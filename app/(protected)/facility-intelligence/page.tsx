"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, Bot, ChevronRight, Mic, ShieldCheck, Sparkles } from "lucide-react";
import { useSessionStore } from "@/store/useSessionStore";
import { oyiService, type OyiChatResponse } from "@/services/oyiService";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
  cards?: Array<Record<string, any>>;
  sources?: Array<Record<string, any>>;
  suggested_actions?: Array<Record<string, any>>;
};

function id() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function OyiOrb() {
  return (
    <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full border border-sky-200/22 bg-sky-400/12 shadow-[0_0_30px_rgba(56,189,248,0.24)]">
      <span className="absolute inset-[-10px] rounded-full bg-sky-400/10 blur-xl" />
      <span className="relative h-4 w-4 rounded-full bg-sky-200 shadow-[0_0_22px_rgba(125,211,252,0.95)]" />
    </span>
  );
}

function CardStack({ cards }: { cards?: Array<Record<string, any>> }) {
  if (!cards?.length) return null;
  return (
    <div className="mt-3 grid gap-2">
      {cards.slice(0, 4).map((card, index) => {
        const items = Array.isArray(card.items) ? card.items : [];
        return (
          <div key={`${card.type || card.title || "card"}-${index}`} className="rounded-[22px] border border-white/[0.075] bg-white/[0.045] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">
            <div className="text-[10px] uppercase tracking-[0.18em] text-sky-100/44">{String(card.type || "attention").replace(/_/g, " ")}</div>
            <div className="mt-1 text-sm font-semibold tracking-[-0.025em] text-white/90">{card.title || "Operational update"}</div>
            {card.summary ? <p className="mt-1 text-xs leading-5 text-zinc-400">{String(card.summary)}</p> : null}
            {items.length ? (
              <div className="mt-2 grid gap-1.5">
                {items.slice(0, 4).map((item: any, itemIndex: number) => (
                  <div key={itemIndex} className="flex items-center justify-between gap-3 rounded-2xl bg-black/18 px-3 py-2 text-xs">
                    <span className="min-w-0 truncate text-zinc-300">{item.title || item.label || "Item"}</span>
                    <span className="shrink-0 text-zinc-500">{item.status || item.occurred_at?.slice?.(0, 10) || ""}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function SuggestedActions({ actions }: { actions?: Array<Record<string, any>> }) {
  const rows = (actions || []).filter((action) => action?.route && action?.label);
  if (!rows.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {rows.slice(0, 5).map((action, index) => (
        <Link key={`${action.route}-${index}`} href={String(action.route)} className="inline-flex items-center gap-1.5 rounded-full border border-sky-300/14 bg-sky-400/[0.075] px-3 py-1.5 text-[11px] font-medium text-sky-100/84 transition active:scale-95">
          {action.label}
          <ChevronRight className="h-3 w-3" />
        </Link>
      ))}
    </div>
  );
}

export default function FacilityIntelligenceModule() {
  const { user } = useSessionStore();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: id(),
      role: "assistant",
      content: "Ask Oyi what is happening across the estate, what needs attention, or what you should do next. I’ll use facility context and keep actions read-only unless confirmation is explicitly required.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const quickPrompts = useMemo(
    () => ["What’s happening?", "What needs attention?", "What should I do next?", "Show maintenance issues", "Show visitor access", "Show camera events"],
    []
  );

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
        estate_id: (user as any)?.estate_id || null,
        module: "facility-intelligence",
        role: (user as any)?.role || null,
        thread_id: threadId,
      });
      if (response.thread_id) setThreadId(response.thread_id);
      setMessages(base.map((item) => item.id === pendingId ? {
        ...item,
        pending: false,
        content: response.message || "Oyi did not return a response.",
        cards: response.cards || [],
        sources: response.sources || [],
        suggested_actions: response.suggested_actions || [],
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

  return (
    <div className="mx-auto flex min-h-[calc(100vh-150px)] max-w-5xl flex-col gap-4 overflow-x-hidden pb-6 text-white">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/12 bg-sky-400/[0.06] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-sky-100/60">
            <Sparkles className="h-3.5 w-3.5" /> Facility Intelligence
          </div>
          <h1 className="mt-3 text-[28px] font-semibold tracking-[-0.055em] text-white sm:text-4xl">Ask Oyi Facility</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-400">Awareness, operations, infrastructure and intelligence in one conversation.</p>
        </div>
        <div className="hidden rounded-[24px] border border-white/10 bg-white/[0.045] p-3 text-zinc-300 shadow-[0_18px_60px_rgba(0,0,0,0.25)] sm:flex">
          <ShieldCheck className="h-5 w-5 text-sky-200" />
        </div>
      </header>

      <section className="rounded-[32px] border border-white/[0.075] bg-[radial-gradient(circle_at_20%_0%,rgba(56,189,248,0.12),rgba(255,255,255,0.045)_44%,rgba(255,255,255,0.025)_100%)] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur-2xl sm:p-5">
        <div className="flex items-center gap-3">
          <OyiOrb />
          <div className="min-w-0">
            <div className="text-[15px] font-semibold tracking-[-0.03em] text-white">Oyi Facility is listening</div>
            <div className="text-xs leading-5 text-zinc-400">Ask about visitors, maintenance, security, cameras, utilities, workflows, or operational attention.</div>
          </div>
        </div>
        <div className="mt-4 flex snap-x gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {quickPrompts.map((prompt) => (
            <button key={prompt} type="button" onClick={() => send(prompt)} disabled={busy} className="shrink-0 snap-start rounded-full border border-white/10 bg-white/[0.055] px-3.5 py-2 text-xs font-medium text-zinc-200 transition active:scale-95 disabled:opacity-50">
              {prompt}
            </button>
          ))}
        </div>
      </section>

      <section className="min-h-[360px] flex-1 rounded-[32px] border border-white/[0.07] bg-black/20 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-4">
        <div className="space-y-3">
          {messages.map((message) => {
            const mine = message.role === "user";
            return (
              <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[92%] rounded-[24px] px-4 py-3 text-sm leading-6 shadow-[0_14px_40px_rgba(0,0,0,0.22)] ${mine ? "bg-sky-400 text-slate-950" : "border border-white/[0.07] bg-white/[0.045] text-zinc-100"}`}>
                  <p className={message.pending ? "animate-pulse text-zinc-400" : ""}>{message.content}</p>
                  {!mine ? <CardStack cards={message.cards} /> : null}
                  {!mine ? <SuggestedActions actions={message.suggested_actions} /> : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <form onSubmit={onSubmit} className="sticky bottom-[calc(92px+env(safe-area-inset-bottom))] z-10 rounded-[28px] border border-white/[0.08] bg-zinc-950/86 p-2 shadow-[0_18px_60px_rgba(0,0,0,0.48)] backdrop-blur-2xl xl:bottom-4">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => inputRef.current?.focus()} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sky-400/12 text-sky-100">
            <Bot className="h-5 w-5" />
          </button>
          <input
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Message Oyi Facility..."
            className="min-w-0 flex-1 bg-transparent px-1 text-sm text-white outline-none placeholder:text-zinc-500"
          />
          <button type="button" onClick={() => inputRef.current?.focus()} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-300">
            <Mic className="h-4 w-4" />
          </button>
          <button type="submit" disabled={busy || !input.trim()} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-zinc-950 transition active:scale-95 disabled:opacity-40">
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
