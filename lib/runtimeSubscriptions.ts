import type { NormalizedSignal } from "@/lib/operationalSignal";
import type { ConversationRequest, ConversationResponse } from "@/lib/conversationRuntime";
import type { ExecutiveBriefing } from "@/lib/executiveRuntime";
import type { OperationalRecommendation } from "@/lib/operationalRecommendations";
import type { OperationalInsight } from "@/lib/operationalReasoning";
import type { AutomationPlan } from "@/lib/safeAutomationRuntime";
import type { OperationalAwareness } from "@/services/contextAwarenessEngine";

export type RuntimeChannel =
  | "facility:signal"
  | "facility:awareness"
  | "facility:insight"
  | "facility:recommendation"
  | "facility:automation"
  | "consumer:signal"
  | "consumer:awareness"
  | "consumer:insight"
  | "consumer:recommendation"
  | "consumer:automation"
  | "office:awareness"
  | "office:insight"
  | "office:recommendation"
  | "office:automation"
  | "notification:event"
  | "notification:recommendation"
  | "notification:automation"
  | "activity:event"
  | "activity:recommendation"
  | "activity:automation"
  | "conversation:request"
  | "conversation:response"
  | "conversation:intent"
  | "conversation:navigation"
  | "conversation:action"
  | "conversation:summary"
  | "executive:briefing"
  | "executive:summary"
  | "executive:risk"
  | "executive:portfolio"
  | "executive:health"
  | "executive:recommendation"
  | "future:digital-twin"
  | "future:conversation"
  | "future:executive";

export const RUNTIME_CHANNELS: RuntimeChannel[] = [
  "facility:signal",
  "facility:awareness",
  "facility:insight",
  "facility:recommendation",
  "facility:automation",
  "consumer:signal",
  "consumer:awareness",
  "consumer:insight",
  "consumer:recommendation",
  "consumer:automation",
  "office:awareness",
  "office:insight",
  "office:recommendation",
  "office:automation",
  "notification:event",
  "notification:recommendation",
  "notification:automation",
  "activity:event",
  "activity:recommendation",
  "activity:automation",
  "conversation:request",
  "conversation:response",
  "conversation:intent",
  "conversation:navigation",
  "conversation:action",
  "conversation:summary",
  "executive:briefing",
  "executive:summary",
  "executive:risk",
  "executive:portfolio",
  "executive:health",
  "executive:recommendation",
  "future:digital-twin",
  "future:conversation",
  "future:executive",
];

export type RuntimePayloadKind = "signal" | "awareness" | "insight" | "recommendation" | "automation" | "conversation" | "executive";

export type RuntimeDeliveryPayload = {
  event?: string;
  payload?: Record<string, unknown>;
  signal?: NormalizedSignal;
  awareness?: OperationalAwareness;
  insights?: OperationalInsight[];
  recommendations?: OperationalRecommendation[];
  automationPlans?: AutomationPlan[];
  conversationRequest?: ConversationRequest;
  conversationResponse?: ConversationResponse;
  executiveBriefing?: ExecutiveBriefing;
  receipt?: Record<string, unknown>;
  source?: string;
};

export type RuntimeDelivery = {
  id: string;
  sequence: number;
  channel: RuntimeChannel;
  kind: RuntimePayloadKind;
  createdAt: string;
  payload: RuntimeDeliveryPayload;
};

export type RuntimeSubscriber = {
  id: string;
  channels: RuntimeChannel[];
  replay?: number;
  onEvent: (delivery: RuntimeDelivery) => void;
};

type PublishInput = {
  kind: RuntimePayloadKind;
  payload: RuntimeDeliveryPayload;
  channels: RuntimeChannel[];
  dedupeKey?: string;
  createdAt?: string;
};

type SubscriberState = {
  subscriber: RuntimeSubscriber;
  order: number;
  deliveries: Map<string, number>;
};

const DEFAULT_REPLAY = 10;
const DEFAULT_BUFFER = 40;
const DEFAULT_DEDUPE_WINDOW_MS = 1000 * 60 * 10;

function text(value: unknown) {
  return String(value ?? "").trim();
}

function lower(value: unknown) {
  return text(value).toLowerCase();
}

