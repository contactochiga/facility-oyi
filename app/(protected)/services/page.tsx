"use client";

import { useEffect, useMemo, useState } from "react";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { useSessionStore } from "@/store/useSessionStore";
import { walletsService } from "@/services/walletsService";
import { facilityService } from "@/services/facilityService";
import { formatMoney } from "@/lib/format";
import { CreditCard, Wallet, Zap, Wifi, Globe, Building2 } from "lucide-react";

type ServiceKey = "utility_token" | "internet_service" | "fiber_internet" | "service_charge";
type ServiceRow = {
  key: ServiceKey;
  title: string;
  desc: string;
  reason: string;
  suggested: number;
  icon: any;
};

const SERVICES: ServiceRow[] = [
  {
    key: "utility_token",
    title: "Electricity Tokens",
    desc: "Issue utility tokens paid from resident wallet balance.",
    reason: "utility_token_purchase",
    suggested: 5000,
    icon: Zap,
  },
  {
    key: "internet_service",
    title: "Internet Service",
    desc: "Charge internet package renewals via wallet.",
    reason: "internet_service_payment",
    suggested: 10000,
    icon: Wifi,
  },
  {
    key: "fiber_internet",
    title: "Fiber Internet",
    desc: "Process fiber broadband dues and renewals.",
    reason: "fiber_internet_payment",
    suggested: 15000,
    icon: Globe,
  },
  {
    key: "service_charge",
    title: "Service Charge",
    desc: "Collect estate service charge from wallets.",
    reason: "estate_service_charge",
    suggested: 25000,
    icon: Building2,
  },
];

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
    internet_service: "10000",
    fiber_internet: "15000",
    service_charge: "25000",
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

  const active = useMemo(() => SERVICES.find((s) => s.key === activeKey)!, [activeKey]);
  const activeAmount = parseNum(amounts[activeKey]);

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

  function setAmount(k: ServiceKey, v: string) {
    setAmounts((p) => ({ ...p, [k]: v }));
  }

  async function debitForService() {
    if (!activeAmount || activeAmount < 100) {
      setErr("Enter a valid amount (minimum 100).");
      return;
    }
    setBusy(true);
    setErr(null);
    setNotice(null);
    const res = await walletsService.debit(activeAmount, active.reason);
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

      <div className="grid gap-4 xl:grid-cols-[330px_1fr]">
        <div className="glass border border-white/10 rounded-2xl p-3 space-y-2">
          {SERVICES.map((s) => {
            const Icon = s.icon;
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
                  <div className="text-sm text-white font-semibold">{s.title}</div>
                </div>
                <div className="mt-1 text-xs text-zinc-400">{s.desc}</div>
              </button>
            );
          })}
        </div>

        <div className="glass border border-white/10 rounded-2xl p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm text-white font-semibold">{active.title}</div>
              <div className="text-xs text-zinc-400 mt-1">{active.desc}</div>
            </div>
            <div className="inline-flex items-center gap-2 text-xs text-zinc-400">
              <Wallet size={14} />
              wallet-linked
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 flex items-center gap-2">
            <span className="text-xs text-zinc-400">{currency}</span>
            <input
              value={amounts[activeKey]}
              onChange={(e) => setAmount(activeKey, e.target.value)}
              placeholder={String(active.suggested)}
              inputMode="numeric"
              className="flex-1 bg-transparent text-sm text-white outline-none"
            />
            <button
              onClick={() => setAmount(activeKey, String(active.suggested))}
              className="text-xs text-zinc-400 hover:text-zinc-200"
            >
              Reset
            </button>
          </div>

          <div className="mt-4 flex gap-2 flex-wrap">
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

