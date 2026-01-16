"use client";

import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { visitorService, type VisitorItem } from "@/services/visitorService";
import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";

export default function VisitorsPage() {
  const [items, setItems] = useState<VisitorItem[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await visitorService.listToday();
      setItems(res || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const columns = useMemo<ColumnDef<VisitorItem>[]>(() => [
    { accessorKey: "full_name", header: "Visitor" },
    { accessorKey: "status", header: "Status" },
    { accessorKey: "created_at", header: "Created" },
  ], []);

  return (
    <div className="space-y-7">
      <Topbar title="Visitors" subtitle="Gate flow • verification • timeline logs" />

      <div className="flex justify-end">
        <Button variant="ghost" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      <DataTable data={items} columns={columns} title="Visitors Today" searchKey={"full_name"} />
    </div>
  );
}
