import type { NormalizedSignal, SignalSeverity } from "@/lib/operationalSignal";
import type { OperationalRecommendation, RecommendationActionType } from "@/lib/operationalRecommendations";
import type { OperationalInsight } from "@/lib/operationalReasoning";
import type { OperationalAwareness, OperationalContext } from "@/services/contextAwarenessEngine";

export type AutomationDomain =
  | "infrastructure"
  | "security"
  | "maintenance"
  | "utility"
  | "environmental"
  | "visitor"
  | "financial"
  | "community"
  | "operational_governance"
  | "executive";

export type AutomationExecutionMode =
  | "suggest_only"
  | "prepare_workflow"
  | "request_approval"
  | "execute_safe";

export type AutomationPlanStatus = "planned" | "awaiting_approval" | "prepared" | "expired" | "cancelled";

export type AutomationPlan = {
  id: string;
  title: string;
  summary: string;
  domain: AutomationDomain;
  sourceRecommendationId: string;
  actionType: RecommendationActionType;
  actionIntent: string;
  targetEntity: {
    id?: string | null;
    type?: string | null;
    name?: string | null;
  };
  targetContext: {
    estate?: string | null;
    building?: string | null;
    room?: string | null;
    owner?: string | null;
  };
  owner: string;
  severity: SignalSeverity;
  confidence: number;
  approvalRequired: boolean;
  verificationRequired: boolean;
  safeToExecute: boolean;
  executionMode: AutomationExecutionMode;
  preconditions: string[];
  safetyChecks: string[];
  requiredPermissions: string[];
  rollbackPlan: string;
  auditReason: string;
  expectedOutcome: string;
  relatedSignals: string[];
  relatedAwareness: string[];
  relatedInsights: string[];
  relatedRecommendations: string[];
  status: AutomationPlanStatus;
  generatedAt: string;
  expiresAt: string;
  nextStep: string;
};

export type AutomationInput = {
  recommendations: OperationalRecommendation[];
  insights?: OperationalInsight[];
  awareness?: OperationalAwareness[];
  signals?: NormalizedSignal[];
  context?: OperationalContext;
  permissions?: string[];
  actor?: { id?: string | null; role?: string | null; name?: string | null };
  owner?: string | null;
  estateId?: string | null;
  generatedAt?: string;
};

type Candidate = Omit<AutomationPlan, "id" | "expiresAt" | "status"> & { entityKey: string };

function text(value: unknown, fallback = "") {
  const next = String(value ?? "").trim();
  return next || fallback;
}

function lower(value: unknown) {
  return text(value).toLowerCase();
}

function addHours(timestamp: string, hours: number) {
  return new Date(new Date(timestamp).getTime() + hours * 60 * 60 * 1000).toISOString();
}

function permissionsForAction(actionType: RecommendationActionType, domain: AutomationDomain) {
  if (domain === "financial") return ["wallets.manage"];
  if (domain === "security") return ["support.assign", "notifications.manage"];
  if (domain === "visitor") return ["visitors.manage"];
  if (domain === "maintenance") return ["support.assign"];
  if (domain === "infrastructure" || domain === "environmental" || domain === "utility") return ["devices.control"];
  if (domain === "community") return ["community.moderate"];
  if (domain === "operational_governance") return ["support.assign"];
  if (domain === "executive") return ["office.read"];
  return actionType === "request_operator_decision" ? ["support.assign"] : [];
}

function executionMode(
  recommendation: OperationalRecommendation,
  requiredPermissions: string[],
  inputPermissions: string[]
): AutomationExecutionMode {
  const hasPermissions = requiredPermissions.every((permission) => inputPermissions.includes(permission));
  if (recommendation.approvalRequired) return "request_approval";
  if (!hasPermissions) return "suggest_only";
  if (
    ["schedule_preventive_inspection", "escalate_overdue_issue", "verify_evidence", "assign_owner", "include_in_briefing", "prepare_management_review", "respond_to_complaints"].includes(recommendation.actionType)
  ) {
    return "prepare_workflow";
  }
  if (
    recommendation.actionType === "request_operator_decision" &&
    recommendation.domain === "operational_governance" &&
    !recommendation.approvalRequired &&
    !recommendation.safeToAutomate
  ) {
    return "execute_safe";
  }
  return "suggest_only";
}

function safeToExecute(mode: AutomationExecutionMode, recommendation: OperationalRecommendation) {
  if (mode !== "execute_safe") return false;
  if (recommendation.domain === "financial" || recommendation.domain === "security" || recommendation.domain === "visitor") return false;
  if (/access|lock|unlock|payment|financial|device/.test(lower(recommendation.actionType))) return false;
  return true;
}

function targetFrom(recommendation: OperationalRecommendation, signals: NormalizedSignal[]) {
  const signal = signals.find((item) => recommendation.relatedSignals.includes(item.id));
  return {
    targetEntity: {
      id: signal?.entity.id || null,
      type: signal?.entity.type || recommendation.domain,
      name: signal?.entity.name || recommendation.title,
    },
    targetContext: {
      estate: signal?.estate.id || null,
      building: signal?.building.id || null,
      room: signal?.room.id || null,
      owner: recommendation.owner || null,
    },
    entityKey: [
      recommendation.domain,
      lower(signal?.entity.id || signal?.entity.name || recommendation.title),
      lower(signal?.room.id || signal?.building.id || signal?.estate.id || "scope"),
    ].join(":"),
  };
}

