"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Ban,
  Check,
  Clock3,
  Copy,
  Download,
  Mail,
  Pencil,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  X,
} from "lucide-react";

import { MetricCard } from "@/components/MetricCard";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { hasPermission } from "@/lib/oyiFoundation";
import facilityService, {
  type HomeInviteRow,
  type HomeMembershipRow,
} from "@/services/facilityService";
import { useSessionStore } from "@/store/useSessionStore";

type InviteRole = "owner" | "admin" | "resident" | "guest";
type InviteArtifact = {
  invite: HomeInviteRow;
  inviteUrl: string;
  qrDataUrl: string;
};
type EditMemberForm = {
  id: string;
  full_name: string;
  username: string;
  email: string;
  role: string;
  status: string;
};

const ROLE_OPTIONS: Array<{ value: InviteRole; label: string; hint: string }> = [
  { value: "owner", label: "Home Owner", hint: "Full home access" },
  { value: "admin", label: "Admin", hint: "Manage home access" },
  { value: "resident", label: "Resident", hint: "Everyday resident access" },
  { value: "guest", label: "Guest", hint: "Limited temporary access" },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function errorMessage(error: any, fallback: string) {
  return error?.response?.data?.error || error?.message || fallback;
}

function formatDate(value?: string | null) {
  if (!value) return "Unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function inviteStatus(invite: HomeInviteRow) {
  const status = String(invite.status || "pending").toLowerCase();
  if (status === "pending" && invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now()) {
    return "expired";
  }
  return status;
}

function StatusBadge({ status }: { status?: string }) {
  const normalized = String(status || "unknown").toLowerCase();
  const tone =
    normalized === "active" || normalized === "accepted"
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
      : normalized === "pending" || normalized === "invited"
      ? "border-amber-500/25 bg-amber-500/10 text-amber-100"
      : normalized === "expired"
      ? "border-orange-500/25 bg-orange-500/10 text-orange-200"
      : normalized === "revoked" || normalized === "disabled"
      ? "border-rose-500/25 bg-rose-500/10 text-rose-200"
      : "border-white/10 bg-white/5 text-zinc-300";

  return (
    <span className={cx("inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]", tone)}>
      {normalized}
    </span>
  );
}

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
  footer,
  maxWidth = "max-w-2xl",
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <section className={cx("glass flex max-h-[min(760px,calc(100vh-2rem))] w-full flex-col overflow-hidden border-blue-500/15 bg-zinc-950/95 shadow-2xl shadow-blue-950/30", maxWidth)}>
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-white">{title}</h2>
            <p className="mt-1 text-xs leading-5 text-zinc-400">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <footer className="flex flex-wrap justify-end gap-2 border-t border-white/10 px-5 py-4">{footer}</footer> : null}
      </section>
    </div>
  );
}

