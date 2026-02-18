// app/(protected)/maintenance/page.tsx
"use client";

import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import {
  maintenanceService,
  type MaintenanceItem,
} from "@/services/maintenanceService";
import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type Lane = "open" | "in_progress" | "resolved" | "all";
type Priority = "low" | "medium" | "high" | "urgent" | string;

function safeLower(v: any) {
  return String(v ?? "").toLowerCase();
}

function statusTone(status: string) {
  const s = safeLower(status);
  if (s === "resolved" || s === "closed") return "text-emerald-200 bg-emerald-500/10 border-emerald-500/20";
  if (s === "in_progress" || s === "assigned") return "text-amber-200 bg-amber-500/10 border-amber-500/20";
  if (s === "open" || s === "new") return "text-sky-200 bg-sky-500/10 border-sky-500/20";
  if (s === "cancelled") return "text-zinc-200 bg-white/5 border-white/10";
  return "text-zinc-200 bg-white/5 border-white/10";
}

function priorityTone(p: Priority) {
  const v = safeLower(p);
  if (v === "urgent") return "text-red-200 bg-red-500/10 border-red-500/20";
  if (v === "high") return "text-amber-200 bg-amber-500/10 border-amber-500/20";
  if (v === "medium") return "text-zinc-200 bg-white/5 border-white/10";
  if (v === "low") return "text-emerald-200 bg-emerald-500/10 border-emerald-500/20";
  return "text-zinc-200 bg-white/5 border-white/10";
}

