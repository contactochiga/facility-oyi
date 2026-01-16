"use client";

import { useEffect, useMemo, useState } from "react";
import Topbar from "@/components/shell/Topbar";
import StatCard from "@/components/ui/StatCard";
import Button from "@/components/ui/Button";
import { facilityService } from "@/services/facilityService";
import type { FacilityOverview } from "@/types/facility";
import { formatMoney, formatNumber } from "@/lib/format";
import { LineChart, Line, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

function series(seed = 10) {
  const now = Date.now();
  return Array.from({ length: 12 }).map((_, i) => ({
    x: new Date(now - (11 - i) * 24 * 3600 * 1000).toLocaleDateString([], { month: "short", day: "2-digit" }),
    y: Math.max(0, Math.round(seed + Math.random() * seed * 2)),
  }));
}

function score(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function OpsPill({ label, value }: { label: string; value: number }) {
  const color =
    value >= 80 ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
    : value >= 55 ? "border-yellow-500/20 bg-yellow-500/10 text-yellow-200"
    : "border-red-500/20 bg-red-500/10 text-red-200";

  return (
    <div className={`glass p-4 border ${color}`}>
      <div className="text-[11px] opacity-80">{label}</div>
      <div className="text-xl font-semibold">{value}%</div>
    </div>
  );
}

export default function OverviewPage() {
  const [data, setData] = useState<FacilityOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const trendDevices = useMemo(() => series(8), []);
  const trendVisitors = useMemo(() => series(5), []);
  const trendWallet = useMemo(() => series(12), []);

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const res = await facilityService.overview();
      setData(res);
    } catch (e: any) {
      setErr(e?.response?.data?.error || "Failed to load overview");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const stability = score(100 - (data?.open_maintenance ?? 0) * 3);
  const security = score(100 - (data?.alerts ?? 0) * 6);
  const uptime = score(70 + (data?.active_devices ?? 0));
  const flow = score(85 - Math.max(0, (data?.visitors_today ?? 0) - 20) * 2);

  return (
    <div className="space-y-7">
      <Topbar title="Overview" subtitle="Estate operational summary • signal-first • executive clarity" />

      <div className="flex items-center justify-between">
        <div className="muted">{data?.estate_id ? `Estate: ${data.estate_id}` : "Estate: —"}</div>
        <Button variant="ghost" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {err && (
        <div className="glass border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-200">
          {err}
        </div>
      )}

      {/* MAIN GRID */}
      <div className="grid gap-4 lg:gap-5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Homes" value={formatNumber(data?.homes ?? 0)} hint="Units under management" />
        <StatCard label="Active Devices" value={formatNumber(data?.active_devices ?? 0)} hint="Online + reporting now" tone="good" />
        <StatCard label="Open Maintenance" value={formatNumber(data?.open_maintenance ?? 0)} hint="Open + in progress" tone={data?.open_maintenance ? "warn" : "good"} />
        <StatCard label="Visitors Today" value={formatNumber(data?.visitors_today ?? 0)} hint="Entries today" />
      </div>

      {/* SIGNAL PANELS */}
      <div className="grid gap-4 lg:gap-5 grid-cols-1 xl:grid-cols-3">
        <div className="glass p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-zinc-400">Alerts</div>
              <div className="mt-2 text-3xl font-semibold">{formatNumber(data?.alerts ?? 0)}</div>
              <div className="mt-2 text-xs text-zinc-500">Unread notifications</div>
            </div>
            <div className="text-xs text-zinc-500">Trend</div>
          </div>
          <div className="h-28 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendDevices.slice(-7)}>
                <Tooltip
                  contentStyle={{ background: "rgba(24,24,27,0.95)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12 }}
                />
                <Line type="monotone" dataKey="y" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-zinc-400">Visitor Flow</div>
              <div className="mt-2 text-3xl font-semibold">{formatNumber(data?.visitors_today ?? 0)}</div>
              <div className="mt-2 text-xs text-zinc-500">Gate pressure</div>
            </div>
            <div className="text-xs text-zinc-500">12 days</div>
          </div>
          <div className="h-28 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendVisitors}>
                <Tooltip
                  contentStyle={{ background: "rgba(24,24,27,0.95)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12 }}
                />
                <Bar dataKey="y" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-zinc-400">Wallet</div>
              <div className="mt-2 text-2xl font-semibold">{formatMoney(data?.wallet?.balance ?? 0, "NGN")}</div>
              <div className="mt-2 text-xs text-zinc-500">
                Outstanding: {formatMoney(data?.wallet?.outstanding_dues ?? 0, "NGN")} • Collected:{" "}
                {formatMoney(data?.wallet?.collected_this_month ?? 0, "NGN")}
              </div>
            </div>
            <div className="text-xs text-zinc-500">Signals</div>
          </div>

          <div className="h-28 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendWallet}>
                <Tooltip
                  contentStyle={{ background: "rgba(24,24,27,0.95)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12 }}
                />
                <Line type="monotone" dataKey="y" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* UNIQUE SIGNATURE: OPS STRIP */}
      <div className="glass p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium">Operational Strip</div>
            <div className="text-xs text-zinc-500 mt-1">
              A single strip that tells you where the estate is bleeding right now.
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto">
            <OpsPill label="Stability" value={stability} />
            <OpsPill label="Security" value={security} />
            <OpsPill label="Uptime" value={uptime} />
            <OpsPill label="Flow" value={flow} />
          </div>
        </div>
      </div>
    </div>
  );
}
