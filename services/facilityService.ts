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

export type EstateServicePaymentRow = {
  id: string;
  amount: number;
  reference: string;
  status: string;
  created_at?: string | null;
  type: string;
  service_key?: string | null;
  service_title?: string | null;
  account_ref?: string | null;
  token_code?: string | null;
  bundle_name?: string | null;
  period_label?: string | null;
  user_email?: string | null;
  user_name?: string | null;
  home_id?: string | null;
  home_name?: string | null;
  home_label?: string | null;
};

export type RoomsResponse<T = any> = {
  rooms: T[];
};

export type EstateStructureSummary = {
  homes: number;
  occupied_homes: number;
  vacant_homes: number;
  pending_activation_homes: number;
  pending_invitations: number;
  expired_invitations: number;
  revoked_invitations: number;
  failed_deliveries: number;
  active_residents: number;
  suspended_residents: number;
  rooms_configured: number;
  devices_assigned: number;
  homes_without_residents: number;
  homes_with_multiple_members: number;
  resident_access_issues: number;
  recently_activated_residents: number;
};

export type EstateStructureResponse = {
  estate: { id: string; name: string };
  homes: any[];
  invitations: HomeInviteRow[];
  summary: EstateStructureSummary;
  sources: Record<string, string>;
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
  updated_at?: string;
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
  invites?: HomeInviteRow[];
  can_manage?: boolean;
};

export type InviteHomeUserPayload = {
  email: string;
  full_name?: string;
  role?: "owner" | "admin" | "resident" | "guest" | string;
  permissions?: Record<string, any>;
};

export type HomeInviteRow = {
  id: string;
  home_id: string;
  invited_email?: string | null;
  role?: string | null;
  status: string;
  expires_at?: string | null;
  delivery_status?: string | null;
  last_sent_at?: string | null;
  claimed_at?: string | null;
  revoked_at?: string | null;
  created_at?: string | null;
  lifecycle_status?: string | null;
};

// ✅ Matches backend inviteHomeUser() return (inviteUrl + qr + membership)
export type InviteHomeUserResponse = {
  message: string;
  inviteUrl: string;
  qrDataUrl: string;
  invited_user_id: string;
  membership: HomeMembershipRow;
  invite: HomeInviteRow;
};

export type ResendHomeInviteResponse = {
  ok: true;
  invite: HomeInviteRow;
  inviteUrl: string;
  qrDataUrl: string;
};

export type UpdateHomeUserPayload = {
  role?: string;
  status?: string;
  permissions?: Record<string, any>;
  full_name?: string;
  username?: string;
  email?: string;
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

export type InfrastructureDevice = {
  id: string;
  oyi_id: string;
  external_id?: string | null;
  name: string;
  type: string;
  category: string;
  provider: string;
  adapter: string;
  status: "online" | "offline" | "unknown" | "pending_assignment" | "error" | string;
  raw_status: string;
  online?: boolean | null;
  last_seen_at?: string | null;
  last_event_at?: string | null;
  sync_state: string;
  bind_state: string;
  home_id?: string | null;
  room_id?: string | null;
  home?: { id: string; name?: string; unit?: string; block?: string } | null;
  room?: { id: string; name?: string } | null;
  capabilities: string[];
  protocols: string[];
  metadata: Record<string, any>;
};

export type InfrastructureOperations = {
  estate: { id: string };
  registry: InfrastructureDevice[];
  discovered: Array<Record<string, any>>;
  homes: Array<Record<string, any>>;
  rooms: Array<Record<string, any>>;
  edge_nodes: Array<Record<string, any>>;
  heartbeats: Array<Record<string, any>>;
  assignment_history: Array<Record<string, any>>;
  providers: Array<Record<string, any>>;
  telemetry: Array<Record<string, any>>;
  sources: Record<string, { available: boolean; reason?: string; required_source?: string; events?: string[] }>;
};

function normalizeEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

/**
 * Map UI roles -> DB enum-safe membership_role
 * Your DB enum supports:
 * owner | admin | manager | security | resident | member | guest | staff | viewer
 *
 * Legacy home_admin/home_member aliases remain accepted for compatibility.
 */
function mapRoleToMembershipRole(role?: string): string {
  const r = String(role || "").trim().toLowerCase();
  if (r === "home_admin" || r === "owner") return "owner";
  if (r === "home_member" || r === "member" || r === "staff") return "member";
  if (r === "admin" || r === "guest" || r === "viewer") return r;
  return "resident";
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

  async estateStructure(estateId?: string): Promise<EstateStructureResponse> {
    const res = await API.get("/facility/estate-structure", {
      params: estateId ? { estate_id: estateId } : undefined,
    });
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

  async updateHome(
    homeId: string,
    payload: {
      name?: string;
      unit?: string;
      block?: string;
      description?: string;
      resident_id?: string | null;
      electricity_meter?: string;
      water_meter?: string;
      internet_id?: string;
      gate_code?: string;
      lat?: number;
      lng?: number;
    }
  ): Promise<{ message: string; home: any }> {
    const res = await API.patch(`/facility/homes/${homeId}`, payload);
    return res.data;
  },

  async listEstateServicePayments(estateId?: string, limit = 80): Promise<{ payments: EstateServicePaymentRow[] }> {
    const res = await API.get("/services/estate/payments", {
      params: { estate_id: estateId, limit },
    });
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

  async updateRoom(roomId: string, payload: { name?: string; type?: string; floor?: number | null }) {
    const res = await API.patch(`/facility/rooms/${roomId}`, payload);
    return res.data as { message: string; room: any };
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
    const res = await API.patch(`/facility/devices/${deviceId}/assign`, {
      room_id: roomId,
    });
    return res.data;
  },

  async infrastructureOperations(): Promise<InfrastructureOperations> {
    const res = await API.get("/facility/devices/operations");
    return res.data;
  },

  async assignFacilityDevice(deviceId: string, payload: { home_id?: string | null; room_id?: string | null }) {
    const res = await API.patch(`/facility/devices/${deviceId}/assign`, payload);
    return res.data;
  },

  async syncFacilityTuya() {
    const res = await API.post("/facility/devices/providers/tuya/sync");
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
   * ✅ Facility invites via:
   * POST /facility/homes/:homeId/invite
   * Backend derives estate_id from home record.
   */
  async inviteHomeUser(homeId: string, payload: InviteHomeUserPayload): Promise<InviteHomeUserResponse> {
    const invitedEmail = normalizeEmail(payload.email);
    if (!invitedEmail.includes("@")) throw new Error("Invalid email");

    const res = await API.post(`/facility/homes/${homeId}/invite`, {
      email: invitedEmail,
      full_name: payload.full_name?.trim() || undefined,
      role: mapRoleToMembershipRole(payload.role),
      permissions: payload.permissions || {},
    });

    return res.data as InviteHomeUserResponse;
  },

  async resendHomeInvite(homeId: string, inviteId: string): Promise<ResendHomeInviteResponse> {
    const res = await API.post(`/facility/homes/${homeId}/invites/${inviteId}/resend`);
    return res.data as ResendHomeInviteResponse;
  },

  async revokeHomeInvite(homeId: string, inviteId: string): Promise<{ ok: true; invite: HomeInviteRow }> {
    const res = await API.post(`/facility/homes/${homeId}/invites/${inviteId}/revoke`);
    return res.data;
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
