import { create } from "zustand";
import {
  decodeToken,
  deleteCookie,
  isExpired,
  setCookie,
  type DecodedToken,
} from "@/lib/auth";

type SessionState = {
  token: string | null;
  user: DecodedToken | null;
  hydrated: boolean;
  hydrate: () => void;
  setToken: (token: string) => void;
  // PHASE 3 UX closure -- merges fields fetched from GET /me/context (e.g.
  // avatar_url) into the current session user. The JWT itself never
  // carries this; it's fetched separately and layered on top.
  patchUser: (patch: Record<string, unknown>) => void;
  clear: () => void;
};

export const useSessionStore = create<SessionState>((set, get) => ({
  token: null,
  user: null,
  hydrated: false,

  hydrate: () => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("oyi_facility_token");
    if (!token) {
      deleteCookie("oyi_facility_token");
      set({ token: null, user: null, hydrated: true });
      return;
    }

    const decoded = decodeToken(token);
    if (!decoded || isExpired(decoded)) {
      localStorage.removeItem("oyi_facility_token");
      deleteCookie("oyi_facility_token");
      set({ token: null, user: null, hydrated: true });
      return;
    }
    set({ token, user: decoded, hydrated: true });
  },

  setToken: (token) => {
    localStorage.setItem("oyi_facility_token", token);
    setCookie("oyi_facility_token", token);
    set({ token, user: decodeToken(token), hydrated: true });
  },

  patchUser: (patch) => {
    const current = get().user;
    if (!current) return;
    set({ user: { ...current, ...patch } as DecodedToken });
  },

  clear: () => {
    localStorage.removeItem("oyi_facility_token");
    deleteCookie("oyi_facility_token");
    set({ token: null, user: null, hydrated: true });
  },
}));
