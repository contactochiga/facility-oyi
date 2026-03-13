// services/cameraService.ts
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

export type BoundCamera = {
  id: string;
  estate_id: string;
  name: string | null;
  ip: string;
  onvif_port: number | null;
  rtsp_url: string;
  username: string | null;
  password: string | null;
  created_at: string;
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

  async bind(payload: {
    estateId?: string;
    name?: string;
    ip: string;
    onvif_port?: number | null;
    rtsp_url: string;
    username?: string;
    password?: string;
  }) {
    const res = await API.post("/cameras/bind", payload);
    return res.data as { ok: boolean; camera: BoundCamera };
  },

  // ✅ NEW: Get short-lived HLS token (Bearer auth works here)
  async getHlsToken(cameraId: string) {
    const res = await API.get(`/cameras/${encodeURIComponent(cameraId)}/hls-token`);
    return res.data as { ok: boolean; token: string; expires_in: number };
  },

  async getPlayback(cameraId: string, rewindSeconds = 0) {
    const rewind = Math.max(0, Math.floor(rewindSeconds || 0));

    // Preferred route (new backend)
    try {
      const res = await API.get(`/cameras/${encodeURIComponent(cameraId)}/playback`, {
        params: { rewind },
      });
      if (res?.data?.url) {
        return res.data as { ok: boolean; type: "hls"; url: string; rewind: number };
      }
    } catch (err: any) {
      const status = Number(err?.response?.status || 0);
      // fall through to legacy flow on 404/405/501 or gateway mismatch
      if (![404, 405, 501, 502].includes(status)) {
        throw err;
      }
    }

    // Legacy fallback (older backend): hls-token + hls.m3u8
    const tokenRes = await API.get(`/cameras/${encodeURIComponent(cameraId)}/hls-token`);
    const token = String(tokenRes?.data?.token || "").trim();
    if (!token) throw new Error("Playback unavailable: missing HLS token.");

    let url = this.hlsUrl(cameraId, token);
    if (rewind > 0) {
      const sep = url.includes("?") ? "&" : "?";
      url = `${url}${sep}rewind=${encodeURIComponent(String(rewind))}`;
    }

    return { ok: true, type: "hls", url, rewind } as {
      ok: boolean;
      type: "hls";
      url: string;
      rewind: number;
    };
  },

  async listEvents(cameraId: string, opts?: { limit?: number; sinceMinutes?: number }) {
    const res = await API.get(`/cameras/${encodeURIComponent(cameraId)}/events`, {
      params: {
        limit: opts?.limit ?? 30,
        sinceMinutes: opts?.sinceMinutes ?? 24 * 60,
      },
    });
    return res.data as { ok: boolean; events: CameraEvent[]; warning?: string };
  },

  async createEvent(
    cameraId: string,
    payload: {
      event_type: string;
      confidence?: number;
      snapshot_url?: string;
      message?: string;
      metadata?: Record<string, any>;
    }
  ) {
    const res = await API.post(`/cameras/${encodeURIComponent(cameraId)}/events`, payload);
    return res.data as { ok: boolean; event?: CameraEvent; error?: string };
  },

  async getAnalyticsCapabilities() {
    const res = await API.get("/cameras/analytics/capabilities");
    return res.data as { ok: boolean; capabilities: string[]; note?: string };
  },

  // ✅ Build HLS URL with signed query token
  hlsUrl(cameraId: string, token: string) {
    const base = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
    return `${base}/cameras/${encodeURIComponent(cameraId)}/hls.m3u8?token=${encodeURIComponent(
      token
    )}`;
  },
};

export default cameraService;
