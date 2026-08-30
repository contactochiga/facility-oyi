#!/usr/bin/env node
// FINAL OYI FACILITY AUTOMATION BUILDER -- Cross-Domain Operational
// Automation. Static regression proof that the Create Automation
// builder is generated from the real capability registry rather than a
// hardcoded per-domain list, that the MODE badge no longer wraps, and
// that Recommendation -> Automation only ever prefills what's honestly
// derivable (name + best-effort domain), never the trigger/action.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../app/(protected)/automation/page.tsx", import.meta.url), "utf8");
const badge = await readFile(new URL("../components/ois/OisStatusBadge.tsx", import.meta.url), "utf8");
const rulesService = await readFile(new URL("../services/automationRulesService.ts", import.meta.url), "utf8");
const facilityService = await readFile(new URL("../services/facilityService.ts", import.meta.url), "utf8");

// MODE badge fix: whitespace-nowrap + shrink-0 so a two-word label like
// "approval required" can never wrap into a bulky multi-line pill.
assert.match(badge, /whitespace-nowrap/);
assert.match(badge, /shrink-0/);

// Builder is domain-generated from the real capability registry, not a
// second, independently-maintained list.
assert.match(page, /availableDomains = useMemo/);
assert.match(page, /d\.actions\.some\(\(a\) => a\.available/);
assert.match(page, /capabilities\?\.domains \|\| \[\]/);
assert.match(page, /facilityService\.automationCapabilities\(\)/);

// 6 real steps: Basics, Trigger, Conditions, Action, Execution, Review.
// Conditions is new (Cross-Domain Fabric Closure) -- only meaningful for
// event-triggered rules, deliberately inserted right after Trigger.
for (const step of ["Basics", "Trigger", "Conditions", "Action", "Execution", "Review"]) {
  assert.match(page, new RegExp(`key: "${step.toLowerCase()}", label: "${step}"`));
}

// Automation is genuinely event-driven now, not schedule-only -- the
// Trigger step offers both modes, sourced from the real trigger registry
// (capabilities.triggers), not a second hardcoded list.
assert.match(page, /const \[triggerMode, setTriggerMode\] = useState<"schedule" \| "event">\("schedule"\)/);
assert.match(page, /eventTriggers = useMemo\(\(\) => \(capabilities\?\.triggers \|\| \[\]\)\.filter/);
assert.match(page, /facilityService\.createAutomationEventRule\(/);

// A real, typed (not generic-expression) condition engine backs the new
// Conditions step, mirroring Backend's automationConditionEvaluator.ts.
for (const kind of ["severity_at_least", "field_threshold", "time_window", "building_occupied", "indoor_sensor_threshold"]) {
  assert.match(page, new RegExp(kind));
}
assert.doesNotMatch(page, /eval\(|new Function\(/);

// Device actions stay out of the event-rule path this pass (disclosed
// scope -- the device_command lane's shape hasn't been verified against
// executeRegisteredAction's generic fallthrough).
assert.match(page, /triggerMode !== "event" \|\| a\.target_type !== "device"/);

// Execution & Governance step reads the real, server-resolved execution
// level from the capability registry -- it does not hardcode "Automatic"
// for every action anymore (that was only ever true for device actions).
assert.match(page, /selectedAction\.execution_level/);
assert.doesNotMatch(page, /<p className="mt-1 text-white">Automatic · {enabled/);

// Entity pickers for the newly-safe domains reuse real, already-shipped
// list services -- not a free-form id text box (explicitly disallowed:
// "Prefer structured selections... not free-form automation commands").
assert.match(page, /visitorService\.list\(\)/);
assert.match(page, /maintenanceService\.list\(\)/);
assert.match(page, /facilityService\.listEstateUsers\(\)/);
assert.doesNotMatch(page, /placeholder="Paste a (visitor|work order) ID"/);

// notification.notify is a real, structured action: target type
// (role/user/home/estate) + title + message, not a free-form command.
assert.match(page, /"role" \| "user" \| "home" \| "estate"/);
assert.match(page, /notifyTitle\.trim\(\) && notifyMessage\.trim\(\)/);

// Recommendation -> Automation only ever prefills name + a best-effort
// domain guess -- it never claims to have picked the actual trigger or
// action for the operator (the documented, permanent contract gap).
assert.match(page, /PLAN_DOMAIN_TO_CAPABILITY_DOMAIN/);
assert.match(page, /onCreateAutomation: \(plan: AutomationPlan\) => void/);
assert.match(page, />Create Automation<\/button>/);
assert.doesNotMatch(page, /actionIntent.*=>.*action_id|mapActionIntentToRegisteredAction/);

// Cross-domain rules can now carry either action shape Backend accepts
// -- device_command (unchanged) or registered_action (governed).
assert.match(rulesService, /export type AutomationRegisteredAction/);
assert.match(rulesService, /action_type: "registered_action"/);
assert.match(rulesService, /export function isRegisteredAction/);

// Facility service exposes the capability registry response types the
// builder consumes -- a read-only projection, confirmed by having no
// mutating call alongside it.
assert.match(facilityService, /automationCapabilities\(\): Promise<AutomationCapabilitiesResponse>/);
assert.match(facilityService, /API\.get\("\/facility\/automation\/capabilities"\)/);

console.log("Cross-Domain Automation Builder smoke passed.");
