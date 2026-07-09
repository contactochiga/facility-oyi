import type { NormalizedSignal, SignalEvidence, SignalSeverity } from "@/lib/operationalSignal";
import type { OperationalInsight } from "@/lib/operationalReasoning";
import type { OperationalAwareness, OperationalContext } from "@/services/contextAwarenessEngine";

export type OperationalRecommendationDomain =
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

export type RecommendationUrgency = "monitor" | "review" | "act" | "urgent";
export type RecommendationActionType =
  | "verify_power"
  | "verify_network"
  | "inspect_hardware"
  | "replace_device"
  | "review_access_event"
  | "check_camera_availability"
  | "escalate_security"
  | "assign_security_follow_up"
  | "create_maintenance_request"
  | "escalate_overdue_issue"
  | "schedule_preventive_inspection"
  | "verify_completed_work"
  | "review_energy_spike"
  | "inspect_water_anomaly"
  | "check_generator_state"
  | "investigate_leak_risk"
  | "restore_climate_device"
  | "inspect_environmental_sensor"
  | "verify_visitor_identity"
  | "check_access_policy"
  | "review_collection_drop"
  | "follow_up_outstanding_payment"
  | "review_financial_posture"
  | "respond_to_complaints"
  | "link_community_signal"
  | "assign_owner"
  | "verify_evidence"
  | "request_operator_decision"
  | "escalate_workflow"
  | "include_in_briefing"
  | "flag_portfolio_risk"
  | "prepare_management_review";

export type OperationalRecommendationStatus = "open" | "monitoring" | "expired" | "resolved";

export type OperationalRecommendation = {
  id: string;
  title: string;
  summary: string;
  domain: OperationalRecommendationDomain;
  severity: SignalSeverity;
  urgency: RecommendationUrgency;
  confidence: number;
  reason: string;
  recommendedAction: string;
  actionType: RecommendationActionType;
  owner: string;
  expectedImpact: string;
  estimatedBenefit: string;
  verificationRequired: boolean;
  approvalRequired: boolean;
  safeToAutomate: boolean;
  relatedSignals: string[];
  relatedAwareness: string[];
  relatedInsights: string[];
  supportingEvidence: SignalEvidence[];
  generatedAt: string;
  expiresAt: string;
  status: OperationalRecommendationStatus;
  nextStep: string;
  source: "operational_recommendation_runtime";
};

export type RecommendationInput = {
  signals?: NormalizedSignal[];
  awareness?: OperationalAwareness[];
  insights?: OperationalInsight[];
  context?: OperationalContext;
  severity?: SignalSeverity;
  confidence?: number;
  ownership?: string | null;
  verificationState?: string | null;
  policies?: Record<string, unknown> | null;
  attention?: Array<{ id?: string; title?: string; detail?: string; domain?: string; severity?: string; action?: string }>;
  generatedAt?: string;
};

type Candidate = Omit<OperationalRecommendation, "id" | "expiresAt" | "source" | "status"> & { entityKey: string };

function text(value: unknown, fallback = "") {
  const next = String(value ?? "").trim();
  return next || fallback;
}

function lower(value: unknown) {
  return text(value).toLowerCase();
}

function severityRank(value: SignalSeverity) {
  return { critical: 3, warning: 2, attention: 1, info: 0 }[value];
}

function urgencyFrom(value: SignalSeverity): RecommendationUrgency {
  if (value === "critical") return "urgent";
  if (value === "warning") return "act";
  if (value === "attention") return "review";
  return "monitor";
}

function confidence(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return 0.65;
  return Math.max(0, Math.min(1, valid.reduce((sum, value) => sum + value, 0) / valid.length));
}

function entityKey(insight: OperationalInsight, signals: NormalizedSignal[]) {
  const signal = signals.find((item) => insight.relatedSignals.includes(item.id));
  return [
    insight.domain,
    lower(signal?.entity.id || signal?.entity.name || insight.title),
    lower(signal?.room.id || signal?.building.id || signal?.estate.id || "scope"),
  ].join(":");
}

