#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const modules = await readFile(new URL("../lib/moduleRegistry.ts", import.meta.url), "utf8");
const topbar = await readFile(new URL("../components/shell/ShellTopbar.tsx", import.meta.url), "utf8");
const sidebar = await readFile(new URL("../components/shell/Sidebar.tsx", import.meta.url), "utf8");
const assistant = await readFile(new URL("../components/shell/FacilityAssistantSheet.tsx", import.meta.url), "utf8");
const assistantShell = await readFile(new URL("../components/oyi-shell/OyiInteractionShell.tsx", import.meta.url), "utf8");
const assistantStyles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const launcher = await readFile(new URL("../components/oyi-shell/OyiLauncher.tsx", import.meta.url), "utf8");
const orb = await readFile(new URL("../components/oyi-shell/OyiOrb.tsx", import.meta.url), "utf8");
const mobileFooter = await readFile(new URL("../components/navigation/MobileModuleFooter.tsx", import.meta.url), "utf8");
const mobileConfig = await readFile(new URL("../components/navigation/mobileNavConfig.ts", import.meta.url), "utf8");
const sidebarContent = await readFile(new URL("../components/shell/SidebarContent.tsx", import.meta.url), "utf8");
const legacyRoute = await readFile(new URL("../app/(protected)/facility-intelligence/page.tsx", import.meta.url), "utf8");

const expected = [
  ["Overview", "/overview"], ["Buildings", "/estate-structure"],
  ["Assets", "/hardware-devices"], ["Security", "/security-access"], ["Utilities", "/services"],
  ["Environment", "/environment"], ["Access", "/traffic"], ["Maintenance", "/maintenance"],
  ["Community", "/community"], ["Finance", "/wallets"],
];

for (const [label, href] of expected) {
  assert.match(modules, new RegExp(`label: "${label}"[^\\n]+href: "${href.replaceAll("/", "\\/")}"`));
}
assert.doesNotMatch(modules, /label: "Live"/);
assert.doesNotMatch(mobileConfig, /label: "Live"/);
assert.doesNotMatch(modules, /label: "Operational Intelligence"/);
assert.match(sidebar, /Building Operations/);
assert.doesNotMatch(sidebar, /Infrastructure operating system/);
for (const removed of ["Search anything", "FacilityContextualOyiButton", "ChevronDown", "estateLabel"]) {
  assert.doesNotMatch(topbar, new RegExp(removed));
}
assert.match(assistant, /title="Oyi"/);
assert.match(assistant, /subtitle="Facility Intelligence"/);
assert.match(assistant, /OyiInteractionShell/);
assert.match(assistant, /activeIntelligenceContext/);
assert.match(assistantShell, /data-oyi-interaction-shell="true"/);
assert.match(assistantShell, /OyiProcessingRow/);
assert.match(assistantStyles, /md:w-\[400px\]/);
assert.match(assistantStyles, /h-\[min\(560px/);
assert.match(assistantStyles, /bg-\[#07101a\]/);
assert.match(launcher, /OyiOrb/);
assert.doesNotMatch(launcher, /Sparkles/);
assert.match(orb, /oyi-shell-orb/);
assert.match(orb, />Oyi</);
assert.match(assistantStyles, /h-14 w-14/);
assert.match(assistantStyles, /bg-\[#06101d\]/);
assert.match(assistantStyles, /shadow-\[0_10px_40px_rgba\(56,189,248,0.35\)\]/);
assert.doesNotMatch(mobileFooter, /Sparkles/);
assert.doesNotMatch(mobileFooter, /Open Oyi Facility Intelligence/);
assert.match(sidebar, /w-\[236px\]/);
assert.match(sidebarContent, /min-h-9/);
assert.match(sidebarContent, /size=\{16\}/);
assert.doesNotMatch(sidebarContent, /shadow-\[0_12px_30px/);
assert.doesNotMatch(sidebarContent, /h-7 w-7 shrink-0 items-center justify-center rounded-lg border/);
assert.match(legacyRoute, /redirect\("\/overview\?oyi=open"\)/);
console.log("Facility commercial shell smoke passed.");
