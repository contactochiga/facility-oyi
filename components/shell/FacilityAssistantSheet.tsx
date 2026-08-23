"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { History, Mic, Sparkles, Volume2, VolumeX, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSessionStore } from "@/store/useSessionStore";
import { useContextStore } from "@/store/useContextStore";
import { useFacilityAssistantStore } from "@/store/useFacilityAssistantStore";
import { useFacilityConversationStore } from "@/store/useFacilityConversationStore";
import FacilityConversationComposer from "@/components/assistant/FacilityConversationComposer";
import FacilityConversationFeed from "@/components/assistant/FacilityConversationFeed";
import { useViewportDockLayout } from "@/hooks/useViewportDockLayout";
import { deriveFacilityOperationalObject } from "@/services/operationalObjectContext";

export default function FacilityAssistantSheet() {
  const router = useRouter();
  const { user } = useSessionStore();
  const { context } = useContextStore();
  const { open, focusHint, source, activeContext, openAssistant, closeAssistant } = useFacilityAssistantStore();
  const { messages, threads, busy, hydrate, restoreThread, sendMessage } = useFacilityConversationStore();
  const pathname = usePathname() || "/overview";
  const searchParams = useSearchParams();
  const [input, setInput] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [voiceReplyEnabled, setVoiceReplyEnabled] = useState(true);
  const composerRef = useRef<HTMLFormElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const spokenRef = useRef<string>("");
  const { viewportHeight, keyboardInset } = useViewportDockLayout({
    active: open,
    dockRef: composerRef,
    lockDocument: true,
    onViewportChange: () => bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" }),
  });

  const starter = useMemo(() => (
    (user as any)?.estate_id ? `Summarize current operational attention for ${String((user as any)?.estate_name || "this estate")}.` : "Summarize current operational attention."
  ), [user]);
  const pageFilters = useMemo(() => Object.fromEntries(Array.from(searchParams.entries()).slice(0, 12)), [searchParams]);
  const moduleContext = useMemo(() => String(pathname).replace(/^\//, "").split("/")[0] || "overview", [pathname]);
  const operationalObject = useMemo(() => deriveFacilityOperationalObject({
    module: moduleContext,
    pathname,
    estate_id: context?.estate_id || (user as any)?.estate_id || null,
    home_id: context?.home_id || null,
    searchParams,
  }), [context?.estate_id, context?.home_id, moduleContext, pathname, searchParams, user]);
  const activeOperationalObject = useMemo(() => {
    const object = activeContext?.selected_subobject || activeContext?.primary_object;
    if (!activeContext || !object) return null;
    return {
      object_type: object.object_type,
      canonical_id: object.canonical_id,
      label: object.label,
      estate_id: activeContext.scope.estate_id,
      building_id: activeContext.scope.building_id,
      home_id: activeContext.scope.home_id,
      room_id: activeContext.scope.room_id,
      parent_id: "parent_id" in object ? object.parent_id || null : null,
      source_module: activeContext.primary_object?.source_module || activeContext.module,
      metadata: {
        active_context: {
          context_id: activeContext.context_id,
          context_version: activeContext.context_version,
          source: activeContext.source,
        },
        visible_state: activeContext.visible_state,
      },
    };
  }, [activeContext]);

  useEffect(() => {
    if (searchParams.get("oyi") === "open" && !open) openAssistant();
  }, [open, openAssistant, searchParams]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeAssistant();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeAssistant, open]);

  useEffect(() => {
    if (!open) return;
    setInput(focusHint || "");
    window.setTimeout(() => {
      const input = document.querySelector("[data-facility-assistant-composer] textarea");
      (input as HTMLTextAreaElement | null)?.focus({ preventScroll: true });
    }, 40);
  }, [focusHint, open]);

  useEffect(() => {
    if (!open) return;
    void hydrate({
      context,
      estateId: context?.estate_id || (user as any)?.estate_id || null,
      homeId: context?.home_id || null,
      userId: (user as any)?.id || null,
    });
  }, [context, hydrate, open, user]);

  useEffect(() => {
    if (!open || !voiceReplyEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const latest = [...messages].reverse().find((item) => item.role === "assistant" && !item.pending && item.content.trim());
    if (!latest || spokenRef.current === latest.id) return;
    spokenRef.current = latest.id;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(latest.content));
  }, [messages, open, voiceReplyEnabled]);

  async function send(text?: string) {
    const message = String(text ?? input).trim();
    if (!message || busy) return;
    setInput("");
    await sendMessage({
      message,
      context,
      estateId: context?.estate_id || (user as any)?.estate_id || null,
      homeId: context?.home_id || null,
      role: user?.role || null,
      module: moduleContext,
      page: pathname,
      route: pathname,
      filters: pageFilters,
      focusHint: focusHint || null,
      operationalObject: activeOperationalObject || operationalObject,
      activeIntelligenceContext: activeContext,
    });
  }

  function handleConversationAction(action: Record<string, any>) {
    if (action.route) {
      closeAssistant();
      router.push(String(action.route));
      return;
    }
    if (action.prompt || action.label) {
      void send(String(action.prompt || action.label));
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] animate-in fade-in duration-200">
      <button type="button" aria-label="Close assistant" className="absolute inset-0 bg-black/70 backdrop-blur-[2px] md:bg-black/25 md:backdrop-blur-none" onClick={closeAssistant} />
      <section
        className="absolute inset-x-0 bottom-0 mx-auto flex w-full max-w-[520px] flex-col overflow-hidden rounded-t-[28px] border border-white/[0.08] bg-[#070b12]/96 shadow-[0_-18px_60px_rgba(0,0,0,0.55)] animate-in slide-in-from-bottom-6 duration-200 md:inset-x-auto md:bottom-5 md:right-5 md:h-[min(720px,calc(100dvh-40px))] md:w-[440px] md:rounded-[24px] md:shadow-[0_24px_80px_rgba(0,0,0,0.62)]"
        style={{ maxHeight: viewportHeight ? `${Math.max(viewportHeight - 18, 320)}px` : "calc(var(--oyi-viewport-height) - 18px - var(--ois-safe-top))", paddingBottom: `calc(env(safe-area-inset-bottom) + ${keyboardInset}px)` }}
        role="dialog"
        aria-modal="true"
        aria-label="Oyi Facility Intelligence"
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-2xl border border-sky-300/18 bg-sky-400/[0.10] text-sky-100">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">Oyi</p>
              <p className="truncate text-[11px] text-zinc-500">Facility Intelligence · {moduleContext.replace(/-/g, " ")}{source === "voice" ? " · voice" : ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setHistoryOpen((value) => !value)} className="grid h-9 w-9 place-items-center rounded-full border border-white/[0.08] bg-white/[0.04] text-zinc-300">
              <History className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setVoiceReplyEnabled((value) => !value)} className="grid h-9 w-9 place-items-center rounded-full border border-white/[0.08] bg-white/[0.04] text-zinc-300">
              {voiceReplyEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
            <button type="button" onClick={closeAssistant} className="grid h-9 w-9 place-items-center rounded-full border border-white/[0.08] bg-white/[0.04] text-zinc-300" aria-label="Close Oyi"><X className="h-4 w-4" /></button>
          </div>
        </div>

        {historyOpen ? (
          <div className="border-b border-white/[0.06] px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">Recent conversations</p>
          <div className="mt-2 space-y-2">
              {threads.length ? threads.map((thread) => (
                <button key={thread.id} type="button" onClick={() => { void restoreThread(thread.id); setHistoryOpen(false); }} className="block w-full rounded-2xl border border-white/[0.07] bg-white/[0.035] px-3 py-3 text-left text-sm text-zinc-200">
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
              <p className="text-sm text-white">Facility intelligence is ready.</p>
              <p className="mt-1 text-xs leading-5 text-zinc-500">Ask about the current domain, buildings, assets, utilities, security, maintenance, or finance.</p>
              <button type="button" onClick={() => void send(starter)} className="mt-3 inline-flex items-center gap-2 rounded-full border border-sky-300/14 bg-sky-400/[0.08] px-3 py-2 text-xs text-sky-100">
                <Mic className="h-3.5 w-3.5" />
                Start intelligence brief
              </button>
            </div>
          ) : null}

          <FacilityConversationFeed
            messages={messages}
            emptyMessage=""
            onAction={handleConversationAction}
            interactive={false}
            compact
          />
          <div ref={bottomRef} />
        </div>

        <form
          ref={composerRef}
          data-facility-assistant-composer
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
          className="border-t border-white/[0.06] px-4 pb-3 pt-3"
        >
          <FacilityConversationComposer
            value={input}
            onChange={setInput}
            onSubmit={() => void send()}
            busy={busy}
            placeholder="Ask Oyi about attention, ownership, verification, or execution history"
            variant="sheet"
            autoFocus={open}
          />
        </form>
      </section>
    </div>
  );
}
