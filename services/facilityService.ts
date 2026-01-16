import API from "./api";
import type { FacilityOverview } from "@/types/facility";

export const facilityService = {
  async overview(): Promise<FacilityOverview> {
    const res = await API.get("/facility/overview");
    return res.data;
  },
};
