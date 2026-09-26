"use client";

import { useState } from "react";
import { useSelection, useTwinData, useTwinRuntime, useRuntimeAssetState, type AssetClassification, type CommandName, type CommandResult } from "oyi-twin-engine";
import { SYSTEM_LABEL } from "oyi-twin-engine/luna/operational/systemPresentation";

const OPERATIONAL_KINDS = new Set(["device", "camera", "access-point", "edge-node"]);

const ELEVATOR_FLOOR_SHORTCUTS = [
  { ref: "LUNA-GROUND", label: "Ground" },
  { ref: "LUNA-L06", label: "Level 6" },
  { ref: "LUNA-L10", label: "Level 10" },
];

// Clearly-labeled simulation/test events — the same three Phase 5
// established. Never a generic "trigger" affordance on any observable
// sensor, only these named, disclosed events.
const SIMULATE_EVENT_FOR: Record<string, { event: string; label: string }> = {
  "LUNA-L06-APT-A-KITCHEN-LEAK-01": { event: "leak_detected", label: "Simulate leak detected" },
  "LUNA-L06-APT-A-ENTRY-SMOKE-01": { event: "smoke_detected", label: "Simulate smoke alarm" },
  "LUNA-L06-APT-A-LIVING-OCC-01": { event: "occupancy_detected", label: "Simulate occupancy detected" },
};

function classificationLabel(c: AssetClassification): string {
  switch (c) {
    case "controllable":
      return "Observable / Controllable";
    case "observable":
      return "Observable (read-only telemetry)";
    case "asset-only":
    default:
      return "Asset-only (no live telemetry)";
  }
}

function fmtValue(v: unknown): string {
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2);
  return JSON.stringify(v);
}

