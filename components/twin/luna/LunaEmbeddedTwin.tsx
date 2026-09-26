"use client";

import Link from "next/link";
import { Maximize2, AlertTriangle } from "lucide-react";
import { useRuntimeStates } from "oyi-twin-engine";
import { LunaTwinProviders } from "./LunaTwinProviders";
import { LunaTwinCanvas } from "./LunaTwinCanvas";

/**
 * The embedded, in-dashboard presentation of the Luna twin (Phase 9) —
 * deliberately minimal: the 3D building, a status readout, and an Expand
 * action. No nav rail, no scenario simulator, no scope switch, no Oyi
 * panel, no asset panel — those belong to the full Command View (Phase 7)
 * that Expand opens, not to a small panel living inside Live Facility
 * View. This is intentionally a *different, smaller* composition of the
 * same engine, not a shrunk-down copy of LunaCommandView.
 */
function EmbeddedStatusStrip({ label }: { label: string }) {
  const states = useRuntimeStates();
  const critical = states.filter((s) => s.status === "critical").length;
  const warning = states.filter((s) => s.status === "warning").length;

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3">
      <div className="pointer-events-auto flex items-center justify-between gap-2">
        <span className="rounded-full border border-white/10 bg-black/60 px-2.5 py-1 text-[10px] font-medium text-white/80 backdrop-blur">{label}</span>
        {(critical > 0 || warning > 0) && (
          <span
            className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] backdrop-blur ${
              critical > 0 ? "border-rose-500/30 bg-rose-500/20 text-rose-200" : "border-amber-500/30 bg-amber-500/20 text-amber-200"
            }`}
          >
            <AlertTriangle className="h-3 w-3" />
            {critical > 0 ? `${critical} critical` : `${warning} attention`}
          </span>
        )}
      </div>
      <div className="pointer-events-auto flex justify-end">
        <Link
          href="/digital-twin/luna"
          className="flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/20 px-3 py-1.5 text-[11px] font-medium text-sky-100 backdrop-blur transition hover:bg-sky-500/30"
        >
          <Maximize2 className="h-3.5 w-3.5" />
          Expand Twin
        </Link>
      </div>
    </div>
  );
}

export function LunaEmbeddedTwin({ label }: { label: string }) {
  return (
    <div className="relative min-h-[310px] w-full overflow-hidden rounded-lg border border-[var(--ois-border-subtle)] bg-black">
      <LunaTwinProviders initialScope="facility">
        <div className="absolute inset-0">
          <LunaTwinCanvas quality="embedded" />
        </div>
        <EmbeddedStatusStrip label={label} />
      </LunaTwinProviders>
    </div>
  );
}
