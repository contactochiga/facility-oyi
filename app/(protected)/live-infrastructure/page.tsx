import ModuleDashboard from "@/components/modules/ModuleDashboard";
import { Camera, Layers3, MapPinned, RadioTower } from "lucide-react";

export default function LiveInfrastructureModule() {
  return (
    <ModuleDashboard
      title="Live Infrastructure"
      subtitle="Estate-scoped operational viewport for maps, digital twin, heat maps, layers, cameras, devices, alerts and edge heartbeat."
      eyebrow="Facility Command"
      tabs={[
        { label: "Dashboard", href: "/live-infrastructure" },
        { label: "Map", href: "/digital-twin?mode=map" },
        { label: "3D Twin", href: "/digital-twin?mode=3d" },
        { label: "Heat Maps", href: "/digital-twin?mode=heat" },
        { label: "Layers", href: "/digital-twin?mode=layers" },
      ]}
      metrics={[
        { label: "Twin View", value: "Live", hint: "Digital estate model", tone: "good" },
        { label: "Layer Groups", value: 5, hint: "Devices, cameras, visitors, maintenance, utilities" },
        { label: "Map State", value: "Ready", hint: "Coordinate-aware canvas" },
        { label: "Edge Signal", value: "Sync", hint: "Heartbeat event bridge", tone: "warn" },
      ]}
      widgets={[
        { title: "Operational Canvas", body: "Open the live map/twin canvas with selectable objects, infrastructure layers and estate overlays.", href: "/digital-twin", icon: MapPinned },
        { title: "Camera Surface", body: "Review estate camera feeds, AI event overlays and surveillance readiness.", href: "/cameras", icon: Camera },
        { title: "Infrastructure Layers", body: "Toggle devices, alerts, access, utilities and maintenance overlays from the twin surface.", href: "/digital-twin?mode=layers", icon: Layers3 },
        { title: "Edge Agents", body: "Track local infrastructure sync, heartbeat posture and device command bridge readiness.", href: "/devices?tab=edge", icon: RadioTower },
      ]}
      actions={[
        { label: "Open Digital Twin", href: "/digital-twin" },
        { label: "View Cameras", href: "/cameras" },
        { label: "Review Alerts", href: "/alerts" },
        { label: "Device Registry", href: "/devices" },
      ]}
      activity={["Twin canvas ready for estate layer sync", "Camera and device overlays route into live infrastructure", "Alerts and visitors can be inspected from related modules"]}
      insights={["The live infrastructure route now owns this module instead of redirecting silently.", "Existing Digital Twin remains the operational deep view."]}
    />
  );
}
