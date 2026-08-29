"use client";

// Automation Workspace UI/UX -- final visual/interaction consistency pass.
// This pass does not change automation architecture, capabilities, or the
// safety/governance model. It reuses the same real data sources the prior
// pass established:
//  - System detectors (duplicate_maintenance_request,
//    stale_visitor_authorization) + the approval queue -- built in an
//    earlier phase, facilityAutomationService.ts on Backend.
//  - Custom automations (Create Automation) -- the pre-existing "Shared
//    Automation Runtime" (Backend's src/routes/scenes.ts, mounted at
//    /scenes). Still scoped to the Assets/Device domain only: that
//    runtime's scheduled-execution path never consults the approval-gated
//    policy resolver, so Visitor/Maintenance stay on the detector+approval
//    path. Not widened in this visual pass.
//  - Governance table + summary -- the existing /facility/automation/policy
//    contract (read-only; editing still lives in Facility Administration).
//  - Oyi Core execution activity / Runs / Failures / History -- the
//    existing oyiCoreRuntimeService execution history/statistics
//    endpoints (src/oyi-core/runtime/executionLedger.ts's real record
//    shape), which cover activity beyond workspace-created automations.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  History as HistoryIcon,
  Info,
  MoreVertical,
  Pause,
  Pencil,
  Play,
  Plus,
  Power,
  Search,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import OisCard from "@/components/ois/OisCard";
import OisDrawer from "@/components/ois/OisDrawer";
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

