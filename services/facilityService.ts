import API from "./api";
import type { FacilityOverview } from "@/types/facility";

/**
 * Facility service
 * Matches backend routes under /facility/*
 */
export const facilityService = {
  // --------------------------------------------------
  // OVERVIEW
  // --------------------------------------------------
  async overview(): Promise<FacilityOverview> {
    const res = await API.get("/facility/overview");
    return res.data;
  },

  // --------------------------------------------------
  // ESTATES
  // --------------------------------------------------

  /**
   * Get estates the current user belongs to
   * GET /facility/estates
   */
  async myEstates(): Promise<{
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
  }> {
    const res = await API.get("/facility/estates");
    return res.data;
  },

  /**
   * Create a new estate
   * POST /facility/estates
   */
  async createEstate(payload: {
    name: string;
    address?: string;
    lat?: number;
    lng?: number;
    type?: string;
  }): Promise<{
    message: string;
    estate: any;
  }> {
    const res = await API.post("/facility/estates", payload);
    return res.data;
  },

  // --------------------------------------------------
  // HOMES
  // --------------------------------------------------

  /**
   * Canonical: List homes in an estate
   * GET /facility/estates/:estateId/homes
   */
  async listEstateHomes(estateId: string): Promise<{
    homes: Array<any>;
  }> {
    const res = await API.get(`/facility/estates/${estateId}/homes`);
    return res.data;
  },

  /**
   * UI alias (DO NOT REMOVE)
   * Keeps existing pages working without refactor
   */
  async listHomes(estateId: string): Promise<{
    homes: Array<any>;
  }> {
    return this.listEstateHomes(estateId);
  },

  /**
   * Create a home under an estate
   * POST /facility/homes
   */
  async createHome(payload: {
    estate_id: string;
    name: string;
    unit?: string;
    block?: string;
    description?: string;
    type?: string;
    resident_id?: string | null;
  }): Promise<{
    message: string;
    home: any;
  }> {
    const res = await API.post("/facility/homes", payload);
    return res.data;
  },
};

export default facilityService;
