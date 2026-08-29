"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  Camera,
  ChevronRight,
  Clock3,
  Eye,
  KeyRound,
  Search,
  SlidersHorizontal,
  Trash2,
  Users,
  X,
} from "lucide-react";
import OisCard from "@/components/ois/OisCard";
import OisListItem from "@/components/ois/OisListItem";
import OisStatusBadge from "@/components/ois/OisStatusBadge";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { facilityService, type EstateMembershipRow, type InfrastructureOperations, type AutomationActionPolicy } from "@/services/facilityService";
import { notificationService, type AlertItem, type NotificationPreference, type NotificationCategory } from "@/services/notificationService";
import { authService } from "@/services/authService";
import { cleanupFacilityPushRegistration } from "@/services/pushRegistrationService";
import { hasPermission, PERMISSION_KEYS, permissionsForRole } from "@/lib/oyiFoundation";
import { iconForTab } from "@/lib/oisIconRegistry";
import { useSessionStore } from "@/store/useSessionStore";

type Tab = "profile" | "operators" | "roles" | "permissions" | "audit" | "automation" | "integrations" | "notifications" | "security" | "settings";
type LoadStatus = "loading" | "ready" | "error" | "permission";
type Source<T> = { status: LoadStatus; data: T; message?: string };
type Detail = { title: string; subtitle?: string; rows: Array<[string, string]>; href?: string };

const TABS: Array<{ key: Tab; label: string; icon: typeof Users }> = [
  { key: "profile", label: "My Profile", icon: iconForTab("profile") },
  { key: "operators", label: "Operators", icon: iconForTab("operators") },
  { key: "roles", label: "Roles", icon: iconForTab("roles") },
  { key: "permissions", label: "Permissions", icon: iconForTab("permissions") },
  { key: "audit", label: "Audit", icon: iconForTab("audit") },
  { key: "automation", label: "Automation", icon: iconForTab("automation") },
  { key: "integrations", label: "Integrations", icon: iconForTab("integrations") },
  { key: "notifications", label: "Notifications", icon: iconForTab("notifications") },
  { key: "security", label: "Security", icon: iconForTab("security") },
  { key: "settings", label: "Facility Profile", icon: iconForTab("settings") },
];

const ROLE_DEFINITIONS = [
  { key: "estate_admin", label: "Estate Governor", description: "Owns estate-level governance, homes, staff, residents and operational continuity.", inheritance: "Top estate role", scope: "Estate-wide" },
  { key: "facility_manager", label: "Facility Manager", description: "Runs daily facility operations across homes, staff, support, residents and devices.", inheritance: "Operational manager", scope: "Estate-wide" },
  { key: "security_operator", label: "Security Operator", description: "Handles visitors, gate access, cameras, incidents and security workflows.", inheritance: "Security-focused", scope: "Estate/security domains" },
  { key: "maintenance_operator", label: "Maintenance Operator", description: "Handles maintenance, support tickets, device posture and resident service workflows.", inheritance: "Support-focused", scope: "Maintenance/support domains" },
  { key: "finance_operator", label: "Finance Operator", description: "Handles wallet, payment and finance operations where enabled.", inheritance: "Finance-focused", scope: "Wallet/service domains" },
  { key: "ochiga_staff", label: "Ochiga Staff", description: "Ochiga support staff with read/support/moderation visibility but not full estate ownership.", inheritance: "Platform staff", scope: "Support-limited" },
];

// Phase 2 commercial-hardening -- Automation Permissions is a READ-ONLY
// administrative-visibility layer over the existing, already-shipped
// client-side automation-recommendation policy (lib/safeAutomationRuntime.ts:
// permissionsForAction/executionMode/safeToExecute). It does not add any new
// automation engine, capability or execution path -- it surfaces the ceiling
// that policy already enforces, so an owner/admin can answer "what is this
// system allowed to do on its own?" without engineering involvement. Full
// autonomous-operation workspace is explicitly out of scope (Phase 3).
type AutomationCeiling = "AUTO_ALLOWED" | "MANUAL_ONLY";

const AUTOMATION_DOMAIN_POLICY: Array<{
  domain: string;
  label: string;
  requiredPermissions: string[];
  advisory: string;
  ceiling: AutomationCeiling;
  ceilingNote: string;
  hardBlocked: boolean;
}> = [
  { domain: "infrastructure", label: "Infrastructure", requiredPermissions: ["devices.control"], advisory: "Suggests or prepares a workflow only", ceiling: "MANUAL_ONLY", ceilingNote: "Device control commands are never executed silently.", hardBlocked: false },
  { domain: "security", label: "Security", requiredPermissions: ["support.assign", "notifications.manage"], advisory: "Suggests or prepares a workflow only", ceiling: "MANUAL_ONLY", ceilingNote: "Critical security actions are never dispatched without explicit operator approval.", hardBlocked: true },
  { domain: "maintenance", label: "Maintenance", requiredPermissions: ["support.assign"], advisory: "Suggests or prepares a workflow only", ceiling: "MANUAL_ONLY", ceilingNote: "Support and maintenance follow-up remains operator-executed.", hardBlocked: false },
  { domain: "utility", label: "Utilities", requiredPermissions: ["devices.control"], advisory: "Suggests or prepares a workflow only", ceiling: "MANUAL_ONLY", ceilingNote: "Utility device control commands are never executed silently.", hardBlocked: false },
  { domain: "environmental", label: "Environment", requiredPermissions: ["devices.control"], advisory: "Suggests or prepares a workflow only", ceiling: "MANUAL_ONLY", ceilingNote: "Environmental device control commands are never executed silently.", hardBlocked: false },
  { domain: "visitor", label: "Visitors / Access", requiredPermissions: ["visitors.manage"], advisory: "Suggests or prepares a workflow only", ceiling: "MANUAL_ONLY", ceilingNote: "Access and visitor permissions are never modified automatically.", hardBlocked: true },
  { domain: "financial", label: "Finance", requiredPermissions: ["wallets.manage"], advisory: "Suggests or prepares a workflow only", ceiling: "MANUAL_ONLY", ceilingNote: "Financial follow-up is never executed automatically.", hardBlocked: true },
  { domain: "community", label: "Community", requiredPermissions: ["community.moderate"], advisory: "Suggests or prepares a workflow only", ceiling: "MANUAL_ONLY", ceilingNote: "Community moderation actions remain operator-executed.", hardBlocked: false },
  { domain: "operational_governance", label: "Assets / Operational Governance", requiredPermissions: ["support.assign"], advisory: "Suggests, prepares a workflow, or requests approval", ceiling: "AUTO_ALLOWED", ceilingNote: "Only a narrow, reversible, internal decision-routing step may run without a human click -- never for approval-required or already-flagged items.", hardBlocked: false },
  { domain: "executive", label: "Executive / Briefings", requiredPermissions: ["office.read"], advisory: "Suggests or prepares a workflow only", ceiling: "MANUAL_ONLY", ceilingNote: "Briefing and reporting output remains operator-reviewed before use.", hardBlocked: false },
];

