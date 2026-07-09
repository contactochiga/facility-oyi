"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { OisPageToolbar, OisRegistryHeader, OisRegistryPanel } from "@/components/ois";
import OisCard from "@/components/ois/OisCard";
import OisDrawer from "@/components/ois/OisDrawer";
import OisListItem from "@/components/ois/OisListItem";
import OisStatusBadge from "@/components/ois/OisStatusBadge";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { facilityService, type InfrastructureServiceAccountRow, type InfrastructureServiceEventRow, type InfrastructureServiceTransactionRow } from "@/services/facilityService";
import { serviceConfigService, type ServiceConfig } from "@/services/serviceConfigService";
import { formatMoney } from "@/lib/format";
import { Activity, ArrowUpDown, CheckCircle2, ClipboardList, CloudCog, FileText, RefreshCw, ShieldAlert, Sparkles, Zap } from "lucide-react";

const FILTERS = ["All", "Electricity", "Water", "Internet", "Gas", "Generator", "Solar", "Issues", "Ready", "Pending"] as const;
const SORTS = ["Recent activity", "Resident", "Service", "Provider", "Status"] as const;

const KEY_LABELS: Record<string, string> = {
  utility_token: "Electricity",
  water_service: "Water",
  gas_service: "Gas",
  internet_service: "Internet",
  fiber_internet: "Internet",
  generator_recovery: "Generator Recovery",
  solar_battery_service: "Solar & Battery",
  service_charge: "Estate Fees",
  other_facility_fees: "Facility Services",
};

const CATEGORY_ORDER = [
  "utility_token",
  "water_service",
  "gas_service",
  "internet_service",
  "generator_recovery",
  "solar_battery_service",
  "service_charge",
  "other_facility_fees",
] as const;

function toneFor(value?: string | null) {
  const text = String(value || "").toLowerCase();
  if (/ready|stable|active|available|online|completed/.test(text)) return "stable";
  if (/issue|failed|warning|degraded|blocked|manual_review/.test(text)) return "warning";
  if (/unsupported|offline|unavailable|cancelled/.test(text)) return "unavailable";
  return "pending";
}

function textFor(value: unknown, fallback = "Pending source") {
  const text = String(value ?? "").trim();
  return text || fallback;
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
  if (active === "Issues") return /issue|failed|warning|blocked|unsupported|degraded/.test(`${account.status} ${account.vending_readiness} ${account.provider_health}`.toLowerCase());
  if (active === "Ready") return String(account.vending_readiness || "").toLowerCase() === "ready";
  if (active === "Pending") return /pending|manual_review|setup/.test(`${account.status} ${account.vending_readiness} ${account.last_transaction_status}`.toLowerCase());
  return KEY_LABELS[account.service_key] === active;
}

function eventLabel(eventType: string) {
  if (eventType === "service.account.provisioned") return "Service Provisioned";
  if (eventType === "service.assignment.created") return "Service Assignment Created";
  if (eventType === "service.status.changed") return "Service Status Changed";
  if (eventType === "service.vending.ready") return "Vending Ready";
  if (eventType === "service.transaction.initiated") return "Transaction Initiated";
  if (eventType === "service.transaction.failed") return "Transaction Failed";
  if (eventType === "service.issue.reported") return "Issue Reported";
  if (eventType === "wallet.service_payment.updated") return "Payment Updated";
  if (eventType === "home.service_registry.updated") return "Registry Updated";
  return eventType.replace(/\./g, " ");
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <OisCard variant="evidence" className="p-3">
      <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--ois-text-muted)]">{label}</div>
      <div className="mt-1 text-sm text-[var(--ois-text-primary)]">{value}</div>
    </OisCard>
  );
}

export default function FacilityInfrastructureServicesPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estateId, setEstateId] = useState("");
  const [configs, setConfigs] = useState<ServiceConfig[]>([]);
  const [accounts, setAccounts] = useState<InfrastructureServiceAccountRow[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<InfrastructureServiceTransactionRow[]>([]);
  const [events, setEvents] = useState<InfrastructureServiceEventRow[]>([]);
  const [selected, setSelected] = useState<InfrastructureServiceAccountRow | null>(null);
  const [activeFilter, setActiveFilter] = useState<typeof FILTERS[number]>("All");
  const [sortBy, setSortBy] = useState<typeof SORTS[number]>("Recent activity");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const overview = await facilityService.overview().catch(() => null);
      const nextEstateId = String((overview as any)?.estate?.id || (overview as any)?.estate_id || "").trim();
      setEstateId(nextEstateId);
      const [configResult, accountResult, paymentResult, transactionResult, eventResult] = await Promise.all([
        serviceConfigService.list(),
        nextEstateId ? facilityService.listInfrastructureServiceAccounts({ estate_id: nextEstateId }) : Promise.resolve({ accounts: [] }),
        nextEstateId ? facilityService.listEstateServicePayments(nextEstateId, 20) : Promise.resolve({ payments: [] }),
        nextEstateId ? facilityService.listInfrastructureServiceTransactions(nextEstateId, 40) : Promise.resolve({ transactions: [], summary: {} }),
        nextEstateId ? facilityService.listInfrastructureServiceEvents(nextEstateId, 40) : Promise.resolve({ events: [] }),
      ]);
      setConfigs(configResult.configs || []);
      setAccounts(accountResult.accounts || []);
      setPayments(paymentResult.payments || []);
      setTransactions(transactionResult.transactions || []);
      setEvents(eventResult.events || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load infrastructure services");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const awareness = useMemo(() => {
    const electricityPending = accounts.filter((item) => item.service_key === "utility_token" && item.vending_readiness !== "ready").length;
    const internetRenewal = accounts.filter((item) => item.service_key === "internet_service" && /pending|setup|manual_review/.test(String(item.status || item.vending_readiness || "").toLowerCase())).length;
    const providerUnavailable = accounts.filter((item) => /offline|issues|degraded|unsupported/.test(String(item.provider_health || item.vending_readiness || "").toLowerCase())).length;
    const provisioningPending = accounts.filter((item) => /pending|setup_needed/.test(String(item.status || "").toLowerCase())).length;
    const billingIncomplete = accounts.filter((item) => !item.billing_profile).length;
    const settlementReview = transactions.filter((item) => /pending|unsupported|manual_review/.test(String(item.settlement_status || item.status || "").toLowerCase())).length;
    return [
      `${electricityPending} electricity accounts awaiting vending`,
      `${internetRenewal} internet subscriptions require renewal`,
      `${providerUnavailable} provider${providerUnavailable === 1 ? "" : "s"} unavailable`,
      `${provisioningPending} services pending provisioning`,
      `${billingIncomplete} billing profiles incomplete`,
      `${settlementReview} settlement queue requires review`,
    ];
  }, [accounts, transactions]);

  const overviewCards = useMemo(() => {
    const providers = new Set(accounts.map((item) => item.provider).filter(Boolean));
    return [
      { label: "Provisioned Services", value: accounts.filter((item) => item.linked).length, detail: "Resident-bound services" },
      { label: "Service Accounts", value: accounts.length, detail: "Canonical records" },
      { label: "Providers", value: providers.size, detail: "Configured providers" },
      { label: "Transactions", value: transactions.length, detail: "Service transaction records" },
      { label: "Ready for Vending", value: accounts.filter((item) => item.vending_readiness === "ready").length, detail: "Authorized routing ready" },
      { label: "Pending Issues", value: accounts.filter((item) => matchesFilter(item, "Issues")).length, detail: "Needs operator review" },
    ];
  }, [accounts, transactions]);

  const categoryCards = useMemo(() => CATEGORY_ORDER.map((serviceKey) => {
    const rows = accounts.filter((item) => item.service_key === serviceKey);
    const latest = rows.slice().sort((a, b) => String(b.last_activity_at || "").localeCompare(String(a.last_activity_at || "")))[0];
    return {
      key: serviceKey,
      title: KEY_LABELS[serviceKey],
      count: rows.length,
      provider: latest?.provider || "Pending source",
      status: latest?.status || "Pending",
      readiness: latest?.vending_readiness || "Pending",
      lastActivity: latest?.last_activity_at || null,
    };
  }), [accounts]);

  const providerRows = useMemo(() => {
    const byProvider = new Map<string, {
      name: string;
      type: string;
      health: string;
      connected: number;
      provisioning: number;
      transactions: number;
      lastSync: string | null;
    }>();
    for (const account of accounts) {
      const name = account.provider || "Provider pending";
      const current = byProvider.get(name) || {
        name,
        type: textFor(account.provider_type, "service provider"),
        health: account.provider_health || "unknown",
        connected: 0,
        provisioning: 0,
        transactions: 0,
        lastSync: null,
      };
      current.connected += account.linked ? 1 : 0;
      current.provisioning += /pending|setup|manual_review/.test(String(account.status || account.vending_readiness || "").toLowerCase()) ? 1 : 0;
      current.transactions += transactions.filter((row) => row.provider === account.provider).length;
      current.lastSync = current.lastSync && account.last_activity_at
        ? (new Date(current.lastSync) > new Date(account.last_activity_at) ? current.lastSync : account.last_activity_at)
        : current.lastSync || account.last_activity_at || null;
      if (/offline|degraded|issues|unsupported/.test(String(account.provider_health || "").toLowerCase())) current.health = account.provider_health || current.health;
      byProvider.set(name, current);
    }
    return [...byProvider.values()];
  }, [accounts, transactions]);

  const filteredAccounts = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = accounts.filter((account) => matchesFilter(account, activeFilter)).filter((account) => {
      if (!query) return true;
      return `${account.resident_name} ${account.home_label} ${account.service_title} ${account.identifier} ${account.provider} ${account.tariff_profile} ${account.billing_profile} ${account.status}`
        .toLowerCase()
        .includes(query);
    });
    return rows.slice().sort((a, b) => {
      if (sortBy === "Resident") return textFor(a.resident_name, "").localeCompare(textFor(b.resident_name, ""));
      if (sortBy === "Service") return textFor(KEY_LABELS[a.service_key], "").localeCompare(textFor(KEY_LABELS[b.service_key], ""));
      if (sortBy === "Provider") return textFor(a.provider, "").localeCompare(textFor(b.provider, ""));
      if (sortBy === "Status") return textFor(a.status, "").localeCompare(textFor(b.status, ""));
      return String(b.last_activity_at || "").localeCompare(String(a.last_activity_at || ""));
    });
  }, [accounts, activeFilter, search, sortBy]);

  const transactionSummary = useMemo(() => ({
    pending: transactions.filter((row) => ["pending", "pending_provider"].includes(String(row.status))).length,
    completed: transactions.filter((row) => String(row.status) === "completed").length,
    failed: transactions.filter((row) => String(row.status) === "failed").length,
    manualReview: transactions.filter((row) => String(row.status) === "manual_review").length,
    unsupported: transactions.filter((row) => String(row.status) === "unsupported").length,
  }), [transactions]);

  const operationalSuggestions = useMemo(() => [
    accounts.some((item) => item.vending_readiness !== "ready")
      ? "Review electricity and provider readiness before resident vending requests queue up."
      : "Electricity provisioning posture is stable across active homes.",
    accounts.some((item) => !item.billing_profile)
      ? "Complete missing billing profiles so resident cards and settlement routing stay aligned."
      : "Billing profiles are complete for the current service registry.",
    transactions.some((item) => /manual_review|unsupported/.test(String(item.status)))
      ? "Manual-review and unsupported transactions should be escalated before enabling live provider execution."
      : "No manual-review service transactions are blocking the current service lane.",
  ], [accounts, transactions]);

  return (
    <div className="space-y-6">
      <Topbar
        title="Infrastructure Services"
        subtitle="Provisioning • Operations • Providers • Billing • Transactions • Intelligence"
        strip={[
          { label: "Attention", value: accounts.filter((item) => matchesFilter(item, "Issues")).length, detail: "Operational review", tone: accounts.some((item) => matchesFilter(item, "Issues")) ? "warning" : "stable" },
          { label: "Approvals", value: transactions.filter((item) => String(item.status) === "manual_review").length, detail: "Manual review queue", tone: "attention" },
          { label: "Escalated", value: transactions.filter((item) => String(item.status) === "failed").length, detail: "Failed service operations", tone: transactions.some((item) => String(item.status) === "failed") ? "warning" : "stable" },
        ]}
      />

      {error ? <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}

      <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <OisCard className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-white/40">Awareness</div>
              <h2 className="mt-1 text-xl font-semibold text-white">Infrastructure service attention</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">Resident-consumable services, provider readiness, billing posture, and runtime-backed operational signals.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" className="gap-2"><Zap className="h-4 w-4" />Provision Service</Button>
              <Button variant="ghost" className="gap-2"><CloudCog className="h-4 w-4" />Providers</Button>
              <Button variant="ghost" className="gap-2"><ClipboardList className="h-4 w-4" />Transactions</Button>
              <Button variant="ghost" className="gap-2"><FileText className="h-4 w-4" />Reports</Button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {awareness.map((item) => (
              <span key={item} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-300">
                {item}
              </span>
            ))}
          </div>
        </OisCard>

        <OisCard className="p-5">
          <OisRegistryHeader title="Operational Suggestions" caption="Awareness-led service actions from live registry posture." />
          <div className="mt-4 space-y-2">
            {operationalSuggestions.map((item, index) => (
              <OisListItem key={index} title={item} description="Generated from live service accounts, transactions, and provider posture." status={index === 0 ? "attention" : "stable"} />
            ))}
          </div>
        </OisCard>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {overviewCards.map((card) => (
          <OisCard key={card.label} className="p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{card.label}</div>
            <div className="mt-2 text-2xl font-semibold text-white">{card.value}</div>
            <div className="mt-1 text-sm text-zinc-400">{card.detail}</div>
          </OisCard>
        ))}
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {categoryCards.map((card) => (
          <OisCard key={card.key} className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">{card.title}</div>
                <div className="mt-1 text-xs text-zinc-500">{card.count} provisioned accounts</div>
              </div>
              <OisStatusBadge status={toneFor(card.readiness)} label={textFor(card.readiness, "Pending")} />
            </div>
            <div className="mt-3 grid gap-2 text-xs">
              <Field label="Provider" value={textFor(card.provider)} />
              <Field label="Status" value={textFor(card.status)} />
              <Field label="Last activity" value={when(card.lastActivity)} />
            </div>
          </OisCard>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <OisRegistryPanel
          title="Service Registry"
          caption="Resident, home, service, identifier, provider, tariff, billing, wallet, and latest operational state."
          toolbar={
            <OisPageToolbar
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search resident, home, provider, identifier, tariff, or billing profile..."
              filterSlot={
                <div className="flex min-w-max items-center gap-1.5">
                  {FILTERS.map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setActiveFilter(filter)}
                      className={`h-11 rounded-[12px] border px-3 text-xs transition ${activeFilter === filter ? "border-sky-300/30 bg-sky-400/12 text-sky-100" : "border-white/10 bg-white/[0.03] text-zinc-400"}`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              }
              sortSlot={
                <Button variant="ghost" className="h-11 gap-2 rounded-[12px] px-3" onClick={() => setSortBy(SORTS[(SORTS.indexOf(sortBy) + 1) % SORTS.length])}>
                  <ArrowUpDown className="h-4 w-4" />{sortBy}
                </Button>
              }
              bulkSlot={
                <Button variant="ghost" className="h-11 rounded-[12px] px-3" onClick={() => setSelectedIds(selectedIds.length === filteredAccounts.length ? [] : filteredAccounts.map((item) => item.id))}>
                  {selectedIds.length ? `Bulk (${selectedIds.length})` : "Bulk Action"}
                </Button>
              }
              onRefresh={() => void load()}
              refreshing={loading}
            />
          }
          className="p-5"
        >
          <div className="mb-3 hidden grid-cols-[1.1fr_1fr_0.85fr_0.95fr_0.9fr_0.8fr_0.8fr_0.7fr_0.65fr_0.9fr] gap-3 px-3 text-[10px] uppercase tracking-[0.16em] text-zinc-500 lg:grid">
            <span>Resident</span>
            <span>Home</span>
            <span>Service</span>
            <span>Identifier</span>
            <span>Provider</span>
            <span>Tariff</span>
            <span>Billing</span>
            <span>Status</span>
            <span>Wallet</span>
            <span>Last Activity</span>
          </div>
          <div className="space-y-2">
            {filteredAccounts.map((account) => (
              <button key={account.id} type="button" onClick={() => setSelected(account)} className="w-full text-left">
                <div className="rounded-[18px] border border-white/[0.06] bg-white/[0.02] px-3 py-3 transition hover:bg-white/[0.04]">
                  <div className="flex items-start justify-between gap-3 lg:hidden">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white">{textFor(account.resident_name, "Resident pending")} · {textFor(KEY_LABELS[account.service_key] || account.service_title)}</div>
                      <div className="mt-1 text-xs text-zinc-400">{textFor(account.home_label)} · {textFor(account.provider)} · {textFor(account.identifier)}</div>
                      <div className="mt-1 text-[11px] text-zinc-500">{textFor(account.tariff_profile)} · {textFor(account.billing_profile)} · {when(account.last_activity_at)}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <OisStatusBadge status={toneFor(account.status)} label={textFor(account.status)} />
                      <OisStatusBadge status={toneFor(account.vending_readiness)} label={textFor(account.vending_readiness)} />
                    </div>
                  </div>
                  <div className="hidden items-center gap-3 lg:grid lg:grid-cols-[1.1fr_1fr_0.85fr_0.95fr_0.9fr_0.8fr_0.8fr_0.7fr_0.65fr_0.9fr]">
                    <span className="text-sm text-white">{textFor(account.resident_name, "Resident pending")}</span>
                    <span className="text-sm text-zinc-300">{textFor(account.home_label)}</span>
                    <span className="text-sm text-zinc-300">{textFor(KEY_LABELS[account.service_key] || account.service_title)}</span>
                    <span className="text-sm text-zinc-300">{textFor(account.identifier)}</span>
                    <span className="text-sm text-zinc-300">{textFor(account.provider)}</span>
                    <span className="text-sm text-zinc-300">{textFor(account.tariff_profile)}</span>
                    <span className="text-sm text-zinc-300">{textFor(account.billing_profile)}</span>
                    <span><OisStatusBadge status={toneFor(account.status)} label={textFor(account.status)} /></span>
                    <span className="text-sm text-zinc-300">{account.wallet_linked ? "Linked" : "Pending"}</span>
                    <span className="text-sm text-zinc-300">{when(account.last_activity_at)}</span>
                  </div>
                </div>
              </button>
            ))}
            {!filteredAccounts.length ? <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">No service records match the current search and filter state.</div> : null}
          </div>
        </OisRegistryPanel>

        <aside className="space-y-4">
          <OisCard className="p-5">
            <OisRegistryHeader title="Provider Registry" caption="Provider type, health, provisioning, transactions, and last sync." />
            <div className="mt-4 space-y-2">
              {providerRows.map((provider) => (
                <OisListItem
                  key={provider.name}
                  title={provider.name}
                  description={`${provider.type} · Connected ${provider.connected} · Provisioning ${provider.provisioning}`}
                  meta={`Transactions ${provider.transactions} · Last sync ${when(provider.lastSync)}`}
                  status={toneFor(provider.health)}
                />
              ))}
              {!providerRows.length ? <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">Provider abstraction is awaiting linked service accounts.</div> : null}
            </div>
          </OisCard>

          <OisCard className="p-5">
            <OisRegistryHeader title="Transactions" caption="Pending, completed, failed, manual review, unsupported, and settlement status." />
            <div className="mt-4 grid gap-2">
              <Field label="Pending" value={transactionSummary.pending} />
              <Field label="Completed" value={transactionSummary.completed} />
              <Field label="Failed" value={transactionSummary.failed} />
              <Field label="Manual Review" value={transactionSummary.manualReview} />
              <Field label="Unsupported" value={transactionSummary.unsupported} />
            </div>
            <div className="mt-4 space-y-2">
              {transactions.slice(0, 6).map((item) => (
                <OisListItem
                  key={item.id}
                  title={`${textFor(KEY_LABELS[item.service_key] || item.service_key)} · ${textFor(item.transaction_type)}`}
                  description={`${item.provider || "Provider pending"} · ${item.amount != null ? formatMoney(Number(item.amount), item.currency || "NGN") : "No amount"}`}
                  meta={`${textFor(item.settlement_status)} · ${when(item.created_at)}`}
                  status={toneFor(item.status)}
                />
              ))}
            </div>
          </OisCard>
        </aside>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <OisCard className="p-5">
          <OisRegistryHeader title="Service Signals" caption="Runtime events coming from the service registry and Oyi Core signal flow." />
          <div className="mt-4 space-y-2">
            {events.slice(0, 10).map((event) => (
              <OisListItem
                key={event.id}
                title={eventLabel(event.event_type)}
                description={`${textFor(KEY_LABELS[event.service_key || ""] || event.service_key, "Infrastructure service")} · ${textFor((event.payload as any)?.reason || (event.payload as any)?.status, "Runtime event")}`}
                meta={when(event.created_at)}
                status={toneFor(event.event_type)}
              />
            ))}
            {!events.length ? <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">No infrastructure service runtime events have synced yet.</div> : null}
          </div>
        </OisCard>

        <OisCard className="p-5">
          <OisRegistryHeader title="Activity" caption="Infrastructure-related operational history from the existing activity and payment pipeline." />
          <div className="mt-4 space-y-2">
            {payments.slice(0, 8).map((payment, index) => (
              <OisListItem
                key={payment.id || payment.reference || index}
                title={payment.service_title || payment.type || "Infrastructure service activity"}
                description={`${payment.home_label || payment.home_name || "Home pending"} · ${payment.user_name || payment.user_email || "Resident pending"}`}
                meta={`${payment.amount ? formatMoney(Number(payment.amount), "NGN") : "No amount"} · ${when(payment.created_at)}`}
                status={toneFor(payment.status)}
              />
            ))}
            {!payments.length ? <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">No infrastructure service activity has been recorded yet.</div> : null}
          </div>
        </OisCard>
      </section>

      <OisDrawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? textFor(KEY_LABELS[selected.service_key] || selected.service_title) : "Infrastructure service"}
        subtitle={selected ? textFor(selected.home_label, "Service account") : undefined}
        width="md"
      >
        {selected ? (
          <div className="space-y-4">
            <OisCard variant="evidence" className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-zinc-300">{textFor(selected.resident_name, "Resident pending assignment")} · {textFor(selected.provider)}</p>
                  <p className="mt-2 text-xs text-zinc-500">{textFor(selected.identifier)} · {textFor(selected.last_transaction_status, "No transaction yet")}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <OisStatusBadge status={toneFor(selected.provider_health)} label={textFor(selected.provider_health, "Unknown")} />
                  <OisStatusBadge status={toneFor(selected.vending_readiness)} label={textFor(selected.vending_readiness, "Pending")} />
                </div>
              </div>
            </OisCard>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Resident" value={textFor(selected.resident_name, "Resident pending assignment")} />
              <Field label="Home" value={textFor(selected.home_label)} />
              <Field label="Service" value={textFor(KEY_LABELS[selected.service_key] || selected.service_title)} />
              <Field label="Identifier" value={textFor(selected.identifier)} />
              <Field label="Provider" value={textFor(selected.provider)} />
              <Field label="Tariff" value={textFor(selected.tariff_profile)} />
              <Field label="Billing" value={textFor(selected.billing_profile)} />
              <Field label="Wallet" value={selected.wallet_linked ? "Linked" : "Pending"} />
              <Field label="Outstanding" value={selected.outstanding != null ? formatMoney(Number(selected.outstanding), "NGN") : "No outstanding"} />
              <Field label="Last activity" value={when(selected.last_activity_at)} />
              <Field label="Transaction state" value={textFor(selected.last_transaction_status, "No transaction yet")} />
              <Field label="Service notes" value={textFor(selected.plan || selected.metadata?.service_notes)} />
            </div>
          </div>
        ) : null}
      </OisDrawer>
    </div>
  );
}
