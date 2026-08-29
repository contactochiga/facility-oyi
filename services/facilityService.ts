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
    timezone?: string | null;
    contact_email?: string | null;
    contact_phone?: string | null;
    created_at?: string;
    membership_role?: string;
    membership_status?: string;
  }>;
};

export type UpdateEstateProfilePayload = {
  name?: string;
  type?: string;
  address?: string;
  lat?: number;
  lng?: number;
  timezone?: string;
  contact_email?: string;
  contact_phone?: string;
};

export type HomesResponse<T = any> = {
  homes: T[];
  buildings?: EstateBuildingRow[];
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

export type InfrastructureServiceAccountRow = {
  id: string;
  estate_id: string;
  home_id: string;
  service_key: string;
  service_title: string;
  service_group: string;
  provider_type?: string | null;
  provider?: string | null;
  identifier?: string | null;
  meter_number?: string | null;
  account_number?: string | null;
  tariff_profile?: string | null;
  billing_profile?: string | null;
  kct?: string | null;
  kctn?: string | null;
  status?: string | null;
  linked?: boolean;
  plan?: string | null;
  balance?: number | null;
  outstanding?: number | null;
  wallet_id?: string | null;
  wallet_linked?: boolean;
  resident_id?: string | null;
  resident_name?: string | null;
  resident_email?: string | null;
  home_label?: string | null;
  vending_readiness?: string | null;
  provider_health?: string | null;
  provider_supported?: boolean;
  provider_health_reason?: string | null;
  last_activity_at?: string | null;
  last_transaction_status?: string | null;
  last_transaction_type?: string | null;
  metadata?: Record<string, any>;
};

export type InfrastructureServiceTransactionRow = {
  id: string;
  estate_id?: string | null;
  home_id?: string | null;
  resident_id?: string | null;
  service_key: string;
  service_type?: string | null;
  provider?: string | null;
  amount?: number | null;
  currency?: string | null;
  status?: string | null;
  transaction_type?: string | null;
  settlement_status?: string | null;
  provider_reference?: string | null;
  metadata?: Record<string, any>;
  created_at?: string | null;
};

export type InfrastructureServiceEventRow = {
  id: string;
  event_type: string;
  estate_id?: string | null;
  home_id?: string | null;
  service_key?: string | null;
  user_id?: string | null;
  actor_id?: string | null;
  payload?: Record<string, any>;
  created_at?: string | null;
};

export type RoomsResponse<T = any> = {
  rooms: T[];
};

export type EstateStructureSummary = {
  buildings?: number;
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
  buildings?: EstateBuildingRow[];
  homes: any[];
  invitations: HomeInviteRow[];
  summary: EstateStructureSummary;
  sources: Record<string, string>;
};

export type EstateBuildingRow = {
  id: string;
  estate_id: string;
  building_ref: string;
  name: string;
  block?: string | null;
  floors?: number | null;
  unit_count?: number | null;
  building_type?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
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

export type InfrastructureDiscoveryClassification = "compatible" | "needs_adapter" | "needs_edge" | "needs_credentials" | "unsupported" | "unknown";

export type InfrastructureOnboardingProvider = {
  key: string;
  label: string;
  adapter_key?: string | null;
  implementation: "active" | "manual_import" | "adapter_required" | "future";
  discovery_mode: "cloud" | "local_network" | "edge" | "manual";
  authentication_methods: string[];
  object_types: string[];
  protocols: string[];
  requires_edge: boolean;
  supports_discovery: boolean;
  supports_import: boolean;
  supports_verification: boolean;
  adapter_registered?: boolean;
  readiness: InfrastructureDiscoveryClassification | "ready";
  connection?: {
    id: string;
    authentication_method: string;
    authentication_status: string;
    credential_ref_present: boolean;
    last_verified_at?: string | null;
    last_error_code?: string | null;
  } | null;
  notes?: string;
};

export type InfrastructureOnboardingCandidate = {
  id: string;
  session_id: string;
  provider_key: string;
  adapter_key: string;
  external_id?: string | null;
  candidate_type: string;
  name: string;
  category?: string | null;
  classification: InfrastructureDiscoveryClassification;
  classification_reason?: string | null;
  discovery_status: "discovered" | "classified" | "imported" | "verifying" | "verified" | "verification_failed" | "promoted" | "rejected" | string;
  online?: boolean | null;
  capabilities: string[];
  protocols: string[];
  proposed_home_id?: string | null;
  proposed_room_id?: string | null;
  duplicate_target_type?: string | null;
  duplicate_target_id?: string | null;
  promoted_target_type?: string | null;
  promoted_target_id?: string | null;
  provider_metadata?: Record<string, any>;
  discovered_at?: string | null;
  verified_at?: string | null;
  promoted_at?: string | null;
};

export type InfrastructureOnboardingSession = {
  id: string;
  onboarding_ref: string;
  estate_id: string;
  building_id?: string | null;
  home_id?: string | null;
  partner_id?: string | null;
  installer_id?: string | null;
  status: string;
  version: number;
  notes?: string | null;
  summary?: {
    total?: number;
    classifications?: Record<string, number>;
    statuses?: Record<string, number>;
    providers?: string[];
  };
  metadata?: Record<string, any>;
  started_at?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type InfrastructureOnboardingDetail = {
  session: InfrastructureOnboardingSession;
  candidates: InfrastructureOnboardingCandidate[];
  verifications: Array<Record<string, any>>;
  events: Array<Record<string, any>>;
  connections: Array<Record<string, any>>;
};

export type InfrastructureOnboardingOverview = {
  estate_id: string;
  sessions: InfrastructureOnboardingSession[];
  latest: InfrastructureOnboardingDetail | null;
  partners: Array<Record<string, any>>;
  providers: InfrastructureOnboardingProvider[];
  connections: Array<Record<string, any>>;
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
// ESTATE TEAM INVITES (Phase 2)
// ---------------------------
export type EstateInviteRow = {
  id: string;
  invited_email: string;
  role: string;
  status: string;
  expires_at: string;
  created_at: string;
  claimed_at?: string | null;
  revoked_at?: string | null;
  last_sent_at?: string | null;
};

export type ListEstateInvitesResponse = {
  estate_id: string;
  invites: EstateInviteRow[];
};

export type CreateEstateInvitePayload = {
  email: string;
  role: string;
};

export type CreateEstateInviteResponse = {
  invite: EstateInviteRow;
  email_delivered: boolean;
  invite_url?: string;
};

// ---------------------------
// AUDIT (Phase 2, tenant-scoped)
// ---------------------------
export type EstateAuditEvent = {
  id: string;
  occurred_at: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  actor_id: string | null;
  actor_role: string | null;
  status: string;
  metadata: Record<string, unknown>;
};

export type EstateAuditLogResponse = {
  ok: true;
  estate_id: string;
  events: EstateAuditEvent[];
};

// ---------------------------
// AUTOMATION (Phase 3, Milestone 1)
// ---------------------------
export type AutomationExecutionLevel = "observe" | "recommend" | "approval_required" | "auto_allowed" | "manual_only" | "unsupported";

export type AutomationActionPolicy = {
  actionId: string;
  executionLevel: AutomationExecutionLevel;
  requiredPermission: string | null;
  reason: string;
};

export type AutomationPolicyResponse = {
  estate_id: string;
  policy: AutomationActionPolicy[];
};

export type AutomationApprovalStatus =
  | "pending_approval" | "approved" | "rejected" | "expired" | "cancelled"
  | "executing" | "succeeded" | "failed" | "verification_failed";

export type AutomationApproval = {
  id: string;
  estate_id: string;
  detector_id: string;
  action_id: string;
  entity_type: string;
  // Cross-Domain Operational Automation -- notification.notify (the one
  // new registered action this pass adds) addresses a role/user/home/
  // estate, not a single existing row, so it carries no entity_id.
  // automation_approvals.entity_id is now nullable at the DB level for
  // exactly this case.
  entity_id: string | null;
  target_label: string | null;
  reason: string;
  evidence: Array<Record<string, unknown>>;
  plan_snapshot: Record<string, unknown>;
  status: AutomationApprovalStatus;
  requested_by: string;
  approver_id: string | null;
  approver_role: string | null;
  decision_note: string | null;
  execution_id: string | null;
  verification: { state: string; summary: string; metadata: Record<string, unknown> } | null;
  expires_at: string;
  created_at: string;
  decided_at: string | null;
  executed_at: string | null;
};

export type AutomationApprovalsResponse = {
  estate_id: string;
  approvals: AutomationApproval[];
};

// ---------------------------
// AUTOMATION CAPABILITY REGISTRY (Cross-Domain Operational Automation)
// Read-only projection of Backend's real EXECUTION_REGISTRY +
// automationPolicyResolver -- what Create Automation is generated from,
// not a second, independently-maintained domain list.
// ---------------------------
export type AutomationCapabilityAction = {
  id: string;
  domain: string;
  label: string;
  target_type: "device" | "visitor_access" | "maintenance_request" | "notification_target" | "none";
  requires_assignee: boolean;
  available: boolean;
  execution_level: AutomationExecutionLevel;
  required_permission: string | null;
  reason: string | null;
};

export type AutomationCapabilityDomain = {
  domain: string;
  label: string;
  actions: AutomationCapabilityAction[];
};

export type AutomationCapabilitiesResponse = {
  estate_id: string;
  triggers: Array<{ type: "schedule"; label: string; schedule_types: string[] }>;
  domains: AutomationCapabilityDomain[];
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
  normalized_state?: Record<string, any> | null;
  supported_controls?: string[];
  control_profile?: string | null;
  health_status?: string | null;
  provider_health?: string | null;
  primary_state?: string | null;
  telemetry_summary?: Record<string, any> | null;
  activity_summary?: string | null;
  last_signal?: string | null;
  device_family?: string | null;
  device_type?: string | null;
  ownership_class?: string | null;
  assignment_scope?: string | null;
  commissioning_status?: string | null;
  projection?: {
    surface?: string;
    visible?: boolean;
    controllable?: boolean;
    ownership_class?: string;
    assignment_scope?: string;
    provider_connection_id?: string | null;
  } | null;
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

export type PlatformTwinResponse = {
  estate_id: string | null;
  models: any[];
  placements: any[];
  sources: Record<string, any>;
};

export type PlatformListResponse<T = any> = {
  estate_id?: string | null;
  items: T[];
  sources?: Record<string, any>;
  history?: any[];
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

  async listBuildings(estateId: string): Promise<{ buildings: EstateBuildingRow[] }> {
    const res = await API.get(`/facility/estates/${estateId}/buildings`);
    return res.data;
  },

  async createBuilding(payload: {
    estate_id: string;
    name: string;
    building_ref?: string;
    block?: string;
    floors?: number;
    unit_count?: number;
    building_type?: string;
  }): Promise<{ message: string; building: EstateBuildingRow }> {
    const res = await API.post("/facility/buildings", payload);
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
    building_id?: string;
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
    service_bindings?: Record<string, any>;
  }): Promise<{ message: string; home: any }> {
    const res = await API.post("/facility/homes", payload);
    return res.data;
  },

  async updateHome(
    homeId: string,
    payload: {
      name?: string;
      building_id?: string | null;
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
      service_bindings?: Record<string, any>;
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

  async listInfrastructureServiceAccounts(params?: {
    estate_id?: string;
    home_id?: string;
    resident_id?: string;
  }): Promise<{ accounts: InfrastructureServiceAccountRow[]; summary?: Record<string, any> }> {
    const res = await API.get("/services/accounts", { params });
    return res.data;
  },

  async listInfrastructureServiceTransactions(estateId?: string, limit = 80): Promise<{ transactions: InfrastructureServiceTransactionRow[]; summary?: Record<string, number> }> {
    const res = await API.get("/services/estate/transactions", {
      params: { estate_id: estateId, limit },
    });
    return res.data;
  },

  async listInfrastructureServiceEvents(estateId?: string, limit = 80): Promise<{ events: InfrastructureServiceEventRow[] }> {
    const res = await API.get("/services/events", {
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

  async infrastructureOnboardingOverview(): Promise<InfrastructureOnboardingOverview> {
    const res = await API.get("/facility/infrastructure/onboarding/history");
    return res.data;
  },

  async infrastructureOnboardingProviders(): Promise<{ providers: InfrastructureOnboardingProvider[] }> {
    const res = await API.get("/facility/infrastructure/onboarding/providers");
    return res.data;
  },

  async startInfrastructureOnboarding(payload: {
    home_id?: string | null;
    building_id?: string | null;
    partner_id?: string | null;
    installer_id?: string | null;
    notes?: string | null;
    property_type?: string | null;
    onboarding_type?: string | null;
  } = {}): Promise<{ session: InfrastructureOnboardingSession }> {
    const res = await API.post("/facility/infrastructure/onboarding/sessions", payload);
    return res.data;
  },

  async getInfrastructureOnboardingSession(sessionId: string): Promise<InfrastructureOnboardingDetail> {
    const res = await API.get(`/facility/infrastructure/onboarding/sessions/${encodeURIComponent(sessionId)}`);
    return res.data;
  },

  async authenticateInfrastructureProvider(sessionId: string, providerKey: string, payload: Record<string, any> = {}) {
    const res = await API.post(`/facility/infrastructure/onboarding/sessions/${encodeURIComponent(sessionId)}/providers/${encodeURIComponent(providerKey)}/authenticate`, payload);
    return res.data as { connection: Record<string, any> };
  },

  async discoverInfrastructure(sessionId: string, payload: {
    providers?: string[];
    provider_credentials?: Record<string, Record<string, any>>;
    allow_local_scan?: boolean;
  }): Promise<{ session: InfrastructureOnboardingSession; candidates: InfrastructureOnboardingCandidate[]; provider_results: Array<Record<string, any>> }> {
    const res = await API.post(`/facility/infrastructure/onboarding/sessions/${encodeURIComponent(sessionId)}/discover`, payload);
    return res.data;
  },

  async importInfrastructureCandidates(sessionId: string, payload: {
    candidate_ids?: string[];
    mappings?: Record<string, { home_id?: string | null; room_id?: string | null; zone_id?: string | null; metadata?: Record<string, any> }>;
  }) {
    const res = await API.post(`/facility/infrastructure/onboarding/sessions/${encodeURIComponent(sessionId)}/import`, payload);
    return res.data as { session: InfrastructureOnboardingSession; candidates: InfrastructureOnboardingCandidate[] };
  },

  async verifyInfrastructureCandidates(sessionId: string, payload: { candidate_ids?: string[]; live_read?: boolean }) {
    const res = await API.post(`/facility/infrastructure/onboarding/sessions/${encodeURIComponent(sessionId)}/verify`, payload);
    return res.data as { session: InfrastructureOnboardingSession; verifications: Array<Record<string, any>> };
  },

  async promoteInfrastructureCandidates(sessionId: string, payload: { candidate_ids?: string[] }) {
    const res = await API.post(`/facility/infrastructure/onboarding/sessions/${encodeURIComponent(sessionId)}/promote`, payload);
    return res.data as { session: InfrastructureOnboardingSession; promoted: InfrastructureOnboardingCandidate[]; failures: Array<Record<string, any>> };
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

  async platformTwin(): Promise<PlatformTwinResponse> {
    const res = await API.get("/facility/platform/twin");
    return res.data;
  },

  async platformUtilityTelemetry(): Promise<PlatformListResponse> {
    const res = await API.get("/facility/platform/utility-telemetry");
    return res.data;
  },

  async platformEdgeHistory(): Promise<PlatformListResponse> {
    const res = await API.get("/facility/platform/edge/history");
    return res.data;
  },

  async platformIncidents(): Promise<PlatformListResponse> {
    const res = await API.get("/facility/platform/incidents");
    return res.data;
  },

  async updatePlatformIncident(incidentId: string, payload: Record<string, unknown>): Promise<any> {
    const res = await API.patch(`/facility/platform/incidents/${incidentId}`, payload);
    return res.data;
  },

  async platformIncidentTimeline(incidentId: string): Promise<PlatformListResponse> {
    const res = await API.get(`/facility/platform/incidents/${incidentId}/timeline`);
    return res.data;
  },

  async platformHandover(): Promise<{ summary?: Record<string, number>; items?: any[]; handover_date?: string }> {
    const res = await API.get("/facility/platform/handover");
    return res.data;
  },

  async platformHandovers(): Promise<{ items?: any[] }> {
    const res = await API.get("/facility/platform/handovers");
    return res.data;
  },

  async createPlatformHandover(payload: { summary: string; open_items: any[]; handover_items: any[] }): Promise<any> {
    const res = await API.post("/facility/platform/handovers", payload);
    return res.data;
  },

  async platformCameraInfrastructure(): Promise<PlatformListResponse> {
    const res = await API.get("/facility/platform/camera-infrastructure");
    return res.data;
  },

  async platformRealtimeAudit(): Promise<{ domains: any[] }> {
    const res = await API.get("/facility/platform/realtime-audit");
    return res.data;
  },

  async platformDeploymentReadiness(): Promise<{ checks: any[] }> {
    const res = await API.get("/facility/platform/deployment-readiness");
    return res.data;
  },

  async intelligenceWorkflows(status?: string): Promise<{ workflows?: any[]; summary?: Record<string, number> }> {
    const res = await API.get("/intelligence/workflows", { params: status ? { status } : undefined });
    return res.data;
  },

  async intelligenceWorkflow(workflowId: string): Promise<any> {
    const res = await API.get(`/intelligence/workflows/${encodeURIComponent(workflowId)}`);
    return res.data;
  },

  async intelligencePredictions(): Promise<{ predictions?: any[] }> {
    const res = await API.get("/intelligence/predictions", { params: { status: "open", limit: 50 } });
    return res.data;
  },

  async acknowledgePrediction(predictionId: string): Promise<any> {
    const res = await API.post(`/intelligence/predictions/${encodeURIComponent(predictionId)}/ack`);
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
  // ESTATE TEAM INVITES (Phase 2)
  // ---------------------------
  async listEstateInvites(): Promise<ListEstateInvitesResponse> {
    const res = await API.get("/facility/estate-invites");
    return res.data;
  },

  async createEstateInvite(payload: CreateEstateInvitePayload): Promise<CreateEstateInviteResponse> {
    const res = await API.post("/facility/estate-invites", {
      email: normalizeEmail(payload.email),
      role: payload.role,
    });
    return res.data;
  },

  async revokeEstateInvite(inviteId: string) {
    const res = await API.post(`/facility/estate-invites/${inviteId}/revoke`);
    return res.data;
  },

  async resendEstateInvite(inviteId: string) {
    const res = await API.post(`/facility/estate-invites/${inviteId}/resend`);
    return res.data;
  },

  // ---------------------------
  // FACILITY PROFILE (Phase 2)
  // ---------------------------
  async updateEstateProfile(estateId: string, payload: UpdateEstateProfilePayload) {
    const res = await API.patch(`/facility/estates/${estateId}`, payload);
    return res.data;
  },

  // ---------------------------
  // AUDIT (Phase 2, tenant-scoped)
  // ---------------------------
  async auditEvents(params?: { limit?: number; before?: string; action?: string }): Promise<EstateAuditLogResponse> {
    const res = await API.get("/facility/audit-events", { params });
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

  // ---------------------------
  // AUTOMATION (Phase 3, Milestone 1)
  // ---------------------------
  async automationPolicy(): Promise<AutomationPolicyResponse> {
    const res = await API.get("/facility/automation/policy");
    return res.data;
  },

  async automationCapabilities(): Promise<AutomationCapabilitiesResponse> {
    const res = await API.get("/facility/automation/capabilities");
    return res.data;
  },

  async automationApprovals(status?: string): Promise<AutomationApprovalsResponse> {
    const res = await API.get("/facility/automation/approvals", { params: status ? { status } : undefined });
    return res.data;
  },

  async approveAutomation(approvalId: string, note?: string): Promise<{ approval: AutomationApproval }> {
    const res = await API.post(`/facility/automation/approvals/${approvalId}/approve`, note ? { note } : {});
    return res.data;
  },

  async rejectAutomation(approvalId: string, note?: string): Promise<{ approval: AutomationApproval }> {
    const res = await API.post(`/facility/automation/approvals/${approvalId}/reject`, note ? { note } : {});
    return res.data;
  },
};

export default facilityService;
