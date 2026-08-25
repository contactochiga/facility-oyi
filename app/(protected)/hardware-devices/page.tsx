"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Camera,
  ChevronRight,
  CircleDot,
  Cpu,
  Gauge,
  Lightbulb,
  Lock,
  LocateFixed,
  MoreVertical,
  Network,
  RefreshCw,
  Search,
  Server,
  SlidersHorizontal,
  Thermometer,
  Wifi,
} from "lucide-react";
import OisCard from "@/components/ois/OisCard";
import OisDrawer from "@/components/ois/OisDrawer";
import OisListItem from "@/components/ois/OisListItem";
import OisStatusBadge from "@/components/ois/OisStatusBadge";
import { OisPageToolbar, OisRegistryHeader } from "@/components/ois";
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
import styles from "./AssetsWorkspace.module.css";

type Tab = "registry" | "discovery" | "assignments" | "providers" | "edge" | "telemetry";
type DetailTab = "overview" | "controls" | "settings" | "telemetry" | "history";

const TABS: Array<{ key: Tab; label: string; icon: typeof Cpu }> = [
  { key: "registry", label: "Registry", icon: iconForTab("registry") },
  { key: "discovery", label: "Discovery", icon: iconForTab("discovery") },
  { key: "edge", label: "Edge", icon: iconForTab("edge") },
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

function relativeDate(value?: string | null) {
  if (!value) return "Unavailable";
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "Unavailable";
  const minutes = Math.max(0, Math.round((Date.now() - time) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

function deviceIcon(device: InfrastructureDevice) {
  const kind = `${device.category} ${device.type} ${device.device_family}`.toLowerCase();
  if (/camera/.test(kind)) return Camera;
  if (/meter|gauge/.test(kind)) return Gauge;
  if (/lock|access|door/.test(kind)) return Lock;
  if (/hvac|air|climate|therm/.test(kind)) return Thermometer;
  if (/light|lamp/.test(kind)) return Lightbulb;
  if (/edge|gateway|server/.test(kind)) return Server;
  if (/network|wifi|router/.test(kind)) return Wifi;
  return Cpu;
}

function specialistRoute(device: InfrastructureDevice) {
  const kind = `${device.category} ${device.type} ${device.device_family}`.toLowerCase();
  if (/camera/.test(kind)) return { href: "/cameras", label: "Open Camera Center" };
  if (/meter|water|electric|utility/.test(kind)) return { href: "/services", label: "Open Utilities" };
  if (/lock|access|door/.test(kind)) return { href: "/traffic", label: "Open Access" };
  if (/sensor|environment|climate|air/.test(kind)) return { href: "/environment", label: "Open Environment" };
  return null;
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
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [typeFilter, setTypeFilter] = useState("all");
  const [healthFilter, setHealthFilter] = useState("all");
  const [assignmentFilter, setAssignmentFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [commanding, setCommanding] = useState<string | null>(null);
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
      const operations = await facilityService.infrastructureOperations();
      setData(operations);
      void facilityService.infrastructureOnboardingOverview().then(setOnboarding).catch(() => setOnboarding(null));
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
    return registry.filter((device) => {
      const matchesQuery = !needle || [device.name, device.type, device.category, device.provider, device.external_id, device.oyi_id, device.metadata?.serial, device.metadata?.model, location(device)]
        .map((value) => text(value, "").toLowerCase())
        .some((value) => value.includes(needle));
      const matchesType = typeFilter === "all" || text(device.category || device.type, "unknown").toLowerCase() === typeFilter;
      const deviceTone = toneFromDevice(device);
      const matchesHealth = healthFilter === "all" || (healthFilter === "attention" ? ["critical", "pending"].includes(deviceTone) : deviceTone === healthFilter);
      const matchesAssignment = assignmentFilter === "all" || (assignmentFilter === "assigned" ? Boolean(device.home_id || device.room_id) : !device.home_id && !device.room_id);
      return matchesQuery && matchesType && matchesHealth && matchesAssignment;
    });
  }, [assignmentFilter, healthFilter, query, registry, typeFilter]);
  const rooms = useMemo(() => (data?.rooms || []).filter((room) => String(room.home_id || "") === homeId), [data, homeId]);
  const assigned = registry.filter((device) => Boolean(device.home_id));
  const pending = registry.filter((device) => !device.home_id);
  const attention = registry.filter((device) => toneFromDevice(device) === "critical" || toneFromDevice(device) === "pending");
  const online = registry.filter((device) => device.online === true || /online|connected/.test(text(device.status, "").toLowerCase()));
  const offline = registry.filter((device) => device.online === false || /offline|unreachable/.test(text(device.status, "").toLowerCase()));
  const degraded = registry.filter((device) => /degraded|warning|battery_low/.test(`${device.health_status} ${device.provider_health}`.toLowerCase()));
  const categories = [...new Set(registry.map(device => text(device.category || device.type, "unknown").toLowerCase()))].sort();
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

  async function runControl(device: InfrastructureDevice, control: string) {
    if (!device.supported_controls?.includes(control)) return;
    if (!window.confirm(`Send ${control.replace(/_/g, " ")} to ${device.name}?`)) return;
    setCommanding(control); setError(null);
    try { await facilityService.sendDeviceCommand(device.id, { action: control }); setNotice(`${control.replace(/_/g, " ")} sent to ${device.name}.`); await load(); }
    catch (requestError: any) { setError(requestError?.response?.data?.error || requestError?.message || "Unable to send this device command."); }
    finally { setCommanding(null); }
  }

  return (
    <div className={`${styles.workspace} space-y-3.5 pb-6`}>
      <header className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-[20px] font-semibold tracking-[-.025em] text-white">Assets</h1><p className="mt-1 text-[11px] text-zinc-500">Asset registry and edge operations</p></div><div className="flex gap-2"><Button variant="ghost" className="h-9 gap-2 rounded-md px-3 text-xs" onClick={() => setFiltersOpen(value => !value)}><SlidersHorizontal className="h-3.5 w-3.5"/>Filters</Button><Button variant="ghost" className="h-9 gap-2 rounded-md px-3 text-xs" onClick={() => void load()}><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}/>Refresh</Button></div></header>

      <section className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">{[
        [Cpu, "Registry", registry.length, "All assets", "text-sky-400"],
        [CircleDot, "Online", online.length, "Canonical connectivity", "text-emerald-400"],
        [AlertTriangle, "Degraded", degraded.length, "Needs attention", "text-amber-400"],
        [CircleDot, "Offline", offline.length, "Not reporting", "text-rose-400"],
        [LocateFixed, "Unassigned", pending.length, "No Home / room", "text-zinc-400"],
        [AlertTriangle, "Attention", attention.length, "Needs review", "text-amber-400"],
      ].map(([Icon, label, value, caption, colour]: any) => <article key={label} className="rounded-[9px] border border-[var(--ois-border-subtle)] bg-[var(--ois-surface)] px-3 py-3"><div className="flex items-center gap-2.5"><span className={`grid h-8 w-8 place-items-center rounded-md bg-black/20 ${colour}`}><Icon className="h-[15px] w-[15px] stroke-[1.6]"/></span><span><small className="block text-[8.5px] font-medium uppercase tracking-[.075em] text-zinc-500">{label}</small><b className="block text-[18px] font-semibold leading-5 text-white">{loading ? "—" : value}</b><small className="text-[8.5px] text-zinc-600">{caption}</small></span></div></article>)}</section>

      {error ? <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}
      {notice ? <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{notice}</div> : null}

      <nav className="flex gap-5 overflow-x-auto border-b border-[var(--ois-border-subtle)] px-1">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} type="button" onClick={() => setTab(key)} className={`relative inline-flex shrink-0 items-center gap-1.5 px-1 pb-2.5 text-[10px] transition ${tab === key ? "text-sky-200 after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-sky-400" : "text-zinc-500 hover:text-white"}`}>
            <Icon className="h-3.5 w-3.5" /> {label}{key === "discovery" && onboardingCandidates.length ? <span className="rounded-full bg-sky-500/15 px-1.5 text-[8px] text-sky-300">{onboardingCandidates.length}</span> : null}{key === "edge" && data?.edge_nodes?.length ? <span className="rounded-full bg-emerald-500/15 px-1.5 text-[8px] text-emerald-300">{data.edge_nodes.length}</span> : null}
          </button>
        ))}
      </nav>

      {tab === "registry" ? (
        <section className="overflow-hidden rounded-[10px] border border-[var(--ois-border-default)] bg-[var(--ois-surface)]">
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--ois-border-subtle)] p-3"><label className="flex h-9 min-w-[240px] flex-1 items-center gap-2 rounded-md border border-[var(--ois-border-subtle)] bg-black/20 px-3"><Search className="h-3.5 w-3.5 text-zinc-600"/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search assets by name, type, provider, location, or ID…" className="min-w-0 flex-1 bg-transparent text-[10.5px] text-white outline-none"/></label><button onClick={() => setFiltersOpen(value => !value)} className={`h-9 rounded-md border px-3 text-[10px] ${filtersOpen ? "border-sky-400/30 bg-sky-500/10 text-sky-200" : "border-[var(--ois-border-subtle)] text-zinc-400"}`}><SlidersHorizontal className="mr-1.5 inline h-3.5 w-3.5"/>Filters</button><span className="text-[9px] text-zinc-600">{filtered.length} of {registry.length}</span></div>
          {filtersOpen ? <div className="grid gap-2 border-b border-[var(--ois-border-subtle)] bg-black/10 p-3 sm:grid-cols-3"><select value={typeFilter} onChange={event => setTypeFilter(event.target.value)} className="h-9 rounded-md border border-[var(--ois-border-subtle)] bg-[#09121b] px-3 text-[10px] text-zinc-300"><option value="all">All asset types</option>{categories.map(category => <option key={category} value={category}>{category.replace(/_/g," ")}</option>)}</select><select value={healthFilter} onChange={event => setHealthFilter(event.target.value)} className="h-9 rounded-md border border-[var(--ois-border-subtle)] bg-[#09121b] px-3 text-[10px] text-zinc-300"><option value="all">All health states</option><option value="stable">Healthy</option><option value="attention">Degraded / attention</option><option value="critical">Offline / critical</option></select><select value={assignmentFilter} onChange={event => setAssignmentFilter(event.target.value)} className="h-9 rounded-md border border-[var(--ois-border-subtle)] bg-[#09121b] px-3 text-[10px] text-zinc-300"><option value="all">All assignments</option><option value="assigned">Assigned</option><option value="unassigned">Unassigned</option></select></div> : null}
          <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[980px] table-fixed text-left"><thead className="bg-black/10 text-[8px] uppercase tracking-[.08em] text-zinc-600"><tr><th className="w-[21%] px-3 py-2.5">Asset / type</th><th className="w-[15%]">Location</th><th className="w-[13%]">Provider</th><th className="w-[12%]">Connectivity</th><th className="w-[12%]">Health</th><th className="w-[12%]">Edge / assignment</th><th className="w-[10%]">Last seen</th><th className="w-[5%]"/></tr></thead><tbody>{filtered.map(device => { const Icon = deviceIcon(device); const selected = detail?.id === device.id; return <tr key={device.id} onClick={() => { setDetail(device); setDetailTab("overview"); }} className={`cursor-pointer border-t border-[var(--ois-border-subtle)] text-[9.5px] text-zinc-400 transition hover:bg-white/[.025] ${selected ? "bg-sky-500/[.045] outline outline-1 -outline-offset-1 outline-sky-400/35" : ""}`}><td className="px-3 py-2.5"><div className="flex items-center gap-2.5"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-white/[.035]"><Icon className="h-3.5 w-3.5 stroke-[1.55] text-sky-300"/></span><span className="min-w-0"><b className="block truncate font-medium text-zinc-100">{device.name}</b><small className="block truncate text-[8px] text-zinc-600">{text(device.device_type || device.category || device.type,"Asset")}</small></span></div></td><td><b className="block truncate font-normal text-zinc-300">{location(device)}</b><small className="text-[8px] text-zinc-600">{device.room?.name || device.home?.name || "Assignment pending"}</small></td><td><b className="block truncate font-normal text-zinc-300">{text(device.provider,"Unavailable")}</b><small className="block truncate text-[8px] text-zinc-600">{text(device.metadata?.model || device.adapter,"Model unavailable")}</small></td><td><Status value={device.status} device={device}/><small className="mt-1 block text-[8px] text-zinc-600">{device.protocols?.[0] || text(device.adapter,"Protocol unavailable")}</small></td><td><span className={`text-[9px] ${toneFromDevice(device)==="stable"?"text-emerald-400":toneFromDevice(device)==="critical"?"text-rose-400":"text-amber-300"}`}>{healthLabel(device.health_status || device.provider_health, "Unknown")}</span><small className="block truncate text-[8px] text-zinc-600">{activitySummary(device,"No health explanation")}</small></td><td><span className="text-zinc-300">{device.metadata?.edge_node_name || device.metadata?.edge_node_id || (device.home_id ? "Assigned" : "Unassigned")}</span><small className="block truncate text-[8px] text-zinc-600">{device.room?.name || device.home?.name || "No location"}</small></td><td>{relativeDate(device.last_seen_at)}</td><td><MoreVertical className="h-3.5 w-3.5 text-zinc-600"/></td></tr>})}</tbody></table></div>
          <div className="divide-y divide-[var(--ois-border-subtle)] md:hidden">{filtered.map(device => { const Icon=deviceIcon(device); return <button key={device.id} onClick={() => { setDetail(device); setDetailTab("overview"); }} className="flex w-full items-center gap-3 p-3 text-left"><span className="grid h-8 w-8 place-items-center rounded-md bg-white/[.04]"><Icon className="h-4 w-4 text-sky-300"/></span><span className="min-w-0 flex-1"><b className="block truncate text-[11px] font-medium text-white">{device.name}</b><small className="block truncate text-[8.5px] text-zinc-600">{location(device)} · {text(device.provider)}</small></span><Status value={device.status} device={device}/><ChevronRight className="h-3.5 w-3.5 text-zinc-600"/></button>})}</div>
          {!filtered.length && !loading ? <div className="grid min-h-40 place-items-center p-6 text-center"><div><Cpu className="mx-auto h-5 w-5 text-zinc-700"/><p className="mt-2 text-[11px] text-zinc-500">No registered assets match this view.</p><button onClick={() => { setQuery(""); setTypeFilter("all"); setHealthFilter("all"); setAssignmentFilter("all"); }} className="mt-2 text-[9px] text-sky-400">Clear filters</button></div></div> : null}
        </section>
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
        title={detail?.name || "Asset overview"}
        subtitle={detail ? `${detail.provider} · ${detail.type}` : undefined}
        width="md"
        footer={detail ? <div className="flex w-full flex-wrap justify-between gap-2"><div>{specialistRoute(detail) ? <Link href={specialistRoute(detail)!.href} className="inline-flex h-9 items-center rounded-md border border-[var(--ois-border-subtle)] px-3 text-[10px] text-sky-300">{specialistRoute(detail)!.label}</Link> : null}</div><Button onClick={() => { setDetail(null); openAssignment(detail); }} className="h-9 gap-2 rounded-md text-[10px]"><SlidersHorizontal className="h-3.5 w-3.5"/>Assign location</Button></div> : null}
      >
        {detail ? <div className="space-y-3"><div className="flex items-center gap-3 rounded-md border border-[var(--ois-border-subtle)] bg-black/15 p-3">{(() => { const Icon=deviceIcon(detail); return <span className="grid h-9 w-9 place-items-center rounded-md bg-sky-500/10"><Icon className="h-4 w-4 text-sky-300"/></span>; })()}<span className="min-w-0 flex-1"><b className="block truncate text-[11px] font-medium text-white">{detail.name}</b><small className="text-[8.5px] text-zinc-600">{text(detail.device_type || detail.category || detail.type)} · {text(detail.provider)}</small></span><Status value={detail.status} device={detail}/></div><nav className="flex gap-4 overflow-x-auto border-b border-[var(--ois-border-subtle)]">{(["overview", ...(detail.projection?.controllable && detail.supported_controls?.length ? ["controls"] : []), "settings", "telemetry", "history"] as DetailTab[]).map(item => <button key={item} onClick={() => setDetailTab(item)} className={`relative shrink-0 px-1 pb-2 text-[9px] capitalize ${detailTab===item?"text-sky-300 after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-sky-400":"text-zinc-500"}`}>{item}</button>)}</nav>
          {detailTab === "overview" ? <div className="space-y-3"><section className="rounded-md border border-[var(--ois-border-subtle)] p-3"><h3 className="text-[10px] font-semibold text-zinc-200">General</h3><dl className="mt-2 space-y-1.5 text-[9px]">{[["Location",location(detail)],["Provider",text(detail.provider)],["Model",text(detail.metadata?.model)],["Oyi ID",detail.oyi_id],["External ID",text(detail.external_id)],["Ownership",text(detail.ownership_class || detail.assignment_scope,"Unassigned")],["Status",statusLabel(detail.primary_state || detail.status)]].map(([label,value])=><div key={label} className="flex justify-between gap-4"><dt className="text-zinc-600">{label}</dt><dd className="max-w-[65%] break-all text-right text-zinc-300">{value}</dd></div>)}</dl></section><section className="rounded-md border border-[var(--ois-border-subtle)] p-3"><h3 className="text-[10px] font-semibold text-zinc-200">Connectivity</h3><dl className="mt-2 space-y-1.5 text-[9px]">{[["Oyi Edge",detail.metadata?.edge_node_name || detail.metadata?.edge_node_id || "Unassigned"],["Protocol",detail.protocols?.join(", ") || text(detail.adapter)],["Provider state",providerHealthLabel(detail.provider_health,"Unavailable")],["Last seen",relativeDate(detail.last_seen_at)],["Telemetry freshness",text(detail.telemetry_summary?.freshness || detail.last_signal,"Unavailable")]].map(([label,value])=><div key={label} className="flex justify-between gap-4"><dt className="text-zinc-600">{label}</dt><dd className="max-w-[65%] text-right text-zinc-300">{value}</dd></div>)}</dl></section><section className="rounded-md border border-[var(--ois-border-subtle)] p-3"><h3 className="text-[10px] font-semibold text-zinc-200">Current status</h3><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">{Object.entries(detail.normalized_state || {}).filter(([key])=>!/password|token|secret|credential|ip/i.test(key)).slice(0,6).map(([key,value])=><div key={key} className="rounded-md bg-white/[.025] p-2"><small className="block text-[8px] capitalize text-zinc-600">{key.replace(/_/g," ")}</small><b className="mt-1 block truncate text-[10px] font-medium text-zinc-200">{String(value)}</b></div>)}{!Object.keys(detail.normalized_state || {}).length ? <p className="col-span-full text-[9px] text-zinc-600">No current state reported.</p> : null}</div></section></div> : null}
          {detailTab === "controls" ? <section className="rounded-md border border-[var(--ois-border-subtle)] p-3"><h3 className="text-[10px] font-semibold text-zinc-200">Supported controls</h3><p className="mt-1 text-[8.5px] text-zinc-600">Commands come from this asset’s canonical capability projection.</p><div className="mt-3 flex flex-wrap gap-2">{(detail.supported_controls || []).map(control => <Button key={control} variant="ghost" disabled={commanding !== null} onClick={() => void runControl(detail,control)} className="h-8 rounded-md px-3 text-[9px] capitalize">{commanding===control?"Sending…":control.replace(/_/g," ")}</Button>)}</div></section> : null}
          {detailTab === "settings" ? <section className="rounded-md border border-[var(--ois-border-subtle)] p-3"><h3 className="text-[10px] font-semibold text-zinc-200">Assignment & configuration</h3><p className="mt-1 text-[9px] leading-4 text-zinc-600">Location assignment uses the existing Home and Room mutation. Provider configuration remains governed by its canonical onboarding connection.</p><Button className="mt-3 h-8 rounded-md text-[9px]" onClick={() => { setDetail(null); openAssignment(detail); }}>Assign Home / Room</Button></section> : null}
          {detailTab === "telemetry" ? <section className="rounded-md border border-[var(--ois-border-subtle)] p-3"><h3 className="text-[10px] font-semibold text-zinc-200">Latest telemetry</h3><div className="mt-2 grid grid-cols-2 gap-2">{Object.entries(detail.telemetry_summary || {}).filter(([key])=>!/password|token|secret|credential|ip/i.test(key)).slice(0,8).map(([key,value])=><div key={key} className="rounded-md bg-white/[.025] p-2"><small className="block text-[8px] capitalize text-zinc-600">{key.replace(/_/g," ")}</small><b className="text-[10px] text-zinc-200">{String(value)}</b></div>)}{!Object.keys(detail.telemetry_summary || {}).length ? <p className="col-span-full py-4 text-center text-[9px] text-zinc-600">No bounded telemetry is available for this asset.</p> : null}</div></section> : null}
          {detailTab === "history" ? <section className="rounded-md border border-[var(--ois-border-subtle)] p-3"><h3 className="text-[10px] font-semibold text-zinc-200">Operational history</h3><div className="mt-2 space-y-2">{(data?.assignment_history || []).filter(event => !event.device_id || event.device_id === detail.id).slice(0,8).map(event => <div key={event.id} className="border-l border-sky-400/20 pl-2"><p className="text-[9px] text-zinc-300">{text(event.action).replace(/\./g," ")}</p><small className="text-[8px] text-zinc-600">{date(event.created_at)}</small></div>)}{!(data?.assignment_history || []).length ? <p className="py-4 text-center text-[9px] text-zinc-600">No bounded audit history is available.</p> : null}</div></section> : null}
        </div> : null}
      </OisDrawer>
    </div>
  );
}
