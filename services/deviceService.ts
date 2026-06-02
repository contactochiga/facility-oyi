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
    const res = await API.get("/facility/devices");
    const raw = res.data?.devices || res.data || [];
    return raw
      .filter((d: any) => Boolean(d?.id))
      .map((d: any) => ({
        id: String(d.id),
        name: d.name || d.label || "Unnamed Device",
        type: d.type || d.category || "unknown",
        category: d.category || d.type || "unknown",
        status: d.status || (d.online === true ? "online" : d.online === false ? "offline" : "unknown"),
        room: d.room || d.room_name || d.home_name || "Unassigned",
        created_at: d.created_at || undefined,
        metadata: d.metadata || {},
      }));
  },
};
