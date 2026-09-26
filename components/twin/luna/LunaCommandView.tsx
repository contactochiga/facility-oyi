"use client";

import { useMemo, useState } from "react";
import type {
  InteractionScope,
  OyiResponse,
  OperationalSystem,
  EngineeringLayerOption,
  SceneOption,
} from "oyi-twin-engine";
import {
  HoverLabel,
  LevelRail,
  OyiOrb,
  DashboardPanel,
  EngineeringDrawer,
  ScenesDrawer,
} from "oyi-twin-engine";
import { LunaContextCard } from "oyi-twin-engine/luna/LunaContextCard";
import { LUNA_LEVEL_RAIL_ITEMS } from "oyi-twin-engine/luna/lunaLevelRail";
import { findSpace } from "oyi-twin-engine/luna/interiors/lunaSpaceLookup";
import {
  SYSTEM_ORDER,
  SYSTEM_LABEL,
  SYSTEM_COLOR,
} from "oyi-twin-engine/luna/operational/systemPresentation";
import { lunaTwinDataProvider } from "oyi-twin-engine/luna/operational/lunaTwinDataProvider";
import { lunaRepresentationPolicy } from "oyi-twin-engine/luna/policy/lunaRepresentationPolicy";
import { LUNA_LEVELS } from "oyi-twin-engine/luna/lunaProgramme";
import { LunaTwinProviders, type LunaDeepLink } from "./LunaTwinProviders";
import { LunaTwinCanvas } from "./LunaTwinCanvas";
import { LunaCommandHeader } from "./LunaCommandHeader";
import { LunaFloorPlanPanel } from "./LunaFloorPlanPanel";
import { useLunaTwinHost } from "./lunaTwinHostContext";

const OYI_SUGGESTED_PROMPTS = ["Show critical issues", "Show me the water system", "Take me to Apartment 6A", "Which cameras are offline?"];

const ENGINEERING_LAYER_DESCRIPTORS: Partial<Record<OperationalSystem, string>> = {
  structure: "Columns, Beams, Slabs",
  electrical: "Power & Lighting",
  water: "Water Supply / Pipes",
  drainage: "Waste & Stormwater",
  fire: "Fire Protection",
  hvac: "Ducting & Air Systems",
  "vertical-transport": "Lifts & Shafts",
  security: "Cameras & Monitoring",
  access: "Access Control",
  "network-edge": "Network & Edge Devices",
  "apartment-devices": "In-Home Devices",
};

const ENGINEERING_LAYER_OPTIONS: EngineeringLayerOption[] = [
  {
    key: null,
    icon: "architecture",
    label: "Architecture",
    descriptor: "Full Building Model",
    color: "#b7c0cc",
  },
  {
    key: "all",
    icon: "all",
    label: "All Systems",
    descriptor: "Integrated View",
    color: "#b88af0",
  },
  ...SYSTEM_ORDER.map((system) => ({
    key: system,
    icon: system,
    label: SYSTEM_LABEL[system],
    descriptor: ENGINEERING_LAYER_DESCRIPTORS[system] ?? SYSTEM_LABEL[system],
    color: SYSTEM_COLOR[system],
  })),
];

const VIEW_OPTIONS: SceneOption[] = [
  { ref: "normal", label: "Normal", descriptor: "Unsectioned building" },
  { ref: "cutaway", label: "Cutaway", descriptor: "Reveal building section" },
  { ref: "explode", label: "Explode", descriptor: "Separate building levels" },
];

