import { deviceService, type FacilityDevice } from "./deviceService";
import { facilityService } from "./facilityService";
import { maintenanceService, type MaintenanceItem } from "./maintenanceService";
import { notificationService, type AlertItem } from "./notificationService";

export type UtilityDomain = "power" | "water" | "network" | "sensors";

export type UtilitySummary = {
  estateId: string | null;
  domains: Array<{
    key: UtilityDomain;
    title: string;
    devices: number;
    online: number;
    openTickets: number;
    alerts: number;
    state: "live" | "attention" | "waiting";
  }>;
  totals: {
    homes: number;
    activeDevices: number;
    openMaintenance: number;
    alerts: number;
  };
  devices: FacilityDevice[];
  maintenance: MaintenanceItem[];
  alerts: AlertItem[];
};

function textOf(input: unknown) {
  return JSON.stringify(input || "").toLowerCase();
}

function deviceMatches(device: FacilityDevice, words: string[]) {
  const haystack = textOf({
    name: device.name,
    type: device.type,
    category: device.category,
    metadata: device.metadata,
  });
  return words.some((word) => haystack.includes(word));
}

function ticketMatches(ticket: MaintenanceItem, words: string[]) {
  const haystack = textOf(ticket);
  return words.some((word) => haystack.includes(word));
}

function alertMatches(alert: AlertItem, words: string[]) {
  const haystack = textOf(alert);
  return words.some((word) => haystack.includes(word));
}

function isOnline(device: FacilityDevice) {
  return ["active", "online", "healthy", "live"].includes(
    String(device.status || "").toLowerCase()
  );
}

const domains: Array<{ key: UtilityDomain; title: string; words: string[] }> = [
  {
    key: "power",
    title: "Power",
    words: ["power", "energy", "electric", "meter", "inverter", "generator", "solar"],
  },
  {
    key: "water",
    title: "Water",
    words: ["water", "pump", "tank", "leak", "flow"],
  },
  {
    key: "network",
    title: "Network",
    words: ["network", "router", "gateway", "wifi", "edge", "internet", "lan"],
  },
  {
    key: "sensors",
    title: "Sensors",
    words: ["sensor", "occupancy", "smoke", "motion", "climate", "temperature", "humidity"],
  },
];

export const utilityService = {
  async summary(): Promise<UtilitySummary> {
    const [overview, devices, maintenance, alerts] = await Promise.all([
      facilityService.overview().catch(() => null),
      deviceService.list().catch(() => []),
      maintenanceService.list().catch(() => []),
      notificationService.unread().catch(() => []),
    ]);

    return {
      estateId: overview?.estate_id || null,
      domains: domains.map((domain) => {
        const domainDevices = devices.filter((device) => deviceMatches(device, domain.words));
        const openTickets = maintenance.filter((ticket) => ticketMatches(ticket, domain.words)).length;
        const domainAlerts = alerts.filter((alert) => alertMatches(alert, domain.words)).length;
        const online = domainDevices.filter(isOnline).length;
        const needsAttention = openTickets > 0 || domainAlerts > 0 || online < domainDevices.length;

        return {
          key: domain.key,
          title: domain.title,
          devices: domainDevices.length,
          online,
          openTickets,
          alerts: domainAlerts,
          state: domainDevices.length ? (needsAttention ? "attention" : "live") : "waiting",
        };
      }),
      totals: {
        homes: Array.isArray((overview as any)?.homes)
          ? (overview as any).homes.length
          : Number((overview as any)?.homes || (overview as any)?.total_homes || 0),
        activeDevices: Number((overview as any)?.active_devices || devices.filter(isOnline).length),
        openMaintenance: Number((overview as any)?.open_maintenance || maintenance.length),
        alerts: Number((overview as any)?.alerts || alerts.length),
      },
      devices,
      maintenance,
      alerts,
    };
  },
};

export default utilityService;
