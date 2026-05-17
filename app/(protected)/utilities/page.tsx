"use client";

import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { utilityService, type UtilitySummary } from "@/services/utilityService";
import { useEffect, useMemo, useState } from "react";
import {
  MdBolt,
  MdOutlineWaterDrop,
  MdRouter,
  MdOutlineSensors,
} from "react-icons/md";

const modules = [
  {
    key: "power",
    title: "Power",
    detail: "Electric meters, load monitoring, backup power and outage response lanes.",
    icon: MdBolt,
    tone: "text-yellow-200 bg-yellow-500/10 border-yellow-500/20",
  },
  {
    key: "water",
    title: "Water",
    detail: "Water meters, tank levels, pump states, leak detection and service tickets.",
    icon: MdOutlineWaterDrop,
    tone: "text-sky-200 bg-sky-500/10 border-sky-500/20",
  },
  {
    key: "network",
    title: "Network",
    detail: "Estate network health, routers, gateways, access points and edge heartbeat.",
    icon: MdRouter,
    tone: "text-emerald-200 bg-emerald-500/10 border-emerald-500/20",
  },
  {
    key: "sensors",
    title: "Sensors",
    detail: "Occupancy, smoke, climate, motion, environmental and utility sensor groups.",
    icon: MdOutlineSensors,
    tone: "text-purple-200 bg-purple-500/10 border-purple-500/20",
  },
];

export default function UtilitiesPage() {
  const [summary, setSummary] = useState<UtilitySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const readiness = useMemo(
    () => [
      "Utility intelligence is derived from live Facility overview, hardware devices, maintenance and notifications.",
      "Power, water, network and sensor domains are classified from registered hardware and operational tickets.",
      "Critical utility incidents route into Alerts & Incidents while work orders remain in Maintenance.",
      "Estate-wide utility intelligence reports back to Ochiga Office through the live export contract.",
    ],
    []
  );

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      setSummary(await utilityService.summary());
    } catch (e: any) {
      setErr(e?.message || "Failed to load utility operations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-7">
      <Topbar
        title="Power & Utilities"
        subtitle="Estate-grade utility supervision for power, water, network and sensors"
      />

      <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.20),_transparent_30%),linear-gradient(145deg,_rgba(255,255,255,0.055),_rgba(255,255,255,0.02))] p-7 lg:p-9">
        <div className="max-w-3xl">
          <div className="text-xs uppercase tracking-[0.24em] text-yellow-200/80">
            National-grade facility layer
          </div>
          <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-white lg:text-5xl">
            Utility operations restored as a live infrastructure control layer.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-300 lg:text-base">
            This surface is reserved for estate utilities: energy, water, network,
            environmental sensors, outages, utility alerts and operational escalation.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
              Estate: {summary?.estateId || "waiting for live estate"}
            </span>
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
              Homes: {summary?.totals.homes ?? 0}
            </span>
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
              Active hardware: {summary?.totals.activeDevices ?? 0}
            </span>
          </div>
        </div>
        <div className="absolute right-7 top-7">
          <Button variant="ghost" onClick={load} disabled={loading}>
            {loading ? "Syncing..." : "Refresh utilities"}
          </Button>
        </div>
      </section>

      {err && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-200">
          {err}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {modules.map((item) => {
          const Icon = item.icon;
          const live = summary?.domains.find((domain) => domain.key === item.key);
          const stateLabel =
            live?.state === "live"
              ? "Live"
              : live?.state === "attention"
              ? "Needs attention"
              : "Waiting for devices";
          return (
            <article
              key={item.title}
              className={`rounded-2xl border p-5 ${item.tone}`}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-white">{item.title}</div>
                  <div className="mt-1 text-xs opacity-75">{stateLabel}</div>
                </div>
                <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-black/20">
                  <Icon className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-4 text-sm leading-6 text-zinc-300">{item.detail}</p>
              <div className="mt-5 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="text-zinc-500">Devices</div>
                  <div className="mt-1 text-base font-semibold text-white">{live?.devices ?? 0}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="text-zinc-500">Online</div>
                  <div className="mt-1 text-base font-semibold text-white">{live?.online ?? 0}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="text-zinc-500">Issues</div>
                  <div className="mt-1 text-base font-semibold text-white">
                    {(live?.openTickets ?? 0) + (live?.alerts ?? 0)}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="glass rounded-2xl border border-white/10 p-6">
          <div className="text-lg font-semibold text-white">Utility operating model</div>
          <div className="mt-4 grid gap-3">
            {readiness.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-zinc-300"
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-2xl border border-white/10 p-6">
          <div className="text-lg font-semibold text-white">Live utility feed</div>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Current data is pulled from the live Facility API: overview, hardware
            registry, maintenance requests and unread operational alerts.
          </p>
          <div className="mt-5 grid gap-3 text-sm">
            <div className="flex justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <span className="text-zinc-400">Open maintenance</span>
              <span className="text-white">{summary?.totals.openMaintenance ?? 0}</span>
            </div>
            <div className="flex justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <span className="text-zinc-400">Unread alerts</span>
              <span className="text-white">{summary?.totals.alerts ?? 0}</span>
            </div>
            <div className="flex justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <span className="text-zinc-400">Registered utility devices</span>
              <span className="text-white">
                {summary?.domains.reduce((sum, domain) => sum + domain.devices, 0) ?? 0}
              </span>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <a href="/devices">
              <Button>Open Hardware Devices</Button>
            </a>
            <a href="/alerts">
              <Button variant="ghost">Open Incidents</Button>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
