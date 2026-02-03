// services/visitorService.ts
import API from "./api";

export type VisitorStatus =
  | "active"
  | "approved"
  | "denied"
  | "entered"
  | "exited"
  | "expired"
  | string;

export type VisitorItem = {
  id: string;

  // DB fields
  visitor_name: string;
  visitor_phone: string;
  purpose?: string | null;
  access_code: string;
  status: VisitorStatus;

  estate_id?: string;
  home_id?: string | null;

  created_at: string;
  expires_at?: string | null;

  // UI helpers (derived)
  full_name: string;
};

function pickError(err: any, fallback: string) {
  return (
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    fallback
  );
}

function normalizeItem(x: any): VisitorItem {
  const visitor_name = String(x?.visitor_name || x?.full_name || x?.name || "—");
  const visitor_phone = String(x?.visitor_phone || x?.phone || "—");
  const access_code = String(x?.access_code || x?.code || "—");
  const created_at = String(x?.created_at || new Date().toISOString());

  return {
    id: String(x?.id),
    visitor_name,
    visitor_phone,
    purpose: x?.purpose ?? null,
    access_code,
    status: String(x?.status || "active"),
    estate_id: x?.estate_id,
    home_id: x?.home_id ?? null,
    created_at,
    expires_at: x?.expires_at ?? null,
    full_name: visitor_name,
  };
}

export const visitorService = {
  /**
   * FACILITY: GET /facility/visitors?today=true
   * Expected backend response:
   *  - { visitors: [...] } OR { items: [...] } OR [...]
   */
  async list(params?: { today?: boolean; status?: string }): Promise<VisitorItem[]> {
    try {
      const res = await API.get("/facility/visitors", { params });

      const raw =
        res.data?.visitors ||
        res.data?.items ||
        res.data ||
        [];

      if (res.data?.error) return [];

      return (Array.isArray(raw) ? raw : []).map(normalizeItem);
    } catch (err: any) {
      // keep silent to avoid crashing table
      console.log("visitorService.list error:", pickError(err, "Failed to load visitors"));
      return [];
    }
  },

  async listToday(): Promise<VisitorItem[]> {
    return this.list({ today: true });
  },

  /**
   * FACILITY: POST /facility/visitors/verify  { code }
   */
  async verify(code: string) {
    try {
      const res = await API.post("/facility/visitors/verify", { code });
      return res.data as { valid?: boolean; visitor?: any; error?: string };
    } catch (err: any) {
      return { error: pickError(err, "Failed to verify code") };
    }
  },

  /**
   * FACILITY: PATCH /facility/visitors/:id   { status }
   */
  async updateStatus(id: string, status: string) {
    try {
      const res = await API.patch(`/facility/visitors/${id}`, { status });
      return res.data as { ok?: boolean; visitor?: any; error?: string };
    } catch (err: any) {
      return { error: pickError(err, "Failed to update visitor") };
    }
  },
};

export default visitorService;
