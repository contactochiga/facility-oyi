"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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

// ✅ Cameras (REAL)
import { cameraService, type BoundCamera } from "@/services/cameraService";
import CameraPlayer from "@/components/cameras/CameraPlayer";

// ✅ Estate id (lightweight) - same logic as your Overview hydration
import { facilityService } from "@/services/facilityService";

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

  if (s === "approved")
    return "text-emerald-200 bg-emerald-500/10 border-emerald-500/20";
  if (s === "entered")
    return "text-blue-200 bg-blue-500/10 border-blue-500/20";
  if (s === "exited")
    return "text-zinc-200 bg-white/5 border-white/10";
  if (s === "denied")
    return "text-red-200 bg-red-500/10 border-red-500/20";

  return "text-amber-200 bg-amber-500/10 border-amber-500/20";
}

function extractErr(e: any) {
  const status = e?.response?.status;
  const msg = e?.response?.data?.error || e?.message || "Request failed";
  return { status, msg: String(msg) };
}

// -------------------------------
// MetricCard (local)
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

export default function VisitorsPage() {
  const [items, setItems] = useState<VisitorItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // view filters (kept)
  const [todayOnly, setTodayOnly] = useState(true);
  const [status, setStatus] = useState<
    "all" | "active" | "pending" | "approved" | "entered" | "exited" | "denied"
  >("all");

  // ✅ Estate + Cameras (REAL)
  const [estateId, setEstateId] = useState<string | null>(null);
  const [cameras, setCameras] = useState<BoundCamera[]>([]);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraErr, setCameraErr] = useState<string | null>(null);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);

  const liveSectionRef = useRef<HTMLDivElement | null>(null);

  async function hydrateEstateFromMembership() {
    try {
      const res = await facilityService.myEstates();
      const first = res?.estates?.[0];
      if (first?.id) {
        setEstateId(first.id);
        return first.id as string;
      }
      setEstateId(null);
      return null;
    } catch (e: any) {
      setEstateId(null);
      return null;
    }
  }

  async function loadCameras(eid?: string | null) {
    const estate = eid || estateId;
    if (!estate) return;

    setCameraLoading(true);
    setCameraErr(null);

    try {
      const res = await cameraService.listByEstate(estate);
      const list: BoundCamera[] = Array.isArray(res?.items) ? res.items : [];

      setCameras(list);

      if (!activeCameraId && list[0]?.id) setActiveCameraId(list[0].id);

      if (activeCameraId && !list.some((c) => c.id === activeCameraId)) {
        setActiveCameraId(list[0]?.id || null);
      }
    } catch (e: any) {
      const { status, msg } = extractErr(e);
      setCameraErr(`${msg}${status ? ` (HTTP ${status})` : ""}`);
      setCameras([]);
      setActiveCameraId(null);
    } finally {
      setCameraLoading(false);
    }
  }

  async function loadVisitors() {
    setLoading(true);
    try {
      const res = todayOnly ? await visitorService.listToday() : await visitorService.list();
      const list = (res || []) as VisitorItem[];

      const filtered =
        status === "all"
          ? list
          : list.filter((x) => String((x as any)?.status || "").toLowerCase() === status);

      setItems(filtered);
    } finally {
      setLoading(false);
    }
  }

  async function loadAll() {
    await loadVisitors();

    // cameras depend on estate id
    let eid = estateId;
    if (!eid) eid = await hydrateEstateFromMembership();
    if (eid) await loadCameras(eid);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayOnly, status]);

  // -------------------------------
  // Stats (kept)
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
  // Access Logs (kept)
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
        location: safeStr(v?.purpose),
        action,
        type,
      };
    });
  }, [items]);

  const securityAlerts = useMemo(() => {
    const recent = [...(items as any[])]
      .sort((a, b) => new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime())
      .slice(0, 3);

    return recent.map((v) => {
      const statusValue = String(v?.status || "pending").toLowerCase();
      const level = statusValue === "denied" ? "high" : statusValue === "pending" ? "medium" : "low";
      const message =
        statusValue === "denied"
          ? `Denied entry attempt: ${safeStr(v?.visitor_name)}`
          : statusValue === "pending"
            ? `Pending approval: ${safeStr(v?.visitor_name)}`
            : `Visitor activity: ${safeStr(v?.visitor_name)}`;

      return {
        time: timeOnly(v?.created_at),
        level,
        message,
        status: statusValue,
      };
    });
  }, [items]);

  // -------------------------------
  // Table columns (kept)
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

              <Button
                variant="ghost"
                onClick={async () => {
                  const id = String(v?.id || "").trim();
                  if (!id) return;
                  const res = await visitorService.timeline(id);
                  if ((res as any)?.error) {
                    setNotice(String((res as any).error));
                    return;
                  }
                  const timeline = Array.isArray((res as any)?.timeline) ? (res as any).timeline : [];
                  if (!timeline.length) {
                    setNotice(`No timeline events yet for ${safeStr(v?.visitor_name)}.`);
                    return;
                  }
                  const summary = timeline
                    .slice(0, 6)
                    .map((e: any) => `${fmtStatus(e?.type)} @ ${when(e?.at)}`)
                    .join(" • ");
                  setNotice(`${safeStr(v?.visitor_name)} timeline: ${summary}`);
                }}
              >
                View
              </Button>
            </div>
          );
        },
      },
    ],
    []
  );

  // Derived UI values (now REAL)
  const activeCameras = cameraLoading ? "…" : `${cameras.length}`;
  const accessPoints = cameraLoading ? "…" : `${cameras.length}`;
  const activeAlerts = securityAlerts.length;
  const patrols = `${Math.min(12, Math.max(cameras.length, 0))}/12`;

  const activeCam = cameras.find((c) => c.id === activeCameraId) || null;
  const activeCamId = activeCam ? activeCam.id : null;

  const tileCams = useMemo(() => {
    const rest = cameras.filter((c) => c.id !== activeCameraId);
    return rest.slice(0, 3);
  }, [cameras, activeCameraId]);

  return (
    <div className="space-y-7">
      <Topbar
        title="Security & Access Control"
        subtitle="Monitor visitor approvals, access codes, entry/exit signals"
        rightSlot={
          <Button variant="ghost" onClick={loadAll} disabled={loading || cameraLoading}>
            <span className="inline-flex items-center gap-2">
              <RefreshCcw className="h-4 w-4" />
              {loading || cameraLoading ? "Refreshing..." : "Refresh"}
            </span>
          </Button>
        }
      />

      {notice ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {notice}
        </div>
      ) : null}

      {/* Filters */}
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

      {/* Metric row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Active Cameras"
          value={activeCameras}
          change={estateId ? "Bound to this site" : "No site linked"}
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

      {/* ✅ LIVE CAMERAS (MOVED FROM OVERVIEW) */}
      <div ref={liveSectionRef} className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-lg font-semibold flex items-center gap-2">
              <Camera className="text-blue-500" size={20} />
              Live Cameras
            </div>
            <div className="text-xs text-slate-400 mt-1">
              HLS stream • facility view • estate security
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={async () => {
                let eid = estateId;
                if (!eid) eid = await hydrateEstateFromMembership();
                if (eid) await loadCameras(eid);
              }}
              disabled={!estateId || cameraLoading}
            >
              {cameraLoading ? "Loading…" : "Refresh Cameras"}
            </Button>
          </div>
        </div>

        {cameraErr && (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {cameraErr}
          </div>
        )}

        {!estateId ? (
          <div className="mt-4 text-sm text-slate-400">
            No site linked yet. Create/select a site to load cameras.
          </div>
        ) : cameras.length === 0 && !cameraLoading ? (
          <div className="mt-4 text-sm text-slate-400">
            No cameras bound yet. Bind cameras to this site first.
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* HERO */}
            <div className="lg:col-span-2">
              {activeCamId ? (
                <CameraPlayer
                  cameraId={activeCamId}
                  variant="hero"
                  controls={true}
                  muted={true}
                  autoPlay={true}
                />
              ) : (
                <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-sm text-slate-400">
                  Select a camera to preview.
                </div>
              )}

              {activeCam && (
                <div className="mt-3 text-xs text-slate-400">
                  Playing:{" "}
                  <span className="text-white/90">
                    {activeCam.name || activeCam.ip}
                  </span>
                </div>
              )}
            </div>

            {/* TILES */}
            <div className="space-y-3">
              <div className="text-xs text-slate-400">Live feeds</div>

              <div className="space-y-3">
                {cameras.length <= 1 ? (
                  <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-slate-400">
                    Add more cameras to unlock multi-view tiles.
                  </div>
                ) : (
                  <>
                    {tileCams.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setActiveCameraId(c.id)}
                        className={[
                          "w-full text-left rounded-xl border border-white/10 bg-black/20 hover:bg-black/30 transition overflow-hidden",
                          "focus:outline-none focus:ring-2 focus:ring-white/10",
                        ].join(" ")}
                      >
                        <div className="relative">
                          <CameraPlayer
                            cameraId={c.id}
                            variant="tile"
                            controls={false}
                            muted={true}
                            autoPlay={true}
                          />
                          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2">
                            <div className="truncate text-[12px] font-medium text-white/90 bg-black/40 border border-white/10 rounded-lg px-2 py-1">
                              {c.name || c.ip}
                            </div>
                            <div className="text-[11px] text-white/70 bg-black/40 border border-white/10 rounded-lg px-2 py-1">
                              Tap
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Camera Status + Security Alerts (kept) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Camera className="text-blue-500" size={20} />
              Camera Activity
            </span>
            <button
              type="button"
              onClick={() => {
                liveSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="text-sm text-blue-500 hover:text-blue-400"
            >
              View Live Feeds
            </button>
          </h3>

          <div className="space-y-3">
            {(cameras.length ? cameras.slice(0, 6) : []).map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.name || c.ip}</p>
                    <p className="text-xs text-slate-400 truncate">{c.ip}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-green-500">Active</p>
                  <p className="text-xs text-slate-400">Live</p>
                </div>
              </div>
            ))}

            {!cameras.length ? (
              <div className="text-sm text-slate-400">
                No cameras loaded yet. Link a site and bind cameras.
              </div>
            ) : null}
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
            {!securityAlerts.length ? (
              <div className="text-sm text-slate-400">No alerts in the current visitor window.</div>
            ) : null}
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
              onClick={async () => {
                const res = await visitorService.lockdown("partial");
                if ((res as any)?.error) {
                  setNotice(String((res as any).error));
                  return;
                }
                setNotice(`Lockdown activated (${String((res as any)?.mode || "partial")}). Ops notified: ${Number((res as any)?.recipients || 0)}.`);
              }}
              className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
            >
              Lock All Doors
            </button>
            <button
              type="button"
              onClick={async () => {
                const res = await visitorService.lockdown("emergency");
                if ((res as any)?.error) {
                  setNotice(String((res as any).error));
                  return;
                }
                setNotice(`Emergency lockdown activated. Ops notified: ${Number((res as any)?.recipients || 0)}.`);
              }}
              className="w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors"
            >
              Emergency Lockdown
            </button>
            <button
              type="button"
              onClick={() => {
                liveSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors"
            >
              View Live Feeds
            </button>
            <button
              type="button"
              onClick={async () => {
                const res = await visitorService.exportReport({ today: todayOnly, format: "csv" });
                if ((res as any)?.error) {
                  setNotice(String((res as any).error));
                  return;
                }
                setNotice("Visitor report export started.");
              }}
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
                <span className="text-xs text-green-500 font-medium">OK</span>
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
        Live Cameras is now wired here (Security). Overview stays lightweight ops summary.
      </div>
    </div>
  );
}
