import ModuleDashboard from "@/components/modules/ModuleDashboard";
import { Cpu, RadioTower, Radar, SlidersHorizontal } from "lucide-react";

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
      ]}
      metrics={[
        { label: "Registry", value: "Live", hint: "Existing device table", tone: "good" },
        { label: "Discovery", value: "Ready", hint: "Tuya, SSDP, ONVIF lanes" },
        { label: "Control", value: "Guarded", hint: "Permission-aware actions", tone: "warn" },
        { label: "Telemetry", value: "Online", hint: "Status and category state" },
      ]}
      widgets={[
        { title: "Device Registry", body: "Infrastructure-focused categories and action menus remain in the existing live device module.", href: "/devices", icon: Cpu },
        { title: "Device Discovery", body: "Import and discovery flows route through the device orchestration page.", href: "/devices?tab=discovery", icon: Radar },
        { title: "Device Control", body: "Control commands, assignment state and reset history stay under guarded device actions.", href: "/devices?tab=control", icon: SlidersHorizontal },
        { title: "Edge Infrastructure", body: "Edge agent state and local sync readiness are part of hardware orchestration.", href: "/devices?tab=edge", icon: RadioTower },
      ]}
      actions={[
        { label: "Open Device Registry", href: "/devices" },
        { label: "Import Devices", href: "/devices?action=import" },
        { label: "Discover Edge Devices", href: "/devices?tab=discovery" },
      ]}
      activity={["Hardware devices now has its own module landing route", "Device deep sections route to the existing live device page", "Edge and telemetry surfaces are ready for expanded tab handling"]}
      insights={["Primary categories are infrastructure-focused instead of generic light/switch buckets.", "Command controls remain permission-sensitive at the action layer."]}
    />
  );
}
