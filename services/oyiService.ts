import API from "./api";
import type { OisContext } from "@/store/useContextStore";

export type OyiSeverity = "normal" | "info" | "attention" | "warning" | "critical";
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

  async chat(input: { message: string; estate_id?: string | null; home_id?: string | null; module?: string | null; role?: string | null; thread_id?: string | null; context?: OisContext | null; page?: string | null; route?: string | null; filters?: Record<string, string>; runtime_context?: Record<string, any> | null }) {
    const res = await API.post("/oyi/chat", { surface: "facility", ...input });
    return res.data as OyiChatResponse;
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
