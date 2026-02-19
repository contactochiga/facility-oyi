// app/(protected)/community/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Topbar from "@/components/shell/Topbar";
import {
  communityService,
  type CommunityPost,
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
// Dummy announcements (UI-only for now, no backend change)
// -------------------------------
const announcements = [
  { id: 1, title: "Pool Maintenance Schedule", date: "Feb 22, 2026", status: "active", views: 234 },
  { id: 2, title: "Parking Rules Update", date: "Feb 20, 2026", status: "active", views: 456 },
  { id: 3, title: "Community Event - March 5", date: "Feb 18, 2026", status: "scheduled", views: 189 },
  { id: 4, title: "Fire Drill Notice", date: "Feb 15, 2026", status: "archived", views: 678 },
];

// -------------------------------
// Page
// -------------------------------
export default function CommunityPage() {
  const [activeTab, setActiveTab] = useState<"feed" | "announcements" | "moderation">("feed");

  const [items, setItems] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ✅ store estateId once resolved (keeps your current flow)
  const [estateId, setEstateId] = useState<string | null>(null);

  // composer (matches your existing create flow, but UI looks like your new standard)
  const [newPost, setNewPost] = useState("");
  const [creating, setCreating] = useState(false);

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
      });

      // optimistic insert (kept)
      setItems((prev) => [created, ...prev]);
      setNewPost("");
    } catch (e: any) {
      setErr(e?.message || "Failed to publish announcement");
    } finally {
      setCreating(false);
    }
  }

  // -------------------------------
  // Adapt backend posts → new UI cards (no data loss; just presentation)
  // -------------------------------
  const cards = useMemo(() => {
    return (items as any[]).map((p) => {
      const author = "System Manager"; // operator console (until backend sends author)
      const building = "Estate Management";
      const avatar = initialsFromName(author);

      // Placeholder engagement until backend supports it
      const likes = Number(p?.likes ?? 0);
      const comments = Number(p?.comments ?? 0);
      const views = Number(p?.views ?? 0);

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
      };
    });
  }, [items]);

  const moderationQueue = useMemo(() => {
    return cards.filter((c) => c._status === "flagged");
  }, [cards]);

  // -------------------------------
  // Stats (kept stable)
  // -------------------------------
  const stats = useMemo(() => {
    const total = items.length;

    // minimal/placeholder stats until backend adds analytics
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

    const engagementRate = total === 0 ? 0 : Math.min(100, Math.round((total / 120) * 100)); // placeholder
    const interactions = (items as any[]).reduce((acc, p) => {
      const l = Number(p?.likes ?? 0);
      const c = Number(p?.comments ?? 0);
      const v = Number(p?.views ?? 0);
      return acc + l + c + v;
    }, 0);

    return {
      activeResidents: 847, // placeholder until backend
      postsToday,
      pendingReview: flagged,
      engagementRate,
      interactions: interactions || 1247, // keep lively if backend has none
    };
  }, [items]);

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
              <textarea
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                placeholder="Share an announcement with residents..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-4 text-sm resize-none focus:outline-none focus:border-blue-500 mb-4"
                rows={3}
              />
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => alert("Wire: image upload later")}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-colors"
                  >
                    Add Image
                  </button>
                  <button
                    type="button"
                    onClick={() => alert("Wire: schedule publish later")}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-colors"
                  >
                    Schedule
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
                        onClick={() => alert("Wire: post menu actions later")}
                        className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        <MoreVertical size={16} className="text-slate-400" />
                      </button>
                    </div>

                    <p className="text-slate-300 mb-4">
                      {clamp(post.content, 520) || "—"}
                    </p>

                    <div className="flex items-center gap-6 text-sm text-slate-400">
                      <button
                        type="button"
                        className="flex items-center gap-2 hover:text-blue-500 transition-colors"
                        onClick={() => alert("Wire: like action later")}
                      >
                        <ThumbsUp size={16} />
                        <span>{post.likes}</span>
                      </button>

                      <button
                        type="button"
                        className="flex items-center gap-2 hover:text-blue-500 transition-colors"
                        onClick={() => alert("Wire: comments view later")}
                      >
                        <MessageSquare size={16} />
                        <span>{post.comments}</span>
                      </button>

                      <div className="flex items-center gap-2">
                        <Eye size={16} />
                        <span>{post.views}</span>
                      </div>
                    </div>
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
                {[
                  { label: "Posts", val: Math.min(234, Math.max(items.length, 1)), pct: 78, bar: "bg-blue-500" },
                  { label: "Comments", val: 567, pct: 92, bar: "bg-green-500" },
                  { label: "Reactions", val: 1234, pct: 65, bar: "bg-purple-500" },
                ].map((x) => (
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
                {[
                  { name: "Sarah Johnson", posts: 45, avatar: "SJ" },
                  { name: "Michael Chen", posts: 38, avatar: "MC" },
                  { name: "Emma Davis", posts: 32, avatar: "ED" },
                  { name: "James Wilson", posts: 28, avatar: "JW" },
                ].map((c) => (
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
                    key={a.id}
                    className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium mb-1">{a.title}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span>{a.date}</span>
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
                          a.status === "active"
                            ? "bg-green-500/10 text-green-500"
                            : a.status === "scheduled"
                              ? "bg-blue-500/10 text-blue-500"
                              : "bg-slate-700 text-slate-400"
                        )}
                      >
                        {a.status}
                      </span>

                      <button
                        type="button"
                        onClick={() => alert("Wire: edit announcement later")}
                        className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        <Edit size={14} className="text-slate-400" />
                      </button>

                      <button
                        type="button"
                        onClick={() => alert("Wire: delete announcement later")}
                        className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        <Trash2 size={14} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
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
                <p className="text-2xl font-semibold mb-1">1,847</p>
                <p className="text-sm text-slate-400">Total Recipients</p>
              </div>
              <div className="p-4 bg-slate-800/50 rounded-lg">
                <p className="text-2xl font-semibold mb-1">87%</p>
                <p className="text-sm text-slate-400">Average Read Rate</p>
              </div>
              <div className="p-4 bg-slate-800/50 rounded-lg">
                <p className="text-2xl font-semibold mb-1">24h</p>
                <p className="text-sm text-slate-400">Avg. Response Time</p>
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
                      onClick={() => alert("Wire: approve (PATCH status=active)")}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => alert("Wire: reject (PATCH status=hidden)")}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => alert("Wire: edit content later")}
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
