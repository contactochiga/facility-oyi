"use client";

import { useEffect, useMemo, useState } from "react";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { useSessionStore } from "@/store/useSessionStore";
import { walletsService } from "@/services/walletsService";
import { facilityService } from "@/services/facilityService";
import serviceConfigService, { type ServiceConfig, type ServiceKey } from "@/services/serviceConfigService";
import { formatMoney } from "@/lib/format";
import { CreditCard, Wallet, Zap, Wifi, Globe, Building2, Droplets, Layers3 } from "lucide-react";

type ServiceRow = {
  key: ServiceKey;
  title: string;
  desc: string;
  suggested: number;
  accountLabel: string;
  accountHint: string;
  icon: any;
};

const SERVICES: ServiceRow[] = [
  {
    key: "utility_token",
    title: "Electricity Metering",
    desc: "Set price per kWh and issue prepaid utility tokens from resident wallet balance.",
    suggested: 5000,
    accountLabel: "Electricity Meter",
    accountHint: "Linked from the home electricity meter",
    icon: Zap,
  },
  {
    key: "water_service",
    title: "Water Metering",
    desc: "Set price per cubic meter and charge water consumption or recharge against the linked water meter.",
    suggested: 12000,
    accountLabel: "Water Meter",
    accountHint: "Linked from the home water meter",
    icon: Droplets,
  },
  {
    key: "internet_service",
    title: "Fiber Internet Service",
    desc: "Set bundle pricing and charge internet package renewals via wallet.",
    suggested: 10000,
    accountLabel: "Internet ID",
    accountHint: "Linked from the home internet account",
    icon: Wifi,
  },
  {
    key: "fiber_internet",
    title: "Fiber Internet",
    desc: "Process fiber broadband dues and renewals.",
    suggested: 15000,
    accountLabel: "Fiber Account",
    accountHint: "Uses the same home internet identifier",
    icon: Globe,
  },
  {
    key: "service_charge",
    title: "Service Charge",
    desc: "Set the fixed monthly service charge collected from resident wallets.",
    suggested: 500000,
    accountLabel: "Home Account",
    accountHint: "Uses the linked home record",
    icon: Building2,
  },
  {
    key: "other_facility_fees",
    title: "Other Facility Fees",
    desc: "One-off charges, levies, and special estate fees.",
    suggested: 5000,
    accountLabel: "Home Account",
    accountHint: "Uses the linked home record",
    icon: Layers3,
  },
];

function pricingGuide(key: ServiceKey) {
  switch (key) {
    case "utility_token":
      return {
        label: "Metered billing",
        note: "Set unit cost as the estate electricity rate per kWh. Example: 300 NGN / kWh. Resident receipts and token generation will use this.",
      };
    case "internet_service":
      return {
        label: "Bundle / fixed pricing",
        note: "Use suggested amount for the main plan and unit name for the plan type. Consumer app currently exposes preset bundle purchases from this service.",
      };
    case "water_service":
      return {
        label: "Metered water billing",
        note: "Set unit cost as the estate water rate per cubic meter or billing unit. Example: 850 NGN / m3. Resident receipts will calculate from this tariff.",
      };
    case "fiber_internet":
      return {
        label: "Secondary fiber plan",
        note: "Keep this disabled unless you need a second separate internet billing stream.",
      };
    case "service_charge":
      return {
        label: "Fixed recurring charge",
        note: "Use a flat monthly amount. Suggested amount should be the monthly service charge billed to each linked home.",
      };
    default:
      return {
        label: "Partner / external service",
        note: "Use this for vendor-driven services such as gas refill or special facility fees that are charged through your estate operations flow.",
      };
  }
}

type ServiceConfigDraft = {
  title: string;
  description: string;
  suggested_amount: string;
  account_label: string;
  account_hint: string;
  active: boolean;
  unit_cost: string;
  unit_name: string;
  billing_mode: "wallet_only" | "metered" | "fixed";
};

type OpEntry = {
  id: string;
  serviceKey: ServiceKey;
  action: "debit" | "fund";
  amount: number;
  status: "success" | "failed";
  createdAt: string;
  note?: string;
};

