// app/(protected)/community/page.tsx
"use client";

import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { communityService, type CommunityPost } from "@/services/communityService";
import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";

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
    throw new Error(json?.error || json?.message || `Request failed (${res.status})`);
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

export default function CommunityPage() {
  const [items, setItems] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ✅ store estateId once resolved
  const [estateId, setEstateId] = useState<string | null>(null);

  // modal state
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [creating, setCreating] = useState(false);

  async function resolveEstate() {
    const overview = await api<{ estate_id: string }>("/facility/overview");
    if (!overview?.estate_id) throw new Error("No estate linked to this operator account yet.");
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

  const columns = useMemo<ColumnDef<CommunityPost>[]>(() => [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="font-semibold truncate text-white">
            {row.original.title || "—"}
          </div>
          <div className="text-xs text-white/60 truncate">
            {row.original.content || "—"}
          </div>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <span className="text-white/70 text-xs">
          {String(row.original.status || "active")}
        </span>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Created",
      cell: ({ row }) => (
        <span className="text-white/70 text-xs">
          {when(row.original.created_at)}
        </span>
      ),
    },
  ], []);

  return (
    <div className="space-y-7">
      <Topbar
        title="Community"
        subtitle="Estate broadcasts • announcements • live updates"
      />

      {err && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {err}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button
          variant="secondary"
          onClick={() => setOpen(true)}
          disabled={loading}
        >
          New Update
        </Button>

        <Button variant="ghost" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      <DataTable
        data={items}
        columns={columns}
        title="Community Posts"
        searchKey="title"
      />

      {/* ✅ NEW UPDATE MODAL */}
      {open && (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur flex items-center justify-center px-5">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-950 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-white font-semibold text-lg">New Community Update</div>
                <div className="text-xs text-white/50 mt-1">
                  This will broadcast to the estate and should appear on the consumer app.
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
                Tip: keep titles short. Consumer UI can show title + preview.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
