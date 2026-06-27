import API from "@/services/api";
import type { NormalizedSignal } from "@/lib/operationalSignal";
import type { OperationalAwareness } from "@/services/contextAwarenessEngine";
import type { OperationalInsight } from "@/lib/operationalReasoning";
import type { OperationalRecommendation } from "@/lib/operationalRecommendations";
import type { AutomationPlan } from "@/lib/safeAutomationRuntime";
import type { ConversationRequest, ConversationResponse } from "@/lib/conversationRuntime";
import type { ExecutiveBriefing, ExecutivePeriod } from "@/lib/executiveRuntime";

export type RuntimeBundleResponse = {
  signals: NormalizedSignal[];
  awareness: OperationalAwareness[];
  insights: OperationalInsight[];
  recommendations: OperationalRecommendation[];
  automationPlans: AutomationPlan[];
};

export async function evaluateOyiCoreRuntime(signals: Array<Partial<NormalizedSignal> & Record<string, unknown>>) {
  const { data } = await API.post("/oyi/runtime/evaluate", { signals });
  return {
    signals: Array.isArray(data?.signals) ? data.signals : [],
    awareness: Array.isArray(data?.awareness) ? data.awareness : [],
    insights: Array.isArray(data?.insights) ? data.insights : [],
    recommendations: Array.isArray(data?.recommendations) ? data.recommendations : [],
    automationPlans: Array.isArray(data?.automationPlans) ? data.automationPlans : [],
  } satisfies RuntimeBundleResponse;
}

export async function runOyiCoreConversation(request: ConversationRequest, signals: Array<Partial<NormalizedSignal> & Record<string, unknown>>) {
  const { data } = await API.post("/oyi/runtime/conversation", { request, signals });
  return data?.response as ConversationResponse;
}

export async function loadOyiCoreExecutiveBriefing(period: ExecutivePeriod, signals: Array<Partial<NormalizedSignal> & Record<string, unknown>>) {
  const { data } = await API.post("/oyi/runtime/executive", { period, signals });
  return data?.briefing as ExecutiveBriefing;
}
