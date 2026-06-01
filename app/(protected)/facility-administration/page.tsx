import ModuleDashboard from "@/components/modules/ModuleDashboard";
import { KeyRound, PlugZap, Settings, ShieldCheck, Users } from "lucide-react";

export default function FacilityAdministrationModule() {
  return (
    <ModuleDashboard
      title="Facility Administration"
      subtitle="Estate staff, roles, permissions, estate settings, integrations, account controls and guarded super-admin operations."
      eyebrow="Authority Layer"
      tabs={[
        { label: "Dashboard", href: "/facility-administration" },
        { label: "Estate Staff", href: "/account?tab=staff" },
        { label: "Roles & Permissions", href: "/account?tab=permissions" },
        { label: "Estate Settings", href: "/account?tab=settings" },
        { label: "Integrations", href: "/account?tab=integrations" },
        { label: "Account", href: "/account" },
        { label: "Super Admin", href: "/super-admin" },
      ]}
      metrics={[
        { label: "Staff", value: "Scoped", hint: "Estate-level operator accounts", status: "ready" },
        { label: "Permissions", value: "Active", hint: "Shared Tier 1 permission foundation", tone: "good", status: "ready" },
        { label: "Integrations", value: "Pending", hint: "Provider credentials are shown as readiness states", tone: "pending", status: "pending" },
        { label: "Super Admin", value: "Guarded", hint: "Role-protected administration", tone: "warn", status: "ready" },
      ]}
      widgets={[
        { title: "Estate Staff", body: "Manage estate operators and staff account context through the account surface.", href: "/account?tab=staff", icon: Users, status: "Ready" },
        { title: "Roles & Permissions", body: "Permission visibility and action access remain connected to the shared foundation.", href: "/account?tab=permissions", icon: ShieldCheck, status: "Ready" },
        { title: "Estate Settings", body: "Estate account settings, notification preferences, profile controls and runtime defaults.", href: "/account?tab=settings", icon: Settings, status: "Ready" },
        { title: "Integrations", body: "Provider readiness for edge, cameras, WhatsApp, devices and storage belongs here.", href: "/account?tab=integrations", icon: PlugZap, status: "Pending Integration" },
        { title: "Super Admin", body: "Guarded cross-estate administration and audit operations.", href: "/super-admin", icon: KeyRound, status: "Ready" },
      ]}
      actions={[
        { label: "Open Account Settings", href: "/account" },
        { label: "Review Integrations", href: "/account?tab=integrations" },
        { label: "Open Super Admin", href: "/super-admin" },
      ]}
      activity={[
        "Facility Administration now has its own module landing page",
        "Account and super-admin routes remain the live action surfaces",
        "Admin-only visibility is controlled from the module registry",
      ]}
      insights={[
        "No Office-level admin modules are exposed here.",
        "Estate settings and integrations stay scoped to the facility runtime.",
      ]}
    />
  );
}
