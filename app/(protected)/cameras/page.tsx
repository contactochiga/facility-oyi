"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Brain, Camera, CheckCircle2, Link2, PlayCircle, Plus, RefreshCw, Search, Server, Shield, TestTube2, X } from "lucide-react";
import OisCard from "@/components/ois/OisCard";
import OisDrawer from "@/components/ois/OisDrawer";
import OisListItem from "@/components/ois/OisListItem";
import OisStatusBadge from "@/components/ois/OisStatusBadge";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import CameraPlayer from "@/components/cameras/CameraPlayer";
import cameraService, { type BoundCamera, type CameraDvr, type CameraEvent, type CameraPrivacyScope, type DiscoveredCamera, type DvrBrand, type DvrChannelDraft } from "@/services/cameraService";
import { facilityService } from "@/services/facilityService";

const brands: Array<{ value: DvrBrand; label: string }> = [
  { value: "generic_rtsp", label: "Generic RTSP" },
  { value: "hikvision", label: "Hikvision" },
  { value: "dahua", label: "Dahua" },
  { value: "hilook", label: "HiLook" },
  { value: "uniview", label: "Uniview" },
];

function text(value: any, fallback = "Unavailable") {
  const s = String(value ?? "").trim();
  return s || fallback;
}

function state(camera: BoundCamera) {
  return String(camera.status || camera.health_status || camera.stream_status || "unknown").toLowerCase();
}

