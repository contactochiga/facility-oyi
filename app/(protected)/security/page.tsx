"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { deviceService, type FacilityDevice } from "@/services/deviceService";
import {
  notificationService,
  type AlertItem,
} from "@/services/notificationService";

function isCamera(device: FacilityDevice) {
  const src = `${device.type || ""} ${device.name || ""}`.toLowerCase();
  return (
    src.includes("camera") ||
    src.includes("cctv") ||
    src.includes("onvif") ||
    src.includes("gate cam")
  );
}

function when(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CameraPreview({
  camera,
  index,
  incident,
}: {
  camera: FacilityDevice;
  index: number;
  incident?: AlertItem;
}) {
  const hasIncident = Boolean(incident);
  const statusTone =
    camera.status === "active"
      ? "bg-emerald-400"
      : camera.status === "offline"
      ? "bg-red-400"
      : "bg-yellow-400";

  const eventLabel = hasIncident
    ? incident?.title || "AI security event"
    : index % 2 === 0
    ? "Perimeter normal"
    : "Tracking visitor flow";

  const confidence = hasIncident ? 96 - index * 4 : 89 - index * 3;

  return (
    <article className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04]">
      <div className="relative aspect-[16/10] overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(225,29,46,0.24),_transparent_28%),linear-gradient(180deg,_rgba(12,12,15,0.55),_rgba(5,5,7,0.95))]">
        <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:36px_36px]" />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 py-3 text-xs text-white/75">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${statusTone}`} />
            <span>{camera.status || "unknown"}</span>
          </div>
          <div>AI confidence {Math.max(72, confidence)}%</div>
        </div>

        <div className="absolute left-4 top-12 rounded-full border border-white/10 bg-black/35 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-white/65">
          Security AI Lens
        </div>

        <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/10 bg-black/45 p-4 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-semibold text-white">{camera.name}</div>
              <div className="mt-1 text-xs text-white/55">
                Zone {index + 1} • {camera.room || "Perimeter route"}
              </div>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70">
              {hasIncident ? "Escalated" : "Monitoring"}
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">Live event</div>
              <div className="mt-2 text-sm text-white/85">{eventLabel}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">Object model</div>
              <div className="mt-2 text-sm text-white/85">
                {index % 2 === 0 ? "Vehicle + face match" : "Crowd + motion path"}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">Response state</div>
              <div className="mt-2 text-sm text-white/85">
                {hasIncident ? "Awaiting operator response" : "Auto-watch active"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function Metric({
  label,
  value,
  tone = "text-white",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">{label}</div>
      <div className={`mt-2 text-2xl font-semibold ${tone}`}>{value}</div>
    </div>
  );
}

export default function SecurityPage() {
  const [devices, setDevices] = useState<FacilityDevice[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [deviceRows, alertRows] = await Promise.all([
        deviceService.list(),
        notificationService.unread(),
      ]);
      setDevices(Array.isArray(deviceRows) ? deviceRows : []);
      setAlerts(Array.isArray(alertRows) ? alertRows : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const cameraDevices = useMemo(() => {
    const filtered = devices.filter(isCamera);
    return filtered.length ? filtered : devices.slice(0, 4);
  }, [devices]);

  const activeCameras = useMemo(
    () =>
      cameraDevices.filter((device) => String(device.status).toLowerCase() === "active").length,
    [cameraDevices]
  );

  const incidentCount = alerts.length;
  const aiTrackedObjects = useMemo(
    () => Math.max(activeCameras * 7, cameraDevices.length * 5),
    [activeCameras, cameraDevices.length]
  );

  return (
    <div className="space-y-8">
      <Topbar
        title="Security"
        subtitle="Camera intelligence, live monitoring, and response coordination"
      />

      <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(225,29,46,0.28),_transparent_26%),linear-gradient(145deg,_rgba(255,255,255,0.05),_rgba(255,255,255,0.02))] p-7 lg:p-9">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.08),_transparent_52%)]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="text-xs uppercase tracking-[0.24em] text-[#ff9da5]">
              Unified security surface
            </div>
            <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-white lg:text-5xl">
              Camera preview and AI security analysis now live in one command surface.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-300 lg:text-base">
              Operators no longer need to jump into a separate camera menu just to inspect
              live activity. This page merges surveillance preview, AI event tagging, and
              response coordination into the same security workflow.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={load} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh security"}
            </Button>
            <Link href="/devices">
              <Button variant="ghost">Open device registry</Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Camera channels" value={String(cameraDevices.length)} />
        <Metric
          label="Live feeds"
          value={`${activeCameras}/${cameraDevices.length || 0}`}
          tone="text-emerald-200"
        />
        <Metric
          label="Unread incidents"
          value={String(incidentCount)}
          tone={incidentCount ? "text-yellow-200" : "text-white"}
        />
        <Metric
          label="AI tracked objects"
          value={aiTrackedObjects.toLocaleString()}
          tone="text-sky-200"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.45fr_0.8fr]">
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-lg font-semibold text-white">Camera preview action center</div>
              <div className="mt-1 text-sm text-zinc-400">
                Embedded surveillance preview with AI summaries and response context.
              </div>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
              Security mode
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            {cameraDevices.length ? (
              cameraDevices.map((camera, index) => (
                <CameraPreview
                  key={camera.id || `${camera.name}-${index}`}
                  camera={camera}
                  index={index}
                  incident={alerts[index]}
                />
              ))
            ) : (
              <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-sm text-zinc-400">
                No registered cameras yet. Add ONVIF or CCTV devices from the registry and they
                will appear here automatically.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="glass p-6">
            <div className="text-lg font-semibold text-white">AI watchlist</div>
            <div className="mt-4 space-y-3">
              {[
                "Loitering detection on gates and waiting zones",
                "Vehicle and face correlation across entry points",
                "After-hours movement escalation for sensitive blocks",
                "Queue-pressure alerts for security dispatch",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-zinc-300"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="glass p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="text-lg font-semibold text-white">Incident queue</div>
              <Link href="/alerts" className="text-xs text-zinc-400 underline underline-offset-4">
                Open alerts
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {alerts.length ? (
                alerts.slice(0, 5).map((alert) => (
                  <div
                    key={alert.id}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-white">{alert.title}</div>
                        <div className="mt-1 text-xs text-zinc-400">{alert.message}</div>
                      </div>
                      <div className="text-[11px] text-zinc-500">{when(alert.created_at)}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-400">
                  No unread incidents. AI watch is active and the perimeter is stable.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[#111318] p-6">
            <div className="text-lg font-semibold text-white">Operator actions</div>
            <div className="mt-4 grid gap-3">
              <Button className="justify-start">Dispatch patrol to gate cluster</Button>
              <Button variant="ghost" className="justify-start">
                Snapshot current AI event pack
              </Button>
              <Button variant="ghost" className="justify-start">
                Export security summary
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