function defaultPreconditions(recommendation: OperationalRecommendation, mode: AutomationExecutionMode) {
  const base = [
    "Recommendation remains active and unexpired.",
    "Supporting evidence is still available for operator review.",
  ];
  if (recommendation.verificationRequired) base.push("Verification evidence must be reviewed before closure.");
  if (mode === "prepare_workflow") base.push("A workflow-capable owner or queue must be available.");
  if (mode === "request_approval") base.push("An authorized operator must approve the action before any execution step.");
  if (mode === "execute_safe") base.push("All required permissions and safety checks must pass.");
  return base;
}

function safetyChecks(recommendation: OperationalRecommendation, mode: AutomationExecutionMode) {
  const checks = [
    "Do not bypass permissions or role boundaries.",
    "Do not auto-execute irreversible or resident-facing actions.",
  ];
  if (recommendation.domain === "security") checks.push("Never dispatch critical security action without explicit approval.");
  if (recommendation.domain === "financial") checks.push("Never execute financial follow-up automatically.");
  if (recommendation.domain === "visitor") checks.push("Never modify access permissions automatically.");
  if (["infrastructure", "environmental", "utility"].includes(recommendation.domain)) checks.push("Do not silently execute device control commands.");
  if (mode === "execute_safe") checks.push("Execution must remain low-risk, internal, and reversible.");
  return checks;
}

function rollbackPlan(mode: AutomationExecutionMode, recommendation: OperationalRecommendation) {
  if (mode === "prepare_workflow") return "Cancel the prepared workflow and return ownership to the originating operational queue.";
  if (mode === "request_approval") return "Reject the approval request and leave the recommendation in review state.";
  if (mode === "execute_safe") return "Cancel the internal automation task and reopen the recommendation for operator review.";
  return "No automated action is executed; cancel by closing the suggestion.";
}

function expectedOutcome(recommendation: OperationalRecommendation, mode: AutomationExecutionMode) {
  if (mode === "prepare_workflow") return `Prepare a safe workflow for: ${recommendation.recommendedAction}`;
  if (mode === "request_approval") return `Gather operator approval before proceeding with: ${recommendation.recommendedAction}`;
  if (mode === "execute_safe") return `Perform a low-risk internal automation step related to: ${recommendation.recommendedAction}`;
  return `Provide operator-ready guidance for: ${recommendation.recommendedAction}`;
}

function actionIntent(recommendation: OperationalRecommendation, mode: AutomationExecutionMode) {
  if (mode === "prepare_workflow") return "prepare_non_executing_workflow";
  if (mode === "request_approval") return "request_operator_approval";
  if (mode === "execute_safe") return "execute_internal_low_risk_step";
  return "suggest_next_action";
}

function candidateFromRecommendation(
  recommendation: OperationalRecommendation,
  signals: NormalizedSignal[],
  permissions: string[],
  generatedAt: string
): Candidate {
  const requiredPermissions = permissionsForAction(recommendation.actionType, recommendation.domain);
  const mode = executionMode(recommendation, requiredPermissions, permissions);
  const { targetEntity, targetContext, entityKey } = targetFrom(recommendation, signals);
  const safe = safeToExecute(mode, recommendation);
  return {
    title: `${recommendation.title} Automation Plan`,
    summary: `${recommendation.summary} This plan prepares the next step without bypassing approval or safety rules.`,
    domain: recommendation.domain,
    sourceRecommendationId: recommendation.id,
    actionType: recommendation.actionType,
    actionIntent: actionIntent(recommendation, mode),
    targetEntity,
    targetContext,
    owner: recommendation.owner || "Operational owner",
    severity: recommendation.severity,
    confidence: recommendation.confidence,
    approvalRequired: recommendation.approvalRequired,
    verificationRequired: recommendation.verificationRequired,
    safeToExecute: safe,
    executionMode: mode,
    preconditions: defaultPreconditions(recommendation, mode),
    safetyChecks: safetyChecks(recommendation, mode),
    requiredPermissions,
    rollbackPlan: rollbackPlan(mode, recommendation),
    auditReason: `${recommendation.reason} Recommendation ${recommendation.id} produced a ${mode} automation plan.`,
    expectedOutcome: expectedOutcome(recommendation, mode),
    relatedSignals: [...recommendation.relatedSignals],
    relatedAwareness: [...recommendation.relatedAwareness],
    relatedInsights: [...recommendation.relatedInsights],
    relatedRecommendations: [recommendation.id],
    generatedAt,
    nextStep:
      mode === "prepare_workflow"
        ? "Prepare the workflow and route it to the correct operator queue."
        : mode === "request_approval"
        ? "Request operator approval before any further action."
        : mode === "execute_safe"
        ? "Run the reversible internal step and retain the audit trail."
        : "Present the plan as guidance only.",
    entityKey,
  };
}

function withId(candidate: Candidate): AutomationPlan {
  const expiresAt = addHours(candidate.generatedAt, 24);
  return {
    id: `automation:${candidate.domain}:${candidate.entityKey}:${new Date(candidate.generatedAt).getTime()}`,
    ...candidate,
    expiresAt,
    status:
      candidate.executionMode === "request_approval"
        ? "awaiting_approval"
        : candidate.executionMode === "prepare_workflow"
        ? "prepared"
        : "planned",
  };
}

export function buildAutomationPlans(input: AutomationInput): AutomationPlan[] {
  const generatedAt = input.generatedAt || new Date().toISOString();
  const permissions = input.permissions || [];
  const signals = input.signals || [];
  const recommendations = input.recommendations || [];
  const unique = new Map<string, AutomationPlan>();

  for (const recommendation of recommendations) {
    const candidate = candidateFromRecommendation(recommendation, signals, permissions, generatedAt);
    const key = `${candidate.domain}:${candidate.entityKey}:${lower(candidate.actionType)}`;
    if (!unique.has(key)) unique.set(key, withId(candidate));
  }

  return [...unique.values()];
}
