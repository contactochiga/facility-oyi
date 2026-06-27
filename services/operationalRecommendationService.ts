import {
  buildOperationalRecommendations,
  type OperationalRecommendation,
} from "@/lib/operationalRecommendations";
import { normalizeSignal, type NormalizedSignal } from "@/lib/operationalSignal";
import { loadFacilityAttention } from "@/services/facilityAttentionService";
import { loadOperationalInsights, type RealtimeReasoningInput } from "@/services/operationalReasoningService";
import { buildAwarenessFromSignal } from "@/services/contextAwarenessEngine";
import { signalFromFacilityAttention } from "@/services/signalAwarenessService";

type RealtimeRecommendationInput = RealtimeReasoningInput & {
  insights?: Awaited<ReturnType<typeof loadOperationalInsights>>;
};

export function deriveRealtimeOperationalRecommendations(input: RealtimeRecommendationInput): OperationalRecommendation[] {
  const awareness = input.awareness || buildAwarenessFromSignal(input.signal);
  const attentionSignals = (input.attention || []).map(signalFromFacilityAttention);
  const normalizedSignals: NormalizedSignal[] = [normalizeSignal(input.signal), ...attentionSignals];
  return buildOperationalRecommendations({
    signals: normalizedSignals,
    awareness: [awareness],
    insights: input.insights || [],
  });
}

export async function loadOperationalRecommendations(): Promise<OperationalRecommendation[]> {
  const [attention, insights] = await Promise.all([
    loadFacilityAttention(),
    loadOperationalInsights(),
  ]);
  return buildOperationalRecommendations({
    signals: attention.map(signalFromFacilityAttention),
    insights,
  });
}
