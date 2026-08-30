#!/usr/bin/env node
// Office->Facility provisioning lifecycle closure. The estate-owner
// activation page previously jumped straight to /overview after
// credentials were set -- no profile, no Facility-profile confirmation,
// no verification step (requirement #8). This smoke proves the extended
// wizard exists, reuses the already-proven profile/avatar functions
// instead of inventing new ones, never fabricates an OTP/MFA capability,
// and that the final redirect target is the new first-run flow (not the
// old bare /overview landing) which itself reuses the existing
// createBuilding/createHome calls rather than new endpoints.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const invitePage = await readFile(new URL("../app/(auth)/facility-invite/page.tsx", import.meta.url), "utf8");
const firstRunPage = await readFile(new URL("../app/(protected)/first-run/page.tsx", import.meta.url), "utf8");

// The wizard's added steps must exist as distinct stages, not just extra
// copy bolted onto the existing credentials step.
assert.match(invitePage, /type WizardStep = "credentials" \| "profile" \| "facility" \| "verify" \| "complete"/, "wizard must define the full stage sequence requirement #8 asks for");

// Profile + photo step reuses Consumer's proven profile/avatar contract --
// no second identity/profile system.
assert.match(invitePage, /authService\.updateMyProfile\(/, "profile step must reuse the existing updateMyProfile contract");
assert.match(invitePage, /authService\.uploadMyAvatar\(/, "profile step must reuse the existing uploadMyAvatar contract");

// Facility profile confirmation must be read-only and backed by the real,
// existing estates-list contract -- never a fabricated or editable form.
assert.match(invitePage, /facilityService\.myEstates\(\)/, "Facility confirmation step must read the real estate record, not a fabricated one");
assert.doesNotMatch(invitePage, /FacilityConfirmStep[\s\S]{0,600}<input/, "Facility profile confirmation must stay read-only -- Office-owned fields are not customer-editable");
assert.match(invitePage, /set by Ochiga during provisioning/i, "Facility confirmation copy must be honest about who owns these fields");

// Verification must be possession-based copy, never a fabricated OTP/MFA
// mechanism the current contract doesn't support.
assert.match(invitePage, /verified because you opened this secure,\s*single-use activation link/i, "verification step must be honest possession-based copy");
assert.doesNotMatch(invitePage, /VerifyStep[\s\S]{0,800}(otp|one-time code|verification code|2fa|mfa)/i, "verification step must not fabricate an OTP/MFA capability");

// Completion must route into first-run, not the old bare dashboard.
assert.match(invitePage, /router\.replace\("\/first-run"\)/, "wizard completion must route into first-run setup, not directly to /overview");
assert.doesNotMatch(invitePage, /setWizardStep\("profile"\)[\s\S]*router\.replace\("\/overview"\)/, "activation success paths must not still redirect straight to /overview");

// First-run reuses the existing Building/Home creation contract and
// estate-resolution pattern -- no parallel provisioning path.
assert.match(firstRunPage, /facilityService\.createBuilding\(/, "first-run must reuse the existing createBuilding call");
assert.match(firstRunPage, /facilityService\.createHome\(/, "first-run must reuse the existing createHome call");
assert.match(firstRunPage, /context\?\.estate_id \|\| user\?\.estate_id/, "first-run must resolve the real active estate, not assume one");

console.log("Facility activation wizard smoke passed.");
