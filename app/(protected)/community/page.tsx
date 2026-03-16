// app/(protected)/community/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Topbar from "@/components/shell/Topbar";
import {
  communityService,
  type CommunityPost,
  type CommunityComment,
} from "@/services/communityService";
import {
  MessageSquare,
  ThumbsUp,
  Eye,
  TrendingUp,
  Send,
  MoreVertical,
  Pin,
  Trash2,
  Edit,
  ImagePlus,
  CalendarClock,
} from "lucide-react";

// -------------------------------
// Helpers (kept from your current flow)
// -------------------------------
function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

// --- tiny cookie helper (same as before) ---
function getCookie(name: string) {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(
    new RegExp(
      `(?:^|; )${name.replace(/[$()*+.?[\\\]^{|}-]/g, "\\$&")}=([^;]*)`
    )
  );
  return m ? decodeURIComponent(m[1]) : null;
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "https://oyi-os.onrender.com";

async function api<T>(path: string): Promise<T> {
  const token =
    getCookie("oyi_facility_token") ||
    getCookie("facility_token") ||
    getCookie("oyi_consumer_token") ||
    (typeof window !== "undefined"
      ? localStorage.getItem("oyi_facility_token") ||
        localStorage.getItem("facility_token") ||
        localStorage.getItem("oyi_consumer_token") ||
        localStorage.getItem("token")
      : null);

  const res = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      json?.error || json?.message || `Request failed (${res.status})`
    );
  }
  return json as T;
}

