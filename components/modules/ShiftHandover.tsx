"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, ClipboardCheck, UserRoundX } from "lucide-react";
import { facilityService } from "@/services/facilityService";

type HandoverItem = {
  id: string;
  title?: string;
  module?: string;
  status?: string;
  priority?: string;
  owner?: string | null;
  due_at?: string | null;
  blocking_reason?: string | null;
  verified_at?: string | null;
};

const isOverdue = (item: HandoverItem) => Boolean(item.due_at && new Date(item.due_at).getTime() < Date.now());
const routeFor = (item: HandoverItem) => item.module === "maintenance" ? "/maintenance" : item.module === "incidents" ? "/alerts" : "/facility-intelligence?module=workflows";

export default function ShiftHandover() {
  const [data, setData] = useState<{ summary?: Record<string, number>; items?: HandoverItem[] }>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    facilityService.platformHandover().then((value) => { if (mounted) setData(value || {}); }).catch(() => { if (mounted) setData({}); }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const summary = data.summary || {};
  const groups = useMemo(() => ({
    overdue: (data.items || []).filter(isOverdue),
    escalated: (data.items || []).filter((item) => String(item.status || "").toLowerCase() === "escalated"),
    unassigned: (data.items || []).filter((item) => !item.owner),
    verification: (data.items || []).filter((item) => ["completed", "resolved"].includes(String(item.status || "").toLowerCase()) && !item.verified_at),
  }), [data.items]);

  const cards = [
    { key: "overdue", label: "Overdue work", value: summary.overdue || 0, icon: CircleAlert, tone: "text-amber-200" },
    { key: "escalated", label: "Escalated incidents", value: summary.escalated || 0, icon: CircleAlert, tone: "text-rose-200" },
    { key: "unassigned", label: "Unassigned items", value: summary.unassigned || 0, icon: UserRoundX, tone: "text-orange-200" },
    { key: "verification", label: "Verification queue", value: summary.verification || 0, icon: ClipboardCheck, tone: "text-sky-200" },
  ] as const;

  return <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
    <div className="flex items-start justify-between gap-3">
      <div><h2 className="text-sm font-semibold text-white">Shift Handover</h2><p className="mt-1 text-xs text-zinc-500">Live operational handover for the active facility.</p></div>
      <Link href="/facility-intelligence?module=handover" className="text-xs text-sky-200">Ask Oyi</Link>
    </div>
    <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
      <div className="rounded-xl bg-black/20 p-3"><span className="text-xs text-zinc-500">Open operations</span><b className="mt-1 block text-lg text-white">{loading ? "—" : summary.open || 0}</b></div>
      <div className="rounded-xl bg-black/20 p-3"><span className="text-xs text-zinc-500">Completed today</span><b className="mt-1 block text-lg text-emerald-200">{loading ? "—" : summary.completed_today || 0}</b></div>
      <div className="rounded-xl bg-black/20 p-3"><span className="text-xs text-zinc-500">Overdue</span><b className="mt-1 block text-lg text-amber-200">{loading ? "—" : summary.overdue || 0}</b></div>
      <div className="rounded-xl bg-black/20 p-3"><span className="text-xs text-zinc-500">Unassigned</span><b className="mt-1 block text-lg text-orange-200">{loading ? "—" : summary.unassigned || 0}</b></div>
    </div>
    <div className="mt-3 grid gap-2 md:grid-cols-2">
      {cards.map(({ key, label, value, icon: Icon, tone }) => <div key={key} className="rounded-xl border border-white/10 bg-black/20 p-3"><div className="flex items-center gap-2"><Icon className={`h-4 w-4 ${tone}`} /><span className="text-xs text-zinc-300">{label}</span><b className="ml-auto text-sm text-white">{loading ? "—" : value}</b></div>{groups[key].slice(0, 1).map((item) => <Link key={item.id} href={routeFor(item)} className="mt-2 block truncate text-xs text-sky-100">{item.title || "Operational item"}{item.blocking_reason ? ` · Blocked: ${item.blocking_reason}` : ""}</Link>)}</div>)}
    </div>
    {!loading && !data.items?.length ? <div className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-white/10 p-3 text-xs text-zinc-500"><CheckCircle2 className="h-4 w-4 text-emerald-300" />No open items require handover in this facility context.</div> : null}
  </section>;
}
