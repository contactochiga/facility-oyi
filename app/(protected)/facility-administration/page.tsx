import ModuleDashboard from "@/components/modules/ModuleDashboard";
import { KeyRound, Settings, ShieldCheck, Users } from "lucide-react";

export default function FacilityAdministrationModule() {
  return (
    <ModuleDashboard
      title="Facility Administration"
      subtitle="Estate staff, roles, permissions, estate settings, integrations, account controls and super-admin operations."
      eyebrow="Authority Layer"
      tabs={[
        { label: "Dashboard", href: "/facility-administration" },
        { label: "Estate Staff", href: "/account?tab=staff" },
        { label: "Roles & Permissions", href: "/account?tab=permissions" },
        { label: "Estate Settings", href: "/account?tab=settings" },
        { label: "Integrations", href: "/account?tab=integrations" },
        { label: "Super Admin", href: "/super-admin" },
      ]}
      metrics={[
        { label: "Staff", value: "Scoped", hint: "Estate-level accounts" },
        { label: "Permissions", value: "Active", hint: "Tier 1 foundation", tone: "good" },
        { label: "Settings", value: "Ready", hint: "Account route" },
        { label: "Super Admin", value: "Guarded", hint: "Role-protected", tone: "warn" },
      ]}
      widgets={[
        { title: "Estate Staff", body: "Manage estate operators and staff account context through the account surface.", href: "/account?tab=staff", icon: Users },
        { title: "Roles & Permissions", body: "Permission visibility and action access remain connected to the shared foundation.", href: "/account?tab=permissions", icon: ShieldCheck },
        { title: "Estate Settings", body: "Estate account settings, notification preferences and profile controls.", href: "/account?tab=settings", icon: Settings },
        { title: "Super Admin", body: "Guarded cross-estate administration and audit operations.", href: "/super-admin", icon: KeyRound },
      ]}
      actions={[
        { label: "Open Account Settings", href: "/account" },
        { label: "Open Super Admin", href: "/super-admin" },
        { label: "Review Integrations", href: "/account?tab=integrations" },
      ]}
      activity={["Facility Administration now has its own module landing page", "Account and super-admin routes remain the live action surfaces", "Admin-only visibility is controlled from the module registry"]}
      insights={["No Office-level admin modules are exposed here.", "Estate settings and integrations stay scoped to the facility runtime."]}
    />
  );
}
