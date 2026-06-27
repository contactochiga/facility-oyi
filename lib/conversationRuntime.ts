import type { NormalizedSignal, SignalEvidence } from "@/lib/operationalSignal";
import type { OperationalRecommendation } from "@/lib/operationalRecommendations";
import type { OperationalInsight } from "@/lib/operationalReasoning";
import type { AutomationPlan } from "@/lib/safeAutomationRuntime";
import type { OperationalAwareness, OperationalContext } from "@/services/contextAwarenessEngine";

export type ConversationIntent =
  | "information"
  | "explanation"
  | "status"
  | "operational_summary"
  | "infrastructure"
  | "security"
  | "maintenance"
  | "utilities"
  | "community"
  | "visitor"
  | "financial"
  | "governance"
  | "executive"
  | "recommendation"
  | "automation"
  | "navigation"
  | "registry_lookup"
  | "comparison"
  | "trend"
  | "forecast_request"
  | "health_check"
  | "verification"
  | "evidence";

export type ConversationRequest = {
  id: string;
  query: string;
  estateId?: string | null;
  buildingId?: string | null;
  unitId?: string | null;
  actor?: {
    id?: string | null;
    name?: string | null;
    role?: string | null;
    permissions?: string[];
  };
  context?: OperationalContext;
  requestedDomain?: string | null;
  generatedAt?: string;
};

export type ConversationResponse = {
  id: string;
  intent: ConversationIntent;
  confidence: number;
  entities: string[];
  filters: Record<string, string[]>;
  requestedDomain: string;
  summary: string;
  answer: string;
  supportingEvidence: SignalEvidence[];
  relatedSignals: string[];
  relatedAwareness: string[];
  relatedInsights: string[];
  relatedRecommendations: string[];
  relatedAutomationPlans: string[];
  suggestedFollowUps: string[];
  availableActions: Array<{ title: string; type: "navigation" | "recommendation" | "automation" | "verification"; target?: string }>;
  permissionsRequired: string[];
  approvalRequired: boolean;
  safeActions: string[];
  unsafeActions: string[];
  generatedAt: string;
  source: "conversation_runtime";
};

export type ConversationInput = {
  request: ConversationRequest;
  signals?: NormalizedSignal[];
  awareness?: OperationalAwareness[];
  insights?: OperationalInsight[];
  recommendations?: OperationalRecommendation[];
  automationPlans?: AutomationPlan[];
  context?: OperationalContext;
  policies?: Record<string, unknown> | null;
  permissions?: string[];
};

function text(value: unknown, fallback = "") {
  const next = String(value ?? "").trim();
  return next || fallback;
}

function lower(value: unknown) {
  return text(value).toLowerCase();
}

function parseIntent(query: string): { intent: ConversationIntent; domain: string; confidence: number } {
  const q = lower(query);
  if (/automation|waiting for approval|workflow|can oyi safely/.test(q)) return { intent: "automation", domain: "automation", confidence: 0.9 };
  if (/recommendation|recommend|what should we do next/.test(q)) return { intent: "recommendation", domain: "recommendation", confidence: 0.9 };
  if (/why|explain/.test(q) && /recommend/.test(q)) return { intent: "explanation", domain: "recommendation", confidence: 0.86 };
  if (/why|explain|what happened/.test(q)) return { intent: "explanation", domain: "operational", confidence: 0.82 };
  if (/changed|since yesterday|overnight|trend/.test(q)) return { intent: "trend", domain: "operational", confidence: 0.8 };
  if (/compare|versus|vs/.test(q)) return { intent: "comparison", domain: "operational", confidence: 0.76 };
  if (/forecast/.test(q)) return { intent: "forecast_request", domain: "operational", confidence: 0.7 };
  if (/health|healthy|unhealthy|posture/.test(q)) return { intent: "health_check", domain: "operational", confidence: 0.84 };
  if (/verify|verification|evidence/.test(q)) return { intent: /evidence/.test(q) ? "evidence" : "verification", domain: "operational", confidence: 0.83 };
  if (/navigate|open|show .*registry|take me/.test(q)) return { intent: "navigation", domain: "navigation", confidence: 0.88 };
  if (/lookup|find|which/.test(q) && /resident|visitor|device|home|wallet/.test(q)) return { intent: "registry_lookup", domain: "registry", confidence: 0.8 };
  if (/summary|summarize|attention/.test(q)) return { intent: "operational_summary", domain: "operational", confidence: 0.86 };
  if (/security|gate|camera|access/.test(q)) return { intent: "security", domain: "security", confidence: 0.84 };
  if (/visitor/.test(q)) return { intent: "visitor", domain: "visitor", confidence: 0.84 };
  if (/maintenance|repair/.test(q)) return { intent: "maintenance", domain: "maintenance", confidence: 0.84 };
  if (/utility|water|energy|power/.test(q)) return { intent: "utilities", domain: "utility", confidence: 0.84 };
  if (/financial|wallet|collection|payment/.test(q)) return { intent: "financial", domain: "financial", confidence: 0.84 };
  if (/community|resident experience|complaint/.test(q)) return { intent: "community", domain: "community", confidence: 0.84 };
  if (/infrastructure|device|offline/.test(q)) return { intent: "infrastructure", domain: "infrastructure", confidence: 0.84 };
  if (/governance|owner|approval/.test(q)) return { intent: "governance", domain: "operational_governance", confidence: 0.82 };
  if (/executive|briefing|portfolio/.test(q)) return { intent: "executive", domain: "executive", confidence: 0.82 };
  if (/status/.test(q)) return { intent: "status", domain: "operational", confidence: 0.74 };
  return { intent: "information", domain: "operational", confidence: 0.62 };
}

