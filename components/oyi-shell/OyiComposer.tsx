"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Plus, SendHorizontal, Square, X } from "lucide-react";
import type { OyiShellCapability } from "./types";

function timer(seconds = 0) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function OyiComposer({ value, onChange, onSubmit, busy, capabilities = [], onStartVoice, voiceActive, voiceElapsed, voiceError, onStopVoice, onCancelVoice }: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  busy?: boolean;
  capabilities?: OyiShellCapability[];
  onStartVoice?: () => void;
  voiceActive?: boolean;
  voiceElapsed?: number;
  voiceError?: string | null;
  onStopVoice?: () => void;
  onCancelVoice?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const canSend = Boolean(value.trim()) && !busy;

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [menuOpen]);

  if (voiceActive) {
    return (
      <div className="oyi-shell-recording" role="status" aria-live="polite">
        <span className="oyi-shell-recording-dot" aria-hidden="true" />
        <span className="tabular-nums">{timer(voiceElapsed)}</span>
        <span className="min-w-0 flex-1 truncate">Listening…</span>
        <button type="button" className="oyi-shell-icon-button" onClick={onCancelVoice} aria-label="Cancel voice input"><X /></button>
        <button type="button" className="oyi-shell-icon-button is-active" onClick={onStopVoice} aria-label="Stop voice input"><Square /></button>
      </div>
    );
  }

  return (
    <div className="oyi-shell-composer-wrap">
      <div className="relative" ref={menuRef}>
        <button type="button" className="oyi-shell-icon-button" disabled={!capabilities.length} onClick={() => setMenuOpen((current) => !current)} aria-label="Oyi capabilities" aria-expanded={menuOpen} aria-controls="oyi-capability-menu"><Plus /></button>
        {menuOpen ? (
          <div id="oyi-capability-menu" role="menu" className="oyi-shell-capability-menu">
            {capabilities.map((capability) => {
              const Icon = capability.icon;
              return (
                <button key={capability.id} type="button" role="menuitem" onClick={() => { setMenuOpen(false); capability.onSelect(); }}>
                  <span className="oyi-shell-capability-icon" aria-hidden="true"><Icon /></span>
                  <span><strong>{capability.label}</strong><small>{capability.description}</small></span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            if (canSend) onSubmit();
          }
        }}
        rows={1}
        placeholder="Ask Oyi anything…"
        aria-label="Message Oyi"
      />
      {onStartVoice ? <button type="button" className="oyi-shell-icon-button" onClick={onStartVoice} disabled={busy} aria-label="Start voice input"><Mic /></button> : null}
      <button type="button" className="oyi-shell-send" disabled={!canSend} onClick={onSubmit} aria-label="Send message"><SendHorizontal /></button>
      {voiceError ? <p className="oyi-shell-composer-error">{voiceError}</p> : null}
    </div>
  );
}
