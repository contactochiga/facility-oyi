import { create } from "zustand";
import { oyiService, type OyiChatResponse, type OyiThreadMessage } from "@/services/oyiService";
import type { OisContext } from "@/store/useContextStore";

export type FacilityChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
  cards?: Array<Record<string, any>>;
  sources?: Array<Record<string, any>>;
  suggested_actions?: Array<Record<string, any>>;
  intent?: string;
  understood?: string;
  execution?: Record<string, any>;
  display_mode?: "conversation" | "list" | "detail" | "audit" | "report" | "awareness";
};

type FacilityThreadSummary = {
  id: string;
  title?: string | null;
  updated_at?: string;
};

type SendArgs = {
  message: string;
  context?: OisContext | null;
  estateId?: string | null;
  homeId?: string | null;
  role?: string | null;
  module?: string | null;
  page?: string | null;
  route?: string | null;
  filters?: Record<string, string>;
  focusHint?: string | null;
};

type ConversationState = {
  messages: FacilityChatMessage[];
  threads: FacilityThreadSummary[];
  threadId: string | null;
  busy: boolean;
  loading: boolean;
  hydratedFor: string | null;
  error: string | null;
  hydrate: (args: { context?: OisContext | null; estateId?: string | null; homeId?: string | null; userId?: string | null; force?: boolean }) => Promise<void>;
  restoreThread: (threadId: string) => Promise<void>;
  sendMessage: (args: SendArgs) => Promise<OyiChatResponse | null>;
  resetConversation: () => void;
  clearError: () => void;
};

function id() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function initialAssistantMessage() {
  return {
    id: id(),
    role: "assistant" as const,
    content: "Operational intelligence is ready. Ask Oyi about attention, verification, ownership, or continuity.",
  };
}

function messageFromThread(row: OyiThreadMessage): FacilityChatMessage {
  const metadata = row.metadata || {};
  return {
    id: row.id,
    role: row.role === "user" ? "user" : "assistant",
    content: row.content || "",
    cards: row.cards || [],
    sources: row.sources || [],
    suggested_actions: row.suggested_actions || [],
    intent: typeof metadata.intent === "string" ? metadata.intent : undefined,
    understood: typeof metadata.understood === "string" ? metadata.understood : undefined,
    execution: metadata.execution && typeof metadata.execution === "object" ? metadata.execution as Record<string, any> : undefined,
    display_mode: typeof metadata.display_mode === "string" ? metadata.display_mode as FacilityChatMessage["display_mode"] : "conversation",
  };
}

export const useFacilityConversationStore = create<ConversationState>((set, get) => ({
  messages: [],
  threads: [],
  threadId: null,
  busy: false,
  loading: false,
  hydratedFor: null,
  error: null,
  async hydrate(args) {
    const key = `${args.userId || "anon"}:${args.context?.estate_id || args.estateId || "none"}:${args.context?.home_id || args.homeId || "none"}`;
    if (!args.force && get().hydratedFor === key && (get().messages.length || get().loading)) return;
    set({ loading: true, error: null });
    try {
      const result = await oyiService.listThreads({
        context: args.context,
        estate_id: args.context?.estate_id || args.estateId || null,
        home_id: args.context?.home_id || args.homeId || null,
        limit: 24,
      });
      const threads = result.threads || [];
      if (!threads.length) {
        set({
          threads: [],
          threadId: null,
          messages: [initialAssistantMessage()],
          hydratedFor: key,
          loading: false,
        });
        return;
      }
      const latest = threads[0];
      const thread = await oyiService.getThreadMessages(latest.id);
      set({
        threads: threads.map((row) => ({ id: row.id, title: row.title, updated_at: row.updated_at })),
        threadId: latest.id,
        messages: (thread.messages || []).map(messageFromThread),
        hydratedFor: key,
        loading: false,
      });
    } catch {
      set({
        messages: [initialAssistantMessage()],
        hydratedFor: key,
        loading: false,
      });
    }
  },
  async restoreThread(nextThreadId) {
    try {
      const result = await oyiService.getThreadMessages(nextThreadId);
      set({
        threadId: nextThreadId,
        messages: (result.messages || []).map(messageFromThread),
        error: null,
      });
    } catch {
      set({ error: "That conversation is no longer available." });
    }
  },
  async sendMessage(args) {
    const message = String(args.message || "").trim();
    if (!message || get().busy) return null;
    const pendingId = id();
    set((state) => ({
      busy: true,
      error: null,
      messages: [
        ...state.messages,
        { id: id(), role: "user", content: message },
        { id: pendingId, role: "assistant", content: "Reviewing live operational context…", pending: true },
      ],
    }));
    try {
      const response = await oyiService.chat({
        message,
        estate_id: args.context?.estate_id || args.estateId || null,
        home_id: args.context?.home_id || args.homeId || null,
        module: args.module || null,
        role: args.role || null,
        thread_id: get().threadId,
        context: args.context,
        page: args.page,
        route: args.route,
        filters: args.filters,
        runtime_context: {
          focus_hint: args.focusHint || null,
          page: args.page || null,
          module: args.module || null,
          estate_name: args.context?.estate?.name || null,
          home_id: args.context?.home_id || null,
          filters: args.filters || {},
        },
      });
      const threadId = response.thread_id || get().threadId;
      set((state) => ({
        busy: false,
        threadId,
        threads: threadId
          ? [{ id: threadId, title: message.slice(0, 96), updated_at: new Date().toISOString() }, ...state.threads.filter((thread) => thread.id !== threadId)].slice(0, 24)
          : state.threads,
        messages: state.messages.map((item) =>
          item.id === pendingId
            ? {
                ...item,
                pending: false,
                content: response.reply || response.message || "Operational review completed.",
                cards: Array.isArray(response.cards) ? response.cards : [],
                sources: Array.isArray(response.sources) ? response.sources : [],
                suggested_actions: Array.isArray(response.suggested_actions) ? response.suggested_actions : [],
                intent: response.intent,
                understood: response.understood,
                execution: response.execution,
                display_mode: response.display_mode || "conversation",
              }
            : item
        ),
      }));
      return response;
    } catch (error: any) {
      set((state) => ({
        busy: false,
        error: error?.response?.data?.error || "Oyi could not reach the operational runtime right now.",
        messages: state.messages.map((item) =>
          item.id === pendingId
            ? { ...item, pending: false, content: error?.response?.data?.error || "Oyi could not reach the operational runtime right now." }
            : item
        ),
      }));
      return null;
    }
  },
  resetConversation() {
    set({
      threadId: null,
      threads: [],
      messages: [],
      busy: false,
      loading: false,
      error: null,
      hydratedFor: null,
    });
  },
  clearError() {
    set({ error: null });
  },
}));
