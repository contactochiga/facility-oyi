export type SignalType =
  | "infrastructure"
  | "operational"
  | "human"
  | "financial"
  | "security"
  | "environmental"
  | "ai"
  | "automation"
  | "maintenance"
  | "community"
  | "communication"
  | "registry"
  | "lifecycle"
  | "telemetry";

export type SignalSeverity = "info" | "attention" | "warning" | "critical";

export type SignalSource =
  | "infrastructure_registry"
  | "device_adapter"
  | "tuya"
  | "matter"
  | "mqtt"
  | "ble"
  | "onvif"
  | "camera"
  | "smart_lock"
  | "water_meter"
  | "energy_meter"
  | "environmental_sensor"
  | "edge_runtime"
  | "estate_registry"
  | "visitor_registry"
  | "resident_action"
  | "maintenance"
  | "accounting"
  | "wallet"
  | "community"
  | "service"
  | "report"
  | "office"
  | "consumer"
  | "ai"
  | "automation"
  | "future_module"
  | string;

export type SignalEntity = {
  id?: string | null;
  type?: string | null;
  name?: string | null;
  status?: string | null;
};

export type SignalScope = {
  id?: string | null;
  name?: string | null;
};

export type SignalActor = {
  id?: string | null;
  type?: "operator" | "resident" | "visitor" | "system" | "ai" | "automation" | string | null;
  name?: string | null;
  role?: string | null;
};

export type SignalEvidence = {
  id?: string | null;
  type?: string | null;
  source?: string | null;
  summary?: string | null;
  uri?: string | null;
  timestamp?: string | null;
  metadata?: Record<string, unknown>;
};

export type NormalizedSignal = {
  id: string;
  type: SignalType;
  source: SignalSource;
  domain: string;
  entity: SignalEntity;
  estate: SignalScope;
  building: SignalScope;
  room: SignalScope;
  actor: SignalActor;
  severity: SignalSeverity;
  confidence: number;
  timestamp: string;
  context: Record<string, unknown>;
  metadata: Record<string, unknown>;
  evidence: SignalEvidence[];
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function scopeFrom(value: unknown): SignalScope {
  if (value && typeof value === "object") {
    const next = value as Record<string, unknown>;
    return { id: text(next.id || next.estate_id || next.building_id || next.room_id) || null, name: text(next.name || next.label) || null };
  }
  return { id: text(value) || null, name: null };
}

export function signalSeverity(value: unknown): SignalSeverity {
  const next = text(value).toLowerCase();
  if (/critical|emergency|panic|intrusion|fire/.test(next)) return "critical";
  if (/warning|high|failed|offline|unreachable|blocked|overdue|error|degraded/.test(next)) return "warning";
  if (/attention|pending|review|unknown|medium/.test(next)) return "attention";
  return "info";
}

export function signalConfidence(value: unknown, fallback = 0.65) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.min(1, value));
  const next = text(value).toLowerCase();
  if (next === "confirmed") return 0.95;
  if (next === "high" || next === "likely") return 0.85;
  if (next === "medium" || next === "possible") return 0.65;
  if (next === "low") return 0.4;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : fallback;
}

export function signalTypeFromDomain(value: unknown): SignalType {
  const next = text(value).toLowerCase();
  if (/wallet|payment|account|finance|transaction/.test(next)) return "financial";
  if (/security|access|visitor|gate|lock|camera|incident/.test(next)) return "security";
  if (/environment|sensor|air|waste|humidity|temperature|water|energy|utility/.test(next)) return "environmental";
  if (/maintenance|support|work.?order/.test(next)) return "maintenance";
  if (/community|announcement|post|moderation/.test(next)) return "community";
  if (/message|communication|notification/.test(next)) return "communication";
  if (/ai|oyi|prediction|intelligence/.test(next)) return "ai";
  if (/automation|rule|scene/.test(next)) return "automation";
  if (/registry|estate|home|resident|room/.test(next)) return "registry";
  if (/lifecycle|status|state/.test(next)) return "lifecycle";
  if (/telemetry|meter|edge|device|infrastructure|provider/.test(next)) return "telemetry";
  return "operational";
}

export function normalizeSignal(input: Partial<NormalizedSignal> & Record<string, unknown>): NormalizedSignal {
  const metadata = asRecord(input.metadata);
  const context = asRecord(input.context);
  const entity = asRecord(input.entity);
  const actor = asRecord(input.actor);
  const rawEvidence = Array.isArray(input.evidence) ? input.evidence : [];
  const timestamp = text(input.timestamp || input.created_at || input.updated_at || metadata.timestamp) || new Date().toISOString();
  const domain = text(input.domain || metadata.domain || input.source || "operational");
  const type = input.type || signalTypeFromDomain(domain);
  const source = text(input.source || metadata.source || domain || "future_module");
  const entityId = text(entity.id || input.entity_id || input.id || metadata.entity_id);

  return {
    id: text(input.id || metadata.id || `${source}:${entityId || timestamp}`),
    type,
    source,
    domain,
    entity: {
      id: entityId || null,
      type: text(entity.type || input.entity_type || metadata.entity_type || type) || null,
      name: text(entity.name || input.title || input.name || metadata.name || metadata.title) || null,
      status: text(entity.status || input.status || metadata.status || metadata.state) || null,
    },
    estate: scopeFrom(input.estate || input.estate_id || metadata.estate_id),
    building: scopeFrom(input.building || input.building_id || metadata.building_id),
    room: scopeFrom(input.room || input.room_id || metadata.room_id),
    actor: {
      id: text(actor.id || input.actor_id || metadata.actor_id) || null,
      type: text(actor.type || input.actor_type || metadata.actor_type) || null,
      name: text(actor.name || input.actor_name || metadata.actor_name) || null,
      role: text(actor.role || input.actor_role || metadata.actor_role) || null,
    },
    severity: signalSeverity(input.severity || input.status || metadata.severity || metadata.status),
    confidence: signalConfidence(input.confidence ?? metadata.confidence),
    timestamp,
    context,
    metadata,
    evidence: rawEvidence.map((item, index) => {
      const evidence = asRecord(item);
      return {
        id: text(evidence.id || `${source}:evidence:${index}`),
        type: text(evidence.type || evidence.event_type || "signal"),
        source: text(evidence.source || source),
        summary: text(evidence.summary || evidence.note || evidence.description || evidence.title),
        uri: text(evidence.uri || evidence.url || evidence.href) || null,
        timestamp: text(evidence.timestamp || evidence.created_at || timestamp),
        metadata: asRecord(evidence.metadata),
      };
    }),
  };
}
