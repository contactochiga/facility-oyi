import { facilityService } from "./facilityService";
import { awarenessFromFacilityAttention } from "@/services/signalAwarenessService";

export type AttentionSeverity = "critical" | "warning" | "info";
export type AttentionCategory =
  | "critical_incident"
  | "security_exception"
  | "escalated_workflow"
  | "verification_failure"
  | "critical_infrastructure_failure"
  | "high_confidence_prediction";

export type FacilityAttentionItem = {
  id: string;
  source_type: string;
  source_id: string;
  category: AttentionCategory;
  severity: AttentionSeverity;
  domain: string;
  title: string;
  detail: string;
  href: string;
  action: string;
  time?: string | null;
  escalation: "escalated" | "blocked" | "overdue" | "none";
  overdueMs: number;
  operationalImpact: number;
  confidence: number;
};

const closed = new Set(["closed", "completed", "resolved", "cancelled", "verified"]);
const categoryOrder: Record<AttentionCategory, number> = {
  critical_incident: 0,
  security_exception: 1,
  escalated_workflow: 2,
  verification_failure: 3,
  critical_infrastructure_failure: 4,
  high_confidence_prediction: 5,
};

const securityPattern = /security|access|intrusion|unauthori[sz]ed|tailgat|gate|door|badge|credential|lockdown|perimeter|panic|camera|surveillance/i;

function text(value: unknown) {
  return String(value || "").trim();
}

function lower(value: unknown) {
  return text(value).toLowerCase();
}

function unresolvedStatus(value: unknown) {
  return !closed.has(lower(value));
}

function parseTime(value?: string | null) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function overdueDuration(value?: string | null) {
  const dueAt = parseTime(value);
  if (!dueAt || dueAt >= Date.now()) return 0;
  return Date.now() - dueAt;
}

function severityLevel(value: unknown): AttentionSeverity {
  const next = lower(value);
  if (/critical|emergency|panic|fire/.test(next)) return "critical";
  if (/high|warning|failed|timeout|blocked|escalated|overdue|offline|error|unreachable|intrusion|security/.test(next)) return "warning";
  return "info";
}

function severityRank(value: AttentionSeverity) {
  return { critical: 0, warning: 1, info: 2 }[value];
}

function escalationRank(value: FacilityAttentionItem["escalation"]) {
  return { escalated: 0, blocked: 1, overdue: 2, none: 3 }[value];
}

function impactLevel(value: unknown) {
  const next = lower(value);
  if (/critical|severe|estate_wide|high/.test(next)) return 4;
  if (/medium|moderate/.test(next)) return 3;
  if (/low/.test(next)) return 2;
  return 1;
}

function normalizeConfidence(value: unknown) {
  if (typeof value === "number") return value;
  const next = lower(value);
  if (next === "confirmed") return 0.95;
  if (next === "likely" || next === "high") return 0.85;
  if (next === "possible" || next === "medium") return 0.65;
  return Number(value) || 0;
}

function verificationState(workflow: any) {
  const status = lower(workflow?.workflow_status || workflow?.status);
  const overdue = Boolean(
    workflow?.workflow_due_at &&
      parseTime(workflow.workflow_due_at) < Date.now() &&
      ["completed", "resolved"].includes(status)
  );
  const state = lower(
    workflow?.verification_state ||
      workflow?.metadata?.verification_state ||
      (["completed", "resolved"].includes(status) ? "pending" : "")
  );
  if (/failed|timeout/.test(state)) return "failed";
  if (/escalated/.test(state)) return "escalated";
  if (overdue || /overdue/.test(state)) return "overdue";
  if (/pending|required|awaiting/.test(state)) return "pending";
  return "not_required";
}

