import type { OperationalObject } from "@/services/oyiService";

type RouteContextInput = {
  module: string;
  pathname: string;
  estate_id?: string | null;
  home_id?: string | null;
  searchParams: Pick<URLSearchParams, "get">;
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function firstPathObject(pathname: string) {
  const parts = String(pathname || "")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts[0] === "homes" && parts[1]) return { object_type: "home" as const, id: parts[1], source_module: "homes" };
  if (parts[0] === "buildings" && parts[1]) return { object_type: "building" as const, id: parts[1], source_module: "estate-structure" };
  return null;
}

function candidateLabel(objectType: string) {
  const byType: Record<string, string> = {
    estate: "Estate",
    building: "Building",
    home: "Home",
    room: "Room",
    device: "Device",
    visitor: "Visitor",
    maintenance_request: "Maintenance request",
    transaction: "Transaction",
    service_account: "Service account",
    notification: "Notification",
    message_thread: "Message thread",
    community_post: "Community post",
    camera: "Camera",
    provider: "Provider",
    meter: "Meter",
    operational_incident: "Operational incident",
  };
  return byType[objectType] || "Operational object";
}

export function deriveFacilityOperationalObject(input: RouteContextInput): Partial<OperationalObject> | null {
  const routeCandidates: Array<{ object_type: string; id: string; source_module: string }> = [
    { object_type: "device", id: text(input.searchParams.get("deviceId")), source_module: "devices" },
    { object_type: "room", id: text(input.searchParams.get("roomId")), source_module: "rooms" },
    { object_type: "home", id: text(input.searchParams.get("homeId")), source_module: "homes" },
    { object_type: "building", id: text(input.searchParams.get("buildingId")), source_module: "estate-structure" },
    { object_type: "visitor", id: text(input.searchParams.get("visitorId")), source_module: "visitors" },
    { object_type: "maintenance_request", id: text(input.searchParams.get("requestId") || input.searchParams.get("ticketId")), source_module: "maintenance" },
    { object_type: "transaction", id: text(input.searchParams.get("transactionId")), source_module: "wallets" },
    { object_type: "service_account", id: text(input.searchParams.get("serviceId")), source_module: "services" },
    { object_type: "notification", id: text(input.searchParams.get("notificationId")), source_module: "alerts" },
    { object_type: "message_thread", id: text(input.searchParams.get("threadId")), source_module: "messages" },
    { object_type: "community_post", id: text(input.searchParams.get("postId")), source_module: "community" },
    { object_type: "camera", id: text(input.searchParams.get("cameraId")), source_module: "cameras" },
    { object_type: "provider", id: text(input.searchParams.get("providerId")), source_module: "services" },
    { object_type: "meter", id: text(input.searchParams.get("meterId")), source_module: "utilities" },
    { object_type: "operational_incident", id: text(input.searchParams.get("incidentId")), source_module: "live-infrastructure" },
  ];
  const selected = routeCandidates.find((item) => item.id) || firstPathObject(input.pathname);
  if (!selected) return null;
  return {
    object_type: selected.object_type as OperationalObject["object_type"],
    canonical_id: selected.id,
    label: candidateLabel(selected.object_type),
    estate_id: input.estate_id || null,
    home_id:
      selected.object_type === "home"
        ? selected.id
        : input.home_id || null,
    room_id:
      selected.object_type === "room"
        ? selected.id
        : text(input.searchParams.get("roomId")) || null,
    source_module: selected.source_module,
    metadata: {
      route: input.pathname,
      module: input.module,
      source: "facility_route_context",
    },
  };
}
