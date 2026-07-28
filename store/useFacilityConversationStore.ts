import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { oyiService, type OperationalObject, type OyiChatResponse, type OyiThreadMessage } from "@/services/oyiService";
import type { OisContext } from "@/store/useContextStore";
import type { FacilityActiveIntelligenceContext } from "@/store/useFacilityAssistantStore";

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
  operationalObject?: Partial<OperationalObject> | null;
  activeIntelligenceContext?: FacilityActiveIntelligenceContext | null;
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

export const useFacilityConversationStore = create<ConversationState>()(persist((set, get) => ({
  messages: [],
  threads: [],
  threadId: null,
  busy: false,
  loading: false,
  hydratedFor: null,
  error: null,
  async hydrate(args) {
    const key = `${args.userId || "anon"}:${args.context?.estate_id || args.estateId || "none"}:${args.context?.home_id || args.homeId || "none"}`;
    const state = get();
    if (!args.force && state.hydratedFor === key && (state.messages.length || state.loading)) return;
    if (!args.force && state.messages.some((message) => message.pending)) {
      set({ hydratedFor: key });
      return;
    }
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
        set((current) => ({
          threads: current.threads,
          threadId: current.threadId,
          messages: current.messages.length ? current.messages : [initialAssistantMessage()],
          hydratedFor: key,
          loading: false,
        }));
        return;
      }
      const preferredThread = threads.find((row) => row.id === get().threadId) || threads[0];
      if (!args.force && get().threadId === preferredThread.id && get().messages.length) {
        set({
          threads: threads.map((row) => ({ id: row.id, title: row.title, updated_at: row.updated_at })),
          hydratedFor: key,
          loading: false,
        });
        return;
      }
      const thread = await oyiService.getThreadMessages(preferredThread.id);
      set({
        threads: threads.map((row) => ({ id: row.id, title: row.title, updated_at: row.updated_at })),
        threadId: preferredThread.id,
        messages: (thread.messages || []).length ? (thread.messages || []).map(messageFromThread) : (get().messages.length ? get().messages : [initialAssistantMessage()]),
        hydratedFor: key,
        loading: false,
      });
    } catch {
      set((current) => ({
        messages: current.messages.length ? current.messages : [initialAssistantMessage()],
        hydratedFor: key,
        loading: false,
      }));
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
    const key = `active:${args.context?.estate_id || args.estateId || "none"}:${args.context?.home_id || args.homeId || "none"}`;
    set((state) => ({
      busy: true,
      error: null,
      hydratedFor: state.hydratedFor || key,
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
        operational_object: args.operationalObject || null,
        runtime_context: {
          focus_hint: args.focusHint || null,
          page: args.page || null,
          module: args.module || null,
          estate_name: args.context?.estate?.name || null,
          home_id: args.context?.home_id || null,
          filters: args.filters || {},
          active_context: args.activeIntelligenceContext || null,
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
}), {
  name: "facility-oyi-conversation",
  storage: createJSONStorage(() => sessionStorage),
  partialize: (state) => ({
    messages: state.messages,
    threads: state.threads,
    threadId: state.threadId,
    hydratedFor: state.hydratedFor,
  }),
}));
