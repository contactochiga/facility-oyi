"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, Volume2, VolumeX } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import OyiInteractionShell from "@/components/oyi-shell/OyiInteractionShell";
import type { OyiShellCapability, OyiShellMessage } from "@/components/oyi-shell/types";
import FacilityConversationFeed from "@/components/assistant/FacilityConversationFeed";
import { useSpeechComposer } from "@/hooks/useSpeechComposer";
import { useViewportDockLayout } from "@/hooks/useViewportDockLayout";
import { deriveFacilityOperationalObject } from "@/services/operationalObjectContext";
import { useContextStore } from "@/store/useContextStore";
import { useFacilityAssistantStore } from "@/store/useFacilityAssistantStore";
import { useFacilityConversationStore, type FacilityChatMessage } from "@/store/useFacilityConversationStore";
import { useSessionStore } from "@/store/useSessionStore";

export default function FacilityAssistantSheet() {
  const router = useRouter();
  const pathname = usePathname() || "/overview";
  const searchParams = useSearchParams();
  const { user } = useSessionStore();
  const { context } = useContextStore();
  const { open, focusHint, source, activeContext, openAssistant, closeAssistant } = useFacilityAssistantStore();
  const { messages, threads, busy, hydrate, restoreThread, sendMessage } = useFacilityConversationStore();
  const [input, setInput] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [voiceReplyEnabled, setVoiceReplyEnabled] = useState(true);
  const composerRef = useRef<HTMLFormElement | null>(null);
  const spokenRef = useRef("");
  const voice = useSpeechComposer(setInput);
  const { viewportHeight, keyboardInset } = useViewportDockLayout({ active: open, dockRef: composerRef, lockDocument: true });

  const pageFilters = useMemo(() => Object.fromEntries(Array.from(searchParams.entries()).slice(0, 12)), [searchParams]);
  const moduleContext = useMemo(() => pathname.replace(/^\//, "").split("/")[0] || "overview", [pathname]);
  const operationalObject = useMemo(() => deriveFacilityOperationalObject({ module: moduleContext, pathname, estate_id: context?.estate_id || (user as any)?.estate_id || null, home_id: context?.home_id || null, searchParams }), [context?.estate_id, context?.home_id, moduleContext, pathname, searchParams, user]);
  const activeOperationalObject = useMemo(() => {
    const object = activeContext?.selected_subobject || activeContext?.primary_object;
    if (!activeContext || !object) return null;
    return {
      object_type: object.object_type, canonical_id: object.canonical_id, label: object.label,
      estate_id: activeContext.scope.estate_id, building_id: activeContext.scope.building_id,
      home_id: activeContext.scope.home_id, room_id: activeContext.scope.room_id,
      parent_id: "parent_id" in object ? object.parent_id || null : null,
      source_module: activeContext.primary_object?.source_module || activeContext.module,
      metadata: { active_context: { context_id: activeContext.context_id, context_version: activeContext.context_version, source: activeContext.source }, visible_state: activeContext.visible_state },
    };
  }, [activeContext]);
  const pending = messages.find((message) => message.pending);

  useEffect(() => {
    if (searchParams.get("oyi") === "open" && !open) openAssistant();
  }, [open, openAssistant, searchParams]);
  useEffect(() => { if (open) setInput(focusHint || ""); }, [focusHint, open]);
  useEffect(() => {
    if (!open) return;
    void hydrate({ context, estateId: context?.estate_id || (user as any)?.estate_id || null, homeId: context?.home_id || null, userId: (user as any)?.id || null });
  }, [context, hydrate, open, user]);
  useEffect(() => {
    if (!open || !voiceReplyEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const latest = [...messages].reverse().find((item) => item.role === "assistant" && !item.pending && item.content.trim());
    if (!latest || spokenRef.current === latest.id) return;
    spokenRef.current = latest.id;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(latest.content));
  }, [messages, open, voiceReplyEnabled]);

  async function send(value = input) {
    const message = value.trim();
    if (!message || busy) return;
    setInput("");
    await sendMessage({ message, context, estateId: context?.estate_id || (user as any)?.estate_id || null, homeId: context?.home_id || null, role: user?.role || null, module: moduleContext, page: pathname, route: pathname, filters: pageFilters, focusHint: focusHint || null, operationalObject: activeOperationalObject || operationalObject, activeIntelligenceContext: activeContext });
  }
  function handleAction(action: Record<string, any>) {
    // PHASE 3 (Milestone 1): a Confirm/Cancel tap re-sends a plain reply
    // through the same conversation call as typing it -- no separate
    // execution path.
    if (action.type === "confirm_reply") { void send(String(action.reply || "confirm")); return; }
    if (action.route) { closeAssistant(); router.push(String(action.route)); return; }
    if (action.prompt || action.label) void send(String(action.prompt || action.label));
  }

  const capabilities = useMemo<OyiShellCapability[]>(() => voice.supported ? [{ id: "voice-input", label: "Voice input", description: "Speak a request for Oyi to transcribe", icon: Mic, onSelect: () => { voice.clearError(); voice.start(); } }] : [], [voice]);
  const starter = (user as any)?.estate_id ? `Summarize current operational attention for ${String((user as any)?.estate_name || "this estate")}.` : "Summarize current operational attention.";

  return <OyiInteractionShell
    open={open} title="Oyi" subtitle="Facility Intelligence"
    contextLabel={source === "voice" ? "Voice" : undefined}
    messages={messages} processingLabel={pending?.content || (busy ? "Checking facility records…" : null)}
    input={input} onInputChange={setInput} onSubmit={(value) => void send(value)}
    onClose={() => { voice.cancel(); setHistoryOpen(false); closeAssistant(); }} busy={busy}
    capabilities={capabilities} onStartVoice={voice.supported ? () => { voice.clearError(); voice.start(); } : undefined}
    voiceActive={voice.recording} voiceElapsed={voice.elapsed} voiceError={voice.error}
    onStopVoice={voice.stop} onCancelVoice={voice.cancel} composerRef={composerRef}
    panelStyle={{ maxHeight: viewportHeight ? `${Math.max(viewportHeight - 24, 320)}px` : undefined, paddingBottom: `calc(env(safe-area-inset-bottom) + ${keyboardInset}px)` }}
    onToggleHistory={() => setHistoryOpen((current) => !current)} historyOpen={historyOpen}
    headerActions={<button type="button" className="oyi-shell-header-button" onClick={() => setVoiceReplyEnabled((current) => !current)} aria-label={voiceReplyEnabled ? "Disable voice replies" : "Enable voice replies"} aria-pressed={voiceReplyEnabled}>{voiceReplyEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</button>}
    history={<div className="max-h-44 overflow-y-auto border-b border-white/[0.09] p-2.5"><p className="px-1.5 pb-1.5 text-[10px] uppercase tracking-[0.08em] text-zinc-400">Recent conversations</p>{threads.length ? <div className="space-y-1">{threads.map((thread) => <button key={thread.id} type="button" onClick={() => { void restoreThread(thread.id); setHistoryOpen(false); }} className="block w-full rounded-[4px] px-2 py-1.5 text-left text-[12px] text-zinc-300 hover:bg-white/[0.05]"><span className="block truncate">{thread.title || "Operational conversation"}</span></button>)}</div> : <p className="px-2 py-3 text-[12px] text-zinc-500">No saved conversations yet.</p>}</div>}
    emptyState={<div className="rounded-[5px] border border-white/[0.09] bg-white/[0.03] p-3.5"><p className="text-[12.5px] text-white">Facility intelligence is ready.</p><p className="mt-1 text-[11.5px] leading-5 text-zinc-400">Ask about this domain, buildings, assets, utilities, security, maintenance, or finance.</p><button type="button" onClick={() => void send(starter)} className="mt-3 rounded-[4px] border border-sky-300/20 bg-sky-400/10 px-2.5 py-1.5 text-[11.5px] text-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/70">Start intelligence brief</button></div>}
    renderMessage={(message: OyiShellMessage) => <FacilityConversationFeed key={message.id} messages={[message as FacilityChatMessage]} emptyMessage="" onAction={handleAction} interactive={false} compact />}
  />;
}
