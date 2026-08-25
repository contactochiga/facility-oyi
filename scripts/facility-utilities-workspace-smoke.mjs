#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const page=await readFile(new URL("../app/(protected)/services/page.tsx",import.meta.url),"utf8");
for(const source of ["listInfrastructureServiceAccounts","listInfrastructureServiceTransactions","listInfrastructureServiceEvents","serviceConfigService.list","serviceConfigService.update"])assert.match(page,new RegExp(source.replace(".","\\.")));
for(const label of ["Total services","Active services","Pending setup","Service policies","Provider Readiness","Utility Status","Services Overview","Configure Service","Transactions","History"])assert.match(page,new RegExp(label));
for(const category of ["Electricity","Water","Internet","Gas","Estate Fees","Facility Services"])assert.match(page,new RegExp(category));
for(const field of ["identifier","meter_number","account_number","tariff_profile","billing_profile","wallet_linked","kct","kctn"])assert.match(page,new RegExp(field));
assert.match(page,/facility:realtime-event/);assert.match(page,/OisDrawer/);assert.match(page,/sm:grid-cols-2/);assert.match(page,/xl:grid-cols-/);
assert.doesNotMatch(page,/Calorie Block|IKEDC|Spectranet|₦12,450|const\s+accounts\s*=\s*\[[^\]]+\]/s);
assert.doesNotMatch(page,/password|access_token|secret|token_code/);
console.log("Facility Utilities workspace smoke passed.");