// Real shape returned by Backend's executionLedger (src/oyi-core/runtime/
// executionLedger.ts's ExecutionLedgerRecord), as served by GET
// /oyi/runtime/executions/history. Only the fields this page reads are
// declared here.
type ExecutionRecord = {
  executionId: string;
  estate: string | null;
  building: string | null;
  unit: string | null;
  device: string | null;
  origin: string | null;
  initiator: { type: string | null; id: string | null; role: string | null; name: string | null };
  action: string;
  requestedAt: string;
  startedAt: string;
  completedAt: string | null;
  duration: number | null;
  status: string;
  approvalRequired: boolean;
  verification: { verified: boolean; method: string | null; trustScore: number } | null;
  automationReference: string | null;
  triggerReason: string | null;
};

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
function durationLabel(ms: number | null) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  return `${Math.round(seconds / 60)}m`;
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
function planStatusTone(status: string): OisStatus {
  if (status === "prepared") return "stable";
  if (status === "awaiting_approval") return "pending";
  if (status === "expired") return "blocked";
  if (status === "cancelled") return "unavailable";
  return "attention";
}
function planSeverityTone(severity: string): OisStatus {
  if (severity === "critical") return "critical";
  if (severity === "warning") return "warning";
  if (severity === "attention") return "attention";
  return "stable";
}
function executionStatusTone(status: string): OisStatus {
  if (status === "executed") return "resolved";
  if (["failed", "denied"].includes(status)) return "critical";
  if (status === "expired") return "blocked";
  if (status === "pending_confirmation") return "pending";
  if (status === "confirmed") return "attention";
  return "stable";
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
function executionTargetLabel(exec: ExecutionRecord) {
  if (exec.device) return exec.device;
  const composed = [exec.building, exec.unit].filter(Boolean).join(" / ");
  return composed || exec.estate || "—";
}
function executionInitiatorLabel(exec: ExecutionRecord) {
  return exec.initiator?.name || exec.initiator?.role || exec.initiator?.type || "System";
}

// ---------------------------
// SHARED PRIMITIVES
// ---------------------------
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
function Registry({ title, subtitle, toolbar, dense, children }: { title: string; subtitle?: string; toolbar?: React.ReactNode; dense?: boolean; children: React.ReactNode }) {
  return (
    <OisCard className="overflow-hidden">
      <header className={`flex flex-wrap items-start justify-between gap-3 ${dense ? "px-3.5 pb-2.5 pt-3.5" : "px-4 pb-3 pt-4"}`}>
        <div>
          <h2 className={dense ? "text-[13px] font-semibold text-white" : "text-sm font-semibold text-white"}>{title}</h2>
          {subtitle ? <p className="mt-0.5 text-[11px] leading-4 text-zinc-500">{subtitle}</p> : null}
        </div>
        {toolbar}
      </header>
      {children}
    </OisCard>
  );
}
function Table({ columns, dense, minWidth, children }: { columns: string[]; dense?: boolean; minWidth?: number; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto border-t border-white/[0.06]">
      <table className="w-full text-left" style={{ minWidth: minWidth || (dense ? 560 : 760) }}>
        <thead>
          <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.08em] text-zinc-500">
            {columns.map((column) => (
              <th key={column} className={`font-medium ${dense ? "px-3 py-2" : "px-4 py-2.5"}`}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function Row({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <tr onClick={onClick} className={`border-b border-white/[0.04] text-[12.5px] text-zinc-300 last:border-0 hover:bg-white/[0.02] ${onClick ? "cursor-pointer" : ""}`}>
      {children}
    </tr>
  );
}
function Cell({ children, className = "", dense }: { children: React.ReactNode; className?: string; dense?: boolean }) {
  return <td className={`align-middle ${dense ? "px-3 py-2 text-[11.5px]" : "px-4 py-3"} ${className}`}>{children}</td>;
}
function EmptyRow({ text, colSpan }: { text: string; colSpan: number }) {
  return <tr><td colSpan={colSpan} className="px-4 py-8 text-center text-sm text-zinc-500">{text}</td></tr>;
}
function Empty({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-zinc-500">{text}</p>;
}
function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <div className="relative w-full max-w-[220px]">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder || "Search…"}
        className="w-full rounded-lg border border-white/10 bg-white/5 py-1.5 pl-8 pr-3 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-sky-400/40"
      />
    </div>
  );
}
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-[11px] transition ${active ? "border-sky-400/35 bg-sky-500/10 text-sky-100" : "border-white/10 bg-white/5 text-zinc-400 hover:text-white"}`}
    >
      {children}
    </button>
  );
}
function FilterBar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] px-4 py-2.5">{children}</div>;
}
function RowMenu({ items }: { items: Array<{ label: string; onClick: () => void; danger?: boolean; disabled?: boolean }> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  if (!items.length) return null;
  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        title="More actions"
        aria-label="More actions"
        onClick={(event) => { event.stopPropagation(); setOpen((v) => !v); }}
        className="rounded-md p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white"
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-lg border border-white/10 bg-[#0c1017] py-1 shadow-xl">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={item.disabled}
              onClick={(event) => { event.stopPropagation(); setOpen(false); item.onClick(); }}
              className={`block w-full px-3 py-1.5 text-left text-xs transition disabled:opacity-40 ${item.danger ? "text-rose-300 hover:bg-rose-500/10" : "text-zinc-300 hover:bg-white/5"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
function InspectDrawer({ open, onClose, title, subtitle, rows }: { open: boolean; onClose: () => void; title: string; subtitle?: string; rows: Array<{ label: string; value: React.ReactNode }> }) {
  return (
    <OisDrawer open={open} onClose={onClose} title={title} subtitle={subtitle} width="md">
      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={`${row.label}-${index}`} className="flex items-start justify-between gap-4 border-b border-white/[0.05] pb-2.5 text-sm last:border-0">
            <span className="shrink-0 text-zinc-500">{row.label}</span>
            <span className="text-right text-zinc-200">{row.value}</span>
          </div>
        ))}
      </div>
    </OisDrawer>
  );
}

// Enabled: Run now, Pause, Edit, More(Duplicate/View runs/Delete).
// Paused: Run now, Resume, Edit, More(Duplicate/View runs/Delete). Run Now
// is independent of enable state -- confirmed against Backend's
// POST /scenes/automations/:id/test, which never checks `enabled`.
function RuleActionControls({ rule, busy, onRun, onToggle, onEdit, onDuplicate, onViewRuns, onDelete }: {
  rule: AutomationRule;
  busy: boolean;
  onRun: () => void;
  onToggle: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onViewRuns: () => void;
  onDelete: () => void;
}) {
  if (busy) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-sky-300">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400" />Working…
      </span>
    );
  }
  return (
    <div className="flex items-center gap-0.5" onClick={(event) => event.stopPropagation()}>
      <button type="button" title="Run now" aria-label="Run now" onClick={onRun} className="rounded-md p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white">
        <Play className="h-3.5 w-3.5" />
      </button>
      <button type="button" title={rule.enabled ? "Pause" : "Resume"} aria-label={rule.enabled ? "Pause automation" : "Resume automation"} onClick={onToggle} className="rounded-md p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white">
        {rule.enabled ? <Pause className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
      </button>
      <button type="button" title="Edit" aria-label="Edit automation" onClick={onEdit} className="rounded-md p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white">
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <RowMenu
        items={[
          { label: "Duplicate", onClick: onDuplicate },
          { label: "View runs", onClick: onViewRuns },
          { label: "Delete", onClick: onDelete, danger: true },
        ]}
      />
    </div>
  );
}
function SystemAutomationIndicator() {
  return (
    <span title="Managed automatically by Oyi Core -- not user-editable" className="inline-flex items-center gap-1 text-[11px] text-zinc-600">
      <Info className="h-3 w-3" />System-managed
    </span>
  );
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
  const [executionHistory, setExecutionHistory] = useState<ExecutionRecord[]>([]);
  const [executionStats, setExecutionStats] = useState<any>(null);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [rulesAvailable, setRulesAvailable] = useState(true);
  const [devices, setDevices] = useState<InfrastructureDevice[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [duplicateTemplate, setDuplicateTemplate] = useState<AutomationRule | null>(null);
  const [runsSelectedRuleId, setRunsSelectedRuleId] = useState<string>("");
  const [inspect, setInspect] = useState<{ title: string; subtitle?: string; rows: Array<{ label: string; value: React.ReactNode }> } | null>(null);

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
      setExecutionHistory((historyResult as ExecutionRecord[]) || []);
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
  const failedRuleRows = useMemo(() => rules.filter((r) => ["failed", "partially_succeeded"].includes(String(r.last_run_status))), [rules]);
  const failedExecutions = useMemo(() => executionHistory.filter((e) => e.status === "failed"), [executionHistory]);

  const enabledRules = useMemo(() => rules.filter((r) => r.enabled), [rules]);
  const succeededRuleRuns = useMemo(() => rules.filter((r) => r.last_run_status === "succeeded").length, [rules]);
  const failedRuleRuns = failedRuleRows.length;

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
      setNotice(rule.enabled ? "Automation paused." : "Automation resumed.");
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

  function openCreate() { setEditingRule(null); setDuplicateTemplate(null); setBuilderOpen(true); }
  function openEdit(rule: AutomationRule) { setEditingRule(rule); setDuplicateTemplate(null); setBuilderOpen(true); }
  function openDuplicate(rule: AutomationRule) { setEditingRule(null); setDuplicateTemplate(rule); setBuilderOpen(true); }
  function openRuns(rule: AutomationRule) { setRunsSelectedRuleId(rule.id); setTab("runs"); }

  function ruleControlsFor(rule: AutomationRule) {
    return (
      <RuleActionControls
        rule={rule}
        busy={busyId === rule.id}
        onRun={() => void runRuleNow(rule)}
        onToggle={() => void toggleRule(rule)}
        onEdit={() => openEdit(rule)}
        onDuplicate={() => openDuplicate(rule)}
        onViewRuns={() => openRuns(rule)}
        onDelete={() => void removeRule(rule)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Topbar title="Automation" subtitle="Automate operations across your facility with safety, approvals and full audit." />

      {error ? <div role="alert" className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</div> : null}
      {notice ? <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">{notice}</div> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
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
        <Button onClick={openCreate} className="shrink-0 gap-2"><Plus className="h-4 w-4" />Create Automation</Button>
      </div>

      {tab === "overview" ? (
        <section className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <FacilityMetricCard icon={<Bot />} label="Active Automations" value={loading ? "—" : totalActive} detail={`${enabledRules.length} custom, ${SYSTEM_AUTOMATIONS.length} built-in`} accent="text-sky-400" />
            <FacilityMetricCard icon={<Clock3 />} label="Pending Approvals" value={loading ? "—" : pendingApprovals.length} detail="Awaiting operator decision" accent="text-amber-400" />
            <FacilityMetricCard icon={<CheckCircle2 />} label="Successful Executions" value={loading ? "—" : totalSucceeded} detail="Across detectors and automations" accent="text-emerald-400" />
            <FacilityMetricCard icon={<XCircle />} label="Failed Executions" value={loading ? "—" : totalFailed} detail="Across detectors and automations" accent={totalFailed ? "text-rose-400" : "text-zinc-400"} />
            <FacilityMetricCard icon={<ShieldCheck />} label="Automation Health" value={loading ? "—" : healthPct == null ? "No data yet" : `${healthPct}%`} detail={healthTotal ? `${totalSucceeded} of ${healthTotal} succeeded` : "Awaiting execution history"} accent={healthPct == null ? "text-zinc-400" : healthPct >= 90 ? "text-emerald-400" : healthPct >= 60 ? "text-amber-400" : "text-rose-400"} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <Registry title="Active Automations" subtitle="Automation rules currently running in your facility." toolbar={<button type="button" onClick={() => setTab("active")} className="text-xs text-sky-200 hover:text-sky-100">View all →</button>}>
              <Table columns={["Automation", "Trigger", "Action", "Mode", "Last Run", "Status", "Actions"]}>
                {SYSTEM_AUTOMATIONS.map((automation) => (
                  <Row key={automation.id}>
                    <Cell><p className="text-zinc-100">{automation.name}</p><span className="mt-1 inline-block rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-zinc-500">{automation.domain}</span></Cell>
                    <Cell className="text-zinc-500">{automation.trigger}</Cell>
                    <Cell className="text-zinc-400">{actionLabel(automation.action)}</Cell>
                    <Cell><OisStatusBadge status="attention" label={automation.mode} /></Cell>
                    <Cell className="text-zinc-500">Event-driven</Cell>
                    <Cell><OisStatusBadge status="stable" label="Enabled" /></Cell>
                    <Cell><SystemAutomationIndicator /></Cell>
                  </Row>
                ))}
                {rules.slice(0, 8).map((rule) => (
                  <Row key={rule.id}>
                    <Cell><p className="text-zinc-100">{rule.name}</p><span className="mt-1 inline-block rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-zinc-500">Assets</span></Cell>
                    <Cell className="text-zinc-500">{triggerSummary(rule.trigger)}</Cell>
                    <Cell className="text-zinc-400">{actionSummary(rule)}</Cell>
                    <Cell><OisStatusBadge status="stable" label="Automatic" /></Cell>
                    <Cell className="text-zinc-500">{relativeLabel(rule.last_run_at)}</Cell>
                    <Cell><OisStatusBadge status={rule.enabled ? "stable" : "unavailable"} label={rule.enabled ? "Enabled" : "Paused"} /></Cell>
                    <Cell>{ruleControlsFor(rule)}</Cell>
                  </Row>
                ))}
                {!rules.length && !loading ? (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-xs text-zinc-500">No custom automations yet. {!rulesAvailable ? "Custom automation creation isn't enabled for this deployment yet." : "Use Create Automation to add one."}</td></tr>
                ) : null}
              </Table>
              <div className="border-t border-white/[0.06] px-4 py-2 text-[11px] text-zinc-600">Showing {Math.min(rules.length, 8) + SYSTEM_AUTOMATIONS.length} of {rules.length + SYSTEM_AUTOMATIONS.length} automations</div>
            </Registry>

            <div className="space-y-4">
              <Registry dense title="Automation Governance" subtitle="How Oyi may act, enforced server-side." toolbar={<Link href="/facility-administration?tab=automation" className="text-[11px] text-sky-200 hover:text-sky-100">Manage governance →</Link>}>
                <Table dense columns={["Operation", "Domain", "Mode", "Status"]}>
                  {policy.map((row) => (
                    <Row key={row.actionId}>
                      <Cell dense className="text-zinc-100">{actionLabel(row.actionId)}</Cell>
                      <Cell dense className="text-zinc-500">{domainForAction(row.actionId)}</Cell>
                      <Cell dense className="capitalize text-zinc-400">{row.executionLevel.replace(/_/g, " ")}</Cell>
                      <Cell dense><OisStatusBadge status="stable" label="Enforced" /></Cell>
                    </Row>
                  ))}
                  {!policy.length && !loading ? <EmptyRow text="No policy data available." colSpan={4} /> : null}
                </Table>
              </Registry>

              <OisCard className="p-3.5">
                <h3 className="text-[13px] font-semibold text-white">Governance Summary</h3>
                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.08em] text-zinc-500">Automatic</p>
                    <p className="mt-0.5 text-base font-semibold text-white">{policy.filter((p) => p.executionLevel === "auto_allowed").length}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.08em] text-zinc-500">Approval-required</p>
                    <p className="mt-0.5 text-base font-semibold text-white">{policy.filter((p) => p.executionLevel === "approval_required").length}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.08em] text-zinc-500">Autonomous rules</p>
                    <p className="mt-0.5 text-base font-semibold text-white">{enabledRules.length}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.08em] text-zinc-500">Safety status</p>
                    <p className="mt-0.5 text-base font-semibold text-emerald-400">Protected</p>
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

      {tab === "active" ? <ActiveAutomationsTab rules={rules} rulesAvailable={rulesAvailable} loading={loading} onCreate={openCreate} ruleControlsFor={ruleControlsFor} /> : null}
      {tab === "recommendations" ? <RecommendationsTab plans={visiblePlans} loading={loading} onDismiss={(id) => setDismissedPlanIds((prev) => new Set(prev).add(id))} onInspect={setInspect} /> : null}
      {tab === "approvals" ? <ApprovalsTab approvals={approvals} pending={pendingApprovals} loading={loading} busyId={busyId} onDecide={decide} onInspect={setInspect} /> : null}
      {tab === "runs" ? <RunsTab runsApprovals={runsApprovals} executions={executionHistory} rules={rules} selectedRuleId={runsSelectedRuleId} onSelectRule={setRunsSelectedRuleId} loading={loading} onInspect={setInspect} /> : null}
      {tab === "failures" ? <FailuresTab failedApprovals={failedApprovals} failedRules={failedRuleRows} failedExecutions={failedExecutions} loading={loading} onInspect={setInspect} /> : null}
      {tab === "history" ? <HistoryTab historyApprovals={historyApprovals} executions={executionHistory} loading={loading} onInspect={setInspect} /> : null}

      <AutomationBuilder
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        devices={devices}
        editingRule={editingRule}
        template={duplicateTemplate}
        onSaved={async () => { setBuilderOpen(false); setNotice(editingRule ? "Automation updated." : "Automation created."); await load(); }}
      />

      <InspectDrawer
        open={Boolean(inspect)}
        onClose={() => setInspect(null)}
        title={inspect?.title || ""}
        subtitle={inspect?.subtitle}
        rows={inspect?.rows || []}
      />
    </div>
  );
}

// ---------------------------
// ACTIVE AUTOMATIONS TAB
// ---------------------------
type TypeFilter = "all" | "system" | "custom";
type StatusFilter = "all" | "enabled" | "paused";

function ActiveAutomationsTab({ rules, rulesAvailable, loading, onCreate, ruleControlsFor }: {
  rules: AutomationRule[];
  rulesAvailable: boolean;
  loading: boolean;
  onCreate: () => void;
  ruleControlsFor: (rule: AutomationRule) => React.ReactNode;
}) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filteredSystem = useMemo(() => {
    if (typeFilter === "custom") return [];
    const query = search.trim().toLowerCase();
    return SYSTEM_AUTOMATIONS.filter((a) => !query || a.name.toLowerCase().includes(query) || a.domain.toLowerCase().includes(query));
  }, [typeFilter, search]);

  const filteredRules = useMemo(() => {
    if (typeFilter === "system") return [];
    const query = search.trim().toLowerCase();
    return rules.filter((rule) => {
      if (statusFilter === "enabled" && !rule.enabled) return false;
      if (statusFilter === "paused" && rule.enabled) return false;
      if (!query) return true;
      return rule.name.toLowerCase().includes(query) || actionSummary(rule).toLowerCase().includes(query);
    });
  }, [rules, typeFilter, statusFilter, search]);

  const total = filteredSystem.length + filteredRules.length;

  return (
    <section>
      <Registry
        title="Active Automations"
        subtitle="Every automation running in your facility -- system detectors and rules you've created."
        toolbar={<Button onClick={onCreate} className="gap-2"><Plus className="h-4 w-4" />Create Automation</Button>}
      >
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search automations…" />
          <div className="flex flex-wrap gap-1.5">
            <Chip active={typeFilter === "all"} onClick={() => setTypeFilter("all")}>All types</Chip>
            <Chip active={typeFilter === "system"} onClick={() => setTypeFilter("system")}>System</Chip>
            <Chip active={typeFilter === "custom"} onClick={() => setTypeFilter("custom")}>Custom</Chip>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Chip active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>All statuses</Chip>
            <Chip active={statusFilter === "enabled"} onClick={() => setStatusFilter("enabled")}>Enabled</Chip>
            <Chip active={statusFilter === "paused"} onClick={() => setStatusFilter("paused")}>Paused</Chip>
          </div>
        </FilterBar>
        <Table columns={["Automation", "Domain", "Trigger", "Action", "Mode", "Last Run", "Next Run", "Status", "Type", "Actions"]} minWidth={1080}>
          {filteredSystem.map((automation) => (
            <Row key={automation.id}>
              <Cell className="text-zinc-100">{automation.name}</Cell>
              <Cell className="text-zinc-500">{automation.domain}</Cell>
              <Cell className="text-zinc-500">{automation.trigger}</Cell>
              <Cell className="text-zinc-400">{actionLabel(automation.action)}</Cell>
              <Cell><OisStatusBadge status="attention" label={automation.mode} /></Cell>
              <Cell className="text-zinc-500">Event-driven</Cell>
              <Cell className="text-zinc-600">—</Cell>
              <Cell><OisStatusBadge status="stable" label="Enabled" /></Cell>
              <Cell className="text-zinc-500">System</Cell>
              <Cell><SystemAutomationIndicator /></Cell>
            </Row>
          ))}
          {filteredRules.map((rule) => (
            <Row key={rule.id}>
              <Cell className="text-zinc-100">{rule.name}</Cell>
              <Cell className="text-zinc-500">Assets</Cell>
              <Cell className="text-zinc-500">{triggerSummary(rule.trigger)}</Cell>
              <Cell className="text-zinc-400">{actionSummary(rule)}</Cell>
              <Cell><OisStatusBadge status="stable" label="Automatic" /></Cell>
              <Cell className="text-zinc-500">{relativeLabel(rule.last_run_at)}</Cell>
              <Cell className="text-zinc-500">{rule.next_run_at ? dateLabel(rule.next_run_at) : "—"}</Cell>
              <Cell><OisStatusBadge status={rule.enabled ? "stable" : "unavailable"} label={rule.enabled ? "Enabled" : "Paused"} /></Cell>
              <Cell className="text-zinc-500">Custom</Cell>
              <Cell>{ruleControlsFor(rule)}</Cell>
            </Row>
          ))}
          {!total ? (
            <EmptyRow colSpan={10} text={loading ? "Loading…" : !rulesAvailable && typeFilter !== "system" ? "Custom automation creation isn't enabled for this deployment yet." : "No automations match this filter."} />
          ) : null}
        </Table>
      </Registry>
    </section>
  );
}

// ---------------------------
// RECOMMENDATIONS TAB
// ---------------------------
function RecommendationsTab({ plans, loading, onDismiss, onInspect }: {
  plans: AutomationPlan[];
  loading: boolean;
  onDismiss: (id: string) => void;
  onInspect: (payload: { title: string; subtitle?: string; rows: Array<{ label: string; value: React.ReactNode }> }) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return plans;
    return plans.filter((plan) => plan.title.toLowerCase().includes(query) || plan.domain.toLowerCase().includes(query));
  }, [plans, search]);

  function inspectPlan(plan: AutomationPlan) {
    onInspect({
      title: plan.title,
      subtitle: plan.summary,
      rows: [
        { label: "Domain", value: plan.domain.replace(/_/g, " ") },
        { label: "Target", value: plan.targetEntity?.name || plan.targetEntity?.type || "—" },
        { label: "Owner", value: plan.owner || "—" },
        { label: "Severity", value: <OisStatusBadge status={planSeverityTone(plan.severity)} label={plan.severity} /> },
        { label: "Confidence", value: `${Math.round((plan.confidence || 0) * 100)}%` },
        { label: "Proposed action", value: plan.actionIntent },
        { label: "Execution mode", value: plan.executionMode.replace(/_/g, " ") },
        { label: "Approval required", value: plan.approvalRequired ? "Yes" : "No" },
        { label: "Verification required", value: plan.verificationRequired ? "Yes" : "No" },
        { label: "Safe to execute", value: plan.safeToExecute ? "Yes" : "No" },
        { label: "Preconditions", value: plan.preconditions?.length ? plan.preconditions.join(", ") : "None recorded" },
        { label: "Safety checks", value: plan.safetyChecks?.length ? plan.safetyChecks.join(", ") : "None recorded" },
        { label: "Required permissions", value: plan.requiredPermissions?.length ? plan.requiredPermissions.join(", ") : "None recorded" },
        { label: "Rollback plan", value: plan.rollbackPlan || "Not specified" },
        { label: "Expected outcome", value: plan.expectedOutcome || "Not specified" },
        { label: "Next step", value: plan.nextStep || "Not specified" },
        { label: "Status", value: <OisStatusBadge status={planStatusTone(plan.status)} label={plan.status.replace(/_/g, " ")} /> },
        { label: "Generated", value: dateLabel(plan.generatedAt) },
        { label: "Expires", value: dateLabel(plan.expiresAt) },
      ],
    });
  }

  return (
    <Registry title="Recommendations" subtitle="Oyi Core's advisory recommendations. Review-only -- these are not automatically converted into executable actions.">
      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search recommendations…" />
      </FilterBar>
      <Table columns={["Recommendation", "Domain", "Target", "Severity", "Proposed action", "Created", "Status", "Actions"]} minWidth={920}>
        {filtered.map((plan) => (
          <Row key={plan.id} onClick={() => inspectPlan(plan)}>
            <Cell className="text-zinc-100">{plan.title}</Cell>
            <Cell className="text-zinc-500">{plan.domain.replace(/_/g, " ")}</Cell>
            <Cell className="text-zinc-400">{plan.targetEntity?.name || plan.targetEntity?.type || "—"}</Cell>
            <Cell><OisStatusBadge status={planSeverityTone(plan.severity)} label={plan.severity} /></Cell>
            <Cell className="max-w-[220px] truncate text-zinc-400">{plan.actionIntent}</Cell>
            <Cell className="text-zinc-500">{dateLabel(plan.generatedAt)}</Cell>
            <Cell><OisStatusBadge status={planStatusTone(plan.status)} label={plan.status.replace(/_/g, " ")} /></Cell>
            <Cell>
              <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
                <button type="button" className="rounded-md px-2 py-1 text-[11px] text-sky-200 hover:bg-white/5" onClick={() => inspectPlan(plan)}>Review</button>
                <button type="button" className="rounded-md px-2 py-1 text-[11px] text-zinc-400 hover:bg-white/5 hover:text-white" onClick={() => onDismiss(plan.id)}>Dismiss</button>
              </div>
            </Cell>
          </Row>
        ))}
        {!filtered.length ? <EmptyRow colSpan={8} text={loading ? "Loading…" : "No recommendations require attention."} /> : null}
      </Table>
    </Registry>
  );
}

