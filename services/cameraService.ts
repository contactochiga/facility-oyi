import API from "./api";
import { createCameraReadClient, normalizeCamera, normalizeCameraEvent, type Camera, type CameraEvent, type CameraPlaybackSession, type CameraScope } from "@/lib/oyi-camera-core/core";

export type DiscoveredCamera = {
  externalId: string;
  adapter: string;
  name: string;
  category: "camera" | string;
  online: boolean;
  capabilities: string[];
  metadata?: any;
};

export type CameraPrivacyScope = Exclude<CameraScope, "unknown">;
export type CameraType = "ip_camera" | "dvr_channel" | "nvr_channel";
export type DvrBrand = "generic_rtsp" | "hikvision" | "dahua" | "hilook" | "uniview";

export type CameraDvr = {
  id: string;
  estate_id: string;
  name: string;
  brand: DvrBrand | string;
  model?: string | null;
  ip_address: string;
  port: number;
  credential_ref: string;
  channel_count: number;
  edge_node_id?: string | null;
  onvif_enabled?: boolean | null;
  rtsp_enabled?: boolean | null;
  status?: string | null;
  last_seen_at?: string | null;
  metadata?: Record<string, any> | null;
};

export type BoundCamera = Camera & {
  ip?: string | null;
  onvif_port: number | null;
  edge_status?: string | null;
  nvrId?: string | null;
  channel?: string | null;
  metadata?: Record<string, any> | null;
};
export type { CameraEvent };

export type CameraAiProfile = {
  armed?: boolean;
  mode?: "home" | "away" | "night" | "vacation" | string;
  sensitivity?: number;
  minConfidence?: number;
  detectHuman?: boolean;
  detectVehicle?: boolean;
  detectAnimal?: boolean;
  detectFace?: boolean;
  detectLoitering?: boolean;
  detectIntrusion?: boolean;
  notifyInApp?: boolean;
  notifyPush?: boolean;
  notifySms?: boolean;
  autoRecordOnDetect?: boolean;
  [key: string]: any;
};

export type DvrChannelDraft = {
  channel_number: number;
  camera_name: string;
  location?: string;
  privacy_scope: CameraPrivacyScope;
  enabled?: boolean;
};

export type CameraInventory = {
  ok: boolean;
  dvrs: CameraDvr[];
  cameras: BoundCamera[];
  summary: {
    dvrs: number;
    cameras: number;
    healthy_streams: number;
    offline_streams: number;
    edge_nodes: number;
    ai_enabled_cameras: number;
  };
};

const readClient = createCameraReadClient(API);
const facilityCamera = (raw: any): BoundCamera => ({ ...normalizeCamera(raw), ip: raw?.ip ?? null, onvif_port: raw?.onvif_port ?? null, edge_status: raw?.edge_status ?? null, nvrId: raw?.nvr_id ?? null, channel: raw?.channel ?? null, metadata: raw?.metadata ?? null });

