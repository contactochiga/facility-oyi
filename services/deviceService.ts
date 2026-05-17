import API from "./api";

export type FacilityDevice = {
  id: string;
  name: string;
  type?: string;
  category?: string;
  status?: string;
  room?: string;
  created_at?: string;
  metadata?: Record<string, any>;
};

export const deviceService = {
  async list(): Promise<FacilityDevice[]> {
    try {
      const res = await API.get("/facility/devices");
      const raw = res.data?.devices || res.data || [];
      return raw.map((d: any) => ({
        id: d.id || d.externalId || crypto.randomUUID(),
        name: d.name || d.label || "Unnamed Device",
        type: d.type || d.category || "unknown",
        category: d.category || d.type || "unknown",
        status: d.status || (d.online ? "active" : "offline"),
        room: d.room || d.room_name || d.home_name || "—",
        created_at: d.created_at || new Date().toISOString(),
        metadata: d.metadata || {},
      }));
    } catch {
      return [];
    }
  },
};
