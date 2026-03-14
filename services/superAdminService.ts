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

  async auditLogs(limit = 120) {
    const res = await API.get("/super-admin/audit-logs", { params: { limit } });
    return res.data as { ok: boolean; items: any[] };
  },

  async estateSummary(estateId: string) {
    const res = await API.get(`/super-admin/estates/${encodeURIComponent(estateId)}/summary`);
    return res.data as { ok: boolean; estate: any; metrics: any; maintenance: any[]; cameras: any[] };
  },

  async setEstateStatus(estateId: string, status: "active" | "suspended") {
    const res = await API.post(`/super-admin/estates/${encodeURIComponent(estateId)}/status`, { status });
    return res.data as { ok: boolean; estate: any };
  },

  async setUserStatus(userId: string, status: "active" | "suspended") {
    const res = await API.post(`/super-admin/users/${encodeURIComponent(userId)}/status`, { status });
    return res.data as { ok: boolean; user: any };
  },

  async setDeviceDisabled(deviceId: string, disabled: boolean) {
    const res = await API.post(`/super-admin/devices/${encodeURIComponent(deviceId)}/disable`, { disabled });
    return res.data as { ok: boolean; device: any };
  },

  async setWalletFrozen(walletId: string, frozen: boolean) {
    const res = await API.post(`/super-admin/wallets/${encodeURIComponent(walletId)}/freeze`, { frozen });
    return res.data as { ok: boolean; wallet: any };
  },
};

export default superAdminService;
