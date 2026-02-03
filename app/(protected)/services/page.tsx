// app/(protected)/services/page.tsx
"use client";

import Topbar from "@/components/shell/Topbar";

type ServiceCardProps = {
  title: string;
  desc: string;
  status?: "live" | "soon";
};

function ServiceCard({ title, desc, status = "soon" }: ServiceCardProps) {
  const badge =
    status === "live"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
      : "border-white/10 bg-white/5 text-zinc-300";

  return (
    <div className="glass border border-white/10 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white truncate">
            {title}
          </div>
          <div className="mt-1 text-xs text-zinc-400 leading-relaxed">
            {desc}
          </div>
        </div>

        <span className={`shrink-0 text-[11px] px-2 py-1 rounded-full border ${badge}`}>
          {status === "live" ? "Live" : "Soon"}
        </span>
      </div>
    </div>
  );
}

export default function FacilityServicesPage() {
  return (
    <div className="space-y-7">
      <Topbar
        title="Facility Services"
        subtitle="Estate payments • utilities • billing operations"
      />

      {/* Head strip (keeps your system clean + non-demo) */}
      <div className="glass border border-white/10 rounded-2xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-white">
              Services Control Plane
            </div>
            <div className="text-xs text-zinc-400 mt-1 max-w-2xl">
              This page will host estate-grade payments and utility operations.
              Residents pay from their wallets; facility enforces billing rules,
              sends reminders, and runs deductions (service charge, utilities, etc.).
            </div>
          </div>

          <div className="text-xs text-zinc-500">
            Status: <span className="text-zinc-200">Wiring in progress</span>
          </div>
        </div>
      </div>

      {/* Services grid */}
      <div className="grid gap-4 lg:gap-5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        <ServiceCard
          title="Electricity Tokens"
          desc="Buy tokens and track consumption. Facility can push tariffs, validate payments, and reconcile token issuance."
          status="soon"
        />
        <ServiceCard
          title="Water Billing"
          desc="Pay water bills, track usage, and manage arrears. Facility can set cycles and auto-reminders."
          status="soon"
        />
        <ServiceCard
          title="Fiber / Internet Subscriptions"
          desc="Handle estate ISP plans and renewals. Facility can manage packages, expiries, and service activation signals."
          status="soon"
        />
        <ServiceCard
          title="Waste & Sanitation"
          desc="Recurring waste fees with automatic deductions (optional). Facility can enforce compliance by unit."
          status="soon"
        />
        <ServiceCard
          title="Service Charge"
          desc="Monthly/quarterly service charge invoicing, reminders, and deductions from wallet (if enabled)."
          status="soon"
        />
        <ServiceCard
          title="Outstanding Bills"
          desc="Unified view of all unpaid items per unit. Facility can broadcast due notices and track resolution."
          status="soon"
        />
      </div>

      {/* Next actions (non-demo, real ops) */}
      <div className="glass border border-white/10 rounded-2xl p-5">
        <div className="text-sm font-medium text-white">Next wiring</div>
        <div className="mt-2 grid gap-2 text-xs text-zinc-400">
          <div>• Wallet ↔ Services: link resident wallet balance and transactions into facility context.</div>
          <div>• Billing engine: create dues (service charge, utilities), track paid/unpaid, push notifications.</div>
          <div>• Signals: emit wallet.funded / wallet.debited + service.purchase events for audit + analytics.</div>
        </div>
      </div>
    </div>
  );
}
