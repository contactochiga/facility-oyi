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
  const role = String(user?.role || "").toLowerCase();
  const isSuperReader = role === "admin" || role === "system_admin" || role === "auditor";
  const canMutate = role === "admin" || role === "system_admin";

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [overview, setOverview] = useState<SuperAdminOverview>(EMPTY_OVERVIEW);
  const [estates, setEstates] = useState<any[]>([]);
  const [homes, setHomes] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [selectedEstate, setSelectedEstate] = useState<any | null>(null);
  const [selectedEstateSummary, setSelectedEstateSummary] = useState<any | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  async function loadAll() {
    if (!isSuperReader) return;
    setLoading(true);
    setErr(null);
    try {
      const [o, e, h, d, t, a, l] = await Promise.all([
        superAdminService.overview(),
        superAdminService.estates(30),
        superAdminService.homes(40),
        superAdminService.devices(40),
        superAdminService.transactions(40),
        superAdminService.activities(60),
        superAdminService.auditLogs(60),
      ]);
      setOverview(o?.metrics || EMPTY_OVERVIEW);
      setEstates(e?.items || []);
      setHomes(h?.items || []);
      setDevices(d?.items || []);
      setTransactions(t?.items || []);
      setActivities(a?.items || []);
      setAuditLogs(l?.items || []);
    } catch (e: any) {
      setErr(String(e?.response?.data?.error || e?.message || "Failed to load super admin command center"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperReader]);

  async function loadEstateSummary(estateId: string) {
    try {
      const out = await superAdminService.estateSummary(estateId);
      setSelectedEstateSummary(out || null);
    } catch {
      setSelectedEstateSummary(null);
    }
  }

  async function toggleEstateStatus(estate: any) {
    if (!canMutate) return;
    const nextStatus = String(estate?.status || "active") === "suspended" ? "active" : "suspended";
    const key = `estate:${estate.id}`;
    setActionBusy(key);
    try {
      await superAdminService.setEstateStatus(String(estate.id), nextStatus as "active" | "suspended");
      await loadAll();
      if (selectedEstate?.id === estate.id) await loadEstateSummary(String(estate.id));
    } catch (e: any) {
      setErr(String(e?.response?.data?.error || e?.message || "Failed estate status update"));
    } finally {
      setActionBusy(null);
    }
  }

  async function toggleDeviceDisabled(device: any) {
    if (!canMutate) return;
    const disabled = !Boolean(device?.is_managed_disabled);
    const key = `device:${device.id}`;
    setActionBusy(key);
    try {
      await superAdminService.setDeviceDisabled(String(device.id), disabled);
      await loadAll();
    } catch (e: any) {
      setErr(String(e?.response?.data?.error || e?.message || "Failed device action"));
    } finally {
      setActionBusy(null);
    }
  }

  async function toggleWalletFrozen(tx: any) {
    if (!canMutate || !tx?.wallet_id) return;
    const frozen = !Boolean(tx?.wallet_frozen || false);
    const key = `wallet:${tx.wallet_id}`;
    setActionBusy(key);
    try {
      await superAdminService.setWalletFrozen(String(tx.wallet_id), frozen);
      await loadAll();
    } catch (e: any) {
      setErr(String(e?.response?.data?.error || e?.message || "Failed wallet action"));
    } finally {
      setActionBusy(null);
    }
  }

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

  if (!isSuperReader) {
    return (
      <div className="space-y-6">
        <Topbar title="Super Admin" subtitle="Global command center" />
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-red-200 text-sm">
          This area is restricted to super-admin accounts.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Topbar title="Super Admin Command Center" subtitle="All estates • homes • devices • transactions • activities" />
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
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      setSelectedEstate(e);
                      await loadEstateSummary(String(e.id));
                    }}
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-zinc-200 hover:bg-white/10"
                  >
                    Drill down
                  </button>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] border", String(e?.status || "active") === "suspended" ? "border-red-500/30 text-red-200 bg-red-500/10" : "border-emerald-500/30 text-emerald-200 bg-emerald-500/10")}>
                    {String(e?.status || "active")}
                  </span>
                  {canMutate ? (
                    <button
                      type="button"
                      onClick={() => toggleEstateStatus(e)}
                      disabled={actionBusy === `estate:${e.id}`}
                      className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-zinc-200 hover:bg-white/10 disabled:opacity-50"
                    >
                      {actionBusy === `estate:${e.id}` ? "..." : String(e?.status || "active") === "suspended" ? "Activate" : "Suspend"}
                    </button>
                  ) : null}
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

      {selectedEstate ? (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold text-zinc-100 mb-2">Estate Drill-down: {selectedEstate.name}</div>
          {selectedEstateSummary ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <div className="rounded-lg border border-white/10 bg-black/20 p-2 text-xs text-zinc-200">Homes: {selectedEstateSummary?.metrics?.homes ?? 0}</div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-2 text-xs text-zinc-200">Users: {selectedEstateSummary?.metrics?.users ?? 0}</div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-2 text-xs text-zinc-200">Devices: {selectedEstateSummary?.metrics?.devices ?? 0}</div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-2 text-xs text-zinc-200">Wallet Tx: {selectedEstateSummary?.metrics?.walletTransactions ?? 0}</div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-2 text-xs text-zinc-200">Maintenance: {selectedEstateSummary?.metrics?.maintenanceRequests ?? 0}</div>
            </div>
          ) : (
            <div className="text-xs text-zinc-500">Loading summary...</div>
          )}
        </section>
      ) : null}

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
                {canMutate ? (
                  <button
                    type="button"
                    onClick={() => toggleDeviceDisabled(d)}
                    disabled={actionBusy === `device:${d.id}`}
                    className="mt-1 rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-zinc-200 hover:bg-white/10 disabled:opacity-50"
                  >
                    {actionBusy === `device:${d.id}` ? "..." : d?.is_managed_disabled ? "Enable" : "Disable"}
                  </button>
                ) : null}
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
                {canMutate ? (
                  <button
                    type="button"
                    onClick={() => toggleWalletFrozen(t)}
                    disabled={!t.wallet_id || actionBusy === `wallet:${t.wallet_id}`}
                    className="mt-1 rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-zinc-200 hover:bg-white/10 disabled:opacity-50"
                  >
                    {actionBusy === `wallet:${t.wallet_id}` ? "..." : t?.wallet_frozen ? "Unfreeze wallet" : "Freeze wallet"}
                  </button>
                ) : null}
              </div>
            ))}
            {!transactions.length ? <div className="text-xs text-zinc-500">No transactions</div> : null}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-semibold text-zinc-100 mb-3">Audit Logs</div>
        <div className="space-y-2 max-h-72 overflow-auto">
          {auditLogs.map((l: any) => (
            <div key={l.id} className="rounded-lg border border-white/10 bg-black/20 p-2">
              <div className="text-xs text-zinc-100">{l.action}</div>
              <div className="text-[11px] text-zinc-400">
                {l.target_type}:{l.target_id} • actor:{l.actor_role || "n/a"} • {when(l.created_at)}
              </div>
            </div>
          ))}
          {!auditLogs.length ? <div className="text-xs text-zinc-500">No audit logs</div> : null}
        </div>
      </section>
    </div>
  );
}
