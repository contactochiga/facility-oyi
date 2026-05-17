"use client";

import { useEffect, useMemo, useState } from "react";
import Topbar from "@/components/shell/Topbar";
import StatCard from "@/components/ui/StatCard";
import Button from "@/components/ui/Button";
import { facilityService } from "@/services/facilityService";
import type { FacilityOverview } from "@/types/facility";
import { formatMoney, formatNumber } from "@/lib/format";
import { LineChart, Line, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

import { communityService, type CommunityPost } from "@/services/communityService";
import { visitorService, type VisitorItem } from "@/services/visitorService";
import Link from "next/link";

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

function timeOnly(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function safeStr(v: any) {
  const s = (v ?? "").toString().trim();
  return s || "—";
}

function statusTone(status?: string) {
  const s = String(status || "").toLowerCase();
  if (s === "approved") return "text-emerald-200 bg-emerald-500/10 border-emerald-500/20";
  if (s === "entered") return "text-blue-200 bg-blue-500/10 border-blue-500/20";
  if (s === "exited") return "text-zinc-200 bg-white/5 border-white/10";
  if (s === "denied") return "text-red-200 bg-red-500/10 border-red-500/20";
  return "text-amber-200 bg-amber-500/10 border-amber-500/20";
}

export default function OverviewPage() {
  const [data, setData] = useState<FacilityOverview | null>(null);

  const [estateId, setEstateId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const [err, setErr] = useState<string | null>(null);

  // UX states
  const [needsEstate, setNeedsEstate] = useState(false);
  const [syncingEstate, setSyncingEstate] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [modalErr, setModalErr] = useState<string | null>(null);
  const [estateForm, setEstateForm] = useState({
    name: "",
    address: "",
    lat: "",
    lng: "",
    type: "estate",
  });

  // ✅ Community widget state
  const [communityItems, setCommunityItems] = useState<CommunityPost[]>([]);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [communityErr, setCommunityErr] = useState<string | null>(null);

  // ✅ Mini-Security widget state (real DB data)
  const [visitorItems, setVisitorItems] = useState<VisitorItem[]>([]);
  const [visitorLoading, setVisitorLoading] = useState(false);
  const [visitorErr, setVisitorErr] = useState<string | null>(null);

  const trendDevices = useMemo(() => series(8), []);
  const trendVisitors = useMemo(() => series(5), []);
  const trendWallet = useMemo(() => series(12), []);

  const canCreateEstate = estateForm.name.trim().length > 1;
  async function hydrateEstateFromMembership() {
    try {
      const res = await facilityService.myEstates();
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
    const [res, memberships] = await Promise.all([
      facilityService.overview(),
      facilityService.myEstates().catch(() => null),
    ]);
    const membershipEstateId = memberships?.estates?.[0]?.id || null;
    setData(res);
    if (res?.estate_id || membershipEstateId) {
      setEstateId(res?.estate_id || membershipEstateId);
      setNeedsEstate(false);
    } else {
      setEstateId(null);
      setNeedsEstate(true);
    }
    setSyncingEstate(false);
    return res?.estate_id || null;
  }

  async function loadCommunity(eid?: string | null) {
    const estate = eid || estateId;
    if (!estate) return;

    setCommunityLoading(true);
    setCommunityErr(null);

    try {
      const posts = await communityService.listByEstate(estate);
      setCommunityItems(posts || []);
    } catch (e: any) {
      const { status, msg } = extractErr(e);
      setCommunityErr(`${msg}${status ? ` (HTTP ${status})` : ""}`);
      setCommunityItems([]);
    } finally {
      setCommunityLoading(false);
    }
  }

  async function loadVisitorsToday() {
    setVisitorLoading(true);
    setVisitorErr(null);
    try {
      const res = await visitorService.listToday();
      setVisitorItems((res || []) as VisitorItem[]);
    } catch (e: any) {
      const { status, msg } = extractErr(e);
      setVisitorErr(`${msg}${status ? ` (HTTP ${status})` : ""}`);
      setVisitorItems([]);
    } finally {
      setVisitorLoading(false);
    }
  }

  async function load() {
    setErr(null);
    setNeedsEstate(false);
    setSyncingEstate(false);
    setLoading(true);

    try {
      const eid = await loadOverview();
      if (eid) {
        await Promise.all([loadCommunity(eid), loadVisitorsToday()]);
      }
    } catch (e: any) {
      const { status, msg } = extractErr(e);

      const lower = msg.toLowerCase();
      const looksLikeNotLinked = lower.includes("estate not linked") || status === 400;

      if (looksLikeNotLinked) {
        const eid = await hydrateEstateFromMembership();

        if (eid) {
          setData(null);
          setSyncingEstate(true);
          setErr(null);
          await Promise.all([loadCommunity(eid), loadVisitorsToday()]);
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
      setShowCreate(false);
      setEstateForm({ name: "", address: "", lat: "", lng: "", type: "estate" });

      const eid = await hydrateEstateFromMembership();
      await load();

      if (eid) {
        await Promise.all([loadCommunity(eid), loadVisitorsToday()]);
      }
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

  const latestPosts = (communityItems || []).slice(0, 3);

  const visitorStats = useMemo(() => {
    const all = visitorItems || [];
    let pending = 0;
    let approved = 0;
    let entered = 0;
    let exited = 0;
    let denied = 0;

    for (const v of all as any[]) {
      const s = String(v?.status || "").toLowerCase();
      if (s === "pending") pending++;
      else if (s === "approved") approved++;
      else if (s === "entered") entered++;
      else if (s === "exited") exited++;
      else if (s === "denied") denied++;
    }

    const inEstate = Math.max(0, entered - exited);
    return { pending, approved, entered, exited, denied, inEstate, total: all.length };
  }, [visitorItems]);

  const accessLogs = useMemo(() => {
    const sorted = [...(visitorItems as any[])].sort((a, b) => {
      const ta = new Date(a?.created_at || 0).getTime();
      const tb = new Date(b?.created_at || 0).getTime();
      return tb - ta;
    });

    return sorted.slice(0, 6).map((v) => ({
      time: timeOnly(v?.created_at),
      who: safeStr(v?.visitor_name),
      purpose: safeStr(v?.purpose),
      status: String(v?.status || "active"),
    }));
  }, [visitorItems]);

  return (
    <div className="space-y-7">
      <Topbar title="Overview" subtitle="Operational summary" showUser={false} showNotifications={true} />

      {/* Header strip */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="muted">{estateId ? `Site: ${estateId}` : "Site: —"}</div>

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

      {/* No estate */}
      {needsEstate && (
        <div className="glass border border-white/10 rounded-2xl p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="text-lg font-semibold">No site linked yet</div>
              <div className="text-sm text-zinc-400 mt-1 max-w-2xl">
                To unlock homes, rooms, visitors and maintenance, create your first site.
                You’ll automatically become <span className="text-zinc-200">Owner</span>.
              </div>
              <div className="text-xs text-zinc-500 mt-3">
                Estate-style meaning: “register the master estate before adding blocks/units.”
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

      {/* Syncing */}
      {syncingEstate && (
        <div className="glass border border-white/10 rounded-2xl p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="text-lg font-semibold">Site created — syncing access</div>
              <div className="text-sm text-zinc-400 mt-1 max-w-2xl">
                Membership is active but overview still reads from a “linked site” field.
                Tap retry to refresh.
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

      {!!err && !needsEstate && !syncingEstate && (
        <div className="glass border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-200">
          {err}
        </div>
      )}

      {/* Main stat cards (small refactor: Hardware Devices -> Energy) */}
      <div className="grid gap-4 lg:gap-5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Homes"
          value={formatNumber(data?.homes ?? 0)}
          hint="Units under management"
          href="/homes"
        />

        <StatCard
          label="Energy"
          value={formatNumber(data?.active_devices ?? 0)}
          hint="Consumption • generation • performance"
          tone="good"
          href="/security"
        />

        <StatCard
          label="Open Maintenance"
          value={formatNumber(data?.open_maintenance ?? 0)}
          hint="Open + in progress"
          tone={data?.open_maintenance ? "warn" : "good"}
          href="/maintenance"
        />

        <StatCard
          label="Security & Access"
          value={formatNumber(data?.visitors_today ?? 0)}
          hint="Visitor activity today"
          href="/visitors"
        />
      </div>

      {/* Replace Cameras with Mini-Security + keep Community */}
      <div className="grid gap-4 lg:gap-5 grid-cols-1 xl:grid-cols-2">
        {/* ✅ MINI SECURITY (REAL DB) */}
        <div className="glass p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-medium">Security Snapshot</div>
              <div className="text-xs text-zinc-500 mt-1">
                Visitor approvals • entry/exit • gate pressure (live from DB)
              </div>
            </div>

            <div className="flex gap-2">
              <Link href="/visitors">
                <Button variant="ghost">Open Security</Button>
              </Link>
              <Button variant="ghost" onClick={loadVisitorsToday} disabled={!estateId || visitorLoading}>
                {visitorLoading ? "Checking..." : "Refresh"}
              </Button>
            </div>
          </div>

          {visitorErr && (
            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {visitorErr}
            </div>
          )}

          {!estateId ? (
            <div className="mt-4 text-sm text-zinc-400">
              No site linked yet. Create/select a site to view security signals.
            </div>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="text-[11px] text-white/45">Pending</div>
                  <div className="mt-1 text-lg font-semibold text-white">{visitorStats.pending}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="text-[11px] text-white/45">Approved</div>
                  <div className="mt-1 text-lg font-semibold text-white">{visitorStats.approved}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="text-[11px] text-white/45">In estate</div>
                  <div className="mt-1 text-lg font-semibold text-white">{visitorStats.inEstate}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="text-[11px] text-white/45">Denied</div>
                  <div className="mt-1 text-lg font-semibold text-white">{visitorStats.denied}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="text-[11px] text-white/45">Total today</div>
                  <div className="mt-1 text-lg font-semibold text-white">{visitorStats.total}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="text-[11px] text-white/45">Alerts</div>
                  <div className="mt-1 text-lg font-semibold text-white">{formatNumber(data?.alerts ?? 0)}</div>
                </div>
              </div>

              <div className="mt-5">
                <div className="text-xs text-zinc-500">Recent access events</div>

                {accessLogs.length === 0 ? (
                  <div className="mt-3 text-sm text-zinc-400">No visitor events yet today.</div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {accessLogs.map((x, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white truncate">{x.who}</div>
                          <div className="text-xs text-zinc-500 truncate">
                            {x.purpose} • {x.time}
                          </div>
                        </div>

                        <span
                          className={`shrink-0 inline-flex text-[11px] px-2 py-1 rounded-full border ${statusTone(x.status)}`}
                        >
                          {String(x.status).replaceAll("_", " ")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ✅ COMMUNITY (unchanged) */}
        <div className="glass p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-medium">Community</div>
              <div className="text-xs text-zinc-500 mt-1">
                Estate broadcasts • announcements • live updates
              </div>
            </div>

            <div className="flex gap-2">
              <Link href="/community">
                <Button variant="ghost">Open Community</Button>
              </Link>

              <Button
                variant="ghost"
                onClick={() => loadCommunity(estateId)}
                disabled={!estateId || communityLoading}
              >
                {communityLoading ? "Checking..." : "New Update"}
              </Button>
            </div>
          </div>

          {communityErr && (
            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {communityErr}
            </div>
          )}

          {!estateId ? (
            <div className="mt-4 text-sm text-zinc-400">
              No site linked yet. Select/onboard a site to view community updates.
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {latestPosts.length === 0 ? (
                <div className="text-sm text-zinc-400">No community posts yet.</div>
              ) : (
                latestPosts.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">
                        {p.title || "Untitled"}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {when(p.created_at)} • {p.status || "published"}
                      </div>
                    </div>

                    <div className="text-xs text-zinc-500 shrink-0">Live</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Signal panels (kept: same structure) */}
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
              <div className="mt-2 text-3xl font-semibold">{formatNumber(data?.visitors_today ?? 0)}</div>
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

      {/* Ops strip (kept) */}
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

      {/* Create estate modal (kept exactly) */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/70" onClick={() => !creating && setShowCreate(false)} />
          <div className="relative glass border border-white/10 rounded-2xl w-full max-w-xl p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-semibold">Create Site</div>
                <div className="text-sm text-zinc-400 mt-1">
                  Register the master site. You’ll become the Owner and can invite managers.
                </div>
              </div>
              <button className="text-zinc-400 hover:text-zinc-200" onClick={() => !creating && setShowCreate(false)}>
                ✕
              </button>
            </div>

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
                After creation, you can add homes, rooms, and invite managers.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