function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "ok" | "warn" }) {
  const cls =
    tone === "ok"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
      : tone === "warn"
        ? "border-rose-500/20 bg-rose-500/10 text-rose-200"
        : "border-white/10 bg-white/5 text-zinc-300";
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] ${cls}`}>{children}</span>;
}

/** Buttons derived purely from availableCommands + current state shape —
 * never a per-asset-ref switch. Ported 1:1 from the standalone engine's
 * AssetInfoPanel dispatch logic (see Oyi-Twin-Engine src/ui/AssetInfoPanel.tsx). */
function CommandControls({ commands, state, run, pending }: { commands: CommandName[]; state: Record<string, unknown>; run: (c: CommandName, args?: Record<string, unknown>) => void; pending: boolean }) {
  if (commands.length === 0) return null;
  const has = (c: CommandName) => commands.includes(c);
  const buttons: Array<{ label: string; onClick: () => void; active?: boolean }> = [];

  if (has("setTemperature")) {
    const on = Boolean(state.on);
    const target = typeof state.target_temp_c === "number" ? state.target_temp_c : 24;
    buttons.push({ label: on ? "Turn off" : "Turn on", onClick: () => run(on ? "turnOff" : "turnOn"), active: on });
    buttons.push({ label: `− ${target - 1}°C`, onClick: () => run("setTemperature", { temperature: target - 1 }) });
    buttons.push({ label: `+ ${target + 1}°C`, onClick: () => run("setTemperature", { temperature: target + 1 }) });
    if (has("setMode")) {
      for (const mode of ["cool", "heat", "fan", "auto"]) {
        buttons.push({ label: mode, onClick: () => run("setMode", { mode }), active: state.mode === mode });
      }
    }
  } else if (has("open") && has("close") && has("setPosition")) {
    const position = typeof state.position === "number" ? state.position : 0;
    buttons.push({ label: "Open", onClick: () => run("open"), active: position === 100 });
    buttons.push({ label: "Half", onClick: () => run("setPosition", { position: 50 }), active: position === 50 });
    buttons.push({ label: "Close", onClick: () => run("close"), active: position === 0 });
  } else if (has("lock") || has("unlock")) {
    const locked = Boolean(state.locked);
    buttons.push({ label: "Lock", onClick: () => run("lock"), active: locked });
    buttons.push({ label: "Unlock", onClick: () => run("unlock"), active: !locked });
  } else if (has("open") && has("close")) {
    const open = Boolean(state.open);
    buttons.push({ label: "Open", onClick: () => run("open"), active: open });
    buttons.push({ label: "Close", onClick: () => run("close"), active: !open });
  } else if (has("setPosition")) {
    for (const floor of ELEVATOR_FLOOR_SHORTCUTS) {
      buttons.push({ label: `Send to ${floor.label}`, onClick: () => run("setPosition", { floor: floor.ref }), active: state.floor === floor.ref });
    }
  } else if (has("setMode") && has("turnOn")) {
    const on = Boolean(state.running);
    buttons.push({ label: on ? "Turn off" : "Turn on", onClick: () => run(on ? "turnOff" : "turnOn"), active: on });
    for (const mode of ["auto", "manual"]) {
      buttons.push({ label: mode, onClick: () => run("setMode", { mode }), active: state.mode === mode });
    }
  } else if (has("setMode")) {
    buttons.push({ label: "Source: grid", onClick: () => run("setMode", { mode: "grid" }), active: state.source === "grid" });
    buttons.push({ label: "Source: generator", onClick: () => run("setMode", { mode: "generator" }), active: state.source === "generator" });
  } else if (has("turnOn") || has("turnOff")) {
    const on = Boolean(state.on ?? state.running);
    buttons.push({ label: on ? "Turn off" : "Turn on", onClick: () => run(on ? "turnOff" : "turnOn"), active: on });
  }

  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">Commands</div>
      <div className="flex flex-wrap gap-1.5">
        {buttons.map((b) => (
          <button
            key={b.label}
            disabled={pending}
            onClick={b.onClick}
            className={`rounded-lg border px-2.5 py-1 text-[11px] transition disabled:opacity-40 ${
              b.active ? "border-sky-500/30 bg-sky-500/15 text-sky-200" : "border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08] hover:text-white"
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function LunaAssetPanel({ onReturnToBuilding }: { onReturnToBuilding: () => void }) {
  const { selected } = useSelection();
  const provider = useTwinData();
  const runtimeProvider = useTwinRuntime();
  const [pending, setPending] = useState(false);
  const [lastResult, setLastResult] = useState<CommandResult | null>(null);

  const ref = selected && OPERATIONAL_KINDS.has(selected.kind) ? selected.ref : null;
  const runtime = useRuntimeAssetState(ref ?? "__none__");

  if (!ref) return null;
  const asset = provider.getAsset(ref);
  if (!asset) return null;

  const run = async (command: CommandName, args?: Record<string, unknown>) => {
    setPending(true);
    const result = await runtimeProvider.execute({ assetRef: ref, command, args });
    setLastResult(result);
    setPending(false);
  };

  const simulateEvent = SIMULATE_EVENT_FOR[ref];

  return (
    <div className="pointer-events-auto flex w-72 flex-col gap-3 overflow-y-auto rounded-xl border border-white/10 bg-black/60 p-3.5 backdrop-blur">
      <div>
        <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">Operational asset</div>
        <div className="mt-0.5 truncate text-sm font-semibold text-white">{asset.label}</div>
        <div className="truncate text-[11px] text-zinc-500">{asset.ref}</div>
      </div>

      <div className="space-y-1 text-[12px]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-zinc-500">System</span>
          <span className="text-zinc-200">{SYSTEM_LABEL[asset.system]}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-zinc-500">Type</span>
          <span className="text-zinc-200">{asset.type}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-zinc-500">Location</span>
          <span className="truncate text-zinc-200">{asset.locationLabel}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-zinc-500">Class</span>
          <span className="truncate text-zinc-200">{classificationLabel(asset.classification)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-zinc-500">Source</span>
          {runtime ? <Pill tone={runtime.status === "critical" || runtime.status === "warning" ? "warn" : runtime.status === "offline" ? "neutral" : "ok"}>{runtime.source} · {runtime.status}</Pill> : <span>—</span>}
        </div>
      </div>

      {runtime ? (
        <div className="space-y-1">
          <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">Current state</div>
          <pre className="whitespace-pre-wrap rounded-lg border border-white/10 bg-white/[0.03] p-2 font-mono text-[11px] leading-5 text-zinc-300">
            {Object.entries(runtime.state).length ? Object.entries(runtime.state).map(([k, v]) => `${k}: ${fmtValue(v)}`).join("\n") : "(no live fields — asset-only)"}
          </pre>
        </div>
      ) : (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2 text-[11px] text-zinc-500">No runtime state available.</div>
      )}

      {runtime && <CommandControls commands={runtime.availableCommands} state={runtime.state} run={run} pending={pending} />}

      {simulateEvent && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-amber-400/80">Simulation / test</div>
          <button
            disabled={pending}
            onClick={() => setLastResult(runtimeProvider.simulateEvent(ref, simulateEvent.event))}
            className="w-full rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-200 transition hover:bg-amber-500/15 disabled:opacity-40"
          >
            {simulateEvent.label}
          </button>
        </div>
      )}

      {lastResult && (
        <div className={`rounded-lg border px-2.5 py-1.5 text-[11px] ${lastResult.ok ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200" : "border-rose-500/20 bg-rose-500/10 text-rose-200"}`}>
          {lastResult.message}
        </div>
      )}

      <button onClick={onReturnToBuilding} className="mt-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-zinc-300 transition hover:bg-white/[0.08] hover:text-white">
        Return to building
      </button>
    </div>
  );
}
