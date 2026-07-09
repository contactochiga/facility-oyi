// app/(protected)/homes/page.tsx

"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import OisCard from "@/components/ois/OisCard";
import OisDrawer from "@/components/ois/OisDrawer";
import OisListItem from "@/components/ois/OisListItem";
import OisStatusBadge from "@/components/ois/OisStatusBadge";
import { OisPageToolbar, OisRegistryHeader, OisRuntimeCard } from "@/components/ois";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { facilityService } from "@/services/facilityService";
import { Building2, ChevronRight, Pencil, Users } from "lucide-react";

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
  service_bindings?: Record<string, {
    provider?: string | null;
    account_ref?: string | null;
    meter_id?: string | null;
    plan?: string | null;
    status?: string | null;
    linked?: boolean;
    tariff_profile?: string | null;
    billing_profile?: string | null;
    kct?: string | null;
    kctn?: string | null;
  }>;
};

type ResidentOption = {
  id: string;
  label: string;
  meta: string;
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
  value?: ReactNode;
}) {
  return (
    <OisCard variant="evidence" className="p-3">
      <div className="text-[11px] text-[var(--ois-text-muted)]">{label}</div>
      <div className="mt-1 text-sm text-[var(--ois-text-primary)]">
        {value === null || value === undefined || value === "" ? "—" : value}
      </div>
    </OisCard>
  );
}

