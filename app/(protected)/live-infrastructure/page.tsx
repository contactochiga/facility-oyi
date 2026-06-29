"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Camera, ChevronRight, Cpu, Layers3, MapPinned, RadioTower, RefreshCw, ShieldAlert, Wrench, Zap } from "lucide-react";
import { OisPageToolbar } from "@/components/ois";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { facilityService, type InfrastructureOperations } from "@/services/facilityService";
import cameraService, { type BoundCamera } from "@/services/cameraService";
import { maintenanceService, type MaintenanceItem } from "@/services/maintenanceService";

function text(value: any, fallback = "Unavailable") {
  const next = String(value ?? "").trim();
  return next || fallback;
}

function lower(value: any) {
  return String(value ?? "").toLowerCase();
}

function sourceText(status: "loading" | "ready" | "error", ready: string, fallback = "Pending source") {
  if (status === "loading") return "Loading source";
  if (status === "error") return fallback;
  return ready;
}

function tone(value: string) {
  const next = lower(value);
  if (/online|available|healthy|source|configured|stable/.test(next)) return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
  if (/offline|error|failed|attention|unavailable/.test(next)) return "border-rose-500/20 bg-rose-500/10 text-rose-200";
  return "border-amber-500/20 bg-amber-500/10 text-amber-100";
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><h2 className="text-sm font-semibold text-white">{title}</h2>{subtitle ? <p className="mt-1 text-xs leading-5 text-zinc-500">{subtitle}</p> : null}<div className="mt-4">{children}</div></section>;
}

