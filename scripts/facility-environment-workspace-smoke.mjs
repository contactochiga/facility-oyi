#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../app/(protected)/environment/page.tsx", import.meta.url), "utf8");
const topbar = await readFile(new URL("../components/shell/ShellTopbar.tsx", import.meta.url), "utf8");

for (const label of ["Overview", "Air Quality", "Weather", "Water Quality", "Energy", "Waste Management", "Alerts", "Sensors", "Reports", "Sustainability"]) {
  assert.match(page, new RegExp(label));
}

for (const metric of ["Air quality index", "Indoor temperature", "Indoor humidity", "Water quality", "Energy today", "Environmental alerts"]) {
  assert.match(page, new RegExp(metric, "i"));
}

for (const source of [
  "facilityService.infrastructureOperations",
  "facilityService.platformUtilityTelemetry",
  "facilityService.weather",
  "loadFacilityAttention",
  "loadOperationalRecommendations",
  "facility:realtime-event",
]) {
  assert.match(page, new RegExp(source.replaceAll(".", "\\.")));
}

// Live weather: real provider-backed panel replaces the old static placeholder,
// wired through the canonical FacilityWeatherResponse contract with honest
// loading/unavailable/location-required/stale states -- never fabricated values.
assert.match(page, /WeatherAside/);
assert.match(page, /WeatherView/);
assert.match(page, /Latest conditions loading/);
assert.match(page, /Facility location needs configuration/);
assert.match(page, /Weather is temporarily unavailable\./);
assert.match(page, /Latest provider result is temporarily stale/);
assert.match(page, /Near-term Forecast/);
assert.match(page, /Outdoor · /);
assert.match(page, /Feels like/);
assert.match(page, /Rain probability/);

assert.match(page, /no undocumented weighting is applied/);
assert.match(page, /No canonical waste events/);
assert.match(page, /No canonical environmental export or report-generation contract/);
assert.match(page, /Calibration controls are omitted/);
assert.match(topbar, /Environmental monitoring, air quality, and sustainability management/);

assert.doesNotMatch(page, /Site Overview|digital twin|3D environment|building image|coming soon/i);
assert.doesNotMatch(page, /AQI-001|TEMP-001|HUM-001|WQ-001|NOISE-001|1,245|72%/);
assert.doesNotMatch(page, />Refresh</);
assert.doesNotMatch(page, /calibrateSensor|calibrationService/);
// The frontend must consume only the canonical weather contract, never call
// a third-party weather provider or read an API key directly from the browser.
assert.doesNotMatch(page, /openweathermap|WEATHER_API_KEY|api\.openweathermap/i);

console.log("Facility Environment workspace smoke passed.");
