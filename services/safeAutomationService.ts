import type { OperationalRecommendation } from "@/lib/operationalRecommendations";
import { buildAutomationPlans, type AutomationPlan } from "@/lib/safeAutomationRuntime";
import { normalizeSignal, type NormalizedSignal } from "@/lib/operationalSignal";
import { loadFacilityAttention } from "@/services/facilityAttentionService";
import { evaluateOyiCoreRuntime } from "@/services/oyiCoreRuntimeService";
import { loadOperationalInsights, type RealtimeReasoningInput } from "@/services/operationalReasoningService";
import { loadOperationalRecommendations } from "@/services/operationalRecommendationService";
import { buildAwarenessFromSignal } from "@/services/contextAwarenessEngine";
import { signalFromFacilityAttention } from "@/services/signalAwarenessService";

type RealtimeAutomationInput = RealtimeReasoningInput & {
  recommendations?: OperationalRecommendation[];
  insights?: Awaited<ReturnType<typeof loadOperationalInsights>>;
  permissions?: string[];
};

export function deriveRealtimeAutomationPlans(input: RealtimeAutomationInput): AutomationPlan[] {
  const awareness = input.awareness || buildAwarenessFromSignal(input.signal);
  const attentionSignals = (input.attention || []).map(signalFromFacilityAttention);
  const normalizedSignals: NormalizedSignal[] = [normalizeSignal(input.signal), ...attentionSignals];
  return buildAutomationPlans({
    signals: normalizedSignals,
    awareness: [awareness],
    insights: input.insights || [],
    recommendations: input.recommendations || [],
    permissions: input.permissions || [],
  });
}

export async function loadAutomationPlans(): Promise<AutomationPlan[]> {
  const attention = await loadFacilityAttention();
  const signals = attention.map(signalFromFacilityAttention);
  try {
    const bundle = await evaluateOyiCoreRuntime(signals);
    return bundle.automationPlans;
  } catch {
    // Temporary compatibility fallback while Facility completes the final
    // cutover from local synthesis to backend-owned runtime outputs.
    const [insights, recommendations] = await Promise.all([
      loadOperationalInsights(),
      loadOperationalRecommendations(),
    ]);
    return buildAutomationPlans({
      signals,
      insights,
      recommendations,
    });
  }
}
