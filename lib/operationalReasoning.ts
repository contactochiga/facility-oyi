import {
  normalizeSignal,
  type NormalizedSignal,
  type SignalEvidence,
  type SignalSeverity,
} from "@/lib/operationalSignal";
import {
  buildAwareness,
  type OperationalAwareness,
  type OperationalContext,
} from "@/services/contextAwarenessEngine";

export type OperationalInsightDomain =
  | "security"
  | "infrastructure"
  | "utility"
  | "maintenance"
  | "visitor"
  | "environmental"
  | "financial"
  | "community";

export type OperationalInsight = {
  id: string;
  title: string;
  summary: string;
  domain: OperationalInsightDomain;
  severity: SignalSeverity;
  confidence: number;
  reason: string;
  impact: string;
  recommendedAction: string;
  evidence: SignalEvidence[];
  relatedSignals: string[];
  relatedAwareness: string[];
  generatedAt: string;
  owner: string;
  verification: string;
  nextStep: string;
  source: "operational_reasoning_runtime";
};

export type ReasoningInput = {
  signals: Array<Partial<NormalizedSignal> & Record<string, unknown>>;
  awareness?: OperationalAwareness[];
  context?: OperationalContext;
  signalHistory?: Array<Partial<NormalizedSignal> & Record<string, unknown>>;
  attention?: Array<{ id?: string; title?: string; detail?: string; domain?: string; severity?: string; action?: string }>;
  generatedAt?: string;
};

export type ReasoningRuntimeSubscriber = (insights: OperationalInsight[]) => void;

type RuntimeOptions = {
  historyLimit?: number;
  dedupeWindowMs?: number;
};

type InsightCandidate = {
  domain: OperationalInsightDomain;
  title: string;
  summary: string;
  severity: SignalSeverity;
  confidence: number;
  reason: string;
  impact: string;
  recommendedAction: string;
  evidence: SignalEvidence[];
  relatedSignals: string[];
  relatedAwareness: string[];
  generatedAt: string;
  owner: string;
  verification: string;
  nextStep: string;
  entityKey: string;
};

function text(value: unknown, fallback = "") {
  const next = String(value ?? "").trim();
  return next || fallback;
}

function lower(value: unknown) {
  return text(value).toLowerCase();
}

