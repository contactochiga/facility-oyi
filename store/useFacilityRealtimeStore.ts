import { create } from "zustand";

export type FacilityRealtimeStatus = "idle" | "connecting" | "live" | "reconnecting" | "offline";

export type FacilityRealtimeEvent = {
  id: string;
  event: string;
  domain: string;
  receivedAt: string;
  payload: Record<string, any>;
};

type RealtimeState = {
  status: FacilityRealtimeStatus;
  lastConnectedAt: string | null;
  lastEventAt: string | null;
  events: FacilityRealtimeEvent[];
  counts: Record<string, number>;
  setStatus: (status: FacilityRealtimeStatus) => void;
  connected: () => void;
  pushEvent: (event: string, payload: Record<string, any>) => void;
  reset: () => void;
};

function domainFor(event: string) {
  if (/device|edge|registry|discovered/.test(event)) return "infrastructure";
  if (/visitor|gate|access/.test(event)) return "visitors";
  if (/camera/.test(event)) return "cameras";
  if (/security|incident|alert/.test(event)) return "security";
  if (/maintenance/.test(event)) return "maintenance";
  if (/community/.test(event)) return "community";
  if (/notification|office/.test(event)) return "notifications";
  return "system";
}

export const useFacilityRealtimeStore = create<RealtimeState>((set) => ({
  status: "idle",
  lastConnectedAt: null,
  lastEventAt: null,
  events: [],
  counts: {},
  setStatus: (status) => set({ status }),
  connected: () => {
    const now = new Date().toISOString();
    set({ status: "live", lastConnectedAt: now });
  },
  pushEvent: (event, payload) => {
    const now = new Date().toISOString();
    const domain = domainFor(event);
    set((state) => ({
      lastEventAt: now,
      counts: { ...state.counts, [domain]: (state.counts[domain] || 0) + 1 },
      events: [
        {
          id: `${event}:${now}:${state.events.length}`,
          event,
          domain,
          receivedAt: now,
          payload,
        },
        ...state.events,
      ].slice(0, 80),
    }));
  },
  reset: () => set({ status: "idle", lastConnectedAt: null, lastEventAt: null, events: [], counts: {} }),
}));
