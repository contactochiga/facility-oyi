"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { facilityService } from "@/services/facilityService";
import OisCard from "@/components/ois/OisCard";
import OisDrawer from "@/components/ois/OisDrawer";
import OisListItem from "@/components/ois/OisListItem";
import OisStatusBadge, { type OisStatus } from "@/components/ois/OisStatusBadge";

const text = (value: unknown, fallback = "Unavailable") => String(value || fallback).replace(/_/g, " ");
const date = (value?: unknown) => value ? new Date(String(value)).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Not recorded";
const confidenceLabel = (value: unknown) => ({ confirmed: "High", likely: "High", possible: "Moderate", needs_monitoring: "Monitor" }[String(value || "").toLowerCase()] || "Unavailable");
const statusTone = (value: unknown): OisStatus => /critical/i.test(String(value || "")) ? "critical" : /high|warning/i.test(String(value || "")) ? "warning" : "attention";

export function openPredictionDrawer(prediction: any) {
  if (!prediction || typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("facility:open-prediction", { detail: { prediction } }));
}

export function PredictionDetailDrawerHost() {
  const [prediction, setPrediction] = useState<any | null>(null);
  useEffect(() => { const handler = (event: Event) => setPrediction((event as CustomEvent<{ prediction?: any }>).detail?.prediction || null); window.addEventListener("facility:open-prediction", handler); return () => window.removeEventListener("facility:open-prediction", handler); }, []);
  return prediction ? <PredictionDetailDrawer prediction={prediction} onClose={() => setPrediction(null)} /> : null;
}

export default function PredictionDetailDrawer({ prediction: initial, onClose }: { prediction: any; onClose: () => void }) {
  const [prediction, setPrediction] = useState(initial); const [acknowledging, setAcknowledging] = useState(false); const [error, setError] = useState<string | null>(null);
  useEffect(() => setPrediction(initial), [initial]);
  const evidence = Array.isArray(prediction?.evidence) ? prediction.evidence : [];
  const impact = prediction?.metadata?.impact || prediction?.impact || prediction?.metadata?.impact_summary || null;
  const category = text(prediction?.prediction_type, "Operational risk");
  const acknowledgement = useMemo(() => String(prediction?.status || "open").toLowerCase() === "acknowledged", [prediction?.status]);
  const acknowledge = async () => { if (!prediction?.id || acknowledgement || acknowledging) return; setAcknowledging(true); setError(null); try { const result = await facilityService.acknowledgePrediction(String(prediction.id)); if (!result?.ok && !result?.prediction) throw new Error("acknowledgement failed"); setPrediction(result.prediction || { ...prediction, status: "acknowledged" }); } catch { setError("Unable to acknowledge this prediction. No acknowledgement was recorded."); } finally { setAcknowledging(false); } };
  return <OisDrawer open={true} onClose={onClose} width="md" title={prediction?.title || "Prediction unavailable"} subtitle={`${category} · ${date(prediction?.created_at)}`} footer={acknowledgement ? <div className="flex items-center gap-2 text-sm text-emerald-100"><CheckCircle2 className="h-4 w-4" />Prediction acknowledged</div> : <button disabled={acknowledging} onClick={() => void acknowledge()} className="inline-flex items-center gap-2 rounded-lg bg-sky-500/15 px-3 py-2 text-sm text-sky-100 disabled:opacity-50">{acknowledging ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{acknowledging ? "Acknowledging" : "Acknowledge prediction"}</button>}>
    <OisCard as="section" variant="evidence" className="p-3"><div className="flex flex-wrap gap-2"><OisStatusBadge status={statusTone(prediction?.severity)} label={text(prediction?.severity, "risk")} /><OisStatusBadge status={acknowledgement ? "completed" : "pending"} label={text(prediction?.status, "active")} /></div></OisCard>
    <OisCard as="section" variant="evidence" className="mt-3 p-3"><h3 className="text-sm font-medium text-white">Prediction summary</h3><p className="mt-2 text-sm leading-6 text-zinc-300">{prediction?.summary || "Prediction details are currently unavailable."}</p></OisCard>
    <OisCard as="section" variant="evidence" className="mt-3 p-3"><h3 className="text-sm font-medium text-white">Confidence and impact</h3><div className="mt-3 grid grid-cols-3 gap-2 text-xs"><div><span className="block text-zinc-500">Confidence</span><span className="text-zinc-200">{confidenceLabel(prediction?.confidence)}</span></div><div><span className="block text-zinc-500">Risk</span><span className="text-zinc-200">{text(prediction?.severity, "Unspecified")}</span></div><div><span className="block text-zinc-500">Impact</span><span className="text-zinc-200">{impact ? text(impact) : "Not specified"}</span></div></div></OisCard>
    <OisCard as="section" variant="evidence" className="mt-3 p-3"><h3 className="text-sm font-medium text-white">Supporting evidence</h3><div className="mt-3 space-y-2">{evidence.slice(0, 15).map((item: any, index: number) => <OisListItem key={item.id || `${item.source || item.source_table || "signal"}-${index}`} title={item.title || item.source || item.source_table || "Supporting signal"} description={text(item.event_type, "Recorded event")} meta={date(item.occurred_at || item.created_at || item.updated_at)} status="stable" />)}{!evidence.length ? <p className="text-xs text-zinc-500">No supporting evidence was returned for this prediction.</p> : null}</div></OisCard>
    <OisCard as="section" variant="evidence" className="mt-3 p-3"><h3 className="text-sm font-medium text-white">Recommended next action</h3><p className="mt-2 text-sm text-sky-100">{prediction?.recommended_action || "No recommended action is currently available."}</p></OisCard>
    <OisCard as="section" variant="evidence" className="mt-3 p-3"><h3 className="text-sm font-medium text-white">Acknowledgement</h3><p className="mt-2 text-xs text-zinc-400">{acknowledgement ? `Acknowledged ${date(prediction?.acknowledged_at)}` : "Not acknowledged"}</p>{acknowledgement && prediction?.acknowledged_by ? <p className="mt-1 text-xs text-zinc-500">Acknowledgement owner recorded.</p> : null}</OisCard>
    {error ? <p className="mt-3 rounded-lg border border-rose-400/20 bg-rose-500/10 p-2 text-xs text-rose-100">{error}</p> : null}
  </OisDrawer>;
}
