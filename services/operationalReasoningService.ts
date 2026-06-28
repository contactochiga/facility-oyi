import {
  buildOperationalInsights,
  operationalReasoningRuntime,
  type OperationalInsight,
} from "@/lib/operationalReasoning";
import { buildAwarenessFromSignal } from "@/services/contextAwarenessEngine";
import { loadFacilityAttention, type FacilityAttentionItem } from "@/services/facilityAttentionService";
import { evaluateOyiCoreRuntime } from "@/services/oyiCoreRuntimeService";
import { signalFromFacilityAttention } from "@/services/signalAwarenessService";
import type { NormalizedSignal } from "@/lib/operationalSignal";

export type RealtimeReasoningInput = {
  signal: Partial<NormalizedSignal> & Record<string, unknown>;
  awareness?: ReturnType<typeof buildAwarenessFromSignal>;
  attention?: FacilityAttentionItem[];
};

export function deriveRealtimeOperationalInsights(input: RealtimeReasoningInput): OperationalInsight[] {
  const awareness = input.awareness || buildAwarenessFromSignal(input.signal);
  const attentionSignals = (input.attention || []).map(signalFromFacilityAttention);
  return operationalReasoningRuntime.evaluate({
    signals: [input.signal, ...attentionSignals],
    awareness: [awareness],
  });
}

export async function loadOperationalInsights(): Promise<OperationalInsight[]> {
  const attention = await loadFacilityAttention();
  const signals = attention.map(signalFromFacilityAttention);
  try {
    const bundle = await evaluateOyiCoreRuntime(signals);
    return bundle.insights;
  } catch {
    // Temporary compatibility fallback until every Facility data source has
    // backend runtime parity. Realtime paths should prefer backend evaluation.
    return buildOperationalInsights({ signals });
  }
}
