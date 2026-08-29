"use client";

// Automation Workspace UI/UX completion. Reuses canonical infrastructure
// only -- no second automation engine was created:
//  - System detectors (duplicate_maintenance_request,
//    stale_visitor_authorization) + the approval queue -- built in an
//    earlier phase, facilityAutomationService.ts on Backend.
//  - Custom automations (Create Automation) -- the pre-existing "Shared
//    Automation Runtime" (Backend's src/routes/scenes.ts, mounted at
//    /scenes), the same backend Oyi Consumer's own device scenes already
//    use. Scoped to the Assets/Device domain only this pass: scenes.ts's
//    scheduled-execution path (executeConsumerAutomation ->
//    executeRegisteredActionBatch) does not consult
//    automationPolicyResolver or automation_approvals at all -- wiring
//    Visitor/Maintenance registered actions into a user-facing scheduler
//    here would let an admin schedule an automatic action that bypasses
//    the approval-required governance built for exactly those domains.
//    Device scenes carry no such regression (they've always executed
//    directly). Facility surface also requires
//    AUTOMATION_SURFACE_FACILITY_ENABLED=true in the deployed
//    environment -- currently false in production; this is a deployment
//    decision, not something flipped here.
//  - Governance table + summary -- the existing /facility/automation/policy
//    contract (read-only; editing still lives in Facility Administration).
//  - Oyi Core execution activity -- the existing oyiCoreRuntimeService
//    execution history/statistics endpoints.
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  History as HistoryIcon,
  Pencil,
  Play,
  Plus,
  Power,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import OisCard from "@/components/ois/OisCard";
import OisDrawer from "@/components/ois/OisDrawer";
import OisListItem from "@/components/ois/OisListItem";
import OisStatusBadge, { type OisStatus } from "@/components/ois/OisStatusBadge";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import FacilityMetricCard from "@/components/ois/FacilityMetricCard";
import { facilityService, type AutomationApproval, type AutomationActionPolicy, type InfrastructureDevice } from "@/services/facilityService";
import { automationRulesService, type AutomationRule, type AutomationScheduleTrigger, type AutomationRuleRun } from "@/services/automationRulesService";
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

// Readable labels for the canonical action keys. The action key stays
// visible as secondary metadata for diagnostics; customers see the
// plain-language label first.
const ACTION_LABELS: Record<string, string> = {
  "visitor.approve": "Approve visitor",
  "visitor.revoke": "Revoke visitor access",
  "visitor.expire": "Expire visitor access",
  "maintenance.assign": "Assign maintenance",
  "maintenance.complete": "Complete maintenance",
  "maintenance.cancel": "Cancel maintenance",
  "device.on": "Turn device on",
  "device.off": "Turn device off",
  "device.toggle": "Toggle device",
};
function actionLabel(actionId: string) {
  return ACTION_LABELS[actionId] || actionId.replace(/[._]/g, " ");
}
function domainForAction(actionId: string) {
  if (actionId.startsWith("visitor.")) return "Access";
  if (actionId.startsWith("maintenance.")) return "Maintenance";
  if (actionId.startsWith("device.")) return "Assets";
  return actionId.split(".")[0] || "General";
}

const SYSTEM_AUTOMATIONS = [
  {
    id: "duplicate_maintenance_request",
    name: "Duplicate work order detection",
    domain: "Maintenance",
    trigger: "On new maintenance request",
    action: "maintenance.cancel",
    mode: "Approval required",
  },
  {
    id: "stale_visitor_authorization",
    name: "Stale visitor authorization cleanup",
    domain: "Access",
    trigger: "On Approvals load",
    action: "visitor.expire",
    mode: "Approval required",
  },
];

