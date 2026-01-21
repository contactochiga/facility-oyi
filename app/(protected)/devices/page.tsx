"use client";

import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { deviceService, type FacilityDevice } from "@/services/deviceService";
import { facilityService, type DiscoveredDevice } from "@/services/facilityService";
import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";

type DiscoverAdapter = "tuya" | "ssdp" | "onvif";

function canonicalName(d: any) {
  return d?.name || d?.local_name || d?.metadata?.model || "Unnamed";
}
function canonicalExternalId(d: any) {
  return (
    d?.externalId ||
    d?.device_id ||
    d?.devId ||
    d?.id ||
    d?.metadata?.raw?.ip ||
    "-"
  );
}
function canonicalCategory(d: any) {
  return d?.category || d?.product_id || d?.metadata?.model || "unknown";
}
function canonicalOnline(d: any) {
  const v = d?.online ?? d?.isOnline ?? d?.status;
  if (typeof v === "boolean") return v ? "online" : "offline";
  if (typeof v === "string") return v;
  return "unknown";
}

export default function DevicesPage() {
  const [items, setItems] = useState<FacilityDevice[]>([]);
  const [loading, setLoading] = useState(false);

  // discovery
  const [scanning, setScanning] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanResults, setScanResults] = useState<DiscoveredDevice[]>([]);
  const [scanErr, setScanErr] = useState<string | null>(null);

  // discovery controls
  const [adapter, setAdapter] = useState<DiscoverAdapter>("tuya");

  // ONVIF options
  const [cidr, setCidr] = useState("192.168.1.0/24");
  const [onvifUser, setOnvifUser] = useState("");
  const [onvifPass, setOnvifPass] = useState("");

  // selection + add
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState(false);
  const selectedCount = useMemo(
    () => Object.values(selected).filter(Boolean).length,
    [selected]
  );

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
    setScanResults([]);
    setSelected({});

    try {
      const opts =
        adapter === "onvif"
          ? {
              cidr,
              username: onvifUser || undefined,
              password: onvifPass || undefined,
            }
          : {};

      const res = await facilityService.discoverDevices(adapter, opts);

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

  async function addOne(d: any) {
    // This will work once backend endpoint exists:
    // POST /facility/devices/register
    // For now, you’ll get a clean error in the modal if not implemented yet.
    setScanErr(null);
    setAdding(true);
    try {
      const payload = {
        estate_id: (d?.estate_id as string) || "", // backend can also infer from req.user, but keep for v1.1
        adapter: d?.adapter || adapter,
        external_id: canonicalExternalId(d),
        name: canonicalName(d),
        category: d?.category || (adapter === "onvif" ? "camera" : canonicalCategory(d)),
        capabilities: d?.capabilities || [],
        protocols: d?.protocols || [],
        metadata: d?.metadata || d,
      };

      // if you haven’t implemented registry yet, this will error:
      await facilityService.registerDevice(payload);

      await load();
    } catch (e: any) {
      setScanErr(e?.response?.data?.error || e?.message || "Register failed (registry endpoint not ready yet)");
    } finally {
      setAdding(false);
    }
  }

  async function bulkAdd() {
    const chosen = scanResults.filter((d: any) => selected[canonicalExternalId(d)]);
    if (!chosen.length) return;

    setScanErr(null);
    setAdding(true);
    try {
      for (const d of chosen) {
        await addOne(d);
      }
      setSelected({});
      await load();
    } catch (e: any) {
      setScanErr(e?.response?.data?.error || e?.message || "Bulk add failed");
    } finally {
      setAdding(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const columns = useMemo<ColumnDef<FacilityDevice>[]>(
    () => [
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
    ],
    []
  );

  return (
    <div className="space-y-7">
      <Topbar title="Devices" subtitle="Estate device registry • operational truth • control hooks" />

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 flex-wrap">
        <Button onClick={() => setScanOpen(true)}>Open Discovery</Button>

        <Button variant="ghost" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {/* Registry list */}
      <DataTable data={items} columns={columns} title="Devices" searchKey={"name"} />

      {/* Discovery Modal */}
      {scanOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/70" onClick={() => !scanning && setScanOpen(false)} />

          <div className="relative glass border border-white/10 rounded-2xl w-full max-w-4xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold">Device Discovery</div>
                <div className="text-sm text-zinc-400 mt-1">
                  Adapter: <span className="text-zinc-200">{adapter.toUpperCase()}</span> • Found{" "}
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

            {/* Adapter controls */}
            <div className="mt-5 flex flex-col gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  className="bg-zinc-900/60 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none"
                  value={adapter}
                  onChange={(e) => setAdapter(e.target.value as DiscoverAdapter)}
                  disabled={scanning || adding}
                >
                  <option value="tuya">Tuya (Cloud)</option>
                  <option value="ssdp">SSDP (LAN)</option>
                  <option value="onvif">ONVIF (Cameras)</option>
                </select>

                <Button onClick={scan} disabled={scanning || adding}>
                  {scanning ? "Scanning..." : "Scan"}
                </Button>

                <Button variant="ghost" onClick={bulkAdd} disabled={!selectedCount || scanning || adding}>
                  Add Selected ({selectedCount})
                </Button>

                <Button variant="ghost" onClick={() => setSelected({})} disabled={!selectedCount || scanning || adding}>
                  Clear Selection
                </Button>
              </div>

              {adapter === "onvif" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    className="bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 outline-none"
                    placeholder="CIDR (e.g. 192.168.1.0/24)"
                    value={cidr}
                    onChange={(e) => setCidr(e.target.value)}
                    disabled={scanning || adding}
                  />
                  <input
                    className="bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 outline-none"
                    placeholder="ONVIF username (optional)"
                    value={onvifUser}
                    onChange={(e) => setOnvifUser(e.target.value)}
                    disabled={scanning || adding}
                  />
                  <input
                    className="bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 outline-none"
                    placeholder="ONVIF password (optional)"
                    type="password"
                    value={onvifPass}
                    onChange={(e) => setOnvifPass(e.target.value)}
                    disabled={scanning || adding}
                  />
                </div>
              )}
            </div>

            {scanErr && (
              <div className="mt-4 glass border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200 rounded-xl">
                {scanErr}
              </div>
            )}

            {/* Results */}
            <div className="mt-5 overflow-auto max-h-[60vh]">
              <table className="w-full text-sm">
                <thead className="text-zinc-400">
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 w-[52px]">Pick</th>
                    <th className="text-left py-2">Name</th>
                    <th className="text-left py-2">External ID</th>
                    <th className="text-left py-2">Category</th>
                    <th className="text-left py-2">Online</th>
                    <th className="text-right py-2">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {scanResults.map((d: any, idx: number) => {
                    const name = canonicalName(d);
                    const ext = canonicalExternalId(d);
                    const cat = adapter === "onvif" ? "camera" : canonicalCategory(d);
                    const online = canonicalOnline(d);
                    const checked = !!selected[ext];

                    return (
                      <tr key={`${ext}-${idx}`} className="border-b border-white/5">
                        <td className="py-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setSelected((p) => ({ ...p, [ext]: e.target.checked }))
                            }
                            disabled={scanning || adding}
                          />
                        </td>

                        <td className="py-3 text-zinc-100">{name}</td>
                        <td className="py-3 text-zinc-300">{ext}</td>
                        <td className="py-3 text-zinc-300">{cat}</td>
                        <td className="py-3">
                          <span className="inline-flex px-2 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-zinc-200">
                            {String(online)}
                          </span>
                        </td>

                        <td className="py-3 text-right">
                          <Button variant="ghost" onClick={() => addOne(d)} disabled={scanning || adding}>
                            {adding ? "Adding..." : "Add"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}

                  {!scanErr && !scanResults.length && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-zinc-500">
                        No devices yet. Choose an adapter and hit Scan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setScanOpen(false)} disabled={scanning || adding}>
                Close
              </Button>
              <Button onClick={scan} disabled={scanning || adding}>
                {scanning ? "Scanning..." : "Scan Again"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
