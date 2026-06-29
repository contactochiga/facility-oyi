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

export type OyiCoreExecutionHistoryParams = {
  limit?: number;
  deviceId?: string | null;
  provider?: string | null;
  origin?: string | null;
  action?: string | null;
  initiatorId?: string | null;
  status?: string | null;
};

export async function loadOyiCoreExecutionHistory(params: number | OyiCoreExecutionHistoryParams = 50) {
  const query = typeof params === "number" ? { limit: params } : params;
  const { data } = await API.get("/oyi/runtime/executions/history", { params: query });
  return Array.isArray(data?.executions) ? data.executions : [];
}

export async function loadOyiCoreExecutionStatistics(params: number | OyiCoreExecutionHistoryParams = 200) {
  const query = typeof params === "number" ? { limit: params } : params;
  const { data } = await API.get("/oyi/runtime/executions/stats/summary", { params: query });
  return {
    statistics: data?.statistics || null,
    operators: Array.isArray(data?.operators) ? data.operators : [],
    providers: Array.isArray(data?.providers) ? data.providers : [],
    estates: Array.isArray(data?.estates) ? data.estates : [],
    timeline: Array.isArray(data?.timeline) ? data.timeline : [],
  };
}
