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

  // ✅ Build HLS URL with signed query token
  hlsUrl(cameraId: string, token: string) {
    const base = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
    return `${base}/cameras/${encodeURIComponent(cameraId)}/hls.m3u8?token=${encodeURIComponent(
      token
    )}`;
  },
};

export default cameraService;
