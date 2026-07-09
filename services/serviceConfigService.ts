import API from "./api";

export type ServiceConfig = {
  estate_id?: string | null;
  service_key: string;
  key?: string;
  title?: string | null;
  description?: string | null;
  active?: boolean | null;
  enabled?: boolean | null;
  status?: string | null;
  suggested_amount?: number | string | null;
  unit_cost?: number | string | null;
  unit_name?: string | null;
  billing_mode?: string | null;
  account_label?: string | null;
  account_hint?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  metadata?: Record<string, any> | null;
};

export type ServiceConfigPatch = Partial<ServiceConfig> & { active?: boolean; enabled?: boolean };

function listFrom(data: any): ServiceConfig[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.services)) return data.services;
  if (Array.isArray(data?.configs)) return data.configs;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function pickError(err: any, fallback: string) {
  return err?.response?.data?.error || err?.response?.data?.message || err?.message || fallback;
}

export const serviceConfigService = {
  async list(): Promise<{ configs: ServiceConfig[]; error?: string }> {
    try {
      const res = await API.get("/services/config");
      return { configs: listFrom(res.data) };
    } catch (err: any) {
      return { configs: [], error: pickError(err, "Service configuration source unavailable") };
    }
  },

  async update(serviceKey: string, payload: ServiceConfigPatch): Promise<{ config?: ServiceConfig; error?: string }> {
    try {
      const res = await API.patch(`/services/config/${encodeURIComponent(serviceKey)}`, payload);
      return { config: res.data?.config || res.data?.service || res.data };
    } catch (err: any) {
      return { error: pickError(err, "Failed to update service configuration") };
    }
  },
};

export default serviceConfigService;
