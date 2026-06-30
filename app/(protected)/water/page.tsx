"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Topbar from "@/components/shell/Topbar";
import { deviceService, type FacilityDevice } from "@/services/deviceService";
import { maintenanceService, type MaintenanceItem } from "@/services/maintenanceService";
import { Droplets, Wrench } from "lucide-react";

function lower(value: unknown) { return String(value || "").toLowerCase(); }
function isWaterDevice(device: FacilityDevice) { return /water|pump|tank|leak|flow|valve|meter|plumb/.test(`${lower(device.name)} ${lower(device.type)} ${lower(device.category)} ${lower(device.metadata)}`); }
function isOnline(device: FacilityDevice) { return /online|active|healthy|live/.test(lower(device.status)); }
function isOpen(ticket: MaintenanceItem) { return !["completed", "closed", "resolved", "cancelled"].includes(lower(ticket.status)); }
function isWaterTicket(ticket: MaintenanceItem) { return /water|pump|tank|leak|flow|valve|meter|pipe/.test(JSON.stringify(ticket || {}).toLowerCase()); }
function dateLabel(value?: string | null) { if (!value) return "Time unavailable"; const d = new Date(value); return Number.isNaN(d.getTime()) ? "Time unavailable" : d.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }); }

export default function WaterPage() {
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
    } catch (err: any) { setError(err?.message || "Failed to load water operations"); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  const waterDevices = useMemo(() => devices.filter(isWaterDevice), [devices]);
  const openWaterTickets = useMemo(() => tickets.filter((ticket) => isOpen(ticket) && isWaterTicket(ticket)), [tickets]);
  const online = waterDevices.filter(isOnline).length;
  const offline = waterDevices.filter((device) => /offline|error|unavailable|down/.test(lower(device.status))).length;

  return (
    <div className="space-y-6">
      <Topbar
        title="Water Operations"
        subtitle="Water devices and events"
        strip={[
          { label: "Registry", value: waterDevices.length, detail: "Water infrastructure", tone: "attention" },
          { label: "Online", value: online, detail: "Active devices", tone: "stable" },
          { label: "Faults", value: offline, detail: "Offline or degraded", tone: offline ? "warning" : "stable" },
          { label: "Open events", value: openWaterTickets.length, detail: "Maintenance queue", tone: openWaterTickets.length ? "warning" : "info" },
        ]}
      />
      {error ? <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}

      <section className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Droplets className="h-4 w-4 text-sky-200" />Water infrastructure registry</h2>
          <div className="mt-4 space-y-2">
            {waterDevices.map((device) => (
              <div key={device.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><div className="text-sm font-medium text-white">{device.name || "Unnamed water device"}</div><div className="mt-1 text-xs text-zinc-500">{device.type || device.category || "Unknown type"} · {device.room || "Estate/shared infrastructure"}</div></div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase text-zinc-300">{device.status || "unknown"}</span>
                </div>
              </div>
            ))}
            {!waterDevices.length ? <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">No water infrastructure devices are registered yet. Awaiting telemetry or device registry assignment.</div> : null}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Wrench className="h-4 w-4 text-amber-200" />Water event timeline</h2>
            <div className="mt-4 space-y-2">
              {openWaterTickets.slice(0, 8).map((ticket) => <Link key={ticket.id} href="/maintenance" className="block rounded-xl border border-white/10 bg-black/20 p-3"><div className="text-sm text-white">{ticket.title}</div><div className="mt-1 text-xs text-zinc-500">{ticket.status} · {dateLabel(ticket.created_at)}</div></Link>)}
              {!openWaterTickets.length ? <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">No active water events. No historical activity is generated without backend data.</div> : null}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-sm leading-6 text-zinc-400">Live pressure, tank level, and meter readings are pending telemetry integration. This page currently uses device registry state and maintenance events only.</div>
        </aside>
      </section>
    </div>
  );
}