function when(value?: string | null) {
  if (!value) return "No live timestamp";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "No live timestamp" : date.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function tone(value: string) {
  if (["online", "active", "healthy", "ok"].includes(value)) return "stable";
  if (["offline", "error", "failed", "degraded"].includes(value)) return "critical";
  return "warning";
}

function ipFromDiscovery(camera: DiscoveredCamera) {
  return text(camera?.metadata?.raw?.ip || camera?.metadata?.ip || camera?.externalId, "");
}

function rtspFromDiscovery(camera: DiscoveredCamera) {
  return text(camera?.metadata?.raw?.rtsp || camera?.metadata?.rtsp, "");
}

function privacyLabel(scope?: string | null) {
  if (scope === "home") return "Home";
  if (scope === "office") return "Office";
  return "Estate";
}

function playbackErrorMessage(requestError: any) {
  const data = requestError?.response?.data || {};
  const raw = String(data.message || data.error || data.reason || requestError?.message || "").toLowerCase();
  const edgeStatus = String(data.edge_status || data.playback?.edge_status || "").toLowerCase();
  const streamStatus = String(data.stream_status || data.playback?.stream_status || "").toLowerCase();
  if (
    /stream runtime unavailable|hls missing|missing hls|waiting_for_edge_runtime|private network|edge/.test(raw) ||
    /missing_hls|offline|unavailable/.test(edgeStatus) ||
    /pending_stream_details|waiting_for_edge_runtime/.test(streamStatus)
  ) {
    return "This camera source is on a private network. Deploy an Oyi Edge node on the same LAN.";
  }
  return data.error || data.message || requestError?.message || "Playback unavailable for this camera.";
}

export default function CamerasPage() {
  const [estateId, setEstateId] = useState("");
  const [items, setItems] = useState<BoundCamera[]>([]);
  const [dvrs, setDvrs] = useState<CameraDvr[]>([]);
  const [summary, setSummary] = useState({ dvrs: 0, cameras: 0, healthy_streams: 0, offline_streams: 0, edge_nodes: 0, ai_enabled_cameras: 0 });
  const [events, setEvents] = useState<Array<CameraEvent & { camera_name?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [source, setSource] = useState<"dvr" | "camera">("dvr");
  const [step, setStep] = useState(1);
  const [scanResults, setScanResults] = useState<DiscoveredCamera[]>([]);
  const [scanning, setScanning] = useState(false);
  const [cidr, setCidr] = useState("192.168.1.0/24");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [location, setLocation] = useState("");
  const [credentialRef, setCredentialRef] = useState("local:generic-rtsp-main");
  const [edgeNodeId, setEdgeNodeId] = useState("");
  const [binding, setBinding] = useState<DiscoveredCamera | null>(null);
  const [bindName, setBindName] = useState("");
  const [playing, setPlaying] = useState<BoundCamera | null>(null);
  const [profileCamera, setProfileCamera] = useState<BoundCamera | null>(null);
  const [profileState, setProfileState] = useState<Record<string, any> | null>(null);
  const [query, setQuery] = useState("");
  const [scopeFilter, setScopeFilter] = useState<"all" | CameraPrivacyScope>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline">("all");
  const [validation, setValidation] = useState<Record<string, string>>({});

  const [dvrName, setDvrName] = useState("Main DVR");
  const [brand, setBrand] = useState<DvrBrand>("generic_rtsp");
  const [dvrIp, setDvrIp] = useState("");
  const [dvrPort, setDvrPort] = useState("554");
  const [channelCount, setChannelCount] = useState("4");
  const [channels, setChannels] = useState<DvrChannelDraft[]>([]);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const estate = await facilityService.overview().then((r) => r.estate_id).catch(async () => {
        const estates = await facilityService.myEstates();
        return estates.estates?.[0]?.id || "";
      });
      setEstateId(estate || "");
      if (!estate) {
        setItems([]);
        setEvents([]);
        setDvrs([]);
        return;
      }
      const inventory = await cameraService.inventoryByEstate(estate).catch(async () => {
        const cameras = await cameraService.listByEstate(estate).then((r) => r.items || []);
        return { ok: true, cameras, dvrs: [], summary: { dvrs: 0, cameras: cameras.length, healthy_streams: 0, offline_streams: 0, edge_nodes: 0, ai_enabled_cameras: 0 } };
      });
      const cameraRows = inventory.cameras || [];
      setItems(cameraRows);
      setDvrs(inventory.dvrs || []);
      setSummary(inventory.summary || { dvrs: 0, cameras: cameraRows.length, healthy_streams: 0, offline_streams: 0, edge_nodes: 0, ai_enabled_cameras: 0 });
      const eventRows = await Promise.all(cameraRows.slice(0, 12).map(async (camera) => {
        const result = await cameraService.listEvents(camera.id, { limit: 12, sinceMinutes: 24 * 60 }).catch(() => ({ events: [] }));
        return (result.events || []).map((event) => ({ ...event, camera_name: camera.name || camera.ip || "Camera" }));
      }));
      setEvents(eventRows.flat().sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()).slice(0, 80));
    } catch (requestError: any) {
      setError(requestError?.response?.data?.error || requestError?.message || "Unable to load cameras.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const onRealtime = (event: Event) => {
      const name = (event as CustomEvent)?.detail?.event || "";
      if (/camera|security|incident|notification/.test(name)) void load();
    };
    window.addEventListener("facility:realtime-event", onRealtime);
    return () => window.removeEventListener("facility:realtime-event", onRealtime);
  }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((camera) => {
      const s = state(camera);
      const scope = String(camera.privacy_scope || camera.metadata?.privacy_scope || "facility") as CameraPrivacyScope;
      const matchesScope = scopeFilter === "all" || scope === scopeFilter;
      const matchesStatus = statusFilter === "all" || (statusFilter === "online" ? ["online", "active", "healthy", "ok"].includes(s) : ["offline", "error", "failed", "degraded"].includes(s));
      const haystack = [camera.name, camera.ip, camera.location, camera.nvr_id, camera.channel, camera.edge_node_id].map((x) => String(x || "").toLowerCase()).join(" ");
      return matchesScope && matchesStatus && (!needle || haystack.includes(needle));
    });
  }, [items, query, scopeFilter, statusFilter]);

  function resetImport() {
    setStep(1);
    setSource("dvr");
    setTestResult(null);
    setChannels([]);
    setUsername("");
    setPassword("");
  }

  async function runDvrTest() {
    setWorking(true);
    setError(null);
    try {
      const result = await cameraService.testDvr({ estateId, name: dvrName, brand, ip_address: dvrIp, port: Number(dvrPort || 554), username, password, channel_count: Number(channelCount || 0) });
      setTestResult(result.message);
      setChannels(result.channels?.length ? result.channels : Array.from({ length: Math.max(0, Number(channelCount || 0)) }, (_, index) => ({ channel_number: index + 1, camera_name: `Channel ${index + 1}`, location: "", privacy_scope: "facility" as const, enabled: true })));
      setStep(3);
    } catch (requestError: any) {
      const msg = requestError?.response?.data?.message || requestError?.response?.data?.error || requestError?.message || "DVR test failed.";
      setTestResult(msg);
      setError(msg);
    } finally {
      setWorking(false);
    }
  }

  async function saveDvr() {
    setWorking(true);
    setError(null);
    try {
      const result = await cameraService.importDvr({ estateId, name: dvrName, brand, ip_address: dvrIp, port: Number(dvrPort || 554), username, password, channel_count: Number(channelCount || channels.length), edge_node_id: edgeNodeId || undefined, channels });
      setPassword("");
      setUsername("");
      setImportOpen(false);
      resetImport();
      setNotice(`${result.cameras.length} camera channels imported. Edge registry is ready for runtime generation.`);
      await load();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.error || requestError?.message || "Unable to import DVR.");
    } finally {
      setWorking(false);
    }
  }

  async function scan() {
    setScanning(true);
    setError(null);
    try {
      const result = await cameraService.scan({ cidr, username: username || undefined, password: password || undefined });
      setScanResults(result.items || []);
      if (!result.items?.length) setNotice("No cameras returned. Local scanning requires reachable ONVIF/LAN sources.");
    } catch (requestError: any) {
      setError(requestError?.response?.data?.error || requestError?.message || "Camera scan unavailable.");
    } finally {
      setScanning(false);
    }
  }

  async function bind() {
    if (!binding) return;
    const ip = ipFromDiscovery(binding);
    const rtsp = rtspFromDiscovery(binding);
    if (!ip || !rtsp) {
      setError("Selected camera needs a stable IP and RTSP URI before binding.");
      return;
    }
    try {
      await cameraService.bind({ estateId: estateId || undefined, name: bindName || binding.name || `Camera ${ip}`, ip, rtsp_url: rtsp, location: location || undefined, camera_type: "ip_camera", privacy_scope: "facility", edge_node_id: edgeNodeId || undefined, credential_ref: credentialRef || undefined });
      setBinding(null);
      setScanOpen(false);
      setPassword("");
      setUsername("");
      setNotice("Camera bound to estate registry.");
      await load();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.error || requestError?.message || "Unable to bind camera.");
    }
  }

  async function openPlayback(camera: BoundCamera) {
    setPlaying(camera);
    setError(null);
    try {
      await cameraService.getPlayback(camera.id);
    } catch (requestError: any) {
      setError(playbackErrorMessage(requestError));
    }
  }

  async function validate(camera: BoundCamera) {
    setValidation((prev) => ({ ...prev, [camera.id]: "Checking" }));
    try {
      const result = await cameraService.validateStream(camera.id);
      setValidation((prev) => ({ ...prev, [camera.id]: `${result.status}: ${result.reason}` }));
    } catch (requestError: any) {
      setValidation((prev) => ({ ...prev, [camera.id]: requestError?.response?.data?.reason || requestError?.response?.data?.error || "Validation failed" }));
    }
  }

  async function openProfile(camera: BoundCamera) {
    setProfileCamera(camera);
    const result = await cameraService.getAiProfile(camera.id).catch(() => ({ ok: false }));
    setProfileState("profile" in result ? result.profile || null : null);
  }

  return (
    <div className="space-y-6">
      <Topbar title="Camera Operations" subtitle="DVR import, camera inventory, stream health, playback, and event readiness." strip={[{ label: "DVRs", value: loading ? "Loading" : summary.dvrs, detail: "Registered sources", tone: "attention" }, { label: "Cameras", value: summary.cameras, detail: "Imported channels", tone: "attention" }, { label: "Attention", value: summary.offline_streams, detail: "Offline streams", tone: summary.offline_streams ? "warning" : "stable" }, { label: "AI", value: summary.ai_enabled_cameras, detail: "Profiles enabled", tone: "info" }]} rightSlot={<div className="flex gap-2"><Button variant="ghost" onClick={() => void load()} disabled={loading} className="gap-2"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh</Button><Button onClick={() => { resetImport(); setImportOpen(true); }} className="gap-2"><Plus className="h-4 w-4" /> Import DVR/NVR</Button></div>} />
      {error ? <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}
      {notice ? <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{notice}</div> : null}

      <OisCard className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-white">Camera Inventory</h2><p className="mt-1 text-xs text-zinc-500">DVR channels, standalone IP cameras, privacy scope, stream state, and Edge assignment.</p></div><Button variant="ghost" onClick={() => setScanOpen(true)} className="gap-2"><Search className="h-4 w-4" /> Import Camera</Button></div>
        <div className="mt-4 grid gap-3 md:grid-cols-4"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search camera, IP, DVR, location" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none md:col-span-2" /><select value={scopeFilter} onChange={(e) => setScopeFilter(e.target.value as any)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"><option value="all">All scopes</option><option value="facility">Estate</option><option value="home">Home</option><option value="office">Office</option></select><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"><option value="all">All status</option><option value="online">Online / healthy</option><option value="offline">Offline / failed</option></select></div>
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10"><div className="hidden grid-cols-7 gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3 text-[10px] uppercase tracking-[0.16em] text-zinc-500 md:grid"><span>DVR</span><span>Channel</span><span>Location</span><span>Status</span><span>Privacy</span><span>Edge</span><span>Last seen</span></div>{filtered.map((camera) => { const s = state(camera); return <article key={camera.id} className="grid gap-3 border-b border-white/5 px-4 py-3 text-sm last:border-b-0 md:grid-cols-7"><span className="hidden text-zinc-300 md:block">{text(dvrs.find((dvr) => dvr.id === camera.nvr_id)?.name || camera.nvr_id, "Standalone")}</span><span className="text-white">{camera.channel ? `CH ${camera.channel}` : text(camera.name, "IP Camera")}</span><span className="text-zinc-300">{text(camera.location || camera.name, "Unmapped")}</span><span><OisStatusBadge status={tone(s)} label={s} className="uppercase" /></span><span className="hidden text-zinc-300 md:block">{privacyLabel(camera.privacy_scope || camera.metadata?.privacy_scope)}</span><span className="hidden text-zinc-300 md:block">{text(camera.edge_node_id, "No Edge")}</span><span className="text-xs text-zinc-500">{when(camera.last_seen_at)}</span><div className="flex flex-wrap gap-2 md:col-span-7"><Button variant="ghost" onClick={() => void openPlayback(camera)} className="gap-2"><PlayCircle className="h-4 w-4" /> Playback</Button><Button variant="ghost" onClick={() => void validate(camera)} className="gap-2"><TestTube2 className="h-4 w-4" /> Validate</Button><Button variant="ghost" onClick={() => void openProfile(camera)} className="gap-2"><Brain className="h-4 w-4" /> AI</Button>{validation[camera.id] ? <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">{validation[camera.id]}</span> : null}</div></article>; })}{!filtered.length && !loading ? <p className="p-5 text-sm text-zinc-500">No cameras match this inventory view.</p> : null}</div>
      </OisCard>

      <section className="grid gap-4 lg:grid-cols-2"><OisCard className="p-5"><h2 className="text-sm font-semibold text-white">Registered DVR/NVR Sources</h2><div className="mt-4 space-y-2">{dvrs.map((dvr) => <OisListItem key={dvr.id} title={dvr.name} description={`${dvr.brand} · ${dvr.ip_address}:${dvr.port} · ${dvr.channel_count} channels · ${dvr.edge_node_id || "No Edge node"}`} status={tone(String(dvr.status || "pending").toLowerCase())} />)}{!dvrs.length ? <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">No DVR/NVR source imported yet.</p> : null}</div></OisCard><OisCard className="p-5"><h2 className="text-sm font-semibold text-white">Recent camera events</h2><div className="mt-4 space-y-2">{events.slice(0, 8).map((event) => <OisListItem key={event.id} title={text(event.event_type).replace(/_/g, " ")} description={`${event.camera_name || event.camera_id} · ${when(event.created_at)}`} meta={`confidence ${event.confidence ?? "n/a"}`} />)}{!events.length && !loading ? <p className="rounded-xl border border-dashed border-white/10 p-3 text-sm text-zinc-500">No recent camera events from backend.</p> : null}</div></OisCard></section>

      {importOpen ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm"><section className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-2xl border border-white/10 bg-zinc-950 p-5"><header className="flex justify-between gap-3"><div><h2 className="text-lg font-semibold text-white">Import camera source</h2><p className="mt-1 text-sm text-zinc-500">Import DVR/NVR channels or a standalone camera. Raw passwords are cleared after save.</p></div><button type="button" onClick={() => setImportOpen(false)}><X className="h-4 w-4 text-zinc-400" /></button></header><div className="mt-5 flex flex-wrap gap-2">{[1, 2, 3, 4, 5].map((n) => <span key={n} className={`rounded-full border px-3 py-1 text-xs ${step === n ? "border-sky-400/30 bg-sky-500/10 text-sky-100" : "border-white/10 text-zinc-500"}`}>Step {n}</span>)}</div>{step === 1 ? <div className="mt-6 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => { setSource("dvr"); setStep(2); }} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-left hover:border-sky-400/30"><Server className="h-6 w-6 text-sky-200" /><p className="mt-4 text-base font-semibold text-white">Import DVR/NVR</p><p className="mt-2 text-sm text-zinc-500">Create DVR record, channel cameras, credential reference, and Edge registry entries.</p></button><button type="button" onClick={() => { setSource("camera"); setImportOpen(false); setScanOpen(true); }} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-left hover:border-sky-400/30"><Camera className="h-6 w-6 text-sky-200" /><p className="mt-4 text-base font-semibold text-white">Import Camera</p><p className="mt-2 text-sm text-zinc-500">Scan ONVIF/RTSP cameras or bind a standalone source.</p></button></div> : null}{step === 2 && source === "dvr" ? <div className="mt-6 grid gap-3 sm:grid-cols-2"><input value={dvrName} onChange={(e) => setDvrName(e.target.value)} placeholder="DVR Name" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none" /><select value={brand} onChange={(e) => setBrand(e.target.value as DvrBrand)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none">{brands.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><input value={dvrIp} onChange={(e) => setDvrIp(e.target.value)} placeholder="IP Address" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none" /><input value={dvrPort} onChange={(e) => setDvrPort(e.target.value)} placeholder="Port" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none" /><input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none" /><input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none" /><input value={channelCount} onChange={(e) => setChannelCount(e.target.value)} placeholder="Channel count" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none" /><input value={edgeNodeId} onChange={(e) => setEdgeNodeId(e.target.value)} placeholder="Edge node ID" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none" /><div className="sm:col-span-2 flex justify-end gap-2"><Button variant="ghost" onClick={() => setStep(1)}>Back</Button><Button onClick={() => void runDvrTest()} disabled={working || !dvrIp || !channelCount} className="gap-2"><TestTube2 className="h-4 w-4" /> {working ? "Testing" : "Test Connection"}</Button></div>{testResult ? <p className="sm:col-span-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100">{testResult}</p> : null}</div> : null}{step === 3 ? <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.035] p-5"><div className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-emerald-300" /><div><p className="text-sm font-semibold text-white">DVR discovery result</p><p className="text-xs text-zinc-500">Channels found: {channels.length} · ONVIF: provided by source · RTSP: prepared</p></div></div><div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={() => setStep(2)}>Back</Button><Button onClick={() => setStep(4)}>Import channels</Button></div></div> : null}{step === 4 ? <div className="mt-6 space-y-3"><p className="text-sm text-zinc-400">Name channels and assign privacy scope before saving.</p>{channels.map((channel, index) => <div key={channel.channel_number} className="grid gap-2 rounded-xl border border-white/10 bg-black/15 p-3 sm:grid-cols-5"><span className="py-3 text-sm text-white">Channel {channel.channel_number}</span><input value={channel.camera_name} onChange={(e) => setChannels((prev) => prev.map((item, i) => i === index ? { ...item, camera_name: e.target.value } : item))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none sm:col-span-2" /><input value={channel.location || ""} onChange={(e) => setChannels((prev) => prev.map((item, i) => i === index ? { ...item, location: e.target.value } : item))} placeholder="Location" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none" /><select value={channel.privacy_scope} onChange={(e) => setChannels((prev) => prev.map((item, i) => i === index ? { ...item, privacy_scope: e.target.value as CameraPrivacyScope } : item))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"><option value="facility">Estate</option><option value="home">Home</option><option value="office">Office</option></select></div>)}<div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setStep(3)}>Back</Button><Button onClick={() => setStep(5)}>Review</Button></div></div> : null}{step === 5 ? <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.035] p-5"><Shield className="h-5 w-5 text-sky-200" /><p className="mt-3 text-sm text-white">Ready to save {channels.length} channels for {dvrName}.</p><p className="mt-2 text-xs text-zinc-500">The backend will store a credential reference only. Password fields will be cleared from this screen after save.</p><div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={() => setStep(4)}>Back</Button><Button onClick={() => void saveDvr()} disabled={working}>{working ? "Saving" : "Save DVR and Channels"}</Button></div></div> : null}</section></div> : null}

      {scanOpen ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm"><section className="w-full max-w-3xl rounded-2xl border border-white/10 bg-zinc-950 p-5"><header className="flex justify-between gap-3"><div><h2 className="text-lg font-semibold text-white">Import standalone camera</h2><p className="mt-1 text-sm text-zinc-500">Scan ONVIF cameras or bind a reachable RTSP source.</p></div><button type="button" onClick={() => setScanOpen(false)}><X className="h-4 w-4 text-zinc-400" /></button></header><div className="mt-5 grid gap-3 sm:grid-cols-3"><input value={cidr} onChange={(e) => setCidr(e.target.value)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" /><input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ONVIF user" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" /><input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="ONVIF password" type="password" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" /></div><Button onClick={() => void scan()} disabled={scanning} className="mt-4 gap-2"><Search className="h-4 w-4" /> {scanning ? "Scanning" : "Run scan"}</Button><div className="mt-4 grid gap-2">{scanResults.map((camera) => <button key={camera.externalId} type="button" onClick={() => { setBinding(camera); setBindName(camera.name || ""); }} className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-left hover:border-sky-400/30"><p className="text-sm text-white">{camera.name}</p><p className="text-xs text-zinc-500">{ipFromDiscovery(camera) || "IP unavailable"} · {rtspFromDiscovery(camera) ? "RTSP ready" : "RTSP unavailable"}</p></button>)}</div></section></div> : null}
      {binding ? <div className="fixed inset-0 z-[60] grid place-items-center bg-black/75 p-4 backdrop-blur-sm"><section className="w-full max-w-xl rounded-2xl border border-white/10 bg-zinc-950 p-5"><h2 className="text-lg font-semibold text-white">Bind camera</h2><div className="mt-5 grid gap-3 sm:grid-cols-2"><input value={bindName} onChange={(e) => setBindName(e.target.value)} placeholder="Camera name" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none" /><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location e.g. Main Gate" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none" /><input value={credentialRef} onChange={(e) => setCredentialRef(e.target.value)} placeholder="Credential ref" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none" /><input value={edgeNodeId} onChange={(e) => setEdgeNodeId(e.target.value)} placeholder="Edge node ID" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none" /></div><p className="mt-3 text-xs text-zinc-500">{ipFromDiscovery(binding)} · {rtspFromDiscovery(binding) || "RTSP unavailable"} · Credentials remain local through credential references.</p><footer className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={() => setBinding(null)}>Cancel</Button><Button onClick={() => void bind()} disabled={!ipFromDiscovery(binding) || !rtspFromDiscovery(binding)}><Link2 className="mr-2 h-4 w-4" /> Save Camera</Button></footer></section></div> : null}
      <OisDrawer open={Boolean(playing)} onClose={() => setPlaying(null)} title={playing?.name || playing?.ip || "Camera playback"} subtitle={playing ? `${text(playing.location || playing.ip, "Camera source")} · ${privacyLabel(playing.privacy_scope || playing.metadata?.privacy_scope)}` : undefined} width="lg">
        {playing ? <div className="space-y-4"><OisCard variant="evidence" className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-zinc-300">{text(playing.location || playing.name, "Camera source")}</p><p className="mt-2 text-xs text-zinc-500">Playback tokens are requested by the player and are not displayed.</p></div><OisStatusBadge status={tone(state(playing))} label={state(playing)} className="uppercase" /></div></OisCard><CameraPlayer cameraId={playing.id} variant="hero" /></div> : null}
      </OisDrawer>
      <OisDrawer open={Boolean(profileCamera)} onClose={() => setProfileCamera(null)} title="AI profile" subtitle={profileCamera ? (profileCamera.name || profileCamera.ip || undefined) : undefined} width="md">
        {profileCamera ? <div className="space-y-4"><OisCard variant="evidence" className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-zinc-300">{profileCamera.location || profileCamera.ip || "Camera source"}</p><p className="mt-2 text-xs text-zinc-500">AI metadata only. No stream control changes are performed here.</p></div><OisStatusBadge status={tone(state(profileCamera))} label={state(profileCamera)} className="uppercase" /></div></OisCard>{profileState ? <pre className="max-h-80 overflow-auto rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-zinc-300">{JSON.stringify(profileState, null, 2)}</pre> : <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">AI profile backend is not configured for this camera yet.</p>}</div> : null}
      </OisDrawer>
    </div>
  );
}
