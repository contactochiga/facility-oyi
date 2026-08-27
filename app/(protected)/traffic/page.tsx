"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Clock3, DoorOpen, KeyRound, ListChecks, ShieldCheck, Users } from "lucide-react";
import AccessVisitorsView from "@/components/access/AccessVisitorsView";
import FacilityMetricCard from "@/components/ois/FacilityMetricCard";
import OisCard from "@/components/ois/OisCard";
import OisStatusBadge from "@/components/ois/OisStatusBadge";
import Topbar from "@/components/shell/Topbar";
import { visitorService, type VisitorItem } from "@/services/visitorService";
import { facilityService, type InfrastructureDevice } from "@/services/facilityService";

type Tab = "dashboard" | "visitors" | "access-points" | "gate-control" | "access-logs";
const tabs: Array<{ key: Tab; label: string }> = [
  { key: "dashboard", label: "Dashboard" }, { key: "visitors", label: "Visitors" },
  { key: "access-points", label: "Access Points" }, { key: "gate-control", label: "Gate Control" }, { key: "access-logs", label: "Access Logs" },
];

function lower(value: unknown) { return String(value ?? "").toLowerCase(); }
function status(visitor: VisitorItem) { return lower(visitor.status || "pending"); }
function dateValue(value?: string | null) { const time = value ? new Date(value).getTime() : Number.NaN; return Number.isFinite(time) ? time : 0; }
function when(value?: string | null) { if (!value) return "Timestamp unavailable"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "Timestamp unavailable" : date.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }); }
function isAccessDevice(device: InfrastructureDevice) { return /gate|access|lock|barrier|door|reader|credential/.test(`${lower(device.name)} ${lower(device.type)} ${lower(device.category)} ${lower(device.device_family)}`); }
function deviceState(device: InfrastructureDevice) { return lower(device.primary_state || device.health_status || device.status || "unknown"); }
function tone(value: string) { if (/denied|expired|offline|failed|error/.test(value)) return "critical"; if (/pending|unknown|degraded/.test(value)) return "pending"; if (/exited|completed/.test(value)) return "completed"; return "stable"; }
function activeVisitor(visitor: VisitorItem) { return ["entered", "active"].includes(status(visitor)); }
function attentionVisitor(visitor: VisitorItem) { return ["pending", "denied", "expired"].includes(status(visitor)) || Boolean(visitor.expires_at && dateValue(visitor.expires_at) < Date.now() && status(visitor) !== "exited"); }

function Panel({ title, caption, children }: { title: string; caption: string; children: React.ReactNode }) {
  return <OisCard className="p-4"><h2 className="text-[14px] font-semibold text-white">{title}</h2><p className="mt-0.5 text-[10.5px] text-zinc-500">{caption}</p>{children}</OisCard>;
}

function VisitorRows({ rows, homeLabels, onReview }: { rows: VisitorItem[]; homeLabels: Map<string, string>; onReview: (visitor: VisitorItem) => void }) {
  return <><div className="mt-3 hidden overflow-x-auto md:block"><table className="w-full min-w-[760px] text-left"><thead className="text-[8.5px] uppercase tracking-[.09em] text-zinc-600"><tr><th className="pb-2.5">Person</th><th>Access point</th><th>Method</th><th>Time</th><th>Status</th><th>Action</th></tr></thead><tbody className="divide-y divide-[var(--ois-border-subtle)]">{rows.map(visitor => <tr key={visitor.id} className="text-[10px] text-zinc-400"><td className="py-2.5 pr-3"><b className="block font-medium text-zinc-100">{visitor.visitor_name}</b><small className="text-[8.5px] text-zinc-600">Visitor · {visitor.home_id ? homeLabels.get(visitor.home_id) || "Home assigned" : visitor.purpose || "No host recorded"}</small></td><td>Not recorded</td><td>{visitor.access_code && visitor.access_code !== "—" ? "Access code" : "Unavailable"}</td><td>{when(visitor.created_at)}</td><td><OisStatusBadge status={tone(status(visitor)) as any} label={status(visitor)} /></td><td><button type="button" onClick={() => onReview(visitor)} className="text-sky-300">Review</button></td></tr>)}</tbody></table></div><div className="mt-3 divide-y divide-[var(--ois-border-subtle)] md:hidden">{rows.map(visitor => <button type="button" onClick={() => onReview(visitor)} key={visitor.id} className="flex w-full items-center gap-3 py-3 text-left"><span className="grid h-8 w-8 place-items-center rounded-md bg-white/[.035] text-sky-300"><Users className="h-3.5 w-3.5"/></span><span className="min-w-0 flex-1"><b className="block truncate text-[10.5px] text-zinc-100">{visitor.visitor_name}</b><small className="block truncate text-[8.5px] text-zinc-600">{visitor.purpose || "Visitor"} · {when(visitor.created_at)}</small></span><OisStatusBadge status={tone(status(visitor)) as any} label={status(visitor)} /></button>)}</div>{!rows.length ? <p className="py-10 text-center text-[10.5px] text-zinc-600">No access activity recorded.</p> : null}</>;
}

