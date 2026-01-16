import API from "./api";

export type VisitorItem = {
  id: string;
  full_name: string;
  status: string;
  created_at: string;
};

export const visitorService = {
  async listToday(): Promise<VisitorItem[]> {
    try {
      const res = await API.get("/visitors?today=true");
      return res.data?.items || res.data || [];
    } catch {
      return [];
    }
  },
};
