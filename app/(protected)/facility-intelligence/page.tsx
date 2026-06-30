"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowUp, Bot, ChevronRight, Copy, History, Mic, Plus, ThumbsUp, Volume2, X } from "lucide-react";
import OisListItem from "@/components/ois/OisListItem";
import { useSessionStore } from "@/store/useSessionStore";
import { useContextStore } from "@/store/useContextStore";
import { oyiService, type OyiChatResponse, type OyiThreadMessage } from "@/services/oyiService";
import { openWorkflowDrawer } from "@/components/modules/WorkflowDetailDrawer";
import { openPredictionDrawer } from "@/components/modules/PredictionDetailDrawer";
import { openInfrastructureDrawer } from "@/components/modules/InfrastructureDetailDrawer";
import type { InfrastructureSource } from "@/services/infrastructurePostureService";
import { resolveFacilityOyiTarget, type OyiTarget } from "@/services/oyiTargetRegistry";

type ChatMessage = {
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

const SUPPORT_DISPLAY_MODES = new Set(["list", "detail", "audit", "report", "awareness"]);
function shouldRenderSupport(displayMode?: string) {
  return SUPPORT_DISPLAY_MODES.has(String(displayMode || "conversation"));
}

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
    sources: row.sources || [],
    suggested_actions: row.suggested_actions || [],
    intent: typeof metadata.intent === "string" ? metadata.intent : undefined,
    understood: typeof metadata.understood === "string" ? metadata.understood : undefined,
    execution: metadata.execution && typeof metadata.execution === "object" ? metadata.execution as Record<string, any> : undefined,
    display_mode: typeof metadata.display_mode === "string" ? metadata.display_mode as ChatMessage["display_mode"] : "conversation",
  };
}

function OyiOrb() {
  return (
    <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full border border-sky-200/22 bg-sky-400/12 shadow-[0_0_30px_rgba(56,189,248,0.24)]">
      <span className="absolute inset-[-10px] rounded-full bg-sky-400/10 blur-xl" />
      <span className="relative h-4 w-4 rounded-full bg-sky-200 shadow-[0_0_22px_rgba(125,211,252,0.95)]" />
    </span>
  );
}

function infrastructureSource(card: Record<string, any>, item: Record<string, any>): InfrastructureSource | null {
  const value = `${card.type || ""} ${card.title || ""} ${card.summary || ""} ${item.domain || ""} ${item.type || ""} ${item.source || ""} ${item.title || ""}`.toLowerCase();
  if (/camera|cctv/.test(value)) return "cameras";
  if (/provider|tuya|mqtt|onvif/.test(value)) return "providers";
  if (/edge|runtime|infrastructure/.test(value)) return "edge";
  if (/utility|water|electric|meter|generator/.test(value)) return "utilities";
  if (/device|hardware|switch|relay|light|ac/.test(value)) return "devices";
  return null;
}

