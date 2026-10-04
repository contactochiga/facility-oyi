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
import { normalizeOyiSuggestions, normalizeOyiThreads, orbStateForView, OYI_VOICE_IDLE_SNAPSHOT, OYI_WORKING_TEXT, OyiOrb, useOyiConnectivity, useOyiInteraction, voiceSnapshotEvents, type OyiVoiceSnapshot } from "oyi-interaction";
import "oyi-interaction/styles.css";
import { createFacilitySurfaceAdapter } from "@/lib/oyi/facilitySurfaceAdapter";
import { facilityVoiceSnapshot } from "@/lib/oyi/facilityVoice";

export default function FacilityAssistantSheet() {
  const router = useRouter();
  const pathname = usePathname() || "/overview";
  const searchParams = useSearchParams();
  const { user } = useSessionStore();
  const { context } = useContextStore();
  const { open, focusHint, source, activeContext, openAssistant, closeAssistant } = useFacilityAssistantStore();
  const { messages, threads, threadId, busy, error: conversationError, hydrate, restoreThread, sendMessage } = useFacilityConversationStore();
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

  // Shared Oyi interaction state. The conversation store owns the request;
  // this projects its lifecycle (and voice/connectivity) into the ONE
  // interaction reducer. Facility realtime is not involved.
  const [interaction, dispatchInteraction] = useOyiInteraction();
  useOyiConnectivity(dispatchInteraction);
  const trackedTurnRef = useRef<string | null>(null);
  const speechAvailable = typeof window !== "undefined" && "speechSynthesis" in window;
  useEffect(() => {
    const pendingMessage = messages.find((message) => message.pending);
    if (pendingMessage && trackedTurnRef.current !== pendingMessage.id) {
      trackedTurnRef.current = pendingMessage.id;
      dispatchInteraction({ type: "turn.submitted", turnId: pendingMessage.id });
      return;
    }
    if (pendingMessage || !trackedTurnRef.current) return;
    const turnId = trackedTurnRef.current;
    trackedTurnRef.current = null;
    const settled = messages.find((message) => message.id === turnId);
    if (!settled) return;
    if (conversationError && !settled.execution) {
      dispatchInteraction({ type: "turn.failed", turnId, reason: typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "network" });
      return;
    }
    dispatchInteraction({ type: "turn.response", turnId, response: { reply: settled.content, execution: settled.execution, confirmations: settled.confirmations, requiresConfirmation: settled.requiresConfirmation, approvalRequired: settled.approvalRequired } });
    // Responding lasts only while the reply is actually spoken.
    if (!(open && voiceReplyEnabled && speechAvailable)) dispatchInteraction({ type: "turn.presented", turnId });
  }, [conversationError, dispatchInteraction, messages, open, speechAvailable, voiceReplyEnabled]);

  const voiceSnapshotRef = useRef<OyiVoiceSnapshot>(OYI_VOICE_IDLE_SNAPSHOT);
  useEffect(() => {
    const next = facilityVoiceSnapshot({ supported: voice.supported, recording: voice.recording, error: voice.error });
    for (const event of voiceSnapshotEvents(voiceSnapshotRef.current, next)) dispatchInteraction(event);
    voiceSnapshotRef.current = next;
  }, [dispatchInteraction, voice.error, voice.recording, voice.supported]);

  const estateName = (user as any)?.estate_id ? String((user as any)?.estate_name || "this estate") : null;
  const surfaceAdapter = useMemo(() => createFacilitySurfaceAdapter({
    user: user as any,
    estateId: context?.estate_id || (user as any)?.estate_id || null,
    estateName,
    buildingId: activeContext?.scope.building_id || null,
    homeId: context?.home_id || null,
    operationalObject: ((activeOperationalObject || operationalObject) as Record<string, unknown> | null) || null,
    voiceEntry: voice.supported,
  }), [activeContext?.scope.building_id, activeOperationalObject, context?.estate_id, context?.home_id, estateName, operationalObject, user, voice.supported]);
  const starterSuggestion = useMemo(() => normalizeOyiSuggestions(surfaceAdapter.starterSeeds(), { source: "seed", max: 1 })[0] || null, [surfaceAdapter]);
  const historyThreads = useMemo(() => normalizeOyiThreads(threads, { activeThreadId: threadId }), [threadId, threads]);

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
    const utterance = new SpeechSynthesisUtterance(latest.content);
    utterance.onend = () => dispatchInteraction({ type: "turn.presented", turnId: latest.id });
    utterance.onerror = () => dispatchInteraction({ type: "turn.presented", turnId: latest.id });
    window.speechSynthesis.speak(utterance);
  }, [dispatchInteraction, messages, open, voiceReplyEnabled]);

  async function send(value = input) {
    const message = value.trim();
    if (!message || busy) return;
    setInput("");
    await sendMessage({ message, context, estateId: context?.estate_id || (user as any)?.estate_id || null, homeId: context?.home_id || null, role: user?.role || null, module: moduleContext, page: pathname, route: pathname, filters: pageFilters, focusHint: focusHint || null, operationalObject: activeOperationalObject || operationalObject, activeIntelligenceContext: activeContext });
  }
  async function restoreAndProject(nextThreadId: string) {
    await restoreThread(nextThreadId);
    const restored = useFacilityConversationStore.getState().messages;
    const latest = [...restored].reverse().find((message) => message.role === "assistant" && !message.pending) || null;
    dispatchInteraction({ type: "thread.restored", latestAssistant: latest ? { reply: latest.content, execution: latest.execution } : null });
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

  return <OyiInteractionShell
    open={open} title="Oyi" subtitle="Facility Intelligence"
    contextLabel={source === "voice" ? "Voice" : undefined}
    messages={messages} processingLabel={pending?.content || (busy ? OYI_WORKING_TEXT : null)}
    statusOrb={<><OyiOrb size="small" state={orbStateForView(interaction)} className="facility-oyi-status-orb" /><span className="oyi-visually-hidden" role="status" aria-live="polite">{interaction.label}</span></>}
    input={input} onInputChange={setInput} onSubmit={(value) => void send(value)}
    onClose={() => { voice.cancel(); setHistoryOpen(false); closeAssistant(); }} busy={busy}
    capabilities={capabilities} onStartVoice={voice.supported ? () => { voice.clearError(); voice.start(); } : undefined}
    voiceActive={voice.recording} voiceElapsed={voice.elapsed} voiceError={voice.error}
    onStopVoice={voice.stop} onCancelVoice={voice.cancel} composerRef={composerRef}
    panelStyle={{ maxHeight: viewportHeight ? `${Math.max(viewportHeight - 24, 320)}px` : undefined, paddingBottom: `calc(env(safe-area-inset-bottom) + ${keyboardInset}px)` }}
    onToggleHistory={() => setHistoryOpen((current) => !current)} historyOpen={historyOpen}
    headerActions={<button type="button" className="oyi-shell-header-button" onClick={() => setVoiceReplyEnabled((current) => !current)} aria-label={voiceReplyEnabled ? "Disable voice replies" : "Enable voice replies"} aria-pressed={voiceReplyEnabled}>{voiceReplyEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</button>}
    history={<div className="max-h-44 overflow-y-auto border-b border-white/[0.09] p-2.5"><p className="px-1.5 pb-1.5 text-[10px] uppercase tracking-[0.08em] text-zinc-400">Recent conversations</p>{historyThreads.length ? <div className="space-y-1">{historyThreads.map((thread) => <button key={thread.id} type="button" aria-current={thread.active ? "true" : undefined} onClick={() => { void restoreAndProject(thread.id); setHistoryOpen(false); }} className="block w-full rounded-[4px] px-2 py-1.5 text-left text-[12px] text-zinc-300 hover:bg-white/[0.05]"><span className="block truncate">{thread.title === "Oyi conversation" ? "Operational conversation" : thread.title}</span></button>)}</div> : <p className="px-2 py-3 text-[12px] text-zinc-500">No saved conversations yet.</p>}</div>}
    emptyState={<div className="rounded-[5px] border border-white/[0.09] bg-white/[0.03] p-3.5"><p className="text-[12.5px] text-white">Facility intelligence is ready.</p><p className="mt-1 text-[11.5px] leading-5 text-zinc-400">Ask about this domain, buildings, assets, utilities, security, maintenance, or finance.</p><button type="button" onClick={() => void send(starterSuggestion?.prompt || "Summarize current operational attention.")} className="mt-3 rounded-[4px] border border-sky-300/20 bg-sky-400/10 px-2.5 py-1.5 text-[11.5px] text-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/70">Start intelligence brief</button></div>}
    renderMessage={(message: OyiShellMessage) => <FacilityConversationFeed key={message.id} messages={[message as FacilityChatMessage]} emptyMessage="" onAction={handleAction} interactive={false} compact />}
  />;
}
