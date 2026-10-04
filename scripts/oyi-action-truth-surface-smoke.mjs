// Facility x shared Oyi interaction foundation -- integration smoke (Slice 2).
// Supersedes the Slice 1 surface smoke: the truth mapper now lives in the
// shared package. Proves:
//   1. the REAL Facility surface adapter + voice wrapper (transpiled from
//      source) satisfy the shared contract;
//   2. the Facility integration matrix through the shared reducer with the
//      canonical Backend fixture;
//   3. focus trap / Escape / focus return and keyboard docking are preserved;
//   4. the FACILITY REALTIME FIREWALL, statically and at runtime;
//   5. the assistant is wired to the shared foundation, no fake progress.
import assert from "node:assert/strict";
import fs from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import { createTsLoader } from "./oyi-ts-loader.mjs";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const sheet = read("components/shell/FacilityAssistantSheet.tsx");
const feed = read("components/assistant/FacilityConversationFeed.tsx");
const shell = read("components/oyi-shell/OyiInteractionShell.tsx");
const orb = read("components/oyi-shell/OyiOrb.tsx");
const store = read("store/useFacilityConversationStore.ts");
const service = read("services/oyiService.ts");
const layout = read("app/(protected)/layout.tsx");
const pkgDir = path.dirname(createRequire(path.join(root, "package.json")).resolve("oyi-interaction/package.json"));
const fixture = JSON.parse(fs.readFileSync(path.join(pkgDir, "fixtures/oyi-action-truth.fixture.json"), "utf8"));
const caseById = (id) => fixture.cases.find((c) => c.id === id);