function mergeEvidence(insight: OperationalInsight, awareness: OperationalAwareness[], signals: NormalizedSignal[]) {
  const found = new Map<string, SignalEvidence>();
  for (const item of insight.evidence) {
    found.set(text(item.id || `${item.type}:${item.timestamp}`), item);
  }
  for (const item of awareness.filter((entry) => insight.relatedAwareness.includes(entry.id)).flatMap((entry) => entry.supporting_evidence)) {
    found.set(text(item.id || `${item.type}:${item.timestamp}`), item);
  }
  for (const item of signals.filter((entry) => insight.relatedSignals.includes(entry.id)).flatMap((entry) => entry.evidence)) {
    found.set(text(item.id || `${item.type}:${item.timestamp}`), item);
  }
  return [...found.values()].slice(0, 8);
}

function signalStatus(signals: NormalizedSignal[], insight: OperationalInsight) {
  const signal = signals.find((item) => insight.relatedSignals.includes(item.id));
  return lower(signal?.entity.status || signal?.metadata.status || signal?.metadata.state);
}

function approvalRequired(domain: OperationalRecommendationDomain, actionType: RecommendationActionType) {
  if (domain === "financial") return true;
  if (domain === "security" && !["review_access_event", "check_camera_availability", "assign_security_follow_up"].includes(actionType)) return true;
  if (["verify_visitor_identity", "check_access_policy"].includes(actionType)) return true;
  return false;
}

function safeToAutomate(actionType: RecommendationActionType, domain: OperationalRecommendationDomain) {
  if (domain === "financial" || domain === "security") return false;
  if (/create_maintenance_request|replace_device|request_operator_decision|escalate/.test(actionType)) return false;
  return false;
}

