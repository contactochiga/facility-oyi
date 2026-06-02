import API from "./api";

export type MaintenanceStatus =
  | "new"
  | "open"
  | "assigned"
  | "scheduled"
  | "in_progress"
  | "waiting_for_resident"
  | "waiting_for_parts"
  | "completed"
  | "resolved"
  | "closed"
  | "cancelled"
  | string;

export type MaintenanceItem = {
  id: string;
  title: string;
  status: MaintenanceStatus;
  created_at: string;
  updated_at?: string | null;
  priority?: string | null;
  category?: string | null;
  description?: string | null;
  resident_id?: string | null;
  resident_name?: string | null;
  resident_email?: string | null;
  user_id?: string | null;
  user_name?: string | null;
  user_email?: string | null;
  estate_id?: string | null;
  home_id?: string | null;
  home_name?: string | null;
  room_id?: string | null;
  room_name?: string | null;
  assigned_to?: string | null;
  assigned_operator?: string | null;
  scheduled_at?: string | null;
  schedule_date?: string | null;
  schedule_time?: string | null;
  note?: string | null;
  notes?: string | null;
  completion_notes?: string | null;
  metadata?: Record<string, any> | null;
};

export type MaintenanceUpdatePayload = {
  status?: MaintenanceStatus;
  assigned_to?: string | null;
  note?: string | null;
  scheduled_at?: string | null;
  schedule_date?: string | null;
  schedule_time?: string | null;
  visit_notes?: string | null;
};

function pickError(err: any, fallback: string) {
  return err?.response?.data?.error || err?.response?.data?.message || err?.message || fallback;
}

export const maintenanceService = {
  async list(params?: { status?: string }): Promise<MaintenanceItem[]> {
    const res = await API.get("/facility/maintenance", {
      params: params?.status ? { status: params.status } : undefined,
    });
    return Array.isArray(res.data?.requests) ? res.data.requests : [];
  },

  async update(id: string, payload: MaintenanceUpdatePayload): Promise<{ request?: MaintenanceItem; error?: string }> {
    try {
      const res = await API.patch(`/facility/maintenance/${encodeURIComponent(id)}`, payload);
      return { request: res.data?.request };
    } catch (err: any) {
      return { error: pickError(err, "Failed to update maintenance request") };
    }
  },
};
