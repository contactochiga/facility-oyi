import API from "./api";
import { maintenanceService, type MaintenanceItem } from "./maintenanceService";
import { visitorService, type VisitorItem } from "./visitorService";
import { notificationService, type AlertItem } from "./notificationService";
import { facilityService } from "./facilityService";

export type OperatorQueueItem = {
  id: string;
  title: string;
  module: "maintenance" | "visitors" | "incidents" | "alerts" | "workflows" | "devices" | "utilities" | "infrastructure";
  priority: "critical" | "high" | "medium" | "low";
  status: string;
  owner: string;
  source?: string;
  created_at?: string | null;
  due_at?: string | null;
  route: string;
  next_action: string;
  blocking_reason?: string | null;
  verification?: "pending" | "verified" | "not_required";
};

const closed = new Set(["completed", "verified", "resolved", "closed", "cancelled", "exited", "denied"]);
const priority = (value: unknown): OperatorQueueItem["priority"] => /critical|urgent|intrusion|fire|panic/.test(String(value || "").toLowerCase()) ? "critical" : /high|offline|failed|error|unreachable|overdue|security/.test(String(value || "").toLowerCase()) ? "high" : /low/.test(String(value || "").toLowerCase()) ? "low" : "medium";
const isFault = (row: any) => /offline|error|failed|degraded|unreachable|critical/.test(String(row?.status || row?.health || row?.health_state || row?.stream_state || row?.state || row?.severity || "").toLowerCase());

