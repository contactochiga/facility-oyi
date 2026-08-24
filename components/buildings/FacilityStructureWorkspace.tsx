"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Building2, ChevronDown, ChevronRight, CircleGauge, DoorOpen,
  Droplets, Home, HousePlug, KeyRound, Layers3, Pencil, Plus, RefreshCw,
  Search, UserPlus, Users, Wifi, X, Zap,
} from "lucide-react";
import Button from "@/components/ui/Button";
import { facilityService, type EstateBuildingRow, type EstateStructureResponse, type HomeInviteRow } from "@/services/facilityService";

type HomeRecord = {
  id: string; estate_id?: string; building_id?: string | null; name?: string; unit?: string | null;
  block?: string | null; floor?: string | number | null; description?: string | null; type?: string | null;
  resident_id?: string | null; resident_name?: string | null; primary_resident_name?: string | null;
  occupancy_status?: string | null; member_count?: number; active_member_count?: number;
  pending_invite_count?: number; expired_invite_count?: number; room_count?: number; device_count?: number;
  electricity_meter?: string | null; water_meter?: string | null; internet_id?: string | null; gate_code?: string | null;
  service_bindings?: Record<string, Record<string, any>>;
};

type RoomRecord = { id: string; name: string; type?: string | null; floor?: number | null };
type ResidentOption = { id: string; label: string; meta: string };
type FormState = {
  name: string; building_id: string; unit: string; block: string; description: string; resident_id: string;
  electricity_meter: string; electricity_kct: string; electricity_kctn: string; water_meter: string;
  gas_id: string; internet_id: string; gate_code: string; provider: string; tariff_profile: string; billing_profile: string;
};

const emptyForm: FormState = { name: "", building_id: "", unit: "", block: "", description: "", resident_id: "", electricity_meter: "", electricity_kct: "", electricity_kctn: "", water_meter: "", gas_id: "", internet_id: "", gate_code: "", provider: "", tariff_profile: "", billing_profile: "" };

function low(value: unknown) { return String(value || "").toLowerCase(); }
function occupied(home: HomeRecord) { return low(home.occupancy_status) === "occupied"; }
function invitationState(invite: HomeInviteRow) { return low(invite.lifecycle_status || invite.status || "pending"); }
function floorLabel(home: HomeRecord) {
  const value = home.floor ?? home.block;
  return String(value ?? "").trim();
}
function serviceValue(home: HomeRecord, key: string) {
  const service = home.service_bindings?.[key] || {};
  return service.status || service.plan || service.provider || service.meter_id || service.account_ref || null;
}
function formFromHome(home: HomeRecord): FormState {
  return {
    name: String(home.name || ""), building_id: String(home.building_id || ""), unit: String(home.unit || ""),
    block: String(home.block || home.floor || ""), description: String(home.description || ""), resident_id: String(home.resident_id || ""),
    electricity_meter: String(home.electricity_meter || ""),
    electricity_kct: String(home.service_bindings?.utility_token?.kct || ""),
    electricity_kctn: String(home.service_bindings?.utility_token?.kctn || ""),
    water_meter: String(home.water_meter || ""),
    gas_id: String(home.service_bindings?.gas_service?.account_ref || home.service_bindings?.gas_service?.meter_id || ""),
    internet_id: String(home.internet_id || ""), gate_code: String(home.gate_code || ""),
    provider: String(home.service_bindings?.utility_token?.provider || home.service_bindings?.water_service?.provider || home.service_bindings?.internet_service?.provider || ""),
    tariff_profile: String(home.service_bindings?.utility_token?.tariff_profile || home.service_bindings?.water_service?.tariff_profile || home.service_bindings?.internet_service?.tariff_profile || ""),
    billing_profile: String(home.service_bindings?.utility_token?.billing_profile || home.service_bindings?.water_service?.billing_profile || home.service_bindings?.internet_service?.billing_profile || ""),
  };
}
function serviceBindings(form: FormState) {
  const common = { provider: form.provider.trim() || undefined, tariff_profile: form.tariff_profile.trim() || undefined, billing_profile: form.billing_profile.trim() || undefined };
  return {
    utility_token: { ...common, account_ref: form.electricity_meter.trim() || undefined, meter_id: form.electricity_meter.trim() || undefined, kct: form.electricity_kct.trim() || undefined, kctn: form.electricity_kctn.trim() || undefined },
    water_service: { ...common, account_ref: form.water_meter.trim() || undefined, meter_id: form.water_meter.trim() || undefined },
    gas_service: { ...common, account_ref: form.gas_id.trim() || undefined, meter_id: form.gas_id.trim() || undefined },
    internet_service: { ...common, account_ref: form.internet_id.trim() || undefined }, service_charge: common, other_facility_fees: common,
  };
}

