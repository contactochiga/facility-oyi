// app/(protected)/visitors/page.tsx
"use client";

import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { visitorService, type VisitorItem } from "@/services/visitorService";
import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
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

function statusTone(status?: string) {
  const s = String(status || "").toLowerCase();

  if (s === "approved")
    return "text-emerald-200 bg-emerald-500/10 border-emerald-500/20";
  if (s === "entered")
    return "text-blue-200 bg-blue-500/10 border-blue-500/20";
  if (s === "exited")
    return "text-zinc-200 bg-white/5 border-white/10";
  if (s === "denied")
    return "text-red-200 bg-red-500/10 border-red-500/20";

  // active / pending / unknown
  return "text-amber-200 bg-amber-500/10 border-amber-500/20";
}

function isExpired(expiresAt?: string | null) {
  if (!expiresAt) return false;
  const t = new Date(expiresAt).getTime();
  if (Number.isNaN(t)) return false;
  return t < Date.now();
}

function fmtStatus(status?: string) {
  return String(status || "active").replaceAll("_", " ");
}

function safeStr(v: any) {
  const s = (v ?? "").toString().trim();
  return s || "—";
}

export default function VisitorsPage() {
  const [items, setItems] = useState<VisitorItem[]>([]);
  const [loading, setLoading] = useState(false);

  // view filters
  const [todayOnly, setTodayOnly] = useState(true);
  const [status, setStatus] = useState<
    "all" | "active" | "pending" | "approved" | "entered" | "exited" | "denied"
  >("all");

  async function load() {
    setLoading(true);
    try {
      const res = todayOnly
        ? await visitorService.listToday()
        : await visitorService.list();

      const list = (res || []) as VisitorItem[];

      // UI-only filter (no backend changes)
      const filtered =
        status === "all"
          ? list
          : list.filter((x) => String((x as any)?.status || "").toLowerCase() === status);

      setItems(filtered);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayOnly, status]);

  // -------------------------------
  // Command overview (no logic changes)
  // -------------------------------
  const stats = useMemo(() => {
    const all = items || [];
    let active = 0;
    let pending = 0;
    let approved = 0;
    let entered = 0;
    let exited = 0;
    let denied = 0;
    let expired = 0;

    for (const v of all as any[]) {
      const s = String(v?.status || "").toLowerCase();
      if (s === "approved") approved++;
      else if (s === "entered") entered++;
      else if (s === "exited") exited++;
      else if (s === "denied") denied++;
      else if (s === "pending") pending++;
      else active++; // fallback bucket

      if (isExpired(v?.expires_at)) expired++;
    }

    const total = all.length;

    // operational sanity: "in estate" = entered but not exited
    const inEstate = Math.max(0, entered - exited);

    return {
      total,
      active,
      pending,
      approved,
      entered,
      exited,
      denied,
      expired,
      inEstate,
    };
  }, [items]);

  // -------------------------------
  // Table columns
  // -------------------------------
  const columns = useMemo<ColumnDef<VisitorItem>[]>(
    () => [
      {
        accessorKey: "visitor_name",
        header: "Visitor",
        cell: ({ row }) => {
          const v: any = row.original;
          const purpose = safeStr(v?.purpose);
          return (
            <div className="min-w-0">
              <div className="font-semibold truncate text-white">
                {safeStr(v?.visitor_name)}
              </div>
              <div className="text-xs text-white/60 truncate">{purpose}</div>
            </div>
          );
        },
      },
      {
        accessorKey: "visitor_phone",
        header: "Phone",
        cell: ({ row }) => (
          <span className="text-white/80">{safeStr((row.original as any)?.visitor_phone)}</span>
        ),
      },
      {
        accessorKey: "access_code",
        header: "Access",
        cell: ({ row }) => {
          const v: any = row.original;
          const code = safeStr(v?.access_code);
          const exp = v?.expires_at;
          const expired = isExpired(exp);
          return (
            <div className="min-w-0">
              <div className="font-mono text-white/90">{code}</div>
              <div className="mt-1 text-[11px] text-white/50">
                Expires{" "}
                <span className={cn(expired ? "text-red-200" : "text-white/70")}>
                  {when(exp)}
                </span>
                {expired ? <span className="text-red-200"> • Expired</span> : null}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const v: any = row.original;
          const s = fmtStatus(v?.status);
          return (
            <span
              className={cn(
                "inline-flex text-[11px] px-2 py-1 rounded-full border",
                statusTone(v?.status)
              )}
            >
              {s}
            </span>
          );
        },
      },
      {
        accessorKey: "created_at",
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
        cell: ({ row }) => {
          const v: any = row.original;
          const code = safeStr(v?.access_code);

          return (
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  if (!code || code === "—") return;
                  navigator.clipboard?.writeText(String(code));
                }}
              >
                Copy code
              </Button>

              <Button
                variant="ghost"
                onClick={() => alert(`Open visitor timeline: ${v?.id || ""}`)}
              >
                View
              </Button>
            </div>
          );
        },
      },
    ],
    []
  );

  return (
    <div className="space-y-7">
      <Topbar
        title="Visitor & Access Control"
        subtitle="Gate flow • verification • entry/exit timeline • access governance"
      />

      {/* Command overview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <div className="text-xs text-white/50">Access overview</div>
          <div className="mt-2 text-2xl font-semibold text-white tracking-tight">
            {stats.total} record(s)
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
              <div className="text-[11px] text-white/45">In estate</div>
              <div className="mt-1 text-sm text-white/85 font-medium">{stats.inEstate}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
              <div className="text-[11px] text-white/45">Expired</div>
              <div className="mt-1 text-sm text-white/85 font-medium">{stats.expired}</div>
            </div>
          </div>

          <div className="mt-4 text-[11px] text-white/40">
            This page is your command panel: visibility, quick actions, and operational status.
          </div>
        </div>

        <div className="lg:col-span-8 rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs text-white/50">Operational lanes</div>
              <div className="mt-2 text-base font-semibold text-white">Gate workflow status</div>
              <div className="mt-1 text-sm text-white/55">
                Approved → Entered → Exited (plus Denied / Expired)
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant={todayOnly ? "primary" : "ghost"}
                onClick={() => setTodayOnly(true)}
                disabled={loading}
              >
                Today
              </Button>
              <Button
                variant={!todayOnly ? "primary" : "ghost"}
                onClick={() => setTodayOnly(false)}
                disabled={loading}
              >
                All
              </Button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 md:grid-cols-6 gap-2">
            {[
              { k: "Pending", v: stats.pending, tone: "text-amber-200 bg-amber-500/10 border-amber-500/20" },
              { k: "Approved", v: stats.approved, tone: "text-emerald-200 bg-emerald-500/10 border-emerald-500/20" },
              { k: "Entered", v: stats.entered, tone: "text-blue-200 bg-blue-500/10 border-blue-500/20" },
              { k: "Exited", v: stats.exited, tone: "text-zinc-200 bg-white/5 border-white/10" },
              { k: "Denied", v: stats.denied, tone: "text-red-200 bg-red-500/10 border-red-500/20" },
              { k: "Total", v: stats.total, tone: "text-white/80 bg-black/20 border-white/10" },
            ].map((x) => (
              <button
                key={x.k}
                type="button"
                onClick={() => setStatus(x.k.toLowerCase() as any)}
                className={cn(
                  "rounded-xl border px-3 py-3 text-left hover:bg-black/20 transition",
                  x.tone
                )}
                title="Click to filter"
              >
                <div className="text-[11px] opacity-80">{x.k}</div>
                <div className="mt-1 text-sm font-semibold">{x.v}</div>
              </button>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/60">Filter</span>
              <select
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                disabled={loading}
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="entered">Entered</option>
                <option value="exited">Exited</option>
                <option value="denied">Denied</option>
                <option value="active">Active (other)</option>
              </select>
            </div>

            <Button variant="ghost" onClick={load} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>
      </div>

      {/* Data table */}
      <DataTable
        data={items}
        columns={columns}
        title={todayOnly ? "Visitors Today" : "All Visitors"}
        searchKey={"visitor_name"}
      />

      {/* Small note */}
      <div className="text-[11px] text-white/40">
        Next wiring (optional): “View” can open a visitor timeline panel (entry scans, zone checks, expiry),
        but no logic changes are required to ship this UI.
      </div>
    </div>
  );
}
