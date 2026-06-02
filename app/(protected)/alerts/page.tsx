"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, RefreshCw, ShieldAlert, X } from "lucide-react";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { notificationService, type AlertItem } from "@/services/notificationService";
import cameraService, { type CameraEvent } from "@/services/cameraService";
import { facilityService } from "@/services/facilityService";

type IncidentStatus = "new" | "acknowledged" | "investigating" | "resolved" | "dismissed";

type Incident = {
  id: string;
  type: string;
  severity: string;
  source: string;
  title: string;
  description: string;
  location: string;
  time?: string | null;
  status: IncidentStatus;
  route: string;
  canAcknowledge: boolean;
};

function text(value: any, fallback = "Unavailable") {
  const s = String(value ?? "").trim();
  return s || fallback;
}

function when(value?: string | null) {
  if (!value) return "No live timestamp";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "No live timestamp" : date.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function severityFor(input: string) {
  const hay = input.toLowerCase();
  if (/critical|intrusion|fire|panic|lockdown|unauthorized/.test(hay)) return "critical";
  if (/offline|failed|denied|security|camera/.test(hay)) return "high";
  if (/warning|degraded|pending|maintenance/.test(hay)) return "medium";
  return "low";
}

function typeFor(input: string) {
  const hay = input.toLowerCase();
  if (/visitor|gate|access/.test(hay)) return "visitor";
  if (/camera|motion|loiter|intrusion/.test(hay)) return "camera";
  if (/device|edge|offline/.test(hay)) return "device";
  if (/maintenance/.test(hay)) return "maintenance";
  if (/community|report/.test(hay)) return "community/report";
  if (/water|power|utility/.test(hay)) return "utility";
  return "security";
}

function tone(value: string) {
  if (value === "critical") return "border-rose-500/20 bg-rose-500/10 text-rose-200";
  if (value === "high") return "border-orange-500/20 bg-orange-500/10 text-orange-200";
  if (value === "medium") return "border-amber-500/20 bg-amber-500/10 text-amber-100";
  return "border-sky-500/20 bg-sky-500/10 text-sky-200";
}

function statusTone(value: IncidentStatus) {
  if (value === "acknowledged" || value === "resolved") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
  if (value === "investigating") return "border-amber-500/20 bg-amber-500/10 text-amber-100";
  if (value === "dismissed") return "border-white/10 bg-white/5 text-zinc-300";
  return "border-rose-500/20 bg-rose-500/10 text-rose-200";
}

export default function AlertsPage() {
  const [notifications, setNotifications] = useState<AlertItem[]>([]);
  const [cameraEvents, setCameraEvents] = useState<Array<CameraEvent & { camera_name?: string }>>([]);
  const [statusById, setStatusById] = useState<Record<string, IncidentStatus>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ incident: Incident; action: IncidentStatus } | null>(null);
  const [filter, setFilter] = useState<"all" | string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const unread = await notificationService.unread();
      setNotifications(unread);
      const estateId = await facilityService.overview().then((r) => r.estate_id).catch(() => "");
      if (estateId) {
        const cameras = await cameraService.listByEstate(estateId).then((r) => r.items || []).catch(() => []);
        const eventRows = await Promise.all(cameras.slice(0, 10).map(async (camera) => {
          const result = await cameraService.listEvents(camera.id, { limit: 10, sinceMinutes: 24 * 60 }).catch(() => ({ events: [] }));
          return (result.events || []).map((event) => ({ ...event, camera_name: camera.name || camera.ip || "Camera" }));
        }));
        setCameraEvents(eventRows.flat());
      } else {
        setCameraEvents([]);
      }
    } catch (requestError: any) {
      setError(requestError?.response?.data?.error || requestError?.message || "Unable to load alerts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const onRealtime = (event: Event) => {
      const name = (event as CustomEvent)?.detail?.event || "";
      if (/alert|incident|security|camera|notification|visitor|maintenance|device|edge/.test(name)) void load();
    };
    window.addEventListener("facility:realtime-event", onRealtime);
    return () => window.removeEventListener("facility:realtime-event", onRealtime);
  }, [load]);

  const incidents = useMemo<Incident[]>(() => {
    const fromNotifications = notifications.map((item) => {
      const source = `${item.title || ""} ${item.message || ""}`;
      const type = typeFor(source);
      return {
        id: item.id,
        type,
        severity: severityFor(source),
        source: "notification",
        title: text(item.title, "Security alert"),
        description: text(item.message, "Review notification"),
        location: type === "visitor" ? "Gate / access" : "Estate",
        time: item.created_at,
        status: statusById[item.id] || (String(item.status || "").toLowerCase() === "read" ? "acknowledged" : "new"),
        route: type === "camera" ? "/cameras" : type === "visitor" ? "/visitors" : "/security-access",
        canAcknowledge: true,
      } as Incident;
    });
    const fromCamera = cameraEvents.map((event) => {
      const title = text(event.event_type, "camera event").replace(/_/g, " ");
      const severity = severityFor(`${title} ${event.message || ""}`);
      return {
        id: `camera:${event.id}`,
        type: "camera",
        severity,
        source: "camera",
        title,
        description: text(event.message, "Camera event"),
        location: event.camera_name || event.camera_id,
        time: event.created_at,
        status: statusById[`camera:${event.id}`] || "new",
        route: "/cameras",
        canAcknowledge: false,
      } as Incident;
    });
    return [...fromNotifications, ...fromCamera].sort((a, b) => new Date(b.time || 0).getTime() - new Date(a.time || 0).getTime());
  }, [cameraEvents, notifications, statusById]);

  const filtered = filter === "all" ? incidents : incidents.filter((incident) => incident.type === filter || incident.severity === filter || incident.status === filter);

  async function applyAction(incident: Incident, action: IncidentStatus) {
    setConfirming(null);
    if (action === "acknowledged" && incident.canAcknowledge && incident.source === "notification") {
      const ok = await notificationService.markRead(incident.id);
      if (!ok) {
        setError("Acknowledge failed. Backend notification read endpoint rejected the request.");
        return;
      }
      await load();
      return;
    }
    setStatusById((prev) => ({ ...prev, [incident.id]: action }));
  }

  return (
    <div className="space-y-6">
      <Topbar title="Alerts & Incidents" subtitle="Security, visitor, camera, device, Edge, utility, maintenance, and community alerts." rightSlot={<Button variant="ghost" onClick={() => void load()} disabled={loading} className="gap-2"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh</Button>} />
      {error ? <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {["critical", "high", "medium", "new", "acknowledged"].map((item) => <button key={item} type="button" onClick={() => setFilter(filter === item ? "all" : item)} className={`rounded-2xl border p-4 text-left ${filter === item ? "border-sky-400/30 bg-sky-500/10" : "border-white/10 bg-white/[0.035]"}`}><p className="text-[10px] uppercase tracking-[0.17em] text-zinc-500">{item}</p><p className="mt-3 text-2xl font-semibold text-white">{incidents.filter((incident) => incident.severity === item || incident.status === item).length}</p><p className="mt-2 text-xs text-zinc-500">Click to filter</p></button>)}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
        <div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-white">Incident lifecycle</h2><p className="mt-1 text-xs text-zinc-500">Acknowledge persists for notifications. Investigating, resolved, and dismissed are frontend-safe until backend incident lifecycle routes are added.</p></div><ShieldAlert className="h-4 w-4 text-rose-200" /></div>
        <div className="mt-4 space-y-3">{filtered.map((incident) => <article key={incident.id} className="rounded-2xl border border-white/10 bg-black/15 p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2 py-1 text-[10px] uppercase ${tone(incident.severity)}`}>{incident.severity}</span><span className={`rounded-full border px-2 py-1 text-[10px] uppercase ${statusTone(incident.status)}`}>{incident.status}</span><span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase text-zinc-400">{incident.type}</span></div><h3 className="mt-3 text-sm font-semibold text-white">{incident.title}</h3><p className="mt-1 text-sm text-zinc-400">{incident.description}</p><p className="mt-2 text-xs text-zinc-500">{incident.source} · {incident.location} · {when(incident.time)}</p></div><div className="flex flex-wrap gap-2"><Button variant="ghost" onClick={() => setConfirming({ incident, action: "acknowledged" })} className="gap-2"><CheckCircle2 className="h-4 w-4" /> Acknowledge</Button><Button variant="ghost" onClick={() => setConfirming({ incident, action: "investigating" })}>Investigating</Button><Button variant="ghost" onClick={() => setConfirming({ incident, action: "resolved" })}>Resolve</Button><Button variant="danger" onClick={() => setConfirming({ incident, action: "dismissed" })}>Dismiss</Button></div></div></article>)}{!filtered.length && !loading ? <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">No alerts or incidents match this view.</p> : null}</div>
      </section>

      {confirming ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm"><section className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-950 p-5"><header className="flex justify-between gap-3"><h2 className="text-lg font-semibold text-white">Confirm incident action</h2><button type="button" onClick={() => setConfirming(null)}><X className="h-4 w-4 text-zinc-400" /></button></header><p className="mt-2 text-sm text-zinc-400">Set <span className="text-white">{confirming.incident.title}</span> to <span className="text-white">{confirming.action}</span>. Only notification acknowledge is persisted by the current backend.</p><footer className="mt-6 flex justify-end gap-2"><Button variant="ghost" onClick={() => setConfirming(null)}>Cancel</Button><Button variant={confirming.action === "dismissed" ? "danger" : "primary"} onClick={() => void applyAction(confirming.incident, confirming.action)}>{confirming.action}</Button></footer></section></div> : null}
    </div>
  );
}
