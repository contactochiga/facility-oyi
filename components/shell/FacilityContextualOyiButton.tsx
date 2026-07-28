"use client";

import { Sparkles } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useContextStore } from "@/store/useContextStore";
import { type FacilityActiveIntelligenceContext, useFacilityAssistantStore } from "@/store/useFacilityAssistantStore";

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

function contextFor(module: string, pathname: string, targetLabel: string | undefined, search: URLSearchParams, estateId: string | null): FacilityActiveIntelligenceContext {
  const objectCandidates = [
    ["assetId", "infrastructure_asset"],
    ["cameraId", "camera"],
    ["meterId", "meter"],
    ["incidentId", "operational_incident"],
    ["requestId", "maintenance_request"],
    ["visitorId", "visitor"],
    ["nodeId", "twin_node"],
    ["buildingId", "building"],
  ] as const;
  const found = objectCandidates.map(([param, type]) => ({ id: String(search.get(param) || "").trim(), type })).find((item) => item.id);
  const canonicalId = found?.id || targetLabel || module;
  const objectType = found?.type || (/hardware|infrastructure|utilities|water|environment/.test(module) ? "infrastructure_asset" : /camera/.test(module) ? "camera" : /maintenance/.test(module) ? "maintenance_request" : /visitor|access/.test(module) ? "visitor" : /digital-twin/.test(module) ? "twin_node" : "operational_incident");
  const label = targetLabel || found?.id || module.replace(/-/g, " ");
  return {
    context_id: `ctx_facility_${objectType}_${canonicalId}`.replace(/[^a-zA-Z0-9_-]+/g, "_"),
    context_version: Date.now(),
    registered_at: new Date().toISOString(),
    surface: "facility",
    module,
    route: pathname,
    scope: {
      estate_id: estateId,
      building_id: search.get("buildingId") || null,
      home_id: null,
      unit_id: null,
      room_id: null,
    },
    primary_object: {
      object_type: objectType,
      canonical_id: canonicalId,
      label,
      privacy_class: "building_operational",
      source_module: module,
    },
    selected_subobject: null,
    visible_state: {
      data_version: null,
      freshness: null,
      current_state: null,
      health: null,
      summary: { selected_tab: search.get("tab") || null },
    },
    source: targetLabel ? "drawer" : "route_fallback",
    permissions: [],
    ownership: { facility_projection: true },
  };
}

export default function FacilityContextualOyiButton({ targetLabel, compact = false, contextOverride }: { targetLabel?: string; compact?: boolean; contextOverride?: FacilityActiveIntelligenceContext | null }) {
  const pathname = usePathname() || "/overview";
  const search = useSearchParams();
  const facilityContext = useContextStore((state) => state.context);
  const openAssistant = useFacilityAssistantStore((state) => state.openAssistant);
  const module = moduleFromPath(pathname);
  const target = targetLabel || search.get("cameraId") || search.get("meterId") || search.get("incidentId") || search.get("buildingId") || "";
  const activeContext = contextOverride || contextFor(module, pathname, target || undefined, search, facilityContext?.estate_id || null);
  return (
    <button
      type="button"
      onClick={() => openAssistant(starterFor(module, target || undefined), activeContext)}
      className={compact
        ? "inline-flex items-center gap-2 rounded-lg border border-sky-300/18 bg-sky-400/[0.08] px-3 py-2 text-xs font-medium text-sky-100"
        : "inline-flex items-center gap-2 rounded-[14px] border border-sky-300/18 bg-sky-400/[0.08] px-3 py-2 text-sm font-medium text-sky-100 transition hover:border-sky-300/30 hover:bg-sky-400/[0.12]"}
      aria-label={`Ask Oyi about ${activeContext.primary_object?.label || target || module}`}
    >
      <Sparkles className="h-4 w-4" />
      <span>{compact ? "Ask Oyi" : `Ask Oyi about ${activeContext.primary_object?.label || target || module.replace(/-/g, " ")}`}</span>
    </button>
  );
}
