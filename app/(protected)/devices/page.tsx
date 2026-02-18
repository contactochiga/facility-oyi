// app/(protected)/devices/page.tsx
"use client";

import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { deviceService, type FacilityDevice } from "@/services/deviceService";
import {
  facilityService,
  type DiscoveredDevice,
} from "@/services/facilityService";
import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";

type DiscoverAdapter = "tuya" | "ssdp" | "onvif";

type SystemKey =
  | "all"
  | "power"
  | "mep"
  | "security"
  | "access"
  | "connectivity"
  | "cameras"
  | "devices";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

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

function safeLower(v: any) {
  return String(v ?? "").toLowerCase();
}

function toSystemKey(device: any): SystemKey {
  const hay = [
    device?.type,
    device?.category,
    device?.name,
    device?.room,
    device?.metadata?.model,
    device?.metadata?.product,
  ]
    .map(safeLower)
    .join(" ");

  // Cameras / CCTV
  if (hay.includes("onvif") || hay.includes("camera") || hay.includes("cctv"))
    return "cameras";

  // Access Control
  if (
    hay.includes("gate") ||
    hay.includes("door") ||
    hay.includes("lock") ||
    hay.includes("access") ||
    hay.includes("turnstile") ||
    hay.includes("barcode") ||
    hay.includes("qr") ||
    hay.includes("rfid")
  )
    return "access";

  // Security Ops
  if (
    hay.includes("alarm") ||
    hay.includes("sensor") ||
    hay.includes("motion") ||
    hay.includes("siren") ||
    hay.includes("security") ||
    hay.includes("intrusion")
  )
    return "security";

  // Connectivity
  if (
    hay.includes("router") ||
    hay.includes("wifi") ||
    hay.includes("lan") ||
    hay.includes("wan") ||
    hay.includes("network") ||
    hay.includes("switch") ||
    hay.includes("fiber") ||
    hay.includes("onu") ||
    hay.includes("ont") ||
    hay.includes("modem") ||
    hay.includes("ap ")
  )
    return "connectivity";

  // Power
  if (
    hay.includes("generator") ||
    hay.includes("inverter") ||
    hay.includes("ups") ||
    hay.includes("power") ||
    hay.includes("electric") ||
    hay.includes("meter") ||
    hay.includes("kva") ||
    hay.includes("voltage")
  )
    return "power";

  // MEP (Mechanical/Electrical/Plumbing)
  if (
    hay.includes("pump") ||
    hay.includes("water") ||
    hay.includes("tank") ||
    hay.includes("plumb") ||
    hay.includes("hvac") ||
    hay.includes("ac") ||
    hay.includes("vent") ||
    hay.includes("boiler") ||
    hay.includes("valve")
  )
    return "mep";

  return "devices";
}

function statusTone(s: string) {
  const v = safeLower(s);
  if (v === "active" || v === "online" || v === "ok") {
    return "text-emerald-200 bg-emerald-500/10 border-emerald-500/20";
  }
  if (v === "offline" || v === "down" || v === "error") {
    return "text-red-200 bg-red-500/10 border-red-500/20";
  }
  if (v === "warning" || v === "degraded") {
    return "text-amber-200 bg-amber-500/10 border-amber-500/20";
  }
  return "text-zinc-200 bg-white/5 border-white/10";
}

function kpiCardTone(kind: "good" | "warn" | "bad" | "neutral") {
  if (kind === "good")
    return "border-emerald-500/20 bg-emerald-500/5";
  if (kind === "warn") return "border-amber-500/20 bg-amber-500/5";
  if (kind === "bad") return "border-red-500/20 bg-red-500/5";
  return "border-white/10 bg-white/5";
}

