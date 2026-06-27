import {
  buildConversationResponse,
  type ConversationRequest,
  type ConversationResponse,
} from "@/lib/conversationRuntime";
import { ensureRuntimeSubscriptions } from "@/lib/runtimeSubscriptions";
import { loadFacilityAttention, loadFacilityAwareness } from "@/services/facilityAttentionService";
import { runOyiCoreConversation } from "@/services/oyiCoreRuntimeService";
import { loadOperationalInsights } from "@/services/operationalReasoningService";
import { loadOperationalRecommendations } from "@/services/operationalRecommendationService";
import { loadAutomationPlans } from "@/services/safeAutomationService";
import { signalFromFacilityAttention } from "@/services/signalAwarenessService";

export async function runConversationRuntime(request: ConversationRequest): Promise<ConversationResponse> {
  const runtime = ensureRuntimeSubscriptions();
  const [attention, awareness, insights, recommendations, automationPlans] = await Promise.all([
    loadFacilityAttention(),
    loadFacilityAwareness(),
    loadOperationalInsights(),
    loadOperationalRecommendations(),
    loadAutomationPlans(),
  ]);
  const signals = attention.map(signalFromFacilityAttention);
  let response: ConversationResponse;
  try {
    response = await runOyiCoreConversation(request, signals);
  } catch {
    response = buildConversationResponse({
      request,
      signals,
      awareness,
      insights,
      recommendations,
      automationPlans,
      permissions: request.actor?.permissions || [],
      context: request.context,
    });
  }
  runtime.publishConversation({
    event: "conversation.runtime",
    conversationRequest: request,
    conversationResponse: response,
    source: "conversation_runtime",
  });
  return response;
}
