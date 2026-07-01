"use client";

import { Mic, SendHorizontal, Square, X } from "lucide-react";
import { useSpeechComposer } from "@/hooks/useSpeechComposer";

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export default function FacilityConversationComposer({
  value,
  onChange,
  onSubmit,
  busy,
  placeholder,
  variant = "page",
  onClose,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  busy?: boolean;
  placeholder: string;
  variant?: "page" | "sheet" | "footer";
  onClose?: () => void;
}) {
  const voice = useSpeechComposer((text) => onChange(text));
  const compact = variant === "footer";

  return (
    <div className={`rounded-[24px] border border-white/[0.08] bg-white/[0.035] ${compact ? "px-3 py-2" : "px-3 py-2.5"} shadow-[0_10px_30px_rgba(0,0,0,0.22)]`}>
      {voice.recording ? (
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-sky-300/14 bg-sky-400/[0.08] px-3 py-2 text-[11px] text-sky-50/84">
            <span className="flex items-end gap-[2px]">
              {[8, 14, 10, 16].map((height, index) => (
                <span key={index} className="w-[3px] animate-pulse rounded-full bg-sky-200/85" style={{ height }} />
              ))}
            </span>
            <span className="tabular-nums">{formatTimer(voice.elapsed)}</span>
            <span className="truncate text-white/66">Listening… speak your request.</span>
          </div>
          <button type="button" onClick={voice.cancel} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.045] text-white/78" aria-label="Cancel voice input">
            <X className="h-4 w-4" />
          </button>
          <button type="button" onClick={voice.stop} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-sky-300/16 bg-sky-400/[0.08] text-sky-100" aria-label="Stop voice input">
            <Square className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => { voice.stop(); if (value.trim()) onSubmit(); }} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sky-300 text-slate-950" aria-label="Send voice input">
            <SendHorizontal className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-end gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <textarea
              value={value}
              onChange={(event) => onChange(event.target.value)}
              rows={1}
              placeholder={placeholder}
              className={`max-h-28 min-h-[24px] min-w-0 flex-1 resize-none bg-transparent text-sm text-white outline-none placeholder:text-zinc-500 ${compact ? "leading-5" : "leading-6"}`}
            />
            <button
              type="button"
              onClick={() => { voice.clearError(); voice.start(); }}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.045] text-white/78"
              aria-label="Start voice input"
            >
              <Mic className="h-4 w-4" />
            </button>
          </div>
          {onClose ? (
            <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.03] text-zinc-400" aria-label="Close chat composer">
              <X className="h-4 w-4" />
            </button>
          ) : null}
          <button type="button" disabled={busy || !value.trim()} onClick={onSubmit} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sky-300 text-slate-950 disabled:opacity-40" aria-label="Send chat message">
            <SendHorizontal className="h-4 w-4" />
          </button>
        </div>
      )}
      {voice.error ? <p className="mt-2 text-[11px] text-amber-200">{voice.error}</p> : null}
    </div>
  );
}
