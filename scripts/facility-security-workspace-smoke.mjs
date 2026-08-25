#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../app/(protected)/security-access/page.tsx", import.meta.url), "utf8");
const compatibility = await readFile(new URL("../app/(protected)/security/page.tsx", import.meta.url), "utf8");
const attention = await readFile(new URL("../services/facilityAttentionService.ts", import.meta.url), "utf8");
const camera = await readFile(new URL("../services/cameraService.ts", import.meta.url), "utf8");
const visitor = await readFile(new URL("../services/visitorService.ts", import.meta.url), "utf8");
const shellTopbar = await readFile(new URL("../components/shell/ShellTopbar.tsx", import.meta.url), "utf8");
const contextualOyi = await readFile(new URL("../components/shell/FacilityContextualOyiButton.tsx", import.meta.url), "utf8");

assert.match(compatibility, /redirect\("\/security-access"\)/);
for (const section of ["Security Attention", "Camera Health & Events", "Security Incidents", "Emergency Actions", "Quick Actions", "Attention Lane"]) assert.match(page, new RegExp(section));
for (const source of ["platformIncidents", "notificationService.unread", "loadFacilityAttention", "cameraService.listByEstate", "cameraService.listEvents"]) assert.match(page, new RegExp(source.replace(".", "\\.")));
assert.match(page, /visitorService\.lockdown\("emergency"\)/);
assert.match(visitor, /\/facility\/visitors\/actions\/lockdown/);
assert.match(page, /Confirm emergency lockdown/);
assert.match(page, /aria-modal="true"/);
assert.match(page, /href="\/cameras"/);
assert.match(page, /href="\/alerts"/);
assert.match(page, /facility-intelligence\?module=attention/);
assert.doesNotMatch(page, /Verify visitor|View gate flow|Visitor verification queue|Open visitor queue/);
assert.doesNotMatch(page, /visitorService\.listToday|visitorService\.list\(/);
assert.match(page, /facility:realtime-event/);
assert.match(attention, /security_exception/);
assert.match(attention, /href: "\/cameras"/);
assert.match(camera, /createCameraMediaReadClient/);
assert.doesNotMatch(page, /rtsp:\/\/|storage_key|access_token|password/);
assert.doesNotMatch(page, /const\s+(?:cameras|incidents|attention)\s*=\s*\[[^\]]+\]/s);
assert.match(shellTopbar, /"security-access": "Cameras, incidents and emergency operations"/);
assert.match(contextualOyi, /Summarize security conditions and response priorities/);

console.log("Facility Security workspace smoke passed.");
