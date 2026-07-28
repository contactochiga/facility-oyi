"use client";

import { Sparkles } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useFacilityAssistantStore } from "@/store/useFacilityAssistantStore";

function moduleFromPath(pathname: string) {
  return pathname.replace(/^\//, "").split("/")[0] || "overview";
}

function starterFor(module: string, target?: string) {
  if (/hardware|live-infrastructure|utilities|water|environment/.test(module)) return `Who is affected by ${target || "this infrastructure posture"}?`;
  if (/camera/.test(module)) return `Summarize camera evidence for ${target || "this camera context"}.`;
  if (/maintenance/.test(module)) return `Who owns ${target || "this maintenance item"} and what is overdue?`;
  if (/visitor|traffic|security-access/.test(module)) return `What is the access state for ${target || "this visitor/access queue"}?`;
  if (/digital-twin/.test(module)) return `Explain the selected digital twin object and active incidents.`;
  if (/facility-intelligence|overview/.test(module)) return "Summarize current operational attention and safest next actions.";
  return `Explain the current ${module.replace(/-/g, " ")} context.`;
}

export default function FacilityContextualOyiButton({ targetLabel, compact = false }: { targetLabel?: string; compact?: boolean }) {
  const pathname = usePathname() || "/overview";
  const search = useSearchParams();
  const openAssistant = useFacilityAssistantStore((state) => state.openAssistant);
  const module = moduleFromPath(pathname);
  const target = targetLabel || search.get("cameraId") || search.get("meterId") || search.get("incidentId") || search.get("buildingId") || "";
  return (
    <button
      type="button"
      onClick={() => openAssistant(starterFor(module, target || undefined))}
      className={compact
        ? "inline-flex items-center gap-2 rounded-lg border border-sky-300/18 bg-sky-400/[0.08] px-3 py-2 text-xs font-medium text-sky-100"
        : "inline-flex items-center gap-2 rounded-[14px] border border-sky-300/18 bg-sky-400/[0.08] px-3 py-2 text-sm font-medium text-sky-100 transition hover:border-sky-300/30 hover:bg-sky-400/[0.12]"}
      aria-label={`Ask Oyi about ${target || module}`}
    >
      <Sparkles className="h-4 w-4" />
      <span>{compact ? "Ask Oyi" : `Ask Oyi about ${target || module.replace(/-/g, " ")}`}</span>
    </button>
  );
}
