"use client";

import { create } from "zustand";
import API from "@/services/api";

export type FacilityEstateContext = { id: string; name: string | null; role?: string | null };
export type OisContext = {
  actor_id: string;
  surface: "facility" | string;
  role: string;
  permissions: string[];
  estate_id: string | null;
  home_id: string | null;
  module: string | null;
  resolved_at: string;
  estate: FacilityEstateContext | null;
  available_estates: FacilityEstateContext[];
};

type ContextState = {
  context: OisContext | null;
  loading: boolean;
  switching: boolean;
  error: string | null;
  refresh: (estateId?: string | null) => Promise<OisContext | null>;
  selectEstate: (estateId: string) => Promise<{ ok: boolean; error?: string }>;
  clear: () => void;
};

const STORAGE_KEY = "oyi_facility_active_estate_id";

function rememberedEstate() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

function announce(context: OisContext | null) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("facility:context-changed", { detail: { context } }));
}

export const useContextStore = create<ContextState>((set, get) => ({
  context: null,
  loading: false,
  switching: false,
  error: null,
  refresh: async (estateId) => {
    set({ loading: true, error: null });
    try {
      const requestedEstate = estateId === undefined ? get().context?.estate_id || rememberedEstate() : estateId;
      const response = await API.get("/me/context/resolved", { params: { surface: "facility", estate_id: requestedEstate || undefined } });
      const context = (response.data?.context || null) as OisContext | null;
      if (context?.estate_id && typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, context.estate_id);
      set({ context, loading: false, error: null });
      announce(context);
      return context;
    } catch (error: any) {
      const message = String(error?.response?.data?.error || "Unable to resolve facility context");
      set({ loading: false, error: message });
      return null;
    }
  },
  selectEstate: async (estateId) => {
    set({ switching: true, error: null });
    const context = await get().refresh(estateId);
    set({ switching: false });
    return context?.estate_id === estateId ? { ok: true } : { ok: false, error: get().error || "estate_context_unavailable" };
  },
  clear: () => {
    if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
    set({ context: null, loading: false, switching: false, error: null });
    announce(null);
  },
}));
