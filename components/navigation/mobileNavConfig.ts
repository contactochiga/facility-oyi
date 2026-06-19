import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bot,
  Building2,
  Car,
  Cpu,
  Droplets,
  FileText,
  Leaf,
  LayoutDashboard,
  MessageSquare,
  RadioTower,
  Settings,
  ShieldCheck,
  UserRoundCog,
  Wrench,
} from "lucide-react";

export type MobileModuleItem = {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  activeRoutes?: string[];
};

export const facilityMobileModules: MobileModuleItem[] = [
  { key: "overview", label: "Overview", href: "/overview", icon: LayoutDashboard, activeRoutes: ["/overview"] },
  { key: "live-infrastructure", label: "Live", href: "/live-infrastructure", icon: RadioTower, activeRoutes: ["/live-infrastructure", "/digital-twin"] },
  { key: "estate-structure", label: "Estate", href: "/estate-structure", icon: Building2, activeRoutes: ["/estate-structure", "/homes", "/occupancy"] },
  { key: "hardware-devices", label: "Devices", href: "/hardware-devices", icon: Cpu, activeRoutes: ["/hardware-devices", "/devices"] },
  { key: "security-access", label: "Security", href: "/security-access", icon: ShieldCheck, activeRoutes: ["/security-access", "/security", "/visitors", "/cameras"] },
  { key: "utilities", label: "Utilities", href: "/utilities", icon: Droplets, activeRoutes: ["/utilities", "/water"] },
  { key: "environment-sensors", label: "Sensors", href: "/environment", icon: Leaf, activeRoutes: ["/environment"] },
  { key: "traffic-mobility", label: "Traffic", href: "/traffic", icon: Car, activeRoutes: ["/traffic"] },
  { key: "maintenance", label: "Maintenance", href: "/maintenance", icon: Wrench, activeRoutes: ["/maintenance", "/alerts"] },
  { key: "community", label: "Community", href: "/community", icon: MessageSquare, activeRoutes: ["/community", "/messages"] },
];

export const officeMobileModules = [
  { key: "overview", label: "Office Overview", target: "overview", focus: "summary", icon: LayoutDashboard },
  { key: "facility", label: "Building Portfolio", target: "facility", focus: "facility", icon: Building2 },
  { key: "devices", label: "Hardware Devices", target: "devices", focus: "devices", icon: Cpu },
  { key: "commercial", label: "Commercial Command", target: "crm_agents", focus: "crm_agents", icon: BarChart3 },
  { key: "documents", label: "Documents & Plans", target: "web_presence", focus: "web_presence", icon: FileText },
  { key: "reports", label: "Infrastructure Intelligence", target: "reports", focus: "reports", icon: RadioTower },
  { key: "audit", label: "Knowledge & Audit", target: "audit", focus: "governance", icon: ShieldCheck },
  { key: "settings", label: "Platform Infrastructure", target: "settings", focus: "platform_infrastructure", icon: Settings },
  { key: "team", label: "Administration", target: "team", focus: "staff_roles", icon: UserRoundCog },
  { key: "ai", label: "Oyi Intelligence", target: "conversation", focus: "conversation", icon: Bot },
] as const;
