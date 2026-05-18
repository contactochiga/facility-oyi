import ModuleDashboard from "@/components/modules/ModuleDashboard";
import { Camera, DoorOpen, ShieldAlert, UserCheck } from "lucide-react";

export default function SecurityAccessModule() {
  return (
    <ModuleDashboard
      title="Security & Access"
      subtitle="Estate security dashboard for visitors, gates, cameras, access control, incidents and emergency response."
      eyebrow="Safety Runtime"
      tabs={[
        { label: "Dashboard", href: "/security-access" },
        { label: "Visitors & Access", href: "/visitors" },
        { label: "Cameras", href: "/cameras" },
        { label: "Security", href: "/security" },
        { label: "Incidents", href: "/alerts" },
      ]}
      metrics={[
        { label: "Visitor Flow", value: "Live", hint: "Today and active access", tone: "good" },
        { label: "Cameras", value: "Linked", hint: "ONVIF and bound feeds" },
        { label: "Access Control", value: "Guarded", hint: "Gate and lock actions", tone: "warn" },
        { label: "Incidents", value: "Routed", hint: "Alerts module" },
      ]}
      widgets={[
        { title: "Visitors & Gate Access", body: "Approve, inspect and track visitor entry/exit events.", href: "/visitors", icon: UserCheck },
        { title: "Camera Surveillance", body: "Monitor bound cameras, AI detection settings and camera events.", href: "/cameras", icon: Camera },
        { title: "Security Dashboard", body: "Open the existing security module for estate safety posture.", href: "/security", icon: ShieldAlert },
        { title: "Access Events", body: "Review gate incidents and alert-driven access events.", href: "/alerts", icon: DoorOpen },
      ]}
      actions={[
        { label: "Open Visitors", href: "/visitors" },
        { label: "Open Cameras", href: "/cameras" },
        { label: "Review Incidents", href: "/alerts" },
      ]}
      activity={["Security & Access now owns the safety module route", "Visitor and camera pages remain the live deep modules", "Incidents route safely to Alerts"]}
      insights={["Security actions should remain gated by visitors/manage and cameras/view permissions.", "Emergency operations can be added here without changing sidebar structure."]}
    />
  );
}
