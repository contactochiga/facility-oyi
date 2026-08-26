"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, Camera, ChevronRight, CircleCheck, Clock3, LockKeyhole, Radar, ShieldAlert, ShieldCheck, Siren } from "lucide-react";
import Topbar from "@/components/shell/Topbar";
import FacilityMetricCard from "@/components/ois/FacilityMetricCard";
import Button from "@/components/ui/Button";
import cameraService, { type BoundCamera, type CameraEvent } from "@/services/cameraService";
import { facilityService } from "@/services/facilityService";
import { loadFacilityAttention, type FacilityAttentionItem } from "@/services/facilityAttentionService";
import { notificationService, type AlertItem } from "@/services/notificationService";
import { visitorService } from "@/services/visitorService";
import { getCameraEventOccurrenceTime } from "@/lib/oyi-camera-core/core";

type Incident = { id: string; title?: string; description?: string; severity?: string; status?: string; source?: string; created_at?: string };
const closed = new Set(["closed", "resolved", "completed", "cancelled", "verified"]);
const securityWords = /security|intrusion|unauthori[sz]ed|tailgat|perimeter|panic|camera|surveillance|access|gate|door|badge|credential|lockdown/i;
const normalized = (value: unknown) => String(value || "unknown").toLowerCase();

function relativeTime(value?: string | null) {
  if (!value) return "Timestamp unavailable";
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "Timestamp unavailable";
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

function statusTone(value: unknown) {
  const next = normalized(value);
  if (/critical|emergency|offline|failed|error/.test(next)) return "text-rose-300";
  if (/warning|high|degraded|pending|attention/.test(next)) return "text-amber-300";
  return "text-emerald-300";
}

function Panel({ title, subtitle, action, children }: { title: string; subtitle: string; action?: ReactNode; children: ReactNode }) {
  return <section className="rounded-xl border border-white/[0.075] bg-white/[0.025] p-4 sm:p-[18px]"><header className="flex items-start justify-between gap-4"><div><h2 className="text-[15px] font-semibold tracking-[-0.015em] text-white">{title}</h2><p className="mt-0.5 text-[11.5px] text-zinc-500">{subtitle}</p></div>{action}</header>{children}</section>;
}

function EmptyState({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return <div className="flex min-h-[142px] flex-col items-center justify-center px-4 py-7 text-center"><span className="text-zinc-500">{icon}</span><p className="mt-3 text-[13px] text-zinc-300">{title}</p><p className="mt-1 text-[11.5px] text-zinc-500">{detail}</p></div>;
}

function ActionLink({ href, icon, title, detail }: { href: string; icon: ReactNode; title: string; detail: string }) {
  return <Link href={href} className="group flex min-h-14 items-center gap-3 rounded-lg border border-sky-400/15 bg-sky-500/[0.045] px-3.5 py-3 transition-colors hover:bg-sky-500/[0.075]"><span className="text-sky-300">{icon}</span><span className="min-w-0 flex-1"><span className="block text-[12.5px] font-medium text-zinc-100">{title}</span><span className="mt-0.5 block text-[11px] text-zinc-500">{detail}</span></span><ChevronRight className="h-4 w-4 text-zinc-500 transition-transform group-hover:translate-x-0.5" /></Link>;
}

export default function SecurityAccessPage() {
  const [cameras, setCameras] = useState<BoundCamera[]>([]);
  const [events, setEvents] = useState<Array<CameraEvent & { camera_name?: string }>>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [notifications, setNotifications] = useState<AlertItem[]>([]);
  const [attention, setAttention] = useState<FacilityAttentionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmLockdown, setConfirmLockdown] = useState(false);
  const [lockingDown, setLockingDown] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [overview, incidentResult, unread, attentionRows] = await Promise.all([
        facilityService.overview().catch(() => null), facilityService.platformIncidents().catch(() => ({ items: [] })), notificationService.unread(), loadFacilityAttention(),
      ]);
      setIncidents((incidentResult.items || []) as Incident[]); setNotifications(unread);
      setAttention(attentionRows.filter((item) => item.category === "critical_incident" || item.category === "security_exception" || (item.category === "critical_infrastructure_failure" && /camera|security|access/i.test(`${item.domain} ${item.title} ${item.detail}`))));
      const estateId = overview?.estate_id || "";
      if (!estateId) { setCameras([]); setEvents([]); return; }
      const cameraRows = await cameraService.listByEstate(estateId).then((result) => result.items || []).catch(() => []);
      setCameras(cameraRows);
      const eventRows = await Promise.all(cameraRows.slice(0, 8).map(async (camera) => {
        const result = await cameraService.listEvents(camera.id, { limit: 4, sinceMinutes: 1440 }).catch(() => ({ events: [] }));
        return (result.events || []).map((event: CameraEvent) => ({ ...event, camera_name: camera.name || camera.ip || "Camera" }));
      }));
      setEvents(eventRows.flat().sort((a, b) => new Date(getCameraEventOccurrenceTime(b)).getTime() - new Date(getCameraEventOccurrenceTime(a)).getTime()).slice(0, 5));
    } catch (requestError: any) { setError(requestError?.response?.data?.error || requestError?.message || "Unable to load security operations."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void load();
    const onRealtime = (event: Event) => { const name = String((event as CustomEvent)?.detail?.event || ""); if (/camera|security|incident|notification|access|device|edge/.test(name)) void load(); };
    window.addEventListener("facility:realtime-event", onRealtime);
    return () => window.removeEventListener("facility:realtime-event", onRealtime);
  }, [load]);

  const openIncidents = useMemo(() => incidents.filter((item) => !closed.has(normalized(item.status))), [incidents]);
  const unhealthyCameras = cameras.filter((camera) => /offline|degraded|failed|error/.test(normalized(camera.runtimeState)));
  const camerasOnline = cameras.filter((camera) => normalized(camera.runtimeState) === "online").length;
  const securityAlerts = notifications.filter((item) => securityWords.test(`${item.title} ${item.message} ${item.type || ""}`));
  const criticalCount = attention.filter((item) => item.severity === "critical").length;
  const overallHealth = criticalCount ? "Critical" : attention.length || unhealthyCameras.length ? "Review" : "Stable";

  async function lockdown() {
    setLockingDown(true); setError(null); setNotice(null);
    const result = await visitorService.lockdown("emergency");
    setLockingDown(false); setConfirmLockdown(false);
    if (result.error) setError(result.error); else setNotice(`Emergency lockdown requested. ${"recipients" in result ? result.recipients || 0 : 0} operators notified.`);
  }

  return <div className="space-y-4">
    <Topbar title="Security" subtitle="Cameras, incidents, critical attention and emergency response" />
    <section className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
      <FacilityMetricCard icon={<ShieldAlert />} label="Security alerts" value={loading ? "—" : securityAlerts.length} detail="Active conditions" accent="text-sky-400" />
      <FacilityMetricCard icon={<Siren />} label="Open incidents" value={loading ? "—" : openIncidents.length} detail="Requires review" accent="text-amber-400" />
      <FacilityMetricCard icon={<Camera />} label="Cameras online" value={loading ? "—" : cameras.length ? `${camerasOnline}/${cameras.length}` : 0} detail="Canonical runtime" accent="text-emerald-400" />
      <FacilityMetricCard icon={<AlertTriangle />} label="Critical attention" value={loading ? "—" : criticalCount} detail="Needs action" accent={criticalCount ? "text-rose-400" : "text-zinc-400"} />
      <FacilityMetricCard icon={<ShieldCheck />} label="Security health" value={loading ? "—" : overallHealth} detail="Overall posture" accent={overallHealth === "Stable" ? "text-emerald-400" : overallHealth === "Critical" ? "text-rose-400" : "text-amber-400"} />
    </section>
    {error ? <div role="alert" className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-100">{error}</div> : null}
    {notice ? <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-100">{notice}</div> : null}
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.9fr)]">
      <main className="grid gap-4">
        <Panel title="Security Attention" subtitle="Active security conditions requiring operator awareness" action={<Link href="/facility-intelligence?module=attention" className="text-[11px] text-sky-300">Open attention</Link>}>
          {!loading && !attention.length && !securityAlerts.length ? <EmptyState icon={<ShieldCheck className="h-8 w-8" />} title="No active security alerts" detail="All clear" /> : <div className="mt-3 grid gap-1.5">{[...attention.slice(0, 4), ...securityAlerts.slice(0, Math.max(0, 4 - attention.length)).map((item) => ({ id: `notification:${item.id}`, title: item.title, detail: item.message, severity: "warning", href: "/alerts", time: item.created_at }))].map((item: any) => <Link key={item.id} href={item.href || "/alerts"} className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-black/10 px-3 py-2.5 hover:bg-white/[0.03]"><ShieldAlert className={`h-4 w-4 shrink-0 ${statusTone(item.severity)}`} /><span className="min-w-0 flex-1"><span className="block truncate text-[12px] text-zinc-100">{item.title}</span><span className="mt-0.5 block truncate text-[10.5px] text-zinc-500">{item.detail}</span></span><span className="text-[10.5px] text-zinc-600">{relativeTime(item.time)}</span></Link>)}</div>}
        </Panel>
        <Panel title="Camera Health & Events" subtitle="Live camera status and recent security events" action={<Link href="/cameras" className="text-[11px] text-sky-300">Open camera wall</Link>}>
          {!loading && !cameras.length ? <EmptyState icon={<Camera className="h-8 w-8" />} title="No live camera source configured" detail="Connect cameras through Assets to start monitoring" /> : <div className="mt-3 grid gap-3 lg:grid-cols-[180px_minmax(0,1fr)]"><div className="rounded-lg border border-white/[0.06] bg-black/10 p-3"><p className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">Camera posture</p><p className="mt-2 text-2xl font-semibold tracking-tight text-white">{camerasOnline}<span className="text-sm font-normal text-zinc-500"> / {cameras.length}</span></p><p className="mt-1 text-[11px] text-zinc-500">Online · {unhealthyCameras.length} need review</p></div><div className="space-y-1.5">{events.map((event) => <div key={event.id} className="flex items-center gap-3 rounded-lg border border-white/[0.06] px-3 py-2"><Radar className="h-4 w-4 shrink-0 text-sky-300" /><span className="min-w-0 flex-1"><span className="block truncate text-[11.5px] text-zinc-200">{event.camera_name}</span><span className="block truncate text-[10.5px] text-zinc-500">{String((event as any).eventType || (event as any).event_type || "Camera event").replace(/_/g, " ")}</span></span><span className="text-[10px] text-zinc-600">{relativeTime(getCameraEventOccurrenceTime(event))}</span></div>)}{!events.length ? <p className="rounded-lg border border-dashed border-white/[0.07] p-4 text-center text-[11px] text-zinc-500">No recent camera events</p> : null}</div></div>}
        </Panel>
        <Panel title="Security Incidents" subtitle="Recent incidents and response reviews" action={<Link href="/alerts" className="text-[11px] text-sky-300">Open incidents</Link>}>
          {!loading && !openIncidents.length ? <EmptyState icon={<AlertTriangle className="h-8 w-8" />} title="No incidents reported" detail="All incidents clear" /> : <div className="mt-3 space-y-1.5">{openIncidents.slice(0, 5).map((incident) => <Link href="/alerts" key={incident.id} className="flex items-center gap-3 rounded-lg border border-white/[0.06] px-3 py-2.5 hover:bg-white/[0.03]"><Siren className={`h-4 w-4 ${statusTone(incident.severity)}`} /><span className="min-w-0 flex-1"><span className="block truncate text-[12px] text-zinc-100">{incident.title || "Security incident"}</span><span className="mt-0.5 block text-[10.5px] text-zinc-500">{incident.status || "Open"} · {incident.source || "Facility"}</span></span><span className="text-[10.5px] text-zinc-600">{relativeTime(incident.created_at)}</span></Link>)}</div>}
        </Panel>
      </main>
      <aside className="grid gap-4">
        <Panel title="Emergency Actions" subtitle="High-impact security operations"><div className="mt-4 grid gap-2.5"><button type="button" onClick={() => setConfirmLockdown(true)} className="group flex min-h-[68px] w-full items-center gap-3 rounded-lg border border-rose-400/25 bg-rose-500/[0.07] px-4 py-3 text-left hover:bg-rose-500/10"><LockKeyhole className="h-5 w-5 shrink-0 text-rose-300" /><span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold text-zinc-100">Emergency Lockdown</span><span className="mt-1 block text-[11px] text-zinc-500">Lock down facility and restrict access</span></span><ChevronRight className="h-4 w-4 text-zinc-500" /></button><ActionLink href="/cameras" icon={<Camera className="h-5 w-5" />} title="Open Camera Wall" detail="View live feeds and camera layout" /></div></Panel>
        <Panel title="Quick Actions" subtitle="Security operations"><div className="mt-4 grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => setConfirmLockdown(true)} className="flex min-h-12 items-center gap-2.5 rounded-lg border border-white/[0.07] bg-black/10 px-3 text-left text-[11.5px] text-zinc-200 hover:bg-white/[0.03]"><LockKeyhole className="h-4 w-4 text-rose-300" /> Emergency Lockdown</button><Link href="/cameras" className="flex min-h-12 items-center gap-2.5 rounded-lg border border-white/[0.07] bg-black/10 px-3 text-[11.5px] text-zinc-200 hover:bg-white/[0.03]"><Camera className="h-4 w-4 text-sky-300" /> Open Camera Wall</Link><Link href="/alerts" className="flex min-h-12 items-center gap-2.5 rounded-lg border border-white/[0.07] bg-black/10 px-3 text-[11.5px] text-zinc-200 hover:bg-white/[0.03]"><ShieldAlert className="h-4 w-4 text-cyan-300" /> Report / Review Incident</Link><Link href="/facility-intelligence?module=attention" className="flex min-h-12 items-center gap-2.5 rounded-lg border border-white/[0.07] bg-black/10 px-3 text-[11.5px] text-zinc-200 hover:bg-white/[0.03]"><AlertTriangle className="h-4 w-4 text-amber-300" /> View Attention Lane</Link></div></Panel>
        <Panel title="Attention Lane" subtitle="Critical security attention items">{!loading && !attention.length ? <EmptyState icon={<CircleCheck className="h-7 w-7" />} title="No critical attention required" detail="You’re all caught up" /> : <div className="mt-3 space-y-1.5">{attention.slice(0, 4).map((item) => <Link href={item.href} key={item.id} className="flex items-start gap-2.5 rounded-lg border border-white/[0.06] p-2.5 hover:bg-white/[0.03]"><Clock3 className={`mt-0.5 h-3.5 w-3.5 ${statusTone(item.severity)}`} /><span className="min-w-0"><span className="block truncate text-[11.5px] text-zinc-200">{item.title}</span><span className="mt-0.5 block truncate text-[10px] text-zinc-500">{item.action} · {relativeTime(item.time)}</span></span></Link>)}</div>}</Panel>
      </aside>
    </div>
    {confirmLockdown ? <div role="presentation" className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.currentTarget === event.target) setConfirmLockdown(false); }}><section role="dialog" aria-modal="true" aria-labelledby="lockdown-title" className="w-full max-w-md rounded-xl border border-rose-400/20 bg-[#07111d] p-5 shadow-2xl shadow-black/60"><div className="flex h-10 w-10 items-center justify-center rounded-lg border border-rose-400/20 bg-rose-500/10"><LockKeyhole className="h-5 w-5 text-rose-300" /></div><h2 id="lockdown-title" className="mt-4 text-lg font-semibold tracking-tight text-white">Confirm emergency lockdown</h2><p className="mt-2 text-[12.5px] leading-5 text-zinc-400">This requests emergency visitor-access lockdown and notifies estate operators through the existing governed emergency runtime. Use only during an active security response.</p><footer className="mt-6 flex justify-end gap-2"><Button variant="ghost" disabled={lockingDown} onClick={() => setConfirmLockdown(false)}>Cancel</Button><Button variant="danger" disabled={lockingDown} onClick={() => void lockdown()}>{lockingDown ? "Requesting…" : "Confirm lockdown"}</Button></footer></section></div> : null}
  </div>;
}