function incidentItems(incidents: any[]) {
  const items: FacilityAttentionItem[] = [];
  for (const row of incidents) {
    if (!unresolvedStatus(row?.status)) continue;
    const severity = lower(row?.severity);
    const source = `${row?.source || ""} ${row?.category || ""} ${row?.type || ""} ${row?.title || ""} ${row?.description || ""}`;
    if (/critical|emergency/.test(severity)) {
      items.push({
        id: `incident:${row.id}`,
        source_type: "incident",
        source_id: String(row.id),
        category: "critical_incident",
        severity: "critical",
        domain: "Incidents",
        title: row.title || "Critical incident",
        detail: row.description || row.source || "Immediate incident response is required.",
        href: "/alerts",
        action: row.assigned_to ? "Review incident response" : "Assign incident owner",
        time: row.created_at,
        escalation: lower(row?.status) === "escalated" ? "escalated" : "none",
        overdueMs: overdueDuration(row?.due_at || row?.sla_due_at),
        operationalImpact: 4,
        confidence: 0,
      });
      continue;
    }
    if (securityPattern.test(source)) {
      items.push({
        id: `incident:${row.id}:security`,
        source_type: "incident",
        source_id: String(row.id),
        category: "security_exception",
        severity: severityLevel(`${row?.severity} ${row?.status} security`),
        domain: "Security",
        title: row.title || "Security exception",
        detail: row.description || row.source || "Security review is required.",
        href: "/alerts",
        action: row.assigned_to ? "Review security response" : "Assign security owner",
        time: row.created_at,
        escalation: lower(row?.status) === "escalated" ? "escalated" : "none",
        overdueMs: overdueDuration(row?.due_at || row?.sla_due_at),
        operationalImpact: impactLevel(row?.impact || row?.operational_impact || row?.severity),
        confidence: 0,
      });
    }
  }
  return items;
}

function workflowItems(workflows: any[]) {
  const items: FacilityAttentionItem[] = [];
  for (const row of workflows) {
    const status = lower(row?.workflow_status || row?.status);
    if (!status || !unresolvedStatus(status)) continue;
    const dueMs = overdueDuration(row?.workflow_due_at);
    const priority = lower(row?.workflow_priority || row?.priority);
    const isEscalated = status === "escalated";
    const isBlocked = status === "blocked" || Boolean(text(row?.blocking_reason || row?.workflow_resolution));
    const isCriticalOverdue = dueMs > 0 && /critical/.test(priority);
    if (isEscalated || isBlocked || isCriticalOverdue) {
      items.push({
        id: `workflow:${row.id || row.workflow_id}`,
        source_type: "workflow",
        source_id: String(row.id || row.workflow_id),
        category: "escalated_workflow",
        severity: isEscalated || /critical/.test(priority) ? "critical" : "warning",
        domain: "Workflow",
        title: row.title || row.workflow_type || "Workflow requires ownership",
        detail:
          row.blocking_reason ||
          row.workflow_resolution ||
          (isCriticalOverdue
            ? "Critical workflow is overdue."
            : isEscalated
            ? "Workflow has been escalated."
            : "Workflow is blocked and needs intervention."),
        href: "/facility-intelligence?module=workflows",
        action: row.workflow_assignee ? "Review ownership and SLA" : "Assign workflow owner",
        time: row.updated_at || row.created_at,
        escalation: isEscalated ? "escalated" : isBlocked ? "blocked" : dueMs > 0 ? "overdue" : "none",
        overdueMs: dueMs,
        operationalImpact: impactLevel(row?.operational_impact || row?.impact || row?.workflow_priority),
        confidence: 0,
      });
    }
    const verification = verificationState(row);
    if (["failed", "escalated", "overdue"].includes(verification)) {
      items.push({
        id: `verification:${row.id || row.workflow_id}`,
        source_type: "workflow",
        source_id: String(row.id || row.workflow_id),
        category: "verification_failure",
        severity: verification === "failed" || verification === "escalated" ? "critical" : "warning",
        domain: "Verification",
        title: row.title || row.workflow_type || "Verification requires review",
        detail:
          verification === "failed"
            ? "Verification failed or timed out."
            : verification === "escalated"
            ? "Verification has been escalated."
            : "Verification is overdue.",
        href: "/facility-intelligence?module=workflows",
        action: verification === "failed" ? "Review failure evidence" : "Review verification",
        time: row.updated_at || row.verified_at || row.created_at,
        escalation: verification === "escalated" ? "escalated" : verification === "overdue" ? "overdue" : "none",
        overdueMs: verification === "overdue" ? dueMs : 0,
        operationalImpact: impactLevel(row?.operational_impact || row?.impact || row?.workflow_priority),
        confidence: 0,
      });
    }
  }
  return items;
}