// ---------------------------
// APPROVALS TAB
// ---------------------------
function ApprovalsTab({ approvals, pending, loading, busyId, onDecide, onInspect }: {
  approvals: AutomationApproval[];
  pending: AutomationApproval[];
  loading: boolean;
  busyId: string | null;
  onDecide: (id: string, decision: "approve" | "reject") => void;
  onInspect: (payload: { title: string; subtitle?: string; rows: Array<{ label: string; value: React.ReactNode }> }) => void;
}) {
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const source = showAll ? approvals : pending;
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return source;
    return source.filter((a) => (a.target_label || a.entity_id || "").toLowerCase().includes(query) || actionLabel(a.action_id).toLowerCase().includes(query));
  }, [source, search]);

  function inspectApproval(approval: AutomationApproval) {
    onInspect({
      title: actionLabel(approval.action_id),
      subtitle: approval.target_label || approval.entity_id,
      rows: [
        { label: "Domain", value: domainForAction(approval.action_id) },
        { label: "Reason", value: approval.reason },
        { label: "Status", value: <OisStatusBadge status={approvalStatusTone(approval.status)} label={approval.status.replace(/_/g, " ")} /> },
        { label: "Requested by", value: approval.requested_by },
        { label: "Approver", value: approval.approver_role || "—" },
        { label: "Decision note", value: approval.decision_note || "—" },
        { label: "Verification", value: approval.verification ? `${approval.verification.state} -- ${approval.verification.summary}` : "Not yet verified" },
        { label: "Requested", value: dateLabel(approval.created_at) },
        { label: "Expires", value: dateLabel(approval.expires_at) },
        { label: "Decided", value: dateLabel(approval.decided_at) },
        { label: "Executed", value: dateLabel(approval.executed_at) },
      ],
    });
  }

  return (
    <Registry title="Approval Queue" subtitle="Concrete, parameter-complete proposals from a system detector. Approve triggers real execution immediately; reject discards it. Both are audited.">
      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search approvals…" />
        <div className="flex gap-1.5">
          <Chip active={!showAll} onClick={() => setShowAll(false)}>Pending</Chip>
          <Chip active={showAll} onClick={() => setShowAll(true)}>All</Chip>
        </div>
      </FilterBar>
      <Table columns={["Action", "Domain", "Target", "Requested", "Expires", "Requested by", "Status", "Actions"]} minWidth={920}>
        {filtered.map((approval) => (
          <Row key={approval.id} onClick={() => inspectApproval(approval)}>
            <Cell className="text-zinc-100">{actionLabel(approval.action_id)}</Cell>
            <Cell className="text-zinc-500">{domainForAction(approval.action_id)}</Cell>
            <Cell className="text-zinc-400">{approval.target_label || approval.entity_id}</Cell>
            <Cell className="text-zinc-500">{dateLabel(approval.created_at)}</Cell>
            <Cell className="text-zinc-500">{dateLabel(approval.expires_at)}</Cell>
            <Cell className="text-zinc-500">{approval.requested_by}</Cell>
            <Cell><OisStatusBadge status={approvalStatusTone(approval.status)} label={approval.status.replace(/_/g, " ")} /></Cell>
            <Cell>
              {approval.status === "pending_approval" ? (
                <div className="flex items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
                  <button type="button" disabled={busyId === approval.id} onClick={() => onDecide(approval.id, "approve")} className="rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-blue-500 disabled:opacity-50">
                    {busyId === approval.id ? "Working…" : "Approve"}
                  </button>
                  <button type="button" disabled={busyId === approval.id} onClick={() => onDecide(approval.id, "reject")} className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-300 hover:bg-white/10">Reject</button>
                </div>
              ) : (
                <button type="button" className="text-[11px] text-sky-200 hover:text-sky-100" onClick={(event) => { event.stopPropagation(); inspectApproval(approval); }}>Review</button>
              )}
            </Cell>
          </Row>
        ))}
        {!filtered.length ? <EmptyRow colSpan={8} text={loading ? "Loading…" : showAll ? "No approvals recorded yet." : "No approvals pending."} /> : null}
      </Table>
    </Registry>
  );
}