function dateLabel(value?: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function relativeLabel(value?: string | null) {
  if (!value) return "Never run";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never run";
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return dateLabel(value);
}

function approvalStatusTone(status: string): OisStatus {
  if (["succeeded"].includes(status)) return "resolved";
  if (["failed", "verification_failed"].includes(status)) return "critical";
  if (["rejected", "cancelled", "expired"].includes(status)) return "blocked";
  if (["executing"].includes(status)) return "pending";
  return "attention";
}
function ruleRunTone(status?: string | null): OisStatus {
  if (["succeeded"].includes(String(status))) return "resolved";
  if (["failed", "partially_succeeded"].includes(String(status))) return "critical";
  if (["running"].includes(String(status))) return "pending";
  return "unavailable";
}
function triggerSummary(trigger: AutomationScheduleTrigger) {
  if (trigger.schedule_type === "daily") return `Daily at ${trigger.local_time}`;
  if (trigger.schedule_type === "weekdays") {
    const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return `${trigger.weekdays.map((d) => names[d]).join(", ")} at ${trigger.local_time}`;
  }
  return `Once on ${trigger.local_datetime.replace("T", " ")}`;
}
function actionSummary(rule: AutomationRule) {
  const first = rule.actions?.[0];
  if (!first) return "No action configured";
  const control = String(first.command?.action || Object.values(first.command || {})[0] || "run");
  const label = first.label || first.action_label || "device";
  return `${String(control).replace(/_/g, " ")} -- ${label}`;
}

function Panel({ title, subtitle, children, action }: { title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <OisCard className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          {subtitle ? <p className="mt-1 text-xs leading-5 text-zinc-500">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </OisCard>
  );
}
function Registry({ title, subtitle, toolbar, children }: { title: string; subtitle?: string; toolbar?: React.ReactNode; children: React.ReactNode }) {
  return (
    <OisCard className="overflow-hidden">
      <header className="flex flex-wrap items-start justify-between gap-3 px-4 pb-3 pt-4">
        <div>
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          {subtitle ? <p className="mt-1 text-xs leading-5 text-zinc-500">{subtitle}</p> : null}
        </div>
        {toolbar}
      </header>
      {children}
    </OisCard>
  );
}
function Table({ columns, children }: { columns: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto border-t border-white/[0.06]">
      <table className="w-full min-w-[760px] text-left">
        <thead>
          <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.08em] text-zinc-500">
            {columns.map((column) => <th key={column} className="px-4 py-2.5 font-medium">{column}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function Row({ children }: { children: React.ReactNode }) {
  return <tr className="border-b border-white/[0.04] text-[12.5px] text-zinc-300 last:border-0 hover:bg-white/[0.02]">{children}</tr>;
}
function Cell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;
}
function EmptyRow({ text, colSpan }: { text: string; colSpan: number }) {
  return <tr><td colSpan={colSpan} className="px-4 py-8 text-center text-sm text-zinc-500">{text}</td></tr>;
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
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [rulesAvailable, setRulesAvailable] = useState(true);
  const [devices, setDevices] = useState<InfrastructureDevice[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [plansResult, approvalsResult, policyResult, historyResult, statsResult, rulesResult, infraResult] = await Promise.all([
        loadAutomationPlans().catch(() => []),
        facilityService.automationApprovals().catch(() => ({ estate_id: "", approvals: [] })),
        facilityService.automationPolicy().catch(() => ({ estate_id: "", policy: [] })),
        loadOyiCoreExecutionHistory({ limit: 50 }).catch(() => []),
        loadOyiCoreExecutionStatistics({ limit: 200 }).catch(() => null),
        automationRulesService.list(),
        facilityService.infrastructureOperations().catch(() => null),
      ]);
      setPlans(plansResult);
      setApprovals(approvalsResult.approvals || []);
      setPolicy(policyResult.policy || []);
      setExecutionHistory(historyResult || []);
      setExecutionStats(statsResult);
      setRules(rulesResult.automations);
      setRulesAvailable(rulesResult.available);
      setDevices(infraResult?.registry || []);
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
  const succeededApprovals = useMemo(() => approvals.filter((a) => a.status === "succeeded"), [approvals]);
  const failedApprovals = useMemo(() => approvals.filter((a) => ["failed", "verification_failed"].includes(a.status)), [approvals]);
  const runsApprovals = useMemo(() => approvals.filter((a) => ["executing", "succeeded", "failed", "verification_failed"].includes(a.status)), [approvals]);
  const historyApprovals = useMemo(() => approvals.filter((a) => a.decided_at), [approvals]);

  const enabledRules = useMemo(() => rules.filter((r) => r.enabled), [rules]);
  const disabledRules = useMemo(() => rules.filter((r) => !r.enabled), [rules]);
  const succeededRuleRuns = useMemo(() => rules.filter((r) => r.last_run_status === "succeeded").length, [rules]);
  const failedRuleRuns = useMemo(() => rules.filter((r) => ["failed", "partially_succeeded"].includes(String(r.last_run_status))).length, [rules]);

  // Combined, real counts across both real execution-tracking sources --
  // the detector-driven approval queue and the scheduled Shared Automation
  // Runtime. Never a fabricated figure.
  const totalActive = SYSTEM_AUTOMATIONS.length + enabledRules.length;
  const totalSucceeded = succeededApprovals.length + succeededRuleRuns;
  const totalFailed = failedApprovals.length + failedRuleRuns;
  const healthTotal = totalSucceeded + totalFailed;
  const healthPct = healthTotal > 0 ? Math.round((totalSucceeded / healthTotal) * 100) : null;

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

  async function toggleRule(rule: AutomationRule) {
    setBusyId(rule.id);
    setError(null);
    try {
      const res = await automationRulesService.setEnabled(rule.id, !rule.enabled);
      if (!res.ok) { setError(res.error); return; }
      setNotice(rule.enabled ? "Automation disabled." : "Automation enabled.");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function removeRule(rule: AutomationRule) {
    if (!window.confirm(`Delete "${rule.name}"? This cannot be undone.`)) return;
    setBusyId(rule.id);
    setError(null);
    try {
      const res = await automationRulesService.remove(rule.id);
      if (!res.ok) { setError(res.error || "Unable to delete this automation."); return; }
      setNotice("Automation deleted.");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function runRuleNow(rule: AutomationRule) {
    setBusyId(rule.id);
    setError(null);
    try {
      const res = await automationRulesService.runNow(rule.id);
      if (!res.ok) { setError(res.error || "Automation run could not complete."); return; }
      setNotice(`Run completed: ${res.status || "done"}.`);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <Topbar
        title="Automation"
        subtitle="Automate operations across your facility with safety, approvals and full audit."
        rightSlot={<Button onClick={() => { setEditingRule(null); setBuilderOpen(true); }} className="gap-2"><Plus className="h-4 w-4" />Create Automation</Button>}
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
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <FacilityMetricCard icon={<Bot />} label="Active Automations" value={loading ? "—" : totalActive} detail={`${enabledRules.length} custom, ${SYSTEM_AUTOMATIONS.length} built-in`} accent="text-sky-400" />
            <FacilityMetricCard icon={<Clock3 />} label="Pending Approvals" value={loading ? "—" : pendingApprovals.length} detail="Awaiting operator decision" accent="text-amber-400" />
            <FacilityMetricCard icon={<CheckCircle2 />} label="Successful Executions" value={loading ? "—" : totalSucceeded} detail="Across detectors and automations" accent="text-emerald-400" />
            <FacilityMetricCard icon={<XCircle />} label="Failed Executions" value={loading ? "—" : totalFailed} detail="Across detectors and automations" accent={totalFailed ? "text-rose-400" : "text-zinc-400"} />
            <FacilityMetricCard icon={<ShieldCheck />} label="Automation Health" value={loading ? "—" : healthPct == null ? "No data yet" : `${healthPct}%`} detail={healthTotal ? `${totalSucceeded} of ${healthTotal} succeeded` : "Awaiting execution history"} accent={healthPct == null ? "text-zinc-400" : healthPct >= 90 ? "text-emerald-400" : healthPct >= 60 ? "text-amber-400" : "text-rose-400"} />
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Registry title="Active Automations" subtitle="Automation rules currently running in your facility." toolbar={<button type="button" onClick={() => setTab("active")} className="text-xs text-sky-200 hover:text-sky-100">View all →</button>}>
              <Table columns={["Automation", "Trigger", "Action", "Mode", "Last Run", "Status", "Actions"]}>
                {SYSTEM_AUTOMATIONS.map((automation) => (
                  <Row key={automation.id}>
                    <Cell><p className="text-zinc-100">{automation.name}</p><span className="mt-1 inline-block rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-zinc-500">{automation.domain}</span></Cell>
                    <Cell className="text-zinc-500">{automation.trigger}</Cell>
                    <Cell className="text-zinc-400">{actionLabel(automation.action)}</Cell>
                    <Cell><OisStatusBadge status="attention" label={automation.mode} /></Cell>
                    <Cell className="text-zinc-500">Built-in</Cell>
                    <Cell><OisStatusBadge status="stable" label="Enabled" /></Cell>
                    <Cell className="text-zinc-600">Not editable</Cell>
                  </Row>
                ))}
                {rules.slice(0, 8).map((rule) => (
                  <Row key={rule.id}>
                    <Cell><p className="text-zinc-100">{rule.name}</p><span className="mt-1 inline-block rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-zinc-500">Assets</span></Cell>
                    <Cell className="text-zinc-500">{triggerSummary(rule.trigger)}</Cell>
                    <Cell className="text-zinc-400">{actionSummary(rule)}</Cell>
                    <Cell><OisStatusBadge status="stable" label="Automatic" /></Cell>
                    <Cell className="text-zinc-500">{relativeLabel(rule.last_run_at)}</Cell>
                    <Cell><OisStatusBadge status={rule.enabled ? "stable" : "unavailable"} label={rule.enabled ? "Enabled" : "Disabled"} /></Cell>
                    <Cell>
                      <div className="flex items-center gap-1">
                        <button type="button" title="Run now" disabled={busyId === rule.id} onClick={() => void runRuleNow(rule)} className="rounded-md p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white"><Play className="h-3.5 w-3.5" /></button>
                        <button type="button" title={rule.enabled ? "Disable" : "Enable"} disabled={busyId === rule.id} onClick={() => void toggleRule(rule)} className="rounded-md p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white"><Power className="h-3.5 w-3.5" /></button>
                        <button type="button" title="Edit" onClick={() => { setEditingRule(rule); setBuilderOpen(true); }} className="rounded-md p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white"><Pencil className="h-3.5 w-3.5" /></button>
                        <button type="button" title="Delete" disabled={busyId === rule.id} onClick={() => void removeRule(rule)} className="rounded-md p-1.5 text-rose-400 hover:bg-rose-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </Cell>
                  </Row>
                ))}
                {!rules.length && !loading ? (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-xs text-zinc-500">No custom automations yet. {!rulesAvailable ? "Custom automation creation isn't enabled for this deployment yet." : "Use Create Automation to add one."}</td></tr>
                ) : null}
              </Table>
              <div className="border-t border-white/[0.06] px-4 py-2.5 text-[11px] text-zinc-600">Showing {Math.min(rules.length, 8) + SYSTEM_AUTOMATIONS.length} of {rules.length + SYSTEM_AUTOMATIONS.length} automations</div>
            </Registry>

            <div className="space-y-5">
              <Registry title="Automation Governance" subtitle="Control how Oyi may act across supported operations." toolbar={<Link href="/facility-administration?tab=automation" className="text-xs text-sky-200 hover:text-sky-100">Manage governance →</Link>}>
                <Table columns={["Operation", "Domain", "Mode", "Status"]}>
                  {policy.map((row) => (
                    <Row key={row.actionId}>
                      <Cell className="text-zinc-100">{actionLabel(row.actionId)}</Cell>
                      <Cell className="text-zinc-500">{domainForAction(row.actionId)}</Cell>
                      <Cell className="capitalize text-zinc-400">{row.executionLevel.replace(/_/g, " ")}</Cell>
                      <Cell><OisStatusBadge status="stable" label="Enforced" /></Cell>
                    </Row>
                  ))}
                  {!policy.length && !loading ? <EmptyRow text="No policy data available." colSpan={4} /> : null}
                </Table>
              </Registry>

              <OisCard className="p-4">
                <h3 className="text-sm font-semibold text-white">Governance Summary</h3>
                <p className="mt-1 text-xs leading-5 text-zinc-500">How Oyi's operational authority is currently configured.</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.08em] text-zinc-500">Automatic execution</p>
                    <p className="mt-1 text-lg font-semibold text-white">{policy.filter((p) => p.executionLevel === "auto_allowed").length}</p>
                    <p className="text-[11px] text-zinc-600">actions</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.08em] text-zinc-500">Approval-required</p>
                    <p className="mt-1 text-lg font-semibold text-white">{policy.filter((p) => p.executionLevel === "approval_required").length}</p>
                    <p className="text-[11px] text-zinc-600">actions</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.08em] text-zinc-500">Autonomous actions</p>
                    <p className="mt-1 text-lg font-semibold text-white">{enabledRules.length}</p>
                    <p className="text-[11px] text-zinc-600">custom automations</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.08em] text-zinc-500">Safety status</p>
                    <p className="mt-1 text-lg font-semibold text-emerald-400">Protected</p>
                    <p className="text-[11px] text-zinc-600">visitor/access/finance excluded</p>
                  </div>
                </div>
              </OisCard>
            </div>
          </div>

          <Panel title="Oyi Core execution activity" subtitle="Broader signal-driven execution history across Oyi Core -- not limited to automations created in this workspace.">
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
          <Registry title="System Automations" subtitle="Built-in detectors that run today. Not yet user-editable.">
            <Table columns={["Automation", "Domain", "Trigger", "Action", "Mode", "Status"]}>
              {SYSTEM_AUTOMATIONS.map((automation) => (
                <Row key={automation.id}>
                  <Cell className="text-zinc-100">{automation.name}</Cell>
                  <Cell className="text-zinc-500">{automation.domain}</Cell>
                  <Cell className="text-zinc-500">{automation.trigger}</Cell>
                  <Cell className="text-zinc-400">{actionLabel(automation.action)}</Cell>
                  <Cell><OisStatusBadge status="attention" label={automation.mode} /></Cell>
                  <Cell><OisStatusBadge status="stable" label="Enabled" /></Cell>
                </Row>
              ))}
            </Table>
          </Registry>
          <Registry title="Custom Automations" subtitle="Automations you've created." toolbar={<Button onClick={() => { setEditingRule(null); setBuilderOpen(true); }} className="gap-2"><Plus className="h-4 w-4" />Create Automation</Button>}>
            <Table columns={["Automation", "Trigger", "Action", "Last Run", "Status", "Actions"]}>
              {rules.map((rule) => (
                <Row key={rule.id}>
                  <Cell className="text-zinc-100">{rule.name}</Cell>
                  <Cell className="text-zinc-500">{triggerSummary(rule.trigger)}</Cell>
                  <Cell className="text-zinc-400">{actionSummary(rule)}</Cell>
                  <Cell className="text-zinc-500">{relativeLabel(rule.last_run_at)}</Cell>
                  <Cell><OisStatusBadge status={rule.enabled ? "stable" : "unavailable"} label={rule.enabled ? "Enabled" : "Disabled"} /></Cell>
                  <Cell>
                    <div className="flex items-center gap-1">
                      <button type="button" title="Run now" disabled={busyId === rule.id} onClick={() => void runRuleNow(rule)} className="rounded-md p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white"><Play className="h-3.5 w-3.5" /></button>
                      <button type="button" title={rule.enabled ? "Disable" : "Enable"} disabled={busyId === rule.id} onClick={() => void toggleRule(rule)} className="rounded-md p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white"><Power className="h-3.5 w-3.5" /></button>
                      <button type="button" title="Edit" onClick={() => { setEditingRule(rule); setBuilderOpen(true); }} className="rounded-md p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white"><Pencil className="h-3.5 w-3.5" /></button>
                      <button type="button" title="Delete" disabled={busyId === rule.id} onClick={() => void removeRule(rule)} className="rounded-md p-1.5 text-rose-400 hover:bg-rose-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </Cell>
                </Row>
              ))}
              {!rules.length ? <EmptyRow text={!rulesAvailable ? "Custom automation creation isn't enabled for this deployment yet." : loading ? "Loading…" : "No custom automations yet."} colSpan={6} /> : null}
            </Table>
          </Registry>
        </section>
      ) : null}

      {tab === "recommendations" ? (
        <Panel title="Recommendations" subtitle="Oyi Core's existing advisory recommendations. Review-only -- these are not automatically converted into executable actions.">
          <div className="space-y-2">
            {visiblePlans.map((plan) => (
              <OisListItem
                key={plan.id}
                title={plan.title}
                description={plan.summary}
                meta={`${plan.domain} · confidence ${Math.round((plan.confidence || 0) * 100)}% · ${dateLabel(plan.generatedAt)}`}
                status={plan.severity === "critical" ? "critical" : plan.severity === "warning" ? "warning" : "attention"}
                action={<Button variant="ghost" onClick={() => setDismissedPlanIds((prev) => new Set(prev).add(plan.id))}>Dismiss</Button>}
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
                meta={`${actionLabel(approval.action_id)} · requested ${dateLabel(approval.created_at)} · expires ${dateLabel(approval.expires_at)}`}
                status="pending"
                action={
                  <div className="flex gap-2">
                    <Button disabled={busyId === approval.id} onClick={() => void decide(approval.id, "approve")}>{busyId === approval.id ? "Working…" : "Approve"}</Button>
                    <Button variant="ghost" disabled={busyId === approval.id} onClick={() => void decide(approval.id, "reject")}>Reject</Button>
                  </div>
                }
              />
            ))}
            {!pendingApprovals.length ? <Empty text={loading ? "Loading…" : "No approvals pending."} /> : null}
          </div>
        </Panel>
      ) : null}

      {tab === "runs" ? (
        <section className="space-y-5">
          <Registry title="Approval-Triggered Runs" subtitle="Executions from the system-detector approval queue.">
            <Table columns={["Action", "Target", "Approver", "Verification", "Status", "Timestamps"]}>
              {runsApprovals.map((run) => (
                <Row key={run.id}>
                  <Cell className="text-zinc-100">{actionLabel(run.action_id)}</Cell>
                  <Cell className="text-zinc-400">{run.target_label || run.entity_id}</Cell>
                  <Cell className="text-zinc-500">{run.approver_role || "—"}</Cell>
                  <Cell className="text-zinc-500">{run.verification ? run.verification.state : "Not yet verified"}</Cell>
                  <Cell><OisStatusBadge status={approvalStatusTone(run.status)} label={run.status.replace(/_/g, " ")} /></Cell>
                  <Cell className="whitespace-nowrap text-zinc-600">{dateLabel(run.executed_at)}</Cell>
                </Row>
              ))}
              {!runsApprovals.length ? <EmptyRow text={loading ? "Loading…" : "No runs yet."} colSpan={6} /> : null}
            </Table>
          </Registry>
          <RuleRunsPanel rules={rules} />
        </section>
      ) : null}

      {tab === "failures" ? (
        <Panel title="Failures" subtitle="Execution or verification failures. Each is audited and notified to eligible operators when it happens.">
          <div className="space-y-2">
            {failedApprovals.map((run) => (
              <OisListItem
                key={run.id}
                title={`${actionLabel(run.action_id)} -- ${run.target_label || run.entity_id}`}
                description={run.verification?.summary || run.decision_note || "Execution failed."}
                meta={`Detector: ${run.detector_id} · ${dateLabel(run.executed_at || run.decided_at)}`}
                status="critical"
                icon={<AlertTriangle className="h-4 w-4 text-rose-300" />}
              />
            ))}
            {rules.filter((r) => ["failed", "partially_succeeded"].includes(String(r.last_run_status))).map((rule) => (
              <OisListItem
                key={rule.id}
                title={`${rule.name} -- ${actionSummary(rule)}`}
                description="Automation run failed or partially succeeded."
                meta={`Custom automation · ${dateLabel(rule.last_run_at)}`}
                status="critical"
                icon={<AlertTriangle className="h-4 w-4 text-rose-300" />}
              />
            ))}
            {!failedApprovals.length && !rules.some((r) => ["failed", "partially_succeeded"].includes(String(r.last_run_status))) ? <Empty text={loading ? "Loading…" : "No failures recorded."} /> : null}
          </div>
        </Panel>
      ) : null}

      {tab === "history" ? (
        <Panel title="History" subtitle="Every decided approval and automation lifecycle event -- approved, rejected, expired, succeeded or failed.">
          <div className="space-y-2">
            {historyApprovals.map((item) => (
              <OisListItem
                key={item.id}
                icon={<HistoryIcon className="h-4 w-4 text-zinc-400" />}
                title={`${actionLabel(item.action_id)} -- ${item.target_label || item.entity_id}`}
                description={`${item.approver_role || item.requested_by} · ${item.decision_note || item.reason}`}
                meta={dateLabel(item.decided_at)}
                status={approvalStatusTone(item.status)}
              />
            ))}
            {!historyApprovals.length ? <Empty text={loading ? "Loading…" : "No decided approvals yet."} /> : null}
          </div>
        </Panel>
      ) : null}

      <AutomationBuilder
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        devices={devices}
        editingRule={editingRule}
        onSaved={async () => { setBuilderOpen(false); setNotice(editingRule ? "Automation updated." : "Automation created."); await load(); }}
      />
    </div>
  );
}

function RuleRunsPanel({ rules }: { rules: AutomationRule[] }) {
  const [selected, setSelected] = useState<AutomationRule | null>(null);
  const [runs, setRuns] = useState<AutomationRuleRun[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);

  useEffect(() => {
    if (!selected) return;
    setLoadingRuns(true);
    automationRulesService.runs(selected.id).then(setRuns).finally(() => setLoadingRuns(false));
  }, [selected]);

  return (
    <Registry title="Custom Automation Runs" subtitle="Execution history for automations created in this workspace." toolbar={
      rules.length ? (
        <select value={selected?.id || ""} onChange={(e) => setSelected(rules.find((r) => r.id === e.target.value) || null)} className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs text-white">
          <option value="">Select an automation…</option>
          {rules.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      ) : undefined
    }>
      {!rules.length ? (
        <p className="p-4 text-sm text-zinc-500">No custom automations exist yet.</p>
      ) : !selected ? (
        <p className="p-4 text-sm text-zinc-500">Select an automation above to see its run history.</p>
      ) : (
        <Table columns={["Source", "Status", "Scheduled For", "Started", "Completed", "Result"]}>
          {loadingRuns ? <EmptyRow text="Loading…" colSpan={6} /> : runs.map((run) => (
            <Row key={run.id}>
              <Cell className="capitalize text-zinc-400">{run.source.replace(/_/g, " ")}</Cell>
              <Cell><OisStatusBadge status={ruleRunTone(run.status)} label={run.status.replace(/_/g, " ")} /></Cell>
              <Cell className="text-zinc-500">{dateLabel(run.scheduled_for)}</Cell>
              <Cell className="text-zinc-500">{dateLabel(run.started_at)}</Cell>
              <Cell className="text-zinc-500">{dateLabel(run.completed_at)}</Cell>
              <Cell className="text-zinc-500">{run.counts ? `${run.counts.completed}/${run.counts.total} completed` : run.error_message || "—"}</Cell>
            </Row>
          ))}
          {!loadingRuns && !runs.length ? <EmptyRow text="No runs recorded for this automation yet." colSpan={6} /> : null}
        </Table>
      )}
    </Registry>
  );
}

// ---------------------------
// CREATE AUTOMATION BUILDER
// Trigger -> Action -> Execution -> Review. Assets/Device domain only
// this pass (see the file header comment for why). Calls the real
// POST/PATCH /scenes/automations contract.
// ---------------------------
type BuilderStep = "trigger" | "action" | "execution" | "review";
const BUILDER_STEPS: Array<{ key: BuilderStep; label: string }> = [
  { key: "trigger", label: "Trigger" },
  { key: "action", label: "Action" },
  { key: "execution", label: "Execution" },
  { key: "review", label: "Review" },
];

function AutomationBuilder({ open, onClose, devices, editingRule, onSaved }: { open: boolean; onClose: () => void; devices: InfrastructureDevice[]; editingRule: AutomationRule | null; onSaved: () => void }) {
  const [step, setStep] = useState<BuilderStep>("trigger");
  const [name, setName] = useState("");
  const [scheduleType, setScheduleType] = useState<"daily" | "weekdays" | "once">("daily");
  const [localTime, setLocalTime] = useState("09:00");
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [localDatetime, setLocalDatetime] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [control, setControl] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editingRule) {
      setName(editingRule.name);
      setEnabled(editingRule.enabled);
      const t = editingRule.trigger;
      setScheduleType(t.schedule_type);
      if (t.schedule_type === "daily" || t.schedule_type === "weekdays") setLocalTime(t.local_time);
      if (t.schedule_type === "weekdays") setWeekdays(t.weekdays);
      if (t.schedule_type === "once") setLocalDatetime(t.local_datetime);
      const firstAction = editingRule.actions?.[0];
      setDeviceId(firstAction?.device_id || "");
      setControl(String(firstAction?.command?.action || ""));
    } else {
      setName("");
      setScheduleType("daily");
      setLocalTime("09:00");
      setWeekdays([1, 2, 3, 4, 5]);
      setLocalDatetime("");
      setDeviceId("");
      setControl("");
      setEnabled(true);
    }
    setStep("trigger");
    setSaveError(null);
  }, [open, editingRule]);

  const device = devices.find((d) => d.id === deviceId) || null;
  const controls = device?.supported_controls || [];
  const stepIndex = BUILDER_STEPS.findIndex((s) => s.key === step);

  function triggerValid() {
    if (scheduleType === "daily") return /^([01]\d|2[0-3]):([0-5]\d)$/.test(localTime);
    if (scheduleType === "weekdays") return /^([01]\d|2[0-3]):([0-5]\d)$/.test(localTime) && weekdays.length > 0;
    return /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):([0-5]\d)$/.test(localDatetime);
  }
  function actionValid() {
    return Boolean(deviceId && control);
  }

  function buildTrigger(): AutomationScheduleTrigger {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Lagos";
    if (scheduleType === "daily") return { type: "schedule", schedule_type: "daily", local_time: localTime, timezone };
    if (scheduleType === "weekdays") return { type: "schedule", schedule_type: "weekdays", local_time: localTime, weekdays, timezone };
    return { type: "schedule", schedule_type: "once", local_datetime: localDatetime, timezone };
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        name: name.trim(),
        trigger: buildTrigger(),
        actions: [{ device_id: deviceId, command: { action: control }, label: device?.name || null }],
        enabled,
      };
      const res = editingRule ? await automationRulesService.update(editingRule.id, payload) : await automationRulesService.create(payload);
      if (!res.ok) {
        if (res.code === "automation_surface_disabled") {
          setSaveError("Facility automation creation isn't enabled for this deployment yet. Contact Ochiga to activate it.");
        } else {
          setSaveError(res.error);
        }
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const inputClass = "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-sky-400/40";

  return (
    <OisDrawer
      open={open}
      onClose={onClose}
      title={editingRule ? "Edit Automation" : "Create Automation"}
      subtitle="Trigger, condition and action -- built from real Facility capabilities."
      width="lg"
      footer={
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" disabled={stepIndex === 0} onClick={() => setStep(BUILDER_STEPS[Math.max(0, stepIndex - 1)].key)}>Back</Button>
          {step !== "review" ? (
            <Button disabled={(step === "trigger" && !triggerValid()) || (step === "action" && !actionValid())} onClick={() => setStep(BUILDER_STEPS[Math.min(BUILDER_STEPS.length - 1, stepIndex + 1)].key)}>Next</Button>
          ) : (
            <Button disabled={saving || !name.trim() || !triggerValid() || !actionValid()} onClick={() => void save()}>{saving ? "Saving…" : editingRule ? "Save changes" : "Create automation"}</Button>
          )}
        </div>
      }
    >
      <div className="mb-5 flex gap-2">
        {BUILDER_STEPS.map((s, index) => (
          <div key={s.key} className={`flex-1 rounded-full px-2 py-1.5 text-center text-[10px] uppercase tracking-[0.06em] ${index <= stepIndex ? "bg-sky-500/15 text-sky-100" : "bg-white/5 text-zinc-600"}`}>{s.label}</div>
        ))}
      </div>

      <div className="mb-4">
        <label className="text-xs text-zinc-500">Automation name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Turn off lobby lights at midnight" className={`${inputClass} mt-1`} /></label>
      </div>

      {step === "trigger" ? (
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">When should this automation run? Only scheduled triggers are supported today -- there is no condition-sensor (e.g. tank level, camera offline) trigger wired into this workspace yet.</p>
          <div className="flex gap-2">
            {(["daily", "weekdays", "once"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setScheduleType(t)} className={`rounded-lg border px-3 py-2 text-xs capitalize ${scheduleType === t ? "border-sky-400/35 bg-sky-500/10 text-sky-100" : "border-white/10 bg-white/5 text-zinc-400"}`}>{t}</button>
            ))}
          </div>
          {scheduleType !== "once" ? (
            <label className="block text-xs text-zinc-500">Time of day<input type="time" value={localTime} onChange={(e) => setLocalTime(e.target.value)} className={`${inputClass} mt-1`} /></label>
          ) : (
            <label className="block text-xs text-zinc-500">Date and time<input type="datetime-local" value={localDatetime} onChange={(e) => setLocalDatetime(e.target.value)} className={`${inputClass} mt-1`} /></label>
          )}
          {scheduleType === "weekdays" ? (
            <div>
              <p className="text-xs text-zinc-500">Repeat on</p>
              <div className="mt-2 flex gap-1.5">
                {weekdayNames.map((label, index) => (
                  <button key={label} type="button" onClick={() => setWeekdays((prev) => prev.includes(index) ? prev.filter((d) => d !== index) : [...prev, index].sort())} className={`h-8 w-8 rounded-md text-[11px] ${weekdays.includes(index) ? "bg-sky-500/20 text-sky-100" : "bg-white/5 text-zinc-500"}`}>{label[0]}</button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {step === "action" ? (
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">What should Oyi do? Only Assets (device) actions can be created here today -- Access and Maintenance actions already execute through the system-detector approval queue, which this builder does not bypass.</p>
          <label className="block text-xs text-zinc-500">Device<select value={deviceId} onChange={(e) => { setDeviceId(e.target.value); setControl(""); }} className={`${inputClass} mt-1`}>
            <option value="">Select a device…</option>
            {devices.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.category || d.type})</option>)}
          </select></label>
          {device ? (
            controls.length ? (
              <label className="block text-xs text-zinc-500">Control<select value={control} onChange={(e) => setControl(e.target.value)} className={`${inputClass} mt-1`}>
                <option value="">Select a control…</option>
                {controls.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
              </select></label>
            ) : (
              <p className="text-xs text-amber-300">This device has no supported controls registered -- it can't be used in an automation yet.</p>
            )
          ) : null}
        </div>
      ) : null}

      {step === "execution" ? (
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">How may this action execute? This is enforced by the backend, not this screen.</p>
          <OisCard variant="evidence" className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">Automatic</p>
                <p className="mt-1 text-xs leading-5 text-zinc-500">Device actions run directly on schedule, the same way Facility's manual device controls already work -- no separate approval step exists for this domain.</p>
              </div>
              <OisStatusBadge status="stable" label="Automatic" />
            </div>
          </OisCard>
          <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />Enable this automation immediately</label>
        </div>
      ) : null}

      {step === "review" ? (
        <div className="space-y-3">
          <OisCard variant="evidence" className="p-4 text-sm">
            <p className="text-zinc-500">WHEN</p>
            <p className="mt-1 text-white">{triggerSummary(buildTrigger())}</p>
          </OisCard>
          <OisCard variant="evidence" className="p-4 text-sm">
            <p className="text-zinc-500">THEN</p>
            <p className="mt-1 text-white">{control ? `${control.replace(/_/g, " ")} -- ${device?.name || "device"}` : "No action configured"}</p>
          </OisCard>
          <OisCard variant="evidence" className="p-4 text-sm">
            <p className="text-zinc-500">EXECUTION</p>
            <p className="mt-1 text-white">Automatic · {enabled ? "Enabled" : "Disabled"} on save</p>
          </OisCard>
          {saveError ? <p className="text-xs text-rose-300">{saveError}</p> : null}
        </div>
      ) : null}
    </OisDrawer>
  );
}
