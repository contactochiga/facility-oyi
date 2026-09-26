"use client";

import { FloorPlan2D, useTwinData, useRuntimeStates } from "oyi-twin-engine";
import { unitStatusForFacility } from "oyi-twin-engine/luna/policy/lunaFloorPlans";
import { lunaRepresentationPolicy } from "oyi-twin-engine/luna/policy/lunaRepresentationPolicy";
import { Building2 } from "lucide-react";
import { useLunaTwinHost } from "./lunaTwinHostContext";

const TONE_BADGE: Record<string, string> = {
  normal: "border-sky-500/20 bg-sky-500/10 text-sky-200",
  attention: "border-rose-500/20 bg-rose-500/10 text-rose-200",
  maintenance: "border-amber-500/20 bg-amber-500/10 text-amber-200",
  vacant: "border-white/10 bg-white/5 text-zinc-400",
  reserved: "border-violet-500/20 bg-violet-500/10 text-violet-200",
};

/**
 * Facility's residential-floor privacy boundary made visible: this is
 * what Facility gets INSTEAD OF a 3D interior for a private, occupied
 * unit — unit-level operational status only, plus whichever specific
 * assets the representation policy still authorizes Facility to see
 * (service infrastructure it owns), never the resident's own devices.
 */
export function LunaFloorPlanPanel() {
  const { activeFloorPlan, selectedUnitRef, selectUnit, representationIdentity, isolateLevelAndFly } = useLunaTwinHost();
  const twinData = useTwinData();
  const states = useRuntimeStates();

  if (!activeFloorPlan) return null;

  const assets = twinData.listAssets();
  const unitStates = Object.fromEntries(activeFloorPlan.units.map((u) => [u.ref, unitStatusForFacility(u.ref, assets, states)]));
  const selectedUnit = activeFloorPlan.units.find((u) => u.ref === selectedUnitRef) ?? null;
  const authorizedAssets = selectedUnit
    ? lunaRepresentationPolicy.filterAuthorizedAssets(assets.filter((a) => a.unitRef === selectedUnit.ref), representationIdentity)
    : [];

  return (
    <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/70 p-6">
      <div className="flex w-full max-w-5xl items-stretch gap-4 rounded-2xl border border-white/10 bg-zinc-950/95 p-4 shadow-2xl">
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-400">
            <Building2 className="h-3.5 w-3.5" />
            {activeFloorPlan.label} — operational plan
          </div>
          <p className="text-[11px] text-zinc-500">
            Private units are shown as unit-level status only. Resident devices are not visible from Facility — this is the privacy boundary, not a rendering limitation.
          </p>
          <div className="aspect-[16/10] text-zinc-500">
            <FloorPlan2D spec={activeFloorPlan} unitStates={unitStates} selectedRef={selectedUnitRef} onSelectUnit={selectUnit} />
          </div>
        </div>

        <div className="flex w-72 shrink-0 flex-col gap-3 border-l border-white/10 pl-4">
          {selectedUnit ? (
            <>
              <div>
                <div className="text-sm font-semibold text-white">{selectedUnit.label}</div>
                <div className="truncate text-[11px] text-zinc-500">{selectedUnit.ref}</div>
              </div>
              <span className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.08em] ${TONE_BADGE[unitStates[selectedUnit.ref]?.tone ?? "normal"]}`}>
                {unitStates[selectedUnit.ref]?.statusLabel}
              </span>

              <div className="mt-1 space-y-1.5">
                <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">Facility-authorized infrastructure</div>
                {authorizedAssets.length === 0 ? (
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2 text-[11px] text-zinc-500">
                    No Facility-managed service infrastructure is exposed for this unit beyond its unit-level status.
                  </div>
                ) : (
                  authorizedAssets.map((asset) => (
                    <div key={asset.ref} className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                      <div className="text-[12px] text-zinc-200">{asset.label}</div>
                      <div className="text-[10px] text-zinc-500">{asset.type.replace(/_/g, " ")}</div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="text-[11px] text-zinc-500">Select a unit to see its Facility-visible status.</div>
          )}

          <button
            onClick={() => isolateLevelAndFly(null, "")}
            className="mt-auto rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
          >
            Close plan
          </button>
        </div>
      </div>
    </div>
  );
}
