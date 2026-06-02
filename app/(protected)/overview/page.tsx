"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Camera,
  ChevronRight,
  CircleHelp,
  DoorOpen,
  Home,
  MonitorCog,
  RefreshCw,
  Router,
  ShieldAlert,
  Siren,
  UserPlus,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import API from "@/services/api";
import { facilityService, type HomeInviteRow } from "@/services/facilityService";
import { useSessionStore } from "@/store/useSessionStore";
import type { FacilityOverview } from "@/types/facility";

type LoadStatus = "loading" | "ready" | "error" | "permission";
type Source<T> = { status: LoadStatus; data: T; message?: string };
type Severity = "critical" | "warning" | "info";
type AttentionItem = {
  id: string;
  severity: Severity;
  domain: string;
  title: string;
  detail: string;
  href: string;
  action: string;
  time?: string | null;
};

type OverviewSources = {
  overview: Source<FacilityOverview | null>;
  homes: Source<any[]>;
  devices: Source<any[]>;
  maintenance: Source<any[]>;
  visitors: Source<any[]>;
  notifications: Source<any[]>;
  cameras: Source<any[]>;
  reports: Source<any[]>;
  community: Source<any[]>;
  invites: Source<HomeInviteRow[]>;
};

function source<T>(data: T, status: LoadStatus = "loading", message?: string): Source<T> {
  return { data, status, message };
}

function emptySources(): OverviewSources {
  return {
    overview: source<FacilityOverview | null>(null),
    homes: source<any[]>([]),
    devices: source<any[]>([]),
    maintenance: source<any[]>([]),
    visitors: source<any[]>([]),
    notifications: source<any[]>([]),
    cameras: source<any[]>([]),
    reports: source<any[]>([]),
    community: source<any[]>([]),
    invites: source<HomeInviteRow[]>([]),
  };
}

function errorSource<T>(error: any, fallback: T): Source<T> {
  const code = Number(error?.response?.status || 0);
  const message = String(
    error?.response?.data?.error ||
      error?.response?.data?.message ||
      error?.message ||
      "Source unavailable"
  );
  return source(fallback, code === 401 || code === 403 ? "permission" : "error", message);
}

async function loadSource<T>(request: Promise<T>, fallback: T): Promise<Source<T>> {
  try {
    return source(await request, "ready");
  } catch (error) {
    return errorSource(error, fallback);
  }
}

function listFrom(data: any, keys: string[]) {
  if (Array.isArray(data)) return data;
  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return [];
}

