"use client";

import Topbar from "@/components/shell/Topbar";
import { MetricCard } from "@/components/MetricCard";
import { Droplets, TrendingDown, AlertTriangle, Waves } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { deviceService, type FacilityDevice } from "@/services/deviceService";
import { maintenanceService, type MaintenanceItem } from "@/services/maintenanceService";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function safeLower(v: unknown) {
  return String(v ?? "").toLowerCase();
}

function isWaterDevice(d: FacilityDevice) {
  const hay = `${safeLower(d.name)} ${safeLower(d.type)} ${safeLower(d.room)}`;
  return (
    hay.includes("water") ||
    hay.includes("pump") ||
    hay.includes("tank") ||
    hay.includes("plumb") ||
    hay.includes("valve") ||
    hay.includes("meter")
  );
}

function statusBucket(s: string) {
  const x = safeLower(s);
  if (x === "active" || x === "online" || x === "ok") return "operational";
  if (x === "offline" || x === "down" || x === "error") return "faulty";
  return "unknown";
}

export default function WaterPage() {
  const [loading, setLoading] = useState(false);
  const [devices, setDevices] = useState<FacilityDevice[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceItem[]>([]);

  async function load() {
    setLoading(true);
    try {
      const [d, m] = await Promise.all([deviceService.list(), maintenanceService.list()]);
      setDevices(Array.isArray(d) ? d : []);
      setMaintenance(Array.isArray(m) ? m : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const waterDevices = useMemo(() => devices.filter(isWaterDevice), [devices]);

  const byType = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of waterDevices) {
      const t = String(d.type || "unknown").trim() || "unknown";
      m.set(t, (m.get(t) || 0) + 1);
    }
    return Array.from(m.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [waterDevices]);

  const qualityRows = useMemo(() => {
    const operational = waterDevices.filter((d) => statusBucket(d.status || "") === "operational").length;
    const faulty = waterDevices.filter((d) => statusBucket(d.status || "") === "faulty").length;
    const unknown = Math.max(0, waterDevices.length - operational - faulty);

    const openWaterMaintenance = maintenance.filter((x: any) => {
      const hay = `${safeLower(x?.title)} ${safeLower(x?.description)} ${safeLower(x?.category)}`;
      const s = safeLower(x?.status);
      const open = s === "open" || s === "in_progress" || s === "assigned";
      return open && (hay.includes("water") || hay.includes("pipe") || hay.includes("pump") || hay.includes("leak"));
    }).length;

    return [
      { parameter: "Operational Devices", value: String(operational), status: operational > 0 ? "healthy" : "idle", range: `of ${waterDevices.length}` },
      { parameter: "Faulty Devices", value: String(faulty), status: faulty > 0 ? "attention" : "healthy", range: "offline/error" },
      { parameter: "Unknown Status", value: String(unknown), status: unknown > 0 ? "review" : "healthy", range: "needs telemetry" },
      { parameter: "Open Water Tickets", value: String(openWaterMaintenance), status: openWaterMaintenance > 0 ? "attention" : "healthy", range: "maintenance queue" },
    ];
  }, [waterDevices, maintenance]);

  const trend = useMemo(() => {
    return byType.map((x, i) => ({
      time: `${String(i + 1).padStart(2, "0")}`,
      usage: x.count,
    }));
  }, [byType]);

  const waterSystems = useMemo(() => {
    const operational = waterDevices.filter((d) => statusBucket(d.status || "") === "operational").length;
    const faulty = waterDevices.filter((d) => statusBucket(d.status || "") === "faulty").length;
    const coverage = waterDevices.length ? Math.round((operational / waterDevices.length) * 100) : 0;

    return {
      coverage,
      operational,
      faulty,
      inventory: waterDevices.length,
    };
  }, [waterDevices]);

  return (
    <div className="space-y-7">
      <Topbar title="Water Management" subtitle="Live water infrastructure health and maintenance signals" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Water Devices" value={String(waterSystems.inventory)} change={loading ? "Refreshing" : "Detected infrastructure"} trend="neutral" icon={Droplets} iconColor="text-blue-500" />
        <MetricCard title="Operational" value={String(waterSystems.operational)} change={`${waterSystems.coverage}% readiness`} trend="neutral" icon={Waves} iconColor="text-emerald-500" />
        <MetricCard title="Faulty/Offline" value={String(waterSystems.faulty)} change={waterSystems.faulty ? "Needs maintenance" : "No outage"} trend={waterSystems.faulty ? "up" : "down"} icon={AlertTriangle} iconColor="text-amber-500" />
        <MetricCard title="Reliability" value={`${waterSystems.coverage}%`} change="Operational ratio" trend="down" icon={TrendingDown} iconColor="text-violet-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <h3 className="text-base font-semibold text-zinc-100 mb-4">Device Type Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="colorWater" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ backgroundColor: "#0b1220", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px" }} />
              <Area type="monotone" dataKey="usage" stroke="#06b6d4" strokeWidth={2} fill="url(#colorWater)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <h3 className="text-base font-semibold text-zinc-100 mb-4">Infrastructure Signals</h3>
          <div className="space-y-3">
            {qualityRows.map((metric) => (
              <div key={metric.parameter} className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-zinc-100">{metric.parameter}</span>
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20">{metric.status}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-xl font-semibold text-cyan-400">{metric.value}</span>
                  <span className="text-zinc-400">{metric.range}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
        <h3 className="text-base font-semibold text-zinc-100 mb-4">Water Device Inventory</h3>
        {!waterDevices.length ? (
          <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
            No water-related devices discovered yet.
          </div>
        ) : (
          <div className="space-y-3">
            {waterDevices.map((d) => {
              const s = statusBucket(d.status || "");
              const tone = s === "operational" ? "text-emerald-300" : s === "faulty" ? "text-red-300" : "text-zinc-300";
              return (
                <div key={d.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-zinc-100">{d.name || "Unnamed device"}</p>
                      <p className="text-xs text-zinc-400 mt-1">{d.type || "unknown"} • {d.room || "Unassigned zone"}</p>
                    </div>
                    <span className={`text-sm font-semibold ${tone}`}>{s}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
