import API from "./api";

/* -----------------------------
 * TYPES
 * ----------------------------- */

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

/* -----------------------------
 * CAMERA SERVICE (FACILITY)
 * ----------------------------- */

export const cameraService = {
  /**
   * Scan LAN cameras (ONVIF)
   * POST /facility/cameras/scan
   */
  async scan(payload: {
    cidr?: string;
    username?: string;
    password?: string;
  }) {
    const res = await API.post("/facility/cameras/scan", payload);
    return res.data as {
      ok: boolean;
      items: DiscoveredCamera[];
    };
  },

  /**
   * List bound cameras by estate
   * GET /facility/cameras/estate/:estateId
   */
  async listByEstate(estateId: string) {
    const res = await API.get(
      `/facility/cameras/estate/${encodeURIComponent(estateId)}`
    );
    return res.data as {
      ok: boolean;
      items: BoundCamera[];
    };
  },

  /**
   * Bind a camera
   * POST /facility/cameras/bind
   */
  async bind(payload: {
    estateId?: string;
    name?: string;
    ip: string;
    onvif_port?: number | null;
    rtsp_url: string;
    username?: string;
    password?: string;
  }) {
    const res = await API.post("/facility/cameras/bind", payload);
    return res.data as {
      ok: boolean;
      camera: BoundCamera;
    };
  },

  /**
   * HLS stream URL
   * GET /facility/cameras/:cameraId/hls.m3u8
   */
  hlsUrl(cameraId: string) {
    const base = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
    return `${base}/facility/cameras/${encodeURIComponent(
      cameraId
    )}/hls.m3u8`;
  },
};

export default cameraService;
