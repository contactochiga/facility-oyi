"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import OisCard from "@/components/ois/OisCard";
import OisDrawer from "@/components/ois/OisDrawer";
import OisListItem from "@/components/ois/OisListItem";
import OisStatusBadge, { type OisStatus } from "@/components/ois/OisStatusBadge";
import ProviderHealthStrip from "@/components/modules/ProviderHealthStrip";
import { loadInfrastructurePostureData, postureLabel, resolveInfrastructurePosture, sourceRecords, type InfrastructurePostureData, type InfrastructureSource } from "@/services/infrastructurePostureService";

const title: Record<InfrastructureSource, string> = { devices: "Device health", cameras: "Camera health", edge: "Oyi Edge", utilities: "Utility telemetry", providers: "Provider health" };
const label = (row: any, source: InfrastructureSource) => source === "devices" ? row?.name || "Device" : source === "cameras" ? row?.name || row?.camera_name || "Camera" : source === "edge" ? row?.name || row?.node_id || "Edge node" : source === "utilities" ? row?.utility_type || row?.name || "Utility reading" : row?.name || row?.key || "Provider";
const status = (row: any, source: InfrastructureSource) => source === "cameras" ? row?.health_state || row?.stream_state || row?.status : source === "edge" ? row?.status || row?.sync_status || row?.state : source === "utilities" ? row?.state || row?.severity : source === "providers" ? row?.status : row?.status || row?.raw_status;
const timestamp = (row: any, source: InfrastructureSource) => source === "utilities" || source === "edge" ? row?.observed_at || row?.updated_at || row?.last_heartbeat_at : row?.updated_at || row?.last_seen_at || row?.last_event_at || row?.received_at || row?.observed_at;
const date = (value: any) => value ? new Date(String(value)).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Not recorded";
const nextAction: Record<InfrastructureSource, string> = { devices: "Inspect the affected device and provider connectivity.", cameras: "Review stream health and the affected camera evidence.", edge: "Check runtime reachability and the latest heartbeat.", utilities: "Review the latest utility reading and related operational work.", providers: "Review synchronization health and the latest provider failure." };
const postureStatus = (value: string): OisStatus => value === "stable" ? "stable" : value === "attention" ? "attention" : value === "degraded" ? "critical" : "unavailable";
const recordStatus = (value: unknown): OisStatus => /failed|error|offline|critical|unreachable|disconnected/i.test(String(value || "")) ? "critical" : /warning|degraded|attention|unknown|pending_configuration/i.test(String(value || "")) ? "attention" : /stable|connected|active|healthy|synced/i.test(String(value || "")) ? "stable" : "unavailable";

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
  return <OisDrawer open={true} onClose={onClose} width="md" title={title[source]} subtitle="Estate-scoped operational posture and supporting evidence." footer={<div className="flex items-center justify-between gap-3"><div><p className="text-xs text-zinc-500">Recommended next action</p><p className="text-sm text-sky-100">{nextAction[source]}</p></div><Link href={route} onClick={onClose} className="shrink-0 rounded-lg border border-sky-400/20 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">Open source</Link></div>}>
    {state === "loading" ? <div className="flex items-center gap-2 text-sm text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" />Loading infrastructure posture</div> : null}
    {state === "error" ? <p className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-100">Infrastructure evidence is unavailable for this facility context.</p> : null}
    {state === "ready" && posture ? <><OisCard as="section" variant="evidence" className="p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-medium text-white">{posture.label}</h3><p className="mt-1 text-xs text-zinc-500">{posture.reason}</p></div><OisStatusBadge status={postureStatus(posture.state)} label={postureLabel(posture.state)} /></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div><span className="block text-zinc-500">Source availability</span><span className="text-zinc-200">{data?.available[source] ? "Available" : "Unavailable"}</span></div><div><span className="block text-zinc-500">Affected signals</span><span className="text-zinc-200">{posture.affected}</span></div></div></OisCard>{source === "providers" ? <OisCard as="section" variant="evidence" className="mt-3 p-3"><h3 className="text-sm font-medium text-white">Provider readiness</h3><div className="mt-3"><ProviderHealthStrip providers={data?.providers || []} available={Boolean(data?.available.providers)} /></div></OisCard> : null}<OisCard as="section" variant="evidence" className="mt-3 p-3"><h3 className="text-sm font-medium text-white">Affected signals</h3><div className="mt-3 space-y-2">{records.slice(0, 12).map((row, index) => <OisListItem key={row.id || row.camera_id || row.node_id || row.key || index} title={label(row, source)} description={String(status(row, source) || "Status unavailable").replace(/_/g, " ")} meta={date(timestamp(row, source))} status={recordStatus(status(row, source))} />)}{!records.length ? <p className="text-xs text-zinc-500">No signals are available for this source.</p> : null}</div></OisCard><OisCard as="section" variant="evidence" className="mt-3 p-3"><h3 className="text-sm font-medium text-white">Supporting evidence</h3><div className="mt-3 space-y-2">{evidence.slice(0, 12).map((row, index) => <OisListItem key={row.id || `${row.camera_id || row.edge_node_id || row.provider || "evidence"}-${index}`} title={label(row, source)} description={String(status(row, source) || row.event_type || "Recorded update").replace(/_/g, " ")} meta={date(timestamp(row, source))} status={recordStatus(status(row, source) || row.event_type)} />)}{!evidence.length ? <p className="text-xs text-zinc-500">No supporting evidence has been recorded for this source.</p> : null}</div></OisCard></> : null}
  </OisDrawer>;
}
