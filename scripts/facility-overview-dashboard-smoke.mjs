import fs from "node:fs";
import assert from "node:assert/strict";
const page=fs.readFileSync("app/(protected)/overview/page.tsx","utf8");
const view=fs.readFileSync("components/overview/FacilityOverviewDashboard.tsx","utf8");
const registry=fs.readFileSync("lib/moduleRegistry.ts","utf8");
const greeting=fs.readFileSync("lib/contextualGreeting.ts","utf8");
assert.match(page,/FacilityOverviewDashboard/);
for(const contract of ["infrastructureOperations","platformTwin","inventoryByEstate","loadFacilityAttention","utilityService.summary","facility:realtime-event"]) assert.match(page,new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
for(const mode of ["Operations","Twin","Cameras","Occupancy","Infrastructure"]) assert.match(view,new RegExp(`\\"${mode}\\"`));
for(const state of ["Digital Twin not configured","No cameras connected","No infrastructure connected","Operational history will appear as telemetry accumulates"]) assert.ok(view.includes(state));
assert.doesNotMatch(view,/rtsp:\/\/|snapshot_url|storage_key|mock cameras|fake event/i);
assert.doesNotMatch(page,/rtsp:\/\/|supabase.*storage|\/cameras\/scan/i);
assert.match(view,/grid-cols-2/);
assert.match(view,/xl:grid-cols/);
const routes={
  "Manage buildings":"/estate-structure",
  "Camera Center":"/cameras",
  "Maintenance":"/maintenance",
  "Manage access":"/traffic",
  "Utilities":"/services",
  "Digital Twin":"/digital-twin",
};
for(const [label,route] of Object.entries(routes)) {
  assert.ok(view.includes(`\"${route}\",\"${label}\"`),`${label} must use ${route}`);
  assert.ok(fs.existsSync(`app/(protected)${route}/page.tsx`),`${route} must resolve to a protected page`);
}
assert.doesNotMatch(view,/\"\/(buildings|access|assets|utilities)\"/);
assert.match(view,/focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/);
assert.doesNotMatch(view,/border-white\/(?:10|20|25|30|40|50|60|70|80|90|100)|border-dashed/);
assert.match(registry,/label: "Buildings", href: "\/estate-structure"/);
assert.match(registry,/label: "Access", href: "\/traffic"/);
assert.match(page,/getContextualGreeting\(\)/);
assert.match(page,/member\?\.name\|\|String\(\(context as any\)\?\.estate\?\.name/);
assert.match(page,/facilityName\.trim\(\)\|\|"your facility"/);
assert.match(page,/Here’s what needs your attention across the facility today\./);
assert.doesNotMatch(page,/facilityName\?`\$\{data\.facilityName\} operations`|Estate operations are stable|Green Smart Estate/i);
assert.match(greeting,/hour < 12.*Good morning/s);
assert.match(greeting,/hour < 17.*Good afternoon/s);
assert.match(greeting,/Good evening/);
console.log("Facility Overview dashboard smoke passed.");