const AUDIT_DOMAINS = [
  "auth",
  "invite",
  "resident",
  "device",
  "visitor",
  "community",
  "message",
  "moderation",
  "admin",
  "settings",
  "wallet",
  "maintenance",
];

function source<T>(data: T, status: LoadStatus = "loading", message?: string): Source<T> {
  return { data, status, message };
}

function fromError<T>(error: any, fallback: T): Source<T> {
  const code = Number(error?.response?.status || 0);
  return source(fallback, code === 401 || code === 403 ? "permission" : "error", String(error?.response?.data?.error || error?.response?.data?.message || error?.message || "Backend unavailable"));
}

async function loadSource<T>(request: Promise<T>, fallback: T): Promise<Source<T>> {
  try {
    return source(await request, "ready");
  } catch (error) {
    return fromError(error, fallback);
  }
}

function text(value: any, fallback = "Unavailable") {
  const next = String(value ?? "").trim();
  return next || fallback;
}

function lower(value: any) {
  return String(value ?? "").toLowerCase();
}

function dateLabel(value?: string | null) {
  if (!value) return "No live timestamp";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No live timestamp";
  return date.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function sourceLabel<T>(item: Source<T>, empty = "Pending source") {
  if (item.status === "loading") return "Loading source";
  if (item.status === "permission") return "Permission required";
  if (item.status === "error") return item.message || "Backend unavailable";
  return empty;
}

function statusTone(value?: string | null) {
  const status = lower(value || "unknown");
  if (/active|connected|ready|configured|enabled|sent|live/.test(status)) return "stable";
  if (/suspended|removed|revoked|failed|error|disconnected|expired/.test(status)) return "critical";
  if (/pending|awaiting|unknown|invited|no configuration|not configured/.test(status)) return "pending";
  return "unavailable";
}

function Status({ value }: { value: string }) {
  return <OisStatusBadge status={statusTone(value)} label={value} className="uppercase tracking-[0.12em]" />;
}

function Metric({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return <OisCard className="p-4"><p className="text-[10px] uppercase tracking-[0.17em] text-[var(--ois-text-muted)]">{label}</p><p className="mt-3 text-2xl font-semibold tracking-tight text-[var(--ois-text-primary)]">{value}</p><p className="mt-2 text-xs leading-5 text-[var(--ois-text-secondary)]">{hint}</p></OisCard>;
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return <OisCard className="p-4 sm:p-5"><h2 className="text-sm font-semibold text-white">{title}</h2>{subtitle ? <p className="mt-1 text-xs leading-5 text-zinc-500">{subtitle}</p> : null}<div className="mt-4">{children}</div></OisCard>;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return <OisCard variant="evidence" className="p-3"><p className="text-[10px] uppercase tracking-[0.14em] text-[var(--ois-text-muted)]">{label}</p><div className="mt-1 text-sm text-[var(--ois-text-primary)]">{value}</div></OisCard>;
}

function operatorName(member: EstateMembershipRow) {
  const user = member.users || ({} as any);
  return user.full_name || user.username || user.email || "Operator";
}

function operatorEmail(member: EstateMembershipRow) {
  return member.users?.email || "Email unavailable";
}

function sourceArray(data: any, keys: string[]) {
  if (Array.isArray(data)) return data;
  for (const key of keys) if (Array.isArray(data?.[key])) return data[key];
  return [];
}

function readinessCheck(data: any, name: string) {
  return sourceArray(data, ["checks"]).find((item: any) => lower(item.name) === lower(name));
}

function readinessStatus(data: any, name: string) {
  const check = readinessCheck(data, name);
  if (!check) return "Pending readiness";
  if (lower(check.status) === "healthy") return "Connected";
  if (lower(check.status) === "missing") return "No readiness source";
  return text(check.status, "Pending readiness");
}

function readinessDetail(data: any, name: string) {
  return text(readinessCheck(data, name)?.detail, "Backend readiness source unavailable.");
}

export default function FacilityAdministrationModule() {
  const { user } = useSessionStore();
  const params = useSearchParams();
  const requestedTab = params.get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(TABS.some((item) => item.key === requestedTab) ? (requestedTab as Tab) : "operators");
  const [operators, setOperators] = useState<Source<EstateMembershipRow[]>>(source([]));
  const [invites, setInvites] = useState<Source<any[]>>(source([]));
  const [estates, setEstates] = useState<Source<any[]>>(source([]));
  const [audit, setAudit] = useState<Source<any[]>>(source([]));
  const [infra, setInfra] = useState<Source<InfrastructureOperations | null>>(source(null));
  const [notifications, setNotifications] = useState<Source<AlertItem[]>>(source([]));
  const [pushReadiness, setPushReadiness] = useState<Source<any>>(source(null));
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [auditFilter, setAuditFilter] = useState("all");
  const [detail, setDetail] = useState<Detail | null>(null);

  const canManageStaff = hasPermission(user, "staff.manage");
  const canSettings = hasPermission(user, "settings.manage");
  const canAudit = hasPermission(user, "audit.read");
  const canNotifications = hasPermission(user, "notifications.read");

  const load = useCallback(async () => {
    setLoading(true);
    const [operatorState, inviteState, estateState, auditState, infraState, notificationState, pushState] = await Promise.all([
      loadSource(facilityService.listEstateUsers().then((res) => res.users || []), []),
      canManageStaff ? loadSource(facilityService.listEstateInvites().then((res) => res.invites || []), []) : Promise.resolve(source<any[]>([], "permission", "Permission required")),
      loadSource(facilityService.myEstates().then((res) => res.estates || []), []),
      canAudit ? loadSource(facilityService.auditEvents({ limit: 160 }).then((res) => res.events || []), []) : Promise.resolve(source<any[]>([], "permission", "Permission required")),
      loadSource(facilityService.infrastructureOperations(), null),
      canNotifications ? loadSource(notificationService.unread(), []) : Promise.resolve(source<AlertItem[]>([], "permission", "Permission required")),
      loadSource(facilityService.platformDeploymentReadiness(), null),
    ]);
    setOperators(operatorState);
    setInvites(inviteState);
    setEstates(estateState);
    setAudit(auditState);
    setInfra(infraState);
    setNotifications(notificationState);
    setPushReadiness(pushState);
    setLoading(false);
  }, [canManageStaff, canAudit, canNotifications]);

  useEffect(() => {
    void load();
    const onRealtime = (event: Event) => {
      const name = (event as CustomEvent)?.detail?.event || "";
      if (/audit|notification|staff|settings|device|edge|integration/.test(name)) void load();
    };
    window.addEventListener("facility:realtime-event", onRealtime);
    return () => window.removeEventListener("facility:realtime-event", onRealtime);
  }, [load]);

  const filteredOperators = operators.data.filter((member) => {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return `${operatorName(member)} ${operatorEmail(member)} ${member.role} ${member.status}`.toLowerCase().includes(needle);
  });

  const activeOperators = operators.data.filter((item) => lower(item.status) === "active");
  const suspendedOperators = operators.data.filter((item) => /suspended|removed|disabled/.test(lower(item.status)));
  const pendingOperators = operators.data.filter((item) => /invited|pending/.test(lower(item.status)));

  const filteredAudit = audit.data.filter((item) => {
    const hay = `${item.action || ""} ${item.actor_role || ""} ${item.resource_type || ""} ${item.resource_id || ""}`.toLowerCase();
    const matchesSearch = !query.trim() || hay.includes(query.trim().toLowerCase());
    const matchesDomain = auditFilter === "all" || hay.includes(auditFilter);
    return matchesSearch && matchesDomain;
  });

  const integrations = useMemo(() => {
    const providers = infra.data?.providers || [];
    const tuya = providers.find((provider: any) => /tuya|smart/i.test(`${provider.provider || provider.name || ""}`));
    const edgeNodes = infra.data?.edge_nodes || [];
    const cameraSource = infra.data?.sources?.cameras || null;
    return [
      { name: "Tuya / Smart Life", status: tuya ? text(tuya.status || tuya.connection_status, "Connected") : "Pending readiness", detail: tuya ? text(tuya.last_sync_at || tuya.updated_at, "Last sync unavailable") : "Provider readiness flows through device provider sync." },
      { name: "Oyi Edge", status: edgeNodes.length ? "Connected" : "Pending readiness", detail: edgeNodes.length ? `${edgeNodes.length} node(s) registered` : "Awaiting Edge registration and heartbeat." },
      { name: "Camera providers", status: cameraSource?.available ? "Connected" : "No readiness source", detail: cameraSource?.reason || "Camera source appears when ONVIF/Edge cameras are bound." },
      { name: "Notification providers", status: pushReadiness.status === "ready" ? "Ready" : "Pending readiness", detail: pushReadiness.status === "ready" ? "Provider readiness source loaded." : sourceLabel(pushReadiness, "No readiness source") },
      { name: "APNs", status: readinessStatus(pushReadiness.data, "APNs"), detail: readinessDetail(pushReadiness.data, "APNs") },
      { name: "FCM", status: readinessStatus(pushReadiness.data, "FCM"), detail: readinessDetail(pushReadiness.data, "FCM") },
      { name: "Future providers", status: "Pending readiness", detail: "Matter, MQTT expansion and additional providers remain future integrations." },
    ];
  }, [infra.data, pushReadiness]);

  const roleRows = ROLE_DEFINITIONS.map((role) => ({ ...role, permissions: permissionsForRole(role.key) }));

  const estate = estates.data[0] || null;

  return (
    <div className="space-y-6">
      <Topbar title="Operational Governance" subtitle="Operators, roles, and audit" strip={[{ label: "Operators", value: operators.status === "ready" ? operators.data.length : "Pending" }, { label: "Active", value: operators.status === "ready" ? activeOperators.length : "Pending" }, { label: "Attention", value: suspendedOperators.length + pendingOperators.length }, { label: "Audit", value: audit.status === "ready" ? audit.data.length : "Pending" }, { label: "Health", value: suspendedOperators.length || pendingOperators.length ? "Review" : "Stable" }]} />

      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => <button key={item.key} type="button" onClick={() => setTab(item.key)} className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs transition ${tab === item.key ? "border-sky-400/35 bg-sky-500/10 text-sky-100" : "border-white/10 bg-white/5 text-zinc-400 hover:text-white"}`}><item.icon className="h-3.5 w-3.5" />{item.label}</button>)}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
        <Search className="h-4 w-4 text-zinc-500" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search operators, audit entries, roles, permissions..." className="min-w-[260px] flex-1 bg-transparent text-sm text-white outline-none" />
        {tab === "audit" ? <select value={auditFilter} onChange={(event) => setAuditFilter(event.target.value)} className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"><option value="all">All domains</option>{AUDIT_DOMAINS.map((domain) => <option key={domain} value={domain}>{domain}</option>)}</select> : null}
      </div>

      {tab === "profile" ? <MyProfileSection estateName={estate?.name || null} /> : null}
      {tab === "operators" ? <OperatorsSection operators={filteredOperators} source={operators} invites={invites} canManage={canManageStaff} userRole={user?.role || ""} onOpen={setDetail} onReload={load} /> : null}
      {tab === "roles" ? <RolesSection roles={roleRows} onOpen={setDetail} /> : null}
      {tab === "permissions" ? <PermissionsSection roles={roleRows} /> : null}
      {tab === "audit" ? <AuditSection source={audit} rows={filteredAudit} /> : null}
      {tab === "automation" ? <AutomationSection /> : null}
      {tab === "integrations" ? <IntegrationsSection rows={integrations} infra={infra} /> : null}
      {tab === "notifications" ? <NotificationsSection notifications={notifications} push={pushReadiness} /> : null}
      {tab === "security" ? <SecuritySection userRole={user?.role || "operator"} canSettings={canSettings} canAudit={canAudit} audit={audit} operators={operators} /> : null}
      {tab === "settings" ? <EstateSettingsSection estate={estate} source={estates} canSettings={canSettings} onSaved={load} /> : null}

      {detail ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm"><section className="w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-950 p-5"><header className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Governance overview</p><h2 className="mt-1 text-lg font-semibold text-white">{detail.title}</h2>{detail.subtitle ? <p className="mt-1 text-sm text-zinc-500">{detail.subtitle}</p> : null}</div><button type="button" onClick={() => setDetail(null)} className="rounded-lg border border-white/10 p-2 text-zinc-400 hover:text-white"><X className="h-4 w-4" /></button></header><div className="mt-5 grid gap-2 sm:grid-cols-2">{detail.rows.map(([label, value]) => <Field key={label} label={label} value={value} />)}</div>{detail.href ? <Link href={detail.href} className="mt-5 inline-flex items-center gap-2 text-sm text-sky-200 hover:text-sky-100">Open source workflow <ChevronRight className="h-4 w-4" /></Link> : null}</section></div> : null}
    </div>
  );
}

// Phase 2 commercial-hardening -- real Team & Access. Grantable-role list
// is a CLIENT-SIDE convenience only (a nicer picker than showing roles the
// server will reject); the actual authority boundary is enforced entirely
// server-side (canGrantMembershipRole/canManageTargetRole in
// Ochiga-backend's estateMembershipRoles.ts) -- this list is deliberately
// conservative (never higher than what the current user's own role
// resembles) but is not itself a security control.
const GRANTABLE_ROLES: Array<{ value: string; label: string; minActorRole: string[] }> = [
  { value: "estate_admin", label: "Estate Admin", minActorRole: ["estate_admin"] },
  { value: "facility_manager", label: "Facility Manager", minActorRole: ["estate_admin"] },
  { value: "security_operator", label: "Security Operator", minActorRole: ["estate_admin", "facility_manager"] },
  { value: "maintenance_operator", label: "Maintenance Operator", minActorRole: ["estate_admin", "facility_manager"] },
  { value: "finance_operator", label: "Finance Operator", minActorRole: ["estate_admin", "facility_manager"] },
];

function grantableRolesFor(actorRole: string) {
  return GRANTABLE_ROLES.filter((r) => r.minActorRole.includes(actorRole));
}

function OperatorsSection({ operators, source, invites, canManage, userRole, onOpen, onReload }: { operators: EstateMembershipRow[]; source: Source<EstateMembershipRow[]>; invites: Source<any[]>; canManage: boolean; userRole: string; onOpen: (detail: Detail) => void; onReload: () => void }) {
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteResult, setInviteResult] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  const grantable = grantableRolesFor(userRole);
  const pendingInvites = invites.data.filter((item) => item.status === "pending");

  async function sendInvite() {
    if (!inviteEmail.trim() || !inviteRole) return;
    setInviteBusy(true);
    setInviteError(null);
    setInviteResult(null);
    try {
      const res = await facilityService.createEstateInvite({ email: inviteEmail.trim(), role: inviteRole });
      setInviteResult(res.email_delivered ? "Invitation sent." : `Invitation created. Email delivery is not configured -- share this link: ${res.invite_url}`);
      setInviteEmail("");
      setInviteRole("");
      onReload();
    } catch (err: any) {
      setInviteError(err?.response?.data?.error || err?.message || "Unable to send invitation.");
    } finally {
      setInviteBusy(false);
    }
  }

  async function revoke(inviteId: string) {
    setRowBusy(inviteId);
    try {
      await facilityService.revokeEstateInvite(inviteId);
      onReload();
    } finally {
      setRowBusy(null);
    }
  }

  async function resend(inviteId: string) {
    setRowBusy(inviteId);
    try {
      const res = await facilityService.resendEstateInvite(inviteId);
      if (!res.email_delivered && res.invite_url) setInviteResult(`Email delivery is not configured -- share this link: ${res.invite_url}`);
      onReload();
    } finally {
      setRowBusy(null);
    }
  }

  async function removeOperator(member: EstateMembershipRow) {
    if (!window.confirm(`Remove ${operatorName(member)} from this estate?`)) return;
    setRowBusy(member.id);
    try {
      await facilityService.removeEstateUser(member.id);
      onReload();
    } catch (err: any) {
      window.alert(err?.response?.data?.error || err?.message || "Unable to remove this team member.");
    } finally {
      setRowBusy(null);
    }
  }

  if (source.status !== "ready") return <Panel title="Team & Access" subtitle="Operator source state"><p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-zinc-500">{sourceLabel(source, "Awaiting activity source")}</p></Panel>;

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        <Panel title="Team & Access" subtitle="Facility team members, roles, status and management actions.">
          <div className="space-y-2">
            {operators.map((member) => (
              <div key={member.id} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <OisListItem title={operatorName(member)} description={`${operatorEmail(member)} · ${member.role || "operator"}`} status={statusTone(member.status || "unknown")} />
                </div>
                <Button variant="ghost" onClick={() => onOpen({ title: operatorName(member), subtitle: operatorEmail(member), rows: [["Role", member.role || "operator"], ["Status", member.status || "unknown"], ["Assigned scope", "Facility scope"], ["Suspension state", /suspended/.test(lower(member.status)) ? "Suspended" : "Not suspended"]], href: "/homes" })} className="gap-2">
                  <Eye className="h-4 w-4" />Inspect
                </Button>
                {canManage ? (
                  <Button variant="ghost" disabled={rowBusy === member.id} onClick={() => void removeOperator(member)} className="gap-2 text-rose-300">
                    Remove
                  </Button>
                ) : null}
              </div>
            ))}
            {!operators.length ? <p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-zinc-500">No operators returned by the estate user source.</p> : null}
          </div>
        </Panel>

        <Panel title="Pending Invitations" subtitle="Invited but not yet activated.">
          {invites.status !== "ready" ? (
            <p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-zinc-500">{sourceLabel(invites, "No invitations")}</p>
          ) : (
            <div className="space-y-2">
              {pendingInvites.map((invite) => (
                <div key={invite.id} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <OisListItem title={invite.invited_email} description={`${invite.role} · expires ${dateLabel(invite.expires_at)}`} status="pending" />
                  </div>
                  {canManage ? (
                    <>
                      <Button variant="ghost" disabled={rowBusy === invite.id} onClick={() => void resend(invite.id)}>Resend</Button>
                      <Button variant="ghost" disabled={rowBusy === invite.id} onClick={() => void revoke(invite.id)} className="text-rose-300">Revoke</Button>
                    </>
                  ) : null}
                </div>
              ))}
              {!pendingInvites.length ? <p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-zinc-500">No pending invitations.</p> : null}
            </div>
          )}
        </Panel>
      </div>

      <Panel title={showInvite ? "Invite Team Member" : "Team Controls"} subtitle={canManage ? "Invite a new team member into this Facility." : "Permission required: staff.manage"}>
        {!canManage ? (
          <p className="text-sm text-zinc-400">You are not authorized to manage this estate's team.</p>
        ) : showInvite ? (
          <div className="space-y-3">
            <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Email" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-sky-400/40" />
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white">
              <option value="">Select a role</option>
              {grantable.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            {inviteError ? <p className="text-xs text-rose-300">{inviteError}</p> : null}
            {inviteResult ? <p className="text-xs text-emerald-300">{inviteResult}</p> : null}
            <div className="flex gap-2">
              <Button disabled={inviteBusy || !inviteEmail.trim() || !inviteRole} onClick={() => void sendInvite()}>{inviteBusy ? "Sending..." : "Send invite"}</Button>
              <Button variant="ghost" onClick={() => setShowInvite(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-sm text-zinc-400">
            <Field label="Active operators" value={String(operators.length)} />
            <Field label="Pending invitations" value={String(pendingInvites.length)} />
            <Button onClick={() => setShowInvite(true)}>Invite team member</Button>
          </div>
        )}
      </Panel>
    </section>
  );
}

function RolesSection({ roles, onOpen }: { roles: Array<typeof ROLE_DEFINITIONS[number] & { permissions: string[] }>; onOpen: (detail: Detail) => void }) {
  return <Panel title="Role Governance" subtitle="Current role definitions from the shared permission foundation. Custom role creation is read-only until backend support exists."><div className="grid gap-3 lg:grid-cols-2">{roles.map((role) => <OisCard key={role.key} variant="evidence" className="p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-white">{role.label}</h3><p className="mt-1 text-xs leading-5 text-zinc-500">{role.description}</p></div><Status value="Read-only" /></div><div className="mt-4 grid gap-2 sm:grid-cols-3"><Field label="Permissions" value={String(role.permissions.length)} /><Field label="Inheritance" value={role.inheritance} /><Field label="Scope" value={role.scope} /></div><Button variant="ghost" className="mt-3 gap-2" onClick={() => onOpen({ title: role.label, subtitle: role.description, rows: [["Role", role.key], ["Inheritance", role.inheritance], ["Operational scope", role.scope], ["Assignment", "Supported through existing membership update flows"], ["Custom role editing", "Pending backend support"], ["Permissions", role.permissions.join(", ") || "None"]] })}><SlidersHorizontal className="h-4 w-4" />Review role</Button></OisCard>)}</div></Panel>;
}

function PermissionsSection({ roles }: { roles: Array<typeof ROLE_DEFINITIONS[number] & { permissions: string[] }> }) {
  return <section className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]"><Panel title="Permission Registry" subtitle="All permissions currently supported by the Facility permission foundation."><div className="max-h-[520px] space-y-2 overflow-auto pr-1">{PERMISSION_KEYS.map((permission) => <div key={permission} className="rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-sm text-zinc-300">{permission}</div>)}</div></Panel><Panel title="Role-to-Permission Mapping" subtitle="Read-only matrix unless backend custom-role editing is added."><div className="space-y-3">{roles.map((role) => <div key={role.key} className="rounded-2xl border border-white/10 bg-black/15 p-4"><h3 className="text-sm font-semibold text-white">{role.label}</h3><div className="mt-3 flex flex-wrap gap-2">{role.permissions.map((permission) => <span key={permission} className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-zinc-300">{permission}</span>)}</div></div>)}</div></Panel></section>;
}

function AuditSection({ source, rows }: { source: Source<any[]>; rows: any[] }) {
  if (source.status !== "ready") return <Panel title="Audit Center" subtitle="Audit visibility"><p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-zinc-500">{sourceLabel(source, "No audit entries")}</p></Panel>;
  return <Panel title="Audit Center" subtitle="This Facility's own administrative and security events -- team changes, invitations, profile edits, permission denials."><div className="space-y-2">{rows.map((item) => <OisListItem key={item.id || `${item.action}-${item.occurred_at}`} title={item.action || "Audit event"} description={`${item.resource_type || "target"}:${item.resource_id || "n/a"} · actor:${item.actor_role || "n/a"}`} meta={dateLabel(item.occurred_at)} status={statusTone(item.status || "recorded")} />)}{!rows.length ? <p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-zinc-500">No audit entries match this filter.</p> : null}</div></Panel>;
}

// PHASE 3 (Milestone 1) -- this section now also shows the REAL,
// server-enforced policy for the 3 concrete domains that actually execute
// (visitor/maintenance/device), sourced live from
// GET /facility/automation/policy (automationPolicyResolver.ts). The
// domain-level matrix above it stays exactly as Phase 2 built it (the
// advisory ceiling from lib/safeAutomationRuntime.ts) -- this section is
// additive, not a replacement, per the governing spec's explicit
// instruction not to replace the Phase 2 Automation Permissions settings.
function AutomationSection() {
  const autoAllowed = AUTOMATION_DOMAIN_POLICY.filter((row) => row.ceiling === "AUTO_ALLOWED");
  const [livePolicy, setLivePolicy] = useState<Source<AutomationActionPolicy[]>>(source([]));

  useEffect(() => {
    let cancelled = false;
    facilityService
      .automationPolicy()
      .then((res) => { if (!cancelled) setLivePolicy(source(res.policy || [], "ready")); })
      .catch((err: any) => { if (!cancelled) setLivePolicy(fromError(err, [])); });
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        <Panel title="Enforced Execution Policy (live)" subtitle="The actual, server-enforced policy for this Facility's three executable action domains -- reflects real backend state, not a description. Every action defaults to approval_required unless this Facility has an explicit override on file (none do yet -- policy editing is not part of this milestone).">
          {livePolicy.status !== "ready" ? (
            <p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-zinc-500">{sourceLabel(livePolicy)}</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {livePolicy.data.map((row) => (
                <OisCard key={row.actionId} variant="evidence" className="p-3">
                  <p className="text-xs font-medium text-zinc-200">{row.actionId}</p>
                  <p className="mt-1 text-[11px] text-zinc-500">{row.executionLevel.replace(/_/g, " ")}</p>
                  <p className="mt-1 text-[10px] text-zinc-600">{row.reason}</p>
                </OisCard>
              ))}
            </div>
          )}
          <Link href="/automation" className="mt-4 inline-flex items-center gap-2 text-sm text-sky-200 hover:text-sky-100">Open the Automation workspace <ChevronRight className="h-4 w-4" /></Link>
        </Panel>
        <Panel title="Automation Permissions" subtitle="What this Facility's automation policy is allowed to do on its own, by domain. Administrative visibility only -- no execution happens from this screen, and this is not the automation operations workspace.">
          <div className="grid gap-3 lg:grid-cols-2">
            {AUTOMATION_DOMAIN_POLICY.map((row) => (
              <OisCard key={row.domain} variant="evidence" className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">{row.label}</h3>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">{row.advisory}</p>
                  </div>
                  <Status value={row.ceiling === "AUTO_ALLOWED" ? "Auto-allowed (narrow)" : "Manual only"} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {row.requiredPermissions.map((permission) => (
                    <span key={permission} className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-zinc-300">{permission}</span>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-5 text-zinc-500">{row.ceilingNote}</p>
                {row.hardBlocked ? <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-amber-300/80">Double-enforced: also hard-blocked at the safety-check layer</p> : null}
              </OisCard>
            ))}
          </div>
        </Panel>
      </div>
      <div className="space-y-5">
        <Panel title="Automatic Execution" subtitle="Domains that may ever run without an operator click.">
          {autoAllowed.length ? (
            <div className="space-y-2 text-sm text-zinc-400">
              {autoAllowed.map((row) => <Field key={row.domain} label={row.label} value={row.ceilingNote} />)}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">No domain currently reaches automatic execution.</p>
          )}
        </Panel>
        <Panel title="Universal Safety Rules" subtitle="Enforced for every domain and every recommendation, regardless of role.">
          <div className="space-y-2 text-sm text-zinc-400">
            <Field label="Permission boundaries" value="Never bypassed or granted implicitly." />
            <Field label="Irreversible actions" value="Never auto-executed, resident-facing or otherwise." />
            <Field label="Approval-flagged items" value="Always require explicit operator approval before any step." />
            <Field label="Automatic execution" value="Where reachable at all, remains low-risk, internal and reversible." />
          </div>
        </Panel>
        <Panel title="Scope" subtitle="What has been implemented and what remains deliberately out of scope.">
          <p className="text-sm leading-6 text-zinc-400">Phase 3 (Milestone 1) added a real operational Automation workspace (see the link above) and server-enforced execution for three domains only: visitor access, maintenance work orders, and device control -- every action defaults to approval-required, never automatic, unless this Facility explicitly opts in (no such override exists yet). Finance, Community, Utilities beyond basic device control, Environment, and Security beyond visitor/lockdown remain observation/recommendation-only by design, matching this platform's own existing safety boundary.</p>
        </Panel>
      </div>
    </section>
  );
}

function IntegrationsSection({ rows, infra }: { rows: Array<{ name: string; status: string; detail: string }>; infra: Source<InfrastructureOperations | null> }) {
  return <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]"><Panel title="Integration Readiness" subtitle="Provider readiness without exposing secrets or unsupported connection states."><div className="grid gap-3 lg:grid-cols-2">{rows.map((item) => <OisCard key={item.name} variant="evidence" className="p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-white">{item.name}</h3><p className="mt-2 text-xs leading-5 text-zinc-500">{item.detail}</p></div><Status value={item.status} /></div></OisCard>)}</div></Panel><Panel title="Provider Source" subtitle="Backend provider and Edge source availability."><div className="space-y-2 text-sm text-zinc-400"><Field label="Infrastructure source" value={infra.status === "ready" ? "Available" : sourceLabel(infra)} /><Field label="Provider sync" value={infra.data?.sources?.providers?.available ? "Connected" : "Pending readiness"} /><Field label="Oyi Edge" value={infra.data?.edge_nodes?.length ? `${infra.data.edge_nodes.length} node(s)` : "Pending readiness"} /></div></Panel></section>;
}

function NotificationsSection({ notifications, push }: { notifications: Source<AlertItem[]>; push: Source<any> }) {
  return <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]"><Panel title="Notification Controls" subtitle="Push, email and SMS readiness. Delivery metrics are shown only when a backend source exists."><div className="grid gap-3 lg:grid-cols-2"><Field label="Unread notifications" value={notifications.status === "ready" ? String(notifications.data.length) : sourceLabel(notifications)} /><Field label="Push readiness" value={push.status === "ready" ? "Readiness source loaded" : sourceLabel(push, "Pending readiness")} /><Field label="Email readiness" value="Pending readiness" /><Field label="SMS readiness" value="Pending readiness" /><Field label="APNs" value={`${readinessStatus(push.data, "APNs")} · ${readinessDetail(push.data, "APNs")}`} /><Field label="FCM" value={`${readinessStatus(push.data, "FCM")} · ${readinessDetail(push.data, "FCM")}`} /></div></Panel><Panel title="Notification Activity" subtitle="Readiness inspection only until provider readiness contracts exist."><p className="text-sm leading-6 text-zinc-400">Provider state is displayed from available readiness sources. Delivery counts, delivery success rates and campaign metrics are not shown because no Facility delivery analytics contract is available.</p></Panel></section>;
}

function SecuritySection({ userRole, canSettings, canAudit, audit, operators }: { userRole: string; canSettings: boolean; canAudit: boolean; audit: Source<any[]>; operators: Source<EstateMembershipRow[]> }) {
  return <section className="grid gap-5 xl:grid-cols-2"><Panel title="Security Policies" subtitle="Authentication, session, role and operator posture."><div className="grid gap-3 sm:grid-cols-2"><Field label="Authentication posture" value="JWT-protected Facility routes" /><Field label="Session posture" value="Cookie/local token cleared on logout by protected shell" /><Field label="Operator access" value={operators.status === "ready" ? `${operators.data.length} Facility team memberships` : sourceLabel(operators)} /><Field label="Current operator role" value={userRole.replace(/_/g, " ")} /><Field label="Control permission" value={canSettings ? "settings.manage available" : "Permission required"} /><Field label="Audit permission" value={canAudit ? "audit.read available" : "Permission required"} /></div></Panel><Panel title="Security Activity" subtitle="Audit-backed security visibility."><p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-zinc-500">{audit.status === "ready" ? `${audit.data.length} audit entries loaded. Use Audit tab for filtering.` : sourceLabel(audit, "Awaiting security event source")}</p></Panel></section>;
}

// Phase 2 commercial-hardening -- Facility Profile is now genuinely
// editable (PATCH /facility/estates/:estateId) for customer-editable
// metadata. Branding/logo needs file-storage infrastructure this pass
// doesn't build (flagged as a P1 gap in the final report) -- shown
// honestly as unavailable rather than a disabled fake control. There is
// still no commercial/deployment/subscription field on `estates` at all
// (confirmed by audit), so there is nothing Office-owned to accidentally
// expose as editable here.
function EstateSettingsSection({ estate, source, canSettings, onSaved }: { estate: any; source: Source<any[]>; canSettings: boolean; onSaved: () => void }) {
  const [form, setForm] = useState({ name: "", type: "", address: "", timezone: "", contact_email: "", contact_phone: "" });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!estate) return;
    setForm({
      name: estate.name || "",
      type: estate.type || "",
      address: estate.address || "",
      timezone: estate.timezone || "",
      contact_email: estate.contact_email || "",
      contact_phone: estate.contact_phone || "",
    });
    setDirty(false);
  }, [estate?.id, estate?.name, estate?.type, estate?.address, estate?.timezone, estate?.contact_email, estate?.contact_phone]);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setSaved(false);
  }

  async function save() {
    if (!estate?.id) return;
    setSaving(true);
    setError(null);
    try {
      await facilityService.updateEstateProfile(estate.id, {
        name: form.name.trim() || undefined,
        type: form.type.trim() || undefined,
        address: form.address.trim(),
        timezone: form.timezone.trim(),
        contact_email: form.contact_email.trim(),
        contact_phone: form.contact_phone.trim(),
      });
      setDirty(false);
      setSaved(true);
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Unable to save Facility profile.");
    } finally {
      setSaving(false);
    }
  }

  if (source.status !== "ready") return <Panel title="Facility Profile" subtitle="Facility control source"><p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-zinc-500">{sourceLabel(source)}</p></Panel>;

  const inputClass = "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-sky-400/40 disabled:opacity-50";

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Panel title="Facility Profile" subtitle="Customer-editable identity and location. Commercial/deployment status remains Ochiga-controlled (see Deployment).">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-zinc-500">Facility name<input className={inputClass} value={form.name} disabled={!canSettings} onChange={(e) => set("name", e.target.value)} /></label>
          <label className="text-xs text-zinc-500">Type<input className={inputClass} value={form.type} disabled={!canSettings} onChange={(e) => set("type", e.target.value)} /></label>
          <label className="text-xs text-zinc-500 sm:col-span-2">Address<input className={inputClass} value={form.address} disabled={!canSettings} onChange={(e) => set("address", e.target.value)} /></label>
          <label className="text-xs text-zinc-500">Timezone<input className={inputClass} value={form.timezone} disabled={!canSettings} placeholder="e.g. Africa/Lagos" onChange={(e) => set("timezone", e.target.value)} /></label>
          <label className="text-xs text-zinc-500">Contact email<input className={inputClass} value={form.contact_email} disabled={!canSettings} onChange={(e) => set("contact_email", e.target.value)} /></label>
          <label className="text-xs text-zinc-500">Contact phone<input className={inputClass} value={form.contact_phone} disabled={!canSettings} onChange={(e) => set("contact_phone", e.target.value)} /></label>
          <Field label="Logo" value="Not yet supported -- requires file storage." />
        </div>
        {error ? <p className="mt-3 text-xs text-rose-300">{error}</p> : null}
        {canSettings ? (
          <div className="mt-4 flex items-center gap-2">
            <Button disabled={!dirty || saving} onClick={() => void save()}>{saving ? "Saving..." : "Save changes"}</Button>
            {saved ? <span className="text-xs text-emerald-300">Saved.</span> : null}
          </div>
        ) : null}
      </Panel>
      <Panel title="Readiness" subtitle="Edit permission and what remains unsupported.">
        <div className="space-y-3 text-sm text-zinc-400">
          <Field label="Edit permission" value={canSettings ? "settings.manage available" : "Permission required: settings.manage"} />
          <Field label="Branding / logo" value="Pending file-storage support" />
          <Field label="Communication readiness" value="Pending backend support" />
          <Field label="Access readiness" value="Owned through Homes/Members access workflows" />
        </div>
      </Panel>
    </section>
  );
}

// PHASE 3 UX closure -- consolidates the former standalone /account page
// into a single tab here rather than a duplicate administrative
// workspace. Moves real functionality (password change, notification
// preferences) unchanged; drops raw technical-ID exposure (user/estate
// UUIDs were previously shown as primary content). Adds real avatar
// upload/remove, reusing the canonical identity/media architecture
// already shipped for Oyi Consumer (GET /me/context, POST/DELETE
// /me/profile/avatar, Supabase Storage bucket "profile-avatars") -- no
// second avatar system.
const NOTIFICATION_CATEGORY_LABEL: Record<NotificationCategory, { title: string; detail: string }> = {
  security: { title: "Security", detail: "Alarms, motion, access anomalies." },
  visitors: { title: "Visitors", detail: "Approvals and access-window changes." },
  maintenance: { title: "Maintenance", detail: "Work order updates." },
  services: { title: "Services", detail: "Utility and service-provider events." },
  wallet: { title: "Wallet", detail: "Payments and balance changes." },
  proximity: { title: "Proximity", detail: "Location/geofence-based signals." },
  devices: { title: "Devices", detail: "Device status and connectivity." },
  automation: { title: "Automation", detail: "Oyi automation recommendations and actions." },
  community: { title: "Community", detail: "Notices and moderation activity." },
  intelligence: { title: "Intelligence", detail: "Oyi insights and digests." },
};
const NOTIFICATION_CATEGORY_ORDER: NotificationCategory[] = [
  "security", "visitors", "maintenance", "services", "wallet", "devices", "automation", "community", "intelligence", "proximity",
];

function MyProfileSection({ estateName }: { estateName: string | null }) {
  const { user, patchUser, clear } = useSessionStore() as any;

  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [loadingPreferences, setLoadingPreferences] = useState(true);
  const [savingCategory, setSavingCategory] = useState<NotificationCategory | null>(null);
  const [prefError, setPrefError] = useState<string | null>(null);

  const [passwordStep, setPasswordStep] = useState<"idle" | "code_sent" | "done">("idle");
  const [passwordCode, setPasswordCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    notificationService
      .preferences()
      .then((items) => setPreferences(items || []))
      .catch(() => setPreferences([]))
      .finally(() => setLoadingPreferences(false));
  }, []);

  function preferenceFor(category: NotificationCategory) {
    return preferences.find((item) => item.category === category);
  }

  async function togglePreferenceChannel(category: NotificationCategory, channel: "push_enabled" | "in_app_enabled", next: boolean) {
    setSavingCategory(category);
    setPrefError(null);
    try {
      const updated = await notificationService.updatePreference(category, { [channel]: next });
      setPreferences((current) => [...current.filter((item) => item.category !== category), updated]);
    } catch (err: any) {
      setPrefError(err?.response?.data?.error || err?.message || "Could not update that preference.");
    } finally {
      setSavingCategory(null);
    }
  }

  async function onAvatarPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setAvatarError("Choose an image file."); return; }
    if (file.size > 6 * 1024 * 1024) { setAvatarError("Image must be 6MB or smaller."); return; }
    setAvatarBusy(true);
    setAvatarError(null);
    try {
      const res = await authService.uploadMyAvatar(file);
      if (!res.ok) { setAvatarError(res.error || "Unable to upload your photo."); return; }
      const url = res.avatar_url || res.profile_image_url || res.user?.avatar_url || res.profile?.avatar_url;
      patchUser({ avatar_url: url || null, profile_image_url: url || null });
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeAvatar() {
    setAvatarBusy(true);
    setAvatarError(null);
    try {
      const res = await authService.removeMyAvatar();
      if (!res.ok) { setAvatarError(res.error || "Unable to remove your photo."); return; }
      patchUser({ avatar_url: null, profile_image_url: null });
    } finally {
      setAvatarBusy(false);
    }
  }

  async function sendPasswordResetCode() {
    if (!user?.email) return;
    setPasswordBusy(true);
    setPasswordError(null);
    try {
      const res = await authService.requestPasswordReset(user.email);
      if (!res.ok) { setPasswordError(res.error || "Unable to send a reset code."); return; }
      setPasswordStep("code_sent");
    } finally {
      setPasswordBusy(false);
    }
  }

  async function completePasswordChange() {
    if (!user?.email) return;
    setPasswordBusy(true);
    setPasswordError(null);
    try {
      const res = await authService.completePasswordReset(user.email, passwordCode.trim(), newPassword);
      if (!res.ok) { setPasswordError(res.error || "Unable to update your password."); return; }
      setPasswordStep("done");
      setPasswordCode("");
      setNewPassword("");
    } finally {
      setPasswordBusy(false);
    }
  }

  async function signOut() {
    await cleanupFacilityPushRegistration();
    clear();
    window.location.href = "/login";
  }

  const avatarUrl = user?.avatar_url || user?.profile_image_url || null;
  const displayName = user?.full_name || user?.username || user?.email?.split("@")[0] || "Facility user";
  const roleLabel = String(user?.role || "operator").replace(/_/g, " ");

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        <Panel title="My Profile" subtitle="Your identity, contact details and photo.">
          <div className="flex items-center gap-4">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-16 w-16 rounded-full border border-white/10 object-cover" />
            ) : (
              <div className="grid h-16 w-16 place-items-center rounded-full border border-sky-400/20 bg-sky-600/20 text-lg font-semibold text-zinc-100">
                {displayName.trim().slice(0, 1).toUpperCase() || "U"}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-200 hover:bg-white/10">
                <Camera className="h-3.5 w-3.5" />
                {avatarBusy ? "Working..." : avatarUrl ? "Replace photo" : "Upload photo"}
                <input type="file" accept="image/*" className="hidden" disabled={avatarBusy} onChange={(event) => void onAvatarPick(event)} />
              </label>
              {avatarUrl ? (
                <Button variant="ghost" disabled={avatarBusy} onClick={() => void removeAvatar()} className="gap-2 text-rose-300">
                  <Trash2 className="h-3.5 w-3.5" />Remove
                </Button>
              ) : null}
            </div>
          </div>
          {avatarError ? <p className="mt-3 text-xs text-rose-300">{avatarError}</p> : null}
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Field label="Name" value={displayName} />
            <Field label="Email" value={user?.email || "Unavailable"} />
            <Field label="Phone" value={user?.phone || "Not provided"} />
            <Field label="Role" value={<OisStatusBadge status="stable" label={roleLabel} />} />
            <Field label="Facility" value={estateName || "Loading..."} />
          </div>
        </Panel>

        <Panel title="Account Security" subtitle="Password and session.">
          {passwordStep === "idle" ? (
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
              <p className="text-sm text-white">Change password</p>
              <p className="mt-1 text-xs leading-5 text-zinc-500">We'll send a one-time code to {user?.email || "your account email"}.</p>
              <Button className="mt-3" variant="ghost" disabled={passwordBusy || !user?.email} onClick={() => void sendPasswordResetCode()}>
                {passwordBusy ? "Sending..." : "Send code"}
              </Button>
            </div>
          ) : passwordStep === "code_sent" ? (
            <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
              <p className="text-sm text-white">Enter the code and your new password</p>
              <input value={passwordCode} onChange={(event) => setPasswordCode(event.target.value)} placeholder="6-digit code" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-sky-400/40" />
              <input value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="New password" type="password" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-sky-400/40" />
              {passwordError ? <p className="text-xs text-rose-300">{passwordError}</p> : null}
              <div className="flex gap-2">
                <Button disabled={passwordBusy || !passwordCode.trim() || newPassword.length < 8} onClick={() => void completePasswordChange()}>{passwordBusy ? "Updating..." : "Update password"}</Button>
                <Button variant="ghost" onClick={() => { setPasswordStep("idle"); setPasswordError(null); }}>Cancel</Button>
              </div>
            </div>
          ) : (
            <Field label="Password" value="Updated." />
          )}
        </Panel>

        <Panel title="Notifications" subtitle="Real, server-persisted delivery preferences by category.">
          {loadingPreferences ? (
            <p className="text-xs text-zinc-500">Loading preferences...</p>
          ) : preferences.length === 0 ? (
            <p className="text-xs text-zinc-500">Notification preferences are unavailable right now.</p>
          ) : (
            <div className="space-y-2">
              {NOTIFICATION_CATEGORY_ORDER.map((category) => {
                const pref = preferenceFor(category);
                const label = NOTIFICATION_CATEGORY_LABEL[category];
                const saving = savingCategory === category;
                return (
                  <div key={category} className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-white">{label.title}</p>
                        <p className="mt-1 text-xs leading-5 text-zinc-500">{label.detail}</p>
                      </div>
                      {pref?.critical_only ? <OisStatusBadge status="warning" label="Critical only" /> : null}
                    </div>
                    <div className="mt-3 flex gap-4">
                      <label className="flex items-center gap-2 text-xs text-zinc-300">
                        <input type="checkbox" checked={Boolean(pref?.in_app_enabled)} disabled={saving} onChange={(event) => void togglePreferenceChannel(category, "in_app_enabled", event.target.checked)} />
                        In-app
                      </label>
                      <label className="flex items-center gap-2 text-xs text-zinc-300">
                        <input type="checkbox" checked={Boolean(pref?.push_enabled)} disabled={saving} onChange={(event) => void togglePreferenceChannel(category, "push_enabled", event.target.checked)} />
                        Push
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {prefError ? <p className="mt-2 text-xs text-rose-300">{prefError}</p> : null}
        </Panel>
      </div>

      <div className="space-y-5">
        <Panel title="Danger Zone" subtitle="Session and account-level actions.">
          <div className="space-y-3">
            <div>
              <Button variant="danger" onClick={() => void signOut()}>Sign out</Button>
            </div>
            {/* Honest disclosure: there is no canonical self-service
               "leave Facility" or "delete account" capability today --
               removing a membership requires staff.manage and explicitly
               blocks self-mutation (see estateUsers.controller.ts). Showing
               a working button here would be fake. Contact an
               administrator for these actions instead. */}
            <p className="text-xs leading-5 text-zinc-500">Leaving this Facility or deleting your account isn't self-service yet. Contact a Facility Administrator for these actions.</p>
          </div>
        </Panel>
      </div>
    </section>
  );
}
