import { facilityService } from "@/services/facilityService";

export type InfrastructureSource = "devices" | "cameras" | "edge" | "utilities" | "providers";
export type InfrastructurePostureState = "stable" | "attention" | "degraded" | "unavailable";

export type InfrastructurePostureRow = {
  source: InfrastructureSource;
  label: string;
  state: InfrastructurePostureState;
  affected: number;
  reason: string;
  route: string;
};

export type InfrastructurePostureData = {
  registry: any[];
  cameras: any[];
  cameraHistory: any[];
  edgeNodes: any[];
  edgeHistory: any[];
  utilities: any[];
  providers: any[];
  providerEvents: any[];
  available: Record<InfrastructureSource, boolean>;
};

const emptyData: InfrastructurePostureData = {
  registry: [], cameras: [], cameraHistory: [], edgeNodes: [], edgeHistory: [], utilities: [], providers: [], providerEvents: [],
  available: { devices: false, cameras: false, edge: false, utilities: false, providers: false },
};

const text = (value: unknown) => String(value || "").toLowerCase();
const has = (value: unknown, expression: RegExp) => expression.test(text(value));
const array = (value: unknown) => Array.isArray(value) ? value : [];
const sourceAvailable = (source: any, fallback: boolean) => source?.available !== false && fallback;

export async function loadInfrastructurePostureData(): Promise<InfrastructurePostureData> {
  const [operations, cameras, edge, utilities] = await Promise.allSettled([
    facilityService.infrastructureOperations(),
    facilityService.platformCameraInfrastructure(),
    facilityService.platformEdgeHistory(),
    facilityService.platformUtilityTelemetry(),
  ]);
  const operationData = operations.status === "fulfilled" ? operations.value : null;
  const cameraData = cameras.status === "fulfilled" ? cameras.value : null;
  const edgeData = edge.status === "fulfilled" ? edge.value : null;
  const utilityData = utilities.status === "fulfilled" ? utilities.value : null;
  if (!operationData && !cameraData && !edgeData && !utilityData) return emptyData;

  return {
    registry: array(operationData?.registry),
    cameras: array(cameraData?.items),
    cameraHistory: array(cameraData?.history),
    edgeNodes: array(operationData?.edge_nodes),
    edgeHistory: array(edgeData?.items),
    utilities: array(utilityData?.items),
    providers: array(operationData?.providers),
    providerEvents: array(operationData?.telemetry).filter((row: any) => text(row?.domain) === "provider"),
    available: {
      devices: sourceAvailable(operationData?.sources?.devices, Boolean(operationData)),
      cameras: sourceAvailable(cameraData?.sources?.cameras, Boolean(cameraData)),
      edge: sourceAvailable(operationData?.sources?.edge_nodes, Boolean(operationData)) || sourceAvailable(edgeData?.sources?.edge, Boolean(edgeData)),
      utilities: sourceAvailable(utilityData?.sources?.utility, Boolean(utilityData)),
      providers: sourceAvailable(operationData?.sources?.provider_webhook_events, Boolean(operationData)),
    },
  };
}

function faultState(rows: any[], degraded: RegExp, attention: RegExp) {
  const degradedRows = rows.filter((row) => has(`${row?.status} ${row?.health} ${row?.health_state} ${row?.stream_state} ${row?.state} ${row?.severity}`, degraded));
  const attentionRows = rows.filter((row) => !degradedRows.includes(row) && has(`${row?.status} ${row?.health} ${row?.health_state} ${row?.stream_state} ${row?.state} ${row?.severity}`, attention));
  return { degradedRows, attentionRows };
}

