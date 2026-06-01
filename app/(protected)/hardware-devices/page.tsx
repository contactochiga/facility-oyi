import ModuleDashboard from "@/components/modules/ModuleDashboard";
import { Camera, Cpu, RadioTower, Radar, SlidersHorizontal } from "lucide-react";

export default function HardwareDevicesModule() {
  return (
    <ModuleDashboard
      title="Hardware Devices"
      subtitle="Estate hardware orchestration center for registry, discovery, control, telemetry, edge agents, reports and integrations."
      eyebrow="Device Runtime"
      tabs={[
        { label: "Dashboard", href: "/hardware-devices" },
        { label: "Registry", href: "/devices" },
        { label: "Discovery", href: "/devices?tab=discovery" },
        { label: "Control", href: "/devices?tab=control" },
        { label: "Telemetry", href: "/devices?tab=telemetry" },
        { label: "Edge Agents", href: "/devices?tab=edge" },
        { label: "Reports", href: "/devices?tab=reports" },
        { label: "Integrations", href: "/devices?tab=integrations" },
      ]}
      metrics={[
        { label: "Registry", value: "Live", hint: "Existing estate device table and action menus", tone: "good", status: "live" },
        { label: "Discovery", value: "Ready", hint: "Tuya, SSDP and ONVIF lanes route safely", status: "ready" },
        { label: "Control", value: "Guarded", hint: "Commands remain permission-aware", tone: "warn", status: "ready" },
        { label: "Telemetry", value: "Pending", hint: "Needs pilot device heartbeat volume", tone: "pending", status: "pending" },
      ]}
      widgets={[
        { title: "Device Registry", body: "Infrastructure categories: Security & Access, Cameras, Environment, Utilities, Traffic, Comfort, Lighting, Meters, Edge and Smart Home.", href: "/devices", icon: Cpu, status: "Live" },
        { title: "Device Discovery", body: "Import, scan and discovery flows route through the device orchestration page.", href: "/devices?tab=discovery", icon: Radar, status: "Ready" },
        { title: "Device Control", body: "Control commands, assignment state and reset history stay under guarded device actions.", href: "/devices?tab=control", icon: SlidersHorizontal, status: "Ready" },
        { title: "Camera Hardware", body: "Camera and surveillance hardware remains visible through the security camera module.", href: "/cameras", icon: Camera, status: "Ready" },
        { title: "Edge Infrastructure", body: "Edge agent state and local sync readiness are part of hardware orchestration.", href: "/devices?tab=edge", icon: RadioTower, status: "Pending Integration" },
      ]}
      actions={[
        { label: "Open Device Registry", href: "/devices" },
        { label: "Import Devices", href: "/devices?action=import" },
        { label: "Discover Edge Devices", href: "/devices?tab=discovery" },
      ]}
      activity={[
        "Hardware devices now has a dedicated module landing route",
        "Device deep sections route to the existing live device page",
        "Pilot readiness depends on provider credentials and edge heartbeat events",
      ]}
      insights={[
        "Primary categories are infrastructure-focused instead of generic light/switch buckets.",
        "Device cards should show provider, location, last heartbeat, last event, edge node and sync state where records exist.",
      ]}
    />
  );
}
