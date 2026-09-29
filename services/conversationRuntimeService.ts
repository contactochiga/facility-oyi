import type { ConversationRequest, ConversationResponse } from "@/lib/conversationRuntime";
import { ensureRuntimeSubscriptions } from "@/lib/runtimeSubscriptions";
import { loadFacilityAttention } from "@/services/facilityAttentionService";
import { runOyiCoreConversation } from "@/services/oyiCoreRuntimeService";
import { signalFromFacilityAttention } from "@/services/signalAwarenessService";
export async function runConversationRuntime(request: ConversationRequest): Promise<ConversationResponse> {
  const signals = (await loadFacilityAttention()).map(signalFromFacilityAttention);
  // Propagate Core unavailability; never synthesize an alternative answer.
  const response = await runOyiCoreConversation(request, signals);
  ensureRuntimeSubscriptions().publishConversation({
    event: "conversation.runtime", conversationRequest: request,
    conversationResponse: response, source: "conversation_runtime",
  });
  return response;
}
