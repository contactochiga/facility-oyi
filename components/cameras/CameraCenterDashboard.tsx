"use client";

import { useMemo } from "react";
import {
  AlertTriangle, Camera, CircleOff, CloudOff, Database, Eye, HardDrive,
  MoreVertical, Play, Radio, Search, Server, ShieldAlert, Video,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import OisCard from "@/components/ois/OisCard";
import OisStatusBadge from "@/components/ois/OisStatusBadge";
import Button from "@/components/ui/Button";
import type { BoundCamera, CameraDvr, CameraEvent } from "@/services/cameraService";
import { getCameraEventOccurrenceTime, getCameraLastActivity } from "@/lib/oyi-camera-core/core";

type EdgeNode = Record<string, any>;
type MediaStats = { count: number; bytes: number; evidence: number };

type Props = {
  cameras: BoundCamera[];
  dvrs: CameraDvr[];
  events: Array<CameraEvent & { camera_name?: string; camera_location?: string; thumbnail_url?: string | null }>;
  edgeNodes: EdgeNode[];
  media: MediaStats;
  loading: boolean;
  query: string;
  scopeFilter: string;
  statusFilter: string;
  filtered: BoundCamera[];
  validation: Record<string, string>;
  onQuery: (value: string) => void;
  onScope: (value: string) => void;
  onStatus: (value: string) => void;
  onOpenCamera: (camera: BoundCamera) => void;
  onValidate: (camera: BoundCamera) => void;
  onProfile: (camera: BoundCamera) => void;
  onImportCamera: () => void;
};

const cameraState = (camera: BoundCamera) => camera.runtimeState;
const stateColour = { online: "#22c55e", degraded: "#f59e0b", offline: "#ef4444", unknown: "#64748b" } as const;
const text = (value: unknown, fallback = "Unavailable") => String(value ?? "").trim() || fallback;

function relativeTime(value?: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Time unavailable";
  return `${new Date(value).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function bytes(value: number) {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  return `${(value / 1024 ** index).toFixed(index > 2 ? 1 : 0)} ${units[index]}`;
}

function severityTone(value: string) {
  const severity = value.toLowerCase();
  if (["critical", "high"].includes(severity)) return "critical";
  if (["medium", "warning"].includes(severity)) return "warning";
  return "attention";
}

function SummaryCard({ icon, label, value, detail, colour }: { icon: React.ReactNode; label: string; value: number; detail: string; colour: string }) {
  return <OisCard className="flex min-h-[82px] items-center gap-3 px-4 py-3">
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/7 bg-white/[0.035]" style={{ color: colour }}>{icon}</span>
    <span className="min-w-0"><span className="block text-[22px] font-semibold leading-6 text-white">{value}</span><span className="mt-1 block text-xs font-medium text-zinc-300">{label}</span><span className="block text-[10px] text-zinc-600">{detail}</span></span>
  </OisCard>;
}

function CameraTile({ camera, onOpen }: { camera: BoundCamera; onOpen: () => void }) {
  const state = cameraState(camera);
  const colour = stateColour[state];
  return <article className="group overflow-hidden rounded-[10px] border border-white/8 bg-[#0a141d] transition hover:border-sky-400/25">
    <button type="button" onClick={onOpen} className="relative block aspect-video w-full overflow-hidden bg-[radial-gradient(circle_at_50%_35%,rgba(23,67,99,.3),rgba(3,9,14,.96)_68%)] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400">
      <span className="absolute left-2 top-2 rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide" style={{ borderColor: `${colour}80`, background: `${colour}22`, color: colour }}>{state === "unknown" ? "unavailable" : state === "online" ? "live" : state}</span>
      <span className="absolute inset-0 grid place-items-center"><span className="grid h-11 w-11 place-items-center rounded-full border border-white/8 bg-black/25 text-zinc-600"><Video className="h-5 w-5" /></span></span>
      <span className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-7 text-[10px] text-zinc-400"><Play className="h-3 w-3" /> Open authorized live view</span>
    </button>
    <div className="flex items-start gap-2 px-3 py-2.5"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: colour }} /><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-white">{camera.name}</span><span className="block truncate text-[10px] text-zinc-500">{text(camera.location, "Location not assigned")}</span></span><MoreVertical className="h-3.5 w-3.5 text-zinc-600" aria-hidden="true" /></div>
  </article>;
}

function EmptyPanel({ icon, title, detail, action }: { icon: React.ReactNode; title: string; detail: string; action?: React.ReactNode }) {
  return <div className="grid min-h-[220px] place-items-center rounded-[10px] border border-dashed border-white/9 bg-black/10 px-6 text-center"><div><span className="mx-auto grid h-11 w-11 place-items-center rounded-xl border border-white/8 bg-white/[0.025] text-zinc-600">{icon}</span><p className="mt-3 text-sm font-medium text-zinc-200">{title}</p><p className="mx-auto mt-1 max-w-md text-xs leading-5 text-zinc-500">{detail}</p>{action ? <div className="mt-4">{action}</div> : null}</div></div>;
}

export default function CameraCenterDashboard(props: Props) {
  const counts = useMemo(() => ({
    online: props.cameras.filter((item) => cameraState(item) === "online").length,
    degraded: props.cameras.filter((item) => cameraState(item) === "degraded").length,
    offline: props.cameras.filter((item) => cameraState(item) === "offline").length,
    unknown: props.cameras.filter((item) => cameraState(item) === "unknown").length,
  }), [props.cameras]);
  const healthData = [
    { name: "Online", value: counts.online, colour: stateColour.online },
    { name: "Degraded", value: counts.degraded, colour: stateColour.degraded },
    { name: "Offline", value: counts.offline, colour: stateColour.offline },
    { name: "Unknown", value: counts.unknown, colour: stateColour.unknown },
  ];
  const attention = props.cameras.filter((camera) => ["offline", "degraded"].includes(cameraState(camera))).sort((a, b) => cameraState(a) === "offline" && cameraState(b) !== "offline" ? -1 : 1).slice(0, 4);

  return <div className="space-y-4">
    <section className="grid grid-cols-2 gap-2.5 md:grid-cols-5" aria-label="Camera status summary">
      <SummaryCard icon={<Camera className="h-4 w-4" />} label="Cameras" value={props.cameras.length} detail="Canonical inventory" colour="#60a5fa" />
      <SummaryCard icon={<Radio className="h-4 w-4" />} label="Online" value={counts.online} detail={props.cameras.length ? `${Math.round(counts.online / props.cameras.length * 100)}% healthy` : "No camera data"} colour={stateColour.online} />
      <SummaryCard icon={<AlertTriangle className="h-4 w-4" />} label="Degraded" value={counts.degraded} detail={props.cameras.length ? `${Math.round(counts.degraded / props.cameras.length * 100)}% of inventory` : "No camera data"} colour={stateColour.degraded} />
      <SummaryCard icon={<CircleOff className="h-4 w-4" />} label="Offline" value={counts.offline} detail={props.cameras.length ? `${Math.round(counts.offline / props.cameras.length * 100)}% of inventory` : "No camera data"} colour={stateColour.offline} />
      <SummaryCard icon={<ShieldAlert className="h-4 w-4" />} label="Events (24h)" value={props.events.length} detail="Recent canonical events" colour="#a78bfa" />
    </section>

    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_310px]">
      <OisCard className="p-3">
        <div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-white">Live Camera Wall</h2><p className="mt-0.5 text-[11px] text-zinc-500">Playback starts only when a camera is opened.</p></div><span className="text-[10px] text-zinc-600">{Math.min(props.cameras.length, 8)} of {props.cameras.length}</span></div>
        {props.loading ? <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[1.35] animate-pulse rounded-[10px] border border-white/5 bg-white/[0.025]" />)}</div> : props.cameras.length ? <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">{props.cameras.slice(0, 8).map((camera) => <CameraTile key={camera.id} camera={camera} onOpen={() => props.onOpenCamera(camera)} />)}</div> : <EmptyPanel icon={<Camera className="h-5 w-5" />} title="No cameras connected yet" detail="Import a DVR/NVR or discover compatible cameras through an online Oyi Edge gateway." action={<Button variant="ghost" onClick={props.onImportCamera}>Import camera</Button>} />}
      </OisCard>

      <OisCard className="p-3">
        <div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-white">Recent Camera Events</h2><span className="text-[10px] text-zinc-600">Last 24 hours</span></div>
        <div className="mt-2 divide-y divide-white/6">{props.events.slice(0, 7).map((event) => {
          const occurrence = getCameraEventOccurrenceTime(event);
          const label = event.detections?.length ? event.detections.map((item) => item.type).filter((value, index, list) => list.indexOf(value) === index).join(" + ") : event.type;
          return <article key={event.id} className="flex gap-2.5 py-2.5"><div className="h-11 w-16 shrink-0 overflow-hidden rounded-md border border-white/7 bg-black/30">{event.thumbnail_url ? <img src={event.thumbnail_url} alt="Authorized camera event" className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center text-zinc-700"><Eye className="h-4 w-4" /></span>}</div><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-medium capitalize text-white">{label.replaceAll("_", " ")}</p><p className="truncate text-[10px] text-zinc-500">{event.camera_name || "Camera"} · {event.camera_location || "Location unavailable"}</p><p suppressHydrationWarning className="mt-0.5 text-[9px] text-zinc-600">{new Date(occurrence).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {relativeTime(occurrence)}</p></div><OisStatusBadge status={severityTone(event.severity)} label={event.severity || "info"} className="self-start uppercase" /></article>;
        })}{!props.events.length && !props.loading ? <div className="py-12 text-center"><Eye className="mx-auto h-5 w-5 text-zinc-700" /><p className="mt-2 text-xs text-zinc-500">No camera events yet.</p></div> : null}</div>
      </OisCard>
    </section>

    <section className="grid gap-4 xl:grid-cols-[250px_minmax(0,1fr)_290px]">
      <OisCard className="p-4"><h2 className="text-sm font-semibold text-white">Camera Health</h2><div className="mt-2 flex items-center gap-3"><div className="relative h-32 w-32 shrink-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={props.cameras.length ? healthData : [{ name: "No data", value: 1, colour: "#1f2937" }]} dataKey="value" innerRadius={41} outerRadius={55} stroke="none">{(props.cameras.length ? healthData : [{ colour: "#1f2937" }]).map((item, index) => <Cell key={index} fill={item.colour} />)}</Pie></PieChart></ResponsiveContainer><span className="absolute inset-0 grid place-content-center text-center"><strong className="text-xl text-white">{props.cameras.length}</strong><small className="text-[9px] text-zinc-600">Total</small></span></div><div className="space-y-2">{healthData.slice(0, 3).map((item) => <div key={item.name} className="flex items-center gap-2 text-[10px]"><span className="h-1.5 w-1.5 rounded-full" style={{ background: item.colour }} /><span className="w-14 text-zinc-400">{item.name}</span><strong className="text-zinc-200">{item.value}</strong></div>)}</div></div></OisCard>
      <OisCard className="p-4"><h2 className="text-sm font-semibold text-white">Camera Health Trend <span className="font-normal text-zinc-600">(Last 24h)</span></h2><div className="mt-4 grid min-h-[118px] place-items-center rounded-lg border border-dashed border-white/7 bg-black/10 px-5 text-center"><div><CloudOff className="mx-auto h-5 w-5 text-zinc-700" /><p className="mt-2 text-xs text-zinc-400">Health history will appear as camera telemetry accumulates.</p><p className="mt-1 text-[10px] text-zinc-600">Current health remains available above.</p></div></div></OisCard>
      <OisCard className="p-4"><h2 className="text-sm font-semibold text-white">Cameras Requiring Attention</h2><div className="mt-3 space-y-2">{attention.map((camera) => <button key={camera.id} type="button" onClick={() => props.onOpenCamera(camera)} className="flex w-full items-center gap-2 rounded-lg border border-white/6 bg-black/10 px-2.5 py-2 text-left hover:bg-white/[0.03]"><span className="h-1.5 w-1.5 rounded-full" style={{ background: stateColour[cameraState(camera)] }} /><span className="min-w-0 flex-1"><span className="block truncate text-[11px] text-zinc-200">{camera.name}</span><span className="block truncate text-[9px] capitalize text-zinc-600">{cameraState(camera)} · {relativeTime(getCameraLastActivity(camera))}</span></span></button>)}{!attention.length ? <p className="rounded-lg border border-dashed border-white/7 p-5 text-center text-xs text-zinc-600">No cameras currently require attention.</p> : null}</div></OisCard>
    </section>

    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_310px]">
      <OisCard className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div><h2 className="text-sm font-semibold text-white">Camera Inventory</h2><p className="mt-0.5 text-[10px] text-zinc-600">Canonical cameras, recorder channels, health and Edge assignment.</p></div><Button variant="ghost" onClick={props.onImportCamera} className="gap-2"><Search className="h-3.5 w-3.5" /> Import Camera</Button></div><div className="grid gap-2 border-y border-white/6 bg-black/10 p-3 sm:grid-cols-[minmax(180px,1fr)_140px_140px]"><label className="relative"><Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-600" /><input value={props.query} onChange={(event) => props.onQuery(event.target.value)} aria-label="Search camera inventory" placeholder="Search camera, DVR or location" className="h-9 w-full rounded-lg border border-white/8 bg-white/[0.025] pl-9 pr-3 text-xs text-white outline-none focus:border-sky-400/40" /></label><select value={props.scopeFilter} onChange={(event) => props.onScope(event.target.value)} aria-label="Camera scope" className="h-9 rounded-lg border border-white/8 bg-[#09131c] px-3 text-xs text-zinc-300"><option value="all">All scopes</option><option value="facility">Estate</option><option value="home">Home</option><option value="office">Office</option></select><select value={props.statusFilter} onChange={(event) => props.onStatus(event.target.value)} aria-label="Camera status" className="h-9 rounded-lg border border-white/8 bg-[#09131c] px-3 text-xs text-zinc-300"><option value="all">All statuses</option><option value="online">Online / healthy</option><option value="offline">Attention</option></select></div><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-[10px]"><thead className="bg-white/[0.018] uppercase tracking-[.08em] text-zinc-600"><tr>{["DVR / Device", "Channel", "Camera", "Location", "Status", "Health", "Last Seen", "Edge Node", "Actions"].map((label) => <th key={label} className="px-3 py-2 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-white/5">{props.filtered.map((camera) => { const dvr = props.dvrs.find((item) => item.id === camera.nvrId); return <tr key={camera.id} className="text-zinc-400 hover:bg-white/[0.018]"><td className="px-3 py-2">{dvr ? <><span className="block text-zinc-300">{dvr.name}</span><span className="text-[9px] text-zinc-600">{text(dvr.brand, "Recorder")}</span></> : "Standalone"}</td><td className="px-3 py-2">{camera.channel ? `CH ${camera.channel}` : "—"}</td><td className="px-3 py-2 font-medium text-zinc-200">{camera.name}</td><td className="px-3 py-2">{text(camera.location, "Unmapped")}</td><td className="px-3 py-2"><span className="inline-flex items-center gap-1 capitalize"><span className="h-1.5 w-1.5 rounded-full" style={{ background: stateColour[cameraState(camera)] }} />{cameraState(camera)}</span></td><td className="px-3 py-2 capitalize">{camera.health?.providerError ? "Provider error" : camera.health?.status || cameraState(camera)}</td><td className="px-3 py-2">{relativeTime(getCameraLastActivity(camera))}</td><td className="px-3 py-2">{camera.edgeNodeId || "No Edge"}</td><td className="px-3 py-2"><div className="flex gap-1"><button type="button" onClick={() => props.onOpenCamera(camera)} aria-label={`Open ${camera.name}`} className="rounded p-1.5 text-zinc-500 hover:bg-white/5 hover:text-white"><Play className="h-3 w-3" /></button><button type="button" onClick={() => props.onValidate(camera)} aria-label={`Validate ${camera.name}`} className="rounded p-1.5 text-zinc-500 hover:bg-white/5 hover:text-white"><Radio className="h-3 w-3" /></button><button type="button" onClick={() => props.onProfile(camera)} aria-label={`Open intelligence profile for ${camera.name}`} className="rounded p-1.5 text-zinc-500 hover:bg-white/5 hover:text-white"><ShieldAlert className="h-3 w-3" /></button></div>{props.validation[camera.id] ? <span className="block max-w-28 truncate text-[9px] text-sky-300">{props.validation[camera.id]}</span> : null}</td></tr>; })}</tbody></table>{!props.filtered.length && !props.loading ? <p className="px-4 py-10 text-center text-xs text-zinc-600">{props.cameras.length ? "No cameras match this inventory view." : "No cameras have been provisioned."}</p> : null}</div></OisCard>
      <div className="space-y-4"><OisCard className="p-4"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-white">Active Edge Nodes</h2><Server className="h-4 w-4 text-sky-400" /></div><div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">{props.edgeNodes.slice(0, 4).map((node) => { const id = String(node.node_id || node.id || "Edge"); const count = props.cameras.filter((camera) => camera.edgeNodeId === id || camera.edgeNodeId === node.id).length; return <article key={String(node.id || id)} className="rounded-lg border border-white/7 bg-black/10 p-3"><div className="flex items-start gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.035] text-zinc-500"><Server className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-white">{node.name || id}</span><span className={`text-[10px] ${String(node.status).toLowerCase() === "online" ? "text-emerald-400" : "text-zinc-500"}`}>{node.status || "Unknown"}</span><span className="block text-[9px] text-zinc-600">{count} camera{count === 1 ? "" : "s"} · {relativeTime(node.last_heartbeat_at)}</span></span></div></article>; })}{!props.edgeNodes.length && !props.loading ? <EmptyPanel icon={<Server className="h-5 w-5" />} title="No Oyi Edge connected" detail="Connect an Oyi Edge gateway before discovering local DVR/NVR systems." /> : null}</div></OisCard><OisCard className="p-4"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-white">Storage & Media</h2><HardDrive className="h-4 w-4 text-cyan-400" /></div><div className="mt-4 grid grid-cols-3 gap-2"><div><strong className="block text-base text-white">{props.media.count}</strong><span className="text-[9px] text-zinc-600">Recent media</span></div><div><strong className="block text-base text-white">{bytes(props.media.bytes)}</strong><span className="text-[9px] text-zinc-600">Catalogued</span></div><div><strong className="block text-base text-white">{props.media.evidence}</strong><span className="text-[9px] text-zinc-600">Preserved</span></div></div>{!props.media.count ? <div className="mt-4 rounded-lg border border-dashed border-white/7 p-4 text-center"><Database className="mx-auto h-4 w-4 text-zinc-700" /><p className="mt-2 text-[10px] text-zinc-600">No camera media has been catalogued yet.</p></div> : null}<p className="mt-3 text-[9px] leading-4 text-zinc-600">Storage quota is not shown because the canonical runtime does not expose a verified global quota.</p></OisCard></div>
    </section>
  </div>;
}
