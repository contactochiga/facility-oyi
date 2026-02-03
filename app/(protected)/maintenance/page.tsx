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
  const [status, setStatus] = useState<"open" | "in_progress" | "resolved" | "all">("open");

  async function load() {
    setLoading(true);
    try {
      const res = await maintenanceService.list(status === "all" ? undefined : { status });
      setItems(res || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const columns = useMemo<ColumnDef<MaintenanceItem>[]>(() => [
    { accessorKey: "title", header: "Title" },
    { accessorKey: "status", header: "Status" },
    { accessorKey: "created_at", header: "Created" },
  ], []);

  return (
    <div className="space-y-7">
      <Topbar title="Maintenance" subtitle="Work orders • SLA lanes • operational assignment" />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/60">Status</span>
          <select
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
          >
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="resolved">Resolved</option>
            <option value="all">All</option>
          </select>
        </div>

        <Button variant="ghost" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      <DataTable data={items} columns={columns} title="Maintenance Requests" searchKey={"title"} />
    </div>
  );
}
