"use client";

// PHASE 3 (Milestone 1) -- the Automation operational workspace. Controls
// and observes real automation activity; it does not replace or duplicate
// Settings -> Automation Permissions (facility-administration/page.tsx),
// which is the read-only administrative policy display. This page reads
// real backend data only: safeAutomationService.loadAutomationPlans()
// (existing, previously only surfaced on Maintenance), the new
// /facility/automation/* endpoints, and oyiCoreRuntimeService's execution
// history/statistics endpoints (existing, previously zero callers).
//
// Only two SYSTEM AUTOMATIONS exist server-side this milestone (duplicate
// work-order detection, stale visitor authorization) -- shown honestly as
// such. There is no user-authored CUSTOM AUTOMATION capability yet; the
// tab says so rather than fabricating a rule builder.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ClipboardList,
  Clock3,
  History as HistoryIcon,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import OisCard from "@/components/ois/OisCard";
import OisListItem from "@/components/ois/OisListItem";
import OisStatusBadge, { type OisStatus } from "@/components/ois/OisStatusBadge";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import FacilityMetricCard from "@/components/ois/FacilityMetricCard";
import { facilityService, type AutomationApproval, type AutomationActionPolicy } from "@/services/facilityService";
import { loadAutomationPlans } from "@/services/safeAutomationService";
import { loadOyiCoreExecutionHistory, loadOyiCoreExecutionStatistics } from "@/services/oyiCoreRuntimeService";
import type { AutomationPlan } from "@/lib/safeAutomationRuntime";

type Tab = "overview" | "active" | "recommendations" | "approvals" | "runs" | "failures" | "history";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "active", label: "Active Automations" },
  { key: "recommendations", label: "Recommendations" },
  { key: "approvals", label: "Approvals" },
  { key: "runs", label: "Runs" },
  { key: "failures", label: "Failures" },
  { key: "history", label: "History" },
];

const SYSTEM_AUTOMATIONS = [
  {
    id: "duplicate_maintenance_request",
    name: "Duplicate work order detection",
    domain: "Maintenance",
    trigger: "On new maintenance request (event-driven)",
    action: "maintenance.cancel",
    policy: "approval_required (conservative default)",
  },
  {
    id: "stale_visitor_authorization",
    name: "Stale visitor authorization cleanup",
    domain: "Access",
    trigger: "On Automation workspace / Approvals load (on-demand scan)",
    action: "visitor.expire",
    policy: "approval_required (conservative default)",
  },
];

