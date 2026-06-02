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

function Metric({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  hint: string;
  tone?: "neutral" | "good" | "warn";
}) {
  const style =
    tone === "good"
      ? "border-emerald-500/20 bg-emerald-500/[0.07]"
      : tone === "warn"
      ? "border-amber-500/20 bg-amber-500/[0.07]"
      : "border-white/10 bg-white/[0.035]";
  return (
    <div className={`rounded-2xl border p-4 ${style}`}>
      <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-2 text-xs leading-5 text-zinc-500">{hint}</p>
    </div>
  );
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
        title="Estate Structure"
        subtitle="Homes, rooms, residents, invitations, and access posture."
        rightSlot={
          <Button variant="ghost" onClick={() => void load()} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        }
      />

      <section className="rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.11),transparent_35%),linear-gradient(145deg,rgba(255,255,255,0.05),rgba(255,255,255,0.018))] p-5">
        <p className="text-[10px] uppercase tracking-[0.18em] text-sky-200/80">Estate operations context</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">{data?.estate?.name || "Estate context"}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
          Review residential capacity, activation gaps, room readiness, and access lifecycle issues without leaving the estate context.
        </p>
      </section>

      {error ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {error} <button type="button" onClick={() => void load()} className="ml-2 text-sky-200 hover:text-sky-100">Retry</button>
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Homes" value={value(summary?.homes)} hint="Registered homes and units" />
        <Metric label="Occupied" value={value(summary?.occupied_homes)} hint="Homes with active members" tone="good" />
        <Metric label="Vacant" value={value(summary?.vacant_homes)} hint="Homes without active or invited members" />
        <Metric label="Pending invitations" value={value(summary?.pending_invitations)} hint="Residents awaiting activation" tone={summary?.pending_invitations ? "warn" : "neutral"} />
        <Metric label="Expired invitations" value={value(summary?.expired_invitations)} hint="Links requiring operator review" tone={summary?.expired_invitations ? "warn" : "neutral"} />
        <Metric label="Active residents" value={value(summary?.active_residents)} hint="Distinct active residents" />
        <Metric label="Rooms configured" value={value(summary?.rooms_configured)} hint="Spaces reflected in Consumer OS" />
        <Metric label="Access issues" value={value(summary?.resident_access_issues)} hint="Expired links, failed deliveries, or suspensions" tone={summary?.resident_access_issues ? "warn" : "neutral"} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Invitation Attention Lane</h2>
              <p className="mt-1 text-xs leading-5 text-zinc-500">Pending setup, expired links, delivery failures, and revoked access.</p>
            </div>
            <Clock3 className="h-4 w-4 text-amber-200" />
          </div>
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

        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <h2 className="text-sm font-semibold text-white">Quick Actions</h2>
          <div className="mt-4 grid gap-2">
            {[
              ["Add Home", "/homes?action=create", Home],
              ["Invite Resident", "/homes?view=access", UserPlus],
              ["Manage Homes", "/homes", Building2],
              ["Review Pending Invites", "/homes?view=access", DoorOpen],
              ["Manage Rooms", "/homes?view=rooms", Layers3],
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

      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Access Posture</h2>
            <p className="mt-1 text-xs leading-5 text-zinc-500">Membership signals derived from active estate homes.</p>
          </div>
          <UserCheck className="h-4 w-4 text-emerald-200" />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Pending activation homes" value={value(summary?.pending_activation_homes)} hint="Homes awaiting first resident activation" />
          <Metric label="Suspended residents" value={value(summary?.suspended_residents)} hint="Residents with paused home access" />
          <Metric label="Homes without residents" value={value(summary?.homes_without_residents)} hint="Homes requiring resident assignment" />
          <Metric label="Multiple members" value={value(summary?.homes_with_multiple_members)} hint="Homes with shared active access" />
        </div>
      </section>
    </div>
  );
}
