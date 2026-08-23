"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  CircleDot,
  Cpu,
  LocateFixed,
  Network,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import OisCard from "@/components/ois/OisCard";
import OisDrawer from "@/components/ois/OisDrawer";
import OisListItem from "@/components/ois/OisListItem";
import OisStatusBadge from "@/components/ois/OisStatusBadge";
import { OisPageToolbar, OisRegistryHeader } from "@/components/ois";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import {
  facilityService,
  type InfrastructureDevice,
  type InfrastructureOnboardingCandidate,
  type InfrastructureOnboardingOverview,
  type InfrastructureOnboardingProvider,
  type InfrastructureOperations,
} from "@/services/facilityService";
import { iconForTab } from "@/lib/oisIconRegistry";
import { activitySummary, healthLabel, onlineLabel, providerHealthLabel, statusLabel, toneFromDevice } from "@/lib/deviceRuntimePresentation";

type Tab = "registry" | "discovery" | "assignments" | "providers" | "edge" | "telemetry";

const TABS: Array<{ key: Tab; label: string; icon: typeof Cpu }> = [
  { key: "registry", label: "Registry", icon: iconForTab("registry") },
  { key: "discovery", label: "Discovery", icon: iconForTab("discovery") },
  { key: "assignments", label: "Ownership", icon: iconForTab("assignments") },
  { key: "providers", label: "Provider Readiness", icon: iconForTab("providers") },
  { key: "edge", label: "Oyi Edge", icon: iconForTab("edge") },
  { key: "telemetry", label: "Telemetry", icon: iconForTab("telemetry") },
];

function text(value: any, fallback = "Unavailable") {
  const result = String(value ?? "").trim();
  return result || fallback;
}

