"use client";

import Topbar from "@/components/shell/Topbar";
import { MetricCard } from "@/components/MetricCard";
import { Car, TrendingUp, Clock, MapPin } from "lucide-react";
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

const parkingOccupancy = [
  { zone: "Level 1", total: 120, occupied: 95, available: 25 },
  { zone: "Level 2", total: 120, occupied: 108, available: 12 },
  { zone: "Level 3", total: 100, occupied: 78, available: 22 },
  { zone: "Level 4", total: 100, occupied: 45, available: 55 },
  { zone: "Visitor", total: 40, occupied: 32, available: 8 },
];

const trafficFlow = [
  { time: "06:00", vehicles: 45 },
  { time: "08:00", vehicles: 180 },
  { time: "10:00", vehicles: 95 },
  { time: "12:00", vehicles: 120 },
  { time: "14:00", vehicles: 85 },
  { time: "16:00", vehicles: 110 },
  { time: "18:00", vehicles: 210 },
  { time: "20:00", vehicles: 75 },
];

const gateActivity = [
  { gate: "Main Gate A", entries: 234, exits: 198, status: "operational" },
  { gate: "Main Gate B", entries: 187, exits: 165, status: "operational" },
  { gate: "Service Gate", entries: 45, exits: 52, status: "operational" },
  { gate: "Emergency Gate", entries: 3, exits: 2, status: "standby" },
];

export default function TrafficPage() {
  return (
    <div className="space-y-7">
      <Topbar
        title="Traffic & Parking"
        subtitle="Vehicle flow • gate activity • parking utilization"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Parking Occupancy"
          value="358/480"
          change="75% capacity"
          trend="neutral"
          icon={Car}
          iconColor="text-blue-500"
        />
        <MetricCard
          title="Vehicles Today"
          value="1,247"
          change="+8% vs yesterday"
          trend="up"
          icon={TrendingUp}
          iconColor="text-emerald-500"
        />
        <MetricCard
          title="Avg. Duration"
          value="4.2h"
          change="Standard range"
          trend="neutral"
          icon={Clock}
          iconColor="text-violet-500"
        />
        <MetricCard
          title="Available Spots"
          value="122"
          change="Multiple zones"
          trend="neutral"
          icon={MapPin}
          iconColor="text-orange-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <h3 className="text-base font-semibold text-zinc-100 mb-4">
            Parking Occupancy by Zone
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={parkingOccupancy}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="zone" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0b1220",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "12px",
                }}
              />
              <Bar dataKey="occupied" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              <Bar dataKey="available" fill="#64748b" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <h3 className="text-base font-semibold text-zinc-100 mb-4">
            Traffic Flow (Today)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trafficFlow}>
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
              <Line type="monotone" dataKey="vehicles" stroke="#10b981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <h3 className="text-base font-semibold text-zinc-100 mb-4">
            Real-time Parking Status
          </h3>

          <div className="space-y-3">
            {parkingOccupancy.map((zone) => {
              const percentage = (zone.occupied / zone.total) * 100;
              const bar =
                percentage > 90
                  ? "bg-red-500"
                  : percentage > 75
                    ? "bg-amber-500"
                    : "bg-emerald-500";

              return (
                <div key={zone.zone} className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-zinc-100">{zone.zone}</span>
                    <span className="text-sm">
                      <span className="text-zinc-100 font-semibold">{zone.available}</span>
                      <span className="text-zinc-400"> / {zone.total} available</span>
                    </span>
                  </div>

                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div className={cn("h-2 rounded-full transition-all", bar)} style={{ width: `${percentage}%` }} />
                  </div>

                  <p className="text-xs text-zinc-400 mt-2">{percentage.toFixed(0)}% occupied</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <h3 className="text-base font-semibold text-zinc-100 mb-4">Gate Activity</h3>

          <div className="space-y-3">
            {gateActivity.map((gate) => (
              <div key={gate.gate} className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-zinc-100">{gate.gate}</span>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      gate.status === "operational"
                        ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                        : "bg-blue-500/10 text-blue-300 border border-blue-500/20"
                    }`}
                  >
                    {gate.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-zinc-400 mb-1">Entries</p>
                    <p className="text-xl font-semibold text-emerald-400">{gate.entries}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-400 mb-1">Exits</p>
                    <p className="text-xl font-semibold text-blue-400">{gate.exits}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-white/10">
            <h4 className="text-sm font-semibold text-zinc-100 mb-3">Peak Hours</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">Morning Rush</span>
                <span className="font-medium text-zinc-100">7:30 AM - 9:00 AM</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">Evening Rush</span>
                <span className="font-medium text-zinc-100">5:00 PM - 7:00 PM</span>
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
