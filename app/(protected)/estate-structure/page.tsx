"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  ChevronRight,
  Clock3,
  DoorOpen,
  Home,
  Layers3,
  RefreshCw,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { OisMetricCard, OisRegistryHeader, OisRuntimeCard } from "@/components/ois";
import {
  facilityService,
  type EstateStructureResponse,
  type HomeInviteRow,
} from "@/services/facilityService";

function formatDate(value?: string | null) {
  if (!value) return "Unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";
  return date.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function lifecycle(invite: HomeInviteRow) {
  return String(invite.lifecycle_status || invite.status || "pending").toLowerCase();
}

export default function EstateStructurePage() {
  const [data, setData] = useState<EstateStructureResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await facilityService.estateStructure());
    } catch (requestError: any) {
      setError(requestError?.response?.data?.error || requestError?.message || "Unable to load estate structure.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const attention = useMemo(() => {
    const invites = data?.invitations || [];
    return invites
      .filter((invite) => ["pending", "expired", "revoked"].includes(lifecycle(invite)) || invite.delivery_status === "failed")
      .slice(0, 8);
  }, [data]);

  const summary = data?.summary;
  const value = (count?: number) => (loading ? "Loading" : error || !summary ? "Pending source" : String(count || 0));

  return (
    <div className="space-y-6">
      <Topbar
        title="Estate Registry"
        subtitle="Homes, rooms, residents, invitations, and access posture."
        strip={[
          { label: "Estate", value: data?.estate?.name || "Context pending" },
          { label: "Homes", value: loading ? "Loading" : summary?.homes || 0 },
          { label: "Invites", value: loading ? "Loading" : summary?.pending_invitations || 0 },
          { label: "Access issues", value: loading ? "Loading" : summary?.resident_access_issues || 0 },
        ]}
        rightSlot={
          <Button variant="ghost" onClick={() => void load()} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        }
      />

      {error ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {error} <button type="button" onClick={() => void load()} className="ml-2 text-sky-200 hover:text-sky-100">Retry</button>
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <OisMetricCard label="Homes" value={value(summary?.homes)} hint="Total" accent="text-sky-300" />
        <OisMetricCard label="Occupied" value={value(summary?.occupied_homes)} hint="Active members" accent="text-emerald-300" />
        <OisMetricCard label="Vacant" value={value(summary?.vacant_homes)} hint="No active members" accent="text-amber-300" />
        <OisMetricCard label="Invites" value={value(summary?.pending_invitations)} hint="Awaiting activation" accent="text-violet-300" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-[var(--ois-radius-card)] border border-[var(--ois-border-default)] bg-[var(--ois-surface)] p-5 shadow-[var(--ois-elevation-card)]">
          <OisRegistryHeader title="Homes Registry" caption="Pending setup, expired links, delivery failures, and revoked access." action={<Clock3 className="h-4 w-4 text-amber-200" />} />
          <div className="mt-4 space-y-2">
            {attention.map((invite) => (
              <Link
                key={invite.id}
                href={`/homes/${invite.home_id}/users`}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/15 px-3 py-3 transition hover:border-sky-400/25"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-200" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-zinc-100">{invite.invited_email || "Resident invitation"}</span>
                  <span className="mt-1 block text-xs text-zinc-500">
                    {lifecycle(invite)} · {invite.delivery_status || "delivery pending"} · {formatDate(invite.expires_at)}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 text-zinc-600" />
              </Link>
            ))}
            {!attention.length && !loading ? (
              <p className="rounded-xl border border-dashed border-white/10 bg-black/15 px-3 py-3 text-sm text-zinc-500">
                No invitation issues require attention.
              </p>
            ) : null}
            {loading ? <p className="text-sm text-zinc-500">Loading invitation posture…</p> : null}
          </div>
        </div>

        <div className="rounded-[var(--ois-radius-card)] border border-[var(--ois-border-default)] bg-[var(--ois-surface)] p-5 shadow-[var(--ois-elevation-card)]">
          <OisRegistryHeader title="Registry Actions" />
          <div className="mt-4 grid gap-2">
            {[
              ["Add Home", "/homes?action=create", Home],
              ["Invite Resident", "/homes?view=access", UserPlus],
              ["Open Home Registry", "/homes", Building2],
              ["Review Pending Invites", "/homes?view=access", DoorOpen],
              ["Open Room Registry", "/homes?view=rooms", Layers3],
              ["View Occupancy", "/occupancy", Users],
            ].map(([label, href, Icon]) => (
              <Link key={String(label)} href={String(href)} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-sm text-zinc-300 transition hover:border-sky-400/25 hover:text-white">
                <Icon className="h-4 w-4 text-sky-200" />
                <span className="flex-1">{String(label)}</span>
                <ChevronRight className="h-4 w-4 text-zinc-600" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <OisRuntimeCard
        title="Runtime Insights"
        items={[
          { label: "Occupancy rate", value: summary?.homes ? `${Math.round(((summary?.occupied_homes || 0) / Math.max(summary.homes, 1)) * 100)}%` : "—", delta: "vs active registry" },
          { label: "Access issues", value: value(summary?.resident_access_issues), delta: "expired or failed" },
        ]}
        chart={<div className="h-20 rounded-[var(--ois-radius-row)] bg-[linear-gradient(180deg,rgba(34,197,94,0.16),rgba(15,20,27,0.18))]" />}
      />
    </div>
  );
}
