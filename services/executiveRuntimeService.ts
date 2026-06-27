import {
  buildConversationResponse,
  type ConversationRequest,
  type ConversationResponse,
} from "@/lib/conversationRuntime";
import { buildExecutiveBriefing, type ExecutiveBriefing, type ExecutivePeriod } from "@/lib/executiveRuntime";
import { ensureRuntimeSubscriptions } from "@/lib/runtimeSubscriptions";
import { loadFacilityAttention, loadFacilityAwareness } from "@/services/facilityAttentionService";
import { loadOperationalInsights } from "@/services/operationalReasoningService";
import { loadOperationalRecommendations } from "@/services/operationalRecommendationService";
import { loadAutomationPlans } from "@/services/safeAutomationService";
import { signalFromFacilityAttention } from "@/services/signalAwarenessService";

function executiveConversationRequest(period: ExecutivePeriod): ConversationRequest {
  const messageByPeriod: Record<ExecutivePeriod, string> = {
    morning: "Provide the morning executive operational summary.",
    daily: "Summarize the daily operational posture.",
    weekly: "Summarize the weekly operational posture and trends.",
    monthly: "Summarize the monthly operational posture and trends.",
    incident: "Summarize current incident risk and critical exposure.",
    infrastructure: "Summarize infrastructure health and recurring issues.",
    maintenance: "Summarize maintenance continuity and unresolved items.",
    financial: "Summarize financial posture and collection risk.",
    security: "Summarize security posture and gate or camera risk.",
    community: "Summarize community posture and unresolved complaints.",
    risk: "Summarize operational risk and unresolved issues.",
    portfolio: "Summarize overall portfolio health and executive priorities.",
  };
  return {
    id: `executive-conversation:${period}`,
    query: messageByPeriod[period],
    requestedDomain: "executive",
  };
}

export async function loadExecutiveBriefing(period: ExecutivePeriod = "daily"): Promise<ExecutiveBriefing> {
  const runtime = ensureRuntimeSubscriptions();
  const [attention, awareness, insights, recommendations, automationPlans] = await Promise.all([
    loadFacilityAttention(),
    loadFacilityAwareness(),
    loadOperationalInsights(),
    loadOperationalRecommendations(),
    loadAutomationPlans(),
  ]);

  const conversationSummaries: ConversationResponse[] = [
    buildConversationResponse({
      request: executiveConversationRequest(period),
      signals: attention.map(signalFromFacilityAttention),
      awareness,
      insights,
      recommendations,
      automationPlans,
    }),
  ];

  const briefing = buildExecutiveBriefing({
    period,
    signals: attention.map(signalFromFacilityAttention),
    awareness,
    insights,
    recommendations,
    automationPlans,
    conversationSummaries,
  });

  runtime.publishExecutive({
    event: "executive.runtime",
    executiveBriefing: briefing,
    conversationResponse: conversationSummaries[0],
    source: "executive_runtime",
  });

  return briefing;
}
