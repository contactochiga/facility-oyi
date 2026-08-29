import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bell,
  Bot,
  Boxes,
  Brain,
  Building2,
  Car,
  ClipboardCheck,
  CloudCog,
  Cpu,
  Droplets,
  FileText,
  Home,
  KeyRound,
  Leaf,
  LocateFixed,
  LockKeyhole,
  Mail,
  MessageSquare,
  PlugZap,
  Radio,
  RadioTower,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserCircle,
  UserCog,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";

export const OIS_ICON_FAMILY = "lucide-react";

export type OisIconKey =
  | "operationalAttention"
  | "liveInfrastructure"
  | "estateRegistry"
  | "infrastructureRegistry"
  | "securityCommand"
  | "visitorAccess"
  | "infrastructureServices"
  | "environmentalAwareness"
  | "gateFlow"
  | "maintenanceContinuity"
  | "communitySignals"
  | "communicationOperations"
  | "financialPosture"
  | "operationalIntelligence"
  | "operationalGovernance"
  | "serviceReadiness"
  | "operatorAccount"
  | "cameraOperations"
  | "notificationActivity"
  | "permissionOwnership"
  | "providerReadiness"
  | "searchDiscovery"
  | "ownership"
  | "activity";

export const OIS_DOMAIN_ICONS: Record<OisIconKey, LucideIcon> = {
  operationalAttention: Activity,
  liveInfrastructure: RadioTower,
  estateRegistry: Home,
  infrastructureRegistry: Cpu,
  securityCommand: ShieldCheck,
  visitorAccess: KeyRound,
  infrastructureServices: Droplets,
  environmentalAwareness: Leaf,
  gateFlow: Car,
  maintenanceContinuity: Wrench,
  communitySignals: Radio,
  communicationOperations: Mail,
  financialPosture: Wallet,
  operationalIntelligence: Brain,
  operationalGovernance: UserCog,
  serviceReadiness: ClipboardCheck,
  operatorAccount: UserCircle,
  cameraOperations: Boxes,
  notificationActivity: Bell,
  permissionOwnership: LockKeyhole,
  providerReadiness: CloudCog,
  searchDiscovery: Search,
  ownership: LocateFixed,
  activity: MessageSquare,
};

export const FACILITY_MODULE_ICON_KEYS: Record<string, OisIconKey> = {
  overview: "operationalAttention",
  "live-infrastructure": "liveInfrastructure",
  "estate-structure": "estateRegistry",
  "hardware-devices": "infrastructureRegistry",
  "security-access": "securityCommand",
  utilities: "infrastructureServices",
  "environment-sensors": "environmentalAwareness",
  "traffic-mobility": "gateFlow",
  maintenance: "maintenanceContinuity",
  community: "communitySignals",
  wallets: "financialPosture",
  intelligence: "operationalIntelligence",
  administration: "operationalGovernance",
  "facility-administration": "operationalGovernance",
  automation: "operationalIntelligence",
};

export const OIS_TAB_ICONS: Record<string, LucideIcon> = {
  registry: Boxes,
  discovery: Search,
  assignments: LocateFixed,
  providers: CloudCog,
  power: PlugZap,
  water: Droplets,
  internet: RadioTower,
  gas: Activity,
  fees: Wallet,
  facility: Wrench,
  custom: SlidersHorizontal,
  edge: RadioTower,
  telemetry: Activity,
  operators: Users,
  roles: UserCog,
  permissions: LockKeyhole,
  audit: Activity,
  automation: Bot,
  integrations: PlugZap,
  notifications: Bell,
  security: ShieldCheck,
  settings: SlidersHorizontal,
  profile: UserCircle,
};

export function iconForModule(moduleKey: string): LucideIcon {
  return OIS_DOMAIN_ICONS[FACILITY_MODULE_ICON_KEYS[moduleKey] || "operationalAttention"];
}

export function iconForDomain(iconKey: OisIconKey): LucideIcon {
  return OIS_DOMAIN_ICONS[iconKey];
}

export function iconForTab(tabKey: string): LucideIcon {
  return OIS_TAB_ICONS[tabKey] || OIS_DOMAIN_ICONS.activity;
}

export const OFFICE_ICON_ALIASES = {
  overview: Activity,
  facility: Building2,
  devices: Cpu,
  commercial: FileText,
  documents: FileText,
  reports: RadioTower,
  audit: LockKeyhole,
  settings: SlidersHorizontal,
  team: UserCog,
  ai: Bot,
} as const;
