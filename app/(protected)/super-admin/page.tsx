"use client";

import { useEffect, useMemo, useState } from "react";
import Topbar from "@/components/shell/Topbar";
import { useSessionStore } from "@/store/useSessionStore";
import superAdminService, { type SuperAdminOverview } from "@/services/superAdminService";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function when(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const EMPTY_OVERVIEW: SuperAdminOverview = {
  estates: 0,
  homes: 0,
  users: 0,
  devices: 0,
  cameras: 0,
  wallets: 0,
  walletTransactions: 0,
  notifications: 0,
  maintenanceRequests: 0,
  communityPosts: 0,
  messages: 0,
};

export default function SuperAdminPage() {
  const { user } = useSessionStore();
  const isAdmin = String(user?.role || "").toLowerCase() === "admin";

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [overview, setOverview] = useState<SuperAdminOverview>(EMPTY_OVERVIEW);
  const [estates, setEstates] = useState<any[]>([]);
  const [homes, setHomes] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);

  async function loadAll() {
    if (!isAdmin) return;
    setLoading(true);
    setErr(null);
    try {
      const [o, e, h, d, t, a] = await Promise.all([
        superAdminService.overview(),
        superAdminService.estates(30),
        superAdminService.homes(40),
        superAdminService.devices(40),
        superAdminService.transactions(40),
        superAdminService.activities(60),
      ]);
      setOverview(o?.metrics || EMPTY_OVERVIEW);
      setEstates(e?.items || []);
      setHomes(h?.items || []);
      setDevices(d?.items || []);
      setTransactions(t?.items || []);
      setActivities(a?.items || []);
    } catch (e: any) {
      setErr(String(e?.response?.data?.error || e?.message || "Failed to load super admin command center"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const cards = useMemo(
    () => [
      { label: "Estates", value: overview.estates },
      { label: "Homes", value: overview.homes },
      { label: "Users", value: overview.users },
      { label: "Devices", value: overview.devices },
      { label: "Cameras", value: overview.cameras },
      { label: "Transactions", value: overview.walletTransactions },
      { label: "Maintenance", value: overview.maintenanceRequests },
      { label: "Community Posts", value: overview.communityPosts },
    ],
    [overview]
  );

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <Topbar title="Super Admin" subtitle="Global command center" />
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-red-200 text-sm">
          This area is restricted to admin accounts.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Topbar title="Super Admin Command Center" subtitle="All estates • homes • devices • transactions • activities" />

      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={loadAll}
          disabled={loading}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 hover:bg-white/10 disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {err ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">{err}</div>
      ) : null}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-[11px] text-zinc-400">{c.label}</div>
            <div className="mt-1 text-2xl font-semibold text-zinc-100">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold text-zinc-100 mb-3">Estates</div>
          <div className="space-y-2 max-h-72 overflow-auto">
            {estates.map((e: any) => (
              <div key={e.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="text-sm font-medium text-zinc-100">{e.name || "Unnamed estate"}</div>
                <div className="text-xs text-zinc-400 mt-1">
                  Homes: {e.homes || 0} • Devices: {e.devices || 0} • Users: {e.users || 0}
                </div>
              </div>
            ))}
            {!estates.length ? <div className="text-xs text-zinc-500">No estates</div> : null}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold text-zinc-100 mb-3">Recent Activities</div>
          <div className="space-y-2 max-h-72 overflow-auto">
            {activities.map((a: any) => (
              <div key={a.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="text-sm text-zinc-100">{a.title}</div>
                <div className="text-xs text-zinc-400 mt-1">
                  {a.channel} • {a.level} • {when(a.created_at)}
                </div>
                {a.detail ? <div className="text-xs text-zinc-300 mt-1">{a.detail}</div> : null}
              </div>
            ))}
            {!activities.length ? <div className="text-xs text-zinc-500">No activities</div> : null}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold text-zinc-100 mb-3">Homes</div>
          <div className="space-y-2 max-h-72 overflow-auto">
            {homes.map((h: any) => (
              <div key={h.id} className="rounded-lg border border-white/10 bg-black/20 p-2">
                <div className="text-xs text-zinc-100">{h.name || "Home"}</div>
                <div className="text-[11px] text-zinc-400">
                  {h.estate_name || h.estate_id || "—"} • {h.block || "—"} / {h.unit || "—"}
                </div>
              </div>
            ))}
            {!homes.length ? <div className="text-xs text-zinc-500">No homes</div> : null}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold text-zinc-100 mb-3">Devices</div>
          <div className="space-y-2 max-h-72 overflow-auto">
            {devices.map((d: any) => (
              <div key={d.id} className="rounded-lg border border-white/10 bg-black/20 p-2">
                <div className="text-xs text-zinc-100">{d.name || d.type || "Device"}</div>
                <div className="text-[11px] text-zinc-400">
                  {d.adapter || "—"} • {d.status || "unknown"} • {d.bind_state || "—"}
                </div>
              </div>
            ))}
            {!devices.length ? <div className="text-xs text-zinc-500">No devices</div> : null}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold text-zinc-100 mb-3">Transactions</div>
          <div className="space-y-2 max-h-72 overflow-auto">
            {transactions.map((t: any) => (
              <div key={t.id} className={cn("rounded-lg border p-2", t.direction === "credit" ? "border-emerald-500/25 bg-emerald-500/10" : "border-amber-500/25 bg-amber-500/10")}>
                <div className="text-xs text-zinc-100">
                  {t.direction || "tx"} • {t.type || "unknown"}
                </div>
                <div className="text-[11px] text-zinc-300">
                  {t.currency || "NGN"} {Number(t.amount || 0).toLocaleString()}
                </div>
                <div className="text-[10px] text-zinc-400">{t.user_email || "—"} • {when(t.created_at)}</div>
              </div>
            ))}
            {!transactions.length ? <div className="text-xs text-zinc-500">No transactions</div> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
