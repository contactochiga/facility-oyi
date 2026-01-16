export type FacilityOverview = {
  estate_id: string;
  homes: number;
  active_devices: number;
  open_maintenance: number;
  visitors_today: number;
  alerts: number;
  wallet: {
    balance: number;
    outstanding_dues: number;
    collected_this_month: number;
  };
};
