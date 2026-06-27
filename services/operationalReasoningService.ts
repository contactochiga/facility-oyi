import {
  buildOperationalInsights,
  operationalReasoningRuntime,
  type OperationalInsight,
} from "@/lib/operationalReasoning";
import { buildAwarenessFromSignal } from "@/services/contextAwarenessEngine";
import { loadFacilityAttention, type FacilityAttentionItem } from "@/services/facilityAttentionService";
import { signalFromFacilityAttention } from "@/services/signalAwarenessService";
import type { NormalizedSignal } from "@/lib/operationalSignal";

type RealtimeReasoningInput = {
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
  return buildOperationalInsights({
    signals: attention.map(signalFromFacilityAttention),
  });
}
