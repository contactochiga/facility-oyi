"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { OisPageToolbar, OisRegistryHeader, OisRegistryPanel, OisRuntimeCard } from "@/components/ois";
import OisCard from "@/components/ois/OisCard";
import OisDrawer from "@/components/ois/OisDrawer";
import OisListItem from "@/components/ois/OisListItem";
import OisStatusBadge from "@/components/ois/OisStatusBadge";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { maintenanceService, type MaintenanceItem, type MaintenanceStatus } from "@/services/maintenanceService";
import VerificationBadge from "@/components/modules/VerificationBadge";
import { facilityService, type EstateMembershipRow } from "@/services/facilityService";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronRight, MessageSquare, RefreshCw } from "lucide-react";

type Lane = "active" | "unassigned" | "scheduled" | "waiting" | "completed" | "all";

type WorkOrderForm = {
  status: string;
  assigned_to: string;
  schedule_date: string;
  schedule_time: string;
  note: string;
};

const STATUS_OPTIONS: Array<{ value: MaintenanceStatus; label: string }> = [
  { value: "new", label: "New" },
  { value: "assigned", label: "Assigned" },
  { value: "accepted", label: "Accepted" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting_for_resident", label: "Waiting For Resident" },
  { value: "waiting_for_parts", label: "Waiting For Parts" },
  { value: "completed", label: "Completed" },
  { value: "verified", label: "Verified" },
  { value: "closed", label: "Closed" },
  { value: "cancelled", label: "Cancelled" },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function lower(value: unknown) {
  return String(value || "").toLowerCase();
}

function titleCase(value: unknown) {
  return String(value || "pending source").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function isClosed(item: MaintenanceItem) {
  return ["completed", "closed", "cancelled", "resolved"].includes(lower(item.status));
}

function isWaiting(item: MaintenanceItem) {
  return ["waiting_for_resident", "waiting_for_parts"].includes(lower(item.status));
}

function isAssigned(item: MaintenanceItem) {
  return Boolean(item.assigned_to || item.assigned_operator || item.metadata?.assigned_operator);
}

function scheduledAt(item: MaintenanceItem) {
  const explicit = item.scheduled_at || item.metadata?.scheduled_at;
  if (explicit) return explicit;
  const date = item.schedule_date || item.metadata?.schedule_date;
  const time = item.schedule_time || item.metadata?.schedule_time;
  return date ? `${date}${time ? `T${time}` : ""}` : null;
}

function isScheduledToday(item: MaintenanceItem) {
  const dateValue = scheduledAt(item);
  if (!dateValue) return false;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

function dateLabel(value?: string | null) {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return date.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function statusTone(status?: string) {
  const value = lower(status);
  if (["completed", "closed", "resolved"].includes(value)) return "completed";
  if (["assigned", "scheduled", "in_progress"].includes(value)) return "attention";
  if (["waiting_for_resident", "waiting_for_parts"].includes(value)) return "warning";
  if (value === "cancelled") return "blocked";
  return "pending";
}

function priorityTone(priority?: string | null) {
  const value = lower(priority || "medium");
  if (value === "urgent") return "critical";
  if (value === "high") return "warning";
  if (value === "low") return "stable";
  return "attention";
}

function locationOf(item: MaintenanceItem) {
  return [item.home_name, item.room_name, item.home_id ? `Home ${String(item.home_id).slice(0, 6)}...` : null]
    .filter(Boolean)
    .join(" / ") || "Location pending";
}

function requesterOf(item: MaintenanceItem) {
  return item.resident_name || item.user_name || item.resident_email || item.user_email || item.resident_id || item.user_id || "Resident pending";
}

function ownerOf(item: MaintenanceItem) {
  return item.assigned_operator || item.metadata?.assigned_operator || item.assigned_to || "No operator assigned";
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <OisCard variant="evidence" className="p-3">
      <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--ois-text-muted)]">{label}</div>
      <div className="mt-1 text-sm text-[var(--ois-text-primary)]">{value}</div>
    </OisCard>
  );
}

export default function MaintenancePage() {
  const [items, setItems] = useState<MaintenanceItem[]>([]);
  const [operators, setOperators] = useState<EstateMembershipRow[]>([]);
  const [lane, setLane] = useState<Lane>("active");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<MaintenanceItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<WorkOrderForm>({ status: "assigned", assigned_to: "", schedule_date: "", schedule_time: "", note: "" });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [requests, estateUsers] = await Promise.all([maintenanceService.list(), facilityService.listEstateUsers().catch(() => ({ users: [] }))]);
      setItems(requests);
      setOperators((estateUsers.users || []).filter((member) => !["disabled", "suspended", "removed"].includes(lower(member.status))));
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Failed to load maintenance requests");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const onRealtime = (event: Event) => {
      const name = (event as CustomEvent)?.detail?.event || "";
      if (/maintenance|notification|audit/.test(name)) void load();
    };
    window.addEventListener("facility:realtime-event", onRealtime);
    return () => window.removeEventListener("facility:realtime-event", onRealtime);
  }, []);

  function open(item: MaintenanceItem) {
    setSelected(item);
    const schedule = scheduledAt(item);
    const date = schedule && !Number.isNaN(new Date(schedule).getTime()) ? new Date(schedule) : null;
    setForm({
      status: String(item.status || "assigned"),
      assigned_to: String(item.assigned_to || ""),
      schedule_date: date ? date.toISOString().slice(0, 10) : "",
      schedule_time: date ? date.toTimeString().slice(0, 5) : "",
      note: "",
    });
  }

  async function saveWorkOrder() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    const scheduled_at = form.schedule_date ? `${form.schedule_date}T${form.schedule_time || "09:00"}:00` : undefined;
    const result = await maintenanceService.update(selected.id, {
      status: form.status,
      assigned_to: form.assigned_to.trim() || null,
      note: form.note.trim() || undefined,
      scheduled_at,
      schedule_date: form.schedule_date || undefined,
      schedule_time: form.schedule_time || undefined,
      visit_notes: form.note.trim() || undefined,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setNotice("Maintenance request updated.");
    setSelected(result.request || selected);
    await load();
  }

  const filtered = useMemo(() => {
    if (lane === "all") return items;
    if (lane === "unassigned") return items.filter((item) => !isClosed(item) && !isAssigned(item));
    if (lane === "scheduled") return items.filter((item) => !isClosed(item) && Boolean(scheduledAt(item)));
    if (lane === "waiting") return items.filter(isWaiting);
    if (lane === "completed") return items.filter(isClosed);
    return items.filter((item) => !isClosed(item));
  }, [items, lane]);

  const stats = useMemo(() => {
    const active = items.filter((item) => !isClosed(item));
    return {
      open: active.length,
      assigned: active.filter(isAssigned).length,
      completed: items.filter(isClosed).length,
      unassigned: active.filter((item) => !isAssigned(item)).length,
      escalated: active.filter((item) => ["urgent", "high"].includes(lower(item.priority))).length,
      waiting: active.filter(isWaiting).length,
      scheduledToday: active.filter(isScheduledToday).length,
    };
  }, [items]);

  const timeline = selected
    ? [
        { label: "Original request", body: selected.description || selected.title || "Maintenance request created.", time: selected.created_at },
        ...(selected.assigned_to ? [{ label: "Assigned operator", body: ownerOf(selected), time: selected.updated_at || selected.created_at }] : []),
        ...(scheduledAt(selected) ? [{ label: "Scheduled visit", body: "Visit window recorded for facility follow-up.", time: scheduledAt(selected) }] : []),
        ...(selected.note || selected.notes ? [{ label: "Operator notes", body: selected.note || selected.notes || "", time: selected.updated_at || selected.created_at }] : []),
        ...(selected.completion_notes ? [{ label: "Completion notes", body: selected.completion_notes, time: selected.updated_at || selected.created_at }] : []),
      ]
    : [];

  const columns = useMemo<ColumnDef<MaintenanceItem>[]>(() => [
    {
      accessorKey: "title",
      header: "Work order",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="min-w-[260px]">
            <div className="font-medium text-white">{item.title || "Maintenance request"}</div>
            <div className="mt-1 text-xs text-zinc-500">{locationOf(item)} · {dateLabel(item.created_at)}</div>
          </div>
        );
      },
    },
    { header: "Requester", cell: ({ row }) => <span className="text-sm text-zinc-300">{requesterOf(row.original)}</span> },
    { header: "Owner", cell: ({ row }) => <span className="text-sm text-zinc-300">{ownerOf(row.original)}</span> },
    {
      accessorKey: "priority",
      header: "Priority",
      cell: ({ row }) => <OisStatusBadge status={priorityTone(row.original.priority)} label={titleCase(row.original.priority || "medium")} />,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <OisStatusBadge status={statusTone(row.original.status)} label={titleCase(row.original.status)} />,
    },
    { header: "Schedule", cell: ({ row }) => <span className="text-xs text-zinc-400">{scheduledAt(row.original) ? dateLabel(scheduledAt(row.original)) : "Not scheduled"}</span> },
    { id: "actions", header: "", cell: ({ row }) => <Button variant="ghost" onClick={() => open(row.original)}>Open</Button> },
  ], []);

  return (
    <div className="space-y-6">
      <Topbar title="Maintenance Continuity" subtitle="Work orders and ownership" strip={[{ label: "Healthy", value: stats.unassigned || stats.escalated ? "Review" : "Stable", detail: "Queue posture", tone: stats.unassigned || stats.escalated ? "warning" : "stable" }, { label: "Open", value: stats.open, detail: "Active requests", tone: "attention" }, { label: "Attention", value: stats.unassigned + stats.escalated, detail: "Unassigned or escalated", tone: "warning" }, { label: "Updated", value: loading ? "Refreshing" : "Now", detail: "Queue sync", tone: "info" }]} />
      {error ? <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
      {notice ? <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{notice}</div> : null}

      <OisRegistryPanel
        title="Maintenance Queue"
        caption={loading ? "Loading records" : `${filtered.length} records`}
        toolbar={<OisPageToolbar
          filterSlot={
            <div className="flex flex-wrap gap-2">
              {([
                ["active", "Active"],
                ["unassigned", "Unassigned"],
                ["scheduled", "Scheduled"],
                ["waiting", "Waiting"],
                ["completed", "Completed"],
                ["all", "All"],
              ] as Array<[Lane, string]>).map(([key, label]) => (
                <button key={key} type="button" onClick={() => setLane(key)} className={cn("rounded-full border px-3 py-2 text-xs transition", lane === key ? "border-sky-400/40 bg-sky-500/10 text-sky-100" : "border-white/10 bg-white/5 text-zinc-400 hover:text-white")}>{label}</button>
              ))}
            </div>
          }
          onRefresh={() => void load()}
          refreshing={loading}
          searchPlaceholder="Search maintenance queue..."
        />}
        className="p-4"
      >
        <div className="hidden md:block">
          <DataTable data={filtered} columns={columns} title="Maintenance Queue" searchKey="title" />
        </div>
        <div className="space-y-2 md:hidden">{filtered.map((item) => <OisListItem key={item.id} title={item.title || "Maintenance request"} description={`${locationOf(item)} · ${titleCase(item.priority || "medium")} priority`} meta={scheduledAt(item) ? `Visit ${dateLabel(scheduledAt(item))}` : ownerOf(item)} status={statusTone(item.status)} action={<ChevronRight className="h-4 w-4 text-[var(--ois-text-muted)]" />} onClick={() => open(item)} className="w-full text-left" />)}{!filtered.length && !loading ? <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">No maintenance items in this lane.</p> : null}</div>
      </OisRegistryPanel>

      <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <OisCard className="p-4">
          <h2 className="text-sm font-semibold text-white">Attention lanes</h2>
          <div className="mt-3 space-y-2 text-sm">
            <Field label="Unassigned requests" value={stats.unassigned} />
            <Field label="Waiting for resident" value={items.filter((item) => lower(item.status) === "waiting_for_resident").length} />
            <Field label="Waiting for parts" value={items.filter((item) => lower(item.status) === "waiting_for_parts").length} />
            <Field label="Escalated requests" value={stats.escalated} />
            <Field label="SLA visibility" value="Awaiting SLA readiness" />
          </div>
        </OisCard>
        <OisCard className="p-4">
          <h2 className="text-sm font-semibold text-white">Resident Continuity</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">Resident-submitted maintenance requests appear here. Status changes notify the requester through the existing backend maintenance update route.</p>
          <Link href="/overview" className="mt-3 inline-flex text-sm text-sky-200">Return to overview</Link>
        </OisCard>
      </section>

      <OisRuntimeCard
        title="Runtime Insights"
        items={[
          { label: "Scheduled today", value: stats.scheduledToday, delta: "visit windows recorded" },
          { label: "Waiting items", value: stats.waiting, delta: "resident or parts dependency" },
          { label: "Escalated", value: stats.escalated, delta: "urgent or high priority" },
        ]}
      />

      <OisDrawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.title || "Maintenance request"}
        subtitle={selected ? `${locationOf(selected)} · ${dateLabel(selected.created_at)}` : undefined}
        width="lg"
        footer={selected ? <div className="space-y-3"><Button onClick={() => void saveWorkOrder()} disabled={saving}>{saving ? "Saving" : "Save update"}</Button><p className="text-xs leading-5 text-zinc-500">Backend persists status and assigned operator. Technician acknowledgement and completion proof remain pending backend workflow support.</p></div> : null}
      >
        {selected ? <div className="space-y-4"><OisCard variant="evidence" className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-zinc-300">{selected.description || selected.title || "Maintenance request created."}</p><p className="mt-2 text-xs text-zinc-500">Requester {requesterOf(selected)}</p></div><div className="flex flex-wrap gap-2"><OisStatusBadge status={statusTone(selected.status)} label={titleCase(selected.status)} /><OisStatusBadge status={priorityTone(selected.priority)} label={titleCase(selected.priority || "medium")} /></div></div></OisCard><div className="grid gap-3 sm:grid-cols-2"><Field label="Requester" value={requesterOf(selected)} /><Field label="Current owner" value={ownerOf(selected)} /><Field label="Scheduled visit" value={scheduledAt(selected) ? dateLabel(scheduledAt(selected)) : "Not scheduled"} /><Field label="Ownership activity" value={selected.assigned_to ? `Assigned to ${ownerOf(selected)} on ${dateLabel(selected.updated_at || selected.created_at)}` : "No ownership activity recorded"} /><Field label="Request age" value={dateLabel(selected.created_at)} />{selected.verified_at || selected.verified_by_resident !== undefined || selected.resident_rating !== undefined || selected.resident_feedback ? <><Field label="Verification status" value={<VerificationBadge state={selected.verified_at || selected.verified_by_resident ? "verified" : "pending"} />} /><Field label="Resident confirmation" value={selected.verified_by_resident ? "Confirmed" : "Not recorded"} />{selected.resident_rating !== undefined && selected.resident_rating !== null ? <Field label="Resident rating" value={`${selected.resident_rating}/5`} /> : null}{selected.resident_feedback ? <Field label="Resident feedback" value={selected.resident_feedback} /> : null}</> : null}</div><OisCard variant="evidence" className="p-4"><h3 className="text-sm font-semibold text-white">Resident Communication Activity</h3><div className="mt-4 space-y-3">{timeline.map((item, index) => <div key={`${item.label}-${index}`} className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3"><MessageSquare className="mt-0.5 h-4 w-4 text-sky-200" /><div><div className="text-sm text-white">{item.label}</div><div className="mt-1 text-sm text-zinc-400">{item.body}</div><div className="mt-1 text-xs text-zinc-600">{dateLabel(item.time)}</div></div></div>)}{!timeline.length ? <p className="text-sm text-zinc-500">No communication activity is available for this request.</p> : null}</div></OisCard><OisCard variant="evidence" className="p-4"><h3 className="text-sm font-semibold text-white">Lifecycle Readiness</h3><div className="mt-4 grid gap-3"><label className="text-xs text-zinc-400">Status<select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-3 text-sm text-white outline-none">{STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label className="text-xs text-zinc-400">Assigned operator<select value={form.assigned_to} onChange={(event) => setForm((current) => ({ ...current, assigned_to: event.target.value }))} className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-3 text-sm text-white outline-none"><option value="">Unassigned</option>{operators.map((operator) => <option key={operator.id} value={operator.users?.id || ""}>{operator.users?.full_name || operator.users?.username || operator.users?.email || "Unnamed operator"} · {String(operator.role || "operator").replace(/_/g, " ")}</option>)}</select></label><div className="grid grid-cols-2 gap-2"><label className="text-xs text-zinc-400">Schedule date<input type="date" value={form.schedule_date} onChange={(event) => setForm((current) => ({ ...current, schedule_date: event.target.value }))} className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-3 text-sm text-white outline-none" /></label><label className="text-xs text-zinc-400">Time<input type="time" value={form.schedule_time} onChange={(event) => setForm((current) => ({ ...current, schedule_time: event.target.value }))} className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-3 text-sm text-white outline-none" /></label></div><label className="text-xs text-zinc-400">Resident / operator note<textarea value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} rows={4} placeholder="Visible update note if backend supports it" className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-3 text-sm text-white outline-none" /></label></div></OisCard></div> : null}
      </OisDrawer>
    </div>
  );
}
