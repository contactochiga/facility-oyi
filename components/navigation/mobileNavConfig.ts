import type { LucideIcon } from "lucide-react";
import { iconForDomain, iconForModule, OFFICE_ICON_ALIASES } from "@/lib/oisIconRegistry";

export type MobileModuleItem = {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  activeRoutes?: string[];
};

export const facilityMobileModules: MobileModuleItem[] = [
  { key: "overview", label: "Attention", href: "/overview", icon: iconForModule("overview"), activeRoutes: ["/overview"] },
  { key: "live-infrastructure", label: "Live", href: "/live-infrastructure", icon: iconForModule("live-infrastructure"), activeRoutes: ["/live-infrastructure", "/digital-twin"] },
  { key: "estate-structure", label: "Registry", href: "/estate-structure", icon: iconForModule("estate-structure"), activeRoutes: ["/estate-structure", "/homes", "/occupancy"] },
  { key: "hardware-devices", label: "Infra", href: "/hardware-devices", icon: iconForModule("hardware-devices"), activeRoutes: ["/hardware-devices", "/devices"] },
  { key: "security-access", label: "Security", href: "/security-access", icon: iconForModule("security-access"), activeRoutes: ["/security-access", "/security", "/visitors", "/cameras"] },
  { key: "utilities", label: "Utility", href: "/utilities", icon: iconForModule("utilities"), activeRoutes: ["/utilities", "/environment", "/water", "/traffic"] },
  { key: "community", label: "Community", href: "/community", icon: iconForModule("community"), activeRoutes: ["/community", "/messages", "/maintenance", "/alerts"] },
  { key: "wallets", label: "Financial", href: "/wallets", icon: iconForModule("wallets"), activeRoutes: ["/wallets", "/services"] },
  { key: "administration", label: "Profile", href: "/account", icon: iconForDomain("operatorAccount"), activeRoutes: ["/account"] },
];

export const officeMobileModules = [
  { key: "overview", label: "Office Attention", target: "overview", focus: "summary", icon: OFFICE_ICON_ALIASES.overview },
  { key: "facility", label: "Building Portfolio", target: "facility", focus: "facility", icon: OFFICE_ICON_ALIASES.facility },
  { key: "devices", label: "Infrastructure Registry", target: "devices", focus: "devices", icon: OFFICE_ICON_ALIASES.devices },
  { key: "commercial", label: "Commercial Command", target: "crm_agents", focus: "crm_agents", icon: OFFICE_ICON_ALIASES.commercial },
  { key: "documents", label: "Documents & Plans", target: "web_presence", focus: "web_presence", icon: OFFICE_ICON_ALIASES.documents },
  { key: "reports", label: "Infrastructure Intelligence", target: "reports", focus: "reports", icon: OFFICE_ICON_ALIASES.reports },
  { key: "audit", label: "Knowledge & Audit", target: "audit", focus: "governance", icon: OFFICE_ICON_ALIASES.audit },
  { key: "settings", label: "Platform Infrastructure", target: "settings", focus: "platform_infrastructure", icon: OFFICE_ICON_ALIASES.settings },
  { key: "team", label: "Governance", target: "team", focus: "staff_roles", icon: OFFICE_ICON_ALIASES.team },
  { key: "ai", label: "Oyi Intelligence", target: "conversation", focus: "conversation", icon: OFFICE_ICON_ALIASES.ai },
] as const;
