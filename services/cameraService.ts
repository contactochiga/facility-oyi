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

  // ⚠️ This ONLY builds a URL. It does NOT add auth headers.
  hlsUrl(cameraId: string) {
    const base = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
    return `${base}/cameras/${encodeURIComponent(cameraId)}/hls.m3u8`;
  },
};

export default cameraService;
