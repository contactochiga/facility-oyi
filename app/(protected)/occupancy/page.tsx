// Messages + Buildings/Home Registry consolidation pass.
//
// This route duplicated FacilityStructureWorkspace's own "Occupancy"
// panel exactly -- same estate-structure-backed data call, same
// Home | Occupancy | Active members | Invited | Suspended | Action
// table, same "Review access" link into /homes/[homeId]/users. Redirects
// to the canonical Buildings workspace with ?panel=occupancy, which
// FacilityStructureWorkspace reads on mount to open the equivalent
// occupancy panel automatically -- the closest honest behavioral match,
// not just a bare redirect to the module root.
import { redirect } from "next/navigation";

export default function OccupancyPage() {
  redirect("/estate-structure?panel=occupancy");
}
