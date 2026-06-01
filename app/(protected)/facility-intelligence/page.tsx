import ModuleDashboard from "@/components/modules/ModuleDashboard";
import { Activity, BarChart3, Brain, FileText, Stethoscope } from "lucide-react";

export default function FacilityIntelligenceModule() {
  return (
    <ModuleDashboard
      title="Facility Intelligence"
      subtitle="Estate analytics, AI-assisted operations, audit activity, infrastructure reports, diagnostics and operational intelligence."
      eyebrow="Intelligence Layer"
      tabs={[
        { label: "Dashboard", href: "/facility-intelligence" },
        { label: "Analytics", href: "/overview?tab=analytics" },
        { label: "AI Operations", href: "/overview?tab=ai" },
        { label: "Audit & Activity", href: "/super-admin?tab=audit" },
        { label: "Reports", href: "/overview?tab=reports" },
        { label: "Diagnostics", href: "/facility-intelligence?tab=diagnostics" },
      ]}
      metrics={[
        { label: "Infrastructure Score", value: "Pending", hint: "Requires stable incident, device, utility and edge telemetry", tone: "pending", status: "pending" },
        { label: "Device Trends", value: "Ready", hint: "Routes through hardware/device signals", status: "ready" },
        { label: "Maintenance Trends", value: "Ready", hint: "Uses existing work-order and ticket surfaces", status: "ready" },
        { label: "Visitor Trends", value: "Ready", hint: "Uses access and traffic activity", status: "ready" },
      ]}
      widgets={[
        { title: "Operational Analytics", body: "Use overview and module charts for estate performance, visitor, utility and support trend summaries.", href: "/overview", icon: BarChart3, status: "Ready" },
        { title: "AI Operations", body: "Facility-level AI activity and future voice command permissions sit under this module.", href: "/overview?tab=ai", icon: Brain, status: "Pending Integration" },
        { title: "Audit & Activity", body: "Super admin activity, audit logs and operational events remain in the guarded admin surface.", href: "/super-admin?tab=audit", icon: Activity, status: "Ready" },
        { title: "Infrastructure Reports", body: "Reports collect from devices, utilities, visitors, maintenance, wallets and alerts.", href: "/overview?tab=reports", icon: FileText, status: "Ready" },
        { title: "Diagnostics", body: "Health diagnostics will score incidents, device posture, utility state and edge sync quality.", href: "/facility-intelligence?tab=diagnostics", icon: Stethoscope, status: "Pending Integration" },
      ]}
      actions={[
        { label: "Open Overview Analytics", href: "/overview" },
        { label: "Open Audit View", href: "/super-admin?tab=audit" },
        { label: "Open Device Reports", href: "/devices?tab=reports" },
        { label: "Run Predictive Diagnostic", disabled: true, pendingLabel: "Pending Telemetry" },
      ]}
      activity={[
        "Facility intelligence route now lands on a real module dashboard",
        "Reports and diagnostics route to active live surfaces or clear pending states",
        "Predictive scoring waits for pilot production telemetry volume",
      ]}
      insights={[
        "This module is estate-scoped and does not expose Office-level intelligence.",
        "The next production step is binding incident trends, utility trends, device health and edge health into one score.",
      ]}
    />
  );
}
