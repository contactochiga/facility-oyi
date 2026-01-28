// services/facilityService.ts

import API from "./api";
import type { FacilityOverview } from "@/types/facility";

export type MyEstatesResponse = {
  estates: Array<{
    id: string;
    name: string;
    address?: string | null;
    lat?: number | null;
    lng?: number | null;
    type?: string | null;
    created_at?: string;
    membership_role?: string;
    membership_status?: string;
  }>;
};

export type HomesResponse<T = any> = {
  homes: T[];
};

export type RoomsResponse<T = any> = {
  rooms: T[];
};

// ---------------------------
// ROOMS (CREATE)
// ---------------------------
export type CreateRoomPayload = {
  estate_id: string;
  home_id: string;
  name: string;
  type?: string;
  floor?: number;
  ai_profile?: Record<string, any>;
};

export type CreateRoomResponse = {
  message: string;
  room: any;
};

// ---------------------------
// DEVICES (DISCOVERY)
// ---------------------------
export type DiscoveredDevice = {
  id?: string;
  name?: string;
  local_name?: string;
  device_id?: string;
  devId?: string;
  product_id?: string;
  category?: string;
  online?: boolean;
  isOnline?: boolean;
  status?: string;

  externalId?: string;
  adapter?: string;
  capabilities?: string[];
  protocols?: string[];
  metadata?: any;

  [key: string]: any;
};

export type DiscoverDevicesResponse = {
  adapter: string;
  count: number;
  devices: DiscoveredDevice[];
};

export type DiscoverAdapter = "tuya" | "ssdp" | "onvif";

export type DiscoverOptions = {
  cidr?: string;
  username?: string;
  password?: string;
  [key: string]: any;
};

// ---------------------------
// ESTATE USERS (KEEP THESE EXPORTS)
// ---------------------------
export type EstateMembershipRow = {
  id: string;
  role: string;
  status: string;
  users: {
    id: string;
    email?: string;
    full_name?: string;
    username?: string;
    role?: string;
  };
};

export type ListEstateUsersResponse = {
  estate_id: string;
  users: EstateMembershipRow[];
};

export type UpdateEstateUserPayload = {
  role?: string;
  status?: string;
};

// ---------------------------
// HOME USERS (KEEP THESE EXPORTS)
// ---------------------------
export type HomeMembershipRow = {
  id: string;
  home_id: string;
  role: string;
  status: string;
  permissions?: Record<string, any>;
  created_at?: string;
  users: {
    id: string;
    email?: string;
    full_name?: string;
    username?: string;
    role?: string;
  };
};

export type ListHomeUsersResponse = {
  home_id: string;
  users: HomeMembershipRow[];
};

export type InviteHomeUserPayload = {
  email: string;
  role?: string; // owner | resident | staff | guest | member
  permissions?: Record<string, any>;
};

// ✅ Matches your backend inviteHomeUser() return (inviteUrl + qr + membership)
export type InviteHomeUserResponse = {
  message: string;
  inviteUrl: string;
  qrDataUrl: string;
  invited_user_id: string;
  membership: HomeMembershipRow; // upserted home_memberships row
};

export type UpdateHomeUserPayload = {
  role?: string;
  status?: string;
  permissions?: Record<string, any>;
};

// ---------------------------
// DEVICE REGISTRY (v1.1 hook stubs)
// ---------------------------
export type RegisterDevicePayload = {
  estate_id: string;
  home_id?: string;
  room_id?: string;

  adapter: string;
  external_id: string;
  name: string;

  category?: string;
  capabilities?: string[];
  protocols?: string[];
  metadata?: any;
};

function normalizeEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

/**
 * Map facility UI role -> backend membership_role
 * Your DB enum supports:
 * owner | admin | manager | security | resident | member | guest | staff | viewer
 */
function mapRoleToMembershipRole(role?: string): string | undefined {
  const r = String(role || "").trim().toLowerCase();
  if (["owner", "resident", "staff", "guest", "member", "viewer"].includes(r)) return r;
  return "member";
}

