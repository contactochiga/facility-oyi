"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import facilityService from "@/services/facilityService";

type RoomRow = {
  id: string;
  name: string;
  type?: string | null;
  floor?: number | null;
  created_at?: string;
};

export default function HomeRoomsPage() {
  const params = useParams<{ homeId: string }>();
  const sp = useSearchParams();

  const homeId = String(params.homeId);
  // We pass estateId in the URL from Homes page: ?estateId=...
  const estateId = sp.get("estateId") || "";

  const [items, setItems] = useState<RoomRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("room");
  const [floor, setFloor] = useState<string>("");

  async function load() {
    setLoading(true);
    try {
      const res = await facilityService.listRooms(homeId);
      setItems(res.rooms || []);
    } finally {
      setLoading(false);
    }
  }

  async function createRoom() {
    if (!estateId) {
      alert("Missing estateId. Go back to Homes and click Manage Rooms again.");
      return;
    }
    if (!name.trim()) {
      alert("Room name is required");
      return;
    }

    setLoading(true);
    try {
      await facilityService.createRoom({
        estate_id: estateId,
        home_id: homeId,
        name: name.trim(),
        type: type || undefined,
        floor: floor ? Number(floor) : undefined,
        ai_profile: {},
      });

      setShowCreate(false);
      setName("");
      setType("room");
      setFloor("");
      await load();
    } catch (e: any) {
      alert(e?.message || "Failed to create room");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeId]);

  const columns = useMemo(
    () => [
      { accessorKey: "name", header: "Room" },
      { accessorKey: "type", header: "Type" },
      { accessorKey: "floor", header: "Floor" },
      { accessorKey: "created_at", header: "Created" },
    ],
    []
  );

  return (
    <div className="space-y-7">
      <Topbar title="Rooms" subtitle="Create rooms under this home • later we assign users/devices" />

      <div className="flex items-center justify-end gap-3">
        <Button variant="ghost" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
        <Button onClick={() => setShowCreate(true)}>Add Room</Button>
      </div>

      <DataTable data={items} columns={columns as any} title="Rooms" searchKey={"name"} />

      {/* Simple modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-950 p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-semibold text-white">Create Room</div>
                <div className="text-sm text-zinc-400">
                  Home: <span className="text-zinc-200">{homeId}</span>
                </div>
              </div>
              <button
                className="text-zinc-400 hover:text-white"
                onClick={() => setShowCreate(false)}
              >
                ✕
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <input
                className="w-full rounded-xl bg-white/5 px-4 py-3 text-white outline-none ring-1 ring-white/10 focus:ring-white/20"
                placeholder="Room name (e.g. Living Room)"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              <div className="grid grid-cols-2 gap-3">
                <input
                  className="w-full rounded-xl bg-white/5 px-4 py-3 text-white outline-none ring-1 ring-white/10 focus:ring-white/20"
                  placeholder="Type (e.g. room, lobby)"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                />
                <input
                  className="w-full rounded-xl bg-white/5 px-4 py-3 text-white outline-none ring-1 ring-white/10 focus:ring-white/20"
                  placeholder="Floor (optional)"
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                />
              </div>

              {!estateId && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  Missing <b>estateId</b> in URL. We’ll fix it by updating the Homes “Manage Rooms”
                  button to include it.
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button onClick={createRoom} disabled={loading}>
                {loading ? "Creating..." : "Create Room"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
