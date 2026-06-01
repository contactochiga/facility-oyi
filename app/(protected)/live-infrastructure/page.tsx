import ModuleDashboard from "@/components/modules/ModuleDashboard";
import { Camera, Layers3, MapPinned, RadioTower } from "lucide-react";

export default function LiveInfrastructureModule() {
  return (
    <ModuleDashboard
      title="Live Infrastructure"
      subtitle="Estate-scoped operational viewport for map, digital twin, cameras, devices, alerts, filters and edge heartbeat readiness."
      eyebrow="Facility Command"
      tabs={[
        { label: "Dashboard", href: "/live-infrastructure" },
        { label: "Map", href: "/digital-twin?mode=map" },
        { label: "3D Twin", href: "/digital-twin?mode=3d" },
        { label: "Hybrid", href: "/digital-twin?mode=hybrid" },
        { label: "Heat Maps", href: "/digital-twin?mode=heat" },
        { label: "Layers", href: "/digital-twin?mode=layers" },
      ]}
      metrics={[
        { label: "Map Canvas", value: "Ready", hint: "Estate markers and infrastructure overlays route to the twin canvas", tone: "good", status: "ready" },
        { label: "3D Twin", value: "Pending", hint: "Integrated mode is available; true live twin binding remains a later backend source", tone: "pending", status: "pending" },
        { label: "Camera Overlay", value: "Linked", hint: "Uses existing camera and surveillance routes", tone: "neutral", status: "ready" },
        { label: "Edge Signal", value: "Pending", hint: "Requires live edge heartbeat events for the pilot estate", tone: "warn", status: "pending" },
      ]}
      widgets={[
        { title: "Operational Canvas", body: "Open the estate map/twin canvas with selectable objects, infrastructure layers and estate overlays.", href: "/digital-twin", icon: MapPinned, status: "Ready" },
        { title: "Camera Surface", body: "Review estate camera feeds, AI event overlays, stream state and surveillance readiness.", href: "/cameras", icon: Camera, status: "Ready" },
        { title: "Infrastructure Layers", body: "Toggle devices, alerts, access, utilities, maintenance and visitor movement overlays from the twin surface.", href: "/digital-twin?mode=layers", icon: Layers3, status: "Pending Integration" },
        { title: "Edge Agents", body: "Track local infrastructure sync, heartbeat posture and device command bridge readiness.", href: "/devices?tab=edge", icon: RadioTower, status: "Pending Integration" },
      ]}
      actions={[
        { label: "Open Digital Twin", href: "/digital-twin" },
        { label: "View Cameras", href: "/cameras" },
        { label: "Review Alerts", href: "/alerts" },
        { label: "Device Registry", href: "/devices" },
      ]}
      activity={[
        "Live infrastructure shell is stable for map, twin, hybrid and heat-map modes",
        "Camera and device overlays route into existing live facility modules",
        "Realtime overlay intensity waits for device.status.updated and edge.heartbeat volume",
      ]}
      insights={[
        "Digital Twin is presented as a Facility infrastructure mode, not a standalone product surface.",
        "No fake heat-map counts are shown until pilot estate telemetry starts flowing.",
      ]}
    />
  );
}
