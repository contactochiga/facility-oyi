import API from "./api";

export type FacilityDevice = {
  id: string;
  name: string;
  type?: string;
  status?: string;
  room?: string;
  created_at?: string;
};

export const deviceService = {
  async list(): Promise<FacilityDevice[]> {
    // Replace later with your real facility endpoint if needed
    // e.g. /facility/devices or /devices?estate_id=...
    try {
      const res = await API.get("/devices/discover");
      const raw = res.data?.devices || res.data || [];
      return raw.map((d: any) => ({
        id: d.id || d.externalId || crypto.randomUUID(),
        name: d.name || "Unnamed Device",
        type: d.category || d.type || "unknown",
        status: d.online ? "active" : d.status || "offline",
        room: d.room || "—",
        created_at: d.created_at || new Date().toISOString(),
      }));
    } catch {
      return [];
    }
  },
};