export async function loadOperatorQueue(role?: string | null): Promise<OperatorQueueItem[]> {
  const [maintenance, visitors, notifications, incidents, workflows, infrastructure, utilities, cameras] = await Promise.all([
    maintenanceService.list().catch(() => [] as MaintenanceItem[]),
    visitorService.list({ today: true }).catch(() => [] as VisitorItem[]),
    notificationService.unread().catch(() => [] as AlertItem[]),
    facilityService.platformIncidents().catch(() => ({ items: [] })),
    API.get("/intelligence/workflows", { params: { limit: 100 } }).then((r) => r.data?.workflows || []).catch(() => []),
    facilityService.infrastructureOperations().catch(() => ({ registry: [], edge_nodes: [], providers: [], telemetry: [] } as any)),
    facilityService.platformUtilityTelemetry().catch(() => ({ items: [] })),
    facilityService.platformCameraInfrastructure().catch(() => ({ items: [] })),
  ]);
  const normalizedRole = String(role || "").toLowerCase();
  const registry = (infrastructure as any)?.registry || [];
  const edgeNodes = (infrastructure as any)?.edge_nodes || [];
  const providers = (infrastructure as any)?.providers || [];
  const items: OperatorQueueItem[] = [
    ...maintenance.filter((row) => !closed.has(String(row.status || "").toLowerCase())).map((row) => ({ id: `maintenance:${row.id}`, title: row.title || "Maintenance request", module: "maintenance" as const, priority: priority(`${row.priority} ${row.status}`), status: String(row.status || "submitted"), owner: row.assigned_operator || row.assigned_to || "Unassigned", source: "Maintenance", created_at: row.created_at, route: "/maintenance", next_action: row.assigned_to ? "Review progress and blockers" : "Assign an operator", blocking_reason: (row as any).blocking_reason || null, verification: ["completed", "attended"].includes(String(row.status || "").toLowerCase()) ? "pending" : "not_required" })),
    ...visitors.filter((row) => ["pending", "active", "approved"].includes(String(row.status || "").toLowerCase())).map((row) => ({ id: `visitor:${row.id}`, title: row.visitor_name || "Visitor access", module: "visitors" as const, priority: priority(row.status), status: String(row.status || "pending"), owner: "Security desk", source: "Visitor access", created_at: row.created_at, route: "/visitors", next_action: "Verify or update visitor access" })),
    ...notifications.map((row: any) => ({ id: `alert:${row.id}`, title: row.title || "Operational alert", module: "alerts" as const, priority: priority(`${row.type} ${row.title} ${row.message}`), status: String(row.status || "received"), owner: "Unassigned", source: "Alert", created_at: row.created_at, route: "/alerts", next_action: "Acknowledge and route the alert" })),
    ...((incidents as any)?.items || []).filter((row: any) => !closed.has(String(row.status || "").toLowerCase())).map((row: any) => ({ id: `incident:${row.id}`, title: row.title || "Operational incident", module: "incidents" as const, priority: priority(`${row.severity} ${row.status}`), status: String(row.status || "detected"), owner: row.assigned_to || "Unassigned", source: row.source || "Incident", created_at: row.created_at, route: "/alerts", next_action: row.assigned_to ? "Review response steps" : "Assign incident owner", blocking_reason: row.blocking_reason || null, verification: ["resolved", "completed"].includes(String(row.status || "").toLowerCase()) && !row.verified_at ? "pending" : "not_required" })),
    ...workflows.filter((row: any) => !closed.has(String(row.workflow_status || "").toLowerCase())).map((row: any) => ({ id: `workflow:${row.id}`, title: row.title || row.workflow_type || "Workflow", module: "workflows" as const, priority: priority(row.workflow_priority), status: String(row.workflow_status || "created"), owner: row.workflow_assignee || row.workflow_owner || "Unassigned", source: "Workflow", created_at: row.created_at, due_at: row.workflow_due_at, route: "/facility-intelligence?module=workflows", next_action: row.workflow_status === "completed" ? "Verify completion" : row.workflow_assignee ? "Review ownership and SLA" : "Assign workflow owner", blocking_reason: row.workflow_resolution || null, verification: row.workflow_status === "completed" ? "pending" : "not_required" })),
    ...registry.filter(isFault).map((row: any) => ({ id: `device:${row.id || row.device_id}`, title: row.name || row.device_name || "Infrastructure device", module: "infrastructure" as const, priority: priority(`${row.status} ${row.health}`), status: String(row.status || row.health || "degraded"), owner: row.owner || "Unassigned", source: "Device", created_at: row.updated_at || row.last_seen_at || row.created_at, route: "/hardware-devices", next_action: "Inspect device health and connectivity" })),
    ...((cameras as any)?.items || []).filter(isFault).map((row: any) => ({ id: `camera:${row.id || row.camera_id}`, title: row.name || row.camera_name || "Camera stream", module: "infrastructure" as const, priority: priority(`${row.health_state} ${row.stream_state}`), status: String(row.health_state || row.stream_state || row.status || "degraded"), owner: row.area_owner || "Unassigned", source: "Camera", created_at: row.updated_at || row.observed_at || row.created_at, route: "/cameras", next_action: "Inspect stream health and camera evidence" })),
    ...edgeNodes.filter(isFault).map((row: any) => ({ id: `edge:${row.id || row.node_id}`, title: row.name || row.node_id || "Oyi Edge node", module: "infrastructure" as const, priority: priority(`${row.status} ${row.sync_status}`), status: String(row.status || row.sync_status || "degraded"), owner: row.owner || "Unassigned", source: "Oyi Edge", created_at: row.last_heartbeat_at || row.updated_at || row.created_at, route: "/hardware-devices?tab=edge", next_action: "Inspect runtime reachability and heartbeat" })),
    ...((utilities as any)?.items || []).filter((row: any) => /offline|failed|degraded|low|critical|warning/i.test(String(row.status || row.health || row.state || row.severity || ""))).map((row: any) => ({ id: `utility:${row.id || row.meter_id}`, title: row.name || row.utility_type || "Utility issue", module: "utilities" as const, priority: priority(`${row.status} ${row.health} ${row.severity}`), status: String(row.status || row.health || row.state || "attention"), owner: row.owner || "Unassigned", source: "Utility telemetry", created_at: row.observed_at || row.updated_at || row.created_at, route: "/utilities", next_action: "Review utility telemetry and service status" })),
    ...providers.filter((row: any) => /provider_error|disconnected|failed/i.test(String(row.status || "")) || Number(row.sync_errors || 0) > 0).map((row: any) => ({ id: `provider:${row.key || row.name}`, title: row.name || row.key || "Provider integration", module: "infrastructure" as const, priority: priority(`${row.status} ${row.sync_errors ? "failed" : ""}`), status: String(row.status || "provider_error"), owner: "Unassigned", source: "Provider", created_at: row.last_sync_at || null, route: "/hardware-devices?tab=providers", next_action: "Review provider synchronization and failure evidence" })),
  ];
  const roleModules = normalizedRole === "security_operator" ? new Set(["visitors", "incidents", "alerts", "workflows", "infrastructure"]) : normalizedRole === "maintenance_operator" ? new Set(["maintenance", "workflows", "alerts", "devices", "utilities", "infrastructure"]) : normalizedRole === "finance_operator" ? new Set(["alerts", "workflows", "utilities"]) : null;
  return items.filter((item) => !roleModules || roleModules.has(item.module)).sort((a, b) => (priority(b.priority) === priority(a.priority) ? new Date(a.due_at || a.created_at || 0).getTime() - new Date(b.due_at || b.created_at || 0).getTime() : ["critical", "high", "medium", "low"].indexOf(a.priority) - ["critical", "high", "medium", "low"].indexOf(b.priority)));
}
