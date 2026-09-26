"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  SelectionContext,
  SceneModeContext,
  InteriorFocusContext,
  TwinDataContext,
  TwinRuntimeContext,
  TwinIntelligenceController,
  RepresentationContext,
  RouteHighlightContext,
  HoverContext,
  type HoverInfo,
  type SceneActions,
  type TwinIntelligenceContext,
  type InteractionScope,
  type OyiResponse,
  type TwinNodeDescriptor,
  type CanonicalRef,
  type OperationalSystem,
  type CameraFlightTarget,
  type RepresentationIdentity,
  type FloorPlanSpec,
} from "oyi-twin-engine";
import { LUNA_CAMERA_PRESETS, enterInteriorCamera, roomFocusCamera, levelCloseCamera, assetFocusCamera } from "oyi-twin-engine/luna/lunaCameraPresets";
import type { InteriorSpec, RoomLayoutSpec } from "oyi-twin-engine/luna/interiors/lunaInteriors";
import { findSpace } from "oyi-twin-engine/luna/interiors/lunaSpaceLookup";
import { lunaTwinDataProvider } from "oyi-twin-engine/luna/operational/lunaTwinDataProvider";
import { lunaLevelHasSystemAssets } from "oyi-twin-engine/luna/operational/OperationalAssetLayer";
import { lunaSimulationProvider } from "oyi-twin-engine/luna/runtime/lunaSimulationProvider";
import { LUNA_SCENARIOS } from "oyi-twin-engine/luna/runtime/lunaScenarios";
import { parseIntent } from "oyi-twin-engine/luna/intelligence/lunaIntentParser";
import { buildScopePolicy, identityForScope } from "oyi-twin-engine/luna/intelligence/lunaScope";
import { explainAsset } from "oyi-twin-engine/luna/intelligence/lunaExplain";
import { lunaBuildRoute } from "oyi-twin-engine/luna/intelligence/lunaServiceRoutes";
import { lunaResolveRelationship } from "oyi-twin-engine/luna/intelligence/lunaRelationships";
import { lunaRepresentationPolicy } from "oyi-twin-engine/luna/policy/lunaRepresentationPolicy";
import { floorPlanForLevel } from "oyi-twin-engine/luna/policy/lunaFloorPlans";
import { LunaTwinHostContext, type LunaTwinHostValue } from "./lunaTwinHostContext";

const APARTMENT_A_LEVEL_REF: CanonicalRef = "LUNA-L06" as CanonicalRef;
const APARTMENT_A_REF: CanonicalRef = "LUNA-L06-APT-A" as CanonicalRef;
const OPERATIONAL_KINDS = new Set(["device", "camera", "access-point", "edge-node"]);

export interface LunaDeepLink {
  system?: OperationalSystem | "all";
  assetRef?: CanonicalRef;
  spaceRef?: CanonicalRef;
  /** Named LUNA_SCENARIOS key to apply once before navigating — this is
   * what makes a Facility "View in Twin" incident card land the twin
   * already showing the fault, not just the affected asset at rest. */
  triggerScenario?: string;
}

interface LunaTwinProvidersProps {
  /** Authorization scope resolved by the Facility host (from real
   * OisContext role/permissions) — the engine never assumes "facility sees
   * everything" on its own, it only ever receives this from the caller. */
  initialScope: InteractionScope;
  /** Which unit a "consumer" scope identity is assigned to — unused for
   * facility scope. Defaults to the Phase 8 representative resident. */
  assignedHomeRef?: CanonicalRef;
  deepLink?: LunaDeepLink;
  children: ReactNode;
}

