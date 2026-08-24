import API from "./api";
import { createCameraReadClient, normalizeCamera, type Camera, type CameraEvent, type CameraPlaybackSession, type CameraScope } from "@/lib/oyi-camera-core/core";
import { createCameraMediaReadClient, type CameraMediaKind } from "@/lib/oyi-camera-core/media";

export type DiscoveredCamera = {
  id: string;
  discoveryId: string;
  fingerprint: string;
  provider: string;
  name: string;
  onvifAvailable: boolean;
  rtspAvailable: boolean;
  requiresAuthentication: boolean;
  capabilities: Record<string, unknown>;
  state: string;
  canonicalCameraId?: string | null;
};

export type CameraPrivacyScope = Exclude<CameraScope, "unknown">;
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
const mediaClient = createCameraMediaReadClient(API);
const facilityCamera = (raw: any): BoundCamera => ({ ...normalizeCamera(raw), ip: raw?.ip ?? null, onvif_port: raw?.onvif_port ?? null, edge_status: raw?.edge_status ?? null, nvrId: raw?.nvr_id ?? null, channel: raw?.channel ?? null, metadata: raw?.metadata ?? null });

export const cameraService = {
  async scan(payload: { estateId: string; edgeNodeId: string; cidr?: string; credentialRef?: string }) {
    const command = await API.post("/edge/camera-discovery/commands", {
      estateId: payload.estateId,
      edgeNodeId: payload.edgeNodeId,
      surface: "facility",
      mode: payload.cidr ? "subnet" : "onvif",
      cidr: payload.cidr || undefined,
      credentialRef: payload.credentialRef || undefined,
    });
    const commandId = String(command.data?.command?.id || "");
    if (!commandId) throw new Error("Edge discovery command was not created.");
    let completed = false;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const status = await API.get(`/edge/camera-discovery/commands/${encodeURIComponent(commandId)}`);
      const state = String(status.data?.command?.status || "");
      if (state === "failed") throw new Error(status.data?.command?.error || "Edge camera discovery failed.");
      if (state === "completed") { completed = true; break; }
    }
    if (!completed) throw new Error("Oyi Edge discovery is still pending. Try again when the node is online.");
    const candidates = await API.get("/edge/camera-discovery/candidates", { params: { estateId: payload.estateId } });
    return { ok: true, items: (candidates.data?.items || []) as DiscoveredCamera[] };
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

  async provision(candidateId: string, payload: {
    name?: string;
    location?: string;
    scope?: CameraPrivacyScope;
    credentialRef?: string;
  }) {
    const res = await API.post(`/edge/camera-discovery/candidates/${encodeURIComponent(candidateId)}/provision`, payload);
    return { ...res.data, camera: facilityCamera(res.data?.camera) } as { ok: boolean; camera: BoundCamera };
  },

  async getPlayback(cameraId: string): Promise<CameraPlaybackSession> {
    return readClient.createPlaybackSession(cameraId);
  },

  async listEvents(cameraId: string, opts?: { limit?: number; sinceMinutes?: number }) {
    const events = await readClient.getCameraEvents(cameraId, { limit: opts?.limit ?? 30, sinceMinutes: opts?.sinceMinutes ?? 24 * 60 });
    return { ok: true, events };
  },

  async listMedia(cameraId: string, opts?: { limit?: number; kind?: CameraMediaKind; eventId?: string }) {
    return mediaClient.getCameraMedia(cameraId, { limit: opts?.limit ?? 20, kind: opts?.kind, eventId: opts?.eventId });
  },

  async createMediaAccess(mediaId: string) {
    return mediaClient.createCameraMediaAccess(mediaId);
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
};

export default cameraService;
