"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  ChevronRight,
  DoorOpen,
  Home,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import Topbar from "@/components/shell/Topbar";
import { facilityService, type EstateStructureResponse } from "@/services/facilityService";

function tone(status?: string) {
  if (status === "occupied") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
  if (status === "pending_activation") return "border-amber-500/20 bg-amber-500/10 text-amber-200";
  return "border-white/10 bg-white/5 text-zinc-300";
}

export default function OccupancyPage() {
  const [data, setData] = useState<EstateStructureResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await facilityService.estateStructure());
    } catch (requestError: any) {
      setError(requestError?.response?.data?.error || requestError?.message || "Unable to load occupancy.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = data?.summary;
  const homes = data?.homes || [];
  const value = (count?: number) => (loading ? "Loading" : error || !summary ? "Pending source" : String(count || 0));

  return (
    <div className="space-y-6">
      <Topbar
        title="Occupancy"
        subtitle="Resident assignment overview"
        strip={[
          { label: "Homes", value: value(summary?.homes), detail: "Registered units", tone: "attention" },
          { label: "Occupied", value: value(summary?.occupied_homes), detail: "Active members linked", tone: "stable" },
          { label: "Attention", value: value((summary?.vacant_homes || 0) + (summary?.pending_activation_homes || 0) + (summary?.homes_without_residents || 0)), detail: "Vacant, pending, or unassigned", tone: "warning" },
          { label: "Residents", value: value(summary?.active_residents), detail: "Active memberships", tone: "info" },
        ]}
      />

      {error ? <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{error}</div> : null}

      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
        <div>
          <h2 className="text-sm font-semibold text-white">Home Occupancy Registry</h2>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            This page reports membership state only. Visitor presence remains in Security & Access.
          </p>
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-sm">
            <thead className="bg-white/5 text-left text-xs text-zinc-400">
              <tr>
                <th className="px-4 py-3">Home</th>
                <th className="px-4 py-3">Occupancy</th>
                <th className="px-4 py-3">Active Members</th>
                <th className="px-4 py-3">Invited</th>
                <th className="px-4 py-3">Suspended</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {homes.map((home) => (
                <tr key={home.id} className="bg-black/10">
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-100">{home.name}</p>
                    <p className="mt-1 text-xs text-zinc-500">{[home.block, home.unit].filter(Boolean).join(" / ") || "Unit label pending"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] ${tone(home.occupancy_status)}`}>
                      {String(home.occupancy_status || "pending source").replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{home.active_member_count ?? "Pending source"}</td>
                  <td className="px-4 py-3 text-zinc-300">{home.invited_member_count ?? "Pending source"}</td>
                  <td className="px-4 py-3 text-zinc-300">{home.suspended_member_count ?? "Pending source"}</td>
                  <td className="px-4 py-3">
                    <Link href={`/homes/${home.id}/users`} className="inline-flex items-center gap-1 text-xs text-sky-200 hover:text-sky-100">
                      Review access <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
              {!homes.length && !loading ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-zinc-500">No homes are registered yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