function parseNum(v: string) {
  const n = Number(String(v || "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

export default function FacilityServicesPage() {
  const { user } = useSessionStore();
  const [activeKey, setActiveKey] = useState<ServiceKey>("utility_token");
  const [amounts, setAmounts] = useState<Record<ServiceKey, string>>({
    utility_token: "5000",
    water_service: "12000",
    internet_service: "10000",
    fiber_internet: "15000",
    service_charge: "25000",
    other_facility_fees: "5000",
  });

  const [walletBalance, setWalletBalance] = useState(0);
  const [currency, setCurrency] = useState("NGN");
  const [estateWallet, setEstateWallet] = useState({
    balance: 0,
    outstanding: 0,
    collectedMonth: 0,
  });
  const [ops, setOps] = useState<OpEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [configs, setConfigs] = useState<Partial<Record<ServiceKey, ServiceConfig>>>({});
  const [configFallback, setConfigFallback] = useState(false);
  const [configBusy, setConfigBusy] = useState(false);
  const [configDrafts, setConfigDrafts] = useState<Partial<Record<ServiceKey, ServiceConfigDraft>>>({});

  const active = useMemo(() => SERVICES.find((s) => s.key === activeKey)!, [activeKey]);
  const activeAmount = parseNum(amounts[activeKey]);
  const estateId = String((user as any)?.estate_id || "").trim();

  function mergedConfig(service: ServiceRow) {
    const cfg = configs[service.key];
    return {
      ...service,
      title: cfg?.title || service.title,
      desc: cfg?.description || service.desc,
      suggested: Number(cfg?.suggested_amount ?? service.suggested),
      accountLabel: cfg?.account_label || service.accountLabel,
      accountHint: cfg?.account_hint || service.accountHint,
      active: cfg?.active ?? true,
      currency: cfg?.currency || currency,
      unitCost: cfg?.unit_cost ?? null,
      unitName: cfg?.unit_name || null,
      billingMode: cfg?.billing_mode || "wallet_only",
    };
  }

  const activeConfig = useMemo(() => mergedConfig(active), [active, configs, currency]);
  const activeDraft = configDrafts[activeKey] || {
    title: activeConfig.title,
    description: activeConfig.desc,
    suggested_amount: String(activeConfig.suggested),
    account_label: activeConfig.accountLabel,
    account_hint: activeConfig.accountHint,
    active: activeConfig.active,
    unit_cost: activeConfig.unitCost == null ? "" : String(activeConfig.unitCost),
    unit_name: activeConfig.unitName || "",
    billing_mode: activeConfig.billingMode,
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem("facility_ops_services");
      const parsed = raw ? JSON.parse(raw) : [];
      setOps(Array.isArray(parsed) ? parsed : []);
    } catch {
      setOps([]);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("facility_ops_services", JSON.stringify(ops));
    } catch {
      // ignore
    }
  }, [ops]);

  async function loadWallets() {
    setErr(null);
    const [mine, overview] = await Promise.all([
      walletsService.getMyWallet(),
      facilityService.overview().catch(() => null),
    ]);

    if (mine?.error) setErr(mine.error);
    if (mine?.wallet) {
      setWalletBalance(Number(mine.wallet.balance || 0));
      setCurrency(String(mine.wallet.currency || "NGN"));
    }

    if (overview?.wallet) {
      setEstateWallet({
        balance: Number(overview.wallet.balance || 0),
        outstanding: Number(overview.wallet.outstanding_dues || 0),
        collectedMonth: Number(overview.wallet.collected_this_month || 0),
      });
    }
  }

  useEffect(() => {
    loadWallets();
  }, []);

  useEffect(() => {
    const run = async () => {
      if (!estateId) return;
      const res: any = await serviceConfigService.list(estateId);
      if (res?.error) {
        setErr(String(res.error));
        return;
      }
      const mapped = Object.fromEntries((res.configs || []).map((cfg: ServiceConfig) => [cfg.service_key, cfg])) as Partial<
        Record<ServiceKey, ServiceConfig>
      >;
      setConfigs(mapped);
      setConfigFallback(Boolean(res.using_fallback));
      setAmounts((prev) => {
        const next = { ...prev };
        for (const service of SERVICES) {
          const cfg = mapped[service.key];
          next[service.key] = String(Number(cfg?.suggested_amount ?? service.suggested));
        }
        return next;
      });
    };
    void run();
  }, [estateId]);

  function setAmount(k: ServiceKey, v: string) {
    setAmounts((p) => ({ ...p, [k]: v }));
  }

  function setDraftField(key: ServiceKey, field: keyof ServiceConfigDraft, value: string | boolean) {
    setConfigDrafts((prev) => ({
      ...prev,
      [key]: {
        title: prev[key]?.title ?? mergedConfig(SERVICES.find((s) => s.key === key)!).title,
        description: prev[key]?.description ?? mergedConfig(SERVICES.find((s) => s.key === key)!).desc,
        suggested_amount:
          prev[key]?.suggested_amount ?? String(mergedConfig(SERVICES.find((s) => s.key === key)!).suggested),
        account_label: prev[key]?.account_label ?? mergedConfig(SERVICES.find((s) => s.key === key)!).accountLabel,
        account_hint: prev[key]?.account_hint ?? mergedConfig(SERVICES.find((s) => s.key === key)!).accountHint,
        active: prev[key]?.active ?? mergedConfig(SERVICES.find((s) => s.key === key)!).active,
        unit_cost:
          prev[key]?.unit_cost ??
          (mergedConfig(SERVICES.find((s) => s.key === key)!).unitCost == null
            ? ""
            : String(mergedConfig(SERVICES.find((s) => s.key === key)!).unitCost)),
        unit_name: prev[key]?.unit_name ?? (mergedConfig(SERVICES.find((s) => s.key === key)!).unitName || ""),
        billing_mode: prev[key]?.billing_mode ?? mergedConfig(SERVICES.find((s) => s.key === key)!).billingMode,
        [field]: value,
      },
    }));
  }

  async function saveConfig() {
    if (!estateId) {
      setErr("No estate is linked to this operator session.");
      return;
    }

    const amount = parseNum(activeDraft.suggested_amount);
    if (amount < 0) {
      setErr("Suggested amount must be zero or greater.");
      return;
    }

    setConfigBusy(true);
    setErr(null);
    setNotice(null);
    const res: any = await serviceConfigService.save(activeKey, {
      estate_id: estateId,
      title: activeDraft.title.trim(),
      description: activeDraft.description.trim(),
      suggested_amount: amount,
      account_label: activeDraft.account_label.trim(),
      account_hint: activeDraft.account_hint.trim(),
      active: Boolean(activeDraft.active),
      currency,
      unit_cost: activeDraft.unit_cost === "" ? null : parseNum(activeDraft.unit_cost),
      unit_name: activeDraft.unit_name.trim() || null,
      billing_mode: activeDraft.billing_mode,
    });
    setConfigBusy(false);

    if (res?.error) {
      setErr(String(res.error));
      return;
    }

    const cfg = res?.config as ServiceConfig;
    setConfigs((prev) => ({ ...prev, [activeKey]: cfg }));
    setAmounts((prev) => ({ ...prev, [activeKey]: String(Number(cfg?.suggested_amount || 0)) }));
    setConfigDrafts((prev) => ({ ...prev, [activeKey]: undefined }));
    setConfigFallback(false);
    setNotice(`${cfg.title} configuration saved.`);
  }

  async function debitForService() {
    if (!activeAmount || activeAmount < 100) {
      setErr("Enter a valid amount (minimum 100).");
      return;
    }
    setBusy(true);
    setErr(null);
    setNotice(null);
    const res = await walletsService.debit(activeAmount, `service_payment:${active.key}`);
    setBusy(false);
    if (res?.error) {
      setErr(res.error);
      setOps((p) => [
        {
          id: `op_${Date.now()}`,
          serviceKey: active.key,
          action: "debit",
          amount: activeAmount,
          status: "failed",
          createdAt: new Date().toISOString(),
          note: res.error,
        },
        ...p,
      ]);
      return;
    }

    setWalletBalance(Number(res.balance || walletBalance));
    setNotice(`${active.title} debit processed.`);
    setOps((p) => [
      {
        id: `op_${Date.now()}`,
        serviceKey: active.key,
        action: "debit",
        amount: activeAmount,
        status: "success",
        createdAt: new Date().toISOString(),
      },
      ...p,
    ]);
    await loadWallets();
  }

  async function fundWallet() {
    const amount = activeAmount;
    const email = String((user as any)?.email || "").trim();
    if (!email) return setErr("Operator email not found in session.");
    if (!amount || amount < 100) return setErr("Enter an amount of at least 100.");

    setBusy(true);
    setErr(null);
    setNotice(null);
    const res = await walletsService.initPayment(amount, email);
    setBusy(false);
    if (res?.error) {
      setErr(res.error);
      setOps((p) => [
        {
          id: `op_${Date.now()}`,
          serviceKey: active.key,
          action: "fund",
          amount,
          status: "failed",
          createdAt: new Date().toISOString(),
          note: res.error,
        },
        ...p,
      ]);
      return;
    }

    const url =
      res?.data?.data?.authorization_url ||
      res?.data?.authorization_url ||
      null;
    if (url) {
      window.open(String(url), "_blank", "noopener,noreferrer");
    }

    setNotice("Funding initialized. Complete payment in opened Paystack tab.");
    setOps((p) => [
      {
        id: `op_${Date.now()}`,
        serviceKey: active.key,
        action: "fund",
        amount,
        status: "success",
        createdAt: new Date().toISOString(),
      },
      ...p,
    ]);
  }

  const activeOps = useMemo(() => ops.filter((x) => x.serviceKey === activeKey).slice(0, 12), [ops, activeKey]);

  return (
    <div className="space-y-7">
      <Topbar title="Services & Wallet Ops" subtitle="Billing workflow • service charges • utility operations" />

      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
        <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Access</div>
        <div className="mt-2 text-sm text-white">
          Sidebar {"->"} <span className="text-blue-300">Billing & Finance</span> {"->"} <span className="text-blue-300">Services & Wallet Ops</span>
        </div>
        <div className="mt-2 text-xs text-zinc-400">
          This is the page where you set estate service prices, meter billing rules, bundle pricing, and resident payment availability.
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="glass border border-white/10 rounded-2xl p-4">
          <div className="text-xs text-zinc-400">Operator Wallet</div>
          <div className="mt-1 text-2xl font-semibold text-white">{formatMoney(walletBalance, currency)}</div>
        </div>
        <div className="glass border border-white/10 rounded-2xl p-4">
          <div className="text-xs text-zinc-400">Estate Wallet</div>
          <div className="mt-1 text-2xl font-semibold text-white">{formatMoney(estateWallet.balance, currency)}</div>
        </div>
        <div className="glass border border-white/10 rounded-2xl p-4">
          <div className="text-xs text-zinc-400">Outstanding Dues</div>
          <div className="mt-1 text-2xl font-semibold text-amber-200">{formatMoney(estateWallet.outstanding, currency)}</div>
          <div className="text-[11px] text-zinc-500 mt-1">Collected this month: {formatMoney(estateWallet.collectedMonth, currency)}</div>
        </div>
      </div>

      {err ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</div>
      ) : null}
      {notice ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{notice}</div>
      ) : null}
      {configFallback ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Service configuration is still using backend defaults. Save estate billing config after creating the `estate_service_configs` table.
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[330px_1fr]">
        <div className="glass border border-white/10 rounded-2xl p-3 space-y-2">
          {SERVICES.map((s) => {
            const view = mergedConfig(s);
            const Icon = view.icon;
            return (
              <button
                key={s.key}
                onClick={() => setActiveKey(s.key)}
                className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                  activeKey === s.key
                    ? "border-blue-500/30 bg-blue-500/10"
                    : "border-white/10 bg-black/20 hover:bg-white/10"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon size={16} className="text-blue-300" />
                  <div className="text-sm text-white font-semibold">{view.title}</div>
                </div>
                <div className="mt-1 text-xs text-zinc-400">{view.desc}</div>
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className="text-zinc-500">{formatMoney(view.suggested, view.currency)}</span>
                  <span className={view.active ? "text-emerald-300" : "text-zinc-500"}>{view.active ? "Active" : "Disabled"}</span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="glass border border-white/10 rounded-2xl p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm text-white font-semibold">{activeConfig.title}</div>
              <div className="text-xs text-zinc-400 mt-1">{activeConfig.desc}</div>
            </div>
            <div className="inline-flex items-center gap-2 text-xs text-zinc-400">
              <Wallet size={14} />
              {activeConfig.active ? "wallet-linked" : "disabled"}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-blue-200">{pricingGuide(activeKey).label}</div>
            <div className="mt-2 text-sm text-white">{pricingGuide(activeKey).note}</div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-[11px] text-zinc-500">Display Title</div>
              <input
                value={activeDraft.title}
                onChange={(e) => setDraftField(activeKey, "title", e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
              />
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-[11px] text-zinc-500">Displayed Amount / Default Charge</div>
              <input
                value={activeDraft.suggested_amount}
                onChange={(e) => setDraftField(activeKey, "suggested_amount", e.target.value)}
                inputMode="numeric"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
              />
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3 md:col-span-2">
              <div className="text-[11px] text-zinc-500">Resident Description</div>
              <input
                value={activeDraft.description}
                onChange={(e) => setDraftField(activeKey, "description", e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
              />
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-[11px] text-zinc-500">Account Label</div>
              <input
                value={activeDraft.account_label}
                onChange={(e) => setDraftField(activeKey, "account_label", e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
              />
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-[11px] text-zinc-500">Account Hint</div>
              <input
                value={activeDraft.account_hint}
                onChange={(e) => setDraftField(activeKey, "account_hint", e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
              />
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-[11px] text-zinc-500">Unit Cost / Tariff</div>
              <input
                value={activeDraft.unit_cost}
                onChange={(e) => setDraftField(activeKey, "unit_cost", e.target.value)}
                inputMode="decimal"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
                placeholder={activeKey === "utility_token" ? "e.g. 300" : "e.g. 11500"}
              />
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-[11px] text-zinc-500">Unit Name / Measure</div>
              <input
                value={activeDraft.unit_name}
                onChange={(e) => setDraftField(activeKey, "unit_name", e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
                placeholder={activeKey === "utility_token" ? "kWh" : activeKey === "internet_service" ? "bundle" : "month"}
              />
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-[11px] text-zinc-500">Billing Mode</div>
              <select
                value={activeDraft.billing_mode}
                onChange={(e) => setDraftField(activeKey, "billing_mode", e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
              >
                <option value="wallet_only">Wallet Only</option>
                <option value="fixed">Fixed Charge</option>
                <option value="metered">Metered</option>
              </select>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-3">
            <div>
              <div className="text-sm text-white">Resident access</div>
              <div className="text-[11px] text-zinc-500">Disable this to hide payment from linked resident accounts.</div>
            </div>
            <button
              type="button"
              onClick={() => setDraftField(activeKey, "active", !activeDraft.active)}
              className={`rounded-full px-3 py-1 text-xs ${
                activeDraft.active ? "bg-emerald-500/15 text-emerald-200" : "bg-zinc-700 text-zinc-300"
              }`}
            >
              {activeDraft.active ? "Active" : "Disabled"}
            </button>
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 flex items-center gap-2">
            <span className="text-xs text-zinc-400">{activeConfig.currency}</span>
            <input
              value={amounts[activeKey]}
              onChange={(e) => setAmount(activeKey, e.target.value)}
              placeholder={String(activeConfig.suggested)}
              inputMode="numeric"
              className="flex-1 bg-transparent text-sm text-white outline-none"
            />
            <button
              onClick={() => setAmount(activeKey, String(activeConfig.suggested))}
              className="text-xs text-zinc-400 hover:text-zinc-200"
            >
              Reset
            </button>
          </div>

          <div className="mt-4 flex gap-2 flex-wrap">
            <Button variant="ghost" onClick={saveConfig} disabled={configBusy}>
              {configBusy ? "Saving..." : "Save Pricing & Billing"}
            </Button>
            <Button onClick={debitForService} disabled={busy}>
              <span className="inline-flex items-center gap-2"><CreditCard size={14} />Process Service Debit</span>
            </Button>
            <Button variant="ghost" onClick={fundWallet} disabled={busy}>
              Fund Wallet
            </Button>
            <Button variant="ghost" onClick={() => loadWallets()} disabled={busy}>
              Refresh
            </Button>
          </div>

          <div className="mt-5">
            <div className="text-xs text-zinc-400 mb-2">Recent Operations ({active.title})</div>
            <div className="space-y-2 max-h-64 overflow-auto">
              {activeOps.map((op) => (
                <div key={op.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm text-white">{op.action === "debit" ? "Service Debit" : "Wallet Funding"}</div>
                    <div
                      className={`text-[11px] px-2 py-0.5 rounded-full ${
                        op.status === "success"
                          ? "bg-emerald-500/15 text-emerald-200"
                          : "bg-red-500/15 text-red-200"
                      }`}
                    >
                      {op.status}
                    </div>
                  </div>
                  <div className="text-xs text-zinc-400 mt-1">{formatMoney(op.amount, currency)}</div>
                  <div className="text-[11px] text-zinc-500 mt-1">{new Date(op.createdAt).toLocaleString()}</div>
                  {op.note ? <div className="text-[11px] text-red-200 mt-1">{op.note}</div> : null}
                </div>
              ))}
              {!activeOps.length ? <div className="text-xs text-zinc-500">No operations yet.</div> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