function dateLabel(value?: string | null) {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return date.toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(sourceState: Source<unknown>) {
  if (sourceState.status === "loading") return "Loading source";
  if (sourceState.status === "permission") return "Permission required";
  if (sourceState.status === "error") return "Pending source";
  return null;
}

function SummaryCard({
  label,
  value,
  hint,
  href,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  hint: string;
  href: string;
  tone?: "neutral" | "good" | "warn";
}) {
  const color =
    tone === "good"
      ? "border-emerald-500/20 bg-emerald-500/[0.07]"
      : tone === "warn"
      ? "border-amber-500/20 bg-amber-500/[0.07]"
      : "border-white/10 bg-white/[0.035]";
  return (
    <Link
      href={href}
      className={`rounded-2xl border p-4 transition hover:border-sky-400/30 hover:bg-white/[0.055] ${color}`}
    >
      <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{label}</div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-white">{value}</div>
      <div className="mt-2 text-xs leading-5 text-zinc-500">{hint}</div>
    </Link>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
      {subtitle ? <p className="mt-1 text-xs leading-5 text-zinc-500">{subtitle}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SourceMessage({ value, empty }: { value: Source<unknown>; empty: string }) {
  const label = statusLabel(value);
  return (
    <div className="rounded-xl border border-dashed border-white/10 bg-black/15 px-3 py-3 text-sm text-zinc-500">
      {label || empty}
    </div>
  );
}

function severityClass(severity: Severity) {
  if (severity === "critical") return "border-red-500/25 bg-red-500/[0.08] text-red-200";
  if (severity === "warning") return "border-amber-500/25 bg-amber-500/[0.08] text-amber-200";
  return "border-sky-500/20 bg-sky-500/[0.07] text-sky-200";
}

function isClosed(value?: string) {
  return ["closed", "completed", "resolved", "cancelled"].includes(String(value || "").toLowerCase());
}

function isOffline(device: any) {
  const state = String(device?.status || device?.state?.status || "").toLowerCase();
  return (
    device?.online === false ||
    device?.metadata?.online === false ||
    ["offline", "unavailable", "error", "disconnected"].some((word) => state.includes(word))
  );
}

function OverviewPage() {
  const { user } = useSessionStore();
  const [sources, setSources] = useState<OverviewSources>(emptySources);
  const [estateName, setEstateName] = useState("Estate context");
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsEstate, setNeedsEstate] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [estateForm, setEstateForm] = useState({ name: "", address: "", type: "estate" });

  const load = useCallback(async () => {
    setLoading(true);
    setSources(emptySources());

    const [overviewState, estatesState] = await Promise.all([
      loadSource(facilityService.overview(), null),
      loadSource(facilityService.myEstates(), { estates: [] }),
    ]);
    const overviewEstateId = overviewState.data?.estate_id || null;
    const memberships = estatesState.data.estates || [];
    const activeEstate = memberships.find((item) => item.id === overviewEstateId) || memberships[0];
    const nextEstateId = overviewEstateId || activeEstate?.id || user?.estate_id || null;

    setEstateName(activeEstate?.name || (user as any)?.estate_name || "Estate context");
    setNeedsEstate(!nextEstateId);

    if (!nextEstateId) {
      setSources({ ...emptySources(), overview: overviewState });
      setLoading(false);
      setLastRefresh(new Date().toISOString());
      return;
    }

    const [homes, devices, maintenance, visitors, notifications, cameras, reports, community] =
      await Promise.all([
        loadSource(facilityService.listHomes(nextEstateId).then((res) => res.homes || []), []),
        loadSource(API.get("/facility/devices").then((res) => listFrom(res.data, ["devices", "items"])), []),
        loadSource(API.get("/facility/maintenance").then((res) => listFrom(res.data, ["requests", "items"])), []),
        loadSource(API.get("/facility/visitors", { params: { today: true } }).then((res) => listFrom(res.data, ["visitors", "items"])), []),
        loadSource(API.get("/notifications", { params: { unread: true } }).then((res) => listFrom(res.data, ["items", "data"])), []),
        loadSource(API.get(`/cameras/estate/${encodeURIComponent(nextEstateId)}`).then((res) => listFrom(res.data, ["items", "cameras"])), []),
        loadSource(API.get("/messages/mod/reports", { params: { status: "open", limit: 40 } }).then((res) => listFrom(res.data, ["reports", "items"])), []),
        loadSource(API.get(`/community/posts/estate/${encodeURIComponent(nextEstateId)}`).then((res) => listFrom(res.data, ["posts", "items"])), []),
      ]);

    let invites: Source<HomeInviteRow[]> = source([], homes.status === "ready" ? "ready" : homes.status);
    if (homes.status === "ready" && homes.data.length) {
      const inviteRequests = await Promise.allSettled(
        homes.data.map((home) => facilityService.listHomeUsers(String(home.id)))
      );
      const accepted = inviteRequests
        .filter((result): result is PromiseFulfilledResult<any> => result.status === "fulfilled")
        .flatMap((result) => result.value?.invites || []);
      invites =
        accepted.length || inviteRequests.some((result) => result.status === "fulfilled")
          ? source(accepted, "ready")
          : errorSource((inviteRequests[0] as PromiseRejectedResult)?.reason, []);
    }

    setSources({
      overview: overviewState,
      homes,
      devices,
      maintenance,
      visitors,
      notifications,
      cameras,
      reports,
      community,
      invites,
    });
    setLoading(false);
    setLastRefresh(new Date().toISOString());
  }, [user]);

  useEffect(() => {
    load();
    const onRealtime = (event: Event) => {
      const name = (event as CustomEvent)?.detail?.event || "";
      if (/device|edge|visitor|maintenance|notification|office|camera|incident|audit|community|message/.test(name)) void load();
    };
    window.addEventListener("facility:realtime-event", onRealtime);
    return () => window.removeEventListener("facility:realtime-event", onRealtime);
  }, [load]);

  const openMaintenance = sources.maintenance.data.filter((item) => !isClosed(item?.status));
  const activeVisitors = sources.visitors.data.filter((item) =>
    ["active", "approved", "entered", "pending"].includes(String(item?.status || "").toLowerCase())
  );
  const pendingVisitors = sources.visitors.data.filter(
    (item) => String(item?.status || "").toLowerCase() === "pending"
  );
  const offlineDevices = sources.devices.data.filter(isOffline);
  const pendingInvites = sources.invites.data.filter(
    (item) => String(item?.status || "").toLowerCase() === "pending"
  );
  const expiredInvites = sources.invites.data.filter((item) => {
    const expiry = item?.expires_at ? new Date(item.expires_at).getTime() : 0;
    return String(item?.status || "").toLowerCase() === "expired" || (!!expiry && expiry < Date.now());
  });

  const attention = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];
    for (const item of sources.notifications.data) {
      const text = `${item?.title || ""} ${item?.message || ""}`.toLowerCase();
      const critical = /security|breach|emergency|critical|lockdown/.test(text);
      items.push({
        id: `notification-${item.id}`,
        severity: critical ? "critical" : "warning",
        domain: critical ? "Security" : "Notification",
        title: item.title || "Unread operational notification",
        detail: item.message || "Review this notification.",
        href: "/alerts",
        action: "Review alert",
        time: item.created_at,
      });
    }
    for (const item of offlineDevices) {
      items.push({
        id: `device-${item.id}`,
        severity: "warning",
        domain: "Device registry",
        title: `${item.name || item.label || "Device"} requires attention`,
        detail: item.room_name || item.home_name || "Review device connectivity and assignment.",
        href: "/devices",
        action: "Review device",
        time: item.updated_at || item.created_at,
      });
    }
    for (const item of openMaintenance) {
      items.push({
        id: `maintenance-${item.id}`,
        severity: String(item.priority || "").toLowerCase() === "urgent" ? "critical" : "warning",
        domain: "Maintenance",
        title: item.title || "Open maintenance request",
        detail: item.status || "Awaiting assignment",
        href: "/maintenance",
        action: "Open request",
        time: item.created_at,
      });
    }
    for (const item of pendingVisitors) {
      items.push({
        id: `visitor-${item.id}`,
        severity: "info",
        domain: "Visitor access",
        title: `${item.visitor_name || item.full_name || "Visitor"} is awaiting review`,
        detail: item.purpose || "Visitor approval pending",
        href: "/visitors",
        action: "Verify visitor",
        time: item.created_at,
      });
    }
    for (const item of sources.reports.data) {
      items.push({
        id: `report-${item.id}`,
        severity: "warning",
        domain: "Community moderation",
        title: item.reason || "Community report requires review",
        detail: item.status || "Open report",
        href: "/messages",
        action: "Review report",
        time: item.created_at,
      });
    }
    for (const item of expiredInvites) {
      items.push({
        id: `invite-${item.id}`,
        severity: "info",
        domain: "Resident access",
        title: `${item.invited_email || "Resident"} invitation expired`,
        detail: "Rotate and resend the invitation if access is still required.",
        href: "/homes",
        action: "Manage invites",
        time: item.expires_at,
      });
    }
    const rank: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
    return items.sort((a, b) => rank[a.severity] - rank[b.severity]).slice(0, 12);
  }, [expiredInvites, offlineDevices, openMaintenance, pendingVisitors, sources.notifications.data, sources.reports.data]);

  const unresolvedSourceCount = Object.values(sources).filter(
    (item) => item.status === "error" || item.status === "permission"
  ).length;
  const estateState = loading
    ? "Refreshing"
    : attention.some((item) => item.severity === "critical")
    ? "Attention"
    : attention.length
    ? "Monitor"
    : unresolvedSourceCount
    ? "Awaiting sources"
    : "Stable";

  async function createEstate() {
    if (estateForm.name.trim().length < 2) return;
    setCreating(true);
    setModalError(null);
    try {
      await facilityService.createEstate({
        name: estateForm.name.trim(),
        address: estateForm.address.trim() || undefined,
        type: estateForm.type,
      });
      setShowCreate(false);
      setEstateForm({ name: "", address: "", type: "estate" });
      await load();
    } catch (error: any) {
      setModalError(String(error?.response?.data?.error || error?.message || "Unable to create site."));
    } finally {
      setCreating(false);
    }
  }

  const metric = (value: number, sourceState: Source<unknown>) =>
    statusLabel(sourceState) || String(value);

  return (
    <div className="space-y-5 sm:space-y-6">
      <Topbar
        title="Facility Overview"
        subtitle="Estate health, attention, and staff action queue"
        rightSlot={
          <Button variant="ghost" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{loading ? "Refreshing" : "Refresh"}</span>
          </Button>
        }
      />

      <section className="rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.12),transparent_30%),linear-gradient(145deg,rgba(255,255,255,0.055),rgba(255,255,255,0.018))] p-4 sm:p-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-sky-200/80">Active estate context</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">{estateName}</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Operator role: <span className="text-zinc-200">{String(user?.role || "operator").replace(/_/g, " ")}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
              Estate state: <span className="text-zinc-200">{estateState}</span>
            </span>
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
              Refreshed: <span className="text-zinc-200">{dateLabel(lastRefresh)}</span>
            </span>
          </div>
        </div>
      </section>

      {needsEstate ? (
        <Panel title="No estate context linked" subtitle="Create an estate context before opening operational workflows.">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShowCreate(true)}>Create Estate</Button>
            <Button variant="ghost" onClick={load}>Retry Context</Button>
          </div>
        </Panel>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <SummaryCard label="Estate state" value={estateState} hint="Derived from available operational sources" href="/alerts" tone={attention.length ? "warn" : "good"} />
        <SummaryCard label="Open maintenance" value={metric(openMaintenance.length, sources.maintenance)} hint="Requests not yet resolved" href="/maintenance" tone={openMaintenance.length ? "warn" : "neutral"} />
        <SummaryCard label="Active visitors" value={metric(activeVisitors.length, sources.visitors)} hint="Today's active access records" href="/visitors" />
        <SummaryCard label="Device attention" value={metric(offlineDevices.length, sources.devices)} hint="Offline or unavailable registry entries" href="/devices" tone={offlineDevices.length ? "warn" : "neutral"} />
        <SummaryCard label="Unread notices" value={metric(sources.notifications.data.length, sources.notifications)} hint="Operator notification queue" href="/alerts" />
        <SummaryCard label="Community reports" value={metric(sources.reports.data.length, sources.reports)} hint="Open moderation queue items" href="/messages" />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Maintenance posture"
          value={metric(openMaintenance.length, sources.maintenance)}
          hint={sources.maintenance.status === "ready" ? "Open work orders requiring operations" : "Pending maintenance source"}
          href="/maintenance"
          tone={openMaintenance.length ? "warn" : "good"}
        />
        <SummaryCard
          label="Utility posture"
          value={statusLabel(sources.devices) || "Registry source"}
          hint="Utility telemetry remains explicit inside Utilities"
          href="/utilities"
          tone={offlineDevices.length ? "warn" : "neutral"}
        />
        <SummaryCard
          label="Wallet posture"
          value={
            sources.overview.status === "ready"
              ? String((sources.overview.data as any)?.wallet?.outstanding_dues ? "Outstanding due" : "Available")
              : statusLabel(sources.overview) || "Pending source"
          }
          hint="Finance posture from Facility overview wallet source"
          href="/wallets"
          tone={(sources.overview.data as any)?.wallet?.outstanding_dues ? "warn" : "neutral"}
        />
        <SummaryCard
          label="Service readiness"
          value={sources.overview.status === "ready" ? "Review services" : statusLabel(sources.overview) || "Pending source"}
          hint="Resident-facing services are managed in Services"
          href="/services"
          tone="neutral"
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          label="Community posture"
          value={metric(sources.community.data.length, sources.community)}
          hint="Published and operational resident communications"
          href="/community"
          tone="neutral"
        />
        <SummaryCard
          label="Communication posture"
          value={metric(sources.reports.data.length, sources.reports)}
          hint="Resident communication reports requiring review"
          href="/messages"
          tone={sources.reports.data.length ? "warn" : "good"}
        />
        <SummaryCard
          label="Moderation posture"
          value={metric(sources.reports.data.length, sources.reports)}
          hint="Open reports from real moderation source"
          href="/community"
          tone={sources.reports.data.length ? "warn" : "good"}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(310px,0.55fr)]">
        <Panel title="Attention Queue" subtitle="Ranked work requiring operator review across connected operational sources.">
          {attention.length ? (
            <div className="space-y-2">
              {attention.map((item) => (
                <Link key={item.id} href={item.href} className="flex gap-3 rounded-xl border border-white/10 bg-black/15 p-3 transition hover:border-sky-400/25 hover:bg-white/[0.045]">
                  <span className={`mt-0.5 h-fit rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.12em] ${severityClass(item.severity)}`}>
                    {item.severity}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs uppercase tracking-[0.14em] text-zinc-500">{item.domain}</span>
                    <span className="mt-1 block text-sm font-medium text-zinc-100">{item.title}</span>
                    <span className="mt-1 block text-xs leading-5 text-zinc-500">{item.detail} · {dateLabel(item.time)}</span>
                  </span>
                  <span className="hidden shrink-0 self-center text-xs text-sky-200 sm:block">{item.action}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 self-center text-zinc-600" />
                </Link>
              ))}
            </div>
          ) : (
            <SourceMessage value={sources.notifications} empty="No critical attention required." />
          )}
        </Panel>

        <Panel title="Quick Actions" subtitle="Open the real workflow before taking operational action.">
          <div className="grid gap-2">
            {[
              ["Add Home", "/homes", Home],
              ["Invite Resident", "/homes", UserPlus],
              ["Discover Device", "/devices", Router],
              ["Verify Visitor", "/visitors", DoorOpen],
              ["Open Camera Center", "/cameras", Camera],
              ["Open Maintenance", "/maintenance", Wrench],
            ].map(([label, href, Icon]) => (
              <Link key={String(label)} href={String(href)} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-sm text-zinc-300 transition hover:border-sky-400/25 hover:bg-white/[0.05] hover:text-white">
                <Icon className="h-4 w-4 text-sky-200" />
                <span className="flex-1">{String(label)}</span>
                <ChevronRight className="h-4 w-4 text-zinc-600" />
              </Link>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <Panel title="Resident Operations" subtitle="Home access and pending resident activation work.">
          <div className="grid grid-cols-3 gap-2">
            <SummaryCard label="Homes" value={metric(sources.homes.data.length, sources.homes)} hint="Active context" href="/homes" />
            <SummaryCard label="Pending" value={metric(pendingInvites.length, sources.invites)} hint="Invites" href="/homes" />
            <SummaryCard label="Expired" value={metric(expiredInvites.length, sources.invites)} hint="Need review" href="/homes" />
          </div>
        </Panel>

        <Panel title="Infrastructure Posture" subtitle="Registry and camera readiness without synthetic telemetry.">
          <div className="space-y-2">
            <PostureRow icon={Zap} label="Device registry" value={statusLabel(sources.devices) || `${sources.devices.data.length - offlineDevices.length} online · ${offlineDevices.length} attention`} />
            <PostureRow icon={Camera} label="Camera inventory" value={statusLabel(sources.cameras) || `${sources.cameras.data.length} bound · health telemetry pending`} />
            <PostureRow icon={MonitorCog} label="Oyi Edge" value="No live source configured" />
            <PostureRow icon={CircleHelp} label="Utilities" value="Awaiting telemetry" />
          </div>
        </Panel>

        <Panel title="Security And Visitors" subtitle="Today's resident access posture.">
          <div className="space-y-2">
            <PostureRow icon={Users} label="Active visitors" value={statusLabel(sources.visitors) || String(activeVisitors.length)} />
            <PostureRow icon={ShieldAlert} label="Pending approvals" value={statusLabel(sources.visitors) || String(pendingVisitors.length)} />
            <PostureRow icon={Siren} label="Lockdown status" value="No live source configured" />
            <Link href="/visitors" className="mt-3 inline-flex items-center gap-2 text-sm text-sky-200 hover:text-sky-100">
              Open visitor access <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel title="Staff Action Queue" subtitle="High-signal tasks from the current attention queue.">
          {attention.length ? (
            <div className="grid gap-2 md:grid-cols-2">
              {attention.slice(0, 6).map((item) => (
                <Link key={`staff-${item.id}`} href={item.href} className="rounded-xl border border-white/10 bg-black/15 px-3 py-3 text-sm text-zinc-300 transition hover:border-sky-400/25">
                  <span className="block text-xs uppercase tracking-[0.12em] text-zinc-500">{item.domain}</span>
                  <span className="mt-1 block text-zinc-100">{item.action}</span>
                  <span className="mt-1 block truncate text-xs text-zinc-500">{item.title}</span>
                </Link>
              ))}
            </div>
          ) : (
            <SourceMessage value={sources.maintenance} empty="No staff actions are queued." />
          )}
        </Panel>
        <Panel title="Source Integrity" subtitle="Unavailable sources stay visible instead of becoming synthetic zeroes.">
          <div className="space-y-2">
            {Object.entries(sources).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/15 px-3 py-2 text-xs">
                <span className="capitalize text-zinc-400">{key}</span>
                <span className={value.status === "ready" ? "text-emerald-200" : value.status === "loading" ? "text-sky-200" : "text-amber-200"}>
                  {value.status === "ready" ? "Available" : statusLabel(value)}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      {showCreate ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-950 p-5 shadow-2xl">
            <h2 className="text-lg font-semibold text-white">Create Estate</h2>
            <p className="mt-1 text-sm text-zinc-500">Register the estate context before adding homes and residents.</p>
            {modalError ? <p className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">{modalError}</p> : null}
            <div className="mt-4 grid gap-3">
              <input value={estateForm.name} onChange={(event) => setEstateForm((current) => ({ ...current, name: event.target.value }))} placeholder="Estate name" className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none focus:border-sky-400/40" />
              <input value={estateForm.address} onChange={(event) => setEstateForm((current) => ({ ...current, address: event.target.value }))} placeholder="Address (optional)" className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none focus:border-sky-400/40" />
              <select value={estateForm.type} onChange={(event) => setEstateForm((current) => ({ ...current, type: event.target.value }))} className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-3 text-sm text-white outline-none focus:border-sky-400/40">
                <option value="estate">Estate</option>
                <option value="facility">Facility</option>
                <option value="campus">Campus</option>
              </select>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setShowCreate(false)} disabled={creating}>Cancel</Button>
                <Button onClick={createEstate} disabled={creating || estateForm.name.trim().length < 2}>{creating ? "Creating" : "Create Estate"}</Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PostureRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof AlertTriangle;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/15 px-3 py-2.5">
      <Icon className="h-4 w-4 shrink-0 text-sky-200" />
      <span className="min-w-0 flex-1 text-sm text-zinc-400">{label}</span>
      <span className="text-right text-xs text-zinc-300">{value}</span>
    </div>
  );
}

export default OverviewPage;
