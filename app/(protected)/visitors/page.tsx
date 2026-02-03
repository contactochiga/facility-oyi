// app/(protected)/visitors/page.tsx
"use client";

import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { visitorService, type VisitorItem } from "@/services/visitorService";
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

function pill(status?: string) {
  const s = String(status || "").toLowerCase();
  if (s === "approved") return "bg-emerald-500/15 text-emerald-200 border-emerald-500/20";
  if (s === "entered") return "bg-blue-500/15 text-blue-200 border-blue-500/20";
  if (s === "exited") return "bg-zinc-500/15 text-zinc-200 border-zinc-500/20";
  if (s === "denied") return "bg-red-500/15 text-red-200 border-red-500/20";
  return "bg-yellow-500/15 text-yellow-200 border-yellow-500/20"; // active/pending
}

export default function VisitorsPage() {
  const [items, setItems] = useState<VisitorItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [todayOnly, setTodayOnly] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = todayOnly
        ? await visitorService.listToday()
        : await visitorService.list();
      setItems(res || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayOnly]); // reload on toggle

  const columns = useMemo<ColumnDef<VisitorItem>[]>(
    () => [
      {
        accessorKey: "visitor_name",
        header: "Visitor",
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="font-semibold truncate">
              {row.original.visitor_name}
            </div>
            <div className="text-xs text-white/60 truncate">
              {row.original.purpose || "—"}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "visitor_phone",
        header: "Phone",
        cell: ({ row }) => (
          <span className="text-white/80">
            {row.original.visitor_phone || "—"}
          </span>
        ),
      },
      {
        accessorKey: "access_code",
        header: "Code",
        cell: ({ row }) => (
          <span className="font-mono text-white/90">
            {row.original.access_code || "—"}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <span
            className={`inline-flex text-[11px] px-2 py-1 rounded-full border ${pill(
              row.original.status
            )}`}
          >
            {String(row.original.status || "active").replaceAll("_", " ")}
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
      {
        accessorKey: "expires_at",
        header: "Expires",
        cell: ({ row }) => (
          <span className="text-white/70 text-xs">
            {when(row.original.expires_at)}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-7">
      <Topbar title="Visitors" subtitle="Gate flow • verification • timeline logs" />

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-2">
          <Button
            variant={todayOnly ? "primary" : "ghost"} // ✅ fixed (no "default" variant)
            onClick={() => setTodayOnly(true)}
            disabled={loading}
          >
            Today
          </Button>
          <Button
            variant={!todayOnly ? "primary" : "ghost"} // ✅ fixed (no "default" variant)
            onClick={() => setTodayOnly(false)}
            disabled={loading}
          >
            All
          </Button>
        </div>

        <Button variant="ghost" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      <DataTable
        data={items}
        columns={columns}
        title={todayOnly ? "Visitors Today" : "All Visitors"}
        searchKey={"visitor_name"}
      />
    </div>
  );
}
