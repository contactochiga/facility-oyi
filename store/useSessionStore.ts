import { create } from "zustand";
import { decodeToken, isExpired, type DecodedToken } from "@/lib/auth";

type SessionState = {
  token: string | null;
  user: DecodedToken | null;
  hydrate: () => void;
  setToken: (token: string) => void;
  clear: () => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  token: null,
  user: null,

  hydrate: () => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("oyi_facility_token");
    if (!token) return;

    const decoded = decodeToken(token);
    if (!decoded || isExpired(decoded)) {
      localStorage.removeItem("oyi_facility_token");
      return;
    }
    set({ token, user: decoded });
  },

  setToken: (token) => {
    localStorage.setItem("oyi_facility_token", token);
    set({ token, user: decodeToken(token) });
  },

  clear: () => {
    localStorage.removeItem("oyi_facility_token");
    set({ token: null, user: null });
  },
}));