function Status({ value }: { value: string }) {
  return <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.12em] ${tone(value)}`}>{value}</span>;
}

function openMaintenance(item: MaintenanceItem) {
  return !/closed|completed|resolved|cancelled/.test(lower(item.status));
}

export default function LiveInfrastructureModule() {
  const [infra, setInfra] = useState<InfrastructureOperations | null>(null);
  const [cameras, setCameras] = useState<BoundCamera[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceItem[]>([]);
  const [estateName, setEstateName] = useState("Live Infrastructure");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const estates = await facilityService.myEstates().catch(() => ({ estates: [] }));
      const estate = estates.estates?.[0];
      setEstateName(estate?.name || "Live Infrastructure");
      const [operations, cams, requests] = await Promise.all([
        facilityService.infrastructureOperations(),
        estate?.id ? cameraService.listByEstate(String(estate.id)).then((res) => res.items || []).catch(() => []) : Promise.resolve([]),
        maintenanceService.list().catch(() => []),
      ]);
      setInfra(operations);
      setCameras(cams);
      setMaintenance(requests);
      setStatus("ready");
    } catch (requestError: any) {
      setError(requestError?.response?.data?.error || requestError?.message || "Backend unavailable");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
    const onRealtime = (event: Event) => {
      const name = (event as CustomEvent)?.detail?.event || "";
      if (/device|edge|camera|maintenance|incident|notification|audit/.test(name)) void load();
    };
    window.addEventListener("facility:realtime-event", onRealtime);
    return () => window.removeEventListener("facility:realtime-event", onRealtime);
  }, [load]);

  const registry = infra?.registry || [];
  const edgeNodes = infra?.edge_nodes || [];
  const telemetry = infra?.telemetry || [];
  const offlineDevices = registry.filter((device) => /offline|error|unavailable/.test(lower(device.status)));
  const cameraAttention = cameras.filter((camera) => /offline|error|degraded|unavailable|unknown/.test(lower(camera.health_status || camera.stream_status || camera.status)));
  const edgeAttention = edgeNodes.filter((node) => /offline|degraded|unreachable|failed|unknown/.test(lower(node.status || node.sync_status)));
  const openRequests = maintenance.filter(openMaintenance);

  const attention = useMemo(() => [
    ...offlineDevices.map((device) => ({ domain: "Device", label: text(device.name), status: text(device.status, "attention"), href: "/hardware-devices" })),
    ...cameraAttention.map((camera) => ({ domain: "Camera", label: text(camera.name || camera.ip), status: text(camera.health_status || camera.stream_status || camera.status, "attention"), href: "/cameras" })),
    ...edgeAttention.map((node) => ({ domain: "Oyi Edge", label: text(node.name || node.node_id), status: text(node.status || node.sync_status, "attention"), href: "/hardware-devices?tab=edge" })),
    ...openRequests.map((item) => ({ domain: "Maintenance", label: text(item.title), status: text(item.status), href: "/maintenance" })),
  ].slice(0, 12), [offlineDevices, cameraAttention, edgeAttention, openRequests]);

  return (
    <div className="space-y-6">
      <Topbar title="Live Infrastructure" subtitle="Realtime estate operations" strip={[{ label: "Status", value: status === "error" ? "Degraded" : status === "ready" ? "Live" : "Loading" }, { label: "Attention", value: attention.length }, { label: "Health", value: attention.length ? "Review" : "Stable" }, { label: "Action", value: "Open infrastructure" }]} rightSlot={<Button variant="ghost" onClick={() => void load()} disabled={status === "loading"} className="gap-2"><RefreshCw className={`h-4 w-4 ${status === "loading" ? "animate-spin" : ""}`} />Refresh</Button>} />
      <OisPageToolbar onRefresh={() => void load()} refreshing={status === "loading"} searchPlaceholder="Live infrastructure routes operations into active Facility registries and work surfaces." />
      {error ? <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">{error}</p> : null}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel title={`Operational Routes${estateName ? ` · ${estateName}` : ""}`} subtitle="No dead canvas modes. Each route opens a real Facility workflow.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[
              ["Estate Command Center", "/digital-twin", MapPinned, "Digital Twin and spatial operations"],
              ["Infrastructure Layers", "/digital-twin?layer=infrastructure", Layers3, "Power, water, network, environmental, and security readiness"],
              ["Device Registry", "/hardware-devices", Cpu, "Registry, discovery, assignment, provider sync, telemetry"],
              ["Oyi Edge", "/hardware-devices?tab=edge", RadioTower, "Heartbeat, queue, runtime and sync posture"],
              ["Camera Center", "/cameras", Camera, "Camera registry, stream readiness and events"],
              ["Incidents & Alerts", "/alerts", ShieldAlert, "Security, device, utility and operational incidents"],
              ["Utilities", "/utilities", Zap, "Power, water, network and environmental source states"],
              ["Maintenance", "/maintenance", Wrench, "Location-backed maintenance work orders"],
            ].map(([label, href, Icon, body]) => (
              <Link key={String(label)} href={String(href)} className="rounded-2xl border border-white/10 bg-black/15 p-4 transition hover:border-sky-400/25 hover:bg-white/[0.045]">
                <div className="flex items-start justify-between gap-3">
                  <Icon className="h-5 w-5 text-sky-200" />
                  <ChevronRight className="h-4 w-4 text-zinc-600" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-white">{String(label)}</h3>
                <p className="mt-2 text-xs leading-5 text-zinc-500">{String(body)}</p>
              </Link>
            ))}
          </div>
        </Panel>

        <Panel title="Infrastructure Attention" subtitle="Real source items requiring operator review.">
          <div className="space-y-2">
            {attention.map((item, index) => <Link key={`${item.domain}-${item.label}-${index}`} href={item.href} className="block rounded-xl border border-white/10 bg-black/15 p-3 transition hover:border-sky-400/25"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{item.domain}</p><p className="mt-1 text-sm text-white">{item.label}</p></div><Status value={item.status} /></div></Link>)}
            {!attention.length ? <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">No critical infrastructure attention required from loaded sources.</div> : null}
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <Panel title="Source Integrity" subtitle="Unavailable telemetry stays visible instead of becoming synthetic zeroes.">
          <div className="space-y-2 text-sm text-zinc-400">
            <p>Device registry: {status === "ready" ? `${registry.length} entries` : sourceText(status, "Pending source", "Backend unavailable")}</p>
            <p>Telemetry events: {status === "ready" ? `${telemetry.length} signals` : sourceText(status, "Awaiting telemetry", "Backend unavailable")}</p>
            <p>Camera source: {status === "ready" ? `${cameras.length} bound cameras` : "No live source ready"}</p>
            <p>Edge source: {status === "ready" ? `${edgeNodes.length} nodes` : "Awaiting live source"}</p>
          </div>
        </Panel>
        <Panel title="Realtime Bridge" subtitle="Live subscriptions supplement polling fallback.">
          <div className="space-y-2 text-sm text-zinc-400">
            <p>device.status.updated</p>
            <p>device.registry.updated</p>
            <p>device.discovered</p>
            <p>edge.heartbeat</p>
            <p>maintenance.updated</p>
            <p>notification:new</p>
            <p>audit.recorded</p>
          </div>
        </Panel>
        <Panel title="Model Readiness" subtitle="Future Plan Studio and renderer integration.">
          <div className="space-y-2 text-sm text-zinc-400">
            <p>GLB model ingestion: Plan Studio Not Configured</p>
            <p>CAD imports: Plan Studio Not Configured</p>
            <p>Estate plans: Awaiting Twin source</p>
            <p>Render engine: Render unavailable until backend source exists</p>
          </div>
        </Panel>
      </section>
    </div>
  );
}
