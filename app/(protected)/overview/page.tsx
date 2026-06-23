"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  Brain,
  Camera,
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
import OisListItem from "@/components/ois/OisListItem";
import OisStatusBadge from "@/components/ois/OisStatusBadge";
import API from "@/services/api";
import { facilityService, type HomeInviteRow } from "@/services/facilityService";
import { loadFacilityAttention, type FacilityAttentionItem } from "@/services/facilityAttentionService";
import { loadFacilityCommunicationPosture, type FacilityCommunicationPosture } from "@/services/facilityCommunicationPostureService";
import { oyiService, type OyiAwareness } from "@/services/oyiService";
import { useSessionStore } from "@/store/useSessionStore";
import type { FacilityOverview } from "@/types/facility";
import OperatorQueue from "@/components/modules/OperatorQueue";
import ShiftHandover from "@/components/modules/ShiftHandover";
import FacilityIntelligenceExposure from "@/components/modules/FacilityIntelligenceExposure";
import VerificationQueue from "@/components/modules/VerificationQueue";
import UnifiedInfrastructurePosture from "@/components/modules/UnifiedInfrastructurePosture";

type LoadStatus = "loading" | "ready" | "error" | "permission";
type Source<T> = { status: LoadStatus; data: T; message?: string };

type MobileMetricItem = {
  label: string;
  value: string | number;
  icon: ComponentType<{ className?: string }>;
  color?: string;
  href?: string;
};

type MobileQuickActionItem = {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  iconClass?: string;
};

type OverviewSources = {
  overview: Source<FacilityOverview | null>;
  homes: Source<any[]>;
  devices: Source<any[]>;
  maintenance: Source<any[]>;
  visitors: Source<any[]>;
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
  className = "",
}: {
  label: string;
  value: string | number;
  hint: string;
  href: string;
  tone?: "neutral" | "good" | "warn";
  className?: string;
}) {
  const color =
    tone === "good"
      ? "border-emerald-500/12 bg-emerald-500/[0.035]"
      : tone === "warn"
      ? "border-amber-500/12 bg-amber-500/[0.035]"
      : "border-white/10 bg-white/[0.035]";
  return (
    <Link
      href={href}
      className={`rounded-[20px] border p-3 transition hover:border-sky-400/30 hover:bg-white/[0.055] sm:rounded-2xl sm:p-4 ${color} ${className}`}
    >
      <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-600">{label}</div>
      <div className="mt-2 text-xl font-semibold tracking-tight text-white sm:mt-3 sm:text-2xl">{value}</div>
      <div className="mt-1.5 text-[11px] leading-4 text-zinc-600 sm:mt-2 sm:text-xs sm:leading-5">{hint}</div>
    </Link>
  );
}

