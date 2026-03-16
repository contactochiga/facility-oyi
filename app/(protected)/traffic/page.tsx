"use client";

import Topbar from "@/components/shell/Topbar";
import { MetricCard } from "@/components/MetricCard";
import { Car, TrendingUp, Clock, MapPin, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { visitorService, type VisitorItem } from "@/services/visitorService";
import { deviceService, type FacilityDevice } from "@/services/deviceService";
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

export default function TrafficPage() {
  const [loading, setLoading] = useState(false);
  const [visitors, setVisitors] = useState<VisitorItem[]>([]);
  const [devices, setDevices] = useState<FacilityDevice[]>([]);
  const [showAllGates, setShowAllGates] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [v, d] = await Promise.all([visitorService.listToday(), deviceService.list()]);
      setVisitors(Array.isArray(v) ? v : []);
      setDevices(Array.isArray(d) ? d : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const accessDevices = useMemo(() => {
    return devices.filter((d) => {
      const hay = `${safeLower(d.type)} ${safeLower(d.name)} ${safeLower(d.room)}`;
      return hay.includes("gate") || hay.includes("access") || hay.includes("lock") || hay.includes("barrier");
    });
  }, [devices]);

  const gateActivity = useMemo(() => {
    const byGate = new Map<string, { gate: string; entries: number; exits: number; status: string }>();

    for (const v of visitors) {
      const gate = (v.purpose || "Main Gate").trim() || "Main Gate";
      const row = byGate.get(gate) || { gate, entries: 0, exits: 0, status: "operational" };
      const s = safeLower(v.status);
      if (s === "exited") row.exits += 1;
      else row.entries += 1;
      byGate.set(gate, row);
    }

    const rows = Array.from(byGate.values());
    if (!rows.length) {
      return [
        {
          gate: "No gate traffic yet",
          entries: 0,
          exits: 0,
          status: "standby",
        },
      ];
    }

    return rows.sort((a, b) => b.entries + b.exits - (a.entries + a.exits));
  }, [visitors]);

  const flowSeries = useMemo(() => {
    const now = new Date();
    const labels: string[] = [];
    for (let i = 7; i >= 0; i -= 1) {
      const d = new Date(now.getTime() - i * 60 * 60 * 1000);
      labels.push(`${String(d.getHours()).padStart(2, "0")}:00`);
    }

    const buckets = new Map<string, number>();
    for (const l of labels) buckets.set(l, 0);

    for (const v of visitors) {
      const key = hourLabel(v.created_at);
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + 1);
    }

    return labels.map((time) => ({ time, vehicles: buckets.get(time) || 0 }));
  }, [visitors]);

  const gateChart = useMemo(
    () => gateActivity.slice(0, 6).map((g) => ({ zone: g.gate, occupied: g.entries, available: g.exits })),
    [gateActivity]
  );
  const primaryGate = gateActivity[0] || null;
  const secondaryGates = gateActivity.slice(1);

  const activeVisitors = visitors.filter((v) => {
    const s = safeLower(v.status);
    return s === "active" || s === "approved" || s === "entered";
  }).length;

  const totalTrips = visitors.length;
  const onlineAccess = accessDevices.filter((d) => safeLower(d.status).includes("active") || safeLower(d.status).includes("online")).length;
  const avgHourly = flowSeries.length
    ? Math.round(flowSeries.reduce((sum, x) => sum + Number(x.vehicles || 0), 0) / flowSeries.length)
    : 0;

  return (
    <div className="space-y-7">
      <Topbar title="Traffic and Parking" subtitle="Live gate movement, access throughput, and entry activity" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Visitors Today" value={String(totalTrips)} change={loading ? "Refreshing" : "Live from facility visitors"} trend="neutral" icon={Car} iconColor="text-blue-500" />
        <MetricCard title="Active Inbound" value={String(activeVisitors)} change="Currently active or entered" trend="up" icon={TrendingUp} iconColor="text-emerald-500" />
        <MetricCard title="Hourly Throughput" value={String(avgHourly)} change="Average entries per hour (last 8h)" trend="neutral" icon={Clock} iconColor="text-violet-500" />
        <MetricCard title="Access Devices Online" value={`${onlineAccess}/${accessDevices.length || 0}`} change="Gate and access infrastructure" trend="neutral" icon={MapPin} iconColor="text-orange-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <h3 className="text-base font-semibold text-zinc-100 mb-4">Gate Activity</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={gateChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="zone" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ backgroundColor: "#0b1220", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px" }} />
              <Bar dataKey="occupied" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              <Bar dataKey="available" fill="#64748b" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <h3 className="text-base font-semibold text-zinc-100 mb-4">Traffic Flow (Last 8 Hours)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={flowSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ backgroundColor: "#0b1220", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px" }} />
              <Line type="monotone" dataKey="vehicles" stroke="#10b981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-zinc-100">Gate Status</h3>
            <p className="mt-1 text-sm text-zinc-400">
              {primaryGate?.gate || "No gate traffic yet"} · 1/{Math.max(gateActivity.length, 1)} primary exit
            </p>
          </div>
          {secondaryGates.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowAllGates((value) => !value)}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-white/10"
            >
              {showAllGates ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {showAllGates ? "Collapse exits" : `Show ${secondaryGates.length} more exits`}
            </button>
          ) : null}
        </div>
        <div className="space-y-3">
          {(showAllGates ? gateActivity : gateActivity.slice(0, 1)).map((gate, index) => (
            <div key={gate.gate} className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="min-w-0">
                  <span className="text-sm font-medium text-zinc-100">{gate.gate}</span>
                  <div className="mt-1 text-[11px] text-zinc-500">
                    Exit {index + 1}/{Math.max(gateActivity.length, 1)}
                  </div>
                </div>
                <span
                  className={
                    gate.status === "operational"
                      ? "px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                      : "px-2 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20"
                  }
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
      </div>
    </div>
  );
}
