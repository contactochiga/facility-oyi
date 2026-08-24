"use client";

import { useEffect, useRef } from "react";
import { History, Sparkles, X } from "lucide-react";
import OyiComposer from "./OyiComposer";
import OyiProcessingRow from "./OyiProcessingRow";
import type { OyiInteractionShellProps } from "./types";

export default function OyiInteractionShell(props: OyiInteractionShellProps) {
  const panelRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(props.onClose);

  useEffect(() => { onCloseRef.current = props.onClose; }, [props.onClose]);

  useEffect(() => {
    if (!props.open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      (props.returnFocusRef?.current || previouslyFocused)?.focus?.({ preventScroll: true });
    };
  }, [props.open, props.returnFocusRef]);

  if (!props.open) return null;
  const visibleMessages = props.messages.filter((message) => !message.pending);

  return (
    <div className="oyi-shell-layer" data-oyi-interaction-shell="true">
      <button type="button" className="oyi-shell-dismiss" aria-label="Close Oyi" onClick={props.onClose} />
      <section ref={panelRef} id="facility-oyi-panel" className="oyi-shell-panel" style={props.panelStyle} role="dialog" aria-modal="true" aria-labelledby="facility-oyi-title">
        <header className="oyi-shell-header">
          <span className="oyi-shell-avatar" aria-hidden="true"><Sparkles /></span>
          <div className="min-w-0 flex-1">
            <h2 id="facility-oyi-title">{props.title}</h2>
            <p>{props.subtitle}{props.contextLabel ? ` · ${props.contextLabel}` : ""}</p>
          </div>
          {props.headerActions}
          {props.onToggleHistory ? <button type="button" className="oyi-shell-header-button" onClick={props.onToggleHistory} aria-label="Conversation history" aria-expanded={props.historyOpen}><History /></button> : null}
          <button ref={closeRef} type="button" className="oyi-shell-header-button" onClick={props.onClose} aria-label="Close Oyi"><X /></button>
        </header>
        {props.historyOpen ? props.history : null}
        <div className="oyi-shell-viewport" style={props.viewportStyle}>
          {!visibleMessages.length ? props.emptyState : null}
          {visibleMessages.map((message) => props.renderMessage ? props.renderMessage(message) : (
            <div key={message.id} className={`oyi-shell-message-row ${message.role}`}><div className="oyi-shell-message"><p>{message.content}</p></div></div>
          ))}
          {props.processingLabel ? <OyiProcessingRow label={props.processingLabel} icon={props.processingIcon} /> : null}
        </div>
        <form ref={props.composerRef} className="oyi-shell-composer" onSubmit={(event) => { event.preventDefault(); props.onSubmit(props.input); }}>
          <OyiComposer value={props.input} onChange={props.onInputChange} onSubmit={() => props.onSubmit(props.input)} busy={props.busy} capabilities={props.capabilities} onStartVoice={props.onStartVoice} voiceActive={props.voiceActive} voiceElapsed={props.voiceElapsed} voiceError={props.voiceError} onStopVoice={props.onStopVoice} onCancelVoice={props.onCancelVoice} />
        </form>
      </section>
    </div>
  );
}
