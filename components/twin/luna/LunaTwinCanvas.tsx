"use client";

import { Suspense, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { CameraRig, Lighting, useSelection, shadowsEnabledFor, dprFor, type RenderQuality } from "oyi-twin-engine";
import { LunaBuilding } from "oyi-twin-engine/luna/LunaBuilding";
import { LUNA_CAMERA_PRESETS } from "oyi-twin-engine/luna/lunaCameraPresets";
import { useLunaTwinHost } from "./lunaTwinHostContext";

export interface LunaTwinCanvasProps {
  /** Render-quality profile (Phase 11 §22) — the embedded dashboard card
   * passes "embedded" for a lighter GPU footprint; the full Command View
   * passes "high". Defaults to "standard" (facility-oyi didn't have this
   * concept before Phase 11, so an unset caller keeps prior behavior). */
  quality?: RenderQuality;
}

/**
 * Pure render surface for the Luna twin — all state/navigation lives in
 * LunaTwinProviders (via useLunaTwinHost), matching the same
 * engine/component boundary the standalone Oyi-Twin-Engine's App.tsx
 * already establishes. Facility OS only ever composes these two pieces
 * plus its own chrome (LunaCommandView) around them; it never reimplements
 * scene logic.
 */
export function LunaTwinCanvas({ quality = "standard" }: LunaTwinCanvasProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { flightTarget } = useLunaTwinHost();
  const { select } = useSelection();

  return (
    <div className="h-full w-full">
      <Canvas
        shadows={shadowsEnabledFor(quality)}
        dpr={dprFor(quality)}
        camera={{ position: LUNA_CAMERA_PRESETS.exteriorHero.position, fov: 42, near: 0.1, far: 2600 }}
        gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05, localClippingEnabled: true }}
        onPointerMissed={() => select(null)}
      >
        <color attach="background" args={["#0e1116"]} />
        {/* Phase 15B — far raised alongside the Canvas far plane so Ring 2
            context (out to ~650 units) stays visible in this embedded host
            too, not just the standalone dev harness. */}
        <fog attach="fog" args={["#0e1116", 100, 1250]} />
        <Suspense fallback={null}>
          <Lighting quality={quality} />
          <LunaBuilding />
        </Suspense>
        <CameraRig ref={controlsRef} flightTarget={flightTarget} />
      </Canvas>
    </div>
  );
}