export const facilityService = {
  // ---------------------------
  // OVERVIEW
  // ---------------------------
  async overview(): Promise<FacilityOverview> {
    const res = await API.get("/facility/overview");
    return res.data;
  },

  // ---------------------------
  // ESTATES
  // ---------------------------
  async myEstates(): Promise<MyEstatesResponse> {
    const res = await API.get("/facility/estates");
    return res.data;
  },

  async createEstate(payload: {
    name: string;
    address?: string;
    lat?: number;
    lng?: number;
    type?: string;
  }): Promise<{ message: string; estate: any }> {
    const res = await API.post("/facility/estates", payload);
    return res.data;
  },

  // ---------------------------
  // HOMES
  // ---------------------------
  async listHomes(estateId: string): Promise<HomesResponse> {
    const res = await API.get(`/facility/estates/${estateId}/homes`);
    return res.data;
  },

  async createHome(payload: {
    estate_id: string;
    name: string;
    unit?: string;
    block?: string;
    description?: string;
    type?: string;
    resident_id?: string | null;

    electricity_meter?: string;
    water_meter?: string;
    internet_id?: string;
    gate_code?: string;
    lat?: number;
    lng?: number;
  }): Promise<{ message: string; home: any }> {
    const res = await API.post("/facility/homes", payload);
    return res.data;
  },

  // ---------------------------
  // ROOMS
  // ---------------------------
  async listRooms(homeId: string): Promise<RoomsResponse> {
    const res = await API.get(`/facility/homes/${homeId}/rooms`);
    return res.data;
  },

  async createRoom(payload: CreateRoomPayload): Promise<CreateRoomResponse> {
    const res = await API.post("/facility/rooms", payload);
    return res.data;
  },

  // ---------------------------
  // DEVICES (DISCOVERY)
  // ---------------------------
  async discoverDevices(
    adapter: DiscoverAdapter = "tuya",
    opts: DiscoverOptions = {}
  ): Promise<DiscoverDevicesResponse> {
    const res = await API.get("/facility/devices/discover", {
      params: {
        adapter,
        ...opts,
      },
    });
    return res.data;
  },

  // ---------------------------
  // DEVICES (REGISTRY) - hooks for v1.1
  // ---------------------------
  async registerDevice(payload: RegisterDevicePayload): Promise<any> {
    const res = await API.post("/facility/devices/register", payload);
    return res.data;
  },

  async attachDevice(deviceId: string, roomId: string): Promise<any> {
    const res = await API.patch(`/facility/devices/${deviceId}/attach`, {
      room_id: roomId,
    });
    return res.data;
  },

  async sendDeviceCommand(deviceId: string, command: Record<string, any>): Promise<any> {
    const res = await API.post(`/facility/devices/${deviceId}/command`, { command });
    return res.data;
  },

  // ---------------------------
  // ESTATE USERS
  // ---------------------------
  async listEstateUsers(): Promise<ListEstateUsersResponse> {
    const res = await API.get("/facility/estate-users");
    return res.data;
  },

  async updateEstateUser(membershipId: string, payload: UpdateEstateUserPayload) {
    const res = await API.patch(`/facility/estate-users/${membershipId}`, payload);
    return res.data;
  },

  async removeEstateUser(membershipId: string) {
    const res = await API.delete(`/facility/estate-users/${membershipId}`);
    return res.data;
  },

  // ---------------------------
  // HOME USERS
  // ---------------------------
  async listHomeUsers(homeId: string): Promise<ListHomeUsersResponse> {
    const res = await API.get(`/facility/homes/${homeId}/users`);
    return res.data;
  },

  /**
   * ✅ FIXED:
   * Facility should invite via:
   * POST /facility/homes/:homeId/invite
   * (backend will derive estate_id from home)
   */
  async inviteHomeUser(homeId: string, payload: InviteHomeUserPayload): Promise<InviteHomeUserResponse> {
    const invitedEmail = normalizeEmail(payload.email);
    if (!invitedEmail.includes("@")) throw new Error("Invalid email");

    const res = await API.post(`/facility/homes/${homeId}/invite`, {
      email: invitedEmail,
      role: mapRoleToMembershipRole(payload.role),
      permissions: payload.permissions || {},
    });

    return res.data as InviteHomeUserResponse;
  },

  async updateHomeUser(membershipId: string, payload: UpdateHomeUserPayload) {
    const res = await API.patch(`/facility/home-users/${membershipId}`, payload);
    return res.data;
  },

  async removeHomeUser(membershipId: string) {
    const res = await API.delete(`/facility/home-users/${membershipId}`);
    return res.data;
  },
};

export default facilityService;
