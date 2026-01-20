// app/(protected)/homes/page.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { facilityService } from "@/services/facilityService";

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
  const [estateId, setEstateId] = useState<string | null>(null);

  const [homes, setHomes] = useState<HomeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Expand → rooms cache
  const [openHomeId, setOpenHomeId] = useState<string | null>(null);
  const [roomsByHome, setRoomsByHome] = useState<Record<string, RoomRow[]>>({});
  const [roomsLoading, setRoomsLoading] = useState<Record<string, boolean>>({});

  // Add modal
  const [showAdd, setShowAdd] = useState(false);
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
    setLoading(true);
    try {
      await facilityService.createHome({
        estate_id: estateId,
        name: form.name.trim(),
        unit: form.unit.trim() || undefined,
        block: form.block.trim() || undefined,
        description: form.description.trim() || undefined,
        type: "home",
      });

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

      await load();
    } catch (e: any) {
      setErr(e?.response?.data?.error || "Failed to create home");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-7">
      <Topbar
        title="Homes"
        subtitle="Units under management • meters • rooms • memberships"
      />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="muted">
          {estateId ? `Estate: ${estateId}` : "Estate: —"}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
          <Button onClick={() => setShowAdd(true)} disabled={!estateId}>
            Add Home
          </Button>
        </div>
      </div>

      {err && (
        <div className="glass border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-200">
          {err}
        </div>
      )}

      {/* TABLE */}
      <div className="glass border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="text-sm font-medium">Homes ({homes.length})</div>
          <div className="text-xs text-zinc-500">
            Tap a row to expand rooms + meters
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
              {homes.map((h) => {
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
                  <>
                    <tr
                      key={h.id}
                      className="border-b border-white/10 hover:bg-white/5 cursor-pointer"
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
                      <tr className="border-b border-white/10 bg-white/[0.02]">
                        <td colSpan={5} className="px-5 py-5">
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            {/* Home Details */}
                            <div className="space-y-3">
                              <div className="text-sm font-medium">Home Details</div>
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
                                <div className="text-sm font-medium">
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

                                  {/* ✅ NEW: Manage Users */}
                                  <a
                                    href={`/homes/${h.id}/users`}
                                    className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm bg-white/5 border border-white/10 hover:bg-white/10 transition"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    Manage Users
                                  </a>
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

                              <div className="text-xs text-zinc-500 mt-2">
                                Home users are managed in <span className="text-zinc-300">Manage Users</span>.
                                Residents will later manage visitors/staff inside the consumer app.
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}

              {!homes.length && !loading && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-zinc-400">
                    No homes yet. Click{" "}
                    <span className="text-zinc-200">Add Home</span> to register the first unit.
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
          <div className="relative glass border border-white/10 rounded-2xl w-full max-w-xl p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-semibold">Add Home</div>
                <div className="text-sm text-zinc-400 mt-1">
                  Register a home/unit under this estate.
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

              <div className="flex gap-2 mt-2">
                <Button variant="ghost" onClick={() => setShowAdd(false)}>
                  Cancel
                </Button>
                <Button onClick={createHome} disabled={!canSubmit || loading}>
                  {loading ? "Saving..." : "Create Home"}
                </Button>
              </div>

              <div className="text-xs text-zinc-500 mt-2">
                Devices can be attached later per room/home (optional).
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
