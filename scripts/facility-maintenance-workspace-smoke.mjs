#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../app/(protected)/maintenance/page.tsx", import.meta.url), "utf8");
const service = await readFile(new URL("../services/maintenanceService.ts", import.meta.url), "utf8");

for (const label of ["Overview", "Work Orders", "Preventive Maintenance", "Schedules", "Assets", "Technicians", "Parts & Inventory", "Reports"]) assert.match(page, new RegExp(label));
for (const metric of ["Open work orders", "In progress", "Due today", "Overdue", "Assets under maintenance", "MTTR"]) assert.match(page, new RegExp(metric, "i"));
for (const section of ["Work Order Overview", "Work Orders by Priority", "Work Orders Trend", "Recent Work Orders", "Priority Breakdown", "Quick Actions", "Assets Health Overview"]) assert.match(page, new RegExp(section));
for (const source of ["maintenanceService.list", "maintenanceService.create", "maintenanceService.update", "maintenanceService.timeline", "facilityService.infrastructureOperations", "facilityService.listEstateUsers", "facility:realtime-event"]) assert.match(page, new RegExp(source.replaceAll(".", "\\.")));
assert.match(service, /API\.post\("\/maintenance"/);
assert.match(page, /No demo records are shown/);
assert.match(page, /does not expose a canonical parts/);
assert.match(page, /Recurring preventive-maintenance plans are not exposed/);
assert.doesNotMatch(page, /Generator 02|Lift 01|Water pump runtime|WO-2025|John Brown|Sarah Ahmed/);
assert.doesNotMatch(page, /setInterval|RefreshCw|>Refresh</);
console.log("Facility Maintenance workspace smoke passed.");
