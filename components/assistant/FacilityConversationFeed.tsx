"use client";

import { ChevronRight, Copy, ThumbsUp, Volume2 } from "lucide-react";
import type { FacilityChatMessage } from "@/store/useFacilityConversationStore";

type ConversationAction = Record<string, any>;

function infrastructureSource(card: Record<string, any>, item: Record<string, any>) {
  const value = `${card.type || ""} ${card.title || ""} ${card.summary || ""} ${item.domain || ""} ${item.type || ""} ${item.source || ""} ${item.title || ""}`.toLowerCase();
  if (/camera|cctv/.test(value)) return "cameras";
  if (/provider|tuya|mqtt|onvif/.test(value)) return "providers";
  if (/edge|runtime|infrastructure/.test(value)) return "edge";
  if (/utility|water|electric|meter|generator/.test(value)) return "utilities";
  if (/device|hardware|switch|relay|light|ac/.test(value)) return "devices";
  return null;
}

function shouldRenderSupport(displayMode?: string) {
  return new Set(["list", "detail", "audit", "report", "awareness"]).has(String(displayMode || "conversation"));
}

function CardStack({
  cards,
  onAction,
}: {
  cards?: Array<Record<string, any>>;
  onAction: (action: ConversationAction) => void;
}) {
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
                  <button
                    key={itemIndex}
                    type="button"
                    onClick={() => onAction({ ...item, target: item.target || card.target, infrastructure_source: infrastructureSource(card, item) })}
                    className="flex w-full items-start justify-between gap-3 rounded-2xl bg-black/18 px-3 py-2 text-left text-xs"
                  >
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

function OperatingStatus({ execution }: { execution?: Record<string, any> }) {
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

function AccountabilityStrip({ execution }: { execution?: Record<string, any> }) {
  const results = Array.isArray(execution?.results) ? execution.results : [];
  const first = results[0] || execution || {};
  const rows = [
    ["Origin", first.origin || first.executionSource || first.source],
    ["Initiator", first.initiatorType || first.actorRole || first.actor],
    ["Provider", first.provider],
    ["Approval", first.approvedBy ? `Approved by ${first.approvedBy}` : first.approvalRequired ? "Required" : "Not required"],
    ["Trust", typeof first.trustScore === "number" ? `${Math.round(first.trustScore * 100)}%` : null],
  ].filter(([, value]) => value);

  if (!rows.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {rows.slice(0, 5).map(([label, value]) => (
        <span key={label} className="rounded-full border border-white/[0.08] bg-white/[0.045] px-2.5 py-1 text-[10px] text-zinc-300">
          <span className="text-zinc-500">{label}</span> {String(value)}
        </span>
      ))}
    </div>
  );
}

function SuggestedActions({
  actions,
  onAction,
}: {
  actions?: Array<Record<string, any>>;
  onAction: (action: ConversationAction) => void;
}) {
  const rows = (actions || []).filter((action) => action?.label);
  if (!rows.length) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {rows.slice(0, 5).map((action, index) => (
        <button
          key={`${action.route || action.label}-${index}`}
          type="button"
          onClick={() => onAction(action)}
          className="inline-flex items-center gap-1.5 rounded-full border border-sky-300/14 bg-sky-400/[0.075] px-3 py-1.5 text-[11px] font-medium text-sky-100/84 transition active:scale-95"
        >
          {action.label}
          <ChevronRight className="h-3 w-3" />
        </button>
      ))}
    </div>
  );
}

export default function FacilityConversationFeed({
  messages,
  emptyMessage,
  onAction,
  onCopy,
  onSpeak,
  onHelpful,
  helpfulResponses,
  interactive = true,
  compact = false,
}: {
  messages: FacilityChatMessage[];
  emptyMessage: string;
  onAction: (action: ConversationAction) => void;
  onCopy?: (content: string) => void;
  onSpeak?: (content: string) => void;
  onHelpful?: (messageId: string) => void;
  helpfulResponses?: Record<string, boolean>;
  interactive?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {!messages.length && emptyMessage.trim() ? <p className="rounded-[22px] border border-white/[0.07] bg-white/[0.03] p-4 text-sm text-zinc-500">{emptyMessage}</p> : null}
      {messages.map((message) => {
        const mine = message.role === "user";
        return (
          <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
            <div className={`${compact ? "max-w-[88%] rounded-[5px] px-3 py-2 text-[12.5px] leading-[1.55]" : "max-w-[94%] rounded-[24px] px-4 py-3 text-sm leading-6 shadow-[0_14px_40px_rgba(0,0,0,0.22)] sm:max-w-[88%]"} overflow-hidden ${mine ? (compact ? "bg-sky-400/20 text-white" : "bg-sky-400 text-slate-950") : "border border-white/[0.09] bg-white/[0.045] text-zinc-100"}`}>
              <p className={`whitespace-pre-wrap break-words ${message.pending ? "animate-pulse text-zinc-400" : ""}`}>{message.content}</p>
              {!mine && shouldRenderSupport(message.display_mode) ? (
                <>
                  <CardStack cards={message.cards} onAction={onAction} />
                  <OperatingStatus execution={message.execution} />
                  <AccountabilityStrip execution={message.execution} />
                  <SuggestedActions actions={message.suggested_actions} onAction={onAction} />
                </>
              ) : null}
              {!mine && interactive && !message.pending ? (
                <div className="mt-2.5 flex items-center gap-1.5 border-t border-white/[0.055] pt-2">
                  <button type="button" onClick={() => onCopy?.(message.content)} className="grid h-7 w-7 place-items-center rounded-full text-white/30 transition hover:bg-white/[0.055] hover:text-white/72 active:scale-95" aria-label="Copy Oyi response">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => onSpeak?.(message.content)} className="grid h-7 w-7 place-items-center rounded-full text-white/30 transition hover:bg-white/[0.055] hover:text-white/72 active:scale-95" aria-label="Listen to Oyi response">
                    <Volume2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onHelpful?.(message.id)}
                    className={`grid h-7 w-7 place-items-center rounded-full transition hover:bg-white/[0.055] active:scale-95 ${helpfulResponses?.[message.id] ? "text-sky-200" : "text-white/30 hover:text-white/72"}`}
                    aria-label="Mark Oyi response helpful"
                  >
                    <ThumbsUp className={`h-3.5 w-3.5 ${helpfulResponses?.[message.id] ? "fill-current" : ""}`} />
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
