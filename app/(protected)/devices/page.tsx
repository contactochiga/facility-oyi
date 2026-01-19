"use client";

import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { deviceService, type FacilityDevice } from "@/services/deviceService";
import { facilityService, type DiscoveredDevice } from "@/services/facilityService";
import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";

export default function DevicesPage() {
  const [items, setItems] = useState<FacilityDevice[]>([]);
  const [loading, setLoading] = useState(false);

  // discovery
  const [scanning, setScanning] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanResults, setScanResults] = useState<DiscoveredDevice[]>([]);
  const [scanErr, setScanErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await deviceService.list();
      setItems(res);
    } finally {
      setLoading(false);
    }
  }

  async function scan() {
    setScanErr(null);
    setScanning(true);

    try {
      const res = await facilityService.discoverDevices("tuya");
      setScanResults(res.devices || []);
      setScanOpen(true);
    } catch (e: any) {
      setScanErr(e?.response?.data?.error || "Scan failed");
      setScanOpen(true);
      setScanResults([]);
    } finally {
      setScanning(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const columns = useMemo<ColumnDef<FacilityDevice>[]>(() => [
    { accessorKey: "name", header: "Device" },
    { accessorKey: "type", header: "Type" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const s = row.original.status ?? "unknown";
        const tone =
          s === "active"
            ? "text-emerald-200 bg-emerald-500/10 border-emerald-500/20"
            : s === "offline"
              ? "text-red-200 bg-red-500/10 border-red-500/20"
              : "text-zinc-200 bg-white/5 border-white/10";
        return <span className={`px-2 py-1 rounded-full border text-xs ${tone}`}>{s}</span>;
      },
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
      ),
    },
  ], []);

  return (
    <div className="space-y-7">
      <Topbar title="Devices" subtitle="Estate device registry • operational truth • control hooks" />

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 flex-wrap">
        <Button onClick={scan} disabled={scanning}>
          {scanning ? "Scanning..." : "Scan Devices"}
        </Button>

        <Button variant="ghost" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {/* Registry list */}
      <DataTable data={items} columns={columns} title="Devices" searchKey={"name"} />

      {/* Discovery Modal */}
      {scanOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => !scanning && setScanOpen(false)}
          />

          <div className="relative glass border border-white/10 rounded-2xl w-full max-w-3xl p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-semibold">Device Discovery</div>
                <div className="text-sm text-zinc-400 mt-1">
                  Adapter: <span className="text-zinc-200">Tuya</span> • Found{" "}
                  <span className="text-zinc-200">{scanResults.length}</span> device(s)
                </div>
              </div>

              <button
                className="text-zinc-400 hover:text-zinc-200"
                onClick={() => !scanning && setScanOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {scanErr && (
              <div className="mt-4 glass border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200 rounded-xl">
                {scanErr}
              </div>
            )}

            <div className="mt-5 overflow-auto max-h-[60vh]">
              <table className="w-full text-sm">
                <thead className="text-zinc-400">
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2">Name</th>
                    <th className="text-left py-2">Device ID</th>
                    <th className="text-left py-2">Category</th>
                    <th className="text-left py-2">Online</th>
                  </tr>
                </thead>
                <tbody>
                  {scanResults.map((d: any, idx: number) => {
                    const name = d.name || d.local_name || "Unnamed";
                    const deviceId = d.device_id || d.devId || d.id || "-";
                    const category = d.category || d.product_id || "-";
                    const online = d.online ?? d.isOnline ?? d.status ?? "unknown";

                    return (
                      <tr key={idx} className="border-b border-white/5">
                        <td className="py-3 text-zinc-100">{name}</td>
                        <td className="py-3 text-zinc-300">{deviceId}</td>
                        <td className="py-3 text-zinc-300">{category}</td>
                        <td className="py-3">
                          <span className="inline-flex px-2 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-zinc-200">
                            {String(online)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}

                  {!scanErr && !scanResults.length && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-zinc-500">
                        No devices found. Confirm Tuya keys + that this estate has accessible devices.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setScanOpen(false)} disabled={scanning}>
                Close
              </Button>
              <Button onClick={scan} disabled={scanning}>
                {scanning ? "Scanning..." : "Scan Again"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
