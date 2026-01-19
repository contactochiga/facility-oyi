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
// DEVICES (DISCOVERY)
// ---------------------------
export type DiscoveredDevice = {
  // Tuya / adapters can vary — keep flexible
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
  [key: string]: any;
};

export type DiscoverDevicesResponse = {
  adapter: string;
  count: number;
  devices: DiscoveredDevice[];
};

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
  async listEstateHomes(estateId: string): Promise<HomesResponse> {
    const res = await API.get(`/facility/estates/${estateId}/homes`);
    return res.data;
  },

  // ✅ Alias used in app/(protected)/homes/page.tsx
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

    // optional fields (your table supports them)
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
  // ✅ Used by app/(protected)/homes/page.tsx
  async listRooms(homeId: string): Promise<RoomsResponse> {
    const res = await API.get(`/facility/homes/${homeId}/rooms`);
    return res.data;
  },

  // ---------------------------
  // DEVICES (DISCOVERY)
  // ---------------------------
  async discoverDevices(adapter: "tuya" = "tuya"): Promise<DiscoverDevicesResponse> {
    const res = await API.get(`/facility/devices/discover?adapter=${adapter}`);
    return res.data;
  },
};

export default facilityService;
