"use client";

import { useEffect, useMemo, useState } from "react";
import { OisPageToolbar, OisRegistryHeader, OisRegistryPanel } from "@/components/ois";
import OisCard from "@/components/ois/OisCard";
import OisDrawer from "@/components/ois/OisDrawer";
import OisListItem from "@/components/ois/OisListItem";
import OisStatusBadge from "@/components/ois/OisStatusBadge";
import Topbar from "@/components/shell/Topbar";
import { facilityService, type InfrastructureServiceAccountRow } from "@/services/facilityService";
import { serviceConfigService, type ServiceConfig } from "@/services/serviceConfigService";
import { formatMoney } from "@/lib/format";

const FILTERS = [
  "All",
  "Electricity",
  "Water",
  "Internet",
  "Gas",
  "Generator",
  "Solar",
  "Issues",
  "Ready",
  "Pending",
] as const;

const KEY_LABELS: Record<string, string> = {
  utility_token: "Electricity",
  water_service: "Water",
  gas_service: "Gas",
  internet_service: "Internet",
  fiber_internet: "Internet",
  generator_recovery: "Generator",
  solar_battery_service: "Solar / Battery",
  service_charge: "Estate Fees",
  other_facility_fees: "Facility Services",
};

function toneFor(value?: string | null) {
  const text = String(value || "").toLowerCase();
  if (/ready|stable|active|available|online/.test(text)) return "stable";
  if (/issue|failed|warning|degraded|blocked/.test(text)) return "warning";
  if (/unavailable|offline|unsupported/.test(text)) return "unavailable";
  return "pending";
}

function when(value?: string | null) {
  if (!value) return "No recent activity";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "No recent activity"
    : date.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function matchesFilter(account: InfrastructureServiceAccountRow, active: typeof FILTERS[number]) {
  if (active === "All") return true;
  if (active === "Issues") return /issue|failed|warning|blocked|unsupported/.test(`${account.status} ${account.vending_readiness} ${account.provider_health}`.toLowerCase());
  if (active === "Ready") return String(account.vending_readiness || "").toLowerCase() === "ready";
  if (active === "Pending") return /pending|manual_review|setup/.test(`${account.status} ${account.vending_readiness} ${account.last_transaction_status}`.toLowerCase());
  return KEY_LABELS[account.service_key] === active;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <OisCard variant="evidence" className="p-3">
      <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--ois-text-muted)]">{label}</div>
      <div className="mt-1 text-sm text-[var(--ois-text-primary)]">{value}</div>
    </OisCard>
  );
}

