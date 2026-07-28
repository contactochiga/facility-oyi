import { create } from "zustand";

export type FacilityActiveIntelligenceContext = {
  context_id: string;
  context_version: number;
  registered_at: string;
  surface: "facility";
  module: string;
  route: string;
  scope: {
    estate_id: string | null;
    building_id: string | null;
    home_id: string | null;
    unit_id: string | null;
    room_id: string | null;
  };
  primary_object: {
    object_type: string;
    canonical_id: string;
    label: string;
    privacy_class: string | null;
    source_module: string | null;
  } | null;
  selected_subobject: {
    object_type: string;
    canonical_id: string;
    label: string;
    parent_id: string | null;
    metadata: Record<string, unknown>;
  } | null;
  visible_state: {
    data_version: string | null;
    freshness: string | null;
    current_state: string | null;
    health: string | null;
    summary: Record<string, unknown>;
  } | null;
  source: "page" | "drawer" | "modal" | "selected_card" | "detail_panel" | "map" | "digital_twin" | "route_fallback";
  permissions: string[];
  ownership: Record<string, unknown> | null;
};

type AssistantState = {
  open: boolean;
  focusHint: string | null;
  source: "search" | "voice" | "assistant";
  activeContext: FacilityActiveIntelligenceContext | null;
  contextVersion: number;
  openAssistant: (focusHint?: string | null, activeContext?: FacilityActiveIntelligenceContext | null) => void;
  openVoiceAssistant: (focusHint?: string | null) => void;
  closeAssistant: () => void;
};

export const useFacilityAssistantStore = create<AssistantState>((set) => ({
  open: false,
  focusHint: null,
  source: "assistant",
  activeContext: null,
  contextVersion: 0,
  openAssistant: (focusHint, activeContext) => set((state) => ({ open: true, focusHint: focusHint || null, source: "assistant", activeContext: activeContext || state.activeContext, contextVersion: activeContext ? activeContext.context_version : state.contextVersion })),
  openVoiceAssistant: (focusHint) => set({ open: true, focusHint: focusHint || null, source: "voice" }),
  closeAssistant: () => set({ open: false, focusHint: null, source: "assistant" }),
}));