// ---------------------------
// RUNS TAB
// ---------------------------
function RunsTab({ runsApprovals, executions, rules, selectedRuleId, onSelectRule, loading, onInspect }: {
  runsApprovals: AutomationApproval[];
  executions: ExecutionRecord[];
  rules: AutomationRule[];
  selectedRuleId: string;
  onSelectRule: (id: string) => void;
  loading: boolean;
  onInspect: (payload: { title: string; subtitle?: string; rows: Array<{ label: string; value: React.ReactNode }> }) => void;
}) {
  const [search, setSearch] = useState("");
  const filteredExecutions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return executions;
    return executions.filter((e) => e.action.toLowerCase().includes(query) || executionTargetLabel(e).toLowerCase().includes(query));
  }, [executions, search]);

  function inspectExecution(exec: ExecutionRecord) {
    onInspect({
      title: exec.action.replace(/[._]/g, " "),
      subtitle: executionTargetLabel(exec),
      rows: [
        { label: "Automation", value: exec.automationReference || "Not automation-originated" },
        { label: "Trigger", value: exec.triggerReason || "—" },
        { label: "Origin", value: exec.origin || "—" },
        { label: "Initiator", value: executionInitiatorLabel(exec) },
        { label: "Status", value: <OisStatusBadge status={executionStatusTone(exec.status)} label={exec.status.replace(/_/g, " ")} /> },
        { label: "Approval required", value: exec.approvalRequired ? "Yes" : "No" },
        { label: "Verification", value: exec.verification ? `${exec.verification.verified ? "Verified" : "Not verified"} -- ${exec.verification.method || "n/a"}` : "Not recorded" },
        { label: "Requested", value: dateLabel(exec.requestedAt) },
        { label: "Started", value: dateLabel(exec.startedAt) },
        { label: "Completed", value: dateLabel(exec.completedAt) },
        { label: "Duration", value: durationLabel(exec.duration) },
      ],
    });
  }

  return (
    <section className="space-y-4">
      <Registry title="Approval-Triggered Runs" subtitle="Executions from the system-detector approval queue.">
        <Table columns={["Action", "Target", "Approver", "Verification", "Status", "Timestamp"]}>
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

      <RuleRunsPanel rules={rules} selectedId={selectedRuleId} onSelectId={onSelectRule} />

      <Registry title="Oyi Core Executions" subtitle="Broader execution history across Oyi Core -- not limited to workspace-created automations.">
        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search executions…" />
        </FilterBar>
        <Table columns={["Execution", "Automation", "Target", "Trigger", "Started", "Duration", "Result", "Verification", "Initiator"]} minWidth={1000}>
          {filteredExecutions.map((exec) => (
            <Row key={exec.executionId} onClick={() => inspectExecution(exec)}>
              <Cell className="text-zinc-100">{exec.action.replace(/[._]/g, " ")}</Cell>
              <Cell className="text-zinc-500">{exec.automationReference || "—"}</Cell>
              <Cell className="text-zinc-400">{executionTargetLabel(exec)}</Cell>
              <Cell className="max-w-[160px] truncate text-zinc-500">{exec.triggerReason || "—"}</Cell>
              <Cell className="text-zinc-500">{dateLabel(exec.startedAt || exec.requestedAt)}</Cell>
              <Cell className="text-zinc-500">{durationLabel(exec.duration)}</Cell>
              <Cell><OisStatusBadge status={executionStatusTone(exec.status)} label={exec.status.replace(/_/g, " ")} /></Cell>
              <Cell className="text-zinc-500">{exec.verification ? (exec.verification.verified ? "Verified" : "Unverified") : "—"}</Cell>
              <Cell className="text-zinc-500">{executionInitiatorLabel(exec)}</Cell>
            </Row>
          ))}
          {!filteredExecutions.length ? <EmptyRow colSpan={9} text={loading ? "Loading…" : "No execution history available."} /> : null}
        </Table>
      </Registry>
    </section>
  );
}

