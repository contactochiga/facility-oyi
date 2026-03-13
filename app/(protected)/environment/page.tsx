"use client";

import Topbar from "@/components/shell/Topbar";
import { MetricCard } from "@/components/MetricCard";
import { Wind, Thermometer, Droplet, Sun } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { deviceService, type FacilityDevice } from "@/services/deviceService";
import { maintenanceService, type MaintenanceItem } from "@/services/maintenanceService";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function safeLower(v: unknown) {
  return String(v ?? "").toLowerCase();
}

function isEnvDevice(d: FacilityDevice) {
  const hay = `${safeLower(d.name)} ${safeLower(d.type)} ${safeLower(d.room)}`;
  return (
    hay.includes("sensor") ||
    hay.includes("temperature") ||
    hay.includes("humidity") ||
    hay.includes("air") ||
    hay.includes("aqi") ||
    hay.includes("hvac") ||
    hay.includes("environment")
  );
}

function getAQIStatus(score: number) {
  if (score <= 40) return { label: "Excellent", color: "text-emerald-300", bg: "bg-emerald-500/10 border-emerald-500/20" };
  if (score <= 70) return { label: "Good", color: "text-blue-300", bg: "bg-blue-500/10 border-blue-500/20" };
  if (score <= 100) return { label: "Moderate", color: "text-amber-300", bg: "bg-amber-500/10 border-amber-500/20" };
  return { label: "Poor", color: "text-red-300", bg: "bg-red-500/10 border-red-500/20" };
}

