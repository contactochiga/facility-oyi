"use client";

import { useEffect, useMemo, useState } from "react";
import { Brain } from "lucide-react";
import { facilityService } from "@/services/facilityService";
import { openWorkflowDrawer } from "@/components/modules/WorkflowDetailDrawer";
import { openPredictionDrawer } from "@/components/modules/PredictionDetailDrawer";

const closed = new Set(["completed", "verified", "cancelled", "closed", "resolved"]);
const priorityTone = (value: unknown) => /critical|high|warning|failed|timeout/i.test(String(value || "")) ? "text-amber-100 border-amber-400/20 bg-amber-500/10" : "text-sky-100 border-sky-400/20 bg-sky-500/10";

export default function FacilityIntelligenceExposure({ onMetrics }: { onMetrics?: (metrics: { active: number; overdue: number; escalated: number; verification: number }) => void }) {
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([facilityService.intelligenceWorkflows(), facilityService.intelligencePredictions()]).then(([wf, prediction]) => {
      if (!mounted) return;
      setWorkflows(wf.workflows || []);
      setPredictions(prediction.predictions || []);
    }).catch(() => mounted && setError("Intelligence sources are unavailable for the active facility context.")).finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  const active = workflows.filter((item) => !closed.has(String(item.workflow_status || item.status || "").toLowerCase()));
  const overdue = active.filter((item) => item.workflow_due_at && new Date(item.workflow_due_at).getTime() < Date.now());
  const escalated = active.filter((item) => String(item.workflow_status || item.status || "").toLowerCase() === "escalated");
  const verification = workflows.filter((item) => ["completed", "resolved"].includes(String(item.workflow_status || item.status || "").toLowerCase()) && String(item.verification_state || item.metadata?.verification_state || "pending").toLowerCase() !== "verified");
  useEffect(() => { onMetrics?.({ active: active.length, overdue: overdue.length, escalated: escalated.length, verification: verification.length }); }, [active.length, escalated.length, onMetrics, overdue.length, verification.length]);

  const insights = useMemo(() => [
    active[0] ? { type: "Workflow intelligence", title: active[0].title || active[0].workflow_type || "Open workflow", summary: `${active.length} active workflow${active.length === 1 ? "" : "s"}; ${overdue.length} overdue.`, action: active[0].workflow_assignee ? "Review ownership and SLA" : "Assign an owner", tone: priorityTone(active[0].workflow_priority), workflowId: String(active[0].id || active[0].workflow_id || "") } : null,
    predictions[0] ? { type: "Prediction intelligence", title: predictions[0].title || "Operational prediction", summary: predictions[0].summary || "A risk pattern requires review.", action: predictions[0].recommended_action || "Review prediction evidence", tone: priorityTone(predictions[0].severity), prediction: predictions[0] } : null,
    verification.length ? { type: "Verification intelligence", title: `${verification.length} item${verification.length === 1 ? "" : "s"} require verification`, summary: "Completed or resolved work is waiting for authoritative confirmation.", action: "Review verification queue", tone: "text-sky-100 border-sky-400/20 bg-sky-500/10" } : null,
  ].filter(Boolean) as Array<{ type: string; title: string; summary: string; action: string; tone: string; workflowId?: string; prediction?: any }>, [active, overdue.length, predictions, verification.length]);

  return <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-white">Estate Intelligence Brief</h2><p className="mt-1 text-xs text-zinc-500">Workflow, prediction, and verification intelligence for the active facility.</p></div><Brain className="h-5 w-5 text-sky-200" /></div>{error ? <p className="mt-3 rounded-lg border border-rose-400/20 bg-rose-500/10 p-2 text-xs text-rose-100">{error}</p> : null}<div className="mt-4 grid gap-2 lg:grid-cols-3">{insights.slice(0, 3).map((insight) => <button key={insight.type} type="button" onClick={() => insight.workflowId ? openWorkflowDrawer(insight.workflowId) : insight.prediction ? openPredictionDrawer(insight.prediction) : undefined} className="rounded-xl border border-white/10 bg-black/20 p-3 text-left"><span className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{insight.type}</span><h3 className="mt-1 text-sm font-medium text-white">{insight.title}</h3><p className="mt-1 text-xs leading-5 text-zinc-400">{insight.summary}</p><p className="mt-2 text-xs text-sky-100">Next: {insight.action}</p></button>)}{!loading && !insights.length ? <p className="text-xs text-zinc-500">No workflow, prediction, or verification insight requires review.</p> : null}</div></section>;
}
