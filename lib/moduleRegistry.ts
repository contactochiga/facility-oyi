import { hasPermission, type OyiIdentity, type PermissionKey } from "./oyiFoundation";

export type VisibilityScope = PermissionKey | string;

export type ModuleDefinition = {
  key: string;
  label: string;
  href: string;
  startsWith?: string[];
  anyOf?: VisibilityScope[];
  allOf?: VisibilityScope[];
  adminOnly?: boolean;
};

export type TabDefinition = {
  key: string;
  label: string;
  anyOf?: VisibilityScope[];
  allOf?: VisibilityScope[];
};

export function isSuperAdmin(user: OyiIdentity | null | undefined) {
  const role = String(user?.role || "").toLowerCase();
  return ["super_admin", "ochiga_admin", "admin", "system_admin"].includes(role);
}

export function canSee(user: OyiIdentity | null | undefined, item: Pick<ModuleDefinition, "anyOf" | "allOf" | "adminOnly">) {
  if (isSuperAdmin(user)) return true;
  if (item.adminOnly) return false;
  const anyOf = item.anyOf || [];
  const allOf = item.allOf || [];
  if (allOf.length && !allOf.every((permission) => hasPermission(user, permission))) return false;
  if (anyOf.length) return anyOf.some((permission) => hasPermission(user, permission));
  return true;
}

export function visibleModules<T extends ModuleDefinition>(user: OyiIdentity | null | undefined, modules: T[]) {
  return modules.filter((module) => canSee(user, module));
}

export function visibleTabs<T extends TabDefinition>(user: OyiIdentity | null | undefined, tabs: T[]) {
  return tabs.filter((tab) => canSee(user, tab));
}

export const FACILITY_MODULES: ModuleDefinition[] = [
  { key: "overview", label: "Overview", href: "/overview", startsWith: ["/overview"], anyOf: ["estates.read", "homes.read"] },
  { key: "live-infrastructure", label: "Live", href: "/live-infrastructure", startsWith: ["/live-infrastructure", "/digital-twin"], anyOf: ["twin.view", "estates.read"] },
  { key: "estate-structure", label: "Buildings", href: "/estate-structure", startsWith: ["/estate-structure", "/homes", "/occupancy"], anyOf: ["homes.read", "estates.read"] },
  { key: "hardware-devices", label: "Assets", href: "/hardware-devices", startsWith: ["/hardware-devices", "/devices"], anyOf: ["devices.read"] },
  { key: "security-access", label: "Security", href: "/security-access", startsWith: ["/security-access", "/security", "/visitors", "/cameras"], anyOf: ["cameras.view", "visitors.manage", "visitors.create"] },
  { key: "utilities", label: "Utilities", href: "/services", startsWith: ["/services", "/utilities", "/water"], anyOf: ["devices.read", "estates.read"] },
  { key: "environment-sensors", label: "Environment", href: "/environment", startsWith: ["/environment"], anyOf: ["devices.read"] },
  { key: "traffic-mobility", label: "Access", href: "/traffic", startsWith: ["/traffic"], anyOf: ["visitors.manage", "estates.read"] },
  { key: "maintenance", label: "Maintenance", href: "/maintenance", startsWith: ["/maintenance", "/alerts"], anyOf: ["support.read", "support.assign"] },
  { key: "community", label: "Community", href: "/community", startsWith: ["/community", "/messages"], anyOf: ["community.read", "community.write", "community.moderate", "community.broadcast", "community.manage_announcements", "notifications.read"] },
  { key: "wallets", label: "Finance", href: "/wallets", startsWith: ["/wallets"], anyOf: ["wallets.read", "wallets.manage"] },
];

export const FACILITY_TABS: Record<string, TabDefinition[]> = {
  "live-infrastructure": [
    { key: "map", label: "Map", anyOf: ["estates.read"] },
    { key: "twin", label: "Digital Twin", anyOf: ["twin.view", "estates.read"] },
    { key: "heat", label: "Heat Maps", anyOf: ["estates.read"] },
    { key: "layers", label: "Infrastructure Layers", anyOf: ["devices.read"] },
  ],
  "hardware-devices": [
    { key: "dashboard", label: "Continuity", anyOf: ["devices.read"] },
    { key: "registry", label: "Registry", anyOf: ["devices.read"] },
    { key: "discovery", label: "Discovery", anyOf: ["devices.control"] },
    { key: "control", label: "Ownership", anyOf: ["devices.control"] },
    { key: "telemetry", label: "Telemetry", anyOf: ["devices.read"] },
    { key: "edge", label: "Edge Agents", anyOf: ["devices.read"] },
  ],
};
