"use client";

import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { notificationService, type AlertItem } from "@/services/notificationService";
import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";

export default function AlertsPage() {
  const [items, setItems] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await notificationService.unread();
      setItems(res || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const columns = useMemo<ColumnDef<AlertItem>[]>(() => [
    { accessorKey: "title", header: "Title" },
    { accessorKey: "message", header: "Message" },
    { accessorKey: "created_at", header: "Created" },
  ], []);

  return (
    <div className="space-y-7">
      <Topbar title="Alerts" subtitle="Unread notifications • security signals • system warnings" />

      <div className="flex justify-end">
        <Button variant="ghost" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      <DataTable data={items} columns={columns} title="Unread Alerts" searchKey={"title"} />
    </div>
  );
}