function LunaCommandViewInner({ estateName }: { estateName: string }) {
  const {
    isolateLevelAndFly,
    enterInterior,
    focusRoom,
    isolatedLevelRef,
    activeSystem,
    selectSystem,
    exploded,
    sectionMode,
    setSectionMode,
    setExploded,
    askOyi,
    activeFloorPlan,
    representationIdentity,
  } = useLunaTwinHost();

  const [engineeringDrawerOpen, setEngineeringDrawerOpen] = useState(false);
  const [viewDrawerOpen, setViewDrawerOpen] = useState(false);
  const [dashboard, setDashboard] = useState<{ title: string; text: string } | null>(null);

  const engineeringOptions = useMemo(() => {
    const assets = lunaRepresentationPolicy.filterAuthorizedAssets(
      lunaTwinDataProvider.listAssets(),
      representationIdentity
    );

    const floors = LUNA_LEVELS.map((level) => ({
      width: level.footprint.width,
      y: level.baseElevation,
      height: level.height,
    }));

    return ENGINEERING_LAYER_OPTIONS.map((option) => {
      const matching = assets.filter(
        (asset) => option.key === "all" || asset.system === option.key
      );

      return {
        ...option,
        preview: {
          floors,
          points: matching.map((asset) => ({
            x: asset.position.x,
            y:
              (LUNA_LEVELS.find((level) => level.ref === asset.ownerLevelRef)
                ?.baseElevation ?? 0) + asset.position.y,
          })),
          label: `${option.label}: modeled building elevation${
            matching.length ? `, ${matching.length} assets` : ""
          }`,
        },
      };
    });
  }, [representationIdentity]);

  const activeView = exploded ? "explode" : sectionMode ? "cutaway" : "normal";

  const selectView = (mode: string) => {
    setSectionMode(mode === "cutaway");
    setExploded(mode === "explode");
  };

  const engineeringButtonLabel =
    activeSystem === null
      ? "Architecture"
      : activeSystem === "all"
        ? "All Systems"
        : SYSTEM_LABEL[activeSystem];

  const navigateToSpace = (ref: string) => {
    const found = findSpace(ref);
    if (!found) return;

    if (found.kind === "level") {
      isolateLevelAndFly(found.level.ref, found.level.label);
    } else if (found.kind === "interior") {
      enterInterior(found.spec);
    } else if (found.kind === "room") {
      focusRoom(found.spec, found.room);
    }
  };

  // Dashboard-on-demand (Phase 12 §"Dashboard on demand"): a plain-language
  // status request opens a temporary glass summary rather than permanently
  // surrounding the twin with panels — closing it returns to a clean twin.
  // Every other question still goes straight through the normal askOyi
  // pipeline (parseIntent → TwinIntelligenceController), unchanged.
  const askOyiPresentation = async (text: string): Promise<OyiResponse> => {
    const response = await askOyi(text);
    if (/\bstatus\b/i.test(text)) {
      setDashboard({ title: "Luna — Status", text: response.text });
    }
    return response;
  };

  return (
    <div className="relative h-[calc(100vh-7rem)] min-h-[560px] w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
      <div className="absolute inset-0">
        <LunaTwinCanvas quality="high" />
      </div>
      <HoverLabel />

      <div className="pointer-events-none absolute inset-0 flex flex-col gap-3 p-3">
        <LunaCommandHeader estateName={estateName} />

        <div className="flex min-h-0 flex-1 items-start justify-between gap-3">
          <div className="pointer-events-auto">
            <LevelRail
              levels={LUNA_LEVEL_RAIL_ITEMS}
              activeLevelRef={isolatedLevelRef}
              onSelectLevel={(ref) => {
                const level = LUNA_LEVEL_RAIL_ITEMS.find((l) => l.ref === ref);
                isolateLevelAndFly(ref, level?.shortLabel ?? ref);
              }}
            />
          </div>
          <LunaContextCard onEnterSpace={navigateToSpace} />
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="pointer-events-auto flex gap-2">
            <button
              type="button"
              onClick={() => {
                setViewDrawerOpen(false);
                setEngineeringDrawerOpen((open) => !open);
              }}
              className="rounded-xl border border-white/10 bg-black/50 px-4 py-2 text-xs font-medium text-zinc-200 backdrop-blur-xl"
            >
              {engineeringButtonLabel}
            </button>

            <button
              type="button"
              onClick={() => {
                setEngineeringDrawerOpen(false);
                setViewDrawerOpen((open) => !open);
              }}
              className="rounded-xl border border-white/10 bg-black/50 px-4 py-2 text-xs font-medium text-zinc-200 backdrop-blur-xl"
            >
              View
            </button>
          </div>

          <OyiOrb
            onAsk={askOyiPresentation}
            suggestedPrompts={OYI_SUGGESTED_PROMPTS}
          />
        </div>
      </div>

      <EngineeringDrawer
        open={engineeringDrawerOpen}
        onClose={() => setEngineeringDrawerOpen(false)}
        options={engineeringOptions}
        activeSystem={activeSystem}
        onSelectSystem={selectSystem}
      />

      <ScenesDrawer
        title="View"
        description="Apply a spatial view to the active engineering representation"
        closeOnSelect={false}
        open={viewDrawerOpen}
        onClose={() => setViewDrawerOpen(false)}
        scenes={VIEW_OPTIONS}
        activeRef={activeView}
        onSelectScene={selectView}
      />

      {dashboard && (
        <div className="pointer-events-none absolute left-3 top-20">
          <DashboardPanel title={dashboard.title} onClose={() => setDashboard(null)}>
            {dashboard.text}
          </DashboardPanel>
        </div>
      )}

      {activeFloorPlan && (
        <div className="pointer-events-none absolute inset-0 p-3">
          <LunaFloorPlanPanel />
        </div>
      )}
    </div>
  );
}

export interface LunaCommandViewProps {
  estateName: string;
  initialScope: InteractionScope;
  deepLink?: LunaDeepLink;
}

/**
 * Facility OS's building-level operational view for Luna Residences.
 * Composes the reusable engine (LunaTwinProviders/LunaTwinCanvas, from the
 * oyi-twin-engine package) with Spatial Glass chrome (Phase 12) — the
 * standalone dev sidebar/panels are never reused here (Phase 7 §11), and
 * the previous always-open system-nav/asset-panel/scenario-strip layout
 * (Phase 7) is replaced by the same restrained pointer/level-rail/mode-dock/
 * context-card/Oyi-orb primitives the standalone's presentation mode uses —
 * one shared visual language, two different hosts.
 */
export function LunaCommandView({ estateName, initialScope, deepLink }: LunaCommandViewProps) {
  return (
    <LunaTwinProviders initialScope={initialScope} deepLink={deepLink}>
      <LunaCommandViewInner estateName={estateName} />
    </LunaTwinProviders>
  );
}
