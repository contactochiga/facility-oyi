"use client";

import OyiOrb from "./OyiOrb";

export default function OyiLauncher({ label, onOpen, controlsId }: { label: string; onOpen: () => void; controlsId: string }) {
  return <OyiOrb label={label} onOpen={onOpen} controlsId={controlsId} />;
}
