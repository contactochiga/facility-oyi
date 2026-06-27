import { normalizeSignal, signalSeverity, type NormalizedSignal } from "@/lib/operationalSignal";
import { buildAwareness, buildAwarenessFromSignal, type OperationalAwareness } from "@/services/contextAwarenessEngine";
import type { FacilityAttentionItem } from "@/services/facilityAttentionService";

function text(value: unknown) {
  return String(value ?? "").trim();
}

function confidence(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function sourceFromEvent(event: string) {
  if (/device/.test(event)) return "infrastructure_registry";
  if (/edge/.test(event)) return "edge_runtime";
  if (/visitor/.test(event)) return "visitor_registry";
  if (/maintenance/.test(event)) return "maintenance";
  if (/camera/.test(event)) return "camera";
  if (/utility/.test(event)) return "environmental_sensor";
  if (/community/.test(event)) return "community";
  if (/notification|message/.test(event)) return "communication";
  if (/audit/.test(event)) return "registry";
  return "future_module";
}

function domainFromEvent(event: string) {
  if (/device|edge|camera|utility|telemetry/.test(event)) return "infrastructure";
  if (/visitor|security|incident|access/.test(event)) return "security";
  if (/maintenance/.test(event)) return "maintenance";
  if (/community/.test(event)) return "community";
  if (/notification|message/.test(event)) return "communication";
  if (/audit/.test(event)) return "registry";
  return "operational";
}

export function signalInputFromRealtimePayload(event: string, payload: Record<string, unknown>) {
  return {
    id: text(payload.id || payload.event_id || `${event}:${payload.updated_at || payload.created_at || Date.now()}`),
    source: sourceFromEvent(event),
    domain: domainFromEvent(event),
    entity: {
      id: text(payload.entity_id || payload.device_id || payload.camera_id || payload.visitor_id || payload.id),
      type: text(payload.entity_type || payload.type || event),
      name: text(payload.name || payload.title || payload.label || payload.device_name || payload.camera_name),
      status: text(payload.status || payload.state || payload.health_status || payload.stream_status),
    },
    estate: { id: text(payload.estate_id), name: text((payload.estate as Record<string, unknown> | undefined)?.name) },
    building: { id: text(payload.building_id), name: text((payload.building as Record<string, unknown> | undefined)?.name) },
    room: { id: text(payload.room_id), name: text((payload.room as Record<string, unknown> | undefined)?.name) },
    actor: { id: text(payload.actor_id), type: text(payload.actor_type), name: text(payload.actor_name) },
    severity: signalSeverity(payload.severity || payload.status),
    confidence: confidence(payload.confidence),
    timestamp: text(payload.timestamp || payload.created_at || payload.updated_at) || new Date().toISOString(),
    context: {
      ownership: payload.owner || payload.assignee ? { owner: payload.owner, assignee: payload.assignee } : undefined,
      asset: payload.asset,
      deviceHealth: payload.device_health,
      edgeState: payload.edge_state,
      visitor: payload.visitor,
      security: payload.security,
      financial: payload.financial,
    },
    metadata: { ...payload, event },
    evidence: [{ type: event, source: sourceFromEvent(event), summary: text(payload.message || payload.description || payload.summary || payload.status), timestamp: text(payload.timestamp || payload.created_at || payload.updated_at) }],
  };
}

export function awarenessFromRealtimePayload(event: string, payload: Record<string, unknown>): OperationalAwareness {
  return buildAwarenessFromSignal(signalInputFromRealtimePayload(event, payload));
}

export function signalFromFacilityAttention(item: FacilityAttentionItem): NormalizedSignal {
  return normalizeSignal({
    id: item.id,
    source: item.source_type,
    domain: item.domain,
    entity: {
      id: item.source_id,
      type: item.source_type,
      name: item.title,
      status: item.severity,
    },
    severity: item.severity,
    confidence: item.confidence || 0.75,
    timestamp: item.time || new Date().toISOString(),
    context: {
      ownership: { owner: item.action.includes("Assign") ? "Unassigned" : "Operational owner" },
      history: { escalation: item.escalation, overdueMs: item.overdueMs },
    },
    metadata: {
      category: item.category,
      detail: item.detail,
      href: item.href,
      action: item.action,
      operationalImpact: item.operationalImpact,
    },
    evidence: [{ id: `${item.id}:attention`, type: item.category, source: item.source_type, summary: item.detail, timestamp: item.time || null }],
  });
}

export function awarenessFromFacilityAttention(items: FacilityAttentionItem[]) {
  return buildAwareness(items.map(signalFromFacilityAttention));
}