function candidateFromInsight(
  insight: OperationalInsight,
  signals: NormalizedSignal[],
  awareness: OperationalAwareness[],
  generatedAt: string
): Candidate | null {
  const relatedAwareness = awareness.filter((item) => insight.relatedAwareness.includes(item.id));
  const status = signalStatus(signals, insight);
  const owner = insight.owner || relatedAwareness.find((item) => text(item.owner))?.owner || "Operational owner";
  const shared = {
    severity: insight.severity,
    urgency: urgencyFrom(insight.severity),
    confidence: confidence([insight.confidence, ...relatedAwareness.map((item) => item.confidence)]),
    owner,
    relatedSignals: [...insight.relatedSignals],
    relatedAwareness: [...insight.relatedAwareness],
    relatedInsights: [insight.id],
    supportingEvidence: mergeEvidence(insight, awareness, signals),
    generatedAt,
    nextStep: insight.nextStep,
    entityKey: entityKey(insight, signals),
  };

  switch (insight.domain) {
    case "infrastructure":
      return {
        ...shared,
        title: "Inspect Infrastructure Reliability",
        summary: "Verify the affected device, power path, and network continuity before the issue degrades further.",
        domain: "infrastructure",
        reason: insight.reason,
        recommendedAction: /failed|error/.test(status) ? "Inspect failed hardware and verify adapter health." : "Verify power supply and network connectivity for the affected device.",
        actionType: /failed|error/.test(status) ? "inspect_hardware" : /offline|unreachable/.test(status) ? "verify_network" : "verify_power",
        expectedImpact: "Restores infrastructure continuity and reduces repeated command or telemetry failure.",
        estimatedBenefit: "Lower incident recurrence and faster device recovery.",
        verificationRequired: true,
        approvalRequired: false,
        safeToAutomate: safeToAutomate(/failed|error/.test(status) ? "inspect_hardware" : /offline|unreachable/.test(status) ? "verify_network" : "verify_power", "infrastructure"),
      };
    case "security":
      return {
        ...shared,
        title: "Review Security Exposure",
        summary: "Correlate access evidence with camera posture and confirm whether escalation is required.",
        domain: "security",
        reason: insight.reason,
        recommendedAction: /camera/.test(lower(insight.reason)) ? "Check camera availability and review the related access event." : "Review the access event and assign security follow-up.",
        actionType: /camera/.test(lower(insight.reason)) ? "check_camera_availability" : "review_access_event",
        expectedImpact: "Reduces unresolved exposure and strengthens evidence-backed response.",
        estimatedBenefit: "Faster confirmation of whether the signal is benign or requires escalation.",
        verificationRequired: true,
        approvalRequired: approvalRequired("security", /camera/.test(lower(insight.reason)) ? "check_camera_availability" : "review_access_event"),
        safeToAutomate: safeToAutomate(/camera/.test(lower(insight.reason)) ? "check_camera_availability" : "review_access_event", "security"),
      };
    case "maintenance":
      return {
        ...shared,
        title: "Schedule Maintenance Follow-up",
        summary: "Open a preventive or overdue maintenance review before service impact expands.",
        domain: "maintenance",
        reason: insight.reason,
        recommendedAction: /overdue|blocked|escalated/.test(status) ? "Escalate the overdue issue and verify ownership." : "Schedule a preventive inspection for the affected asset.",
        actionType: /overdue|blocked|escalated/.test(status) ? "escalate_overdue_issue" : "schedule_preventive_inspection",
        expectedImpact: "Reduces repeat failures and prevents backlog from becoming resident-facing disruption.",
        estimatedBenefit: "Improved SLA posture and more stable maintenance continuity.",
        verificationRequired: true,
        approvalRequired: false,
        safeToAutomate: false,
      };
    case "utility":
      return {
        ...shared,
        title: "Review Infrastructure Service Anomaly",
        summary: "Inspect the abnormal utility pattern and verify whether supply posture or metering is drifting.",
        domain: "utility",
        reason: insight.reason,
        recommendedAction: /water/.test(lower(insight.summary + insight.reason)) ? "Inspect the water usage anomaly and verify leak risk." : "Review the energy spike and check generator, solar, or load state.",
        actionType: /water/.test(lower(insight.summary + insight.reason)) ? "inspect_water_anomaly" : "review_energy_spike",
        expectedImpact: "Limits service disruption and prevents infrastructure issues from becoming continuity incidents.",
        estimatedBenefit: "Earlier anomaly detection and reduced operating cost risk.",
        verificationRequired: true,
        approvalRequired: false,
        safeToAutomate: false,
      };
    case "environmental":
      return {
        ...shared,
        title: "Stabilize Environmental Readiness",
        summary: "Review the affected climate or sensor condition before comfort or safety degrades.",
        domain: "environmental",
        reason: insight.reason,
        recommendedAction: /sensor/.test(lower(insight.summary + insight.reason)) ? "Inspect the environmental sensor and verify its readings." : "Restore the climate-related device serving the affected area.",
        actionType: /sensor/.test(lower(insight.summary + insight.reason)) ? "inspect_environmental_sensor" : "restore_climate_device",
        expectedImpact: "Protects occupant comfort and reduces prolonged environmental exposure.",
        estimatedBenefit: "Better comfort continuity and fewer false environmental incidents.",
        verificationRequired: true,
        approvalRequired: false,
        safeToAutomate: false,
      };
    case "visitor":
      return {
        ...shared,
        title: "Verify Visitor Access Pattern",
        summary: "Confirm visitor identity, access policy, and repeated denial context before the pattern escalates.",
        domain: "visitor",
        reason: insight.reason,
        recommendedAction: "Review repeated denials, verify visitor identity, and check the current access policy.",
        actionType: "verify_visitor_identity",
        expectedImpact: "Improves gate continuity without weakening access assurance.",
        estimatedBenefit: "Fewer unresolved denials and clearer operator ownership.",
        verificationRequired: true,
        approvalRequired: true,
        safeToAutomate: false,
      };
    case "financial":
      return {
        ...shared,
        title: "Review Financial Posture",
        summary: "Investigate the financial variance and confirm whether follow-up or governance review is required.",
        domain: "financial",
        reason: insight.reason,
        recommendedAction: /drop|outstanding|payment/.test(lower(insight.summary + insight.reason)) ? "Review the collection drop and follow up outstanding payments." : "Review the broader financial posture and service-cost change.",
        actionType: /drop|outstanding|payment/.test(lower(insight.summary + insight.reason)) ? "follow_up_outstanding_payment" : "review_financial_posture",
        expectedImpact: "Protects collection continuity and highlights financial risk earlier.",
        estimatedBenefit: "Better reconciliation pace and more stable revenue posture.",
        verificationRequired: true,
        approvalRequired: true,
        safeToAutomate: false,
      };
    case "community":
      return {
        ...shared,
        title: "Respond to Community Pattern",
        summary: "Link the resident-facing signal to its operational cause and assign a clear follow-up path.",
        domain: "community",
        reason: insight.reason,
        recommendedAction: "Respond to repeated complaints and link the community signal to maintenance or security follow-up.",
        actionType: "respond_to_complaints",
        expectedImpact: "Improves resident experience and prevents unresolved sentiment from compounding.",
        estimatedBenefit: "Clearer cross-team ownership and faster resident-facing resolution.",
        verificationRequired: true,
        approvalRequired: false,
        safeToAutomate: false,
      };
    default:
      return null;
  }
}

