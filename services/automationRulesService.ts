// Automation Workspace UI/UX completion -- client for the existing,
// pre-existing "Shared Automation Runtime" (Ochiga-backend's
// src/routes/scenes.ts, mounted at /scenes). This is NOT a new
// automation engine: it's the same backend Oyi Consumer already uses for
// scheduled device scenes, extended in an earlier phase to also accept
// Facility-surface registered actions. No new backend engine was created
// for this workspace -- this file only calls the real, already-shipped
// contract.
//
// Scope for THIS pass: only device (Assets) actions are createable here.
// Facility's registered_action lane (visitor.*/maintenance.*) executes
// on schedule with no approval gate at all (confirmed by reading
// executeConsumerAutomation/executeRegisteredActionBatch directly --
// neither consults automationPolicyResolver or automation_approvals).
// Wiring that lane into a user-facing builder would let a Facility admin
// schedule an automatic maintenance/visitor action that bypasses the
// approval-required governance built for exactly those domains. Device
// scenes carry no such regression (they've always executed directly,
// the same way Consumer's device scenes always have), so only Assets is
// offered as a creatable domain this pass.
import API from "./api";

export type AutomationSurface = "consumer" | "facility" | "office";

export type AutomationScheduleTrigger =
  | { type: "schedule"; schedule_type: "daily"; local_time: string; timezone: string }
  | { type: "schedule"; schedule_type: "weekdays"; local_time: string; weekdays: number[]; timezone: string }
  | { type: "schedule"; schedule_type: "once"; local_datetime: string; timezone: string };

export type AutomationRuleDeviceAction = {
  device_id: string;
  command: Record<string, unknown>;
  label?: string | null;
  action_label?: string | null;
};

export type AutomationRule = {
  id: string;
  estate_id: string | null;
  home_id: string | null;
  created_by: string | null;
  name: string;
  surface: AutomationSurface;
  trigger: AutomationScheduleTrigger;
  condition: Record<string, unknown>;
  actions: AutomationRuleDeviceAction[];
  enabled: boolean;
  timezone: string;
  next_run_at: string | null;
  last_run_at?: string | null;
  last_run_status?: string | null;
  created_at: string;
  updated_at?: string | null;
};

export type AutomationRuleRun = {
  id: string;
  automation_id: string;
  status: "running" | "succeeded" | "partially_succeeded" | "failed" | string;
  source: "scheduled" | "manual_test" | string;
  scheduled_for: string;
  started_at: string;
  completed_at: string | null;
  counts: { total: number; completed: number; failed: number };
  actions: Array<Record<string, unknown>>;
  error_code?: string | null;
  error_message?: string | null;
};

function unwrapRules(data: any): AutomationRule[] {
  const rows: AutomationRule[] = Array.isArray(data?.automations) ? data.automations : [];
  // Defense-in-depth: the backend now honors ?surface=facility (see the
  // companion Backend change), but this client-side filter is kept as a
  // second, independent guarantee that a Facility surface never renders
  // or acts on another surface's automation, even if the query param is
  // ever dropped, changed, or bypassed by a future caller.
  return rows.filter((row) => row.surface === "facility");
}

export const automationRulesService = {
  async list(): Promise<{ available: boolean; automations: AutomationRule[]; error?: string }> {
    try {
      const res = await API.get("/scenes/automations", { params: { surface: "facility" } });
      return { available: Boolean(res.data?.available), automations: unwrapRules(res.data) };
    } catch (err: any) {
      return { available: false, automations: [], error: err?.response?.data?.error || err?.message || "Unable to load automations." };
    }
  },

  async create(payload: { name: string; trigger: AutomationScheduleTrigger; actions: AutomationRuleDeviceAction[]; enabled: boolean; condition?: Record<string, unknown> }): Promise<{ ok: true; rule: AutomationRule } | { ok: false; error: string; code?: string }> {
    try {
      const res = await API.post("/scenes/automations", { surface: "facility", ...payload });
      return { ok: true, rule: res.data as AutomationRule };
    } catch (err: any) {
      return { ok: false, error: err?.response?.data?.error || err?.message || "Unable to create this automation.", code: err?.response?.data?.code };
    }
  },

  async update(id: string, payload: Partial<{ name: string; trigger: AutomationScheduleTrigger; actions: AutomationRuleDeviceAction[]; enabled: boolean; condition: Record<string, unknown> }>): Promise<{ ok: true; rule: AutomationRule } | { ok: false; error: string; code?: string }> {
    try {
      const res = await API.patch(`/scenes/automations/${id}`, payload);
      return { ok: true, rule: res.data as AutomationRule };
    } catch (err: any) {
      return { ok: false, error: err?.response?.data?.error || err?.message || "Unable to update this automation.", code: err?.response?.data?.code };
    }
  },

  async setEnabled(id: string, enabled: boolean) {
    return this.update(id, { enabled });
  },

  async remove(id: string): Promise<{ ok: boolean; error?: string }> {
    try {
      await API.delete(`/scenes/automations/${id}`);
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.response?.data?.error || err?.message || "Unable to delete this automation." };
    }
  },

  async runNow(id: string): Promise<{ ok: boolean; status?: string; error?: string }> {
    try {
      const res = await API.post(`/scenes/automations/${id}/test`);
      return { ok: Boolean(res.data?.ok), status: res.data?.status };
    } catch (err: any) {
      return { ok: false, error: err?.response?.data?.error || err?.message || "Unable to run this automation." };
    }
  },

  async runs(id: string): Promise<AutomationRuleRun[]> {
    try {
      const res = await API.get(`/scenes/automations/${id}/runs`);
      return Array.isArray(res.data?.runs) ? res.data.runs : [];
    } catch {
      return [];
    }
  },
};
