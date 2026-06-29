"use client";

import { useEffect, useMemo, useState } from "react";
import OisCard from "@/components/ois/OisCard";
import OisDrawer from "@/components/ois/OisDrawer";
import OisListItem from "@/components/ois/OisListItem";
import OisStatusBadge from "@/components/ois/OisStatusBadge";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { communityService, type CommunityPost } from "@/services/communityService";
import messagesService, { type ModerationReport } from "@/services/messagesService";
import { facilityService } from "@/services/facilityService";
import { hasPermission } from "@/lib/oyiFoundation";
import { useSessionStore } from "@/store/useSessionStore";
import { Archive, CalendarClock, Edit, Eye, FileText, Megaphone, Pin, RefreshCw, ShieldAlert, X } from "lucide-react";

type Tab = "announcements" | "posts" | "reports" | "media" | "pinned" | "moderation";
type ComposeState = { title: string; content: string; category: string; status: string; scheduled_at: string; audienceType: string; pinned: boolean };

const EMPTY_COMPOSE: ComposeState = { title: "", content: "", category: "notice", status: "active", scheduled_at: "", audienceType: "all_estate", pinned: false };

function cn(...classes: Array<string | false | null | undefined>) { return classes.filter(Boolean).join(" "); }
function lower(value: unknown) { return String(value || "").toLowerCase(); }
function dateLabel(value?: string | null) { if (!value) return "Time unavailable"; const d = new Date(value); return Number.isNaN(d.getTime()) ? "Time unavailable" : d.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }); }
function titleOf(post: CommunityPost) { return post.title || post.content?.slice(0, 80) || "Community post"; }
function bodyOf(post: CommunityPost) { return post.content || post.body || "No content supplied."; }
function authorOf(post: CommunityPost) { return post.author_name || post.created_by_name || post.created_by_email || post.user_id || "Operator / resident"; }
function isModerationReport(target: CommunityPost | ModerationReport | null): target is ModerationReport { return Boolean(target && "message_id" in target); }
function statusTone(status?: string | null) { const value = lower(status || "active"); if (/active|published/.test(value)) return "stable"; if (/scheduled|draft|pending/.test(value)) return "pending"; if (/flagged|reported|review/.test(value)) return "attention"; if (/denied|archived|hidden|dismissed/.test(value)) return "blocked"; return "unavailable"; }
function mediaFrom(post: CommunityPost): Array<{ url: string; type: string }> { return Array.isArray(post.media) ? post.media.map((item: any) => ({ url: String(item?.url || ""), type: String(item?.type || item?.mediaType || "image") })).filter((item) => item.url) : []; }

function Metric({ label, value, hint }: { label: string; value: string | number; hint: string }) { return <OisCard className="p-4"><div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ois-text-muted)]">{label}</div><div className="mt-3 text-2xl font-semibold text-[var(--ois-text-primary)]">{value}</div><div className="mt-1 text-xs text-[var(--ois-text-secondary)]">{hint}</div></OisCard>; }
function Field({ label, value }: { label: string; value: React.ReactNode }) { return <OisCard variant="evidence" className="p-3"><div className="text-[10px] uppercase tracking-[0.14em] text-[var(--ois-text-muted)]">{label}</div><div className="mt-1 text-sm text-[var(--ois-text-primary)]">{value}</div></OisCard>; }

