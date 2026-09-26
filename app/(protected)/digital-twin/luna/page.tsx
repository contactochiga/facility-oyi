"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { CanonicalRef, OperationalSystem } from "oyi-twin-engine";
import type { LunaDeepLink } from "@/components/twin/luna/LunaTwinProviders";
import { LunaCommandView } from "@/components/twin/luna/LunaCommandView";
import { deriveLunaScope } from "@/components/twin/luna/deriveLunaScope";
import { useContextStore } from "@/store/useContextStore";

const VALID_SYSTEMS = new Set(["electrical", "water", "fire", "hvac", "vertical-transport", "security", "access", "network-edge", "apartment-devices", "all"]);

/**
 * Facility OS's deep-linkable entry point into the Luna digital twin
 * (Phase 7 §6). Query params: system, asset, space, trigger — e.g.
 * /digital-twin/luna?asset=LUNA-B1-WATER-BP-02&system=water&trigger=water-pressure-fault
 * lands the twin already showing a triggered incident's affected asset.
 */
export default function LunaTwinPage() {
  const searchParams = useSearchParams();
  const { context, loading, refresh } = useContextStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!context && !loading) void refresh();
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deepLink: LunaDeepLink = useMemo(() => {
    const systemParam = searchParams.get("system");
    const assetParam = searchParams.get("asset");
    const spaceParam = searchParams.get("space");
    const triggerParam = searchParams.get("trigger");
    return {
      system: systemParam && VALID_SYSTEMS.has(systemParam) ? (systemParam as OperationalSystem | "all") : undefined,
      assetRef: assetParam ? (assetParam as CanonicalRef) : undefined,
      spaceRef: spaceParam ? (spaceParam as CanonicalRef) : undefined,
      triggerScenario: triggerParam || undefined,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const initialScope = deriveLunaScope(context);
  const estateName = context?.estate?.name || "Luna Residences";

  if (!ready) return null;

  return (
    <div className="space-y-3">
      <LunaCommandView estateName={estateName} initialScope={initialScope} deepLink={deepLink} />
    </div>
  );
}
