"use client";

import { useMemo } from "react";
import { useSceneMode, useInteriorFocus, type OperationalSystem } from "oyi-twin-engine";
import { LUNA_LEVELS } from "oyi-twin-engine/luna/lunaProgramme";
import { LUNA_GROUND_LOBBY, LUNA_L01_CLUB, LUNA_L06_APT_A, LUNA_L10_APT_A, LUNA_PENTHOUSE_INTERIOR, LUNA_ROOFTOP_SKY, type InteriorSpec, type RoomLayoutSpec } from "oyi-twin-engine/luna/interiors/lunaInteriors";
import { SYSTEM_ORDER, SYSTEM_LABEL, SYSTEM_COLOR } from "oyi-twin-engine/luna/operational/systemPresentation";
import { lunaRepresentationPolicy } from "oyi-twin-engine/luna/policy/lunaRepresentationPolicy";
import { useLunaTwinHost } from "./lunaTwinHostContext";

const INTERIORS: Array<{ spec: InteriorSpec; enterLabel: string }> = [
  { spec: LUNA_GROUND_LOBBY, enterLabel: "Ground Lobby" },
  { spec: LUNA_L01_CLUB, enterLabel: "Residents' Club" },
  { spec: LUNA_L06_APT_A, enterLabel: "Apartment A (L06)" },
  { spec: LUNA_L10_APT_A, enterLabel: "Premium Residence (L10)" },
  { spec: LUNA_PENTHOUSE_INTERIOR, enterLabel: "Penthouse" },
  { spec: LUNA_ROOFTOP_SKY, enterLabel: "Luna Sky" },
];

function NavSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="px-1 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">{label}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function NavButton({ active, onClick, children, swatch }: { active?: boolean; onClick: () => void; children: React.ReactNode; swatch?: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] transition ${
        active ? "bg-sky-500/15 text-sky-200 ring-1 ring-inset ring-sky-500/30" : "text-zinc-300 hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      {swatch && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: swatch }} />}
      <span className="truncate">{children}</span>
    </button>
  );
}

export function LunaSystemNav({
  onSelectSystem,
  onIsolateLevel,
  onEnterInterior,
  onFocusRoom,
  onExitInterior,
}: {
  onSelectSystem: (system: OperationalSystem | "all" | null) => void;
  onIsolateLevel: (levelRef: string | null, label: string) => void;
  onEnterInterior: (spec: InteriorSpec) => void;
  onFocusRoom: (spec: InteriorSpec, room: RoomLayoutSpec) => void;
  onExitInterior: () => void;
}) {
  const { activeSystem } = useSceneMode();
  const { activeInteriorRef, focusedRoomRef } = useInteriorFocus();
  const { isolatedLevelRef, representationIdentity } = useLunaTwinHost();

  const activeInterior = INTERIORS.find((i) => i.spec.interiorRef === activeInteriorRef)?.spec ?? null;

  // Phase 8 privacy boundary: only interiors this identity is authorized
  // to enter in 3D (Facility-managed common spaces, or a resident's own
  // assigned unit) ever appear as an "Enter Interior" option — a private
  // occupied residence resolves to a 2D-only representation instead and
  // simply isn't offered here as a 3D destination.
  const visibleInteriors = useMemo(
    () =>
      INTERIORS.filter(({ spec }) => {
        const mode = lunaRepresentationPolicy.resolveMode({ ref: spec.interiorRef, identity: representationIdentity });
        return mode === "FULL_3D" || mode === "CONTEXT_3D";
      }),
    [representationIdentity]
  );

  return (
    <div className="pointer-events-auto flex w-64 flex-col gap-4 overflow-y-auto rounded-xl border border-white/10 bg-black/60 p-3 backdrop-blur">
      <NavSection label="Operational Systems">
        <NavButton active={activeSystem === null} onClick={() => onSelectSystem(null)}>
          Systems mode: off
        </NavButton>
        <NavButton active={activeSystem === "all"} onClick={() => onSelectSystem("all")}>
          All systems
        </NavButton>
        {SYSTEM_ORDER.map((system) => (
          <NavButton key={system} active={activeSystem === system} onClick={() => onSelectSystem(system)} swatch={SYSTEM_COLOR[system]}>
            {SYSTEM_LABEL[system]}
          </NavButton>
        ))}
      </NavSection>

      {activeInterior ? (
        <NavSection label={`Inside: ${activeInterior.label}`}>
          <button onClick={onExitInterior} className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-left text-[12px] text-zinc-300 hover:bg-white/[0.08] hover:text-white">
            Exit to exterior
          </button>
          {activeInterior.rooms.map((room) => (
            <NavButton key={room.ref} active={focusedRoomRef === room.ref} onClick={() => onFocusRoom(activeInterior, room)}>
              {room.label}
            </NavButton>
          ))}
        </NavSection>
      ) : (
        <NavSection label="Interiors">
          {visibleInteriors.map(({ spec, enterLabel }) => (
            <NavButton key={spec.interiorRef} onClick={() => onEnterInterior(spec)}>
              {enterLabel}
            </NavButton>
          ))}
        </NavSection>
      )}

      <NavSection label="Levels">
        {[...LUNA_LEVELS].reverse().map((level) => (
          <NavButton
            key={level.ref}
            active={isolatedLevelRef === level.ref}
            onClick={() => onIsolateLevel(isolatedLevelRef === level.ref ? null : level.ref, level.label)}
          >
            {level.label}
          </NavButton>
        ))}
      </NavSection>
    </div>
  );
}
