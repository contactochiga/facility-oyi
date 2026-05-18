import ModuleDashboard from "@/components/modules/ModuleDashboard";
import { Building2, Home, Layers3, Users } from "lucide-react";

export default function EstateStructureModule() {
  return (
    <ModuleDashboard
      title="Estate Structure"
      subtitle="Facility structure dashboard for buildings, homes, units, rooms, spaces, occupants and occupancy posture."
      eyebrow="Estate Runtime"
      tabs={[
        { label: "Dashboard", href: "/estate-structure" },
        { label: "Buildings", href: "/homes?view=buildings" },
        { label: "Homes & Units", href: "/homes" },
        { label: "Rooms & Spaces", href: "/homes?view=rooms" },
        { label: "Residents", href: "/occupancy" },
      ]}
      metrics={[
        { label: "Homes / Units", value: "Live", hint: "Synced from facility records", tone: "good" },
        { label: "Rooms", value: "Scoped", hint: "Loaded per home" },
        { label: "Occupancy", value: "Active", hint: "Resident context" },
        { label: "Structure Health", value: "Ready", hint: "Estate hierarchy aligned" },
      ]}
      widgets={[
        { title: "Homes & Units Registry", body: "Create, update and inspect estate homes/units with room expansion and meter identifiers.", href: "/homes", icon: Home },
        { title: "Building View", body: "Building-level grouping remains connected through the homes and spaces registry.", href: "/homes?view=buildings", icon: Building2 },
        { title: "Rooms & Spaces", body: "Rooms, floors, utility areas and shared spaces can be expanded from the unit record.", href: "/homes?view=rooms", icon: Layers3 },
        { title: "Resident Occupancy", body: "Resident and occupant state remains available through the occupancy module.", href: "/occupancy", icon: Users },
      ]}
      actions={[
        { label: "Open Homes Registry", href: "/homes" },
        { label: "View Occupancy", href: "/occupancy" },
        { label: "Add Building / Unit", href: "/homes?action=create" },
      ]}
      activity={["Estate structure module now lands on its own dashboard", "Homes and rooms remain the source of truth", "Occupancy routes into the estate-scoped people layer"]}
      insights={["Buildings are not separated from estate structure until live building records are available.", "Room and space expansion is preserved inside the existing Homes module."]}
    />
  );
}
