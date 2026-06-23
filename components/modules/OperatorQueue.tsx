"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import OisCard from "@/components/ois/OisCard";
import OisListItem from "@/components/ois/OisListItem";
import OisStatusBadge, { type OisStatus } from "@/components/ois/OisStatusBadge";
import { loadOperatorQueue, type OperatorQueueItem } from "@/services/operatorQueueService";
import { useSessionStore } from "@/store/useSessionStore";
import { openWorkflowDrawer } from "@/components/modules/WorkflowDetailDrawer";

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
  return <OisCard as="section" className="p-3 sm:p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-white">Operational Queue</h2><p className="mt-1 text-xs text-zinc-500">Role-filtered work requiring ownership, verification, or the next action.</p></div><Link href="/facility-intelligence?module=workflows" className="text-xs text-sky-200">Open queue</Link></div><div className="mt-3 space-y-1.5">{items.slice(0, limit).map((item) => <Link key={item.id} href={item.route} onClick={(event) => { if (String(item.id).startsWith("workflow:")) { event.preventDefault(); openWorkflowDrawer(String(item.id).replace(/^workflow:/, "")); } }} className="block text-left">
    <OisListItem
      className="w-full gap-2 p-2.5"
      title={<span className="block truncate text-sm">{item.title}</span>}
      meta={<OisStatusBadge status={normalizeStatus(item.status)} label={item.status} />}
      action={<OisStatusBadge status={priorityStatus[item.priority]} label={item.priority} />}
    />
  </Link>)}{!items.length && !loading ? <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">No unresolved operator items are visible for this role.</p> : null}</div></OisCard>;
}
