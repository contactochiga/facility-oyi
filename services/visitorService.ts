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

  created_at?: string | null;
  expires_at?: string | null;

  // UI helpers (derived)
  full_name: string;
};

export type VisitorTimelineEvent = {
  at: string;
  type: string;
  note: string;
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

  return {
    id: String(x?.id),
    visitor_name,
    visitor_phone,
    purpose: x?.purpose ?? null,
    access_code,
    status: String(x?.status || "active"),
    estate_id: x?.estate_id,
    home_id: x?.home_id ?? null,
    created_at: x?.created_at ?? null,
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
    } catch {
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

  /**
   * FACILITY: GET /facility/visitors/:id/timeline
   */
  async timeline(id: string) {
    try {
      const res = await API.get(`/facility/visitors/${id}/timeline`);
      return res.data as {
        ok?: boolean;
        visitor?: any;
        timeline?: VisitorTimelineEvent[];
        error?: string;
      };
    } catch (err: any) {
      return { error: pickError(err, "Failed to load visitor timeline") };
    }
  },

  /**
   * FACILITY: POST /facility/visitors/actions/lockdown { mode }
   */
  async lockdown(mode: "partial" | "emergency" = "partial") {
    try {
      const res = await API.post("/facility/visitors/actions/lockdown", { mode });
      return res.data as {
        ok?: boolean;
        mode?: string;
        activated_at?: string;
        recipients?: number;
        error?: string;
      };
    } catch (err: any) {
      return { error: pickError(err, "Failed to activate lockdown") };
    }
  },

  /**
   * FACILITY: GET /facility/visitors/reports/export
   */
  async exportReport(params?: { today?: boolean; format?: "json" | "csv" }) {
    const format = params?.format || "json";
    try {
      if (format === "csv") {
        const res = await API.get("/facility/visitors/reports/export", {
          params: { today: params?.today, format: "csv" },
          responseType: "blob",
        });
        const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `visitor-report-${params?.today ? "today" : "all"}.csv`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
        return { ok: true };
      }

      const res = await API.get("/facility/visitors/reports/export", {
        params: { today: params?.today, format: "json" },
      });
      return res.data as {
        ok?: boolean;
        scope?: string;
        summary?: Record<string, number>;
        visitors?: any[];
        generated_at?: string;
        error?: string;
      };
    } catch (err: any) {
      return { error: pickError(err, "Failed to export visitor report") };
    }
  },
};

export default visitorService;