function RuleRunsPanel({ rules, selectedId, onSelectId }: { rules: AutomationRule[]; selectedId: string; onSelectId: (id: string) => void }) {
  const [runs, setRuns] = useState<AutomationRuleRun[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const selected = rules.find((r) => r.id === selectedId) || null;

  useEffect(() => {
    if (!selectedId) { setRuns([]); return; }
    setLoadingRuns(true);
    automationRulesService.runs(selectedId).then(setRuns).finally(() => setLoadingRuns(false));
  }, [selectedId]);

  return (
    <Registry title="Custom Automation Runs" subtitle="Execution history for automations created in this workspace." toolbar={
      rules.length ? (
        <select value={selectedId} onChange={(e) => onSelectId(e.target.value)} className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs text-white">
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
// FAILURES TAB
// ---------------------------
type FailureRow = { id: string; automation: string; domain: string; target: string; stage: string; reason: string; time: string; source: string; rows: Array<{ label: string; value: React.ReactNode }> };

function FailuresTab({ failedApprovals, failedRules, failedExecutions, loading, onInspect }: {
  failedApprovals: AutomationApproval[];
  failedRules: AutomationRule[];
  failedExecutions: ExecutionRecord[];
  loading: boolean;
  onInspect: (payload: { title: string; subtitle?: string; rows: Array<{ label: string; value: React.ReactNode }> }) => void;
}) {
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "approvals" | "custom" | "executions">("all");

  const combined = useMemo<FailureRow[]>(() => {
    const rows: FailureRow[] = [];
    for (const approval of failedApprovals) {
      rows.push({
        id: `approval:${approval.id}`,
        automation: actionLabel(approval.action_id),
        domain: domainForAction(approval.action_id),
        target: approval.target_label || approval.entity_id,
        stage: approval.status.replace(/_/g, " "),
        reason: approval.verification?.summary || approval.decision_note || approval.reason,
        time: approval.executed_at || approval.decided_at || approval.created_at,
        source: "Approval Queue",
        rows: [
          { label: "Domain", value: domainForAction(approval.action_id) },
          { label: "Target", value: approval.target_label || approval.entity_id },
          { label: "Detector", value: approval.detector_id },
          { label: "Reason", value: approval.reason },
          { label: "Verification", value: approval.verification ? `${approval.verification.state} -- ${approval.verification.summary}` : "Not recorded" },
          { label: "Time", value: dateLabel(approval.executed_at || approval.decided_at) },
        ],
      });
    }
    for (const rule of failedRules) {
      rows.push({
        id: `rule:${rule.id}`,
        automation: rule.name,
        domain: "Assets",
        target: actionSummary(rule),
        stage: String(rule.last_run_status).replace(/_/g, " "),
        reason: "Automation run failed or partially succeeded.",
        time: rule.last_run_at || rule.updated_at || rule.created_at,
        source: "Custom Automation",
        rows: [
          { label: "Action", value: actionSummary(rule) },
          { label: "Trigger", value: triggerSummary(rule.trigger) },
          { label: "Last run status", value: String(rule.last_run_status).replace(/_/g, " ") },
          { label: "Last run", value: dateLabel(rule.last_run_at) },
        ],
      });
    }
    for (const exec of failedExecutions) {
      rows.push({
        id: `execution:${exec.executionId}`,
        automation: exec.automationReference || exec.action.replace(/[._]/g, " "),
        domain: exec.origin || "—",
        target: executionTargetLabel(exec),
        stage: exec.status,
        reason: exec.triggerReason || "Execution failed.",
        time: exec.completedAt || exec.startedAt || exec.requestedAt,
        source: "Oyi Core",
        rows: [
          { label: "Action", value: exec.action.replace(/[._]/g, " ") },
          { label: "Target", value: executionTargetLabel(exec) },
          { label: "Trigger", value: exec.triggerReason || "—" },
          { label: "Initiator", value: executionInitiatorLabel(exec) },
          { label: "Started", value: dateLabel(exec.startedAt) },
          { label: "Completed", value: dateLabel(exec.completedAt) },
        ],
      });
    }
    return rows.sort((a, b) => new Date(b.time || 0).getTime() - new Date(a.time || 0).getTime());
  }, [failedApprovals, failedRules, failedExecutions]);

  const filtered = useMemo(() => {
    let rows = combined;
    if (sourceFilter === "approvals") rows = rows.filter((r) => r.source === "Approval Queue");
    if (sourceFilter === "custom") rows = rows.filter((r) => r.source === "Custom Automation");
    if (sourceFilter === "executions") rows = rows.filter((r) => r.source === "Oyi Core");
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((r) => r.automation.toLowerCase().includes(query) || r.target.toLowerCase().includes(query));
  }, [combined, sourceFilter, search]);

  return (
    <Registry title="Failures" subtitle="Execution or verification failures across every real automation source. Each is audited.">
      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search failures…" />
        <div className="flex flex-wrap gap-1.5">
          <Chip active={sourceFilter === "all"} onClick={() => setSourceFilter("all")}>All sources</Chip>
          <Chip active={sourceFilter === "approvals"} onClick={() => setSourceFilter("approvals")}>Approval Queue</Chip>
          <Chip active={sourceFilter === "custom"} onClick={() => setSourceFilter("custom")}>Custom Automation</Chip>
          <Chip active={sourceFilter === "executions"} onClick={() => setSourceFilter("executions")}>Oyi Core</Chip>
        </div>
      </FilterBar>
      <Table columns={["Automation", "Domain", "Target", "Failure stage", "Reason", "Time", "Source", "Actions"]} minWidth={960}>
        {filtered.map((row) => (
          <Row key={row.id} onClick={() => onInspect({ title: row.automation, subtitle: row.reason, rows: row.rows })}>
            <Cell className="text-zinc-100">{row.automation}</Cell>
            <Cell className="text-zinc-500">{row.domain}</Cell>
            <Cell className="text-zinc-400">{row.target}</Cell>
            <Cell><OisStatusBadge status="critical" label={row.stage} /></Cell>
            <Cell className="max-w-[220px] truncate text-zinc-400">{row.reason}</Cell>
            <Cell className="text-zinc-500">{dateLabel(row.time)}</Cell>
            <Cell className="text-zinc-600">{row.source}</Cell>
            <Cell>
              <button type="button" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-sky-200 hover:bg-white/5" onClick={(event) => { event.stopPropagation(); onInspect({ title: row.automation, subtitle: row.reason, rows: row.rows }); }}>
                <AlertTriangle className="h-3 w-3" />Review
              </button>
            </Cell>
          </Row>
        ))}
        {!filtered.length ? <EmptyRow colSpan={8} text={loading ? "Loading…" : "No failed executions."} /> : null}
      </Table>
    </Registry>
  );
}

// ---------------------------
// HISTORY TAB
// ---------------------------
type HistoryRow = { id: string; timestamp: string; automation: string; event: string; actor: string; target: string; result: string; source: string; rows: Array<{ label: string; value: React.ReactNode }> };

function HistoryTab({ historyApprovals, executions, loading, onInspect }: {
  historyApprovals: AutomationApproval[];
  executions: ExecutionRecord[];
  loading: boolean;
  onInspect: (payload: { title: string; subtitle?: string; rows: Array<{ label: string; value: React.ReactNode }> }) => void;
}) {
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "approvals" | "executions">("all");

  const combined = useMemo<HistoryRow[]>(() => {
    const rows: HistoryRow[] = [];
    for (const item of historyApprovals) {
      rows.push({
        id: `approval:${item.id}`,
        timestamp: item.decided_at || item.created_at,
        automation: actionLabel(item.action_id),
        event: item.status.replace(/_/g, " "),
        actor: item.approver_role || item.requested_by,
        target: item.target_label || item.entity_id,
        result: item.status,
        source: "Approval Queue",
        rows: [
          { label: "Action", value: actionLabel(item.action_id) },
          { label: "Target", value: item.target_label || item.entity_id },
          { label: "Actor", value: item.approver_role || item.requested_by },
          { label: "Decision note", value: item.decision_note || item.reason },
          { label: "Status", value: <OisStatusBadge status={approvalStatusTone(item.status)} label={item.status.replace(/_/g, " ")} /> },
          { label: "Decided", value: dateLabel(item.decided_at) },
        ],
      });
    }
    for (const exec of executions) {
      rows.push({
        id: `execution:${exec.executionId}`,
        timestamp: exec.completedAt || exec.startedAt || exec.requestedAt,
        automation: exec.automationReference || "—",
        event: exec.action.replace(/[._]/g, " "),
        actor: executionInitiatorLabel(exec),
        target: executionTargetLabel(exec),
        result: exec.status,
        source: "Oyi Core",
        rows: [
          { label: "Action", value: exec.action.replace(/[._]/g, " ") },
          { label: "Automation", value: exec.automationReference || "Not automation-originated" },
          { label: "Target", value: executionTargetLabel(exec) },
          { label: "Initiator", value: executionInitiatorLabel(exec) },
          { label: "Status", value: <OisStatusBadge status={executionStatusTone(exec.status)} label={exec.status.replace(/_/g, " ")} /> },
          { label: "Requested", value: dateLabel(exec.requestedAt) },
          { label: "Completed", value: dateLabel(exec.completedAt) },
        ],
      });
    }
    return rows.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
  }, [historyApprovals, executions]);

  const filtered = useMemo(() => {
    let rows = combined;
    if (sourceFilter === "approvals") rows = rows.filter((r) => r.source === "Approval Queue");
    if (sourceFilter === "executions") rows = rows.filter((r) => r.source === "Oyi Core");
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((r) => r.automation.toLowerCase().includes(query) || r.actor.toLowerCase().includes(query) || r.target.toLowerCase().includes(query));
  }, [combined, sourceFilter, search]);

  return (
    <Registry title="History" subtitle="Broad automation lifecycle and execution activity -- not limited to automations created in this workspace.">
      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search history…" />
        <div className="flex flex-wrap gap-1.5">
          <Chip active={sourceFilter === "all"} onClick={() => setSourceFilter("all")}>All sources</Chip>
          <Chip active={sourceFilter === "approvals"} onClick={() => setSourceFilter("approvals")}>Approval Queue</Chip>
          <Chip active={sourceFilter === "executions"} onClick={() => setSourceFilter("executions")}>Oyi Core</Chip>
        </div>
      </FilterBar>
      <Table columns={["Timestamp", "Automation", "Event", "Actor", "Target", "Result", "Source"]} minWidth={880}>
        {filtered.map((row) => (
          <Row key={row.id} onClick={() => onInspect({ title: row.event, subtitle: row.automation, rows: row.rows })}>
            <Cell className="whitespace-nowrap text-zinc-500">{dateLabel(row.timestamp)}</Cell>
            <Cell className="text-zinc-100">{row.automation}</Cell>
            <Cell className="capitalize text-zinc-400">{row.event}</Cell>
            <Cell className="text-zinc-500">{row.actor}</Cell>
            <Cell className="text-zinc-400">{row.target}</Cell>
            <Cell><OisStatusBadge status={approvalStatusTone(row.result) === "attention" ? executionStatusTone(row.result) : approvalStatusTone(row.result)} label={row.result.replace(/_/g, " ")} /></Cell>
            <Cell className="text-zinc-600">{row.source}</Cell>
          </Row>
        ))}
        {!filtered.length ? <EmptyRow colSpan={7} text={loading ? "Loading…" : "No history recorded yet."} /> : null}
      </Table>
    </Registry>
  );
}

// ---------------------------
// CREATE AUTOMATION BUILDER
// Trigger -> Action -> Execution -> Review. Assets/Device domain only
// this pass (see the file header comment for why). Calls the real
// POST/PATCH /scenes/automations contract. `template` prefills the form
// from an existing rule for Duplicate without editing it (Save always
// calls create() when editingRule is null).
// ---------------------------
type BuilderStep = "trigger" | "action" | "execution" | "review";
const BUILDER_STEPS: Array<{ key: BuilderStep; label: string }> = [
  { key: "trigger", label: "Trigger" },
  { key: "action", label: "Action" },
  { key: "execution", label: "Execution" },
  { key: "review", label: "Review" },
];

function AutomationBuilder({ open, onClose, devices, editingRule, template, onSaved }: { open: boolean; onClose: () => void; devices: InfrastructureDevice[]; editingRule: AutomationRule | null; template: AutomationRule | null; onSaved: () => void }) {
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
    const source = editingRule || template;
    if (source) {
      setName(editingRule ? source.name : `${source.name} (copy)`);
      setEnabled(editingRule ? source.enabled : true);
      const t = source.trigger;
      setScheduleType(t.schedule_type);
      if (t.schedule_type === "daily" || t.schedule_type === "weekdays") setLocalTime(t.local_time);
      if (t.schedule_type === "weekdays") setWeekdays(t.weekdays);
      if (t.schedule_type === "once") setLocalDatetime(t.local_datetime);
      const firstAction = source.actions?.[0];
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
  }, [open, editingRule, template]);

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
      title={editingRule ? "Edit Automation" : template ? "Duplicate Automation" : "Create Automation"}
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
