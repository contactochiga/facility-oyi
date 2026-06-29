"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, Building2, Pencil, Plus, X } from "lucide-react";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { facilityService } from "@/services/facilityService";

type RoomRow = {
  id: string;
  name: string;
  type?: string | null;
  floor?: number | null;
  device_count?: number | null;
  created_at?: string;
};

type RoomForm = { name: string; type: string; floor: string };

const EMPTY_FORM: RoomForm = { name: "", type: "room", floor: "" };

export default function HomeRoomsPage() {
  const params = useParams<{ homeId: string }>();
  const sp = useSearchParams();
  const homeId = String(params.homeId);
  const estateId = sp.get("estateId") || "";
  const [items, setItems] = useState<RoomRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<RoomRow | null>(null);
  const [form, setForm] = useState<RoomForm>(EMPTY_FORM);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await facilityService.listRooms(homeId);
      setItems(response.rooms || []);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.error || requestError?.message || "Unable to load rooms.");
    } finally {
      setLoading(false);
    }
  }, [homeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalDevices = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.device_count || 0), 0),
    [items]
  );

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
    setShowEditor(true);
  }

  function openEdit(room: RoomRow) {
    setEditing(room);
    setForm({
      name: room.name || "",
      type: room.type || "room",
      floor: room.floor === null || room.floor === undefined ? "" : String(room.floor),
    });
    setError(null);
    setShowEditor(true);
  }

  async function saveRoom() {
    if (!form.name.trim()) {
      setError("Room name is required.");
      return;
    }
    if (!editing && !estateId) {
      setError("Estate context is unavailable. Return to Homes and reopen room management.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (editing) {
        await facilityService.updateRoom(editing.id, {
          name: form.name.trim(),
          type: form.type.trim() || "room",
          floor: form.floor ? Number(form.floor) : null,
        });
        setNotice("Room updated. Consumer Spaces will reflect the latest room details.");
      } else {
        await facilityService.createRoom({
          estate_id: estateId,
          home_id: homeId,
          name: form.name.trim(),
          type: form.type.trim() || "room",
          floor: form.floor ? Number(form.floor) : undefined,
          ai_profile: {},
        });
        setNotice("Room created. It is now available to the assigned home.");
      }
      setShowEditor(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      await load();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.error || requestError?.message || "Unable to save room.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Topbar
        title="Rooms"
        subtitle="Review the spaces that appear in the resident home context."
        rightSlot={
          <Link href="/homes?view=rooms" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-200 transition hover:bg-white/10">
            <ArrowLeft className="h-4 w-4" /> Back to Homes
          </Link>
        }
      />

      <section className="glass flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-sky-200">Home spaces</p>
          <p className="mt-1 text-sm text-zinc-300">{items.length} configured rooms · {totalDevices} assigned devices</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={openCreate} disabled={!estateId} className="gap-2">
            <Plus className="h-4 w-4" /> Add Room
          </Button>
        </div>
      </section>

      {!estateId ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Estate context is unavailable. Return to Homes and reopen room management before creating rooms.
        </div>
      ) : null}
      {error ? <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}
      {notice ? <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{notice}</div> : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((room) => (
          <article key={room.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-sky-500/20 bg-sky-500/10">
                  <Building2 className="h-4 w-4 text-sky-200" />
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold text-white">{room.name}</h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    {room.type || "room"}{room.floor === null || room.floor === undefined ? "" : ` · Floor ${room.floor}`}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => openEdit(room)} className="rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-300 transition hover:bg-white/10" aria-label={`Edit ${room.name}`}>
                <Pencil className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-4 text-xs text-zinc-500">{room.device_count ?? "Pending source"} assigned devices</p>
          </article>
        ))}
        {!items.length && !loading ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-black/15 p-5 text-sm text-zinc-500">
            No rooms configured yet. Add the first room to populate Consumer Spaces for this home.
          </div>
        ) : null}
      </section>

      {showEditor ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm">
          <section className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-950 p-5 shadow-2xl">
            <header className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">{editing ? "Edit Room" : "Add Room"}</h2>
                <p className="mt-1 text-sm text-zinc-500">Room names and purposes flow into the resident Spaces experience.</p>
              </div>
              <button type="button" onClick={() => setShowEditor(false)} className="rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-400 hover:text-white" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="mt-5 grid gap-3">
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Room name" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-sky-400/40" />
              <div className="grid grid-cols-2 gap-3">
                <input value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} placeholder="Purpose or type" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-sky-400/40" />
                <input value={form.floor} onChange={(event) => setForm({ ...form, floor: event.target.value })} placeholder="Floor (optional)" inputMode="numeric" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-sky-400/40" />
              </div>
            </div>
            <footer className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowEditor(false)}>Cancel</Button>
              <Button onClick={() => void saveRoom()} disabled={loading}>{loading ? "Saving" : editing ? "Save Changes" : "Create Room"}</Button>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}
