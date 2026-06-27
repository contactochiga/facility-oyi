"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { utilityService, type UtilitySummary, type UtilityDomain } from "@/services/utilityService";
import { AlertTriangle, Bolt, Droplets, Leaf, Network, RefreshCw, ShieldCheck } from "lucide-react";

const DOMAIN_META: Record<UtilityDomain, { title: string; icon: typeof Bolt; route: string; description: string }> = {
  power: { title: "Power", icon: Bolt, route: "/utilities", description: "Electricity meters, backup systems, generator links, and outage response." },
  water: { title: "Water", icon: Droplets, route: "/water", description: "Water meters, tanks, pumps, leaks, and water maintenance events." },
  network: { title: "Network", icon: Network, route: "/utilities", description: "Internet IDs, routers, gateways, Oyi Edge, and connectivity degradation." },
  sensors: { title: "Waste / Environmental", icon: Leaf, route: "/environment", description: "Environmental sensors, HVAC signals, waste/service events, and shared infrastructure." },
};

function stateLabel(state?: string) {
  if (state === "live") return "Live source";
  if (state === "attention") return "Needs attention";
  return "Awaiting telemetry";
}

function stateTone(state?: string) {
  if (state === "live") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
  if (state === "attention") return "border-amber-500/20 bg-amber-500/10 text-amber-200";
  return "border-white/10 bg-white/5 text-zinc-300";
}

function dateLabel(value?: string | null) {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function utilityText(value: unknown) {
  return JSON.stringify(value || "").toLowerCase();
}

export default function UtilitiesPage() {
  const [summary, setSummary] = useState<UtilitySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setSummary(await utilityService.summary());
    } catch (err: any) {
      setError(err?.message || "Failed to load utility operations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const onRealtime = (event: Event) => {
      const name = (event as CustomEvent)?.detail?.event || "";
      if (/device|edge|maintenance|notification|utility|incident/.test(name)) void load();
    };
    window.addEventListener("facility:realtime-event", onRealtime);
    return () => window.removeEventListener("facility:realtime-event", onRealtime);
  }, []);

  const utilityEvents = useMemo(() => {
    const maintenance = (summary?.maintenance || []).map((item: any) => ({
      id: `maintenance-${item.id}`,
      event: item.title || "Maintenance request",
      location: item.home_name || item.room_name || item.home_id || "Estate infrastructure",
      severity: item.priority || "review",
      status: item.status || "open",
      time: item.created_at,
      href: "/maintenance",
    }));
    const alerts = (summary?.alerts || []).map((item: any) => ({
      id: `alert-${item.id}`,
      event: item.title || item.message || "Utility alert",
      location: item.location || item.home_name || "Estate alert",
      severity: item.severity || item.priority || "attention",
      status: item.status || "unread",
      time: item.created_at,
      href: "/alerts",
    }));
    return [...alerts, ...maintenance]
      .filter((item) => /power|water|network|internet|pump|generator|outage|utility|sensor|environment|waste|leak/.test(utilityText(item)))
      .slice(0, 12);
  }, [summary]);

  const ownership = useMemo(() => {
    const devices = summary?.devices || [];
    const estateWide = devices.filter((device: any) => !device.home_id).length;
    const homeLevel = devices.filter((device: any) => device.home_id).length;
    const shared = devices.filter((device: any) => /shared|estate|gate|pump|generator|network|edge/.test(utilityText(device))).length;
    return { estateWide, homeLevel, shared };
  }, [summary]);

  return (
    <div className="space-y-6">
      <Topbar title="Utility Intelligence" subtitle="Power, water, network, waste, and environmental utility posture." rightSlot={<Button variant="ghost" onClick={() => void load()} disabled={loading} className="gap-2"><RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />Refresh</Button>} />
      {error ? <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {(summary?.domains || Object.keys(DOMAIN_META).map((key) => ({ key, state: "waiting", devices: 0, online: 0, openTickets: 0, alerts: 0 })) as any).map((domain: any) => {
          const meta = DOMAIN_META[domain.key as UtilityDomain];
          const Icon = meta.icon;
          return (
            <Link key={domain.key} href={meta.route} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-sky-400/30">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">{meta.title}</div>
                  <div className={`mt-2 inline-flex rounded-full border px-2 py-1 text-[11px] ${stateTone(domain.state)}`}>{stateLabel(domain.state)}</div>
                </div>
                <Icon className="h-5 w-5 text-sky-200" />
              </div>
              <p className="mt-4 text-sm leading-6 text-zinc-400">{meta.description}</p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-xl border border-white/10 bg-black/20 p-3"><span className="text-zinc-500">Devices</span><strong className="mt-1 block text-white">{domain.devices}</strong></div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3"><span className="text-zinc-500">Online</span><strong className="mt-1 block text-white">{domain.online}</strong></div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3"><span className="text-zinc-500">Events</span><strong className="mt-1 block text-white">{Number(domain.openTickets || 0) + Number(domain.alerts || 0)}</strong></div>
              </div>
            </Link>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <h2 className="text-sm font-semibold text-white">Utility Attention</h2>
          <p className="mt-1 text-xs text-zinc-500">Outages, degraded states and restored service events appear only when backed by maintenance or notification sources.</p>
          <div className="mt-4 space-y-2">
            {utilityEvents.map((event) => (
              <Link key={event.id} href={event.href} className="flex gap-3 rounded-xl border border-white/10 bg-black/20 p-3 transition hover:border-sky-400/25">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-200" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-white">{event.event}</span>
                  <span className="mt-1 block text-xs text-zinc-500">{event.location} · {event.severity} · {dateLabel(event.time)}</span>
                </span>
                <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase text-zinc-300">{event.status}</span>
              </Link>
            ))}
            {!utilityEvents.length ? <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">No utility alerts from live sources. Awaiting telemetry or resident maintenance reports.</div> : null}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <h2 className="text-sm font-semibold text-white">Infrastructure ownership</h2>
            <div className="mt-4 grid gap-2 text-sm">
              <div className="rounded-xl border border-white/10 bg-black/20 p-3"><span className="text-zinc-500">Estate-wide infrastructure</span><strong className="block text-white">{ownership.estateWide}</strong></div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3"><span className="text-zinc-500">Home-level infrastructure</span><strong className="block text-white">{ownership.homeLevel}</strong></div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3"><span className="text-zinc-500">Shared infrastructure</span><strong className="block text-white">{ownership.shared}</strong></div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <h2 className="text-sm font-semibold text-white">Source integrity</h2>
            <div className="mt-3 space-y-2 text-sm text-zinc-400">
              <p><ShieldCheck className="mr-2 inline h-4 w-4 text-sky-200" />Live readings require telemetry.</p>
              <p>Missing sources show as Awaiting telemetry, not zero.</p>
              <p>Maintenance and alerts remain the current utility event sources.</p>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