function governanceCandidate(
  awareness: OperationalAwareness[],
  insights: OperationalInsight[],
  generatedAt: string
): Candidate | null {
  const actionable = insights[0];
  if (!actionable) return null;
  const unowned = !text(actionable.owner) || /operational owner/i.test(text(actionable.owner));
  const verificationPending = awareness.some((item) => actionable.relatedAwareness.includes(item.id) && /verify/i.test(item.verification));
  if (!unowned && !verificationPending) return null;
  return {
    title: "Request Operator Decision",
    summary: "An operational item needs a named owner or explicit verification step before it can be closed safely.",
    domain: "operational_governance",
    severity: actionable.severity,
    urgency: urgencyFrom(actionable.severity),
    confidence: actionable.confidence,
    reason: verificationPending ? "Verification is still required before the current insight can be closed." : "The insight does not yet have a sufficiently clear owner.",
    recommendedAction: verificationPending ? "Verify evidence and request an operator decision." : "Assign an owner and request the next operator decision.",
    actionType: verificationPending ? "verify_evidence" : "assign_owner",
    owner: actionable.owner || "Operations lead",
    expectedImpact: "Improves operational accountability and reduces drift between detection and response.",
    estimatedBenefit: "Cleaner ownership handoff and fewer unresolved workflows.",
    verificationRequired: verificationPending,
    approvalRequired: false,
    safeToAutomate: false,
    relatedSignals: actionable.relatedSignals,
    relatedAwareness: actionable.relatedAwareness,
    relatedInsights: [actionable.id],
    supportingEvidence: actionable.evidence,
    generatedAt,
    nextStep: "Route through Operational Governance if ownership remains unresolved.",
    entityKey: `governance:${actionable.id}`,
  };
}

function awarenessFallbackCandidate(awareness: OperationalAwareness[], generatedAt: string): Candidate | null {
  const target = awareness.find((item) => item.urgency === "urgent" || item.urgency === "act" || (item.urgency === "review" && item.confidence >= 0.8));
  if (!target) return null;
  const domainMap: Record<OperationalAwareness["kind"], OperationalRecommendationDomain> = {
    operational: "operational_governance",
    infrastructure: "infrastructure",
    security: "security",
    maintenance: "maintenance",
    financial: "financial",
    community: "community",
    environmental: "environmental",
    service: "operational_governance",
    visitor: "visitor",
    executive: "executive",
  };
  const actionMap: Record<OperationalAwareness["kind"], RecommendationActionType> = {
    operational: "request_operator_decision",
    infrastructure: "verify_network",
    security: "review_access_event",
    maintenance: "schedule_preventive_inspection",
    financial: "review_financial_posture",
    community: "respond_to_complaints",
    environmental: "inspect_environmental_sensor",
    service: "assign_owner",
    visitor: "verify_visitor_identity",
    executive: "include_in_briefing",
  };
  return {
    title: target.title.replace("Attention", "Recommendation"),
    summary: target.summary,
    domain: domainMap[target.kind],
    severity: target.urgency === "urgent" ? "critical" : target.urgency === "act" ? "warning" : "attention",
    urgency: target.urgency,
    confidence: target.confidence,
    reason: target.reason,
    recommendedAction: target.recommended_action,
    actionType: actionMap[target.kind],
    owner: target.owner || "Operational owner",
    expectedImpact: target.impact,
    estimatedBenefit: "Earlier operator action before the condition becomes a wider operational issue.",
    verificationRequired: /verify/i.test(target.verification) || target.urgency !== "monitor",
    approvalRequired: approvalRequired(domainMap[target.kind], actionMap[target.kind]),
    safeToAutomate: safeToAutomate(actionMap[target.kind], domainMap[target.kind]),
    relatedSignals: target.related_signals,
    relatedAwareness: [target.id],
    relatedInsights: [],
    supportingEvidence: target.supporting_evidence,
    generatedAt,
    nextStep: target.verification,
    entityKey: `awareness:${target.id}`,
  };
}

