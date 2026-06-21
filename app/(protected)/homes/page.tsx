// app/(protected)/homes/page.tsx

"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { MetricCard } from "@/components/MetricCard";
import { facilityService } from "@/services/facilityService";
import { ArrowLeft, Building2, DoorOpen, Home, Pencil, Search, Users } from "lucide-react";

type HomeRow = {
  id: string;
  estate_id: string;
  name: string;
  unit?: string | null;
  block?: string | null;
  description?: string | null;
  electricity_meter?: string | null;
  water_meter?: string | null;
  internet_id?: string | null;
  gate_code?: string | null;
  lat?: number | null;
  lng?: number | null;
  resident_id?: string | null;
  type?: string | null;
  created_at?: string;
  room_count?: number;
  device_count?: number;
  member_count?: number;
  active_member_count?: number;
  invited_member_count?: number;
  suspended_member_count?: number;
  pending_invite_count?: number;
  expired_invite_count?: number;
  occupancy_status?: "occupied" | "pending_activation" | "vacant" | string;
};

type RoomRow = {
  id: string;
  home_id: string;
  estate_id: string;
  name: string;
  type?: string | null;
  floor?: number | null;
  created_at?: string;
};

function Field({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  return (
    <div className="glass p-3 border border-white/10 rounded-xl">
      <div className="text-[11px] text-zinc-400">{label}</div>
      <div className="text-sm mt-1 text-zinc-100">
        {value === null || value === undefined || value === "" ? "—" : value}
      </div>
    </div>
  );
}

export default function HomesPage() {
  const sp = useSearchParams();
  const [estateId, setEstateId] = useState<string | null>(null);

  const [homes, setHomes] = useState<HomeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Expand → rooms cache
  const [openHomeId, setOpenHomeId] = useState<string | null>(null);
  const [roomsByHome, setRoomsByHome] = useState<Record<string, RoomRow[]>>({});
  const [roomsLoading, setRoomsLoading] = useState<Record<string, boolean>>({});

  // Add modal
  const [showAdd, setShowAdd] = useState(false);
  const [editHomeId, setEditHomeId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    unit: "",
    block: "",
    description: "",
    electricity_meter: "",
    water_meter: "",
    internet_id: "",
    gate_code: "",
  });
  const canSubmit = useMemo(() => form.name.trim().length > 0, [form.name]);
  const editingHome = useMemo(() => homes.find((h) => h.id === editHomeId) || null, [homes, editHomeId]);
  const summary = useMemo(() => {
    return {
      total: homes.length,
      occupied: homes.filter((home) => home.occupancy_status === "occupied").length,
      vacant: homes.filter((home) => home.occupancy_status === "vacant").length,
      pending: homes.reduce((sum, home) => sum + Number(home.pending_invite_count || 0), 0),
    };
  }, [homes]);
  const view = sp.get("view") || "all";
  const filteredHomes = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = homes.filter((home) => {
      if (!needle) return true;
      return [home.name, home.unit, home.block, home.description]
        .some((value) => String(value || "").toLowerCase().includes(needle));
    });
    if (view === "rooms") return [...filtered].sort((a, b) => Number(b.room_count || 0) - Number(a.room_count || 0));
    if (view === "access") return [...filtered].sort((a, b) => Number(b.pending_invite_count || 0) - Number(a.pending_invite_count || 0));
    if (view === "buildings") return [...filtered].sort((a, b) => String(a.block || "").localeCompare(String(b.block || "")));
    return filtered;
  }, [homes, search, view]);

  async function bootstrapEstate() {
    const res = await facilityService.myEstates(); // { estates: [...] }
    const first = res?.estates?.[0];
    if (first?.id) return first.id as string;
    return null;
  }

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const eid = estateId || (await bootstrapEstate());
      setEstateId(eid);

      if (!eid) {
        setHomes([]);
        setErr("No estate linked. Go to Overview and Create Estate first.");
        return;
      }

      const res = await facilityService.listHomes(eid); // { homes: [] }
      setHomes(res?.homes || []);
    } catch (e: any) {
      setErr(e?.response?.data?.error || "Failed to load homes");
    } finally {
      setLoading(false);
    }
  }

  async function loadRooms(homeId: string) {
    setRoomsLoading((p) => ({ ...p, [homeId]: true }));
    try {
      const res = await facilityService.listRooms(homeId); // { rooms: [] }
      setRoomsByHome((p) => ({ ...p, [homeId]: res?.rooms || [] }));
    } catch {
      setRoomsByHome((p) => ({ ...p, [homeId]: [] }));
    } finally {
      setRoomsLoading((p) => ({ ...p, [homeId]: false }));
    }
  }

  async function toggleHome(homeId: string) {
    const next = openHomeId === homeId ? null : homeId;
    setOpenHomeId(next);

    if (next && !roomsByHome[next]) {
      await loadRooms(next);
    }
  }

  async function createHome() {
    if (!estateId) return;
    setErr(null);
    setNotice(null);
    setLoading(true);
    try {
      const res = await facilityService.createHome({
        estate_id: estateId,
        name: form.name.trim(),
        unit: form.unit.trim() || undefined,
        block: form.block.trim() || undefined,
        description: form.description.trim() || undefined,
        electricity_meter: form.electricity_meter.trim() || undefined,
        water_meter: form.water_meter.trim() || undefined,
        internet_id: form.internet_id.trim() || undefined,
        gate_code: form.gate_code.trim() || undefined,
        type: "home",
      });

      if (res?.home?.id) {
        setHomes((prev) => [res.home as HomeRow, ...prev]);
      }

      setShowAdd(false);
      setForm({
        name: "",
        unit: "",
        block: "",
        description: "",
        electricity_meter: "",
        water_meter: "",
        internet_id: "",
        gate_code: "",
      });
      setNotice("Home created successfully.");

      await load();
    } catch (e: any) {
      setErr(e?.response?.data?.error || "Failed to create home");
    } finally {
      setLoading(false);
    }
  }

  async function saveHomeEdit() {
    if (!editHomeId) return;
    setErr(null);
    setNotice(null);
    setLoading(true);
    try {
      const res = await facilityService.updateHome(editHomeId, {
        name: form.name.trim() || undefined,
        unit: form.unit.trim() || undefined,
        block: form.block.trim() || undefined,
        description: form.description.trim() || undefined,
        electricity_meter: form.electricity_meter.trim() || undefined,
        water_meter: form.water_meter.trim() || undefined,
        internet_id: form.internet_id.trim() || undefined,
        gate_code: form.gate_code.trim() || undefined,
      });

      if (res?.home?.id) {
        setHomes((prev) =>
          prev.map((home) => (home.id === res.home.id ? ({ ...home, ...(res.home as HomeRow) }) : home))
        );
      }

      setShowAdd(false);
      setEditHomeId(null);
      setForm({
        name: "",
        unit: "",
        block: "",
        description: "",
        electricity_meter: "",
        water_meter: "",
        internet_id: "",
        gate_code: "",
      });
      setNotice("Home details updated successfully.");
      await load();
    } catch (e: any) {
      setErr(e?.response?.data?.error || "Failed to update home");
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditHomeId(null);
    setForm({
      name: "",
      unit: "",
      block: "",
      description: "",
      electricity_meter: "",
      water_meter: "",
      internet_id: "",
      gate_code: "",
    });
    setShowAdd(true);
  }

  function openEdit(home: HomeRow) {
    setEditHomeId(home.id);
    setForm({
      name: String(home.name || ""),
      unit: String(home.unit || ""),
      block: String(home.block || ""),
      description: String(home.description || ""),
      electricity_meter: String(home.electricity_meter || ""),
      water_meter: String(home.water_meter || ""),
      internet_id: String(home.internet_id || ""),
      gate_code: String(home.gate_code || ""),
    });
    setShowAdd(true);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (sp.get("action") === "create") openCreate();
    // Query-driven modal opening intentionally tracks route state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  return (
    <div className="space-y-7">
      <Topbar
        title="Homes"
        subtitle="Operational home registry, occupancy, rooms, and resident access."
        rightSlot={
          <Link
            href="/overview"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-200 hover:bg-white/10 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Overview
          </Link>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard title="Homes" value={String(summary.total)} change="Registered units" trend="neutral" icon={Building2} iconColor="text-blue-400" />
        <MetricCard title="Occupied" value={String(summary.occupied)} change="Homes with active residents" trend="neutral" icon={Users} iconColor="text-emerald-400" />
        <MetricCard title="Vacant" value={String(summary.vacant)} change="Homes without assigned residents" trend="neutral" icon={Home} iconColor="text-zinc-300" />
        <MetricCard title="Pending Invites" value={String(summary.pending)} change="Awaiting resident activation" trend="neutral" icon={DoorOpen} iconColor="text-amber-400" />
      </div>

      <div className="glass border border-white/10 rounded-2xl px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Estate Context</div>
          <div className="text-sm text-zinc-100 mt-1">
            {estateId ? "Linked to current estate operations context" : "No estate linked"}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
          <Button onClick={openCreate} disabled={!estateId}>
            Add Home
          </Button>
        </div>
      </div>

      <div className="glass flex flex-col gap-3 border border-white/10 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {[
            ["All Homes", "/homes"],
            ["Buildings", "/homes?view=buildings"],
            ["Rooms", "/homes?view=rooms"],
            ["Access", "/homes?view=access"],
          ].map(([label, href]) => {
            const active = href === "/homes" ? view === "all" : href.includes(`view=${view}`);
            return <Link key={href} href={href} className={`rounded-xl border px-3 py-2 text-xs transition ${active ? "border-sky-400/35 bg-sky-500/10 text-sky-100" : "border-white/10 bg-black/15 text-zinc-400 hover:text-white"}`}>{label}</Link>;
          })}
        </div>
        <label className="flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-black/15 px-3 py-2 lg:w-[320px]">
          <Search className="h-4 w-4 text-zinc-500" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search homes, units, or blocks" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-600" />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {filteredHomes.map((home, index) => (
          <div key={`${home.id}:overview`} className={`glass rounded-2xl border border-white/10 p-5 ${index > 3 ? "xl:hidden" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base font-semibold text-white truncate">{home.name}</div>
                <div className="mt-1 text-xs text-zinc-500 truncate">
                  {[home.block, home.unit].filter(Boolean).join(" / ") || "No block or unit assigned"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => openEdit(home)}
                className="rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-200 hover:bg-white/10 transition"
                aria-label={`Edit ${home.name}`}
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label="Occupancy" value={String(home.occupancy_status || "pending source").replace(/_/g, " ")} />
              <Field label="Members" value={home.member_count ?? "Pending source"} />
              <Field label="Rooms" value={home.room_count ?? "Pending source"} />
              <Field label="Devices" value={home.device_count ?? "Pending source"} />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/homes/${home.id}/rooms?estateId=${encodeURIComponent(estateId || "")}`}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-100 hover:bg-white/10 transition"
              >
                <Building2 className="h-4 w-4" />
                Manage Rooms
              </Link>
              <Link
                href={`/homes/${home.id}/users?estateId=${encodeURIComponent(estateId || "")}`}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-100 hover:bg-white/10 transition"
              >
                <Users className="h-4 w-4" />
                Manage Members
              </Link>
              <Link href="/occupancy" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-100 hover:bg-white/10 transition">
                View Occupancy
              </Link>
              <Button variant="ghost" onClick={() => toggleHome(home.id)}>
                {openHomeId === home.id ? "Collapse" : "Open Details"}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {err && (
        <div className="glass border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-200">
          {err}
        </div>
      )}

      {notice && (
        <div className="glass border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-200">
          {notice}
        </div>
      )}

      {/* TABLE */}
      <div className="hidden overflow-hidden rounded-2xl border border-white/10 md:block">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="text-sm font-medium">Homes ({filteredHomes.length})</div>
          <div className="text-xs text-zinc-500">
            Open a home to manage meters, rooms, and users
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-zinc-400">
              <tr className="border-b border-white/10">
                <th className="text-left px-5 py-3">Home</th>
                <th className="text-left px-5 py-3">Unit</th>
                <th className="text-left px-5 py-3">Block</th>
                <th className="text-left px-5 py-3">Meters</th>
                <th className="text-left px-5 py-3">Internet</th>
              </tr>
            </thead>
            <tbody>
              {filteredHomes.map((h) => {
                const expanded = openHomeId === h.id;
                const rooms = roomsByHome[h.id] || [];
                const rLoading = roomsLoading[h.id];

                const meters = [
                  h.electricity_meter ? `E: ${h.electricity_meter}` : null,
                  h.water_meter ? `W: ${h.water_meter}` : null,
                ]
                  .filter(Boolean)
                  .join(" • ");

                return (
                  <Fragment key={h.id}>
                    <tr
                      className={`border-b border-white/10 cursor-pointer transition ${expanded ? "bg-white/[0.06]" : "hover:bg-white/5"}`}
                      onClick={() => toggleHome(h.id)}
                    >
                      <td className="px-5 py-4">
                        <div className="font-medium text-zinc-100">{h.name}</div>
                        <div className="text-xs text-zinc-500 mt-1">
                          {h.description || "—"}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-zinc-200">{h.unit || "—"}</td>
                      <td className="px-5 py-4 text-zinc-200">{h.block || "—"}</td>
                      <td className="px-5 py-4 text-zinc-200">{meters || "—"}</td>
                      <td className="px-5 py-4 text-zinc-200">{h.internet_id || "—"}</td>
                    </tr>

                    {expanded && (
                      <tr className="border-b border-white/10 bg-white/[0.03]">
                        <td colSpan={5} className="px-5 py-5">
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            {/* Home Details */}
                            <div className="space-y-3">
                              <div className="text-sm font-medium text-zinc-100">Home Details</div>
                              <div className="grid grid-cols-2 gap-3">
                                <Field label="Electricity Meter" value={h.electricity_meter} />
                                <Field label="Water Meter" value={h.water_meter} />
                                <Field label="Internet ID" value={h.internet_id} />
                                <Field label="Gate Code" value={h.gate_code} />
                              </div>
                            </div>

                            {/* Rooms */}
                            <div className="space-y-3 lg:col-span-2">
                              <div className="flex items-center justify-between">
                                <div className="text-sm font-medium text-zinc-100">
                                  Rooms ({rLoading ? "…" : rooms.length})
                                </div>

                                <div className="flex gap-2 flex-wrap justify-end">
                                  <Button
                                    variant="ghost"
                                    onClick={(e: any) => {
                                      e.stopPropagation();
                                      loadRooms(h.id);
                                    }}
                                    disabled={rLoading}
                                  >
                                    {rLoading ? "Loading..." : "Reload Rooms"}
                                  </Button>

                                  {/* ✅ Manage Rooms (keeps estateId in query) */}
                                  <a
                                    href={`/homes/${h.id}/rooms?estateId=${encodeURIComponent(
                                      estateId || ""
                                    )}`}
                                    className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm bg-white/5 border border-white/10 hover:bg-white/10 transition"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    Manage Rooms
                                  </a>

                                  <a
                                    href={`/homes/${h.id}/users?estateId=${encodeURIComponent(
                                      estateId || ""
                                    )}`}
                                    className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm bg-white/5 border border-white/10 hover:bg-white/10 transition"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    Manage Members
                                  </a>
                                  <Button
                                    variant="ghost"
                                    onClick={(e: any) => {
                                      e.stopPropagation();
                                      openEdit(h);
                                    }}
                                  >
                                    Edit Home
                                  </Button>
                                </div>
                              </div>

                              <div className="grid gap-2">
                                {rLoading ? (
                                  <div className="text-sm text-zinc-400">Loading rooms…</div>
                                ) : rooms.length ? (
                                  rooms.map((r) => (
                                    <div
                                      key={r.id}
                                      className="glass p-3 border border-white/10 rounded-xl flex items-center justify-between"
                                    >
                                      <div>
                                        <div className="text-sm font-medium">{r.name}</div>
                                        <div className="text-xs text-zinc-500 mt-1">
                                          {r.type || "—"}{" "}
                                          {r.floor !== null && r.floor !== undefined
                                            ? `• Floor ${r.floor}`
                                            : ""}
                                        </div>
                                      </div>
                                      <div className="text-xs text-zinc-500">
                                        {r.id.slice(0, 8)}…
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-sm text-zinc-400">No rooms yet.</div>
                                )}
                              </div>

                              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-xs text-zinc-400">
                                Use <span className="text-zinc-200">Manage Members</span> to invite residents, update access roles, and disable or remove memberships without leaving the home context.
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}

              {!filteredHomes.length && !loading && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-zinc-400">
                    {homes.length ? "No homes match this filter." : <>No homes yet. Click <span className="text-zinc-200">Add Home</span> to register the first unit.</>}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD HOME MODAL */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowAdd(false)} />
          <div className="relative glass border border-white/10 rounded-2xl w-full max-w-2xl p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-semibold">{editingHome ? "Edit Home" : "Add Home"}</div>
                <div className="text-sm text-zinc-400 mt-1">
                  {editingHome
                    ? "Update utility identifiers, gate details, and the home metadata."
                    : "Register a unit and pre-link its utility/service identifiers."}
                </div>
              </div>
              <button className="text-zinc-400 hover:text-zinc-200" onClick={() => setShowAdd(false)}>
                ✕
              </button>
            </div>

            <div className="grid gap-3 mt-5">
              <input
                className="bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 outline-none"
                placeholder="Home name (e.g. Block A - Unit 12)"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />

              <div className="grid grid-cols-2 gap-3">
                <input
                  className="bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 outline-none"
                  placeholder="Unit (optional)"
                  value={form.unit}
                  onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
                />
                <input
                  className="bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 outline-none"
                  placeholder="Block (optional)"
                  value={form.block}
                  onChange={(e) => setForm((p) => ({ ...p, block: e.target.value }))}
                />
              </div>

              <textarea
                className="bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 outline-none min-h-[90px]"
                placeholder="Description (optional)"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />

              <div className="grid grid-cols-2 gap-3">
                <input
                  className="bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 outline-none"
                  placeholder="Electricity meter (optional)"
                  value={form.electricity_meter}
                  onChange={(e) => setForm((p) => ({ ...p, electricity_meter: e.target.value }))}
                />
                <input
                  className="bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 outline-none"
                  placeholder="Water meter (optional)"
                  value={form.water_meter}
                  onChange={(e) => setForm((p) => ({ ...p, water_meter: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input
                  className="bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 outline-none"
                  placeholder="Internet ID (optional)"
                  value={form.internet_id}
                  onChange={(e) => setForm((p) => ({ ...p, internet_id: e.target.value }))}
                />
                <input
                  className="bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 outline-none"
                  placeholder="Gate code (optional)"
                  value={form.gate_code}
                  onChange={(e) => setForm((p) => ({ ...p, gate_code: e.target.value }))}
                />
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-zinc-400">
                These identifiers feed the consumer app directly. Keep meters and internet IDs accurate here so resident services remain active and bill correctly.
              </div>

              <div className="flex gap-2 mt-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowAdd(false);
                    setEditHomeId(null);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={editingHome ? saveHomeEdit : createHome} disabled={!canSubmit || loading}>
                  {loading ? "Saving..." : editingHome ? "Save Changes" : "Create Home"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