function infrastructureItemFromRow(
  sourceType: string,
  row: any,
  options: { title: string; detail: string; href: string; status: string; action: string; time?: string | null }
): FacilityAttentionItem {
  return {
    id: `${sourceType}:${row?.id || row?.device_id || row?.camera_id || row?.node_id || row?.meter_id || row?.key || row?.name}`,
    source_type: sourceType,
    source_id: String(row?.id || row?.device_id || row?.camera_id || row?.node_id || row?.meter_id || row?.key || row?.name),
    category: "critical_infrastructure_failure" as const,
    severity: severityLevel(options.status),
    domain: "Infrastructure",
    title: options.title,
    detail: options.detail,
    href: options.href,
    action: options.action,
    time: options.time,
    escalation: /escalated/.test(lower(options.status)) ? "escalated" : "none",
    overdueMs: 0,
    operationalImpact: impactLevel(row?.impact || row?.operational_impact || row?.severity || options.status),
    confidence: 0,
  };
}

function infrastructureItems(infrastructure: any, utilities: any[], cameras: any[]) {
  const items: FacilityAttentionItem[] = [];
  const registry = Array.isArray(infrastructure?.registry) ? infrastructure.registry : [];
  const edgeNodes = Array.isArray(infrastructure?.edge_nodes) ? infrastructure.edge_nodes : [];
  const providers = Array.isArray(infrastructure?.providers) ? infrastructure.providers : [];
  const telemetry = Array.isArray(infrastructure?.telemetry) ? infrastructure.telemetry : [];

  for (const row of registry) {
    const status = lower(`${row?.status} ${row?.health} ${row?.severity}`);
    if (!/offline|error|failed|critical|unreachable|unavailable/.test(status)) continue;
    items.push(
      infrastructureItemFromRow("device", row, {
        title: row?.name || row?.device_name || "Infrastructure device failure",
        detail: row?.room?.name || row?.home?.name || "Device connectivity or health has failed.",
        href: "/hardware-devices",
        status,
        action: "Inspect device health",
        time: row?.updated_at || row?.last_seen_at || row?.created_at,
      })
    );
  }

  for (const row of edgeNodes) {
    const status = lower(`${row?.status} ${row?.sync_status} ${row?.severity}`);
    if (!/offline|error|failed|critical|unreachable|unavailable/.test(status)) continue;
    items.push(
      infrastructureItemFromRow("edge", row, {
        title: row?.name || row?.node_id || "Edge node failure",
        detail: "Runtime reachability or sync has failed.",
        href: "/hardware-devices?tab=edge",
        status,
        action: "Inspect edge runtime",
        time: row?.last_heartbeat_at || row?.updated_at || row?.created_at,
      })
    );
  }

  for (const row of providers) {
    const status = lower(`${row?.status} ${row?.sync_errors ? "failed" : ""}`);
    if (!/provider_error|disconnected|failed|critical/.test(status) && Number(row?.sync_errors || 0) <= 0) continue;
    items.push(
      infrastructureItemFromRow("provider", row, {
        title: row?.name || row?.key || "Provider integration failure",
        detail: "Provider synchronization is failing.",
        href: "/hardware-devices?tab=providers",
        status,
        action: "Review provider synchronization",
        time: row?.last_sync_at || row?.updated_at || null,
      })
    );
  }

  for (const row of telemetry) {
    const status = lower(`${row?.status} ${row?.health} ${row?.state} ${row?.severity}`);
    if (!/offline|error|failed|critical|outage|unavailable/.test(status)) continue;
    items.push(
      infrastructureItemFromRow("telemetry", row, {
        title: row?.affected || row?.name || row?.title || "Infrastructure telemetry failure",
        detail: row?.action || row?.message || "Critical telemetry failure requires review.",
        href: "/live-infrastructure",
        status,
        action: "Review telemetry failure",
        time: row?.time || row?.observed_at || row?.updated_at || row?.created_at,
      })
    );
  }

  for (const row of utilities) {
    const status = lower(`${row?.status} ${row?.health} ${row?.state} ${row?.severity}`);
    if (!/offline|error|failed|critical|outage|unavailable/.test(status)) continue;
    items.push(
      infrastructureItemFromRow("utility", row, {
        title: row?.name || row?.utility_type || "Utility failure",
        detail: "Critical utility telemetry requires review.",
        href: "/utilities",
        status,
        action: "Review utility status",
        time: row?.observed_at || row?.updated_at || row?.created_at,
      })
    );
  }

  for (const row of cameras) {
    const status = lower(`${row?.status} ${row?.health_state} ${row?.stream_state} ${row?.severity}`);
    if (!/offline|error|failed|critical|unavailable/.test(status)) continue;
    items.push(
      infrastructureItemFromRow("camera", row, {
        title: row?.name || row?.camera_name || row?.ip || "Camera failure",
        detail: "Camera stream or health has failed.",
        href: "/cameras",
        status,
        action: "Inspect camera evidence",
        time: row?.updated_at || row?.observed_at || row?.created_at,
      })
    );
  }

  return items;
}

