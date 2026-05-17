"use client";

import React, { useEffect, useMemo, useState } from "react";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { facilityService } from "@/services/facilityService";
import { walletsService } from "@/services/walletsService";
import { formatMoney } from "@/lib/format";
import type { ColumnDef } from "@tanstack/react-table";
import { Wallet, TrendingUp, AlertCircle, DollarSign } from "lucide-react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function MetricCard({
  title,
  value,
  hint,
  trend = "neutral",
  icon: Icon,
  iconColor = "text-blue-500",
}: {
  title: string;
  value: string | number;
  hint?: string;
  trend?: "up" | "down" | "neutral";
  icon: any;
  iconColor?: string;
}) {
  const trendColors: Record<string, string> = {
    up: "text-green-500",
    down: "text-red-500",
    neutral: "text-slate-400",
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-slate-400 mb-2">{title}</p>
          <p className="text-3xl font-semibold mb-1">{value}</p>
          {hint ? <p className={cn("text-sm", trendColors[trend] || "text-slate-400")}>{hint}</p> : null}
        </div>
        <div className={cn("p-3 rounded-lg bg-slate-800", iconColor)}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
}

type WalletActivityRow = {
  id: string;
  type: string;
  amount: number;
  status: string;
  reference?: string | null;
  created_at?: string | null;
  service_title?: string | null;
  user_name?: string | null;
  user_email?: string | null;
  home_name?: string | null;
  home_label?: string | null;
  token_code?: string | null;
  bundle_name?: string | null;
  period_label?: string | null;
};

function when(iso?: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function pill(s?: string) {
  const x = String(s || "").toLowerCase();
  if (x === "success" || x === "completed") {
    return "bg-emerald-500/15 text-emerald-200 border-emerald-500/20";
  }
  if (x === "failed" || x === "reversed") {
    return "bg-red-500/15 text-red-200 border-red-500/20";
  }
  return "bg-yellow-500/15 text-yellow-200 border-yellow-500/20";
}

export default function WalletsPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "transactions" | "outstanding" | "invoices">("overview");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [overviewWallet, setOverviewWallet] = useState<{
    balance: number;
    outstanding_dues: number;
    collected_this_month: number;
  } | null>(null);

  const [myWallet, setMyWallet] = useState<{ balance: number; currency: string }>({
    balance: 0,
    currency: "NGN",
  });

  const [rows, setRows] = useState<WalletActivityRow[]>([]);

  const [showDebit, setShowDebit] = useState(false);
  const [debitAmount, setDebitAmount] = useState("");
  const [debitReason, setDebitReason] = useState("service_charge");
  const canDebit = Number(debitAmount) > 0;

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const ov = await facilityService.overview();
      setOverviewWallet({
        balance: Number(ov?.wallet?.balance || 0),
        outstanding_dues: Number(ov?.wallet?.outstanding_dues || 0),
        collected_this_month: Number(ov?.wallet?.collected_this_month || 0),
      });

      const mine = await walletsService.getMyWallet();
      if (mine?.error) {
        setErr(mine.error);
      } else if (mine.wallet) {
        setMyWallet({
          balance: Number(mine.wallet.balance || 0),
          currency: String(mine.wallet.currency || "NGN"),
        });
      }

      const estateId = String((ov as any)?.estate?.id || (ov as any)?.estate_id || "").trim();
      if (estateId) {
        const tx = await facilityService.listEstateServicePayments(estateId, 80);
        setRows(Array.isArray(tx?.payments) ? tx.payments : []);
      } else {
        setRows([]);
      }
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Failed to load billing and finance");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runDebit() {
    if (!canDebit) return;
    setLoading(true);
    setErr(null);

    try {
      const amt = Number(debitAmount);
      const res = await walletsService.debit(amt, debitReason || "manual_debit");
      if (res.error) {
        setErr(res.error);
        return;
      }

      setMyWallet((p) => ({ ...p, balance: Number(res.balance ?? p.balance) }));
      setShowDebit(false);
      setDebitAmount("");
      setDebitReason("service_charge");
      await load();
    } finally {
      setLoading(false);
    }
  }

  const estateBalance = overviewWallet?.balance ?? 0;
  const estateOutstanding = overviewWallet?.outstanding_dues ?? 0;
  const estateCollected = overviewWallet?.collected_this_month ?? 0;

  const recognized = estateBalance + estateCollected + estateOutstanding;
  const collectionRate =
    estateOutstanding > 0
      ? Math.max(0, Math.min(100, Math.round((estateCollected / (estateCollected + estateOutstanding)) * 100)))
      : 100;

  const composition = useMemo(() => {
    const total = Math.max(1, recognized);
    return [
      {
        label: "Estate Wallet Balance",
        value: estateBalance,
        pct: Math.round((estateBalance / total) * 100),
        bar: "bg-blue-500",
      },
      {
        label: "Collected This Month",
        value: estateCollected,
        pct: Math.round((estateCollected / total) * 100),
        bar: "bg-emerald-500",
      },
      {
        label: "Outstanding Dues",
        value: estateOutstanding,
        pct: Math.round((estateOutstanding / total) * 100),
        bar: "bg-amber-500",
      },
    ];
  }, [estateBalance, estateCollected, estateOutstanding, recognized]);

  const columns = useMemo<ColumnDef<WalletActivityRow>[]>(
    () => [
      { accessorKey: "type", header: "Type" },
      {
        accessorKey: "service_title",
        header: "Service",
        cell: ({ row }) => (
          <div>
            <div className="text-sm text-white">{row.original.service_title || row.original.type}</div>
            <div className="text-[11px] text-white/50">
              {row.original.user_name || row.original.user_email || "-"}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "amount",
        header: "Amount",
        cell: ({ row }) => (
          <span className="font-semibold">
            {formatMoney(Number(row.original.amount || 0), myWallet.currency || "NGN")}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <span className={cn("inline-flex text-[11px] px-2 py-1 rounded-full border", pill(row.original.status))}>
            {String(row.original.status || "pending")}
          </span>
        ),
      },
      {
        accessorKey: "reference",
        header: "Reference",
        cell: ({ row }) => (
          <div className="text-xs text-white/70">
            <div className="font-mono">{row.original.reference || "-"}</div>
            {row.original.token_code ? <div className="text-emerald-300">Token: {row.original.token_code}</div> : null}
          </div>
        ),
      },
      {
        accessorKey: "created_at",
        header: "Created",
        cell: ({ row }) => <span className="text-white/70 text-xs">{when(row.original.created_at)}</span>,
      },
      {
        accessorKey: "home_name",
        header: "Home",
        cell: ({ row }) => (
          <div className="text-xs text-white/70">
            <div>{row.original.home_name || "-"}</div>
            {row.original.home_label ? <div className="text-white/45">{row.original.home_label}</div> : null}
          </div>
        ),
      },
    ],
    [myWallet.currency]
  );

  return (
    <div className="space-y-7">
      <Topbar title="Wallet Operations" subtitle="Live wallet flows from your facility backend" />

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowDebit(true)} disabled={loading}>
            Manual Debit
          </Button>
        </div>

        <Button variant="ghost" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {!!err && (
        <div className="border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-200 rounded-2xl">{err}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Collected (MTD)"
          value={formatMoney(estateCollected || 0, "NGN")}
          hint="From facility overview"
          trend="up"
          icon={DollarSign}
          iconColor="text-green-500"
        />
        <MetricCard
          title="Estate Wallet"
          value={formatMoney(estateBalance || 0, "NGN")}
          hint="Current aggregate balance"
          trend="neutral"
          icon={Wallet}
          iconColor="text-blue-500"
        />
        <MetricCard
          title="Outstanding Dues"
          value={formatMoney(estateOutstanding || 0, "NGN")}
          hint={estateOutstanding > 0 ? "Requires collection" : "No outstanding dues"}
          trend={estateOutstanding > 0 ? "down" : "up"}
          icon={AlertCircle}
          iconColor="text-amber-500"
        />
        <MetricCard
          title="Collection Rate"
          value={`${collectionRate}%`}
          hint="Collected vs outstanding"
          trend={collectionRate >= 75 ? "up" : "down"}
          icon={TrendingUp}
          iconColor="text-purple-500"
        />
      </div>

      <div className="mb-2">
        <div className="flex gap-2 border-b border-slate-800">
          {(["overview", "transactions", "outstanding", "invoices"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-6 py-3 text-sm font-medium transition-colors border-b-2",
                activeTab === tab
                  ? "border-blue-500 text-blue-500"
                  : "border-transparent text-slate-400 hover:text-white"
              )}
              type="button"
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">Wallet Composition</h3>
            <div className="space-y-4">
              {composition.map((item) => (
                <div key={item.label} className="p-4 bg-slate-800/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{item.label}</span>
                    <span className="text-lg font-semibold">{formatMoney(item.value || 0, "NGN")}</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div className={cn("h-2 rounded-full", item.bar)} style={{ width: `${item.pct}%` }} />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{item.pct}% of known finance total</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">Operator Wallet</h3>
            <div className="p-4 bg-slate-800/50 rounded-lg">
              <div className="text-xs text-slate-400">My Wallet Balance</div>
              <div className="text-xl font-semibold mt-1">
                {formatMoney(myWallet.balance || 0, myWallet.currency || "NGN")}
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-800">
              <h4 className="text-sm font-semibold mb-2">Finance Feed Status</h4>
              <p className="text-sm text-slate-400">
                Resident wallet-funded service payments now appear here with unit, resident, and receipt context.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === "transactions" && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Wallet Activity</h3>
          <DataTable data={rows} columns={columns} title="Backend Wallet Activity" searchKey={"reference"} />
          {!rows.length ? <div className="mt-3 text-sm text-slate-400">No service payment activity available yet.</div> : null}
        </div>
      )}

      {activeTab === "outstanding" && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Outstanding Summary</h3>
          {estateOutstanding > 0 ? (
            <div className="p-5 bg-slate-800/50 rounded-lg border border-amber-500/20">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold">Total Outstanding Dues</p>
                  <p className="text-sm text-slate-400">Aggregate amount pending across linked homes</p>
                </div>
                <p className="text-2xl font-semibold text-amber-400">{formatMoney(estateOutstanding, "NGN")}</p>
              </div>
              <p className="text-xs text-slate-500">Open homes, residents, or services modules to send reminders per unit.</p>
            </div>
          ) : (
            <div className="p-5 bg-slate-800/50 rounded-lg border border-emerald-500/20 text-sm text-slate-300">
              No outstanding dues at the moment.
            </div>
          )}
        </div>
      )}

      {activeTab === "invoices" && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-3">Invoice Operations</h3>
          <p className="text-sm text-slate-400 mb-6">
            This section is live-ready and intentionally empty until invoice template endpoints are connected.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-800/50 rounded-lg">
              <p className="text-xs text-slate-400">Templates</p>
              <p className="text-xl font-semibold mt-1">0</p>
            </div>
            <div className="p-4 bg-slate-800/50 rounded-lg">
              <p className="text-xs text-slate-400">Generated (MTD)</p>
              <p className="text-xl font-semibold mt-1">0</p>
            </div>
            <div className="p-4 bg-slate-800/50 rounded-lg">
              <p className="text-xs text-slate-400">Paid (MTD)</p>
              <p className="text-xl font-semibold mt-1">0</p>
            </div>
          </div>
        </div>
      )}

      {showDebit && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/70" onClick={() => !loading && setShowDebit(false)} />
          <div className="relative bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold">Manual Debit</div>
                <div className="text-sm text-slate-400 mt-1">Run a direct debit from the operator wallet.</div>
              </div>
              <button className="text-slate-400 hover:text-slate-200" onClick={() => !loading && setShowDebit(false)}>
                x
              </button>
            </div>

            <div className="grid gap-3 mt-5">
              <input
                className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-blue-500"
                placeholder="Amount (NGN)"
                value={debitAmount}
                onChange={(e) => setDebitAmount(e.target.value)}
                inputMode="decimal"
              />

              <input
                className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-blue-500"
                placeholder="Reason (e.g. service_charge)"
                value={debitReason}
                onChange={(e) => setDebitReason(e.target.value)}
              />

              <div className="flex gap-2 mt-2 justify-end">
                <Button variant="ghost" onClick={() => setShowDebit(false)} disabled={loading}>
                  Cancel
                </Button>
                <Button onClick={runDebit} disabled={loading || !canDebit}>
                  {loading ? "Debiting..." : "Debit"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
