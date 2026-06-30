"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  Camera,
  ChevronRight,
  Cpu,
  DoorOpen,
  Eye,
  Home,
  Layers3,
  LocateFixed,
  MapPinned,
  Maximize2,
  Minus,
  Network,
  Plus,
  Search,
  ShieldAlert,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import API from "@/services/api";
import { facilityService, type InfrastructureOperations } from "@/services/facilityService";
import cameraService, { type BoundCamera } from "@/services/cameraService";
import { maintenanceService, type MaintenanceItem } from "@/services/maintenanceService";
import { visitorService, type VisitorItem } from "@/services/visitorService";
import { useContextStore } from "@/store/useContextStore";

const LAYERS = [
  "estate",
  "model",
  "infrastructure",
  "devices",
  "cameras",
  "utilities",
  "incidents",
  "edge",
  "maintenance",
] as const;

type LayerKey = (typeof LAYERS)[number];
type TwinStatus = "No model loaded" | "Model loading" | "Model available" | "Render unavailable" | "Awaiting Twin source";
type Detail = { type: string; title: string; subtitle?: string; rows: Array<[string, string]>; href?: string };

type TwinResource = {
  configured?: boolean;
  source?: string | null;
  model_url?: string | null;
  render_url?: string | null;
  capabilities?: string[];
  reason?: string | null;
};

type LoadState<T> = { status: "loading" | "ready" | "error" | "permission"; data: T; message?: string };

function state<T>(data: T, status: LoadState<T>["status"] = "loading", message?: string): LoadState<T> {
  return { data, status, message };
}

function sourceLabel<T>(source: LoadState<T>, empty = "Pending source") {
  if (source.status === "loading") return "Loading source";
  if (source.status === "permission") return "Permission required";
  if (source.status === "error") return source.message || "Backend unavailable";
  return empty;
}

function fromError<T>(error: any, fallback: T): LoadState<T> {
  const code = Number(error?.response?.status || 0);
  const message = String(error?.response?.data?.error || error?.response?.data?.message || error?.message || "Backend unavailable");
  return state(fallback, code === 401 || code === 403 ? "permission" : "error", message);
}

async function loadSource<T>(request: Promise<T>, fallback: T): Promise<LoadState<T>> {
  try {
    return state(await request, "ready");
  } catch (error) {
    return fromError(error, fallback);
  }
}

function text(value: any, fallback = "Unavailable") {
  const next = String(value ?? "").trim();
  return next || fallback;
}

