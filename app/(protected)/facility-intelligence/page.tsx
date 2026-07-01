"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, History, Plus, X } from "lucide-react";
import { useSessionStore } from "@/store/useSessionStore";
import { useContextStore } from "@/store/useContextStore";
import { openWorkflowDrawer } from "@/components/modules/WorkflowDetailDrawer";
import { openPredictionDrawer } from "@/components/modules/PredictionDetailDrawer";
import { openInfrastructureDrawer } from "@/components/modules/InfrastructureDetailDrawer";
import type { InfrastructureSource } from "@/services/infrastructurePostureService";
import { resolveFacilityOyiTarget, type OyiTarget } from "@/services/oyiTargetRegistry";
import FacilityConversationComposer from "@/components/assistant/FacilityConversationComposer";
import FacilityConversationFeed from "@/components/assistant/FacilityConversationFeed";
import { useFacilityConversationStore } from "@/store/useFacilityConversationStore";
import { useViewportDockLayout } from "@/hooks/useViewportDockLayout";

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
  const { viewportHeight, dockHeight, keyboardInset } = useViewportDockLayout({
    active: true,
    dockRef: composerRef,
    lockDocument: true,
    onViewportChange: () => bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" }),
  });

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
  }, [messages, dockHeight]);

  function startNewChat() {
    resetConversation();
    setInput("");
    setHistoryOpen(false);
    window.setTimeout(() => {
      const input = composerRef.current?.querySelector("textarea");
      (input as HTMLTextAreaElement | null)?.focus({ preventScroll: true });
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

  function handleConversationAction(action: Record<string, any>) {
    if (openTarget(action.target)) return;
    const actionType = String(action.type || "").toLowerCase();
    const workflowId = action.workflow_id || action.id;
    if (workflowId && /workflow/i.test(actionType)) {
      openWorkflowDrawer(String(workflowId));
      return;
    }
    if (/prediction/i.test(actionType)) {
      openPredictionDrawer(action);
      return;
    }
    if (action.infrastructure_source) {
      openInfrastructureDrawer(action.infrastructure_source as InfrastructureSource);
      return;
    }
    if (action.route) {
      router.push(String(action.route));
      return;
    }
    if (action.prompt || action.label) {
      void send(String(action.prompt || action.label));
    }
  }

  const estateLabel = context?.estate?.name || (context ? "Estate context unavailable" : "Loading estate context...");

  return (
    <div
      className="mx-auto flex w-full min-w-0 max-w-5xl flex-col overflow-hidden bg-zinc-950 text-white md:h-full md:min-h-0 md:px-0 xl:pb-5"
      style={{ height: viewportHeight ? `${viewportHeight}px` : "var(--oyi-viewport-height)", maxWidth: "100vw" }}
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

      <section className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-4 sm:px-0" style={{ scrollPaddingBottom: `calc(${dockHeight + 24}px + env(safe-area-inset-bottom))`, WebkitOverflowScrolling: "touch" }}>
        <div className="space-y-4">
          <FacilityConversationFeed
            messages={messages}
            emptyMessage="Ask Oyi about attention, verification, ownership, or execution history."
            onAction={handleConversationAction}
            onCopy={(content) => void copyResponse(content)}
            onSpeak={speakResponse}
            onHelpful={markHelpful}
            helpfulResponses={helpfulResponses}
          />
          <div ref={bottomRef} className="h-1" />
        </div>
      </section>

      <form ref={composerRef} onSubmit={(event) => { event.preventDefault(); void send(); }} className="z-30 mt-auto shrink-0 px-3 md:px-0 md:pb-0" style={{ paddingBottom: `calc(10px + env(safe-area-inset-bottom) + ${keyboardInset}px)` }}>
        <FacilityConversationComposer
          value={input}
          onChange={setInput}
          onSubmit={() => void send()}
          busy={busy}
          placeholder="Ask Oyi about attention, verification, ownership, or execution history"
          variant="page"
          autoFocus={searchParams.get("focus") === "1"}
        />
      </form>
      {historyOpen ? (
        <div className="fixed inset-0 z-40 flex items-end bg-black/60 p-3 backdrop-blur-sm xl:items-center xl:justify-center">
          <section className="w-full rounded-[28px] border border-white/[0.08] bg-zinc-950 p-4 shadow-2xl xl:max-w-md">
            <div className="flex items-center justify-between"><h2 className="text-base font-semibold text-white">Recent conversations</h2><button type="button" onClick={() => setHistoryOpen(false)} className="grid h-9 w-9 place-items-center rounded-full text-zinc-400 hover:bg-white/[0.06]" aria-label="Close history"><X className="h-4 w-4" /></button></div>
            <div className="mt-3 max-h-[55vh] space-y-2 overflow-y-auto">
              {threads.length ? threads.map((thread) => <button key={thread.id} type="button" onClick={() => { void restoreThread(thread.id); setHistoryOpen(false); }} className="block w-full rounded-2xl border border-white/[0.07] bg-white/[0.035] px-3 py-3 text-left text-sm text-zinc-200 transition hover:bg-white/[0.06]"><span className="block truncate">{thread.title || "Oyi conversation"}</span><span className="mt-1 block text-[11px] text-zinc-500">{thread.updated_at ? new Date(thread.updated_at).toLocaleString() : ""}</span></button>) : <p className="px-1 py-5 text-sm text-zinc-500">No saved conversations yet.</p>}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
