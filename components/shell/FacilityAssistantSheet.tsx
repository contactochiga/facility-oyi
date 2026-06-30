"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { History, Mic, Sparkles, Volume2, VolumeX } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { oyiService, type OyiThreadMessage } from "@/services/oyiService";
import { useSessionStore } from "@/store/useSessionStore";
import { useContextStore } from "@/store/useContextStore";
import { useFacilityAssistantStore } from "@/store/useFacilityAssistantStore";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
  execution?: Record<string, any>;
  cards?: Array<Record<string, any>>;
  suggested_actions?: Array<Record<string, any>>;
};

function id() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function messageFromThread(row: OyiThreadMessage): ChatMessage {
  const metadata = row.metadata || {};
  return {
    id: row.id,
    role: row.role === "user" ? "user" : "assistant",
    content: row.content || "",
    cards: row.cards || [],
    suggested_actions: row.suggested_actions || [],
    execution: metadata.execution && typeof metadata.execution === "object" ? metadata.execution as Record<string, any> : undefined,
  };
}

function AccountabilityStrip({ execution }: { execution?: Record<string, any> }) {
  const results = Array.isArray(execution?.results) ? execution.results : [];
  const first = results[0] || execution || {};
  const rows = [
    ["Origin", first.origin || first.executionSource || first.source],
    ["Initiator", first.initiatorType || first.actorRole || first.actor],
    ["Provider", first.provider],
    ["Approval", first.approvedBy ? `Approved by ${first.approvedBy}` : first.approvalRequired ? "Required" : "Not required"],
    ["Trust", typeof first.trustScore === "number" ? `${Math.round(first.trustScore * 100)}%` : null],
  ].filter(([, value]) => value);

  if (!rows.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {rows.slice(0, 5).map(([label, value]) => (
        <span key={label} className="rounded-full border border-white/[0.08] bg-white/[0.045] px-2.5 py-1 text-[10px] text-zinc-300">
          <span className="text-zinc-500">{label}</span> {String(value)}
        </span>
      ))}
    </div>
  );
}

