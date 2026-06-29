"use client";

import { useEffect, useMemo, useState } from "react";
import { OisPageToolbar, OisRegistryHeader, OisRuntimeCard } from "@/components/ois";
import OisCard from "@/components/ois/OisCard";
import OisDrawer from "@/components/ois/OisDrawer";
import OisListItem from "@/components/ois/OisListItem";
import OisStatusBadge from "@/components/ois/OisStatusBadge";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { facilityService } from "@/services/facilityService";
import { loadOyiCoreExecutionHistory, loadOyiCoreExecutionStatistics } from "@/services/oyiCoreRuntimeService";
import { walletsService } from "@/services/walletsService";
import { formatMoney } from "@/lib/format";
import { useSessionStore } from "@/store/useSessionStore";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronRight, Download, Eye, RefreshCw } from "lucide-react";

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
function statusTone(status?: string | null) { const value = lower(status); if (/completed|success|paid/.test(value)) return "completed"; if (/failed|rejected|reversed/.test(value)) return "failed"; if (/pending|processing|approval/.test(value)) return "pending"; return "unavailable"; }

function Detail({ label, value }: { label: string; value: React.ReactNode }) { return <OisCard variant="evidence" className="p-3"><div className="text-[10px] uppercase tracking-[0.14em] text-[var(--ois-text-muted)]">{label}</div><div className="mt-1 break-words text-sm text-[var(--ois-text-primary)]">{value || "-"}</div></OisCard>; }

