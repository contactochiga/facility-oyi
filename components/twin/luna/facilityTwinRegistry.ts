import type { TwinRegistry, CanonicalRef } from "oyi-twin-engine";

// Phase 9 — Facility's own twin-availability registry. No backend field
// exists yet for "does this estate have a configured digital twin" (that
// would be the real, eventual mechanism — see the Phase 9 report), so
// this keys off the estate's display name as the least-invasive local
// stand-in. Adding a real building later means adding an entry here (or
// swapping this function for a real backend-lookup call) — never a new
// "if Luna" conditional in FacilityOverviewDashboard or LunaCommandView.
const FACILITY_TWIN_REGISTRY: TwinRegistry = {
  "luna residences": { available: true, buildingRef: "LUNA-TOWER" as CanonicalRef, label: "Luna Residences" },
};

export function resolveFacilityTwin(estateName: string | null | undefined) {
  const key = (estateName || "").trim().toLowerCase();
  return FACILITY_TWIN_REGISTRY[key] ?? { available: false };
}
