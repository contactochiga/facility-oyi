#!/usr/bin/env node
// Live Weather + Environmental Context Integration. Facility location
// (lat/lng) is the authority the weather panel resolves against -- this
// smoke proves the Facility Administration Profile form actually exposes it,
// gated by the same RBAC check as every other Profile field, and validates
// range before sending it to Backend's already-real updateEstate contract.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../app/(protected)/facility-administration/page.tsx", import.meta.url), "utf8");

assert.match(page, /lat: "", lng: ""/, "Profile form state must carry lat/lng fields");
assert.match(page, /estate\.lat/, "Profile form must populate latitude from the real estate record");
assert.match(page, /estate\.lng/, "Profile form must populate longitude from the real estate record");
assert.match(page, /Latitude must be a number between -90 and 90/, "latitude must be range-validated before saving");
assert.match(page, /Longitude must be a number between -180 and 180/, "longitude must be range-validated before saving");
assert.match(page, /lat,\s*\n?\s*lng,/, "save payload must include lat/lng");
assert.match(page, /Latitude<input className=\{inputClass\} value=\{form\.lat\} disabled=\{!canSettings\}/, "latitude input must be RBAC-gated the same way as every other Profile field");
assert.match(page, /Longitude<input className=\{inputClass\} value=\{form\.lng\} disabled=\{!canSettings\}/, "longitude input must be RBAC-gated the same way as every other Profile field");

// Weather is never derived from the logged-in user's device location -- only
// from the Facility's own configured coordinates.
assert.doesNotMatch(page, /navigator\.geolocation/, "must never derive Facility weather location from the operator's own device");

console.log("Facility location configuration smoke passed.");
