"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Layers3 } from "lucide-react";
import { useLunaTwinHost } from "./lunaTwinHostContext";

export function LunaCommandHeader({ estateName }: { estateName: string }) {
  const router = useRouter();
  const { resetOverview, exploded, toggleExploded, interactionScope, setInteractionScope, selected } = useLunaTwinHost();

  // Collapse semantics (Phase 9): this is an immersive mode of Facility
  // OS, not a separate destination — returning should restore wherever
  // the user actually came from (e.g. Overview's embedded Twin tab), not
  // always land on a fixed page. Falls back to Overview, the primary
  // embedded entry point, when there's no history to unwind.
  const collapse = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/overview");
  };

  return (
    <div className="pointer-events-auto flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/60 px-4 py-2.5 backdrop-blur">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={collapse}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
          title="Back to Facility / Collapse Twin"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">Luna Residences — Digital Twin</div>
          <div className="truncate text-[11px] text-zinc-500">{estateName} · Live building command view{selected ? ` · ${selected.label}` : ""}</div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] text-sky-200">
          {interactionScope === "facility" ? "Facility scope" : "Consumer scope"}
        </span>
        <div className="hidden items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] p-0.5 sm:flex">
          <button
            className={`rounded-md px-2 py-1 text-[11px] transition ${interactionScope === "facility" ? "bg-sky-500/20 text-sky-200" : "text-zinc-400 hover:text-zinc-200"}`}
            onClick={() => setInteractionScope("facility")}
          >
            Facility
          </button>
          <button
            className={`rounded-md px-2 py-1 text-[11px] transition ${interactionScope === "consumer" ? "bg-sky-500/20 text-sky-200" : "text-zinc-400 hover:text-zinc-200"}`}
            onClick={() => setInteractionScope("consumer")}
          >
            Consumer
          </button>
        </div>
        <button
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] transition ${exploded ? "border-sky-500/30 bg-sky-500/10 text-sky-200" : "border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]"}`}
          onClick={toggleExploded}
        >
          <Layers3 className="h-3.5 w-3.5" />
          {exploded ? "Collapse floors" : "Explode floors"}
        </button>
        <button className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-zinc-300 transition hover:bg-white/[0.08] hover:text-white" onClick={resetOverview}>
          Reset / Overview
        </button>
      </div>
    </div>
  );
}