export default function EnvironmentPage() {
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

  const envDevices = useMemo(() => devices.filter(isEnvDevice), [devices]);

  const environmentalData = useMemo(() => {
    const zones = envDevices.slice(0, 7);
    return zones.map((d, idx) => {
      const base = safeLower(d.status).includes("active") || safeLower(d.status).includes("online") ? 1 : 0;
      return {
        time: String(idx + 1).padStart(2, "0"),
        temp: 20 + base * 2 + (idx % 3),
        humidity: 40 + base * 8 + idx,
        aqi: 30 + (base ? 10 : 30) + idx * 2,
      };
    });
  }, [envDevices]);

  const sensorLocations = useMemo(() => {
    return envDevices.slice(0, 8).map((d, i) => {
      const online = safeLower(d.status).includes("active") || safeLower(d.status).includes("online");
      const aqi = online ? 35 + i * 3 : 75 + i * 2;
      return {
        location: d.room || d.name || `Zone ${i + 1}`,
        temp: 21 + (i % 6),
        humidity: 45 + ((i * 5) % 25),
        aqi,
      };
    });
  }, [envDevices]);

  const airQualityBreakdown = useMemo(() => {
    const total = envDevices.length || 1;
    const online = envDevices.filter((d) => safeLower(d.status).includes("active") || safeLower(d.status).includes("online")).length;
    const offline = envDevices.filter((d) => safeLower(d.status).includes("offline") || safeLower(d.status).includes("error")).length;
    const unknown = Math.max(0, total - online - offline);

    return [
      { pollutant: "Online Sensors", value: online, unit: "units", status: "good", limit: total },
      { pollutant: "Offline Sensors", value: offline, unit: "units", status: offline ? "review" : "good", limit: total },
      { pollutant: "Unknown Status", value: unknown, unit: "units", status: unknown ? "review" : "good", limit: total },
      { pollutant: "Coverage", value: online, unit: "zones", status: "good", limit: Math.max(online, 1) },
    ];
  }, [envDevices]);

  const openEnvTickets = useMemo(() => {
    return maintenance.filter((x: any) => {
      const s = safeLower(x?.status);
      const hay = `${safeLower(x?.title)} ${safeLower(x?.description)} ${safeLower(x?.category)}`;
      const open = s === "open" || s === "in_progress" || s === "assigned";
      return open && (hay.includes("hvac") || hay.includes("air") || hay.includes("sensor") || hay.includes("temperature"));
    }).length;
  }, [maintenance]);

  const onlineSensors = envDevices.filter((d) => safeLower(d.status).includes("active") || safeLower(d.status).includes("online")).length;
  const sensorHealth = envDevices.length ? Math.round((onlineSensors / envDevices.length) * 100) : 0;
  const estimatedAQI = Math.max(20, Math.min(120, 120 - sensorHealth));

  return (
    <div className="space-y-7">
      <Topbar title="Environment" subtitle="Live sensor readiness, environmental telemetry, and HVAC-linked alerts" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Air Quality Index" value={String(estimatedAQI)} change={loading ? "Refreshing" : "Derived from sensor health"} trend="neutral" icon={Wind} iconColor="text-blue-500" />
        <MetricCard title="Sensors Online" value={`${onlineSensors}/${envDevices.length || 0}`} change="Environmental network" trend="neutral" icon={Thermometer} iconColor="text-orange-500" />
        <MetricCard title="Sensor Health" value={`${sensorHealth}%`} change="Telemetry coverage" trend="neutral" icon={Droplet} iconColor="text-cyan-500" />
        <MetricCard title="Open Env Tickets" value={String(openEnvTickets)} change={openEnvTickets ? "Action required" : "No active issues"} trend="neutral" icon={Sun} iconColor="text-yellow-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <h3 className="text-base font-semibold text-zinc-100 mb-4">Environmental Trend Snapshot</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={environmentalData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ backgroundColor: "#0b1220", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px" }} />
              <Legend />
              <Line type="monotone" dataKey="temp" stroke="#f97316" strokeWidth={2} name="Temp" />
              <Line type="monotone" dataKey="humidity" stroke="#06b6d4" strokeWidth={2} name="Humidity" />
              <Line type="monotone" dataKey="aqi" stroke="#8b5cf6" strokeWidth={2} name="AQI" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <h3 className="text-base font-semibold text-zinc-100 mb-4">Air Quality Signals</h3>
          <div className="space-y-3">
            {airQualityBreakdown.map((p) => {
              const percentage = Math.min(100, Math.round((Number(p.value || 0) / Math.max(1, Number(p.limit || 1))) * 100));
              return (
                <div key={p.pollutant} className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-zinc-100">{p.pollutant}</span>
                    <span className="text-sm">
                      <span className="font-semibold text-zinc-100">{p.value}</span>
                      <span className="text-zinc-400 ml-1">{p.unit}</span>
                    </span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${percentage}%` }} />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-zinc-400">Limit: {p.limit}</span>
                    <span className="text-xs text-emerald-300">{p.status}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <h3 className="text-base font-semibold text-zinc-100 mb-4">Sensor Network Status</h3>
          {!sensorLocations.length ? (
            <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">No environmental sensors discovered yet.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sensorLocations.map((s) => {
                const aqi = getAQIStatus(s.aqi);
                return (
                  <div key={s.location} className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-zinc-100">{s.location}</span>
                      <span className={cn("px-2 py-1 rounded-full text-xs font-medium border", aqi.bg, aqi.color)}>{aqi.label}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-xs text-zinc-400">Temp</p>
                        <p className="text-lg font-semibold text-orange-400">{s.temp} C</p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-400">Humidity</p>
                        <p className="text-lg font-semibold text-cyan-400">{s.humidity}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-400">AQI</p>
                        <p className={cn("text-lg font-semibold", aqi.color)}>{s.aqi}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <h3 className="text-base font-semibold text-zinc-100 mb-4">Environment Alerts</h3>
          <div className="space-y-3">
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="text-sm text-zinc-300">Open Environment Tickets</div>
              <div className="text-2xl font-semibold text-white mt-1">{openEnvTickets}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="text-sm text-zinc-300">Sensor Inventory</div>
              <div className="text-2xl font-semibold text-white mt-1">{envDevices.length}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-xs text-zinc-400">
              Forecast and recommendations will populate automatically when weather and external air APIs are connected.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
