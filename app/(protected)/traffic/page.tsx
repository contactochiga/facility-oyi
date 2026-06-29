"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DoorOpen } from "lucide-react";
import { OisListItem, OisRegistryHeader } from "@/components/ois";
import Topbar from "@/components/shell/Topbar";
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
      <Topbar title="Gate Flow Intelligence" subtitle="Movement and access telemetry" strip={[{ label: "Entries", value: loading ? "Loading" : entries }, { label: "Active", value: loading ? "Loading" : Math.max(0, entries - exits) }, { label: "Pending", value: loading ? "Loading" : pending }, { label: "Devices", value: loading ? "Loading" : `${onlineAccess}/${accessDevices.length}` }, { label: "Health", value: pending || !accessDevices.length ? "Review" : "Stable" }]} />
      {error ? <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <OisRegistryHeader title="Gate Flow Activity" caption={loading ? "Loading records" : `${gateRows.length} records`} />
          <div className="mt-4 space-y-2">{gateRows.map((row) => <OisListItem key={row.id} icon={<DoorOpen className="h-4 w-4 text-sky-200" />} title={row.title} description={row.detail} meta={when(row.time)} status={row.status === "pending" ? "pending" : row.status === "exited" ? "completed" : "stable"} />)}{!gateRows.length && !loading ? <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">No gate movement recorded today.</p> : null}</div>
        </div>
        <aside className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <OisRegistryHeader title="Gate telemetry source" caption={loading ? "Loading records" : `${accessDevices.length} records`} />
          <p className="mt-2 text-sm leading-6 text-zinc-400">{accessDevices.length ? "Access devices are present in the infrastructure registry. Dedicated throughput counters will appear when gate hardware emits movement telemetry." : "Awaiting gate telemetry. Add access hardware or Edge events to enable live movement source."}</p>
          <div className="mt-4 space-y-2">{accessDevices.slice(0, 8).map((device) => <div key={device.id} className="rounded-xl border border-white/10 bg-black/15 px-3 py-3"><p className="text-sm text-white">{device.name}</p><p className="mt-1 text-xs text-zinc-500">{device.provider} · {device.status} · {device.home?.name || "Estate"}</p></div>)}</div>
        </aside>
      </section>
    </div>
  );
}
