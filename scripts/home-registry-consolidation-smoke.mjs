#!/usr/bin/env node
// Buildings/Home Registry consolidation. Static regression proof that
// the old duplicate registry routes are real server-side redirects (not
// deleted, not left as a second live UI), and that the still-needed
// per-home detail sub-routes were left untouched.
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";

const homesRoot = await readFile(new URL("../app/(protected)/homes/page.tsx", import.meta.url), "utf8");
const occupancy = await readFile(new URL("../app/(protected)/occupancy/page.tsx", import.meta.url), "utf8");

assert.match(homesRoot, /redirect\("\/estate-structure"\)/);
assert.doesNotMatch(homesRoot, /facilityService\.(listHomes|createHome|updateHome)\(/, "the old duplicate Home registry data-fetching/mutation logic must be gone, not just hidden");
assert.doesNotMatch(homesRoot, /"use client"/, "a server-side redirect does not need client hooks");

assert.match(occupancy, /redirect\("\/estate-structure\?panel=occupancy"\)/);
assert.doesNotMatch(occupancy, /facilityService\.estateStructure\(/, "the old duplicate Occupancy table-fetching logic must be gone, not just hidden");

// The still-canonical per-home detail routes must remain real,
// functioning pages -- FacilityStructureWorkspace links into them for
// advanced member/room management and does not reimplement them inline.
for (const path of ["../app/(protected)/homes/[homeId]/users/page.tsx", "../app/(protected)/homes/[homeId]/rooms/page.tsx"]) {
  await access(new URL(path, import.meta.url));
}

console.log("Home Registry consolidation smoke passed.");
