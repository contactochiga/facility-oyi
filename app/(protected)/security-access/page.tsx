"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Camera, DoorOpen, Lock, RefreshCw, ShieldAlert, UserCheck } from "lucide-react";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { facilityService, type InfrastructureOperations } from "@/services/facilityService";
import { visitorService, type VisitorItem } from "@/services/visitorService";
import cameraService, { type BoundCamera, type CameraEvent } from "@/services/cameraService";
import { notificationService, type AlertItem } from "@/services/notificationService";

function status(value: any) {
  return String(value || "unknown").toLowerCase();
}

function when(value?: string | null) {
  if (!value) return "No live timestamp";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "No live timestamp" : date.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function tone(value: string) {
  if (["online", "active", "approved", "entered", "resolved"].includes(value)) return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
  if (["offline", "denied", "critical", "error"].includes(value)) return "border-rose-500/20 bg-rose-500/10 text-rose-200";
  return "border-amber-500/20 bg-amber-500/10 text-amber-100";
}

function Metric({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-[10px] uppercase tracking-[0.17em] text-zinc-500">{label}</p><p className="mt-3 text-2xl font-semibold text-white">{value}</p><p className="mt-2 text-xs text-zinc-500">{hint}</p></div>;
}

export default function SecurityAccessPage() {
  const [visitors, setVisitors] = useState<VisitorItem[]>([]);
  const [cameras, setCameras] = useState<BoundCamera[]>([]);
  const [events, setEvents] = useState<Array<CameraEvent & { camera_name?: string }>>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [infra, setInfra] = useState<InfrastructureOperations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmLockdown, setConfirmLockdown] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [visitorRows, unread, infrastructure] = await Promise.all([
        visitorService.listToday(),
        notificationService.unread(),
        facilityService.infrastructureOperations().catch(() => null),
      ]);
      setVisitors(visitorRows);
      setAlerts(unread);
      setInfra(infrastructure);
      const estateId = infrastructure?.estate?.id || (await facilityService.overview().then((r) => r.estate_id).catch(() => ""));
      if (estateId) {
        const cameraRows = await cameraService.listByEstate(estateId).then((r) => r.items || []).catch(() => []);
        setCameras(cameraRows);
        const eventRows = await Promise.all(cameraRows.slice(0, 8).map(async (camera) => {
          const result = await cameraService.listEvents(camera.id, { limit: 8, sinceMinutes: 24 * 60 }).catch(() => ({ events: [] }));
          return (result.events || []).map((event) => ({ ...event, camera_name: camera.name || camera.ip || "Camera" }));
        }));
        setEvents(eventRows.flat().sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()).slice(0, 20));
      } else {
        setCameras([]);
        setEvents([]);
      }
    } catch (requestError: any) {
      setError(requestError?.response?.data?.error || requestError?.message || "Unable to load security operations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const onRealtime = (event: Event) => {
      const name = (event as CustomEvent)?.detail?.event || "";
      if (/visitor|camera|security|incident|notification|device|edge/.test(name)) void load();
    };
    window.addEventListener("facility:realtime-event", onRealtime);
    return () => window.removeEventListener("facility:realtime-event", onRealtime);
  }, [load]);

  const activeVisitors = visitors.filter((v) => ["approved", "entered", "active"].includes(status(v.status)));
  const pendingVisitors = visitors.filter((v) => status(v.status) === "pending");
  const unhealthyCameras = cameras.filter((camera) => ["offline", "error", "degraded"].includes(status(camera.status || camera.health_status || camera.stream_status)));
  const anomalies = useMemo(() => [...(infra?.telemetry || []), ...alerts.slice(0, 6).map((alert) => ({ id: alert.id, affected: alert.title, domain: "alert", action: alert.message, time: alert.created_at }))].slice(0, 8), [infra, alerts]);

  async function lockdown() {
    setNotice(null);
    const result = await visitorService.lockdown("emergency");
    setConfirmLockdown(false);
    if (result.error) setError(result.error);
    else setNotice(`Emergency lockdown requested. ${"recipients" in result ? result.recipients || 0 : 0} operators notified.`);
  }

  return (
    <div className="space-y-6">
      <Topbar title="Security & Access" subtitle="Visitors, gates, cameras, incidents, and emergency response." rightSlot={<Button variant="ghost" onClick={() => void load()} disabled={loading} className="gap-2"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh</Button>} />

      <section className="rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(239,68,68,0.13),transparent_32%),linear-gradient(145deg,rgba(255,255,255,0.055),rgba(255,255,255,0.018))] p-5">
        <p className="text-[10px] uppercase tracking-[0.18em] text-rose-200">Safety runtime</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Operational security command center</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">Coordinate resident access, visitor verification, camera posture, and incident attention from real estate sources.</p>
      </section>

      {error ? <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}
      {notice ? <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{notice}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="Active visitors" value={loading ? "Loading" : activeVisitors.length} hint="Approved, entered, or active today" />
        <Metric label="Pending approval" value={loading ? "Loading" : pendingVisitors.length} hint="Visitors needing gate review" />
        <Metric label="Camera health" value={loading ? "Loading" : `${Math.max(0, cameras.length - unhealthyCameras.length)}/${cameras.length}`} hint={cameras.length ? "Healthy / total cameras" : "No live camera source configured"} />
        <Metric label="Recent incidents" value={loading ? "Loading" : alerts.length + events.length} hint="Notifications plus camera events" />
        <Metric label="Access anomalies" value={loading ? "Loading" : anomalies.length} hint="Security, provider, device, or Edge attention" />
        <Metric label="Realtime" value={infra?.sources?.realtime?.available ? "Ready" : "Polling"} hint="Socket bridge with polling fallback" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold text-white">Visitor verification queue</h2><Link href="/visitors" className="text-xs text-sky-200">Open visitor queue</Link></div>
            <div className="mt-4 space-y-2">{pendingVisitors.slice(0, 6).map((visitor) => <Link key={visitor.id} href="/visitors" className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/15 px-3 py-3"><UserCheck className="h-4 w-4 text-sky-200" /><span className="min-w-0 flex-1"><span className="block truncate text-sm text-white">{visitor.visitor_name}</span><span className="text-xs text-zinc-500">{visitor.purpose || "Visitor"} · expires {when(visitor.expires_at)}</span></span><span className={`rounded-full border px-2 py-1 text-[10px] ${tone(status(visitor.status))}`}>{visitor.status}</span></Link>)}{!pendingVisitors.length && !loading ? <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">No pending visitor approvals.</p> : null}</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold text-white">Camera health and recent events</h2><Link href="/cameras" className="text-xs text-sky-200">Open camera wall</Link></div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">{cameras.slice(0, 6).map((camera) => <article key={camera.id} className="rounded-xl border border-white/10 bg-black/15 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-medium text-white">{camera.name || camera.ip || "Camera"}</h3><p className="mt-1 text-xs text-zinc-500">{camera.ip || "IP unavailable"} · {when(camera.last_seen_at)}</p></div><span className={`rounded-full border px-2 py-1 text-[10px] ${tone(status(camera.status || camera.health_status || camera.stream_status))}`}>{camera.status || camera.health_status || "unknown"}</span></div></article>)}{!cameras.length && !loading ? <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">No live camera source configured.</p> : null}</div>
          </div>
        </div>

        <aside className="space-y-5">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><h2 className="text-sm font-semibold text-white">Emergency actions</h2><p className="mt-1 text-xs leading-5 text-zinc-500">High-impact security actions require confirmation and backend support.</p><Button variant="danger" onClick={() => setConfirmLockdown(true)} className="mt-4 w-full gap-2"><Lock className="h-4 w-4" /> Emergency lockdown</Button><p className="mt-3 text-xs text-zinc-500">Lockdown sends operator notifications through the existing visitor operations endpoint.</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><h2 className="text-sm font-semibold text-white">Quick routes</h2><div className="mt-4 grid gap-2">{[["Verify visitor", "/visitors", DoorOpen], ["Open camera wall", "/cameras", Camera], ["Report / review incident", "/alerts", ShieldAlert], ["View gate flow", "/traffic", AlertTriangle]].map(([label, href, Icon]) => <Link key={String(label)} href={String(href)} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-sm text-zinc-300 hover:text-white"><Icon className="h-4 w-4 text-sky-200" /> <span>{String(label)}</span></Link>)}</div></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><h2 className="text-sm font-semibold text-white">Attention lane</h2><div className="mt-4 space-y-2">{anomalies.map((item: any) => <div key={item.id} className="rounded-xl border border-white/10 bg-black/15 px-3 py-3"><p className="text-sm text-white">{item.affected || item.title || "Security item"}</p><p className="mt-1 text-xs text-zinc-500">{item.domain || "security"} · {when(item.time || item.created_at)}</p><p className="mt-1 text-xs text-zinc-400">{item.action || item.message || "Review item"}</p></div>)}{!anomalies.length && !loading ? <p className="rounded-xl border border-dashed border-white/10 p-3 text-sm text-zinc-500">No critical attention required.</p> : null}</div></div>
        </aside>
      </section>

      {confirmLockdown ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm"><section className="w-full max-w-lg rounded-2xl border border-rose-500/20 bg-zinc-950 p-5"><h2 className="text-lg font-semibold text-white">Confirm emergency lockdown</h2><p className="mt-2 text-sm leading-6 text-zinc-400">This requests emergency visitor-access lockdown and notifies estate operators. Use only when the security desk is actively responding.</p><footer className="mt-6 flex justify-end gap-2"><Button variant="ghost" onClick={() => setConfirmLockdown(false)}>Cancel</Button><Button variant="danger" onClick={() => void lockdown()}>Confirm lockdown</Button></footer></section></div> : null}
    </div>
  );
}
