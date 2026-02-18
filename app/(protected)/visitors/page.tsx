// app/(protected)/visitors/page.tsx
"use client";

import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { visitorService, type VisitorItem } from "@/services/visitorService";
import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Shield,
  Users,
  KeyRound,
  DoorOpen,
  DoorClosed,
  Ban,
  Clock,
  RefreshCcw,
} from "lucide-react";

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

  // pending / active / unknown
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

function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  tone = "border-white/10 bg-white/5",
}: {
  title: string;
  value: any;
  hint?: string;
  icon: any;
  tone?: string;
}) {
  return (
    <div className={cn("rounded-2xl border backdrop-blur p-5", tone)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-white/55">{title}</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-white">
            {value}
          </div>
          {hint ? (
            <div className="mt-2 text-[11px] text-white/45">{hint}</div>
          ) : null}
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-2">
          <Icon className="h-5 w-5 text-white/70" />
        </div>
      </div>
    </div>
  );
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
          : list.filter(
              (x) => String((x as any)?.status || "").toLowerCase() === status
            );

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
  // Table columns (unchanged logic)
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
          <span className="text-white/80">
            {safeStr((row.original as any)?.visitor_phone)}
          </span>
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
        title="Security & Access"
        subtitle="Visitor approvals • access codes • entry/exit visibility"
        rightSlot={
          <Button variant="ghost" onClick={load} disabled={loading}>
            <span className="inline-flex items-center gap-2">
              <RefreshCcw className="h-4 w-4" />
              {loading ? "Refreshing..." : "Refresh"}
            </span>
          </Button>
        }
      />

      {/* COMMAND OVERVIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left summary */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] text-white/70">
                  <Shield className="h-4 w-4" />
                  Gate control
                  <span className="text-white/25">•</span>
                  <span className="text-white/55">
                    {todayOnly ? "Today" : "All records"}
                  </span>
                </div>

                <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
                  {stats.total} record(s)
                </div>
                <div className="mt-1 text-sm text-white/55">
                  Quick visibility into access flow and movement.
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                <div className="text-[11px] text-white/45">In estate</div>
                <div className="mt-1 text-sm text-white/85 font-medium">
                  {stats.inEstate}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                <div className="text-[11px] text-white/45">Expired</div>
                <div className="mt-1 text-sm text-white/85 font-medium">
                  {stats.expired}
                </div>
              </div>
            </div>

            <div className="mt-4 text-[11px] text-white/40">
              No logic changes: this is purely presentation over your existing API.
            </div>
          </div>

          {/* toggles */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4">
            <div className="text-xs text-white/55">Time window</div>
            <div className="mt-3 flex gap-2">
              <Button
                variant={todayOnly ? "primary" : "ghost"}
                onClick={() => setTodayOnly(true)}
                disabled={loading}
                className="flex-1"
              >
                Today
              </Button>
              <Button
                variant={!todayOnly ? "primary" : "ghost"}
                onClick={() => setTodayOnly(false)}
                disabled={loading}
                className="flex-1"
              >
                All
              </Button>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-white/60">Status</span>
              <select
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
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
          </div>
        </div>

        {/* Right metrics */}
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <StatCard
            title="Pending approvals"
            value={stats.pending}
            hint="Waiting for operator action"
            icon={Clock}
            tone="border-amber-500/20 bg-amber-500/10"
          />
          <StatCard
            title="Approved"
            value={stats.approved}
            hint="Cleared for entry"
            icon={KeyRound}
            tone="border-emerald-500/20 bg-emerald-500/10"
          />
          <StatCard
            title="Entered"
            value={stats.entered}
            hint="Check entry movements"
            icon={DoorOpen}
            tone="border-blue-500/20 bg-blue-500/10"
          />
          <StatCard
            title="Exited"
            value={stats.exited}
            hint="Departure confirmed"
            icon={DoorClosed}
            tone="border-white/10 bg-white/5"
          />
          <StatCard
            title="Denied"
            value={stats.denied}
            hint="Rejected access attempts"
            icon={Ban}
            tone="border-red-500/20 bg-red-500/10"
          />
          <StatCard
            title="Active / other"
            value={stats.active}
            hint="Unclassified or active entries"
            icon={Users}
            tone="border-white/10 bg-black/20"
          />
        </div>
      </div>

      {/* DATA TABLE */}
      <DataTable
        data={items}
        columns={columns}
        title={todayOnly ? "Visitors Today" : "All Visitors"}
        searchKey={"visitor_name"}
      />

      <div className="text-[11px] text-white/40">
        Next wiring later (optional): “View” can open a visitor timeline panel.
        But the current flow is untouched.
      </div>
    </div>
  );
}
