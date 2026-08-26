#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const page=await readFile(new URL("../app/(protected)/services/page.tsx",import.meta.url),"utf8");
for(const source of ["listInfrastructureServiceAccounts","listEstateServicePayments","listInfrastructureServiceTransactions","listInfrastructureServiceEvents","serviceConfigService.list","serviceConfigService.update"])assert.match(page,new RegExp(source.replace(".","\\.")));
for(const label of ["Total Services","Active Services","Pending Setup","Service Policies","Services Overview","Provider Readiness","Utility Status","Transactions","History"])assert.match(page,new RegExp(label));
for(const field of ["suggested_amount","unit_cost","billing_mode","policyVersion","resident_purchases_enabled","minimum_purchase_amount","maximum_purchase_amount","fixed_fee","percentage_fee","tax_percentage","fulfilment_method","vending_mode","issuer_name","support_contact"])assert.match(page,new RegExp(field));
for(const binding of ["identifier","meter_number","account_number","tariff_profile","billing_profile","wallet_linked","kct","kctn"])assert.match(page,new RegExp(binding));
assert.match(page,/facility:realtime-event/);assert.match(page,/UtilitiesRegistryWorkspace/);assert.match(page,/OisDrawer/);assert.match(page,/FacilityMetricCard/);assert.doesNotMatch(page,/<Topbar[^>]+strip=/);assert.doesNotMatch(page,/Calorie Block|IKEDC|Spectranet|₦12,450/);assert.doesNotMatch(page,/password|access_token|secret|token_code/);
console.log("Facility Utilities workspace smoke passed.");
