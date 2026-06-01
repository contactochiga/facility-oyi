import ModuleDashboard from "@/components/modules/ModuleDashboard";
import { Building2, Home, Layers3, Users } from "lucide-react";

export default function EstateStructureModule() {
  return (
    <ModuleDashboard
      title="Estate Structure"
      subtitle="Facility structure dashboard for buildings, homes, units, rooms, spaces, occupants, zones and occupancy posture."
      eyebrow="Estate Runtime"
      tabs={[
        { label: "Dashboard", href: "/estate-structure" },
        { label: "Buildings", href: "/homes?view=buildings" },
        { label: "Homes & Units", href: "/homes" },
        { label: "Rooms & Spaces", href: "/homes?view=rooms" },
        { label: "Residents", href: "/occupancy" },
        { label: "Zones", href: "/digital-twin?mode=zones" },
      ]}
      metrics={[
        { label: "Homes / Units", value: "Live", hint: "Uses the existing estate-scoped homes registry", tone: "good", status: "live" },
        { label: "Buildings", value: "Grouped", hint: "Currently inferred from home/building records", status: "ready" },
        { label: "Rooms", value: "Scoped", hint: "Loaded per home/unit where available", status: "ready" },
        { label: "Operational Zones", value: "Pending", hint: "Utility/security/shared zones need pilot estate mapping", tone: "pending", status: "pending" },
      ]}
      widgets={[
        { title: "Homes & Units Registry", body: "Create, update and inspect estate homes/units with room expansion and meter identifiers.", href: "/homes", icon: Home, status: "Live" },
        { title: "Building View", body: "Building-level grouping remains connected through the homes and spaces registry.", href: "/homes?view=buildings", icon: Building2, status: "Ready" },
        { title: "Rooms & Spaces", body: "Rooms, floors, utility areas and shared spaces can be expanded from unit records.", href: "/homes?view=rooms", icon: Layers3, status: "Ready" },
        { title: "Resident Occupancy", body: "Resident and occupant state remains available through the occupancy module.", href: "/occupancy", icon: Users, status: "Ready" },
      ]}
      actions={[
        { label: "Open Homes Registry", href: "/homes" },
        { label: "View Occupancy", href: "/occupancy" },
        { label: "Add Building / Unit", href: "/homes?action=create" },
      ]}
      activity={[
        "Estate structure module now lands on its own dashboard",
        "Homes and rooms remain the current estate source of truth",
        "Zone mapping is intentionally marked pending until estate plan data is live",
      ]}
      insights={[
        "For the 120-unit pilot, building, unit, room and resident import completeness is the first structure checkpoint.",
        "Shared areas, utility zones and security zones should bind to Digital Twin layers after plan mapping.",
      ]}
    />
  );
}
