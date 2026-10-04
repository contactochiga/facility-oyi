// Facility surface adapter for the shared Oyi interaction foundation
// (oyi-interaction). It supplies Facility CONTEXT, NAVIGATION, STARTER SEEDS,
// OPERATIONAL-OBJECT context and HISTORY POLICY -- nothing else. It cannot
// grant capability authority, override Backend permission results, invent
// execution truth or change Core semantics (defineOyiSurfaceAdapter enforces
// the contract). It has no access to Facility realtime.
import { defineOyiSurfaceAdapter, normalizeOyiNavigation, type OyiSuggestionInput, type OyiSurfaceAdapter } from "oyi-interaction/core";
import { FACILITY_MODULES, visibleModules } from "@/lib/moduleRegistry";
import type { OyiIdentity } from "@/lib/oyiFoundation";

export function facilityStarterSeeds(estateName: string | null): OyiSuggestionInput[] {
  return [
    {
      id: "facility-brief",
      label: "Start intelligence brief",
      prompt: estateName ? `Summarize current operational attention for ${estateName}.` : "Summarize current operational attention.",
    },
  ];
}

export function createFacilitySurfaceAdapter(input: {
  user: OyiIdentity | null | undefined;
  estateId: string | null;
  estateName: string | null;
  buildingId: string | null;
  homeId: string | null;
  operationalObject: Record<string, unknown> | null;
  voiceEntry: boolean;
}): OyiSurfaceAdapter {
  return defineOyiSurfaceAdapter({
    surface: "facility",
    context: () => ({
      scopeKind: input.buildingId ? "building" : input.estateId ? "estate" : "none",
      scopeLabel: input.estateName,
      estateId: input.estateId,
      homeId: input.homeId,
      buildingId: input.buildingId,
    }),
    // Visibility only, through the existing permission-aware registry.
    navigation: () => normalizeOyiNavigation(visibleModules(input.user, FACILITY_MODULES).map((module) => ({ key: module.key, label: module.label, href: module.href }))),
    starterSeeds: () => facilityStarterSeeds(input.estateName),
    operationalObject: () => input.operationalObject,
    // Backend threads are the history. Facility caches recent thread messages
    // on-device (zustand persist "facility-oyi-conversation") for fast
    // rehydration; hydrate() replaces it from Backend. Audited and kept.
    historyPolicy: { source: "backend_threads", localFallback: "backend_cache", maxThreads: 24 },
    uiHints: { voiceEntry: input.voiceEntry },
  });
}