function date(value?: string | null) {
  if (!value) return "No live timestamp";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "No live timestamp";
  return parsed.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function tone(status?: string | null) {
  const value = text(status, "unknown").toLowerCase();
  if (["online", "connected", "active", "seen", "success"].includes(value)) return "stable";
  if (["offline", "unreachable", "provider_error", "error", "failed"].includes(value)) return "critical";
  if (["pending_assignment", "pending_configuration", "pending_registration", "unknown"].includes(value)) return "pending";
  return "unavailable";
}

function Status({ value, device }: { value?: string | null; device?: InfrastructureDevice | null }) {
  const status = device ? toneFromDevice(device) : tone(value);
  const label = device
    ? healthLabel(device.health_status || device.provider_health || device.primary_state || value, text(value, "unknown"))
    : text(value, "unknown").replace(/_/g, " ");
  return <OisStatusBadge status={status as any} label={label} className="uppercase tracking-[0.12em]" />;
}

function location(device: InfrastructureDevice) {
  return device.room?.name || device.home?.name || [device.home?.block, device.home?.unit].filter(Boolean).join(" / ") || "Pending assignment";
}

function onboardingTone(value?: string | null) {
  const state = text(value, "unknown").toLowerCase();
  if (["compatible", "ready", "verified", "promoted", "operational", "authenticated", "not_required"].includes(state)) return "stable";
  if (["unsupported", "failed", "verification_failed"].includes(state)) return "critical";
  if (["needs_adapter", "needs_edge", "needs_credentials", "authentication_required", "conditional"].includes(state)) return "pending";
  return "attention";
}

function providerReadiness(provider: InfrastructureOnboardingProvider) {
  if (provider.readiness === "ready") return "Ready";
  if (provider.readiness === "needs_edge") return "Oyi Edge required";
  if (provider.readiness === "needs_credentials") return "Connection required";
  if (provider.readiness === "needs_adapter") return "Adapter required";
  if (provider.readiness === "unsupported") return "Not available yet";
  return text(provider.readiness, "Review").replace(/_/g, " ");
}

export default function HardwareDevicesPage() {
  const [data, setData] = useState<InfrastructureOperations | null>(null);
  const [tab, setTab] = useState<Tab>("registry");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<InfrastructureDevice | null>(null);
  const [detail, setDetail] = useState<InfrastructureDevice | null>(null);
  const [homeId, setHomeId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [saving, setSaving] = useState(false);
  const [onboarding, setOnboarding] = useState<InfrastructureOnboardingOverview | null>(null);
  const [selectedProvider, setSelectedProvider] = useState("tuya");
  const [discovering, setDiscovering] = useState(false);
  const [providerResults, setProviderResults] = useState<Array<Record<string, any>>>([]);
  const [discoveryMessage, setDiscoveryMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [operations, onboardingState] = await Promise.all([
        facilityService.infrastructureOperations(),
        facilityService.infrastructureOnboardingOverview().catch(() => null),
      ]);
      setData(operations);
      setOnboarding(onboardingState);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.error || requestError?.message || "Unable to load infrastructure operations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialTab = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("tab");
    if (TABS.some((item) => item.key === initialTab)) setTab(initialTab as Tab);
    void load();
    const onRealtime = (event: Event) => {
      const name = (event as CustomEvent)?.detail?.event || "";
      if (/device|edge|registry|discovered|audit/.test(name)) void load();
    };
    window.addEventListener("facility:realtime-event", onRealtime);
    const timer = window.setInterval(() => void load(), 30_000);
    return () => {
      window.removeEventListener("facility:realtime-event", onRealtime);
      window.clearInterval(timer);
    };
  }, [load]);

  const registry = data?.registry || [];
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return registry;
    return registry.filter((device) =>
      [device.name, device.type, device.provider, device.external_id, device.oyi_id, location(device)]
        .map((value) => text(value, "").toLowerCase())
        .some((value) => value.includes(needle))
    );
  }, [query, registry]);
  const rooms = useMemo(() => (data?.rooms || []).filter((room) => String(room.home_id || "") === homeId), [data, homeId]);
  const assigned = registry.filter((device) => Boolean(device.home_id));
  const pending = registry.filter((device) => !device.home_id);
  const attention = registry.filter((device) => toneFromDevice(device) === "critical" || toneFromDevice(device) === "pending");
  const onboardingCandidates = onboarding?.latest?.candidates || [];
  const onboardingProviders = onboarding?.providers || [];
  const activeSession = onboarding?.latest?.session || null;

  function openAssignment(device: InfrastructureDevice) {
    setAssigning(device);
    setHomeId(device.home_id || "");
    setRoomId(device.room_id || "");
    setNotice(null);
  }

  async function saveAssignment() {
    if (!assigning) return;
    if (!homeId) {
      setError("Select a home before saving this assignment.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await facilityService.assignFacilityDevice(assigning.id, { home_id: homeId, room_id: roomId || null });
      setAssigning(null);
      setNotice(`${assigning.name} assignment updated.`);
      await load();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.error || requestError?.message || "Unable to assign this device.");
    } finally {
      setSaving(false);
    }
  }

  async function discover() {
    setDiscovering(true);
    setDiscoveryMessage(null);
    setError(null);
    try {
      let session = activeSession;
      if (!session || ["operational", "cancelled", "failed"].includes(session.status)) {
        session = (await facilityService.startInfrastructureOnboarding({ onboarding_type: "infrastructure_discovery" })).session;
      }
      const result = await facilityService.discoverInfrastructure(session.id, { providers: [selectedProvider] });
      setProviderResults(result.provider_results || []);
      const count = result.candidates?.length || 0;
      setDiscoveryMessage(count ? `${count} systems found and staged for review.` : result.provider_results?.[0]?.message || "No new systems were returned by this source.");
      await load();
    } catch (requestError: any) {
      setDiscoveryMessage(requestError?.response?.data?.error || requestError?.message || "Discovery source unavailable.");
    } finally {
      setDiscovering(false);
    }
  }

  async function onboardCandidate(candidate: InfrastructureOnboardingCandidate) {
    if (!activeSession) return;
    setSaving(true);
    setError(null);
    try {
      if (candidate.discovery_status === "classified") {
        await facilityService.importInfrastructureCandidates(activeSession.id, { candidate_ids: [candidate.id] });
      }
      if (!["verified", "promoted"].includes(candidate.discovery_status)) {
        await facilityService.verifyInfrastructureCandidates(activeSession.id, { candidate_ids: [candidate.id], live_read: true });
      }
      const detail = await facilityService.getInfrastructureOnboardingSession(activeSession.id);
      const verified = detail.candidates.find((item) => item.id === candidate.id);
      if (verified?.discovery_status !== "verified" && verified?.discovery_status !== "promoted") {
        const verification = detail.verifications.find((item) => item.candidate_id === candidate.id);
        const failed = Array.isArray(verification?.checks) ? verification.checks.find((check: any) => check.state === "failed") : null;
        throw new Error(failed?.summary || "This system needs attention before it can be added to the registry.");
      }
      if (verified.discovery_status !== "promoted") {
        const result = await facilityService.promoteInfrastructureCandidates(activeSession.id, { candidate_ids: [candidate.id] });
        if (result.failures?.length) throw new Error(result.failures[0]?.message || "Registry promotion could not complete.");
      }
      setNotice(`${candidate.name} verified and added to the canonical registry.`);
      await load();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.error || requestError?.message || "Unable to complete onboarding for this system.");
    } finally {
      setSaving(false);
    }
  }

  async function syncTuya() {
    setSaving(true);
    setError(null);
    try {
      const result = await facilityService.syncFacilityTuya();
      setNotice(`Tuya sync completed. Added ${result.added || 0}, updated ${result.updated || 0}, unavailable ${result.unavailable || 0}.`);
      await load();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.error || requestError?.message || "Unable to synchronize Tuya.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Topbar
        title="Assets"
        subtitle="Registry, discovery and edge operations"
        strip={[
          { label: "Registry", value: loading ? "Loading" : registry.length },
          { label: "Assigned", value: loading ? "Loading" : assigned.length },
          { label: "Pending", value: loading ? "Loading" : pending.length },
          { label: "Attention", value: loading ? "Loading" : attention.length },
          { label: "Edge", value: loading ? "Loading" : data?.edge_nodes?.length || 0 },
          { label: "Health", value: attention.length ? "Review" : "Stable" },
        ]}
      />

      {error ? <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}
      {notice ? <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{notice}</div> : null}

      <nav className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} type="button" onClick={() => setTab(key)} className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs transition ${tab === key ? "border-sky-400/30 bg-sky-500/10 text-sky-100" : "border-white/10 bg-white/[0.035] text-zinc-400 hover:text-white"}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </nav>

      {tab === "registry" ? (
        <OisCard className="p-5">
          <header>
            <OisRegistryHeader title="Device Registry" caption={loading ? "Loading records" : `${filtered.length} records`} />
          </header>
          <div className="mt-4">
            <OisPageToolbar
              searchValue={query}
              onSearchChange={setQuery}
              searchPlaceholder="Search device, provider, location, or registry ID..."
              filterSlot={<div className="flex min-w-max flex-nowrap gap-2">{TABS.slice(0, 4).map(({ key, label }) => <button key={key} type="button" onClick={() => setTab(key)} className={`rounded-xl border px-3 py-2 text-xs transition ${tab === key ? "border-sky-400/30 bg-sky-500/10 text-sky-100" : "border-white/10 bg-white/5 text-zinc-400 hover:text-white"}`}>{label}</button>)}</div>}
              bulkSlot={<Button variant="ghost" onClick={() => setTab("assignments")} className="gap-2"><SlidersHorizontal className="h-4 w-4" />Ownership</Button>}
              onRefresh={() => void load()}
              refreshing={loading}
            />
          </div>
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1100px] text-left text-xs">
              <thead className="text-[10px] uppercase tracking-[0.14em] text-zinc-600"><tr><th className="pb-3">Device</th><th>Type</th><th>Provider</th><th>Oyi ID</th><th>External ID</th><th>Location</th><th>Status</th><th>Last seen</th><th /></tr></thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((device) => (
                  <tr key={device.id} className="text-zinc-300">
                    <td className="py-3 pr-3 font-medium text-white">{device.name}</td><td>{device.type}</td><td>{device.provider}</td>
                    <td className="max-w-36 truncate font-mono text-[11px] text-zinc-500">{device.oyi_id}</td><td className="max-w-40 truncate font-mono text-[11px] text-zinc-500">{device.external_id || "Unavailable"}</td>
                    <td>{location(device)}</td><td><Status value={device.status} device={device} /></td><td>{date(device.last_seen_at)}</td>
                    <td><button type="button" onClick={() => setDetail(device)} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-zinc-300 hover:text-white">Review</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && !loading ? <p className="mt-4 rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">No registered devices match this view.</p> : null}
          </div>
          <div className="mt-4 space-y-2 md:hidden">
            {filtered.map((device) => (
              <OisListItem
                key={device.id}
                title={device.name}
                description={`${location(device)} · ${activitySummary(device, text(device.provider, "Provider unavailable"))}`}
                meta={`Last seen ${date(device.last_seen_at)} · ${providerHealthLabel(device.provider_health, onlineLabel(device, "Unknown"))}`}
                status={toneFromDevice(device) as any}
                action={<ChevronRight className="h-4 w-4 text-[var(--ois-text-muted)]" />}
                onClick={() => setDetail(device)}
                className="w-full text-left"
              />
            ))}
            {!filtered.length && !loading ? <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">No registered devices match this view.</p> : null}
          </div>
        </OisCard>
      ) : null}

      {tab === "discovery" ? (
        <section className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-white">Discover Existing Infrastructure</h2>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-500">Oyi discovers what is already present, checks compatibility, prevents duplicate records, verifies the connection, and adds approved systems to the existing registry.</p>
              </div>
              <Button onClick={() => void discover()} disabled={discovering} className="gap-2"><Search className="h-4 w-4" /> {discovering ? "Discovering" : "Discover Infrastructure"}</Button>
            </div>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {(onboardingProviders.length ? onboardingProviders.filter((provider) => provider.supports_discovery || ["adapter_required", "future"].includes(provider.implementation)).slice(0, 12) : [
                { key: "tuya", label: "Tuya / Smart Life", readiness: "ready" },
                { key: "onvif", label: "ONVIF", readiness: "needs_edge" },
                { key: "ssdp", label: "Local Network", readiness: "needs_edge" },
                { key: "oyi_edge", label: "Oyi Edge", readiness: "ready" },
              ] as any[]).map((provider) => <button key={provider.key} type="button" onClick={() => setSelectedProvider(provider.key)} className={`shrink-0 rounded-xl border px-3 py-2 text-xs transition ${selectedProvider === provider.key ? "border-sky-400/30 bg-sky-500/10 text-sky-100" : "border-white/10 bg-white/5 text-zinc-400 hover:text-white"}`}><span>{provider.label}</span><span className="ml-2 text-[10px] opacity-60">{providerReadiness(provider as InfrastructureOnboardingProvider)}</span></button>)}
            </div>
            {discoveryMessage ? <p className="mt-4 rounded-xl border border-dashed border-white/10 px-3 py-3 text-sm text-zinc-500">{discoveryMessage}</p> : null}
            {providerResults.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {providerResults.map((result, index) => (
                  <OisStatusBadge
                    key={`${result.provider_key}:${index}`}
                    status={onboardingTone(result.classification)}
                    label={`${text(result.provider_key, "Provider").replace(/_/g, " ")} · ${text(result.message, "Review")}`}
                  />
                ))}
              </div>
            ) : null}
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {onboardingCandidates.map((candidate) => <article key={candidate.id} className="rounded-xl border border-white/10 bg-black/15 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-sm font-medium text-white">{candidate.name}</h3><p className="mt-1 text-xs text-zinc-500">{candidate.provider_key.replace(/_/g, " ")} · {text(candidate.category || candidate.candidate_type, "system")} · {candidate.duplicate_target_id ? "Existing record found" : "New identity"}</p></div><OisStatusBadge status={onboardingTone(candidate.discovery_status === "classified" ? candidate.classification : candidate.discovery_status)} label={text(candidate.discovery_status === "classified" ? candidate.classification : candidate.discovery_status).replace(/_/g, " ")} /></div><p className="mt-3 text-xs leading-5 text-zinc-400">{candidate.classification_reason || "Ready for infrastructure review."}</p>{candidate.classification === "compatible" ? <Button variant="ghost" onClick={() => void onboardCandidate(candidate)} disabled={saving || candidate.discovery_status === "promoted"} className="mt-4 gap-2"><ChevronRight className="h-4 w-4" /> {candidate.discovery_status === "promoted" ? "Operational" : candidate.discovery_status === "verified" ? "Add to Registry" : "Import and Verify"}</Button> : null}</article>)}
              {!onboardingCandidates.length && !discovering ? <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500 lg:col-span-2">Choose a source and run discovery. Local systems are collected through Oyi Edge; cloud systems use their connected account.</p> : null}
            </div>
          </div>
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><h2 className="text-sm font-semibold text-white">Edge Discovery Inbox</h2><p className="mt-1 text-xs text-zinc-500">{data?.sources?.discovered_devices?.available ? "Local discovery reported by property Edge nodes." : "Awaiting an Edge discovery source."}</p><div className="mt-4 grid gap-2">{(data?.discovered || []).slice(0, 12).map((device) => <div key={device.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/15 px-3 py-3 text-sm"><Network className="h-4 w-4 text-sky-200" /><span className="flex-1 text-zinc-200">{device.name}</span><span className="text-xs text-zinc-500">{device.source}</span><Status value={device.registered ? "active" : device.status} /></div>)}{!data?.discovered?.length ? <p className="rounded-xl border border-dashed border-white/10 p-3 text-sm text-zinc-500">No local systems have been reported by Oyi Edge.</p> : null}</div></div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><h2 className="text-sm font-semibold text-white">Discovery History</h2><p className="mt-1 text-xs text-zinc-500">Automatic onboarding records, not project tasks.</p><div className="mt-4 space-y-2">{(onboarding?.sessions || []).slice(0, 8).map((session) => <div key={session.id} className="rounded-xl border border-white/10 bg-black/15 px-3 py-3"><div className="flex items-center justify-between gap-2"><p className="text-xs font-medium text-zinc-200">{session.onboarding_ref}</p><OisStatusBadge status={onboardingTone(session.status)} label={session.status.replace(/_/g, " ")} /></div><p className="mt-1 text-[11px] text-zinc-500">{session.summary?.total || 0} systems · {date(session.updated_at)}</p></div>)}{!onboarding?.sessions?.length ? <p className="rounded-xl border border-dashed border-white/10 p-3 text-sm text-zinc-500">No onboarding history yet.</p> : null}</div></div>
          </section>
        </section>
      ) : null}

      {tab === "assignments" ? (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><h2 className="text-sm font-semibold text-white">Ownership Queue</h2><p className="mt-1 text-xs text-zinc-500">Select a registry device and bind it to an estate home and valid room.</p><div className="mt-4 space-y-2">{registry.map((device) => <button key={device.id} type="button" onClick={() => openAssignment(device)} className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-black/15 px-3 py-3 text-left transition hover:border-sky-400/25"><Cpu className="h-4 w-4 text-sky-200" /><span className="min-w-0 flex-1"><span className="block truncate text-sm text-white">{device.name}</span><span className="mt-1 block text-xs text-zinc-500">{location(device)}</span></span><Status value={device.status} /><SlidersHorizontal className="h-4 w-4 text-zinc-600" /></button>)}</div></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><h2 className="text-sm font-semibold text-white">Ownership Activity</h2><p className="mt-1 text-xs text-zinc-500">{data?.sources?.audit_events?.available ? "Latest auditable registry changes." : "Awaiting audit source."}</p><div className="mt-4 space-y-2">{(data?.assignment_history || []).slice(0, 10).map((event) => <div key={event.id} className="rounded-xl border border-white/10 bg-black/15 px-3 py-3"><p className="text-xs text-zinc-200">{text(event.action).replace(/\./g, " ")}</p><p className="mt-1 text-[11px] text-zinc-500">{date(event.created_at)}</p></div>)}</div></div>
        </section>
      ) : null}

      {tab === "providers" ? <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{onboardingProviders.map((provider) => <article key={provider.key} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-white">{provider.label}</h2><p className="mt-1 text-xs text-zinc-500">{provider.discovery_mode.replace(/_/g, " ")} · {provider.protocols.slice(0, 3).join(" · ") || "Integration adapter"}</p></div><OisStatusBadge status={onboardingTone(provider.readiness)} label={providerReadiness(provider)} /></div><dl className="mt-4 space-y-2 text-xs"><div className="flex justify-between gap-3"><dt className="text-zinc-500">Connection</dt><dd className="text-zinc-300">{text(provider.connection?.authentication_status, provider.authentication_methods.includes("none") ? "Not required" : "Not connected").replace(/_/g, " ")}</dd></div><div className="flex justify-between gap-3"><dt className="text-zinc-500">Last verified</dt><dd className="text-zinc-300">{date(provider.connection?.last_verified_at)}</dd></div><div className="flex justify-between gap-3"><dt className="text-zinc-500">Import</dt><dd className="text-zinc-300">{provider.supports_import ? "Available" : "Adapter required"}</dd></div></dl><div className="mt-5 flex flex-wrap gap-2">{provider.key === "tuya" ? <Button variant="ghost" onClick={() => void syncTuya()} disabled={saving} className="gap-2"><RefreshCw className="h-4 w-4" /> Re-Sync</Button> : null}{provider.supports_discovery ? <Button variant="ghost" onClick={() => { setSelectedProvider(provider.key); setTab("discovery"); }} className="gap-2"><Search className="h-4 w-4" /> Discover</Button> : null}</div>{provider.notes ? <p className="mt-3 text-xs leading-5 text-zinc-500">{provider.notes}</p> : null}</article>)}{!onboardingProviders.length ? <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500 md:col-span-2 xl:col-span-3">Provider readiness will appear after the onboarding schema is available.</p> : null}</section> : null}

      {tab === "edge" ? <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]"><div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><h2 className="text-sm font-semibold text-white">Oyi Edge Nodes</h2><p className="mt-1 text-xs text-zinc-500">{data?.sources?.edge_nodes?.available ? "Heartbeat-backed local infrastructure agents." : "Awaiting live source."}</p><div className="mt-4 space-y-3">{(data?.edge_nodes || []).map((node) => <article key={node.id} className="rounded-xl border border-white/10 bg-black/15 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-medium text-white">{node.name}</h3><p className="mt-1 text-xs text-zinc-500">{node.node_id} · {node.ip_address || "IP unavailable"} · {node.version || "Version unavailable"}</p></div><Status value={node.status} /></div><div className="mt-4 grid grid-cols-2 gap-2 text-xs text-zinc-400"><span>Last heartbeat: {date(node.last_heartbeat_at)}</span><span>Sync: {text(node.sync_status)}</span><span>Devices: {node.device_count || 0}</span><span>Queue: {node.queue_depth || 0}</span></div></article>)}{!data?.edge_nodes?.length && !loading ? <p className="rounded-xl border border-dashed border-white/10 px-3 py-3 text-sm text-zinc-500">Awaiting Oyi Edge registration and heartbeat.</p> : null}</div></div><div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><h2 className="text-sm font-semibold text-white">Heartbeat Activity</h2><div className="mt-4 space-y-2">{(data?.heartbeats || []).slice(0, 12).map((heartbeat) => <div key={heartbeat.id} className="flex gap-3 rounded-xl border border-white/10 bg-black/15 px-3 py-3"><CircleDot className="h-4 w-4 text-sky-200" /><span className="min-w-0 flex-1 text-xs text-zinc-300">{text(heartbeat.edge_node_id)}<span className="mt-1 block text-[11px] text-zinc-500">{date(heartbeat.received_at)}</span></span><Status value={heartbeat.heartbeat_status} /></div>)}</div></div></section> : null}

      {tab === "telemetry" ? <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><h2 className="text-sm font-semibold text-white">Infrastructure Telemetry Lane</h2><p className="mt-1 text-xs text-zinc-500">Operational attention only. No synthetic analytics.</p><div className="mt-4 space-y-2">{(data?.telemetry || []).map((event) => <article key={event.id} className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/15 px-4 py-3 md:flex-row md:items-center"><AlertTriangle className={`h-4 w-4 shrink-0 ${event.severity === "high" ? "text-rose-200" : "text-amber-200"}`} /><span className="min-w-0 flex-1"><span className="block text-sm text-white">{event.affected}</span><span className="mt-1 block text-xs text-zinc-500">{event.domain} · {event.location} · {date(event.time)}</span></span><span className="text-xs text-zinc-400">{event.action}</span></article>)}{!data?.telemetry?.length && !loading ? <p className="rounded-xl border border-dashed border-white/10 px-3 py-3 text-sm text-zinc-500">No infrastructure attention items reported by active sources.</p> : null}</div></section> : null}

      <OisDrawer
        open={Boolean(assigning)}
        onClose={() => setAssigning(null)}
        title="Assign Ownership"
        subtitle={assigning ? `${assigning.name} · ${assigning.provider}` : undefined}
        width="md"
        footer={assigning ? <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setAssigning(null)}>Cancel</Button><Button onClick={() => void saveAssignment()} disabled={saving || !homeId}>{saving ? "Saving" : "Save Ownership"}</Button></div> : null}
      >
        {assigning ? <div className="space-y-4"><OisCard variant="evidence" className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-white">{location(assigning)}</p><p className="mt-2 text-xs text-zinc-500">{assigning.oyi_id}</p></div><OisStatusBadge status={tone(assigning.status)} label={text(assigning.status, "unknown").replace(/_/g, " ")} className="uppercase" /></div></OisCard><div className="grid gap-3"><select value={homeId} onChange={(event) => { setHomeId(event.target.value); setRoomId(""); }} className="rounded-xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-white"><option value="">Select home</option>{(data?.homes || []).map((home) => <option key={home.id} value={home.id}>{text(home.name || [home.block, home.unit].filter(Boolean).join(" / "), "Home")}</option>)}</select><select value={roomId} onChange={(event) => setRoomId(event.target.value)} disabled={!homeId} className="rounded-xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-white disabled:opacity-50"><option value="">Home level only</option>{rooms.map((room) => <option key={room.id} value={room.id}>{text(room.name, "Room")}</option>)}</select></div></div> : null}
      </OisDrawer>

      <OisDrawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.name || "Infrastructure overview"}
        subtitle={detail ? `${detail.provider} · ${detail.type}` : undefined}
        width="md"
        footer={detail ? <div className="flex flex-wrap gap-2"><Button variant="ghost" disabled className="gap-2"><LocateFixed className="h-4 w-4" /> Locate unavailable</Button><Button onClick={() => { setDetail(null); openAssignment(detail); }} className="gap-2"><SlidersHorizontal className="h-4 w-4" /> Ownership</Button></div> : null}
      >
        {detail ? <div className="space-y-4"><OisCard variant="evidence" className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-white">{location(detail)}</p><p className="mt-2 text-xs text-zinc-500">{activitySummary(detail, `Last seen ${date(detail.last_seen_at)}`)}</p></div><OisStatusBadge status={toneFromDevice(detail) as any} label={healthLabel(detail.health_status || detail.status, text(detail.status, "unknown"))} className="uppercase" /></div></OisCard><div className="grid gap-3 sm:grid-cols-2"><OisCard variant="evidence" className="p-3"><span className="block text-[10px] uppercase tracking-[0.14em] text-[var(--ois-text-muted)]">Oyi ID</span><span className="mt-1 block break-all font-mono text-xs text-zinc-300">{detail.oyi_id}</span></OisCard><OisCard variant="evidence" className="p-3"><span className="block text-[10px] uppercase tracking-[0.14em] text-[var(--ois-text-muted)]">External ID</span><span className="mt-1 block break-all font-mono text-xs text-zinc-300">{detail.external_id || "Unavailable"}</span></OisCard><OisCard variant="evidence" className="p-3"><span className="block text-[10px] uppercase tracking-[0.14em] text-[var(--ois-text-muted)]">Location</span><span className="mt-1 block text-zinc-300">{location(detail)}</span></OisCard><OisCard variant="evidence" className="p-3"><span className="block text-[10px] uppercase tracking-[0.14em] text-[var(--ois-text-muted)]">Last seen</span><span className="mt-1 block text-zinc-300">{date(detail.last_seen_at)}</span></OisCard><OisCard variant="evidence" className="p-3"><span className="block text-[10px] uppercase tracking-[0.14em] text-[var(--ois-text-muted)]">Primary state</span><span className="mt-1 block text-zinc-300">{statusLabel(detail.primary_state, "Unknown")}</span></OisCard><OisCard variant="evidence" className="p-3"><span className="block text-[10px] uppercase tracking-[0.14em] text-[var(--ois-text-muted)]">Provider health</span><span className="mt-1 block text-zinc-300">{providerHealthLabel(detail.provider_health, "Unknown")}</span></OisCard></div></div> : null}
      </OisDrawer>
    </div>
  );
}
