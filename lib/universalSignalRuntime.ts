import {
  normalizeSignal,
  signalDeduplicationKey,
  signalPriority,
  validateSignal,
  type NormalizedSignal,
  type SignalPriority,
} from "@/lib/operationalSignal";

export type SignalRuntimeOutput =
  | "operational_intelligence"
  | "infrastructure_registry"
  | "activity"
  | "notifications"
  | "automation"
  | "conversation"
  | "digital_twin"
  | "reports"
  | "executive_intelligence"
  | "future_ai";

export const SIGNAL_RUNTIME_OUTPUTS: SignalRuntimeOutput[] = [
  "operational_intelligence",
  "infrastructure_registry",
  "activity",
  "notifications",
  "automation",
  "conversation",
  "digital_twin",
  "reports",
  "executive_intelligence",
  "future_ai",
];

export type SignalRuntimeReceipt = {
  signal: NormalizedSignal;
  accepted: boolean;
  duplicate: boolean;
  priority: SignalPriority;
  outputs: SignalRuntimeOutput[];
  issues: string[];
  receivedAt: string;
  auditId: string;
};

export type SignalRuntimeSubscriber = (receipt: SignalRuntimeReceipt) => void;

type RuntimeOptions = {
  outputs?: SignalRuntimeOutput[];
  dedupeTtlMs?: number;
  auditLimit?: number;
};

type ReceiveOptions = {
  outputs?: SignalRuntimeOutput[];
  receivedAt?: string;
};

function outputsFor(signal: NormalizedSignal): SignalRuntimeOutput[] {
  const outputs = new Set<SignalRuntimeOutput>(["operational_intelligence", "activity", "reports", "future_ai"]);
  const haystack = `${signal.type} ${signal.source} ${signal.domain} ${signal.entity.type}`.toLowerCase();
  if (/device|edge|infrastructure|telemetry|meter|camera|onvif|tuya|mqtt|ble|matter/.test(haystack)) {
    outputs.add("infrastructure_registry");
    outputs.add("digital_twin");
  }
  if (/notification|communication|message|security|visitor|maintenance|financial|wallet|community/.test(haystack)) outputs.add("notifications");
  if (/automation|rule|scene|device|edge|visitor|maintenance/.test(haystack)) outputs.add("automation");
  if (/ai|oyi|conversation|message|communication/.test(haystack)) outputs.add("conversation");
  if (/executive|financial|security|critical|governance/.test(haystack) || signal.severity === "critical") outputs.add("executive_intelligence");
  return [...outputs];
}

export class UniversalSignalRuntime {
  private dedupe = new Map<string, number>();
  private auditTrail: SignalRuntimeReceipt[] = [];
  private subscribers = new Set<SignalRuntimeSubscriber>();
  private options: Required<RuntimeOptions>;

  constructor(options: RuntimeOptions = {}) {
    this.options = {
      outputs: options.outputs || SIGNAL_RUNTIME_OUTPUTS,
      dedupeTtlMs: options.dedupeTtlMs ?? 60000,
      auditLimit: options.auditLimit ?? 250,
    };
  }

  receive(input: Partial<NormalizedSignal> & Record<string, unknown>, options: ReceiveOptions = {}) {
    const receivedAt = options.receivedAt || new Date().toISOString();
    const signal = this.timestamp(this.normalize(input), receivedAt);
    const validation = this.validate(signal);
    const duplicate = this.deduplicate(signal, receivedAt);
    const priority = this.prioritize(signal);
    const outputs = this.publishTargets(signal, options.outputs);
    const receipt: SignalRuntimeReceipt = {
      signal,
      accepted: validation.ok && !duplicate,
      duplicate,
      priority,
      outputs,
      issues: validation.issues,
      receivedAt,
      auditId: `signal-audit:${signal.id}:${receivedAt}`,
    };
    this.audit(receipt);
    if (receipt.accepted) this.publish(receipt);
    return receipt;
  }

  normalize(input: Partial<NormalizedSignal> & Record<string, unknown>) {
    return normalizeSignal(input);
  }

  validate(signal: NormalizedSignal) {
    return validateSignal(signal);
  }

  timestamp(signal: NormalizedSignal, receivedAt = new Date().toISOString()): NormalizedSignal {
    return { ...signal, timestamp: signal.timestamp || receivedAt, metadata: { ...signal.metadata, received_at: receivedAt } };
  }

  deduplicate(signal: NormalizedSignal, receivedAt = new Date().toISOString()) {
    const key = signalDeduplicationKey(signal);
    const now = new Date(receivedAt).getTime();
    const previous = this.dedupe.get(key);
    for (const [entryKey, expiresAt] of this.dedupe.entries()) {
      if (expiresAt <= now) this.dedupe.delete(entryKey);
    }
    if (previous && previous > now) return true;
    this.dedupe.set(key, now + this.options.dedupeTtlMs);
    return false;
  }

  prioritize(signal: NormalizedSignal) {
    return signalPriority(signal);
  }

  publishTargets(signal: NormalizedSignal, requested?: SignalRuntimeOutput[]) {
    const allowed = new Set(this.options.outputs);
    const candidates = requested?.length ? requested : outputsFor(signal);
    return candidates.filter((output) => allowed.has(output));
  }

  publish(receipt: SignalRuntimeReceipt) {
    for (const subscriber of this.subscribers) subscriber(receipt);
  }

  audit(receipt: SignalRuntimeReceipt) {
    this.auditTrail = [receipt, ...this.auditTrail].slice(0, this.options.auditLimit);
  }

  subscribe(subscriber: SignalRuntimeSubscriber) {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  auditLog() {
    return [...this.auditTrail];
  }

  reset() {
    this.dedupe.clear();
    this.auditTrail = [];
  }
}

export const universalSignalRuntime = new UniversalSignalRuntime();

export function receiveOperationalSignal(input: Partial<NormalizedSignal> & Record<string, unknown>, options?: ReceiveOptions) {
  return universalSignalRuntime.receive(input, options);
}
