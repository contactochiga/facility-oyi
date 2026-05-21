"use client";

import { useEffect, useMemo, useState } from "react";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { facilityService } from "@/services/facilityService";
import { Activity, Building2, Droplets, PlugZap, RadioTower, RefreshCw, Router, ShieldCheck, Wallet } from "lucide-react";

type ServiceHealth = {
  key: string;
  title: string;
  description: string;
  icon: any;
  status: "operational" | "watch" | "pending";
};

const SERVICE_HEALTH: ServiceHealth[] = [
  {
    key: "power",
    title: "Power Systems",
    description: "Meters, inverter/UPS, generator links, outages and estate power telemetry.",
    icon: PlugZap,
    status: "operational",
  },
  {
    key: "water",
    title: "Water Systems",
    description: "Water meters, tank levels, pumps, leaks and maintenance-linked water events.",
    icon: Droplets,
    status: "operational",
  },
  {
    key: "network",
    title: "Network & Internet",
    description: "Resident internet IDs, access equipment, gateway health and connectivity signals.",
    icon: Router,
    status: "watch",
  },
  {
    key: "access",
    title: "Security Access",
    description: "Gate, visitor, camera and access-control services tied to estate operations.",
    icon: ShieldCheck,
    status: "operational",
  },
  {
    key: "edge",
    title: "Edge Infrastructure",
    description: "Local agents, telemetry sync, heartbeat state and site-level command readiness.",
    icon: RadioTower,
    status: "pending",
  },
];

function statusClass(status: ServiceHealth["status"]) {
  if (status === "operational") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
  if (status === "watch") return "border-amber-500/20 bg-amber-500/10 text-amber-200";
  return "border-white/10 bg-white/5 text-zinc-300";
}

function formatMoney(amount: number, currency = "NGN") {
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Number(amount || 0));
  } catch {
    return `${currency} ${Number(amount || 0).toLocaleString()}`;
  }
}

export default function FacilityServicesPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [overview, setOverview] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const overviewRes = await facilityService
        .overview()
        .catch((error) => ({ error: error?.message || "Failed to load overview" }));
      const estateId = String((overviewRes as any)?.estate?.id || (overviewRes as any)?.estate_id || "").trim();
      const paymentsRes = estateId
        ? await facilityService.listEstateServicePayments(estateId, 8).catch(() => ({ payments: [] }))
        : { payments: [] };
      if ((overviewRes as any)?.error) setErr(String((overviewRes as any).error));
      setOverview(overviewRes || null);
      setPayments(Array.isArray((paymentsRes as any)?.payments) ? (paymentsRes as any).payments : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const stats = useMemo(() => {
    const wallet = overview?.wallet || {};
    const homes = Array.isArray(overview?.homes) ? overview.homes : [];
    const devices = Array.isArray(overview?.devices) ? overview.devices : [];
    const activeDevices = devices.filter((device: any) => /online|active|operational/i.test(String(device.status || ""))).length;
    return [
      { label: "Estate Wallet", value: formatMoney(Number(wallet.balance || 0)), hint: "Available estate balance", icon: Wallet },
      { label: "Outstanding", value: formatMoney(Number(wallet.outstanding_dues || 0)), hint: "Service dues signal", icon: Activity },
      { label: "Homes Linked", value: String(homes.length || overview?.total_homes || 0), hint: "Units with service context", icon: Building2 },
      { label: "Active Devices", value: String(activeDevices || overview?.active_devices || 0), hint: "Operational utility/device signal", icon: PlugZap },
    ];
  }, [overview]);

  return (
    <div className="space-y-7">
      <Topbar title="Service Operations" subtitle="Utility availability • estate service readiness • live operational signals" />

      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
        Service Operations is now operational-only: utilities, readiness, live estate signals, recent service activity and infrastructure health.
      </div>

      {err ? <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</div> : null}

      <div className="grid gap-4 md:grid-cols-4">
        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="glass rounded-2xl border border-white/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-zinc-400">{item.label}</div>
                <Icon size={18} className="text-blue-300" />
              </div>
              <div className="mt-2 text-2xl font-semibold text-white">{loading ? "..." : item.value}</div>
              <div className="mt-1 text-[11px] text-zinc-500">{item.hint}</div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <section className="glass rounded-2xl border border-white/10 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-white">Infrastructure Service Registry</div>
              <div className="mt-1 text-xs text-zinc-400">Estate-scoped utility and service domains powered by the live Facility API.</div>
            </div>
            <Button variant="ghost" onClick={() => load()} disabled={loading}>
              <span className="inline-flex items-center gap-2"><RefreshCw size={14} />Refresh</span>
            </Button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {SERVICE_HEALTH.map((service) => {
              const Icon = service.icon;
              return (
                <article key={service.key} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-blue-200">
                        <Icon size={18} />
                      </span>
                      <div>
                        <div className="text-sm font-semibold text-white">{service.title}</div>
                        <div className="mt-1 text-xs text-zinc-400">{service.description}</div>
                      </div>
                    </div>
                    <span className={`rounded-full border px-2 py-1 text-[11px] ${statusClass(service.status)}`}>{service.status}</span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="glass rounded-2xl border border-white/10 p-4">
            <div className="text-sm font-semibold text-white">Recent Service Signals</div>
            <div className="mt-3 space-y-2 max-h-80 overflow-auto">
              {payments.slice(0, 8).map((payment: any, index) => (
                <div key={payment.id || index} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm text-white">{payment.service_title || payment.type || "Service activity"}</div>
                    <span className="text-[11px] text-zinc-500">{payment.status || "recorded"}</span>
                  </div>
                  <div className="mt-1 text-xs text-zinc-400">{payment.home_label || payment.home_id || "Estate service"}</div>
                </div>
              ))}
              {!payments.length ? <div className="text-xs text-zinc-500">No service activity has synced yet.</div> : null}
            </div>
          </div>

          <div className="glass rounded-2xl border border-white/10 p-4">
            <div className="text-sm font-semibold text-white">Production Rule</div>
            <div className="mt-2 text-xs leading-6 text-zinc-400">
              Services remain operational-first. Commercial controls stay outside this surface until the infrastructure runtime, audit coverage and live estate data are fully verified.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