export default function CommunityPage() {
  const { user } = useSessionStore();
  const [tab, setTab] = useState<Tab>("announcements");
  const [estateId, setEstateId] = useState<string | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [compose, setCompose] = useState<ComposeState>(EMPTY_COMPOSE);
  const [editTarget, setEditTarget] = useState<CommunityPost | null>(null);
  const [moderationTarget, setModerationTarget] = useState<CommunityPost | ModerationReport | null>(null);
  const [moderationNote, setModerationNote] = useState("");
  const [moderationAction, setModerationAction] = useState<"active" | "flagged" | "denied" | "archived" | "dismiss">("active");

  const canRead = hasPermission(user, "community.read");
  const canWrite = hasPermission(user, "community.write");
  const canBroadcast = hasPermission(user, "community.broadcast") || hasPermission(user, "community.manage_announcements");
  const canModerate = hasPermission(user, "community.moderate") || hasPermission(user, "support.assign");

  async function resolveEstate() {
    const overview = await facilityService.overview();
    const id = String((overview as any)?.estate?.id || (overview as any)?.estate_id || user?.estate_id || "").trim();
    if (!id) throw new Error("No estate context linked to this operator.");
    setEstateId(id);
    return id;
  }

  async function load() {
    setLoading(true); setError(null);
    try {
      const id = estateId || await resolveEstate();
      const [postRows, reportRows] = await Promise.all([
        communityService.listByEstate(id).catch(() => []),
        canModerate ? messagesService.listReports("open", 80).catch((err) => ({ error: err?.message || "Failed to load reports" })) : Promise.resolve([]),
      ]);
      setPosts(Array.isArray(postRows) ? postRows : []);
      setReports(Array.isArray(reportRows) ? reportRows : []);
    } catch (err: any) { setError(err?.message || "Failed to load community operations"); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  function openCompose(post?: CommunityPost) {
    setEditTarget(post || null);
    setCompose(post ? { title: post.title || "", content: bodyOf(post), category: post.category || "notice", status: post.status || "active", scheduled_at: post.scheduled_at || "", audienceType: post.audience_type || "all_estate", pinned: Boolean(post.is_pinned) } : EMPTY_COMPOSE);
    setComposeOpen(true);
  }

  async function saveAnnouncement() {
    if (!canWrite && !canBroadcast) { setError("Permission required: community.write or community.broadcast."); return; }
    if (!compose.title.trim() && !compose.content.trim()) { setError("Announcement title or body is required."); return; }
    setSaving(true); setError(null); setNotice(null);
    try {
      const id = estateId || await resolveEstate();
      const payload = { title: compose.title.trim() || compose.content.trim().slice(0, 80) || "Announcement", content: compose.content.trim() || null, category: compose.category, status: compose.status, is_pinned: compose.pinned, scheduled_at: compose.scheduled_at || null, audience: { type: compose.audienceType } };
      if (editTarget) await communityService.updatePost(String(editTarget.id), payload);
      else await communityService.createPost({ estateId: id, ...payload });
      setNotice(editTarget ? "Announcement updated." : "Announcement created.");
      setComposeOpen(false); setEditTarget(null); setCompose(EMPTY_COMPOSE);
      await load();
    } catch (err: any) { setError(err?.message || "Failed to save announcement"); }
    finally { setSaving(false); }
  }

  async function moderatePost(post: CommunityPost, status: string) {
    if (!canModerate) { setError("Permission required: community.moderate."); return; }
    setSaving(true); setError(null); setNotice(null);
    try {
      await communityService.updatePost(String(post.id), { status });
      setNotice(`Content marked ${status}.`);
      setModerationTarget(null);
      await load();
    } catch (err: any) { setError(err?.message || "Failed to update moderation state"); }
    finally { setSaving(false); }
  }

  async function resolveReport(report: ModerationReport, action: "dismiss" | "hide_message" | "mute_sender") {
    if (!canModerate) { setError("Permission required: community.moderate/support.assign."); return; }
    setSaving(true); setError(null); setNotice(null);
    const result: any = await messagesService.resolveReport(String(report.id), { action, note: moderationNote.trim() || undefined, mute_hours: action === "mute_sender" ? 24 : undefined });
    setSaving(false);
    if (result?.error) { setError(result.error); return; }
    setNotice("Moderation report resolved.");
    setModerationTarget(null); setModerationNote("");
    await load();
  }

  const announcements = posts.filter((post) => /notice|announcement|maintenance|security|amenity|service/.test(lower(post.category)) || post.is_pinned);
  const pinned = posts.filter((post) => post.is_pinned || lower(post.status) === "pinned");
  const flagged = posts.filter((post) => /flagged|reported|review/.test(lower(post.status)));
  const mediaPosts = posts.filter((post) => mediaFrom(post).length);
  const recentEdited = posts.filter((post) => post.updated_at && post.updated_at !== post.created_at).slice(0, 8);
  const pendingReview = [...flagged, ...reports].length;

  const visibleRows = tab === "announcements" ? announcements : tab === "posts" ? posts : tab === "media" ? mediaPosts : tab === "pinned" ? pinned : tab === "moderation" ? flagged : [];

  if (!canRead) {
    return <div className="space-y-6"><Topbar title="Community Signals" subtitle="Community permissions required" /><div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 text-sm text-amber-100">Permission required: community.read.</div></div>;
  }

  return (
    <div className="space-y-6">
      <Topbar title="Community Signals" subtitle="Announcements, posts, reports, media, pinned content, and moderation attention" strip={[{ label: "Reports", value: reports.length }, { label: "Attention", value: pendingReview }, { label: "Health", value: pendingReview ? "Review" : "Stable" }, { label: "Action", value: "Moderate queue" }]} rightSlot={<Button variant="ghost" onClick={() => void load()} disabled={loading} className="gap-2"><RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />Refresh</Button>} />
      {error ? <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
      {notice ? <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{notice}</div> : null}

      <section className="grid gap-3 md:grid-cols-5">
        <Metric label="Announcements" value={announcements.length} hint="Operational notices and broadcasts" />
        <Metric label="Open reports" value={reports.length} hint="Backend moderation reports" />
        <Metric label="Pending moderation" value={pendingReview} hint="Reports or flagged posts" />
        <Metric label="Pinned notices" value={pinned.length} hint="Pinned content currently visible" />
        <Metric label="Media posts" value={mediaPosts.length} hint="Posts with uploaded media" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <OisCard className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {(["announcements", "posts", "reports", "media", "pinned", "moderation"] as Tab[]).map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={cn("rounded-full border px-3 py-2 text-xs capitalize", tab === item ? "border-sky-400/40 bg-sky-500/10 text-sky-100" : "border-white/10 bg-white/5 text-zinc-400 hover:text-white")}>{item}</button>)}
            </div>
            <Button onClick={() => openCompose()} disabled={!canWrite && !canBroadcast} className="gap-2"><Megaphone className="h-4 w-4" />Create announcement</Button>
          </div>

          {tab === "reports" ? <ReportList reports={reports} canModerate={canModerate} onOpen={(report) => { setModerationTarget(report); setModerationAction("dismiss"); }} /> : <PostList rows={visibleRows} canModerate={canModerate} canWrite={canWrite || canBroadcast} onEdit={openCompose} onModerate={(post) => { setModerationTarget(post); setModerationAction("active"); }} />}
        </OisCard>
        <aside className="space-y-4">
          <OisCard className="p-4"><h2 className="text-sm font-semibold text-white">Announcement attention queue</h2><div className="mt-3 space-y-2"><Field label="Pending review" value={pendingReview} /><Field label="Recently edited" value={recentEdited.length} /><Field label="Pinned notices" value={pinned.length} /><Field label="Scheduling" value="Scheduling Pending Backend Support" /><Field label="Targeting" value="Targeting Not Configured" /></div></OisCard>
          <OisCard className="p-4"><h2 className="text-sm font-semibold text-white">Moderation Activity</h2><p className="mt-2 text-sm leading-6 text-zinc-400">Moderator, timestamp and action appear when returned by moderation endpoints. No local moderation activity is fabricated.</p></OisCard>
          <OisCard className="p-4"><h2 className="text-sm font-semibold text-white">Resident communications</h2><Field label="Unread communications" value="Awaiting communication metrics" /><Field label="Community health" value={pendingReview ? "Review required" : "No live source configured"} /></OisCard>
        </aside>
      </section>

      {composeOpen ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm"><section className="w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-950 p-5"><header className="flex justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Announcement lifecycle</p><h2 className="mt-1 text-lg font-semibold text-white">{editTarget ? "Edit announcement" : "Create announcement"}</h2></div><button type="button" onClick={() => setComposeOpen(false)} className="rounded-lg border border-white/10 p-2 text-zinc-400 hover:text-white"><X className="h-4 w-4" /></button></header><div className="mt-5 grid gap-3"><input value={compose.title} onChange={(e) => setCompose((c) => ({ ...c, title: e.target.value }))} placeholder="Title" className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-3 text-sm text-white outline-none" /><textarea value={compose.content} onChange={(e) => setCompose((c) => ({ ...c, content: e.target.value }))} placeholder="Announcement body" rows={5} className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-3 text-sm text-white outline-none" /><div className="grid gap-2 sm:grid-cols-3"><select value={compose.status} onChange={(e) => setCompose((c) => ({ ...c, status: e.target.value }))} className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-3 text-sm text-white"><option value="draft">Draft</option><option value="active">Published</option><option value="scheduled">Scheduled</option><option value="archived">Archived</option></select><select value={compose.audienceType} onChange={(e) => setCompose((c) => ({ ...c, audienceType: e.target.value }))} className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-3 text-sm text-white"><option value="all_estate">Entire Estate</option><option value="home">Specific Homes</option><option value="resident_group">Resident Groups</option></select><input type="datetime-local" value={compose.scheduled_at} onChange={(e) => setCompose((c) => ({ ...c, scheduled_at: e.target.value }))} className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-3 text-sm text-white" /></div><label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={compose.pinned} onChange={(e) => setCompose((c) => ({ ...c, pinned: e.target.checked }))} /> Pin this notice</label><div className="grid gap-2 sm:grid-cols-2"><Field label="Targeting support" value="Targeting Not Configured" /><Field label="Scheduling support" value="Scheduling Pending Backend Support" /></div><Button onClick={() => void saveAnnouncement()} disabled={saving}>{saving ? "Saving" : "Save announcement"}</Button></div></section></div> : null}

      <OisDrawer open={Boolean(moderationTarget)} onClose={() => setModerationTarget(null)} title={isModerationReport(moderationTarget) ? "Review moderation report" : "Review content"} subtitle={moderationTarget ? (isModerationReport(moderationTarget) ? "Community moderation report" : titleOf(moderationTarget)) : undefined} width="md" footer={moderationTarget ? (isModerationReport(moderationTarget) ? <div className="flex flex-wrap gap-2"><Button variant="ghost" onClick={() => void resolveReport(moderationTarget, "dismiss")} disabled={saving}>Dismiss</Button><Button onClick={() => void resolveReport(moderationTarget, "hide_message")} disabled={saving}>Hide message</Button><Button variant="danger" onClick={() => void resolveReport(moderationTarget, "mute_sender")} disabled={saving}>Mute sender</Button></div> : <Button onClick={() => void moderatePost(moderationTarget, moderationAction)} disabled={saving}>Apply moderation</Button>) : null}>
        {moderationTarget ? <div className="space-y-4"><OisCard variant="evidence" className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-zinc-300">{isModerationReport(moderationTarget) ? (moderationTarget.action || "Pending review") : bodyOf(moderationTarget)}</p><p className="mt-2 text-xs text-zinc-500">{isModerationReport(moderationTarget) ? dateLabel(moderationTarget.created_at) : authorOf(moderationTarget)}</p></div><OisStatusBadge status={isModerationReport(moderationTarget) ? statusTone(moderationTarget.status || "open") : statusTone(moderationTarget.status)} label={isModerationReport(moderationTarget) ? (moderationTarget.status || "open") : (moderationTarget.status || "active")} className="uppercase" /></div></OisCard><select value={moderationAction} onChange={(e) => setModerationAction(e.target.value as any)} className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-3 text-sm text-white"><option value="active">Resolve / Publish</option><option value="flagged">Escalate / Flag</option><option value="denied">Dismiss / Deny</option><option value="archived">Archive</option></select><textarea value={moderationNote} onChange={(e) => setModerationNote(e.target.value)} rows={4} placeholder="Moderation note" className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-3 text-sm text-white outline-none" /></div> : null}
      </OisDrawer>
    </div>
  );
}

function PostList({ rows, canWrite, canModerate, onEdit, onModerate }: { rows: CommunityPost[]; canWrite: boolean; canModerate: boolean; onEdit: (post: CommunityPost) => void; onModerate: (post: CommunityPost) => void }) {
  return <div className="mt-4 space-y-2">{rows.map((post) => <OisCard key={post.id} variant="evidence" className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-white">{titleOf(post)}</h3><p className="mt-1 text-xs text-zinc-500">{authorOf(post)} · {dateLabel(post.created_at)}</p></div><OisStatusBadge status={statusTone(post.status)} label={post.status || "active"} className="uppercase" /></div><p className="mt-3 line-clamp-3 text-sm leading-6 text-zinc-400">{bodyOf(post)}</p><div className="mt-4 grid gap-2 sm:grid-cols-4"><Field label="Created by" value={authorOf(post)} /><Field label="Created" value={dateLabel(post.created_at)} /><Field label="Last edited" value={dateLabel(post.updated_at)} /><Field label="Audience" value={post.audience_type || "Entire Estate"} /></div><div className="mt-3 flex flex-wrap gap-2">{canWrite ? <Button variant="ghost" onClick={() => onEdit(post)} className="gap-2"><Edit className="h-4 w-4" />Edit</Button> : null}{canModerate ? <Button variant="ghost" onClick={() => onModerate(post)} className="gap-2"><ShieldAlert className="h-4 w-4" />Moderate</Button> : null}</div></OisCard>)}{!rows.length ? <div className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-zinc-500">No signals in this lane.</div> : null}</div>;
}

function ReportList({ reports, canModerate, onOpen }: { reports: ModerationReport[]; canModerate: boolean; onOpen: (report: ModerationReport) => void }) {
  return <div className="mt-4 space-y-2">{reports.map((report) => <OisCard key={report.id} variant="evidence" className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-white">{report.reason || "Reported message"}</h3><p className="mt-1 text-xs text-zinc-500">{dateLabel(report.created_at)} · {report.status || "open"}</p></div><OisStatusBadge status={statusTone(report.status || "open")} label={report.status || "open"} className="uppercase" /></div><div className="mt-4 grid gap-2 sm:grid-cols-3"><Field label="Moderator" value={report.moderator_id || "Awaiting moderation data"} /><Field label="Action taken" value={report.action || "Pending review"} /><Field label="Timestamp" value={dateLabel(report.resolved_at || report.created_at)} /></div>{canModerate ? <Button className="mt-3 gap-2" variant="ghost" onClick={() => onOpen(report)}><Eye className="h-4 w-4" />Review</Button> : null}</OisCard>)}{!reports.length ? <div className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-zinc-500">No open moderation reports.</div> : null}</div>;
}
