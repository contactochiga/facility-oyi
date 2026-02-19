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
import {
  Zap,
  Sun,
  Lightbulb,
  TrendingDown,
  Wind,
} from "lucide-react";

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

function safeLower(v: any) {
  return String(v ?? "").toLowerCase();
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

  if (hay.includes("onvif") || hay.includes("camera") || hay.includes("cctv"))
    return "cameras";

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

  if (
    hay.includes("alarm") ||
    hay.includes("sensor") ||
    hay.includes("motion") ||
    hay.includes("siren") ||
    hay.includes("security") ||
    hay.includes("intrusion")
  )
    return "security";

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

/** ✅ Safe MetricCard (local) — no dependency */
function MetricCard({
  title,
  value,
  change,
  icon: Icon,
  tone = "neutral",
}: {
  title: string;
  value: string;
  change?: string;
  icon: any;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const toneCls =
    tone === "good"
      ? "border-emerald-500/20 bg-emerald-500/5"
      : tone === "warn"
        ? "border-amber-500/20 bg-amber-500/5"
        : tone === "bad"
          ? "border-red-500/20 bg-red-500/5"
          : "border-white/10 bg-white/5";

  return (
    <div className={cn("rounded-2xl border backdrop-blur p-5", toneCls)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-white/55">{title}</div>
          <div className="mt-2 text-2xl font-semibold text-white tracking-tight">
            {value}
          </div>
          {change ? (
            <div className="mt-2 text-xs text-white/45">{change}</div>
          ) : null}
        </div>
        <div className="h-10 w-10 rounded-xl border border-white/10 bg-black/20 flex items-center justify-center">
          <Icon className="h-5 w-5 text-white/75" />
        </div>
      </div>
    </div>
  );
}

/** ✅ Tiny SVG Line chart (no Recharts) */
function MiniLineChart({
  data,
}: {
  data: Array<{ label: string; solar: number; grid: number; total: number }>;
}) {
  const w = 680;
  const h = 240;
  const pad = 18;

  const maxY = Math.max(...data.map((d) => Math.max(d.solar, d.grid, d.total)), 1);

  function pxX(i: number) {
    const span = w - pad * 2;
    return pad + (i * span) / Math.max(1, data.length - 1);
  }
  function pxY(v: number) {
    const span = h - pad * 2;
    return pad + (1 - v / maxY) * span;
  }

  function pathFor(key: "solar" | "grid" | "total") {
    return data
      .map((d, i) => `${i === 0 ? "M" : "L"} ${pxX(i).toFixed(1)} ${pxY(d[key]).toFixed(1)}`)
      .join(" ");
  }

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[260px]">
        {/* grid */}
        {Array.from({ length: 5 }).map((_, i) => {
          const y = pad + (i * (h - pad * 2)) / 4;
          return (
            <line
              key={i}
              x1={pad}
              x2={w - pad}
              y1={y}
              y2={y}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
            />
          );
        })}

        {/* lines */}
        <path d={pathFor("solar")} fill="none" stroke="rgba(245,158,11,0.95)" strokeWidth="2.5" />
        <path d={pathFor("grid")} fill="none" stroke="rgba(59,130,246,0.95)" strokeWidth="2.5" />
        <path
          d={pathFor("total")}
          fill="none"
          stroke="rgba(139,92,246,0.95)"
          strokeWidth="2.5"
          strokeDasharray="6 6"
        />

        {/* x labels (sparse) */}
        {data.map((d, i) => {
          if (i !== 0 && i !== Math.floor(data.length / 2) && i !== data.length - 1) return null;
          const x = pxX(i);
          return (
            <text
              key={d.label}
              x={x}
              y={h - 6}
              textAnchor="middle"
              fontSize="11"
              fill="rgba(255,255,255,0.45)"
            >
              {d.label}
            </text>
          );
        })}
      </svg>

      <div className="mt-2 flex items-center gap-3 text-xs text-white/55">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: "rgba(245,158,11,0.95)" }} /> Solar
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: "rgba(59,130,246,0.95)" }} /> Grid
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: "rgba(139,92,246,0.95)" }} /> Total
        </span>
      </div>
    </div>
  );
}

