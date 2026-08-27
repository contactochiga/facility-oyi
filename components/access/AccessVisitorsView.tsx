"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Download, KeyRound, Search, X } from "lucide-react";
import FacilityMetricCard from "@/components/ois/FacilityMetricCard";
import OisCard from "@/components/ois/OisCard";
import OisDrawer from "@/components/ois/OisDrawer";
import OisListItem from "@/components/ois/OisListItem";
import OisStatusBadge from "@/components/ois/OisStatusBadge";
import Button from "@/components/ui/Button";
import { loadOyiCoreExecutionHistory } from "@/services/oyiCoreRuntimeService";
import { visitorService, type VisitorItem, type VisitorTimelineEvent } from "@/services/visitorService";
import { AlertTriangle, CheckCircle2, Clock3, DoorOpen, LogOut, Users } from "lucide-react";

type Filter = "all" | "pending" | "approved" | "entered" | "exited" | "denied";

function text(input: unknown, fallback = "Unavailable") { const result = String(input ?? "").trim(); return result || fallback; }
function status(input: unknown) { return String(input || "pending").toLowerCase(); }
function expired(visitor: VisitorItem) { const time = visitor.expires_at ? new Date(visitor.expires_at).getTime() : Number.NaN; return Number.isFinite(time) && time < Date.now(); }
function isToday(input?: string | null) { if (!input) return false; const date = new Date(input); const now = new Date(); return !Number.isNaN(date.getTime()) && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate(); }
function when(input?: string | null) { if (!input) return "Timestamp unavailable"; const date = new Date(input); return Number.isNaN(date.getTime()) ? "Timestamp unavailable" : date.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }); }
function tone(input: string) { if (["approved", "entered", "active"].includes(input)) return "verified"; if (["denied", "expired"].includes(input)) return "critical"; if (input === "exited") return "completed"; return "pending"; }