function CardStack({ cards, onTarget }: { cards?: Array<Record<string, any>>; onTarget: (target: OyiTarget | null | undefined) => boolean }) {
  const visibleCards = (cards || []).filter((card) => !["capability", "capability_registry"].includes(String(card?.type || "")));
  if (!visibleCards.length) return null;
  return (
    <div className="mt-3 grid gap-2">
      {visibleCards.slice(0, 3).map((card, index) => {
        const items = Array.isArray(card.items) ? card.items : [];
        return (
          <div key={`${card.type || card.title || "card"}-${index}`} className="rounded-[22px] border border-white/[0.075] bg-white/[0.045] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">
            <div className="text-[10px] uppercase tracking-[0.18em] text-sky-100/44">{String(card.type || "attention").replace(/_/g, " ")}</div>
            <div className="mt-1 text-sm font-semibold tracking-[-0.025em] text-white/90">{card.title || "Operational update"}</div>
            {card.summary ? <p className="mt-1 text-xs leading-5 text-zinc-400">{String(card.summary)}</p> : null}
            {items.length ? (
              <div className="mt-2 grid gap-1.5">
                {items.slice(0, 4).map((item: any, itemIndex: number) => (
                  <button key={itemIndex} type="button" onClick={() => {
                    if (onTarget(item.target || card.target)) return;
                    // Legacy cards created before the target contract retain the prior behavior.
                    const type = String(card.type || item.type || ""); const workflowId = item.workflow_id || item.id; const source = infrastructureSource(card, item); if (workflowId && /workflow/i.test(type)) openWorkflowDrawer(String(workflowId)); if (/prediction/i.test(type)) openPredictionDrawer(item); if (source) openInfrastructureDrawer(source);
                  }} className="flex w-full items-start justify-between gap-3 rounded-2xl bg-black/18 px-3 py-2 text-left text-xs">
                    <span className="min-w-0 break-words text-zinc-300">{item.title || item.label || "Item"}</span>
                    <span className="max-w-[48%] shrink-0 break-words text-right text-zinc-500">{item.status || item.occurred_at?.slice?.(0, 10) || ""}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function OperatingStatus({ execution }: { intent?: string; understood?: string; execution?: Record<string, any> }) {
  const results = Array.isArray(execution?.results) ? execution.results : [];
  const first = results[0] || {};
  const rawStatus = String(first.status || "").replace(/_/g, " ");
  if (!rawStatus) return null;
  const status = /denied/.test(rawStatus)
    ? "Action not available"
    : /failed|error/.test(rawStatus)
      ? "Action could not be completed"
      : /confirmation|pending/.test(rawStatus)
        ? "Confirmation needed"
        : /executed|success/.test(rawStatus)
          ? "Action completed"
          : "Action update";
  const tone =
    /denied|failed|error/.test(status)
      ? "border-rose-300/15 bg-rose-400/[0.055] text-rose-50/80"
      : /confirmation|pending/.test(status)
        ? "border-amber-300/16 bg-amber-400/[0.06] text-amber-50/82"
        : "border-sky-300/14 bg-sky-400/[0.055] text-sky-50/82";
  return (
    <div className={`mt-3 rounded-[20px] border p-3 ${tone}`}>
      <div className="text-[10px] font-medium uppercase tracking-[0.18em] opacity-75">{status}</div>
      {first.summary || first.error ? <p className="mt-1 text-xs leading-5 opacity-90">{String(first.summary || first.error)}</p> : null}
    </div>
  );
}

function SuggestedActions({ actions, onTarget }: { actions?: Array<Record<string, any>>; onTarget: (target: OyiTarget | null | undefined) => boolean }) {
  const rows = (actions || []).filter((action) => action?.label && (action?.route || (action?.target && action.target.target_type !== "none")));
  if (!rows.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {rows.slice(0, 5).map((action, index) => (
        <button key={`${action.route || action.label}-${index}`} type="button" onClick={() => { if (!onTarget(action.target) && action.route) window.location.assign(String(action.route)); }} className="inline-flex items-center gap-1.5 rounded-full border border-sky-300/14 bg-sky-400/[0.075] px-3 py-1.5 text-[11px] font-medium text-sky-100/84 transition active:scale-95">
          {action.label}
          <ChevronRight className="h-3 w-3" />
        </button>
      ))}
    </div>
  );
}

function awarenessCards(response: OyiChatResponse) {
  if (!["list", "detail", "audit", "report", "awareness"].includes(String(response.display_mode || "conversation"))) return [];
  const cards = Array.isArray(response.cards) ? response.cards : [];
  const awareness = response.awareness;
  if (!awareness?.headline) return cards;
  const primaryCard = {
    type: awareness.severity === "normal" ? "normal" : "attention",
    title: awareness.headline,
    summary: awareness.summary || awareness.body || awareness.recommended_action || "Oyi ranked this as the current operational state.",
    items: awareness.recommended_action
      ? [{ title: "Recommended action", status: awareness.recommended_action }]
      : [],
    score: awareness.awareness_score ?? awareness.score,
  };
  const remaining = cards.filter((card) => String(card?.title || "") !== awareness.headline);
  return [primaryCard, ...remaining];
}

export default function FacilityIntelligenceModule() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useSessionStore();
  const { context } = useContextStore();
  const [targetError, setTargetError] = useState<string | null>(null);

  function openTarget(target: OyiTarget | null | undefined) {
    const result = resolveFacilityOyiTarget(target, router);
    if (!result.handled && result.error) setTargetError(result.error);
    return result.handled;
  }
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [helpfulResponses, setHelpfulResponses] = useState<Record<string, boolean>>({});
  const [historyOpen, setHistoryOpen] = useState(false);
  const [threads, setThreads] = useState<Array<{ id: string; title?: string | null; updated_at?: string }>>([]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    messages.filter((message) => message.role === "assistant" && !message.pending).forEach((message) => {
      const support = shouldRenderSupport(message.display_mode);
    });
  }, [messages]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const moduleContext = searchParams.get("module") || "facility-intelligence";
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollerRef = useRef<HTMLElement | null>(null);
  const composerRef = useRef<HTMLFormElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [composerHeight, setComposerHeight] = useState(92);

  async function copyResponse(content: string) {
    try {
      await navigator.clipboard?.writeText(content);
    } catch {
      // Clipboard permissions can be unavailable in embedded app shells.
    }
  }

  function speakResponse(content: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(content));
  }

  function markHelpful(messageId: string) {
    setHelpfulResponses((current) => ({ ...current, [messageId]: true }));
  }

  useEffect(() => {
    let cancelled = false;
    async function hydrateLatestThread() {
      if (!(user as any)?.id) return;
      try {
        const result = await oyiService.listThreads({ context, estate_id: context?.estate_id || (user as any)?.estate_id || null, limit: 24 });
        if (cancelled) return;
        const availableThreads = result.threads || [];
        setThreads(availableThreads);
        const thread = availableThreads[0];
        if (!thread?.id || cancelled) return;
        const res = await oyiService.getThreadMessages(thread.id);
        if (cancelled) return;
        const nextMessages = (res.messages || []).map(messageFromThread);
        if (nextMessages.length) {
          setThreadId(thread.id);
          setMessages(nextMessages);
        }
      } catch {
        // Keep the local starter prompt if backend history is unavailable.
      }
    }
    void hydrateLatestThread();
    return () => { cancelled = true; };
  }, [(user as any)?.id, context]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" }));
    return () => cancelAnimationFrame(frame);
  }, [messages, composerHeight]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let frame = 0;
    const measure = () => {
      const next = Math.ceil(composerRef.current?.getBoundingClientRect().height || 92);
      setComposerHeight((current) => (Math.abs(current - next) > 2 ? next : current));
    };
    const keepLatestVisible = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        measure();
        bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
      });
    };
    measure();
    const observer = typeof ResizeObserver !== "undefined" && composerRef.current ? new ResizeObserver(measure) : null;
    if (observer && composerRef.current) observer.observe(composerRef.current);
    window.visualViewport?.addEventListener("resize", keepLatestVisible);
    window.visualViewport?.addEventListener("scroll", keepLatestVisible);
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.visualViewport?.removeEventListener("resize", keepLatestVisible);
      window.visualViewport?.removeEventListener("scroll", keepLatestVisible);
    };
  }, []);

  useEffect(() => {
    if (searchParams.get("focus") === "1") window.setTimeout(() => inputRef.current?.focus(), 80);
  }, [searchParams]);

  async function restoreThread(nextThreadId: string) {
    try {
      const result = await oyiService.getThreadMessages(nextThreadId);
      const restored = (result.messages || []).map(messageFromThread);
      setThreadId(nextThreadId);
      setMessages(restored);
      setHistoryOpen(false);
    } catch {
      // Keep the active conversation when a historic thread cannot be loaded.
    }
  }

  function startNewChat() {
    setThreadId(null);
    setMessages([]);
    setInput("");
    setHistoryOpen(false);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function send(text?: string) {
    const message = (text || input).trim();
    if (!message || busy) return;
    const pendingId = id();
    const base: ChatMessage[] = [
      ...messages,
      { id: id(), role: "user", content: message },
      { id: pendingId, role: "assistant", content: "Checking facility context…", pending: true },
    ];
    setMessages(base);
    setInput("");
    setBusy(true);
    try {
      const response: OyiChatResponse = await oyiService.chat({
        message,
        estate_id: context?.estate_id || (user as any)?.estate_id || null,
        module: moduleContext,
        role: (user as any)?.role || null,
        thread_id: threadId,
        context,
      });
      if (response.thread_id) setThreadId(response.thread_id);
      if (response.thread_id) {
        setThreads((current) => [{ id: response.thread_id!, title: message.slice(0, 96), updated_at: new Date().toISOString() }, ...current.filter((thread) => thread.id !== response.thread_id)].slice(0, 24));
      }
      setMessages(base.map((item) => item.id === pendingId ? {
        ...item,
        pending: false,
        content: response.message || "Oyi did not return a response.",
        cards: awarenessCards(response),
        sources: response.sources || [],
        suggested_actions: response.suggested_actions || [],
        intent: response.intent,
        understood: response.understood,
        execution: response.execution,
        display_mode: response.display_mode || "conversation",
      } : item));
    } catch (error: any) {
      setMessages(base.map((item) => item.id === pendingId ? { ...item, pending: false, content: error?.response?.data?.error || "Oyi Facility is unavailable right now." } : item));
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send();
  }

  const latestAssistant = [...messages].reverse().find((message) => message.role === "assistant" && !message.pending) || null;
  const currentCards = latestAssistant?.cards || [];
  const currentActions = latestAssistant?.suggested_actions || [];
  const currentExecutions = Array.isArray(latestAssistant?.execution?.results) ? latestAssistant?.execution?.results : [];
  const currentSources = latestAssistant?.sources || [];
  const automationPlans = currentExecutions.filter((result: any) => /pending|confirm|approval|plan|queued/.test(String(result.status || result.type || "").toLowerCase()));
  const estateLabel = context?.estate?.name || "Estate context unavailable";

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-5xl flex-col overflow-hidden bg-zinc-950 text-white md:min-h-0 md:px-0 xl:pb-5">
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-zinc-950/94 px-3 pb-3 pt-[calc(10px+env(safe-area-inset-top))] backdrop-blur-xl sm:px-0 md:pt-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => router.back()} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.045] text-zinc-200 transition active:scale-95" aria-label="Back to Facility modules"><ArrowLeft className="h-4 w-4" /></button>
            <div className="min-w-0">
              <h1 className="truncate text-[18px] font-semibold tracking-[-0.04em] text-white">Operational Intelligence</h1>
              <p className="mt-0.5 text-xs text-zinc-500">{estateLabel}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => setHistoryOpen(true)} className="grid h-10 w-10 place-items-center rounded-full border border-sky-300/14 bg-sky-300/[0.055] text-sky-50/82 transition active:scale-95" aria-label="Recent conversations"><History className="h-4 w-4" /></button>
            <button type="button" onClick={startNewChat} className="grid h-10 w-10 place-items-center rounded-full border border-white/[0.09] bg-white/[0.045] text-white/78 transition active:scale-95" aria-label="New chat"><Plus className="h-4 w-4" /></button>
          </div>
        </div>
      </header>
      {targetError ? <p className="mx-3 mt-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.08] px-3 py-2 text-xs text-amber-100 sm:mx-0">{targetError}</p> : null}

      <section ref={scrollerRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-0" style={{ paddingBottom: `calc(${composerHeight + 18}px + env(safe-area-inset-bottom))`, scrollPaddingBottom: `calc(${composerHeight + 24}px + env(safe-area-inset-bottom))`, WebkitOverflowScrolling: "touch" }}>
        <div className="space-y-5">
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-white">Conversation</h2>
              <span className="text-xs text-zinc-500">{messages.length ? `${messages.length} messages` : "No conversation yet"}</span>
            </div>
            {!messages.length ? <p className="rounded-[22px] border border-white/[0.07] bg-white/[0.03] p-4 text-sm text-zinc-500">Start a conversation to load operational context.</p> : null}
          {messages.map((message) => {
            const mine = message.role === "user";
            return (
              <div key={message.id} className={`mt-3 flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[94%] overflow-hidden rounded-[24px] px-4 py-3 text-sm leading-6 shadow-[0_14px_40px_rgba(0,0,0,0.22)] sm:max-w-[88%] ${mine ? "bg-sky-400 text-slate-950" : "border border-white/[0.07] bg-white/[0.045] text-zinc-100"}`}>
                  <p className={`whitespace-pre-wrap break-words ${message.pending ? "animate-pulse text-zinc-400" : ""}`}>{message.content}</p>
                  {!mine && shouldRenderSupport(message.display_mode) ? <>
                    <CardStack cards={message.cards} onTarget={openTarget} />
                    <OperatingStatus execution={message.execution} />
                    <SuggestedActions actions={message.suggested_actions} onTarget={openTarget} />
                  </> : null}
                  {!mine && !message.pending ? (
                    <div className="mt-2.5 flex items-center gap-1.5 border-t border-white/[0.055] pt-2">
                      <button type="button" onClick={() => void copyResponse(message.content)} className="grid h-7 w-7 place-items-center rounded-full text-white/30 transition hover:bg-white/[0.055] hover:text-white/72 active:scale-95" aria-label="Copy Oyi response"><Copy className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => speakResponse(message.content)} className="grid h-7 w-7 place-items-center rounded-full text-white/30 transition hover:bg-white/[0.055] hover:text-white/72 active:scale-95" aria-label="Listen to Oyi response"><Volume2 className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => markHelpful(message.id)} className={`grid h-7 w-7 place-items-center rounded-full transition hover:bg-white/[0.055] active:scale-95 ${helpfulResponses[message.id] ? "text-sky-200" : "text-white/30 hover:text-white/72"}`} aria-label="Mark Oyi response helpful"><ThumbsUp className={`h-3.5 w-3.5 ${helpfulResponses[message.id] ? "fill-current" : ""}`} /></button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
          </div>

          <div className="border-t border-white/[0.06] pt-4">
            <h2 className="text-sm font-semibold text-white">Current Situation</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-300">{latestAssistant?.content || "Ask Oyi about attention, infrastructure, ownership, or verification."}</p>
          </div>

          <div className="border-t border-white/[0.06] pt-4">
            <h2 className="text-sm font-semibold text-white">Recommendations</h2>
            <div className="mt-3 space-y-2">
              {currentActions.length ? currentActions.slice(0, 6).map((action, index) => <OisListItem key={`${action.label || action.route}-${index}`} title={action.label || "Recommended action"} description={action.summary || action.route || "Open the suggested route."} meta={action.intent || action.reason || "Operational recommendation"} onClick={() => { if (!openTarget(action.target) && action.route) window.location.assign(String(action.route)); }} className="w-full text-left" />) : <p className="text-sm text-zinc-500">Recommendations will appear when Oyi has enough context.</p>}
            </div>
          </div>

          <div className="border-t border-white/[0.06] pt-4">
            <h2 className="text-sm font-semibold text-white">Automation Plans</h2>
            <div className="mt-3 space-y-2">
              {automationPlans.length ? automationPlans.slice(0, 6).map((result: any, index: number) => <OisListItem key={`${result.executionId || result.id || index}-automation`} title={result.label || result.summary || "Automation plan"} description={result.error || result.summary || "Pending automation or approval path"} meta={result.provider || result.origin || "Runtime automation"} status={/pending|confirm|approval/.test(String(result.status || "").toLowerCase()) ? "pending" : "attention"} />) : <p className="text-sm text-zinc-500">Automation plans appear when Oyi prepares an executable path.</p>}
            </div>
          </div>

          <div className="border-t border-white/[0.06] pt-4">
            <h2 className="text-sm font-semibold text-white">Recent Executions</h2>
            <div className="mt-3 space-y-2">
              {currentExecutions.length ? currentExecutions.slice(0, 6).map((result: any, index: number) => <OisListItem key={`${result.executionId || result.id || index}`} title={result.label || result.summary || result.status || "Execution"} description={result.error || result.summary || "Operational execution update"} meta={result.provider || result.origin || "Runtime execution"} status={/success|executed/.test(String(result.status || "").toLowerCase()) ? "completed" : /pending|confirm/.test(String(result.status || "").toLowerCase()) ? "pending" : /failed|error|denied/.test(String(result.status || "").toLowerCase()) ? "critical" : "attention"} />) : <p className="text-sm text-zinc-500">No recent execution records in this conversation.</p>}
            </div>
          </div>

          <div className="border-t border-white/[0.06] pt-4">
            <h2 className="text-sm font-semibold text-white">Runtime Timeline</h2>
            <div className="mt-3 space-y-2">
              {currentSources.length ? currentSources.slice(0, 8).map((source: any, index: number) => <OisListItem key={`${source.title || source.name || index}`} title={source.title || source.name || source.source || "Runtime source"} description={source.summary || source.detail || source.description || "Supporting runtime evidence"} meta={source.timestamp || source.updated_at || source.created_at || "Timestamp unavailable"} status="stable" />) : currentCards.length ? currentCards.slice(0, 8).map((card: any, index: number) => <OisListItem key={`${card.title || card.type || index}`} title={card.title || "Operational insight"} description={card.summary || "Runtime detail"} meta={card.type || "runtime"} status="attention" />) : <p className="text-sm text-zinc-500">Runtime timeline appears when Oyi returns supporting evidence.</p>}
            </div>
          </div>
          <div ref={bottomRef} className="h-1" />
        </div>
      </section>

      <form ref={composerRef} onSubmit={onSubmit} className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-5xl px-3 pb-[calc(10px+env(safe-area-inset-bottom))] md:px-5 xl:sticky xl:bottom-0 xl:px-0 xl:pb-0">
        <div className="rounded-[28px] border border-white/[0.08] bg-zinc-950/90 p-2 shadow-[0_18px_60px_rgba(0,0,0,0.48)] backdrop-blur-2xl">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => inputRef.current?.focus()} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sky-400/12 text-sky-100">
            <Bot className="h-5 w-5" />
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            rows={1}
            placeholder="Ask Operational Intelligence..."
            className="max-h-28 min-h-10 min-w-0 flex-1 resize-none bg-transparent px-1 py-2.5 text-sm leading-5 text-white outline-none placeholder:text-zinc-500"
          />
          <button type="button" onClick={() => inputRef.current?.focus()} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-300">
            <Mic className="h-4 w-4" />
          </button>
          <button type="submit" disabled={busy || !input.trim()} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-zinc-950 transition active:scale-95 disabled:opacity-40">
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
        </div>
      </form>
      {historyOpen ? (
        <div className="fixed inset-0 z-40 flex items-end bg-black/60 p-3 backdrop-blur-sm xl:items-center xl:justify-center">
          <section className="w-full rounded-[28px] border border-white/[0.08] bg-zinc-950 p-4 shadow-2xl xl:max-w-md">
            <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-white">Recent conversations</h2><button type="button" onClick={() => setHistoryOpen(false)} className="grid h-9 w-9 place-items-center rounded-full text-zinc-400 hover:bg-white/[0.06]" aria-label="Close history"><X className="h-4 w-4" /></button></div>
            <div className="mt-3 max-h-[55vh] space-y-2 overflow-y-auto">
              {threads.length ? threads.map((thread) => <button key={thread.id} type="button" onClick={() => void restoreThread(thread.id)} className="block w-full rounded-2xl border border-white/[0.07] bg-white/[0.035] px-3 py-3 text-left text-sm text-zinc-200 transition hover:bg-white/[0.06]"><span className="block truncate">{thread.title || "Oyi conversation"}</span><span className="mt-1 block text-[11px] text-zinc-500">{thread.updated_at ? new Date(thread.updated_at).toLocaleString() : ""}</span></button>) : <p className="px-1 py-5 text-sm text-zinc-500">No saved conversations yet.</p>}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
