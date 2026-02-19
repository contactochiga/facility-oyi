"use client";

import Topbar from "@/components/shell/Topbar";
import { MetricCard } from "@/components/MetricCard";
import { Wind, Thermometer, Droplet, Sun } from "lucide-react";
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

const environmentalData = [
  { time: "00:00", temp: 22, humidity: 55, aqi: 45 },
  { time: "04:00", temp: 20, humidity: 62, aqi: 38 },
  { time: "08:00", temp: 24, humidity: 52, aqi: 52 },
  { time: "12:00", temp: 28, humidity: 48, aqi: 58 },
  { time: "16:00", temp: 27, humidity: 50, aqi: 62 },
  { time: "20:00", temp: 24, humidity: 56, aqi: 48 },
  { time: "23:59", temp: 22, humidity: 58, aqi: 42 },
];

const sensorLocations = [
  { location: "Main Plaza", temp: 24, humidity: 52, aqi: 48 },
  { location: "Building A Lobby", temp: 23, humidity: 48, aqi: 35 },
  { location: "Parking Area", temp: 26, humidity: 55, aqi: 65 },
  { location: "Garden Zone", temp: 25, humidity: 58, aqi: 42 },
  { location: "Building E Roof", temp: 27, humidity: 50, aqi: 55 },
];

const airQualityBreakdown = [
  { pollutant: "PM2.5", value: 12, unit: "μg/m³", status: "good", limit: 35 },
  { pollutant: "PM10", value: 28, unit: "μg/m³", status: "good", limit: 150 },
  { pollutant: "O₃", value: 42, unit: "ppb", status: "good", limit: 70 },
  { pollutant: "NO₂", value: 18, unit: "ppb", status: "good", limit: 100 },
  { pollutant: "CO", value: 0.4, unit: "ppm", status: "good", limit: 9 },
];

function getAQIStatus(aqi: number) {
  if (aqi <= 50) return { label: "Excellent", color: "text-emerald-300", bg: "bg-emerald-500/10 border-emerald-500/20" };
  if (aqi <= 100) return { label: "Good", color: "text-blue-300", bg: "bg-blue-500/10 border-blue-500/20" };
  if (aqi <= 150) return { label: "Moderate", color: "text-amber-300", bg: "bg-amber-500/10 border-amber-500/20" };
  return { label: "Poor", color: "text-red-300", bg: "bg-red-500/10 border-red-500/20" };
}

export default function EnvironmentPage() {
  return (
    <div className="space-y-7">
      <Topbar
        title="Environment"
        subtitle="Air quality • temperature • humidity • sensor network"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Air Quality Index" value="48" change="Good quality" trend="neutral" icon={Wind} iconColor="text-blue-500" />
        <MetricCard title="Temperature" value="24°C" change="Optimal range" trend="neutral" icon={Thermometer} iconColor="text-orange-500" />
        <MetricCard title="Humidity" value="52%" change="Comfortable" trend="neutral" icon={Droplet} iconColor="text-cyan-500" />
        <MetricCard title="UV Index" value="6" change="Moderate" trend="neutral" icon={Sun} iconColor="text-yellow-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <h3 className="text-base font-semibold text-zinc-100 mb-4">Environmental Trends (24h)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={environmentalData}>
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
              <Legend />
              <Line type="monotone" dataKey="temp" stroke="#f97316" strokeWidth={2} name="Temperature (°C)" />
              <Line type="monotone" dataKey="humidity" stroke="#06b6d4" strokeWidth={2} name="Humidity (%)" />
              <Line type="monotone" dataKey="aqi" stroke="#8b5cf6" strokeWidth={2} name="AQI" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <h3 className="text-base font-semibold text-zinc-100 mb-4">Air Quality Details</h3>

          <div className="space-y-3">
            {airQualityBreakdown.map((p) => {
              const percentage = (p.value / p.limit) * 100;
              const bar =
                percentage < 50 ? "bg-emerald-500" : percentage < 75 ? "bg-blue-500" : "bg-amber-500";

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
                    <div className={cn("h-2 rounded-full", bar)} style={{ width: `${Math.min(percentage, 100)}%` }} />
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-zinc-400">Limit: {p.limit} {p.unit}</span>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sensorLocations.map((s) => {
              const aqi = getAQIStatus(s.aqi);
              return (
                <div key={s.location} className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-zinc-100">{s.location}</span>
                    <span className={cn("px-2 py-1 rounded-full text-xs font-medium border", aqi.bg, aqi.color)}>
                      {aqi.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs text-zinc-400">Temp</p>
                      <p className="text-lg font-semibold text-orange-400">{s.temp}°C</p>
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
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <h3 className="text-base font-semibold text-zinc-100 mb-4">Environmental Alerts</h3>

          <div className="space-y-3 mb-6">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-sm font-medium text-emerald-300">All Systems Normal</span>
              </div>
              <p className="text-xs text-zinc-400">
                All environmental parameters within optimal range
              </p>
            </div>
          </div>

          <div className="pt-6 border-t border-white/10">
            <h4 className="text-sm font-semibold text-zinc-100 mb-3">Weather Forecast</h4>

            <div className="space-y-3">
              {[
                { day: "Today", icon: <Sun className="text-yellow-500" size={16} />, temp: "24-28°C" },
                { day: "Tomorrow", icon: <Sun className="text-yellow-500" size={16} />, temp: "23-27°C" },
                { day: "Friday", icon: <Droplet className="text-blue-500" size={16} />, temp: "21-25°C" },
              ].map((w) => (
                <div key={w.day} className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">{w.day}</span>
                  <div className="flex items-center gap-2">
                    {w.icon}
                    <span className="text-sm font-medium text-zinc-100">{w.temp}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-6 border-t border-white/10 mt-6">
            <h4 className="text-sm font-semibold text-zinc-100 mb-3">HVAC Recommendations</h4>

            <div className="space-y-2">
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3">
                <p className="text-xs text-blue-300">
                  Optimal temperature detected. Consider reducing HVAC load to save energy.
                </p>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                <p className="text-xs text-emerald-300">
                  Natural ventilation recommended for next 4 hours based on outdoor conditions.
                </p>
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
