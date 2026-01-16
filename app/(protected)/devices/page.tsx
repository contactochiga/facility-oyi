"use client";

import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { deviceService, type FacilityDevice } from "@/services/deviceService";
import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";

export default function DevicesPage() {
  const [items, setItems] = useState<FacilityDevice[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await deviceService.list();
      setItems(res);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const columns = useMemo<ColumnDef<FacilityDevice>[]>(() => [
    { accessorKey: "name", header: "Device" },
    { accessorKey: "type", header: "Type" },
    { accessorKey: "status", header: "Status",
      cell: ({ row }) => {
        const s = row.original.status ?? "unknown";
        const tone =
          s === "active" ? "text-emerald-200 bg-emerald-500/10 border-emerald-500/20"
          : s === "offline" ? "text-red-200 bg-red-500/10 border-red-500/20"
          : "text-zinc-200 bg-white/5 border-white/10";
        return <span className={`px-2 py-1 rounded-full border text-xs ${tone}`}>{s}</span>;
      }
    },
    { accessorKey: "room", header: "Room" },
    { accessorKey: "created_at", header: "Created" },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button variant="ghost" onClick={() => alert(`Open device: ${row.original.id}`)}>
            View
          </Button>
        </div>
      )
    }
  ], []);

  return (
    <div className="space-y-7">
      <Topbar title="Devices" subtitle="Estate device registry • operational truth • control hooks" />

      <div className="flex justify-end">
        <Button variant="ghost" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      <DataTable data={items} columns={columns} title="Devices" searchKey={"name"} />
    </div>
  );
}