function occupancyStatus(value?: string | null) {
  const status = String(value || "pending source").toLowerCase();
  if (status === "occupied") return "stable";
  if (status === "vacant") return "warning";
  if (status === "pending_activation") return "pending";
  return "unavailable";
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
  const [mobileHomeId, setMobileHomeId] = useState<string | null>(null);
  const [roomsByHome, setRoomsByHome] = useState<Record<string, RoomRow[]>>({});
  const [roomsLoading, setRoomsLoading] = useState<Record<string, boolean>>({});

  // Add modal
  const [showAdd, setShowAdd] = useState(false);
  const [editHomeId, setEditHomeId] = useState<string | null>(null);
  const [residentOptions, setResidentOptions] = useState<ResidentOption[]>([]);
  const [form, setForm] = useState({
    name: "",
    unit: "",
    block: "",
    description: "",
    resident_id: "",
    electricity_meter: "",
    electricity_kct: "",
    electricity_kctn: "",
    water_meter: "",
    gas_id: "",
    internet_id: "",
    gate_code: "",
    provider: "",
    tariff_profile: "",
    billing_profile: "",
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
  const selectedMobileHome = useMemo(() => filteredHomes.find((home) => home.id === mobileHomeId) || null, [filteredHomes, mobileHomeId]);

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
      try {
        const estateUsers = await facilityService.listEstateUsers();
        const options = Array.isArray(estateUsers?.users)
          ? estateUsers.users
              .map((row: any) => {
                const user = row?.users;
                const id = String(user?.id || "");
                if (!id) return null;
                return {
                  id,
                  label: user?.full_name || user?.username || user?.email || "Resident",
                  meta: [user?.email || null, row?.role || null].filter(Boolean).join(" · "),
                };
              })
              .filter(Boolean) as ResidentOption[]
          : [];
        setResidentOptions(options);
      } catch {
        setResidentOptions([]);
      }
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

  async function openMobileHome(homeId: string) {
    setMobileHomeId(homeId);
    if (!roomsByHome[homeId]) {
      await loadRooms(homeId);
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
        resident_id: form.resident_id || undefined,
        electricity_meter: form.electricity_meter.trim() || undefined,
        water_meter: form.water_meter.trim() || undefined,
        internet_id: form.internet_id.trim() || undefined,
        gate_code: form.gate_code.trim() || undefined,
        service_bindings: {
          utility_token: {
            account_ref: form.electricity_meter.trim() || undefined,
            meter_id: form.electricity_meter.trim() || undefined,
            provider: form.provider.trim() || undefined,
            tariff_profile: form.tariff_profile.trim() || undefined,
            billing_profile: form.billing_profile.trim() || undefined,
            kct: form.electricity_kct.trim() || undefined,
            kctn: form.electricity_kctn.trim() || undefined,
          },
          water_service: {
            account_ref: form.water_meter.trim() || undefined,
            meter_id: form.water_meter.trim() || undefined,
            provider: form.provider.trim() || undefined,
            tariff_profile: form.tariff_profile.trim() || undefined,
            billing_profile: form.billing_profile.trim() || undefined,
          },
          gas_service: {
            account_ref: form.gas_id.trim() || undefined,
            meter_id: form.gas_id.trim() || undefined,
            provider: form.provider.trim() || undefined,
            tariff_profile: form.tariff_profile.trim() || undefined,
            billing_profile: form.billing_profile.trim() || undefined,
          },
          internet_service: {
            account_ref: form.internet_id.trim() || undefined,
            provider: form.provider.trim() || undefined,
            tariff_profile: form.tariff_profile.trim() || undefined,
            billing_profile: form.billing_profile.trim() || undefined,
          },
          service_charge: {
            provider: form.provider.trim() || undefined,
            tariff_profile: form.tariff_profile.trim() || undefined,
            billing_profile: form.billing_profile.trim() || undefined,
          },
          other_facility_fees: {
            provider: form.provider.trim() || undefined,
            tariff_profile: form.tariff_profile.trim() || undefined,
            billing_profile: form.billing_profile.trim() || undefined,
          },
        },
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
        resident_id: "",
        electricity_meter: "",
        electricity_kct: "",
        electricity_kctn: "",
        water_meter: "",
        gas_id: "",
        internet_id: "",
        gate_code: "",
        provider: "",
        tariff_profile: "",
        billing_profile: "",
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
        resident_id: form.resident_id || undefined,
        electricity_meter: form.electricity_meter.trim() || undefined,
        water_meter: form.water_meter.trim() || undefined,
        internet_id: form.internet_id.trim() || undefined,
        gate_code: form.gate_code.trim() || undefined,
        service_bindings: {
          utility_token: {
            account_ref: form.electricity_meter.trim() || undefined,
            meter_id: form.electricity_meter.trim() || undefined,
            provider: form.provider.trim() || undefined,
            tariff_profile: form.tariff_profile.trim() || undefined,
            billing_profile: form.billing_profile.trim() || undefined,
            kct: form.electricity_kct.trim() || undefined,
            kctn: form.electricity_kctn.trim() || undefined,
          },
          water_service: {
            account_ref: form.water_meter.trim() || undefined,
            meter_id: form.water_meter.trim() || undefined,
            provider: form.provider.trim() || undefined,
            tariff_profile: form.tariff_profile.trim() || undefined,
            billing_profile: form.billing_profile.trim() || undefined,
          },
          gas_service: {
            account_ref: form.gas_id.trim() || undefined,
            meter_id: form.gas_id.trim() || undefined,
            provider: form.provider.trim() || undefined,
            tariff_profile: form.tariff_profile.trim() || undefined,
            billing_profile: form.billing_profile.trim() || undefined,
          },
          internet_service: {
            account_ref: form.internet_id.trim() || undefined,
            provider: form.provider.trim() || undefined,
            tariff_profile: form.tariff_profile.trim() || undefined,
            billing_profile: form.billing_profile.trim() || undefined,
          },
          service_charge: {
            provider: form.provider.trim() || undefined,
            tariff_profile: form.tariff_profile.trim() || undefined,
            billing_profile: form.billing_profile.trim() || undefined,
          },
          other_facility_fees: {
            provider: form.provider.trim() || undefined,
            tariff_profile: form.tariff_profile.trim() || undefined,
            billing_profile: form.billing_profile.trim() || undefined,
          },
        },
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
        resident_id: "",
        electricity_meter: "",
        electricity_kct: "",
        electricity_kctn: "",
        water_meter: "",
        gas_id: "",
        internet_id: "",
        gate_code: "",
        provider: "",
        tariff_profile: "",
        billing_profile: "",
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
      resident_id: "",
      electricity_meter: "",
      electricity_kct: "",
      electricity_kctn: "",
      water_meter: "",
      gas_id: "",
      internet_id: "",
      gate_code: "",
      provider: "",
      tariff_profile: "",
      billing_profile: "",
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
      resident_id: String(home.resident_id || ""),
      electricity_meter: String(home.electricity_meter || ""),
      electricity_kct: String(home.service_bindings?.utility_token?.kct || ""),
      electricity_kctn: String(home.service_bindings?.utility_token?.kctn || ""),
      water_meter: String(home.water_meter || ""),
      gas_id: String(home.service_bindings?.gas_service?.account_ref || home.service_bindings?.gas_service?.meter_id || ""),
      internet_id: String(home.internet_id || ""),
      gate_code: String(home.gate_code || ""),
      provider: String(home.service_bindings?.utility_token?.provider || home.service_bindings?.water_service?.provider || home.service_bindings?.internet_service?.provider || ""),
      tariff_profile: String(home.service_bindings?.utility_token?.tariff_profile || home.service_bindings?.water_service?.tariff_profile || home.service_bindings?.internet_service?.tariff_profile || ""),
      billing_profile: String(home.service_bindings?.utility_token?.billing_profile || home.service_bindings?.water_service?.billing_profile || home.service_bindings?.internet_service?.billing_profile || ""),
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
        title="Home Registry"
        subtitle="Homes and resident access"
        strip={[
          { label: "Healthy", value: summary.pending || summary.vacant ? "Review" : "Stable", detail: "Registry posture", tone: summary.pending || summary.vacant ? "warning" : "stable" },
          { label: "Homes", value: summary.total, detail: "Registered units", tone: "attention" },
          { label: "Attention", value: summary.pending + summary.vacant, detail: "Vacant or pending", tone: "warning" },
          { label: "Updated", value: loading ? "Refreshing" : "Now", detail: "Live registry", tone: "info" },
        ]}
      />

      <div className="md:hidden">
        <OisPageToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search homes, blocks, residents..."
        filterSlot={
          <div className="flex min-w-max flex-nowrap gap-2">
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
        }
        bulkSlot={<Button onClick={openCreate} disabled={!estateId}>Add Home</Button>}
        onRefresh={load}
        refreshing={loading}
        />
      </div>


      <div className="space-y-2 md:hidden">
        <OisRegistryHeader title="Homes Registry" caption={`Showing ${filteredHomes.length} of ${homes.length} homes`} />
        {filteredHomes.map((home) => (
          <OisListItem
            key={`${home.id}:mobile`}
            title={home.name}
            description={`${String(home.occupancy_status || "pending source").replace(/_/g, " ")} · ${home.room_count ?? "Pending"} rooms`}
            meta={`${[home.block, home.unit].filter(Boolean).join(" / ") || "No block or unit assigned"} · ${home.member_count ?? "Pending"} members`}
            status={occupancyStatus(home.occupancy_status)}
            action={<ChevronRight className="h-4 w-4 text-[var(--ois-text-muted)]" />}
            onClick={() => void openMobileHome(home.id)}
            className="w-full text-left"
          />
        ))}
        {!filteredHomes.length && !loading ? <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">{homes.length ? "No homes match this filter." : "No homes yet. Use Add Home to register the first unit."}</p> : null}
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
      <div className="hidden overflow-hidden rounded-[var(--ois-radius-card)] border border-[var(--ois-border-default)] bg-[var(--ois-surface)] shadow-[var(--ois-elevation-card)] md:block">
        <div className="border-b border-white/10 px-5 py-4">
          <OisRegistryHeader title="Homes Registry" caption={`Showing ${filteredHomes.length} of ${homes.length} homes. Open a home to review meters, rooms, and access.`} />
        </div>
        <div className="border-b border-white/10 px-5 py-4">
          <OisPageToolbar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search homes, blocks, residents..."
            filterSlot={
              <div className="flex min-w-max flex-nowrap gap-2">
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
            }
            bulkSlot={<Button onClick={openCreate} disabled={!estateId}>Add Home</Button>}
            onRefresh={load}
            refreshing={loading}
          />
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
                            <div className="space-y-3">
                              <div className="text-sm font-medium text-zinc-100">Home Overview</div>
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
                                    {rLoading ? "Refreshing rooms" : "Reload Rooms"}
                                  </Button>

                                  <a
                                    href={`/homes/${h.id}/rooms?estateId=${encodeURIComponent(
                                      estateId || ""
                                    )}`}
                                    className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm bg-white/5 border border-white/10 hover:bg-white/10 transition"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    Open Rooms
                                  </a>

                                  <a
                                    href={`/homes/${h.id}/users?estateId=${encodeURIComponent(
                                      estateId || ""
                                    )}`}
                                    className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm bg-white/5 border border-white/10 hover:bg-white/10 transition"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    Open Access
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
                                    <OisListItem
                                      key={r.id}
                                      title={r.name}
                                      description={`${r.type || "—"}${r.floor !== null && r.floor !== undefined ? ` • Floor ${r.floor}` : ""}`}
                                      meta={`${r.id.slice(0, 8)}…`}
                                    />
                                  ))
                                ) : (
                                  <div className="text-sm text-zinc-400">No rooms yet.</div>
                                )}
                              </div>

                              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-xs text-zinc-400">
                                Use <span className="text-zinc-200">Open Access</span> to invite residents, update access roles, and disable or remove memberships without leaving the home context.
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

      <OisRuntimeCard
        title="Runtime Insights"
        items={[
          { label: "Occupancy rate", value: summary.total ? `${Math.round((summary.occupied / Math.max(summary.total, 1)) * 100)}%` : "—", delta: "registered homes" },
          { label: "Invite pressure", value: summary.pending, delta: "awaiting activation" },
        ]}
      />

      <OisDrawer
        open={Boolean(selectedMobileHome)}
        onClose={() => setMobileHomeId(null)}
        title={selectedMobileHome?.name || "Home overview"}
        subtitle={selectedMobileHome ? `${[selectedMobileHome.block, selectedMobileHome.unit].filter(Boolean).join(" / ") || "No block or unit assigned"} · ${String(selectedMobileHome.occupancy_status || "pending source").replace(/_/g, " ")}` : undefined}
        width="md"
        footer={selectedMobileHome ? <div className="flex flex-wrap gap-2"><Link href={`/homes/${selectedMobileHome.id}/rooms?estateId=${encodeURIComponent(estateId || "")}`} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100"><Building2 className="h-4 w-4" />Open Rooms</Link><Link href={`/homes/${selectedMobileHome.id}/users?estateId=${encodeURIComponent(estateId || "")}`} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100"><Users className="h-4 w-4" />Open Access</Link><Button variant="ghost" onClick={() => { setMobileHomeId(null); openEdit(selectedMobileHome); }}><Pencil className="mr-2 h-4 w-4" />Edit Home</Button></div> : null}
      >
        {selectedMobileHome ? <div className="space-y-4"><OisCard variant="evidence" className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-white">{selectedMobileHome.description || "No home description recorded."}</p><p className="mt-2 text-xs text-zinc-500">Pending invites {selectedMobileHome.pending_invite_count || 0} · Devices {selectedMobileHome.device_count ?? "Pending source"}</p></div><OisStatusBadge status={occupancyStatus(selectedMobileHome.occupancy_status)} label={String(selectedMobileHome.occupancy_status || "pending source").replace(/_/g, " ")} /></div></OisCard><div className="grid gap-3 sm:grid-cols-2"><Field label="Members" value={selectedMobileHome.member_count ?? "Pending source"} /><Field label="Rooms" value={selectedMobileHome.room_count ?? "Pending source"} /><Field label="Electricity Meter" value={selectedMobileHome.electricity_meter} /><Field label="Water Meter" value={selectedMobileHome.water_meter} /><Field label="Internet ID" value={selectedMobileHome.internet_id} /><Field label="Gate Code" value={selectedMobileHome.gate_code} /></div><OisCard variant="evidence" className="p-4"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-white">Rooms</h3><Button variant="ghost" onClick={() => void loadRooms(selectedMobileHome.id)} disabled={roomsLoading[selectedMobileHome.id]}>{roomsLoading[selectedMobileHome.id] ? "Refreshing rooms" : "Reload"}</Button></div><div className="mt-3 space-y-2">{roomsLoading[selectedMobileHome.id] ? <p className="text-sm text-zinc-400">Refreshing rooms…</p> : (roomsByHome[selectedMobileHome.id] || []).length ? (roomsByHome[selectedMobileHome.id] || []).map((room) => <OisListItem key={room.id} title={room.name} description={`${room.type || "—"}${room.floor !== null && room.floor !== undefined ? ` • Floor ${room.floor}` : ""}`} meta={`${room.id.slice(0, 8)}…`} />) : <p className="text-sm text-zinc-400">No rooms yet.</p>}</div></OisCard></div> : null}
      </OisDrawer>

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

              <select
                className="bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 outline-none"
                value={form.resident_id}
                onChange={(e) => setForm((p) => ({ ...p, resident_id: e.target.value }))}
              >
                <option value="">Assign resident later</option>
                {residentOptions.map((resident) => (
                  <option key={resident.id} value={resident.id}>
                    {resident.label} {resident.meta ? `· ${resident.meta}` : ""}
                  </option>
                ))}
              </select>

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
                  placeholder="KCT (optional)"
                  value={form.electricity_kct}
                  onChange={(e) => setForm((p) => ({ ...p, electricity_kct: e.target.value }))}
                />
                <input
                  className="bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 outline-none"
                  placeholder="KCTN (optional)"
                  value={form.electricity_kctn}
                  onChange={(e) => setForm((p) => ({ ...p, electricity_kctn: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input
                  className="bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 outline-none"
                  placeholder="Gas service ID (optional)"
                  value={form.gas_id}
                  onChange={(e) => setForm((p) => ({ ...p, gas_id: e.target.value }))}
                />
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

              <div className="grid gap-3 md:grid-cols-3">
                <input
                  className="bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 outline-none"
                  placeholder="Provider (optional)"
                  value={form.provider}
                  onChange={(e) => setForm((p) => ({ ...p, provider: e.target.value }))}
                />
                <input
                  className="bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 outline-none"
                  placeholder="Tariff profile (optional)"
                  value={form.tariff_profile}
                  onChange={(e) => setForm((p) => ({ ...p, tariff_profile: e.target.value }))}
                />
                <input
                  className="bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 outline-none"
                  placeholder="Billing profile (optional)"
                  value={form.billing_profile}
                  onChange={(e) => setForm((p) => ({ ...p, billing_profile: e.target.value }))}
                />
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-zinc-400">
                Saving this home now provisions resident-facing infrastructure services automatically. Meter IDs, gas/internet accounts, tariff profile, billing profile, and resident assignment feed Consumer OS, wallet readiness, and Oyi Core service signals.
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