function formatAgo(isoLike: any) {
  const d = new Date(isoLike);
  if (Number.isNaN(d.getTime())) return String(isoLike ?? "-");
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function getLocationLabel(item: any) {
  // We don't know your exact schema, so we safely stitch the best signal we can.
  // If you later add `home_name`, `unit`, `block`, `zone`, `room_name`, etc. this will auto-render.
  const parts = [
    item?.zone,
    item?.block,
    item?.building,
    item?.unit,
    item?.apartment,
    item?.home_name,
    item?.home?.name,
    item?.room_name,
    item?.room?.name,
  ]
    .map((x: any) => String(x || "").trim())
    .filter(Boolean);

  if (parts.length) return parts.join(" • ");

  // fallback: if you only have IDs today
  const homeId = item?.home_id ? `Home ${String(item.home_id).slice(0, 6)}…` : "";
  const roomId = item?.room_id ? `Room ${String(item.room_id).slice(0, 6)}…` : "";
  const estateId = item?.estate_id ? `Estate ${String(item.estate_id).slice(0, 6)}…` : "";

  const fallback = [homeId, roomId, estateId].filter(Boolean).join(" • ");
  return fallback || "—";
}

function getRequesterLabel(item: any) {
  // If you later join and expose resident info, it will show here.
  const name =
    item?.resident_name ||
    item?.resident?.name ||
    item?.user_name ||
    item?.user?.name ||
    "";
  const email =
    item?.resident_email || item?.resident?.email || item?.user?.email || "";
  const id = item?.resident_id || item?.user_id || "";

  const cleanName = String(name || "").trim();
  const cleanEmail = String(email || "").trim();

  if (cleanName && cleanEmail) return `${cleanName} • ${cleanEmail}`;
  if (cleanName) return cleanName;
  if (cleanEmail) return cleanEmail;
  if (id) return `Resident ${String(id).slice(0, 6)}…`;
  return "—";
}

export default function MaintenancePage() {
  const [items, setItems] = useState<MaintenanceItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [lane, setLane] = useState<Lane>("open");
  const [selected, setSelected] = useState<MaintenanceItem | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await maintenanceService.list(
        lane === "all" ? undefined : { status: lane }
      );
      setItems(res || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lane]);

  const stats = useMemo(() => {
    const total = items.length;
    let open = 0,
      inProg = 0,
      resolved = 0;
    let high = 0;

    for (const it of items as any[]) {
      const s = safeLower(it?.status);
      if (s === "open") open += 1;
      else if (s === "in_progress") inProg += 1;
      else if (s === "resolved") resolved += 1;

      const p = safeLower(it?.priority);
      if (p === "high" || p === "urgent") high += 1;
    }

    return { total, open, inProg, resolved, high };
  }, [items]);

  const columns = useMemo<ColumnDef<MaintenanceItem>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Request",
        cell: ({ row }) => {
          const it: any = row.original;
          const category = it?.category ? String(it.category) : "";
          const desc = it?.description ? String(it.description) : "";
          const created = it?.created_at;

          return (
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="font-medium text-zinc-100 truncate">
                  {String(it?.title ?? "-")}
                </div>
                {category ? (
                  <span className="inline-flex px-2 py-1 rounded-full border border-white/10 bg-white/5 text-[11px] text-zinc-200">
                    {category}
                  </span>
                ) : null}
              </div>

              {desc ? (
                <div className="mt-1 text-sm text-zinc-400 line-clamp-2">
                  {desc}
                </div>
              ) : null}

              <div className="mt-2 flex items-center gap-2 flex-wrap text-[11px] text-zinc-400">
                <span>Created {formatAgo(created)}</span>
                <span className="text-white/20">•</span>
                <span className="truncate">From: {getLocationLabel(it)}</span>
              </div>
            </div>
          );
        },
      },
      {
        id: "priority",
        header: "Priority",
        cell: ({ row }) => {
          const it: any = row.original;
          const p = it?.priority ?? "medium";
          return (
            <span className={cn("px-2 py-1 rounded-full border text-xs", priorityTone(p))}>
              {String(p)}
            </span>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const it: any = row.original;
          const s = it?.status ?? "unknown";
          return (
            <span className={cn("px-2 py-1 rounded-full border text-xs", statusTone(s))}>
              {String(s)}
            </span>
          );
        },
      },
      {
        id: "requester",
        header: "Requester",
        cell: ({ row }) => {
          const it: any = row.original;
          return (
            <div className="text-sm text-zinc-300">
              {getRequesterLabel(it)}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              onClick={() => setSelected(row.original)}
            >
              Open
            </Button>
          </div>
        ),
      },
    ],
    []
  );

  const laneTabs: Array<{ key: Lane; label: string; hint: string }> = [
    { key: "open", label: "Open", hint: "New & unassigned" },
    { key: "in_progress", label: "In Progress", hint: "Assigned & being worked" },
    { key: "resolved", label: "Resolved", hint: "Closed tickets" },
    { key: "all", label: "All", hint: "Everything" },
  ];

  const selectedAny: any = selected;

  return (
    <div className="space-y-7">
      <Topbar
        title="Maintenance Command"
        subtitle="Work orders • routing • assignments • audit"
      />

      {/* Lane tabs + actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {laneTabs.map((t) => {
            const active = lane === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setLane(t.key)}
                className={cn(
                  "rounded-full px-3 py-2 text-xs border transition",
                  active
                    ? "border-white/20 bg-white/10 text-zinc-100"
                    : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
                )}
                title={t.hint}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <Button variant="ghost" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {/* Command overview (operator snapshot) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <div className="text-xs text-zinc-400">Workload</div>
          <div className="mt-2 text-2xl font-semibold text-zinc-100">
            {stats.total} request(s)
          </div>
          <div className="mt-2 text-sm text-zinc-400">
            High priority: <span className="text-zinc-200">{stats.high}</span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { k: "Open", v: stats.open },
              { k: "In Prog", v: stats.inProg },
              { k: "Resolved", v: stats.resolved },
            ].map((x) => (
              <div
                key={x.k}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-3"
              >
                <div className="text-[11px] text-zinc-400">{x.k}</div>
                <div className="mt-1 text-sm text-zinc-200 font-medium">
                  {x.v}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 text-[11px] text-zinc-400">
            Next: wire “Assignments” + “SLA timers” when you’re ready. This page already has the command layout.
          </div>
        </div>

        <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <div className="text-xs text-zinc-400">Operator actions</div>
          <div className="mt-2 text-base font-semibold text-zinc-100">
            Response shortcuts
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              {
                title: "Assign technician",
                desc: "Route ticket to a technician/team",
                onClick: () => alert("Wire to assignment modal"),
              },
              {
                title: "Broadcast update",
                desc: "Notify resident about progress",
                onClick: () => alert("Wire to notifications composer"),
              },
              {
                title: "Escalate to facility",
                desc: "Raise severity + add supervisor",
                onClick: () => alert("Wire to escalation flow"),
              },
              {
                title: "Export log",
                desc: "Download operational report",
                onClick: () => alert("Wire to export endpoint"),
              },
            ].map((x) => (
              <button
                key={x.title}
                type="button"
                onClick={x.onClick}
                className="text-left rounded-2xl border border-white/10 bg-black/20 hover:bg-black/30 transition p-4"
              >
                <div className="text-sm font-semibold text-zinc-100">
                  {x.title}
                </div>
                <div className="mt-1 text-sm text-zinc-400">{x.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <div className="text-xs text-zinc-400">Routing signals</div>
          <div className="mt-2 text-base font-semibold text-zinc-100">
            What’s missing now
          </div>

          <div className="mt-4 space-y-3 text-sm text-zinc-400">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-zinc-200 font-medium">Location (Unit/Zone)</div>
              <div className="mt-1">
                Add join/fields so each ticket shows exact apartment/zone.
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-zinc-200 font-medium">Assignment</div>
              <div className="mt-1">
                assigned_to + technician directory for routing.
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-zinc-200 font-medium">SLA</div>
              <div className="mt-1">
                timers + escalation thresholds.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <DataTable
        data={items}
        columns={columns}
        title="Maintenance Requests"
        searchKey={"title"}
      />

      {/* Details drawer/modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setSelected(null)}
          />
          <div className="relative w-full max-w-3xl rounded-2xl border border-white/10 bg-zinc-950/70 backdrop-blur p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-lg font-semibold text-zinc-100 truncate">
                  {String((selectedAny?.title ?? "Maintenance Request") as any)}
                </div>
                <div className="mt-1 text-sm text-zinc-400">
                  From: <span className="text-zinc-200">{getLocationLabel(selectedAny)}</span>
                </div>
              </div>

              <button
                className="text-zinc-400 hover:text-zinc-200"
                onClick={() => setSelected(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <span className={cn("px-2 py-1 rounded-full border text-xs", statusTone(selectedAny?.status))}>
                {String(selectedAny?.status ?? "unknown")}
              </span>
              <span className={cn("px-2 py-1 rounded-full border text-xs", priorityTone(selectedAny?.priority ?? "medium"))}>
                {String(selectedAny?.priority ?? "medium")}
              </span>
              {selectedAny?.category ? (
                <span className="px-2 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-zinc-200">
                  {String(selectedAny.category)}
                </span>
              ) : null}
              <span className="text-xs text-zinc-400">
                Created {formatAgo(selectedAny?.created_at)}
              </span>
            </div>

            {selectedAny?.description ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs text-zinc-400">Description</div>
                <div className="mt-2 text-sm text-zinc-200 leading-6">
                  {String(selectedAny.description)}
                </div>
              </div>
            ) : null}

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs text-zinc-400">Requester</div>
                <div className="mt-2 text-sm text-zinc-200">
                  {getRequesterLabel(selectedAny)}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs text-zinc-400">Identifiers</div>
                <div className="mt-2 text-[12px] text-zinc-300 space-y-1">
                  <div>ticket_id: <span className="text-zinc-200">{String(selectedAny?.id ?? "-")}</span></div>
                  <div>estate_id: <span className="text-zinc-200">{String(selectedAny?.estate_id ?? "-")}</span></div>
                  <div>home_id: <span className="text-zinc-200">{String(selectedAny?.home_id ?? "-")}</span></div>
                  <div>room_id: <span className="text-zinc-200">{String(selectedAny?.room_id ?? "-")}</span></div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2 flex-wrap">
              <Button
                variant="ghost"
                onClick={() => alert("Wire: set status = in_progress")}
              >
                Mark In Progress
              </Button>
              <Button
                variant="ghost"
                onClick={() => alert("Wire: assign technician")}
              >
                Assign
              </Button>
              <Button
                onClick={() => alert("Wire: set status = resolved")}
              >
                Resolve
              </Button>
            </div>

            <div className="mt-4 text-[11px] text-zinc-500">
              Note: Once your API returns unit/zone/home names, this modal will immediately show the exact apartment.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