export const cameraService = {
  async scan(payload: { cidr?: string; username?: string; password?: string }) {
    const res = await API.post("/cameras/scan", payload);
    return res.data as { ok: boolean; items: DiscoveredCamera[] };
  },

  async listByEstate(estateId: string) {
    const res = await API.get(`/cameras/estate/${encodeURIComponent(estateId)}`);
    return { ok: true, items: (res.data?.items || []).map(facilityCamera) as BoundCamera[] };
  },

  async inventoryByEstate(estateId: string) {
    const res = await API.get(`/cameras/inventory/estate/${encodeURIComponent(estateId)}`);
    return { ...res.data, cameras: (res.data?.cameras || []).map(facilityCamera) } as CameraInventory;
  },

  async listDvrs(estateId: string) {
    const res = await API.get(`/cameras/dvrs/estate/${encodeURIComponent(estateId)}`);
    return res.data as { ok: boolean; items: CameraDvr[] };
  },

  async testDvr(payload: { estateId?: string; name?: string; brand: DvrBrand | string; ip_address: string; port?: number; username?: string; password?: string; channel_count?: number; model?: string; onvif_enabled?: boolean }) {
    const res = await API.post("/cameras/dvrs/test", payload);
    return res.data as { ok: boolean; status: "healthy" | "warning" | "failed"; dvr_online: boolean; channel_count: number; channels: DvrChannelDraft[]; message: string; latency_ms?: number | null };
  },

  async importDvr(payload: { estateId?: string; name: string; brand: DvrBrand | string; ip_address: string; port?: number; username?: string; password?: string; channel_count: number; edge_node_id?: string; credential_ref?: string; model?: string; onvif_enabled?: boolean; channels: DvrChannelDraft[] }) {
    const res = await API.post("/cameras/dvrs/import", payload);
    return { ...res.data, cameras: (res.data?.cameras || []).map(facilityCamera) } as { ok: boolean; dvr: CameraDvr; cameras: BoundCamera[]; errors?: Array<{ channel: number; error: string }>; message: string };
  },

  async validateStream(cameraId: string) {
    const res = await API.post(`/cameras/${encodeURIComponent(cameraId)}/validate-stream`, {});
    return res.data as { ok: boolean; status: "healthy" | "warning" | "failed"; checks: Record<string, string>; reason: string };
  },

  async bind(payload: {
    estateId?: string;
    name?: string;
    ip: string;
    onvif_port?: number | null;
    rtsp_url?: string;
    username?: string;
    password?: string;
    location?: string;
    camera_type?: CameraType;
    privacy_scope?: CameraPrivacyScope;
    access_policy?: Record<string, any>;
    edge_node_id?: string;
    dvr_id?: string;
    channel_number?: string | number;
    credential_ref?: string;
    enabled?: boolean;
  }) {
    const res = await API.post("/cameras/bind", payload);
    return { ...res.data, camera: facilityCamera(res.data?.camera) } as { ok: boolean; camera: BoundCamera };
  },

  async getHlsToken(cameraId: string) {
    const res = await API.get(`/cameras/${encodeURIComponent(cameraId)}/hls-token`);
    return res.data as { ok: boolean; token: string; expires_in: number };
  },

  async getPlayback(cameraId: string, rewindSeconds = 0): Promise<CameraPlaybackSession> {
    return readClient.createPlaybackSession(cameraId, { rewindSeconds });
  },

  async listEvents(cameraId: string, opts?: { limit?: number; sinceMinutes?: number }) {
    const events = await readClient.getCameraEvents(cameraId, { limit: opts?.limit ?? 30, sinceMinutes: opts?.sinceMinutes ?? 24 * 60 });
    return { ok: true, events };
  },

  async createEvent(cameraId: string, payload: { event_type: string; confidence?: number; snapshot_url?: string; message?: string; metadata?: Record<string, any> }) {
    const res = await API.post(`/cameras/${encodeURIComponent(cameraId)}/events`, payload);
    return { ...res.data, event: res.data?.event ? normalizeCameraEvent(res.data.event) : undefined } as { ok: boolean; event?: CameraEvent; error?: string };
  },

  async getAnalyticsCapabilities() {
    const res = await API.get("/cameras/analytics/capabilities");
    return res.data as { ok: boolean; capabilities: string[]; note?: string };
  },

  async getAiProfile(cameraId: string) {
    try {
      const res = await API.get(`/cameras/${encodeURIComponent(cameraId)}/ai/profile`);
      return res.data as { ok: boolean; profile?: CameraAiProfile };
    } catch (err: any) {
      const status = Number(err?.response?.status || 0);
      if ([404, 405, 501].includes(status)) return { ok: false, profile: undefined } as { ok: boolean; profile?: CameraAiProfile };
      throw err;
    }
  },

  async upsertAiProfile(cameraId: string, profile: CameraAiProfile) {
    try {
      const res = await API.put(`/cameras/${encodeURIComponent(cameraId)}/ai/profile`, profile);
      return res.data as { ok: boolean; profile?: CameraAiProfile };
    } catch (err: any) {
      const status = Number(err?.response?.status || 0);
      if ([404, 405, 501].includes(status)) return { ok: false, skipped: true } as { ok: boolean; skipped?: boolean };
      throw err;
    }
  },

  hlsUrl(cameraId: string, token: string) {
    const base = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
    return `${base}/cameras/${encodeURIComponent(cameraId)}/hls.m3u8?token=${encodeURIComponent(token)}`;
  },
};

export default cameraService;
