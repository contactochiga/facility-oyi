import { create } from "zustand";

type AssistantState = {
  open: boolean;
  focusHint: string | null;
  source: "search" | "voice" | "assistant";
  openAssistant: (focusHint?: string | null) => void;
  openVoiceAssistant: (focusHint?: string | null) => void;
  closeAssistant: () => void;
};

export const useFacilityAssistantStore = create<AssistantState>((set) => ({
  open: false,
  focusHint: null,
  source: "assistant",
  openAssistant: (focusHint) => set({ open: true, focusHint: focusHint || null, source: "assistant" }),
  openVoiceAssistant: (focusHint) => set({ open: true, focusHint: focusHint || null, source: "voice" }),
  closeAssistant: () => set({ open: false, focusHint: null, source: "assistant" }),
}));
