"use client";

import { useEffect, useMemo, useState } from "react";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { facilityService } from "@/services/facilityService";
import { walletsService } from "@/services/walletsService";
import { formatMoney } from "@/lib/format";
import { useSessionStore } from "@/store/useSessionStore";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, Download, Eye, RefreshCw, Wallet, X } from "lucide-react";

type WalletActivityRow = {
  id?: string;
  type?: string;
  amount?: number | string | null;
  status?: string | null;
  reference?: string | null;
  created_at?: string | null;
  service_title?: string | null;
  user_name?: string | null;
  user_email?: string | null;
  home_name?: string | null;
  home_label?: string | null;
  source?: string | null;
  destination?: string | null;
  currency?: string | null;
};

function cn(...classes: Array<string | false | null | undefined>) { return classes.filter(Boolean).join(" "); }
function lower(value: unknown) { return String(value || "").toLowerCase(); }
function dateLabel(value?: string | null) { if (!value) return "Time unavailable"; const d = new Date(value); return Number.isNaN(d.getTime()) ? "Time unavailable" : d.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }); }
function statusTone(status?: string | null) { const value = lower(status); if (/completed|success|paid/.test(value)) return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"; if (/failed|rejected|reversed/.test(value)) return "border-red-500/20 bg-red-500/10 text-red-200"; if (/pending|processing|approval/.test(value)) return "border-amber-500/20 bg-amber-500/10 text-amber-200"; return "border-white/10 bg-white/5 text-zinc-300"; }

function Metric({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{label}</div><div className="mt-3 text-2xl font-semibold text-white">{value}</div><div className="mt-1 text-xs text-zinc-500">{hint}</div></div>;
}
function Detail({ label, value }: { label: string; value: React.ReactNode }) { return <div className="rounded-xl border border-white/10 bg-black/20 p-3"><div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{label}</div><div className="mt-1 break-words text-sm text-zinc-200">{value || "-"}</div></div>; }

export default function WalletsPage() {
  const { user } = useSessionStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [wallet, setWallet] = useState({ balance: 0, outstanding_dues: 0, collected_this_month: 0, currency: "NGN" });
  const [rows, setRows] = useState<WalletActivityRow[]>([]);
  const [selected, setSelected] = useState<WalletActivityRow | null>(null);

  const permissions = Array.isArray((user as any)?.permissions) ? (user as any).permissions : [];
  const canRead = permissions.includes("wallets.read") || ["admin", "owner", "estate_admin", "finance_operator"].includes(String(user?.role || ""));
  const canManage = permissions.includes("wallets.manage") || ["admin", "owner", "estate_admin", "finance_operator"].includes(String(user?.role || ""));

  async function load() {
    setLoading(true); setError(null);
    try {
      const ov = await facilityService.overview();
      setWallet({
        balance: Number((ov as any)?.wallet?.balance || 0),
        outstanding_dues: Number((ov as any)?.wallet?.outstanding_dues || 0),
        collected_this_month: Number((ov as any)?.wallet?.collected_this_month || 0),
        currency: "NGN",
      });
      const mine = await walletsService.getMyWallet();
      if (mine.wallet?.currency) setWallet((current) => ({ ...current, currency: String(mine.wallet?.currency || current.currency) }));
      const estateId = String((ov as any)?.estate?.id || (ov as any)?.estate_id || "").trim();
      if (estateId) {
        const tx = await facilityService.listEstateServicePayments(estateId, 120);
        setRows(Array.isArray(tx?.payments) ? tx.payments : []);
      } else setRows([]);
    } catch (err: any) { setError(err?.response?.data?.error || err?.message || "Failed to load wallet operations"); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  const pending = rows.filter((row) => /pending|processing|approval/.test(lower(row.status)));
  const failed = rows.filter((row) => /failed|rejected|reversed/.test(lower(row.status)));
  const completed = rows.filter((row) => /completed|success|paid/.test(lower(row.status)));

  const columns = useMemo<ColumnDef<WalletActivityRow>[]>(() => [
    { header: "Transaction", cell: ({ row }) => <div><div className="text-sm text-white">{row.original.service_title || row.original.type || "Wallet transaction"}</div><div className="mt-1 text-xs text-zinc-500">{row.original.user_name || row.original.user_email || "Resident source pending"}</div></div> },
    { header: "Amount", cell: ({ row }) => <span className="font-semibold text-white">{formatMoney(Number(row.original.amount || 0), row.original.currency || wallet.currency)}</span> },
    { header: "Status", cell: ({ row }) => <span className={cn("rounded-full border px-2 py-1 text-xs", statusTone(row.original.status))}>{row.original.status || "pending"}</span> },
    { header: "Reference", cell: ({ row }) => <span className="font-mono text-xs text-zinc-400">{row.original.reference || row.original.id || "-"}</span> },
    { header: "Timestamp", cell: ({ row }) => <span className="text-xs text-zinc-400">{dateLabel(row.original.created_at)}</span> },
    { id: "actions", header: "", cell: ({ row }) => <Button variant="ghost" onClick={() => setSelected(row.original)} className="gap-2"><Eye className="h-4 w-4" />Details</Button> },
  ], [wallet.currency]);

  if (!canRead) {
    return <div className="space-y-6"><Topbar title="Wallet Operations" subtitle="Finance permissions required" /><div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 text-sm text-amber-100">Permission required: wallets.read.</div></div>;
  }

  return (
    <div className="space-y-6">
      <Topbar title="Wallet Operations" subtitle="Estate finance, resident service payments, failed transactions, and finance attention queue" rightSlot={<Button variant="ghost" onClick={() => void load()} disabled={loading} className="gap-2"><RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />Refresh</Button>} />
      {error ? <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
      {notice ? <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">{notice}</div> : null}

      <section className="grid gap-3 md:grid-cols-4">
        <Metric label="Wallet balance" value={formatMoney(wallet.balance, wallet.currency)} hint="Estate overview source" />
        <Metric label="Recent transactions" value={rows.length} hint="Service payment records" />
        <Metric label="Pending" value={pending.length} hint="Pending or processing" />
        <Metric label="Failed" value={failed.length} hint="Requires operator review" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="hidden md:block"><DataTable data={rows} columns={columns} title="Transaction Registry" searchKey="reference" /></div><div className="space-y-2 md:hidden">{rows.map((row, index) => <button key={row.id || row.reference || index} type="button" onClick={() => setSelected(row)} className="block w-full rounded-2xl border border-white/10 bg-black/20 p-3 text-left"><div className="flex justify-between gap-3"><span className="truncate text-sm font-medium text-white">{row.service_title || row.type || "Wallet transaction"}</span><span className={cn("shrink-0 rounded-full border px-2 py-1 text-[10px]", statusTone(row.status))}>{row.status || "pending"}</span></div><p className="mt-2 text-sm text-zinc-200">{formatMoney(Number(row.amount || 0), row.currency || wallet.currency)}</p><p className="mt-1 truncate text-xs text-zinc-500">{row.home_name || row.user_name || "Estate payment"} · {dateLabel(row.created_at)}</p></button>)}{!rows.length && !loading ? <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">No transaction records are available.</p> : null}</div></div>
        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><h2 className="text-sm font-semibold text-white">Wallet attention queue</h2><div className="mt-3 space-y-2">{[...failed, ...pending].slice(0, 8).map((row, index) => <button key={row.id || row.reference || index} type="button" onClick={() => setSelected(row)} className="block w-full rounded-xl border border-white/10 bg-black/20 p-3 text-left"><div className="flex justify-between gap-3"><span className="text-sm text-white">{row.service_title || row.type || "Transaction"}</span><span className={cn("rounded-full border px-2 py-1 text-[10px]", statusTone(row.status))}>{row.status || "pending"}</span></div><div className="mt-1 text-xs text-zinc-500">{formatMoney(Number(row.amount || 0), row.currency || wallet.currency)} · {dateLabel(row.created_at)}</div></button>)}{![...failed, ...pending].length ? <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">No failed or pending finance items.</div> : null}</div></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><h2 className="text-sm font-semibold text-white">Operational exports</h2><p className="mt-2 text-sm leading-6 text-zinc-400">Export Pending Backend Support. No local export is generated until a backend export contract exists.</p><Button variant="ghost" disabled className="mt-3 gap-2"><Download className="h-4 w-4" />Export pending</Button></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><h2 className="text-sm font-semibold text-white">Permissions</h2><p className="mt-2 text-sm text-zinc-400">Read: wallets.read · Manage: wallets.manage</p><p className="mt-2 text-xs text-zinc-500">Manage available: {canManage ? "Yes" : "No"}</p></div>
        </aside>
      </section>

      {selected ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm"><section className="w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-950 p-5"><header className="flex justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Transaction detail</p><h2 className="mt-1 text-lg font-semibold text-white">{selected.service_title || selected.type || "Wallet transaction"}</h2></div><button type="button" onClick={() => setSelected(null)} className="rounded-lg border border-white/10 p-2 text-zinc-400 hover:text-white"><X className="h-4 w-4" /></button></header><div className="mt-5 grid gap-3 sm:grid-cols-2"><Detail label="Amount" value={formatMoney(Number(selected.amount || 0), selected.currency || wallet.currency)} /><Detail label="Source" value={selected.source || selected.user_name || selected.user_email || "Resident wallet source"} /><Detail label="Destination" value={selected.destination || "Estate service wallet"} /><Detail label="Reference" value={selected.reference || selected.id} /><Detail label="Status" value={<span className={cn("rounded-full border px-2 py-1 text-xs", statusTone(selected.status))}>{selected.status || "pending"}</span>} /><Detail label="Timestamp" value={dateLabel(selected.created_at)} /><Detail label="Home" value={selected.home_name || selected.home_label || "Home pending"} /><Detail label="Action" value={/failed|pending|rejected/.test(lower(selected.status)) ? "Review with resident/service provider" : "No operator action required"} /></div></section></div> : null}
    </div>
  );
}
