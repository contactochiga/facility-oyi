"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { OisCard, OisListItem, OisPageToolbar, OisRegistryHeader, OisRegistryPanel } from "@/components/ois";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { deviceService, type FacilityDevice } from "@/services/deviceService";
import { maintenanceService, type MaintenanceItem } from "@/services/maintenanceService";
import { Leaf, Thermometer, Wrench } from "lucide-react";

function lower(value: unknown) { return String(value || "").toLowerCase(); }
function isEnvironmentDevice(device: FacilityDevice) { return /sensor|temperature|humidity|air|aqi|hvac|environment|smoke|motion|waste/.test(`${lower(device.name)} ${lower(device.type)} ${lower(device.category)} ${lower(device.metadata)}`); }
function isOnline(device: FacilityDevice) { return /online|active|healthy|live/.test(lower(device.status)); }
function isOpen(ticket: MaintenanceItem) { return !["completed", "closed", "resolved", "cancelled"].includes(lower(ticket.status)); }
function isEnvTicket(ticket: MaintenanceItem) { return /environment|sensor|hvac|air|temperature|humidity|waste|smoke/.test(JSON.stringify(ticket || {}).toLowerCase()); }
function dateLabel(value?: string | null) { if (!value) return "Time unavailable"; const d = new Date(value); return Number.isNaN(d.getTime()) ? "Time unavailable" : d.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }); }

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
      <Topbar title="Environmental Awareness" subtitle="Sensors and comfort signals" strip={[{ label: "Status", value: envDevices.length ? "Live" : "Pending" }, { label: "Attention", value: unavailable + openEnvTickets.length }, { label: "Health", value: unavailable || openEnvTickets.length ? "Review" : "Stable" }, { label: "Action", value: "Inspect sensors" }]} />
      {error ? <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
      <section className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <OisRegistryPanel
          title="Environmental Registry"
          caption={loading ? "Loading records" : `${envDevices.length} records`}
          action={<Thermometer className="h-4 w-4 text-sky-200" />}
          toolbar={<OisPageToolbar onRefresh={() => void load()} refreshing={loading} searchPlaceholder="Environmental awareness is sourced from sensor registry and maintenance signals." />}
          className="p-5"
        >
          <div className="grid gap-2 md:grid-cols-2">
            {envDevices.map((device) => (
              <OisListItem key={device.id} title={device.name || "Unnamed sensor"} description={`${device.type || device.category || "Unknown type"} · ${device.room || "Estate/shared infrastructure"}`} meta={`${isOnline(device) ? "Online" : "Review required"} · ${dateLabel((device as any).last_seen_at || (device as any).updated_at)}`} status={isOnline(device) ? "stable" : /offline|error|unavailable|down/.test(lower(device.status)) ? "critical" : "pending"} />
            ))}
            {!envDevices.length ? <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500 md:col-span-2">No environmental sensors are registered yet. Awaiting telemetry source.</div> : null}
          </div>
        </OisRegistryPanel>
        <aside className="space-y-4">
          <OisCard className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Wrench className="h-4 w-4 text-amber-200" />Environmental Activity</h2>
            <div className="mt-4 space-y-2">{openEnvTickets.slice(0, 8).map((ticket) => <Link key={ticket.id} href="/maintenance" className="block rounded-xl border border-white/10 bg-black/20 p-3"><div className="text-sm text-white">{ticket.title}</div><div className="mt-1 text-xs text-zinc-500">{ticket.status} · {dateLabel(ticket.created_at)}</div></Link>)}{!openEnvTickets.length ? <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">No environment events from backend sources.</div> : null}</div>
          </OisCard>
          <OisCard className="p-5 text-sm leading-6 text-zinc-400"><Leaf className="mb-3 h-5 w-5 text-emerald-200" />Temperature, humidity, AQI, waste and external environmental readings remain hidden until a live telemetry source is configured.</OisCard>
        </aside>
      </section>
    </div>
  );
}
