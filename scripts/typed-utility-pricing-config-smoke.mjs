#!/usr/bin/env node
// Facility <-> Consumer Utilities acceptance: the Policy drawer used to
// show one generic unit_cost/unit_name/billing_mode form for every
// utility type (confirmed by the sibling facility-utilities-workspace-
// smoke.mjs, which still asserts those fields exist for backward
// compatibility on the one remaining "generic" path). This proves the
// drawer now branches by service type instead of forcing Electricity,
// Water, Gas, Internet and Service Charge through that same shape.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../app/(protected)/services/page.tsx", import.meta.url), "utf8");
const serviceConfigService = await readFile(new URL("../services/serviceConfigService.ts", import.meta.url), "utf8");

// A single service_key -> UI-kind mapping must exist, and it must
// distinguish all five typed kinds this acceptance pass covers.
assert.match(page, /function pricingKindFor/);
assert.match(page, /"utility_token"\) return "electricity"/);
assert.match(page, /"water_service"\) return "water"/);
assert.match(page, /"gas_service"\) return "gas"/);
assert.match(page, /"internet_service".*"fiber_internet".*return "subscription"/);
assert.match(page, /"service_charge".*"other_facility_fees".*return "recurring"/);

// Electricity/Water: rate + unit + payment timing (prepaid/postpaid) +
// source/provider -- not just a bare unit_cost/unit_name pair.
for (const field of ["pricing_rate_amount", "pricing_unit_name", "pricing_payment_timing", "pricing_provider"]) {
  assert.match(page, new RegExp(field), `Policy drawer must capture ${field}`);
}
assert.match(page, /Rate \(₦ \/ kWh\)/, "electricity must show an explicit kWh rate label, not a generic 'unit rate'");
assert.match(page, /Rate \(₦ \/ m³\)/, "water must show an explicit m³ rate label, independent of electricity's kWh label");

// Gas: unit must be explicit/editable, never silently inferred.
assert.match(page, /unitEditable: true/, "gas pricing must expose an editable unit field rather than inferring one");

// Internet/Fibre: plan-list semantics (name/price/billing cycle), not a
// metered tariff -- multiple simultaneous plans supported.
for (const field of ["pricing_plans", "emptyPlanRow", "Add another plan"]) {
  assert.match(page, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `Internet pricing must support ${field}`);
}
assert.doesNotMatch(page, /kind === "subscription"[\s\S]{0,200}Rate \(₦/, "Internet's plan editor must not be forced through the electricity/water rate label");

// Service Charge: amount + frequency, explicitly not metered.
assert.match(page, /pricing_billing_frequency/);
assert.match(page, /One-off/);

// The typed pricing payload actually reaches the same single "Save
// Policy" action Facility already uses -- no second form/endpoint.
assert.match(page, /pricing\s*[,}]/, "savePolicy must attach the typed pricing payload to the existing save call");
assert.match(page, /serviceConfigService\.update\(selectedPolicy\.service_key,/);

// The generic unit_cost/unit_name/billing_mode fields must still exist,
// scoped to the one remaining "generic" kind (generator_recovery / solar
// battery) -- this fix must not remove functionality for service types
// outside its explicit scope.
assert.match(page, /kind === "generic"/);
assert.match(page, /Unit rate/);

// serviceConfigService must carry the typed pricing contract end to end.
assert.match(serviceConfigService, /pricing_plans/);
assert.match(serviceConfigService, /ServiceConfigPricingInput/);
assert.match(serviceConfigService, /usage_based/);
assert.match(serviceConfigService, /subscription/);

console.log("Typed utility pricing config smoke passed.");