function PeopleCommunicationCard({
  posture,
  sourceState,
}: {
  posture: FacilityCommunicationPosture | null;
  sourceState: Source<FacilityCommunicationPosture | null>;
}) {
  const state = posture?.postureState || "unavailable";
  const tone =
    state === "attention"
      ? "border-amber-500/12 bg-amber-500/[0.035]"
      : state === "stable"
      ? "border-emerald-500/12 bg-emerald-500/[0.035]"
      : "border-white/10 bg-white/[0.035]";
  const label =
    state === "attention"
      ? "Attention"
      : state === "stable"
      ? "Stable"
      : state === "limited"
      ? "Limited"
      : "Unavailable";
  const supportHref = "/facility-intelligence?module=support";
  const sourceLabel = statusLabel(sourceState);

  return (
    <div className={`rounded-[20px] border p-3 sm:rounded-2xl sm:p-4 ${tone}`}>
      <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-600">People</div>
      <div className="mt-2 text-xl font-semibold tracking-tight text-white sm:mt-3 sm:text-2xl">{label}</div>
      <div className="mt-1.5 text-[11px] leading-4 text-zinc-600 sm:mt-2 sm:text-xs sm:leading-5">
        {sourceLabel || "Communication posture from shared message and community ownership."}
      </div>
      <div className="mt-3 space-y-1.5">
        <Link href="/messages" className="flex items-center justify-between rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-[11px] text-zinc-300 transition hover:border-sky-400/25 hover:bg-white/[0.045]">
          <span>Unread Messages</span>
          <span className="text-zinc-500">{posture?.unreadMessages ?? "—"}</span>
        </Link>
        <Link href="/messages" className="flex items-center justify-between rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-[11px] text-zinc-300 transition hover:border-sky-400/25 hover:bg-white/[0.045]">
          <span>Unread Resident Threads</span>
          <span className="text-zinc-500">{posture?.unreadResidentThreads ?? "—"}</span>
        </Link>
        <Link href={supportHref} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-[11px] text-zinc-300 transition hover:border-sky-400/25 hover:bg-white/[0.045]">
          <span>Support Waiting</span>
          <span className="text-zinc-500">{posture?.supportState === "unavailable" ? "Unavailable" : posture?.supportState}</span>
        </Link>
        <Link href="/community" className="flex items-center justify-between rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-[11px] text-zinc-300 transition hover:border-sky-400/25 hover:bg-white/[0.045]">
          <span>Moderation Pending</span>
          <span className="text-zinc-500">{posture?.moderationPending ?? "—"}</span>
        </Link>
      </div>
    </div>
  );
}

