"use client";

import { useEffect, useMemo, useState } from "react";
import { OisPageToolbar, OisRegistryHeader, OisRuntimeCard } from "@/components/ois";
import OisCard from "@/components/ois/OisCard";
import OisDrawer from "@/components/ois/OisDrawer";
import OisListItem from "@/components/ois/OisListItem";
import OisStatusBadge from "@/components/ois/OisStatusBadge";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { facilityService } from "@/services/facilityService";
import { serviceConfigService, type ServiceConfig } from "@/services/serviceConfigService";
import { formatMoney } from "@/lib/format";
import { Eye, RefreshCw, SlidersHorizontal, ToggleLeft, ToggleRight } from "lucide-react";

const FALLBACK_SERVICES: ServiceConfig[] = [
  { service_key: "utility_token", title: "Utility Token", description: "Resident electricity token purchase", active: true, status: "pending configuration", billing_mode: "metered" },
  { service_key: "water_service", title: "Water Service", description: "Water recharge and service billing", active: true, status: "pending configuration", billing_mode: "metered" },
  { service_key: "internet_service", title: "Internet Service", description: "Resident internet subscription services", active: true, status: "pending configuration", billing_mode: "fixed" },
  { service_key: "service_charge", title: "Service Charge", description: "Estate operational dues", active: true, status: "pending configuration", billing_mode: "fixed" },
  { service_key: "other_facility_fees", title: "Other Facility Fees", description: "Special estate fees", active: true, status: "pending configuration", billing_mode: "fixed" },
];

function lower(value: unknown) { return String(value || "").toLowerCase(); }
function serviceKey(config: ServiceConfig) { return String(config.service_key || config.key || "service"); }
function serviceTitle(config: ServiceConfig) { return String(config.title || serviceKey(config).replace(/_/g, " ")); }
function isEnabled(config: ServiceConfig) { return config.enabled ?? config.active ?? false; }
function readiness(config: ServiceConfig) {
  if (!isEnabled(config)) return "Unavailable";
  const status = lower(config.status);
  if (/maintenance/.test(status)) return "Maintenance mode";
  if (/pending|config/.test(status)) return "Pending readiness";
  return "Available";
}
function readinessTone(label: string) { if (label === "Available") return "stable"; if (label === "Maintenance mode") return "warning"; if (label === "Unavailable") return "unavailable"; return "pending"; }
function dateLabel(value?: string | null) { if (!value) return "Time unavailable"; const d = new Date(value); return Number.isNaN(d.getTime()) ? "Time unavailable" : d.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }); }

function Field({ label, value }: { label: string; value: React.ReactNode }) { return <OisCard variant="evidence" className="p-3"><div className="text-[10px] uppercase tracking-[0.14em] text-[var(--ois-text-muted)]">{label}</div><div className="mt-1 text-sm text-[var(--ois-text-primary)]">{value}</div></OisCard>; }

