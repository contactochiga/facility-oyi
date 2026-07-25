import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const failures = [];

function expect(file, pattern, message) {
  const body = read(file);
  if (!pattern.test(body)) failures.push(`${file}: ${message}`);
}

expect(
  "services/facilityService.ts",
  /ownership_class\?: string \| null[\s\S]*projection\?: \{/,
  "Facility infrastructure contract must accept canonical device projection fields",
);
expect(
  "services/facilityService.ts",
  /assignFacilityDevice\(deviceId: string, payload: \{ home_id\?: string \| null; room_id\?: string \| null \}\)/,
  "Facility assignment must continue through the canonical backend assignment route",
);
expect(
  "services/facilityService.ts",
  /syncFacilityTuya\(\)[\s\S]*\/facility\/devices\/providers\/tuya\/sync/,
  "Facility Tuya sync must continue using the backend provider adapter route",
);

if (failures.length) {
  console.error("Facility device projection smoke failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Facility device projection smoke passed.");
