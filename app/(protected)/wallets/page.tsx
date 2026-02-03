// app/(protected)/wallets/page.tsx
"use client";

import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { facilityService } from "@/services/facilityService";
import { walletsService } from "@/services/walletsService";
import { formatMoney } from "@/lib/format";
import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";

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
  if (x === "success" || x === "completed") return "bg-emerald-500/15 text-emerald-200 border-emerald-500/20";
  if (x === "failed" || x === "reversed") return "bg-red-500/15 text-red-200 border-red-500/20";
  return "bg-yellow-500/15 text-yellow-200 border-yellow-500/20";
}

export default function WalletsPage() {
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

  // activity table (we don’t have a backend list endpoint yet, so this is an empty-safe lane)
  const [rows, setRows] = useState<WalletActivityRow[]>([]);

  // modal: manual debit test
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
        // don’t hard fail page; just show info
        setErr(mine.error);
      } else if (mine.wallet) {
        setMyWallet({
          balance: Number(mine.wallet.balance || 0),
          currency: String(mine.wallet.currency || "NGN"),
        });
      }

      // 3) activity rows
      // NOTE: You currently do NOT have /wallets/transactions endpoint in backend.
      // So we keep this table empty-safe until you add it.
      setRows([]);
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Failed to load wallets");
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

      // reload overview (so dashboard wallet reads in sync)
      await load();
    } finally {
      setLoading(false);
    }
  }

  const estateBalance = overviewWallet?.balance ?? 0;
  const estateOutstanding = overviewWallet?.outstanding_dues ?? 0;
  const estateCollected = overviewWallet?.collected_this_month ?? 0;

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

  return (
    <div className="space-y-7">
      <Topbar title="Wallets" subtitle="Estate finance signals • balances • deductions" />

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
        <div className="glass border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-200">
          {err}
        </div>
      )}

      {/* SUMMARY GRID */}
      <div className="grid gap-4 lg:gap-5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <div className="glass p-5">
          <div className="text-xs text-zinc-400">Estate Wallet (aggregate)</div>
          <div className="mt-2 text-2xl font-semibold">
            {formatMoney(estateBalance, "NGN")}
          </div>
          <div className="mt-2 text-xs text-zinc-500">From /facility/overview</div>
        </div>

        <div className="glass p-5">
          <div className="text-xs text-zinc-400">Outstanding Dues</div>
          <div className="mt-2 text-2xl font-semibold">
            {formatMoney(estateOutstanding, "NGN")}
          </div>
          <div className="mt-2 text-xs text-zinc-500">Unpaid dues aggregation</div>
        </div>

        <div className="glass p-5">
          <div className="text-xs text-zinc-400">Collected This Month</div>
          <div className="mt-2 text-2xl font-semibold">
            {formatMoney(estateCollected, "NGN")}
          </div>
          <div className="mt-2 text-xs text-zinc-500">Month-to-date</div>
        </div>

        <div className="glass p-5">
          <div className="text-xs text-zinc-400">My Wallet</div>
          <div className="mt-2 text-2xl font-semibold">
            {formatMoney(myWallet.balance || 0, myWallet.currency || "NGN")}
          </div>
          <div className="mt-2 text-xs text-zinc-500">Operator/user wallet row</div>
        </div>
      </div>

      {/* TABLE */}
      <DataTable
        data={rows}
        columns={columns}
        title="Wallet Activity"
        searchKey={"reference"}
      />

      {!rows.length && (
        <div className="glass p-5 text-sm text-zinc-300">
          No wallet activity endpoint connected yet.
          <div className="text-xs text-zinc-500 mt-2">
            If you want this table populated, we’ll add: <span className="text-zinc-200">GET /wallets/transactions</span> to read from <span className="text-zinc-200">wallet_transactions</span>.
          </div>
        </div>
      )}

      {/* MANUAL DEBIT MODAL */}
      {showDebit && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => !loading && setShowDebit(false)}
          />
          <div className="relative glass border border-white/10 rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold">Manual Debit</div>
                <div className="text-sm text-zinc-400 mt-1">
                  Use this to test deductions + signals end-to-end.
                </div>
              </div>
              <button
                className="text-zinc-400 hover:text-zinc-200"
                onClick={() => !loading && setShowDebit(false)}
              >
                ✕
              </button>
            </div>

            <div className="grid gap-3 mt-5">
              <input
                className="bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 outline-none"
                placeholder="Amount (NGN)"
                value={debitAmount}
                onChange={(e) => setDebitAmount(e.target.value)}
                inputMode="decimal"
              />

              <input
                className="bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 outline-none"
                placeholder="Reason (e.g. service_charge)"
                value={debitReason}
                onChange={(e) => setDebitReason(e.target.value)}
              />

              <div className="flex gap-2 mt-2">
                <Button variant="ghost" onClick={() => setShowDebit(false)} disabled={loading}>
                  Cancel
                </Button>
                <Button onClick={runDebit} disabled={loading || !canDebit}>
                  {loading ? "Debiting..." : "Debit"}
                </Button>
              </div>

              <div className="text-xs text-zinc-500">
                Estate-style meaning: “collect service charge from resident wallet”.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
