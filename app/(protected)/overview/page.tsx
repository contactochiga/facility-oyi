// app/(protected)/overview/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Topbar from "@/components/shell/Topbar";
import StatCard from "@/components/ui/StatCard";
import Button from "@/components/ui/Button";
import { facilityService } from "@/services/facilityService";
import type { FacilityOverview } from "@/types/facility";
import { formatMoney, formatNumber } from "@/lib/format";
import {
  LineChart,
  Line,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

function series(seed = 10) {
  const now = Date.now();
  return Array.from({ length: 12 }).map((_, i) => ({
    x: new Date(now - (11 - i) * 24 * 3600 * 1000).toLocaleDateString([], {
      month: "short",
      day: "2-digit",
    }),
    y: Math.max(0, Math.round(seed + Math.random() * seed * 2)),
  }));
}

function score(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function OpsPill({ label, value }: { label: string; value: number }) {
  const color =
    value >= 80
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
      : value >= 55
      ? "border-yellow-500/20 bg-yellow-500/10 text-yellow-200"
      : "border-red-500/20 bg-red-500/10 text-red-200";

  return (
    <div className={`glass p-4 border ${color}`}>
      <div className="text-[11px] opacity-80">{label}</div>
      <div className="text-xl font-semibold">{value}%</div>
    </div>
  );
}

function extractErr(e: any) {
  const status = e?.response?.status;
  const msg = e?.response?.data?.error || e?.message || "Request failed";
  return { status, msg: String(msg) };
}

export default function OverviewPage() {
  const [data, setData] = useState<FacilityOverview | null>(null);

  const [estateId, setEstateId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const [err, setErr] = useState<string | null>(null);

  // UX states
  const [needsEstate, setNeedsEstate] = useState(false); // no estate memberships at all
  const [syncingEstate, setSyncingEstate] = useState(false); // estate exists but overview still says "not linked"

  const [showCreate, setShowCreate] = useState(false);
  const [modalErr, setModalErr] = useState<string | null>(null);

  const [estateForm, setEstateForm] = useState({
    name: "",
    address: "",
    lat: "",
    lng: "",
    type: "estate",
  });

  const trendDevices = useMemo(() => series(8), []);
  const trendVisitors = useMemo(() => series(5), []);
  const trendWallet = useMemo(() => series(12), []);

  const canCreateEstate = estateForm.name.trim().length > 1;

  async function hydrateEstateFromMembership() {
    try {
      const res = await facilityService.myEstates(); // { estates: [...] }
      const first = res?.estates?.[0];

      if (first?.id) {
        setEstateId(first.id);
        setNeedsEstate(false);
        return first.id as string;
      }

      setEstateId(null);
      setNeedsEstate(true);
      return null;
    } catch (e: any) {
      const { status, msg } = extractErr(e);
      setErr(`Failed to check sites${status ? ` (${status})` : ""}: ${msg}`);
      return null;
    }
  }

  async function loadOverview() {
    const res = await facilityService.overview();
    setData(res);
    setEstateId(res?.estate_id || null);
    setNeedsEstate(false);
    setSyncingEstate(false);
  }

  async function load() {
    setErr(null);
    setNeedsEstate(false);
    setSyncingEstate(false);
    setLoading(true);

    try {
      await loadOverview();
    } catch (e: any) {
      const { status, msg } = extractErr(e);

      // If backend says estate not linked, fallback to membership estates
      const lower = msg.toLowerCase();
      const looksLikeNotLinked = lower.includes("estate not linked") || status === 400;

      if (looksLikeNotLinked) {
        const eid = await hydrateEstateFromMembership();

        // If user already has a membership, treat as "syncing"
        if (eid) {
          setData(null);
          setSyncingEstate(true);
          setErr(null);
        } else {
          setData(null);
          setNeedsEstate(true);
          setErr(null);
        }
      } else {
        setErr(`${msg}${status ? ` (HTTP ${status})` : ""}`);
      }
    } finally {
      setLoading(false);
    }
  }

  async function createEstate() {
    if (!canCreateEstate) return;

    setErr(null);
    setModalErr(null);
    setCreating(true);

    try {
      const payload = {
        name: estateForm.name.trim(),
        address: estateForm.address.trim() || undefined,
        lat: estateForm.lat.trim() ? Number(estateForm.lat) : undefined,
        lng: estateForm.lng.trim() ? Number(estateForm.lng) : undefined,
        type: estateForm.type || "estate",
      };

      await facilityService.createEstate(payload);

      // reset + close modal
      setShowCreate(false);
      setEstateForm({ name: "", address: "", lat: "", lng: "", type: "estate" });

      // Pull estates again
      await hydrateEstateFromMembership();

      // Try overview again
      await load();
    } catch (e: any) {
      const { status, msg } = extractErr(e);
      const friendly = `${msg}${status ? ` (HTTP ${status})` : ""}`;
      setModalErr(friendly);
      setErr(friendly);
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stability = score(100 - (data?.open_maintenance ?? 0) * 3);
  const security = score(100 - (data?.alerts ?? 0) * 6);
  const uptime = score(70 + (data?.active_devices ?? 0));
  const flow = score(85 - Math.max(0, (data?.visitors_today ?? 0) - 20) * 2);

  return (
    <div className="space-y-7">
      {/* SHORT + CLEAN HEADER */}
      <Topbar title="Overview" subtitle="Operational summary" />

      {/* HEADER STRIP */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="muted">
          {estateId ? `Site: ${estateId}` : "Site: —"}
        </div>

        {/* CTA logic */}
        {!estateId ? (
          <Button onClick={() => setShowCreate(true)} disabled={creating}>
            {creating ? "Creating..." : "Create Site"}
          </Button>
        ) : (
          <Button variant="ghost" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        )}
      </div>

      {/* NO ESTATE PANEL */}
      {needsEstate && (
        <div className="glass border border-white/10 rounded-2xl p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="text-lg font-semibold">No site linked yet</div>
              <div className="text-sm text-zinc-400 mt-1 max-w-2xl">
                To unlock homes, rooms, devices, visitors and maintenance, create your first site.
                You’ll automatically become <span className="text-zinc-200">Owner</span> and can invite facility managers.
              </div>
              <div className="text-xs text-zinc-500 mt-3">
                Think of this as registering the “master site” before adding blocks/units.
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => setShowCreate(true)} disabled={creating}>
                {creating ? "Creating..." : "Create Site"}
              </Button>
              <Button variant="ghost" onClick={load} disabled={loading}>
                {loading ? "Checking..." : "Retry"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* SYNCING PANEL */}
      {syncingEstate && (
        <div className="glass border border-white/10 rounded-2xl p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="text-lg font-semibold">Site created — syncing access</div>
              <div className="text-sm text-zinc-400 mt-1 max-w-2xl">
                Your membership is active, but the overview is still reading from a “linked site” field.
                Tap retry to refresh. If it keeps happening, we’ll update the backend overview to derive the site from membership.
              </div>
              <div className="text-xs text-zinc-500 mt-3">
                Site: <span className="text-zinc-200">{estateId || "—"}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="ghost" onClick={load} disabled={loading}>
                {loading ? "Refreshing..." : "Retry"}
              </Button>
              <Button onClick={() => setShowCreate(true)} disabled={creating}>
                {creating ? "Creating..." : "Create Another Site"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* OTHER ERRORS */}
      {!!err && !needsEstate && !syncingEstate && (
        <div className="glass border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-200">
          {err}
        </div>
      )}

      {/* MAIN GRID */}
      <div className="grid gap-4 lg:gap-5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Homes"
          value={formatNumber(data?.homes ?? 0)}
          hint="Units under management"
          href="/homes"
        />

        <StatCard
          label="Active Devices"
          value={formatNumber(data?.active_devices ?? 0)}
          hint="Online + reporting now"
          tone="good"
          href="/devices"
        />

        <StatCard
          label="Open Maintenance"
          value={formatNumber(data?.open_maintenance ?? 0)}
          hint="Open + in progress"
          tone={data?.open_maintenance ? "warn" : "good"}
          href="/maintenance"
        />

        <StatCard
          label="Visitors Today"
          value={formatNumber(data?.visitors_today ?? 0)}
          hint="Entries today"
          href="/visitors"
        />
      </div>

      {/* SIGNAL PANELS */}
      <div className="grid gap-4 lg:gap-5 grid-cols-1 xl:grid-cols-3">
        <div className="glass p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-zinc-400">Alerts</div>
              <div className="mt-2 text-3xl font-semibold">
                {formatNumber(data?.alerts ?? 0)}
              </div>
              <div className="mt-2 text-xs text-zinc-500">Unread notifications</div>
            </div>
            <div className="text-xs text-zinc-500">Trend</div>
          </div>

          <div className="h-28 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendDevices.slice(-7)}>
                <Tooltip
                  contentStyle={{
                    background: "rgba(24,24,27,0.95)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 12,
                  }}
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
              <div className="mt-2 text-3xl font-semibold">
                {formatNumber(data?.visitors_today ?? 0)}
              </div>
              <div className="mt-2 text-xs text-zinc-500">Gate pressure</div>
            </div>
            <div className="text-xs text-zinc-500">12 days</div>
          </div>

          <div className="h-28 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendVisitors}>
                <Tooltip
                  contentStyle={{
                    background: "rgba(24,24,27,0.95)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 12,
                  }}
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
              <div className="mt-2 text-2xl font-semibold">
                {formatMoney(data?.wallet?.balance ?? 0, "NGN")}
              </div>
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
                  contentStyle={{
                    background: "rgba(24,24,27,0.95)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 12,
                  }}
                />
                <Line type="monotone" dataKey="y" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* OPS STRIP */}
      <div className="glass p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium">Operational Strip</div>
            <div className="text-xs text-zinc-500 mt-1">
              A single strip that tells you where the site is bleeding right now.
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

      {/* CREATE ESTATE MODAL */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => !creating && setShowCreate(false)}
          />
          <div className="relative glass border border-white/10 rounded-2xl w-full max-w-xl p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-semibold">Create Site</div>
                <div className="text-sm text-zinc-400 mt-1">
                  Register the master site. You’ll become the Owner and can invite managers.
                </div>
              </div>
              <button
                className="text-zinc-400 hover:text-zinc-200"
                onClick={() => !creating && setShowCreate(false)}
              >
                ✕
              </button>
            </div>

            {/* modal error */}
            {modalErr && (
              <div className="mt-4 glass border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200 rounded-xl">
                {modalErr}
              </div>
            )}

            <div className="grid gap-3 mt-5">
              <input
                className="bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 outline-none"
                placeholder="Site name (e.g. Ochiga Smart Estate)"
                value={estateForm.name}
                onChange={(e) => setEstateForm((p) => ({ ...p, name: e.target.value }))}
              />

              <input
                className="bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 outline-none"
                placeholder="Address (optional)"
                value={estateForm.address}
                onChange={(e) => setEstateForm((p) => ({ ...p, address: e.target.value }))}
              />

              <div className="grid grid-cols-2 gap-3">
                <input
                  className="bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 outline-none"
                  placeholder="Latitude (optional)"
                  value={estateForm.lat}
                  onChange={(e) => setEstateForm((p) => ({ ...p, lat: e.target.value }))}
                />
                <input
                  className="bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 outline-none"
                  placeholder="Longitude (optional)"
                  value={estateForm.lng}
                  onChange={(e) => setEstateForm((p) => ({ ...p, lng: e.target.value }))}
                />
              </div>

              <select
                className="bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 outline-none"
                value={estateForm.type}
                onChange={(e) => setEstateForm((p) => ({ ...p, type: e.target.value }))}
              >
                <option value="estate">Estate</option>
                <option value="facility">Facility</option>
                <option value="campus">Campus</option>
              </select>

              <div className="flex gap-2 mt-2">
                <Button variant="ghost" onClick={() => setShowCreate(false)} disabled={creating}>
                  Cancel
                </Button>
                <Button onClick={createEstate} disabled={!canCreateEstate || creating}>
                  {creating ? "Creating..." : "Create Site"}
                </Button>
              </div>

              <div className="text-xs text-zinc-500 mt-2">
                After creation, you can add homes, rooms, devices and invite managers.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