export default function TrafficPage() {
  const [todayVisitors, setTodayVisitors] = useState<VisitorItem[]>([]);
  const [allVisitors, setAllVisitors] = useState<VisitorItem[]>([]);
  const [devices, setDevices] = useState<InfrastructureDevice[]>([]);
  const [homes, setHomes] = useState<Array<Record<string, any>>>([]);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [focusVisitorId, setFocusVisitorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [today, visitors, infrastructure] = await Promise.all([visitorService.listToday(), visitorService.list({ today: false }), facilityService.infrastructureOperations().catch(() => null)]);
      setTodayVisitors(today); setAllVisitors(visitors); setDevices(infrastructure?.registry || []); setHomes(infrastructure?.homes || []);
    } catch (requestError: any) { setError(requestError?.response?.data?.error || requestError?.message || "Unable to load Access operations."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); const listener = (event: Event) => { const name = String((event as CustomEvent)?.detail?.event || ""); if (/visitor|gate|access|device|edge/.test(name)) void load(); }; window.addEventListener("facility:realtime-event", listener); return () => window.removeEventListener("facility:realtime-event", listener); }, [load]);
  useEffect(() => { const applyLocation = () => { const view = new URLSearchParams(window.location.search).get("view"); if (tabs.some(item => item.key === view)) setTab(view as Tab); }; applyLocation(); window.addEventListener("popstate", applyLocation); return () => window.removeEventListener("popstate", applyLocation); }, []);

  function activateTab(next: Tab) { setTab(next); setFocusVisitorId(null); const url = next === "dashboard" ? "/traffic" : `/traffic?view=${next}`; window.history.pushState({}, "", url); }
  function openVisitor(visitor: VisitorItem) { setFocusVisitorId(visitor.id); setTab("visitors"); window.history.pushState({}, "", "/traffic?view=visitors"); }

  const accessPoints = useMemo(() => devices.filter(isAccessDevice), [devices]);
  const homeLabels = useMemo(() => new Map(homes.map(home => [String(home.id), String(home.name || [home.block, home.unit].filter(Boolean).join(" / ") || "Home assigned")])), [homes]);
  const active = todayVisitors.filter(activeVisitor);
  const preApproved = allVisitors.filter(visitor => status(visitor) === "approved" && (!visitor.expires_at || dateValue(visitor.expires_at) >= Date.now()));
  const attention = todayVisitors.filter(attentionVisitor);
  const recent = todayVisitors.slice().sort((a, b) => dateValue(b.created_at) - dateValue(a.created_at)).slice(0, 8);
  const upcoming = allVisitors.filter(visitor => ["approved", "pending"].includes(status(visitor)) && (!visitor.expires_at || dateValue(visitor.expires_at) >= Date.now())).sort((a, b) => dateValue(a.expires_at) - dateValue(b.expires_at)).slice(0, 6);
  const onlinePoints = accessPoints.filter(device => /online|active|healthy|connected/.test(deviceState(device))).length;

  return <div className="space-y-3.5 pb-6">
    <Topbar title="Access" subtitle="Access control, visitors, gates and entry management" />
    <section className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6"><FacilityMetricCard icon={<Users/>} label="Visitors today" value={loading ? "—" : todayVisitors.length} detail="Recorded activity" accent="text-sky-400"/><FacilityMetricCard icon={<CheckCircle2/>} label="Active visitors" value={loading ? "—" : active.length} detail="Currently entered" accent="text-emerald-400"/><FacilityMetricCard icon={<Clock3/>} label="Pre-approved" value={loading ? "—" : preApproved.length} detail="Scheduled access" accent="text-amber-400"/><FacilityMetricCard icon={<DoorOpen/>} label="Access points" value={loading ? "—" : accessPoints.length} detail={`${onlinePoints} operational`} accent="text-emerald-400"/><FacilityMetricCard icon={<Activity/>} label="Access events" value={loading ? "—" : todayVisitors.length} detail="Today’s records" accent="text-violet-400"/><FacilityMetricCard icon={<AlertTriangle/>} label="Attention" value={loading ? "—" : attention.length} detail="Requires review" accent={attention.length ? "text-rose-400" : "text-zinc-400"}/></section>
    {error ? <div role="alert" className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</div> : null}
    <nav className="flex gap-5 overflow-x-auto border-b border-[var(--ois-border-subtle)] px-1">{tabs.map(item => <button key={item.key} type="button" onClick={() => activateTab(item.key)} className={`relative shrink-0 pb-2.5 text-[10px] ${tab === item.key ? "text-sky-200 after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-sky-400" : "text-zinc-500 hover:text-white"}`}>{item.label}</button>)}</nav>

    {tab === "dashboard" ? <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]"><main className="grid gap-4"><Panel title="Live Access Overview" caption="Real-time access activity across the facility"><VisitorRows rows={recent} homeLabels={homeLabels} onReview={openVisitor}/></Panel><Panel title="Upcoming Visits" caption="Scheduled and pre-approved visits"><div className="mt-3 hidden overflow-x-auto md:block"><table className="w-full min-w-[760px] text-left"><thead className="text-[8.5px] uppercase tracking-[.09em] text-zinc-600"><tr><th className="pb-2.5">Visitor</th><th>Purpose</th><th>Host / unit</th><th>Schedule</th><th>Access point</th><th>Status</th><th>Action</th></tr></thead><tbody className="divide-y divide-[var(--ois-border-subtle)]">{upcoming.map(visitor => <tr key={visitor.id} className="text-[10px] text-zinc-400"><td className="py-2.5 font-medium text-zinc-100">{visitor.visitor_name}</td><td>{visitor.purpose || "Not recorded"}</td><td>{visitor.home_id ? homeLabels.get(visitor.home_id) || "Home assigned" : "Not assigned"}</td><td>{when(visitor.expires_at)}</td><td>Not assigned</td><td><OisStatusBadge status={tone(status(visitor)) as any} label={status(visitor)}/></td><td><button type="button" onClick={() => openVisitor(visitor)} className="text-sky-300">Review</button></td></tr>)}</tbody></table></div><div className="mt-3 divide-y divide-[var(--ois-border-subtle)] md:hidden">{upcoming.map(visitor => <button type="button" onClick={() => openVisitor(visitor)} key={visitor.id} className="block w-full py-3 text-left"><b className="text-[10.5px] text-zinc-100">{visitor.visitor_name}</b><small className="block text-[8.5px] text-zinc-600">{visitor.purpose || "Visit"} · {when(visitor.expires_at)}</small></button>)}</div>{!upcoming.length ? <p className="py-10 text-center text-[10.5px] text-zinc-600">No upcoming visits.</p> : null}</Panel></main><aside className="grid gap-4"><Panel title="Gate Status" caption="All access points and their current status"><div className="mt-3 space-y-1.5">{accessPoints.slice(0, 8).map(device => <div key={device.id} className="flex items-center gap-2 rounded-lg border border-[var(--ois-border-subtle)] px-3 py-2.5"><DoorOpen className="h-3.5 w-3.5 text-sky-300"/><span className="min-w-0 flex-1"><b className="block truncate text-[10.5px] font-medium text-zinc-200">{device.name}</b><small className="text-[8.5px] text-zinc-600">{device.device_type || device.category || "Access point"}</small></span><OisStatusBadge status={tone(deviceState(device)) as any} label={deviceState(device)}/></div>)}{!accessPoints.length ? <p className="py-8 text-center text-[10.5px] text-zinc-600">No access points configured.</p> : null}</div></Panel><Panel title="Access Methods" caption="Credential usage from canonical access records"><div className="py-8 text-center"><KeyRound className="mx-auto h-5 w-5 text-zinc-700"/><p className="mt-2 text-[10.5px] text-zinc-500">Access-method aggregation unavailable</p><small className="text-[8.5px] text-zinc-600">Visitor records do not expose a method field.</small></div></Panel><Panel title="Quick Actions" caption="Common access operations"><div className="mt-3 grid grid-cols-2 gap-1.5"><button type="button" onClick={() => { activateTab("visitors"); setVerifyOpen(true); }} className="flex h-10 items-center gap-2 rounded-lg border border-[var(--ois-border-subtle)] px-2.5 text-[9.5px] text-zinc-300"><KeyRound className="h-3.5 w-3.5 text-sky-300"/>Verify visitor</button><button type="button" onClick={() => activateTab("visitors")} className="flex h-10 items-center gap-2 rounded-lg border border-[var(--ois-border-subtle)] px-2.5 text-[9.5px] text-zinc-300"><Users className="h-3.5 w-3.5 text-sky-300"/>All visitors</button><button type="button" onClick={() => activateTab("access-logs")} className="flex h-10 items-center gap-2 rounded-lg border border-[var(--ois-border-subtle)] px-2.5 text-[9.5px] text-zinc-300"><ListChecks className="h-3.5 w-3.5 text-sky-300"/>Access logs</button><button type="button" onClick={() => activateTab("access-points")} className="flex h-10 items-center gap-2 rounded-lg border border-[var(--ois-border-subtle)] px-2.5 text-[9.5px] text-zinc-300"><DoorOpen className="h-3.5 w-3.5 text-sky-300"/>Access points</button></div></Panel></aside></section> : null}
    {tab === "visitors" ? <AccessVisitorsView homeLabels={homeLabels} verifyOpen={verifyOpen} onVerifyOpenChange={setVerifyOpen} focusVisitorId={focusVisitorId} onChanged={() => void load()}/> : null}
    {tab === "access-points" ? <Panel title="Access Points" caption="Access-relevant hardware projected from the canonical Assets registry"><div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{accessPoints.map(device => <div key={device.id} className="rounded-lg border border-[var(--ois-border-subtle)] p-3"><div className="flex items-center justify-between gap-3"><b className="text-[11px] text-zinc-100">{device.name}</b><OisStatusBadge status={tone(deviceState(device)) as any} label={deviceState(device)}/></div><p className="mt-2 text-[9px] text-zinc-500">{device.home?.name || device.room?.name || "Facility-level assignment"}</p><p className="mt-1 text-[9px] text-zinc-600">{device.provider || "Provider unavailable"} · Last activity {when(device.last_event_at || device.last_seen_at)}</p></div>)}{!accessPoints.length ? <p className="py-12 text-center text-[10.5px] text-zinc-600 md:col-span-2 xl:col-span-3">No access points configured.</p> : null}</div></Panel> : null}
    {tab === "gate-control" ? <Panel title="Gate Control" caption="Read-only gate posture; no canonical remote gate command is exposed"><div className="mt-3 space-y-2">{accessPoints.map(device => <div key={device.id} className="flex items-center gap-3 rounded-lg border border-[var(--ois-border-subtle)] p-3"><ShieldCheck className="h-4 w-4 text-sky-300"/><span className="min-w-0 flex-1"><b className="block truncate text-[11px] text-zinc-100">{device.name}</b><small className="text-[9px] text-zinc-600">Controller health · {when(device.last_seen_at)}</small></span><OisStatusBadge status={tone(deviceState(device)) as any} label={deviceState(device)}/></div>)}{!accessPoints.length ? <p className="py-12 text-center text-[10.5px] text-zinc-600">No gate controllers configured.</p> : null}</div></Panel> : null}
    {tab === "access-logs" ? <Panel title="Access Logs" caption="Bounded canonical visitor lifecycle records"><VisitorRows rows={allVisitors.slice().sort((a,b)=>dateValue(b.created_at)-dateValue(a.created_at)).slice(0,40)} homeLabels={homeLabels} onReview={openVisitor}/></Panel> : null}
  </div>;
}
