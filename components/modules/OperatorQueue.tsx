"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { loadOperatorQueue, type OperatorQueueItem } from "@/services/operatorQueueService";
import { useSessionStore } from "@/store/useSessionStore";

const tone: Record<string, string> = { critical: "border-rose-500/25 bg-rose-500/10 text-rose-200", high: "border-orange-500/25 bg-orange-500/10 text-orange-200", medium: "border-amber-500/25 bg-amber-500/10 text-amber-100", low: "border-sky-500/20 bg-sky-500/10 text-sky-100" };
const closed = new Set(["completed", "verified", "resolved", "closed", "cancelled"]);
const age = (value?: string | null) => { if (!value) return "Time unavailable"; const hours = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 3600000)); return hours < 24 ? `${hours}h open` : `${Math.floor(hours / 24)}d open`; };

export default function OperatorQueue() {
  const { user } = useSessionStore();
  const [items, setItems] = useState<OperatorQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { let active = true; loadOperatorQueue(user?.role).then((rows) => { if (active) setItems(rows); }).finally(() => active && setLoading(false)); return () => { active = false; }; }, [user?.role]);
  const summary = useMemo(() => ({ open: items.filter((item) => !closed.has(item.status.toLowerCase())).length, overdue: items.filter((item) => item.due_at && new Date(item.due_at).getTime() < Date.now()).length, unassigned: items.filter((item) => item.owner === "Unassigned").length, completedToday: 0 }), [items]);
  return <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-white">Operator Queue</h2><p className="mt-1 text-xs text-zinc-500">Role-filtered work needing attention, ownership, or verification.</p></div><Link href="/facility-intelligence?module=workflows" className="text-xs text-sky-200">Ask Oyi</Link></div><div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs"><div className="rounded-xl bg-black/20 p-2"><b className="block text-white">{summary.open}</b>Open</div><div className="rounded-xl bg-black/20 p-2"><b className="block text-amber-100">{summary.overdue}</b>Overdue</div><div className="rounded-xl bg-black/20 p-2"><b className="block text-orange-100">{summary.unassigned}</b>Unassigned</div><div className="rounded-xl bg-black/20 p-2"><b className="block text-zinc-300">{summary.completedToday}</b>Today</div></div><div className="mt-4 space-y-2">{items.slice(0, 8).map((item) => <Link key={item.id} href={item.route} className="block rounded-xl border border-white/10 bg-black/20 p-3 hover:bg-white/[0.05]"><div className="flex justify-between gap-2"><span className="truncate text-sm font-medium text-white">{item.title}</span><span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] ${tone[item.priority]}`}>{item.priority}</span></div><p className="mt-1 text-xs text-zinc-500">{item.module} · {item.status} · {item.owner} · {age(item.created_at)}</p><p className="mt-2 text-xs text-sky-100">Next: {item.next_action}</p></Link>)}{!items.length && !loading ? <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">No unresolved operator items are visible for this role.</p> : null}</div></section>;
}
