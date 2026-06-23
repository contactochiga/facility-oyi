"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import OisCard from "@/components/ois/OisCard";
import OisListItem from "@/components/ois/OisListItem";
import OisStatusBadge, { type OisStatus } from "@/components/ois/OisStatusBadge";
import { facilityService } from "@/services/facilityService";
import { normalizeVerificationState } from "@/components/modules/VerificationBadge";
import VerificationSummary, { type VerificationSummaryValue } from "@/components/modules/VerificationSummary";
import { openWorkflowDrawer } from "@/components/modules/WorkflowDetailDrawer";

const age = (value?: string | null) => { if (!value) return "Age unavailable"; const hours = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 3600000)); return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`; };
const label = (value?: unknown, fallback = "Workflow") => String(value || fallback).replace(/_/g, " ");
const formatDueState = (dueAt?: string | null, overdue = false) => overdue ? "Verification due: overdue" : dueAt ? `Due ${new Date(dueAt).toLocaleDateString()}` : "No verification due time";
const dueStatus = (dueAt?: string | null, overdue = false): OisStatus => overdue ? "overdue" : dueAt ? "stable" : "unavailable";
const getEscalationState = (workflow: Record<string, any>) => {
  const value = String(workflow.workflow_escalation_state || workflow.escalation_state || workflow.escalation || workflow.workflow_status || workflow.status || "").toLowerCase();
  if (value === "escalated") return "escalated";
  if (value === "blocked") return "blocked";
  return null;
};

export default function VerificationQueue({ limit = 5, onSummary }: { limit?: number; onSummary?: (summary: VerificationSummaryValue) => void }) {
  const [workflows, setWorkflows] = useState<any[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => { let mounted = true; facilityService.intelligenceWorkflows().then((data) => { if (mounted) setWorkflows(data.workflows || []); }).catch(() => { if (mounted) setWorkflows([]); }).finally(() => mounted && setLoading(false)); return () => { mounted = false; }; }, []);
  const records = useMemo(() => workflows.map((workflow) => { const status = String(workflow.workflow_status || workflow.status || "").toLowerCase(); const overdue = Boolean(workflow.workflow_due_at && new Date(workflow.workflow_due_at).getTime() < Date.now() && !["verified", "cancelled"].includes(status)); const state = normalizeVerificationState(workflow.verification_state || workflow.metadata?.verification_state || (status === "completed" || status === "resolved" ? "pending" : null), overdue); return { workflow, state, overdue }; }).filter((row) => row.state !== "not_required"), [workflows]);
  const summary = useMemo(() => ({ pending: records.filter((row) => row.state === "pending").length, overdue: records.filter((row) => row.state === "overdue").length, failed: records.filter((row) => row.state === "failed").length, verifiedToday: workflows.filter((workflow) => workflow.verified_at && String(workflow.verified_at).slice(0, 10) === new Date().toISOString().slice(0, 10)).length }), [records, workflows]);
  useEffect(() => { onSummary?.(summary); }, [onSummary, summary]);
  return <OisCard as="section" className="p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-white">Verification Queue</h2><p className="mt-1 text-xs text-zinc-500">Completed work awaiting authoritative confirmation.</p></div><Link href="/facility-intelligence?module=workflows" className="text-xs text-sky-200">View all</Link></div><div className="mt-4"><VerificationSummary summary={summary} loading={loading} /></div><div className="mt-4 space-y-2">{records.slice(0, limit).map(({ workflow, state, overdue }) => {
    const escalation = getEscalationState(workflow);
    const nextAction = state === "failed" ? "Review failure evidence" : "Review and verify completion";
    return <button key={workflow.id || workflow.workflow_id} type="button" onClick={() => openWorkflowDrawer(String(workflow.id || workflow.workflow_id))} className="block w-full text-left">
      <OisListItem
        className="w-full"
        title={<span className="block truncate">{workflow.title || workflow.workflow_type || "Workflow"}</span>}
        description={<span>{label(workflow.workflow_type, "workflow")} · {workflow.workflow_assignee || workflow.workflow_owner || "Unassigned"} · {age(workflow.created_at)}</span>}
        status={state as OisStatus}
        meta={<div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <OisStatusBadge status={dueStatus(workflow.workflow_due_at, overdue)} label={formatDueState(workflow.workflow_due_at, overdue)} />
            {escalation ? <OisStatusBadge status={escalation} /> : null}
          </div>
          <p className="text-xs text-sky-100">Next: {nextAction}</p>
        </div>}
      />
    </button>;
  })}{!loading && !records.length ? <p className="rounded-xl border border-dashed border-white/10 p-3 text-sm text-zinc-500">No work is currently awaiting verification.</p> : null}</div></OisCard>;
}