export default function AccessVisitorsView({ homeLabels, verifyOpen, onVerifyOpenChange, focusVisitorId, onChanged }: { homeLabels: Map<string, string>; verifyOpen: boolean; onVerifyOpenChange: (open: boolean) => void; focusVisitorId?: string | null; onChanged?: () => void }) {
  const [items, setItems] = useState<VisitorItem[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [todayOnly, setTodayOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyResult, setVerifyResult] = useState<{ valid: boolean; message: string; visitor?: VisitorItem } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [selected, setSelected] = useState<VisitorItem | null>(null);
  const [timeline, setTimeline] = useState<VisitorTimelineEvent[]>([]);
  const [executionHistory, setExecutionHistory] = useState<Array<Record<string, any>>>([]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems(await visitorService.list({ today: todayOnly })); }
    catch (requestError: any) { setError(requestError?.message || "Unable to load visitors."); }
    finally { setLoading(false); }
  }, [todayOnly]);

  useEffect(() => { void load(); const listener = (event: Event) => { const name = String((event as CustomEvent)?.detail?.event || ""); if (/visitor|access|gate|notification|audit/.test(name)) void load(); }; window.addEventListener("facility:realtime-event", listener); return () => window.removeEventListener("facility:realtime-event", listener); }, [load]);

  const openVisitor = useCallback(async (visitor: VisitorItem) => {
    setSelected(visitor); setTimeline([]); setExecutionHistory([]);
    const result = await visitorService.timeline(visitor.id);
    if (result.error) setError(result.error); else setTimeline("timeline" in result ? result.timeline || [] : []);
    const runtime = await loadOyiCoreExecutionHistory({ limit: 8, action: "visitor" }).catch(() => []);
    setExecutionHistory(Array.isArray(runtime) ? runtime : []);
  }, []);

  useEffect(() => { if (!focusVisitorId || !items.length) return; const visitor = items.find(item => item.id === focusVisitorId); if (visitor) void openVisitor(visitor); }, [focusVisitorId, items, openVisitor]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter(visitor => {
      const visitorStatus = expired(visitor) ? "expired" : status(visitor.status);
      if (filter !== "all" && !(filter === "entered" ? ["entered", "active"].includes(visitorStatus) : visitorStatus === filter)) return false;
      if (!needle) return true;
      const home = visitor.home_id ? homeLabels.get(visitor.home_id) : "";
      return [visitor.visitor_name, visitor.visitor_phone, visitor.purpose, visitor.access_code, home].some(value => text(value, "").toLowerCase().includes(needle));
    });
  }, [filter, homeLabels, items, query]);

  const counts = useMemo(() => ({ pending: items.filter(item => status(item.status) === "pending" && !expired(item)).length, approved: items.filter(item => status(item.status) === "approved" && !expired(item)).length, entered: items.filter(item => ["entered", "active"].includes(status(item.status)) && !expired(item)).length, exited: items.filter(item => status(item.status) === "exited").length, attention: items.filter(item => status(item.status) === "denied" || expired(item)).length }), [items]);
  const visitorsToday = items.filter(item => isToday(item.created_at)).length;

  async function verify() {
    setVerifying(true); setVerifyResult(null);
    const result = await visitorService.verify(verifyCode.trim());
    if (result.error) setVerifyResult({ valid: false, message: result.error });
    else {
      const valid = "valid" in result ? Boolean(result.valid) : false;
      const visitor = "visitor" in result ? result.visitor : undefined;
      setVerifyResult({ valid, visitor: visitor || undefined, message: valid ? `Access code verified for ${text(visitor?.visitor_name, "visitor")}.` : "Access code is invalid, expired, denied, or already used." });
      await load(); onChanged?.();
    }
    setVerifying(false);
  }

  async function setVisitorStatus(next: string) {
    if (!selected) return;
    const result = await visitorService.updateStatus(selected.id, next);
    if (result.error) setError(result.error); else { setNotice(`Visitor status updated to ${next}.`); setSelected(null); await load(); onChanged?.(); }
  }

  function closeVerify() { onVerifyOpenChange(false); setVerifyCode(""); setVerifyResult(null); }

  return <div className="space-y-3.5">
    <header><h2 className="text-[15px] font-semibold text-white">Visitors</h2><p className="mt-0.5 text-[10.5px] text-zinc-500">Visitor approvals, access lifecycle and visit history</p></header>
    <section className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6"><FacilityMetricCard icon={<Users/>} label="Visitors today" value={loading ? "—" : visitorsToday} detail="Today’s records" accent="text-sky-400"/><FacilityMetricCard icon={<Clock3/>} label="Pending" value={loading ? "—" : counts.pending} detail="Awaiting review" accent="text-amber-400"/><FacilityMetricCard icon={<CheckCircle2/>} label="Approved" value={loading ? "—" : counts.approved} detail="Access approved" accent="text-emerald-400"/><FacilityMetricCard icon={<DoorOpen/>} label="Entered" value={loading ? "—" : counts.entered} detail="Active lifecycle" accent="text-emerald-400"/><FacilityMetricCard icon={<LogOut/>} label="Exited" value={loading ? "—" : counts.exited} detail="Completed visits" accent="text-zinc-400"/><FacilityMetricCard icon={<AlertTriangle/>} label="Attention" value={loading ? "—" : counts.attention} detail="Denied or expired" accent={counts.attention ? "text-rose-400" : "text-zinc-400"}/></section>
    {error ? <div role="alert" className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</div> : null}
    {notice ? <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">{notice}</div> : null}
    <OisCard className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-[14px] font-semibold text-white">Visitor Registry</h3><p className="mt-0.5 text-[10px] text-zinc-500">Canonical visitor verification and lifecycle records</p></div><div className="flex gap-2"><Button variant="ghost" className="h-8 gap-2 px-3 text-[10px]" onClick={() => visitorService.exportReport({ today: todayOnly, format: "csv" })}><Download className="h-3.5 w-3.5"/>Export</Button><Button className="h-8 gap-2 px-3 text-[10px]" onClick={() => onVerifyOpenChange(true)}><KeyRound className="h-3.5 w-3.5"/>Verify Visitor</Button></div></div>
      <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between"><label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/[.07] bg-black/10 px-3 lg:max-w-sm"><Search className="h-3.5 w-3.5 text-zinc-600"/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search visitor, phone, purpose, code or Home…" className="min-w-0 flex-1 bg-transparent text-[10.5px] text-white outline-none placeholder:text-zinc-600"/></label><div className="flex gap-1 overflow-x-auto pb-1">{(["all", "pending", "approved", "entered", "exited", "denied"] as Filter[]).map(item => <button key={item} type="button" onClick={() => setFilter(item)} className={`whitespace-nowrap rounded-md border px-2.5 py-1.5 text-[9.5px] capitalize ${filter === item ? "border-sky-400/25 bg-sky-500/15 text-sky-200" : "border-white/[.07] text-zinc-500"}`}>{item}</button>)}<button type="button" onClick={() => setTodayOnly(current => !current)} className={`whitespace-nowrap rounded-md border px-2.5 py-1.5 text-[9.5px] ${todayOnly ? "border-sky-400/25 bg-sky-500/15 text-sky-200" : "border-white/[.07] text-zinc-500"}`}>Today</button></div></div>
      <div className="mt-4 hidden overflow-x-auto md:block"><table className="w-full min-w-[860px] text-left"><thead className="text-[8.5px] uppercase tracking-[.09em] text-zinc-600"><tr><th className="pb-2.5">Visitor</th><th>Host / Home</th><th>Purpose</th><th>Access</th><th>Status</th><th>Created / schedule</th><th>Action</th></tr></thead><tbody className="divide-y divide-[var(--ois-border-subtle)]">{visible.map(visitor => { const visitorStatus = expired(visitor) ? "expired" : status(visitor.status); return <tr key={visitor.id} className="text-[10px] text-zinc-400"><td className="py-2.5 pr-3"><b className="block font-medium text-zinc-100">{visitor.visitor_name}</b><small className="text-[8.5px] text-zinc-600">{text(visitor.visitor_phone)}</small></td><td>{visitor.home_id ? homeLabels.get(visitor.home_id) || "Home assigned" : "Not assigned"}</td><td>{visitor.purpose || "Visitor"}</td><td><span className="font-mono text-[9.5px]">{visitor.access_code || "Unavailable"}</span><small className="block text-[8px] text-zinc-600">Expires {when(visitor.expires_at)}</small></td><td><OisStatusBadge status={tone(visitorStatus) as any} label={visitorStatus}/></td><td>{when(visitor.created_at)}</td><td><button type="button" onClick={() => void openVisitor(visitor)} className="text-sky-300">Review</button></td></tr>; })}</tbody></table></div>
      <div className="mt-3 divide-y divide-[var(--ois-border-subtle)] md:hidden">{visible.map(visitor => { const visitorStatus = expired(visitor) ? "expired" : status(visitor.status); return <button key={visitor.id} type="button" onClick={() => void openVisitor(visitor)} className="flex w-full items-center gap-3 py-3 text-left"><span className="grid h-8 w-8 place-items-center rounded-md bg-white/[.035] text-sky-300"><Users className="h-3.5 w-3.5"/></span><span className="min-w-0 flex-1"><b className="block truncate text-[10.5px] text-zinc-100">{visitor.visitor_name}</b><small className="block truncate text-[8.5px] text-zinc-600">{visitor.purpose || "Visitor"} · {when(visitor.created_at)}</small></span><OisStatusBadge status={tone(visitorStatus) as any} label={visitorStatus}/><ChevronRight className="h-3.5 w-3.5 text-zinc-600"/></button>; })}</div>
      {!visible.length && !loading ? <p className="py-12 text-center text-[10.5px] text-zinc-600">No visitor access items match this view.</p> : null}
    </OisCard>
    {verifyOpen ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" aria-label="Verify Visitor" className="w-full max-w-md rounded-xl border border-white/[.09] bg-[#071019] p-5 shadow-2xl"><header className="flex items-start justify-between gap-3"><div><h2 className="text-[15px] font-semibold text-white">Verify Visitor</h2><p className="mt-1 text-[10px] text-zinc-500">Check an existing canonical access or verification code.</p></div><button type="button" aria-label="Close verification" onClick={closeVerify}><X className="h-4 w-4 text-zinc-500"/></button></header><label className="mt-5 block text-[9px] uppercase tracking-[.08em] text-zinc-500">Access / Verification Code<input autoFocus value={verifyCode} onChange={event => { setVerifyCode(event.target.value); setVerifyResult(null); }} placeholder="Enter code" className="mt-2 h-10 w-full rounded-lg border border-white/[.08] bg-black/20 px-3 font-mono text-xs text-white outline-none focus:border-sky-400/40"/></label>{verifyResult ? <div className={`mt-4 rounded-lg border px-3 py-3 ${verifyResult.valid ? "border-emerald-500/20 bg-emerald-500/10" : "border-rose-500/20 bg-rose-500/10"}`}><p className={`text-[10.5px] ${verifyResult.valid ? "text-emerald-200" : "text-rose-200"}`}>{verifyResult.message}</p>{verifyResult.visitor ? <p className="mt-1 text-[9px] text-zinc-400">{verifyResult.visitor.purpose || "Visitor"} · {text(verifyResult.visitor.visitor_phone)}</p> : null}</div> : null}<footer className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={closeVerify}>Close</Button>{verifyResult?.visitor ? <Button variant="ghost" onClick={() => { void openVisitor(verifyResult.visitor!); closeVerify(); }}>Review visitor</Button> : null}<Button onClick={() => void verify()} disabled={!verifyCode.trim() || verifying}>{verifying ? "Verifying…" : "Verify"}</Button></footer></section></div> : null}
    <OisDrawer open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.visitor_name || "Visitor access overview"} subtitle={selected ? `${selected.purpose || "Visitor"} · ${text(selected.visitor_phone)}` : undefined} width="md" footer={selected ? <div className="flex flex-wrap gap-2">{["approved", "entered", "exited", "denied"].map(next => <Button key={next} variant={next === "denied" ? "danger" : "ghost"} onClick={() => void setVisitorStatus(next)}>{next}</Button>)}</div> : null}>{selected ? <div className="space-y-4"><OisCard variant="evidence" className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-sm text-white">{selected.access_code || "Code unavailable"}</p><p className="mt-2 text-xs text-zinc-500">Expires {when(selected.expires_at)}</p><p className="mt-1 text-xs text-zinc-500">{selected.home_id ? homeLabels.get(selected.home_id) || "Home assigned" : "No Home assigned"}</p></div><OisStatusBadge status={tone(expired(selected) ? "expired" : status(selected.status)) as any} label={expired(selected) ? "expired" : status(selected.status)}/></div></OisCard><OisCard className="p-4"><h3 className="text-sm font-medium text-white">Runtime trace</h3><div className="mt-3 space-y-2">{executionHistory.map(item => <OisListItem key={item.executionId || item.signalId} title={item.action || "Visitor execution"} description={`${item.origin || "system"} · ${item.provider || "backend"}`} meta={`${item.status || "recorded"} · ${when(item.completedAt || item.requestedAt)}`}/>)}{!executionHistory.length ? <p className="py-5 text-center text-xs text-zinc-500">No runtime execution history is available yet.</p> : null}</div></OisCard><OisCard variant="evidence" className="p-4"><h3 className="text-sm font-medium text-white">Activity</h3><div className="mt-3 space-y-2">{timeline.map(item => <OisListItem key={`${item.type}:${item.at}`} title={item.note} description={`${item.type} · ${when(item.at)}`}/>)}{!timeline.length ? <p className="py-5 text-center text-xs text-zinc-500">No access activity available.</p> : null}</div></OisCard></div> : null}</OisDrawer>
  </div>;
}
