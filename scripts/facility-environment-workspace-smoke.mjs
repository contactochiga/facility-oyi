#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../app/(protected)/environment/page.tsx", import.meta.url), "utf8");
const topbar = await readFile(new URL("../components/shell/ShellTopbar.tsx", import.meta.url), "utf8");

for (const label of ["Overview", "Air Quality", "Weather", "Water Quality", "Energy", "Waste Management", "Alerts", "Sensors", "Reports", "Sustainability"]) {
  assert.match(page, new RegExp(label));
}

for (const metric of ["Air quality index", "Average temperature", "Average humidity", "Water quality", "Energy today", "Environmental alerts"]) {
  assert.match(page, new RegExp(metric, "i"));
}

for (const source of [
  "facilityService.infrastructureOperations",
  "facilityService.platformUtilityTelemetry",
  "loadFacilityAttention",
  "loadOperationalRecommendations",
  "facility:realtime-event",
]) {
  assert.match(page, new RegExp(source.replaceAll(".", "\\.")));
}

assert.match(page, /No canonical weather integration/);
assert.match(page, /no undocumented weighting is applied/);
assert.match(page, /No canonical waste events/);
assert.match(page, /No canonical environmental export or report-generation contract/);
assert.match(page, /Calibration controls are omitted/);
assert.match(topbar, /Environmental monitoring, air quality, and sustainability management/);

assert.doesNotMatch(page, /Site Overview|digital twin|3D environment|building image|coming soon/i);
assert.doesNotMatch(page, /AQI-001|TEMP-001|HUM-001|WQ-001|NOISE-001|1,245|72%/);
assert.doesNotMatch(page, />Refresh</);
assert.doesNotMatch(page, /calibrateSensor|calibrationService|weatherService/);

console.log("Facility Environment workspace smoke passed.");