export function LunaTwinProviders({ initialScope, assignedHomeRef, deepLink, children }: LunaTwinProvidersProps) {
  const [selected, setSelected] = useState<TwinNodeDescriptor | null>(null);
  const [isolatedLevelRef, setIsolatedLevelRef] = useState<CanonicalRef | null>(null);
  const [exploded, setExploded] = useState(false);
  const [sectionMode, setSectionMode] = useState(false);
  const [sectionSide, setSectionSide] = useState<"north" | "south" | "east" | "west">("north");
  const [flightTarget, setFlightTarget] = useState<CameraFlightTarget | null>(LUNA_CAMERA_PRESETS.exteriorHero);
  const [activeInteriorRef, setActiveInteriorRef] = useState<CanonicalRef | null>(null);
  const [focusedRoomRef, setFocusedRoomRef] = useState<CanonicalRef | null>(null);
  const [activeSystem, setActiveSystem] = useState<OperationalSystem | "all" | null>(null);
  const [interactionScope, setInteractionScope] = useState<InteractionScope>(initialScope);
  const [oyiContext, setOyiContext] = useState<TwinIntelligenceContext>({});
  const [highlightedRefs, setHighlightedRefs] = useState<CanonicalRef[]>([]);
  const [activeFloorPlan, setActiveFloorPlan] = useState<FloorPlanSpec | null>(null);
  const [selectedUnitRef, setSelectedUnitRef] = useState<CanonicalRef | null>(null);
  const [hovered, setHovered] = useState<HoverInfo | null>(null);

  const representationIdentity: RepresentationIdentity = useMemo(
    () => identityForScope(interactionScope, assignedHomeRef),
    [interactionScope, assignedHomeRef]
  );

  const flyTo = (preset: CameraFlightTarget) => setFlightTarget(preset);

  const isolateLevelAndFly = (levelRef: CanonicalRef | null, label: string) => {
    setActiveSystem(null);
    setIsolatedLevelRef(levelRef);
    setActiveInteriorRef(null);
    setFocusedRoomRef(null);
    setSelectedUnitRef(null);
    if (levelRef) {
      setFlightTarget(levelCloseCamera(levelRef));
      setSelected({ ref: levelRef, kind: "level", label });
      // Phase 8 privacy boundary: a residential level's private unit
      // subdivision resolves to a 2D operational plan for this identity
      // rather than a 3D interior walkthrough — the level's own
      // architecture (massing) still flies in 3D above, unaffected.
      const mode = lunaRepresentationPolicy.resolveMode({ ref: levelRef, identity: representationIdentity });
      setActiveFloorPlan(mode === "OPERATIONAL_2D" ? (floorPlanForLevel(levelRef) ?? null) : null);
    } else {
      setSelected(null);
      setActiveFloorPlan(null);
    }
  };

  const enterInterior = (spec: InteriorSpec) => {
    // Defense-in-depth: even if a caller bypasses the nav-list filtering
    // that normally keeps a private unit's "Enter Interior" option off
    // Facility's list, entering the actual 3D interior is refused here
    // too — falls back to the level's 2D operational plan instead.
    const mode = lunaRepresentationPolicy.resolveMode({ ref: spec.interiorRef, identity: representationIdentity });
    if (mode !== "FULL_3D" && mode !== "CONTEXT_3D") {
      isolateLevelAndFly(spec.ownerLevelRef, spec.label);
      return;
    }
    setActiveSystem(null);
    setIsolatedLevelRef(spec.ownerLevelRef);
    setActiveInteriorRef(spec.interiorRef);
    setFocusedRoomRef(null);
    setActiveFloorPlan(null);
    setSelectedUnitRef(null);
    setFlightTarget(enterInteriorCamera(spec));
    setSelected({ ref: spec.interiorRef, kind: "unit", label: spec.label });
  };

  const focusRoom = (spec: InteriorSpec, room: RoomLayoutSpec) => {
    setIsolatedLevelRef(spec.ownerLevelRef);
    setActiveInteriorRef(spec.interiorRef);
    setFocusedRoomRef(room.ref);
    setFlightTarget(roomFocusCamera(spec, room));
    setSelected({ ref: room.ref, kind: "room", label: room.label, parentRef: spec.interiorRef });
  };

  const exitToExterior = () => {
    setActiveSystem(null);
    setIsolatedLevelRef(null);
    setActiveInteriorRef(null);
    setFocusedRoomRef(null);
    setActiveFloorPlan(null);
    setSelectedUnitRef(null);
    setFlightTarget(LUNA_CAMERA_PRESETS.exteriorHero);
    setSelected(null);
  };

  const resetOverview = () => {
    setFlightTarget(LUNA_CAMERA_PRESETS.overview);
    setActiveSystem(null);
    setIsolatedLevelRef(null);
    setActiveInteriorRef(null);
    setFocusedRoomRef(null);
    setActiveFloorPlan(null);
    setSelectedUnitRef(null);
    setExploded(false);
    setSelected(null);
  };

  const selectSystem = (system: OperationalSystem | "all" | null) => {
    setActiveSystem(system);
    setIsolatedLevelRef(null);
    setActiveInteriorRef(null);
    setFocusedRoomRef(null);
    setActiveFloorPlan(null);
    setSelectedUnitRef(null);
    setSelected(null);
    if (system !== null) setFlightTarget(LUNA_CAMERA_PRESETS.overview);
  };

  const selectUnit = (unitRef: CanonicalRef | null) => setSelectedUnitRef(unitRef);

  const returnToBuildingFromAsset = () => {
    setSelected(null);
    setFlightTarget(LUNA_CAMERA_PRESETS.overview);
  };

  useEffect(() => {
    if (!selected || !OPERATIONAL_KINDS.has(selected.kind)) return;
    const asset = lunaTwinDataProvider.getAsset(selected.ref);
    if (asset) setFlightTarget(assetFocusCamera(asset));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.ref]);

  const sceneActions: SceneActions = useMemo(
    () => ({
      navigateToAsset(ref) {
        const asset = lunaTwinDataProvider.getAsset(ref);
        if (!asset) return;
        if (asset.system === "apartment-devices") {
          setActiveSystem(null);
          setIsolatedLevelRef(APARTMENT_A_LEVEL_REF);
          setActiveInteriorRef(APARTMENT_A_REF);
        } else {
          setIsolatedLevelRef(null);
          setActiveInteriorRef(null);
          setFocusedRoomRef(null);
          setActiveSystem(asset.system);
        }
        setSelected({ ref: asset.ref, kind: asset.kind, label: asset.label, parentRef: asset.parentRef });
      },
      navigateToSpace(ref) {
        const found = findSpace(ref);
        if (!found) return;
        if (found.kind === "level") {
          isolateLevelAndFly(found.level.ref, found.level.label);
        } else if (found.kind === "interior") {
          enterInterior(found.spec);
        } else if (found.kind === "room") {
          focusRoom(found.spec, found.room);
        }
      },
      setSystemMode(system) {
        selectSystem(system);
      },
      highlightRoute(refs) {
        setHighlightedRefs(refs);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const controller = useMemo(
    () =>
      new TwinIntelligenceController(
        lunaTwinDataProvider,
        lunaSimulationProvider,
        sceneActions,
        (ref) => explainAsset(lunaTwinDataProvider, lunaSimulationProvider, ref),
        (system, targetRef) => lunaBuildRoute(lunaTwinDataProvider, system, targetRef),
        (ref, type) => lunaResolveRelationship(ref, type)
      ),
    [sceneActions]
  );

  const askOyi = async (text: string): Promise<OyiResponse> => {
    const intent = parseIntent(text, oyiContext);
    const scopePolicy = buildScopePolicy(representationIdentity);
    const response = await controller.handleIntent(intent, scopePolicy, oyiContext);
    setOyiContext(response.context);
    return response;
  };

  // Deep-link contract (Phase 7 §6/§7): applied once on mount so a Facility
  // "View in Twin" card can open the twin already focused on an incident —
  // trigger the simulated fault first, then navigate, so the pump/asset is
  // already showing its fault state rather than its resting one.
  useEffect(() => {
    if (!deepLink) return;
    if (deepLink.triggerScenario) {
      const scenario = LUNA_SCENARIOS.find((s) => s.key === deepLink.triggerScenario);
      scenario?.apply();
    }
    if (deepLink.assetRef) {
      sceneActions.navigateToAsset(deepLink.assetRef);
    } else if (deepLink.spaceRef) {
      sceneActions.navigateToSpace(deepLink.spaceRef);
    } else if (deepLink.system) {
      sceneActions.setSystemMode(deepLink.system);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hostValue: LunaTwinHostValue = {
    selected,
    isolatedLevelRef,
    activeInteriorRef,
    focusedRoomRef,
    activeSystem,
    exploded,
    toggleExploded: () => setExploded((v) => !v),
    sectionMode,
    setSectionMode,
    setExploded,
    flightTarget,
    flyTo,
    isolateLevelAndFly,
    enterInterior,
    focusRoom,
    exitToExterior,
    resetOverview,
    selectSystem,
    returnToBuildingFromAsset,
    interactionScope,
    setInteractionScope,
    oyiContext,
    askOyi,
    representationIdentity,
    activeFloorPlan,
    selectedUnitRef,
    selectUnit,
  };

  return (
    <RepresentationContext.Provider value={{ identity: representationIdentity, policy: lunaRepresentationPolicy }}>
      <HoverContext.Provider value={{ hovered, setHovered }}>
        <TwinDataContext.Provider value={lunaTwinDataProvider}>
          <TwinRuntimeContext.Provider value={lunaSimulationProvider}>
            <SelectionContext.Provider value={{ selected, select: setSelected }}>
              <SceneModeContext.Provider
                value={{
                  isolatedLevelRef,
                  isolateLevel: setIsolatedLevelRef,
                  exploded,
                  toggleExploded: () => setExploded((v) => !v),
                  explodeGap: 3.5,
                  activeSystem,
                  setActiveSystem,
                  sectionMode,
                  toggleSectionMode: () => setSectionMode((v) => !v),
                  sectionSide,
                  setSectionSide,
                  levelHasSystemAssets: lunaLevelHasSystemAssets,
                }}
              >
                <InteriorFocusContext.Provider value={{ activeInteriorRef, setActiveInterior: setActiveInteriorRef, focusedRoomRef, setFocusedRoom: setFocusedRoomRef }}>
                  <RouteHighlightContext.Provider value={{ highlightedRefs, setHighlightedRefs }}>
                    <LunaTwinHostContext.Provider value={hostValue}>{children}</LunaTwinHostContext.Provider>
                  </RouteHighlightContext.Provider>
                </InteriorFocusContext.Provider>
              </SceneModeContext.Provider>
            </SelectionContext.Provider>
          </TwinRuntimeContext.Provider>
        </TwinDataContext.Provider>
      </HoverContext.Provider>
    </RepresentationContext.Provider>
  );
}