function when(value?: string | null) {
  if (!value) return "No live timestamp";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No live timestamp";
  return date.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function lower(value: any) {
  return String(value ?? "").toLowerCase();
}

function tone(value?: string | null) {
  const v = lower(value || "unknown");
  if (/online|active|healthy|available|ready|entered|approved/.test(v)) return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
  if (/offline|error|failed|unavailable|expired|critical/.test(v)) return "border-rose-500/20 bg-rose-500/10 text-rose-200";
  if (/pending|awaiting|unknown|degraded|open|assigned/.test(v)) return "border-amber-500/20 bg-amber-500/10 text-amber-100";
  return "border-white/10 bg-white/5 text-zinc-300";
}

function Status({ value }: { value: string }) {
  return <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.12em] ${tone(value)}`}>{value}</span>;
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          {subtitle ? <p className="mt-1 text-xs leading-5 text-zinc-500">{subtitle}</p> : null}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function hasLocation(entity: any) {
  return Boolean(entity?.home_id || entity?.room_id || entity?.home?.id || entity?.room?.id || entity?.home_name || entity?.room_name || entity?.location);
}

function deviceLocation(device: any) {
  return text(device?.room?.name || device?.room_name || device?.home?.name || device?.home_name || device?.room || device?.location, "Pending assignment");
}

function cameraStatus(camera: BoundCamera) {
  return text(camera.health_status || camera.stream_status || camera.status, "unknown");
}

function layerMatches(layer: LayerKey, entityType: string) {
  const type = entityType.toLowerCase();
  if (layer === "estate") return ["home", "room"].includes(type);
  if (layer === "infrastructure") return true;
  if (layer === "devices") return type === "device";
  if (layer === "cameras") return type === "camera";
  if (layer === "edge") return type === "edge";
  if (layer === "maintenance") return type === "maintenance";
  if (layer === "incidents") return type.includes("incident");
  if (layer === "utilities") return type === "utility";
  return layer === "model";
}

function maintenanceOpen(item: MaintenanceItem) {
  return !/closed|completed|cancelled|resolved/.test(lower(item.status));
}

export default function DigitalTwinPage() {
  const { context } = useContextStore();
  const [loading, setLoading] = useState(true);
  const [estateName, setEstateName] = useState("Estate Command Center");
  const [estateId, setEstateId] = useState<string | null>(null);
  const [estate, setEstate] = useState<LoadState<any>>(state(null));
  const [infra, setInfra] = useState<LoadState<InfrastructureOperations | null>>(state(null));
  const [cameras, setCameras] = useState<LoadState<BoundCamera[]>>(state([]));
  const [maintenance, setMaintenance] = useState<LoadState<MaintenanceItem[]>>(state([]));
  const [visitors, setVisitors] = useState<LoadState<VisitorItem[]>>(state([]));
  const [notifications, setNotifications] = useState<LoadState<any[]>>(state([]));
  const [twin, setTwin] = useState<LoadState<TwinResource | null>>(state(null));
  const [model, setModel] = useState<LoadState<TwinResource | null>>(state(null));
  const [render, setRender] = useState<LoadState<TwinResource | null>>(state(null));
  const [placements, setPlacements] = useState<LoadState<any[]>>(state([]));
  const [utilityTelemetry, setUtilityTelemetry] = useState<LoadState<any[]>>(state([]));
  const [platformIncidents, setPlatformIncidents] = useState<LoadState<any[]>>(state([]));
  const [edgeHistory, setEdgeHistory] = useState<LoadState<any[]>>(state([]));
  const [cameraInfrastructure, setCameraInfrastructure] = useState<LoadState<any[]>>(state([]));
  const [activeLayer, setActiveLayer] = useState<LayerKey>("estate");
  const [visible, setVisible] = useState<Record<LayerKey, boolean>>(() => Object.fromEntries(LAYERS.map((layer) => [layer, true])) as Record<LayerKey, boolean>);
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [zoom, setZoom] = useState(100);

  const load = useCallback(async () => {
    setLoading(true);
    const estates = await loadSource(facilityService.myEstates(), { estates: [] });
    const firstEstate = estates.data.estates?.find((item: any) => String(item.id) === String(context?.estate_id || "")) || estates.data.estates?.[0] || null;
    const nextEstateId = firstEstate?.id ? String(firstEstate.id) : null;
    setEstateId(nextEstateId);
    setEstateName(firstEstate?.name || "Estate Command Center");

    const [structure, operations, platformTwin, utilityState, incidentsState, edgeHistoryState, cameraInfraState, maintenanceState, visitorState, notificationState, cameraState] = await Promise.all([
      loadSource(facilityService.estateStructure(nextEstateId || undefined), null),
      loadSource(facilityService.infrastructureOperations(), null),
      loadSource(facilityService.platformTwin(), null),
      loadSource(facilityService.platformUtilityTelemetry(), { items: [] }),
      loadSource(facilityService.platformIncidents(), { items: [] }),
      loadSource(facilityService.platformEdgeHistory(), { items: [] }),
      loadSource(facilityService.platformCameraInfrastructure(), { items: [], history: [] }),
      loadSource(maintenanceService.list(), []),
      loadSource(visitorService.listToday(), []),
      loadSource(API.get("/notifications", { params: { unread: true } }).then((res) => res.data?.items || res.data?.data || []), []),
      nextEstateId ? loadSource(cameraService.listByEstate(nextEstateId).then((res) => res.items || []), []) : Promise.resolve(state<BoundCamera[]>([], "error", "No estate context")),
    ]);

    setEstate(structure);
    setInfra(operations);
    const models = platformTwin.data?.models || [];
    const activeModel = models[0] || null;
    setTwin(platformTwin.status === "ready" ? state(platformTwin.data as any, "ready") : state(null, platformTwin.status, platformTwin.message));
    setModel(platformTwin.status === "ready" ? state(activeModel ? { ...activeModel, configured: true, model_url: activeModel.file_url, source: activeModel.source_type } : { configured: false, source: null, model_url: null }, "ready") : state(null, platformTwin.status, platformTwin.message));
    setRender(platformTwin.status === "ready" ? state(activeModel?.metadata?.render_url ? { configured: true, render_url: activeModel.metadata.render_url, source: "registered_model" } : { configured: false, source: null, render_url: null }, "ready") : state(null, platformTwin.status, platformTwin.message));
    setPlacements(platformTwin.status === "ready" ? state(platformTwin.data?.placements || [], "ready") : state([], platformTwin.status, platformTwin.message));
    setUtilityTelemetry(utilityState.status === "ready" ? state(utilityState.data?.items || [], "ready") : state([], utilityState.status, utilityState.message));
    setPlatformIncidents(incidentsState.status === "ready" ? state(incidentsState.data?.items || [], "ready") : state([], incidentsState.status, incidentsState.message));
    setEdgeHistory(edgeHistoryState.status === "ready" ? state(edgeHistoryState.data?.items || [], "ready") : state([], edgeHistoryState.status, edgeHistoryState.message));
    setCameraInfrastructure(cameraInfraState.status === "ready" ? state(cameraInfraState.data?.items || [], "ready") : state([], cameraInfraState.status, cameraInfraState.message));
    setMaintenance(maintenanceState);
    setVisitors(visitorState);
    setNotifications(notificationState);
    setCameras(cameraState);
    setLoading(false);
  }, [context?.estate_id]);

  useEffect(() => {
    const initialLayer = new URLSearchParams(window.location.search).get("layer") || new URLSearchParams(window.location.search).get("mode");
    if (LAYERS.includes(initialLayer as LayerKey)) setActiveLayer(initialLayer as LayerKey);
    void load();
    const onRealtime = (event: Event) => {
      const name = (event as CustomEvent)?.detail?.event || "";
      if (/device|edge|visitor|maintenance|community|notification|audit|camera|incident|twin|utility/.test(name)) void load();
    };
    window.addEventListener("facility:realtime-event", onRealtime);
    return () => window.removeEventListener("facility:realtime-event", onRealtime);
  }, [load]);

  const registry = infra.data?.registry || [];
  const homes = estate.data?.homes || infra.data?.homes || [];
  const rooms = infra.data?.rooms || [];
  const edgeNodes = infra.data?.edge_nodes || [];
  const heartbeats = edgeHistory.data.length ? edgeHistory.data : infra.data?.heartbeats || [];
  const openMaintenance = maintenance.data.filter(maintenanceOpen);
  const offlineDevices = registry.filter((device) => /offline|error|unavailable/.test(lower(device.status)));
  const cameraAttention = cameras.data.filter((camera) => /offline|error|degraded|unavailable|unknown/.test(lower(cameraStatus(camera))));
  const edgeAttention = edgeNodes.filter((node) => /offline|degraded|unreachable|failed|unknown/.test(lower(node.status || node.sync_status)));
  const placementFor = (entityType: string, entityId: any) => placements.data.find((placement) => lower(placement.entity_type) === lower(entityType) && String(placement.entity_id) === String(entityId));
  const locationState = (entityType: string, entityId: any) => text(placementFor(entityType, entityId)?.location_state, "location_pending").replace(/_/g, " ");
  const visitorIncidents = visitors.data.filter((visitor) => /pending|denied|expired/.test(lower(visitor.status)));

  const twinStatus: TwinStatus = loading
    ? "Model loading"
    : twin.status === "error" && model.status === "error" && render.status === "error"
      ? "Awaiting Twin source"
      : model.data?.configured || model.data?.model_url || render.data?.render_url
        ? "Model available"
        : render.status === "ready" && !render.data?.render_url
          ? "Render unavailable"
          : "No model loaded";

  const sourceRows = [
    ["Twin", twin.status === "ready" ? twinStatus : sourceLabel(twin, "Awaiting Twin source")],
    ["Model", model.status === "ready" ? (model.data?.configured ? "Model available" : "No model loaded") : sourceLabel(model, "No model loaded")],
    ["Render", render.status === "ready" ? (render.data?.render_url ? "Render available" : "Render unavailable") : sourceLabel(render, "Render unavailable")],
    ["Registry", infra.status === "ready" ? `${registry.length} registry entities` : sourceLabel(infra, "Pending source")],
    ["Cameras", cameras.status === "ready" ? `${cameras.data.length} cameras` : sourceLabel(cameras, "No live source configured")],
    ["Maintenance", maintenance.status === "ready" ? `${openMaintenance.length} open requests` : sourceLabel(maintenance, "Pending source")],
  ];

  const entities = useMemo(() => {
    const rows: Detail[] = [];
    if (visible.estate) {
      for (const home of homes) rows.push({ type: "Home", title: text(home.name || home.unit || home.id, "Home"), subtitle: [home.block, home.unit].filter(Boolean).join(" / ") || "Estate structure", rows: [["Occupancy", text(home.occupancy_status || home.status, "Pending source")], ["Location", locationState("home", home.id)], ["Assigned devices", String(registry.filter((d) => String(d.home_id || d.home?.id || "") === String(home.id)).length)], ["Assigned cameras", String(cameras.data.filter((c) => String(c.metadata?.home_id || c.edge_node_id || "") === String(home.id)).length)], ["Maintenance", String(maintenance.data.filter((m) => String(m.home_id || "") === String(home.id)).length)]], href: `/homes/${home.id}/users` });
      for (const room of rooms) rows.push({ type: "Room", title: text(room.name || room.id, "Room"), subtitle: `Home ${text(room.home_id, "unassigned")}`, rows: [["Type", text(room.type, "Not configured")], ["Location", locationState("room", room.id)], ["Floor", text(room.floor, "Not configured")], ["Devices", String(registry.filter((d) => String(d.room_id || d.room?.id || "") === String(room.id)).length)]], href: room.home_id ? `/homes/${room.home_id}/rooms` : "/homes" });
    }
    if (visible.devices) {
      for (const device of registry) rows.push({ type: "Device", title: text(device.name || device.oyi_id, "Device"), subtitle: deviceLocation(device), rows: [["Status", text(device.status, "unknown")], ["Location", locationState("device", device.id)], ["Provider", text(device.provider || device.adapter)], ["Protocol", text((device.protocols || []).join(", "), "Unavailable")], ["External ID", text(device.external_id, "Unavailable")]], href: "/hardware-devices" });
    }
    if (visible.cameras) {
      for (const camera of cameras.data) rows.push({ type: "Camera", title: text(camera.name || camera.ip, "Camera"), subtitle: text(camera.ip || camera.edge_node_id, "No location source"), rows: [["Health", cameraStatus(camera)], ["Location", locationState("camera", camera.id)], ["Zone", text(cameraInfrastructure.data.find((item) => String(item.camera_id) === String(camera.id))?.zone, "Location pending")], ["Last seen", when(camera.last_seen_at)], ["AI profile", "Open Camera Center"], ["Edge", text(camera.edge_node_id, "No Edge node")]], href: "/cameras" });
    }
    if (visible.edge) {
      for (const node of edgeNodes) rows.push({ type: "Edge", title: text(node.name || node.node_id, "Oyi Edge node"), subtitle: text(node.ip_address || node.estate_id, "No location source"), rows: [["Status", text(node.status, "unknown")], ["Location", locationState("edge_node", node.id)], ["Version", text(node.version)], ["Heartbeat", when(node.last_heartbeat_at)], ["Queue", text(node.queue_depth, "Awaiting telemetry")], ["Devices", text(node.device_count, "Awaiting telemetry")]], href: "/hardware-devices?tab=edge" });
    }
    if (visible.maintenance) {
      for (const item of maintenance.data) rows.push({ type: "Maintenance", title: text(item.title, "Maintenance request"), subtitle: text(item.room_name || item.home_name || item.category, "No location source"), rows: [["Status", text(item.status)], ["Location", locationState("maintenance", item.id)], ["Priority", text(item.priority)], ["Assigned", text(item.assigned_operator || item.assigned_to, "Unassigned")], ["Created", when(item.created_at)]], href: "/maintenance" });
    }
    if (visible.incidents) {
      for (const item of platformIncidents.data) rows.push({ type: "Incident", title: text(item.title, "Operational incident"), subtitle: text(item.location?.label || item.source, "No incident location"), rows: [["Severity", text(item.severity, "unknown")], ["State", text(item.status, "open")], ["Location", locationState("incident", item.id)], ["Assigned", text(item.assigned_to, "Unassigned")], ["Time", when(item.created_at)]], href: "/alerts" });
      for (const item of notifications.data) rows.push({ type: "Incident", title: text(item.title || item.message, "Operational alert"), subtitle: text(item.location || item.domain, "No incident location"), rows: [["Severity", text(item.severity || item.priority, "unknown")], ["State", text(item.status, "new")], ["Time", when(item.created_at)], ["Source", text(item.source || item.type, "notification")]], href: "/alerts" });
      for (const visitor of visitorIncidents) rows.push({ type: "Visitor Incident", title: text(visitor.visitor_name, "Visitor"), subtitle: text(visitor.purpose || visitor.home_id, "No gate location"), rows: [["Status", text(visitor.status)], ["Time", when(visitor.created_at)], ["Home", text(visitor.home_id, "No home source")]], href: "/visitors" });
    }
    if (visible.utilities) {
      for (const item of utilityTelemetry.data) rows.push({ type: "Utility", title: text(item.utility_type, "Utility telemetry"), subtitle: text(item.source, "Awaiting telemetry"), rows: [["State", text(item.state, "awaiting telemetry")], ["Value", item.value === null || item.value === undefined ? "Awaiting telemetry" : `${item.value} ${text(item.unit, "")}`], ["Observed", when(item.observed_at)], ["Source", text(item.source, "No source configured")]], href: "/utilities" });
      for (const home of homes.filter((h: any) => h.electricity_meter || h.water_meter || h.internet_id)) rows.push({ type: "Utility", title: text(home.name || home.unit, "Utility endpoint"), subtitle: "Estate/home utility identifiers", rows: [["Power", home.electricity_meter ? "Configured" : "Not configured"], ["Water", home.water_meter ? "Configured" : "Not configured"], ["Network", home.internet_id ? "Configured" : "Not configured"]], href: "/utilities" });
    }
    return rows;
  }, [visible, homes, rooms, registry, cameras.data, cameraInfrastructure.data, edgeNodes, maintenance.data, notifications.data, platformIncidents.data, utilityTelemetry.data, visitorIncidents, placements.data]);

  const filteredEntities = entities.filter((item) => {
    const needle = query.trim().toLowerCase();
    if (!needle) return activeLayer === "model" || layerMatches(activeLayer, item.type);
    return `${item.type} ${item.title} ${item.subtitle || ""} ${item.rows.map((row) => row.join(" ")).join(" ")}`.toLowerCase().includes(needle);
  });

  const attention = [
    ...offlineDevices.map((device) => ({ label: text(device.name), domain: "Device Health", status: text(device.status), href: "/hardware-devices" })),
    ...cameraAttention.map((camera) => ({ label: text(camera.name || camera.ip), domain: "Camera Health", status: cameraStatus(camera), href: "/cameras" })),
    ...edgeAttention.map((node) => ({ label: text(node.name || node.node_id), domain: "Edge Health", status: text(node.status || node.sync_status), href: "/hardware-devices?tab=edge" })),
    ...openMaintenance.map((item) => ({ label: text(item.title), domain: "Maintenance Queue", status: text(item.status), href: "/maintenance" })),
    ...platformIncidents.data.map((item) => ({ label: text(item.title), domain: "Incident Queue", status: text(item.status, "open"), href: "/alerts" })),
    ...utilityTelemetry.data.filter((item) => /degraded|offline/.test(lower(item.state))).map((item) => ({ label: text(item.utility_type), domain: "Utility Health", status: text(item.state), href: "/utilities" })),
    ...notifications.data.map((item) => ({ label: text(item.title || item.message), domain: "Incident Queue", status: text(item.status || item.severity, "new"), href: "/alerts" })),
  ].slice(0, 12);

  return (
    <div className={focusMode ? "space-y-4" : "space-y-6"}>
      <Topbar
        title="Digital Twin"
        subtitle="Spatial estate operations"
        strip={[
          { label: "Structures", value: estate.status === "ready" ? homes.length + rooms.length : sourceLabel(estate), detail: "Homes and rooms", tone: "attention" },
          { label: "Device health", value: infra.status === "ready" ? `${offlineDevices.length} attention` : sourceLabel(infra), detail: "Registry posture", tone: offlineDevices.length ? "warning" : "stable" },
          { label: "Camera health", value: cameras.status === "ready" ? `${cameraAttention.length} attention` : sourceLabel(cameras, "Pending source"), detail: "Bound streams", tone: cameraAttention.length ? "warning" : "stable" },
          { label: "Edge health", value: infra.status === "ready" ? `${edgeAttention.length} attention` : sourceLabel(infra), detail: "Heartbeat posture", tone: edgeAttention.length ? "warning" : "stable" },
        ]}
      />

      <section className="rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.12),transparent_34%),linear-gradient(145deg,rgba(255,255,255,0.055),rgba(255,255,255,0.018))] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-sky-200/80">Estate command center</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">{estateName}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">No simulated maps or coordinates are rendered. The twin uses existing estate structure, registry, camera, maintenance, visitor, notification, and Edge sources.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Status value={twinStatus} />
            <Status value={infra.status === "ready" ? "Infrastructure source" : sourceLabel(infra, "Pending source")} />
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
        <Panel title="Twin Layers" subtitle="Toggle real operational layers. Hidden layers are removed from search and detail lists.">
          <div className="space-y-2">
            {LAYERS.map((layer) => (
              <button key={layer} type="button" onClick={() => setActiveLayer(layer)} className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition ${activeLayer === layer ? "border-sky-400/35 bg-sky-500/10 text-sky-100" : "border-white/10 bg-black/15 text-zinc-400 hover:text-white"}`}>
                <input type="checkbox" checked={visible[layer]} onChange={(event) => { event.stopPropagation(); setVisible((current) => ({ ...current, [layer]: event.target.checked })); }} />
                <span className="flex-1 capitalize">{layer.replace(/-/g, " ")}</span>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Spatial Operations Surface" subtitle="Model navigation is available only as a command shell until a render/model source is configured.">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
              <Search className="h-4 w-4 text-zinc-500" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search buildings, homes, residents, devices, cameras, incidents, Edge..." className="w-72 max-w-[60vw] bg-transparent text-sm text-white outline-none" />
            </div>
            <Button variant="ghost" onClick={() => setZoom((value) => Math.max(60, value - 10))} className="gap-2"><Minus className="h-4 w-4" />Zoom</Button>
            <span className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-400">{zoom}%</span>
            <Button variant="ghost" onClick={() => setZoom((value) => Math.min(160, value + 10))} className="gap-2"><Plus className="h-4 w-4" />Zoom</Button>
            <Button variant="ghost" onClick={() => setFocusMode((value) => !value)} className="gap-2"><Maximize2 className="h-4 w-4" />{focusMode ? "Exit focus" : "Focus"}</Button>
          </div>

          <div className="rounded-2xl border border-dashed border-sky-400/20 bg-[radial-gradient(circle_at_center,rgba(14,165,233,0.08),transparent_45%),rgba(0,0,0,0.2)] p-5" style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top left" }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Twin state</p>
                <h2 className="mt-1 text-lg font-semibold text-white">{twinStatus}</h2>
                <p className="mt-1 text-sm text-zinc-500">Pan/zoom controls are shell-level only until a live render or GLB model is configured.</p>
              </div>
              <Status value={render.data?.render_url ? "Render available" : "Render unavailable"} />
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {sourceRows.map(([label, value]) => <div key={label} className="rounded-xl border border-white/10 bg-black/25 p-3"><p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{label}</p><p className="mt-1 text-sm text-zinc-200">{value}</p></div>)}
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {filteredEntities.slice(0, 18).map((item, index) => (
              <button key={`${item.type}-${item.title}-${index}`} type="button" onClick={() => setDetail(item)} className="rounded-2xl border border-white/10 bg-black/15 p-4 text-left transition hover:border-sky-400/30 hover:bg-white/[0.045]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{item.type}</p>
                    <h3 className="mt-1 text-sm font-semibold text-white">{item.title}</h3>
                    <p className="mt-1 text-xs text-zinc-500">{item.subtitle || "No location source"}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-zinc-600" />
                </div>
              </button>
            ))}
            {!filteredEntities.length ? <p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-zinc-500">No entities available for this layer. {activeLayer === "model" ? "Plan Studio Not Configured." : "Awaiting telemetry or source assignment."}</p> : null}
          </div>
        </Panel>

        <Panel title="Infrastructure Command" subtitle="Attention queues from real Facility sources only.">
          <div className="grid gap-2">
            {attention.map((item, index) => (
              <Link key={`${item.domain}-${item.label}-${index}`} href={item.href} className="rounded-xl border border-white/10 bg-black/15 p-3 transition hover:border-sky-400/25">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{item.domain}</p>
                    <p className="mt-1 text-sm text-white">{item.label}</p>
                  </div>
                  <Status value={item.status} />
                </div>
              </Link>
            ))}
            {!attention.length ? <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">No critical attention required from loaded sources.</div> : null}
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <Panel title="Plan Studio Readiness" subtitle="Future ingestion contract without creating a simulated model.">
          <div className="space-y-2 text-sm text-zinc-400">
            <p>GLB models: {model.data?.model_url ? "Model available" : "Plan Studio Not Configured"}</p>
            <p>CAD imports: Plan Studio Not Configured</p>
            <p>Estate plans: {twin.data?.configured ? "Twin source configured" : "Awaiting Twin source"}</p>
            <p>Render pipeline: {render.data?.render_url ? "Render available" : "Render unavailable"}</p>
          </div>
        </Panel>
        <Panel title="Realtime Domains" subtitle="Socket events supplement polling fallback.">
          <div className="grid gap-2 text-sm text-zinc-400">
            {[
              "device.status.updated",
              "device.registry.updated",
              "device.discovered",
              "edge.heartbeat",
              "visitor.updated",
              "maintenance.updated",
              "community.updated",
              "notification:new",
              "audit.recorded",
            ].map((event) => <div key={event} className="rounded-xl border border-white/10 bg-black/15 px-3 py-2">{event}</div>)}
          </div>
        </Panel>
        <Panel title="Spatial Data Integrity" subtitle="Current placement readiness by entity type.">
          <div className="space-y-2 text-sm text-zinc-400">
            <p>Placements persisted: {placements.data.length}</p>
            <p>Devices with assignment: {registry.filter(hasLocation).length}</p>
            <p>Cameras with infrastructure records: {cameraInfrastructure.data.length}</p>
            <p>Maintenance with location: {maintenance.data.filter(hasLocation).length}</p>
            <p>Incidents with location: {platformIncidents.data.filter(hasLocation).length}</p>
          </div>
        </Panel>
      </section>

      {detail ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm">
          <section className="w-full max-w-xl rounded-2xl border border-white/10 bg-zinc-950 p-5">
            <header className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">{detail.type}</p>
                <h2 className="mt-1 text-lg font-semibold text-white">{detail.title}</h2>
                <p className="mt-1 text-sm text-zinc-500">{detail.subtitle || "No location source"}</p>
              </div>
              <button type="button" onClick={() => setDetail(null)} className="rounded-lg border border-white/10 p-2 text-zinc-400 hover:text-white"><X className="h-4 w-4" /></button>
            </header>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {detail.rows.map(([label, value]) => <div key={label} className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{label}</p><p className="mt-1 text-sm text-zinc-200">{value}</p></div>)}
            </div>
            {detail.href ? <Link href={detail.href} className="mt-5 inline-flex items-center gap-2 text-sm text-sky-200 hover:text-sky-100">Open operational module <ChevronRight className="h-4 w-4" /></Link> : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}
