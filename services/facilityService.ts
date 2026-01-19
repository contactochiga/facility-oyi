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

export type HomesResponse = {
  homes: any[];
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

  // ✅ Alias your UI is calling
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
  }): Promise<{ message: string; home: any }> {
    const res = await API.post("/facility/homes", payload);
    return res.data;
  },
};

export default facilityService;
