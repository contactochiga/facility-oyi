"use client";

import { useEffect, useMemo, useState } from "react";
import OisCard from "@/components/ois/OisCard";
import OisDrawer from "@/components/ois/OisDrawer";
import OisListItem from "@/components/ois/OisListItem";
import OisStatusBadge from "@/components/ois/OisStatusBadge";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import messagesService, { type MessageLite, type ModerationReport, type ResidentLite, type ThreadLite } from "@/services/messagesService";
import { hasPermission } from "@/lib/oyiFoundation";
import { useSessionStore } from "@/store/useSessionStore";
import { AlertTriangle, CheckCircle, MessageSquare, RefreshCw, Search, Send, ShieldAlert } from "lucide-react";

type Tab = "inbox" | "resident_threads" | "operator_threads" | "reports" | "escalations";
type ActionState = "open" | "under_review" | "resolved" | "dismissed";

function cn(...classes: Array<string | false | null | undefined>) { return classes.filter(Boolean).join(" "); }
function nameOf(peer: any) { return peer?.full_name || peer?.username || peer?.email || "Resident"; }
function dateLabel(value?: string | null) { if (!value) return "Time unavailable"; const d = new Date(value); return Number.isNaN(d.getTime()) ? "Time unavailable" : d.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }); }
function statusTone(status?: string | null) { const value = String(status || "open").toLowerCase(); if (/resolved|closed|dismissed/.test(value)) return "resolved"; if (/review|pending|open/.test(value)) return "pending"; return "unavailable"; }

function Metric({ label, value, hint }: { label: string; value: string | number; hint: string }) { return <OisCard className="p-4"><div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ois-text-muted)]">{label}</div><div className="mt-3 text-2xl font-semibold text-[var(--ois-text-primary)]">{value}</div><div className="mt-1 text-xs text-[var(--ois-text-secondary)]">{hint}</div></OisCard>; }
function Field({ label, value }: { label: string; value: React.ReactNode }) { return <OisCard variant="evidence" className="p-3"><div className="text-[10px] uppercase tracking-[0.14em] text-[var(--ois-text-muted)]">{label}</div><div className="mt-1 text-sm text-[var(--ois-text-primary)]">{value}</div></OisCard>; }

