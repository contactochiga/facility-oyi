import {
  buildOperationalRecommendations,
  type OperationalRecommendation,
} from "@/lib/operationalRecommendations";
import { normalizeSignal, type NormalizedSignal } from "@/lib/operationalSignal";
import { loadFacilityAttention } from "@/services/facilityAttentionService";
import { evaluateOyiCoreRuntime } from "@/services/oyiCoreRuntimeService";
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
  const attention = await loadFacilityAttention();
  const signals = attention.map(signalFromFacilityAttention);
  try {
    const bundle = await evaluateOyiCoreRuntime(signals);
    return bundle.recommendations;
  } catch {
    const insights = await loadOperationalInsights();
    return buildOperationalRecommendations({
      signals,
      insights,
    });
  }
}