function Metric({ icon, label, value, detail, tone = "text-sky-400" }: { icon: React.ReactNode; label: string; value: React.ReactNode; detail: string; tone?: string }) {
  return <article className="rounded-xl border border-[var(--ois-border-subtle)] bg-[var(--ois-surface)] p-3.5"><div className="flex items-center gap-3"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-black/20 ${tone}`}>{icon}</span><span className="min-w-0"><small className="block truncate text-[9px] uppercase tracking-[.08em] text-zinc-500">{label}</small><b className="mt-0.5 block text-xl font-semibold text-white">{value}</b><small className="block truncate text-[9px] text-zinc-600">{detail}</small></span></div></article>;
}

function HomeSummary({ home, rooms, loadingRooms, estateId, onEdit, onLoadRooms }: { home: HomeRecord; rooms: RoomRecord[]; loadingRooms: boolean; estateId: string; onEdit: () => void; onLoadRooms: () => void }) {
  const resident = home.primary_resident_name || home.resident_name || (home.active_member_count ? `${home.active_member_count} active resident${home.active_member_count === 1 ? "" : "s"}` : "Unassigned");
  const services = [
    [Zap, "Electricity", home.electricity_meter || serviceValue(home, "utility_token")],
    [Droplets, "Water", home.water_meter || serviceValue(home, "water_service")],
    [Wifi, "Internet", home.internet_id || serviceValue(home, "internet_service")],
    [KeyRound, "Access", home.gate_code ? "Configured" : null],
  ] as const;
  return <div className="border-t border-[var(--ois-border-subtle)] bg-black/10 p-3 sm:p-4">
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-lg border border-[var(--ois-border-subtle)] p-3"><small className="text-zinc-600">Assigned resident</small><p className="mt-1 truncate text-xs text-zinc-200">{resident}</p></div>
      <div className="rounded-lg border border-[var(--ois-border-subtle)] p-3"><small className="text-zinc-600">Occupancy</small><p className={`mt-1 text-xs ${occupied(home) ? "text-emerald-400" : "text-amber-300"}`}>{String(home.occupancy_status || "Status unavailable").replaceAll("_", " ")}</p></div>
      <div className="rounded-lg border border-[var(--ois-border-subtle)] p-3"><small className="text-zinc-600">Setup</small><p className="mt-1 text-xs text-zinc-200">{Number(home.pending_invite_count || 0) + Number(home.expired_invite_count || 0) ? "Needs attention" : "No recorded issues"}</p></div>
      <div className="rounded-lg border border-[var(--ois-border-subtle)] p-3"><small className="text-zinc-600">Devices</small><p className="mt-1 text-xs text-zinc-200">{home.device_count ?? "Unavailable"}</p></div>
    </div>
    <h4 className="mt-4 text-[10px] font-medium uppercase tracking-[.08em] text-zinc-500">Services & access</h4>
    <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">{services.map(([Icon, label, value]) => <div key={label} className="flex items-center gap-2 rounded-lg border border-[var(--ois-border-subtle)] px-3 py-2.5"><Icon className="h-3.5 w-3.5 text-sky-400"/><span className="min-w-0"><b className="block text-[10px] text-zinc-300">{label}</b><small className="block truncate text-[9px] text-zinc-600">{value || "Not configured"}</small></span></div>)}</div>
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <Button variant="ghost" onClick={onEdit}><Pencil className="mr-2 h-3.5 w-3.5"/>Edit Home</Button>
      <Link href={`/homes/${home.id}/users?estateId=${encodeURIComponent(estateId)}`} className="rounded-lg border border-[var(--ois-border-subtle)] px-3 py-2 text-[11px] text-zinc-300 hover:text-white">Manage Access</Link>
      <Link href={`/homes/${home.id}/rooms?estateId=${encodeURIComponent(estateId)}`} className="rounded-lg border border-[var(--ois-border-subtle)] px-3 py-2 text-[11px] text-zinc-300 hover:text-white">View Rooms</Link>
      <Link href={`/services?home_id=${encodeURIComponent(home.id)}`} className="rounded-lg border border-[var(--ois-border-subtle)] px-3 py-2 text-[11px] text-zinc-300 hover:text-white">View Services</Link>
      <button type="button" onClick={onLoadRooms} className="ml-auto text-[10px] text-sky-400">{loadingRooms ? "Loading rooms…" : rooms.length ? `${rooms.length} rooms loaded` : "Load room summary"}</button>
    </div>
    {rooms.length ? <div className="mt-2 flex flex-wrap gap-1.5">{rooms.map(room => <span key={room.id} className="rounded-md bg-white/[.03] px-2 py-1 text-[9px] text-zinc-500">{room.name}{room.type ? ` · ${room.type}` : ""}</span>)}</div> : null}
  </div>;
}

function HomeEditor({ home, buildings, residents, form, saving, error, onChange, onClose, onSave }: { home: HomeRecord | null; buildings: EstateBuildingRow[]; residents: ResidentOption[]; form: FormState; saving: boolean; error: string | null; onChange: (next: FormState) => void; onClose: () => void; onSave: () => void }) {
  const field = (key: keyof FormState, label: string, secret = false) => <label className="grid gap-1.5 text-[10px] text-zinc-400"><span>{label}</span><input type={secret ? "password" : "text"} value={form[key]} onChange={event => onChange({ ...form, [key]: event.target.value })} className="min-h-10 rounded-lg border border-[var(--ois-border-subtle)] bg-black/25 px-3 text-xs text-white outline-none focus:border-sky-400/40"/></label>;
  return <div className="fixed inset-0 z-50 flex justify-end bg-black/70 p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={home ? "Edit Home" : "Add Home"}><div className="flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-[var(--ois-border-default)] bg-[#070d14] shadow-2xl sm:rounded-2xl sm:border">
    <header className="flex items-start justify-between border-b border-[var(--ois-border-subtle)] px-5 py-4"><div><h2 className="text-base font-semibold text-white">{home ? "Edit Home" : "Add Home / Unit"}</h2><p className="mt-1 text-xs text-zinc-500">Preserves the existing Home provisioning and service configuration workflow.</p></div><button onClick={onClose} aria-label="Close editor"><X className="h-5 w-5 text-zinc-500"/></button></header>
    <div className="flex-1 space-y-5 overflow-y-auto p-5">
      {error ? <p className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</p> : null}
      <section><h3 className="text-[10px] font-semibold uppercase tracking-[.12em] text-zinc-500">Home</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">{field("name", "Home / Unit name")}<label className="grid gap-1.5 text-[10px] text-zinc-400"><span>Building relationship</span><select value={form.building_id} onChange={event => onChange({ ...form, building_id: event.target.value })} className="min-h-10 rounded-lg border border-[var(--ois-border-subtle)] bg-[#0a111a] px-3 text-xs text-white"><option value="">Property level / no building</option>{buildings.map(building => <option key={building.id} value={building.id}>{building.name}</option>)}</select></label>{field("block", "Floor / block metadata")}{field("unit", "Unit identifier")}</div><div className="mt-3">{field("description", "Description")}</div></section>
      <section><h3 className="text-[10px] font-semibold uppercase tracking-[.12em] text-zinc-500">Resident / occupancy</h3><label className="mt-3 grid gap-1.5 text-[10px] text-zinc-400"><span>Assigned resident</span><select value={form.resident_id} onChange={event => onChange({ ...form, resident_id: event.target.value })} className="min-h-10 rounded-lg border border-[var(--ois-border-subtle)] bg-[#0a111a] px-3 text-xs text-white"><option value="">Assign resident later</option>{residents.map(resident => <option key={resident.id} value={resident.id}>{resident.label}{resident.meta ? ` · ${resident.meta}` : ""}</option>)}</select></label></section>
      <section><h3 className="text-[10px] font-semibold uppercase tracking-[.12em] text-zinc-500">Utilities & services</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">{field("electricity_meter", "Electricity meter ID")}{field("water_meter", "Water meter ID")}{field("internet_id", "Internet account / ID")}{field("gas_id", "Gas service ID")}{field("electricity_kct", "Electricity KCT", true)}{field("electricity_kctn", "Electricity KCTN", true)}</div></section>
      <section><h3 className="text-[10px] font-semibold uppercase tracking-[.12em] text-zinc-500">Access</h3><div className="mt-3">{field("gate_code", "Gate / access configuration", true)}</div></section>
      <section><h3 className="text-[10px] font-semibold uppercase tracking-[.12em] text-zinc-500">Billing / provider</h3><div className="mt-3 grid gap-3 sm:grid-cols-3">{field("provider", "Provider")}{field("tariff_profile", "Tariff profile")}{field("billing_profile", "Billing profile")}</div></section>
    </div>
    <footer className="flex justify-end gap-2 border-t border-[var(--ois-border-subtle)] p-4"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={onSave} disabled={saving || !form.name.trim()}>{saving ? "Saving…" : home ? "Save Changes" : "Create Home"}</Button></footer>
  </div></div>;
}

export default function FacilityStructureWorkspace() {
  const [data, setData] = useState<EstateStructureResponse | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState(""); const [openBuildings, setOpenBuildings] = useState<Set<string>>(new Set());
  const [openFloors, setOpenFloors] = useState<Set<string>>(new Set()); const [openHome, setOpenHome] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Record<string, RoomRecord[]>>({}); const [roomsLoading, setRoomsLoading] = useState<string | null>(null);
  const [residents, setResidents] = useState<ResidentOption[]>([]); const [editorHome, setEditorHome] = useState<HomeRecord | null | undefined>(undefined);
  const [form, setForm] = useState<FormState>(emptyForm); const [saving, setSaving] = useState(false); const [editorError, setEditorError] = useState<string | null>(null);
  const [buildingModal, setBuildingModal] = useState(false); const [buildingName, setBuildingName] = useState(""); const [buildingFloors, setBuildingFloors] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const structure = await facilityService.estateStructure(); setData(structure);
      try { const response = await facilityService.listEstateUsers(); setResidents((response.users || []).map((row: any) => ({ id: String(row?.users?.id || ""), label: row?.users?.full_name || row?.users?.username || row?.users?.email || "Resident", meta: row?.users?.email || row?.role || "" })).filter((item: ResidentOption) => item.id)); } catch { setResidents([]); }
    } catch (requestError: any) { setError(requestError?.response?.data?.error || requestError?.message || "Unable to load Facility structure."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); const listener = (event: Event) => { const name = String((event as CustomEvent)?.detail?.event || ""); if (/estate|building|home|room|resident|invite|access|service|device/.test(name)) void load(); }; window.addEventListener("facility:realtime-event", listener); return () => window.removeEventListener("facility:realtime-event", listener); }, [load]);

  const homes = (data?.homes || []) as HomeRecord[]; const buildings = data?.buildings || []; const summary = data?.summary;
  const visibleHomes = useMemo(() => { const needle = query.trim().toLowerCase(); return needle ? homes.filter(home => [home.name, home.unit, home.block, home.description].some(value => low(value).includes(needle))) : homes; }, [homes, query]);
  const grouped = useMemo(() => buildings.map(building => ({ building, homes: visibleHomes.filter(home => String(home.building_id || "") === String(building.id)) })).filter(group => !query || low(group.building.name).includes(low(query)) || group.homes.length), [buildings, visibleHomes, query]);
  const standalone = visibleHomes.filter(home => !home.building_id || !buildings.some(building => String(building.id) === String(home.building_id)));
  const attention = useMemo(() => (data?.invitations || []).filter(invite => ["pending", "expired", "revoked"].includes(invitationState(invite)) || invite.delivery_status === "failed"), [data]);
  const issueCount = Number(summary?.resident_access_issues || 0) + Number(summary?.homes_without_residents || 0);
  const toggle = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) => setter(current => { const next = new Set(current); next.has(key) ? next.delete(key) : next.add(key); return next; });
  const loadRooms = async (homeId: string) => { setRoomsLoading(homeId); try { const response = await facilityService.listRooms(homeId); setRooms(current => ({ ...current, [homeId]: response.rooms || [] })); } finally { setRoomsLoading(null); } };
  const openEditor = (home: HomeRecord | null) => { setEditorHome(home); setForm(home ? formFromHome(home) : emptyForm); setEditorError(null); };
  const saveHome = async () => { if (!data?.estate?.id) return; setSaving(true); setEditorError(null); const payload = { building_id: form.building_id || null, name: form.name.trim(), unit: form.unit.trim() || undefined, block: form.block.trim() || undefined, description: form.description.trim() || undefined, resident_id: form.resident_id || undefined, electricity_meter: form.electricity_meter.trim() || undefined, water_meter: form.water_meter.trim() || undefined, internet_id: form.internet_id.trim() || undefined, gate_code: form.gate_code.trim() || undefined, service_bindings: serviceBindings(form) }; try { if (editorHome?.id) await facilityService.updateHome(editorHome.id, payload); else await facilityService.createHome({ estate_id: data.estate.id, ...payload, building_id: form.building_id || undefined, type: "home" }); setEditorHome(undefined); await load(); } catch (requestError: any) { setEditorError(requestError?.response?.data?.error || "Unable to save this Home."); } finally { setSaving(false); } };
  const addBuilding = async () => { if (!data?.estate?.id || !buildingName.trim()) return; setSaving(true); try { await facilityService.createBuilding({ estate_id: data.estate.id, name: buildingName.trim(), floors: buildingFloors ? Number(buildingFloors) : undefined }); setBuildingModal(false); setBuildingName(""); setBuildingFloors(""); await load(); } catch (requestError: any) { setError(requestError?.response?.data?.error || "Unable to add this building."); } finally { setSaving(false); } };

  const renderHome = (home: HomeRecord) => { const expanded = openHome === home.id; return <div key={home.id} data-home-row className="overflow-hidden rounded-lg border border-[var(--ois-border-subtle)] bg-black/10"><button type="button" onClick={() => setOpenHome(expanded ? null : home.id)} className="flex w-full items-center gap-3 px-3 py-3 text-left"><Home className="h-4 w-4 shrink-0 text-sky-300"/><span className="min-w-0 flex-1"><b className="block truncate text-xs text-zinc-200">{home.name || home.unit || "Unnamed Home"}</b><small className="block truncate text-[9px] text-zinc-600">{[home.unit, home.description].filter(Boolean).join(" · ") || "Property-level Home"}</small></span><span className={`rounded-full px-2 py-1 text-[8px] ${occupied(home) ? "bg-emerald-500/10 text-emerald-400" : "bg-white/[.04] text-zinc-500"}`}>{home.occupancy_status || "Unavailable"}</span>{expanded ? <ChevronDown className="h-4 w-4 text-zinc-600"/> : <ChevronRight className="h-4 w-4 text-zinc-600"/>}</button>{expanded ? <HomeSummary home={home} rooms={rooms[home.id] || []} loadingRooms={roomsLoading === home.id} estateId={data?.estate?.id || ""} onEdit={() => openEditor(home)} onLoadRooms={() => void loadRooms(home.id)}/> : null}</div>; };

  return <div className="space-y-4 pb-6">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-xl font-semibold tracking-tight text-white">Buildings</h1><p className="mt-1 text-xs text-zinc-500">Spaces, Homes and occupancy across {data?.estate?.name || "the active facility"}.</p></div><div className="flex gap-2"><Button variant="ghost" onClick={() => void load()}><RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}/>Refresh</Button><Button onClick={() => setBuildingModal(true)}><Plus className="mr-2 h-4 w-4"/>Add Building</Button></div></header>
    {error ? <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">{error}</p> : null}
    <section className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6"><Metric icon={<Building2 className="h-4 w-4"/>} label="Buildings" value={summary?.buildings ?? buildings.length} detail="Active structures"/><Metric icon={<HousePlug className="h-4 w-4"/>} label="Homes / units" value={summary?.homes ?? homes.length} detail="Registered Homes"/><Metric icon={<Users className="h-4 w-4"/>} label="Occupied" value={summary?.occupied_homes ?? homes.filter(occupied).length} detail="Assigned occupancy" tone="text-emerald-400"/><Metric icon={<Home className="h-4 w-4"/>} label="Vacant" value={summary?.vacant_homes ?? homes.filter(home => low(home.occupancy_status) === "vacant").length} detail="Canonical status" tone="text-emerald-400"/><Metric icon={<UserPlus className="h-4 w-4"/>} label="Residents" value={summary?.active_residents ?? "—"} detail="Active residents"/><Metric icon={<AlertTriangle className="h-4 w-4"/>} label="Setup issues" value={issueCount} detail="Needs attention" tone={issueCount ? "text-amber-400" : "text-zinc-500"}/></section>
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]"><div className="rounded-xl border border-[var(--ois-border-default)] bg-[var(--ois-surface)] p-3 sm:p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-white">Facility Structure</h2><p className="mt-1 text-[10px] text-zinc-600">Canonical Building → floor/block → Home relationships</p></div><button onClick={() => openEditor(null)} className="text-[10px] text-sky-400">+ Add Home / Unit</button></div><label className="mt-3 flex items-center gap-2 rounded-lg border border-[var(--ois-border-subtle)] bg-black/15 px-3"><Search className="h-3.5 w-3.5 text-zinc-600"/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search buildings, floors or Homes…" className="min-h-10 flex-1 bg-transparent text-xs text-white outline-none"/></label><div className="mt-3 space-y-2">
      {grouped.map(({ building, homes: buildingHomes }) => { const open = openBuildings.has(building.id); const floorGroups = new Map<string, HomeRecord[]>(); const direct: HomeRecord[] = []; buildingHomes.forEach(home => { const floor = floorLabel(home); if (!floor) direct.push(home); else floorGroups.set(floor, [...(floorGroups.get(floor) || []), home]); }); const countOccupied = buildingHomes.filter(occupied).length; return <div key={building.id} data-building-row className="rounded-lg border border-[var(--ois-border-subtle)] bg-black/10"><button type="button" onClick={() => toggle(setOpenBuildings, building.id)} className="flex w-full items-center gap-3 px-3 py-3 text-left"><Building2 className="h-5 w-5 text-sky-300"/><span className="min-w-0 flex-1"><b className="block truncate text-xs text-zinc-200">{building.name}</b><small className="text-[9px] text-zinc-600">{building.floors ? `${building.floors} floors · ` : ""}{buildingHomes.length} Homes / units</small></span><span className="hidden text-right sm:block"><b className="block text-xs text-emerald-400">{buildingHomes.length ? Math.round(countOccupied / buildingHomes.length * 100) : 0}%</b><small className="text-[8px] text-zinc-600">occupied</small></span>{open ? <ChevronDown className="h-4 w-4 text-zinc-600"/> : <ChevronRight className="h-4 w-4 text-zinc-600"/>}</button>{open ? <div className="space-y-2 border-t border-[var(--ois-border-subtle)] p-2 sm:p-3">{[...floorGroups.entries()].map(([floor, floorHomes]) => { const floorKey = `${building.id}:${floor}`; const floorOpen = openFloors.has(floorKey); return <div key={floorKey} data-floor-row className="rounded-lg border border-[var(--ois-border-subtle)]"><button type="button" onClick={() => toggle(setOpenFloors, floorKey)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left"><Layers3 className="h-4 w-4 text-sky-400"/><span className="flex-1 text-xs text-zinc-300">{/^floor/i.test(floor) ? floor : `Floor / block ${floor}`}<small className="ml-2 text-[9px] text-zinc-600">{floorHomes.length} units</small></span>{floorOpen ? <ChevronDown className="h-4 w-4 text-zinc-600"/> : <ChevronRight className="h-4 w-4 text-zinc-600"/>}</button>{floorOpen ? <div className="space-y-2 border-t border-[var(--ois-border-subtle)] p-2">{floorHomes.map(renderHome)}</div> : null}</div>; })}{direct.map(renderHome)}{!buildingHomes.length ? <p className="p-3 text-xs text-zinc-600">No Homes assigned to this Building.</p> : null}</div> : null}</div>; })}
      {standalone.length ? <div className="rounded-lg border border-[var(--ois-border-subtle)] bg-black/10 p-2"><div className="flex items-center gap-2 px-2 py-2"><Home className="h-4 w-4 text-sky-300"/><span><b className="block text-xs text-zinc-300">Standalone / property-level Homes</b><small className="text-[9px] text-zinc-600">No artificial Building relationship</small></span></div><div className="space-y-2">{standalone.map(renderHome)}</div></div> : null}
      {!loading && !grouped.length && !standalone.length ? <div className="rounded-lg border border-[var(--ois-border-subtle)] px-4 py-10 text-center"><Building2 className="mx-auto h-5 w-5 text-zinc-700"/><p className="mt-2 text-xs text-zinc-500">No Facility structure has been registered yet.</p><button onClick={() => setBuildingModal(true)} className="mt-2 text-[10px] text-sky-400">Add the first Building</button></div> : null}
    </div></div><aside className="space-y-4"><div className="rounded-xl border border-[var(--ois-border-default)] bg-[var(--ois-surface)] p-4"><h2 className="text-sm font-semibold text-white">Registry Attention</h2><p className="mt-1 text-[10px] text-zinc-600">Existing invitation and assignment status</p><div className="mt-3 space-y-2">{attention.slice(0,5).map(invite => <Link key={invite.id} href={`/homes/${invite.home_id}/users`} className="flex items-center gap-2 rounded-lg border border-[var(--ois-border-subtle)] p-2.5"><AlertTriangle className="h-3.5 w-3.5 text-amber-400"/><span className="min-w-0 flex-1"><b className="block truncate text-[10px] text-zinc-300">{invite.invited_email || "Resident invitation"}</b><small className="text-[9px] text-zinc-600">{invitationState(invite)} · {invite.delivery_status || "delivery pending"}</small></span><ChevronRight className="h-3.5 w-3.5 text-zinc-700"/></Link>)}{summary?.homes_without_residents ? <Link href="/homes?view=access" className="flex items-center gap-2 rounded-lg border border-[var(--ois-border-subtle)] p-2.5"><AlertTriangle className="h-3.5 w-3.5 text-amber-400"/><span className="flex-1 text-[10px] text-zinc-300">{summary.homes_without_residents} unassigned Homes</span><ChevronRight className="h-3.5 w-3.5 text-zinc-700"/></Link> : null}{!attention.length && !summary?.homes_without_residents ? <p className="py-6 text-center text-[10px] text-zinc-600">No registry issues require attention.</p> : null}</div></div><div className="rounded-xl border border-[var(--ois-border-default)] bg-[var(--ois-surface)] p-4"><h2 className="text-sm font-semibold text-white">Quick Actions</h2><div className="mt-3 grid grid-cols-2 gap-2">{[["Add Home", () => openEditor(null), Home], ["Add Building", () => setBuildingModal(true), Building2]].map(([label, action, Icon]: any) => <button key={label} onClick={action} className="flex items-center gap-2 rounded-lg border border-[var(--ois-border-subtle)] p-2.5 text-left text-[10px] text-zinc-300"><Icon className="h-3.5 w-3.5 text-sky-400"/>{label}</button>)}<Link href="/homes?view=access" className="flex items-center gap-2 rounded-lg border border-[var(--ois-border-subtle)] p-2.5 text-[10px] text-zinc-300"><UserPlus className="h-3.5 w-3.5 text-sky-400"/>Invite Resident</Link><Link href="/homes?view=rooms" className="flex items-center gap-2 rounded-lg border border-[var(--ois-border-subtle)] p-2.5 text-[10px] text-zinc-300"><Layers3 className="h-3.5 w-3.5 text-sky-400"/>Room Registry</Link><Link href="/occupancy" className="flex items-center gap-2 rounded-lg border border-[var(--ois-border-subtle)] p-2.5 text-[10px] text-zinc-300"><CircleGauge className="h-3.5 w-3.5 text-sky-400"/>Occupancy</Link><Link href="/homes" className="flex items-center gap-2 rounded-lg border border-[var(--ois-border-subtle)] p-2.5 text-[10px] text-zinc-300"><DoorOpen className="h-3.5 w-3.5 text-sky-400"/>Home Registry</Link></div></div><div className="rounded-xl border border-[var(--ois-border-default)] bg-[var(--ois-surface)] p-4"><h2 className="text-sm font-semibold text-white">Occupancy Overview</h2><div className="mt-4 flex items-center gap-4"><div className="grid h-20 w-20 place-items-center rounded-full border-[9px] border-sky-500/30 border-t-emerald-400"><b className="text-lg text-white">{summary?.homes ? Math.round((summary.occupied_homes || 0) / summary.homes * 100) : 0}%</b></div><div className="space-y-2 text-[10px] text-zinc-500"><p><i className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-400"/>Occupied {summary?.occupied_homes || 0}</p><p><i className="mr-2 inline-block h-2 w-2 rounded-full bg-sky-500"/>Vacant {summary?.vacant_homes || 0}</p><p className="max-w-[170px] text-[9px] text-zinc-700">Assignment status only; physical presence is not inferred.</p></div></div></div></aside></section>
    {editorHome !== undefined ? <HomeEditor home={editorHome} buildings={buildings} residents={residents} form={form} saving={saving} error={editorError} onChange={setForm} onClose={() => setEditorHome(undefined)} onSave={() => void saveHome()}/> : null}
    {buildingModal ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"><div className="w-full max-w-md rounded-xl border border-[var(--ois-border-default)] bg-[#070d14] p-5"><div className="flex justify-between"><div><h2 className="text-base font-semibold text-white">Add Building</h2><p className="mt-1 text-xs text-zinc-500">Create a canonical Building structure.</p></div><button onClick={() => setBuildingModal(false)}><X className="h-5 w-5 text-zinc-500"/></button></div><div className="mt-5 grid gap-3"><input value={buildingName} onChange={event => setBuildingName(event.target.value)} placeholder="Building name" className="min-h-11 rounded-lg border border-[var(--ois-border-subtle)] bg-black/20 px-3 text-sm text-white outline-none"/><input value={buildingFloors} onChange={event => setBuildingFloors(event.target.value)} inputMode="numeric" placeholder="Number of floors (optional)" className="min-h-11 rounded-lg border border-[var(--ois-border-subtle)] bg-black/20 px-3 text-sm text-white outline-none"/><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setBuildingModal(false)}>Cancel</Button><Button onClick={() => void addBuilding()} disabled={saving || !buildingName.trim()}>Add Building</Button></div></div></div></div> : null}
  </div>;
}