export default function FacilityMessagesPage() {
  const { user } = useSessionStore();
  const [tab, setTab] = useState<Tab>("inbox");
  const [threads, setThreads] = useState<ThreadLite[]>([]);
  const [residents, setResidents] = useState<ResidentLite[]>([]);
  const [activeThread, setActiveThread] = useState<ThreadLite | null>(null);
  const [messages, setMessages] = useState<MessageLite[]>([]);
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [search, setSearch] = useState("");
  const [compose, setCompose] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<ModerationReport | null>(null);
  const [moderationNote, setModerationNote] = useState("");
  const [workflowState, setWorkflowState] = useState<ActionState>("open");

  const canRead = hasPermission(user, "community.read");
  const canWrite = hasPermission(user, "community.write");
  const canModerate = hasPermission(user, "community.moderate") || hasPermission(user, "support.assign");

  async function load() {
    setLoading(true); setError(null);
    try {
      const [inbox, people, reportRows] = await Promise.all([
        messagesService.listInbox(),
        messagesService.listResidents(),
        canModerate ? messagesService.listReports("open", 80) : Promise.resolve([]),
      ]);
      setThreads(Array.isArray(inbox) ? inbox : []);
      setResidents(Array.isArray(people) ? people : []);
      setReports(Array.isArray(reportRows) ? reportRows : []);
      if (!activeThread && Array.isArray(inbox) && inbox[0]) setActiveThread(inbox[0]);
    } catch (err: any) { setError(err?.message || "Failed to load message center"); }
    finally { setLoading(false); }
  }

  async function loadMessages(thread: ThreadLite | null) {
    if (!thread?.id) { setMessages([]); return; }
    const rows = await messagesService.listMessages(String(thread.id));
    setMessages(Array.isArray(rows) ? rows : []);
    await messagesService.markRead(String(thread.id));
  }

  useEffect(() => { void load(); }, []);
  useEffect(() => { void loadMessages(activeThread); }, [activeThread?.id]);

  async function startDirect(peerId: string) {
    if (!canWrite) { setError("Permission required: community.write."); return; }
    const result: any = await messagesService.openDirect(peerId);
    if (result?.error) { setError(result.error); return; }
    await load();
    const next = result?.thread;
    if (next?.id) setActiveThread(next);
  }

  async function send() {
    if (!activeThread?.id || !compose.trim()) return;
    if (!canWrite) { setError("Permission required: community.write."); return; }
    const body = compose.trim();
    setCompose("");
    const result: any = await messagesService.sendMessage(String(activeThread.id), body);
    if (result?.error) { setError(result.error); setCompose(body); return; }
    await loadMessages(activeThread);
    await load();
  }

  async function resolveReport(action: "dismiss" | "hide_message" | "mute_sender") {
    if (!selectedReport) return;
    if (!canModerate) { setError("Permission required: community.moderate/support.assign."); return; }
    setSaving(true); setError(null); setNotice(null);
    const result: any = await messagesService.resolveReport(String(selectedReport.id), { action, note: moderationNote.trim() || workflowState, mute_hours: action === "mute_sender" ? 24 : undefined });
    setSaving(false);
    if (result?.error) { setError(result.error); return; }
    setNotice("Moderation action recorded.");
    setSelectedReport(null); setModerationNote(""); setWorkflowState("open");
    await load();
  }

  const filteredResidents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return residents;
    return residents.filter((resident) => `${resident.full_name || ""} ${resident.username || ""} ${resident.role || ""}`.toLowerCase().includes(q));
  }, [search, residents]);

  const unreadThreads = threads.filter((thread) => Number(thread.unread_count || 0) > 0);
  const residentThreads = threads.filter((thread) => !thread.peer?.role || /resident|homeowner|guest|owner|admin/.test(String(thread.peer.role).toLowerCase()));
  const operatorThreads = threads.filter((thread) => /operator|staff|manager|facility|security|admin/.test(String(thread.peer?.role || "").toLowerCase()));
  const visibleThreads = tab === "resident_threads" ? residentThreads : tab === "operator_threads" ? operatorThreads : threads;
  const escalated = reports.filter((report) => /escalated|high|urgent|abuse|threat/.test(`${report.reason || ""} ${report.status || ""}`.toLowerCase()));

  if (!canRead) {
    return <div className="space-y-6"><Topbar title="Communication Operations" subtitle="Messaging permissions required" /><div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 text-sm text-amber-100">Permission required: community.read.</div></div>;
  }

  return (
    <div className="space-y-6">
      <Topbar title="Communication Operations" subtitle="Inbox, resident threads, operator communications, reports, and escalations" rightSlot={<Button variant="ghost" onClick={() => void load()} disabled={loading} className="gap-2"><RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />Refresh</Button>} />
      {error ? <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
      {notice ? <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{notice}</div> : null}

      <section className="grid gap-3 md:grid-cols-5">
        <Metric label="Inbox" value={threads.length} hint="Resident/operator threads" />
        <Metric label="Unread" value={unreadThreads.length} hint="Threads with unread messages" />
        <Metric label="Open reports" value={reports.length} hint="Moderation reports" />
        <Metric label="Escalations" value={escalated.length} hint="High-priority reports by real report text" />
        <Metric label="Residents" value={residents.length} hint="Reachable resident signals" />
      </section>

      <div className="flex flex-wrap gap-2">{(["inbox", "resident_threads", "operator_threads", "reports", "escalations"] as Tab[]).map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={cn("rounded-full border px-3 py-2 text-xs capitalize", tab === item ? "border-sky-400/40 bg-sky-500/10 text-sky-100" : "border-white/10 bg-white/5 text-zinc-400 hover:text-white")}>{item.replace(/_/g, " ")}</button>)}</div>

      {tab === "reports" || tab === "escalations" ? <ReportsPanel reports={tab === "escalations" ? escalated : reports} canModerate={canModerate} onOpen={(report) => setSelectedReport(report)} /> : (
        <section className="grid gap-4 xl:grid-cols-[320px_1fr_340px]">
          <OisCard as="aside" className="p-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><MessageSquare className="h-4 w-4 text-sky-200" />Resident Threads</h2>
            <div className="mt-3 space-y-2">{visibleThreads.map((thread) => <OisListItem key={thread.id} title={nameOf(thread.peer)} description={thread.last_message?.body || "No messages yet"} meta={dateLabel(thread.last_message_at)} status={Number(thread.unread_count || 0) > 0 ? "attention" : undefined} onClick={() => setActiveThread(thread)} className={cn("w-full text-left", activeThread?.id === thread.id ? "border-[var(--ois-primary)]/35 bg-[var(--ois-primary-soft)]" : "")} />)}{!visibleThreads.length ? <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">No threads in this lane.</div> : null}</div>
          </OisCard>

          <OisCard as="main" className="flex min-h-[560px] flex-col p-4">
            <header className="border-b border-white/10 pb-3"><h2 className="text-sm font-semibold text-white">{activeThread ? nameOf(activeThread.peer) : "Conversation"}</h2><p className="mt-1 text-xs text-zinc-500">Resident communication timeline</p></header>
            <div className="flex-1 space-y-2 overflow-auto py-4">{messages.map((message) => <OisListItem key={message.id} title={message.body} meta={`${message.sender_id || "sender"} · ${dateLabel(message.created_at)}${message.is_hidden ? " · hidden" : ""}`} />)}{!activeThread ? <div className="text-sm text-zinc-500">Pick a thread or start a resident conversation.</div> : !messages.length ? <div className="text-sm text-zinc-500">No messages in this thread.</div> : null}</div>
            <div className="flex gap-2 border-t border-white/10 pt-3"><input value={compose} onChange={(e) => setCompose(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void send(); } }} disabled={!activeThread || !canWrite} placeholder={canWrite ? "Send message..." : "Permission required: community.write"} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none disabled:opacity-50" /><Button onClick={() => void send()} disabled={!activeThread || !compose.trim() || !canWrite} className="gap-2"><Send className="h-4 w-4" />Send</Button></div>
          </OisCard>

          <OisCard as="aside" className="p-4"><h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Search className="h-4 w-4 text-sky-200" />Start conversation</h2><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search residents" className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none" /><div className="mt-3 max-h-[420px] space-y-2 overflow-auto">{filteredResidents.map((resident) => <OisListItem key={resident.id} title={nameOf(resident)} description={resident.role || "resident"} onClick={() => void startDirect(String(resident.id))} className={cn("w-full text-left", !canWrite ? "pointer-events-none opacity-50" : "")} />)}{!filteredResidents.length ? <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">No resident signals available.</div> : null}</div></OisCard>
        </section>
      )}

      <OisDrawer open={Boolean(selectedReport)} onClose={() => setSelectedReport(null)} title={selectedReport?.reason || "Reported message"} subtitle={selectedReport ? `Moderation report · ${dateLabel(selectedReport.created_at)}` : undefined} width="md" footer={selectedReport ? <div className="flex flex-wrap gap-2"><Button variant="ghost" onClick={() => void resolveReport("dismiss")} disabled={saving}>Dismiss</Button><Button onClick={() => void resolveReport("hide_message")} disabled={saving}>Hide message</Button><Button variant="danger" onClick={() => void resolveReport("mute_sender")} disabled={saving}>Mute sender 24h</Button></div> : null}>
        {selectedReport ? <div className="space-y-4"><OisCard variant="evidence" className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-zinc-300">{selectedReport.action || "Pending review"}</p><p className="mt-2 text-xs text-zinc-500">{selectedReport.moderator_id || "Awaiting moderation data"}</p></div><OisStatusBadge status={statusTone(selectedReport.status)} label={selectedReport.status || "open"} /></div></OisCard><div className="grid gap-2 sm:grid-cols-2"><Field label="Status" value={<OisStatusBadge status={statusTone(selectedReport.status)} label={selectedReport.status || "open"} />} /><Field label="Created" value={dateLabel(selectedReport.created_at)} /><Field label="Moderator" value={selectedReport.moderator_id || "Awaiting moderation data"} /><Field label="Action taken" value={selectedReport.action || "Pending review"} /></div><select value={workflowState} onChange={(e) => setWorkflowState(e.target.value as ActionState)} className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-3 text-sm text-white"><option value="open">Open</option><option value="under_review">Under Review</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option></select><textarea value={moderationNote} onChange={(e) => setModerationNote(e.target.value)} rows={4} placeholder="Moderation notes" className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-3 text-sm text-white outline-none" /></div> : null}
      </OisDrawer>
    </div>
  );
}

function ReportsPanel({ reports, canModerate, onOpen }: { reports: ModerationReport[]; canModerate: boolean; onOpen: (report: ModerationReport) => void }) {
  return <OisCard className="p-4"><h2 className="flex items-center gap-2 text-sm font-semibold text-white"><ShieldAlert className="h-4 w-4 text-amber-200" />Moderation Queue</h2><p className="mt-1 text-xs text-zinc-500">Reported messages and resident communications requiring review.</p><div className="mt-4 space-y-2">{reports.map((report) => <OisCard key={report.id} variant="evidence" className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-white">{report.reason || "Reported message"}</h3><p className="mt-1 text-xs text-zinc-500">{dateLabel(report.created_at)}</p></div><OisStatusBadge status={statusTone(report.status)} label={report.status || "open"} className="uppercase" /></div><div className="mt-3 grid gap-2 sm:grid-cols-3"><Field label="Moderator" value={report.moderator_id || "Awaiting moderation data"} /><Field label="Action" value={report.action || "Pending review"} /><Field label="Resolution" value={dateLabel(report.resolved_at)} /></div>{canModerate ? <Button className="mt-3 gap-2" variant="ghost" onClick={() => onOpen(report)}><AlertTriangle className="h-4 w-4" />Review</Button> : null}</OisCard>)}{!reports.length ? <div className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-zinc-500">No open reports in this lane.</div> : null}</div></OisCard>;
}
