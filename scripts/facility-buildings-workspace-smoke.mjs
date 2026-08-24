#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workspace = await readFile(new URL("../components/buildings/FacilityStructureWorkspace.tsx", import.meta.url), "utf8");
const live = await readFile(new URL("../app/(protected)/live-infrastructure/page.tsx", import.meta.url), "utf8");
const twin = await readFile(new URL("../app/(protected)/digital-twin/page.tsx", import.meta.url), "utf8");
const modules = await readFile(new URL("../lib/moduleRegistry.ts", import.meta.url), "utf8");
const mobile = await readFile(new URL("../components/navigation/mobileNavConfig.ts", import.meta.url), "utf8");
const service = await readFile(new URL("../services/facilityService.ts", import.meta.url), "utf8");
const infrastructureDrawer = await readFile(new URL("../components/modules/InfrastructureDetailDrawer.tsx", import.meta.url), "utf8");

assert.doesNotMatch(modules, /label: "Live"/);
assert.doesNotMatch(mobile, /label: "Live"/);
assert.match(live, /redirect\("\/digital-twin"\)/);
assert.match(infrastructureDrawer, /posture\?\.route \|\| "\/hardware-devices"/);

for (const source of ["infrastructureOperations", "platformTwin", "platformUtilityTelemetry", "platformIncidents", "platformEdgeHistory", "platformCameraInfrastructure"]) {
  assert.match(twin, new RegExp(`facilityService\\.${source}\\(`));
}
for (const route of ["/hardware-devices", "/cameras", "/alerts", "/services", "/maintenance"]) assert.match(twin, new RegExp(route));

for (const contract of ["estateStructure", "createBuilding", "createHome", "updateHome", "listRooms", "listEstateUsers"]) assert.match(workspace, new RegExp(`facilityService\\.${contract}\\(`));
assert.match(workspace, /home\.building_id/);
assert.match(workspace, /Standalone \/ property-level Homes/);
assert.match(workspace, /No artificial Building relationship/);
assert.match(workspace, /data-building-row/);
assert.match(workspace, /data-floor-row/);
assert.match(workspace, /data-home-row/);
assert.match(workspace, /setOpenBuildings/);
assert.match(workspace, /setOpenFloors/);
assert.match(workspace, /setOpenHome/);
assert.match(workspace, /serviceBindings\(form\)/);
for (const binding of ["utility_token", "water_service", "gas_service", "internet_service", "service_charge", "other_facility_fees"]) assert.match(workspace, new RegExp(binding));
for (const action of ["Manage Access", "View Rooms", "View Services", "Invite Resident", "Room Registry", "Occupancy", "Home Registry"]) assert.match(workspace, new RegExp(action));
assert.match(workspace, /facility:realtime-event/);
assert.doesNotMatch(workspace, /Green Smart Estate|John Doe|Calorie Block|Unit 5B/);
assert.doesNotMatch(workspace, /const\s+(?:homes|buildings|residents)\s*=\s*\[[^\]]+\]/s);

for (const route of ["/facility/estate-structure", "/facility/buildings", "/facility/homes"]) assert.ok(service.includes(route));
assert.ok(service.includes("`/facility/homes/${homeId}/rooms`"));

console.log("Facility Buildings workspace smoke passed.");
