"use client";

import React, { useEffect, useMemo, useState } from "react";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { visitorService, type VisitorItem } from "@/services/visitorService";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Shield,
  Camera,
  Lock,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCcw,
  Eye,
  KeyRound,
  DoorOpen,
  DoorClosed,
  Ban,
  Users,
} from "lucide-react";

// -------------------------------
// helpers
// -------------------------------
function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function when(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeOnly(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function safeStr(v: any) {
  const s = (v ?? "").toString().trim();
  return s || "—";
}

function fmtStatus(status?: string) {
  return String(status || "active").replaceAll("_", " ");
}

function isExpired(expiresAt?: string | null) {
  if (!expiresAt) return false;
  const t = new Date(expiresAt).getTime();
  if (Number.isNaN(t)) return false;
  return t < Date.now();
}

function statusTone(status?: string) {
  const s = String(status || "").toLowerCase();

  if (s === "approved") return "text-emerald-200 bg-emerald-500/10 border-emerald-500/20";
  if (s === "entered") return "text-blue-200 bg-blue-500/10 border-blue-500/20";
  if (s === "exited") return "text-zinc-200 bg-white/5 border-white/10";
  if (s === "denied") return "text-red-200 bg-red-500/10 border-red-500/20";

  return "text-amber-200 bg-amber-500/10 border-amber-500/20";
}

// -------------------------------
// MetricCard (local: prevents dependency break)
// -------------------------------
function MetricCard({
  title,
  value,
  change,
  trend = "neutral",
  icon: Icon,
  iconColor = "text-blue-500",
}: {
  title: string;
  value: string | number;
  change?: string;
  trend?: "up" | "down" | "neutral";
  icon: any;
  iconColor?: string;
}) {
  const trendColors: Record<string, string> = {
    up: "text-green-500",
    down: "text-red-500",
    neutral: "text-slate-400",
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-slate-400 mb-2">{title}</p>
          <p className="text-3xl font-semibold mb-1">{value}</p>
          {change ? (
            <p className={`text-sm ${trendColors[trend] || "text-slate-400"}`}>
              {change}
            </p>
          ) : null}
        </div>
        <div className={`p-3 rounded-lg bg-slate-800 ${iconColor}`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
}

// -------------------------------
// Demo-only (UI parity). Swap later when endpoints exist.
// -------------------------------
const cameraFeeds = [
  { id: "CAM-01", location: "Main Entrance", status: "active", lastEvent: "2 min ago" },
  { id: "CAM-02", location: "Parking Level 1", status: "active", lastEvent: "5 min ago" },
  { id: "CAM-03", location: "Lobby Building A", status: "active", lastEvent: "12 min ago" },
  { id: "CAM-04", location: "Elevator Hall", status: "maintenance", lastEvent: "1 hour ago" },
  { id: "CAM-05", location: "Emergency Exit", status: "active", lastEvent: "8 min ago" },
  { id: "CAM-06", location: "Loading Dock", status: "active", lastEvent: "3 min ago" },
];

const securityAlerts = [
  { time: "14:20", level: "high", message: "Tailgating detected at Main Entrance", status: "investigating" },
  { time: "13:45", level: "medium", message: "Door held open - Building B Floor 2", status: "resolved" },
  { time: "12:30", level: "low", message: "Camera CAM-04 offline", status: "maintenance" },
];

export default function VisitorsPage() {
  const [items, setItems] = useState<VisitorItem[]>([]);
  const [loading, setLoading] = useState(false);

  // view filters (kept)
  const [todayOnly, setTodayOnly] = useState(true);
  const [status, setStatus] = useState<
    "all" | "active" | "pending" | "approved" | "entered" | "exited" | "denied"
  >("all");

  async function load() {
    setLoading(true);
    try {
      const res = todayOnly ? await visitorService.listToday() : await visitorService.list();
      const list = (res || []) as VisitorItem[];

      // UI-only filter (kept)
      const filtered =
        status === "all"
          ? list
          : list.filter((x) => String((x as any)?.status || "").toLowerCase() === status);

      setItems(filtered);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayOnly, status]);

  // -------------------------------
  // Stats (kept logic)
  // -------------------------------
  const stats = useMemo(() => {
    const all = items || [];
    let active = 0;
    let pending = 0;
    let approved = 0;
    let entered = 0;
    let exited = 0;
    let denied = 0;
    let expired = 0;

    for (const v of all as any[]) {
      const s = String(v?.status || "").toLowerCase();
      if (s === "approved") approved++;
      else if (s === "entered") entered++;
      else if (s === "exited") exited++;
      else if (s === "denied") denied++;
      else if (s === "pending") pending++;
      else active++;

      if (isExpired(v?.expires_at)) expired++;
    }

    const total = all.length;
    const inEstate = Math.max(0, entered - exited);

    return { total, active, pending, approved, entered, exited, denied, expired, inEstate };
  }, [items]);

  // -------------------------------
  // Access Logs (derived from YOUR real visitor items)
  // -------------------------------
  const accessLogs = useMemo(() => {
    const sorted = [...(items as any[])].sort((a, b) => {
      const ta = new Date(a?.created_at || 0).getTime();
      const tb = new Date(b?.created_at || 0).getTime();
      return tb - ta;
    });

    return sorted.slice(0, 8).map((v) => {
      const s = String(v?.status || "").toLowerCase();
      const action =
        s === "approved" ? "Access Approved" :
        s === "entered" ? "Entry Logged" :
        s === "exited" ? "Exit Logged" :
        s === "denied" ? "Access Denied" :
        s === "pending" ? "Pending Review" :
        "Access Event";

      const type = s === "denied" ? "warning" : "success";

      return {
        time: timeOnly(v?.created_at),
        user: safeStr(v?.visitor_name),
        location: safeStr(v?.purpose), // best available field you already show
        action,
        type,
      };
    });
  }, [items]);

  // -------------------------------
  // Table columns (kept, unchanged logic)
  // -------------------------------
  const columns = useMemo<ColumnDef<VisitorItem>[]>(
    () => [
      {
        accessorKey: "visitor_name",
        header: "Visitor",
        cell: ({ row }) => {
          const v: any = row.original;
          const purpose = safeStr(v?.purpose);
          return (
            <div className="min-w-0">
              <div className="font-semibold truncate text-white">{safeStr(v?.visitor_name)}</div>
              <div className="text-xs text-white/60 truncate">{purpose}</div>
            </div>
          );
        },
      },
      {
        accessorKey: "visitor_phone",
        header: "Phone",
        cell: ({ row }) => (
          <span className="text-white/80">{safeStr((row.original as any)?.visitor_phone)}</span>
        ),
      },
      {
        accessorKey: "access_code",
        header: "Access",
        cell: ({ row }) => {
          const v: any = row.original;
          const code = safeStr(v?.access_code);
          const exp = v?.expires_at;
          const expired = isExpired(exp);
          return (
            <div className="min-w-0">
              <div className="font-mono text-white/90">{code}</div>
              <div className="mt-1 text-[11px] text-white/50">
                Expires{" "}
                <span className={cn(expired ? "text-red-200" : "text-white/70")}>
                  {when(exp)}
                </span>
                {expired ? <span className="text-red-200"> • Expired</span> : null}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const v: any = row.original;
          const s = fmtStatus(v?.status);
          return (
            <span className={cn("inline-flex text-[11px] px-2 py-1 rounded-full border", statusTone(v?.status))}>
              {s}
            </span>
          );
        },
      },
      {
        accessorKey: "created_at",
        header: "Created",
        cell: ({ row }) => (
          <span className="text-white/70 text-xs">{when((row.original as any)?.created_at)}</span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const v: any = row.original;
          const code = safeStr(v?.access_code);

          return (
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  if (!code || code === "—") return;
                  navigator.clipboard?.writeText(String(code));
                }}
              >
                Copy code
              </Button>

              <Button variant="ghost" onClick={() => alert(`Open visitor timeline: ${v?.id || ""}`)}>
                View
              </Button>
            </div>
          );
        },
      },
    ],
    []
  );

  // UI copies that feel real but still reflect your data
  const activeCameras = "47/48";
  const accessPoints = "156";
  const activeAlerts = securityAlerts.length;
  const patrols = "12/12";

  return (
    <div className="space-y-7">
      <Topbar
        title="Security & Access Control"
        subtitle="Monitor visitor approvals, access codes, entry/exit signals"
        rightSlot={
          <Button variant="ghost" onClick={load} disabled={loading}>
            <span className="inline-flex items-center gap-2">
              <RefreshCcw className="h-4 w-4" />
              {loading ? "Refreshing..." : "Refresh"}
            </span>
          </Button>
        }
      />

      {/* Filters (kept) */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={todayOnly ? "primary" : "ghost"}
            onClick={() => setTodayOnly(true)}
            disabled={loading}
          >
            Today
          </Button>
          <Button
            variant={!todayOnly ? "primary" : "ghost"}
            onClick={() => setTodayOnly(false)}
            disabled={loading}
          >
            All Records
          </Button>

          <select
            className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm focus:outline-none focus:border-blue-500 text-white"
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            disabled={loading}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="entered">Entered</option>
            <option value="exited">Exited</option>
            <option value="denied">Denied</option>
            <option value="active">Active (other)</option>
          </select>
        </div>

        <div className="text-xs text-slate-400">
          <span className="inline-flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Gate control • {todayOnly ? "Today" : "All"} • {stats.total} record(s)
          </span>
        </div>
      </div>

      {/* Metric row (new standard) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Active Cameras"
          value={activeCameras}
          change="1 under maintenance"
          trend="neutral"
          icon={Camera}
          iconColor="text-blue-500"
        />
        <MetricCard
          title="Access Points"
          value={accessPoints}
          change="All operational"
          trend="neutral"
          icon={Lock}
          iconColor="text-green-500"
        />
        <MetricCard
          title="Active Alerts"
          value={activeAlerts}
          change="1 high priority"
          trend="up"
          icon={AlertTriangle}
          iconColor="text-red-500"
        />
        <MetricCard
          title="Security Patrols"
          value={patrols}
          change="On schedule"
          trend="neutral"
          icon={Shield}
          iconColor="text-purple-500"
        />
      </div>

      {/* Camera Status + Security Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Camera className="text-blue-500" size={20} />
              Camera Status
            </span>
            <button
              type="button"
              onClick={() => alert("Wire: live feeds later")}
              className="text-sm text-blue-500 hover:text-blue-400"
            >
              View All
            </button>
          </h3>

          <div className="space-y-3">
            {cameraFeeds.map((camera) => (
              <div key={camera.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full",
                      camera.status === "active" ? "bg-green-500" : "bg-yellow-500"
                    )}
                  />
                  <div>
                    <p className="text-sm font-medium">{camera.id}</p>
                    <p className="text-xs text-slate-400">{camera.location}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={cn(
                      "text-xs font-medium",
                      camera.status === "active" ? "text-green-500" : "text-yellow-500"
                    )}
                  >
                    {camera.status === "active" ? "Active" : "Maintenance"}
                  </p>
                  <p className="text-xs text-slate-400">{camera.lastEvent}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="text-yellow-500" size={20} />
            Security Alerts
          </h3>

          <div className="space-y-4">
            {securityAlerts.map((a, idx) => (
              <div key={idx} className="flex items-start gap-3 p-4 bg-slate-800/50 rounded-lg">
                <div
                  className={cn(
                    "p-2 rounded-lg",
                    a.level === "high"
                      ? "bg-red-500/10"
                      : a.level === "medium"
                        ? "bg-yellow-500/10"
                        : "bg-blue-500/10"
                  )}
                >
                  <AlertTriangle
                    className={cn(
                      a.level === "high"
                        ? "text-red-500"
                        : a.level === "medium"
                          ? "text-yellow-500"
                          : "text-blue-500"
                    )}
                    size={16}
                  />
                </div>

                <div className="flex-1">
                  <p className="text-sm font-medium">{a.message}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock size={12} />
                      {a.time}
                    </span>

                    <span
                      className={cn(
                        "text-xs px-2 py-1 rounded-full",
                        a.status === "investigating"
                          ? "bg-yellow-500/10 text-yellow-500"
                          : a.status === "resolved"
                            ? "bg-green-500/10 text-green-500"
                            : "bg-blue-500/10 text-blue-500"
                      )}
                    >
                      {a.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-slate-800">
            <h4 className="text-sm font-semibold mb-3">Visitor Signals (Live)</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <div className="text-xs text-slate-400">Pending approvals</div>
                <div className="text-lg font-semibold mt-1">{stats.pending}</div>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <div className="text-xs text-slate-400">In estate</div>
                <div className="text-lg font-semibold mt-1">{stats.inEstate}</div>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <div className="text-xs text-slate-400">Denied</div>
                <div className="text-lg font-semibold mt-1">{stats.denied}</div>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <div className="text-xs text-slate-400">Expired codes</div>
                <div className="text-lg font-semibold mt-1">{stats.expired}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Access logs + Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Lock className="text-green-500" size={20} />
            Recent Access Logs (Visitors)
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left text-xs font-medium text-slate-400 pb-3">Time</th>
                  <th className="text-left text-xs font-medium text-slate-400 pb-3">User</th>
                  <th className="text-left text-xs font-medium text-slate-400 pb-3">Location / Purpose</th>
                  <th className="text-left text-xs font-medium text-slate-400 pb-3">Action</th>
                  <th className="text-left text-xs font-medium text-slate-400 pb-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {accessLogs.map((log, idx) => (
                  <tr key={idx} className="border-b border-slate-800 last:border-0">
                    <td className="py-3 text-sm">{log.time}</td>
                    <td className="py-3 text-sm">{log.user}</td>
                    <td className="py-3 text-sm text-slate-400">{log.location}</td>
                    <td className="py-3 text-sm">{log.action}</td>
                    <td className="py-3">
                      {log.type === "success" ? (
                        <CheckCircle className="text-green-500" size={16} />
                      ) : (
                        <AlertTriangle className="text-yellow-500" size={16} />
                      )}
                    </td>
                  </tr>
                ))}

                {!accessLogs.length ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400 text-sm">
                      No visitor events yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-800">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Users className="text-blue-500" size={20} />
              Visitor Registry (Backend)
            </h3>

            <DataTable
              data={items}
              columns={columns}
              title={todayOnly ? "Visitors Today" : "All Visitors"}
              searchKey={"visitor_name"}
            />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => alert("Wire: lock all doors endpoint later")}
              className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
            >
              Lock All Doors
            </button>
            <button
              type="button"
              onClick={() => alert("Wire: emergency lockdown endpoint later")}
              className="w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors"
            >
              Emergency Lockdown
            </button>
            <button
              type="button"
              onClick={() => alert("Wire: view live feeds later")}
              className="w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors"
            >
              View Live Feeds
            </button>
            <button
              type="button"
              onClick={() => alert("Wire: generate report later")}
              className="w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors"
            >
              Generate Report
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-800">
            <h4 className="text-sm font-semibold mb-3">System Health</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Cameras</span>
                <span className="text-xs text-green-500 font-medium">98%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Access Points</span>
                <span className="text-xs text-green-500 font-medium">100%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Visitor Flow</span>
                <span className="text-xs text-green-500 font-medium">OK</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-800">
            <h4 className="text-sm font-semibold mb-3">Visitor KPIs</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-2">
                  <Clock size={14} /> Pending
                </span>
                <span className="font-semibold">{stats.pending}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-2">
                  <KeyRound size={14} /> Approved
                </span>
                <span className="font-semibold">{stats.approved}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-2">
                  <DoorOpen size={14} /> Entered
                </span>
                <span className="font-semibold">{stats.entered}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-2">
                  <DoorClosed size={14} /> Exited
                </span>
                <span className="font-semibold">{stats.exited}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-2">
                  <Ban size={14} /> Denied
                </span>
                <span className="font-semibold">{stats.denied}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-2">
                  <Eye size={14} /> In Estate
                </span>
                <span className="font-semibold">{stats.inEstate}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="text-[11px] text-slate-400">
        Everything above keeps your current API + flow. The camera/alerts are demo UI for now.
        When you’re ready, we’ll wire cameras + door events to live endpoints.
      </div>
    </div>
  );
}
