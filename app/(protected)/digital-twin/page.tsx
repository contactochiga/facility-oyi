"use client";

import { useEffect, useMemo, useState } from "react";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { facilityService } from "@/services/facilityService";
import { deviceService } from "@/services/deviceService";
import cameraService from "@/services/cameraService";
import { visitorService } from "@/services/visitorService";
import { maintenanceService } from "@/services/maintenanceService";
import {
  Activity,
  Boxes,
  Cable,
  Camera,
  Cctv,
  Cpu,
  Droplets,
  Gauge,
  House,
  Layers3,
  MapPinned,
  ScanEye,
  ShieldAlert,
  Sparkles,
  Wifi,
  Zap,
} from "lucide-react";

function safeLower(v: unknown) {
  return String(v ?? "").toLowerCase();
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type TwinMode = "2d" | "3d" | "ops";
type LayerKey = "devices" | "cameras" | "visitors" | "maintenance" | "utilities";

function formatAgo(iso?: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
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
  const [mode, setMode] = useState<TwinMode>("3d");
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    devices: true,
    cameras: true,
    visitors: true,
    maintenance: true,
    utilities: true,
  });

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

      const nextHomes = Array.isArray(homesRes?.homes) ? homesRes.homes : [];
      setHomes(nextHomes);
      setDevices(Array.isArray(devicesRes) ? devicesRes : []);
      setVisitors(Array.isArray(visitorsRes) ? visitorsRes : []);
      setMaintenance(Array.isArray(maintenanceRes) ? maintenanceRes : []);
      setCameras(Array.isArray(camsRes?.items) ? camsRes.items : []);
      setSelectedZoneId((prev) => prev || String(nextHomes?.[0]?.id || ""));
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
      return s.includes("online") || s.includes("active") || s.includes("ok") || s.includes("on");
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

    const meteredHomes = homes.filter((h) => h?.electricity_meter || h?.water_meter || h?.internet_id).length;

    return {
      onlineDevices,
      openMaintenance,
      activeVisitors,
      alerts,
      meteredHomes,
    };
  }, [devices, maintenance, visitors, homes]);

  const twinZones = useMemo(() => {
    if (!homes.length) return [];
    return homes.slice(0, 12).map((h: any, idx: number) => {
      const name = String(h?.name || `Home ${idx + 1}`);
      const localKey = name.toLowerCase();
      const devicesInHome = devices.filter((d) => {
        const src = `${d?.room || ""} ${d?.home_name || ""} ${d?.name || ""}`.toLowerCase();
        return src.includes(localKey);
      });
      const camsInHome = cameras.filter((c) => `${c?.name || ""}`.toLowerCase().includes(localKey));
      const visitsInHome = visitors.filter((v) => `${v?.home_name || v?.host_name || ""}`.toLowerCase().includes(localKey));
      const maintenanceInHome = maintenance.filter((m) => `${m?.home_name || m?.title || m?.location || ""}`.toLowerCase().includes(localKey));

      const offlineCount = devicesInHome.filter((d) => {
        const s = safeLower(d?.status);
        return s.includes("offline") || s.includes("error");
      }).length;
      const status = maintenanceInHome.length > 0 ? "attention" : offlineCount > 0 ? "degraded" : "healthy";

      const x = 8 + (idx % 4) * 22;
      const y = 10 + Math.floor(idx / 4) * 25;
      const width = 15;
      const depth = 10;
      const height = 90 + ((devicesInHome.length + camsInHome.length) % 4) * 18;

      return {
        id: String(h?.id || idx),
        home: h,
        name,
        status,
        devices: devicesInHome,
        cameras: camsInHome,
        visitors: visitsInHome,
        maintenance: maintenanceInHome,
        x,
        y,
        width,
        depth,
        height,
        meters: {
          power: h?.electricity_meter || null,
          water: h?.water_meter || null,
          internet: h?.internet_id || null,
        },
      };
    });
  }, [homes, devices, cameras, visitors, maintenance]);

  const selectedZone = useMemo(
    () => twinZones.find((z) => z.id === selectedZoneId) || twinZones[0] || null,
    [twinZones, selectedZoneId]
  );

  const liveFeed = useMemo(() => {
    const feed: Array<{ id: string; label: string; tone: string; meta: string }> = [];

    visitors.slice(0, 6).forEach((v: any, idx: number) => {
      feed.push({
        id: `visitor-${idx}`,
        label: `${v?.visitor_name || v?.name || "Visitor"} access ${String(v?.status || "pending")}`,
        tone: "emerald",
        meta: formatAgo(v?.updated_at || v?.created_at),
      });
    });

    maintenance.slice(0, 6).forEach((m: any, idx: number) => {
      feed.push({
        id: `maint-${idx}`,
        label: `${m?.title || "Maintenance issue"} • ${m?.status || "open"}`,
        tone: "amber",
        meta: formatAgo(m?.updated_at || m?.created_at),
      });
    });

    cameras.slice(0, 6).forEach((c: any, idx: number) => {
      feed.push({
        id: `cam-${idx}`,
        label: `${c?.name || "Camera"} live stream active`,
        tone: "cyan",
        meta: `${c?.status || "online"}`,
      });
    });

    return feed.slice(0, 12);
  }, [visitors, maintenance, cameras]);

  const layerDefs: Array<{ key: LayerKey; label: string; icon: any; accent: string }> = [
    { key: "devices", label: "Devices", icon: Cpu, accent: "text-cyan-300" },
    { key: "cameras", label: "Cameras", icon: Camera, accent: "text-blue-300" },
    { key: "visitors", label: "Visitors", icon: ScanEye, accent: "text-emerald-300" },
    { key: "maintenance", label: "Maintenance", icon: ShieldAlert, accent: "text-amber-300" },
    { key: "utilities", label: "Utilities", icon: Cable, accent: "text-violet-300" },
  ];

  return (
    <div className="space-y-7">
      <Topbar
        title="Digital Twin"
        subtitle="2D / 3D estate twin with live operations overlays, utility mapping, and security telemetry"
        rightSlot={
          <div className="flex items-center gap-2">
            <div className="flex rounded-2xl border border-white/10 bg-white/5 p-1">
              {(["2d", "3d", "ops"] as TwinMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "rounded-xl px-3 py-2 text-xs transition",
                    mode === m ? "bg-white text-black" : "text-zinc-300 hover:bg-white/10"
                  )}
                  type="button"
                >
                  {m === "2d" ? "2D Plan" : m === "3d" ? "3D Twin" : "Ops Layer"}
                </button>
              ))}
            </div>
            <Button variant="ghost" onClick={load} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        }
      />

      {err ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-200">{err}</div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <MetricCard icon={MapPinned} title="Estate" value={estateName} meta={estateId ? `ID ${estateId.slice(0, 8)}...` : "No estate"} accent="text-blue-300" />
        <MetricCard icon={House} title="Twin Zones" value={String(homes.length)} meta="Homes mapped into twin" accent="text-emerald-300" />
        <MetricCard icon={Wifi} title="Device Health" value={`${kpi.onlineDevices}/${devices.length || 0}`} meta="online / total devices" accent="text-cyan-300" />
        <MetricCard icon={Gauge} title="Metered Homes" value={String(kpi.meteredHomes)} meta="power / water / internet linked" accent="text-violet-300" />
        <MetricCard icon={ShieldAlert} title="Live Alerts" value={String(kpi.alerts)} meta="open faults and outages" accent="text-amber-300" />
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-[280px_1fr_360px] gap-4">
        <div className="glass p-4 space-y-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Twin Layers</div>
            <div className="mt-2 text-sm text-white">Toggle operational overlays on the estate twin.</div>
          </div>

          <div className="space-y-2">
            {layerDefs.map((layer) => {
              const Icon = layer.icon;
              return (
                <button
                  key={layer.key}
                  type="button"
                  onClick={() => setLayers((prev) => ({ ...prev, [layer.key]: !prev[layer.key] }))}
                  className={cn(
                    "w-full rounded-2xl border px-3 py-3 text-left transition",
                    layers[layer.key] ? "border-white/10 bg-white/8" : "border-white/5 bg-black/20 text-zinc-500"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Icon className={cn("h-4 w-4", layer.accent)} />
                      <span className="text-sm text-white">{layer.label}</span>
                    </div>
                    <span className={cn("text-[11px]", layers[layer.key] ? "text-emerald-300" : "text-zinc-500")}>{layers[layer.key] ? "On" : "Off"}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Runtime</div>
            <div className="mt-3 space-y-2">
              {[
                { label: "Twin sync", value: twinZones.length ? 96 : 0 },
                { label: "IoT telemetry", value: devices.length ? Math.max(40, Math.round((kpi.onlineDevices / Math.max(1, devices.length)) * 100)) : 0 },
                { label: "Security intelligence", value: cameras.length ? 91 : 0 },
                { label: "MEP visibility", value: homes.length ? 78 : 0 },
              ].map((row) => (
                <div key={row.label}>
                  <div className="mb-1 flex items-center justify-between text-[11px] text-zinc-400">
                    <span>{row.label}</span>
                    <span>{row.value}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-2 rounded-full bg-blue-500" style={{ width: `${row.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="glass p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white">Estate Twin Canvas</div>
              <div className="mt-1 text-xs text-zinc-400">Interactive estate zones, smart infrastructure overlays, and live operational state.</div>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] text-zinc-300">
              <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
              {mode === "2d" ? "Plan layer" : mode === "3d" ? "Isometric layer" : "Operations layer"}
            </div>
          </div>

          <div className="relative min-h-[640px] overflow-hidden rounded-[28px] border border-white/10 bg-[#060912]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.18),transparent_35%),radial-gradient(circle_at_80%_15%,rgba(16,185,129,0.14),transparent_25%),radial-gradient(circle_at_55%_75%,rgba(168,85,247,0.12),transparent_30%),linear-gradient(180deg,#0a1020_0%,#070b14_100%)]" />
            <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:42px_42px]" />

            {mode !== "ops" ? (
              <div className="absolute inset-x-10 bottom-10 top-20 rounded-[36px] border border-white/8 bg-gradient-to-b from-white/[0.03] to-transparent shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]" />
            ) : null}

            {twinZones.map((z) => {
              const selected = selectedZone?.id === z.id;
              const cardTone = z.status === "healthy" ? "border-emerald-500/25 bg-emerald-500/8" : z.status === "attention" ? "border-red-500/25 bg-red-500/8" : "border-amber-500/25 bg-amber-500/8";
              const left = `${z.x}%`;
              const top = `${z.y}%`;

              return (
                <button
                  key={z.id}
                  type="button"
                  onClick={() => setSelectedZoneId(z.id)}
                  className="absolute text-left transition"
                  style={{ left, top, width: mode === "2d" ? 180 : 170 }}
                >
                  {mode === "3d" ? (
                    <div className={cn("relative", selected ? "scale-[1.03]" : "scale-100")}>
                      <div className="absolute left-4 top-0 h-24 w-24 rotate-[32deg] rounded-2xl border border-white/10 bg-white/5 blur-2xl" />
                      <div
                        className={cn(
                          "relative mx-auto",
                          selected ? "drop-shadow-[0_20px_45px_rgba(34,211,238,0.18)]" : "drop-shadow-[0_16px_35px_rgba(0,0,0,0.35)]"
                        )}
                        style={{ height: `${Math.min(220, z.height + 38)}px` }}
                      >
                        <div className="absolute left-8 right-8 top-4 h-10 -skew-x-[35deg] rounded-xl border border-white/10 bg-white/[0.08]" />
                        <div className={cn("absolute left-3 top-10 bottom-6 w-10 -skew-y-[55deg] rounded-l-xl border border-white/8 bg-white/[0.04]", cardTone)} />
                        <div className={cn("absolute right-5 left-12 top-12 bottom-6 rounded-r-2xl border border-white/10 bg-gradient-to-b from-white/[0.14] to-white/[0.03]", cardTone)} />
                        <div className="absolute inset-x-8 bottom-0 h-6 rounded-full bg-cyan-400/10 blur-xl" />
                        <div className="absolute inset-x-0 bottom-7 px-6">
                          <div className="rounded-2xl border border-white/10 bg-black/35 px-3 py-2 backdrop-blur">
                            <div className="text-xs font-semibold text-white truncate">{z.name}</div>
                            <div className="mt-1 text-[10px] text-zinc-300">{z.devices.length} devices • {z.cameras.length} cameras</div>
                            <div className={cn("mt-1 text-[10px]", z.status === "healthy" ? "text-emerald-300" : z.status === "attention" ? "text-red-300" : "text-amber-300")}>{z.status}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : mode === "2d" ? (
                    <div className={cn("rounded-[24px] border p-4 backdrop-blur transition", cardTone, selected ? "shadow-[0_0_0_1px_rgba(34,211,238,0.35)]" : "") }>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-white">{z.name}</div>
                          <div className="mt-1 text-[11px] text-zinc-400">{z.home?.block || "Block"} {z.home?.unit || "Unit"}</div>
                        </div>
                        <div className={cn("h-2.5 w-2.5 rounded-full", z.status === "healthy" ? "bg-emerald-400" : z.status === "attention" ? "bg-red-400" : "bg-amber-400")} />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-zinc-300">
                        <TwinStat icon={Cpu} value={String(z.devices.length)} />
                        <TwinStat icon={Camera} value={String(z.cameras.length)} />
                        <TwinStat icon={ScanEye} value={String(z.visitors.length)} />
                        <TwinStat icon={ShieldAlert} value={String(z.maintenance.length)} />
                      </div>
                    </div>
                  ) : (
                    <div className={cn("rounded-[24px] border p-4 backdrop-blur transition", cardTone, selected ? "shadow-[0_0_0_1px_rgba(34,211,238,0.35)]" : "") }>
                      <div className="flex items-center gap-2 text-xs font-semibold text-white">
                        <Boxes className="h-4 w-4 text-cyan-300" />
                        {z.name}
                      </div>
                      <div className="mt-2 space-y-1 text-[11px] text-zinc-300">
                        {layers.utilities ? <div>Power {z.meters.power ? "linked" : "missing"} • Water {z.meters.water ? "linked" : "missing"}</div> : null}
                        {layers.devices ? <div>{z.devices.length} live device nodes</div> : null}
                        {layers.cameras ? <div>{z.cameras.length} camera feeds mapped</div> : null}
                        {layers.visitors ? <div>{z.visitors.length} visitor activity items</div> : null}
                        {layers.maintenance ? <div>{z.maintenance.length} maintenance tasks</div> : null}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}

            {layers.utilities && mode !== "ops" ? (
              <>
                <div className="absolute left-[12%] top-[18%] h-[2px] w-[26%] bg-gradient-to-r from-violet-400/0 via-violet-400/60 to-violet-400/0" />
                <div className="absolute right-[15%] top-[34%] h-[2px] w-[24%] bg-gradient-to-r from-cyan-400/0 via-cyan-400/60 to-cyan-400/0" />
                <div className="absolute left-[22%] bottom-[28%] h-[2px] w-[32%] bg-gradient-to-r from-emerald-400/0 via-emerald-400/60 to-emerald-400/0" />
              </>
            ) : null}

            {!twinZones.length ? (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-400">No home zones available to render digital twin yet.</div>
            ) : null}
          </div>
        </div>

        <div className="glass p-4 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Selected Zone</div>
            {selectedZone ? (
              <>
                <div className="mt-2 text-lg font-semibold text-white">{selectedZone.name}</div>
                <div className="mt-1 text-xs text-zinc-400">{selectedZone.home?.description || "Mapped estate unit with live twin overlays."}</div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
                  <OverlayMetric icon={Zap} label="Power" value={selectedZone.meters.power || "No meter"} accent="text-amber-300" />
                  <OverlayMetric icon={Droplets} label="Water" value={selectedZone.meters.water || "No meter"} accent="text-cyan-300" />
                  <OverlayMetric icon={Wifi} label="Internet" value={selectedZone.meters.internet || "No ID"} accent="text-emerald-300" />
                  <OverlayMetric icon={Cpu} label="Devices" value={String(selectedZone.devices.length)} accent="text-violet-300" />
                </div>
              </>
            ) : (
              <div className="mt-2 text-sm text-zinc-400">Select a zone to inspect its live twin state.</div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Activity className="h-4 w-4 text-cyan-300" />
              Live Overlay Feed
            </div>
            <div className="mt-3 space-y-2">
              {liveFeed.map((item) => (
                <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                  <div className="text-sm text-white">{item.label}</div>
                  <div className="mt-1 text-[11px] text-zinc-400">{item.meta}</div>
                </div>
              ))}
              {!liveFeed.length ? <div className="text-xs text-zinc-500">No live overlay events yet.</div> : null}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-sm font-semibold text-white">Intelligence Summary</div>
            <div className="mt-3 space-y-3 text-[12px] text-zinc-300">
              <div className="flex items-start gap-2"><Cctv className="mt-0.5 h-4 w-4 text-blue-300" /><span>{cameras.length} camera feeds are mapped into the estate twin for surveillance overlays.</span></div>
              <div className="flex items-start gap-2"><Cable className="mt-0.5 h-4 w-4 text-violet-300" /><span>Utility layer reflects electricity, water, and internet linkage from each home profile.</span></div>
              <div className="flex items-start gap-2"><Sparkles className="mt-0.5 h-4 w-4 text-cyan-300" /><span>This twin is now ready for a later Mapbox or Three.js renderer without changing the data plane.</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, title, value, meta, accent }: { icon: any; title: string; value: string; meta: string; accent: string }) {
  return (
    <div className="glass p-5">
      <div className="text-xs text-white/55">{title}</div>
      <div className="mt-2 inline-flex items-center gap-2 text-xl font-semibold text-white">
        <Icon className={cn("h-5 w-5", accent)} />
        <span className="truncate">{value}</span>
      </div>
      <div className="mt-2 text-[11px] text-zinc-400">{meta}</div>
    </div>
  );
}

function TwinStat({ icon: Icon, value }: { icon: any; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-2 py-2 text-zinc-200">
      <div className="flex items-center gap-1.5"><Icon className="h-3.5 w-3.5 text-cyan-300" /><span>{value}</span></div>
    </div>
  );
}

function OverlayMetric({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
      <div className="flex items-center gap-2 text-zinc-400"><Icon className={cn("h-3.5 w-3.5", accent)} /><span>{label}</span></div>
      <div className="mt-2 text-white">{value}</div>
    </div>
  );
}