/** ✅ Tiny SVG Bar chart (no Recharts) */
function MiniBarChart({
  data,
}: {
  data: Array<{ building: string; current: number; target: number }>;
}) {
  const maxY = Math.max(...data.map((d) => Math.max(d.current, d.target)), 1);

  return (
    <div className="w-full">
      <div className="grid grid-cols-5 gap-3 items-end h-[260px]">
        {data.map((d) => {
          const cur = Math.round((d.current / maxY) * 100);
          const tar = Math.round((d.target / maxY) * 100);

          return (
            <div key={d.building} className="flex flex-col items-center gap-2">
              <div className="w-full flex items-end gap-2 h-[220px]">
                <div
                  className="flex-1 rounded-t-xl border border-white/10 bg-emerald-500/25"
                  style={{ height: `${cur}%` }}
                  title={`Current: ${d.current}`}
                />
                <div
                  className="flex-1 rounded-t-xl border border-white/10 bg-white/10"
                  style={{ height: `${tar}%` }}
                  title={`Target: ${d.target}`}
                />
              </div>
              <div className="text-[11px] text-white/45 text-center leading-tight">
                {d.building.replace("Building ", "B")}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex items-center gap-4 text-xs text-white/55">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-sm bg-emerald-500/60" /> Current Usage
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-sm bg-white/25" /> Target
        </span>
      </div>
    </div>
  );
}

export default function DevicesPage() {
  const [items, setItems] = useState<FacilityDevice[]>([]);
  const [loading, setLoading] = useState(false);

  // keep your existing filters + discovery untouched
  const [system, setSystem] = useState<SystemKey>("all");

  const [scanning, setScanning] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanResults, setScanResults] = useState<DiscoveredDevice[]>([]);
  const [scanErr, setScanErr] = useState<string | null>(null);

  const [adapter, setAdapter] = useState<DiscoverAdapter>("tuya");

  const [cidr, setCidr] = useState("192.168.1.0/24");
  const [onvifUser, setOnvifUser] = useState("");
  const [onvifPass, setOnvifPass] = useState("");

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
    setScanOpen(true);

    try {
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

    let active = 0;
    let offline = 0;

    const bySystem = new Map<SystemKey, number>();

    for (const d of items as any[]) {
      const s = safeLower(d?.status ?? "unknown");
      if (s === "active" || s === "online" || s === "ok") active += 1;
      if (s === "offline" || s === "down" || s === "error") offline += 1;

      const sys = toSystemKey(d);
      bySystem.set(sys, (bySystem.get(sys) ?? 0) + 1);
    }

    const unknown = total - active - offline;
    const health =
      total === 0 ? 100 : Math.round((active / Math.max(1, total)) * 100);

    const systemCounts = (k: SystemKey) => bySystem.get(k) ?? 0;

    return { total, active, offline, unknown, health, systemCounts };
  }, [items]);

  const filteredItems = useMemo(() => {
    if (system === "all") return items;
    return (items as any[]).filter((d) => toSystemKey(d) === system) as any;
  }, [items, system]);

  // ✅ Energy mock data (UI-only; doesn’t touch your APIs)
  const hourlyData = [
    { label: "00:00", solar: 0, grid: 450, total: 450 },
    { label: "04:00", solar: 0, grid: 380, total: 380 },
    { label: "08:00", solar: 120, grid: 500, total: 620 },
    { label: "12:00", solar: 280, grid: 500, total: 780 },
    { label: "16:00", solar: 180, grid: 670, total: 850 },
    { label: "20:00", solar: 20, grid: 700, total: 720 },
    { label: "23:59", solar: 0, grid: 580, total: 580 },
  ];

  const buildingComparison = [
    { building: "Building A", current: 1840, target: 2000 },
    { building: "Building B", current: 2150, target: 2200 },
    { building: "Building C", current: 1680, target: 1900 },
    { building: "Building D", current: 2320, target: 2400 },
    { building: "Building E", current: 1590, target: 1800 },
  ];

  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("24h");

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
        cell: ({ row }) => (
          <span className="text-zinc-300">{String((row.original as any)?.type ?? "-")}</span>
        ),
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
        cell: ({ row }) => (
          <span className="text-zinc-300">{String((row.original as any)?.room ?? "-")}</span>
        ),
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

  return (
    <div className="space-y-7">
      <Topbar
        title="Energy Management"
        subtitle="Real-time consumption • sustainability • building performance"
        rightSlot={
          <div className="flex gap-2">
            {(["24h", "7d", "30d"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={cn(
                  "px-3 py-2 rounded-lg text-xs font-medium border transition",
                  timeRange === r
                    ? "bg-blue-600 text-white border-blue-500/30"
                    : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10"
                )}
                type="button"
              >
                {r}
              </button>
            ))}
          </div>
        }
      />

      {/* ✅ Metric row (smart city vibe) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Consumption"
          value="847 kWh"
          change="-12% vs yesterday"
          icon={Zap}
          tone="warn"
        />
        <MetricCard
          title="Solar Generation"
          value="312 kWh"
          change="+8% vs yesterday"
          icon={Sun}
          tone="good"
        />
        <MetricCard
          title="Energy Efficiency"
          value="87%"
          change="+3% this week"
          icon={TrendingDown}
          tone="good"
        />
        <MetricCard
          title="Cost Savings"
          value="$1,247"
          change="This month"
          icon={Lightbulb}
          tone="neutral"
        />
      </div>

      {/* ✅ Charts row (no recharts) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-white/90">Energy Sources (24h)</div>
            <div className="text-xs text-white/45">{timeRange.toUpperCase()}</div>
          </div>
          <div className="mt-4">
            <MiniLineChart data={hourlyData} />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-white/90">Building Performance</div>
            <div className="text-xs text-white/45">Current vs Target</div>
          </div>
          <div className="mt-4">
            <MiniBarChart data={buildingComparison} />
          </div>
        </div>
      </div>

      {/* ✅ Bottom row: keep your existing command tabs + discovery buttons (flow intact) */}
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
          <Button onClick={() => setScanOpen(true)}>Open Discovery</Button>
          <Button variant="ghost" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {/* ✅ Registry stays the same (no breaking) */}
      <DataTable
        data={filteredItems}
        columns={columns}
        title={system === "all" ? "Command Inventory" : `Command Inventory • ${system}`}
        searchKey={"name"}
      />

      {/* ✅ Discovery Modal stays the same (your original) */}
      {scanOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => !scanning && !adding && setScanOpen(false)}
          />

          <div className="relative border border-white/10 rounded-2xl w-full max-w-4xl p-6 bg-zinc-950/70 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-white">Device Discovery</div>
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

            <div className="mt-5 flex flex-col gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  className="bg-zinc-900/60 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none text-white"
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
                    className="bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 outline-none text-white"
                    placeholder="CIDR (e.g. 192.168.1.0/24)"
                    value={cidr}
                    onChange={(e) => setCidr(e.target.value)}
                    disabled={scanning || adding}
                  />
                  <input
                    className="bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 outline-none text-white"
                    placeholder="ONVIF username (optional)"
                    value={onvifUser}
                    onChange={(e) => setOnvifUser(e.target.value)}
                    disabled={scanning || adding}
                  />
                  <input
                    className="bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 outline-none text-white"
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
              <div className="mt-4 border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200 rounded-xl">
                {scanErr}
              </div>
            )}

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
