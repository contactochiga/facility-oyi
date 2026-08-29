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
import { facilityService, type AutomationApproval, type AutomationActionPolicy, type InfrastructureDevice, type AutomationCapabilitiesResponse, type AutomationCapabilityAction, type EstateMembershipRow } from "@/services/facilityService";
import { automationRulesService, type AutomationRule, type AutomationRuleAction, type AutomationScheduleTrigger, type AutomationRuleRun, isRegisteredAction } from "@/services/automationRulesService";
import { loadAutomationPlans } from "@/services/safeAutomationService";
import { loadOyiCoreExecutionHistory, loadOyiCoreExecutionStatistics } from "@/services/oyiCoreRuntimeService";
import type { AutomationPlan } from "@/lib/safeAutomationRuntime";
import { visitorService, type VisitorItem } from "@/services/visitorService";
import { maintenanceService, type MaintenanceItem } from "@/services/maintenanceService";

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
  "maintenance.create": "Create work order",
  "device.on": "Turn device on",
  "device.off": "Turn device off",
  "device.toggle": "Toggle device",
  "notification.notify": "Send notification",
  "community.approve": "Approve community post",
  "community.reject": "Reject community post",
  "community.post_announcement": "Post announcement",
  "service.assign": "Assign service",
  "service.complete": "Complete service",
  "wallet.approve": "Approve wallet transaction",
  "wallet.cancel": "Cancel wallet transaction",
};
function actionLabel(actionId: string) {
  return ACTION_LABELS[actionId] || actionId.replace(/[._]/g, " ");
}
// Cross-Domain Operational Automation -- mirrors EXECUTION_REGISTRY's own
// domain grouping (intelligence-core/executionRegistry.ts), the single
// canonical source. Kept as a static fallback for labels used before the
// capability registry has loaded (e.g. system detectors' fixed action
// ids), not a second source of truth for anything the registry itself
// answers.
function domainForAction(actionId: string) {
  if (actionId.startsWith("visitor.")) return "Access";
  if (actionId.startsWith("maintenance.")) return "Maintenance";
  if (actionId.startsWith("device.")) return "Assets";
  if (actionId.startsWith("notification.")) return "Notifications";
  if (actionId.startsWith("community.")) return "Community";
  if (actionId.startsWith("service.")) return "Services";
  if (actionId.startsWith("wallet.")) return "Finance";
  return actionId.split(".")[0] || "General";
}

