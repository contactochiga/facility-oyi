"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import OisCard from "@/components/ois/OisCard";
import OisListItem from "@/components/ois/OisListItem";
import OisStatusBadge, { type OisStatus } from "@/components/ois/OisStatusBadge";
import { loadOperatorQueue, type OperatorQueueItem } from "@/services/operatorQueueService";
import { useSessionStore } from "@/store/useSessionStore";
import { openWorkflowDrawer } from "@/components/modules/WorkflowDetailDrawer";

const closed = new Set(["completed", "verified", "resolved", "closed", "cancelled"]);
const age = (value?: string | null) => { if (!value) return "Time unavailable"; const hours = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 3600000)); return hours < 24 ? `${hours}h open` : `${Math.floor(hours / 24)}d open`; };
const priorityStatus: Record<OperatorQueueItem["priority"], OisStatus> = { critical: "critical", high: "warning", medium: "attention", low: "stable" };
const normalizeStatus = (value: string): OisStatus => {
  const state = value.toLowerCase().trim().replace(/[\s-]+/g, "_");
  if (["stable", "attention", "warning", "critical", "unavailable", "pending", "verified", "failed", "escalated", "blocked", "overdue", "resolved", "completed"].includes(state)) return state as OisStatus;
  return "unavailable";
};

export default function OperatorQueue({ limit = 5 }: { limit?: number }) {
  const { user } = useSessionStore();
  const [items, setItems] = useState<OperatorQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { let active = true; loadOperatorQueue(user?.role).then((rows) => { if (active) setItems(rows); }).finally(() => active && setLoading(false)); return () => { active = false; }; }, [user?.role]);
  const summary = useMemo(() => ({ open: items.filter((item) => !closed.has(item.status.toLowerCase())).length, overdue: items.filter((item) => item.due_at && new Date(item.due_at).getTime() < Date.now()).length, unassigned: items.filter((item) => item.owner === "Unassigned").length, verification: items.filter((item) => item.verification === "pending").length }), [items]);
  return <OisCard as="section" className="p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-white">Operational Queue</h2><p className="mt-1 text-xs text-zinc-500">Role-filtered work requiring ownership, verification, or the next action.</p></div><Link href="/facility-intelligence?module=workflows" className="text-xs text-sky-200">View all</Link></div><div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs"><OisCard as="div" variant="evidence" className="p-2"><b className="block text-white">{summary.open}</b>Open</OisCard><OisCard as="div" variant="evidence" className="p-2"><b className="block text-amber-100">{summary.overdue}</b>Overdue</OisCard><OisCard as="div" variant="evidence" className="p-2"><b className="block text-orange-100">{summary.unassigned}</b>Unassigned</OisCard><OisCard as="div" variant="evidence" className="p-2"><b className="block text-sky-100">{summary.verification}</b>Verify</OisCard></div><div className="mt-4 space-y-2">{items.slice(0, limit).map((item) => <Link key={item.id} href={item.route} onClick={(event) => { if (String(item.id).startsWith("workflow:")) { event.preventDefault(); openWorkflowDrawer(String(item.id).replace(/^workflow:/, "")); } }} className="block text-left">
    <OisListItem
      className="w-full"
      title={<span className="block truncate">{item.title}</span>}
      description={<span>{item.source ? `${item.source} · ` : ""}{item.owner} · {age(item.created_at)}</span>}
      meta={<div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <OisStatusBadge status={normalizeStatus(item.status)} label={item.status} />
          {item.blocking_reason ? <OisStatusBadge status="blocked" label={`Blocked: ${item.blocking_reason}`} /> : null}
          {String(item.status).toLowerCase() === "escalated" ? <OisStatusBadge status="escalated" /> : null}
          {item.verification === "pending" ? <OisStatusBadge status="attention" label="Verification required" /> : null}
        </div>
        <p className="text-xs text-sky-100">Next: {item.next_action}</p>
      </div>}
      action={<OisStatusBadge status={priorityStatus[item.priority]} label={item.priority} />}
    />
  </Link>)}{!items.length && !loading ? <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">No unresolved operator items are visible for this role.</p> : null}</div></OisCard>;
}
