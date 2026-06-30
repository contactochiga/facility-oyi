"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Cpu,
  ShieldAlert,
  Users,
  Wallet,
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
import OisOperationalStrip from "@/components/ois/OisOperationalStrip";
import { useContextStore } from "@/store/useContextStore";

type LoadStatus = "loading" | "ready" | "error" | "permission";
type Source<T> = { status: LoadStatus; data: T; message?: string };

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
    <section className="rounded-[18px] border border-white/[0.06] bg-white/[0.024] p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-zinc-100">{title}</h2>
          {subtitle ? <p className="mt-1 text-[11px] leading-4 text-zinc-500">{subtitle}</p> : null}
        </div>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function SourceMessage({ value, empty }: { value: Source<unknown>; empty: string }) {
  const label = statusLabel(value);
  return (
    <div className="rounded-[16px] border border-dashed border-white/[0.08] bg-black/15 px-3 py-3 text-sm text-zinc-500">
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

function greetingForHour(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

function OverviewPage() {
  const { user } = useSessionStore();
  const { context, loading: contextLoading } = useContextStore();
  const [sources, setSources] = useState<OverviewSources>(emptySources);
  const [estateName, setEstateName] = useState("");
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

    setEstateName(activeEstate?.name || (user as any)?.estate_name || "");
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

  const resolvedEstateName = String(context?.estate?.name || estateName || "").trim();
  const greeting = resolvedEstateName ? `${greetingForHour()}, ${resolvedEstateName.toUpperCase()} 👋` : `${greetingForHour()} 👋`;
  const intelligenceBrief =
    !resolvedEstateName && contextLoading
      ? "Loading estate context..."
      : pendingVisitors.length
      ? `${pendingVisitors.length} visitor access action${pendingVisitors.length === 1 ? "" : "s"} require review.`
      : attention.length
      ? `${attention.length} operational action${attention.length === 1 ? "" : "s"} require review.`
      : openMaintenance.length
      ? `${openMaintenance.length} maintenance item${openMaintenance.length === 1 ? "" : "s"} remain active.`
      : "No urgent operational action is blocking the estate right now.";
  const highestPriority =
    attention[0]?.title
      ? `Highest priority: ${attention[0].title}.`
      : pendingVisitors[0]?.visitor_name
      ? `Highest priority: ${pendingVisitors[0].visitor_name} visitor access verification.`
      : !resolvedEstateName && contextLoading
      ? "Loading estate context..."
      : awarenessStatus === "loading"
      ? "Refreshing Oyi intelligence."
      : backendAwareness?.headline || displayedFacilityAwareness;
  const peoplePostureLabel = statusLabel(communicationSource) || (communicationSource.data?.postureState === "attention" ? "Attention" : communicationSource.data?.postureState === "stable" ? "Stable" : communicationSource.data?.postureState === "limited" ? "Limited" : "Unavailable");
  const securityPostureLabel = attention.some((item) => item.domain === "Security") ? "Review" : "Stable";
  const infrastructurePostureLabel = offlineDevices.length ? `${offlineDevices.length} Attention` : "Stable";
  const financePostureLabel = (sources.overview.data as any)?.wallet?.outstanding_dues ? "Due" : "Stable";
  return (
    <div className="space-y-3 overflow-x-hidden pb-6 sm:space-y-4 lg:space-y-5 sm:overflow-visible sm:pb-0">
      <div className="hidden sm:block">
        <Topbar title="Facility Overview" subtitle="Operational attention center" />
      </div>

      {needsEstate ? (
        <Panel title="No estate context linked" subtitle="Create an estate context before opening operational workflows.">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShowCreate(true)}>Create Estate</Button>
            <Button variant="ghost" onClick={load}>Retry Context</Button>
          </div>
        </Panel>
      ) : null}

      <section className="rounded-[18px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.024),rgba(255,255,255,0.01))] p-3 sm:p-3.5">
        <div className="grid gap-2">
          <div>
            <h2 className="text-[1.05rem] font-semibold tracking-[-0.035em] text-white sm:text-[1.28rem]">{greeting}</h2>
            <p className="mt-2 max-w-3xl text-[13px] leading-5 text-zinc-200">{intelligenceBrief}</p>
            <p className="mt-1 max-w-3xl text-[12px] leading-5 text-zinc-500">{highestPriority}</p>
          </div>
        </div>
      </section>

      <OisOperationalStrip
        items={[
          { label: "Attention", value: loading ? "—" : attention.length, tone: "warning" },
          { label: "Verification", value: loading ? "—" : verificationSummary.pending + verificationSummary.overdue + verificationSummary.failed, tone: "attention" },
          { label: "Escalated", value: loading ? "—" : workflowMetrics.escalated, tone: "critical" },
          { label: "Overdue", value: loading ? "—" : workflowMetrics.overdue, tone: "warning" },
        ]}
      />

      <div className="grid gap-3 xl:grid-cols-12 xl:items-stretch">
        <div className="xl:col-span-5">
          <Panel title="Attention Stack" subtitle="The five highest-ranked items requiring review.">
              {attention.length ? (
                <div className="space-y-1">
                  {attention.map((item) => (
                    <Link key={item.id} href={item.href} className="block">
                      <OisListItem
                        className="gap-2"
                        title={<span className="block truncate text-sm font-medium text-zinc-100">{item.title}</span>}
                        description={<span className="text-[11px] text-zinc-400">{item.action}</span>}
                        meta={<span className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">{item.domain}</span>}
                        action={<OisStatusBadge status={item.severity === "critical" ? "critical" : item.severity === "warning" ? "warning" : "attention"} label={item.severity} className="px-1.5 py-px text-[10px] uppercase opacity-85" />}
                      />
                    </Link>
                  ))}
                </div>
              ) : (
                <SourceMessage value={attentionSource} empty="No critical attention required." />
              )}
          </Panel>
        </div>
        <div className="grid gap-3 xl:col-span-7 xl:grid-cols-2">
          <OperatorQueue limit={5} />
          <VerificationQueue limit={5} onSummary={setVerificationSummary} />
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-12 xl:items-stretch">
        <div className="xl:col-span-7">
          <FacilityIntelligenceExposure onMetrics={setWorkflowMetrics} />
        </div>
        <div className="xl:col-span-5">
          <Panel title="Operational Posture" subtitle="People, security, infrastructure, and finance.">
            <div className="space-y-1">
              {[
                { label: "People", value: peoplePostureLabel, tone: communicationSource.data?.postureState === "attention" ? "attention" : communicationSource.data?.postureState === "stable" ? "stable" : communicationSource.data?.postureState === "limited" ? "warning" : "unavailable", icon: <Users className="h-4 w-4 text-sky-200/75" /> },
                { label: "Security", value: securityPostureLabel, tone: securityPostureLabel === "Review" ? "warning" : "stable", icon: <ShieldAlert className="h-4 w-4 text-sky-200/75" /> },
                { label: "Infrastructure", value: infrastructurePostureLabel, tone: offlineDevices.length ? "warning" : "stable", icon: <Cpu className="h-4 w-4 text-sky-200/75" /> },
                { label: "Finance", value: financePostureLabel, tone: financePostureLabel === "Due" ? "warning" : "stable", icon: <Wallet className="h-4 w-4 text-sky-200/75" /> },
              ].map((item) => (
                <OisListItem
                  key={item.label}
                  title={<span className="text-sm text-white">{item.label}</span>}
                  description={<span className="text-[11px] text-zinc-500">Current posture</span>}
                  meta={<span className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">{item.label}</span>}
                  icon={item.icon}
                  action={<OisStatusBadge status={item.tone as any} label={item.value} className="px-1.5 py-px text-[10px] opacity-85" />}
                  className="gap-2"
                />
              ))}
            </div>
          </Panel>
        </div>
      </div>

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

export default OverviewPage;
