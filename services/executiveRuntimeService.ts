import type { ExecutiveBriefing, ExecutivePeriod } from "@/lib/executiveRuntime";
import { ensureRuntimeSubscriptions } from "@/lib/runtimeSubscriptions";
import { loadFacilityAttention } from "@/services/facilityAttentionService";
import { loadOyiCoreExecutiveBriefing } from "@/services/oyiCoreRuntimeService";
import { signalFromFacilityAttention } from "@/services/signalAwarenessService";
export async function loadExecutiveBriefing(period: ExecutivePeriod = "daily"): Promise<ExecutiveBriefing> {
  const signals = (await loadFacilityAttention()).map(signalFromFacilityAttention);
  const briefing = await loadOyiCoreExecutiveBriefing(period, signals);
  ensureRuntimeSubscriptions().publishExecutive({
    event: "executive.runtime", executiveBriefing: briefing, source: "executive_runtime",
  });
  return briefing;
}
