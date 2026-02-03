// app/(protected)/community/page.tsx
"use client";

import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { communityService, type CommunityPost } from "@/services/communityService";
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

function getEstateId(): string | null {
  if (typeof window === "undefined") return null;

  // common keys we’ve used across the apps
  return (
    localStorage.getItem("ochiga_estate") ||
    localStorage.getItem("oyi_estate") ||
    localStorage.getItem("estate_id") ||
    null
  );
}

export default function CommunityPage() {
  const [items, setItems] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const estateId = getEstateId();
      if (!estateId) {
        setErr("No estate linked yet. Please select/onboard an estate.");
        setItems([]);
        return;
      }

      // ✅ listByEstate returns CommunityPost[]
      const posts = await communityService.listByEstate(estateId);
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
  }, []);

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
          onClick={() => {
            // Placeholder for your “New Update” modal later
            setErr("New Update modal not wired yet. We can add it next.");
          }}
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
    </div>
  );
}
