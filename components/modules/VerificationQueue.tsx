"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import OisCard from "@/components/ois/OisCard";
import OisListItem from "@/components/ois/OisListItem";
import OisStatusBadge, { type OisStatus } from "@/components/ois/OisStatusBadge";
import { facilityService } from "@/services/facilityService";
import { normalizeVerificationState } from "@/components/modules/VerificationBadge";
import { type VerificationSummaryValue } from "@/components/modules/VerificationSummary";
import { openWorkflowDrawer } from "@/components/modules/WorkflowDetailDrawer";

const formatDueState = (dueAt?: string | null, overdue = false) => overdue ? "Verification due: overdue" : dueAt ? `Due ${new Date(dueAt).toLocaleDateString()}` : "No verification due time";
const badgeClass = "px-1.5 py-px text-[10px] opacity-80";

export default function VerificationQueue({ limit = 5, onSummary }: { limit?: number; onSummary?: (summary: VerificationSummaryValue) => void }) {
  const [workflows, setWorkflows] = useState<any[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => { let mounted = true; facilityService.intelligenceWorkflows().then((data) => { if (mounted) setWorkflows(data.workflows || []); }).catch(() => { if (mounted) setWorkflows([]); }).finally(() => mounted && setLoading(false)); return () => { mounted = false; }; }, []);
  const records = useMemo(() => workflows.map((workflow) => { const status = String(workflow.workflow_status || workflow.status || "").toLowerCase(); const overdue = Boolean(workflow.workflow_due_at && new Date(workflow.workflow_due_at).getTime() < Date.now() && !["verified", "cancelled"].includes(status)); const state = normalizeVerificationState(workflow.verification_state || workflow.metadata?.verification_state || (status === "completed" || status === "resolved" ? "pending" : null), overdue); return { workflow, state, overdue }; }).filter((row) => row.state !== "not_required"), [workflows]);
  const summary = useMemo(() => ({ pending: records.filter((row) => row.state === "pending").length, overdue: records.filter((row) => row.state === "overdue").length, failed: records.filter((row) => row.state === "failed").length, verifiedToday: workflows.filter((workflow) => workflow.verified_at && String(workflow.verified_at).slice(0, 10) === new Date().toISOString().slice(0, 10)).length }), [records, workflows]);
  useEffect(() => { onSummary?.(summary); }, [onSummary, summary]);
  return <OisCard as="section" className="h-full border-white/[0.06] bg-white/[0.024] p-3 sm:p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="text-[15px] font-semibold tracking-[-0.02em] text-white">Verification Queue</h2><p className="mt-1 text-[11px] leading-4 text-zinc-500">Completed work awaiting authoritative confirmation.</p></div><Link href="/facility-intelligence?module=workflows" className="text-[11px] text-sky-200">Open queue</Link></div><div className="mt-3 space-y-1.5">{records.slice(0, limit).map(({ workflow, state, overdue }) => {
    return <button key={workflow.id || workflow.workflow_id} type="button" onClick={() => openWorkflowDrawer(String(workflow.id || workflow.workflow_id))} className="block w-full text-left">
      <OisListItem
        className="w-full gap-2"
        title={<span className="block truncate text-sm font-medium text-white">{workflow.title || workflow.workflow_type || "Workflow"}</span>}
        meta={<span className="text-[11px] text-zinc-500">{formatDueState(workflow.workflow_due_at, overdue)}</span>}
        action={<OisStatusBadge status={state as OisStatus} label={String(state).replace(/_/g, " ")} className={badgeClass} />}
      />
    </button>;
  })}{!loading && !records.length ? <p className="rounded-xl border border-dashed border-white/10 p-3 text-sm text-zinc-500">No work is currently awaiting verification.</p> : null}</div></OisCard>;
}
