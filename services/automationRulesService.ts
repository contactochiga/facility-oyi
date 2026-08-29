// Automation Workspace UI/UX -- client for the existing, pre-existing
// "Shared Automation Runtime" (Ochiga-backend's src/routes/scenes.ts,
// mounted at /scenes). This is NOT a new automation engine: it's the
// same backend Oyi Consumer already uses for scheduled device scenes,
// extended in earlier phases to also accept Facility-surface registered
// actions.
//
// Cross-Domain Operational Automation -- previously this builder only
// ever created device_command actions, because the registered_action
// lane (visitor.*/maintenance.*) executed on schedule with no approval
// gate at all. Backend has since closed that gap: every registered_action
// item on a scheduled/manual-test run is now policy-checked through the
// same resolver (and same approval_required-by-default) the system-
// detector approval queue already uses -- see scenes.ts's
// executeConsumerAutomation. So this client now supports BOTH action
// shapes Backend actually accepts: device_command (unchanged, always
// executes directly, exactly as Consumer's own device scenes always
// have) and registered_action (visitor/maintenance/notification --
// governed, may queue for approval instead of executing immediately).
import API from "./api";

export type AutomationSurface = "consumer" | "facility" | "office";

export type AutomationScheduleTrigger =
  | { type: "schedule"; schedule_type: "daily"; local_time: string; timezone: string }
  | { type: "schedule"; schedule_type: "weekdays"; local_time: string; weekdays: number[]; timezone: string }
  | { type: "schedule"; schedule_type: "once"; local_datetime: string; timezone: string };

export type AutomationDeviceAction = {
  action_type?: undefined;
  device_id: string;
  command: Record<string, unknown>;
  label?: string | null;
  action_label?: string | null;
};

export type AutomationRegisteredAction = {
  action_type: "registered_action";
  action_id: string;
  entity_id?: string;
  assignee?: string | null;
  label?: string | null;
  command?: Record<string, unknown> | null;
};

export type AutomationRuleAction = AutomationDeviceAction | AutomationRegisteredAction;

// Kept as an alias -- earlier code across this app refers to
// AutomationRuleDeviceAction specifically for the device-command shape.
export type AutomationRuleDeviceAction = AutomationDeviceAction;

export function isRegisteredAction(action: AutomationRuleAction): action is AutomationRegisteredAction {
  return (action as AutomationRegisteredAction)?.action_type === "registered_action";
}

export type AutomationRule = {
  id: string;
  estate_id: string | null;
  home_id: string | null;
  created_by: string | null;
  name: string;
  surface: AutomationSurface;
  trigger: AutomationScheduleTrigger;
  condition: Record<string, unknown>;
  actions: AutomationRuleAction[];
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
  status: "running" | "succeeded" | "partially_succeeded" | "failed" | "skipped" | string;
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

  async create(payload: { name: string; trigger: AutomationScheduleTrigger; actions: AutomationRuleAction[]; enabled: boolean; condition?: Record<string, unknown> }): Promise<{ ok: true; rule: AutomationRule } | { ok: false; error: string; code?: string }> {
    try {
      const res = await API.post("/scenes/automations", { surface: "facility", ...payload });
      return { ok: true, rule: res.data as AutomationRule };
    } catch (err: any) {
      return { ok: false, error: err?.response?.data?.error || err?.message || "Unable to create this automation.", code: err?.response?.data?.code };
    }
  },

  async update(id: string, payload: Partial<{ name: string; trigger: AutomationScheduleTrigger; actions: AutomationRuleAction[]; enabled: boolean; condition: Record<string, unknown> }>): Promise<{ ok: true; rule: AutomationRule } | { ok: false; error: string; code?: string }> {
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
