"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, ChevronRight, Clock, DoorOpen, Download, KeyRound, RefreshCw, Search, ShieldAlert, X } from "lucide-react";
import OisCard from "@/components/ois/OisCard";
import OisDrawer from "@/components/ois/OisDrawer";
import OisListItem from "@/components/ois/OisListItem";
import OisStatusBadge from "@/components/ois/OisStatusBadge";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { visitorService, type VisitorItem, type VisitorTimelineEvent } from "@/services/visitorService";

type Filter = "all" | "pending" | "approved" | "entered" | "exited" | "denied";

function value(input: any, fallback = "Unavailable") {
  const text = String(input ?? "").trim();
  return text || fallback;
}

function status(input: any) {
  return String(input || "active").toLowerCase();
}

function expired(visitor: VisitorItem) {
  if (!visitor.expires_at) return false;
  const time = new Date(visitor.expires_at).getTime();
  return Number.isFinite(time) && time < Date.now();
}

function when(input?: string | null) {
  if (!input) return "No live timestamp";
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? "No live timestamp" : date.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function tone(input: string) {
  if (["approved", "entered", "active"].includes(input)) return "verified";
  if (["denied", "expired"].includes(input)) return "critical";
  if (input === "exited") return "completed";
  return "pending";
}

function Metric({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return <OisCard className="p-4"><p className="text-[10px] uppercase tracking-[0.17em] text-[var(--ois-text-muted)]">{label}</p><p className="mt-3 text-2xl font-semibold text-[var(--ois-text-primary)]">{value}</p><p className="mt-2 text-xs text-[var(--ois-text-secondary)]">{hint}</p></OisCard>;
}

export default function VisitorsPage() {
  const [items, setItems] = useState<VisitorItem[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [todayOnly, setTodayOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");
  const [selected, setSelected] = useState<VisitorItem | null>(null);
  const [timeline, setTimeline] = useState<VisitorTimelineEvent[]>([]);
  const [lockdownOpen, setLockdownOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await visitorService.list({ today: todayOnly, status: filter === "all" ? undefined : filter }));
    } catch (requestError: any) {
      setError(requestError?.message || "Unable to load visitors.");
    } finally {
      setLoading(false);
    }
  }, [filter, todayOnly]);

  useEffect(() => {
    void load();
    const onRealtime = (event: Event) => {
      const name = (event as CustomEvent)?.detail?.event || "";
      if (/visitor|access|gate|notification|audit/.test(name)) void load();
    };
    window.addEventListener("facility:realtime-event", onRealtime);
    return () => window.removeEventListener("facility:realtime-event", onRealtime);
  }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((visitor) => [visitor.visitor_name, visitor.visitor_phone, visitor.purpose, visitor.access_code].map((v) => value(v, "").toLowerCase()).some((v) => v.includes(needle)));
  }, [items, query]);
  const pending = items.filter((item) => status(item.status) === "pending").length;
  const active = items.filter((item) => ["approved", "entered", "active"].includes(status(item.status))).length;
  const exited = items.filter((item) => status(item.status) === "exited").length;
  const expiredCount = items.filter(expired).length;

  async function openVisitor(visitor: VisitorItem) {
    setSelected(visitor);
    setTimeline([]);
    const result = await visitorService.timeline(visitor.id);
    if (result.error) setError(result.error);
    else setTimeline("timeline" in result ? result.timeline || [] : []);
  }

  async function verify() {
    setError(null);
    const result = await visitorService.verify(verifyCode.trim());
    if (result.error) setError(result.error);
    else {
      const verified = "valid" in result ? result.valid : false;
      const visitor = "visitor" in result ? result.visitor : null;
      setNotice(verified ? `Access code verified for ${value(visitor?.visitor_name, "visitor")}.` : "Access code could not be verified.");
      setVerifyOpen(false);
      setVerifyCode("");
      if (verified && visitor) void openVisitor(visitor);
      await load();
    }
  }

  async function setVisitorStatus(next: string) {
    if (!selected) return;
    const result = await visitorService.updateStatus(selected.id, next);
    if (result.error) setError(result.error);
    else {
      setNotice(`Visitor status updated to ${next}.`);
      setSelected(null);
      await load();
    }
  }

  async function lockdown() {
    const result = await visitorService.lockdown("emergency");
    setLockdownOpen(false);
    if (result.error) setError(result.error);
    else setNotice(`Emergency lockdown requested. ${"recipients" in result ? result.recipients || 0 : 0} operators notified.`);
  }

  return (
    <div className="space-y-6">
      <Topbar title="Visitor Access Registry" subtitle="Queue, verification, activity, and access lifecycle." rightSlot={<Button variant="ghost" onClick={() => void load()} disabled={loading} className="gap-2"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh</Button>} />
      {error ? <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}
      {notice ? <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{notice}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Visitor queue" value={loading ? "Loading" : items.length} hint={todayOnly ? "Today only" : "All visible visitors"} />
        <Metric label="Pending" value={pending} hint="Awaiting gate review" />
        <Metric label="Active / entered" value={active} hint="Approved or inside estate" />
        <Metric label="Exited" value={exited} hint="Completed visits" />
        <Metric label="Expired passes" value={expiredCount} hint="Access codes past expiry" />
      </section>

      <OisCard className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">{(["all", "pending", "approved", "entered", "exited", "denied"] as Filter[]).map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={`rounded-xl border px-3 py-2 text-xs uppercase ${filter === item ? "border-sky-400/30 bg-sky-500/10 text-sky-100" : "border-white/10 bg-white/5 text-zinc-400"}`}>{item}</button>)}</div>
          <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setTodayOnly((v) => !v)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-300">{todayOnly ? "Today" : "All time"}</button><Button onClick={() => setVerifyOpen(true)} className="gap-2"><KeyRound className="h-4 w-4" /> Verify code</Button><Button variant="ghost" onClick={() => visitorService.exportReport({ today: todayOnly, format: "csv" })} className="gap-2"><Download className="h-4 w-4" /> Export</Button><Button variant="danger" onClick={() => setLockdownOpen(true)} className="gap-2"><ShieldAlert className="h-4 w-4" /> Lockdown</Button></div>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2"><Search className="h-4 w-4 text-zinc-500" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search visitor, phone, purpose, or code" className="w-full bg-transparent text-sm text-white outline-none" /></div>
        <div className="mt-4 hidden overflow-x-auto md:block">
          <table className="w-full min-w-[900px] text-left text-xs"><thead className="text-[10px] uppercase tracking-[0.14em] text-zinc-600"><tr><th className="pb-3">Visitor</th><th>Phone</th><th>Purpose</th><th>Access</th><th>Status</th><th>Created</th><th /></tr></thead><tbody className="divide-y divide-white/5">{filtered.map((visitor) => { const s = expired(visitor) ? "expired" : status(visitor.status); return <tr key={visitor.id} className="text-zinc-300"><td className="py-3 pr-3 font-medium text-white">{visitor.visitor_name}</td><td>{visitor.visitor_phone}</td><td>{visitor.purpose || "Visitor"}</td><td className="font-mono text-[11px]">{visitor.access_code || "Unavailable"}<span className="block pt-1 font-sans text-zinc-500">Expires {when(visitor.expires_at)}</span></td><td><OisStatusBadge status={tone(s)} label={s} className="uppercase" /></td><td>{when(visitor.created_at)}</td><td><button type="button" onClick={() => void openVisitor(visitor)} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-zinc-300 hover:text-white">Review</button></td></tr>; })}</tbody></table>
          {!filtered.length && !loading ? <p className="mt-4 rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">No visitor access items match this view.</p> : null}
        </div>
        <div className="mt-4 space-y-2 md:hidden">{filtered.map((visitor) => { const s = expired(visitor) ? "expired" : status(visitor.status); return <OisListItem key={visitor.id} title={visitor.visitor_name} description={`${visitor.purpose || "Visitor"} · Expires ${when(visitor.expires_at)}`} meta={<><span className="font-mono text-[11px] text-[var(--ois-text-secondary)]">{visitor.access_code || "Code unavailable"}</span><span className="block">{when(visitor.created_at)}</span></>} status={tone(s)} action={<ChevronRight className="h-4 w-4 text-[var(--ois-text-muted)]" />} onClick={() => void openVisitor(visitor)} className="w-full text-left" />; })}{!filtered.length && !loading ? <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">No visitor access items match this view.</p> : null}</div>
      </OisCard>

      {verifyOpen ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm"><section className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-5"><header className="flex justify-between gap-3"><h2 className="text-lg font-semibold text-white">Verify visitor access</h2><button type="button" onClick={() => setVerifyOpen(false)}><X className="h-4 w-4 text-zinc-400" /></button></header><input value={verifyCode} onChange={(e) => setVerifyCode(e.target.value)} placeholder="Access code" className="mt-5 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none" /><footer className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={() => setVerifyOpen(false)}>Cancel</Button><Button onClick={() => void verify()} disabled={!verifyCode.trim()}>Verify</Button></footer></section></div> : null}

      <OisDrawer open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.visitor_name || "Visitor access overview"} subtitle={selected ? `${selected.purpose || "Visitor"} · ${selected.visitor_phone}` : undefined} width="md" footer={selected ? <div className="flex flex-wrap gap-2">{["approved", "entered", "exited", "denied"].map((next) => <Button key={next} variant={next === "denied" ? "danger" : "ghost"} onClick={() => void setVisitorStatus(next)}>{next}</Button>)}</div> : null}>
        {selected ? <div className="space-y-4"><OisCard variant="evidence" className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-sm text-white">{selected.access_code || "Code unavailable"}</p><p className="mt-2 text-xs text-zinc-500">Expires {when(selected.expires_at)}</p></div><OisStatusBadge status={tone(expired(selected) ? "expired" : status(selected.status))} label={expired(selected) ? "expired" : status(selected.status)} className="uppercase" /></div></OisCard><OisCard variant="evidence" className="p-4"><h3 className="text-sm font-medium text-white">Activity</h3><div className="mt-3 space-y-2">{timeline.map((item) => <OisListItem key={`${item.type}:${item.at}`} title={item.note} description={`${item.type} · ${when(item.at)}`} />)}{!timeline.length ? <p className="rounded-xl border border-dashed border-white/10 p-3 text-sm text-zinc-500">No access activity available.</p> : null}</div></OisCard></div> : null}
      </OisDrawer>
      {lockdownOpen ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm"><section className="w-full max-w-md rounded-2xl border border-rose-500/20 bg-zinc-950 p-5"><h2 className="text-lg font-semibold text-white">Confirm lockdown</h2><p className="mt-2 text-sm text-zinc-400">This notifies estate operators and requests visitor access lockdown. Continue only during an active security response.</p><footer className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={() => setLockdownOpen(false)}>Cancel</Button><Button variant="danger" onClick={() => void lockdown()}><Ban className="mr-2 h-4 w-4" /> Confirm</Button></footer></section></div> : null}
    </div>
  );
}
