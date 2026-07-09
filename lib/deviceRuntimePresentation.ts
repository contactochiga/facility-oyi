export type RuntimeLike = Record<string, any> | null | undefined;

function text(...values: any[]) {
  for (const value of values) {
    const next = String(value ?? "").trim();
    if (next) return next;
  }
  return "";
}

function record(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function boolValue(value: any): boolean | null {
  if (value === true || value === false) return value;
  const raw = String(value ?? "").trim().toLowerCase();
  if (["1", "true", "on", "yes", "active", "healthy", "online"].includes(raw)) return true;
  if (["0", "false", "off", "no", "inactive", "offline", "unavailable"].includes(raw)) return false;
  return null;
}

function titleCase(value: string, fallback: string) {
  const normalized = value.replace(/[_-]+/g, " ").trim();
  if (!normalized) return fallback;
  return normalized
    .split(/\s+/)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

export function normalizeDeviceRuntime(device: Record<string, any> | null | undefined) {
  const normalized = record(device?.normalized_state);
  const online = boolValue(normalized.online ?? device?.online);
  const primary =
    text(device?.primary_state).toLowerCase() ||
    (online === false ? "offline" : "") ||
    (boolValue(normalized.power) === true ? "on" : boolValue(normalized.power) === false ? "off" : "") ||
    text(normalized.lock_state).toLowerCase() ||
    "";
  const health =
    text(device?.health_status).toLowerCase() ||
    (online === false ? "offline" : "") ||
    text(device?.status).toLowerCase() ||
    "stable";
  return {
    normalized_state: normalized,
    supported_controls: Array.isArray(device?.supported_controls) ? device.supported_controls : [],
    control_profile: text(device?.control_profile).toLowerCase() || "",
    primary_state: primary,
    health_status: health,
    provider_health: text(device?.provider_health).toLowerCase() || "",
    telemetry_summary: record(device?.telemetry_summary),
    activity_summary: text(device?.activity_summary, device?.last_signal),
    last_signal: text(device?.last_signal, device?.activity_summary),
    device_family: text(device?.device_family, device?.category, device?.type).toLowerCase(),
    device_type: text(device?.device_type, device?.type, device?.category),
    online,
  };
}

export function statusLabel(value: any, fallback = "Unknown") {
  const raw = text(value).toLowerCase();
  if (!raw) return fallback;
  if (raw === "on") return "On";
  if (raw === "off") return "Off";
  if (raw === "online") return "Online";
  if (raw === "offline") return "Offline";
  if (raw === "locked") return "Locked";
  if (raw === "unlocked") return "Unlocked";
  if (raw === "open") return "Open";
  if (raw === "closed") return "Closed";
  if (raw === "reporting") return "Reporting";
  return titleCase(raw, fallback);
}

export function healthLabel(value: any, fallback = "Unknown") {
  const raw = text(value).toLowerCase();
  if (!raw) return fallback;
  if (raw === "stable" || raw === "healthy") return "Healthy";
  if (raw === "offline") return "Offline";
  if (raw === "degraded") return "Degraded";
  if (raw === "battery_low") return "Battery low";
  if (/attention|warning|issue|review/.test(raw)) return "Attention";
  return titleCase(raw, fallback);
}

export function providerHealthLabel(value: any, fallback = "Unknown") {
  return healthLabel(value, fallback);
}

export function activitySummary(device: Record<string, any> | null | undefined, fallback = "No recent device activity.") {
  return normalizeDeviceRuntime(device).activity_summary || fallback;
}

export function onlineLabel(device: Record<string, any> | null | undefined, fallback = "Unknown") {
  const runtime = normalizeDeviceRuntime(device);
  if (runtime.online === true) return "Online";
  if (runtime.online === false) return "Offline";
  return fallback;
}

export function toneFromDevice(device: Record<string, any> | null | undefined) {
  const runtime = normalizeDeviceRuntime(device);
  const status = `${runtime.health_status} ${runtime.provider_health} ${runtime.primary_state} ${device?.status || ""}`.toLowerCase();
  if (/stable|healthy|online|on|locked|reporting/.test(status)) return "stable";
  if (/offline|degraded|failed|fault|error|unavailable/.test(status)) return "critical";
  if (/pending|attention|review|battery_low/.test(status)) return "pending";
  return "unavailable";
}
