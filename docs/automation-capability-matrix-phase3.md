# Automation Capability Matrix -- Phase 3 (Milestone 1)

Supersedes `docs/automation-readiness-matrix.md` (Phase 2) for the three domains
this milestone actually operationalised. This document describes reality
after implementation, per the governing spec's Section 33/43 requirement --
it distinguishes IMPLEMENTED / WIRED / DEPLOYED / EXECUTABLE / VERIFIABLE /
AUTONOMOUSLY ELIGIBLE explicitly rather than treating them as synonyms.

## Legend

- **Signal sources**: what real events/data feed this domain's automation.
- **Executable actions**: concrete `EXECUTION_REGISTRY` actions this milestone can run.
- **Default execution level**: server-enforced default from `automationPolicyResolver.ts`.
- **Status**: IMPLEMENTED (code exists) / WIRED (connected end-to-end) / DEPLOYED (present in the PR, not yet merged/live) / EXECUTABLE (can actually run) / VERIFIABLE (has a real post-execution check) / AUTONOMOUSLY ELIGIBLE (could ever run without a human click -- almost always "no" this milestone).

| Domain | Signal source | Reasoning/recommendation | Executable actions | Target adapter | Verification | Default execution level | Approval support | Realtime | Notification | Audit | Failure recovery | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Maintenance** | Event-driven: new `maintenance_request` insert (`maintenance.controller.ts`) | Narrow detector: same-home duplicate within 72h | `maintenance.cancel` (also `.assign`/`.complete` registered but no detector proposes them yet) | `executeRegisteredAction` (existing) | `verifyMaintenanceStatus` (existing, real) | `approval_required` | Yes -- `automation_approvals` | Yes -- `facility:realtime-event`/`facility:automation` | Yes -- `NotificationService.sendToUser` to rank≥50 members | Yes -- `emitAuditEvent`, tenant-scoped | Precondition check (target already completed/cancelled) blocks stale execution | IMPLEMENTED, WIRED, EXECUTABLE, VERIFIABLE. Not AUTONOMOUSLY ELIGIBLE (no Facility has an auto_allowed override; none can be created yet -- no editing UI). DEPLOYED to a PR, not yet merged. |
| **Access (visitor)** | On-demand scan: `visitor_access` rows past `expires_at`, still `active` (run at Approvals/workspace load, not a background schedule) | Narrow detector: stale authorization | `visitor.expire` (also `.approve`/`.revoke` registered, no detector proposes them yet) | `executeRegisteredAction` (existing) | `verifyVisitorStatus` (existing, real) | `approval_required` | Yes | Yes | Yes | Yes | Same precondition pattern | Same as Maintenance. On-demand, not event-driven or scheduled -- see "Proactive trigger" note below. |
| **Assets (device)** | None this milestone -- no detector | None proposed | `device.on/off/toggle` registered and policy-resolved, but **no detector or UI creates an approval for these yet** | `executeRegisteredAction` -> `executeDeviceCommandForActor` (existing) | `verifyDeviceAction` (existing, real) | `approval_required` | Code path exists, unexercised | N/A (unreached) | N/A (unreached) | N/A (unreached) | N/A (unreached) | IMPLEMENTED (policy + execution + verification all wired), NOT WIRED end-to-end (no candidate ever proposes a device approval) -- disclosed gap, not fabricated. |
| **Security** (beyond visitor/lockdown) | Existing camera/incident signals (unchanged) | Existing (unchanged) | None | None | None | `manual_only` / `unsupported` (registry: `available:false` doesn't exist for a distinct "security" action set -- there simply is no registered security execution action beyond visitor/device) | No | Existing incident realtime (unchanged) | Existing (unchanged) | Existing (unchanged) | N/A | UNCHANGED from Phase 2. No automation wiring added. |
| **Utilities** (beyond device on/off) | None | None | None | None | None | `unsupported` | No | No | No | No | N/A | UNCHANGED. No utility-specific executable action exists in the registry. |
| **Environment** | None | Existing telemetry display (unchanged) | None | None | None | `unsupported` | No | No | No | No | N/A | UNCHANGED. Read-only, as Phase 2 found. |
| **Finance** | None | None | None | `wallet.approve`/`wallet.cancel` exist in `EXECUTION_REGISTRY` but `available:false` (pre-existing, untouched) | None | `manual_only` (registry-level, not this milestone's default) | No | No | No | No | N/A | UNCHANGED. This milestone did not touch wallet/finance code at all, per explicit "extreme caution" instruction. |
| **Community** | None | None | None | `community.approve`/`community.reject` exist but `available:false` (pre-existing, untouched) | None | `manual_only` | No | No | No | No | N/A | UNCHANGED. Not touched. |

## Proactive trigger status (spec Section 19/22)

- **Maintenance duplicate detector**: genuinely event-driven, fires inline on real request creation. No polling, no new scheduler.
- **Stale visitor detector**: on-demand (runs when the Approvals endpoint/workspace is loaded), not a background schedule. This is a deliberate, disclosed limitation: `OYI_PROACTIVE_SCHEDULER_ENABLED` (the existing, code-complete BullMQ scheduler found during the Phase 0 audit) was **not** enabled and no separate `worker.ts` deployment was created or verified this milestone -- flipping either is a production deployment decision, not a code change, and was left to the account owner per the approved plan. A stale visitor authorization is only found the next time someone opens the workspace, not the moment it goes stale.

## Deduplication / idempotency

- Proposal-level: DB unique index (`automation_approvals_one_pending_per_target`) plus an application-level duplicate check -- proven in the E2E "Scenario E" behavioral test (firing the same detector twice produces exactly one pending approval).
- Execution-level: an approval's own `status` transition out of `pending_approval` is the idempotency gate; a second approve/reject attempt on the same row is rejected with `not_pending`, not re-executed.

## What "verified" actually means here

Every execution this milestone re-reads the real target row immediately after the action (`verifyVisitorStatus`/`verifyMaintenanceStatus`) and compares it against the expected status. A mismatch is recorded as `verification_failed`, not silently reported as success. `device.on/off/toggle` has the same verification function wired (`verifyDeviceAction`) but is currently unreachable (see Assets row above).
