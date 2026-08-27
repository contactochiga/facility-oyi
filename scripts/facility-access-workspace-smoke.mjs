#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../app/(protected)/traffic/page.tsx", import.meta.url), "utf8");
const visitors = await readFile(new URL("../components/access/AccessVisitorsView.tsx", import.meta.url), "utf8");
const compatibility = await readFile(new URL("../app/(protected)/visitors/page.tsx", import.meta.url), "utf8");
const registry = await readFile(new URL("../lib/moduleRegistry.ts", import.meta.url), "utf8");
const mobile = await readFile(new URL("../components/navigation/mobileNavConfig.ts", import.meta.url), "utf8");

for (const source of ["visitorService.listToday", "visitorService.list", "facilityService.infrastructureOperations", "facility:realtime-event"]) assert.match(page, new RegExp(source.replaceAll(".", "\\.")));
for (const label of ["Visitors today", "Active visitors", "Pre-approved", "Access points", "Access events", "Attention", "Live Access Overview", "Upcoming Visits", "Gate Status", "Access Methods", "Gate Control", "Access Logs"]) assert.match(page, new RegExp(label));
for (const truthfulState of ["No access activity recorded.", "No upcoming visits.", "No access points configured.", "Access-method aggregation unavailable", "no canonical remote gate command is exposed"]) assert.match(page, new RegExp(truthfulState.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
assert.match(registry, /key: "traffic-mobility"[\s\S]*startsWith: \["\/traffic", "\/visitors"\]/);
const securityRegistryLine = registry.split("\n").find((line) => line.includes('key: "security-access"')) || "";
const securityMobileLine = mobile.split("\n").find((line) => line.includes('key: "security-access"')) || "";
assert.doesNotMatch(securityRegistryLine, /"\/visitors"/);
assert.match(mobile, /key: "traffic-mobility"[\s\S]*activeRoutes: \["\/traffic", "\/visitors"\]/);
assert.doesNotMatch(securityMobileLine, /"\/visitors"/);
assert.doesNotMatch(page, />Add Visitor</);
assert.doesNotMatch(page, />Open Gate</);
assert.doesNotMatch(page, /Calorie Block|Main Gate|Pedestrian Gate|RFID Card/);
assert.match(page, /AccessVisitorsView/);
assert.match(page, /activateTab\("visitors"\)/);
assert.match(page, /setVerifyOpen\(true\)/);
assert.match(page, /view=visitors/);
assert.doesNotMatch(page, /href="\/visitors"/);
assert.doesNotMatch(page, /RefreshCw|>Refresh</);
assert.match(compatibility, /redirect\("\/traffic\?view=visitors"\)/);
for (const source of ["visitorService.list", "visitorService.verify", "visitorService.timeline", "visitorService.updateStatus", "visitorService.exportReport", "facility:realtime-event"]) assert.match(visitors, new RegExp(source.replaceAll(".", "\\.")));
for (const label of ["Visitor approvals, access lifecycle and visit history", "Visitor Registry", "Verify Visitor", "Visitors today", "Pending", "Approved", "Entered", "Exited", "Attention", "Export"]) assert.match(visitors, new RegExp(label));
assert.match(visitors, /OisDrawer/);
assert.match(visitors, /aria-modal="true"/);
assert.doesNotMatch(visitors, /Lockdown|visitorService\.lockdown/);
console.log("Facility Access workspace smoke passed.");
