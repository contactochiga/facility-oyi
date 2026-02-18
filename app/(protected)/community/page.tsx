// app/(protected)/community/page.tsx
"use client";

import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import {
  communityService,
  type CommunityPost,
} from "@/services/communityService";
import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";

// -------------------------------
// Helpers
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

function when(iso?: string | null) {
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

function statusTone(status?: string | null) {
  const s = String(status || "active").toLowerCase();
  if (s === "active") return "text-emerald-200 bg-emerald-500/10 border-emerald-500/20";
  if (s === "hidden" || s === "archived") return "text-zinc-200 bg-white/5 border-white/10";
  if (s === "flagged") return "text-amber-200 bg-amber-500/10 border-amber-500/20";
  return "text-zinc-200 bg-white/5 border-white/10";
}

function clampPreview(text?: string | null, max = 140) {
  const t = String(text || "").trim();
  if (!t) return "—";
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

type EstateStats = {
  total: number;
  active: number;
  flagged: number;
  hidden: number;
  lastPostAt?: string | null;
};

export default function CommunityPage() {
  const [items, setItems] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ✅ store estateId once resolved
  const [estateId, setEstateId] = useState<string | null>(null);

  // composer modal
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [creating, setCreating] = useState(false);

  // control modal
  const [selected, setSelected] = useState<CommunityPost | null>(null);

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

  async function createPost() {
    if (!title.trim()) {
      setErr("Title is required.");
      return;
    }

    setCreating(true);
    setErr(null);

    try {
      const eid = estateId || (await resolveEstate());

      const newPost = await communityService.createPost({
        estateId: eid,
        title: title.trim(),
        content: content.trim() || null,
      });

      // ✅ optimistic insert on top
      setItems((prev) => [newPost, ...prev]);

      // reset + close
      setTitle("");
      setContent("");
      setOpen(false);
    } catch (e: any) {
      setErr(e?.message || "Failed to create post");
    } finally {
      setCreating(false);
    }
  }

  // -------------------------------
  // Stats (command overview)
  // -------------------------------
  const stats = useMemo<EstateStats>(() => {
    let active = 0;
    let flagged = 0;
    let hidden = 0;
    let lastPostAt: string | null = null;

    for (const p of items as any[]) {
      const s = String(p?.status || "active").toLowerCase();
      if (s === "active") active += 1;
      else if (s === "flagged") flagged += 1;
      else if (s === "hidden" || s === "archived") hidden += 1;

      const c = p?.created_at;
      if (c && (!lastPostAt || new Date(c).getTime() > new Date(lastPostAt).getTime())) {
        lastPostAt = c;
      }
    }

    return {
      total: items.length,
      active,
      flagged,
      hidden,
      lastPostAt,
    };
  }, [items]);

  // -------------------------------
  // Columns (command list)
  // -------------------------------
  const columns = useMemo<ColumnDef<CommunityPost>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Post",
        cell: ({ row }) => {
          const p: any = row.original;
          const preview = clampPreview(p?.content, 160);
          return (
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="font-semibold truncate text-white">
                  {p?.title || "—"}
                </div>
                <span
                  className={cn(
                    "px-2 py-1 rounded-full border text-[11px]",
                    statusTone(p?.status)
                  )}
                >
                  {String(p?.status || "active")}
                </span>
              </div>
              <div className="mt-1 text-sm text-white/60 line-clamp-2">
                {preview}
              </div>
              <div className="mt-2 text-[11px] text-white/45 flex items-center gap-2 flex-wrap">
                <span>Created {when(p?.created_at)}</span>
                <span className="text-white/20">•</span>
                <span>Estate feed</span>
              </div>
            </div>
          );
        },
      },
      {
        id: "created",
        header: "Created",
        cell: ({ row }) => (
          <span className="text-white/70 text-xs">
            {when((row.original as any)?.created_at)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              onClick={() => setSelected(row.original)}
            >
              Control
            </Button>
          </div>
        ),
      },
    ],
    []
  );

  // -------------------------------
  // UI
  // -------------------------------
  return (
    <div className="space-y-7">
      <Topbar
        title="Community Command"
        subtitle="Estate feed • moderation • broadcasts • operational visibility"
      />

      {err && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {err}
        </div>
      )}

      {/* Command overview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <div className="text-xs text-white/50">Estate community</div>
          <div className="mt-2 text-2xl font-semibold text-white tracking-tight">
            {stats.total} post(s)
          </div>
          <div className="mt-2 text-sm text-white/60">
            Last update:{" "}
            <span className="text-white/80">
              {stats.lastPostAt ? when(stats.lastPostAt) : "—"}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { k: "Active", v: stats.active },
              { k: "Flagged", v: stats.flagged },
              { k: "Hidden", v: stats.hidden },
            ].map((x) => (
              <div
                key={x.k}
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-3"
              >
                <div className="text-[11px] text-white/45">{x.k}</div>
                <div className="mt-1 text-sm text-white/85 font-medium">
                  {x.v}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 text-[11px] text-white/40">
            This is the facility control view. Consumer users just see the feed;
            operators see moderation + broadcast controls.
          </div>
        </div>

        <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <div className="text-xs text-white/50">Operator actions</div>
          <div className="mt-2 text-base font-semibold text-white">
            Community controls
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              {
                title: "Broadcast update",
                desc: "Post announcement to the whole estate",
                onClick: () => setOpen(true),
              },
              {
                title: "Moderation queue",
                desc: "Review flagged content and take actions",
                onClick: () => alert("Wire: moderation queue (flagged filter)"),
              },
              {
                title: "Policy warning",
                desc: "Warn a user / apply a restriction",
                onClick: () => alert("Wire: user warning / restrictions"),
              },
              {
                title: "Export activity",
                desc: "Download community activity log",
                onClick: () => alert("Wire: export endpoint"),
              },
            ].map((x) => (
              <button
                key={x.title}
                type="button"
                onClick={x.onClick}
                className="text-left rounded-2xl border border-white/10 bg-black/20 hover:bg-black/30 transition p-4"
              >
                <div className="text-sm font-semibold text-white">
                  {x.title}
                </div>
                <div className="mt-1 text-sm text-white/55">{x.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <div className="text-xs text-white/50">Governance signals</div>
          <div className="mt-2 text-base font-semibold text-white">
            Next wiring (backend)
          </div>

          <div className="mt-4 space-y-3 text-sm text-white/55">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-white/85 font-medium">Delete/Hide post</div>
              <div className="mt-1">
                Add endpoints: <span className="text-white/70">PATCH status</span> /{" "}
                <span className="text-white/70">DELETE</span>.
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-white/85 font-medium">User moderation</div>
              <div className="mt-1">
                Warn, mute, or restrict based on estate policy.
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-white/85 font-medium">Audit trail</div>
              <div className="mt-1">
                Log operator actions (what, who, when).
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button variant="secondary" onClick={() => setOpen(true)} disabled={loading}>
          New Update
        </Button>

        <Button variant="ghost" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {/* Feed table */}
      <DataTable data={items} columns={columns} title="Estate Feed" searchKey="title" />

      {/* NEW UPDATE MODAL */}
      {open && (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur flex items-center justify-center px-5">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-950 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-white font-semibold text-lg">
                  Broadcast Update
                </div>
                <div className="text-xs text-white/50 mt-1">
                  Sends an announcement to the estate community feed (consumer app).
                </div>
              </div>

              <button
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-white/70 hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <div className="text-xs text-white/60 mb-1">Title *</div>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Water shutdown notice"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-white/20"
                />
              </div>

              <div>
                <div className="text-xs text-white/60 mb-1">Message (optional)</div>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Add details…"
                  rows={5}
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-white/20"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <Button variant="ghost" onClick={() => setOpen(false)} disabled={creating}>
                  Cancel
                </Button>

                <Button variant="primary" onClick={createPost} disabled={creating}>
                  {creating ? "Posting..." : "Post Update"}
                </Button>
              </div>

              <div className="text-[11px] text-white/40 pt-1">
                Operator note: keep it short. If you need long-form, link to a notice PDF.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTROL MODAL (visual control center; real moderation wires later) */}
      {selected && (
        <div className="fixed inset-0 z-[130] bg-black/70 backdrop-blur flex items-center justify-center px-5">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-950 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-white font-semibold text-lg truncate">
                  {(selected as any)?.title || "Post"}
                </div>
                <div className="mt-1 text-xs text-white/50">
                  Created {when((selected as any)?.created_at)} • Status{" "}
                  <span className="text-white/80">
                    {String((selected as any)?.status || "active")}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelected(null)}
                className="rounded-lg px-3 py-2 text-white/70 hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs text-white/50">Content</div>
              <div className="mt-2 text-sm text-white/80 leading-6">
                {String((selected as any)?.content || "—")}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => alert("Wire: PATCH status=flagged")}
                className="rounded-2xl border border-white/10 bg-black/20 hover:bg-black/30 transition p-4 text-left"
              >
                <div className="text-sm font-semibold text-white">Flag</div>
                <div className="mt-1 text-sm text-white/55">Send to moderation queue</div>
              </button>

              <button
                type="button"
                onClick={() => alert("Wire: PATCH status=hidden")}
                className="rounded-2xl border border-white/10 bg-black/20 hover:bg-black/30 transition p-4 text-left"
              >
                <div className="text-sm font-semibold text-white">Hide</div>
                <div className="mt-1 text-sm text-white/55">Remove from consumer feed</div>
              </button>

              <button
                type="button"
                onClick={() => alert("Wire: DELETE post")}
                className="rounded-2xl border border-red-500/20 bg-red-500/10 hover:bg-red-500/15 transition p-4 text-left"
              >
                <div className="text-sm font-semibold text-red-200">Delete</div>
                <div className="mt-1 text-sm text-red-200/70">Hard remove (audit)</div>
              </button>
            </div>

            <div className="mt-4 text-[11px] text-white/40">
              These controls are UI-ready. When you add backend endpoints (PATCH status / DELETE),
              just replace the alerts with real calls and refresh().
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