function executiveCandidate(insights: OperationalInsight[], generatedAt: string): Candidate | null {
  const highImpact = insights.find((item) => item.severity === "critical" || item.domain === "financial" || item.domain === "security");
  if (!highImpact) return null;
  return {
    title: "Include in Executive Briefing",
    summary: "A high-impact operational issue should be included in executive context and portfolio review.",
    domain: "executive",
    severity: highImpact.severity,
    urgency: urgencyFrom(highImpact.severity),
    confidence: highImpact.confidence,
    reason: "The current insight has cross-cutting operational or portfolio significance.",
    recommendedAction: highImpact.domain === "financial" ? "Prepare a management review of the financial posture risk." : "Include this issue in the next executive operational briefing.",
    actionType: highImpact.domain === "financial" ? "prepare_management_review" : "include_in_briefing",
    owner: highImpact.owner || "Executive operations",
    expectedImpact: "Improves executive visibility into risk before it spreads across teams or estates.",
    estimatedBenefit: "Earlier management alignment and better portfolio prioritization.",
    verificationRequired: false,
    approvalRequired: true,
    safeToAutomate: false,
    relatedSignals: highImpact.relatedSignals,
    relatedAwareness: highImpact.relatedAwareness,
    relatedInsights: [highImpact.id],
    supportingEvidence: highImpact.evidence,
    generatedAt,
    nextStep: "Prepare summary language for Office and executive runtime consumers.",
    entityKey: `executive:${highImpact.id}`,
  };
}

function withId(candidate: Candidate): OperationalRecommendation {
  const expiresAt = new Date(new Date(candidate.generatedAt).getTime() + 1000 * 60 * 60 * 24).toISOString();
  return {
    id: `recommendation:${candidate.domain}:${candidate.entityKey}:${new Date(candidate.generatedAt).getTime()}`,
    ...candidate,
    expiresAt,
    status: candidate.urgency === "monitor" ? "monitoring" : "open",
    source: "operational_recommendation_runtime",
  };
}

export function buildOperationalRecommendations(input: RecommendationInput): OperationalRecommendation[] {
  const generatedAt = input.generatedAt || new Date().toISOString();
  const signals = input.signals || [];
  const awareness = input.awareness || [];
  const insights = input.insights || [];
  const candidates: Candidate[] = [];

  for (const insight of insights) {
    const candidate = candidateFromInsight(insight, signals, awareness, generatedAt);
    if (candidate) candidates.push(candidate);
  }

  const governance = governanceCandidate(awareness, insights, generatedAt);
  if (governance) candidates.push(governance);
  const fallback = awarenessFallbackCandidate(awareness, generatedAt);
  if (fallback) candidates.push(fallback);
  const executive = executiveCandidate(insights, generatedAt);
  if (executive) candidates.push(executive);

  const unique = new Map<string, OperationalRecommendation>();
  for (const candidate of candidates) {
    const key = `${candidate.domain}:${candidate.entityKey}:${lower(candidate.reason)}`;
    if (!unique.has(key)) unique.set(key, withId(candidate));
  }

  return [...unique.values()].sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || b.confidence - a.confidence);
}