function timeMs(value: string | undefined) {
  const parsed = new Date(value || "").getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function severityRank(value: SignalSeverity) {
  return { critical: 3, warning: 2, attention: 1, info: 0 }[value];
}

function dominantSeverity(values: SignalSeverity[]) {
  return [...values].sort((a, b) => severityRank(b) - severityRank(a))[0] || "info";
}

function awarenessUrgencyRank(value: OperationalAwareness["urgency"]) {
  return { urgent: 3, act: 2, review: 1, monitor: 0 }[value];
}

function confidence(values: number[]) {
  if (!values.length) return 0.65;
  return Math.max(0, Math.min(1, values.reduce((sum, value) => sum + value, 0) / values.length));
}

function entityKey(signal: NormalizedSignal) {
  return [
    lower(signal.domain || signal.type),
    lower(signal.entity.id || signal.entity.name || "unknown"),
    lower(signal.room.id || signal.building.id || signal.estate.id || "scope"),
  ].join(":");
}

function evidenceFromAwareness(awareness: OperationalAwareness[]): SignalEvidence[] {
  return awareness.flatMap((item, index) =>
    item.supporting_evidence.length
      ? item.supporting_evidence
      : [
          {
            id: `${item.id}:awareness:${index}`,
            type: item.kind,
            source: "operational_reasoning_runtime",
            summary: item.summary,
            timestamp: item.generated_at,
            metadata: { owner: item.owner, urgency: item.urgency },
          },
        ]
  );
}

function mergeEvidence(signals: NormalizedSignal[], awareness: OperationalAwareness[]) {
  const unique = new Map<string, SignalEvidence>();
  for (const item of [...signals.flatMap((signal) => signal.evidence), ...evidenceFromAwareness(awareness)]) {
    const key = text(item.id || `${item.type}:${item.timestamp}:${item.summary}`);
    if (!unique.has(key)) unique.set(key, item);
  }
  return [...unique.values()].slice(0, 6);
}

function ownerFrom(signals: NormalizedSignal[], awareness: OperationalAwareness[]) {
  return (
    awareness.find((item) => text(item.owner))?.owner ||
    signals.find((signal) => text(signal.actor.name || signal.actor.role))?.actor.name ||
    signals.find((signal) => text(signal.actor.role))?.actor.role ||
    "Operational owner"
  );
}

function activeSignals(history: NormalizedSignal[], signal: NormalizedSignal, windowMs: number) {
  const latestTs = timeMs(signal.timestamp);
  return history.filter((item) => {
    if (entityKey(item) !== entityKey(signal)) return false;
    const delta = Math.abs(latestTs - timeMs(item.timestamp));
    return delta <= windowMs;
  });
}

function relatedAwarenessFor(signal: NormalizedSignal, awareness: OperationalAwareness[]) {
  return awareness.filter((item) => item.related_signals.includes(signal.id));
}

function shouldReason(signals: NormalizedSignal[], awareness: OperationalAwareness[]) {
  const severe = signals.some((signal) => signal.severity === "critical");
  const repeated = signals.length >= 2;
  const strongAwareness = awareness.some((item) => awarenessUrgencyRank(item.urgency) >= 2 || item.confidence >= 0.8);
  return severe || repeated || strongAwareness;
}

function signalStatus(signal: NormalizedSignal) {
  return lower(signal.entity.status || signal.metadata.status || signal.metadata.state || signal.metadata.health_status);
}

function securityCandidate(
  signal: NormalizedSignal,
  signals: NormalizedSignal[],
  awareness: OperationalAwareness[],
  generatedAt: string
): InsightCandidate | null {
  const haystack = lower(`${signal.type} ${signal.source} ${signal.domain} ${signal.entity.type} ${signal.metadata.event}`);
  if (!/security|access|visitor|gate|camera|lock|incident|door/.test(haystack)) return null;
  if (!shouldReason(signals, awareness)) return null;
  const cameraUnavailable = signals.some((item) => /camera/.test(lower(item.entity.type || item.domain)) && /offline|unavailable|error/.test(signalStatus(item)));
  const unusualAccess = signals.some((item) => /denied|unknown|unauthori|forced|after_hours/.test(lower(item.metadata.reason || item.metadata.message || item.entity.status)));
  const reason = cameraUnavailable && unusualAccess
    ? "Door, access, or visitor activity is occurring alongside reduced camera visibility."
    : "Security-related signals show elevated operational exposure.";
  return {
    domain: "security",
    title: "Potential Security Exposure",
    summary: `${text(signal.entity.name || signal.entity.id, "A protected access point")} requires security review.`,
    severity: dominantSeverity(signals.map((item) => item.severity)),
    confidence: confidence([...signals.map((item) => item.confidence), ...awareness.map((item) => item.confidence)]),
    reason,
    impact: "Access control, incident response, or evidence capture may be degraded until verified.",
    recommendedAction: "Verify door, visitor, and camera evidence together before closure.",
    evidence: mergeEvidence(signals, awareness),
    relatedSignals: signals.map((item) => item.id),
    relatedAwareness: awareness.map((item) => item.id),
    generatedAt,
    owner: ownerFrom(signals, awareness),
    verification: "Confirm access logs, camera coverage, and operator assignment.",
    nextStep: "Route to Security Command if exposure remains active.",
    entityKey: entityKey(signal),
  };
}

function infrastructureCandidate(
  signal: NormalizedSignal,
  signals: NormalizedSignal[],
  awareness: OperationalAwareness[],
  generatedAt: string
): InsightCandidate | null {
  const haystack = lower(`${signal.type} ${signal.source} ${signal.domain} ${signal.entity.type}`);
  if (!/device|edge|telemetry|meter|utility|infrastructure|camera|tuya|matter|mqtt|ble|onvif/.test(haystack)) return null;
  const failing = signals.filter((item) => /offline|unreachable|failed|error|degraded/.test(signalStatus(item)));
  if (!failing.length && !shouldReason(signals, awareness)) return null;
  return {
    domain: "infrastructure",
    title: "Infrastructure Reliability Issue",
    summary: `${text(signal.entity.name || signal.entity.id, "An infrastructure asset")} is showing repeated availability or execution failure signals.`,
    severity: dominantSeverity(signals.map((item) => item.severity)),
    confidence: confidence([...signals.map((item) => item.confidence), ...awareness.map((item) => item.confidence)]),
    reason: "The same infrastructure entity has repeated offline, failed, or degraded state signals within the active window.",
    impact: "Automations, telemetry continuity, or resident-facing controls may not execute reliably.",
    recommendedAction: "Verify connectivity, power state, and adapter health before escalating replacement or dispatch.",
    evidence: mergeEvidence(signals, awareness),
    relatedSignals: signals.map((item) => item.id),
    relatedAwareness: awareness.map((item) => item.id),
    generatedAt,
    owner: ownerFrom(signals, awareness),
    verification: "Confirm last-seen time, command success rate, and adapter availability.",
    nextStep: "Escalate to Infrastructure Registry ownership if instability persists.",
    entityKey: entityKey(signal),
  };
}

function utilityCandidate(
  signal: NormalizedSignal,
  signals: NormalizedSignal[],
  awareness: OperationalAwareness[],
  generatedAt: string
): InsightCandidate | null {
  const haystack = lower(`${signal.type} ${signal.source} ${signal.domain} ${signal.entity.type} ${JSON.stringify(signal.metadata)}`);
  if (!/utility|power|energy|solar|generator|meter/.test(haystack)) return null;
  if (!shouldReason(signals, awareness)) return null;
  return {
    domain: "utility",
    title: "Infrastructure Service Continuity Risk",
    summary: `${text(signal.entity.name || signal.entity.id, "A utility asset")} is reporting a pattern that can affect cost or continuity.`,
    severity: dominantSeverity(signals.map((item) => item.severity)),
    confidence: confidence([...signals.map((item) => item.confidence), ...awareness.map((item) => item.confidence)]),
    reason: "Infrastructure service telemetry shows elevated operational variance, degraded supply posture, or a supporting source is unavailable.",
    impact: "Energy cost, backup posture, or service continuity may drift before operators can intervene.",
    recommendedAction: "Review infrastructure service telemetry, backup state, and recent source changes together.",
    evidence: mergeEvidence(signals, awareness),
    relatedSignals: signals.map((item) => item.id),
    relatedAwareness: awareness.map((item) => item.id),
    generatedAt,
    owner: ownerFrom(signals, awareness),
    verification: "Verify telemetry accuracy and current utility source availability.",
    nextStep: "Open Infrastructure Services if the source mix remains unstable.",
    entityKey: entityKey(signal),
  };
}

function maintenanceCandidate(
  signal: NormalizedSignal,
  signals: NormalizedSignal[],
  awareness: OperationalAwareness[],
  generatedAt: string
): InsightCandidate | null {
  const haystack = lower(`${signal.type} ${signal.source} ${signal.domain} ${signal.entity.type}`);
  if (!/maintenance|workflow|repair|service/.test(haystack) && !awareness.some((item) => item.kind === "maintenance")) return null;
  const overdue = signals.some((item) => /overdue|blocked|escalated/.test(signalStatus(item) || lower(item.metadata.action)));
  if (!overdue && !shouldReason(signals, awareness)) return null;
  return {
    domain: "maintenance",
    title: "Preventive Maintenance Candidate",
    summary: `${text(signal.entity.name || signal.entity.id, "An operational asset")} is showing repeated maintenance pressure or overdue recovery.`,
    severity: dominantSeverity(signals.map((item) => item.severity)),
    confidence: confidence([...signals.map((item) => item.confidence), ...awareness.map((item) => item.confidence)]),
    reason: "Maintenance or infrastructure signals continue to recur without a verified recovery window.",
    impact: "Resident continuity, service level posture, and maintenance backlog risk may increase.",
    recommendedAction: "Review recurring failures, open maintenance history, and assign a preventive action owner.",
    evidence: mergeEvidence(signals, awareness),
    relatedSignals: signals.map((item) => item.id),
    relatedAwareness: awareness.map((item) => item.id),
    generatedAt,
    owner: ownerFrom(signals, awareness),
    verification: "Confirm whether the asset has an open request, overdue repair, or repeat failure trend.",
    nextStep: "Promote to Maintenance Continuity if the pattern repeats after intervention.",
    entityKey: entityKey(signal),
  };
}

function visitorCandidate(
  signal: NormalizedSignal,
  signals: NormalizedSignal[],
  awareness: OperationalAwareness[],
  generatedAt: string
): InsightCandidate | null {
  const haystack = lower(`${signal.type} ${signal.source} ${signal.domain} ${signal.entity.type} ${JSON.stringify(signal.metadata)}`);
  if (!/visitor|access|gate|credential/.test(haystack)) return null;
  const denied = signals.filter((item) => /denied|blocked|unknown|pending|expired/.test(signalStatus(item) || lower(item.metadata.reason || item.metadata.message)));
  if (denied.length < 2 && !signals.some((item) => item.severity === "critical")) return null;
  return {
    domain: "visitor",
    title: "Access Review Required",
    summary: `${text(signal.entity.name || signal.entity.id, "A visitor access flow")} is showing repeated denials or incomplete verification.`,
    severity: dominantSeverity(signals.map((item) => item.severity)),
    confidence: confidence([...signals.map((item) => item.confidence), ...awareness.map((item) => item.confidence)]),
    reason: "Repeated access denials or unresolved verification suggest the visitor lifecycle needs operator review.",
    impact: "Access continuity, security assurance, or front-of-house responsiveness may be affected.",
    recommendedAction: "Review verification evidence, host approval, and most recent access attempts together.",
    evidence: mergeEvidence(signals, awareness),
    relatedSignals: signals.map((item) => item.id),
    relatedAwareness: awareness.map((item) => item.id),
    generatedAt,
    owner: ownerFrom(signals, awareness),
    verification: "Confirm visitor identity, approval state, and gate action history.",
    nextStep: "Move to Visitor Access Registry review if denials continue.",
    entityKey: entityKey(signal),
  };
}

function environmentalCandidate(
  signal: NormalizedSignal,
  signals: NormalizedSignal[],
  awareness: OperationalAwareness[],
  generatedAt: string
): InsightCandidate | null {
  const haystack = lower(`${signal.type} ${signal.source} ${signal.domain} ${signal.entity.type} ${JSON.stringify(signal.context)}`);
  if (!/environment|temperature|humidity|air|water|sensor|climate/.test(haystack)) return null;
  if (!shouldReason(signals, awareness)) return null;
  return {
    domain: "environmental",
    title: "Environmental Comfort Risk",
    summary: `${text(signal.entity.name || signal.entity.id, "An environmental zone")} is showing conditions that can affect comfort or safety.`,
    severity: dominantSeverity(signals.map((item) => item.severity)),
    confidence: confidence([...signals.map((item) => item.confidence), ...awareness.map((item) => item.confidence)]),
    reason: "Environmental telemetry and supporting operational signals indicate a sustained exposure pattern.",
    impact: "Occupied space comfort, health posture, or equipment continuity may be affected until stabilized.",
    recommendedAction: "Verify room conditions, related infrastructure state, and occupancy context together.",
    evidence: mergeEvidence(signals, awareness),
    relatedSignals: signals.map((item) => item.id),
    relatedAwareness: awareness.map((item) => item.id),
    generatedAt,
    owner: ownerFrom(signals, awareness),
    verification: "Confirm sensor accuracy, supporting HVAC/device state, and affected room occupancy.",
    nextStep: "Escalate to Environmental Awareness when the affected zone remains unstable.",
    entityKey: entityKey(signal),
  };
}

function financialCandidate(
  signal: NormalizedSignal,
  signals: NormalizedSignal[],
  awareness: OperationalAwareness[],
  generatedAt: string
): InsightCandidate | null {
  const haystack = lower(`${signal.type} ${signal.source} ${signal.domain} ${signal.entity.type}`);
  if (!/wallet|financial|payment|accounting|transaction|collection/.test(haystack)) return null;
  if (!shouldReason(signals, awareness)) return null;
  return {
    domain: "financial",
    title: "Financial Posture Attention",
    summary: `${text(signal.entity.name || signal.entity.id, "A financial flow")} is showing a pattern that may require reconciliation or service review.`,
    severity: dominantSeverity(signals.map((item) => item.severity)),
    confidence: confidence([...signals.map((item) => item.confidence), ...awareness.map((item) => item.confidence)]),
    reason: "Payment, wallet, or accounting signals suggest a sustained change in financial operating posture.",
    impact: "Collection continuity, service access, or account confidence may be affected until reviewed.",
    recommendedAction: "Review the transaction trail, account status, and service impact before resolution.",
    evidence: mergeEvidence(signals, awareness),
    relatedSignals: signals.map((item) => item.id),
    relatedAwareness: awareness.map((item) => item.id),
    generatedAt,
    owner: ownerFrom(signals, awareness),
    verification: "Confirm whether this is a temporary variance, failed transaction chain, or account trend.",
    nextStep: "Open Financial Posture review when variance persists across cycles.",
    entityKey: entityKey(signal),
  };
}

function communityCandidate(
  signal: NormalizedSignal,
  signals: NormalizedSignal[],
  awareness: OperationalAwareness[],
  generatedAt: string
): InsightCandidate | null {
  const haystack = lower(`${signal.type} ${signal.source} ${signal.domain} ${signal.entity.type}`);
  if (!/community|complaint|moderation|post|message|resident/.test(haystack)) return null;
  if (!shouldReason(signals, awareness)) return null;
  return {
    domain: "community",
    title: "Resident Experience Risk",
    summary: `${text(signal.entity.name || signal.entity.id, "A community issue")} is repeating without a verified recovery path.`,
    severity: dominantSeverity(signals.map((item) => item.severity)),
    confidence: confidence([...signals.map((item) => item.confidence), ...awareness.map((item) => item.confidence)]),
    reason: "Repeated community, complaint, or moderation signals suggest unresolved resident-facing impact.",
    impact: "Resident trust, operational responsiveness, or cross-team coordination may degrade.",
    recommendedAction: "Review the affected zone, supporting maintenance state, and recent resident signals together.",
    evidence: mergeEvidence(signals, awareness),
    relatedSignals: signals.map((item) => item.id),
    relatedAwareness: awareness.map((item) => item.id),
    generatedAt,
    owner: ownerFrom(signals, awareness),
    verification: "Confirm recurrence, unresolved dependencies, and current owner acknowledgement.",
    nextStep: "Escalate into Community Signals if the issue remains unresolved after review.",
    entityKey: entityKey(signal),
  };
}

const CANDIDATES = [
  securityCandidate,
  infrastructureCandidate,
  utilityCandidate,
  maintenanceCandidate,
  visitorCandidate,
  environmentalCandidate,
  financialCandidate,
  communityCandidate,
];

function dedupeKey(candidate: InsightCandidate) {
  return `${candidate.domain}:${candidate.entityKey}:${lower(candidate.reason)}`;
}

function withIds(candidate: InsightCandidate) {
  return {
    id: `insight:${candidate.domain}:${candidate.entityKey}:${timeMs(candidate.generatedAt)}`,
    title: candidate.title,
    summary: candidate.summary,
    domain: candidate.domain,
    severity: candidate.severity,
    confidence: candidate.confidence,
    reason: candidate.reason,
    impact: candidate.impact,
    recommendedAction: candidate.recommendedAction,
    evidence: candidate.evidence,
    relatedSignals: candidate.relatedSignals,
    relatedAwareness: candidate.relatedAwareness,
    generatedAt: candidate.generatedAt,
    owner: candidate.owner,
    verification: candidate.verification,
    nextStep: candidate.nextStep,
    source: "operational_reasoning_runtime" as const,
  };
}

export function buildOperationalInsights(input: ReasoningInput): OperationalInsight[] {
  const generatedAt = input.generatedAt || new Date().toISOString();
  const signals = [...(input.signalHistory || []), ...input.signals]
    .map((signal) => normalizeSignal(signal))
    .sort((a, b) => timeMs(b.timestamp) - timeMs(a.timestamp));
  const awareness = input.awareness?.length ? input.awareness : buildAwareness(signals, input.context);
  const unique = new Map<string, OperationalInsight>();

  for (const signal of signals) {
    const relatedSignals = activeSignals(signals, signal, 1000 * 60 * 60 * 6);
    const relatedAwareness = awareness.filter((item) => {
      if (item.related_signals.includes(signal.id)) return true;
      return relatedSignals.some((entry) => item.related_signals.includes(entry.id));
    });
    for (const createCandidate of CANDIDATES) {
      const candidate = createCandidate(signal, relatedSignals, relatedAwarenessFor(signal, relatedAwareness), generatedAt);
      if (!candidate) continue;
      const key = dedupeKey(candidate);
      if (!unique.has(key)) unique.set(key, withIds(candidate));
    }
  }

  return [...unique.values()].sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || b.confidence - a.confidence);
}

