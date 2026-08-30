"use client";

// OYI Facility -- Final Messages + Buildings/Home Registry consolidation
// pass. Messages is rebuilt against the real, already-shipped 1:1 direct
// messaging system (Ochiga-backend's dm_threads/dm_messages/
// dm_thread_members, src/controllers/messagesController.ts, mounted at
// /messages) -- no new messaging backend was created. Real-time delivery
// reuses the existing Socket.IO "dm:new" event (already emitted server-
// side to every thread member's `user:${id}` room, which this client
// already joins on connect) -- see services/facilityRealtime.ts.
//
// Genuinely NOT supported, and intentionally not faked:
//  - Group/team channels. dm_threads.kind allows 'group' at the schema
//    level, but no backend route creates one -- only 1:1 direct threads
//    are creatable. "Facility Team" here means a 1:1 conversation with a
//    real facility-role team member, not a shared channel.
//  - Conversation assignment ("assigned to Utilities Team"). No
//    assignee/team field exists on dm_threads. Omitted, not simulated.
//  - Voice/video calling. Audited Ochiga-backend's telephony stack in
//    full: Twilio has zero configured credentials, and more fundamentally
//    there is no HTTP route a frontend can call to place a resident call
//    at all (Backend's internal voice-dispatch pipeline is only invoked by
//    internal Oyi AI/automation/goal machinery). The call control stays
//    visible (matching the approved reference) but permanently disabled
//    with an honest tooltip -- never wired to a fake success path.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  ChevronRight,
  Droplets,
  FileText,
  Flame,
  Image as ImageIcon,
  Info,
  MessageSquare,
  MoreVertical,
  Paperclip,
  Phone,
  Plus,
  Radio,
  Search,
  Send,
  ShieldAlert,
  Smile,
  Users,
  Wifi,
  Wrench,
  Zap,
} from "lucide-react";
import OisCard from "@/components/ois/OisCard";
import OisDrawer from "@/components/ois/OisDrawer";
import OisStatusBadge, { type OisStatus } from "@/components/ois/OisStatusBadge";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import FacilityMetricCard from "@/components/ois/FacilityMetricCard";
import messagesService, { type MessageLite, type ModerationReport, type ResidentLite, type ThreadLite } from "@/services/messagesService";
import { facilityService } from "@/services/facilityService";
import { maintenanceService, type MaintenanceItem } from "@/services/maintenanceService";
import { communityService, type CommunityPost } from "@/services/communityService";
import { hasPermission } from "@/lib/oyiFoundation";
import { useSessionStore } from "@/store/useSessionStore";

type Category = "all" | "residents" | "facility_team" | "maintenance" | "security" | "announcements";
const CATEGORIES: Array<{ key: Category; label: string }> = [
  { key: "all", label: "All Messages" },
  { key: "residents", label: "Residents" },
  { key: "facility_team", label: "Facility Team" },
  { key: "maintenance", label: "Maintenance" },
  { key: "security", label: "Security" },
  { key: "announcements", label: "Announcements" },
];

function isFacilityRole(role?: string | null) {
  return /operator|staff|manager|facility|security|admin|owner/.test(String(role || "").toLowerCase());
}
function isMaintenanceRole(role?: string | null) {
  return /maintenance/.test(String(role || "").toLowerCase());
}
function isSecurityRole(role?: string | null) {
  return /security/.test(String(role || "").toLowerCase());
}
function nameOf(peer: any) {
  return peer?.full_name || peer?.username || peer?.email || "Facility user";
}
function initials(name: string) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "U";
  return parts.length === 1 ? parts[0].slice(0, 1).toUpperCase() : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