function SuggestedActions({ actions, onSelect }: { actions?: Array<Record<string, any>>; onSelect: (value: string) => void }) {
  const rows = (actions || []).filter((action) => action?.label);
  if (!rows.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {rows.slice(0, 4).map((action, index) => (
        <button
          key={`${action.label}-${index}`}
          type="button"
          onClick={() => onSelect(String(action.prompt || action.label))}
          className="rounded-full border border-sky-300/14 bg-sky-400/[0.08] px-2.5 py-1.5 text-[10px] text-sky-100"
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

export default function FacilityAssistantSheet() {
  const { user } = useSessionStore();
  const { context } = useContextStore();
  const { open, focusHint, closeAssistant } = useFacilityAssistantStore();
  const pathname = usePathname() || "/overview";
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threads, setThreads] = useState<Array<{ id: string; title?: string | null; updated_at?: string }>>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [voiceReplyEnabled, setVoiceReplyEnabled] = useState(true);
  const [composerInset, setComposerInset] = useState(0);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const spokenRef = useRef<string>("");

  const starter = useMemo(() => (
    (user as any)?.estate_id ? `Summarize current operational attention for ${String((user as any)?.estate_name || "this estate")}.` : "Summarize current operational attention."
  ), [user]);
  const pageFilters = useMemo(() => Object.fromEntries(Array.from(searchParams.entries()).slice(0, 12)), [searchParams]);
  const moduleContext = useMemo(() => String(pathname).replace(/^\//, "").split("/")[0] || "overview", [pathname]);

  useEffect(() => {
    if (!open) return;
    setInput(focusHint || "");
    inputRef.current?.focus();
  }, [focusHint, open]);

  useEffect(() => {
    if (!open || !(user as any)?.id) return;
    let cancelled = false;
    async function loadThreads() {
      try {
        const result = await oyiService.listThreads({
          context,
          estate_id: context?.estate_id || (user as any)?.estate_id || null,
          home_id: context?.home_id || null,
          limit: 16,
        });
        if (cancelled) return;
        const nextThreads = result.threads || [];
        setThreads(nextThreads);
        const latest = nextThreads[0];
        if (!latest?.id) {
          setMessages([{ id: id(), role: "assistant", content: "Operational intelligence is ready. Ask Oyi about attention, verification, ownership, or continuity." }]);
          return;
        }
        const thread = await oyiService.getThreadMessages(latest.id);
        if (cancelled) return;
        setThreadId(latest.id);
        setMessages((thread.messages || []).map(messageFromThread));
      } catch {
        if (!cancelled) {
          setMessages([{ id: id(), role: "assistant", content: "Operational intelligence is ready. Ask Oyi about attention, verification, ownership, or continuity." }]);
        }
      }
    }
    void loadThreads();
    return () => {
      cancelled = true;
    };
  }, [context, open, user]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const updateInset = () => {
      const viewport = window.visualViewport;
      const heightLoss = viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
      setComposerInset(heightLoss);
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" }));
    };
    updateInset();
    window.visualViewport?.addEventListener("resize", updateInset);
    window.visualViewport?.addEventListener("scroll", updateInset);
    window.addEventListener("orientationchange", updateInset);
    return () => {
      window.visualViewport?.removeEventListener("resize", updateInset);
      window.visualViewport?.removeEventListener("scroll", updateInset);
      window.removeEventListener("orientationchange", updateInset);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !voiceReplyEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const latest = [...messages].reverse().find((item) => item.role === "assistant" && !item.pending && item.content.trim());
    if (!latest || spokenRef.current === latest.id) return;
    spokenRef.current = latest.id;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(latest.content));
  }, [messages, open, voiceReplyEnabled]);

  async function restoreThread(nextThreadId: string) {
    const result = await oyiService.getThreadMessages(nextThreadId);
    setThreadId(nextThreadId);
    setMessages((result.messages || []).map(messageFromThread));
    setHistoryOpen(false);
  }

  async function send(text?: string) {
    const message = String(text ?? input).trim();
    if (!message || busy) return;
    const pendingId = id();
    const nextBase = [
      ...messages,
      { id: id(), role: "user" as const, content: message },
      { id: pendingId, role: "assistant" as const, content: "Reviewing live operational context…", pending: true },
    ];
    setMessages(nextBase);
    setInput("");
    setBusy(true);
    try {
      const response = await oyiService.chat({
        message,
        estate_id: context?.estate_id || (user as any)?.estate_id || null,
        home_id: context?.home_id || null,
        module: moduleContext,
        role: user?.role || null,
        thread_id: threadId,
        context,
        page: pathname,
        route: pathname,
        filters: pageFilters,
        runtime_context: {
          focus_hint: focusHint || null,
          page: pathname,
          module: moduleContext,
          estate_name: context?.estate?.name || (user as any)?.estate_name || null,
          home_id: context?.home_id || null,
          filters: pageFilters,
        },
      });
      if (response.thread_id) setThreadId(response.thread_id);
      const reply = String(response.reply || response.message || "Operational review completed.");
      setMessages((current) => current.map((item) => item.id === pendingId ? {
        ...item,
        pending: false,
        content: reply,
        execution: response.execution,
        cards: Array.isArray(response.cards) ? response.cards : [],
        suggested_actions: Array.isArray(response.suggested_actions) ? response.suggested_actions : [],
      } : item));
    } catch {
      setMessages((current) => current.map((item) => item.id === pendingId ? {
        ...item,
        pending: false,
        content: "Oyi could not reach the operational runtime right now.",
      } : item));
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] md:hidden animate-in fade-in duration-200">
      <button type="button" aria-label="Close assistant" className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={closeAssistant} />
      <section
        className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[calc(100dvh-18px-var(--sat))] w-full max-w-[520px] flex-col overflow-hidden rounded-t-[28px] border border-white/[0.08] bg-[#070b12]/96 shadow-[0_-18px_60px_rgba(0,0,0,0.55)] animate-in slide-in-from-bottom-6 duration-200"
        style={{ paddingBottom: `calc(env(safe-area-inset-bottom) + ${composerInset}px)` }}
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-2xl border border-sky-300/18 bg-sky-400/[0.10] text-sky-100">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">Operational Intelligence</p>
              <p className="truncate text-[11px] text-zinc-500">{moduleContext.replace(/-/g, " ")} · anchored shell assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setHistoryOpen((value) => !value)} className="grid h-9 w-9 place-items-center rounded-full border border-white/[0.08] bg-white/[0.04] text-zinc-300">
              <History className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setVoiceReplyEnabled((value) => !value)} className="grid h-9 w-9 place-items-center rounded-full border border-white/[0.08] bg-white/[0.04] text-zinc-300">
              {voiceReplyEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {historyOpen ? (
          <div className="border-b border-white/[0.06] px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Recent conversations</p>
            <div className="mt-2 space-y-2">
              {threads.length ? threads.map((thread) => (
                <button key={thread.id} type="button" onClick={() => void restoreThread(thread.id)} className="block w-full rounded-2xl border border-white/[0.07] bg-white/[0.035] px-3 py-3 text-left text-sm text-zinc-200">
                  <span className="block truncate">{thread.title || "Operational conversation"}</span>
                  <span className="mt-1 block text-[11px] text-zinc-500">{thread.updated_at ? new Date(thread.updated_at).toLocaleString() : ""}</span>
                </button>
              )) : <p className="rounded-2xl border border-dashed border-white/[0.07] px-3 py-4 text-sm text-zinc-500">No saved conversations yet.</p>}
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {!messages.length ? (
            <div className="rounded-[22px] border border-white/[0.07] bg-white/[0.03] p-4">
              <p className="text-sm text-white">Operational attention is available.</p>
              <p className="mt-1 text-xs leading-5 text-zinc-500">Ask about verification queues, access review, infrastructure posture, or recent execution history.</p>
              <button type="button" onClick={() => void send(starter)} className="mt-3 inline-flex items-center gap-2 rounded-full border border-sky-300/14 bg-sky-400/[0.08] px-3 py-2 text-xs text-sky-100">
                <Mic className="h-3.5 w-3.5" />
                Start intelligence brief
              </button>
            </div>
          ) : null}

          <div className="space-y-3">
            {messages.map((message) => (
              <div key={message.id} className={message.role === "user" ? "ml-10" : "mr-6"}>
                <div className={`rounded-[22px] border px-3.5 py-3 text-sm ${message.role === "user" ? "border-sky-300/12 bg-sky-400/[0.08] text-sky-50" : "border-white/[0.07] bg-white/[0.035] text-zinc-100"}`}>
                  <p className="leading-6">{message.content}</p>
                  {message.pending ? <div className="mt-2 h-1.5 w-20 rounded-full bg-sky-400/25"><div className="h-full w-10 animate-pulse rounded-full bg-sky-300/70" /></div> : null}
                  <AccountabilityStrip execution={message.execution} />
                  <SuggestedActions actions={message.suggested_actions} onSelect={(value) => void send(value)} />
                </div>
              </div>
            ))}
          </div>
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
          className="border-t border-white/[0.06] px-4 pb-3 pt-3"
        >
          <div className="flex items-end gap-2 rounded-[24px] border border-white/[0.08] bg-white/[0.035] px-3 py-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              rows={1}
              placeholder="Ask Oyi about attention, ownership, verification, or execution history"
              className="max-h-28 min-h-[24px] flex-1 resize-none bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
            />
            <button type="submit" disabled={busy || !input.trim()} className="rounded-full bg-sky-400 px-3 py-2 text-xs font-medium text-slate-950 disabled:opacity-40">
              {busy ? "Thinking" : "Send"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
