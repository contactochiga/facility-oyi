"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronRight, Copy, History, Plus, ThumbsUp, Volume2, X } from "lucide-react";
import { useSessionStore } from "@/store/useSessionStore";
import { useContextStore } from "@/store/useContextStore";
import { openWorkflowDrawer } from "@/components/modules/WorkflowDetailDrawer";
import { openPredictionDrawer } from "@/components/modules/PredictionDetailDrawer";
import { openInfrastructureDrawer } from "@/components/modules/InfrastructureDetailDrawer";
import type { InfrastructureSource } from "@/services/infrastructurePostureService";
import { resolveFacilityOyiTarget, type OyiTarget } from "@/services/oyiTargetRegistry";
import FacilityConversationComposer from "@/components/assistant/FacilityConversationComposer";
import { useFacilityConversationStore } from "@/store/useFacilityConversationStore";

const SUPPORT_DISPLAY_MODES = new Set(["list", "detail", "audit", "report", "awareness"]);
function shouldRenderSupport(displayMode?: string) {
  return SUPPORT_DISPLAY_MODES.has(String(displayMode || "conversation"));
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

export default function FacilityIntelligenceModule() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useSessionStore();
  const { context } = useContextStore();
  const { messages, threads, busy, hydrate, restoreThread, sendMessage, resetConversation } = useFacilityConversationStore();
  const [targetError, setTargetError] = useState<string | null>(null);

  function openTarget(target: OyiTarget | null | undefined) {
    const result = resolveFacilityOyiTarget(target, router);
    if (!result.handled && result.error) setTargetError(result.error);
    return result.handled;
  }
  const [input, setInput] = useState("");
  const [helpfulResponses, setHelpfulResponses] = useState<Record<string, boolean>>({});
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    messages.filter((message) => message.role === "assistant" && !message.pending).forEach(() => undefined);
  }, [messages]);
  const moduleContext = searchParams.get("module") || "facility-intelligence";
  const composerRef = useRef<HTMLFormElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [composerHeight, setComposerHeight] = useState(92);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

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
    void hydrate({
      context,
      estateId: context?.estate_id || (user as any)?.estate_id || null,
      homeId: context?.home_id || null,
      userId: (user as any)?.id || null,
    });
  }, [context, hydrate, user]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" }));
    return () => cancelAnimationFrame(frame);
  }, [messages, composerHeight]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let frame = 0;
    const updateViewport = () => {
      const nextHeight = Math.round(window.visualViewport?.height || window.innerHeight);
      setViewportHeight((current) => (current !== nextHeight ? nextHeight : current));
    };
    const measure = () => {
      const next = Math.ceil(composerRef.current?.getBoundingClientRect().height || 92);
      setComposerHeight((current) => (Math.abs(current - next) > 2 ? next : current));
    };
    const keepLatestVisible = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        updateViewport();
        measure();
        bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
      });
    };
    const lockShellScroll = () => {
      const previousBodyOverflow = document.body.style.overflow;
      const previousHtmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previousBodyOverflow;
        document.documentElement.style.overflow = previousHtmlOverflow;
      };
    };
    const restoreScrollLock = lockShellScroll();
    updateViewport();
    measure();
    const observer = typeof ResizeObserver !== "undefined" && composerRef.current ? new ResizeObserver(measure) : null;
    if (observer && composerRef.current) observer.observe(composerRef.current);
    window.visualViewport?.addEventListener("resize", keepLatestVisible);
    window.visualViewport?.addEventListener("scroll", keepLatestVisible);
    window.addEventListener("orientationchange", keepLatestVisible);
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.visualViewport?.removeEventListener("resize", keepLatestVisible);
      window.visualViewport?.removeEventListener("scroll", keepLatestVisible);
      window.removeEventListener("orientationchange", keepLatestVisible);
      restoreScrollLock();
    };
  }, []);

  useEffect(() => {
    if (searchParams.get("focus") !== "1") return;
    window.setTimeout(() => {
      const input = composerRef.current?.querySelector("textarea");
      (input as HTMLTextAreaElement | null)?.focus();
    }, 80);
  }, [searchParams]);

  function startNewChat() {
    resetConversation();
    setInput("");
    setHistoryOpen(false);
    window.setTimeout(() => {
      const input = composerRef.current?.querySelector("textarea");
      (input as HTMLTextAreaElement | null)?.focus();
    }, 0);
  }

  async function send(text?: string) {
    const message = (text || input).trim();
    if (!message || busy) return;
    setInput("");
    await sendMessage({
      message,
      context,
      estateId: context?.estate_id || (user as any)?.estate_id || null,
      homeId: context?.home_id || null,
      role: (user as any)?.role || null,
      module: moduleContext,
      page: "/facility-intelligence",
      route: "/facility-intelligence",
      filters: Object.fromEntries(Array.from(searchParams.entries()).slice(0, 12)),
    });
  }

  const estateLabel = context?.estate?.name || "Estate context unavailable";

  return (
    <div
      className="mx-auto flex max-w-5xl flex-col overflow-hidden bg-zinc-950 text-white md:h-full md:min-h-0 md:px-0 xl:pb-5"
      style={{ height: viewportHeight ? `${viewportHeight}px` : "100dvh" }}
    >
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

      <section className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-0" style={{ scrollPaddingBottom: `calc(${composerHeight + 24}px + env(safe-area-inset-bottom))`, WebkitOverflowScrolling: "touch" }}>
        <div className="space-y-4">
          {!messages.length ? <p className="rounded-[22px] border border-white/[0.07] bg-white/[0.03] p-4 text-sm text-zinc-500">Ask Oyi about attention, verification, ownership, or execution history.</p> : null}
          {messages.map((message) => {
            const mine = message.role === "user";
            return (
              <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
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
          <div ref={bottomRef} className="h-1" />
        </div>
      </section>

      <form ref={composerRef} onSubmit={(event) => { event.preventDefault(); void send(); }} className="z-30 mt-auto shrink-0 px-3 pb-[calc(10px+env(safe-area-inset-bottom))] md:px-0 md:pb-0">
        <FacilityConversationComposer
          value={input}
          onChange={setInput}
          onSubmit={() => void send()}
          busy={busy}
          placeholder="Ask Oyi about attention, verification, ownership, or execution history"
          variant="page"
        />
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