export default function DevicesPage() {
  const [items, setItems] = useState<FacilityDevice[]>([]);
  const [loading, setLoading] = useState(false);

  // command filters
  const [system, setSystem] = useState<SystemKey>("all");

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

    // open modal immediately so user sees scanning state
    setScanOpen(true);

    try {
      // cache-bust every discover call
      const baseOpts: Record<string, any> = { _ts: Date.now() };

      const opts =
        adapter === "onvif"
          ? {
              ...baseOpts,
              cidr,
              username: onvifUser || undefined,
              password: onvifPass || undefined,
            }
          : baseOpts;

      const res: any = await facilityService.discoverDevices(adapter, opts);

      const devices = Array.isArray(res?.devices) ? res.devices : null;

      if (!devices) {
        setScanErr(
          "Discovery returned no JSON devices (likely cached 304). Fix backend: set Cache-Control: no-store on /facility/devices/discover and disable ETag for that route."
        );
        setScanResults([]);
        return;
      }

      setScanResults(devices);
    } catch (e: any) {
      setScanErr(e?.response?.data?.error || e?.message || "Scan failed");
      setScanResults([]);
    } finally {
      setScanning(false);
    }
  }

  async function addOne(d: any) {
    setScanErr(null);
    setAdding(true);
    try {
      const payload = {
        estate_id: (d?.estate_id as string) || "",
        adapter: d?.adapter || adapter,
        external_id: canonicalExternalId(d),
        name: canonicalName(d),
        category: d?.category || (adapter === "onvif" ? "camera" : canonicalCategory(d)),
        capabilities: d?.capabilities || [],
        protocols: d?.protocols || [],
        metadata: d?.metadata || d,
      };

      await facilityService.registerDevice(payload);
      await load();
    } catch (e: any) {
      setScanErr(
        e?.response?.data?.error ||
          e?.message ||
          "Register failed (registry endpoint not ready yet)"
      );
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

  const derived = useMemo(() => {
    const total = items.length;

    const byStatus = new Map<string, number>();
    const bySystem = new Map<SystemKey, number>();

    let active = 0;
    let offline = 0;

    for (const d of items as any[]) {
      const s = safeLower(d?.status ?? "unknown");
      byStatus.set(s, (byStatus.get(s) ?? 0) + 1);

      if (s === "active" || s === "online" || s === "ok") active += 1;
      if (s === "offline" || s === "down" || s === "error") offline += 1;

      const sys = toSystemKey(d);
      bySystem.set(sys, (bySystem.get(sys) ?? 0) + 1);
    }

    const unknown = total - active - offline;
    const health =
      total === 0 ? 100 : Math.round((active / Math.max(1, total)) * 100);

    const systemCounts = (k: SystemKey) => bySystem.get(k) ?? 0;

    return {
      total,
      active,
      offline,
      unknown,
      health,
      systemCounts,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    if (system === "all") return items;
    return (items as any[]).filter((d) => toSystemKey(d) === system) as any;
  }, [items, system]);

  const columns = useMemo<ColumnDef<FacilityDevice>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Device",
        cell: ({ row }) => {
          const d: any = row.original;
          const sys = toSystemKey(d);
          const sysLabel =
            sys === "power"
              ? "Power"
              : sys === "mep"
                ? "MEP"
                : sys === "security"
                  ? "Security"
                  : sys === "access"
                    ? "Access"
                    : sys === "connectivity"
                      ? "Connectivity"
                      : sys === "cameras"
                        ? "Cameras"
                        : "Device";

          return (
            <div className="min-w-0">
              <div className="font-medium text-zinc-100 truncate">{d?.name ?? "-"}</div>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <span className="inline-flex px-2 py-1 rounded-full border border-white/10 bg-white/5 text-[11px] text-zinc-200">
                  {sysLabel}
                </span>
                {d?.type && (
                  <span className="inline-flex px-2 py-1 rounded-full border border-white/10 bg-white/5 text-[11px] text-zinc-300">
                    {String(d.type)}
                  </span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => <span className="text-zinc-300">{String((row.original as any)?.type ?? "-")}</span>,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const s = (row.original as any)?.status ?? "unknown";
          return (
            <span className={cn("px-2 py-1 rounded-full border text-xs", statusTone(String(s)))}>
              {String(s)}
            </span>
          );
        },
      },
      {
        accessorKey: "room",
        header: "Zone",
        cell: ({ row }) => <span className="text-zinc-300">{String((row.original as any)?.room ?? "-")}</span>,
      },
      {
        accessorKey: "created_at",
        header: "Created",
        cell: ({ row }) => (
          <span className="text-zinc-400">
            {String((row.original as any)?.created_at ?? "-")}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => alert(`Open device: ${(row.original as any).id}`)}
            >
              Command
            </Button>
          </div>
        ),
      },
    ],
    []
  );

  const systemTabs: Array<{ key: SystemKey; label: string; hint: string }> = [
    { key: "all", label: "Overview", hint: "All systems" },
    { key: "power", label: "Power", hint: "Generator • meters • UPS" },
    { key: "mep", label: "MEP", hint: "Water • pumps • HVAC" },
    { key: "security", label: "Security", hint: "Sensors • alarms" },
    { key: "access", label: "Access", hint: "Gates • locks • QR" },
    { key: "connectivity", label: "Connectivity", hint: "Fiber • Wi-Fi • LAN" },
    { key: "cameras", label: "Cameras", hint: "ONVIF • CCTV" },
    { key: "devices", label: "Devices", hint: "Everything else" },
  ];

  const healthKind =
    derived.total === 0
      ? "neutral"
      : derived.health >= 85
        ? "good"
        : derived.health >= 60
          ? "warn"
          : "bad";

  return (
    <div className="space-y-7">
      <Topbar
        title="Facility Command Center"
        subtitle="Observe • control • audit — power, MEP, security, access, connectivity, cameras"
      />

      {/* Command Actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {systemTabs.map((t) => {
            const active = system === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setSystem(t.key)}
                className={cn(
                  "rounded-full px-3 py-2 text-xs border transition",
                  active
                    ? "border-white/20 bg-white/10 text-zinc-100"
                    : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
                )}
                type="button"
                title={t.hint}
              >
                {t.label}
                <span className="ml-2 text-[11px] text-zinc-400">
                  {t.key === "all" ? derived.total : derived.systemCounts(t.key)}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Button
            onClick={() => {
              setScanOpen(true);
            }}
          >
            Open Discovery
          </Button>

          <Button variant="ghost" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {/* System Overview (dashboard layer) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Health */}
        <div
          className={cn(
            "lg:col-span-4 rounded-2xl border backdrop-blur p-5",
            kpiCardTone(healthKind as any)
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs text-zinc-400">System health</div>
              <div className="mt-2 text-3xl font-semibold text-zinc-100">
                {derived.health}%
              </div>
              <div className="mt-2 text-xs text-zinc-400">
                Active: <span className="text-zinc-200">{derived.active}</span>{" "}
                • Offline: <span className="text-zinc-200">{derived.offline}</span>{" "}
                • Unknown: <span className="text-zinc-200">{derived.unknown}</span>
              </div>
            </div>

            <span
              className={cn(
                "px-2 py-1 rounded-full border text-xs",
                statusTone(
                  healthKind === "good"
                    ? "active"
                    : healthKind === "warn"
                      ? "warning"
                      : healthKind === "bad"
                        ? "offline"
                        : "unknown"
                )
              )}
            >
              {healthKind === "good"
                ? "Stable"
                : healthKind === "warn"
                  ? "Degraded"
                  : healthKind === "bad"
                    ? "Critical"
                    : "No data"}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { k: "Power", v: derived.systemCounts("power") },
              { k: "Security", v: derived.systemCounts("security") },
              { k: "Connectivity", v: derived.systemCounts("connectivity") },
            ].map((x) => (
              <div
                key={x.k}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-3"
              >
                <div className="text-[11px] text-zinc-400">{x.k}</div>
                <div className="mt-1 text-sm text-zinc-200 font-medium">
                  {x.v}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 text-[11px] text-zinc-400">
            Tip: keep this page as the operator “command” layer — registry is only one part.
          </div>
        </div>

        {/* Live Ops shortcuts */}
        <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs text-zinc-400">Operator actions</div>
              <div className="mt-2 text-base font-semibold text-zinc-100">
                Command shortcuts
              </div>
              <div className="mt-2 text-sm text-zinc-400">
                Fast entry points for “observe → act → audit”.
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              {
                title: "Open Incidents",
                desc: "Security + access anomalies",
                onClick: () => alert("Open incidents (wire to /facility/incidents)"),
              },
              {
                title: "Utilities Snapshot",
                desc: "Power + water current status",
                onClick: () => setSystem("power"),
              },
              {
                title: "Connectivity Watch",
                desc: "Fiber/Wi-Fi outages + ticketing",
                onClick: () => setSystem("connectivity"),
              },
              {
                title: "CCTV Monitor",
                desc: "Cameras + streams health",
                onClick: () => setSystem("cameras"),
              },
            ].map((x) => (
              <button
                key={x.title}
                type="button"
                onClick={x.onClick}
                className="text-left rounded-2xl border border-white/10 bg-black/20 hover:bg-black/30 transition p-4"
              >
                <div className="text-sm font-semibold text-zinc-100">
                  {x.title}
                </div>
                <div className="mt-1 text-sm text-zinc-400">{x.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Discovery status */}
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <div className="text-xs text-zinc-400">Discovery</div>
          <div className="mt-2 text-base font-semibold text-zinc-100">
            Adapters
          </div>

          <div className="mt-4 space-y-2">
            {[
              { a: "Tuya (Cloud)", k: "tuya" },
              { a: "SSDP (LAN)", k: "ssdp" },
              { a: "ONVIF (Cameras)", k: "onvif" },
            ].map((x) => {
              const active = adapter === (x.k as DiscoverAdapter);
              return (
                <button
                  key={x.k}
                  type="button"
                  onClick={() => setAdapter(x.k as DiscoverAdapter)}
                  className={cn(
                    "w-full rounded-xl border px-3 py-3 text-left transition",
                    active
                      ? "border-white/20 bg-white/10"
                      : "border-white/10 bg-black/20 hover:bg-black/30"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-zinc-100">{x.a}</div>
                    <span className="text-[11px] text-zinc-400">
                      {active ? "Selected" : "Select"}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-zinc-400">
                    {x.k === "tuya"
                      ? "Cloud inventory + control hooks"
                      : x.k === "ssdp"
                        ? "LAN discovery for supported devices"
                        : "Camera discovery and binding"}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex gap-2">
            <Button onClick={scan} disabled={scanning || adding}>
              {scanning ? "Scanning..." : "Scan"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setScanOpen(true)}
              disabled={scanning || adding}
            >
              View
            </Button>
          </div>
        </div>
      </div>

      {/* Registry list (still here, but now framed as command inventory) */}
      <DataTable
        data={filteredItems}
        columns={columns}
        title={
          system === "all"
            ? "Command Inventory"
            : `Command Inventory • ${
                system === "power"
                  ? "Power"
                  : system === "mep"
                    ? "MEP"
                    : system === "security"
                      ? "Security"
                      : system === "access"
                        ? "Access"
                        : system === "connectivity"
                          ? "Connectivity"
                          : system === "cameras"
                            ? "Cameras"
                            : "Devices"
              }`
        }
        searchKey={"name"}
      />

      {/* Discovery Modal */}
      {scanOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => !scanning && !adding && setScanOpen(false)}
          />

          <div className="relative glass border border-white/10 rounded-2xl w-full max-w-4xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold">Device Discovery</div>
                <div className="text-sm text-zinc-400 mt-1">
                  Adapter:{" "}
                  <span className="text-zinc-200">{adapter.toUpperCase()}</span>{" "}
                  •{" "}
                  {scanning ? (
                    <span className="text-zinc-200">Scanning…</span>
                  ) : (
                    <>
                      Found{" "}
                      <span className="text-zinc-200">{scanResults.length}</span>{" "}
                      device(s)
                    </>
                  )}
                </div>
              </div>

              <button
                className="text-zinc-400 hover:text-zinc-200"
                onClick={() => !scanning && !adding && setScanOpen(false)}
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

                <Button
                  variant="ghost"
                  onClick={bulkAdd}
                  disabled={!selectedCount || scanning || adding}
                >
                  Add Selected ({selectedCount})
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => setSelected({})}
                  disabled={!selectedCount || scanning || adding}
                >
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
                    const cat =
                      adapter === "onvif" ? "camera" : canonicalCategory(d);
                    const online = canonicalOnline(d);
                    const checked = !!selected[ext];

                    return (
                      <tr key={`${ext}-${idx}`} className="border-b border-white/5">
                        <td className="py-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setSelected((p) => ({
                                ...p,
                                [ext]: e.target.checked,
                              }))
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
                          <Button
                            variant="ghost"
                            onClick={() => addOne(d)}
                            disabled={scanning || adding}
                          >
                            {adding ? "Adding..." : "Add"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}

                  {!scanErr && !scanResults.length && !scanning && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-zinc-500">
                        No devices yet. Choose an adapter and hit Scan.
                      </td>
                    </tr>
                  )}

                  {scanning && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-zinc-400">
                        Scanning… please wait.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setScanOpen(false)}
                disabled={scanning || adding}
              >
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
