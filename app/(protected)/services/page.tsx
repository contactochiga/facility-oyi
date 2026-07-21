"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { OisPageToolbar, OisRegistryHeader, OisRegistryPanel } from "@/components/ois";
import OisCard from "@/components/ois/OisCard";
import OisDrawer from "@/components/ois/OisDrawer";
import OisListItem from "@/components/ois/OisListItem";
import OisStatusBadge from "@/components/ois/OisStatusBadge";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { formatMoney } from "@/lib/format";
import { iconForTab } from "@/lib/oisIconRegistry";
import { facilityService, type InfrastructureServiceAccountRow, type InfrastructureServiceEventRow, type InfrastructureServiceTransactionRow } from "@/services/facilityService";
import { serviceConfigService, type ServiceConfig } from "@/services/serviceConfigService";
import { ArrowUpDown, ClipboardList, CloudCog, FileText, Plus, ShieldAlert, Zap } from "lucide-react";

const SERVICE_LABELS: Record<string, string> = {
  utility_token: "Electricity",
  water_service: "Water Supply",
  gas_service: "Gas",
  internet_service: "Internet",
  fiber_internet: "Fiber / ISP",
  generator_recovery: "Generator Recovery",
  solar_battery_service: "Solar / Battery",
  service_charge: "Estate Fees",
  other_facility_fees: "Facility Services",
};

const SERVICE_DOMAINS = [
  {
    key: "power",
    title: "Power & Energy",
    description: "Electricity, generator recovery, and solar continuity services.",
    serviceKeys: ["utility_token", "generator_recovery", "solar_battery_service"],
    iconKey: "power",
  },
  {
    key: "water",
    title: "Water",
    description: "Water supply, borehole, and metering readiness.",
    serviceKeys: ["water_service"],
    iconKey: "water",
  },
  {
    key: "internet",
    title: "Internet",
    description: "Fiber, ISP, and bandwidth-linked resident subscriptions.",
    serviceKeys: ["internet_service", "fiber_internet"],
    iconKey: "internet",
  },
  {
    key: "gas",
    title: "Gas",
    description: "Gas supply, refill readiness, and household continuity.",
    serviceKeys: ["gas_service"],
    iconKey: "gas",
  },
  {
    key: "fees",
    title: "Estate Fees",
    description: "Dues, levies, and service-charge policy execution.",
    serviceKeys: ["service_charge"],
    iconKey: "fees",
  },
  {
    key: "facility",
    title: "Facility Services",
    description: "Waste, sanitation, parking, and operational service support.",
    serviceKeys: ["other_facility_fees"],
    iconKey: "facility",
  },
  {
    key: "custom",
    title: "Custom",
    description: "Reserved for future resident-consumable services and special programs.",
    serviceKeys: [],
    iconKey: "custom",
  },
] as const;

const DOMAIN_FILTERS = ["All", ...SERVICE_DOMAINS.map((domain) => domain.title)] as const;
const TYPE_FILTERS = ["All", ...Array.from(new Set(Object.values(SERVICE_LABELS)))] as const;
const STATUS_FILTERS = ["All", "Ready", "Pending", "Issues"] as const;
const SORTS = ["Recent activity", "Resident", "Service", "Provider", "Status"] as const;

type DomainDefinition = (typeof SERVICE_DOMAINS)[number];

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
  if (eventType === "service.config.updated") return "Policy Updated";
  return eventType.replace(/\./g, " ");
}

function serviceDomainFor(serviceKey?: string | null) {
  const key = String(serviceKey || "").trim();
  return SERVICE_DOMAINS.find((domain) => (domain.serviceKeys as readonly string[]).includes(key)) || SERVICE_DOMAINS[SERVICE_DOMAINS.length - 1];
}

function matchesStatusFilter(account: InfrastructureServiceAccountRow, filter: (typeof STATUS_FILTERS)[number]) {
  if (filter === "All") return true;
  const haystack = `${account.status} ${account.vending_readiness} ${account.provider_health} ${account.last_transaction_status}`.toLowerCase();
  if (filter === "Ready") return /ready|stable|active/.test(haystack);
  if (filter === "Pending") return /pending|manual_review|setup/.test(haystack);
  return /issue|failed|warning|blocked|unsupported|degraded|offline/.test(haystack);
}

function policyMeta(config: ServiceConfig) {
  const raw = config.metadata && typeof config.metadata === "object" ? config.metadata : {};
  const policy = raw.policy && typeof raw.policy === "object" ? raw.policy : {};
  return {
    domain: String(policy.domain || serviceDomainFor(config.service_key).title),
    childLabel: String(policy.child_label || SERVICE_LABELS[config.service_key] || config.title || "Service"),
    policyLabel: String(policy.policy_label || `${SERVICE_LABELS[config.service_key] || config.title || "Service"} policy`),
    providerLane: String(policy.provider_lane || "provider"),
    version: String(policy.version || "v1"),
    effectiveFrom: String(policy.effective_from || config.updated_at || config.created_at || ""),
  };
}

