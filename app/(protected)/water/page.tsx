"use client";

import Topbar from "@/components/shell/Topbar";
import { MetricCard } from "@/components/MetricCard";
import { Droplets, TrendingDown, AlertTriangle, Waves } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const consumptionData = [
  { time: "00:00", usage: 1200 },
  { time: "04:00", usage: 950 },
  { time: "08:00", usage: 2100 },
  { time: "12:00", usage: 2400 },
  { time: "16:00", usage: 2200 },
  { time: "20:00", usage: 1800 },
  { time: "23:59", usage: 1500 },
];

const buildingUsage = [
  { building: "Building A", usage: 4850, target: 5000, status: "normal" },
  { building: "Building B", usage: 5420, target: 5000, status: "high" },
  { building: "Building C", usage: 3980, target: 4500, status: "normal" },
  { building: "Building D", usage: 5100, target: 5200, status: "normal" },
  { building: "Building E", usage: 4200, target: 4800, status: "normal" },
];

const waterQuality = [
  { parameter: "pH Level", value: "7.2", status: "optimal", range: "6.5 - 8.5" },
  { parameter: "Turbidity", value: "0.8 NTU", status: "optimal", range: "< 1 NTU" },
  { parameter: "Chlorine", value: "0.5 mg/L", status: "optimal", range: "0.2 - 1.0 mg/L" },
  { parameter: "Temperature", value: "22°C", status: "optimal", range: "15 - 25°C" },
];

export default function WaterPage() {
  return (
    <div className="space-y-7">
      <Topbar
        title="Water Management"
        subtitle="Consumption • quality • reservoirs • pumps"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Consumption"
          value="23,550 L"
          change="-8% vs yesterday"
          trend="down"
          icon={Droplets}
          iconColor="text-blue-500"
        />
        <MetricCard
          title="Water Quality"
          value="Excellent"
          change="All parameters normal"
          trend="neutral"
          icon={Waves}
          iconColor="text-emerald-500"
        />
        <MetricCard
          title="Cost Savings"
          value="$428"
          change="This month"
          trend="up"
          icon={TrendingDown}
          iconColor="text-violet-500"
        />
        <MetricCard
          title="Alerts"
          value="1"
          change="High usage detected"
          trend="up"
          icon={AlertTriangle}
          iconColor="text-amber-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <h3 className="text-base font-semibold text-zinc-100 mb-4">Water Consumption (24h)</h3>

          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={consumptionData}>
              <defs>
                <linearGradient id="colorWater" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>

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
              <Area type="monotone" dataKey="usage" stroke="#06b6d4" strokeWidth={2} fill="url(#colorWater)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <h3 className="text-base font-semibold text-zinc-100 mb-4">Water Quality Metrics</h3>

          <div className="space-y-3">
            {waterQuality.map((metric) => (
              <div key={metric.parameter} className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-zinc-100">{metric.parameter}</span>
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                    {metric.status}
                  </span>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <h3 className="text-base font-semibold text-zinc-100 mb-4">Building Water Usage</h3>

          <div className="space-y-3">
            {buildingUsage.map((building) => {
              const percentage = (building.usage / building.target) * 100;
              const bar = building.status === "high" ? "bg-amber-500" : "bg-cyan-500";

              return (
                <div key={building.building} className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-zinc-100">{building.building}</span>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-zinc-100">
                        {building.usage.toLocaleString()} L
                      </span>
                      <span className="text-xs text-zinc-400 ml-1">
                        / {building.target.toLocaleString()} L
                      </span>
                    </div>
                  </div>

                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div className={cn("h-2 rounded-full transition-all", bar)} style={{ width: `${Math.min(percentage, 100)}%` }} />
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-zinc-400">{percentage.toFixed(0)}% of target</span>
                    {building.status === "high" ? (
                      <span className="text-xs text-amber-300 flex items-center gap-1">
                        <AlertTriangle size={12} />
                        Above target
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <h3 className="text-base font-semibold text-zinc-100 mb-4">Water Systems</h3>

          <div className="space-y-3">
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-zinc-100">Main Supply Pressure</span>
                <span className="text-sm font-semibold text-emerald-300">Normal</span>
              </div>
              <div className="text-2xl font-semibold text-zinc-100 mb-1">45 PSI</div>
              <p className="text-xs text-zinc-400">Target range: 40-50 PSI</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-zinc-100">Reservoir Level</span>
                <span className="text-sm font-semibold text-emerald-300">Adequate</span>
              </div>
              <div className="text-2xl font-semibold text-zinc-100 mb-1">78%</div>
              <div className="w-full bg-white/10 rounded-full h-2 mt-2">
                <div className="bg-cyan-500 h-2 rounded-full" style={{ width: "78%" }} />
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-zinc-100">Pump Stations</span>
                <span className="text-sm font-semibold text-emerald-300">All Operational</span>
              </div>
              <div className="grid grid-cols-4 gap-2 mt-3">
                {[1, 2, 3, 4].map((pump) => (
                  <div key={pump} className="text-center p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                    <div className="text-xs text-emerald-300 font-medium">P{pump}</div>
                    <div className="text-xs text-zinc-400 mt-1">Active</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <h4 className="text-sm font-semibold text-zinc-100 mb-3">Conservation Goals</h4>
              <div className="space-y-3">
                {[
                  { label: "Water Reduction Target", value: "12%", width: "12%", bar: "bg-blue-500" },
                  { label: "Recycling Rate", value: "24%", width: "24%", bar: "bg-emerald-500" },
                ].map((g) => (
                  <div key={g.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-zinc-400">{g.label}</span>
                      <span className="text-xs font-semibold text-zinc-100">{g.value}</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-1.5">
                      <div className={cn("h-1.5 rounded-full", g.bar)} style={{ width: g.width }} />
                    </div>
                  </div>
                ))}
              </div>
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