function whenShort(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initialsFromName(name?: string) {
  const s = String(name || "").trim();
  if (!s) return "SM";
  const parts = s.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function clamp(text?: string | null, max = 260) {
  const t = String(text || "").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function mediaItemsFromPost(post: any): Array<{ url: string; mediaType: "image" | "video"; name?: string | null }> {
  return Array.isArray(post?.media)
    ? post.media
        .map((item: any) => ({
          url: String(item?.url || ""),
          mediaType: item?.type === "video" || item?.mediaType === "video" ? "video" : "image",
          name: item?.name ? String(item.name) : null,
        }))
        .filter((item: any) => item.url)
    : [];
}

// -------------------------------
// MetricCard (local, so nothing breaks)
// -------------------------------
function MetricCard({
  title,
  value,
  change,
  trend = "neutral",
  icon: Icon,
  iconColor = "text-blue-500",
}: {
  title: string;
  value: string | number;
  change?: string;
  trend?: "up" | "down" | "neutral";
  icon: any;
  iconColor?: string;
}) {
  const trendColors: Record<string, string> = {
    up: "text-green-500",
    down: "text-red-500",
    neutral: "text-slate-400",
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-slate-400 mb-2">{title}</p>
          <p className="text-3xl font-semibold mb-1">{value}</p>
          {change ? (
            <p className={`text-sm ${trendColors[trend] || "text-slate-400"}`}>
              {change}
            </p>
          ) : null}
        </div>
        <div className={`p-3 rounded-lg bg-slate-800 ${iconColor}`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
}

// -------------------------------
// Page
// -------------------------------
export default function CommunityPage() {
  const [activeTab, setActiveTab] = useState<"feed" | "announcements" | "moderation">("feed");

  const [items, setItems] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // ✅ store estateId once resolved (keeps your current flow)
  const [estateId, setEstateId] = useState<string | null>(null);

  // composer (matches your existing create flow, but UI looks like your new standard)
  const [newPost, setNewPost] = useState("");
  const [creating, setCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [scheduledFor, setScheduledFor] = useState<string>("");
  const [mediaItems, setMediaItems] = useState<Array<{ url: string; mediaType: "image" | "video" }>>([]);
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [commentMap, setCommentMap] = useState<Record<string, CommunityComment[]>>({});
  const [commentLoading, setCommentLoading] = useState<Record<string, boolean>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentSending, setCommentSending] = useState<Record<string, boolean>>({});
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});
  const postRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const viewedPostIds = useRef<Set<string>>(new Set());

  async function toBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read media file"));
      reader.readAsDataURL(file);
    });
  }

  async function onPickMedia(fileList: FileList | null) {
    if (!fileList?.length) return;
    try {
      const uploaded: Array<{ url: string; mediaType: "image" | "video" }> = [];
      for (const file of Array.from(fileList).slice(0, 3)) {
        const base64 = await toBase64(file);
        const mediaType = file.type.startsWith("video/") ? "video" : "image";
        const res = await communityService.uploadMedia({
          base64,
          mime: file.type,
          filename: file.name,
          mediaType,
        });
        if (res?.url) uploaded.push({ url: res.url, mediaType });
      }
      if (uploaded.length) {
        setMediaItems((prev) => [...prev, ...uploaded].slice(0, 6));
        setNotice(`${uploaded.length} media file(s) uploaded.`);
      }
    } catch (e: any) {
      setErr(e?.message || "Media upload failed");
    }
  }

  async function resolveEstate() {
    const overview = await api<{ estate_id: string }>("/facility/overview");
    if (!overview?.estate_id)
      throw new Error("No estate linked to this operator account yet.");
    setEstateId(overview.estate_id);
    return overview.estate_id;
  }

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const eid = estateId || (await resolveEstate());
      const posts = await communityService.listByEstate(eid);
      setItems(posts || []);
      const nextViews: Record<string, number> = {};
      for (const post of posts || []) {
        const postId = String((post as any)?.id || "");
        if (!postId) continue;
        nextViews[postId] = Number((post as any)?.views ?? (post as any)?.view_count ?? 0);
      }
      setViewCounts((prev) => ({ ...prev, ...nextViews }));
    } catch (e: any) {
      setErr(e?.message || "Failed to load community posts");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function publish() {
    // UI is textarea-only (like your sample), but backend still needs a title.
    const body = newPost.trim();
    if (!body) {
      setErr("Write something before publishing.");
      return;
    }

    setCreating(true);
    setErr(null);

    try {
      const eid = estateId || (await resolveEstate());

      const title =
        body.split("\n").find((x) => x.trim())?.trim()?.slice(0, 80) || "Announcement";

      const content =
        body.length > 80 ? body : body; // keep full message in content

      const created = await communityService.createPost({
        estateId: eid,
        title,
        content: content || null,
        media: mediaItems.length ? mediaItems : null,
      });

      if (scheduledFor) {
        await communityService.updatePost(String(created.id), {
          status: "scheduled",
        });
      }

      // optimistic insert (kept)
      setItems((prev) => [{ ...created, status: scheduledFor ? "scheduled" : created.status }, ...prev]);
      setNewPost("");
      setMediaItems([]);
      setScheduledFor("");
    } catch (e: any) {
      setErr(e?.message || "Failed to publish announcement");
    } finally {
      setCreating(false);
    }
  }

  async function moderatePost(postId: string, status: "active" | "flagged" | "denied" | "scheduled") {
    try {
      const updated = await communityService.updatePost(postId, { status });
      setItems((prev) => prev.map((x) => (String(x.id) === String(postId) ? { ...x, ...updated } : x)));
      setNotice(`Post updated: ${status}`);
    } catch (e: any) {
      setErr(e?.message || "Failed to update moderation status");
    }
  }

  async function editPost(postId: string, currentTitle?: string, currentContent?: string) {
    const nextTitle = window.prompt("Edit post title", String(currentTitle || "").trim() || "Announcement");
    if (nextTitle === null) return;
    const nextContent = window.prompt("Edit post content", String(currentContent || "").trim());
    if (nextContent === null) return;
    try {
      const updated = await communityService.updatePost(postId, {
        title: nextTitle.trim(),
        content: nextContent.trim(),
      });
      setItems((prev) => prev.map((x) => (String(x.id) === String(postId) ? { ...x, ...updated } : x)));
      setNotice("Post updated.");
    } catch (e: any) {
      setErr(e?.message || "Failed to edit post");
    }
  }

  async function removePost(postId: string) {
    const yes = window.confirm("Delete this post? This action cannot be undone.");
    if (!yes) return;
    try {
      await communityService.deletePost(postId);
      setItems((prev) => prev.filter((x) => String(x.id) !== String(postId)));
      setNotice("Post deleted.");
    } catch (e: any) {
      setErr(e?.message || "Failed to delete post");
    }
  }

  async function toggleComments(postId: string) {
    const next = !openComments[postId];
    setOpenComments((prev) => ({ ...prev, [postId]: next }));
    if (!next || commentMap[postId]) return;
    setCommentLoading((prev) => ({ ...prev, [postId]: true }));
    setErr(null);
    try {
      const comments = await communityService.listComments(postId);
      setCommentMap((prev) => ({ ...prev, [postId]: Array.isArray(comments) ? comments : [] }));
    } catch (e: any) {
      setErr(e?.message || "Failed to load comments");
      setCommentMap((prev) => ({ ...prev, [postId]: [] }));
    } finally {
      setCommentLoading((prev) => ({ ...prev, [postId]: false }));
    }
  }

  async function addInlineComment(postId: string) {
    const content = String(commentDrafts[postId] || "").trim();
    if (!postId || !content) return;

    setCommentSending((prev) => ({ ...prev, [postId]: true }));
    setErr(null);
    try {
      const created = await communityService.createComment(postId, content);
      setCommentMap((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] || []), created],
      }));
      setCommentDrafts((prev) => ({ ...prev, [postId]: "" }));
      setItems((prev) =>
        prev.map((item: any) =>
          String(item.id) === postId
            ? {
                ...item,
                comment_count: Number(item?.comment_count ?? item?.comments ?? 0) + 1,
                comments: Number(item?.comments ?? item?.comment_count ?? 0) + 1,
              }
            : item
        )
      );
    } catch (e: any) {
      setErr(e?.message || "Failed to send comment");
    } finally {
      setCommentSending((prev) => ({ ...prev, [postId]: false }));
    }
  }

  async function toggleReaction(postId: string) {
    try {
      const res = await communityService.reactToPost(postId, "like");
      setItems((prev) =>
        prev.map((item: any) =>
          String(item.id) === postId
            ? {
                ...item,
                like_count: Number(res?.like_count ?? res?.likes ?? item?.like_count ?? 0),
                likes: Number(res?.like_count ?? res?.likes ?? item?.likes ?? 0),
                liked_by_me: Boolean(res?.liked_by_me ?? !item?.liked_by_me),
              }
            : item
        )
      );
    } catch (e: any) {
      setErr(e?.message || "Failed to update reaction");
    }
  }

  // -------------------------------
  // Adapt backend posts → new UI cards (no data loss; just presentation)
  // -------------------------------
  const cards = useMemo(() => {
    return (items as any[]).map((p) => {
      const author =
        String(
          p?.author_name ||
            p?.author?.full_name ||
            p?.author?.name ||
            p?.created_by_name ||
            p?.created_by_email ||
            "System Manager"
        ).trim() || "System Manager";
      const building = "Estate Management";
      const avatar = initialsFromName(author);
      const likes = Number(p?.likes ?? p?.like_count ?? p?.reactions_count ?? 0);
      const comments = Number(p?.comments ?? p?.comment_count ?? p?.reply_count ?? p?.replies_count ?? 0);
      const postId = String(p?.id ?? "");
      const views = Number(viewCounts[postId] ?? p?.views ?? p?.view_count ?? 0);

      const status = String(p?.status || "active").toLowerCase();
      const isPinned = status === "pinned" || status === "announcement_pinned";

      return {
        id: p?.id ?? `${p?.created_at ?? ""}-${p?.title ?? ""}`,
        author,
        building,
        avatar,
        time: whenShort(p?.created_at),
        content: p?.content ? String(p.content) : String(p?.title || ""),
        likes,
        comments,
        views,
        isPinned,
        type: "announcement",
        _raw: p,
        _status: status,
        _liked: Boolean(p?.liked_by_me || p?.reacted_by_me),
      };
    });
  }, [items, viewCounts]);

  const moderationQueue = useMemo(() => {
    return cards.filter((c) => c._status === "flagged");
  }, [cards]);

  const announcements = useMemo(() => {
    return cards.filter((c) => c.isPinned || c.type === "announcement");
  }, [cards]);

  // -------------------------------
  // Stats (kept stable)
  // -------------------------------
  const stats = useMemo(() => {
    const total = items.length;

    // Derived from current estate feed
    const postsToday = (() => {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth();
      const d = now.getDate();
      let c = 0;
      for (const p of items as any[]) {
        const t = p?.created_at ? new Date(p.created_at) : null;
        if (!t || Number.isNaN(t.getTime())) continue;
        if (t.getFullYear() === y && t.getMonth() === m && t.getDate() === d) c += 1;
      }
      return c;
    })();

    const flagged = (items as any[]).filter(
      (p) => String(p?.status || "").toLowerCase() === "flagged"
    ).length;

    const activeResidents = new Set(cards.map((c) => c.author)).size;
    const interactions = (items as any[]).reduce((acc, p) => {
      const l = Number(p?.likes ?? p?.like_count ?? p?.reactions_count ?? 0);
      const c = Number(p?.comments ?? p?.comment_count ?? p?.reply_count ?? p?.replies_count ?? 0);
      const v = Number(p?.views ?? p?.view_count ?? 0);
      return acc + l + c + v;
    }, 0);
    const engagementRate =
      total === 0 ? 0 : Math.min(100, Math.round((interactions / Math.max(total * 12, 1)) * 100));

    return {
      activeResidents,
      postsToday,
      pendingReview: flagged,
      engagementRate,
      interactions,
    };
  }, [cards, items]);

  const engagementSummary = useMemo(() => {
    const posts = cards.length;
    const comments = cards.reduce((acc, c) => acc + Number(c.comments || 0), 0);
    const reactions = cards.reduce((acc, c) => acc + Number(c.likes || 0), 0);
    const maxVal = Math.max(posts, comments, reactions, 1);

    return [
      { label: "Posts", val: posts, pct: Math.round((posts / maxVal) * 100), bar: "bg-blue-500" },
      { label: "Comments", val: comments, pct: Math.round((comments / maxVal) * 100), bar: "bg-green-500" },
      { label: "Reactions", val: reactions, pct: Math.round((reactions / maxVal) * 100), bar: "bg-purple-500" },
    ];
  }, [cards]);

  const topContributors = useMemo(() => {
    const countByAuthor = new Map<string, { name: string; posts: number; avatar: string }>();

    for (const c of cards) {
      const key = c.author.toLowerCase();
      const existing = countByAuthor.get(key);
      if (existing) {
        existing.posts += 1;
      } else {
        countByAuthor.set(key, { name: c.author, posts: 1, avatar: c.avatar });
      }
    }

    return Array.from(countByAuthor.values())
      .sort((a, b) => b.posts - a.posts)
      .slice(0, 4);
  }, [cards]);

  useEffect(() => {
    if (!cards.length || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const postId = String((entry.target as HTMLElement).dataset.postId || "");
          if (!postId || viewedPostIds.current.has(postId)) continue;
          viewedPostIds.current.add(postId);
          void (async () => {
            try {
              const res = await communityService.trackView(postId);
              const nextCount = Number(res?.view_count ?? res?.views ?? 0);
              if (Number.isFinite(nextCount)) {
                setViewCounts((prev) => ({ ...prev, [postId]: nextCount }));
              }
            } catch {
              // fail-soft
            }
          })();
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.65 }
    );

    for (const post of cards) {
      const postId = String(post.id || "");
      const node = postRefs.current[postId];
      if (!postId || !node || viewedPostIds.current.has(postId)) continue;
      observer.observe(node);
    }

    return () => observer.disconnect();
  }, [cards]);

  return (
    <div className="space-y-7">
      <Topbar
        title="Community Management"
        subtitle="Monitor and manage resident interactions and announcements"
      />

      {err ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {err}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {notice}
        </div>
      ) : null}

      {/* Metrics (exact vibe) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Active Residents"
          value={stats.activeResidents}
          change="+12% this week"
          trend="up"
          icon={MessageSquare}
          iconColor="text-blue-500"
        />
        <MetricCard
          title="Posts Today"
          value={stats.postsToday}
          change={`${stats.pendingReview} pending review`}
          trend="neutral"
          icon={Send}
          iconColor="text-green-500"
        />
        <MetricCard
          title="Engagement Rate"
          value={`${stats.engagementRate}%`}
          change="+5% vs last week"
          trend="up"
          icon={TrendingUp}
          iconColor="text-purple-500"
        />
        <MetricCard
          title="Total Interactions"
          value={stats.interactions}
          change="This week"
          trend="neutral"
          icon={ThumbsUp}
          iconColor="text-orange-500"
        />
      </div>

      {/* Tabs (exact vibe) */}
      <div className="mb-2">
        <div className="flex gap-2 border-b border-slate-800">
          {(["feed", "announcements", "moderation"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-6 py-3 text-sm font-medium transition-colors border-b-2",
                activeTab === tab
                  ? "border-blue-500 text-blue-500"
                  : "border-transparent text-slate-400 hover:text-white"
              )}
              type="button"
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2 py-2 pr-2">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="px-4 py-2 rounded-lg text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors disabled:opacity-60"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      {/* FEED */}
      {activeTab === "feed" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left feed */}
          <div className="lg:col-span-2 space-y-6">
            {/* Create Announcement (keeps your createPost flow, UI matches sample) */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Create Announcement</h3>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => onPickMedia(e.target.files)}
              />
              <textarea
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                placeholder="Share an announcement with residents..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-4 text-sm resize-none focus:outline-none focus:border-blue-500 mb-4"
                rows={3}
              />
              {mediaItems.length ? (
                <div className="mb-3 flex flex-wrap gap-2">
                  {mediaItems.map((m, idx) => (
                    <span
                      key={`${m.url}-${idx}`}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-300"
                    >
                      {m.mediaType}
                      <button
                        type="button"
                        className="text-slate-400 hover:text-white"
                        onClick={() =>
                          setMediaItems((prev) => prev.filter((_, i) => i !== idx))
                        }
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
              {scheduledFor ? (
                <div className="mb-3 text-xs text-blue-300">
                  Scheduled publish: {new Date(scheduledFor).toLocaleString()}
                </div>
              ) : null}
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-colors"
                  >
                    <span className="inline-flex items-center gap-2">
                      <ImagePlus size={14} />
                      Add Media
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      now.setMinutes(now.getMinutes() + 10);
                      const isoLocal = now.toISOString().slice(0, 16);
                      const picked = window.prompt("Schedule date-time (YYYY-MM-DDTHH:mm)", scheduledFor || isoLocal);
                      if (picked === null) return;
                      const stamp = new Date(picked).getTime();
                      if (Number.isNaN(stamp)) {
                        setErr("Invalid schedule date-time format.");
                        return;
                      }
                      setScheduledFor(new Date(stamp).toISOString());
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-colors"
                  >
                    <span className="inline-flex items-center gap-2">
                      <CalendarClock size={14} />
                      Schedule
                    </span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={publish}
                  disabled={creating}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
                >
                  {creating ? "Publishing..." : "Publish"}
                </button>
              </div>
            </div>

            {/* Posts list */}
            <div className="space-y-4">
              {cards.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
                  No community posts yet.
                </div>
              ) : (
                cards.map((post) => (
                  <div
                    key={String(post.id)}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-6"
                  >
                    <div
                      ref={(node) => {
                        postRefs.current[String(post.id)] = node;
                      }}
                      data-post-id={String(post.id)}
                    />
                    {post.isPinned ? (
                      <div className="flex items-center gap-2 mb-3 text-yellow-500 text-sm">
                        <Pin size={14} />
                        <span className="font-medium">Pinned Announcement</span>
                      </div>
                    ) : null}

                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-semibold text-sm">
                          {post.avatar}
                        </div>
                        <div>
                          <p className="font-semibold">{post.author}</p>
                          <p className="text-xs text-slate-400">
                            {post.building} • {post.time}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={async () => {
                          const id = String(post.id);
                          const raw = (post as any)?._raw || {};
                          const action = window.prompt(
                            "Action: pin | flag | approve | edit | delete",
                            "pin"
                          );
                          if (!action) return;
                          const a = action.toLowerCase().trim();
                          if (a === "pin") return void (await moderatePost(id, "scheduled"));
                          if (a === "flag") return void (await moderatePost(id, "flagged"));
                          if (a === "approve") return void (await moderatePost(id, "active"));
                          if (a === "delete") return void (await removePost(id));
                          if (a === "edit")
                            return void (await editPost(id, raw?.title, raw?.content ?? raw?.body));
                          setNotice("Unknown action.");
                        }}
                        className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        <MoreVertical size={16} className="text-slate-400" />
                      </button>
                    </div>

                    <p className="text-slate-300 mb-4">
                      {clamp(post.content, 520) || "—"}
                    </p>

                    {mediaItemsFromPost((post as any)?._raw).length ? (
                      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {mediaItemsFromPost((post as any)?._raw).map((media, idx) => (
                          <div
                            key={`${media.url}-${idx}`}
                            className="overflow-hidden rounded-xl border border-slate-800 bg-black/30"
                          >
                            {media.mediaType === "video" ? (
                              <video src={media.url} controls className="max-h-64 w-full bg-black object-cover" />
                            ) : (
                              <img
                                src={media.url}
                                alt={media.name || "community media"}
                                className="max-h-64 w-full object-cover"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <div className="flex items-center gap-6 text-sm text-slate-400">
                      <button
                        type="button"
                        className={cn(
                          "flex items-center gap-2 transition-colors",
                          (post as any)._liked ? "text-blue-400" : "hover:text-blue-500"
                        )}
                        onClick={() => void toggleReaction(String(post.id))}
                      >
                        <ThumbsUp size={16} />
                        <span>{post.likes}</span>
                      </button>

                      <button
                        type="button"
                        className="flex items-center gap-2 hover:text-blue-500 transition-colors"
                        onClick={() => void toggleComments(String(post.id))}
                      >
                        <MessageSquare size={16} />
                        <span>{post.comments}</span>
                      </button>

                      <div className="flex items-center gap-2">
                        <Eye size={16} />
                        <span>{viewCounts[String(post.id)] ?? post.views}</span>
                      </div>
                    </div>

                    {openComments[String(post.id)] ? (
                      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                        {commentLoading[String(post.id)] ? (
                          <div className="text-sm text-slate-400">Loading comments...</div>
                        ) : (
                          <div className="space-y-3">
                            {(commentMap[String(post.id)] || []).length ? (
                              (commentMap[String(post.id)] || []).map((comment) => (
                                <div
                                  key={String(comment.id)}
                                  className="rounded-xl border border-slate-800 bg-slate-900/80 p-3"
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="text-sm font-medium text-white">
                                      {String((comment as any).author_name || "Resident")}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                      {whenShort(comment.created_at)}
                                    </div>
                                  </div>
                                  <div className="mt-2 text-sm leading-6 text-slate-300">
                                    {String(comment.content || "")}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-sm text-slate-400">No comments yet.</div>
                            )}

                            <div className="flex flex-col gap-3 sm:flex-row">
                              <textarea
                                value={commentDrafts[String(post.id)] || ""}
                                onChange={(e) =>
                                  setCommentDrafts((prev) => ({
                                    ...prev,
                                    [String(post.id)]: e.target.value,
                                  }))
                                }
                                placeholder="Write a comment..."
                                className="min-h-[88px] flex-1 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500"
                              />
                              <button
                                type="button"
                                onClick={() => void addInlineComment(String(post.id))}
                                disabled={
                                  !!commentSending[String(post.id)] ||
                                  !String(commentDrafts[String(post.id)] || "").trim()
                                }
                                className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {commentSending[String(post.id)] ? "Posting..." : "Reply"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Engagement Stats</h3>
              <div className="space-y-4">
                {engagementSummary.map((x) => (
                  <div key={x.label}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-400">{x.label}</span>
                      <span className="text-sm font-semibold">{x.val}</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2">
                      <div className={cn(x.bar, "h-2 rounded-full")} style={{ width: `${x.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Top Contributors</h3>
              <div className="space-y-3">
                {topContributors.map((c) => (
                  <div
                    key={c.name}
                    className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-semibold text-xs">
                        {c.avatar}
                      </div>
                      <span className="text-sm font-medium">{c.name}</span>
                    </div>
                    <span className="text-xs text-slate-400">{c.posts} posts</span>
                  </div>
                ))}
                {!topContributors.length ? (
                  <div className="text-sm text-slate-400">No contributor data yet.</div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ANNOUNCEMENTS */}
      {activeTab === "announcements" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">All Announcements</h3>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("feed");
                    // focus user on composer
                    setTimeout(() => {
                      const el = document.querySelector("textarea");
                      (el as HTMLTextAreaElement | null)?.focus?.();
                    }, 50);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
                >
                  Create New
                </button>
              </div>

              <div className="space-y-3">
                {announcements.map((a) => (
                  <div
                    key={String(a.id)}
                    className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium mb-1">
                        {String((a as any)?._raw?.title || "Announcement")}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span>{a.time}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Eye size={12} />
                          {a.views} views
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "px-3 py-1 rounded-full text-xs font-medium",
                          a._status === "active"
                            ? "bg-green-500/10 text-green-500"
                            : a._status === "scheduled"
                              ? "bg-blue-500/10 text-blue-500"
                              : "bg-slate-700 text-slate-400"
                        )}
                      >
                        {a._status || "active"}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          editPost(
                            String(a.id),
                            String((a as any)?._raw?.title || "Announcement"),
                            String((a as any)?._raw?.content ?? (a as any)?._raw?.body ?? "")
                          )
                        }
                        className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        <Edit size={14} className="text-slate-400" />
                      </button>

                      <button
                        type="button"
                        onClick={() => removePost(String(a.id))}
                        className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        <Trash2 size={14} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
                {announcements.length === 0 ? (
                  <div className="text-sm text-slate-400">No announcements yet.</div>
                ) : null}
              </div>

              {/* Keep your backend data accessible: show latest operator posts here too */}
              <div className="mt-6 pt-6 border-t border-slate-800">
                <h4 className="text-sm font-semibold mb-3 text-slate-200">
                  Latest From Feed (Live)
                </h4>
                <div className="space-y-3">
                  {cards.slice(0, 4).map((p) => (
                    <div key={`live-${String(p.id)}`} className="p-4 bg-slate-800/40 rounded-lg">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-white truncate">
                            {String((p._raw as any)?.title || "Announcement")}
                          </div>
                          <div className="text-xs text-slate-400 mt-1 truncate">
                            {p.time} • {p.building}
                          </div>
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-2">
                          <Eye size={12} />
                          {p.views}
                        </div>
                      </div>
                    </div>
                  ))}
                  {cards.length === 0 ? (
                    <div className="text-sm text-slate-400">No live posts yet.</div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">Announcement Reach</h3>
            <div className="space-y-4">
              <div className="p-4 bg-slate-800/50 rounded-lg">
                <p className="text-2xl font-semibold mb-1">{stats.activeResidents}</p>
                <p className="text-sm text-slate-400">Total Recipients</p>
              </div>
              <div className="p-4 bg-slate-800/50 rounded-lg">
                <p className="text-2xl font-semibold mb-1">{stats.engagementRate}%</p>
                <p className="text-sm text-slate-400">Average Read Rate</p>
              </div>
              <div className="p-4 bg-slate-800/50 rounded-lg">
                <p className="text-2xl font-semibold mb-1">{stats.postsToday}</p>
                <p className="text-sm text-slate-400">Posts Today</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODERATION */}
      {activeTab === "moderation" && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between gap-3 mb-6">
            <h3 className="text-lg font-semibold">Pending Review</h3>
            <div className="text-sm text-slate-400">
              {moderationQueue.length} item(s)
            </div>
          </div>

          <div className="space-y-4">
            {moderationQueue.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <p className="text-sm">No posts pending review</p>
              </div>
            ) : (
              moderationQueue.map((post) => (
                <div key={`mod-${String(post.id)}`} className="p-4 bg-slate-800/50 rounded-lg">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-semibold text-sm">
                      {post.avatar}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{post.author}</p>
                      <p className="text-xs text-slate-400 mb-2">{post.time}</p>
                      <p className="text-sm text-slate-300">
                        {clamp(post.content, 320) || "—"}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => moderatePost(String(post.id), "active")}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => moderatePost(String(post.id), "denied")}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        editPost(
                          String(post.id),
                          String((post as any)?._raw?.title || "Announcement"),
                          String((post as any)?._raw?.content ?? (post as any)?._raw?.body ?? "")
                        )
                      }
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Small operator hint (keeps “don’t lose anything” mindset) */}
      <div className="text-xs text-slate-500">
        Note: This UI matches your new standard. Your live data flow is still from{" "}
        <span className="text-slate-300">communityService.listByEstate()</span> and{" "}
        <span className="text-slate-300">communityService.createPost()</span>.
        When you add likes/comments/views/authors on backend, they will drop in here automatically.
      </div>
    </div>
  );
}