function check(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

// ---- runtime realtime firewall: trap sockets/transport BEFORE loading ----
const forbiddenLoads = [];
const originalLoad = Module._load;
Module._load = function (request, ...rest) {
  if (/socket\.io|facilityRealtime/.test(String(request))) {
    forbiddenLoads.push(request);
    throw new Error(`forbidden load: ${request}`);
  }
  return originalLoad.call(this, request, ...rest);
};
const networkCalls = [];
const trap = (name) => new Proxy(function () {}, { construct() { networkCalls.push(name); throw new Error(name); }, apply() { networkCalls.push(name); throw new Error(name); } });
globalThis.WebSocket = trap("WebSocket");
globalThis.EventSource = trap("EventSource");

const core = await import("oyi-interaction/core");
const load = createTsLoader(root, root);
const { createFacilitySurfaceAdapter, facilityStarterSeeds } = load("lib/oyi/facilitySurfaceAdapter.ts");
const { facilityVoiceSnapshot } = load("lib/oyi/facilityVoice.ts");
const { FACILITY_MODULES, visibleModules } = load("lib/moduleRegistry.ts");

const manager = { id: "f1", role: "facility_manager", permissions: ["estates.read", "homes.read", "devices.read", "support.read"], permission_scopes: [] };
const adapter = createFacilitySurfaceAdapter({ user: manager, estateId: "e1", estateName: "Luna Estate", buildingId: "b1", homeId: null, operationalObject: null, voiceEntry: true });

function turn(response) {
  let model = core.createInteractionModel();
  for (const event of [{ type: "turn.submitted", turnId: "m1" }, { type: "turn.response", turnId: "m1", response }, { type: "turn.presented", turnId: "m1" }]) model = core.interactionReducer(model, event);
  return core.deriveInteractionView(model);
}

check("adapter: real Facility adapter passes the shared contract (frozen, no authority fields)", () => {
  assert.equal(adapter.surface, "facility");
  assert.ok(Object.isFrozen(adapter));
  assert.deepEqual(Object.keys(adapter).sort(), ["context", "historyPolicy", "navigation", "operationalObject", "starterSeeds", "surface", "uiHints"]);
  assert.deepEqual(adapter.context(), { scopeKind: "building", scopeLabel: "Luna Estate", estateId: "e1", homeId: null, buildingId: "b1" });
  assert.deepEqual(adapter.historyPolicy, { source: "backend_threads", localFallback: "backend_cache", maxThreads: 24 });
});

check("navigation adapter: exactly Facility's permission-aware moduleRegistry", () => {
  for (const user of [manager, { id: "g", role: "guest", permissions: [], permission_scopes: [] }, null]) {
    const expected = visibleModules(user, FACILITY_MODULES).map((m) => m.key);
    const actual = createFacilitySurfaceAdapter({ user, estateId: null, estateName: null, buildingId: null, homeId: null, operationalObject: null, voiceEntry: false }).navigation().map((item) => item.key);
    assert.deepEqual(actual, expected);
  }
  const signedOut = createFacilitySurfaceAdapter({ user: null, estateId: null, estateName: null, buildingId: null, homeId: null, operationalObject: null, voiceEntry: false }).navigation();
  assert.ok(signedOut.length < FACILITY_MODULES.length, "registry permission filtering applied");
});

check("starter seed preserved from the previous Facility starter text", () => {
  assert.equal(facilityStarterSeeds("Luna Estate")[0].prompt, "Summarize current operational attention for Luna Estate.");
  assert.equal(facilityStarterSeeds(null)[0].prompt, "Summarize current operational attention.");
  assert.equal(core.normalizeOyiSuggestions(adapter.starterSeeds(), { source: "seed" })[0].label, "Start intelligence brief");
});

check("ordinary question -> idle answer without action", () => {
  const view = turn({ reply: "Two assets need attention.", execution: { status: "read_only", action: null } });
  assert.equal(view.phase, "idle");
  assert.equal(view.action, null);
});

for (const [id, label, phase] of [["A", "confirmation", "confirmation_required"], ["H", "cancel", "action_cancelled"], ["C2", "accepted-not-verified", "action_accepted"], ["E", "unobservable", "action_unobservable"], ["D", "verified fixture", "action_verified"], ["F", "failure", "action_failed"], ["J", "provider rejected", "action_rejected"]]) {
  check(`${label} (${id}) -> ${phase}`, () => {
    const view = turn({ reply: `Fixture ${id}`, ...caseById(id).response });
    assert.equal(view.phase, phase);
    assert.equal(view.action?.verified === true, caseById(id).response.execution.action?.status === "confirmed");
  });
}

check("permission restriction -> no action outcome", () => {
  const view = turn({ reply: "Not permitted.", ...caseById("M").response });
  assert.equal(view.action, null);
  assert.notEqual(view.phase, "action_verified");
});

check("thread restore + history -> same truth; canonical threads normalized", () => {
  const restored = core.deriveInteractionView(core.interactionReducer(core.createInteractionModel(), { type: "thread.restored", latestAssistant: { reply: "x", execution: caseById("C").response.execution } }));
  assert.equal(restored.phase, "action_unobservable");
  assert.match(sheet, /normalizeOyiThreads\(threads, \{ activeThreadId: threadId \}\)/);
  assert.match(sheet, /type: "thread\.restored", latestAssistant:/);
  // Audited local cache: zustand persist of Backend thread messages, replaced by hydrate().
  assert.match(store, /name: "facility-oyi-conversation"/);
});

check("voice wrapper drives the shared reducer through voiceSnapshotEvents", () => {
  const idle = facilityVoiceSnapshot({ supported: true, recording: false, error: null });
  const listening = facilityVoiceSnapshot({ supported: true, recording: true, error: null });
  const failed = facilityVoiceSnapshot({ supported: true, recording: false, error: "Microphone blocked" });
  assert.deepEqual(core.voiceSnapshotEvents(idle, listening).map((e) => e.type), ["voice.listening"]);
  assert.deepEqual(core.voiceSnapshotEvents(listening, failed).map((e) => e.type), ["voice.error"]);
  assert.equal(facilityVoiceSnapshot({ supported: false, recording: false, error: null }).permissionState, "unsupported");
  assert.match(sheet, /voiceSnapshotEvents\(voiceSnapshotRef\.current, next\)/);
});

check("focus trap, Escape, focus return preserved via the shared hook; keyboard docking unchanged", () => {
  assert.match(shell, /useOyiFocusTrap\(\{ active: props\.open, containerRef: panelRef, initialFocusRef: closeRef, returnFocusRef: props\.returnFocusRef, onEscape: props\.onClose \}\)/);
  assert.match(shell, /role="dialog" aria-modal="true"/);
  const hook = fs.readFileSync(path.join(pkgDir, "dist/react/hooks.js"), "utf8");
  assert.match(hook, /event\.key === "Escape"/);
  assert.match(hook, /event\.key !== "Tab"/);
  assert.match(hook, /event\.shiftKey && document\.activeElement === first/);
  assert.match(hook, /\(returnFocusRef\?\.current \|\| previouslyFocused\)\?\.focus/);
  assert.match(sheet, /useViewportDockLayout\(\{ active: open, dockRef: composerRef, lockDocument: true \}\)/);
  assert.match(sheet, /composerRef=\{composerRef\}/);
});

check("REALTIME FIREWALL (static): Oyi files and the shared package never touch Facility realtime", () => {
  const forbidden = /facilityRealtime|connectFacilityRealtime|disconnectFacilityRealtime|socket\.io|subscribe:estate|subscribe:user|scope:replace/;
  for (const [name, source] of [["sheet", sheet], ["feed", feed], ["shell", shell], ["orb", orb], ["store", store], ["adapter", read("lib/oyi/facilitySurfaceAdapter.ts")], ["voice", read("lib/oyi/facilityVoice.ts")], ["launcher", read("components/oyi-shell/OyiLauncher.tsx")]]) {
    assert.doesNotMatch(source, forbidden, name);
  }
  const walk = (dir, out = []) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const f = path.join(dir, e.name); if (e.isDirectory()) walk(f, out); else if (/\.(js|css)$/.test(e.name)) out.push(f); } return out; };
  for (const file of walk(path.join(pkgDir, "dist"))) assert.doesNotMatch(fs.readFileSync(file, "utf8"), forbidden, path.relative(pkgDir, file));
  // Realtime stays owned by the protected layout.
  assert.match(layout, /connectFacilityRealtime\(/);
  assert.match(layout, /disconnectFacilityRealtime\(\)/);
});

