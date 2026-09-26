"use client";

import dynamic from "next/dynamic";

// Phase 9 performance requirement: the twin (three.js/@react-three/fiber
// engine bundle) must never load as part of the normal Overview/Live
// Facility View bundle — dynamic + ssr:false defers the import until this
// component actually mounts (i.e. until the "Twin" tab is selected), and
// code-splits it into its own chunk.
export const LunaEmbeddedTwinLazy = dynamic(() => import("./LunaEmbeddedTwin").then((m) => m.LunaEmbeddedTwin), {
  ssr: false,
  loading: () => <div className="min-h-[310px] w-full animate-pulse rounded-lg border border-[var(--ois-border-subtle)] bg-black/20" />,
});
