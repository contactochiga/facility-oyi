#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const objectContextSource = await readFile(new URL("../services/operationalObjectContext.ts", import.meta.url), "utf8");
const oyiServiceSource = await readFile(new URL("../services/oyiService.ts", import.meta.url), "utf8");
const realtimeSource = await readFile(new URL("../services/facilityRealtime.ts", import.meta.url), "utf8");
const launcherSource = await readFile(new URL("../components/shell/FacilityContextualOyiButton.tsx", import.meta.url), "utf8");
const topbarSource = await readFile(new URL("../components/shell/ShellTopbar.tsx", import.meta.url), "utf8");
const infrastructureDrawerSource = await readFile(new URL("../components/modules/InfrastructureDetailDrawer.tsx", import.meta.url), "utf8");
const assistantStoreSource = await readFile(new URL("../store/useFacilityAssistantStore.ts", import.meta.url), "utf8");
const assistantSheetSource = await readFile(new URL("../components/shell/FacilityAssistantSheet.tsx", import.meta.url), "utf8");

function check(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}: ${error?.message || error}`);
    process.exitCode = 1;
  }
}

check("Facility route context derives building, home, camera, meter and incident targets", () => {
  for (const token of ["buildingId", "homeId", "cameraId", "meterId", "incidentId"]) {
    assert.match(objectContextSource, new RegExp(token));
  }
  assert.match(objectContextSource, /source: "facility_route_context"/);
});

check("Facility Oyi runtime conversation sends operational object and route context", () => {
  assert.match(oyiServiceSource, /API\.post\("\/oyi\/runtime\/conversation"/);
  assert.match(oyiServiceSource, /surface: "facility"/);
  assert.match(oyiServiceSource, /operational_object: input\.operational_object \|\| null/);
  assert.match(oyiServiceSource, /route: input\.route \|\| null/);
  assert.match(oyiServiceSource, /active_intelligence_context/);
});

check("Facility realtime consumes server-authorized awareness, not raw resident-private inference", () => {
  assert.match(realtimeSource, /serverAwareness/);
  assert.match(realtimeSource, /operational_awareness/);
  assert.doesNotMatch(realtimeSource, /resident_device_private.*facility/i);
});

check("Facility renders contextual Oyi entry points for shell and infrastructure objects", () => {
  assert.match(launcherSource, /Who is affected/);
  assert.match(launcherSource, /openAssistant/);
  assert.match(launcherSource, /contextFor/);
  assert.match(launcherSource, /primary_object/);
  assert.match(topbarSource, /FacilityContextualOyiButton/);
  assert.match(infrastructureDrawerSource, /targetLabel=\{title\[source\]\}/);
});

check("Facility assistant stores structured active context instead of text-only target identity", () => {
  assert.match(assistantStoreSource, /FacilityActiveIntelligenceContext/);
  assert.match(assistantStoreSource, /activeContext/);
  assert.match(assistantSheetSource, /activeOperationalObject/);
  assert.match(assistantSheetSource, /activeIntelligenceContext/);
});

if (process.exitCode) process.exit(process.exitCode);
