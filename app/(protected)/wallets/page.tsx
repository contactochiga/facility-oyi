// app/(protected)/wallets/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { facilityService } from "@/services/facilityService";
import { walletsService } from "@/services/walletsService";
import { formatMoney } from "@/lib/format";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Wallet,
  TrendingUp,
  AlertCircle,
  DollarSign,
  CreditCard,
  Download,
  Eye,
} from "lucide-react";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// -------------------------------
// MetricCard (kept local so nothing breaks)
// -------------------------------
function MetricCard({
  title,
  value,
  change,
  trend = "neutral",
  icon: Icon,
  iconColor = "text-blue-500",
}: {
  title: string;
  value: string | number;
  change?: string;
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
          {change ? (
            <p className={`text-sm ${trendColors[trend] || "text-slate-400"}`}>
              {change}
            </p>
          ) : null}
        </div>
        <div className={`p-3 rounded-lg bg-slate-800 ${iconColor}`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
}

// -------------------------------
// Types (kept from your current Wallets page)
// -------------------------------
type WalletActivityRow = {
  id: string;
  type: string;
  amount: number;
  status: string;
  reference?: string | null;
  created_at?: string | null;
};

function when(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function pill(s?: string) {
  const x = String(s || "").toLowerCase();
  if (x === "success" || x === "completed")
    return "bg-emerald-500/15 text-emerald-200 border-emerald-500/20";
  if (x === "failed" || x === "reversed")
    return "bg-red-500/15 text-red-200 border-red-500/20";
  return "bg-yellow-500/15 text-yellow-200 border-yellow-500/20";
}

// -------------------------------
// Demo-only datasets (UI parity like your sample)
// Doesn’t change backend; you can swap later when endpoints exist.
// -------------------------------
const revenueData = [
  { month: "Jan", rent: 245000, utilities: 45000, services: 28000 },
  { month: "Feb", rent: 248000, utilities: 42000, services: 31000 },
  { month: "Mar", rent: 245000, utilities: 48000, services: 29000 },
  { month: "Apr", rent: 252000, utilities: 46000, services: 33000 },
  { month: "May", rent: 258000, utilities: 44000, services: 35000 },
  { month: "Jun", rent: 255000, utilities: 47000, services: 32000 },
];

const paymentDistribution = [
  { name: "Paid on Time", value: 78, color: "#10b981" },
  { name: "Pending", value: 15, color: "#f59e0b" },
  { name: "Overdue", value: 7, color: "#ef4444" },
];

const recentTransactions = [
  { id: "TXN-8847", unit: "Building A - 302", type: "Rent", amount: 2500, status: "completed", date: "2 hours ago" },
  { id: "TXN-8846", unit: "Building B - 105", type: "Utilities", amount: 156, status: "completed", date: "5 hours ago" },
  { id: "TXN-8845", unit: "Building C - 408", type: "Service Charge", amount: 180, status: "pending", date: "1 day ago" },
  { id: "TXN-8844", unit: "Building D - 201", type: "Rent", amount: 2800, status: "completed", date: "1 day ago" },
  { id: "TXN-8843", unit: "Building A - 507", type: "Parking", amount: 120, status: "failed", date: "2 days ago" },
];

const outstandingBills = [
  { unit: "Building A - 205", resident: "John Doe", amount: 2680, dueDate: "Feb 15, 2026", daysOverdue: 4, type: "Rent + Utilities" },
  { unit: "Building C - 312", resident: "Jane Smith", amount: 1850, dueDate: "Feb 10, 2026", daysOverdue: 9, type: "Rent" },
  { unit: "Building B - 104", resident: "Mike Johnson", amount: 450, dueDate: "Feb 18, 2026", daysOverdue: 1, type: "Service Charge" },
  { unit: "Building E - 601", resident: "Sarah Wilson", amount: 3200, dueDate: "Feb 12, 2026", daysOverdue: 7, type: "Rent + Services" },
];

const invoiceTemplates = [
  { id: 1, name: "Monthly Rent Invoice", type: "Rent", lastUsed: "2 days ago" },
  { id: 2, name: "Utility Bill", type: "Utilities", lastUsed: "5 days ago" },
  { id: 3, name: "Service Charge Notice", type: "Service", lastUsed: "1 week ago" },
  { id: 4, name: "Parking Fee", type: "Parking", lastUsed: "2 weeks ago" },
];

export default function WalletsPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "transactions" | "outstanding" | "invoices">("overview");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // overview wallet (estate-level aggregates from /facility/overview)
  const [overviewWallet, setOverviewWallet] = useState<{
    balance: number;
    outstanding_dues: number;
    collected_this_month: number;
  } | null>(null);

  // my wallet (operator wallet row from /wallets)
  const [myWallet, setMyWallet] = useState<{ balance: number; currency: string }>({
    balance: 0,
    currency: "NGN",
  });

  // activity table (still empty-safe until backend endpoint exists)
  const [rows, setRows] = useState<WalletActivityRow[]>([]);

  // modal: manual debit test (kept)
  const [showDebit, setShowDebit] = useState(false);
  const [debitAmount, setDebitAmount] = useState("");
  const [debitReason, setDebitReason] = useState("service_charge");
  const canDebit = Number(debitAmount) > 0;

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      // 1) facility overview wallet (estate-level)
      const ov = await facilityService.overview();
      if (ov?.wallet) {
        setOverviewWallet({
          balance: Number(ov.wallet.balance || 0),
          outstanding_dues: Number(ov.wallet.outstanding_dues || 0),
          collected_this_month: Number(ov.wallet.collected_this_month || 0),
        });
      } else {
        setOverviewWallet({ balance: 0, outstanding_dues: 0, collected_this_month: 0 });
      }

      // 2) my wallet (operator/user wallet)
      const mine = await walletsService.getMyWallet();
      if (mine?.error) {
        setErr(mine.error);
      } else if (mine.wallet) {
        setMyWallet({
          balance: Number(mine.wallet.balance || 0),
          currency: String(mine.wallet.currency || "NGN"),
        });
      }

      // 3) activity rows
      // NOTE: still no /wallets/transactions endpoint; keep empty-safe
      setRows([]);
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Failed to load billing & finance");
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

      // optimistic UI
      setMyWallet((p) => ({ ...p, balance: Number(res.balance ?? p.balance) }));

      // close modal
      setShowDebit(false);
      setDebitAmount("");
      setDebitReason("service_charge");

      // reload overview
      await load();
    } finally {
      setLoading(false);
    }
  }

  const estateBalance = overviewWallet?.balance ?? 0;
  const estateOutstanding = overviewWallet?.outstanding_dues ?? 0;
  const estateCollected = overviewWallet?.collected_this_month ?? 0;

  // Keep your DataTable wiring (doesn’t break anything)
  const columns = useMemo<ColumnDef<WalletActivityRow>[]>(() => [
    { accessorKey: "type", header: "Type" },
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
        <span className={`inline-flex text-[11px] px-2 py-1 rounded-full border ${pill(row.original.status)}`}>
          {String(row.original.status || "pending")}
        </span>
      ),
    },
    {
      accessorKey: "reference",
      header: "Reference",
      cell: ({ row }) => (
        <span className="text-white/70 text-xs font-mono">{row.original.reference || "—"}</span>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Created",
      cell: ({ row }) => (
        <span className="text-white/70 text-xs">{when(row.original.created_at)}</span>
      ),
    },
  ], [myWallet.currency]);

  // UI metric values: prefer live wallet signals, fallback to demo-like copy
  const totalRevenueMTD = estateCollected; // this month’s collection is your closest “MTD revenue” signal
  const collectedToday = 0; // backend doesn’t give daily yet (placeholder)
  const outstanding = estateOutstanding;
  const collectionRate = estateOutstanding > 0 ? Math.max(70, Math.min(99, Math.round((estateCollected / (estateCollected + estateOutstanding)) * 100))) : 94;

  return (
    <div className="space-y-7">
      <Topbar title="Billing & Finance" subtitle="Manage payments, invoices, and financial operations" />

      {/* Top actions (kept: Manual Debit + Refresh) */}
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
        <div className="border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-200 rounded-2xl">
          {err}
        </div>
      )}

      {/* Metrics (exact standard vibe) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Revenue (MTD)"
          value={formatMoney(totalRevenueMTD || 0, "NGN")}
          change="+8% vs last month"
          trend="up"
          icon={DollarSign}
          iconColor="text-green-500"
        />
        <MetricCard
          title="Collected Today"
          value={formatMoney(collectedToday, "NGN")}
          change="45 transactions"
          trend="neutral"
          icon={Wallet}
          iconColor="text-blue-500"
        />
        <MetricCard
          title="Outstanding"
          value={formatMoney(outstanding || 0, "NGN")}
          change="12 overdue accounts"
          trend="up"
          icon={AlertCircle}
          iconColor="text-red-500"
        />
        <MetricCard
          title="Collection Rate"
          value={`${collectionRate}%`}
          change="+2% this month"
          trend="up"
          icon={TrendingUp}
          iconColor="text-purple-500"
        />
      </div>

      {/* Tabs (exact standard vibe) */}
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

      {/* OVERVIEW */}
      {activeTab === "overview" && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Revenue Breakdown (6 Months)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="month" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="rent" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="utilities" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="services" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Payment Status Distribution</h3>
              <div className="flex items-center gap-8">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie
                      data={paymentDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {paymentDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>

                <div className="flex-1 space-y-3">
                  {paymentDistribution.map((status, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: status.color }}
                        />
                        <span className="text-sm text-slate-300">{status.name}</span>
                      </div>
                      <span className="text-sm font-semibold">{status.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Revenue by Category</h3>
              <div className="space-y-4">
                {[
                  { category: "Estate Wallet (aggregate)", amount: estateBalance, percentage: 76, color: "bg-blue-500" },
                  { category: "Collected This Month", amount: estateCollected, percentage: 14, color: "bg-green-500" },
                  { category: "Outstanding Dues", amount: estateOutstanding, percentage: 10, color: "bg-purple-500" },
                ].map((item) => (
                  <div key={item.category} className="p-4 bg-slate-800/50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{item.category}</span>
                      <span className="text-lg font-semibold">
                        {formatMoney(item.amount || 0, "NGN")}
                      </span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${item.color}`}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {item.percentage}% of total revenue
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => alert("Wire: Generate invoice endpoint later")}
                  className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <CreditCard size={16} />
                  Generate Invoice
                </button>
                <button
                  type="button"
                  onClick={() => alert("Wire: Export report endpoint later")}
                  className="w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Download size={16} />
                  Export Report
                </button>
                <button
                  type="button"
                  onClick={() => alert("Wire: Bulk reminders endpoint later")}
                  className="w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <AlertCircle size={16} />
                  Send Reminders
                </button>
                <button
                  type="button"
                  onClick={() => alert("Wire: Accounts page later")}
                  className="w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors"
                >
                  View All Accounts
                </button>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-800">
                <h4 className="text-sm font-semibold mb-3">Payment Methods</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Bank Transfer</span>
                    <span className="font-medium">62%</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Card</span>
                    <span className="font-medium">28%</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Wallet</span>
                    <span className="font-medium">10%</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-800">
                <h4 className="text-sm font-semibold mb-3">Operator Wallet</h4>
                <div className="p-4 bg-slate-800/50 rounded-lg">
                  <div className="text-xs text-slate-400">My Wallet Balance</div>
                  <div className="text-xl font-semibold mt-1">
                    {formatMoney(myWallet.balance || 0, myWallet.currency || "NGN")}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* TRANSACTIONS */}
      {activeTab === "transactions" && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Recent Transactions</h3>
            <div className="flex gap-2">
              <select className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-blue-500">
                <option>All Types</option>
                <option>Rent</option>
                <option>Utilities</option>
                <option>Services</option>
              </select>
              <button
                type="button"
                onClick={() => alert("Wire: filters later")}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-colors"
              >
                Filter
              </button>
            </div>
          </div>

          {/* Demo table (matches your target UI) */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left text-xs font-medium text-slate-400 pb-3">Transaction ID</th>
                  <th className="text-left text-xs font-medium text-slate-400 pb-3">Unit</th>
                  <th className="text-left text-xs font-medium text-slate-400 pb-3">Type</th>
                  <th className="text-left text-xs font-medium text-slate-400 pb-3">Amount</th>
                  <th className="text-left text-xs font-medium text-slate-400 pb-3">Status</th>
                  <th className="text-left text-xs font-medium text-slate-400 pb-3">Date</th>
                  <th className="text-left text-xs font-medium text-slate-400 pb-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-slate-800 last:border-0">
                    <td className="py-4 text-sm font-medium">{transaction.id}</td>
                    <td className="py-4 text-sm">{transaction.unit}</td>
                    <td className="py-4 text-sm text-slate-400">{transaction.type}</td>
                    <td className="py-4 text-sm font-semibold">${transaction.amount.toLocaleString()}</td>
                    <td className="py-4">
                      <span
                        className={cn(
                          "px-2 py-1 rounded-full text-xs font-medium",
                          transaction.status === "completed"
                            ? "bg-green-500/10 text-green-500"
                            : transaction.status === "pending"
                              ? "bg-yellow-500/10 text-yellow-500"
                              : "bg-red-500/10 text-red-500"
                        )}
                      >
                        {transaction.status}
                      </span>
                    </td>
                    <td className="py-4 text-sm text-slate-400">{transaction.date}</td>
                    <td className="py-4">
                      <button
                        type="button"
                        className="text-blue-500 hover:text-blue-400 text-sm flex items-center gap-1"
                        onClick={() => alert(`Wire: view ${transaction.id}`)}
                      >
                        <Eye size={14} />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Keep your REAL table wiring intact (hidden safe lane for when endpoint arrives) */}
          <div className="mt-8">
            <DataTable data={rows} columns={columns} title="Wallet Activity (Backend)" searchKey={"reference"} />
            {!rows.length ? (
              <div className="mt-3 text-sm text-slate-400">
                Backend activity feed is still not connected (no /wallets/transactions yet).
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* OUTSTANDING */}
      {activeTab === "outstanding" && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Outstanding Payments</h3>
            <button
              type="button"
              onClick={() => alert("Wire: bulk reminder endpoint later")}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
            >
              Send Bulk Reminder
            </button>
          </div>

          <div className="space-y-4">
            {outstandingBills.map((bill, idx) => (
              <div key={idx} className="p-5 bg-slate-800/50 rounded-lg border border-red-500/20">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <p className="font-semibold">{bill.unit}</p>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-500">
                        {bill.daysOverdue} days overdue
                      </span>
                    </div>
                    <p className="text-sm text-slate-400">{bill.resident}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold text-red-500">${bill.amount.toLocaleString()}</p>
                    <p className="text-xs text-slate-400 mt-1">Due: {bill.dueDate}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-700">
                  <span className="text-sm text-slate-400">{bill.type}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => alert(`Wire: reminder ${bill.unit}`)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs font-medium transition-colors"
                    >
                      Send Reminder
                    </button>
                    <button
                      type="button"
                      onClick={() => alert(`Wire: details ${bill.unit}`)}
                      className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-medium transition-colors"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* INVOICES */}
      {activeTab === "invoices" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Invoice Templates</h3>
              <button
                type="button"
                onClick={() => alert("Wire: create template later")}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
              >
                Create Template
              </button>
            </div>

            <div className="space-y-3">
              {invoiceTemplates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg"
                >
                  <div>
                    <p className="font-medium mb-1">{template.name}</p>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span className="px-2 py-1 rounded bg-slate-700">{template.type}</span>
                      <span>Last used: {template.lastUsed}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => alert(`Wire: use template ${template.id}`)}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs font-medium transition-colors"
                    >
                      Use Template
                    </button>
                    <button
                      type="button"
                      onClick={() => alert(`Wire: edit template ${template.id}`)}
                      className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-medium transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">Invoice Stats</h3>
            <div className="space-y-4">
              <div className="p-4 bg-slate-800/50 rounded-lg">
                <p className="text-2xl font-semibold mb-1">847</p>
                <p className="text-sm text-slate-400">Invoices Generated (MTD)</p>
              </div>
              <div className="p-4 bg-slate-800/50 rounded-lg">
                <p className="text-2xl font-semibold mb-1">98%</p>
                <p className="text-sm text-slate-400">Delivery Success Rate</p>
              </div>
              <div className="p-4 bg-slate-800/50 rounded-lg">
                <p className="text-2xl font-semibold mb-1">2.3 days</p>
                <p className="text-sm text-slate-400">Avg. Payment Time</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MANUAL DEBIT MODAL (kept exactly, only styling aligned a bit) */}
      {showDebit && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => !loading && setShowDebit(false)}
          />
          <div className="relative bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold">Manual Debit</div>
                <div className="text-sm text-slate-400 mt-1">
                  Use this to test deductions + signals end-to-end.
                </div>
              </div>
              <button
                className="text-slate-400 hover:text-slate-200"
                onClick={() => !loading && setShowDebit(false)}
              >
                ✕
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

              <div className="text-xs text-slate-500">
                Estate-style meaning: “collect service charge from resident wallet”.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
