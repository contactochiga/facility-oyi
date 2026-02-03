// app/(protected)/community/page.tsx
"use client";

import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { communityService, type CommunityPost } from "@/services/communityService";
import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";

// --- tiny cookie helper ---
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

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      // ✅ Facility-grade: resolve estate context from backend
      const overview = await api<{ estate_id: string }>("/facility/overview");
      const estateId = overview?.estate_id;

      if (!estateId) {
        setErr("No estate linked to this operator account yet.");
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
          onClick={() => setErr("New Update modal not wired yet. We can add it next.")}
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