function dateLabel(value?: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function approvalStatusTone(status: string): OisStatus {
  if (["succeeded"].includes(status)) return "resolved";
  if (["failed", "verification_failed"].includes(status)) return "critical";
  if (["rejected", "cancelled", "expired"].includes(status)) return "blocked";
  if (["executing"].includes(status)) return "pending";
  return "attention";
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <OisCard className="p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      {subtitle ? <p className="mt-1 text-xs leading-5 text-zinc-500">{subtitle}</p> : null}
      <div className="mt-4">{children}</div>
    </OisCard>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-zinc-500">{text}</p>;
}

export default function AutomationWorkspace() {
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [plans, setPlans] = useState<AutomationPlan[]>([]);
  const [dismissedPlanIds, setDismissedPlanIds] = useState<Set<string>>(new Set());
  const [approvals, setApprovals] = useState<AutomationApproval[]>([]);
  const [policy, setPolicy] = useState<AutomationActionPolicy[]>([]);
  const [executionHistory, setExecutionHistory] = useState<any[]>([]);
  const [executionStats, setExecutionStats] = useState<any>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [plansResult, approvalsResult, policyResult, historyResult, statsResult] = await Promise.all([
        loadAutomationPlans().catch(() => []),
        facilityService.automationApprovals().catch(() => ({ estate_id: "", approvals: [] })),
        facilityService.automationPolicy().catch(() => ({ estate_id: "", policy: [] })),
        loadOyiCoreExecutionHistory({ limit: 50 }).catch(() => []),
        loadOyiCoreExecutionStatistics({ limit: 200 }).catch(() => null),
      ]);
      setPlans(plansResult);
      setApprovals(approvalsResult.approvals || []);
      setPolicy(policyResult.policy || []);
      setExecutionHistory(historyResult || []);
      setExecutionStats(statsResult);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Unable to load Automation workspace.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const onRealtime = (event: Event) => {
      const name = String((event as CustomEvent)?.detail?.event || "");
      if (/automation|maintenance|visitor|device|notification/.test(name)) void load();
    };
    window.addEventListener("facility:realtime-event", onRealtime);
    window.addEventListener("facility:automation", onRealtime);
    return () => {
      window.removeEventListener("facility:realtime-event", onRealtime);
      window.removeEventListener("facility:automation", onRealtime);
    };
  }, [load]);

  const visiblePlans = useMemo(() => plans.filter((p) => !dismissedPlanIds.has(p.id)), [plans, dismissedPlanIds]);
  const pendingApprovals = useMemo(() => approvals.filter((a) => a.status === "pending_approval"), [approvals]);
  const executedToday = useMemo(() => {
    const today = new Date().toDateString();
    return approvals.filter((a) => a.executed_at && new Date(a.executed_at).toDateString() === today);
  }, [approvals]);
  const succeeded = useMemo(() => approvals.filter((a) => a.status === "succeeded"), [approvals]);
  const failed = useMemo(() => approvals.filter((a) => ["failed", "verification_failed"].includes(a.status)), [approvals]);
  const runs = useMemo(() => approvals.filter((a) => ["executing", "succeeded", "failed", "verification_failed"].includes(a.status)), [approvals]);
  const history = useMemo(() => approvals.filter((a) => a.decided_at), [approvals]);

  async function decide(approvalId: string, decision: "approve" | "reject") {
    setBusyId(approvalId);
    setError(null);
    try {
      if (decision === "approve") await facilityService.approveAutomation(approvalId);
      else await facilityService.rejectAutomation(approvalId);
      setNotice(decision === "approve" ? "Approved. Execution attempted immediately." : "Rejected.");
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || `Unable to ${decision} this action.`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <Topbar
        title="Automation"
        subtitle="Operational command centre -- observes and controls real automation activity"
        strip={[
          { label: "Pending approvals", value: loading ? "…" : pendingApprovals.length },
          { label: "Recommendations", value: loading ? "…" : visiblePlans.length },
          { label: "Executed today", value: loading ? "…" : executedToday.length },
          { label: "Failures", value: loading ? "…" : failed.length },
          { label: "Health", value: failed.length ? "Review" : "Stable" },
        ]}
      />

      {error ? <div role="alert" className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</div> : null}
      {notice ? <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">{notice}</div> : null}

      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs transition ${tab === item.key ? "border-sky-400/35 bg-sky-500/10 text-sky-100" : "border-white/10 bg-white/5 text-zinc-400 hover:text-white"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <section className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-4">
            <FacilityMetricCard icon={<Bot />} label="Active automations" value={SYSTEM_AUTOMATIONS.length} detail="System-defined detectors" accent="text-sky-400" />
            <FacilityMetricCard icon={<Clock3 />} label="Pending approvals" value={loading ? "—" : pendingApprovals.length} detail="Awaiting operator decision" accent="text-amber-400" />
            <FacilityMetricCard icon={<CheckCircle2 />} label="Successful executions" value={loading ? "—" : succeeded.length} detail="Approved, executed and verified" accent="text-emerald-400" />
            <FacilityMetricCard icon={<XCircle />} label="Failed / unverified" value={loading ? "—" : failed.length} detail="Execution or verification failures" accent={failed.length ? "text-rose-400" : "text-zinc-400"} />
          </div>
          <Panel title="Automation policy (server-authoritative)" subtitle="Real execution levels enforced by the backend for each registered action -- not the same as this Facility's Settings display, which is a read-only summary of the same underlying policy.">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {policy.map((p) => (
                <div key={p.actionId} className="rounded-xl border border-white/10 bg-black/15 p-3">
                  <p className="text-xs font-medium text-zinc-200">{p.actionId}</p>
                  <p className="mt-1 text-[11px] text-zinc-500">{p.executionLevel.replace(/_/g, " ")}</p>
                </div>
              ))}
              {!policy.length && !loading ? <Empty text="No policy data available." /> : null}
            </div>
          </Panel>
          <Panel title="Oyi Core execution activity" subtitle="Broader signal-driven execution history across Oyi Core -- not limited to this automation queue.">
            {executionStats?.statistics ? (
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                <FacilityMetricCard icon={<ShieldCheck />} label="Total executions" value={executionStats.statistics.total} detail="All Oyi Core executions" accent="text-sky-400" />
                <FacilityMetricCard icon={<CheckCircle2 />} label="Success rate" value={`${executionStats.statistics.successRate}%`} detail="Across all origins" accent="text-emerald-400" />
                <FacilityMetricCard icon={<Clock3 />} label="Approval required" value={executionStats.statistics.approvalRequired} detail="Flagged for approval" accent="text-amber-400" />
                <FacilityMetricCard icon={<XCircle />} label="Failed" value={executionStats.statistics.failedExecutions} detail="Terminal failures" accent="text-rose-400" />
                <FacilityMetricCard icon={<Bot />} label="Automation-origin" value={executionStats.statistics.automationActions} detail="origin: automation" accent="text-violet-400" />
              </div>
            ) : (
              <Empty text={loading ? "Loading…" : "No execution statistics available."} />
            )}
          </Panel>
        </section>
      ) : null}

      {tab === "active" ? (
        <section className="space-y-5">
          <Panel title="System Automations" subtitle="Server-defined detectors -- real, running today, not user-editable in this phase.">
            <div className="space-y-2">
              {SYSTEM_AUTOMATIONS.map((automation) => (
                <OisListItem
                  key={automation.id}
                  title={automation.name}
                  description={`${automation.domain} · ${automation.trigger}`}
                  meta={`Action: ${automation.action} · Policy: ${automation.policy}`}
                  status="stable"
                />
              ))}
            </div>
          </Panel>
          <Panel title="Custom Automations" subtitle="User-authored automation rules.">
            <Empty text="Unsupported in this phase -- no custom rule authoring exists yet. Only the system-defined detectors above run today." />
          </Panel>
        </section>
      ) : null}

      {tab === "recommendations" ? (
        <Panel title="Recommendations" subtitle="Oyi Core's existing advisory recommendations. Review-only -- these are not automatically converted into executable actions; only the narrow system automations above ever propose something executable.">
          <div className="space-y-2">
            {visiblePlans.map((plan) => (
              <OisListItem
                key={plan.id}
                title={plan.title}
                description={plan.summary}
                meta={`${plan.domain} · confidence ${Math.round((plan.confidence || 0) * 100)}% · ${dateLabel(plan.generatedAt)}`}
                status={plan.severity === "critical" ? "critical" : plan.severity === "warning" ? "warning" : "attention"}
                action={
                  <Button variant="ghost" onClick={() => setDismissedPlanIds((prev) => new Set(prev).add(plan.id))}>
                    Dismiss
                  </Button>
                }
              />
            ))}
            {!visiblePlans.length ? <Empty text={loading ? "Loading…" : "No recommendations right now."} /> : null}
          </div>
        </Panel>
      ) : null}

      {tab === "approvals" ? (
        <Panel title="Approval Queue" subtitle="Concrete, parameter-complete proposals from a system detector. Approve triggers real execution immediately; reject discards it. Both are audited.">
          <div className="space-y-2">
            {pendingApprovals.map((approval) => (
              <OisListItem
                key={approval.id}
                title={approval.target_label || approval.entity_id}
                description={approval.reason}
                meta={`${approval.action_id} · requested ${dateLabel(approval.created_at)} · expires ${dateLabel(approval.expires_at)}`}
                status="pending"
                action={
                  <div className="flex gap-2">
                    <Button disabled={busyId === approval.id} onClick={() => void decide(approval.id, "approve")}>
                      {busyId === approval.id ? "Working…" : "Approve"}
                    </Button>
                    <Button variant="ghost" disabled={busyId === approval.id} onClick={() => void decide(approval.id, "reject")}>
                      Reject
                    </Button>
                  </div>
                }
              />
            ))}
            {!pendingApprovals.length ? <Empty text={loading ? "Loading…" : "No approvals pending."} /> : null}
          </div>
        </Panel>
      ) : null}

      {tab === "runs" ? (
        <Panel title="Runs" subtitle="Approval-triggered executions -- signal, recommendation and detector lineage, policy, approval, execution and verification state.">
          <div className="space-y-2">
            {runs.map((run) => (
              <OisListItem
                key={run.id}
                title={`${run.action_id} -- ${run.target_label || run.entity_id}`}
                description={`Detector: ${run.detector_id} · Approver: ${run.approver_role || "—"} · ${run.verification ? `Verification: ${run.verification.state}` : "Not yet verified"}`}
                meta={`Requested ${dateLabel(run.created_at)} · Decided ${dateLabel(run.decided_at)} · Executed ${dateLabel(run.executed_at)}`}
                status={approvalStatusTone(run.status)}
              />
            ))}
            {!runs.length ? <Empty text={loading ? "Loading…" : "No runs yet."} /> : null}
          </div>
        </Panel>
      ) : null}

      {tab === "failures" ? (
        <Panel title="Failures" subtitle="Execution or verification failures. Each is audited and notified to eligible operators when it happens.">
          <div className="space-y-2">
            {failed.map((run) => (
              <OisListItem
                key={run.id}
                title={`${run.action_id} -- ${run.target_label || run.entity_id}`}
                description={run.verification?.summary || run.decision_note || "Execution failed."}
                meta={`Detector: ${run.detector_id} · ${dateLabel(run.executed_at || run.decided_at)}`}
                status="critical"
                icon={<AlertTriangle className="h-4 w-4 text-rose-300" />}
              />
            ))}
            {!failed.length ? <Empty text={loading ? "Loading…" : "No failures recorded."} /> : null}
          </div>
        </Panel>
      ) : null}

      {tab === "history" ? (
        <Panel title="History" subtitle="Every decided approval -- approved, rejected, expired, succeeded or failed.">
          <div className="space-y-2">
            {history.map((item) => (
              <OisListItem
                key={item.id}
                icon={<HistoryIcon className="h-4 w-4 text-zinc-400" />}
                title={`${item.action_id} -- ${item.target_label || item.entity_id}`}
                description={`${item.approver_role || item.requested_by} · ${item.decision_note || item.reason}`}
                meta={dateLabel(item.decided_at)}
                status={approvalStatusTone(item.status)}
              />
            ))}
            {!history.length ? <Empty text={loading ? "Loading…" : "No decided approvals yet."} /> : null}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
