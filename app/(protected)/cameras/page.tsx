"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Brain, Camera, Link2, PlayCircle, RefreshCw, Search, X } from "lucide-react";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import CameraPlayer from "@/components/cameras/CameraPlayer";
import cameraService, { type BoundCamera, type CameraEvent, type DiscoveredCamera } from "@/services/cameraService";
import { facilityService } from "@/services/facilityService";

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
  if (["online", "active", "healthy", "ok"].includes(value)) return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
  if (["offline", "error", "failed", "degraded"].includes(value)) return "border-rose-500/20 bg-rose-500/10 text-rose-200";
  return "border-amber-500/20 bg-amber-500/10 text-amber-100";
}

function ipFromDiscovery(camera: DiscoveredCamera) {
  return text(camera?.metadata?.raw?.ip || camera?.metadata?.ip || camera?.externalId, "");
}

function rtspFromDiscovery(camera: DiscoveredCamera) {
  return text(camera?.metadata?.raw?.rtsp || camera?.metadata?.rtsp, "");
}

function Metric({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-[10px] uppercase tracking-[0.17em] text-zinc-500">{label}</p><p className="mt-3 text-2xl font-semibold text-white">{value}</p><p className="mt-2 text-xs text-zinc-500">{hint}</p></div>;
}

export default function CamerasPage() {
  const [estateId, setEstateId] = useState("");
  const [items, setItems] = useState<BoundCamera[]>([]);
  const [events, setEvents] = useState<Array<CameraEvent & { camera_name?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanResults, setScanResults] = useState<DiscoveredCamera[]>([]);
  const [scanning, setScanning] = useState(false);
  const [cidr, setCidr] = useState("192.168.1.0/24");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [binding, setBinding] = useState<DiscoveredCamera | null>(null);
  const [bindName, setBindName] = useState("");
  const [playing, setPlaying] = useState<BoundCamera | null>(null);
  const [profileCamera, setProfileCamera] = useState<BoundCamera | null>(null);
  const [profileState, setProfileState] = useState<Record<string, any> | null>(null);

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
        return;
      }
      const cameras = await cameraService.listByEstate(estate).then((r) => r.items || []);
      setItems(cameras);
      const eventRows = await Promise.all(cameras.slice(0, 12).map(async (camera) => {
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

  const healthy = items.filter((camera) => ["online", "active", "healthy", "ok"].includes(state(camera))).length;
  const bound = items.filter((camera) => Boolean(camera.rtsp_url || camera.edge_node_id)).length;
  const degraded = items.filter((camera) => ["offline", "error", "failed", "degraded"].includes(state(camera))).length;

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
      await cameraService.bind({ estateId: estateId || undefined, name: bindName || binding.name || `Camera ${ip}`, ip, rtsp_url: rtsp, username: username || undefined, password: password || undefined });
      setBinding(null);
      setScanOpen(false);
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
      setError(requestError?.response?.data?.error || requestError?.message || "Playback unavailable for this camera.");
    }
  }

  async function openProfile(camera: BoundCamera) {
    setProfileCamera(camera);
    const result = await cameraService.getAiProfile(camera.id).catch(() => ({ ok: false }));
    setProfileState("profile" in result ? result.profile || null : null);
  }

  return (
    <div className="space-y-6">
      <Topbar title="Camera Operations" subtitle="Camera registry, stream health, scan, playback, and intelligence readiness." rightSlot={<Button variant="ghost" onClick={() => void load()} disabled={loading} className="gap-2"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh</Button>} />
      {error ? <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}
      {notice ? <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{notice}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Camera registry" value={loading ? "Loading" : items.length} hint="Bound estate cameras" />
        <Metric label="Healthy" value={healthy} hint="Online or healthy streams" />
        <Metric label="Bound sources" value={bound} hint="RTSP or Edge-linked cameras" />
        <Metric label="Degraded" value={degraded} hint="Offline or failed streams" />
        <Metric label="Recent events" value={events.length} hint="Camera event records" />
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-white">Camera registry</h2><p className="mt-1 text-xs text-zinc-500">{items.length ? "Physical camera source state from backend." : "No live camera source configured."}</p></div><Button onClick={() => setScanOpen(true)} className="gap-2"><Search className="h-4 w-4" /> Scan cameras</Button></div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">{items.map((camera) => { const s = state(camera); return <article key={camera.id} className="rounded-2xl border border-white/10 bg-black/15 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-white">{camera.name || camera.ip || "Camera"}</h3><p className="mt-1 text-xs text-zinc-500">{camera.ip || "IP unavailable"} · {camera.edge_node_id || "No Edge node"} · {when(camera.last_seen_at)}</p></div><span className={`rounded-full border px-2 py-1 text-[10px] uppercase ${tone(s)}`}>{s}</span></div><div className="mt-4 flex flex-wrap gap-2"><Button variant="ghost" onClick={() => void openPlayback(camera)} className="gap-2"><PlayCircle className="h-4 w-4" /> Playback</Button><Button variant="ghost" onClick={() => void openProfile(camera)} className="gap-2"><Brain className="h-4 w-4" /> AI profile</Button></div></article>; })}{!items.length && !loading ? <p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-zinc-500">No live camera source configured. Scan ONVIF cameras or wait for Oyi Edge discovery.</p> : null}</div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><h2 className="text-sm font-semibold text-white">Recent camera events</h2><div className="mt-4 space-y-2">{events.map((event) => <div key={event.id} className="rounded-xl border border-white/10 bg-black/15 px-3 py-3"><p className="text-sm text-white">{text(event.event_type).replace(/_/g, " ")}</p><p className="mt-1 text-xs text-zinc-500">{event.camera_name || event.camera_id} · {when(event.created_at)} · confidence {event.confidence ?? "n/a"}</p><p className="mt-1 text-xs text-zinc-400">{event.message || "Camera event"}</p></div>)}{!events.length && !loading ? <p className="rounded-xl border border-dashed border-white/10 p-3 text-sm text-zinc-500">No recent camera events from backend.</p> : null}</div></section>

      {scanOpen ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm"><section className="w-full max-w-3xl rounded-2xl border border-white/10 bg-zinc-950 p-5"><header className="flex justify-between gap-3"><div><h2 className="text-lg font-semibold text-white">Scan cameras</h2><p className="mt-1 text-sm text-zinc-500">Requires reachable ONVIF/LAN cameras or Edge-backed discovery.</p></div><button type="button" onClick={() => setScanOpen(false)}><X className="h-4 w-4 text-zinc-400" /></button></header><div className="mt-5 grid gap-3 sm:grid-cols-3"><input value={cidr} onChange={(e) => setCidr(e.target.value)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" /><input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ONVIF user" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" /><input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="ONVIF password" type="password" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" /></div><Button onClick={() => void scan()} disabled={scanning} className="mt-4 gap-2"><Search className="h-4 w-4" /> {scanning ? "Scanning" : "Run scan"}</Button><div className="mt-4 grid gap-2">{scanResults.map((camera) => <button key={camera.externalId} type="button" onClick={() => { setBinding(camera); setBindName(camera.name || ""); }} className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-left hover:border-sky-400/30"><p className="text-sm text-white">{camera.name}</p><p className="text-xs text-zinc-500">{ipFromDiscovery(camera) || "IP unavailable"} · {rtspFromDiscovery(camera) ? "RTSP ready" : "RTSP unavailable"}</p></button>)}</div></section></div> : null}
      {binding ? <div className="fixed inset-0 z-[60] grid place-items-center bg-black/75 p-4 backdrop-blur-sm"><section className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-5"><h2 className="text-lg font-semibold text-white">Bind camera</h2><input value={bindName} onChange={(e) => setBindName(e.target.value)} placeholder="Camera name" className="mt-5 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none" /><p className="mt-3 text-xs text-zinc-500">{ipFromDiscovery(binding)} · {rtspFromDiscovery(binding) || "RTSP unavailable"}</p><footer className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={() => setBinding(null)}>Cancel</Button><Button onClick={() => void bind()} disabled={!ipFromDiscovery(binding) || !rtspFromDiscovery(binding)}><Link2 className="mr-2 h-4 w-4" /> Bind</Button></footer></section></div> : null}
      {playing ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm"><section className="w-full max-w-4xl rounded-2xl border border-white/10 bg-zinc-950 p-5"><header className="flex justify-between gap-3"><h2 className="text-lg font-semibold text-white">{playing.name || playing.ip || "Camera playback"}</h2><button type="button" onClick={() => setPlaying(null)}><X className="h-4 w-4 text-zinc-400" /></button></header><div className="mt-5"><CameraPlayer cameraId={playing.id} variant="hero" /></div><p className="mt-3 text-xs text-zinc-500">Playback tokens are requested by the player and are not displayed.</p></section></div> : null}
      {profileCamera ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm"><section className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-950 p-5"><header className="flex justify-between gap-3"><h2 className="text-lg font-semibold text-white">AI profile</h2><button type="button" onClick={() => setProfileCamera(null)}><X className="h-4 w-4 text-zinc-400" /></button></header><p className="mt-2 text-sm text-zinc-400">{profileCamera.name || profileCamera.ip}</p>{profileState ? <pre className="mt-4 max-h-80 overflow-auto rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-zinc-300">{JSON.stringify(profileState, null, 2)}</pre> : <p className="mt-4 rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">AI profile backend is not configured for this camera yet.</p>}</section></div> : null}
    </div>
  );
}
