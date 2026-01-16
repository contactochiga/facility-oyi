import API from "./api";

export type AlertItem = {
  id: string;
  title: string;
  message: string;
  status?: string;
  created_at?: string;
};

export const notificationService = {
  async unread(): Promise<AlertItem[]> {
    try {
      const res = await API.get("/notifications?unread=true");
      return res.data?.items || res.data || [];
    } catch {
      return [];
    }
  },
};
