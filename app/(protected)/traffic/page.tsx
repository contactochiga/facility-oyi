"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Car, Clock, DoorOpen, RefreshCw, Route, ShieldAlert } from "lucide-react";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { visitorService, type VisitorItem } from "@/services/visitorService";
import { facilityService, type InfrastructureDevice } from "@/services/facilityService";

function lower(value: any) {
  return String(value ?? "").toLowerCase();
}

function when(value?: string | null) {
  if (!value) return "No live timestamp";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "No live timestamp" : date.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function Metric({ label, value, hint, icon: Icon }: { label: string; value: string | number; hint: string; icon: typeof Car }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[0.17em] text-zinc-500">{label}</p><p className="mt-3 text-2xl font-semibold text-white">{value}</p><p className="mt-2 text-xs text-zinc-500">{hint}</p></div><Icon className="h-5 w-5 text-sky-200" /></div></div>;
}

export default function TrafficPage() {
  const [visitors, setVisitors] = useState<VisitorItem[]>([]);
  const [devices, setDevices] = useState<InfrastructureDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [visitorRows, infra] = await Promise.all([
        visitorService.listToday(),
        facilityService.infrastructureOperations().catch(() => null),
      ]);
      setVisitors(visitorRows);
      setDevices(infra?.registry || []);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.error || requestError?.message || "Unable to load gate movement.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const onRealtime = (event: Event) => {
      const name = (event as CustomEvent)?.detail?.event || "";
      if (/visitor|gate|access|device|edge/.test(name)) void load();
    };
    window.addEventListener("facility:realtime-event", onRealtime);
    return () => window.removeEventListener("facility:realtime-event", onRealtime);
  }, [load]);

  const entries = visitors.filter((visitor) => ["approved", "entered", "active"].includes(lower(visitor.status))).length;
  const exits = visitors.filter((visitor) => lower(visitor.status) === "exited").length;
  const pending = visitors.filter((visitor) => lower(visitor.status) === "pending").length;
  const accessDevices = devices.filter((device) => /gate|access|lock|barrier|door/.test(`${lower(device.name)} ${lower(device.type)} ${lower(device.category)}`));
  const onlineAccess = accessDevices.filter((device) => ["online", "active"].includes(lower(device.status))).length;
  const gateRows = useMemo(() => {
    const rows = visitors.slice().sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()).slice(0, 30);
    return rows.map((visitor) => ({
      id: visitor.id,
      title: visitor.visitor_name,
      status: lower(visitor.status),
      detail: `${visitor.purpose || "Visitor"} · ${visitor.access_code || "No code"}`,
      time: visitor.created_at,
    }));
  }, [visitors]);

  return (
    <div className="space-y-6">
      <Topbar title="Traffic & Gate Flow" subtitle="Visitor movement, access actions, and gate telemetry readiness." rightSlot={<Button variant="ghost" onClick={() => void load()} disabled={loading} className="gap-2"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh</Button>} />
      {error ? <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Entries today" value={loading ? "Loading" : entries} hint="Approved, active, or entered visitors" icon={DoorOpen} />
        <Metric label="Exits today" value={exits} hint="Visitors marked exited" icon={Route} />
        <Metric label="Active visitors" value={Math.max(0, entries - exits)} hint="Estimated from visitor lifecycle" icon={Car} />
        <Metric label="Pending gate actions" value={pending} hint="Visitors awaiting verification" icon={ShieldAlert} />
        <Metric label="Access devices" value={`${onlineAccess}/${accessDevices.length}`} hint={accessDevices.length ? "Online / total access devices" : "Awaiting gate telemetry"} icon={Clock} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <h2 className="text-sm font-semibold text-white">Recent gate events</h2>
          <p className="mt-1 text-xs text-zinc-500">Derived from visitor lifecycle until dedicated gate telemetry is connected.</p>
          <div className="mt-4 space-y-2">{gateRows.map((row) => <div key={row.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/15 px-3 py-3"><DoorOpen className="h-4 w-4 text-sky-200" /><span className="min-w-0 flex-1"><span className="block truncate text-sm text-white">{row.title}</span><span className="text-xs text-zinc-500">{row.detail} · {when(row.time)}</span></span><span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase text-zinc-300">{row.status}</span></div>)}{!gateRows.length && !loading ? <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">No gate movement recorded today.</p> : null}</div>
        </div>
        <aside className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <h2 className="text-sm font-semibold text-white">Gate telemetry source</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">{accessDevices.length ? "Access devices are present in the infrastructure registry. Dedicated throughput counters will appear when gate hardware emits movement telemetry." : "Awaiting gate telemetry. Add access hardware or Edge events to enable live movement source."}</p>
          <div className="mt-4 space-y-2">{accessDevices.slice(0, 8).map((device) => <div key={device.id} className="rounded-xl border border-white/10 bg-black/15 px-3 py-3"><p className="text-sm text-white">{device.name}</p><p className="mt-1 text-xs text-zinc-500">{device.provider} · {device.status} · {device.home?.name || "Estate"}</p></div>)}</div>
        </aside>
      </section>
    </div>
  );
}
