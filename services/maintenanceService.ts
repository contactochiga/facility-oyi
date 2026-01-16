import API from "./api";

export type MaintenanceItem = {
  id: string;
  title: string;
  status: string;
  created_at: string;
};

export const maintenanceService = {
  async list(): Promise<MaintenanceItem[]> {
    try {
      const res = await API.get("/maintenance?status=open");
      return res.data?.items || res.data || [];
    } catch {
      return [];
    }
  },
};
