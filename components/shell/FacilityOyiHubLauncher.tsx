"use client";

import OyiLauncher from "@/components/oyi-shell/OyiLauncher";
import { useFacilityAssistantStore } from "@/store/useFacilityAssistantStore";

export default function FacilityOyiHubLauncher() {
  const open = useFacilityAssistantStore((state) => state.open);
  const openAssistant = useFacilityAssistantStore((state) => state.openAssistant);
  if (open) return null;
  return <OyiLauncher label="Open Oyi Facility Intelligence" onOpen={() => openAssistant()} controlsId="facility-oyi-panel" />;
}
