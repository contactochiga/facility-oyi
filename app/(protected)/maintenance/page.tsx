"use client";

import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import {
  maintenanceService,
  type MaintenanceItem,
} from "@/services/maintenanceService";
import { deviceService, type FacilityDevice } from "@/services/deviceService";
import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Wrench,
  CheckCircle,
  Clock,
  AlertCircle,
  Plus,
} from "lucide-react";

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
  if (s === "resolved" || s === "closed")
    return "text-emerald-200 bg-emerald-500/10 border-emerald-500/20";
  if (s === "in_progress" || s === "assigned")
    return "text-sky-200 bg-sky-500/10 border-sky-500/20";
  if (s === "open" || s === "new")
    return "text-amber-200 bg-amber-500/10 border-amber-500/20";
  if (s === "cancelled")
    return "text-zinc-200 bg-white/5 border-white/10";
  return "text-zinc-200 bg-white/5 border-white/10";
}

function priorityTone(p: Priority) {
  const v = safeLower(p);
  if (v === "urgent") return "text-red-200 bg-red-500/10 border-red-500/20";
  if (v === "high") return "text-amber-200 bg-amber-500/10 border-amber-500/20";
  if (v === "medium") return "text-sky-200 bg-sky-500/10 border-sky-500/20";
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

  const homeId = item?.home_id ? `Home ${String(item.home_id).slice(0, 6)}…` : "";
  const roomId = item?.room_id ? `Room ${String(item.room_id).slice(0, 6)}…` : "";
  const estateId = item?.estate_id ? `Estate ${String(item.estate_id).slice(0, 6)}…` : "";
  const fallback = [homeId, roomId, estateId].filter(Boolean).join(" • ");
  return fallback || "—";
}

