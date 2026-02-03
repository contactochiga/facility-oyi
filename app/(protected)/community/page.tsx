// app/(protected)/community/page.tsx
"use client";

import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { communityService, type CommunityPost } from "@/services/communityService";
import { facilityService } from "@/services/facilityService";
import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";

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

function pill(status?: string | null) {
  const s = String(status || "").toLowerCase();
  if (s === "deleted") return "bg-red-500/15 text-red-200 border-red-500/20";
  return "bg-emerald-500/15 text-emerald-200 border-emerald-500/20";
}

export default function CommunityPage() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [estateId, setEstateId] = useState<string | null>(null);
  const [items, setItems] = useState<CommunityPost[]>([]);

  // modal state
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const canPost = title.trim().length >= 3 && content.trim().length >= 3;

  async function hydrateEstateFromMembership() {
    try {
      const res = await facilityService.myEstates(); // { estates: [...] }
      const first = res?.estates?.[0];
      if (first?.id) {
        setEstateId(first.id);
        return first.id as string;
      }
      setEstateId(null);
      return null;
    } catch (e: any) {
      setEstateId(null);
      setErr(e?.response?.data?.error || e?.message || "Failed to load estates");
      return null;
    }
  }

  async function load(estate?: string | null) {
    setLoading(true);
    setErr(null);

    try {
      const eid = estate || estateId || (await hydrateEstateFromMembership());
      if (!eid) {
        setItems([]);
        setErr("No estate linked yet. Create or join an estate.");
        return;
      }

      const res = await communityService.listByEstate(eid);
      setItems(res.items || []);
      if (res.error) setErr(res.error);
    } finally {
      setLoading(false);
    }
  }

  async function create() {
    if (!canPost) return;

    setLoading(true);
    setErr(null);

    try {
      const eid = estateId || (await hydrateEstateFromMembership());
      if (!eid) {
        setErr("No estate linked yet.");
        return;
      }

      const res = await communityService.create({
        estateId: eid,
        title: title.trim(),
        content: content.trim(),
      });

      if (res.error) {
        setErr(res.error);
        return;
      }

      // reset
      setShowNew(false);
      setTitle("");
      setContent("");

      // reload
      await load(eid);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns = useMemo<ColumnDef<CommunityPost>[]>(() => [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="font-semibold truncate">{row.original.title}</div>
          <div className="text-xs text-white/60 line-clamp-1 mt-1">
            {row.original.content || "—"}
          </div>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <span
          className={`inline-flex text-[11px] px-2 py-1 rounded-full border ${pill(row.original.status)}`}
        >
          {String(row.original.status || "active")}
        </span>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Created",
      cell: ({ row }) => (
        <span className="text-white/70 text-xs">{when(row.original.created_at)}</span>
      ),
    },
  ], []);

  return (
    <div className="space-y-7">
      <Topbar title="Community" subtitle="Estate broadcasts • announcements • live updates" />

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button onClick={() => setShowNew(true)} disabled={loading || !estateId && !items.length}>
          New Update
        </Button>

        <Button variant="ghost" onClick={() => load()} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {!!err && (
        <div className="glass border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-200">
          {err}
        </div>
      )}

      <DataTable data={items} columns={columns} title="Community Posts" searchKey={"title"} />

      {!items.length && !loading && !err && (
        <div className="glass p-5 text-sm text-zinc-300">
          No community posts yet.
          <div className="text-xs text-zinc-500 mt-2">
            Post updates here to broadcast info to all estate accounts.
          </div>
        </div>
      )}

      {/* CREATE MODAL */}
      {showNew && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => !loading && setShowNew(false)}
          />
          <div className="relative glass border border-white/10 rounded-2xl w-full max-w-xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold">New community post</div>
                <div className="text-sm text-zinc-400 mt-1">
                  This creates a community post for your estate.
                </div>
              </div>
              <button
                className="text-zinc-400 hover:text-zinc-200"
                onClick={() => !loading && setShowNew(false)}
              >
                ✕
              </button>
            </div>

            <div className="grid gap-3 mt-5">
              <input
                className="bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 outline-none"
                placeholder="Title (e.g. Water shutdown notice)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />

              <textarea
                className="bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 outline-none min-h-[140px]"
                placeholder="Content / message"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />

              <div className="flex gap-2 mt-2">
                <Button variant="ghost" onClick={() => setShowNew(false)} disabled={loading}>
                  Cancel
                </Button>
                <Button onClick={create} disabled={loading || !canPost}>
                  {loading ? "Posting..." : "Post"}
                </Button>
              </div>

              <div className="text-xs text-zinc-500">
                Estate-style meaning: “control room broadcast.”
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
