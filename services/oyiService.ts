import API from "./api";

export type OyiSeverity = "normal" | "info" | "attention" | "critical";
export type OyiAwareness = {
  headline: string;
  body?: string;
  severity: OyiSeverity;
  destination: string;
  cards?: Array<Record<string, any>>;
  sources?: Array<Record<string, any>>;
  score?: number;
  generated_at?: string;
};

export type OyiChatResponse = {
  ok?: boolean;
  message: string;
  cards?: Array<Record<string, any>>;
  sources?: Array<Record<string, any>>;
  suggested_actions?: Array<Record<string, any>>;
  awareness?: OyiAwareness;
  thread_id?: string;
};

export const oyiService = {
  async awareness(input: { estate_id?: string | null; home_id?: string | null } = {}) {
    const res = await API.get("/oyi/awareness", { params: { surface: "facility", ...input } });
    return res.data as OyiAwareness & { ok?: boolean };
  },

  async chat(input: { message: string; estate_id?: string | null; home_id?: string | null; module?: string | null; role?: string | null; thread_id?: string | null }) {
    const res = await API.post("/oyi/chat", { surface: "facility", ...input });
    return res.data as OyiChatResponse;
  },
};
