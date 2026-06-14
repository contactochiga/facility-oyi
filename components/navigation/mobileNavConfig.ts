import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bot,
  BriefcaseBusiness,
  ClipboardList,
  CreditCard,
  FileText,
  Home,
  LayoutDashboard,
  MessageSquare,
  Settings,
  ShieldCheck,
  UserRoundCog,
  Users,
  Wrench,
  Zap,
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
  { key: "homes", label: "Homes", href: "/homes", icon: Home, activeRoutes: ["/homes", "/estate-structure", "/occupancy"] },
  { key: "devices", label: "Devices", href: "/hardware-devices", icon: Zap, activeRoutes: ["/hardware-devices", "/devices"] },
  { key: "visitors", label: "Visitors", href: "/visitors", icon: ShieldCheck, activeRoutes: ["/visitors", "/security-access", "/security", "/cameras"] },
  { key: "maintenance", label: "Maintenance", href: "/maintenance", icon: Wrench, activeRoutes: ["/maintenance"] },
  { key: "accounting", label: "Accounting", href: "/wallets", icon: CreditCard, activeRoutes: ["/wallets", "/services", "/utilities", "/water"] },
  { key: "community", label: "Community", href: "/community", icon: MessageSquare, activeRoutes: ["/community", "/messages"] },
  { key: "staff", label: "Staff", href: "/facility-administration", icon: UserRoundCog, activeRoutes: ["/facility-administration", "/account", "/super-admin"] },
  { key: "reports", label: "Reports", href: "/alerts", icon: BarChart3, activeRoutes: ["/alerts", "/live-infrastructure", "/digital-twin", "/environment", "/traffic"] },
  { key: "ai", label: "AI", href: "/facility-intelligence", icon: Bot, activeRoutes: ["/facility-intelligence"] },
];

export const officeMobileModules = [
  { key: "dashboard", label: "Dashboard", target: "overview", focus: "summary", icon: LayoutDashboard },
  { key: "projects", label: "Projects", target: "commercial", icon: BriefcaseBusiness },
  { key: "clients", label: "Clients", target: "crm_agents", focus: "crm_agents", icon: Users },
  { key: "documents", label: "Documents", target: "web_presence", focus: "web_presence", icon: FileText },
  { key: "tasks", label: "Tasks", target: "notifications", icon: ClipboardList },
  { key: "finance", label: "Finance", target: "reports", focus: "reports", icon: CreditCard },
  { key: "team", label: "Team", target: "team", focus: "staff_roles", icon: UserRoundCog },
  { key: "reports", label: "Reports", target: "reports", focus: "reports", icon: BarChart3 },
  { key: "settings", label: "Settings", target: "settings", focus: "platform_infrastructure", icon: Settings },
  { key: "ai", label: "AI", target: "ai_operations", focus: "ai_operations", icon: Bot },
] as const;
