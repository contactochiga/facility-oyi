"use client";

import { createContext, useContext } from "react";
import type {
  CameraFlightTarget,
  CanonicalRef,
  InteractionScope,
  OperationalSystem,
  OyiResponse,
  TwinIntelligenceContext,
  TwinNodeDescriptor,
  RepresentationIdentity,
  FloorPlanSpec,
} from "oyi-twin-engine";
import type { InteriorSpec, RoomLayoutSpec } from "oyi-twin-engine/luna/interiors/lunaInteriors";

/**
 * Facility-specific host glue — NOT part of the portable engine. Mirrors
 * the state/navigation surface the standalone Oyi-Twin-Engine's App.tsx
 * owns directly, so LunaCommandView (the Facility-styled chrome) and
 * LunaTwinCanvas (the R3F render) can both read/drive the same twin
 * instance without either owning the state themselves.
 */
export interface LunaTwinHostValue {
  selected: TwinNodeDescriptor | null;
  isolatedLevelRef: CanonicalRef | null;
  activeInteriorRef: CanonicalRef | null;
  focusedRoomRef: CanonicalRef | null;
  activeSystem: OperationalSystem | "all" | null;
  exploded: boolean;
  toggleExploded: () => void;
  sectionMode: boolean;
  setSectionMode: (enabled: boolean) => void;
  setExploded: (enabled: boolean) => void;
  flightTarget: CameraFlightTarget | null;

  flyTo: (preset: CameraFlightTarget) => void;
  isolateLevelAndFly: (levelRef: CanonicalRef | null, label: string) => void;
  enterInterior: (spec: InteriorSpec) => void;
  focusRoom: (spec: InteriorSpec, room: RoomLayoutSpec) => void;
  exitToExterior: () => void;
  resetOverview: () => void;
  selectSystem: (system: OperationalSystem | "all" | null) => void;
  returnToBuildingFromAsset: () => void;

  interactionScope: InteractionScope;
  setInteractionScope: (scope: InteractionScope) => void;
  oyiContext: TwinIntelligenceContext;
  askOyi: (text: string) => Promise<OyiResponse>;

  /** Phase 8 — the full representation identity behind `interactionScope`
   * (role/permissions/assignedHomeRefs/facilityResponsibility), and the
   * privacy-boundary state it drives: when a residential level resolves
   * to a 2D operational plan for this identity, `activeFloorPlan` carries
   * that plan's spec instead of (or alongside) the 3D view. */
  representationIdentity: RepresentationIdentity;
  activeFloorPlan: FloorPlanSpec | null;
  selectedUnitRef: CanonicalRef | null;
  selectUnit: (ref: CanonicalRef | null) => void;
}

export const LunaTwinHostContext = createContext<LunaTwinHostValue | null>(null);

export function useLunaTwinHost(): LunaTwinHostValue {
  const ctx = useContext(LunaTwinHostContext);
  if (!ctx) throw new Error("useLunaTwinHost must be used within a LunaTwinProviders tree");
  return ctx;
}
