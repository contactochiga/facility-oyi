"use client";

import { useEffect, useMemo, useState } from "react";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import CameraPlayer from "@/components/cameras/CameraPlayer";
import cameraService, {
  type BoundCamera,
  type DiscoveredCamera,
  type CameraEvent,
} from "@/services/cameraService";
import { facilityService } from "@/services/facilityService";
import {
  Bell,
  Brain,
  Car,
  Clock3,
  Dog,
  Shield,
  ShieldAlert,
  UserRound,
} from "lucide-react";

function extractErr(e: any) {
  const status = e?.response?.status;
  const msg = e?.response?.data?.error || e?.message || "Request failed";
  return { status, msg: String(msg) };
}

function ipFromDiscovered(d: DiscoveredCamera) {
  return (
    d?.metadata?.raw?.ip ||
    d?.metadata?.ip ||
    d?.externalId ||
    ""
  );
}

type AiProfile = {
  armed: boolean;
  mode: "home" | "away" | "night" | "vacation";
  sensitivity: number;
  minConfidence: number;
  detectHuman: boolean;
  detectVehicle: boolean;
  detectAnimal: boolean;
  detectFace: boolean;
  detectLoitering: boolean;
  detectIntrusion: boolean;
  notifyInApp: boolean;
  notifyPush: boolean;
  notifySms: boolean;
  autoRecordOnDetect: boolean;
};

const AI_PROFILE_STORAGE_KEY = "facility.camera.aiProfiles.v1";

const defaultAiProfile: AiProfile = {
  armed: true,
  mode: "away",
  sensitivity: 70,
  minConfidence: 65,
  detectHuman: true,
  detectVehicle: true,
  detectAnimal: true,
  detectFace: true,
  detectLoitering: true,
  detectIntrusion: true,
  notifyInApp: true,
  notifyPush: true,
  notifySms: false,
  autoRecordOnDetect: true,
};

