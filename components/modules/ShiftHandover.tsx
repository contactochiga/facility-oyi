"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, History, Save } from "lucide-react";
import OisCard from "@/components/ois/OisCard";
import OisListItem from "@/components/ois/OisListItem";
import OisOperationalStrip from "@/components/ois/OisOperationalStrip";
import { facilityService } from "@/services/facilityService";
import { hasPermission } from "@/lib/oyiFoundation";
import { useSessionStore } from "@/store/useSessionStore";

type HandoverItem = { id: string; title?: string; module?: string; status?: string; priority?: string; owner?: string | null; due_at?: string | null; blocking_reason?: string | null; verified_at?: string | null; };
const isOverdue = (item: HandoverItem) => Boolean(item.due_at && new Date(item.due_at).getTime() < Date.now());
const routeFor = (item: HandoverItem) => item.module === "maintenance" ? "/maintenance" : item.module === "incidents" ? "/alerts" : "/facility-intelligence?module=workflows";
const itemMeta = (item: HandoverItem) => `${item.module || "workflow"} · ${item.owner || "Unassigned"}${item.due_at ? ` · Due ${new Date(item.due_at).toLocaleDateString()}` : ""}`;

export default function ShiftHandover() {
  const { user } = useSessionStore();
  const [data, setData] = useState<{ summary?: Record<string, number>; items?: HandoverItem[] }>({});
  const [history, setHistory] = useState<any[]>([]);
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => Promise.all([facilityService.platformHandover(), facilityService.platformHandovers()]).then(([handover, notes]) => { setData(handover || {}); setHistory(notes.items || []); }).catch(() => setError("Handover data is unavailable for this facility context.")).finally(() => setLoading(false));
  useEffect(() => { void load(); }, []);
  const totals = data.summary || {};
  const priorityItems = useMemo(
    () =>
      (data.items || [])
        .filter((item) => {
          const status = String(item.status || "").toLowerCase();
          return isOverdue(item) || status === "escalated" || !item.owner || (["completed", "resolved"].includes(status) && !item.verified_at);
        })
        .slice(0, 4),
    [data.items]
  );
  const canCreate = hasPermission(user, "support.assign");
  const save = async (event: FormEvent) => { event.preventDefault(); if (!summary.trim()) return; setSaving(true); setError(null); try { await facilityService.createPlatformHandover({ summary: summary.trim(), open_items: data.items || [], handover_items: data.items || [] }); setSummary(""); await load(); } catch { setError("Unable to save the handover note. No handover was created."); } finally { setSaving(false); } };

  return (
    <OisCard as="section" className="h-full border-white/[0.06] bg-white/[0.024] p-3 sm:p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-white">Shift Handover</h2>
          <p className="mt-1 text-[11px] leading-4 text-zinc-500">Live unresolved operations plus notes for the next shift.</p>
        </div>
      </div>

      {error ? (
        <p className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/10 p-2 text-xs text-rose-100">{error}</p>
      ) : null}

      <OisOperationalStrip
        className="mt-2.5"
        items={[
          { label: "Open", value: loading ? "—" : totals.open || 0, tone: "attention" },
          { label: "Completed", value: loading ? "—" : totals.completed_today || 0, tone: "stable" },
          { label: "Overdue", value: loading ? "—" : totals.overdue || 0, tone: "warning" },
          { label: "Unassigned", value: loading ? "—" : totals.unassigned || 0, tone: "critical" },
        ]}
      />

      {priorityItems.length ? (
        <div className="mt-2.5 space-y-1">
          {priorityItems.map((item) => {
            const status = String(item.status || "").toLowerCase();
            const badge =
              status === "escalated"
                ? "escalated"
                : isOverdue(item)
                ? "overdue"
                : !item.owner
                ? "warning"
                : "attention";
            const cue =
              status === "escalated"
                ? "Escalated"
                : isOverdue(item)
                ? "Overdue"
                : !item.owner
                ? "Unassigned"
                : "Needs verification";
            return (
              <Link key={item.id} href={routeFor(item)} className="block">
                <OisListItem
                  title={<span className="block truncate text-sm text-white">{item.title || "Operational item"}</span>}
                  description={<span className="text-[11px] text-zinc-500">{itemMeta(item)}</span>}
                  meta={<span className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">{cue}</span>}
                  status={badge}
                  className="bg-black/5"
                />
              </Link>
            );
          })}
        </div>
      ) : null}

      {canCreate ? (
        <div className="mt-2.5 rounded-[16px] border border-white/[0.05] bg-black/10 p-2.5">
          <form onSubmit={save}>
            <label className="text-[11px] font-medium text-zinc-300">Today&apos;s handover note</label>
            <textarea
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="Open issues, risks, actions for the next shift…"
              className="mt-2 min-h-24 w-full rounded-[14px] border border-white/[0.07] bg-black/10 p-2.5 text-sm text-white outline-none focus:border-sky-400/40"
            />
            <div className="mt-2 flex justify-end">
              <button
                disabled={saving || !summary.trim()}
                className="inline-flex items-center gap-2 rounded-[14px] bg-sky-500/15 px-3 py-2 text-xs text-sky-100 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? "Saving" : "Save handover"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="mt-2.5">
        <div className="flex items-center gap-2 text-[11px] text-zinc-500">
          <History className="h-3.5 w-3.5" />
          Recent handovers
        </div>
        <div className="mt-2 space-y-1">
          {history.slice(0, 3).map((item) => (
            <OisListItem
              key={item.id}
              title={item.handover_date}
              description={item.summary || "No narrative note recorded."}
              meta={`${Array.isArray(item.open_items) ? item.open_items.length : 0} open items`}
              status="completed"
              className="whitespace-pre-wrap"
            />
          ))}
          {!loading && !history.length ? (
            <p className="rounded-xl border border-dashed border-white/10 p-3 text-xs text-zinc-500">
              No handover notes have been recorded for this facility yet.
            </p>
          ) : null}
        </div>
      </div>

      {!loading && !data.items?.length ? (
        <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-dashed border-white/10 p-3 text-xs text-zinc-500">
          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
          No open items require handover in this facility context.
        </div>
      ) : null}
    </OisCard>
  );
}