// AutomationPlan (Oyi Core's recommendation vocabulary) uses different
// domain strings than the capability registry's real EXECUTION_REGISTRY
// domains. Only a best-effort UI convenience for pre-selecting a domain
// in the builder -- domains with no real executable capability fall back
// to "notifications" (the one action that's honestly always applicable:
// tell someone about this) rather than a domain that would show nothing
// but unavailable actions.
const PLAN_DOMAIN_TO_CAPABILITY_DOMAIN: Record<string, string> = {
  infrastructure: "devices",
  maintenance: "maintenance",
  visitor: "visitors",
  environmental: "devices",
  community: "community",
  financial: "notifications",
  security: "notifications",
  utility: "notifications",
  operational_governance: "notifications",
  executive: "notifications",
};

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
  if (isRegisteredAction(first)) {
    if (first.action_id === "notification.notify") {
      const command = (first.command || {}) as { target?: string; target_value?: string; title?: string };
      return `Notify ${command.target || "target"}${command.target_value ? ` (${command.target_value})` : ""} -- ${command.title || "notification"}`;
    }
    return `${actionLabel(first.action_id)}${first.label ? ` -- ${first.label}` : ""}`;
  }
  const control = String(first.command?.action || Object.values(first.command || {})[0] || "run");
  const label = first.label || first.action_label || "device";
  return `${String(control).replace(/_/g, " ")} -- ${label}`;
}
function ruleDomain(rule: AutomationRule) {
  const first = rule.actions?.[0];
  if (first && isRegisteredAction(first)) return domainForAction(first.action_id);
  return "Assets";
}
// Cross-Domain Operational Automation -- device_command actions have
// always executed directly (no registered_action bypass risk, unchanged
// this pass), so "Automatic" is accurate for them without a lookup.
// registered_action rules (visitor/maintenance/notification) are now
// governed the same way system detectors are -- this reads the real
// resolved execution level from the same /facility/automation/policy
// data Governance already shows, instead of a hardcoded label that would
// be wrong for anything approval_required.
function ruleModeBadge(rule: AutomationRule, policy: AutomationActionPolicy[]) {
  const first = rule.actions?.[0];
  if (first && isRegisteredAction(first)) {
    const match = policy.find((p) => p.actionId === first.action_id);
    const level = match?.executionLevel || "approval_required";
    const label = level === "auto_allowed" ? "Automatic" : level.replace(/_/g, " ");
    const status: OisStatus = level === "auto_allowed" ? "stable" : level === "approval_required" ? "attention" : "unavailable";
    return <OisStatusBadge status={status} label={label} />;
  }
  return <OisStatusBadge status="stable" label="Automatic" />;
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
  const [capabilities, setCapabilities] = useState<AutomationCapabilitiesResponse | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [duplicateTemplate, setDuplicateTemplate] = useState<AutomationRule | null>(null);
  const [builderPrefill, setBuilderPrefill] = useState<{ name: string; domain: string } | null>(null);
  const [runsSelectedRuleId, setRunsSelectedRuleId] = useState<string>("");
  const [inspect, setInspect] = useState<{ title: string; subtitle?: string; rows: Array<{ label: string; value: React.ReactNode }> } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [plansResult, approvalsResult, policyResult, historyResult, statsResult, rulesResult, infraResult, capabilitiesResult] = await Promise.all([
        loadAutomationPlans().catch(() => []),
        facilityService.automationApprovals().catch(() => ({ estate_id: "", approvals: [] })),
        facilityService.automationPolicy().catch(() => ({ estate_id: "", policy: [] })),
        loadOyiCoreExecutionHistory({ limit: 50 }).catch(() => []),
        loadOyiCoreExecutionStatistics({ limit: 200 }).catch(() => null),
        automationRulesService.list(),
        facilityService.infrastructureOperations().catch(() => null),
        facilityService.automationCapabilities().catch(() => null),
      ]);
      setPlans(plansResult);
      setApprovals(approvalsResult.approvals || []);
      setPolicy(policyResult.policy || []);
      setExecutionHistory((historyResult as ExecutionRecord[]) || []);
      setExecutionStats(statsResult);
      setRules(rulesResult.automations);
      setRulesAvailable(rulesResult.available);
      setDevices(infraResult?.registry || []);
      setCapabilities(capabilitiesResult);
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

  function openCreate() { setEditingRule(null); setDuplicateTemplate(null); setBuilderPrefill(null); setBuilderOpen(true); }
  function openEdit(rule: AutomationRule) { setEditingRule(rule); setDuplicateTemplate(null); setBuilderPrefill(null); setBuilderOpen(true); }
  function openDuplicate(rule: AutomationRule) { setEditingRule(null); setDuplicateTemplate(rule); setBuilderPrefill(null); setBuilderOpen(true); }
  function openRuns(rule: AutomationRule) { setRunsSelectedRuleId(rule.id); setTab("runs"); }
  // Section 10 (Recommendation -> Automation): AutomationPlan's actionType
  // vocabulary is abstract/advisory and cannot be safely auto-mapped onto
  // a concrete registered action -- documented directly in
  // facilityAutomationService.ts's own file header as a deliberate,
  // permanent design boundary, not a gap to paper over. So this prefills
  // only what's honestly derivable (a name, and a best-effort domain
  // guess) and always opens the same real builder for the operator to
  // complete -- it never claims the trigger/action were already decided.
  function openCreateFromRecommendation(plan: AutomationPlan) {
    setEditingRule(null);
    setDuplicateTemplate(null);
    setBuilderPrefill({ name: plan.title.slice(0, 80), domain: PLAN_DOMAIN_TO_CAPABILITY_DOMAIN[plan.domain] || "notifications" });
    setBuilderOpen(true);
  }

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
                    <Cell><p className="text-zinc-100">{rule.name}</p><span className="mt-1 inline-block rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-zinc-500">{ruleDomain(rule)}</span></Cell>
                    <Cell className="text-zinc-500">{triggerSummary(rule.trigger)}</Cell>
                    <Cell className="text-zinc-400">{actionSummary(rule)}</Cell>
                    <Cell>{ruleModeBadge(rule, policy)}</Cell>
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

      {tab === "active" ? <ActiveAutomationsTab rules={rules} policy={policy} rulesAvailable={rulesAvailable} loading={loading} onCreate={openCreate} ruleControlsFor={ruleControlsFor} /> : null}
      {tab === "recommendations" ? <RecommendationsTab plans={visiblePlans} loading={loading} onDismiss={(id) => setDismissedPlanIds((prev) => new Set(prev).add(id))} onInspect={setInspect} onCreateAutomation={openCreateFromRecommendation} /> : null}
      {tab === "approvals" ? <ApprovalsTab approvals={approvals} pending={pendingApprovals} loading={loading} busyId={busyId} onDecide={decide} onInspect={setInspect} /> : null}
      {tab === "runs" ? <RunsTab runsApprovals={runsApprovals} executions={executionHistory} rules={rules} selectedRuleId={runsSelectedRuleId} onSelectRule={setRunsSelectedRuleId} loading={loading} onInspect={setInspect} /> : null}
      {tab === "failures" ? <FailuresTab failedApprovals={failedApprovals} failedRules={failedRuleRows} failedExecutions={failedExecutions} loading={loading} onInspect={setInspect} /> : null}
      {tab === "history" ? <HistoryTab historyApprovals={historyApprovals} executions={executionHistory} loading={loading} onInspect={setInspect} /> : null}

      <AutomationBuilder
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        devices={devices}
        capabilities={capabilities}
        editingRule={editingRule}
        template={duplicateTemplate}
        prefill={builderPrefill}
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

function ActiveAutomationsTab({ rules, policy, rulesAvailable, loading, onCreate, ruleControlsFor }: {
  rules: AutomationRule[];
  policy: AutomationActionPolicy[];
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
              <Cell className="text-zinc-500">{ruleDomain(rule)}</Cell>
              <Cell className="text-zinc-500">{triggerSummary(rule.trigger)}</Cell>
              <Cell className="text-zinc-400">{actionSummary(rule)}</Cell>
              <Cell>{ruleModeBadge(rule, policy)}</Cell>
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
function RecommendationsTab({ plans, loading, onDismiss, onInspect, onCreateAutomation }: {
  plans: AutomationPlan[];
  loading: boolean;
  onDismiss: (id: string) => void;
  onInspect: (payload: { title: string; subtitle?: string; rows: Array<{ label: string; value: React.ReactNode }> }) => void;
  onCreateAutomation: (plan: AutomationPlan) => void;
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
                <button type="button" title="Prefills the builder's name and domain -- you still choose the real trigger and action" className="rounded-md px-2 py-1 text-[11px] text-emerald-300 hover:bg-white/5" onClick={() => onCreateAutomation(plan)}>Create Automation</button>
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
      subtitle: approval.target_label || approval.entity_id || undefined,
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
        target: approval.target_label || approval.entity_id || "Not entity-scoped",
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
        target: item.target_label || item.entity_id || "Not entity-scoped",
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
// CREATE AUTOMATION BUILDER (Cross-Domain Operational Automation)
// Basics -> Trigger -> Action -> Execution & Governance -> Review.
// Domain-generated from the real capability registry (GET
// /facility/automation/capabilities -- a projection of
// EXECUTION_REGISTRY + automationPolicyResolver, not a second,
// independently-maintained domain list). Trigger stays schedule-only,
// disclosed -- no condition/event/threshold trigger engine exists
// anywhere in the platform yet. Calls the real POST/PATCH
// /scenes/automations contract; every registered_action item is now
// policy-checked server-side on every run (see scenes.ts's
// executeConsumerAutomation), so exposing Access/Maintenance/
// Notifications here no longer bypasses governance the way it would
// have before this pass. `template` prefills the form from an existing
// rule for Duplicate without editing it (Save always calls create()
// when editingRule is null). `prefill` seeds name/domain only, from an
// eligible recommendation -- never the action itself (see Section 10's
// documented gap in facilityAutomationService.ts).
// ---------------------------
type BuilderStep = "basics" | "trigger" | "action" | "execution" | "review";
const BUILDER_STEPS: Array<{ key: BuilderStep; label: string }> = [
  { key: "basics", label: "Basics" },
  { key: "trigger", label: "Trigger" },
  { key: "action", label: "Action" },
  { key: "execution", label: "Execution" },
  { key: "review", label: "Review" },
];
const NOTIFY_ROLES = ["admin", "manager", "operator", "security", "staff"];

function AutomationBuilder({ open, onClose, devices, capabilities, editingRule, template, prefill, onSaved }: {
  open: boolean;
  onClose: () => void;
  devices: InfrastructureDevice[];
  capabilities: AutomationCapabilitiesResponse | null;
  editingRule: AutomationRule | null;
  template: AutomationRule | null;
  prefill: { name: string; domain: string } | null;
  onSaved: () => void;
}) {
  const [step, setStep] = useState<BuilderStep>("basics");
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [actionId, setActionId] = useState("");
  const [scheduleType, setScheduleType] = useState<"daily" | "weekdays" | "once">("daily");
  const [localTime, setLocalTime] = useState("09:00");
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [localDatetime, setLocalDatetime] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [control, setControl] = useState("");
  const [visitorEntityId, setVisitorEntityId] = useState("");
  const [maintenanceEntityId, setMaintenanceEntityId] = useState("");
  const [assignee, setAssignee] = useState("");
  const [notifyTarget, setNotifyTarget] = useState<"role" | "user" | "home" | "estate">("role");
  const [notifyTargetValue, setNotifyTargetValue] = useState("");
  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyMessage, setNotifyMessage] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Lazy, on-demand entity lists -- only fetched once the builder is
  // open and the operator has actually picked a domain that needs them,
  // reusing the exact same real list calls the Access/Maintenance/Team
  // pages already use, not a new endpoint.
  const [visitors, setVisitors] = useState<VisitorItem[] | null>(null);
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceItem[] | null>(null);
  const [estateUsers, setEstateUsers] = useState<EstateMembershipRow[] | null>(null);

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
      if (firstAction && isRegisteredAction(firstAction)) {
        setDomain(domainCapabilityKey(firstAction.action_id));
        setActionId(firstAction.action_id);
        setDeviceId("");
        setControl("");
        setVisitorEntityId(firstAction.action_id.startsWith("visitor.") ? firstAction.entity_id || "" : "");
        setMaintenanceEntityId(firstAction.action_id.startsWith("maintenance.") ? firstAction.entity_id || "" : "");
        setAssignee(firstAction.assignee || "");
        if (firstAction.action_id === "notification.notify") {
          const command = (firstAction.command || {}) as { target?: string; target_value?: string; title?: string; message?: string };
          setNotifyTarget((command.target as any) || "role");
          setNotifyTargetValue(command.target_value || "");
          setNotifyTitle(command.title || "");
          setNotifyMessage(command.message || "");
        } else {
          setNotifyTargetValue(""); setNotifyTitle(""); setNotifyMessage("");
        }
      } else {
        setDomain("devices");
        setActionId("");
        setDeviceId(firstAction?.device_id || "");
        setControl(String(firstAction?.command?.action || ""));
        setVisitorEntityId(""); setMaintenanceEntityId(""); setAssignee("");
        setNotifyTargetValue(""); setNotifyTitle(""); setNotifyMessage("");
      }
    } else {
      setName(prefill?.name || "");
      setDomain(prefill?.domain || "");
      setActionId("");
      setScheduleType("daily");
      setLocalTime("09:00");
      setWeekdays([1, 2, 3, 4, 5]);
      setLocalDatetime("");
      setDeviceId("");
      setControl("");
      setVisitorEntityId("");
      setMaintenanceEntityId("");
      setAssignee("");
      setNotifyTarget("role");
      setNotifyTargetValue("");
      setNotifyTitle("");
      setNotifyMessage("");
      setEnabled(true);
    }
    setStep("basics");
    setSaveError(null);
  }, [open, editingRule, template, prefill]);

  useEffect(() => {
    if (!open) return;
    if (domain === "visitors" && visitors === null) visitorService.list().then(setVisitors).catch(() => setVisitors([]));
    if (domain === "maintenance" && maintenanceRequests === null) maintenanceService.list().then(setMaintenanceRequests).catch(() => setMaintenanceRequests([]));
    if ((domain === "maintenance" || (domain === "notifications" && notifyTarget === "user")) && estateUsers === null) {
      facilityService.listEstateUsers().then((res) => setEstateUsers(res.users || [])).catch(() => setEstateUsers([]));
    }
  }, [open, domain, notifyTarget, visitors, maintenanceRequests, estateUsers]);

  function domainCapabilityKey(id: string) {
    if (id.startsWith("visitor.")) return "visitors";
    if (id.startsWith("maintenance.")) return "maintenance";
    if (id.startsWith("device.")) return "devices";
    if (id.startsWith("notification.")) return "notifications";
    return id.split(".")[0] || "";
  }

  const availableDomains = useMemo(
    () => (capabilities?.domains || []).filter((d) => d.actions.some((a) => a.available)),
    [capabilities]
  );
  const domainActions = useMemo(
    () => availableDomains.find((d) => d.domain === domain)?.actions.filter((a) => a.available) || [],
    [availableDomains, domain]
  );
  const selectedAction: AutomationCapabilityAction | null = domainActions.find((a) => a.id === actionId) || null;
  const device = devices.find((d) => d.id === deviceId) || null;
  const controls = device?.supported_controls || [];
  const stepIndex = BUILDER_STEPS.findIndex((s) => s.key === step);

  function selectDomain(nextDomain: string) {
    // Clear any action selected under the previous domain rather than
    // silently keeping a stale, invisible selection.
    setDomain(nextDomain);
    setActionId("");
  }

  function basicsValid() {
    return Boolean(name.trim() && domain);
  }
  function triggerValid() {
    if (scheduleType === "daily") return /^([01]\d|2[0-3]):([0-5]\d)$/.test(localTime);
    if (scheduleType === "weekdays") return /^([01]\d|2[0-3]):([0-5]\d)$/.test(localTime) && weekdays.length > 0;
    return /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):([0-5]\d)$/.test(localDatetime);
  }
  function actionValid() {
    if (!selectedAction) return false;
    if (selectedAction.target_type === "device") return Boolean(deviceId && control);
    if (selectedAction.target_type === "visitor_access") return Boolean(visitorEntityId);
    if (selectedAction.target_type === "maintenance_request") return Boolean(maintenanceEntityId) && (!selectedAction.requires_assignee || Boolean(assignee));
    if (selectedAction.target_type === "notification_target") return Boolean(notifyTitle.trim() && notifyMessage.trim() && (notifyTarget === "estate" || notifyTargetValue.trim()));
    return true;
  }

  function buildTrigger(): AutomationScheduleTrigger {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Lagos";
    if (scheduleType === "daily") return { type: "schedule", schedule_type: "daily", local_time: localTime, timezone };
    if (scheduleType === "weekdays") return { type: "schedule", schedule_type: "weekdays", local_time: localTime, weekdays, timezone };
    return { type: "schedule", schedule_type: "once", local_datetime: localDatetime, timezone };
  }

  function buildActions(): AutomationRuleAction[] {
    if (!selectedAction) return [];
    if (selectedAction.target_type === "device") {
      return [{ device_id: deviceId, command: { action: control }, label: device?.name || null }];
    }
    if (selectedAction.target_type === "visitor_access") {
      const visitor = (visitors || []).find((v) => v.id === visitorEntityId) || null;
      return [{ action_type: "registered_action", action_id: selectedAction.id, entity_id: visitorEntityId, label: visitor?.visitor_name || null }];
    }
    if (selectedAction.target_type === "maintenance_request") {
      const request = (maintenanceRequests || []).find((r) => r.id === maintenanceEntityId) || null;
      return [{ action_type: "registered_action", action_id: selectedAction.id, entity_id: maintenanceEntityId, assignee: assignee || null, label: request?.title || null }];
    }
    if (selectedAction.target_type === "notification_target") {
      return [{
        action_type: "registered_action",
        action_id: "notification.notify",
        command: { target: notifyTarget, target_value: notifyTarget === "estate" ? null : notifyTargetValue, title: notifyTitle.trim(), message: notifyMessage.trim() },
        label: notifyTitle.trim() || null,
      }];
    }
    return [];
  }

  function reviewTargetLabel() {
    if (!selectedAction) return "No action configured";
    if (selectedAction.target_type === "device") return `${control ? control.replace(/_/g, " ") : "control"} -- ${device?.name || "device"}`;
    if (selectedAction.target_type === "visitor_access") {
      const visitor = (visitors || []).find((v) => v.id === visitorEntityId);
      return `${selectedAction.label} -- ${visitor?.visitor_name || "visitor"}`;
    }
    if (selectedAction.target_type === "maintenance_request") {
      const request = (maintenanceRequests || []).find((r) => r.id === maintenanceEntityId);
      const who = assignee ? (estateUsers || []).find((u) => u.users?.id === assignee)?.users?.full_name : null;
      return `${selectedAction.label} -- ${request?.title || "work order"}${who ? ` (assign to ${who})` : ""}`;
    }
    if (selectedAction.target_type === "notification_target") {
      const target = notifyTarget === "estate" ? "the whole estate" : notifyTarget === "role" ? `role: ${notifyTargetValue}` : notifyTarget === "user" ? (estateUsers || []).find((u) => u.users?.id === notifyTargetValue)?.users?.full_name || "a team member" : "a home";
      return `Notify ${target} -- "${notifyTitle || "untitled"}"`;
    }
    return selectedAction.label;
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        name: name.trim(),
        trigger: buildTrigger(),
        actions: buildActions(),
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
  const stepValid = step === "basics" ? basicsValid() : step === "trigger" ? triggerValid() : step === "action" ? actionValid() : true;

  return (
    <OisDrawer
      open={open}
      onClose={onClose}
      title={editingRule ? "Edit Automation" : template ? "Duplicate Automation" : "Create Automation"}
      subtitle="Built from real Facility capabilities -- what you see here is what Oyi can actually do."
      width="lg"
      footer={
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" disabled={stepIndex === 0} onClick={() => setStep(BUILDER_STEPS[Math.max(0, stepIndex - 1)].key)}>Back</Button>
          {step !== "review" ? (
            <Button disabled={!stepValid} onClick={() => setStep(BUILDER_STEPS[Math.min(BUILDER_STEPS.length - 1, stepIndex + 1)].key)}>Next</Button>
          ) : (
            <Button disabled={saving || !basicsValid() || !triggerValid() || !actionValid()} onClick={() => void save()}>{saving ? "Saving…" : editingRule ? "Save changes" : "Create automation"}</Button>
          )}
        </div>
      }
    >
      <div className="mb-5 flex gap-2">
        {BUILDER_STEPS.map((s, index) => (
          <div key={s.key} className={`flex-1 rounded-full px-2 py-1.5 text-center text-[10px] uppercase tracking-[0.06em] ${index <= stepIndex ? "bg-sky-500/15 text-sky-100" : "bg-white/5 text-zinc-600"}`}>{s.label}</div>
        ))}
      </div>

      {step === "basics" ? (
        <div className="space-y-4">
          <label className="block text-xs text-zinc-500">Automation name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Turn off lobby lights at midnight" className={`${inputClass} mt-1`} /></label>
          <div>
            <p className="text-xs text-zinc-500">Domain</p>
            <p className="mt-1 text-[11px] text-zinc-600">Only domains with a real, currently executable action are shown.</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {availableDomains.map((d) => (
                <button key={d.domain} type="button" onClick={() => selectDomain(d.domain)} className={`rounded-lg border px-3 py-2 text-xs ${domain === d.domain ? "border-sky-400/35 bg-sky-500/10 text-sky-100" : "border-white/10 bg-white/5 text-zinc-400"}`}>{d.label}</button>
              ))}
              {!availableDomains.length ? <p className="text-xs text-amber-300">No executable domains are available yet -- loading, or none configured.</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      {step === "trigger" ? (
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">When should this automation run? Only scheduled triggers are supported today, across every domain -- there is no condition/event/threshold trigger engine (e.g. tank level, camera offline) wired into the platform yet. System-managed detectors are the only event-driven automations that exist today.</p>
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
          <label className="block text-xs text-zinc-500">Action<select value={actionId} onChange={(e) => setActionId(e.target.value)} className={`${inputClass} mt-1`}>
            <option value="">Select an action…</option>
            {domainActions.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select></label>

          {selectedAction?.target_type === "device" ? (
            <>
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
            </>
          ) : null}

          {selectedAction?.target_type === "visitor_access" ? (
            <label className="block text-xs text-zinc-500">Visitor<select value={visitorEntityId} onChange={(e) => setVisitorEntityId(e.target.value)} className={`${inputClass} mt-1`}>
              <option value="">{visitors === null ? "Loading visitors…" : "Select a visitor…"}</option>
              {(visitors || []).map((v) => <option key={v.id} value={v.id}>{v.visitor_name} -- {v.status}</option>)}
            </select></label>
          ) : null}

          {selectedAction?.target_type === "maintenance_request" ? (
            <>
              <label className="block text-xs text-zinc-500">Work order<select value={maintenanceEntityId} onChange={(e) => setMaintenanceEntityId(e.target.value)} className={`${inputClass} mt-1`}>
                <option value="">{maintenanceRequests === null ? "Loading work orders…" : "Select a work order…"}</option>
                {(maintenanceRequests || []).map((m) => <option key={m.id} value={m.id}>{m.title} -- {m.status}</option>)}
              </select></label>
              {selectedAction.requires_assignee ? (
                <label className="block text-xs text-zinc-500">Assign to<select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={`${inputClass} mt-1`}>
                  <option value="">{estateUsers === null ? "Loading team…" : "Select a team member…"}</option>
                  {(estateUsers || []).map((u) => <option key={u.id} value={u.users?.id}>{u.users?.full_name || u.users?.email} -- {u.role}</option>)}
                </select></label>
              ) : null}
            </>
          ) : null}

          {selectedAction?.target_type === "notification_target" ? (
            <>
              <div>
                <p className="text-xs text-zinc-500">Notify</p>
                <div className="mt-1.5 flex gap-1.5">
                  {(["role", "user", "home", "estate"] as const).map((t) => (
                    <button key={t} type="button" onClick={() => { setNotifyTarget(t); setNotifyTargetValue(""); }} className={`rounded-lg border px-3 py-1.5 text-xs capitalize ${notifyTarget === t ? "border-sky-400/35 bg-sky-500/10 text-sky-100" : "border-white/10 bg-white/5 text-zinc-400"}`}>{t}</button>
                  ))}
                </div>
              </div>
              {notifyTarget === "role" ? (
                <label className="block text-xs text-zinc-500">Role<select value={notifyTargetValue} onChange={(e) => setNotifyTargetValue(e.target.value)} className={`${inputClass} mt-1`}>
                  <option value="">Select a role…</option>
                  {NOTIFY_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select></label>
              ) : null}
              {notifyTarget === "user" ? (
                <label className="block text-xs text-zinc-500">Team member<select value={notifyTargetValue} onChange={(e) => setNotifyTargetValue(e.target.value)} className={`${inputClass} mt-1`}>
                  <option value="">{estateUsers === null ? "Loading team…" : "Select a team member…"}</option>
                  {(estateUsers || []).map((u) => <option key={u.id} value={u.users?.id}>{u.users?.full_name || u.users?.email}</option>)}
                </select></label>
              ) : null}
              {notifyTarget === "home" ? (
                <label className="block text-xs text-zinc-500">Home ID<input value={notifyTargetValue} onChange={(e) => setNotifyTargetValue(e.target.value)} placeholder="Paste a home ID from Buildings" className={`${inputClass} mt-1`} /></label>
              ) : null}
              <label className="block text-xs text-zinc-500">Title<input value={notifyTitle} onChange={(e) => setNotifyTitle(e.target.value)} placeholder="e.g. Overnight lighting review" className={`${inputClass} mt-1`} /></label>
              <label className="block text-xs text-zinc-500">Message<textarea value={notifyMessage} onChange={(e) => setNotifyMessage(e.target.value)} rows={3} placeholder="What should the recipient know?" className={`${inputClass} mt-1`} /></label>
            </>
          ) : null}

          {!domainActions.length ? <p className="text-xs text-amber-300">No executable actions in this domain yet.</p> : null}
        </div>
      ) : null}

      {step === "execution" ? (
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">How may this action execute? This is resolved server-side by the same governance every approval and system detector already uses -- this screen only displays it.</p>
          {selectedAction ? (
            <OisCard variant="evidence" className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-white capitalize">{selectedAction.execution_level.replace(/_/g, " ")}</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    {selectedAction.execution_level === "auto_allowed"
                      ? "This action runs directly on schedule -- no separate approval step exists for it."
                      : selectedAction.execution_level === "approval_required"
                        ? "Each scheduled run will queue for operator approval in the Approvals tab instead of executing immediately."
                        : selectedAction.reason || "This action cannot currently execute."}
                  </p>
                  {selectedAction.required_permission ? <p className="mt-2 text-[11px] text-zinc-600">Requires permission: {selectedAction.required_permission}</p> : null}
                </div>
                <OisStatusBadge status={selectedAction.execution_level === "auto_allowed" ? "stable" : selectedAction.execution_level === "approval_required" ? "attention" : "unavailable"} label={selectedAction.execution_level.replace(/_/g, " ")} />
              </div>
            </OisCard>
          ) : (
            <p className="text-xs text-zinc-500">Choose an action first to see how it may execute.</p>
          )}
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
            <p className="mt-1 text-white">{reviewTargetLabel()}</p>
          </OisCard>
          <OisCard variant="evidence" className="p-4 text-sm">
            <p className="text-zinc-500">MODE</p>
            <p className="mt-1 capitalize text-white">{selectedAction ? selectedAction.execution_level.replace(/_/g, " ") : "—"} · {enabled ? "Enabled" : "Disabled"} on save</p>
          </OisCard>
          {saveError ? <p className="text-xs text-rose-300">{saveError}</p> : null}
        </div>
      ) : null}
    </OisDrawer>
  );
}
