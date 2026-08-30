// Messages + Buildings/Home Registry consolidation pass.
//
// This route used to render a full, independent Home registry (its own
// listHomes-backed data fetching, its own Add/Edit Home modal, its own
// room/access drill-down links) that duplicated the
// canonical Buildings experience at /estate-structure
// (components/buildings/FacilityStructureWorkspace.tsx) -- same data,
// same mutations, older UI. Facility Structure already fully supersedes
// this page's listing/creation/editing functionality, and already links
// out to the real, still-needed per-home detail routes
// (/homes/[homeId]/users, /homes/[homeId]/rooms -- untouched by this
// change, still canonical) for advanced member/room management.
//
// Server-side redirect, not a deleted route: old bookmarks and any
// remaining internal `/homes` links (e.g. a generic "Facility scope"
// inspect action in Facility Administration) land safely in the one
// canonical Buildings experience instead of 404ing or rendering a
// second, stale registry.
import { redirect } from "next/navigation";

export default function HomesPage() {
  redirect("/estate-structure");
}