function MobileMetricStrip({ items }: { items: MobileMetricItem[] }) {
  return (
    <section className="rounded-[20px] border border-white/[0.07] bg-[linear-gradient(145deg,rgba(255,255,255,0.046),rgba(255,255,255,0.012))] p-2.5 shadow-[0_12px_38px_rgba(0,0,0,0.30)] backdrop-blur-2xl sm:hidden">
      <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const Icon = item.icon;
          const content = (
            <>
              <div className={`mx-auto flex items-center justify-center gap-1.5 ${item.color || "text-sky-300"}`}>
                <Icon className="h-4 w-4" />
                <span className="text-[20px] font-semibold tracking-[-0.05em]">{item.value}</span>
              </div>
              <div className="mt-1 text-[11px] text-white/48">{item.label}</div>
            </>
          );
          const className = "min-w-[86px] shrink-0 snap-start rounded-[16px] border border-white/[0.055] bg-white/[0.026] px-2 py-2 text-center transition hover:border-sky-400/25 hover:bg-white/[0.05]";
          return item.href ? (
            <Link key={item.label} href={item.href} className={className}>
              {content}
            </Link>
          ) : (
            <div key={item.label} className={className}>
              {content}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MobileQuickActionStrip({ items }: { items: MobileQuickActionItem[] }) {
  return (
    <section className="rounded-[20px] border border-white/[0.07] bg-[linear-gradient(145deg,rgba(255,255,255,0.044),rgba(255,255,255,0.012))] p-2.5 shadow-[0_12px_38px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:hidden">
      <div className="flex snap-x gap-2 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const Icon = item.icon;
          const content = (
            <>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[14px] border border-white/[0.07] bg-white/[0.045]">
                <Icon className={`h-4 w-4 ${item.iconClass || "text-sky-300 drop-shadow-[0_0_12px_rgba(56,189,248,0.55)]"}`} />
              </span>
              <span className="min-w-0 text-left">
                <span className="block text-[11px] font-medium text-white/82">{item.label}</span>
                <span className="block max-w-[118px] truncate text-[10px] text-white/42">{item.value}</span>
              </span>
            </>
          );
          const className = "flex min-w-[148px] shrink-0 snap-start items-center gap-2 rounded-[17px] border border-white/[0.055] bg-black/20 px-2.5 py-2 transition hover:border-sky-400/25 hover:bg-white/[0.045] disabled:opacity-50";
          if (item.onClick) {
            return (
              <button key={item.label} type="button" onClick={item.onClick} disabled={item.disabled} className={className}>
                {content}
              </button>
            );
          }
          return (
            <Link key={item.label} href={item.href || "/overview"} className={className}>
              {content}
            </Link>
          );
        })}
      </div>
    </section>
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
    <section className="rounded-[22px] border border-white/10 bg-white/[0.035] p-3 sm:rounded-2xl sm:p-5">
      <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
      {subtitle ? <p className="mt-1 text-xs leading-5 text-zinc-500">{subtitle}</p> : null}
      <div className="mt-3 sm:mt-4">{children}</div>
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
  const [backendAwareness, setBackendAwareness] = useState<OyiAwareness | null>(null);
  const [awarenessStatus, setAwarenessStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [workflowMetrics, setWorkflowMetrics] = useState({ active: 0, overdue: 0, escalated: 0, verification: 0 });
  const [verificationSummary, setVerificationSummary] = useState({ pending: 0, overdue: 0, failed: 0, verifiedToday: 0 });
  const [attentionSource, setAttentionSource] = useState<Source<FacilityAttentionItem[]>>(source([]));
  const [communicationSource, setCommunicationSource] = useState<Source<FacilityCommunicationPosture | null>>(source(null));

  const load = useCallback(async () => {
    setLoading(true);
    setSources(emptySources());
    setAttentionSource(source([], "loading"));
    setCommunicationSource(source(null, "loading"));

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
      setAttentionSource(source([], "ready"));
      setCommunicationSource(source(null, "ready"));
      setBackendAwareness(null);
      setAwarenessStatus("idle");
      setLoading(false);
      setLastRefresh(new Date().toISOString());
      return;
    }

    setAwarenessStatus("loading");
    setBackendAwareness(null);
    const [homes, devices, maintenance, visitors, cameras, reports, community, awareness, attentionState, communicationState] =
      await Promise.all([
        loadSource(facilityService.listHomes(nextEstateId).then((res) => res.homes || []), []),
        loadSource(API.get("/facility/devices").then((res) => listFrom(res.data, ["devices", "items"])), []),
        loadSource(API.get("/facility/maintenance").then((res) => listFrom(res.data, ["requests", "items"])), []),
        loadSource(API.get("/facility/visitors", { params: { today: true } }).then((res) => listFrom(res.data, ["visitors", "items"])), []),
        loadSource(API.get(`/cameras/estate/${encodeURIComponent(nextEstateId)}`).then((res) => listFrom(res.data, ["items", "cameras"])), []),
        loadSource(API.get("/messages/mod/reports", { params: { status: "open", limit: 40 } }).then((res) => listFrom(res.data, ["reports", "items"])), []),
        loadSource(API.get(`/community/posts/estate/${encodeURIComponent(nextEstateId)}`).then((res) => listFrom(res.data, ["posts", "items"])), []),
        oyiService.awareness({ estate_id: nextEstateId }).catch(() => null),
        loadSource(loadFacilityAttention(), []),
        loadSource(loadFacilityCommunicationPosture(nextEstateId), null),
      ]);

    setBackendAwareness(awareness?.headline ? awareness : null);
    setAwarenessStatus(awareness?.headline ? "ready" : "error");
    setAttentionSource(attentionState);
    setCommunicationSource(communicationState);

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

  const attention = attentionSource.data;

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
  const facilityAwareness = attention.length
    ? `${attention.length} item${attention.length === 1 ? "" : "s"} need attention`
    : estateState === "Awaiting sources"
    ? "Operational sources are syncing"
    : "Estate operating normally";
  const displayedFacilityAwareness = awarenessStatus === "loading" ? "Checking Oyi awareness" : backendAwareness?.headline || facilityAwareness;
  const displayedFacilityAction =
    awarenessStatus === "loading"
      ? "Ranking operational signals now."
      : awarenessStatus === "error"
      ? "Oyi awareness is unavailable, showing local operational context."
      : backendAwareness?.recommended_action || backendAwareness?.summary || "Tap a strip below to open the right workflow.";

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
  const mobileMetrics: MobileMetricItem[] = [
    { label: "Estate", value: estateState, icon: ShieldAlert, color: attention.length ? "text-amber-300" : "text-emerald-300", href: "/alerts" },
    { label: "Open", value: metric(openMaintenance.length, sources.maintenance), icon: Wrench, color: openMaintenance.length ? "text-amber-300" : "text-sky-300", href: "/maintenance" },
    { label: "Visitors", value: metric(activeVisitors.length, sources.visitors), icon: Users, color: "text-violet-300", href: "/visitors" },
    { label: "Devices", value: metric(offlineDevices.length, sources.devices), icon: Zap, color: offlineDevices.length ? "text-amber-300" : "text-cyan-300", href: "/devices" },
    { label: "Reports", value: metric(sources.reports.data.length, sources.reports), icon: BarChart3, color: sources.reports.data.length ? "text-amber-300" : "text-blue-300", href: "/messages" },
  ];
  const mobileQuickActions: MobileQuickActionItem[] = [
    { label: "Maintenance", value: openMaintenance.length ? `${openMaintenance.length} open` : "No open work", icon: Wrench, href: "/maintenance", iconClass: "text-amber-300 drop-shadow-[0_0_12px_rgba(251,191,36,0.55)]" },
    { label: "Visitor Access", value: pendingVisitors.length ? `${pendingVisitors.length} awaiting` : activeVisitors.length ? `${activeVisitors.length} active` : "Clear", icon: DoorOpen, href: "/security-access", iconClass: "text-violet-300 drop-shadow-[0_0_12px_rgba(167,139,250,0.55)]" },
    { label: "Security", value: attention.some((item) => item.domain === "Security") ? "Review alert" : "No critical alert", icon: Siren, href: "/security-access", iconClass: "text-red-300 drop-shadow-[0_0_12px_rgba(248,113,113,0.5)]" },
    { label: "Operations", value: sources.reports.data.length ? `${sources.reports.data.length} reports` : "Reports clear", icon: BarChart3, href: "/alerts", iconClass: "text-blue-300 drop-shadow-[0_0_12px_rgba(96,165,250,0.55)]" },
    { label: "Resident Access", value: pendingInvites.length ? `${pendingInvites.length} pending` : "Invites clear", icon: UserPlus, href: "/facility-administration", iconClass: "text-emerald-300 drop-shadow-[0_0_12px_rgba(52,211,153,0.48)]" },
    { label: "Oyi Intelligence", value: attention.length ? "Needs review" : "Estate calm", icon: Brain, href: "/facility-intelligence", iconClass: "text-sky-200 drop-shadow-[0_0_14px_rgba(125,211,252,0.68)]" },
  ];

  return (
    <div className="space-y-4 overflow-x-hidden pb-8 sm:space-y-6 sm:overflow-visible sm:pb-0">
      <div className="flex items-center justify-between gap-3 sm:hidden">
        <div className="min-w-0">
          <h1 className="truncate text-[24px] font-semibold tracking-[-0.055em] text-white">Facility Overview</h1>
          <p className="mt-1 text-xs text-zinc-500">Operational attention center</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={load} disabled={loading} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.045] text-sky-200 shadow-[0_10px_30px_rgba(0,0,0,0.28)] backdrop-blur-2xl disabled:opacity-50" aria-label="Refresh overview">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <Link href="/messages" className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.045] text-sky-200 shadow-[0_10px_30px_rgba(0,0,0,0.28)] backdrop-blur-2xl" aria-label="Open messages">
            <Users className="h-4 w-4" />
          </Link>
          <Link href="/alerts" className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.045] text-sky-200 shadow-[0_10px_30px_rgba(0,0,0,0.28)] backdrop-blur-2xl" aria-label="Open notifications">
            <ShieldAlert className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="hidden sm:block">
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
      </div>

      {needsEstate ? (
        <Panel title="No estate context linked" subtitle="Create an estate context before opening operational workflows.">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShowCreate(true)}>Create Estate</Button>
            <Button variant="ghost" onClick={load}>Retry Context</Button>
          </div>
        </Panel>
      ) : null}

      <section className="rounded-[26px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.14),transparent_32%),linear-gradient(145deg,rgba(255,255,255,0.055),rgba(255,255,255,0.018))] p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[10px] uppercase tracking-[0.16em] text-sky-200/80">Operational Attention Center</p><h2 className="mt-1 text-xl font-semibold text-white">{estateName} is {estateState.toLowerCase()}</h2><p className="mt-2 max-w-2xl text-sm text-zinc-400">{displayedFacilityAction}</p></div><div className="flex flex-wrap gap-2"><Link href="/facility-intelligence?focus=1" className="rounded-lg border border-sky-400/20 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">Ask Oyi</Link><Link href="/facility-intelligence?module=workflows" className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-200">Open Queue</Link><Link href="/alerts" className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-200">Open Incidents</Link></div></div>
        <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">{[["Attention", attention.length, "text-amber-100"],["Overdue", workflowMetrics.overdue, "text-amber-100"],["Escalated", workflowMetrics.escalated, "text-rose-100"],["Verification", verificationSummary.pending + verificationSummary.overdue + verificationSummary.failed, "text-sky-100"]].map(([label, value, color]) => <div key={String(label)} className="rounded-xl border border-white/10 bg-black/20 p-3"><span className="text-xs text-zinc-500">{label}</span><b className={`mt-1 block text-lg ${color}`}>{loading ? "—" : value}</b></div>)}</div>
      </section>

      <Panel title="Attention Stack" subtitle="The five highest-ranked items requiring review.">
          {attention.length ? (
            <div className="space-y-1.5">
              {attention.map((item) => (
                <Link key={item.id} href={item.href} className="block">
                  <OisListItem
                    className="gap-2 p-2"
                    title={<span className="block truncate text-sm font-medium text-zinc-100">{item.title}</span>}
                    meta={<span className="text-[11px] text-zinc-600">{item.domain}</span>}
                    action={<span className="text-[11px] text-zinc-500">{item.action}</span>}
                  />
                </Link>
              ))}
            </div>
          ) : (
            <SourceMessage value={attentionSource} empty="No critical attention required." />
          )}
      </Panel>

      <OperatorQueue limit={5} />

      <VerificationQueue limit={5} onSummary={setVerificationSummary} />

      <FacilityIntelligenceExposure onMetrics={setWorkflowMetrics} />

      <UnifiedInfrastructurePosture />

      <Panel title="Operational Health" subtitle="People, security, infrastructure, and finance posture.">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <PeopleCommunicationCard posture={communicationSource.data} sourceState={communicationSource} />
          <SummaryCard label="Security" value={attention.some((item) => item.domain === "Security") ? "Review" : "Stable"} hint={`${workflowMetrics.verification} verification items`} href="/alerts" tone={attention.some((item) => item.domain === "Security") ? "warn" : "good"} />
          <SummaryCard label="Infrastructure" value={offlineDevices.length ? `${offlineDevices.length} attention` : "Stable"} hint="Devices, cameras, Edge, and utilities" href="/live-infrastructure" tone={offlineDevices.length ? "warn" : "good"} />
          <SummaryCard label="Finance" value={(sources.overview.data as any)?.wallet?.outstanding_dues ? "Due" : "Stable"} hint="Wallet, services, and payment exceptions" href="/wallets" tone={(sources.overview.data as any)?.wallet?.outstanding_dues ? "warn" : "good"} />
        </div>
      </Panel>

      <ShiftHandover />

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
