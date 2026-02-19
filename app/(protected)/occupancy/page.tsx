"use client";

import Topbar from "@/components/shell/Topbar";
import { MetricCard } from "@/components/MetricCard";
import { Users, TrendingUp, Building, Clock } from "lucide-react";
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

const occupancyTrend = [
  { time: "06:00", occupancy: 145 },
  { time: "08:00", occupancy: 1240 },
  { time: "10:00", occupancy: 2380 },
  { time: "12:00", occupancy: 2650 },
  { time: "14:00", occupancy: 2420 },
  { time: "16:00", occupancy: 2580 },
  { time: "18:00", occupancy: 1890 },
  { time: "20:00", occupancy: 680 },
];

const buildingOccupancy = [
  { building: "Building A", current: 548, capacity: 700, percentage: 78 },
  { building: "Building B", current: 644, capacity: 700, percentage: 92 },
  { building: "Building C", current: 455, capacity: 700, percentage: 65 },
  { building: "Building D", current: 616, capacity: 700, percentage: 88 },
  { building: "Building E", current: 584, capacity: 820, percentage: 71 },
];

const floorOccupancy = [
  { floor: "Floor 1", occupancy: 145, capacity: 150 },
  { floor: "Floor 2", occupancy: 132, capacity: 150 },
  { floor: "Floor 3", occupancy: 98, capacity: 150 },
  { floor: "Floor 4", occupancy: 118, capacity: 150 },
  { floor: "Floor 5", occupancy: 55, capacity: 100 },
];

export default function OccupancyPage() {
  return (
    <div className="space-y-7">
      <Topbar
        title="Occupancy"
        subtitle="Real-time occupancy • capacity • distribution"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Occupancy"
          value="2,847"
          change="+124 vs last hour"
          trend="up"
          icon={Users}
          iconColor="text-blue-500"
        />
        <MetricCard
          title="Overall Capacity"
          value="79%"
          change="Within normal range"
          trend="neutral"
          icon={TrendingUp}
          iconColor="text-emerald-500"
        />
        <MetricCard
          title="Active Buildings"
          value="5/5"
          change="All operational"
          trend="neutral"
          icon={Building}
          iconColor="text-violet-500"
        />
        <MetricCard
          title="Peak Time"
          value="12:00 PM"
          change="2,650 people"
          trend="neutral"
          icon={Clock}
          iconColor="text-orange-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <h3 className="text-base font-semibold text-zinc-100 mb-4">
            Occupancy Trend (Today)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={occupancyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0b1220",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "12px",
                }}
              />
              <Line type="monotone" dataKey="occupancy" stroke="#8b5cf6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <h3 className="text-base font-semibold text-zinc-100 mb-4">
            Building Distribution
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={buildingOccupancy}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="building" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0b1220",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "12px",
                }}
              />
              <Bar dataKey="current" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <h3 className="text-base font-semibold text-zinc-100 mb-4">
            Building Occupancy Status
          </h3>

          <div className="space-y-3">
            {buildingOccupancy.map((b) => {
              const bar =
                b.percentage > 90
                  ? "bg-red-500"
                  : b.percentage > 75
                    ? "bg-amber-500"
                    : "bg-emerald-500";

              const label =
                b.percentage > 90 ? "Near Capacity" : b.percentage > 75 ? "High" : "Normal";

              const labelTone =
                b.percentage > 90
                  ? "text-red-300"
                  : b.percentage > 75
                    ? "text-amber-300"
                    : "text-emerald-300";

              return (
                <div key={b.building} className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-zinc-100">{b.building}</span>
                    <span className="text-sm">
                      <span className="font-semibold text-zinc-100">{b.current}</span>
                      <span className="text-zinc-400"> / {b.capacity}</span>
                    </span>
                  </div>

                  <div className="w-full bg-white/10 rounded-full h-2 mb-2">
                    <div className={cn("h-2 rounded-full transition-all", bar)} style={{ width: `${b.percentage}%` }} />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">{b.percentage}% capacity</span>
                    <span className={cn("text-xs font-medium", labelTone)}>{label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <h3 className="text-base font-semibold text-zinc-100 mb-4">
            Building A — Floor Breakdown
          </h3>

          <div className="space-y-4 mb-6">
            {floorOccupancy.map((f) => {
              const percentage = (f.occupancy / f.capacity) * 100;
              const bar =
                percentage > 90
                  ? "bg-red-500"
                  : percentage > 75
                    ? "bg-amber-500"
                    : "bg-blue-500";

              return (
                <div key={f.floor} className="flex items-center gap-4">
                  <span className="text-sm font-medium w-20 text-zinc-100">{f.floor}</span>
                  <div className="flex-1">
                    <div className="w-full bg-white/10 rounded-full h-2">
                      <div className={cn("h-2 rounded-full", bar)} style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                  <span className="text-sm text-zinc-400 w-24 text-right">
                    {f.occupancy}/{f.capacity}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="pt-6 border-t border-white/10">
            <h4 className="text-sm font-semibold text-zinc-100 mb-3">Density Heat Map</h4>

            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 25 }, (_, i) => {
                const density = Math.random();
                const tile =
                  density > 0.8
                    ? "bg-red-500/40"
                    : density > 0.6
                      ? "bg-amber-500/40"
                      : density > 0.4
                        ? "bg-emerald-500/40"
                        : "bg-blue-500/20";

                return <div key={i} className={cn("aspect-square rounded", tile)} />;
              })}
            </div>

            <div className="flex items-center justify-between mt-4 text-xs">
              {[
                { label: "Low", c: "bg-blue-500/20" },
                { label: "Medium", c: "bg-emerald-500/40" },
                { label: "High", c: "bg-amber-500/40" },
                { label: "Critical", c: "bg-red-500/40" },
              ].map((x) => (
                <div key={x.label} className="flex items-center gap-2">
                  <div className={cn("w-3 h-3 rounded", x.c)} />
                  <span className="text-zinc-400">{x.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-6 border-t border-white/10 mt-6">
            <h4 className="text-sm font-semibold text-zinc-100 mb-3">Occupancy Analytics</h4>
            <div className="space-y-3">
              {[
                { k: "Avg. Daily Peak", v: "2,650 people" },
                { k: "Avg. Duration", v: "6.5 hours" },
                { k: "Turnover Rate", v: "3.2x daily" },
              ].map((x) => (
                <div key={x.k} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">{x.k}</span>
                  <span className="font-medium text-zinc-100">{x.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