function currencyValue(value?: number | string | null) {
  if (value == null || value === "") return "Not configured";
  const numeric = Number(value);
  return Number.isFinite(numeric) ? formatMoney(numeric, "NGN") : String(value);
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <OisCard variant="evidence" className="p-3">
      <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--ois-text-muted)]">{label}</div>
      <div className="mt-1 text-sm text-[var(--ois-text-primary)]">{value}</div>
    </OisCard>
  );
}

function inputClassName() {
  return "h-11 w-full rounded-[14px] border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none transition focus:border-sky-400/35";
}

export default function FacilityInfrastructureServicesPage() {
  const [loading, setLoading] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estateId, setEstateId] = useState("");
  const [configs, setConfigs] = useState<ServiceConfig[]>([]);
  const [accounts, setAccounts] = useState<InfrastructureServiceAccountRow[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<InfrastructureServiceTransactionRow[]>([]);
  const [events, setEvents] = useState<InfrastructureServiceEventRow[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<InfrastructureServiceAccountRow | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<DomainDefinition | null>(null);
  const [selectedPolicy, setSelectedPolicy] = useState<ServiceConfig | null>(null);
  const [policyDraft, setPolicyDraft] = useState({
    title: "",
    suggested_amount: "",
    unit_cost: "",
    unit_name: "",
    billing_mode: "fixed",
    policyVersion: "v1",
    effectiveFrom: "",
    resident_purchases_enabled: false,
    minimum_purchase_amount: "",
    maximum_purchase_amount: "",
    fixed_fee: "",
    percentage_fee: "",
    tax_percentage: "",
    fulfilment_method: "token",
    vending_mode: "facility",
    issuer_name: "",
    support_contact: "",
  });
  const [activeDomain, setActiveDomain] = useState<(typeof DOMAIN_FILTERS)[number]>("All");
  const [activeType, setActiveType] = useState<(typeof TYPE_FILTERS)[number]>("All");
  const [activeStatus, setActiveStatus] = useState<(typeof STATUS_FILTERS)[number]>("All");
  const [sortBy, setSortBy] = useState<(typeof SORTS)[number]>("Recent activity");
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

  useEffect(() => {
    if (!selectedPolicy) return;
    const meta = policyMeta(selectedPolicy);
    const electricity = selectedPolicy.metadata?.electricity && typeof selectedPolicy.metadata.electricity === "object" ? selectedPolicy.metadata.electricity : {};
    setPolicyDraft({
      title: selectedPolicy.title || SERVICE_LABELS[selectedPolicy.service_key] || "Service policy",
      suggested_amount: String(selectedPolicy.suggested_amount ?? ""),
      unit_cost: selectedPolicy.unit_cost == null ? "" : String(selectedPolicy.unit_cost),
      unit_name: String(selectedPolicy.unit_name || ""),
      billing_mode: String(selectedPolicy.billing_mode || "fixed"),
      policyVersion: meta.version,
      effectiveFrom: meta.effectiveFrom ? meta.effectiveFrom.slice(0, 16) : "",
      resident_purchases_enabled: Boolean(electricity.resident_purchases_enabled),
      minimum_purchase_amount: electricity.minimum_purchase_amount == null ? "" : String(electricity.minimum_purchase_amount),
      maximum_purchase_amount: electricity.maximum_purchase_amount == null ? "" : String(electricity.maximum_purchase_amount),
      fixed_fee: electricity.fixed_fee == null ? "" : String(electricity.fixed_fee),
      percentage_fee: electricity.percentage_fee == null ? "" : String(electricity.percentage_fee),
      tax_percentage: electricity.tax_percentage == null ? "" : String(electricity.tax_percentage),
      fulfilment_method: String(electricity.fulfilment_method || "token"),
      vending_mode: String(electricity.vending_mode || "facility"),
      issuer_name: String(electricity.issuer_name || ""),
      support_contact: String(electricity.support_contact || ""),
    });
  }, [selectedPolicy]);

  const attentionCount = useMemo(
    () => accounts.filter((account) => matchesStatusFilter(account, "Issues")).length,
    [accounts],
  );

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

  const operationalSuggestions = useMemo(() => [
    attentionCount
      ? "Review grouped service attention before resident-facing actions queue up."
      : "Infrastructure service posture is stable across active homes.",
    configs.some((item) => item.unit_cost == null && item.billing_mode !== "fixed")
      ? "Complete missing policy rates so billing and vending calculations stay consistent."
      : "Infrastructure policies are configured for the current service portfolio.",
    transactions.some((item) => /manual_review|unsupported/.test(String(item.status)))
      ? "Manual-review and unsupported transactions should be escalated before live provider execution."
      : "No manual-review service transactions are blocking the current lane.",
  ], [attentionCount, configs, transactions]);

  const groupedDomainCards = useMemo(() => SERVICE_DOMAINS.map((domain) => {
    const rows = accounts.filter((item) => (domain.serviceKeys as readonly string[]).includes(item.service_key));
    const latest = rows.slice().sort((a, b) => String(b.last_activity_at || "").localeCompare(String(a.last_activity_at || "")))[0];
    const providers = new Set(rows.map((item) => item.provider).filter(Boolean));
    return {
      ...domain,
      count: rows.length,
      active: rows.filter((item) => /ready|active|stable/.test(String(item.status || item.vending_readiness || "").toLowerCase())).length,
      issues: rows.filter((item) => matchesStatusFilter(item, "Issues")).length,
      providers: providers.size,
      latestActivity: latest?.last_activity_at || null,
      status: latest?.vending_readiness || latest?.status || (rows.length ? "Pending" : "No accounts"),
      childTypes: Array.from(new Set(rows.map((item) => SERVICE_LABELS[item.service_key] || item.service_title))),
      rows,
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
    return accounts
      .filter((account) => activeDomain === "All" || serviceDomainFor(account.service_key).title === activeDomain)
      .filter((account) => activeType === "All" || (SERVICE_LABELS[account.service_key] || account.service_title) === activeType)
      .filter((account) => matchesStatusFilter(account, activeStatus))
      .filter((account) => {
        if (!query) return true;
        return `${account.resident_name} ${account.home_label} ${account.service_title} ${account.identifier} ${account.provider} ${account.tariff_profile} ${account.billing_profile} ${account.status}`
          .toLowerCase()
          .includes(query);
      })
      .slice()
      .sort((a, b) => {
        if (sortBy === "Resident") return textFor(a.resident_name, "").localeCompare(textFor(b.resident_name, ""));
        if (sortBy === "Service") return textFor(SERVICE_LABELS[a.service_key] || a.service_title, "").localeCompare(textFor(SERVICE_LABELS[b.service_key] || b.service_title, ""));
        if (sortBy === "Provider") return textFor(a.provider, "").localeCompare(textFor(b.provider, ""));
        if (sortBy === "Status") return textFor(a.status, "").localeCompare(textFor(b.status, ""));
        return String(b.last_activity_at || "").localeCompare(String(a.last_activity_at || ""));
      });
  }, [accounts, activeDomain, activeStatus, activeType, search, sortBy]);

  const transactionSummary = useMemo(() => ({
    pending: transactions.filter((row) => ["pending", "pending_provider"].includes(String(row.status))).length,
    completed: transactions.filter((row) => String(row.status) === "completed").length,
    failed: transactions.filter((row) => String(row.status) === "failed").length,
    manualReview: transactions.filter((row) => String(row.status) === "manual_review").length,
    unsupported: transactions.filter((row) => String(row.status) === "unsupported").length,
  }), [transactions]);

  const strip = useMemo(() => {
    const providers = new Set(accounts.map((item) => item.provider).filter(Boolean));
    return [
      { label: "Attention", value: attentionCount, detail: "Operational review", tone: attentionCount ? "warning" : "stable" },
      { label: "Approvals", value: transactions.filter((item) => String(item.status) === "manual_review").length, detail: "Manual review queue", tone: "attention" },
      { label: "Escalated", value: transactions.filter((item) => String(item.status) === "failed").length, detail: "Failed service ops", tone: transactions.some((item) => String(item.status) === "failed") ? "warning" : "stable" },
      { label: "Provisioned", value: accounts.filter((item) => item.linked).length, detail: "Resident-bound services", tone: "stable" },
      { label: "Accounts", value: accounts.length, detail: "Canonical records", tone: "stable" },
      { label: "Providers", value: providers.size, detail: "Configured lanes", tone: "pending" },
      { label: "Transactions", value: transactions.length, detail: "Runtime records", tone: "pending" },
      { label: "Ready", value: accounts.filter((item) => item.vending_readiness === "ready").length, detail: "Vending-ready", tone: "stable" },
      { label: "Issues", value: attentionCount, detail: "Needs intervention", tone: attentionCount ? "warning" : "stable" },
    ] as Array<{ label: string; value: string | number; detail: string; tone: "attention" | "stable" | "warning" }>;
  }, [accounts, attentionCount, transactions]);

  async function savePolicy() {
    if (!selectedPolicy) return;
    setSavingPolicy(true);
    setError(null);
    const nextMetadata = {
      ...(selectedPolicy.metadata || {}),
      policy: {
        ...(selectedPolicy.metadata?.policy || {}),
        version: policyDraft.policyVersion.trim() || "v1",
        effective_from: policyDraft.effectiveFrom || new Date().toISOString(),
      },
      ...(selectedPolicy.service_key === "utility_token" ? {
        electricity: {
          ...(selectedPolicy.metadata?.electricity || {}),
          resident_purchases_enabled: Boolean(policyDraft.resident_purchases_enabled),
          tariff_per_kwh: policyDraft.unit_cost === "" ? null : Number(policyDraft.unit_cost),
          minimum_purchase_amount: policyDraft.minimum_purchase_amount === "" ? null : Number(policyDraft.minimum_purchase_amount),
          maximum_purchase_amount: policyDraft.maximum_purchase_amount === "" ? null : Number(policyDraft.maximum_purchase_amount),
          fixed_fee: policyDraft.fixed_fee === "" ? null : Number(policyDraft.fixed_fee),
          percentage_fee: policyDraft.percentage_fee === "" ? null : Number(policyDraft.percentage_fee),
          tax_percentage: policyDraft.tax_percentage === "" ? null : Number(policyDraft.tax_percentage),
          fulfilment_method: policyDraft.fulfilment_method,
          vending_mode: policyDraft.vending_mode,
          issuer_name: policyDraft.issuer_name.trim() || null,
          support_contact: policyDraft.support_contact.trim() || null,
          effective_from: policyDraft.effectiveFrom || new Date().toISOString(),
        },
      } : {}),
    };
    const result = await serviceConfigService.update(selectedPolicy.service_key, {
      estate_id: estateId,
      title: policyDraft.title,
      suggested_amount: policyDraft.suggested_amount === "" ? null : Number(policyDraft.suggested_amount),
      unit_cost: policyDraft.unit_cost === "" ? null : Number(policyDraft.unit_cost),
      unit_name: policyDraft.unit_name || null,
      billing_mode: policyDraft.billing_mode,
      metadata: nextMetadata,
    });
    setSavingPolicy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.config) {
      setConfigs((current) => current.map((item) => item.service_key === result.config?.service_key ? result.config : item));
      setSelectedPolicy(result.config);
    }
  }

  return (
    <div className="space-y-6">
      <Topbar
        title="Infrastructure Services"
        subtitle="Provisioning • Operations • Providers • Billing • Transactions • Intelligence"
        strip={strip}
      />

      {error ? <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}

      <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <OisCard className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-white/40">Awareness</div>
              <h2 className="mt-1 text-xl font-semibold text-white">Infrastructure service attention</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">Grouped service domains, provider readiness, billing posture, and runtime-backed operational signals.</p>
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
          <OisRegistryHeader title="Operational Suggestions" caption="Awareness-led actions from live grouped service posture." />
          <div className="mt-4 space-y-2">
            {operationalSuggestions.map((item, index) => (
              <OisListItem key={index} title={item} description="Generated from live service accounts, transactions, and provider posture." status={index === 0 ? "attention" : "stable"} />
            ))}
          </div>
        </OisCard>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {groupedDomainCards.map((domain) => {
          const Icon = iconForTab(domain.iconKey);
          return (
            <OisCard key={domain.key} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[16px] border border-white/10 bg-white/[0.04] text-white/82">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white">{domain.title}</div>
                    <div className="mt-1 text-xs leading-5 text-zinc-400">{domain.description}</div>
                  </div>
                </div>
                <OisStatusBadge status={toneFor(domain.status)} label={textFor(domain.status, "Pending")} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Field label="Accounts" value={domain.count} />
                <Field label="Active" value={domain.active} />
                <Field label="Issues" value={domain.issues} />
                <Field label="Providers" value={domain.providers} />
              </div>

              <div className="mt-4 text-xs text-zinc-500">
                {domain.childTypes.length ? domain.childTypes.join(" • ") : "Custom service domain reserved for future provisioning."}
              </div>
              <div className="mt-2 text-xs text-zinc-500">Latest activity · {when(domain.latestActivity)}</div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="ghost" className="h-9 rounded-[12px] px-3 text-xs" onClick={() => setSelectedDomain(domain)}>
                  View Domain
                </Button>
                <Button variant="ghost" className="h-9 rounded-[12px] px-3 text-xs" onClick={() => setActiveDomain(domain.title)}>
                  Focus Registry
                </Button>
              </div>
            </OisCard>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <OisRegistryPanel
          title="Infrastructure Policies"
          caption="Estate tariffs, billing rules, and provider-linked policy profiles. Service accounts bind to these active policies."
          action={<Button variant="ghost" className="h-9 gap-2 rounded-[12px] px-3"><Plus className="h-4 w-4" />Add Service</Button>}
          className="p-5"
        >
          <div className="space-y-2">
            {configs.map((config) => {
              const meta = policyMeta(config);
              return (
                <button key={config.service_key} type="button" onClick={() => setSelectedPolicy(config)} className="w-full text-left">
                  <div className="rounded-[18px] border border-white/[0.06] bg-white/[0.02] px-3 py-3 transition hover:bg-white/[0.04]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white">{meta.policyLabel}</div>
                        <div className="mt-1 text-xs text-zinc-400">{meta.domain} • {meta.childLabel}</div>
                        <div className="mt-1 text-[11px] text-zinc-500">
                          {currencyValue(config.unit_cost)} {config.unit_name ? `per ${config.unit_name}` : "rate pending"} • {textFor(config.billing_mode, "Billing pending")}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <OisStatusBadge status={config.active ? "stable" : "pending"} label={config.active ? "Active" : "Draft"} />
                        <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{meta.version}</span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </OisRegistryPanel>

        <OisCard className="p-5">
          <OisRegistryHeader title="Provider Registry" caption="Provider type, health, provisioning, transactions, and last sync." />
          <div className="mt-4 space-y-2">
            {providerRows.map((provider) => (
              <OisListItem
                key={provider.name}
                title={provider.name}
                description={`${provider.type} • Connected ${provider.connected} • Provisioning ${provider.provisioning}`}
                meta={`Transactions ${provider.transactions} • Last sync ${when(provider.lastSync)}`}
                status={toneFor(provider.health)}
              />
            ))}
            {!providerRows.length ? <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">Provider abstraction is awaiting linked service accounts.</div> : null}
          </div>
        </OisCard>
      </section>

      <OisRegistryPanel
        title="Service Registry"
        caption="Resident, home, grouped service domain, identifier, provider, tariff, billing, wallet, and latest operational state."
        toolbar={
          <OisPageToolbar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search resident, home, provider, identifier, tariff, or billing profile..."
            filterSlot={
              <div className="flex min-w-max items-center gap-1.5">
                {DOMAIN_FILTERS.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setActiveDomain(filter)}
                    className={`h-11 rounded-[12px] border px-3 text-xs transition ${activeDomain === filter ? "border-sky-300/30 bg-sky-400/12 text-sky-100" : "border-white/10 bg-white/[0.03] text-zinc-400"}`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            }
            sortSlot={
              <div className="flex items-center gap-1.5">
                <Button variant="ghost" className="h-11 gap-2 rounded-[12px] px-3" onClick={() => setSortBy(SORTS[(SORTS.indexOf(sortBy) + 1) % SORTS.length])}>
                  <ArrowUpDown className="h-4 w-4" />{sortBy}
                </Button>
                <Button variant="ghost" className="h-11 gap-2 rounded-[12px] px-3" onClick={() => setActiveStatus(STATUS_FILTERS[(STATUS_FILTERS.indexOf(activeStatus) + 1) % STATUS_FILTERS.length])}>
                  <ShieldAlert className="h-4 w-4" />{activeStatus}
                </Button>
              </div>
            }
            bulkSlot={
              <div className="flex items-center gap-1.5">
                <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <div className="flex min-w-max gap-1.5">
                    {TYPE_FILTERS.map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setActiveType(filter)}
                        className={`h-11 rounded-[12px] border px-3 text-xs transition ${activeType === filter ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100" : "border-white/10 bg-white/[0.03] text-zinc-400"}`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>
                <Button variant="ghost" className="h-11 rounded-[12px] px-3" onClick={() => setSelectedIds(selectedIds.length === filteredAccounts.length ? [] : filteredAccounts.map((item) => item.id))}>
                  {selectedIds.length ? `Bulk (${selectedIds.length})` : "Bulk Action"}
                </Button>
              </div>
            }
            onRefresh={() => void load()}
            refreshing={loading}
          />
        }
        className="p-5"
      >
        <div className="mb-3 hidden grid-cols-[1.05fr_0.95fr_0.9fr_0.85fr_0.9fr_0.7fr_0.7fr_0.7fr_0.65fr_0.85fr] gap-3 px-3 text-[10px] uppercase tracking-[0.16em] text-zinc-500 lg:grid">
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
            <button key={account.id} type="button" onClick={() => setSelectedAccount(account)} className="w-full text-left">
              <div className="rounded-[18px] border border-white/[0.06] bg-white/[0.02] px-3 py-3 transition hover:bg-white/[0.04]">
                <div className="flex items-start justify-between gap-3 lg:hidden">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white">{textFor(account.resident_name, "Resident pending")} • {textFor(SERVICE_LABELS[account.service_key] || account.service_title)}</div>
                    <div className="mt-1 text-xs text-zinc-400">{textFor(account.home_label)} • {serviceDomainFor(account.service_key).title} • {textFor(account.provider)}</div>
                    <div className="mt-1 text-[11px] text-zinc-500">{textFor(account.identifier)} • {textFor(account.tariff_profile)} • {when(account.last_activity_at)}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <OisStatusBadge status={toneFor(account.status)} label={textFor(account.status)} />
                    <OisStatusBadge status={toneFor(account.vending_readiness)} label={textFor(account.vending_readiness)} />
                  </div>
                </div>
                <div className="hidden items-center gap-3 lg:grid lg:grid-cols-[1.05fr_0.95fr_0.9fr_0.85fr_0.9fr_0.7fr_0.7fr_0.7fr_0.65fr_0.85fr]">
                  <span className="text-sm text-white">{textFor(account.resident_name, "Resident pending")}</span>
                  <span className="text-sm text-zinc-300">{textFor(account.home_label)}</span>
                  <span className="text-sm text-zinc-300">{textFor(SERVICE_LABELS[account.service_key] || account.service_title)}</span>
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

      <section className="grid gap-4 xl:grid-cols-[0.95fr_0.95fr_1.1fr]">
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
                title={`${textFor(SERVICE_LABELS[item.service_key] || item.service_key)} • ${textFor(item.transaction_type)}`}
                description={`${item.provider || "Provider pending"} • ${item.amount != null ? formatMoney(Number(item.amount), item.currency || "NGN") : "No amount"}`}
                meta={`${textFor(item.settlement_status)} • ${when(item.created_at)}`}
                status={toneFor(item.status)}
              />
            ))}
          </div>
        </OisCard>

        <OisCard className="p-5">
          <OisRegistryHeader title="Service Signals" caption="Runtime events coming from the service registry and Oyi Core signal flow." />
          <div className="mt-4 space-y-2">
            {events.slice(0, 8).map((event) => (
              <OisListItem
                key={event.id}
                title={eventLabel(event.event_type)}
                description={`${textFor(SERVICE_LABELS[event.service_key || ""] || event.service_key, "Infrastructure service")} • ${textFor((event.payload as any)?.reason || (event.payload as any)?.status, "Runtime event")}`}
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
                description={`${payment.home_label || payment.home_name || "Home pending"} • ${payment.user_name || payment.user_email || "Resident pending"}`}
                meta={`${payment.amount ? formatMoney(Number(payment.amount), "NGN") : "No amount"} • ${when(payment.created_at)}`}
                status={toneFor(payment.status)}
              />
            ))}
            {!payments.length ? <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">No infrastructure service activity has been recorded yet.</div> : null}
          </div>
        </OisCard>
      </section>

      <OisDrawer
        open={Boolean(selectedDomain)}
        onClose={() => setSelectedDomain(null)}
        title={selectedDomain?.title || "Infrastructure domain"}
        subtitle={selectedDomain?.description}
        width="md"
      >
        {selectedDomain ? (
          <div className="space-y-4">
            <OisCard variant="evidence" className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-zinc-300">{selectedDomain.title}</p>
                  <p className="mt-2 text-xs text-zinc-500">{selectedDomain.key === "custom" ? "Use Add Service to prepare future resident-consumable categories without introducing duplicate runtime logic." : "Child service types, active accounts, and latest operational signals."}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" className="h-9 rounded-[12px] px-3 text-xs" onClick={() => setActiveDomain(selectedDomain.title)}>Focus Registry</Button>
                  <Button variant="ghost" className="h-9 rounded-[12px] px-3 text-xs" onClick={() => setSelectedDomain(null)}>Close</Button>
                </div>
              </div>
            </OisCard>

            {selectedDomain.serviceKeys.length ? (
              <div className="space-y-3">
                {selectedDomain.serviceKeys.map((serviceKey) => {
                  const rows = accounts.filter((item) => item.service_key === serviceKey);
                  return (
                    <OisCard key={serviceKey} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-white">{SERVICE_LABELS[serviceKey] || serviceKey}</div>
                          <div className="mt-1 text-xs text-zinc-500">{rows.length} service accounts • {rows.filter((item) => matchesStatusFilter(item, "Issues")).length} pending issues</div>
                        </div>
                        <OisStatusBadge status={rows.some((item) => matchesStatusFilter(item, "Issues")) ? "warning" : "stable"} label={rows.length ? "Live" : "Awaiting provisioning"} />
                      </div>
                      <div className="mt-3 space-y-2">
                        {rows.slice(0, 4).map((row) => (
                          <OisListItem
                            key={row.id}
                            title={`${textFor(row.resident_name, "Resident pending")} • ${textFor(row.home_label)}`}
                            description={`${textFor(row.provider)} • ${textFor(row.identifier)} • ${textFor(row.billing_profile)}`}
                            meta={when(row.last_activity_at)}
                            status={toneFor(row.status || row.vending_readiness)}
                          />
                        ))}
                        {!rows.length ? <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">No service accounts have been provisioned for this child service type yet.</div> : null}
                      </div>
                    </OisCard>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">
                Custom services are reserved for future provider-linked categories such as additional estate support programs or partner services.
              </div>
            )}
          </div>
        ) : null}
      </OisDrawer>

      <OisDrawer
        open={Boolean(selectedAccount)}
        onClose={() => setSelectedAccount(null)}
        title={selectedAccount ? textFor(SERVICE_LABELS[selectedAccount.service_key] || selectedAccount.service_title) : "Infrastructure service"}
        subtitle={selectedAccount ? textFor(selectedAccount.home_label, "Service account") : undefined}
        width="md"
      >
        {selectedAccount ? (
          <div className="space-y-4">
            <OisCard variant="evidence" className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-zinc-300">{textFor(selectedAccount.resident_name, "Resident pending assignment")} • {textFor(selectedAccount.provider)}</p>
                  <p className="mt-2 text-xs text-zinc-500">{textFor(selectedAccount.identifier)} • {textFor(selectedAccount.last_transaction_status, "No transaction yet")}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <OisStatusBadge status={toneFor(selectedAccount.provider_health)} label={textFor(selectedAccount.provider_health, "Unknown")} />
                  <OisStatusBadge status={toneFor(selectedAccount.vending_readiness)} label={textFor(selectedAccount.vending_readiness, "Pending")} />
                </div>
              </div>
            </OisCard>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Resident" value={textFor(selectedAccount.resident_name, "Resident pending assignment")} />
              <Field label="Home" value={textFor(selectedAccount.home_label)} />
              <Field label="Domain" value={serviceDomainFor(selectedAccount.service_key).title} />
              <Field label="Service" value={textFor(SERVICE_LABELS[selectedAccount.service_key] || selectedAccount.service_title)} />
              <Field label="Identifier" value={textFor(selectedAccount.identifier)} />
              <Field label="Provider" value={textFor(selectedAccount.provider)} />
              <Field label="Tariff" value={textFor(selectedAccount.tariff_profile)} />
              <Field label="Billing" value={textFor(selectedAccount.billing_profile)} />
              <Field label="Wallet" value={selectedAccount.wallet_linked ? "Linked" : "Pending"} />
              <Field label="Outstanding" value={selectedAccount.outstanding != null ? formatMoney(Number(selectedAccount.outstanding), "NGN") : "No outstanding"} />
              <Field label="Last activity" value={when(selectedAccount.last_activity_at)} />
              <Field label="Transaction state" value={textFor(selectedAccount.last_transaction_status, "No transaction yet")} />
            </div>
          </div>
        ) : null}
      </OisDrawer>

      <OisDrawer
        open={Boolean(selectedPolicy)}
        onClose={() => setSelectedPolicy(null)}
        title={selectedPolicy ? policyMeta(selectedPolicy).policyLabel : "Infrastructure policy"}
        subtitle={selectedPolicy ? `${policyMeta(selectedPolicy).domain} • ${policyMeta(selectedPolicy).childLabel}` : undefined}
        width="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" className="h-10 rounded-[12px] px-4" onClick={() => setSelectedPolicy(null)}>Close</Button>
            <Button className="h-10 rounded-[12px] px-4" onClick={() => void savePolicy()} disabled={savingPolicy}>
              {savingPolicy ? "Saving..." : "Save Policy"}
            </Button>
          </div>
        }
      >
        {selectedPolicy ? (
          <div className="space-y-4">
            <OisCard variant="evidence" className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-white">{selectedPolicy.title || SERVICE_LABELS[selectedPolicy.service_key]}</div>
                  <div className="mt-1 text-xs text-zinc-500">Home provisioning binds service accounts to this policy and transaction receipts preserve the policy snapshot in runtime metadata.</div>
                </div>
                <OisStatusBadge status={selectedPolicy.active ? "stable" : "pending"} label={selectedPolicy.active ? "Active policy" : "Draft policy"} />
              </div>
            </OisCard>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.16em] text-zinc-500">Policy title</span>
                <input className={inputClassName()} value={policyDraft.title} onChange={(event) => setPolicyDraft((current) => ({ ...current, title: event.target.value }))} />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.16em] text-zinc-500">Suggested amount</span>
                <input className={inputClassName()} inputMode="decimal" value={policyDraft.suggested_amount} onChange={(event) => setPolicyDraft((current) => ({ ...current, suggested_amount: event.target.value }))} />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.16em] text-zinc-500">Unit rate</span>
                <input className={inputClassName()} inputMode="decimal" value={policyDraft.unit_cost} onChange={(event) => setPolicyDraft((current) => ({ ...current, unit_cost: event.target.value }))} />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.16em] text-zinc-500">Unit name</span>
                <input className={inputClassName()} value={policyDraft.unit_name} onChange={(event) => setPolicyDraft((current) => ({ ...current, unit_name: event.target.value }))} />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.16em] text-zinc-500">Billing mode</span>
                <select className={inputClassName()} value={policyDraft.billing_mode} onChange={(event) => setPolicyDraft((current) => ({ ...current, billing_mode: event.target.value }))}>
                  <option value="fixed">Fixed</option>
                  <option value="metered">Metered</option>
                  <option value="wallet_only">Wallet only</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.16em] text-zinc-500">Policy version</span>
                <input className={inputClassName()} value={policyDraft.policyVersion} onChange={(event) => setPolicyDraft((current) => ({ ...current, policyVersion: event.target.value }))} />
              </label>
              <label className="space-y-2 sm:col-span-2">
                <span className="text-xs uppercase tracking-[0.16em] text-zinc-500">Effective from</span>
                <input className={inputClassName()} type="datetime-local" value={policyDraft.effectiveFrom} onChange={(event) => setPolicyDraft((current) => ({ ...current, effectiveFrom: event.target.value }))} />
              </label>
              {selectedPolicy.service_key === "utility_token" ? (
                <>
                  <label className="flex items-center justify-between gap-3 rounded-[14px] border border-white/10 bg-white/[0.03] px-3 py-3 sm:col-span-2">
                    <span>
                      <span className="block text-xs uppercase tracking-[0.16em] text-zinc-500">Resident purchases</span>
                      <span className="mt-1 block text-xs text-zinc-500">Enable Buy Electricity for eligible home meters.</span>
                    </span>
                    <input type="checkbox" checked={policyDraft.resident_purchases_enabled} onChange={(event) => setPolicyDraft((current) => ({ ...current, resident_purchases_enabled: event.target.checked }))} />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.16em] text-zinc-500">Minimum purchase</span>
                    <input className={inputClassName()} inputMode="decimal" value={policyDraft.minimum_purchase_amount} onChange={(event) => setPolicyDraft((current) => ({ ...current, minimum_purchase_amount: event.target.value }))} />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.16em] text-zinc-500">Maximum purchase</span>
                    <input className={inputClassName()} inputMode="decimal" value={policyDraft.maximum_purchase_amount} onChange={(event) => setPolicyDraft((current) => ({ ...current, maximum_purchase_amount: event.target.value }))} />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.16em] text-zinc-500">Fixed fee</span>
                    <input className={inputClassName()} inputMode="decimal" value={policyDraft.fixed_fee} onChange={(event) => setPolicyDraft((current) => ({ ...current, fixed_fee: event.target.value }))} />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.16em] text-zinc-500">Percentage fee</span>
                    <input className={inputClassName()} inputMode="decimal" value={policyDraft.percentage_fee} onChange={(event) => setPolicyDraft((current) => ({ ...current, percentage_fee: event.target.value }))} />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.16em] text-zinc-500">Tax percentage</span>
                    <input className={inputClassName()} inputMode="decimal" value={policyDraft.tax_percentage} onChange={(event) => setPolicyDraft((current) => ({ ...current, tax_percentage: event.target.value }))} />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.16em] text-zinc-500">Fulfilment method</span>
                    <select className={inputClassName()} value={policyDraft.fulfilment_method} onChange={(event) => setPolicyDraft((current) => ({ ...current, fulfilment_method: event.target.value }))}>
                      <option value="token">Token</option>
                      <option value="direct_meter_credit">Direct meter credit</option>
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.16em] text-zinc-500">Vending mode</span>
                    <select className={inputClassName()} value={policyDraft.vending_mode} onChange={(event) => setPolicyDraft((current) => ({ ...current, vending_mode: event.target.value }))}>
                      <option value="facility">Facility controlled</option>
                      <option value="external_provider">External provider</option>
                      <option value="test">Test token mode</option>
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.16em] text-zinc-500">Receipt issuer</span>
                    <input className={inputClassName()} value={policyDraft.issuer_name} onChange={(event) => setPolicyDraft((current) => ({ ...current, issuer_name: event.target.value }))} />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.16em] text-zinc-500">Support contact</span>
                    <input className={inputClassName()} value={policyDraft.support_contact} onChange={(event) => setPolicyDraft((current) => ({ ...current, support_contact: event.target.value }))} />
                  </label>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
      </OisDrawer>
    </div>
  );
}
