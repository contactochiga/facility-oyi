// services/notificationService.ts
import API from "./api";

export type AlertItem = {
  id: string;
  title: string;
  message: string;
  status?: string;
  created_at?: string;
  type?: string;
  estate_id?: string;
  acknowledged_at?: string | null;
  assigned_at?: string | null;
  assigned_to?: string | null;
  resolved_at?: string | null;
  resolution_note?: string | null;
};

function unwrapList(data: any): AlertItem[] {
  // supports: {items:[...]} OR [...] OR {data:[...]} etc
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

export const notificationService = {
  async unread(): Promise<AlertItem[]> {
    try {
      const res = await API.get("/notifications?unread=true");
      return unwrapList(res.data);
    } catch {
      return [];
    }
  },

  // ✅ optional: only works if your backend has it
  async markRead(id: string): Promise<boolean> {
    try {
      await API.post(`/notifications/read/${id}`);
      return true;
    } catch {
      return false;
    }
  },

  async updateLifecycle(id: string, payload: { status: "acknowledged" | "assigned" | "resolved"; assigned_to?: string; resolution_note?: string }): Promise<{ item?: AlertItem; error?: string }> {
    try {
      const res = await API.patch(`/notifications/${id}/lifecycle`, payload);
      return { item: res.data?.item || res.data?.notification || res.data };
    } catch (error: any) {
      return { error: String(error?.response?.data?.error || error?.response?.data?.message || "Unable to update alert lifecycle") };
    }
  },
};