export default function FacilityServicesPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configs, setConfigs] = useState<ServiceConfig[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [wallet, setWallet] = useState({ balance: 0, outstanding: 0, collected: 0 });
  const [selected, setSelected] = useState<ServiceConfig | null>(null);

  async function load() {
    setLoading(true); setError(null); setNotice(null);
    try {
      const overview = await facilityService.overview().catch(() => null);
      const estateId = String((overview as any)?.estate?.id || (overview as any)?.estate_id || "").trim();
      setWallet({ balance: Number((overview as any)?.wallet?.balance || 0), outstanding: Number((overview as any)?.wallet?.outstanding_dues || 0), collected: Number((overview as any)?.wallet?.collected_this_month || 0) });
      const configResult = await serviceConfigService.list();
      setConfigError(configResult.error || null);
      setConfigs(configResult.configs.length ? configResult.configs : FALLBACK_SERVICES);
      if (estateId) {
        const paymentRows = await facilityService.listEstateServicePayments(estateId, 20).catch(() => ({ payments: [] }));
        setPayments(Array.isArray(paymentRows.payments) ? paymentRows.payments : []);
      } else setPayments([]);
    } catch (err: any) { setError(err?.message || "Failed to load service operations"); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function toggleService(config: ServiceConfig) {
    setSaving(true); setError(null); setNotice(null);
    const enabled = !isEnabled(config);
    const result = await serviceConfigService.update(serviceKey(config), { active: enabled, enabled });
    setSaving(false);
    if (result.error) { setError(result.error); return; }
    setNotice(`${serviceTitle(config)} updated.`);
    await load();
  }

  const enabled = configs.filter(isEnabled).length;
  const disabled = configs.length - enabled;
  const pending = configs.filter((config) => readiness(config) === "Pending readiness").length;

  const consumerImpact = useMemo(() => [
    { label: "Visitor services", enabled: true, source: "Security & Access / Visitors" },
    { label: "Maintenance services", enabled: configs.some((config) => /maintenance|service_charge|other/.test(serviceKey(config))), source: "Maintenance request flow" },
    { label: "Wallet services", enabled: configs.some(isEnabled), source: "Wallet-funded resident services" },
    { label: "Community services", enabled: true, source: "Community module" },
  ], [configs]);

  return (
    <div className="space-y-6">
      <Topbar title="Service Readiness" subtitle="Resident-facing service readiness, impact, and audit visibility" strip={[{ label: "Healthy", value: disabled ? "Mixed" : "Stable", detail: "Readiness posture", tone: disabled ? "warning" : "stable" }, { label: "Enabled", value: enabled, detail: "Resident-facing", tone: "attention" }, { label: "Pending", value: pending, detail: "Needs configuration", tone: "warning" }, { label: "Updated", value: loading ? "Refreshing" : "Now", detail: "Registry sync", tone: "info" }]} />
      <OisPageToolbar onRefresh={() => void load()} refreshing={loading} searchPlaceholder="Search service readiness..." />
      {error ? <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
      {notice ? <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{notice}</div> : null}
      {configError ? <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">Readiness source: {configError}. Showing contract defaults as Pending readiness, not live controls.</div> : null}

      <section className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <OisCard className="p-5">
          <OisRegistryHeader title="Service Registry" caption="Resident-facing services, readiness, and control state." />
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {configs.map((config) => {
              const ready = readiness(config);
              return <OisCard key={serviceKey(config)} variant="evidence" className="p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-white">{serviceTitle(config)}</h3><p className="mt-1 text-xs leading-5 text-zinc-500">{config.description || "No readiness description supplied."}</p></div><OisStatusBadge status={readinessTone(ready)} label={ready} className="uppercase" /></div><div className="mt-4 grid grid-cols-2 gap-2 text-xs"><Field label="Billing" value={config.billing_mode || "Pending source"} /><Field label="Suggested" value={config.suggested_amount ? formatMoney(Number(config.suggested_amount), "NGN") : "Pending source"} /></div><div className="mt-4 flex flex-wrap gap-2"><Button variant="ghost" onClick={() => setSelected(config)} className="gap-2"><Eye className="h-4 w-4" />Review</Button><Button variant={isEnabled(config) ? "secondary" : "primary"} onClick={() => void toggleService(config)} disabled={saving || Boolean(configError)} className="gap-2">{isEnabled(config) ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}{isEnabled(config) ? "Disable" : "Enable"}</Button></div></OisCard>;
            })}
          </div>
        </OisCard>

        <aside className="space-y-4">
          <OisCard className="p-5"><h2 className="text-sm font-semibold text-white">Consumer impact preview</h2><div className="mt-4 space-y-2">{consumerImpact.map((item) => <OisListItem key={item.label} title={item.label} description={item.source} status={item.enabled ? "stable" : "unavailable"} />)}</div></OisCard>
          <OisCard className="p-5"><h2 className="text-sm font-semibold text-white">Service finance signal</h2><div className="mt-4 grid gap-2"><Field label="Estate wallet" value={formatMoney(wallet.balance, "NGN")} /><Field label="Outstanding" value={formatMoney(wallet.outstanding, "NGN")} /><Field label="Collected this month" value={formatMoney(wallet.collected, "NGN")} /></div></OisCard>
          <OisCard className="p-5"><h2 className="text-sm font-semibold text-white">Readiness Activity</h2><p className="mt-2 text-sm leading-6 text-zinc-400">Audit events appear when the backend records service readiness changes. No local audit activity is fabricated.</p></OisCard>
        </aside>
      </section>

      <OisCard className="p-5"><OisRegistryHeader title="Resident Service Activity" caption="Recent payment and readiness signals from service usage." /><div className="mt-4 space-y-2">{payments.slice(0, 10).map((payment, index) => <OisListItem key={payment.id || payment.reference || index} title={payment.service_title || payment.type || "Service payment"} description={`${payment.home_label || payment.home_name || "Home pending"} · ${payment.amount ? formatMoney(Number(payment.amount), "NGN") : "Amount pending"}`} meta={dateLabel(payment.created_at)} status={readinessTone(payment.status || "Pending readiness")} />)}{!payments.length ? <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">No resident service activity has synced yet.</div> : null}</div></OisCard>

      <OisRuntimeCard
        title="Runtime Insights"
        items={[
          { label: "Resident-ready services", value: enabled, delta: "available for use" },
          { label: "Pending readiness", value: pending, delta: "need backend configuration" },
          { label: "Recent payments", value: payments.length, delta: "resident activity signals" },
        ]}
      />

      <OisDrawer open={Boolean(selected)} onClose={() => setSelected(null)} title={selected ? serviceTitle(selected) : "Service readiness"} subtitle={selected ? `Readiness · ${serviceKey(selected)}` : undefined} width="md">
        {selected ? <div className="space-y-4"><OisCard variant="evidence" className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-zinc-300">{selected.description || "No readiness description supplied."}</p><p className="mt-2 text-xs text-zinc-500">{selected.account_label || "Pending source"}</p></div><OisStatusBadge status={readinessTone(readiness(selected))} label={readiness(selected)} /></div></OisCard><div className="grid gap-3 sm:grid-cols-2"><Field label="Service key" value={serviceKey(selected)} /><Field label="Readiness" value={<OisStatusBadge status={readinessTone(readiness(selected))} label={readiness(selected)} />} /><Field label="Account label" value={selected.account_label || "Pending source"} /><Field label="Account hint" value={selected.account_hint || "Pending source"} /><Field label="Unit cost" value={selected.unit_cost ? formatMoney(Number(selected.unit_cost), "NGN") : "Pending source"} /><Field label="Updated" value={dateLabel(selected.updated_at)} /></div><div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm leading-6 text-zinc-400"><SlidersHorizontal className="mb-2 h-4 w-4 text-sky-200" />Readiness controls use <code>/services/config/:serviceKey</code>. If the operator lacks <code>settings.manage</code>, controls remain visible but fail closed through backend permissions.</div></div> : null}
      </OisDrawer>
    </div>
  );
}
