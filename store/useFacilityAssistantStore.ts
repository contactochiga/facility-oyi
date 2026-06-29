import { create } from "zustand";

type AssistantState = {
  open: boolean;
  focusHint: string | null;
  openAssistant: (focusHint?: string | null) => void;
  closeAssistant: () => void;
};

export const useFacilityAssistantStore = create<AssistantState>((set) => ({
  open: false,
  focusHint: null,
  openAssistant: (focusHint) => set({ open: true, focusHint: focusHint || null }),
  closeAssistant: () => set({ open: false, focusHint: null }),
}));
