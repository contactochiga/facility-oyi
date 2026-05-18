import ModuleDashboard from "@/components/modules/ModuleDashboard";
import { Activity, BarChart3, Brain, FileText } from "lucide-react";

export default function FacilityIntelligenceModule() {
  return (
    <ModuleDashboard
      title="Facility Intelligence"
      subtitle="Estate analytics, AI operations, audit activity, infrastructure reports, diagnostics and operational intelligence."
      eyebrow="Intelligence Layer"
      tabs={[
        { label: "Dashboard", href: "/facility-intelligence" },
        { label: "Analytics", href: "/overview?tab=analytics" },
        { label: "AI Operations", href: "/overview?tab=ai" },
        { label: "Audit & Activity", href: "/super-admin?tab=audit" },
        { label: "Reports", href: "/overview?tab=reports" },
      ]}
      metrics={[
        { label: "Analytics", value: "Live", hint: "Overview + module signals", tone: "good" },
        { label: "AI Ops", value: "Ready", hint: "Estate-scoped execution lane" },
        { label: "Audit", value: "Tracked", hint: "Super admin audit trail" },
        { label: "Diagnostics", value: "Online", hint: "Health and activity signals" },
      ]}
      widgets={[
        { title: "Analytics", body: "Use overview and module charts for estate performance and operational trend summaries.", href: "/overview", icon: BarChart3 },
        { title: "AI Operations", body: "Facility-level AI activity and future voice command permissions sit under this module.", href: "/overview?tab=ai", icon: Brain },
        { title: "Audit & Activity", body: "Super admin activity, audit logs and operational events remain in the guarded admin surface.", href: "/super-admin?tab=audit", icon: Activity },
        { title: "Reports", body: "Infrastructure reports collect from devices, utilities, visitors, support and wallets.", href: "/overview?tab=reports", icon: FileText },
      ]}
      actions={[
        { label: "Open Overview Analytics", href: "/overview" },
        { label: "Open Audit View", href: "/super-admin?tab=audit" },
        { label: "Open Device Reports", href: "/devices?tab=reports" },
      ]}
      activity={["Facility intelligence route now lands on a real module dashboard", "Reports and diagnostics route to active live surfaces", "Audit is kept behind administration permissions"]}
      insights={["This module is estate-scoped and does not expose Office-level intelligence.", "Future predictive intelligence can attach here without sidebar changes."]}
    />
  );
}
