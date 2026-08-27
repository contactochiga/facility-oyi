#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../app/(protected)/wallets/page.tsx", import.meta.url), "utf8");
const topbar = await readFile(new URL("../components/shell/ShellTopbar.tsx", import.meta.url), "utf8");

for (const label of ["Overview", "Transactions", "Wallets", "Service Payments", "Billing", "Reports"]) assert.match(page, new RegExp(label));
for (const metric of ["Money received", "Service payments", "Pending payments", "Facility wallet value", "Transactions", "Financial attention"]) assert.match(page, new RegExp(metric, "i"));
for (const source of ["facilityService.overview", "listEstateServicePayments", "listInfrastructureServiceTransactions", "listInfrastructureServiceAccounts", "serviceConfigService.list", "loadOperationalRecommendations", "loadOyiCoreExecutionHistory", "facility:realtime-event"]) assert.match(page, new RegExp(source.replaceAll(".", "\\.")));
for (const section of ["Collection Flow", "Payment Breakdown", "Recent Transactions", "Financial Summary", "Quick Actions", "Financial Attention", "Payment Status"]) assert.match(page, new RegExp(section));
assert.match(page, /No canonical Facility financial-report export contract exists/);
assert.match(page, /not an estate-wide resident-wallet list/);
assert.match(page, /Replaces unsupported budget analytics/);
assert.match(page, /Payment credentials, tokens, provider secrets, and private instruments are never rendered/);
assert.match(topbar, /Wallet activity, service payments, and financial operations/);
assert.doesNotMatch(page, /New Transaction|Create Invoice|Approve Bills|Create Budget|Account Statement/);
assert.doesNotMatch(page, /24\.68M|16\.32M|8\.36M|11\.45M|32\.18M|Salaries|Cleaning payroll|Office Rent/);
assert.doesNotMatch(page, />Refresh</);

console.log("Facility Finance workspace smoke passed.");
