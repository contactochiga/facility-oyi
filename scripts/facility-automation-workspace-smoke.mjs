#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../app/(protected)/automation/page.tsx", import.meta.url), "utf8");
const rulesService = await readFile(new URL("../services/automationRulesService.ts", import.meta.url), "utf8");
const shellTopbar = await readFile(new URL("../components/shell/ShellTopbar.tsx", import.meta.url), "utf8");

// Header/nav per the exact required copy and tab set.
assert.match(page, /subtitle="Automate operations across your facility with safety, approvals and full audit\."/);
assert.match(page, />Create Automation</);
for (const tab of ["Overview", "Active Automations", "Recommendations", "Approvals", "Runs", "Failures", "History"]) assert.match(page, new RegExp(`label: "${tab}"`));

// KPI strip pulls from real sources only -- no manufactured trend/sparkline.
for (const metric of ["Active Automations", "Pending Approvals", "Successful Executions", "Failed Executions", "Automation Health"]) assert.match(page, new RegExp(metric));
assert.match(page, /No data yet/);
assert.doesNotMatch(page, /sparkline/i);
assert.doesNotMatch(page, /Math\.random/);

// Active Automations table matches the required column set and is built
// from the real system-detector list plus the real automationRulesService
// data, not hardcoded example rows.
for (const column of ["Automation", "Trigger", "Action", "Mode", "Last Run", "Status", "Actions"]) assert.match(page, new RegExp(`"${column}"`));
assert.match(page, /rules\.slice\(0, 8\)\.map\(\(rule\)/);
assert.match(page, /automationRulesService\.list/);

// Governance table/summary are read-only here and route to Facility
// Administration for editing -- never a second policy editor.
assert.match(page, /Automation Governance/);
assert.match(page, /Governance Summary/);
assert.match(page, /facility-administration\?tab=automation/);
assert.match(page, /facilityService\.automationPolicy\(\)/);
assert.doesNotMatch(page, /updateAutomationPolicy|savePolicy|policy\.update/);

// Oyi Core execution activity is real data, not implied to originate
// solely from user-created automations.
assert.match(page, /loadOyiCoreExecutionHistory/);
assert.match(page, /loadOyiCoreExecutionStatistics/);
assert.match(page, /not limited to automations created in this workspace/);

// Create Automation is scoped to the Assets\/Device domain this pass, and
// discloses why (no bypass of the approval-required Visitor\/Maintenance
// governance built in the earlier phase).
assert.match(page, /Only Assets \(device\) actions can be created here today/);
assert.match(page, /schedule-only|Only scheduled triggers are supported today/);
assert.match(page, /automation_surface_disabled/);

// No fabricated example data from the reference screenshot leaked into
// production code (illustrative rows the spec explicitly said not to copy).
assert.doesNotMatch(page, /Lobby Lights|HVAC Zone|Elevator Bank|Fire Pump/);

// The client-only automations service calls the real, pre-existing Shared
// Automation Runtime contract -- not a new engine -- and defends the
// cross-surface privacy fix independently of the backend filter.
assert.match(rulesService, /\/scenes\/automations/);
assert.match(rulesService, /row\.surface === "facility"/);
assert.doesNotMatch(rulesService, /surface.*consumer.*=>.*facility|mislabel/i);

// --- Final UI/UX consistency pass -------------------------------------

// Create Automation now lives on the same row as the tab navigation, not
// floating in a separate header row above it (Topbar no longer receives
// a rightSlot on this page).
assert.doesNotMatch(page, /<Topbar[\s\S]{0,400}rightSlot=/);
assert.match(page, /flex flex-wrap items-center justify-between gap-3">\s*<div className="flex flex-wrap gap-1\.5">\s*{TABS\.map/);
assert.match(page, /<Button onClick={openCreate} className="shrink-0 gap-2">/);

// Action controls are fully and distinctly represented: Run now is
// independent of the enable\/disable toggle, and paused vs enabled show
// different icons/labels (Pause vs Resume), per the confirmed real
// behavior of POST /scenes/automations/:id/test (never checks `enabled`).
assert.match(page, /title="Run now"/);
assert.match(page, /rule\.enabled \? "Pause" : "Resume"/);
assert.match(page, /rule\.enabled \? <Pause/);

// A "More" menu exists and only exposes actions genuinely backed by the
// real client (Duplicate re-uses create(), View runs re-uses the real
// per-rule runs() call, Delete re-uses remove()) -- no dead controls.
assert.match(page, /label: "Duplicate", onClick: onDuplicate/);
assert.match(page, /label: "View runs", onClick: onViewRuns/);
assert.match(page, /label: "Delete", onClick: onDelete, danger: true/);

// System-managed detectors are never visually implied to be editable.
assert.match(page, /System-managed/);
assert.match(page, /not user-editable/);

// Every non-Overview subpage now uses the same registry\/table\/filter
// language (search + table), not the old one-off OisListItem card list
// per tab, and it must be genuine data, not a synthetic figure.
for (const fn of ["ActiveAutomationsTab", "RecommendationsTab", "ApprovalsTab", "RunsTab", "FailuresTab", "HistoryTab"]) {
  assert.match(page, new RegExp(`function ${fn}`));
}
assert.match(page, /function SearchInput/);
assert.match(page, /function InspectDrawer/);

// The exact required subtitle is wired into the map ShellTopbar actually
// renders on screen (Topbar's own subtitle prop only ever reaches an
// aria-label, never visible text -- confirmed by reading the component).
assert.match(shellTopbar, /automation: "Automate operations across your facility with safety, approvals and full audit\."/);

console.log("Facility Automation workspace smoke passed.");