export function resolveInfrastructurePosture(data: InfrastructurePostureData): InfrastructurePostureRow[] {
  const deviceFaults = faultState(data.registry, /error|failed|unavailable|disabled/, /offline|degraded|unknown/);
  const cameraFaults = faultState(data.cameras, /offline|failed|error|unavailable/, /warning|degraded|unknown/);
  const edgeFaults = faultState(data.edgeNodes, /offline|unreachable|failed|error/, /degraded|warning|unknown/);
  const utilityFaults = faultState(data.utilities, /offline|degraded|critical|failed/, /warning|attention/);
  const configuredProviders = data.providers.filter((provider) => !/pending_configuration/i.test(String(provider?.status || "")));
  const providerFailures = configuredProviders.filter((provider) => has(`${provider?.status}`, /provider_error|disconnected|failed/) || Number(provider?.sync_errors || 0) > 0);
  const providerWarnings = data.providers.filter((provider) => has(provider?.status, /pending_configuration|warning/));

  const stateFor = (available: boolean, rows: any[], faults: ReturnType<typeof faultState>, unavailableReason: string, emptyReason: string): Pick<InfrastructurePostureRow, "state" | "affected" | "reason"> => {
    if (!available) return { state: "unavailable", affected: 0, reason: unavailableReason };
    if (!rows.length) return { state: "unavailable", affected: 0, reason: emptyReason };
    if (faults.degradedRows.length) return { state: "degraded", affected: faults.degradedRows.length, reason: `${faults.degradedRows.length} critical health issue${faults.degradedRows.length === 1 ? "" : "s"}` };
    if (faults.attentionRows.length) return { state: "attention", affected: faults.attentionRows.length, reason: `${faults.attentionRows.length} item${faults.attentionRows.length === 1 ? "" : "s"} needs review` };
    return { state: "stable", affected: 0, reason: "No actionable health issue" };
  };

  const devices = !data.available.devices
    ? { state: "unavailable" as const, affected: 0, reason: "Device registry unavailable" }
    : !data.registry.length
      ? { state: "stable" as const, affected: 0, reason: "No registered devices" }
      : stateFor(true, data.registry, deviceFaults, "Device registry unavailable", "No registered devices");
  const cameras = stateFor(data.available.cameras, data.cameras, cameraFaults, "Camera health source unavailable", "Not configured");
  const edge = stateFor(data.available.edge, data.edgeNodes, edgeFaults, "Edge source unavailable", "Not configured");
  const utilities = stateFor(data.available.utilities, data.utilities, utilityFaults, "Utility telemetry unavailable", "Not configured");
  const providers: Pick<InfrastructurePostureRow, "state" | "affected" | "reason"> = !data.available.providers
    ? { state: "unavailable", affected: 0, reason: "Provider health source unavailable" }
    : providerFailures.length
      ? { state: "degraded", affected: providerFailures.length, reason: `${providerFailures.length} provider failure${providerFailures.length === 1 ? "" : "s"}` }
      : configuredProviders.length
        ? { state: "stable", affected: 0, reason: "Configured providers are connected" }
        : providerWarnings.length
          ? { state: "attention", affected: 0, reason: "No provider configured" }
          : { state: "unavailable", affected: 0, reason: "No provider source returned" };

  return [
    { source: "devices", label: "Devices", route: "/hardware-devices", ...devices },
    { source: "cameras", label: "Cameras", route: "/cameras", ...cameras },
    { source: "edge", label: "Edge", route: "/hardware-devices?tab=edge", ...edge },
    { source: "utilities", label: "Utilities", route: "/utilities", ...utilities },
    { source: "providers", label: "Providers", route: "/hardware-devices?tab=providers", ...providers },
  ];
}

export function postureTone(state: InfrastructurePostureState) {
  return {
    stable: "border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
    attention: "border-amber-400/20 bg-amber-500/10 text-amber-100",
    degraded: "border-rose-400/20 bg-rose-500/10 text-rose-100",
    unavailable: "border-white/10 bg-white/[0.05] text-zinc-300",
  }[state];
}

export function postureLabel(state: InfrastructurePostureState) {
  return { stable: "Stable", attention: "Attention", degraded: "Degraded", unavailable: "Unavailable" }[state];
}

export function sourceRecords(data: InfrastructurePostureData, source: InfrastructureSource) {
  if (source === "devices") return data.registry;
  if (source === "cameras") return data.cameras;
  if (source === "edge") return data.edgeNodes;
  if (source === "utilities") return data.utilities;
  return data.providers.filter((provider) => !/pending_configuration/i.test(String(provider?.status || "")));
}
