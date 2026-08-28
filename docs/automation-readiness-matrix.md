# Automation Readiness Matrix

Phase 2 of the Oyi Facility commercial-production closure programme, Section 18.

This matrix is **input to a future Phase 3** (the full automation operationalisation
workspace). It is not itself an implementation of Phase 3, and Phase 3 is not built
by this document or by anything in Phase 2. It records, honestly, what the
already-shipped client-side automation-recommendation policy
(`lib/safeAutomationRuntime.ts`) is currently capable of, per domain -- not what a
future engine should be capable of. Any Phase 3 design must start from this ceiling,
not assume a higher one exists today.

The policy is enforced in two independent places, confirmed by reading the source
directly (not inferred): `executionMode()` decides which of four modes
(`suggest_only`, `prepare_workflow`, `request_approval`, `execute_safe`) a given
recommendation reaches, and `safeToExecute()` is a second, redundant safety check
that can only ever narrow `execute_safe` further, never widen it. Nothing in this
runtime executes anything against Ochiga Backend -- it produces conversational
guidance and prepared-workflow text only.

## Domain matrix (spec's requested 8 domains)

| Domain (spec) | Runtime domain | Required permission(s) | Advisory behavior | Approval pathway | Automatic execution ceiling | Hard-blocked? |
|---|---|---|---|---|---|---|
| Security | `security` | `support.assign`, `notifications.manage` | Suggests or prepares a workflow only | Available whenever the source recommendation is flagged approval-required | **MANUAL_ONLY** | Yes -- `security` can never reach `execute_safe`, enforced in both `executionMode()`'s domain gate and `safeToExecute()`'s explicit block |
| Access | `visitor` | `visitors.manage` | Suggests or prepares a workflow only | Available whenever flagged approval-required | **MANUAL_ONLY** | Yes -- same double-enforcement as Security |
| Maintenance | `maintenance` | `support.assign` | Suggests or prepares a workflow only | Available whenever flagged approval-required | **MANUAL_ONLY** | No (never reaches `execute_safe` because `executionMode()`'s only `execute_safe` path requires `domain === "operational_governance"`) |
| Utilities | `utility` | `devices.control` | Suggests or prepares a workflow only | Available whenever flagged approval-required | **MANUAL_ONLY** | No (same structural reason as Maintenance) |
| Environment | `environmental` | `devices.control` | Suggests or prepares a workflow only | Available whenever flagged approval-required | **MANUAL_ONLY** | No (same structural reason as Maintenance) |
| Assets | `infrastructure` | `devices.control` | Suggests or prepares a workflow only | Available whenever flagged approval-required | **MANUAL_ONLY** | No (same structural reason as Maintenance) |
| Finance | `financial` | `wallets.manage` | Suggests or prepares a workflow only | Available whenever flagged approval-required | **MANUAL_ONLY** | Yes -- `financial` can never reach `execute_safe`, same double-enforcement as Security/Access |
| Community | `community` | `community.moderate` | Suggests or prepares a workflow only | Available whenever flagged approval-required | **MANUAL_ONLY** | No (same structural reason as Maintenance) |

## Domains present in the runtime but outside the spec's requested 8

Disclosed for completeness rather than silently mapped into one of the above --
these are genuinely distinct in the source and should not be conflated with any
spec domain above.

| Runtime domain | Required permission(s) | Automatic execution ceiling | Note |
|---|---|---|---|
| `operational_governance` | `support.assign` | **AUTO_ALLOWED (narrow)** | The *only* domain that can ever reach `execute_safe` today, and only for a single case: `actionType === "request_operator_decision"`, not already approval-required, not already flagged safe-to-automate elsewhere. Even then, execution is defined as "a low-risk, internal, reversible step" -- never resident-facing, never irreversible. |
| `executive` | `office.read` | **MANUAL_ONLY** | Briefing/reporting output; always operator-reviewed before use. |

## Universal rules (apply regardless of domain)

Read directly from `safetyChecks()` in `lib/safeAutomationRuntime.ts`:

- Never bypass permissions or role boundaries.
- Never auto-execute an irreversible or resident-facing action.
- Never dispatch a critical security action without explicit approval.
- Never execute a financial follow-up automatically.
- Never modify access/visitor permissions automatically.
- Never silently execute a device control command (infrastructure/environmental/utility).
- Where `execute_safe` is reached at all, execution must remain low-risk, internal, and reversible.

## Reading this matrix for Phase 3 planning

- 7 of 8 requested domains are **MANUAL_ONLY** today: any real action always
  requires either explicit operator approval (when the recommendation itself is
  flagged `approvalRequired`) or a human acting on a suggestion/prepared workflow.
  Phase 3 raising any of these ceilings is a deliberate, scoped decision, not a
  default -- especially Security, Access and Finance, which are additionally
  hard-blocked at a second, independent layer.
- Only `operational_governance` (not one of the 8 requested domains) has any
  automatic-execution path today, and it is narrow by design.
- This matrix reflects `lib/safeAutomationRuntime.ts` as of Phase 2. If that file
  changes, this matrix must be regenerated from the source, not edited by hand
  from memory.
