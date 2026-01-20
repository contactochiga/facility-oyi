"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import facilityService, { type HomeMembershipRow } from "@/services/facilityService";
import type { ColumnDef } from "@tanstack/react-table";

function pill(status?: string) {
  const s = (status || "unknown").toLowerCase();
  const tone =
    s === "active"
      ? "text-emerald-200 bg-emerald-500/10 border-emerald-500/20"
      : s === "invited"
        ? "text-yellow-200 bg-yellow-500/10 border-yellow-500/20"
        : s === "disabled"
          ? "text-red-200 bg-red-500/10 border-red-500/20"
          : "text-zinc-200 bg-white/5 border-white/10";

  return <span className={`px-2 py-1 rounded-full border text-xs ${tone}`}>{s}</span>;
}

export default function HomeUsersPage() {
  const params = useParams<{ homeId: string }>();
  const homeId = String(params.homeId);

  const [items, setItems] = useState<HomeMembershipRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Invite modal
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("resident");
  const [inviteResult, setInviteResult] = useState<{ inviteUrl?: string; qrDataUrl?: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await facilityService.listHomeUsers(homeId);
      setItems(res.users || []);
    } finally {
      setLoading(false);
    }
  }

  async function invite() {
    if (!email.trim()) {
      alert("Email is required");
      return;
    }
    setLoading(true);
    try {
      const res = await facilityService.inviteHomeUser(homeId, {
        email: email.trim(),
        role: role || "resident",
        permissions: {},
      });
      setInviteResult({ inviteUrl: res.inviteUrl, qrDataUrl: res.qrDataUrl });
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.error || e?.message || "Invite failed");
    } finally {
      setLoading(false);
    }
  }

  async function setMembership(membershipId: string, patch: any) {
    setLoading(true);
    try {
      await facilityService.updateHomeUser(membershipId, patch);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.error || e?.message || "Update failed");
    } finally {
      setLoading(false);
    }
  }

  async function removeMembership(membershipId: string) {
    if (!confirm("Remove this user from the home?")) return;
    setLoading(true);
    try {
      await facilityService.removeHomeUser(membershipId);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.error || e?.message || "Remove failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeId]);

  const columns = useMemo<ColumnDef<HomeMembershipRow>[]>(() => [
    {
      header: "User",
      accessorFn: (r) => r.users?.email || r.users?.full_name || r.users?.username || r.users?.id,
      cell: ({ row }) => {
        const u = row.original.users;
        return (
          <div>
            <div className="font-medium text-zinc-100">{u?.full_name || u?.username || "—"}</div>
            <div className="text-xs text-zinc-500 mt-1">{u?.email || "—"}</div>
          </div>
        );
      }
    },
    {
      header: "Home Role",
      accessorKey: "role",
      cell: ({ row }) => <span className="text-sm text-zinc-200">{row.original.role}</span>,
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => pill(row.original.status),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const m = row.original;
        return (
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setMembership(m.id, { status: m.status === "active" ? "disabled" : "active" })}
              disabled={loading}
            >
              {m.status === "active" ? "Disable" : "Activate"}
            </Button>

            <Button
              variant="ghost"
              onClick={() => {
                const next = prompt("Set role (owner / resident / staff)", m.role);
                if (!next) return;
                setMembership(m.id, { role: next });
              }}
              disabled={loading}
            >
              Role
            </Button>

            <Button variant="ghost" onClick={() => removeMembership(m.id)} disabled={loading}>
              Remove
            </Button>
          </div>
        );
      }
    }
  ], [loading]);

  return (
    <div className="space-y-7">
      <Topbar
        title="Home Users"
        subtitle="Private membership • owner-controlled access • onboarding via invites"
      />

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
        <Button onClick={() => { setShowInvite(true); setInviteResult(null); }}>
          Invite User
        </Button>
      </div>

      <DataTable data={items} columns={columns} title="Home Members" searchKey={"role"} />

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-zinc-950 p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-semibold text-white">Invite to Home</div>
                <div className="text-sm text-zinc-400 mt-1">
                  Home: <span className="text-zinc-200">{homeId}</span>
                </div>
              </div>
              <button className="text-zinc-400 hover:text-white" onClick={() => setShowInvite(false)}>
                ✕
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <input
                className="w-full rounded-xl bg-white/5 px-4 py-3 text-white outline-none ring-1 ring-white/10 focus:ring-white/20"
                placeholder="Email (e.g. resident@email.com)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <input
                className="w-full rounded-xl bg-white/5 px-4 py-3 text-white outline-none ring-1 ring-white/10 focus:ring-white/20"
                placeholder="Role (owner / resident / staff)"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />

              {inviteResult?.inviteUrl && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                  <div className="text-sm text-emerald-200 font-medium">Invite created</div>
                  <div className="text-xs text-zinc-300 mt-2 break-all">
                    {inviteResult.inviteUrl}
                  </div>

                  {inviteResult.qrDataUrl && (
                    <div className="mt-3">
                      <img src={inviteResult.qrDataUrl} alt="Invite QR" className="h-40 w-40 rounded-xl border border-white/10" />
                      <div className="text-xs text-zinc-400 mt-2">Scan QR or share the link.</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowInvite(false)}>
                Close
              </Button>
              <Button onClick={invite} disabled={loading}>
                {loading ? "Inviting..." : "Create Invite"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