function timeLabel(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function relativeLabel(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const minutes = Math.round((Date.now() - d.getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString([], { month: "short", day: "2-digit" });
}
function dayLabel(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString([], { month: "long", day: "numeric", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}
function occupancyTone(status?: string | null): OisStatus {
  const value = String(status || "").toLowerCase();
  if (value === "occupied") return "stable";
  if (value === "vacant") return "unavailable";
  if (value === "pending_activation") return "pending";
  return "unavailable";
}
function serviceState(home: any, key: string): { label: string; tone: OisStatus } {
  const service = home?.service_bindings?.[key] || {};
  const status = String(service.status || "").toLowerCase();
  if (status === "interruption_reported" || status === "outage") return { label: "Interruption reported", tone: "warning" };
  if (status) return { label: status.replace(/_/g, " "), tone: "stable" };
  if (service.provider || service.account_ref || service.meter_id) return { label: "Active", tone: "stable" };
  return { label: "Not configured", tone: "unavailable" };
}
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const QUICK_EMOJI = ["👍", "🙏", "✅", "⚠️", "🔧", "💧", "⚡", "🙌"];

function Avatar({ name, online }: { name: string; online?: boolean }) {
  return (
    <span className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-sky-500/15 text-[11px] font-semibold text-sky-100">
      {initials(name)}
      {online ? <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0a0f16] bg-emerald-400" /> : null}
    </span>
  );
}

export default function FacilityMessagesPage() {
  const { user } = useSessionStore() as any;
  const [estateId, setEstateId] = useState<string | null>(null);
  const [homes, setHomes] = useState<any[]>([]);
  const [threads, setThreads] = useState<ThreadLite[]>([]);
  const [residents, setResidents] = useState<ResidentLite[]>([]);
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [announcements, setAnnouncements] = useState<CommunityPost[]>([]);
  const [maintenanceItems, setMaintenanceItems] = useState<MaintenanceItem[]>([]);

  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageLite[]>([]);
  const [category, setCategory] = useState<Category>("all");
  const [search, setSearch] = useState("");
  const [compose, setCompose] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const [announcementsOpen, setAnnouncementsOpen] = useState(false);
  const [announceTitle, setAnnounceTitle] = useState("");
  const [announceBody, setAnnounceBody] = useState("");
  const [announceSaving, setAnnounceSaving] = useState(false);
  const [reportTarget, setReportTarget] = useState<MessageLite | null>(null);
  const [reportReason, setReportReason] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);

  const canRead = hasPermission(user, "community.read");
  const canWrite = hasPermission(user, "community.write");
  const canModerate = hasPermission(user, "community.moderate") || hasPermission(user, "support.assign");
  const canAnnounce = hasPermission(user, "community.manage_announcements") || hasPermission(user, "community.broadcast");

  const activeThread = useMemo(() => threads.find((t) => t.id === activeThreadId) || null, [threads, activeThreadId]);
  const activeHome = useMemo(() => homes.find((h) => String(h.id) === String(activeThread?.peer?.home_id)) || null, [homes, activeThread]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const overview = await facilityService.overview().catch(() => null);
      const id = String((overview as any)?.estate?.id || (overview as any)?.estate_id || user?.estate_id || "");
      setEstateId(id || null);
      const [inbox, people, reportRows, announcementRows, maintenanceRows, structure] = await Promise.all([
        messagesService.listInbox(),
        messagesService.listResidents(),
        canModerate ? messagesService.listReports("open", 80) : Promise.resolve([]),
        id ? communityService.listByEstate(id).catch(() => []) : Promise.resolve([]),
        maintenanceService.list().catch(() => []),
        facilityService.estateStructure().catch(() => null),
      ]);
      setThreads(Array.isArray(inbox) ? inbox : []);
      setResidents(Array.isArray(people) ? people : []);
      setReports(Array.isArray(reportRows) ? reportRows : []);
      setAnnouncements((Array.isArray(announcementRows) ? announcementRows : []).filter((post) => String(post.category || "").toLowerCase() === "announcement"));
      setMaintenanceItems(Array.isArray(maintenanceRows) ? maintenanceRows : []);
      setHomes((structure as any)?.homes || []);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Unable to load Messages.");
    } finally {
      setLoading(false);
    }
  }, [canModerate, user?.estate_id]);

  const loadMessages = useCallback(async (threadId: string | null) => {
    if (!threadId) { setMessages([]); return; }
    const rows = await messagesService.listMessages(threadId);
    setMessages(Array.isArray(rows) ? rows : []);
    await messagesService.markRead(threadId);
    setThreads((prev) => prev.map((t) => (t.id === threadId ? { ...t, unread_count: 0 } : t)));
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadMessages(activeThreadId); }, [activeThreadId, loadMessages]);
  useEffect(() => { timelineRef.current?.scrollTo({ top: timelineRef.current.scrollHeight }); }, [messages]);

  useEffect(() => {
    function onDm(event: Event) {
      const msg = (event as CustomEvent)?.detail as MessageLite | undefined;
      if (!msg?.thread_id) return;
      if (msg.thread_id === activeThreadId) {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        void messagesService.markRead(msg.thread_id);
      }
      void load();
    }
    window.addEventListener("facility:dm-message", onDm);
    return () => window.removeEventListener("facility:dm-message", onDm);
  }, [activeThreadId, load]);

  const residentPeople = useMemo(() => residents.filter((r) => !isFacilityRole(r.role)), [residents]);
  const facilityPeople = useMemo(() => residents.filter((r) => isFacilityRole(r.role)), [residents]);

  const filteredThreads = useMemo(() => {
    const query = search.trim().toLowerCase();
    let rows = threads;
    if (category === "residents") rows = rows.filter((t) => !isFacilityRole(t.peer?.role));
    else if (category === "facility_team") rows = rows.filter((t) => isFacilityRole(t.peer?.role));
    else if (category === "maintenance") rows = rows.filter((t) => isMaintenanceRole(t.peer?.role));
    else if (category === "security") rows = rows.filter((t) => isSecurityRole(t.peer?.role));
    if (query) rows = rows.filter((t) => nameOf(t.peer).toLowerCase().includes(query) || (t.last_message?.body || "").toLowerCase().includes(query));
    return rows;
  }, [threads, category, search]);

  const totalUnread = useMemo(() => threads.reduce((sum, t) => sum + Number(t.unread_count || 0), 0), [threads]);
  const homeMaintenance = useMemo(() => {
    if (!activeThread?.peer?.home_id) return [];
    return maintenanceItems.filter((item) => String(item.home_id || "") === String(activeThread.peer!.home_id)).slice(0, 3);
  }, [maintenanceItems, activeThread]);

  function groupedMessages() {
    const groups: Array<{ day: string; items: MessageLite[] }> = [];
    for (const message of messages) {
      const day = dayLabel(message.created_at);
      const last = groups[groups.length - 1];
      if (last && last.day === day) last.items.push(message);
      else groups.push({ day, items: [message] });
    }
    return groups;
  }

  async function startDirect(peerId: string) {
    if (!canWrite) { setError("Permission required: community.write."); return; }
    const result: any = await messagesService.openDirect(peerId);
    if (result?.error) { setError(result.error); return; }
    setNewMessageOpen(false);
    await load();
    if (result?.thread?.id) { setActiveThreadId(String(result.thread.id)); setMobileDetailOpen(true); }
  }

  async function send() {
    if (!activeThreadId || !compose.trim() || !canWrite) return;
    const body = compose.trim();
    setCompose("");
    setSending(true);
    const result: any = await messagesService.sendMessage(activeThreadId, body);
    setSending(false);
    if (result?.error) { setError(result.error); setCompose(body); return; }
    await loadMessages(activeThreadId);
    await load();
  }

  async function sendAttachment(file: File, mediaType: "image" | "file") {
    if (!activeThreadId || !canWrite) return;
    setError(null);
    try {
      const base64 = await readFileAsBase64(file);
      const uploaded = await messagesService.uploadMedia({ base64, mime: file.type || "application/octet-stream", filename: file.name, mediaType });
      if ((uploaded as any)?.error || !(uploaded as any)?.url) { setError((uploaded as any)?.error || "Unable to upload attachment."); return; }
      const result: any = await messagesService.sendMedia(activeThreadId, { url: (uploaded as any).url, mediaType, filename: file.name });
      if (result?.error) { setError(result.error); return; }
      await loadMessages(activeThreadId);
      await load();
    } catch (err: any) {
      setError(err?.message || "Unable to send attachment.");
    }
  }

  async function toggleArchive() {
    if (!activeThreadId) return;
    setMenuOpen(false);
    const result: any = await messagesService.setArchived(activeThreadId, true);
    if (result?.error) { setError(result.error); return; }
    setNotice("Conversation archived.");
    setActiveThreadId(null);
    setMobileDetailOpen(false);
    await load();
  }

  async function submitReport() {
    if (!reportTarget || !reportReason.trim()) return;
    try {
      const res = await (await import("@/services/api")).default.post(`/messages/message/${reportTarget.id}/report`, { reason: reportReason.trim() });
      if (res?.data?.ok) { setNotice("Message reported for review."); setReportTarget(null); setReportReason(""); }
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Unable to report this message.");
    }
  }

  async function createAnnouncement() {
    if (!estateId || !announceTitle.trim()) return;
    setAnnounceSaving(true);
    try {
      await communityService.createPost({ estateId, title: announceTitle.trim(), content: announceBody.trim() || null, category: "announcement" });
      setAnnounceTitle(""); setAnnounceBody(""); setAnnouncementsOpen(false);
      setNotice("Announcement posted.");
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Unable to post announcement.");
    } finally {
      setAnnounceSaving(false);
    }
  }

  if (!canRead) {
    return (
      <div className="space-y-6">
        <Topbar title="Messages" subtitle="Communication across your facility." />
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 text-sm text-amber-100">Permission required: community.read.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Topbar title="Messages" subtitle="Communication across your facility." />

      {error ? <div role="alert" className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</div> : null}
      {notice ? <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">{notice}</div> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:flex xl:flex-1 xl:gap-2.5">
          <FacilityMetricCard icon={<MessageSquare />} label="Unread" value={loading ? "—" : totalUnread} detail={`${threads.filter((t) => Number(t.unread_count || 0) > 0).length} conversations`} accent="text-sky-400" />
          <FacilityMetricCard icon={<Radio />} label="Open Conversations" value={loading ? "—" : threads.length} detail="Active" accent="text-emerald-400" />
          <FacilityMetricCard icon={<Users />} label="Residents" value={loading ? "—" : residentPeople.length} detail="Registered" accent="text-violet-400" />
          <FacilityMetricCard icon={<ShieldAlert />} label="Facility Team" value={loading ? "—" : facilityPeople.filter((p) => p.is_online).length} detail="Online" accent="text-amber-400" />
          <FacilityMetricCard icon={<AlertTriangle />} label="Attention Required" value={loading ? "—" : reports.length} detail="Open reports" accent={reports.length ? "text-rose-400" : "text-zinc-400"} />
        </div>
        <div className="flex shrink-0 gap-2">
          <Button onClick={() => setNewMessageOpen(true)} disabled={!canWrite} className="gap-2"><Plus className="h-4 w-4" />New Message</Button>
          <Button variant="secondary" onClick={() => setAnnouncementsOpen(true)} className="gap-2"><Radio className="h-4 w-4" />Announcements</Button>
        </div>
      </div>

      <section className="grid gap-3 xl:grid-cols-[300px_minmax(0,1fr)_300px]">
        {/* LEFT -- inbox */}
        <OisCard className={`flex max-h-[720px] flex-col overflow-hidden p-0 ${mobileDetailOpen ? "hidden xl:flex" : "flex"}`}>
          <div className="space-y-2.5 border-b border-white/[0.06] p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations…" className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-8 pr-3 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-sky-400/40" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((item) => {
                const count = item.key === "all" ? threads.length
                  : item.key === "residents" ? threads.filter((t) => !isFacilityRole(t.peer?.role)).length
                  : item.key === "facility_team" ? threads.filter((t) => isFacilityRole(t.peer?.role)).length
                  : item.key === "maintenance" ? threads.filter((t) => isMaintenanceRole(t.peer?.role)).length
                  : item.key === "security" ? threads.filter((t) => isSecurityRole(t.peer?.role)).length
                  : announcements.length;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => (item.key === "announcements" ? setAnnouncementsOpen(true) : setCategory(item.key))}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition ${category === item.key ? "border-sky-400/35 bg-sky-500/10 text-sky-100" : "border-white/10 bg-white/5 text-zinc-400 hover:text-white"}`}
                  >
                    {item.label}<span className="text-[10px] text-zinc-500">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredThreads.map((thread) => {
              const unread = Number(thread.unread_count || 0) > 0;
              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => { setActiveThreadId(String(thread.id)); setMobileDetailOpen(true); }}
                  className={`flex w-full items-start gap-2.5 border-b border-white/[0.04] px-3 py-2.5 text-left transition hover:bg-white/[0.03] ${activeThreadId === thread.id ? "bg-sky-500/[0.06]" : ""}`}
                >
                  <Avatar name={nameOf(thread.peer)} online={thread.peer?.is_online} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <b className="truncate text-[12.5px] font-medium text-zinc-100">{nameOf(thread.peer)}</b>
                      <span className="shrink-0 text-[10px] text-zinc-600">{relativeLabel(thread.last_message_at)}</span>
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="truncate text-[11px] text-zinc-500">{thread.last_message?.body || "No messages yet"}</span>
                      {unread ? <span className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-sky-500 px-1 text-[9px] font-semibold text-white">{thread.unread_count}</span> : null}
                    </span>
                    <span className="mt-0.5 block truncate text-[9.5px] uppercase tracking-[0.06em] text-zinc-600">{thread.peer?.role ? String(thread.peer.role).replace(/_/g, " ") : "Facility"}</span>
                  </span>
                </button>
              );
            })}
            {!filteredThreads.length ? <p className="p-6 text-center text-xs text-zinc-500">{loading ? "Loading conversations…" : "No conversations in this lane."}</p> : null}
          </div>
        </OisCard>

        {/* CENTRE -- active conversation */}
        <OisCard className={`flex max-h-[720px] flex-col overflow-hidden p-0 ${!mobileDetailOpen ? "hidden xl:flex" : "flex"}`}>
          {activeThread ? (
            <>
              <header className="flex items-center gap-2.5 border-b border-white/[0.06] px-3.5 py-3">
                <button type="button" onClick={() => setMobileDetailOpen(false)} className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-zinc-400 hover:bg-white/5 xl:hidden" aria-label="Back to conversations"><ArrowLeft className="h-4 w-4" /></button>
                <Avatar name={nameOf(activeThread.peer)} online={activeThread.peer?.is_online} />
                <div className="min-w-0 flex-1">
                  <b className="block truncate text-[13px] font-semibold text-white">{nameOf(activeThread.peer)}</b>
                  <p className="truncate text-[10.5px] text-zinc-500">{activeHome ? `${activeHome.name || activeHome.unit || "Home"} · ` : ""}{activeThread.peer?.role ? String(activeThread.peer.role).replace(/_/g, " ") : "Resident"}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" disabled title="Voice calling isn't available yet -- no telephony route exists for resident/team calls" className="grid h-8 w-8 cursor-not-allowed place-items-center rounded-md text-zinc-600" aria-label="Call (unavailable)"><Phone className="h-4 w-4" /></button>
                  {activeThread.peer?.home_id ? (
                    <Link href="/estate-structure" title="View home" className="grid h-8 w-8 place-items-center rounded-md text-zinc-400 hover:bg-white/5 hover:text-white" aria-label="View home"><Building2 className="h-4 w-4" /></Link>
                  ) : null}
                  <div className="relative">
                    <button type="button" onClick={() => setMenuOpen((v) => !v)} title="More actions" className="grid h-8 w-8 place-items-center rounded-md text-zinc-400 hover:bg-white/5 hover:text-white" aria-label="More actions"><MoreVertical className="h-4 w-4" /></button>
                    {menuOpen ? (
                      <div className="absolute right-0 top-9 z-20 w-48 overflow-hidden rounded-lg border border-white/10 bg-[#0c1017] py-1 shadow-xl">
                        {activeThread.peer?.home_id ? <Link href="/estate-structure" onClick={() => setMenuOpen(false)} className="block px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-white/5">View home</Link> : null}
                        <button type="button" onClick={() => void toggleArchive()} className="block w-full px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-white/5">Archive conversation</button>
                        <button type="button" onClick={() => { const last = messages[messages.length - 1]; if (last) { setReportTarget(last); setMenuOpen(false); } }} disabled={!messages.length} className="block w-full px-3 py-1.5 text-left text-xs text-rose-300 hover:bg-rose-500/10 disabled:opacity-40">Report latest message</button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </header>

              <div ref={timelineRef} className="flex-1 space-y-4 overflow-y-auto px-3.5 py-3.5">
                {groupedMessages().map((group) => (
                  <div key={group.day} className="space-y-2">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.08em] text-zinc-600"><span className="h-px flex-1 bg-white/[0.06]" />{group.day}<span className="h-px flex-1 bg-white/[0.06]" /></div>
                    {group.items.map((message) => {
                      const outgoing = String(message.sender_id || "") === String(user?.id || "");
                      const mediaUrl = message.metadata?.media_url || null;
                      return (
                        <div key={message.id} className={`flex ${outgoing ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[75%] rounded-xl px-3 py-2 text-[12.5px] leading-5 ${outgoing ? "bg-sky-600 text-white" : "bg-white/[0.06] text-zinc-200"}`}>
                            {mediaUrl && message.message_type === "image" ? <img src={mediaUrl} alt={message.metadata?.filename || "attachment"} className="mb-1.5 max-h-56 rounded-lg object-cover" /> : null}
                            {mediaUrl && message.message_type === "file" ? <a href={mediaUrl} target="_blank" rel="noreferrer" className="mb-1.5 flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-[11px] underline"><FileText className="h-3.5 w-3.5 shrink-0" />{message.metadata?.filename || "Attachment"}</a> : null}
                            {message.body ? <p className={message.is_hidden ? "italic text-zinc-500" : ""}>{message.is_hidden ? "Message hidden by moderation." : message.body}</p> : null}
                            <span className={`mt-1 block text-right text-[9.5px] ${outgoing ? "text-sky-100/70" : "text-zinc-600"}`}>{timeLabel(message.created_at)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
                {!messages.length ? <p className="py-10 text-center text-xs text-zinc-500">No messages in this conversation yet.</p> : null}
              </div>

              <div className="border-t border-white/[0.06] p-3">
                <div className="flex items-end gap-2">
                  <div className="flex gap-0.5">
                    <button type="button" title="Attach file" onClick={() => fileInputRef.current?.click()} disabled={!canWrite} className="grid h-9 w-9 place-items-center rounded-md text-zinc-400 hover:bg-white/5 hover:text-white disabled:opacity-40"><Paperclip className="h-4 w-4" /></button>
                    <button type="button" title="Attach image" onClick={() => imageInputRef.current?.click()} disabled={!canWrite} className="grid h-9 w-9 place-items-center rounded-md text-zinc-400 hover:bg-white/5 hover:text-white disabled:opacity-40"><ImageIcon className="h-4 w-4" /></button>
                    <div className="relative">
                      <button type="button" title="Emoji" onClick={() => setEmojiOpen((v) => !v)} disabled={!canWrite} className="grid h-9 w-9 place-items-center rounded-md text-zinc-400 hover:bg-white/5 hover:text-white disabled:opacity-40"><Smile className="h-4 w-4" /></button>
                      {emojiOpen ? (
                        <div className="absolute bottom-10 left-0 z-20 flex gap-1 rounded-lg border border-white/10 bg-[#0c1017] p-1.5 shadow-xl">
                          {QUICK_EMOJI.map((emoji) => <button key={emoji} type="button" onClick={() => { setCompose((c) => c + emoji); setEmojiOpen(false); }} className="grid h-7 w-7 place-items-center rounded-md text-base hover:bg-white/5">{emoji}</button>)}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <textarea
                    value={compose}
                    onChange={(e) => setCompose(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
                    rows={1}
                    placeholder={canWrite ? "Type your message…" : "Permission required: community.write"}
                    disabled={!canWrite}
                    className="max-h-28 min-h-9 flex-1 resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[12.5px] text-white outline-none placeholder:text-zinc-600 focus:border-sky-400/40 disabled:opacity-50"
                  />
                  <Button onClick={() => void send()} disabled={!canWrite || sending || !compose.trim()} className="h-9 gap-1.5 px-3"><Send className="h-3.5 w-3.5" />Send</Button>
                </div>
                <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void sendAttachment(file, "file"); e.target.value = ""; }} />
                <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void sendAttachment(file, "image"); e.target.value = ""; }} />
              </div>
            </>
          ) : (
            <div className="grid flex-1 place-items-center p-8 text-center">
              <div>
                <MessageSquare className="mx-auto h-6 w-6 text-zinc-700" />
                <p className="mt-3 text-sm text-zinc-400">Select a conversation, or start a new one.</p>
              </div>
            </div>
          )}
        </OisCard>

        {/* RIGHT -- operational context */}
        <div className={`space-y-3 ${mobileDetailOpen ? "hidden xl:block" : "hidden xl:block"}`}>
          {activeThread ? (
            <>
              <OisCard className="p-3.5">
                <h3 className="flex items-center gap-1.5 text-[12px] font-semibold text-white"><Info className="h-3.5 w-3.5 text-sky-300" />Context</h3>
                <div className="mt-2.5 space-y-1.5 text-[11.5px]">
                  <div className="flex justify-between"><span className="text-zinc-500">Resident</span><span className="text-zinc-200">{nameOf(activeThread.peer)}</span></div>
                  {activeHome ? (
                    <>
                      <div className="flex justify-between"><span className="text-zinc-500">Home</span><span className="text-zinc-200">{activeHome.name || activeHome.unit || "—"}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">Building / block</span><span className="text-zinc-200">{activeHome.block || "Property level"}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">Occupancy</span><OisStatusBadge status={occupancyTone(activeHome.occupancy_status)} label={String(activeHome.occupancy_status || "Unavailable").replace(/_/g, " ")} /></div>
                    </>
                  ) : <p className="text-[10.5px] text-zinc-600">No Home is linked to this conversation.</p>}
                </div>
              </OisCard>

              {activeHome ? (
                <OisCard className="p-3.5">
                  <div className="flex items-center justify-between"><h3 className="text-[12px] font-semibold text-white">Active Services</h3></div>
                  <div className="mt-2.5 space-y-1.5">
                    {[[Zap, "Electricity", "utility_token"], [Droplets, "Water", "water_service"], [Wifi, "Internet", "internet_service"], [Flame, "Gas", "gas_service"]].map(([Icon, label, key]: any) => {
                      const state = serviceState(activeHome, key);
                      return <div key={label} className="flex items-center justify-between rounded-md border border-white/[0.06] bg-black/10 px-2.5 py-1.5"><span className="flex items-center gap-2 text-[11px] text-zinc-300"><Icon className="h-3.5 w-3.5 text-sky-400" />{label}</span><OisStatusBadge status={state.tone} label={state.label} /></div>;
                    })}
                  </div>
                </OisCard>
              ) : null}

              <OisCard className="p-3.5">
                <div className="flex items-center justify-between"><h3 className="text-[12px] font-semibold text-white">Recent Maintenance</h3><Link href="/maintenance" className="text-[10.5px] text-sky-300 hover:text-sky-200">View all</Link></div>
                <div className="mt-2.5 space-y-1.5">
                  {homeMaintenance.map((item) => (
                    <Link key={item.id} href="/maintenance" className="block rounded-md border border-white/[0.06] bg-black/10 px-2.5 py-2 hover:bg-white/[0.03]">
                      <p className="truncate text-[11px] text-zinc-200">{item.title}</p>
                      <p className="mt-0.5 text-[10px] capitalize text-zinc-500">{String(item.status || "").replace(/_/g, " ")} · {relativeLabel(item.created_at)}</p>
                    </Link>
                  ))}
                  {!homeMaintenance.length ? <p className="text-[10.5px] text-zinc-600">{activeThread.peer?.home_id ? "No recent maintenance for this Home." : "No Home linked -- maintenance context unavailable."}</p> : null}
                </div>
              </OisCard>

              <OisCard className="p-3.5">
                <h3 className="text-[12px] font-semibold text-white">Quick Actions</h3>
                <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                  <Link href={activeThread.peer?.home_id ? `/maintenance?action=create&home_id=${encodeURIComponent(activeThread.peer.home_id)}` : "/maintenance"} className="flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-black/10 px-2 py-2 text-left text-[10.5px] text-zinc-300 hover:bg-white/[0.03]"><Wrench className="h-3.5 w-3.5 text-sky-400" />Create Work Order</Link>
                  <Link href="/estate-structure" className="flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-black/10 px-2 py-2 text-left text-[10.5px] text-zinc-300 hover:bg-white/[0.03]"><Building2 className="h-3.5 w-3.5 text-sky-400" />View Home Profile</Link>
                  <Link href="/maintenance" className="flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-black/10 px-2 py-2 text-left text-[10.5px] text-zinc-300 hover:bg-white/[0.03]"><ClipboardIcon />View Maintenance</Link>
                  <button type="button" onClick={() => { const last = messages[messages.length - 1]; if (last) setReportTarget(last); }} disabled={!messages.length} className="flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-black/10 px-2 py-2 text-left text-[10.5px] text-rose-300 hover:bg-rose-500/5 disabled:opacity-40"><ShieldAlert className="h-3.5 w-3.5" />Escalate</button>
                </div>
              </OisCard>
            </>
          ) : (
            <OisCard className="p-4 text-center text-xs text-zinc-500">Select a conversation to see operational context.</OisCard>
          )}
        </div>
      </section>

      {/* NEW MESSAGE */}
      <OisDrawer open={newMessageOpen} onClose={() => setNewMessageOpen(false)} title="New Message" subtitle="Start a direct conversation with a resident or Facility team member." width="md">
        <div className="space-y-4">
          {[["Residents", residentPeople], ["Facility Team", facilityPeople]].map(([label, list]: any) => (
            <div key={label}>
              <h4 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">{label}</h4>
              <div className="mt-2 space-y-1">
                {(list as ResidentLite[]).map((person) => (
                  <button key={person.id} type="button" onClick={() => void startDirect(String(person.id))} disabled={!canWrite} className="flex w-full items-center gap-2.5 rounded-lg border border-white/[0.06] px-2.5 py-2 text-left hover:bg-white/[0.03] disabled:opacity-40">
                    <Avatar name={nameOf(person)} online={person.is_online} />
                    <span className="min-w-0 flex-1"><b className="block truncate text-[12px] text-zinc-200">{nameOf(person)}</b><span className="block truncate text-[10.5px] text-zinc-600">{person.role ? String(person.role).replace(/_/g, " ") : "Resident"}</span></span>
                    <ChevronRight className="h-3.5 w-3.5 text-zinc-700" />
                  </button>
                ))}
                {!list.length ? <p className="text-[11px] text-zinc-600">No one in this lane.</p> : null}
              </div>
            </div>
          ))}
        </div>
      </OisDrawer>

      {/* ANNOUNCEMENTS -- canonical Community capability, not a second backend */}
      <OisDrawer open={announcementsOpen} onClose={() => setAnnouncementsOpen(false)} title="Announcements" subtitle="Posted through the canonical Community announcements capability." width="md" footer={canAnnounce ? (
        <div className="w-full space-y-2">
          <input value={announceTitle} onChange={(e) => setAnnounceTitle(e.target.value)} placeholder="Announcement title" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-sky-400/40" />
          <textarea value={announceBody} onChange={(e) => setAnnounceBody(e.target.value)} rows={3} placeholder="Announcement details" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-sky-400/40" />
          <Button className="w-full" disabled={!announceTitle.trim() || announceSaving} onClick={() => void createAnnouncement()}>{announceSaving ? "Posting…" : "Post Announcement"}</Button>
        </div>
      ) : null}>
        <div className="space-y-2">
          {announcements.map((post) => (
            <OisCard key={post.id} variant="evidence" className="p-3">
              <p className="text-[12.5px] font-medium text-white">{post.title}</p>
              {post.content ? <p className="mt-1 text-[11.5px] leading-5 text-zinc-400">{post.content}</p> : null}
              <p className="mt-2 text-[10px] text-zinc-600">{post.author_name || post.created_by_name || "Facility"} · {relativeLabel(post.created_at)}</p>
            </OisCard>
          ))}
          {!announcements.length ? <p className="py-8 text-center text-xs text-zinc-500">No announcements posted yet.</p> : null}
          {!canAnnounce ? <p className="rounded-lg border border-dashed border-white/10 p-3 text-center text-[11px] text-zinc-600">Permission required to post: community.manage_announcements.</p> : null}
        </div>
      </OisDrawer>

      {/* REPORT MESSAGE -- real moderation capability */}
      <OisDrawer open={Boolean(reportTarget)} onClose={() => { setReportTarget(null); setReportReason(""); }} title="Report message" subtitle={reportTarget?.body ? `"${reportTarget.body.slice(0, 80)}"` : undefined} width="sm" footer={<Button className="w-full" disabled={!reportReason.trim()} onClick={() => void submitReport()}>Submit report</Button>}>
        <textarea value={reportReason} onChange={(e) => setReportReason(e.target.value)} rows={4} placeholder="Reason for reporting this message" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-sky-400/40" />
      </OisDrawer>
    </div>
  );
}

function ClipboardIcon() {
  return <FileText className="h-3.5 w-3.5 text-sky-400" />;
}
