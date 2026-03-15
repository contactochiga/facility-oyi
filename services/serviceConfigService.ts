import API from "./api";

export type ServiceKey =
  | "utility_token"
  | "water_service"
  | "internet_service"
  | "fiber_internet"
  | "service_charge"
  | "other_facility_fees";

export type ServiceConfig = {
  estate_id: string;
  service_key: ServiceKey;
  title: string;
  description: string;
  suggested_amount: number;
  currency: string;
  active: boolean;
  account_label: string;
  account_hint: string;
  payment_mode: "wallet_only";
  unit_cost?: number | null;
  unit_name?: string | null;
  billing_mode?: "wallet_only" | "metered" | "fixed";
  created_at?: string;
  updated_at?: string;
};

function pickError(err: any, fallback: string) {
  return err?.response?.data?.error || err?.response?.data?.message || err?.message || fallback;
}

export const serviceConfigService = {
  async list(estate_id?: string) {
    try {
      const res = await API.get("/services/config", { params: estate_id ? { estate_id } : undefined });
      return {
        configs: (res.data?.configs || []) as ServiceConfig[],
        using_fallback: Boolean(res.data?.using_fallback),
      };
    } catch (err: any) {
      return { configs: [] as ServiceConfig[], using_fallback: false, error: pickError(err, "Failed to load service configs") } as any;
    }
  },

  async save(
    serviceKey: ServiceKey,
    payload: Partial<Pick<ServiceConfig, "estate_id" | "title" | "description" | "suggested_amount" | "currency" | "active" | "account_label" | "account_hint">>
      & Partial<Pick<ServiceConfig, "unit_cost" | "unit_name" | "billing_mode">>
  ) {
    try {
      const res = await API.patch(`/services/config/${serviceKey}`, payload);
      return res.data as { ok: boolean; config: ServiceConfig };
    } catch (err: any) {
      return { error: pickError(err, "Failed to save service config") } as any;
    }
  },
};

export default serviceConfigService;