function timeMs(value: string) {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function canUseWindow() {
  return typeof window !== "undefined" && typeof window.dispatchEvent === "function";
}

function dispatchBrowserEvent(name: string, detail: RuntimeDeliveryPayload) {
  if (!canUseWindow()) return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function dedupeIdentity(payload: RuntimeDeliveryPayload) {
  const signal = payload.signal;
  const awareness = payload.awareness;
  const insights = payload.insights || [];
  return lower(
    [
      payload.event,
      signal?.id,
      awareness?.id,
      insights.map((item) => item.id).join(","),
      signal?.domain,
      signal?.entity.id || signal?.entity.name,
      awareness?.kind,
    ].join(":")
  );
}

export class RuntimeSubscriptionEngine {
  private sequence = 0;
  private registry = new Map<string, SubscriberState>();
  private history = new Map<RuntimeChannel, RuntimeDelivery[]>();
  private booted = false;
  private order = 0;

  constructor(private options: { replayBuffer?: number; dedupeWindowMs?: number } = {}) {}

  register(subscriber: RuntimeSubscriber) {
    if (this.registry.has(subscriber.id)) return () => this.unregister(subscriber.id);
    const state: SubscriberState = {
      subscriber,
      order: this.order++,
      deliveries: new Map(),
    };
    this.registry.set(subscriber.id, state);
    const replayCount = subscriber.replay ?? 0;
    if (replayCount > 0) this.replay(subscriber.id, replayCount);
    return () => this.unregister(subscriber.id);
  }

  unregister(id: string) {
    this.registry.delete(id);
  }

  publish(input: PublishInput) {
    const createdAt = input.createdAt || new Date().toISOString();
    const deliveryBase = {
      sequence: ++this.sequence,
      kind: input.kind,
      createdAt,
      payload: input.payload,
    };
    for (const channel of input.channels) {
      const delivery: RuntimeDelivery = {
        id: `${channel}:${deliveryBase.sequence}`,
        channel,
        ...deliveryBase,
      };
      this.store(channel, delivery);
      this.deliver(channel, delivery, input.dedupeKey || dedupeIdentity(input.payload));
    }
  }

  publishSignal(payload: RuntimeDeliveryPayload) {
    this.publish({
      kind: "signal",
      payload,
      channels: ["facility:signal", "consumer:signal", "activity:event", "future:digital-twin", "future:conversation"],
      dedupeKey: payload.signal?.id,
    });
    dispatchBrowserEvent("facility:realtime-event", payload);
  }

  publishAwareness(payload: RuntimeDeliveryPayload) {
    this.publish({
      kind: "awareness",
      payload,
      channels: [
        "facility:awareness",
        "consumer:awareness",
        "office:awareness",
        "notification:event",
        "activity:event",
        "future:digital-twin",
        "future:conversation",
        "future:executive",
      ],
      dedupeKey: payload.awareness?.id || payload.signal?.id,
    });
  }

  publishInsights(payload: RuntimeDeliveryPayload) {
    if (!payload.insights?.length) return;
    this.publish({
      kind: "insight",
      payload,
      channels: [
        "facility:insight",
        "consumer:insight",
        "office:insight",
        "notification:event",
        "activity:event",
        "future:digital-twin",
        "future:conversation",
        "future:executive",
      ],
      dedupeKey: payload.insights.map((item) => item.id).join(","),
    });
  }

  publishRecommendations(payload: RuntimeDeliveryPayload) {
    if (!payload.recommendations?.length) return;
    this.publish({
      kind: "recommendation",
      payload,
      channels: [
        "facility:recommendation",
        "consumer:recommendation",
        "office:recommendation",
        "notification:recommendation",
        "activity:recommendation",
        "future:digital-twin",
        "future:conversation",
        "future:executive",
      ],
      dedupeKey: payload.recommendations.map((item) => item.id).join(","),
    });
  }

  publishAutomation(payload: RuntimeDeliveryPayload) {
    if (!payload.automationPlans?.length) return;
    this.publish({
      kind: "automation",
      payload,
      channels: [
        "facility:automation",
        "consumer:automation",
        "office:automation",
        "notification:automation",
        "activity:automation",
        "future:digital-twin",
        "future:conversation",
        "future:executive",
      ],
      dedupeKey: payload.automationPlans.map((item) => item.id).join(","),
    });
  }

  publishConversation(payload: RuntimeDeliveryPayload) {
    this.publish({
      kind: "conversation",
      payload,
      channels: [
        "conversation:request",
        "conversation:response",
        "conversation:intent",
        "conversation:navigation",
        "conversation:action",
        "conversation:summary",
        "future:conversation",
        "future:executive",
      ],
      dedupeKey: payload.conversationResponse?.id || payload.conversationRequest?.id || payload.event,
    });
  }

  publishExecutive(payload: RuntimeDeliveryPayload) {
    this.publish({
      kind: "executive",
      payload,
      channels: [
        "executive:briefing",
        "executive:summary",
        "executive:risk",
        "executive:portfolio",
        "executive:health",
        "executive:recommendation",
        "future:executive",
      ],
      dedupeKey: payload.executiveBriefing?.id || payload.event,
    });
  }

  replay(id: string, count = DEFAULT_REPLAY) {
    const state = this.registry.get(id);
    if (!state) return;
    const matched = state.subscriber.channels.flatMap((channel) => this.history.get(channel) || []);
    const ordered = [...matched].sort((a, b) => a.sequence - b.sequence).slice(-count);
    for (const delivery of ordered) {
      state.subscriber.onEvent(delivery);
    }
  }

  snapshot() {
    return {
      subscribers: [...this.registry.values()]
        .sort((a, b) => a.order - b.order)
        .map((state) => ({ id: state.subscriber.id, channels: state.subscriber.channels })),
      channels: RUNTIME_CHANNELS.map((channel) => ({
        channel,
        buffered: (this.history.get(channel) || []).length,
      })),
    };
  }

  ensureDefaultSubscribers() {
    if (this.booted) return;
    this.booted = true;

    this.register({
      id: "facility-runtime",
      channels: ["facility:signal", "facility:awareness", "facility:insight", "facility:recommendation", "facility:automation"],
      replay: 0,
      onEvent: (delivery) => {
        dispatchBrowserEvent(delivery.channel, delivery.payload);
      },
    });

    this.register({
      id: "consumer-runtime",
      channels: ["consumer:signal", "consumer:awareness", "consumer:insight", "consumer:recommendation", "consumer:automation"],
      replay: 0,
      onEvent: (delivery) => {
        dispatchBrowserEvent(delivery.channel, delivery.payload);
      },
    });

    this.register({
      id: "office-runtime",
      channels: ["office:awareness", "office:insight", "office:recommendation", "office:automation"],
      replay: 0,
      onEvent: (delivery) => {
        dispatchBrowserEvent(delivery.channel, delivery.payload);
      },
    });

    this.register({
      id: "activity-runtime",
      channels: ["activity:event", "activity:recommendation", "activity:automation"],
      replay: 0,
      onEvent: (delivery) => {
        dispatchBrowserEvent(delivery.channel, delivery.payload);
      },
    });

    this.register({
      id: "notification-runtime",
      channels: ["notification:event", "notification:recommendation", "notification:automation"],
      replay: 0,
      onEvent: (delivery) => {
        if (delivery.kind === "signal") return;
        dispatchBrowserEvent(delivery.channel, delivery.payload);
      },
    });

    this.register({
      id: "conversation-runtime",
      channels: ["conversation:request", "conversation:response", "conversation:intent", "conversation:navigation", "conversation:action", "conversation:summary", "future:conversation"],
      replay: 0,
      onEvent: (delivery) => {
        dispatchBrowserEvent(delivery.channel, delivery.payload);
      },
    });

    this.register({
      id: "digital-twin-runtime",
      channels: ["future:digital-twin"],
      replay: 0,
      onEvent: (delivery) => {
        dispatchBrowserEvent("future:digital-twin", delivery.payload);
      },
    });

    this.register({
      id: "executive-runtime",
      channels: ["executive:briefing", "executive:summary", "executive:risk", "executive:portfolio", "executive:health", "executive:recommendation", "future:executive"],
      replay: 0,
      onEvent: (delivery) => {
        dispatchBrowserEvent(delivery.channel, delivery.payload);
      },
    });
  }

  private store(channel: RuntimeChannel, delivery: RuntimeDelivery) {
    const limit = this.options.replayBuffer ?? DEFAULT_BUFFER;
    const next = [delivery, ...(this.history.get(channel) || [])].slice(0, limit);
    this.history.set(channel, next);
  }

  private deliver(channel: RuntimeChannel, delivery: RuntimeDelivery, dedupeKey: string) {
    const dedupeWindowMs = this.options.dedupeWindowMs ?? DEFAULT_DEDUPE_WINDOW_MS;
    const subscribers = [...this.registry.values()]
      .filter((state) => state.subscriber.channels.includes(channel))
      .sort((a, b) => a.order - b.order);
    for (const state of subscribers) {
      this.pruneDeliveries(state, delivery.createdAt, dedupeWindowMs);
      const existing = state.deliveries.get(`${channel}:${dedupeKey}`);
      if (existing && existing > timeMs(delivery.createdAt)) continue;
      state.deliveries.set(`${channel}:${dedupeKey}`, timeMs(delivery.createdAt) + dedupeWindowMs);
      state.subscriber.onEvent(delivery);
    }
  }

  private pruneDeliveries(state: SubscriberState, createdAt: string, dedupeWindowMs: number) {
    const now = timeMs(createdAt);
    for (const [key, expiresAt] of state.deliveries.entries()) {
      if (expiresAt <= now - dedupeWindowMs) state.deliveries.delete(key);
    }
  }
}

export const runtimeSubscriptionEngine = new RuntimeSubscriptionEngine();

export function ensureRuntimeSubscriptions() {
  runtimeSubscriptionEngine.ensureDefaultSubscribers();
  return runtimeSubscriptionEngine;
}
