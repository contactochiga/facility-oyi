import API from "./api";

export type MaintenanceItem = {
  id: string;
  title: string;
  status: string;
  created_at: string;
};

export const maintenanceService = {
  async list(params?: { status?: string }): Promise<MaintenanceItem[]> {
    const res = await API.get("/facility/maintenance", {
      params: params?.status ? { status: params.status } : undefined,
    });

    // backend returns: { requests: [...] }
    return res.data?.requests || [];
  },
};
