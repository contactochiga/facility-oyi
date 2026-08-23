#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const modules = await readFile(new URL("../lib/moduleRegistry.ts", import.meta.url), "utf8");
const topbar = await readFile(new URL("../components/shell/ShellTopbar.tsx", import.meta.url), "utf8");
const sidebar = await readFile(new URL("../components/shell/Sidebar.tsx", import.meta.url), "utf8");
const assistant = await readFile(new URL("../components/shell/FacilityAssistantSheet.tsx", import.meta.url), "utf8");
const legacyRoute = await readFile(new URL("../app/(protected)/facility-intelligence/page.tsx", import.meta.url), "utf8");

const expected = [
  ["Overview", "/overview"], ["Live", "/live-infrastructure"], ["Buildings", "/estate-structure"],
  ["Assets", "/hardware-devices"], ["Security", "/security-access"], ["Utilities", "/services"],
  ["Environment", "/environment"], ["Access", "/traffic"], ["Maintenance", "/maintenance"],
  ["Community", "/community"], ["Finance", "/wallets"],
];

for (const [label, href] of expected) {
  assert.match(modules, new RegExp(`label: "${label}"[^\\n]+href: "${href.replaceAll("/", "\\/")}"`));
}
assert.doesNotMatch(modules, /label: "Operational Intelligence"/);
assert.match(sidebar, /Building Operations/);
assert.doesNotMatch(sidebar, /Infrastructure operating system/);
for (const removed of ["Search anything", "FacilityContextualOyiButton", "ChevronDown", "estateLabel"]) {
  assert.doesNotMatch(topbar, new RegExp(removed));
}
assert.match(assistant, />Oyi</);
assert.match(assistant, /Facility Intelligence/);
assert.match(assistant, /activeIntelligenceContext/);
assert.match(legacyRoute, /redirect\("\/overview\?oyi=open"\)/);
console.log("Facility commercial shell smoke passed.");
