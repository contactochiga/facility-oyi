import API from "./api";

export type SuperAdminOverview = {
  estates: number;
  homes: number;
  users: number;
  devices: number;
  cameras: number;
  wallets: number;
  walletTransactions: number;
  notifications: number;
  maintenanceRequests: number;
  communityPosts: number;
  messages: number;
};

export const superAdminService = {
  async overview() {
    const res = await API.get("/super-admin/overview");
    return res.data as { ok: boolean; metrics: SuperAdminOverview };
  },

  async estates(limit = 50, q = "") {
    const res = await API.get("/super-admin/estates", { params: { limit, q } });
    return res.data as { ok: boolean; items: any[] };
  },

  async homes(limit = 100, q = "") {
    const res = await API.get("/super-admin/homes", { params: { limit, q } });
    return res.data as { ok: boolean; items: any[] };
  },

  async devices(limit = 100, q = "") {
    const res = await API.get("/super-admin/devices", { params: { limit, q } });
    return res.data as { ok: boolean; items: any[] };
  },

  async transactions(limit = 100, q = "") {
    const res = await API.get("/super-admin/transactions", { params: { limit, q } });
    return res.data as { ok: boolean; items: any[] };
  },

  async activities(limit = 120) {
    const res = await API.get("/super-admin/activities", { params: { limit } });
    return res.data as { ok: boolean; items: any[] };
  },
};

export default superAdminService;
