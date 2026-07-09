import API from "./api";

export type FacilityDevice = {
  id: string;
  name: string;
  type?: string;
  category?: string;
  status?: string;
  normalized_state?: Record<string, any> | null;
  supported_controls?: string[];
  control_profile?: string | null;
  health_status?: string | null;
  provider_health?: string | null;
  primary_state?: string | null;
  telemetry_summary?: Record<string, any> | null;
  activity_summary?: string | null;
  last_signal?: string | null;
  device_family?: string | null;
  device_type?: string | null;
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
        normalized_state: d.normalized_state || null,
        supported_controls: Array.isArray(d.supported_controls) ? d.supported_controls : [],
        control_profile: d.control_profile || null,
        health_status: d.health_status || null,
        provider_health: d.provider_health || null,
        primary_state: d.primary_state || null,
        telemetry_summary: d.telemetry_summary || null,
        activity_summary: d.activity_summary || null,
        last_signal: d.last_signal || null,
        device_family: d.device_family || null,
        device_type: d.device_type || null,
        room: d.room || d.room_name || d.home_name || "Unassigned",
        created_at: d.created_at || undefined,
        metadata: d.metadata || {},
      }));
  },
};
