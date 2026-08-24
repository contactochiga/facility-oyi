import API from "./api";

export type DiscoveredCamera = {
  externalId: string;
  adapter: string;
  name: string;
  category: "camera" | string;
  online: boolean;
  capabilities: string[];
  metadata?: any;
};

export type CameraPrivacyScope = "facility" | "home" | "office";
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

export type BoundCamera = {
  id: string;
  estate_id: string;
  name: string | null;
  ip?: string | null;
  onvif_port: number | null;
  status?: string | null;
  health_status?: string | null;
  stream_status?: string | null;
  edge_status?: string | null;
  edge_node_id?: string | null;
  location?: string | null;
  nvr_id?: string | null;
  channel?: string | null;
  credential_ref?: string | null;
  privacy_scope?: CameraPrivacyScope | string | null;
  last_seen_at?: string | null;
  created_at?: string | null;
  metadata?: Record<string, any> | null;
  health?: {
    online: boolean;
    status: string;
    stream_status: string;
    last_health_at?: string | null;
    latency_ms?: number | null;
    reconnect_count?: number;
    provider_error?: string | null;
  } | null;
};

export type CameraEvent = {
  id: string;
  camera_id: string;
  event_type: string;
  confidence?: number | null;
  snapshot_url?: string | null;
  message?: string | null;
  metadata?: Record<string, any> | null;
  created_at?: string | null;
  source_timestamp?: string | null;
};

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

export const cameraService = {
  async scan(payload: { cidr?: string; username?: string; password?: string }) {
    const res = await API.post("/cameras/scan", payload);
    return res.data as { ok: boolean; items: DiscoveredCamera[] };
  },

  async listByEstate(estateId: string) {
    const res = await API.get(`/cameras/estate/${encodeURIComponent(estateId)}`);
    return res.data as { ok: boolean; items: BoundCamera[] };
  },

  async inventoryByEstate(estateId: string) {
    const res = await API.get(`/cameras/inventory/estate/${encodeURIComponent(estateId)}`);
    return res.data as CameraInventory;
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
    return res.data as { ok: boolean; dvr: CameraDvr; cameras: BoundCamera[]; errors?: Array<{ channel: number; error: string }>; message: string };
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
    return res.data as { ok: boolean; camera: BoundCamera };
  },

  async getHlsToken(cameraId: string) {
    const res = await API.get(`/cameras/${encodeURIComponent(cameraId)}/hls-token`);
    return res.data as { ok: boolean; token: string; expires_in: number };
  },

  async getPlayback(cameraId: string, rewindSeconds = 0) {
    const rewind = Math.max(0, Math.floor(rewindSeconds || 0));
    try {
      const res = await API.get(`/cameras/${encodeURIComponent(cameraId)}/playback`, { params: { rewind } });
      if (res?.data?.url || res?.data?.hls_url) {
        return { ...res.data, url: res.data.hls_url || res.data.url, type: res.data.playback_type || res.data.type || "hls" } as { ok: boolean; type: "hls"; url: string; rewind: number; hls_url?: string; edge_status?: string; stream_status?: string; message?: string };
      }
    } catch (err: any) {
      const status = Number(err?.response?.status || 0);
      if (![404, 405, 501, 502].includes(status)) throw err;
    }

    const tokenRes = await API.get(`/cameras/${encodeURIComponent(cameraId)}/hls-token`);
    const token = String(tokenRes?.data?.token || "").trim();
    if (!token) throw new Error("Playback unavailable: missing HLS token.");
    let url = this.hlsUrl(cameraId, token);
    if (rewind > 0) url = `${url}${url.includes("?") ? "&" : "?"}rewind=${encodeURIComponent(String(rewind))}`;
    return { ok: true, type: "hls", url, rewind } as { ok: boolean; type: "hls"; url: string; rewind: number };
  },

  async listEvents(cameraId: string, opts?: { limit?: number; sinceMinutes?: number }) {
    const res = await API.get(`/cameras/${encodeURIComponent(cameraId)}/events`, { params: { limit: opts?.limit ?? 30, sinceMinutes: opts?.sinceMinutes ?? 24 * 60 } });
    return res.data as { ok: boolean; events: CameraEvent[]; warning?: string };
  },

  async createEvent(cameraId: string, payload: { event_type: string; confidence?: number; snapshot_url?: string; message?: string; metadata?: Record<string, any> }) {
    const res = await API.post(`/cameras/${encodeURIComponent(cameraId)}/events`, payload);
    return res.data as { ok: boolean; event?: CameraEvent; error?: string };
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