function queryEntities(query: string) {
  const matches = text(query)
    .split(/[^A-Za-z0-9_-]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 2);
  return [...new Set(matches)].slice(0, 8);
}

function domainMatch(domain: string, value: string) {
  if (domain === "operational") return true;
  return lower(value).includes(lower(domain));
}

function evidenceFrom(
  signals: NormalizedSignal[],
  awareness: OperationalAwareness[],
  insights: OperationalInsight[],
  recommendations: OperationalRecommendation[],
  automationPlans: AutomationPlan[]
) {
  const found = new Map<string, SignalEvidence>();
  for (const signal of signals.slice(0, 3)) {
    for (const item of signal.evidence) {
      const key = text(item.id || `${item.type}:${item.timestamp}`);
      if (!found.has(key)) found.set(key, item);
    }
  }
  for (const item of awareness.slice(0, 2).flatMap((entry) => entry.supporting_evidence)) {
    const key = text(item.id || `${item.type}:${item.timestamp}`);
    if (!found.has(key)) found.set(key, item);
  }
  for (const item of insights.slice(0, 2).flatMap((entry) => entry.evidence)) {
    const key = text(item.id || `${item.type}:${item.timestamp}`);
    if (!found.has(key)) found.set(key, item);
  }
  for (const recommendation of recommendations.slice(0, 2).flatMap((entry) => entry.supportingEvidence)) {
    const key = text(recommendation.id || `${recommendation.type}:${recommendation.timestamp}`);
    if (!found.has(key)) found.set(key, recommendation);
  }
  for (const plan of automationPlans.slice(0, 1)) {
    found.set(`automation:${plan.id}`, {
      id: `automation:${plan.id}`,
      type: "automation_plan",
      source: "conversation_runtime",
      summary: plan.summary,
      timestamp: plan.generatedAt,
      metadata: { executionMode: plan.executionMode, requiredPermissions: plan.requiredPermissions },
    });
  }
  return [...found.values()].slice(0, 8);
}

function makeActions(
  recommendations: OperationalRecommendation[],
  automationPlans: AutomationPlan[],
  domain: string
): ConversationResponse["availableActions"] {
  const actions: ConversationResponse["availableActions"] = [];
  for (const recommendation of recommendations.slice(0, 2)) {
    actions.push({ title: recommendation.title, type: "recommendation" });
  }
  for (const plan of automationPlans.slice(0, 2)) {
    actions.push({ title: plan.title, type: "automation" });
  }
  if (domain === "security") actions.push({ title: "Open Operational Attention filtered to security", type: "navigation", target: "/alerts" });
  if (domain === "infrastructure") actions.push({ title: "Open Infrastructure Registry filtered to affected devices", type: "navigation", target: "/hardware-devices" });
  if (domain === "visitor") actions.push({ title: "Open Visitor Access Registry filtered to pending approvals", type: "navigation", target: "/visitors" });
  if (domain === "financial") actions.push({ title: "Open Financial Posture filtered to overdue collections", type: "navigation", target: "/wallets" });
  return actions.slice(0, 5);
}

