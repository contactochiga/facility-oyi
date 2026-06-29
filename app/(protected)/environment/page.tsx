"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { deviceService, type FacilityDevice } from "@/services/deviceService";
import { maintenanceService, type MaintenanceItem } from "@/services/maintenanceService";
import { Leaf, RefreshCw, Thermometer, Wrench } from "lucide-react";

function lower(value: unknown) { return String(value || "").toLowerCase(); }
function isEnvironmentDevice(device: FacilityDevice) { return /sensor|temperature|humidity|air|aqi|hvac|environment|smoke|motion|waste/.test(`${lower(device.name)} ${lower(device.type)} ${lower(device.category)} ${lower(device.metadata)}`); }
function isOnline(device: FacilityDevice) { return /online|active|healthy|live/.test(lower(device.status)); }
function isOpen(ticket: MaintenanceItem) { return !["completed", "closed", "resolved", "cancelled"].includes(lower(ticket.status)); }
function isEnvTicket(ticket: MaintenanceItem) { return /environment|sensor|hvac|air|temperature|humidity|waste|smoke/.test(JSON.stringify(ticket || {}).toLowerCase()); }
function dateLabel(value?: string | null) { if (!value) return "Time unavailable"; const d = new Date(value); return Number.isNaN(d.getTime()) ? "Time unavailable" : d.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }); }

function Metric({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{label}</div><div className="mt-3 text-2xl font-semibold text-white">{value}</div><div className="mt-1 text-xs text-zinc-500">{hint}</div></div>;
}

export default function EnvironmentPage() {
  const [devices, setDevices] = useState<FacilityDevice[]>([]);
  const [tickets, setTickets] = useState<MaintenanceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      const [deviceRows, ticketRows] = await Promise.all([deviceService.list().catch(() => []), maintenanceService.list().catch(() => [])]);
      setDevices(Array.isArray(deviceRows) ? deviceRows : []);
      setTickets(Array.isArray(ticketRows) ? ticketRows : []);
    } catch (err: any) { setError(err?.message || "Failed to load environment operations"); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  const envDevices = useMemo(() => devices.filter(isEnvironmentDevice), [devices]);
  const openEnvTickets = useMemo(() => tickets.filter((ticket) => isOpen(ticket) && isEnvTicket(ticket)), [tickets]);
  const online = envDevices.filter(isOnline).length;
  const unavailable = envDevices.filter((device) => /offline|error|unavailable|down/.test(lower(device.status))).length;

  return (
    <div className="space-y-6">
      <Topbar title="Environmental Awareness" subtitle="Environmental sensors, HVAC/service events, and telemetry readiness" strip={[{ label: "Status", value: envDevices.length ? "Live" : "Pending" }, { label: "Attention", value: unavailable + openEnvTickets.length }, { label: "Health", value: unavailable || openEnvTickets.length ? "Review" : "Stable" }, { label: "Action", value: "Inspect sensors" }]} rightSlot={<Button variant="ghost" onClick={() => void load()} disabled={loading} className="gap-2"><RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />Refresh</Button>} />
      {error ? <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}

      <section className="grid gap-3 md:grid-cols-4">
        <Metric label="Sensor inventory" value={envDevices.length} hint="Environment-related registry entries" />
        <Metric label="Online sensors" value={online} hint="Reported active by registry" />
        <Metric label="Unavailable" value={unavailable} hint="Offline/error registry status" />
        <Metric label="Open events" value={openEnvTickets.length} hint="Environment-related maintenance" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Thermometer className="h-4 w-4 text-sky-200" />Environmental Signal Registry</h2>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {envDevices.map((device) => (
              <div key={device.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3"><div><div className="text-sm font-medium text-white">{device.name || "Unnamed sensor"}</div><div className="mt-1 text-xs text-zinc-500">{device.type || device.category || "Unknown type"} · {device.room || "Estate/shared infrastructure"}</div></div><span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase text-zinc-300">{device.status || "unknown"}</span></div>
              </div>
            ))}
            {!envDevices.length ? <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500 md:col-span-2">No environmental sensors are registered yet. Awaiting telemetry source.</div> : null}
          </div>
        </div>
        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Wrench className="h-4 w-4 text-amber-200" />Environmental Activity</h2>
            <div className="mt-4 space-y-2">{openEnvTickets.slice(0, 8).map((ticket) => <Link key={ticket.id} href="/maintenance" className="block rounded-xl border border-white/10 bg-black/20 p-3"><div className="text-sm text-white">{ticket.title}</div><div className="mt-1 text-xs text-zinc-500">{ticket.status} · {dateLabel(ticket.created_at)}</div></Link>)}{!openEnvTickets.length ? <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">No environment events from backend sources.</div> : null}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-sm leading-6 text-zinc-400"><Leaf className="mb-3 h-5 w-5 text-emerald-200" />Temperature, humidity, AQI, waste and external environmental readings remain hidden until a live telemetry source is configured.</div>
        </aside>
      </section>
    </div>
  );
}