function getRequesterLabel(item: any) {
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

/** UI-only card, local to this page (no new dependency) */
function MetricCard({
  title,
  value,
  sub,
  Icon,
  iconClass,
}: {
  title: string;
  value: string | number;
  sub?: string;
  Icon: any;
  iconClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-white/50">{title}</div>
          <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
          {sub ? <div className="mt-2 text-xs text-white/45">{sub}</div> : null}
        </div>
        <div
          className={cn(
            "h-10 w-10 rounded-xl border border-white/10 bg-black/20 flex items-center justify-center",
            iconClass
          )}
        >
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

export default function MaintenancePage() {
  const [items, setItems] = useState<MaintenanceItem[]>([]);
  const [devices, setDevices] = useState<FacilityDevice[]>([]);
  const [loading, setLoading] = useState(false);

  const [lane, setLane] = useState<Lane>("open");
  const [selected, setSelected] = useState<MaintenanceItem | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [res, dev] = await Promise.all([
        maintenanceService.list(lane === "all" ? undefined : { status: lane }),
        deviceService.list(),
      ]);
      setItems(res || []);
      setDevices(Array.isArray(dev) ? dev : []);
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
    let urgent = 0;

    for (const it of items as any[]) {
      const s = safeLower(it?.status);
      if (s === "open") open += 1;
      else if (s === "in_progress") inProg += 1;
      else if (s === "resolved") resolved += 1;

      const p = safeLower(it?.priority);
      if (p === "urgent") urgent += 1;
      if (p === "high" || p === "urgent") high += 1;
    }

    const pendingTasks = open;
    const inProgress = inProg;
    const criticalIssues = urgent;

    return {
      total,
      open,
      inProg,
      resolved,
      high,
      urgent,
      pendingTasks,
      inProgress,
      criticalIssues,
    };
  }, [items]);

  const activeTasks = useMemo(() => {
    const arr = [...(items as any[])];
    // prioritize urgent/high, then newest
    arr.sort((a, b) => {
      const pa = safeLower(a?.priority);
      const pb = safeLower(b?.priority);
      const score = (p: string) =>
        p === "urgent" ? 3 : p === "high" ? 2 : p === "medium" ? 1 : 0;
      const s = score(pb) - score(pa);
      if (s !== 0) return s;
      const ta = new Date(a?.created_at || 0).getTime();
      const tb = new Date(b?.created_at || 0).getTime();
      return tb - ta;
    });

    return arr.slice(0, 5);
  }, [items]);

  const recentCompletions = useMemo(() => {
    const resolved = (items as any[]).filter(
      (x) => safeLower(x?.status) === "resolved" || safeLower(x?.status) === "closed"
    );
    resolved.sort((a, b) => {
      const ta = new Date(a?.updated_at || a?.resolved_at || a?.created_at || 0).getTime();
      const tb = new Date(b?.updated_at || b?.resolved_at || b?.created_at || 0).getTime();
      return tb - ta;
    });
    return resolved.slice(0, 4);
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
          return <div className="text-sm text-zinc-300">{getRequesterLabel(it)}</div>;
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => setSelected(row.original)}>
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

  const equipmentStatus = useMemo(() => {
    const groups = new Map<
      string,
      { category: string; total: number; operational: number; maintenance: number; faulty: number }
    >();

    for (const d of devices as any[]) {
      const label = String(d?.type || "Devices");
      const row =
        groups.get(label) || {
          category: label,
          total: 0,
          operational: 0,
          maintenance: 0,
          faulty: 0,
        };

      row.total += 1;
      const s = safeLower(d?.status);
      if (s === "active" || s === "online" || s === "ok") row.operational += 1;
      else if (s === "offline" || s === "down" || s === "error") row.faulty += 1;
      else row.maintenance += 1;

      groups.set(label, row);
    }

    return Array.from(groups.values()).sort((a, b) => b.total - a.total).slice(0, 6);
  }, [devices]);

  return (
    <div className="space-y-7">
      <Topbar
        title="Facility Maintenance"
        subtitle="Work orders • assignments • status tracking"
      />

      {/* Tabs + actions */}
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

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => {}}
            disabled
          >
            <span className="inline-flex items-center gap-2">
              <Plus size={16} />
              Create Task Soon
            </span>
          </Button>

          <Button variant="ghost" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Pending Tasks"
          value={stats.pendingTasks}
          sub={stats.high ? `${stats.high} high priority` : "No high priority"}
          Icon={Clock}
          iconClass="text-amber-200"
        />
        <MetricCard
          title="In Progress"
          value={stats.inProgress}
          sub={stats.inProgress ? "Active teams working" : "No active work"}
          Icon={Wrench}
          iconClass="text-sky-200"
        />
        <MetricCard
          title="Completed"
          value={stats.resolved}
          sub="Resolved tickets"
          Icon={CheckCircle}
          iconClass="text-emerald-200"
        />
        <MetricCard
          title="Critical Issues"
          value={stats.criticalIssues}
          sub={stats.criticalIssues ? "Needs immediate attention" : "No critical issues"}
          Icon={AlertCircle}
          iconClass="text-red-200"
        />
      </div>

      {/* Main panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Active tasks */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-white">
                Active Maintenance Tasks
              </div>
              <div className="mt-1 text-sm text-white/50">
                Live work orders being handled by the facility team.
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={() => {}}
              disabled
            >
              Create Task Soon
            </Button>
          </div>

          <div className="mt-5 space-y-3">
            {activeTasks.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
                No tasks in this lane yet.
              </div>
            ) : (
              activeTasks.map((task: any) => {
                const p = task?.priority ?? "medium";
                const s = task?.status ?? "open";
                const id = task?.id ? String(task.id) : "—";
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelected(task)}
                    className="w-full text-left rounded-xl border border-white/10 bg-black/20 hover:bg-black/30 transition p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                          {String(task?.title ?? "Maintenance Request")}
                        </div>
                        <div className="mt-1 text-xs text-white/45">
                          ID: {String(id)}
                          <span className="text-white/20"> • </span>
                          {getLocationLabel(task)}
                        </div>
                      </div>

                      <span
                        className={cn(
                          "px-2 py-1 rounded-full border text-xs shrink-0",
                          priorityTone(p)
                        )}
                      >
                        {String(p)}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={cn(
                            "px-2 py-1 rounded-full border",
                            statusTone(s)
                          )}
                        >
                          {String(s)}
                        </span>
                        <span className="text-white/45">
                          Requested {formatAgo(task?.created_at)}
                        </span>
                      </div>
                      <span className="text-white/45">Open</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Equipment status */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6">
          <div className="text-lg font-semibold text-white">Equipment Status</div>
          <div className="mt-1 text-sm text-white/50">
            Operational overview from live device inventory.
          </div>

          <div className="mt-5 space-y-4">
            {!equipmentStatus.length ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
                No equipment data available yet.
              </div>
            ) : equipmentStatus.map((eq) => {
              const opW = (eq.operational / eq.total) * 100;
              const mW = (eq.maintenance / eq.total) * 100;
              const fW = (eq.faulty / eq.total) * 100;

              return (
                <div key={eq.category}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white/90">
                      {eq.category}
                    </span>
                    <span className="text-sm text-white/45">
                      {eq.operational}/{eq.total}
                    </span>
                  </div>

                  <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-white/10">
                    <div className="bg-emerald-500" style={{ width: `${opW}%` }} />
                    <div className="bg-amber-500" style={{ width: `${mW}%` }} />
                    <div className="bg-red-500" style={{ width: `${fW}%` }} />
                  </div>

                  <div className="flex items-center gap-4 mt-2 text-xs flex-wrap">
                    <span className="flex items-center gap-1 text-emerald-300">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      {eq.operational} Operational
                    </span>
                    {eq.maintenance > 0 ? (
                      <span className="flex items-center gap-1 text-amber-300">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        {eq.maintenance} Maintenance
                      </span>
                    ) : null}
                    {eq.faulty > 0 ? (
                      <span className="flex items-center gap-1 text-red-300">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        {eq.faulty} Faulty
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recently completed (from real items) */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6">
        <div className="flex items-center gap-2">
          <CheckCircle className="text-emerald-300" size={18} />
          <div className="text-lg font-semibold text-white">Recently Completed</div>
        </div>
        <div className="mt-1 text-sm text-white/50">
          Closed work orders — quick audit trail.
        </div>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-3">
          {recentCompletions.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
              No completed tasks in this lane yet.
            </div>
          ) : (
            recentCompletions.map((it: any) => (
              <button
                key={String(it?.id ?? `${it?.title || "resolved"}-${it?.created_at || ""}`)}
                type="button"
                onClick={() => setSelected(it)}
                className="text-left rounded-xl border border-white/10 bg-black/20 hover:bg-black/30 transition p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <CheckCircle className="text-emerald-300" size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-white truncate">
                      {String(it?.title ?? "Resolved maintenance request")}
                    </div>
                    <div className="mt-1 text-xs text-white/45">
                      {getLocationLabel(it)}
                      <span className="text-white/20"> • </span>
                      {formatAgo(it?.updated_at || it?.resolved_at || it?.created_at)}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Table (kept exactly) */}
      <DataTable
        data={items}
        columns={columns}
        title="Maintenance Requests"
        searchKey={"title"}
      />

      {/* Details modal (kept exactly, just fits new look) */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/70" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-3xl rounded-2xl border border-white/10 bg-zinc-950/70 backdrop-blur p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-lg font-semibold text-zinc-100 truncate">
                  {String((selectedAny?.title ?? "Maintenance Request") as any)}
                </div>
                <div className="mt-1 text-sm text-zinc-400">
                  From:{" "}
                  <span className="text-zinc-200">{getLocationLabel(selectedAny)}</span>
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
                  <div>
                    ticket_id:{" "}
                    <span className="text-zinc-200">{String(selectedAny?.id ?? "-")}</span>
                  </div>
                  <div>
                    estate_id:{" "}
                    <span className="text-zinc-200">{String(selectedAny?.estate_id ?? "-")}</span>
                  </div>
                  <div>
                    home_id:{" "}
                    <span className="text-zinc-200">{String(selectedAny?.home_id ?? "-")}</span>
                  </div>
                  <div>
                    room_id:{" "}
                    <span className="text-zinc-200">{String(selectedAny?.room_id ?? "-")}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2 flex-wrap">
              <Button variant="ghost" onClick={() => {}} disabled>
                Mark In Progress
              </Button>
              <Button variant="ghost" onClick={() => {}} disabled>
                Assign
              </Button>
              <Button onClick={() => {}} disabled>
                Resolve
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