export default function WalletsPage() {
  const { user } = useSessionStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [wallet, setWallet] = useState({ balance: 0, outstanding_dues: 0, collected_this_month: 0, currency: "NGN" });
  const [rows, setRows] = useState<WalletActivityRow[]>([]);
  const [selected, setSelected] = useState<WalletActivityRow | null>(null);
  const [executionHistory, setExecutionHistory] = useState<Array<Record<string, any>>>([]);
  const [executionStats, setExecutionStats] = useState<Record<string, any> | null>(null);

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

  useEffect(() => {
    let alive = true;
    void loadOyiCoreExecutionStatistics({ limit: 40, action: "payment" }).then((stats) => {
      if (alive) setExecutionStats(stats.statistics || null);
    }).catch(() => {
      if (alive) setExecutionStats(null);
    });
    return () => {
      alive = false;
    };
  }, []);

  const pending = rows.filter((row) => /pending|processing|approval/.test(lower(row.status)));
  const failed = rows.filter((row) => /failed|rejected|reversed/.test(lower(row.status)));
  const completed = rows.filter((row) => /completed|success|paid/.test(lower(row.status)));

  useEffect(() => {
    if (!selected) {
      setExecutionHistory([]);
      return;
    }
    let alive = true;
    void loadOyiCoreExecutionHistory({ limit: 8, action: "payment" }).then((executions) => {
      if (alive) setExecutionHistory(Array.isArray(executions) ? executions : []);
    }).catch(() => {
      if (alive) setExecutionHistory([]);
    });
    return () => {
      alive = false;
    };
  }, [selected]);

  const columns = useMemo<ColumnDef<WalletActivityRow>[]>(() => [
    { header: "Transaction", cell: ({ row }) => <div><div className="text-sm text-white">{row.original.service_title || row.original.type || "Wallet transaction"}</div><div className="mt-1 text-xs text-zinc-500">{row.original.user_name || row.original.user_email || "Resident source pending"}</div></div> },
    { header: "Amount", cell: ({ row }) => <span className="font-semibold text-white">{formatMoney(Number(row.original.amount || 0), row.original.currency || wallet.currency)}</span> },
    { header: "Status", cell: ({ row }) => <OisStatusBadge status={statusTone(row.original.status)} label={row.original.status || "pending"} /> },
    { header: "Reference", cell: ({ row }) => <span className="font-mono text-xs text-zinc-400">{row.original.reference || row.original.id || "-"}</span> },
    { header: "Timestamp", cell: ({ row }) => <span className="text-xs text-zinc-400">{dateLabel(row.original.created_at)}</span> },
    { id: "actions", header: "", cell: ({ row }) => <Button variant="ghost" onClick={() => setSelected(row.original)} className="gap-2"><Eye className="h-4 w-4" />Review</Button> },
  ], [wallet.currency]);

  if (!canRead) {
    return <div className="space-y-6"><Topbar title="Financial Posture" subtitle="Finance access required" /><div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 text-sm text-amber-100">Permission required: wallets.read.</div></div>;
  }

  return (
    <div className="space-y-6">
      <Topbar title="Financial Posture" subtitle="Transactions and payment review" strip={[{ label: "Healthy", value: pending.length || failed.length ? "Review" : "Stable", detail: "Financial posture", tone: pending.length || failed.length ? "warning" : "stable" }, { label: "Payments", value: rows.length, detail: "Visible transactions", tone: "attention" }, { label: "Attention", value: pending.length + failed.length, detail: "Pending or failed", tone: "warning" }, { label: "Updated", value: loading ? "Refreshing" : "Now", detail: "Runtime sync", tone: "info" }]} />
      <OisPageToolbar onRefresh={() => void load()} refreshing={loading} searchPlaceholder="Search transaction registry..." />
      {error ? <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
      {notice ? <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">{notice}</div> : null}

      <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <OisCard className="p-4">
          <OisRegistryHeader title="Transaction Registry" caption="Resident wallet activity and estate payment execution." />
          <div className="mt-4 hidden md:block"><DataTable data={rows} columns={columns} title="Transaction Flow" searchKey="reference" /></div>
          <div className="mt-4 space-y-2 md:hidden">{rows.map((row, index) => <OisListItem key={row.id || row.reference || index} title={row.service_title || row.type || "Wallet transaction"} description={`${formatMoney(Number(row.amount || 0), row.currency || wallet.currency)} · ${row.home_name || row.user_name || "Estate payment"}`} meta={dateLabel(row.created_at)} status={statusTone(row.status)} action={<ChevronRight className="h-4 w-4 text-[var(--ois-text-muted)]" />} onClick={() => setSelected(row)} className="w-full text-left" />)}{!rows.length && !loading ? <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">No transaction activity is available.</p> : null}</div>
        </OisCard>
        <aside className="space-y-4">
          <OisCard className="p-4"><OisRegistryHeader title="Financial Attention Queue" caption="Items that need financial review." /><div className="mt-3 space-y-2">{[...failed, ...pending].slice(0, 8).map((row, index) => <OisListItem key={row.id || row.reference || index} title={row.service_title || row.type || "Transaction"} description={`${formatMoney(Number(row.amount || 0), row.currency || wallet.currency)} · ${dateLabel(row.created_at)}`} status={statusTone(row.status)} onClick={() => setSelected(row)} className="w-full text-left" />)}{![...failed, ...pending].length ? <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">No failed or pending financial items.</div> : null}</div></OisCard>
          <OisCard className="p-4"><h2 className="text-sm font-semibold text-white">Operational exports</h2><p className="mt-2 text-sm leading-6 text-zinc-400">Export Pending Backend Support. No local export is generated until a backend export contract exists.</p><Button variant="ghost" disabled className="mt-3 gap-2"><Download className="h-4 w-4" />Export pending</Button></OisCard>
          <OisCard className="p-4"><h2 className="text-sm font-semibold text-white">Access</h2><p className="mt-2 text-sm text-zinc-400">Read: wallets.read · Ownership: wallets.manage</p><p className="mt-2 text-xs text-zinc-500">Ownership available: {canManage ? "Yes" : "No"}</p></OisCard>
        </aside>
      </section>

      <OisRuntimeCard
        title="Runtime Insights"
        items={[
          { label: "Completed payments", value: completed.length, delta: "settled successfully" },
          { label: "Attention items", value: pending.length + failed.length, delta: "pending or failed review" },
          { label: "Execution history", value: executionStats?.total || 0, delta: "runtime records" },
        ]}
      />

      <OisDrawer open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.service_title || selected?.type || "Wallet transaction"} subtitle={selected ? `${selected.reference || selected.id || "Reference pending"} · ${dateLabel(selected.created_at)}` : undefined} width="md">
        {selected ? <div className="space-y-4"><OisCard variant="evidence" className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-zinc-300">{selected.source || selected.user_name || selected.user_email || "Resident wallet source"}</p><p className="mt-2 text-xs text-zinc-500">{selected.destination || "Estate service wallet"}</p></div><div className="flex flex-wrap gap-2"><OisStatusBadge status={statusTone(selected.status)} label={selected.status || "pending"} /><span className="text-lg font-semibold text-white">{formatMoney(Number(selected.amount || 0), selected.currency || wallet.currency)}</span></div></div></OisCard><OisCard className="p-4"><h3 className="text-sm font-medium text-white">Runtime trace</h3><div className="mt-3 space-y-2">{executionHistory.map((item) => <OisListItem key={item.executionId || item.signalId} title={item.action || "Payment execution"} description={`${item.origin || "system"} · ${item.provider || "backend"}`} meta={`${item.status || "recorded"} · ${dateLabel(item.completedAt || item.requestedAt)}`} />)}{!executionHistory.length ? <p className="rounded-xl border border-dashed border-white/10 p-3 text-sm text-zinc-500">No runtime execution history is available yet.</p> : null}</div></OisCard><div className="grid gap-3 sm:grid-cols-2"><Detail label="Amount" value={formatMoney(Number(selected.amount || 0), selected.currency || wallet.currency)} /><Detail label="Source" value={selected.source || selected.user_name || selected.user_email || "Resident wallet source"} /><Detail label="Destination" value={selected.destination || "Estate service wallet"} /><Detail label="Reference" value={selected.reference || selected.id} /><Detail label="Status" value={<OisStatusBadge status={statusTone(selected.status)} label={selected.status || "pending"} />} /><Detail label="Timestamp" value={dateLabel(selected.created_at)} /><Detail label="Home" value={selected.home_name || selected.home_label || "Home pending"} /><Detail label="Action" value={/failed|pending|rejected/.test(lower(selected.status)) ? "Review with resident/service provider" : "No operator action required"} /></div></div> : null}
      </OisDrawer>
    </div>
  );
}
