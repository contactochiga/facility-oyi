"use client";

import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { maintenanceService, type MaintenanceItem } from "@/services/maintenanceService";
import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";

export default function MaintenancePage() {
  const [items, setItems] = useState<MaintenanceItem[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await maintenanceService.list();
      setItems(res || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const columns = useMemo<ColumnDef<MaintenanceItem>[]>(() => [
    { accessorKey: "title", header: "Title" },
    { accessorKey: "status", header: "Status" },
    { accessorKey: "created_at", header: "Created" },
  ], []);

  return (
    <div className="space-y-7">
      <Topbar title="Maintenance" subtitle="Work orders • SLA lanes • operational assignment" />

      <div className="flex justify-end">
        <Button variant="ghost" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      <DataTable data={items} columns={columns} title="Maintenance Requests" searchKey={"title"} />
    </div>
  );
}