export default function HomeUsersPage() {
  const params = useParams<{ homeId: string }>();
  const homeId = String(params.homeId);
  const { user } = useSessionStore();

  const [members, setMembers] = useState<HomeMembershipRow[]>([]);
  const [invites, setInvites] = useState<HomeInviteRow[]>([]);
  const [backendCanManage, setBackendCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteRole>("resident");
  const [artifact, setArtifact] = useState<InviteArtifact | null>(null);
  const [editMember, setEditMember] = useState<EditMemberForm | null>(null);
  const [removeMember, setRemoveMember] = useState<HomeMembershipRow | null>(null);
  const [revokeInvite, setRevokeInvite] = useState<HomeInviteRow | null>(null);

  const canManage = backendCanManage && hasPermission(user, "staff.manage");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await facilityService.listHomeUsers(homeId);
      setMembers(response.users || []);
      setInvites(response.invites || []);
      setBackendCanManage(Boolean(response.can_manage));
    } catch (requestError: any) {
      setError(errorMessage(requestError, "Unable to load home access."));
    } finally {
      setLoading(false);
    }
  }, [homeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    return {
      active: members.filter((item) => item.status === "active").length,
      pending: invites.filter((item) => inviteStatus(item) === "pending").length,
      disabled: members.filter((item) => item.status === "disabled").length,
      owners: members.filter((item) => item.role === "owner" && item.status === "active").length,
    };
  }, [invites, members]);

  async function createInvite() {
    if (!inviteEmail.trim()) {
      setError("Enter the resident email address.");
      return;
    }

    setBusyAction("create-invite");
    setError(null);
    try {
      const response = await facilityService.inviteHomeUser(homeId, {
        email: inviteEmail,
        role: inviteRole,
        permissions: {},
      });
      setArtifact({
        invite: response.invite,
        inviteUrl: response.inviteUrl,
        qrDataUrl: response.qrDataUrl,
      });
      setNotice("Invite created. Share the secure setup link or QR code with the resident.");
      await load();
    } catch (requestError: any) {
      setError(errorMessage(requestError, "Unable to create invite."));
    } finally {
      setBusyAction(null);
    }
  }

  async function resendInvite(invite: HomeInviteRow) {
    setBusyAction(`resend:${invite.id}`);
    setError(null);
    try {
      const response = await facilityService.resendHomeInvite(homeId, invite.id);
      setArtifact({
        invite: response.invite,
        inviteUrl: response.inviteUrl,
        qrDataUrl: response.qrDataUrl,
      });
      setShowInvite(true);
      setNotice("Invite refreshed. The previous setup link is no longer valid.");
      await load();
    } catch (requestError: any) {
      setError(errorMessage(requestError, "Unable to resend invite."));
    } finally {
      setBusyAction(null);
    }
  }

  async function confirmRevoke() {
    if (!revokeInvite) return;
    setBusyAction(`revoke:${revokeInvite.id}`);
    setError(null);
    try {
      await facilityService.revokeHomeInvite(homeId, revokeInvite.id);
      setRevokeInvite(null);
      setNotice("Invite revoked. Its setup link can no longer be activated.");
      await load();
    } catch (requestError: any) {
      setError(errorMessage(requestError, "Unable to revoke invite."));
    } finally {
      setBusyAction(null);
    }
  }

  async function saveMember() {
    if (!editMember) return;
    setBusyAction(`member:${editMember.id}`);
    setError(null);
    try {
      await facilityService.updateHomeUser(editMember.id, {
        full_name: editMember.full_name,
        username: editMember.username,
        email: editMember.email,
        role: editMember.role,
        status: editMember.status,
      });
      setEditMember(null);
      setNotice("Member access updated.");
      await load();
    } catch (requestError: any) {
      setError(errorMessage(requestError, "Unable to update member."));
    } finally {
      setBusyAction(null);
    }
  }

  async function confirmRemoveMember() {
    if (!removeMember) return;
    setBusyAction(`remove:${removeMember.id}`);
    setError(null);
    try {
      await facilityService.removeHomeUser(removeMember.id);
      setRemoveMember(null);
      setNotice("Member removed from this home.");
      await load();
    } catch (requestError: any) {
      setError(errorMessage(requestError, "Unable to remove member."));
    } finally {
      setBusyAction(null);
    }
  }

  async function copySetupLink() {
    if (!artifact?.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(artifact.inviteUrl);
      setNotice("Setup link copied.");
    } catch {
      setError("Could not copy automatically. Select and copy the setup link manually.");
    }
  }

  function openInviteSheet() {
    setInviteEmail("");
    setInviteRole("resident");
    setArtifact(null);
    setNotice(null);
    setError(null);
    setShowInvite(true);
  }

  return (
    <div className="space-y-6">
      <Topbar
        title="Members & Access"
        subtitle="Manage residents, roles, and secure home invitations."
        rightSlot={
          <Link
            href="/homes"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-200 transition hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Homes
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard title="Active" value={String(stats.active)} change="Live home access" trend="neutral" icon={UserCheck} iconColor="text-emerald-400" />
        <MetricCard title="Pending" value={String(stats.pending)} change="Awaiting setup" trend="neutral" icon={UserPlus} iconColor="text-amber-400" />
        <MetricCard title="Paused" value={String(stats.disabled)} change="Suspended access" trend="neutral" icon={UserX} iconColor="text-rose-400" />
        <MetricCard title="Owners" value={String(stats.owners)} change="Home authority" trend="neutral" icon={ShieldCheck} iconColor="text-blue-400" />
      </div>

      {error ? <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}
      {notice ? <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">{notice}</div> : null}

      <section className="glass flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-300">Home access control</p>
          <p className="mt-1 text-sm text-zinc-300">
            {canManage ? "Invite residents and manage existing home permissions." : "Review the members currently assigned to this home."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cx("mr-2 h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
          {canManage ? (
            <Button onClick={openInviteSheet}>
              <UserPlus className="mr-2 h-4 w-4" />
              Invite resident
            </Button>
          ) : null}
        </div>
      </section>

      {!canManage && !loading ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          You do not have permission to manage home access.
        </div>
      ) : null}

      <section className="glass overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Current members</h2>
            <p className="mt-1 text-xs text-zinc-500">Real home memberships and access roles.</p>
          </div>
          <Users className="h-4 w-4 text-blue-300" />
        </div>
        <div className="divide-y divide-white/10">
          {members.map((member) => {
            const profile = member.users || {};
            return (
              <article key={member.id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-blue-500/20 bg-blue-500/10 text-sm font-semibold text-blue-100">
                    {(profile.full_name || profile.username || profile.email || "?").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{profile.full_name || profile.username || "Resident"}</p>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">{profile.email || "Email unavailable"}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-zinc-300">{member.role}</span>
                  <StatusBadge status={member.status} />
                  {canManage ? (
                    <>
                      <Button
                        variant="ghost"
                        className="px-3 py-1.5 text-xs"
                        onClick={() =>
                          setEditMember({
                            id: member.id,
                            full_name: profile.full_name || "",
                            username: profile.username || "",
                            email: profile.email || "",
                            role: member.role,
                            status: member.status,
                          })
                        }
                      >
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button variant="danger" className="px-3 py-1.5 text-xs" onClick={() => setRemoveMember(member)}>
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        Remove
                      </Button>
                    </>
                  ) : null}
                </div>
              </article>
            );
          })}
          {!members.length && !loading ? (
            <div className="px-5 py-10 text-center text-sm text-zinc-500">No members are assigned to this home yet.</div>
          ) : null}
          {loading && !members.length ? (
            <div className="px-5 py-10 text-center text-sm text-zinc-500">Loading home members…</div>
          ) : null}
        </div>
      </section>

      {canManage ? (
        <section className="glass overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Resident invitations</h2>
              <p className="mt-1 text-xs text-zinc-500">Secure setup invitations generated for this home.</p>
            </div>
            <QrCode className="h-4 w-4 text-cyan-300" />
          </div>
          <div className="divide-y divide-white/10">
            {invites.map((invite) => {
              const status = inviteStatus(invite);
              const canResend = status === "pending" || status === "expired";
              const canRevoke = status === "pending";
              return (
                <article key={invite.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10">
                      <Mail className="h-4 w-4 text-cyan-200" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{invite.invited_email || "Resident invitation"}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {invite.role || "resident"} · expires {formatDate(invite.expires_at)}
                      </p>
                      {invite.last_sent_at ? <p className="mt-1 text-[11px] text-zinc-600">Last generated {formatDate(invite.last_sent_at)}</p> : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={status} />
                    {canResend ? (
                      <Button
                        variant="ghost"
                        className="px-3 py-1.5 text-xs"
                        disabled={busyAction === `resend:${invite.id}`}
                        onClick={() => void resendInvite(invite)}
                      >
                        <RefreshCw className={cx("mr-1.5 h-3.5 w-3.5", busyAction === `resend:${invite.id}` && "animate-spin")} />
                        Resend invite
                      </Button>
                    ) : null}
                    {canRevoke ? (
                      <Button variant="danger" className="px-3 py-1.5 text-xs" onClick={() => setRevokeInvite(invite)}>
                        <Ban className="mr-1.5 h-3.5 w-3.5" />
                        Revoke invite
                      </Button>
                    ) : null}
                  </div>
                </article>
              );
            })}
            {!invites.length && !loading ? (
              <div className="px-5 py-10 text-center text-sm text-zinc-500">No resident invitations have been generated for this home.</div>
            ) : null}
          </div>
        </section>
      ) : null}

      {showInvite ? (
        <ModalShell
          title={artifact ? "Resident setup invite" : "Invite resident"}
          subtitle={artifact ? "Share this secure one-time setup link or QR code with the resident." : "Create home access before the resident activates their Oyi account."}
          onClose={() => setShowInvite(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowInvite(false)}>Close</Button>
              {!artifact ? <Button onClick={() => void createInvite()} disabled={busyAction === "create-invite"}>{busyAction === "create-invite" ? "Creating…" : "Create invite"}</Button> : null}
            </>
          }
        >
          {!artifact ? (
            <div className="space-y-5">
              <label className="block">
                <span className="text-xs font-medium text-zinc-300">Resident email</span>
                <Input className="mt-2" type="email" placeholder="resident@example.com" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} />
              </label>
              <div>
                <p className="text-xs font-medium text-zinc-300">Access role</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {ROLE_OPTIONS.map((option) => (
                    <button
                      type="button"
                      key={option.value}
                      onClick={() => setInviteRole(option.value)}
                      className={cx(
                        "rounded-xl border px-3 py-3 text-left transition",
                        inviteRole === option.value
                          ? "border-blue-500/50 bg-blue-500/15 shadow-lg shadow-blue-950/20"
                          : "border-white/10 bg-white/5 hover:bg-white/10"
                      )}
                    >
                      <span className="block text-sm font-medium text-white">{option.label}</span>
                      <span className="mt-1 block text-xs text-zinc-500">{option.hint}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs leading-5 text-zinc-400">
                Oyi creates a one-time setup link and QR code. The resident chooses their username and password during activation.
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-[1fr_190px]">
              <div className="space-y-4">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-emerald-100">
                    <Check className="h-4 w-4" />
                    Secure invite ready
                  </div>
                  <p className="mt-2 text-xs text-emerald-100/70">Expires {formatDate(artifact.invite.expires_at)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-300">Setup link</p>
                  <p className="mt-2 break-all rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-xs leading-5 text-zinc-300">{artifact.inviteUrl}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => void copySetupLink()}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy setup link
                  </Button>
                  <a
                    href={artifact.qrDataUrl}
                    download={`oyi-home-invite-${artifact.invite.id}.png`}
                    className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-white/10"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download QR
                  </a>
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white p-3">
                <img src={artifact.qrDataUrl} alt="Resident setup QR code" className="aspect-square w-full" />
              </div>
            </div>
          )}
        </ModalShell>
      ) : null}

      {editMember ? (
        <ModalShell
          title="Edit member access"
          subtitle="Update the resident profile fields and home-level permissions."
          onClose={() => setEditMember(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setEditMember(null)}>Cancel</Button>
              <Button onClick={() => void saveMember()} disabled={busyAction === `member:${editMember.id}`}>Save changes</Button>
            </>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Input placeholder="Full name" value={editMember.full_name} onChange={(event) => setEditMember({ ...editMember, full_name: event.target.value })} />
            <Input placeholder="Username" value={editMember.username} onChange={(event) => setEditMember({ ...editMember, username: event.target.value })} />
            <Input className="sm:col-span-2" type="email" placeholder="Email" value={editMember.email} onChange={(event) => setEditMember({ ...editMember, email: event.target.value })} />
            <label>
              <span className="text-xs text-zinc-400">Role</span>
              <select className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-white outline-none" value={editMember.role} onChange={(event) => setEditMember({ ...editMember, role: event.target.value })}>
                {ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label>
              <span className="text-xs text-zinc-400">Access status</span>
              <select className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-white outline-none" value={editMember.status} onChange={(event) => setEditMember({ ...editMember, status: event.target.value })}>
                <option value="active">Active</option>
                <option value="disabled">Suspended</option>
              </select>
            </label>
          </div>
        </ModalShell>
      ) : null}

      {removeMember ? (
        <ModalShell
          title="Remove member?"
          subtitle="This removes the member's access to this home. It does not delete their Oyi account."
          onClose={() => setRemoveMember(null)}
          maxWidth="max-w-md"
          footer={
            <>
              <Button variant="ghost" onClick={() => setRemoveMember(null)}>Keep member</Button>
              <Button variant="danger" onClick={() => void confirmRemoveMember()} disabled={busyAction === `remove:${removeMember.id}`}>Remove access</Button>
            </>
          }
        >
          <p className="text-sm text-zinc-300">{removeMember.users?.email || "This resident"} will lose home access immediately.</p>
        </ModalShell>
      ) : null}

      {revokeInvite ? (
        <ModalShell
          title="Revoke invite?"
          subtitle="The resident will no longer be able to activate this setup link."
          onClose={() => setRevokeInvite(null)}
          maxWidth="max-w-md"
          footer={
            <>
              <Button variant="ghost" onClick={() => setRevokeInvite(null)}>Keep invite</Button>
              <Button variant="danger" onClick={() => void confirmRevoke()} disabled={busyAction === `revoke:${revokeInvite.id}`}>Revoke invite</Button>
            </>
          }
        >
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <Clock3 className="h-4 w-4 text-amber-300" />
            <p className="text-sm text-zinc-300">{revokeInvite.invited_email || "Resident invitation"}</p>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
