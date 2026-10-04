"use client";

// Facility launcher orb: the shared OyiOrb renderer (oyi-interaction) with
// Facility's fixed launcher placement ("oyi-shell-orb"). It owns no
// intelligence state; while the panel is closed it reflects connectivity
// only (idle/offline).
import { OyiOrb as SharedOyiOrb, orbStateForView, useOyiConnectivity, useOyiInteraction } from "oyi-interaction";

export default function OyiOrb({ label, onOpen, controlsId }: { label: string; onOpen: () => void; controlsId: string }) {
  const [view, dispatch] = useOyiInteraction();
  useOyiConnectivity(dispatch);
  return (
    <SharedOyiOrb
      state={orbStateForView(view)}
      onActivate={onOpen}
      actionLabel={label}
      controlsId={controlsId}
      expanded={false}
      hasPopup="dialog"
      className="oyi-shell-orb"
    />
  );
}