export default function FacilityServicesPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estateId, setEstateId] = useState<string>("");
  const [configs, setConfigs] = useState<ServiceConfig[]>([]);
  const [accounts, setAccounts] = useState<InfrastructureServiceAccountRow[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [selected, setSelected] = useState<InfrastructureServiceAccountRow | null>(null);
  const [activeFilter, setActiveFilter] = useState<typeof FILTERS[number]>("All");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const overview = await facilityService.overview().catch(() => null);
      const nextEstateId = String((overview as any)?.estate?.id || (overview as any)?.estate_id || "").trim();
      setEstateId(nextEstateId);
      const [configResult, accountsResult, paymentRows] = await Promise.all([
        serviceConfigService.list(),
        nextEstateId ? facilityService.listInfrastructureServiceAccounts({ estate_id: nextEstateId }) : Promise.resolve({ accounts: [] }),
        nextEstateId ? facilityService.listEstateServicePayments(nextEstateId, 20) : Promise.resolve({ payments: [] }),
      ]);
      setConfigs(configResult.configs || []);
      setAccounts(accountsResult.accounts || []);
      setPayments(paymentRows.payments || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load infrastructure services");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(
    () => accounts.filter((account) => matchesFilter(account, activeFilter)),
    [accounts, activeFilter],
  );

  const readyCount = accounts.filter((account) => String(account.vending_readiness || "").toLowerCase() === "ready").length;
  const issueCount = accounts.filter((account) => matchesFilter(account, "Issues")).length;
  const pendingCount = accounts.filter((account) => matchesFilter(account, "Pending")).length;
  const residentLinked = accounts.filter((account) => account.resident_id).length;

  return (
    <div className="space-y-6">
      <Topbar
        title="Infrastructure Services"
        subtitle="Resident-bound service operations"
        strip={[
          { label: "Accounts", value: accounts.length, detail: "Provisioned services", tone: "stable" },
          { label: "Ready", value: readyCount, detail: "Vending-ready", tone: "attention" },
          { label: "Pending", value: pendingCount, detail: "Provider/manual review", tone: "warning" },
          { label: "Linked", value: residentLinked, detail: "Resident assignments", tone: "info" },
        ]}
      />

      {error ? <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}

      <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <OisRegistryPanel
          title="Provisioned Service Accounts"
          caption="Electricity, water, gas, internet, generator, solar, estate fees, and resident service readiness."
          toolbar={<OisPageToolbar onRefresh={() => void load()} refreshing={loading} searchPlaceholder="Search home, resident, provider, or identifier..." />}
          className="p-5"
        >
          <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={`rounded-full border px-3 py-2 text-xs transition ${activeFilter === filter ? "border-sky-300/30 bg-sky-400/12 text-sky-100" : "border-white/10 bg-white/[0.04] text-zinc-400 hover:bg-white/[0.06]"}`}
              >
                {filter}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-2">
            {filtered.map((account) => (
              <button
                key={account.id}
                type="button"
                onClick={() => setSelected(account)}
                className="w-full text-left"
              >
                <OisListItem
                  title={`${KEY_LABELS[account.service_key] || account.service_title} · ${account.home_label || "Home pending"}`}
                  description={`${account.resident_name || "Resident pending"} · ${account.provider || "Provider pending"} · ${account.identifier || "Identifier pending"}`}
                  meta={when(account.last_activity_at)}
                  status={toneFor(account.vending_readiness || account.status)}
                  action={
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <OisStatusBadge status={toneFor(account.provider_health)} label={String(account.provider_health || "Unknown").replace(/_/g, " ")} />
                      <OisStatusBadge status={toneFor(account.vending_readiness)} label={String(account.vending_readiness || "Pending").replace(/_/g, " ")} />
                    </div>
                  }
                />
              </button>
            ))}
            {!filtered.length ? (
              <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">
                No infrastructure service accounts match this filter yet.
              </div>
            ) : null}
          </div>
        </OisRegistryPanel>

        <aside className="space-y-4">
          <OisCard className="p-5">
            <OisRegistryHeader title="Readiness Posture" caption="Provider, wallet, and resident service linkage." />
            <div className="mt-4 space-y-2">
              <OisListItem title="Issues requiring review" description="Provider failures, unsupported vending, or blocked status" meta={`${issueCount} records`} status={issueCount ? "warning" : "stable"} />
              <OisListItem title="Estate scope" description={estateId ? "Live estate registry" : "Estate context pending"} meta={estateId || "No estate"} status={estateId ? "stable" : "pending"} />
              <OisListItem title="Configuration coverage" description={`${configs.length} service profiles available`} meta="Infrastructure service controls" status={configs.length ? "stable" : "pending"} />
            </div>
          </OisCard>

          <OisCard className="p-5">
            <OisRegistryHeader title="Recent Activity" caption="Transactions and service activity already emitted by the backend." />
            <div className="mt-4 space-y-2">
              {payments.slice(0, 6).map((payment, index) => (
                <OisListItem
                  key={payment.id || payment.reference || index}
                  title={payment.service_title || payment.type || "Service transaction"}
                  description={`${payment.home_label || payment.home_name || "Home pending"} · ${payment.user_name || payment.user_email || "Resident pending"}`}
                  meta={when(payment.created_at)}
                  status={toneFor(payment.status)}
                />
              ))}
              {!payments.length ? <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">No service activity has synced yet.</div> : null}
            </div>
          </OisCard>
        </aside>
      </section>

      <OisDrawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? (KEY_LABELS[selected.service_key] || selected.service_title) : "Infrastructure service"}
        subtitle={selected ? selected.home_label || "Service record" : undefined}
        width="md"
      >
        {selected ? (
          <div className="space-y-4">
            <OisCard variant="evidence" className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-zinc-300">{selected.resident_name || "Resident pending assignment"} · {selected.provider || "Provider pending"}</p>
                  <p className="mt-2 text-xs text-zinc-500">{selected.identifier || "Identifier pending"} · {selected.last_transaction_status || "No transaction yet"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <OisStatusBadge status={toneFor(selected.provider_health)} label={String(selected.provider_health || "Unknown").replace(/_/g, " ")} />
                  <OisStatusBadge status={toneFor(selected.vending_readiness)} label={String(selected.vending_readiness || "Pending").replace(/_/g, " ")} />
                </div>
              </div>
            </OisCard>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Provider" value={selected.provider || "Pending source"} />
              <Field label="Identifier" value={selected.identifier || "Pending source"} />
              <Field label="Tariff profile" value={selected.tariff_profile || "Pending source"} />
              <Field label="Billing profile" value={selected.billing_profile || "Pending source"} />
              <Field label="Wallet link" value={selected.wallet_linked ? "Linked" : "Pending"} />
              <Field label="Last activity" value={when(selected.last_activity_at)} />
              <Field label="Outstanding" value={selected.outstanding != null ? formatMoney(Number(selected.outstanding), "NGN") : "No outstanding"} />
              <Field label="Plan / notes" value={selected.plan || selected.metadata?.service_notes || "Pending source"} />
            </div>
          </div>
        ) : null}
      </OisDrawer>
    </div>
  );
}
