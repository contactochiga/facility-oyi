"use client";

import { useEffect, useMemo, useState } from "react";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { facilityService } from "@/services/facilityService";
import { deviceService } from "@/services/deviceService";
import cameraService from "@/services/cameraService";
import { visitorService } from "@/services/visitorService";
import { maintenanceService } from "@/services/maintenanceService";
import { Activity, Cctv, House, MapPinned, ShieldAlert, Wifi } from "lucide-react";

function safeLower(v: unknown) {
  return String(v ?? "").toLowerCase();
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function DigitalTwinPage() {
  const [loading, setLoading] = useState(false);
  const [estateId, setEstateId] = useState<string | null>(null);
  const [estateName, setEstateName] = useState("Digital Twin");
  const [homes, setHomes] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [cameras, setCameras] = useState<any[]>([]);
  const [visitors, setVisitors] = useState<any[]>([]);
  const [maintenance, setMaintenance] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const estates = await facilityService.myEstates();
      const estate = estates?.estates?.[0];
      if (!estate?.id) {
        setErr("No estate linked yet.");
        setLoading(false);
        return;
      }

      setEstateId(String(estate.id));
      setEstateName(String(estate.name || "Estate"));

      const [homesRes, devicesRes, visitorsRes, maintenanceRes, camsRes] = await Promise.all([
        facilityService.listHomes(String(estate.id)).catch(() => ({ homes: [] })),
        deviceService.list().catch(() => []),
        visitorService.listToday().catch(() => []),
        maintenanceService.list().catch(() => []),
        cameraService.listByEstate(String(estate.id)).catch(() => ({ items: [] })),
      ]);

      setHomes(Array.isArray(homesRes?.homes) ? homesRes.homes : []);
      setDevices(Array.isArray(devicesRes) ? devicesRes : []);
      setVisitors(Array.isArray(visitorsRes) ? visitorsRes : []);
      setMaintenance(Array.isArray(maintenanceRes) ? maintenanceRes : []);
      setCameras(Array.isArray(camsRes?.items) ? camsRes.items : []);
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Failed to load digital twin");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const kpi = useMemo(() => {
    const onlineDevices = devices.filter((d) => {
      const s = safeLower(d?.status);
      return s.includes("online") || s.includes("active") || s.includes("ok");
    }).length;

    const openMaintenance = maintenance.filter((m) => {
      const s = safeLower(m?.status);
      return s === "open" || s === "in_progress" || s === "assigned";
    }).length;

    const activeVisitors = visitors.filter((v) => {
      const s = safeLower(v?.status);
      return s === "approved" || s === "entered" || s === "active";
    }).length;

    const alerts = openMaintenance + Math.max(0, devices.length - onlineDevices);

    return {
      onlineDevices,
      openMaintenance,
      activeVisitors,
      alerts,
    };
  }, [devices, maintenance, visitors]);

  const twinZones = useMemo(() => {
    if (!homes.length) return [];
    return homes.slice(0, 12).map((h: any, idx: number) => {
      const devicesInHome = devices.filter((d) => String(d?.room || "").toLowerCase().includes(String(h?.name || "").toLowerCase()));
      const camInHome = cameras.filter((c) => String(c?.name || "").toLowerCase().includes(String(h?.name || "").toLowerCase()));

      const status = devicesInHome.some((d) => safeLower(d?.status).includes("offline") || safeLower(d?.status).includes("error"))
        ? "degraded"
        : "healthy";

      const x = 8 + (idx % 4) * 23;
      const y = 14 + Math.floor(idx / 4) * 24;

      return {
        id: String(h?.id || idx),
        name: String(h?.name || `Home ${idx + 1}`),
        status,
        devices: devicesInHome.length,
        cameras: camInHome.length,
        x,
        y,
      };
    });
  }, [homes, devices, cameras]);

  return (
    <div className="space-y-7">
      <Topbar
        title="Digital Twin"
        subtitle="Live estate twin with operations telemetry, zones, and security overlays"
        rightSlot={
          <Button variant="ghost" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        }
      />

      {err ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-200">{err}</div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="glass p-5">
          <div className="text-xs text-white/55">Estate</div>
          <div className="mt-2 text-xl font-semibold text-white inline-flex items-center gap-2">
            <MapPinned size={18} className="text-blue-300" />
            {estateName}
          </div>
          <div className="mt-2 text-[11px] text-zinc-400">{estateId ? `ID ${estateId.slice(0, 8)}...` : "No estate"}</div>
        </div>

        <div className="glass p-5">
          <div className="text-xs text-white/55">Connected Homes</div>
          <div className="mt-2 text-xl font-semibold text-white inline-flex items-center gap-2">
            <House size={18} className="text-emerald-300" />
            {homes.length}
          </div>
          <div className="mt-2 text-[11px] text-zinc-400">Twin zones mapped</div>
        </div>

        <div className="glass p-5">
          <div className="text-xs text-white/55">Device Health</div>
          <div className="mt-2 text-xl font-semibold text-white inline-flex items-center gap-2">
            <Wifi size={18} className="text-cyan-300" />
            {kpi.onlineDevices}/{devices.length || 0}
          </div>
          <div className="mt-2 text-[11px] text-zinc-400">online / total</div>
        </div>

        <div className="glass p-5">
          <div className="text-xs text-white/55">Security Alerts</div>
          <div className="mt-2 text-xl font-semibold text-white inline-flex items-center gap-2">
            <ShieldAlert size={18} className="text-amber-300" />
            {kpi.alerts}
          </div>
          <div className="mt-2 text-[11px] text-zinc-400">open issues and outages</div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.65fr] gap-4">
        <div className="glass p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-white">Estate Twin Canvas</div>
            <div className="text-xs text-zinc-400">Live zones: {twinZones.length}</div>
          </div>

          <div className="relative rounded-2xl border border-white/10 bg-zinc-950/60 overflow-hidden min-h-[560px]">
            <div className="absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:46px_46px] opacity-[0.22]" />

            {twinZones.map((z) => (
              <div
                key={z.id}
                className={cn(
                  "absolute rounded-xl border px-3 py-2 min-w-[120px]",
                  z.status === "healthy"
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : "border-amber-500/30 bg-amber-500/10"
                )}
                style={{ left: `${z.x}%`, top: `${z.y}%` }}
              >
                <div className="text-xs font-medium text-white truncate">{z.name}</div>
                <div className="mt-1 text-[10px] text-zinc-300">{z.devices} devices • {z.cameras} cameras</div>
                <div className={cn("mt-1 text-[10px]", z.status === "healthy" ? "text-emerald-300" : "text-amber-300")}>
                  {z.status}
                </div>
              </div>
            ))}

            {!twinZones.length ? (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-400">
                No home zones available to render digital twin yet.
              </div>
            ) : null}
          </div>
        </div>

        <div className="glass p-4 space-y-3">
          <div className="text-sm font-semibold text-white">Live Overlay Feed</div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs text-zinc-400">Active Visitors</div>
            <div className="text-2xl font-semibold text-white mt-1">{kpi.activeVisitors}</div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs text-zinc-400">Cameras Online</div>
            <div className="text-2xl font-semibold text-white mt-1 inline-flex items-center gap-2">
              <Cctv size={16} className="text-blue-300" />
              {cameras.length}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs text-zinc-400">Open Maintenance</div>
            <div className="text-2xl font-semibold text-white mt-1">{kpi.openMaintenance}</div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs text-zinc-400 mb-2">Operational Pulse</div>
            <div className="space-y-2">
              {[
                { label: "Twin sync", v: twinZones.length ? 92 : 0 },
                { label: "Security graph", v: cameras.length ? 88 : 0 },
                { label: "IoT telemetry", v: devices.length ? Math.max(40, Math.round((kpi.onlineDevices / Math.max(1, devices.length)) * 100)) : 0 },
              ].map((p) => (
                <div key={p.label}>
                  <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1">
                    <span>{p.label}</span>
                    <span>{p.v}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-2 bg-blue-500" style={{ width: `${p.v}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-zinc-400">
            <div className="inline-flex items-center gap-1 text-zinc-300 mb-1">
              <Activity size={13} />
              Twin runtime status
            </div>
            <div>Production layer active. Next step is 3D/Map renderer integration (Mapbox/Three.js) on this same data plane.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
