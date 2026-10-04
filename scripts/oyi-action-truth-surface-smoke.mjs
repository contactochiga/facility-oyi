// Oyi action truth -- Facility surface wiring (Slice 1).
// The shared mapper's behaviour is proven by oyi-action-truth-contract-smoke;
// this proves the Facility assistant actually uses it and that the retired
// over-claiming copy cannot return.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const feed = read("components/assistant/FacilityConversationFeed.tsx");
const store = read("store/useFacilityConversationStore.ts");
const service = read("services/oyiService.ts");

function check(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

check("feed renders canonical action truth through the shared mapper", () => {
  assert.match(feed, /from "@\/lib\/oyiActionTruth"/);
  assert.match(feed, /function ActionTruthStatus/);
  assert.match(feed, /<ActionTruthStatus message=\{message\} \/>/);
  assert.match(feed, /data-action-verified=\{view\.verified \? "true" : "false"\}/);
  assert.match(feed, /presentation_policy\?\.primary === "execution"/);
});

check("over-claiming copy is gone", () => {
  assert.equal(feed.includes('"Action completed"'), false);
  assert.equal(store.includes("Operational review completed."), false);
});

check("confirmation prompt is approval, not verification", () => {
  const prompt = feed.match(/function ConfirmationPrompt[\s\S]*?\nfunction SuggestedActions/)?.[0] || "";
  assert.match(prompt, /Confirm action\?/);
  assert.match(prompt, /Nothing has been sent yet\./);
  // Confirm/Cancel still re-send through the one conversation path.
  assert.match(prompt, /type: "confirm_reply", reply: "confirm"/);
});

check("empty responses fall back honestly", () => {
  assert.match(store, /response\.reply \|\| response\.message \|\| emptyResponseText\(response\)/);
  assert.match(store, /OYI_EMPTY_RESPONSE_TEXT/);
});

check("restoration rebuilds execution from persisted canonical action", () => {
  assert.match(store, /function restoredExecution/);
  assert.match(store, /execution: restoredExecution\(row\)/);
  assert.match(service, /presentation_policy: runtime\.presentation_policy/);
});

console.log("FACILITY ACTION TRUTH SURFACE SMOKE PASSED");
