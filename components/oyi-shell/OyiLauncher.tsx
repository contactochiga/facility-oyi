"use client";

import { Sparkles } from "lucide-react";

export default function OyiLauncher({ label, onOpen, controlsId }: { label: string; onOpen: () => void; controlsId: string }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="oyi-shell-launcher"
      aria-label={label}
      aria-expanded="false"
      aria-controls={controlsId}
    >
      <span className="oyi-shell-launcher-mark" aria-hidden="true"><Sparkles /></span>
      <span>Oyi</span>
    </button>
  );
}
