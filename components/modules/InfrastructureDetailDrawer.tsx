"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, X } from "lucide-react";
import ProviderHealthStrip from "@/components/modules/ProviderHealthStrip";
import { loadInfrastructurePostureData, postureLabel, postureTone, resolveInfrastructurePosture, sourceRecords, type InfrastructurePostureData, type InfrastructurePostureRow, type InfrastructureSource } from "@/services/infrastructurePostureService";

const title: Record<InfrastructureSource, string> = { devices: "Device health", cameras: "Camera health", edge: "Oyi Edge", utilities: "Utility telemetry", providers: "Provider health" };
const label = (row: any, source: InfrastructureSource) => source === "devices" ? row?.name || "Device" : source === "cameras" ? row?.name || row?.camera_name || "Camera" : source === "edge" ? row?.name || row?.node_id || "Edge node" : source === "utilities" ? row?.utility_type || row?.name || "Utility reading" : row?.name || row?.key || "Provider";
const status = (row: any, source: InfrastructureSource) => source === "cameras" ? row?.health_state || row?.stream_state || row?.status : source === "edge" ? row?.status || row?.sync_status || row?.state : source === "utilities" ? row?.state || row?.severity : source === "providers" ? row?.status : row?.status || row?.raw_status;
const timestamp = (row: any, source: InfrastructureSource) => source === "utilities" || source === "edge" ? row?.observed_at || row?.updated_at || row?.last_heartbeat_at : row?.updated_at || row?.last_seen_at || row?.last_event_at || row?.received_at || row?.observed_at;
const date = (value: any) => value ? new Date(String(value)).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Not recorded";
const nextAction: Record<InfrastructureSource, string> = { devices: "Inspect the affected device and provider connectivity.", cameras: "Review stream health and the affected camera evidence.", edge: "Check runtime reachability and the latest heartbeat.", utilities: "Review the latest utility reading and related operational work.", providers: "Review synchronization health and the latest provider failure." };

export function openInfrastructureDrawer(source?: InfrastructureSource | null) {
  if (!source || typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("facility:open-infrastructure", { detail: { source } }));
}

export function InfrastructureDetailDrawerHost() {
  const [source, setSource] = useState<InfrastructureSource | null>(null);
  useEffect(() => { const handler = (event: Event) => setSource((event as CustomEvent<{ source?: InfrastructureSource }>).detail?.source || null); window.addEventListener("facility:open-infrastructure", handler); return () => window.removeEventListener("facility:open-infrastructure", handler); }, []);
  return source ? <InfrastructureDetailDrawer source={source} onClose={() => setSource(null)} /> : null;
}

export default function InfrastructureDetailDrawer({ source, onClose }: { source: InfrastructureSource; onClose: () => void }) {
  const [data, setData] = useState<InfrastructurePostureData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => { let mounted = true; setState("loading"); loadInfrastructurePostureData().then((next) => { if (!mounted) return; setData(next); setState("ready"); }).catch(() => mounted && setState("error")); return () => { mounted = false; }; }, [source]);
  const posture = useMemo(() => data ? resolveInfrastructurePosture(data).find((row) => row.source === source) : null, [data, source]);
  const records = useMemo(() => data ? sourceRecords(data, source) : [], [data, source]);
  const evidence = useMemo(() => {
    if (!data) return [];
    if (source === "cameras") return data.cameraHistory;
    if (source === "edge") return data.edgeHistory;
    if (source === "utilities") return data.utilities;
    if (source === "providers") return data.providerEvents;
    return records;
  }, [data, records, source]);
  const route = posture?.route || "/live-infrastructure";
  return <div className="fixed inset-0 z-[72] bg-black/65 backdrop-blur-sm"><aside className="ml-auto flex h-[100dvh] w-full max-w-[640px] flex-col border-l border-white/10 bg-zinc-950 shadow-2xl"><header className="sticky top-0 z-10 flex items-start justify-between border-b border-white/10 bg-zinc-950/95 p-4 backdrop-blur"><div className="min-w-0"><p className="text-[10px] uppercase tracking-[0.16em] text-sky-200/75">Infrastructure detail</p><h2 className="mt-1 truncate text-lg font-semibold text-white">{title[source]}</h2><p className="mt-1 text-xs text-zinc-500">Estate-scoped operational posture and supporting evidence.</p></div><button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.04]" aria-label="Close infrastructure detail"><X className="h-4 w-4 text-zinc-300" /></button></header><div className="flex-1 overflow-y-auto p-4 pb-28">{state === "loading" ? <div className="flex items-center gap-2 text-sm text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" />Loading infrastructure posture</div> : null}{state === "error" ? <p className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-100">Infrastructure evidence is unavailable for this facility context.</p> : null}{state === "ready" && posture ? <><section className="rounded-xl border border-white/10 bg-black/20 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-medium text-white">{posture.label}</h3><p className="mt-1 text-xs text-zinc-500">{posture.reason}</p></div><span className={`rounded-full border px-2 py-1 text-[10px] uppercase ${postureTone(posture.state)}`}>{postureLabel(posture.state)}</span></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div><span className="block text-zinc-500">Source availability</span><span className="text-zinc-200">{data?.available[source] ? "Available" : "Unavailable"}</span></div><div><span className="block text-zinc-500">Affected records</span><span className="text-zinc-200">{posture.affected}</span></div></div></section>{source === "providers" ? <section className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3"><h3 className="text-sm font-medium text-white">Configured providers</h3><div className="mt-3"><ProviderHealthStrip providers={data?.providers || []} available={Boolean(data?.available.providers)} /></div></section> : null}<section className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3"><h3 className="text-sm font-medium text-white">Affected records</h3><div className="mt-3 space-y-2">{records.slice(0, 12).map((row, index) => <div key={row.id || row.camera_id || row.node_id || row.key || index} className="rounded-lg border border-white/10 p-2 text-xs"><div className="flex justify-between gap-3"><b className="min-w-0 break-words text-zinc-200">{label(row, source)}</b><span className="shrink-0 text-zinc-500">{date(timestamp(row, source))}</span></div><p className="mt-1 text-zinc-500">{String(status(row, source) || "Status unavailable").replace(/_/g, " ")}</p></div>)}{!records.length ? <p className="text-xs text-zinc-500">No records are available for this source.</p> : null}</div></section><section className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3"><h3 className="text-sm font-medium text-white">Supporting evidence</h3><div className="mt-3 space-y-2">{evidence.slice(0, 12).map((row, index) => <div key={row.id || `${row.camera_id || row.edge_node_id || row.provider || "evidence"}-${index}`} className="rounded-lg border border-white/10 p-2 text-xs"><b className="block text-zinc-200">{label(row, source)}</b><p className="mt-1 text-zinc-500">{String(status(row, source) || row.event_type || "Recorded update").replace(/_/g, " ")} · {date(timestamp(row, source))}</p></div>)}{!evidence.length ? <p className="text-xs text-zinc-500">No supporting evidence has been recorded for this source.</p> : null}</div></section></> : null}</div><footer className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-white/10 bg-zinc-950/95 p-4 backdrop-blur"><div><p className="text-xs text-zinc-500">Recommended next action</p><p className="text-sm text-sky-100">{nextAction[source]}</p></div><Link href={route} onClick={onClose} className="shrink-0 rounded-lg border border-sky-400/20 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">Open source</Link></footer></aside></div>;
}
