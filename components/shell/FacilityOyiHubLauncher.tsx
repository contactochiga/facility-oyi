"use client";

import { Sparkles } from "lucide-react";
import { useFacilityAssistantStore } from "@/store/useFacilityAssistantStore";

export default function FacilityOyiHubLauncher() {
  const open = useFacilityAssistantStore((state) => state.open);
  const openAssistant = useFacilityAssistantStore((state) => state.openAssistant);
  if (open) return null;
  return (
    <button type="button" onClick={() => openAssistant()} className="fixed bottom-5 right-5 z-[80] hidden h-12 items-center gap-2 rounded-full border border-sky-300/20 bg-[#071523]/95 px-4 text-sm font-medium text-sky-50 shadow-[0_16px_44px_rgba(0,0,0,0.45),0_0_30px_rgba(14,165,233,0.12)] backdrop-blur-xl transition hover:border-sky-300/35 hover:bg-[#0a1c2d] md:inline-flex" aria-label="Open Oyi Facility Intelligence">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-sky-400/15 text-sky-100"><Sparkles className="h-4 w-4" /></span>
      Oyi
    </button>
  );
}
