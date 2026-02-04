// services/notificationService.ts
import API from "./api";

export type AlertItem = {
  id: string;
  title: string;
  message: string;
  status?: string;
  created_at?: string;
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
};
