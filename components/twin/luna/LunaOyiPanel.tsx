"use client";

import { useState } from "react";
import { useTwinData, type OyiResponse } from "oyi-twin-engine";
import { Sparkles } from "lucide-react";
import { useLunaTwinHost } from "./lunaTwinHostContext";

const SUGGESTED_PROMPTS = [
  "Show critical issues",
  "Show me the water problem",
  "Take me to Apartment 6A",
  "What is wrong with the building?",
  "Which cameras are offline?",
  "Show me the generator",
];

interface Exchange {
  question: string;
  response: OyiResponse;
}

/**
 * Facility-hosted Oyi interaction surface. All intent parsing and command
 * execution happens inside TwinIntelligenceController via askOyi
 * (LunaTwinProviders) — this component only renders the conversation, it
 * never resolves an intent or calls TwinRuntimeProvider itself, matching
 * Phase 7 §8's "do not build a second Facility-only conversational parser."
 */
export function LunaOyiPanel() {
  const twinData = useTwinData();
  const { askOyi } = useLunaTwinHost();
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [history, setHistory] = useState<Exchange[]>([]);

  const submit = async (text: string) => {
    const question = text.trim();
    if (!question || pending) return;
    setPending(true);
    setInput("");
    const response = await askOyi(question);
    setHistory((h) => [...h.slice(-2), { question, response }]);
    setPending(false);
  };

  const last = history[history.length - 1];
  const contextRef = last?.response.context.lastAssetRef ?? last?.response.context.lastSpaceRef;
  const contextLabel = contextRef ? (twinData.getAsset(contextRef)?.label ?? contextRef) : null;

  return (
    <div className="pointer-events-auto flex w-80 flex-col gap-2 rounded-xl border border-violet-500/15 bg-black/60 p-3 backdrop-blur">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-violet-200">
          <Sparkles className="h-3.5 w-3.5" />
          Ask Oyi
        </div>
        {contextLabel && <span className="truncate text-[10px] text-zinc-500">Context: {contextLabel}</span>}
      </div>

      <div className="max-h-40 space-y-2 overflow-y-auto">
        {history.length === 0 && <div className="text-[11px] leading-5 text-zinc-500">Ask about a system, a space, or an asset — Oyi will show and explain it.</div>}
        {history.map((exchange, i) => (
          <div key={i} className="space-y-1">
            <div className="text-[11px] font-medium text-zinc-200">{exchange.question}</div>
            <div
              className={`text-[11px] leading-5 ${
                exchange.response.deniedByScope ? "text-amber-300" : exchange.response.ok ? "text-zinc-400" : "text-rose-300"
              }`}
            >
              {exchange.response.text}
            </div>
          </div>
        ))}
        {pending && <div className="text-[11px] italic text-zinc-500">Thinking…</div>}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SUGGESTED_PROMPTS.map((p) => (
          <button
            key={p}
            disabled={pending}
            onClick={() => submit(p)}
            className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 text-[10px] text-violet-200 transition hover:bg-violet-500/15 disabled:opacity-40"
          >
            {p}
          </button>
        ))}
      </div>

      <form
        className="flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
      >
        <input
          value={input}
          disabled={pending}
          placeholder="Ask Oyi about Luna…"
          onChange={(e) => setInput(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[12px] text-white placeholder:text-zinc-600 focus:border-violet-500/40 focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="shrink-0 rounded-lg border border-violet-500/30 bg-violet-500/15 px-3 py-1.5 text-[12px] text-violet-200 transition hover:bg-violet-500/20 disabled:opacity-40"
        >
          Ask
        </button>
      </form>
    </div>
  );
}
