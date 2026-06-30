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
import { OisRegistryHeader } from "@/components/ois";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import {
  facilityService,
  type DiscoverAdapter,
  type DiscoveredDevice,
  type InfrastructureDevice,
  type InfrastructureOperations,
} from "@/services/facilityService";
import { iconForTab } from "@/lib/oisIconRegistry";

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

function Status({ value }: { value?: string | null }) {
  return <OisStatusBadge status={tone(value)} label={text(value, "unknown").replace(/_/g, " ")} className="uppercase tracking-[0.12em]" />;
}

function location(device: InfrastructureDevice) {
  return device.room?.name || device.home?.name || [device.home?.block, device.home?.unit].filter(Boolean).join(" / ") || "Pending assignment";
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
  const [adapter, setAdapter] = useState<DiscoverAdapter>("tuya");
  const [discovering, setDiscovering] = useState(false);
  const [discovery, setDiscovery] = useState<DiscoveredDevice[]>([]);
  const [discoveryMessage, setDiscoveryMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await facilityService.infrastructureOperations());
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
  const attention = registry.filter((device) => ["offline", "error"].includes(device.status));

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
      const result = await facilityService.discoverDevices(adapter);
      setDiscovery(result.devices || []);
      setDiscoveryMessage(result.devices?.length ? null : "Awaiting discovery source. No new devices were returned.");
    } catch (requestError: any) {
      setDiscovery([]);
      setDiscoveryMessage(requestError?.response?.data?.error || requestError?.message || "Discovery source unavailable.");
    } finally {
      setDiscovering(false);
    }
  }

  async function register(device: DiscoveredDevice) {
    const externalId = text(device.externalId || device.external_id || device.device_id || device.devId || device.id, "");
    if (!externalId || !data?.estate?.id) {
      setError("This discovery result has no stable provider identity and cannot be registered.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await facilityService.registerDevice({
        estate_id: data.estate.id,
        adapter: text(device.adapter || adapter, adapter),
        external_id: externalId,
        name: text(device.name || device.local_name, "Unnamed device"),
        category: text(device.category, "device"),
        capabilities: Array.isArray(device.capabilities) ? device.capabilities : [],
        protocols: Array.isArray(device.protocols) ? device.protocols : [],
        metadata: device.metadata || {},
      });
      setNotice(`${text(device.name || device.local_name, "Device")} registered. Assign it to a home when ready.`);
      await load();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.error || requestError?.message || "Unable to register this device.");
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
        title="Infrastructure Registry"
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
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <OisRegistryHeader title="Device Registry" caption={loading ? "Loading records" : `${filtered.length} records`} />
            </div>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search registry" className="w-full max-w-xs rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-sky-400/40" />
          </header>
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1100px] text-left text-xs">
              <thead className="text-[10px] uppercase tracking-[0.14em] text-zinc-600"><tr><th className="pb-3">Device</th><th>Type</th><th>Provider</th><th>Oyi ID</th><th>External ID</th><th>Location</th><th>Status</th><th>Last seen</th><th /></tr></thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((device) => (
                  <tr key={device.id} className="text-zinc-300">
                    <td className="py-3 pr-3 font-medium text-white">{device.name}</td><td>{device.type}</td><td>{device.provider}</td>
                    <td className="max-w-36 truncate font-mono text-[11px] text-zinc-500">{device.oyi_id}</td><td className="max-w-40 truncate font-mono text-[11px] text-zinc-500">{device.external_id || "Unavailable"}</td>
                    <td>{location(device)}</td><td><Status value={device.status} /></td><td>{date(device.last_seen_at)}</td>
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
                description={`${location(device)} · ${text(device.provider, "Provider unavailable")}`}
                meta={`Last seen ${date(device.last_seen_at)}`}
                status={tone(device.status)}
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
                <h2 className="text-sm font-semibold text-white">Discovery</h2>
                <p className="mt-1 text-xs leading-5 text-zinc-500">Discover, review, register, then assign. Edge-pushed results appear below when the source is active.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(["tuya", "ssdp", "onvif"] as DiscoverAdapter[]).map((item) => <button key={item} type="button" onClick={() => setAdapter(item)} className={`rounded-xl border px-3 py-2 text-xs uppercase ${adapter === item ? "border-sky-400/30 bg-sky-500/10 text-sky-100" : "border-white/10 bg-white/5 text-zinc-400"}`}>{item}</button>)}
                <Button onClick={() => void discover()} disabled={discovering} className="gap-2"><Search className="h-4 w-4" /> {discovering ? "Discovering" : "Discover"}</Button>
              </div>
            </div>
            {discoveryMessage ? <p className="mt-4 rounded-xl border border-dashed border-white/10 px-3 py-3 text-sm text-zinc-500">{discoveryMessage}</p> : null}
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {discovery.map((device, index) => {
                const external = text(device.externalId || device.external_id || device.device_id || device.devId || device.id, "");
                return <article key={`${external}:${index}`} className="rounded-xl border border-white/10 bg-black/15 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-medium text-white">{text(device.name || device.local_name, "Unnamed device")}</h3><p className="mt-1 text-xs text-zinc-500">{adapter} · {text(device.category, "device")} · {external || "No stable identity"}</p></div><Status value={device.online === true ? "online" : device.online === false ? "offline" : "unknown"} /></div><Button variant="ghost" onClick={() => void register(device)} disabled={!external || saving} className="mt-4 gap-2"><ChevronRight className="h-4 w-4" /> Register</Button></article>;
              })}
            </div>
          </div>
          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><h2 className="text-sm font-semibold text-white">Edge Discovery Inbox</h2><p className="mt-1 text-xs text-zinc-500">{data?.sources?.discovered_devices?.available ? "Durable Edge discovery results." : "Awaiting discovery source."}</p><div className="mt-4 grid gap-2">{(data?.discovered || []).slice(0, 12).map((device) => <div key={device.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/15 px-3 py-3 text-sm"><Network className="h-4 w-4 text-sky-200" /><span className="flex-1 text-zinc-200">{device.name}</span><span className="text-xs text-zinc-500">{device.source}</span><Status value={device.registered ? "active" : device.status} /></div>)}</div></section>
        </section>
      ) : null}

      {tab === "assignments" ? (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><h2 className="text-sm font-semibold text-white">Ownership Queue</h2><p className="mt-1 text-xs text-zinc-500">Select a registry device and bind it to an estate home and valid room.</p><div className="mt-4 space-y-2">{registry.map((device) => <button key={device.id} type="button" onClick={() => openAssignment(device)} className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-black/15 px-3 py-3 text-left transition hover:border-sky-400/25"><Cpu className="h-4 w-4 text-sky-200" /><span className="min-w-0 flex-1"><span className="block truncate text-sm text-white">{device.name}</span><span className="mt-1 block text-xs text-zinc-500">{location(device)}</span></span><Status value={device.status} /><SlidersHorizontal className="h-4 w-4 text-zinc-600" /></button>)}</div></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><h2 className="text-sm font-semibold text-white">Ownership Activity</h2><p className="mt-1 text-xs text-zinc-500">{data?.sources?.audit_events?.available ? "Latest auditable registry changes." : "Awaiting audit source."}</p><div className="mt-4 space-y-2">{(data?.assignment_history || []).slice(0, 10).map((event) => <div key={event.id} className="rounded-xl border border-white/10 bg-black/15 px-3 py-3"><p className="text-xs text-zinc-200">{text(event.action).replace(/\./g, " ")}</p><p className="mt-1 text-[11px] text-zinc-500">{date(event.created_at)}</p></div>)}</div></div>
        </section>
      ) : null}

      {tab === "providers" ? <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{(data?.providers || []).map((provider) => <article key={provider.key} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-white">{provider.name}</h2><p className="mt-1 text-xs text-zinc-500">{provider.device_count || 0} registry devices</p></div><Status value={provider.status} /></div><dl className="mt-4 space-y-2 text-xs"><div className="flex justify-between gap-3"><dt className="text-zinc-500">Last sync</dt><dd className="text-zinc-300">{date(provider.last_sync_at)}</dd></div><div className="flex justify-between gap-3"><dt className="text-zinc-500">Sync errors</dt><dd className="text-zinc-300">{provider.sync_errors || 0}</dd></div></dl>{provider.key === "tuya" ? <Button variant="ghost" onClick={() => void syncTuya()} disabled={!provider.can_sync || saving} className="mt-5 gap-2"><RefreshCw className="h-4 w-4" /> Re-Sync Provider</Button> : <p className="mt-5 text-xs text-zinc-500">{provider.status === "pending_configuration" ? "Pending readiness" : "Provider-driven synchronization"}</p>}</article>)}</section> : null}

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
        {detail ? <div className="space-y-4"><OisCard variant="evidence" className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-white">{location(detail)}</p><p className="mt-2 text-xs text-zinc-500">Last seen {date(detail.last_seen_at)}</p></div><OisStatusBadge status={tone(detail.status)} label={text(detail.status, "unknown").replace(/_/g, " ")} className="uppercase" /></div></OisCard><div className="grid gap-3 sm:grid-cols-2"><OisCard variant="evidence" className="p-3"><span className="block text-[10px] uppercase tracking-[0.14em] text-[var(--ois-text-muted)]">Oyi ID</span><span className="mt-1 block break-all font-mono text-xs text-zinc-300">{detail.oyi_id}</span></OisCard><OisCard variant="evidence" className="p-3"><span className="block text-[10px] uppercase tracking-[0.14em] text-[var(--ois-text-muted)]">External ID</span><span className="mt-1 block break-all font-mono text-xs text-zinc-300">{detail.external_id || "Unavailable"}</span></OisCard><OisCard variant="evidence" className="p-3"><span className="block text-[10px] uppercase tracking-[0.14em] text-[var(--ois-text-muted)]">Location</span><span className="mt-1 block text-zinc-300">{location(detail)}</span></OisCard><OisCard variant="evidence" className="p-3"><span className="block text-[10px] uppercase tracking-[0.14em] text-[var(--ois-text-muted)]">Last seen</span><span className="mt-1 block text-zinc-300">{date(detail.last_seen_at)}</span></OisCard></div></div> : null}
      </OisDrawer>
    </div>
  );
}
