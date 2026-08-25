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
  "app/(protected)/hardware-devices/page.tsx",
  /Asset \/ type[\s\S]*Location[\s\S]*Provider[\s\S]*Connectivity[\s\S]*Health[\s\S]*Edge \/ assignment[\s\S]*Last seen/,
  "Assets must retain the canonical operational registry columns",
);
expect(
  "app/(protected)/hardware-devices/page.tsx",
  /type Tab = "registry"[\s\S]*const TABS[\s\S]*"registry"[\s\S]*"discovery"[\s\S]*"edge"/,
  "Registry, Discovery, and Edge must remain the primary Assets modes",
);
expect(
  "app/(protected)/hardware-devices/page.tsx",
  /projection\?\.controllable && detail\.supported_controls\?\.length/,
  "Controls must render only from the canonical capability projection",
);
expect(
  "app/(protected)/hardware-devices/page.tsx",
  /facilityService\.sendDeviceCommand\(device\.id/,
  "Asset controls must use the existing governed command contract",
);
expect(
  "app/(protected)/hardware-devices/page.tsx",
  /\/password\|token\|secret\|credential\|ip\/i/,
  "Asset state and telemetry projections must exclude secret and private-network fields",
);
expect(
  "app/(protected)/hardware-devices/page.tsx",
  /Open Camera Center[\s\S]*Open Utilities[\s\S]*Open Access[\s\S]*Open Environment/,
  "Assets must hand specialist operations to canonical domain modules",
);
expect(
  "app/(protected)/hardware-devices/page.tsx",
  /No registered assets match this view[\s\S]*No bounded telemetry is available[\s\S]*No bounded audit history is available/,
  "Assets must provide truthful registry, telemetry, and history empty states",
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
