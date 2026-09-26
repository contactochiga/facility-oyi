"use client";

import { useState } from "react";
import { LUNA_SCENARIOS } from "oyi-twin-engine/luna/runtime/lunaScenarios";
import { FlaskConical } from "lucide-react";

/**
 * Facility-only scenario simulator. Triggering a preset runs its own
 * apply() through the exact same runtime-provider choke point every
 * command uses (see Oyi-Twin-Engine's lunaSimulationProvider) — this
 * component holds no simulation logic of its own. Explicitly labeled as
 * simulation throughout since there is no live hardware or production
 * data behind it.
 */
export function LunaScenarioStrip() {
  const [lastKey, setLastKey] = useState<string | null>(null);

  return (
    <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/15 bg-black/60 px-3 py-2.5 backdrop-blur">
      <div className="flex items-center gap-1.5 pr-1 text-[10px] font-medium uppercase tracking-[0.14em] text-amber-400/80">
        <FlaskConical className="h-3.5 w-3.5" />
        Simulation
      </div>
      {LUNA_SCENARIOS.map((scenario) => (
        <button
          key={scenario.key}
          title={scenario.description}
          onClick={() => {
            scenario.apply();
            setLastKey(scenario.key);
          }}
          className={`rounded-lg border px-2.5 py-1 text-[11px] transition ${
            lastKey === scenario.key
              ? "border-sky-500/30 bg-sky-500/15 text-sky-200"
              : scenario.key === "normal"
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15"
                : "border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08] hover:text-white"
          }`}
        >
          {scenario.label}
        </button>
      ))}
      {lastKey && <span className="pl-1 text-[11px] text-zinc-500">Last triggered: {LUNA_SCENARIOS.find((s) => s.key === lastKey)?.label}</span>}
    </div>
  );
}