check("REALTIME FIREWALL (runtime): loading the package, adapter and voice wrapper opened no socket and loaded no realtime module", () => {
  let model = core.createInteractionModel();
  for (const item of fixture.cases) model = core.interactionReducer(model, { type: "thread.restored", latestAssistant: item.restored_metadata });
  adapter.navigation(); adapter.starterSeeds(); adapter.context();
  assert.deepEqual(forbiddenLoads, []);
  assert.deepEqual(networkCalls, []);
});

check("assistant wired to the shared foundation; no fake progress; honest fallback", () => {
  for (const needle of ["useOyiInteraction()", "useOyiConnectivity(dispatchInteraction)", 'type: "turn.submitted", turnId: pendingMessage.id', "type: \"turn.response\", turnId", "type: \"turn.presented\", turnId", "type: \"turn.failed\", turnId", "createFacilitySurfaceAdapter(", "surfaceAdapter.starterSeeds()", "statusOrb={<><OyiOrb", "OYI_WORKING_TEXT"]) {
    assert.ok(sheet.includes(needle), `sheet missing ${needle}`);
  }
  assert.match(feed, /<OyiActionResult view=\{view\} \/>/);
  assert.match(feed, /<OyiConfirmation/);
  assert.match(feed, /type: "confirm_reply", reply: "confirm"/);
  assert.match(orb, /SharedOyiOrb/);
  assert.match(store, /content: OYI_WORKING_TEXT, pending: true/);
  assert.match(store, /response\.reply \|\| response\.message \|\| emptyResponseText\(response\)/);
  assert.match(service, /presentation_policy: runtime\.presentation_policy/);
  for (const [name, source] of [["sheet", sheet], ["store", store], ["feed", feed]]) {
    for (const phrase of ["Checking facility records…", "Scanning facility…", "Reviewing buildings…", "Operational review completed.", '"Action completed"', "@/lib/oyiActionTruth"]) assert.equal(source.includes(phrase), false, `${name}: ${phrase}`);
  }
  assert.doesNotMatch(feed, /emerald/, "Confirm is never styled as success");
});

Module._load = originalLoad;
console.log("FACILITY OYI INTERACTION SURFACE SMOKE PASSED");
