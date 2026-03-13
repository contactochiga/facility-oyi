"use client";

import Topbar from "@/components/shell/Topbar";
import { MetricCard } from "@/components/MetricCard";
import { Users, TrendingUp, Building, Clock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { visitorService, type VisitorItem } from "@/services/visitorService";
import { facilityService } from "@/services/facilityService";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function safeLower(v: unknown) {
  return String(v ?? "").toLowerCase();
}

function hourLabel(iso?: string) {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return "00:00";
  return `${String(d.getHours()).padStart(2, "0")}:00`;
}

function isActiveStatus(status: string) {
  const s = safeLower(status);
  return s === "active" || s === "approved" || s === "entered";
}

export default function OccupancyPage() {
  const [loading, setLoading] = useState(false);
  const [visitors, setVisitors] = useState<VisitorItem[]>([]);
  const [homes, setHomes] = useState<any[]>([]);

  async function load() {
    setLoading(true);
    try {
      const todayVisitors = await visitorService.listToday();
      setVisitors(Array.isArray(todayVisitors) ? todayVisitors : []);

      const estates = await facilityService.myEstates();
      const firstEstateId = estates?.estates?.[0]?.id;
      if (firstEstateId) {
        const h = await facilityService.listHomes(firstEstateId);
        setHomes(Array.isArray(h?.homes) ? h.homes : []);
      } else {
        setHomes([]);
      }
    } catch {
      setHomes([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const occupancyTrend = useMemo(() => {
    const now = new Date();
    const labels: string[] = [];
    for (let i = 7; i >= 0; i -= 1) {
      const d = new Date(now.getTime() - i * 60 * 60 * 1000);
      labels.push(`${String(d.getHours()).padStart(2, "0")}:00`);
    }

    const inFlow = new Map<string, number>();
    for (const l of labels) inFlow.set(l, 0);

    for (const v of visitors) {
      if (!isActiveStatus(String(v.status || ""))) continue;
      const k = hourLabel(v.created_at);
      if (inFlow.has(k)) inFlow.set(k, (inFlow.get(k) || 0) + 1);
    }

    let running = 0;
    return labels.map((time) => {
      running += inFlow.get(time) || 0;
      return { time, occupancy: running };
    });
  }, [visitors]);

  const buildingOccupancy = useMemo(() => {
    const byHome = new Map<string, { building: string; current: number; capacity: number; percentage: number }>();

    for (const h of homes) {
      const id = String(h?.id || "");
      if (!id) continue;
      byHome.set(id, {
        building: String(h?.name || h?.unit || "Home"),
        current: 0,
        capacity: 10,
        percentage: 0,
      });
    }

    for (const v of visitors) {
      if (!isActiveStatus(String(v.status || ""))) continue;
      const hid = String(v.home_id || "");
      if (!hid || !byHome.has(hid)) continue;
      const row = byHome.get(hid)!;
      row.current += 1;
      byHome.set(hid, row);
    }

    const rows = Array.from(byHome.values()).map((r) => ({
      ...r,
      percentage: Math.min(100, Math.round((r.current / Math.max(1, r.capacity)) * 100)),
    }));

    return rows.sort((a, b) => b.current - a.current).slice(0, 8);
  }, [homes, visitors]);

  const totalOccupancy = occupancyTrend.length ? occupancyTrend[occupancyTrend.length - 1].occupancy : 0;
  const activeBuildings = buildingOccupancy.filter((x) => x.current > 0).length;
  const totalCapacity = buildingOccupancy.reduce((sum, x) => sum + x.capacity, 0);
  const overallCapacity = totalCapacity ? Math.round((totalOccupancy / totalCapacity) * 100) : 0;
  const peak = occupancyTrend.reduce((a, b) => (b.occupancy > a.occupancy ? b : a), { time: "--:--", occupancy: 0 });

  return (
    <div className="space-y-7">
      <Topbar title="Occupancy" subtitle="Live occupancy from visitor access and home assignments" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total Occupancy" value={String(totalOccupancy)} change={loading ? "Refreshing" : "Active visitor presence"} trend="up" icon={Users} iconColor="text-blue-500" />
        <MetricCard title="Overall Capacity" value={`${Math.max(0, overallCapacity)}%`} change="Derived from tracked homes" trend="neutral" icon={TrendingUp} iconColor="text-emerald-500" />
        <MetricCard title="Active Homes" value={`${activeBuildings}/${buildingOccupancy.length || 0}`} change="Homes with active occupancy" trend="neutral" icon={Building} iconColor="text-violet-500" />
        <MetricCard title="Peak Time" value={peak.time} change={`${peak.occupancy} peak occupancy`} trend="neutral" icon={Clock} iconColor="text-orange-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <h3 className="text-base font-semibold text-zinc-100 mb-4">Occupancy Trend (Last 8 Hours)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={occupancyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ backgroundColor: "#0b1220", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px" }} />
              <Line type="monotone" dataKey="occupancy" stroke="#8b5cf6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <h3 className="text-base font-semibold text-zinc-100 mb-4">Home Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={buildingOccupancy}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="building" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ backgroundColor: "#0b1220", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px" }} />
              <Bar dataKey="current" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
        <h3 className="text-base font-semibold text-zinc-100 mb-4">Home Occupancy Status</h3>
        {!buildingOccupancy.length ? (
          <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">No homes available for occupancy analytics yet.</div>
        ) : (
          <div className="space-y-3">
            {buildingOccupancy.map((b) => {
              const bar = b.percentage > 90 ? "bg-red-500" : b.percentage > 75 ? "bg-amber-500" : "bg-emerald-500";
              const label = b.percentage > 90 ? "Near Capacity" : b.percentage > 75 ? "High" : "Normal";
              const labelTone = b.percentage > 90 ? "text-red-300" : b.percentage > 75 ? "text-amber-300" : "text-emerald-300";
              return (
                <div key={b.building} className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-zinc-100">{b.building}</span>
                    <span className="text-sm"><span className="font-semibold text-zinc-100">{b.current}</span><span className="text-zinc-400"> / {b.capacity}</span></span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2 mb-2">
                    <div className={`${bar} h-2 rounded-full transition-all`} style={{ width: `${b.percentage}%` }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">{b.percentage}% capacity</span>
                    <span className={`text-xs font-medium ${labelTone}`}>{label}</span>
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