function predictionItems(predictions: any[]) {
  const items: FacilityAttentionItem[] = [];
  for (const row of predictions) {
    const status = lower(row?.status || "open");
    const confidence = normalizeConfidence(row?.confidence ?? row?.metadata?.confidence_score);
    const impact = lower(row?.metadata?.impact || row?.impact || row?.metadata?.impact_summary);
    if (["acknowledged", "resolved", "closed", "inactive"].includes(status)) continue;
    if (confidence < 0.8) continue;
    if (!/high|critical/.test(impact)) continue;
    items.push({
      id: `prediction:${row.id}`,
      source_type: "prediction",
      source_id: String(row.id),
      category: "high_confidence_prediction",
      severity: /critical/.test(impact) || /critical/.test(lower(row?.severity)) ? "critical" : "warning",
      domain: "Predictions",
      title: row?.title || "High-confidence prediction",
      detail: row?.summary || row?.recommended_action || "Oyi flagged a high-confidence operational risk.",
      href: "/facility-intelligence?module=predictions",
      action: row?.recommended_action || "Review prediction evidence",
      time: row?.created_at,
      escalation: "none",
      overdueMs: 0,
      operationalImpact: impactLevel(impact),
      confidence,
    });
  }
  return items;
}

function compareAttention(a: FacilityAttentionItem, b: FacilityAttentionItem) {
  return (
    categoryOrder[a.category] - categoryOrder[b.category] ||
    severityRank(a.severity) - severityRank(b.severity) ||
    escalationRank(a.escalation) - escalationRank(b.escalation) ||
    b.overdueMs - a.overdueMs ||
    b.operationalImpact - a.operationalImpact ||
    b.confidence - a.confidence ||
    parseTime(b.time) - parseTime(a.time)
  );
}

function dedupeAndTrim(items: FacilityAttentionItem[]) {
  const unique = new Map<string, FacilityAttentionItem>();
  for (const item of [...items].sort(compareAttention)) {
    const key = `${item.source_type}:${item.source_id}`;
    if (!unique.has(key)) unique.set(key, item);
    if (unique.size >= 5) break;
  }
  return [...unique.values()];
}

export async function loadFacilityAttention(): Promise<FacilityAttentionItem[]> {
  const [incidents, workflows, predictions, infrastructure, utilities, cameras] = await Promise.all([
    facilityService.platformIncidents().catch(() => ({ items: [] })),
    facilityService.intelligenceWorkflows().catch(() => ({ workflows: [] })),
    facilityService.intelligencePredictions().catch(() => ({ predictions: [] })),
    facilityService.infrastructureOperations().catch(() => null),
    facilityService.platformUtilityTelemetry().catch(() => ({ items: [] })),
    facilityService.platformCameraInfrastructure().catch(() => ({ items: [] })),
  ]);

  return dedupeAndTrim([
    ...incidentItems(incidents.items || []),
    ...workflowItems(workflows.workflows || []),
    ...infrastructureItems(infrastructure, utilities.items || [], cameras.items || []),
    ...predictionItems(predictions.predictions || []),
  ]);
}

export async function loadFacilityAwareness() {
  return awarenessFromFacilityAttention(await loadFacilityAttention());
}