export class OperationalReasoningRuntime {
  private signalHistory: NormalizedSignal[] = [];
  private awarenessHistory: OperationalAwareness[] = [];
  private insightTrail: OperationalInsight[] = [];
  private dedupe = new Map<string, number>();
  private subscribers = new Set<ReasoningRuntimeSubscriber>();
  private options: Required<RuntimeOptions>;

  constructor(options: RuntimeOptions = {}) {
    this.options = {
      historyLimit: options.historyLimit ?? 250,
      dedupeWindowMs: options.dedupeWindowMs ?? 1000 * 60 * 20,
    };
  }

  evaluate(input: ReasoningInput) {
    const signals = input.signals.map((signal) => normalizeSignal(signal));
    const awareness = input.awareness?.length ? input.awareness : buildAwareness(signals, input.context);
    this.signalHistory = [...signals, ...this.signalHistory].slice(0, this.options.historyLimit);
    this.awarenessHistory = [...awareness, ...this.awarenessHistory].slice(0, this.options.historyLimit);
    const insights = buildOperationalInsights({
      ...input,
      signals,
      awareness,
      signalHistory: [...signals, ...this.signalHistory].slice(0, this.options.historyLimit),
    }).filter((insight) => !this.isDuplicate(insight));
    if (insights.length) {
      this.insightTrail = [...insights, ...this.insightTrail].slice(0, this.options.historyLimit);
      for (const subscriber of this.subscribers) subscriber(insights);
    }
    return insights;
  }

  subscribe(subscriber: ReasoningRuntimeSubscriber) {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  auditLog() {
    return [...this.insightTrail];
  }

  reset() {
    this.signalHistory = [];
    this.awarenessHistory = [];
    this.insightTrail = [];
    this.dedupe.clear();
  }

  private isDuplicate(insight: OperationalInsight) {
    const key = `${insight.domain}:${lower(insight.relatedSignals[0] || insight.title)}:${lower(insight.reason)}`;
    const now = timeMs(insight.generatedAt);
    for (const [entry, expiresAt] of this.dedupe.entries()) {
      if (expiresAt <= now) this.dedupe.delete(entry);
    }
    const existing = this.dedupe.get(key);
    if (existing && existing > now) return true;
    this.dedupe.set(key, now + this.options.dedupeWindowMs);
    return false;
  }
}

export const operationalReasoningRuntime = new OperationalReasoningRuntime();