function followUps(intent: ConversationIntent, domain: string) {
  if (intent === "automation") return ["Which automation plans are waiting for approval?", "Which plans are safe only to prepare, not execute?"];
  if (intent === "recommendation") return ["Why did Oyi recommend this?", "Which recommendations require approval?"];
  if (domain === "security") return ["What evidence supports this security posture?", "Which camera or access signals changed most recently?"];
  if (domain === "infrastructure") return ["Which infrastructure is unhealthy?", "Which devices are repeating failures?"];
  if (domain === "maintenance") return ["What maintenance is overdue?", "Which assets need preventive inspection?"];
  return ["What requires attention?", "What changed since yesterday?"];
}

export function buildConversationResponse(input: ConversationInput): ConversationResponse {
  const generatedAt = input.request.generatedAt || new Date().toISOString();
  const { intent, domain, confidence } = parseIntent(input.request.query);
  const signals = (input.signals || []).filter((item) => domainMatch(domain, `${item.domain} ${item.type} ${item.entity.type}`));
  const awareness = (input.awareness || []).filter((item) => domainMatch(domain, item.kind));
  const insights = (input.insights || []).filter((item) => domainMatch(domain, item.domain));
  const recommendations = (input.recommendations || []).filter((item) => domainMatch(domain, item.domain));
  const automationPlans = (input.automationPlans || []).filter((item) => domainMatch(domain, item.domain));
  const evidence = evidenceFrom(signals, awareness, insights, recommendations, automationPlans);
  const known = [
    insights[0]?.summary,
    recommendations[0]?.summary,
    awareness[0]?.summary,
    signals[0]?.entity.name ? `${signals[0].entity.name} is part of the current operational context.` : "",
  ].filter(Boolean);
  const likely = insights[0]?.reason || recommendations[0]?.reason || "";
  const unknown = !signals.length && !awareness.length && !insights.length && !recommendations.length && !automationPlans.length;
  const permissionsRequired = [...new Set(automationPlans.flatMap((item) => item.requiredPermissions))];
  const approvalRequired = automationPlans.some((item) => item.approvalRequired) || recommendations.some((item) => item.approvalRequired);
  const safeActions = automationPlans.filter((item) => item.safeToExecute).map((item) => item.title);
  const unsafeActions = automationPlans.filter((item) => !item.safeToExecute).map((item) => item.title);

  const summary = unknown
    ? "Oyi Core does not currently have enough runtime evidence to answer this with confidence."
    : `Oyi Core found ${insights.length || awareness.length || recommendations.length || signals.length} relevant operational item(s) for this request.`;
  const answer = [
    known.length ? `Known: ${known.join(" ")}` : "Known: No direct matching operational artifact was found.",
    likely ? `Likely: ${likely}` : "Likely: No strong causal pattern was available from current runtime artifacts.",
    unknown ? "Unknown: Additional runtime evidence or verification is required." : "Requires verification: Review supporting evidence before closing the loop.",
  ].join(" ");

  return {
    id: `conversation-response:${input.request.id}`,
    intent,
    confidence,
    entities: queryEntities(input.request.query),
    filters: {
      domain: [domain],
      intent: [intent],
    },
    requestedDomain: input.request.requestedDomain || domain,
    summary,
    answer,
    supportingEvidence: evidence,
    relatedSignals: signals.map((item) => item.id),
    relatedAwareness: awareness.map((item) => item.id),
    relatedInsights: insights.map((item) => item.id),
    relatedRecommendations: recommendations.map((item) => item.id),
    relatedAutomationPlans: automationPlans.map((item) => item.id),
    suggestedFollowUps: followUps(intent, domain),
    availableActions: makeActions(recommendations, automationPlans, domain),
    permissionsRequired,
    approvalRequired,
    safeActions,
    unsafeActions,
    generatedAt,
    source: "conversation_runtime",
  };
}