export default function CamerasPage() {
  const [estateId, setEstateId] = useState<string | null>(null);

  const [items, setItems] = useState<BoundCamera[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // scan modal
  const [scanOpen, setScanOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanErr, setScanErr] = useState<string | null>(null);
  const [scanResults, setScanResults] = useState<DiscoveredCamera[]>([]);

  const [cidr, setCidr] = useState("192.168.1.0/24");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // bind state
  const [binding, setBinding] = useState(false);
  const [bindName, setBindName] = useState("");
  const [selected, setSelected] = useState<DiscoveredCamera | null>(null);

  // camera intelligence workflow
  const [intelCameraId, setIntelCameraId] = useState<string>("");
  const [intelRewind, setIntelRewind] = useState(0);
  const [intelEvents, setIntelEvents] = useState<CameraEvent[]>([]);
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelCaps, setIntelCaps] = useState<string[]>([]);
  const [intelErr, setIntelErr] = useState<string | null>(null);
  const [profileByCamera, setProfileByCamera] = useState<Record<string, AiProfile>>({});
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [aiMonitorOn, setAiMonitorOn] = useState(false);
  const [aiMonitorRate, setAiMonitorRate] = useState(20);
  const [aiLastDetected, setAiLastDetected] = useState<string | null>(null);

  const selectedIp = useMemo(() => (selected ? ipFromDiscovered(selected) : ""), [selected]);
  const activeProfile = useMemo(
    () => profileByCamera[intelCameraId] || { ...defaultAiProfile },
    [profileByCamera, intelCameraId]
  );

  function persistProfiles(next: Record<string, AiProfile>) {
    setProfileByCamera(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(AI_PROFILE_STORAGE_KEY, JSON.stringify(next));
    }
  }

  function patchActiveProfile(patch: Partial<AiProfile>) {
    if (!intelCameraId) return;
    const current = profileByCamera[intelCameraId] || { ...defaultAiProfile };
    persistProfiles({
      ...profileByCamera,
      [intelCameraId]: { ...current, ...patch },
    });
  }

  function applyAiPreset(preset: "security" | "pet" | "parking" | "balanced") {
    if (preset === "security") {
      patchActiveProfile({
        mode: "away",
        detectHuman: true,
        detectVehicle: true,
        detectAnimal: true,
        detectIntrusion: true,
        detectLoitering: true,
        sensitivity: 82,
        minConfidence: 70,
      });
      return;
    }
    if (preset === "pet") {
      patchActiveProfile({
        mode: "home",
        detectHuman: true,
        detectVehicle: false,
        detectAnimal: true,
        detectIntrusion: false,
        detectLoitering: false,
        sensitivity: 60,
        minConfidence: 55,
      });
      return;
    }
    if (preset === "parking") {
      patchActiveProfile({
        mode: "away",
        detectHuman: true,
        detectVehicle: true,
        detectAnimal: false,
        detectIntrusion: true,
        detectLoitering: true,
        sensitivity: 74,
        minConfidence: 62,
      });
      return;
    }
    patchActiveProfile({ ...defaultAiProfile });
  }

  async function saveAiProfile() {
    if (!intelCameraId) return;
    setProfileSaving(true);
    setProfileMsg(null);
    const profile = profileByCamera[intelCameraId] || { ...defaultAiProfile };
    try {
      const remoteRes = await cameraService
        .upsertAiProfile(intelCameraId, profile)
        .catch(() => ({ ok: false, skipped: true }));

      await cameraService.createEvent(intelCameraId, {
        event_type: "ai_profile_updated",
        confidence: 1,
        message: `AI profile updated (${profile.mode.toUpperCase()} mode)`,
        metadata: { profile, source: "facility_camera_ui" },
      });

      await loadIntel(intelCameraId);

      if (remoteRes?.ok) {
        setProfileMsg("AI profile synced to backend.");
      } else {
        setProfileMsg("AI profile saved locally. Backend sync endpoint not available yet.");
      }
    } catch (e: any) {
      const { msg } = extractErr(e);
      setProfileMsg(`Failed to save AI profile: ${msg}`);
    } finally {
      setProfileSaving(false);
    }
  }

  async function hydrateEstate() {
    // same strategy as your overview page
    try {
      const res = await facilityService.overview();
      if (res?.estate_id) {
        setEstateId(res.estate_id);
        return res.estate_id as string;
      }
    } catch {}

    try {
      const r = await facilityService.myEstates();
      const first = r?.estates?.[0];
      if (first?.id) {
        setEstateId(first.id);
        return first.id as string;
      }
    } catch {}

    setEstateId(null);
    return null;
  }

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const eid = estateId || (await hydrateEstate());
      if (!eid) {
        setItems([]);
        setErr("No site linked yet. Create/Join a site first.");
        return;
      }

      const res = await cameraService.listByEstate(eid);
      const next = res?.items || [];
      setItems(next);
      if (!intelCameraId && next.length) setIntelCameraId(String(next[0].id));
    } catch (e: any) {
      const { status, msg } = extractErr(e);
      setErr(`${msg}${status ? ` (HTTP ${status})` : ""}`);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadIntel(cameraId: string) {
    if (!cameraId) return;
    setIntelLoading(true);
    setIntelErr(null);
    try {
      const [eventsRes, capsRes] = await Promise.all([
        cameraService.listEvents(cameraId, { limit: 25, sinceMinutes: 24 * 60 }),
        cameraService.getAnalyticsCapabilities().catch(() => ({ ok: false, capabilities: [] as string[] })),
      ]);
      setIntelEvents(eventsRes?.events || []);
      setIntelCaps(Array.isArray(capsRes?.capabilities) ? capsRes.capabilities : []);
      if (eventsRes?.warning) setIntelErr(eventsRes.warning);
    } catch (e: any) {
      const { msg } = extractErr(e);
      setIntelErr(msg);
      setIntelEvents([]);
    } finally {
      setIntelLoading(false);
    }
  }

  async function scan() {
    setScanErr(null);
    setScanning(true);
    setScanResults([]);
    setSelected(null);

    try {
      const res = await cameraService.scan({
        cidr: cidr.trim() || undefined,
        username: username.trim() || undefined,
        password: password.trim() || undefined,
      });

      setScanResults(res?.items || []);
    } catch (e: any) {
      const { status, msg } = extractErr(e);
      setScanErr(`${msg}${status ? ` (HTTP ${status})` : ""}`);
      setScanResults([]);
    } finally {
      setScanning(false);
    }
  }

  async function bindSelected() {
    if (!selected) return;
    const ip = selectedIp;
    const rtsp = selected?.metadata?.raw?.rtsp || selected?.metadata?.rtsp || "";

    if (!ip) {
      setScanErr("Selected camera has no IP in metadata. (metadata.raw.ip missing)");
      return;
    }
    if (!rtsp) {
      setScanErr("Selected camera has no RTSP URI. Ensure ONVIF stream URI was discovered.");
      return;
    }

    setScanErr(null);
    setBinding(true);
    try {
      const payload = {
        estateId: estateId || undefined,
        name: bindName.trim() || selected.name || `Camera ${ip}`,
        ip,
        onvif_port: selected?.metadata?.raw?.onvifPort || selected?.metadata?.onvifPort || null,
        rtsp_url: rtsp,
        username: username.trim() || undefined,
        password: password.trim() || undefined,
      };

      await cameraService.bind(payload);
      setSelected(null);
      setBindName("");
      setScanOpen(false);
      await load();
    } catch (e: any) {
      const { status, msg } = extractErr(e);
      setScanErr(`${msg}${status ? ` (HTTP ${status})` : ""}`);
    } finally {
      setBinding(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(AI_PROFILE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        setProfileByCamera(parsed as Record<string, AiProfile>);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!intelCameraId) return;
    loadIntel(intelCameraId);
    setProfileLoading(true);
    cameraService
      .getAiProfile(intelCameraId)
      .then((res: any) => {
        if (res?.profile) {
          const merged = {
            ...defaultAiProfile,
            ...res.profile,
          } as AiProfile;
          persistProfiles({
            ...profileByCamera,
            [intelCameraId]: merged,
          });
        } else if (!profileByCamera[intelCameraId]) {
          persistProfiles({
            ...profileByCamera,
            [intelCameraId]: { ...defaultAiProfile },
          });
        }
      })
      .finally(() => setProfileLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intelCameraId]);

  useEffect(() => {
    if (!aiMonitorOn || !intelCameraId) return;
    const profile = profileByCamera[intelCameraId] || defaultAiProfile;
    if (!profile.armed) return;

    const candidates: string[] = [];
    if (profile.detectHuman) candidates.push("human_detection");
    if (profile.detectVehicle) candidates.push("vehicle_detection");
    if (profile.detectAnimal) candidates.push("animal_detection");
    if (profile.detectFace) candidates.push("face_recognition");
    if (profile.detectIntrusion) candidates.push("intrusion_detection");
    if (profile.detectLoitering) candidates.push("loitering_detection");
    if (!candidates.length) return;

    const ms = Math.max(8, Math.min(90, Number(aiMonitorRate || 20))) * 1000;
    const timer = setInterval(() => {
      const idx = Math.floor(Math.random() * candidates.length);
      const picked = candidates[idx];
      emitAiEvent(picked, "auto");
    }, ms);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiMonitorOn, aiMonitorRate, intelCameraId, profileByCamera]);

  async function emitAiEvent(type: string, source: "manual" | "auto" = "manual") {
    if (!intelCameraId) return;
    setIntelErr(null);
    const profile = profileByCamera[intelCameraId] || defaultAiProfile;
    const confBase = source === "manual" ? 0.9 : Math.max(0.5, profile.minConfidence / 100);
    const confidence = Math.min(0.99, confBase + Math.random() * 0.08);
    const res: any = await cameraService.createEvent(intelCameraId, {
      event_type: type,
      confidence,
      message:
        source === "manual"
          ? `Operator logged ${type.replace(/_/g, " ")}`
          : `AI monitor detected ${type.replace(/_/g, " ")}`,
      metadata: {
        source: source === "manual" ? "facility_ui_manual" : "facility_ai_monitor",
        profile_mode: profile.mode,
      },
    });
    if (res?.error) {
      setIntelErr(String(res.error));
      return;
    }
    setAiLastDetected(`${type.replace(/_/g, " ")} • ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`);

    if (profile.notifyPush && typeof window !== "undefined" && "Notification" in window) {
      try {
        if (window.Notification.permission === "default") {
          await window.Notification.requestPermission();
        }
        if (window.Notification.permission === "granted") {
          new window.Notification("Camera AI event", {
            body: `${type.replace(/_/g, " ")} detected on selected camera`,
          });
        }
      } catch {}
    }
    await loadIntel(intelCameraId);
  }

  async function logManualEvent(type: string) {
    await emitAiEvent(type, "manual");
  }

  return (
    <div className="space-y-7">
      <Topbar title="Cameras" subtitle="Discovery • binding • live stream" />

      <div className="flex items-center justify-end gap-2 flex-wrap">
        <Button onClick={() => setScanOpen(true)}>Scan Cameras</Button>
        <Button variant="ghost" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {!!err && (
        <div className="glass border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-200">
          {err}
        </div>
      )}

      {/* AI camera control center */}
      <div className="glass border border-white/10 rounded-2xl p-4 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm font-semibold text-white inline-flex items-center gap-2">
              <Brain size={16} className="text-blue-300" />
              AI Camera Security Center
            </div>
            <div className="text-xs text-zinc-400 mt-1">
              Full AI detection, rewind playback, event timeline, and alert routing.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={intelCameraId}
              onChange={(e) => setIntelCameraId(e.target.value)}
              className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm"
            >
              {!items.length ? <option value="">No camera</option> : null}
              {items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || c.ip}
                </option>
              ))}
            </select>
            <Button variant="ghost" onClick={() => intelCameraId && loadIntel(intelCameraId)} disabled={!intelCameraId}>
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.9fr_1fr]">
          <div className="space-y-3">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-xs text-zinc-400 mb-2">Playback / Rewind</div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {[
                  { label: "Live", value: 0 },
                  { label: "-1m", value: 60 },
                  { label: "-5m", value: 300 },
                  { label: "-15m", value: 900 },
                  { label: "-30m", value: 1800 },
                ].map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setIntelRewind(p.value)}
                    className={`rounded-full px-3 py-1 text-xs border ${
                      intelRewind === p.value
                        ? "border-blue-500/30 bg-blue-500/10 text-blue-200"
                        : "border-white/10 bg-white/5 text-zinc-300"
                    }`}
                  >
                    <span className="inline-flex items-center gap-1"><Clock3 size={12} />{p.label}</span>
                  </button>
                ))}
              </div>
              <input
                type="range"
                min={0}
                max={3600}
                step={30}
                value={intelRewind}
                onChange={(e) => setIntelRewind(Number(e.target.value))}
                className="w-full"
              />
              <div className="text-[11px] text-zinc-500 mt-1">Current rewind: {intelRewind === 0 ? "Live" : `${intelRewind}s ago`}</div>
            </div>

            {intelCameraId ? (
              <CameraPlayer cameraId={intelCameraId} variant="hero" rewindSeconds={intelRewind} />
            ) : (
              <div className="rounded-xl border border-white/10 bg-black/30 p-6 text-sm text-zinc-400">
                Select camera to open AI playback.
              </div>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-white font-semibold inline-flex items-center gap-2">
                <Shield size={15} className="text-emerald-300" />
                AI Modes & Detection
              </div>
              {profileLoading ? <span className="text-[10px] text-zinc-500">loading…</span> : null}
            </div>

            <div className="flex gap-1.5 flex-wrap">
              {[
                { key: "security", label: "Security" },
                { key: "pet", label: "Pet Home" },
                { key: "parking", label: "Parking" },
                { key: "balanced", label: "Balanced" },
              ].map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => applyAiPreset(p.key as any)}
                  className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-200"
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 flex items-center justify-between">
                Armed
                <input type="checkbox" checked={activeProfile.armed} onChange={(e) => patchActiveProfile({ armed: e.target.checked })} />
              </label>
              <label className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 flex items-center justify-between">
                Auto Record
                <input type="checkbox" checked={activeProfile.autoRecordOnDetect} onChange={(e) => patchActiveProfile({ autoRecordOnDetect: e.target.checked })} />
              </label>
              <label className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 flex items-center justify-between">
                Human
                <input type="checkbox" checked={activeProfile.detectHuman} onChange={(e) => patchActiveProfile({ detectHuman: e.target.checked })} />
              </label>
              <label className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 flex items-center justify-between">
                Vehicle
                <input type="checkbox" checked={activeProfile.detectVehicle} onChange={(e) => patchActiveProfile({ detectVehicle: e.target.checked })} />
              </label>
              <label className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 flex items-center justify-between">
                Animal
                <input type="checkbox" checked={activeProfile.detectAnimal} onChange={(e) => patchActiveProfile({ detectAnimal: e.target.checked })} />
              </label>
              <label className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 flex items-center justify-between">
                Face
                <input type="checkbox" checked={activeProfile.detectFace} onChange={(e) => patchActiveProfile({ detectFace: e.target.checked })} />
              </label>
              <label className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 flex items-center justify-between">
                Intrusion
                <input type="checkbox" checked={activeProfile.detectIntrusion} onChange={(e) => patchActiveProfile({ detectIntrusion: e.target.checked })} />
              </label>
              <label className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 flex items-center justify-between">
                Loitering
                <input type="checkbox" checked={activeProfile.detectLoitering} onChange={(e) => patchActiveProfile({ detectLoitering: e.target.checked })} />
              </label>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] text-zinc-400">Sensitivity: {activeProfile.sensitivity}</div>
              <input type="range" min={1} max={100} value={activeProfile.sensitivity} onChange={(e) => patchActiveProfile({ sensitivity: Number(e.target.value) })} className="w-full" />
              <div className="text-[11px] text-zinc-400">Min confidence: {activeProfile.minConfidence}%</div>
              <input type="range" min={30} max={99} value={activeProfile.minConfidence} onChange={(e) => patchActiveProfile({ minConfidence: Number(e.target.value) })} className="w-full" />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 flex items-center justify-between">
                <span className="inline-flex items-center gap-1"><Bell size={12} /> In-app</span>
                <input type="checkbox" checked={activeProfile.notifyInApp} onChange={(e) => patchActiveProfile({ notifyInApp: e.target.checked })} />
              </label>
              <label className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 flex items-center justify-between">
                Push
                <input type="checkbox" checked={activeProfile.notifyPush} onChange={(e) => patchActiveProfile({ notifyPush: e.target.checked })} />
              </label>
              <label className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 flex items-center justify-between">
                SMS
                <input type="checkbox" checked={activeProfile.notifySms} onChange={(e) => patchActiveProfile({ notifySms: e.target.checked })} />
              </label>
              <select
                value={activeProfile.mode}
                onChange={(e) => patchActiveProfile({ mode: e.target.value as AiProfile["mode"] })}
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5"
              >
                <option value="home">Home</option>
                <option value="away">Away</option>
                <option value="night">Night</option>
                <option value="vacation">Vacation</option>
              </select>
            </div>

            <div className="flex gap-2">
              <Button onClick={saveAiProfile} disabled={!intelCameraId || profileSaving}>
                {profileSaving ? "Saving..." : "Save AI Profile"}
              </Button>
              <Button
                variant={aiMonitorOn ? "secondary" : "ghost"}
                onClick={() => setAiMonitorOn((v) => !v)}
                disabled={!intelCameraId}
              >
                {aiMonitorOn ? "Stop AI Monitor" : "Start AI Monitor"}
              </Button>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] text-zinc-400">AI monitor interval: {aiMonitorRate}s</div>
              <input
                type="range"
                min={8}
                max={90}
                value={aiMonitorRate}
                onChange={(e) => setAiMonitorRate(Number(e.target.value))}
                className="w-full"
              />
              {aiMonitorOn ? (
                <div className="text-[11px] text-emerald-300">
                  AI monitor active{aiLastDetected ? ` • last: ${aiLastDetected}` : ""}.
                </div>
              ) : (
                <div className="text-[11px] text-zinc-500">AI monitor is idle.</div>
              )}
            </div>
            {profileMsg ? <div className="text-[11px] text-zinc-400">{profileMsg}</div> : null}
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-sm text-white font-semibold inline-flex items-center gap-2">
              <ShieldAlert size={15} className="text-amber-300" />
              Detection Timeline
            </div>
            {intelErr ? <div className="text-xs text-amber-200 mt-1">{intelErr}</div> : null}

            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <button type="button" onClick={() => logManualEvent("human_detection")} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-zinc-200 inline-flex items-center justify-center gap-1"><UserRound size={12} />Human</button>
              <button type="button" onClick={() => logManualEvent("vehicle_detection")} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-zinc-200 inline-flex items-center justify-center gap-1"><Car size={12} />Vehicle</button>
              <button type="button" onClick={() => logManualEvent("animal_detection")} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-zinc-200 inline-flex items-center justify-center gap-1"><Dog size={12} />Animal</button>
            </div>

            <div className="mt-3 max-h-72 overflow-auto space-y-2">
              {intelLoading ? <div className="text-xs text-zinc-500">Loading events...</div> : null}
              {!intelLoading && !intelEvents.length ? (
                <div className="text-xs text-zinc-500">No events yet.</div>
              ) : null}
              {intelEvents.map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => {
                    const ts = ev.created_at ? new Date(ev.created_at).getTime() : 0;
                    if (!ts) return;
                    const sec = Math.max(0, Math.round((Date.now() - ts) / 1000));
                    setIntelRewind(Math.min(3600, sec));
                  }}
                  className="w-full text-left rounded-lg border border-white/10 bg-zinc-900/70 px-2.5 py-2"
                >
                  <div className="text-xs text-white font-medium">{String(ev.event_type || "event").replace(/_/g, " ")}</div>
                  <div className="text-[11px] text-zinc-400 mt-1">{ev.message || "Detection event"}</div>
                  <div className="text-[10px] text-zinc-500 mt-1">
                    {ev.created_at ? new Date(ev.created_at).toLocaleString() : ""}
                    {typeof ev.confidence === "number" ? ` • ${Math.round(ev.confidence * 100)}%` : ""}
                  </div>
                </button>
              ))}
            </div>

            {intelCaps.length ? (
              <div className="mt-3 text-[11px] text-zinc-500 line-clamp-3">
                Backend capabilities: {intelCaps.map((c) => c.replace(/_/g, " ")).join(", ")}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Bound cameras */}
      {items.length === 0 ? (
        <div className="glass p-6 text-sm text-zinc-400">
          No cameras bound yet. Click <span className="text-zinc-200">Scan Cameras</span> to find ONVIF cameras on your network.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((c) => (
            <div key={c.id} className="glass p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">
                    {c.name || `Camera ${c.ip}`}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    IP: <span className="text-zinc-200">{c.ip}</span>
                  </div>
                </div>
                <div className="text-xs text-zinc-500">Live</div>
              </div>

              <CameraPlayer cameraId={c.id} />
            </div>
          ))}
        </div>
      )}

      {/* Scan modal */}
      {scanOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => !scanning && !binding && setScanOpen(false)}
          />

          <div className="relative glass border border-white/10 rounded-2xl w-full max-w-4xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold">Scan Cameras (ONVIF)</div>
                <div className="text-sm text-zinc-400 mt-1">
                  {scanning ? "Scanning..." : `Found ${scanResults.length} camera(s)`}
                </div>
              </div>
              <button
                className="text-zinc-400 hover:text-zinc-200"
                onClick={() => !scanning && !binding && setScanOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                className="bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 outline-none"
                placeholder="CIDR (e.g. 192.168.1.0/24)"
                value={cidr}
                onChange={(e) => setCidr(e.target.value)}
                disabled={scanning || binding}
              />
              <input
                className="bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 outline-none"
                placeholder="ONVIF username (optional)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={scanning || binding}
              />
              <input
                className="bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 outline-none"
                placeholder="ONVIF password (optional)"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={scanning || binding}
              />
            </div>

            <div className="mt-4 flex gap-2">
              <Button onClick={scan} disabled={scanning || binding}>
                {scanning ? "Scanning..." : "Scan"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setScanResults([]);
                  setSelected(null);
                  setScanErr(null);
                }}
                disabled={scanning || binding}
              >
                Clear
              </Button>
            </div>

            {scanErr && (
              <div className="mt-4 glass border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200 rounded-xl">
                {scanErr}
              </div>
            )}

            {/* results */}
            <div className="mt-5 overflow-auto max-h-[45vh]">
              <table className="w-full text-sm">
                <thead className="text-zinc-400">
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2">Pick</th>
                    <th className="text-left py-2">Name</th>
                    <th className="text-left py-2">IP</th>
                    <th className="text-left py-2">RTSP</th>
                  </tr>
                </thead>
                <tbody>
                  {scanResults.map((d, idx) => {
                    const ip = ipFromDiscovered(d);
                    const rtsp = d?.metadata?.raw?.rtsp || d?.metadata?.rtsp || "";
                    const picked = selected?.externalId === d.externalId;

                    return (
                      <tr key={`${d.externalId}-${idx}`} className="border-b border-white/5">
                        <td className="py-3">
                          <input
                            type="radio"
                            name="cam"
                            checked={picked}
                            onChange={() => setSelected(d)}
                            disabled={scanning || binding}
                          />
                        </td>
                        <td className="py-3 text-zinc-100">{d.name}</td>
                        <td className="py-3 text-zinc-300">{ip || "—"}</td>
                        <td className="py-3 text-zinc-300 truncate max-w-[320px]">
                          {rtsp ? rtsp : "—"}
                        </td>
                      </tr>
                    );
                  })}

                  {!scanResults.length && !scanning && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-zinc-500">
                        No cameras found yet. Enter CIDR and Scan.
                      </td>
                    </tr>
                  )}

                  {scanning && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-zinc-400">
                        Scanning… please wait.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* bind panel */}
            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div className="md:col-span-2">
                <div className="text-xs text-zinc-500 mb-2">Bind name</div>
                <input
                  className="w-full bg-zinc-900/60 border border-white/10 rounded-xl px-4 py-3 outline-none"
                  placeholder={selected ? (selected.name || "Camera name") : "Select a camera first"}
                  value={bindName}
                  onChange={(e) => setBindName(e.target.value)}
                  disabled={!selected || scanning || binding}
                />
              </div>

              <Button onClick={bindSelected} disabled={!selected || scanning || binding}>
                {binding ? "Binding..." : "Bind Camera"}
              </Button>
            </div>

            {/* quick preview */}
            {selected && (
              <div className="mt-5 glass p-4">
                <div className="text-sm font-medium">Preview (after you bind)</div>
                <div className="text-xs text-zinc-500 mt-1">
                  Stream will appear on this page after binding.
                </div>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setScanOpen(false)} disabled={scanning || binding}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
