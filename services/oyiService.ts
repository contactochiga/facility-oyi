import API from "./api";
import type { OisContext } from "@/store/useContextStore";

export type OyiSeverity = "normal" | "info" | "attention" | "warning" | "critical";
export type TruthState = "confirmed" | "observed" | "inferred" | "predicted" | "pending_confirmation" | "unavailable" | "unsupported" | "permission_restricted";
export type OyiAwareness = {
  headline: string;
  summary?: string;
  body?: string;
  severity: OyiSeverity;
  recommended_action?: string;
  destination: string;
  cards?: Array<Record<string, any>>;
  sources?: Array<Record<string, any>>;
  suggested_actions?: Array<Record<string, any>>;
  awareness_score?: number;
  score?: number;
  generated_at?: string;
};

export type OperationalObject = {
  object_type: string;
  canonical_id: string;
  label: string;
  estate_id: string | null;
  building_id: string | null;
  home_id: string | null;
  room_id: string | null;
  parent_id: string | null;
  source_module: string | null;
  capabilities: string[];
  current_state: string | null;
  health: string | null;
  permissions: string[];
  relationships: Record<string, any>;
  evidence_references: string[];
  metadata: Record<string, any>;
  freshness: string | null;
};

export type CanonicalTruth = {
  title: string;
  body: string;
  truth_state: TruthState;
  severity: OyiSeverity;
  source_event: string | null;
  confidence: number | null;
  object: OperationalObject | null;
  occurred_at: string | null;
  freshness: string | null;
  recommended_actions: Array<Record<string, any>>;
  active_execution: Record<string, any> | null;
  target: Record<string, any> | null;
  technical_details: Record<string, any> | null;
};

export type OyiChatResponse = {
  ok?: boolean;
  message: string;
  reply?: string;
  intent?: string;
  understood?: string;
  execution?: Record<string, any>;
  display_mode?: "conversation" | "list" | "detail" | "audit" | "report" | "awareness";
  cards?: Array<Record<string, any>>;
  sources?: Array<Record<string, any>>;
  suggested_actions?: Array<Record<string, any>>;
  awareness?: OyiAwareness;
  thread_id?: string;
  truth?: CanonicalTruth;
  operational_object?: OperationalObject | null;
  context?: {
    surface: string;
    estate_id: string | null;
    home_id: string | null;
    module: string | null;
    context_source: string;
    warnings: string[];
  };
  confirmations?: Array<Record<string, any>>;
  approvalRequired?: boolean;
  requiresConfirmation?: boolean;
};

export type OyiThread = {
  id: string;
  surface?: string;
  estate_id?: string | null;
  home_id?: string | null;
  module?: string | null;
  title?: string | null;
  created_at?: string;
  updated_at?: string;
  metadata?: Record<string, any>;
};

export type OyiThreadMessage = {
  id: string;
  thread_id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  cards?: Array<Record<string, any>>;
  sources?: Array<Record<string, any>>;
  suggested_actions?: Array<Record<string, any>>;
  metadata?: Record<string, any>;
  created_at?: string;
};

export const oyiService = {
  async awareness(input: { estate_id?: string | null; home_id?: string | null; context?: OisContext | null } = {}) {
    const res = await API.get("/oyi/awareness", { params: { surface: "facility", estate_id: input.context?.estate_id || input.estate_id, home_id: input.context?.home_id || input.home_id } });
    return res.data as OyiAwareness & { ok?: boolean };
  },

  async chat(input: { message: string; estate_id?: string | null; home_id?: string | null; module?: string | null; role?: string | null; thread_id?: string | null; context?: OisContext | null; page?: string | null; route?: string | null; filters?: Record<string, string>; runtime_context?: Record<string, any> | null; operational_object?: Partial<OperationalObject> | null }) {
    const res = await API.post("/oyi/runtime/conversation", {
      message: input.message,
      surface: "facility",
      estate_id: input.context?.estate_id || input.estate_id || null,
      home_id: input.context?.home_id || input.home_id || null,
      module: input.module || input.context?.module || null,
      role: input.role || null,
      thread_id: input.thread_id || null,
      operational_object: input.operational_object || null,
      context: { ...(input.context || {}), runtime_context: input.runtime_context || null, page: input.page || null, route: input.route || null, filters: input.filters || {} },
    });
    const runtime = res.data?.response || {};
    return {
      ok: Boolean(res.data?.ok),
      message: runtime.message || runtime.reply || "",
      reply: runtime.reply || runtime.message || "",
      intent: runtime.intent,
      understood: runtime.understood,
      execution: runtime.execution,
      display_mode: runtime.display_mode,
      cards: Array.isArray(runtime.cards) ? runtime.cards : [],
      sources: Array.isArray(runtime.sources) ? runtime.sources : [],
      suggested_actions: Array.isArray(runtime.suggested_actions) ? runtime.suggested_actions : [],
      awareness: runtime.awareness,
      thread_id: runtime.thread_id,
      truth: runtime.truth || undefined,
      operational_object: runtime.operational_object || null,
      context: runtime.context || undefined,
      confirmations: Array.isArray(runtime.confirmations) ? runtime.confirmations : [],
      approvalRequired: Boolean(runtime.approvalRequired),
      requiresConfirmation: Boolean(runtime.requiresConfirmation),
    } as OyiChatResponse;
  },

  async listThreads(input: { estate_id?: string | null; home_id?: string | null; limit?: number; context?: OisContext | null } = {}) {
    const res = await API.get("/oyi/threads", { params: { surface: "facility", estate_id: input.context?.estate_id || input.estate_id, home_id: input.context?.home_id || input.home_id, limit: input.limit } });
    return res.data as { ok?: boolean; threads?: OyiThread[] };
  },

  async getThreadMessages(threadId: string) {
    const res = await API.get(`/oyi/threads/${encodeURIComponent(threadId)}/messages`);
    return res.data as { ok?: boolean; thread?: OyiThread; messages?: OyiThreadMessage[] };
  },
};
