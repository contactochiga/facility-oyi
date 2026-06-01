import ModuleDashboard from "@/components/modules/ModuleDashboard";
import { Camera, DoorOpen, ShieldAlert, UserCheck } from "lucide-react";

export default function SecurityAccessModule() {
  return (
    <ModuleDashboard
      title="Security & Access"
      subtitle="Estate security dashboard for visitors, gates, cameras, access control, incidents, AI detection summaries and emergency response."
      eyebrow="Safety Runtime"
      tabs={[
        { label: "Dashboard", href: "/security-access" },
        { label: "Visitors & Access", href: "/visitors" },
        { label: "Cameras", href: "/cameras" },
        { label: "Security", href: "/security" },
        { label: "Incidents", href: "/alerts" },
        { label: "Emergency", href: "/alerts?type=emergency" },
      ]}
      metrics={[
        { label: "Visitor Flow", value: "Live", hint: "Today and active access events", tone: "good", status: "live" },
        { label: "Cameras", value: "Linked", hint: "Bound feeds and stream state", status: "ready" },
        { label: "Access Control", value: "Guarded", hint: "Gate and lock actions require permission", tone: "warn", status: "ready" },
        { label: "AI Detection", value: "Pending", hint: "Needs active camera analytics provider", tone: "pending", status: "pending" },
      ]}
      widgets={[
        { title: "Visitors & Gate Access", body: "Approve, inspect and track visitor entry/exit events for the active estate.", href: "/visitors", icon: UserCheck, status: "Live" },
        { title: "Camera Surveillance", body: "Monitor bound cameras, stream state, AI settings and camera events.", href: "/cameras", icon: Camera, status: "Ready" },
        { title: "Security Dashboard", body: "Open the existing security module for safety posture, alerts and incident response.", href: "/security", icon: ShieldAlert, status: "Ready" },
        { title: "Access Events", body: "Review gate incidents, forced-open alerts and emergency access events.", href: "/alerts", icon: DoorOpen, status: "Ready" },
      ]}
      actions={[
        { label: "Open Visitors", href: "/visitors" },
        { label: "Open Cameras", href: "/cameras" },
        { label: "Review Incidents", href: "/alerts" },
        { label: "AI Detection Provider", disabled: true, pendingLabel: "Pending Integration" },
      ]}
      activity={[
        "Security & Access now owns the safety module route",
        "Visitor and camera pages remain the live deep modules",
        "AI detection is clearly pending until camera analytics is connected",
      ]}
      insights={[
        "Security actions should remain gated by visitors/manage and cameras/view permissions.",
        "The 120-unit pilot needs camera stream health, gate event intake and incident escalation tested end-to-end.",
      ]}
    />
  );
}
