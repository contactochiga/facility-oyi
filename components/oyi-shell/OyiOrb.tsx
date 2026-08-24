"use client";

export default function OyiOrb({ label, onOpen, controlsId }: { label: string; onOpen: () => void; controlsId: string }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="oyi-shell-orb"
      aria-label={label}
      aria-expanded="false"
      aria-controls={controlsId}
      aria-haspopup="dialog"
    >
      <span aria-hidden="true">Oyi</span>
    </button>
  );
}
