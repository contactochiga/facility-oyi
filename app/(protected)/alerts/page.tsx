// app/(protected)/alerts/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  Clock,
  Filter,
} from "lucide-react";
import { notificationService, type AlertItem } from "@/services/notificationService";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type Severity = "critical" | "high" | "medium" | "low";
type Status = "active" | "investigating" | "acknowledged" | "resolved";

type UiAlert = {
  id: string;
  severity: Severity;
  category: string;
  title: string;
  description: string;
  location: string;
  time: string;
  status: Status;

  // keep original for future wiring
  raw: AlertItem;
};

function safeStr(v: any, fallback = "—") {
  const s = String(v ?? "").trim();
  return s ? s : fallback;
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

// A lightweight "time ago" (no deps)
function timeAgo(iso?: string | null) {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = Date.now() - t;

  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;

  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;

  const day = Math.floor(hr / 24);
  return `${day} day${day === 1 ? "" : "s"} ago`;
}

function pickCategory(title: string, msg: string) {
  const hay = `${title} ${msg}`.toLowerCase();

  if (hay.includes("security") || hay.includes("access") || hay.includes("unauthorized") || hay.includes("intrusion"))
    return "Security";
  if (hay.includes("visitor") || hay.includes("gate") || hay.includes("door") || hay.includes("lock"))
    return "Security";
  if (hay.includes("maintenance") || hay.includes("elevator") || hay.includes("fault") || hay.includes("broken"))
    return "Maintenance";
  if (hay.includes("power") || hay.includes("energy") || hay.includes("generator") || hay.includes("inverter") || hay.includes("meter"))
    return "Energy";
  if (hay.includes("water") || hay.includes("pump") || hay.includes("tank") || hay.includes("pressure"))
    return "Water";
  if (hay.includes("traffic") || hay.includes("parking") || hay.includes("vehicle"))
    return "Traffic";
  if (hay.includes("air") || hay.includes("aqi") || hay.includes("environment") || hay.includes("humidity") || hay.includes("temperature"))
    return "Environment";
  if (hay.includes("fire") || hay.includes("alarm") || hay.includes("smoke"))
    return "Fire Safety";

  return "System";
}

function pickSeverity(title: string, msg: string, raw: any): Severity {
  const hay = `${title} ${msg}`.toLowerCase();
  const t = String(raw?.type || raw?.severity || raw?.level || "").toLowerCase();

  // if backend already provides something useful
  if (t === "critical" || t === "high" || t === "medium" || t === "low") return t as Severity;

  if (hay.includes("critical") || hay.includes("fire") || hay.includes("intrusion") || hay.includes("unauthorized"))
    return "critical";
  if (hay.includes("failed") || hay.includes("malfunction") || hay.includes("offline") || hay.includes("pressure drop"))
    return "high";
  if (hay.includes("warning") || hay.includes("anomaly") || hay.includes("exceed") || hay.includes("degraded"))
    return "medium";

  return "low";
}

function defaultLocation(category: string, title: string, msg: string) {
  const hay = `${title} ${msg}`.toLowerCase();
  if (hay.includes("gate")) return "Gate";
  if (hay.includes("building a")) return "Building A";
  if (hay.includes("building b")) return "Building B";
  if (hay.includes("building c")) return "Building C";
  if (hay.includes("building d")) return "Building D";
  if (hay.includes("parking")) return "Parking";
  if (category === "System") return "Facility Network";
  return "Estate";
}

function getSeverityIcon(severity: Severity) {
  switch (severity) {
    case "critical":
      return <AlertCircle className="text-red-500" size={20} />;
    case "high":
      return <AlertTriangle className="text-orange-500" size={20} />;
    case "medium":
      return <AlertTriangle className="text-yellow-500" size={20} />;
    default:
      return <Info className="text-blue-500" size={20} />;
  }
}

function getSeverityCardTone(severity: Severity) {
  switch (severity) {
    case "critical":
      return "bg-red-500/10 border-red-500/20";
    case "high":
      return "bg-orange-500/10 border-orange-500/20";
    case "medium":
      return "bg-yellow-500/10 border-yellow-500/20";
    default:
      return "bg-blue-500/10 border-blue-500/20";
  }
}

function getSeverityRowTone(severity: Severity) {
  switch (severity) {
    case "critical":
      return "bg-red-500/10 text-red-200 border-red-500/20";
    case "high":
      return "bg-orange-500/10 text-orange-200 border-orange-500/20";
    case "medium":
      return "bg-yellow-500/10 text-yellow-200 border-yellow-500/20";
    default:
      return "bg-blue-500/10 text-blue-200 border-blue-500/20";
  }
}

function getStatusTone(status: Status) {
  switch (status) {
    case "active":
      return "bg-red-500/10 text-red-200";
    case "investigating":
      return "bg-yellow-500/10 text-yellow-200";
    case "acknowledged":
      return "bg-blue-500/10 text-blue-200";
    default:
      return "bg-green-500/10 text-green-200";
  }
}

export default function AlertsPage() {
  const [items, setItems] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(false);

  // UI “workflow” state (does not touch backend yet)
  const [statusById, setStatusById] = useState<Record<string, Status>>({});

  const [filterSeverity, setFilterSeverity] = useState<"all" | Severity>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | Status>("all");

  async function load() {
    setLoading(true);
    try {
      const res = await notificationService.unread();
      setItems(res || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const uiAlerts: UiAlert[] = useMemo(() => {
    return (items || []).map((a: any, idx) => {
      const id = String(a?.id ?? a?._id ?? a?.uuid ?? idx);
      const title = safeStr(a?.title ?? a?.subject ?? a?.name, "System alert");
      const description = safeStr(a?.message ?? a?.body ?? a?.description, "—");
      const category = safeStr(a?.category, pickCategory(title, description));
      const severity = pickSeverity(title, description, a);

      // If backend already provides status use it; else default unread to active
      const backendStatus = String(a?.status || "").toLowerCase() as Status;
      const status: Status =
        statusById[id] ||
        (backendStatus === "active" ||
        backendStatus === "investigating" ||
        backendStatus === "acknowledged" ||
        backendStatus === "resolved"
          ? backendStatus
          : "active");

      const created = a?.created_at ?? a?.createdAt ?? a?.time ?? null;

      const location = safeStr(
        a?.location ?? a?.zone ?? a?.source,
        defaultLocation(category, title, description)
      );

      return {
        id,
        severity,
        category,
        title,
        description,
        location,
        time: safeStr(a?.time, timeAgo(created)),
        status,
        raw: a,
      };
    });
  }, [items, statusById]);

  const filteredAlerts = useMemo(() => {
    return uiAlerts.filter((a) => {
      if (filterSeverity !== "all" && a.severity !== filterSeverity) return false;
      if (filterStatus !== "all" && a.status !== filterStatus) return false;
      return true;
    });
  }, [uiAlerts, filterSeverity, filterStatus]);

  const alertCounts = useMemo(() => {
    return {
      critical: uiAlerts.filter((a) => a.severity === "critical").length,
      high: uiAlerts.filter((a) => a.severity === "high").length,
      medium: uiAlerts.filter((a) => a.severity === "medium").length,
      low: uiAlerts.filter((a) => a.severity === "low").length,
    };
  }, [uiAlerts]);

  function setStatus(id: string, next: Status) {
    setStatusById((p) => ({ ...p, [id]: next }));
  }

  return (
    <div className="space-y-7">
      <Topbar
        title="Alerts"
        subtitle="System alerts • security signals • operator notifications"
      />

      {/* Counters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={cn("rounded-2xl border p-5", getSeverityCardTone("critical"))}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-red-200/80">Critical</span>
            <AlertCircle className="text-red-500" size={20} />
          </div>
          <div className="text-3xl font-semibold text-red-200">
            {alertCounts.critical}
          </div>
        </div>

        <div className={cn("rounded-2xl border p-5", getSeverityCardTone("high"))}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-orange-200/80">High</span>
            <AlertTriangle className="text-orange-500" size={20} />
          </div>
          <div className="text-3xl font-semibold text-orange-200">
            {alertCounts.high}
          </div>
        </div>

        <div className={cn("rounded-2xl border p-5", getSeverityCardTone("medium"))}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-yellow-200/80">Medium</span>
            <AlertTriangle className="text-yellow-500" size={20} />
          </div>
          <div className="text-3xl font-semibold text-yellow-200">
            {alertCounts.medium}
          </div>
        </div>

        <div className={cn("rounded-2xl border p-5", getSeverityCardTone("low"))}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-blue-200/80">Low</span>
            <Info className="text-blue-500" size={20} />
          </div>
          <div className="text-3xl font-semibold text-blue-200">
            {alertCounts.low}
          </div>
        </div>
      </div>

      {/* List + filters */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-white">
            <Filter size={18} className="text-white/70" />
            Active Alerts
          </h3>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value as any)}
              className="px-3 py-2 bg-zinc-900/60 border border-white/10 rounded-xl text-sm outline-none focus:border-blue-500"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-3 py-2 bg-zinc-900/60 border border-white/10 rounded-xl text-sm outline-none focus:border-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="investigating">Investigating</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="resolved">Resolved</option>
            </select>

            <Button variant="ghost" onClick={load} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>

        {filteredAlerts.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="mx-auto mb-3 text-emerald-400" size={44} />
            <p className="text-lg font-medium text-white mb-1">No Alerts Found</p>
            <p className="text-sm text-white/60">
              All systems operating normally.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  "p-5 rounded-2xl border",
                  getSeverityRowTone(alert.severity)
                )}
              >
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-xl bg-black/20 border border-white/10">
                    {getSeverityIcon(alert.severity)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h4 className="font-semibold text-white truncate">
                            {alert.title}
                          </h4>
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-black/20 border border-white/10 text-white/70">
                            {alert.category}
                          </span>
                        </div>

                        <p className="text-sm text-white/80">
                          {alert.description}
                        </p>
                      </div>

                      <span
                        className={cn(
                          "shrink-0 px-3 py-1 rounded-full text-xs font-medium",
                          getStatusTone(alert.status)
                        )}
                      >
                        {alert.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-white/60 mt-3 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {alert.time}
                        {alert.raw?.created_at ? (
                          <span className="text-white/40">
                            {" "}
                            • {when(alert.raw.created_at as any)}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-white/30">•</span>
                      <span className="truncate">{alert.location}</span>
                    </div>

                    {/* Actions (UI-only until backend routes exist) */}
                    <div className="flex gap-2 mt-4 flex-wrap">
                      {alert.status === "active" ? (
                        <>
                          <button
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-xl text-xs font-medium transition-colors text-white"
                            onClick={() => setStatus(alert.id, "acknowledged")}
                            type="button"
                          >
                            Acknowledge
                          </button>
                          <button
                            className="px-4 py-2 bg-zinc-900/60 hover:bg-zinc-800 rounded-xl text-xs font-medium transition-colors text-white/90 border border-white/10"
                            onClick={() => setStatus(alert.id, "investigating")}
                            type="button"
                          >
                            Assign Team
                          </button>
                        </>
                      ) : null}

                      {alert.status === "investigating" ? (
                        <>
                          <button
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-xs font-medium transition-colors text-white"
                            onClick={() => setStatus(alert.id, "resolved")}
                            type="button"
                          >
                            Mark Resolved
                          </button>
                          <button
                            className="px-4 py-2 bg-zinc-900/60 hover:bg-zinc-800 rounded-xl text-xs font-medium transition-colors text-white/90 border border-white/10"
                            onClick={() => setStatus(alert.id, "acknowledged")}
                            type="button"
                          >
                            Update Status
                          </button>
                        </>
                      ) : null}

                      {alert.status === "acknowledged" ? (
                        <button
                          className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-xl text-xs font-medium transition-colors text-white"
                          onClick={() => setStatus(alert.id, "investigating")}
                          type="button"
                        >
                          Begin Investigation
                        </button>
                      ) : null}

                      <button
                        className="px-4 py-2 bg-zinc-900/60 hover:bg-zinc-800 rounded-xl text-xs font-medium transition-colors text-white/90 border border-white/10"
                        onClick={() =>
                          window.alert(
                            `Alert details\n\n${alert.title}\n\n${alert.description}\n\nCategory: ${alert.category}\nLocation: ${alert.location}`
                          )
                        }
                        type="button"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
