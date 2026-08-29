"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Camera,
  ChevronRight,
  Eye,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import OisCard from "@/components/ois/OisCard";
import OisStatusBadge from "@/components/ois/OisStatusBadge";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import FacilityMetricCard from "@/components/ois/FacilityMetricCard";
import { facilityService, type EstateMembershipRow, type InfrastructureOperations, type AutomationActionPolicy } from "@/services/facilityService";
import { notificationService, type AlertItem, type NotificationPreference, type NotificationCategory } from "@/services/notificationService";
import { authService } from "@/services/authService";
import { cleanupFacilityPushRegistration } from "@/services/pushRegistrationService";
import { hasPermission, PERMISSION_KEYS, permissionsForRole } from "@/lib/oyiFoundation";
import { iconForTab } from "@/lib/oisIconRegistry";
import { useSessionStore } from "@/store/useSessionStore";

// Final Facility commercial UX closure -- this workspace is the
// administrative control plane (governance), distinct from the
// operational modules it sits alongside. "My Profile" and "Facility
// Profile" are consolidated into one Profile tab; the old text-only KPI
// strip is replaced with the compact metric-card language already used
// across Buildings/Assets/Utilities/Maintenance/Automation; large cards
// are reserved for genuine summaries -- registries (Operators, Roles,
// Permissions, Audit, Automation policy, Integrations) use compact tables.
type Tab = "profile" | "operators" | "roles" | "permissions" | "audit" | "automation" | "integrations" | "notifications" | "security";
type LoadStatus = "loading" | "ready" | "error" | "permission";
type Source<T> = { status: LoadStatus; data: T; message?: string };
type Detail = { title: string; subtitle?: string; rows: Array<[string, string]>; href?: string };

const TABS: Array<{ key: Tab; label: string; icon: typeof Users }> = [
  { key: "profile", label: "Profile", icon: iconForTab("profile") },
  { key: "operators", label: "Operators", icon: iconForTab("operators") },
  { key: "roles", label: "Roles", icon: iconForTab("roles") },
  { key: "permissions", label: "Permissions", icon: iconForTab("permissions") },
  { key: "audit", label: "Audit", icon: iconForTab("audit") },
  { key: "automation", label: "Automation", icon: iconForTab("automation") },
  { key: "integrations", label: "Integrations", icon: iconForTab("integrations") },
  { key: "notifications", label: "Notifications", icon: iconForTab("notifications") },
  { key: "security", label: "Security", icon: iconForTab("security") },
];

const ROLE_DEFINITIONS = [
  { key: "estate_admin", label: "Facility Owner", description: "Owns Facility-level governance, homes, staff, residents and operational continuity.", inheritance: "Top Facility role", scope: "Facility-wide" },
  { key: "facility_manager", label: "Facility Manager", description: "Runs daily facility operations across homes, staff, support, residents and devices.", inheritance: "Operational manager", scope: "Facility-wide" },
  { key: "security_operator", label: "Security Operator", description: "Handles visitors, gate access, cameras, incidents and security workflows.", inheritance: "Security-focused", scope: "Facility/security domains" },
  { key: "maintenance_operator", label: "Maintenance Operator", description: "Handles maintenance, support tickets, device posture and resident service workflows.", inheritance: "Support-focused", scope: "Maintenance/support domains" },
  { key: "finance_operator", label: "Finance Operator", description: "Handles wallet, payment and finance operations where enabled.", inheritance: "Finance-focused", scope: "Wallet/service domains" },
  { key: "ochiga_staff", label: "Ochiga Staff", description: "Ochiga support staff with read/support/moderation visibility but not full Facility ownership.", inheritance: "Platform staff", scope: "Support-limited" },
];

// Read-only administrative-visibility layer over the existing, already-
// shipped client-side automation-recommendation policy
// (lib/safeAutomationRuntime.ts). Surfaces the ceiling that policy already
// enforces; adds no execution path.
type AutomationCeiling = "AUTO_ALLOWED" | "MANUAL_ONLY";

const AUTOMATION_DOMAIN_POLICY: Array<{
  domain: string;
  label: string;
  requiredPermissions: string[];
  ceiling: AutomationCeiling;
  hardBlocked: boolean;
}> = [
  { domain: "infrastructure", label: "Infrastructure", requiredPermissions: ["devices.control"], ceiling: "MANUAL_ONLY", hardBlocked: false },
  { domain: "security", label: "Security", requiredPermissions: ["support.assign", "notifications.manage"], ceiling: "MANUAL_ONLY", hardBlocked: true },
  { domain: "maintenance", label: "Maintenance", requiredPermissions: ["support.assign"], ceiling: "MANUAL_ONLY", hardBlocked: false },
  { domain: "utility", label: "Utilities", requiredPermissions: ["devices.control"], ceiling: "MANUAL_ONLY", hardBlocked: false },
  { domain: "environmental", label: "Environment", requiredPermissions: ["devices.control"], ceiling: "MANUAL_ONLY", hardBlocked: false },
  { domain: "visitor", label: "Visitors / Access", requiredPermissions: ["visitors.manage"], ceiling: "MANUAL_ONLY", hardBlocked: true },
  { domain: "financial", label: "Finance", requiredPermissions: ["wallets.manage"], ceiling: "MANUAL_ONLY", hardBlocked: true },
  { domain: "community", label: "Community", requiredPermissions: ["community.moderate"], ceiling: "MANUAL_ONLY", hardBlocked: false },
  { domain: "operational_governance", label: "Assets", requiredPermissions: ["support.assign"], ceiling: "AUTO_ALLOWED", hardBlocked: false },
  { domain: "executive", label: "Briefings", requiredPermissions: ["office.read"], ceiling: "MANUAL_ONLY", hardBlocked: false },
];

const ACTION_LABELS: Record<string, string> = {
  "visitor.approve": "Approve visitor",
  "visitor.revoke": "Revoke visitor access",
  "visitor.expire": "Expire visitor access",
  "maintenance.assign": "Assign maintenance",
  "maintenance.complete": "Complete maintenance",
  "maintenance.cancel": "Cancel maintenance",
  "device.on": "Turn device on",
  "device.off": "Turn device off",
  "device.toggle": "Toggle device",
};
function actionLabel(actionId: string) {
  return ACTION_LABELS[actionId] || actionId.replace(/[._]/g, " ");
}
function domainForAction(actionId: string) {
  if (actionId.startsWith("visitor.")) return "Access";
  if (actionId.startsWith("maintenance.")) return "Maintenance";
  if (actionId.startsWith("device.")) return "Assets";
  return actionId.split(".")[0] || "General";
}

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
  if (!value) return "No data yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No data yet";
  return date.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function sourceLabel<T>(item: Source<T>, empty = "Pending source") {
  if (item.status === "loading") return "Loading";
  if (item.status === "permission") return "Permission required";
  if (item.status === "error") return item.message || "Unavailable";
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
  return <OisStatusBadge status={statusTone(value)} label={value} className="uppercase tracking-[0.1em]" />;
}

// Compact administrative registry -- the primary pattern for every
// section below. Cards are reserved for KPIs and genuine summaries.
function Registry({ title, subtitle, toolbar, children }: { title: string; subtitle?: string; toolbar?: React.ReactNode; children: React.ReactNode }) {
  return (
    <OisCard className="overflow-hidden">
      <header className="flex flex-wrap items-start justify-between gap-3 px-4 pb-3 pt-4">
        <div>
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          {subtitle ? <p className="mt-1 text-xs leading-5 text-zinc-500">{subtitle}</p> : null}
        </div>
        {toolbar}
      </header>
      {children}
    </OisCard>
  );
}

function Table({ columns, children }: { columns: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto border-t border-white/[0.06]">
      <table className="w-full min-w-[720px] text-left">
        <thead>
          <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.08em] text-zinc-500">
            {columns.map((column) => <th key={column} className="px-4 py-2.5 font-medium">{column}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <tr className="border-b border-white/[0.04] text-[12.5px] text-zinc-300 last:border-0 hover:bg-white/[0.02]">{children}</tr>;
}
function Cell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;
}
function Empty({ text: message, colSpan }: { text: string; colSpan: number }) {
  return <tr><td colSpan={colSpan} className="px-4 py-8 text-center text-sm text-zinc-500">{message}</td></tr>;
}
function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-xl border border-white/10 bg-black/15 px-3 py-3"><p className="text-[10px] uppercase tracking-[0.1em] text-zinc-500">{label}</p><div className="mt-1 text-sm text-zinc-100">{value}</div></div>;
}

function operatorName(member: EstateMembershipRow) {
  const user = member.users || ({} as any);
  return user.full_name || user.username || user.email || "Operator";
}
function operatorEmail(member: EstateMembershipRow) {
  return member.users?.email || "Email unavailable";
}
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "U";
  return parts.length === 1 ? parts[0].slice(0, 1).toUpperCase() : (parts[0][0] + parts[1][0]).toUpperCase();
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
  if (!check) return "Setup required";
  if (lower(check.status) === "healthy") return "Connected";
  if (lower(check.status) === "missing") return "Setup required";
  return text(check.status, "Setup required");
}
function readinessDetail(data: any, name: string) {
  return text(readinessCheck(data, name)?.detail, "No readiness source available.");
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
  const attentionCount = suspendedOperators.length + pendingOperators.length;

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
      { name: "Tuya / Smart Life", category: "Device provider", status: tuya ? text(tuya.status || tuya.connection_status, "Connected") : "Setup required", lastSync: tuya ? text(tuya.last_sync_at || tuya.updated_at, "No data yet") : "No data yet", detail: tuya ? "Connected device provider." : "Provider readiness flows through device provider sync." },
      { name: "Oyi Edge", category: "Infrastructure", status: edgeNodes.length ? "Connected" : "Setup required", lastSync: "No data yet", detail: edgeNodes.length ? `${edgeNodes.length} node(s) registered` : "Awaiting Edge registration and heartbeat." },
      { name: "Camera providers", category: "Camera", status: cameraSource?.available ? "Connected" : "Unavailable", lastSync: "No data yet", detail: cameraSource?.reason || "Camera source appears when ONVIF/Edge cameras are bound." },
      { name: "APNs", category: "Push", status: readinessStatus(pushReadiness.data, "APNs"), lastSync: "No data yet", detail: readinessDetail(pushReadiness.data, "APNs") },
      { name: "FCM", category: "Push", status: readinessStatus(pushReadiness.data, "FCM"), lastSync: "No data yet", detail: readinessDetail(pushReadiness.data, "FCM") },
    ];
  }, [infra.data, pushReadiness]);

  const roleRows = ROLE_DEFINITIONS.map((role) => ({ ...role, permissions: permissionsForRole(role.key) }));
  const estate = estates.data[0] || null;

  const kpis = [
    { icon: <Users />, label: "Operators", value: operators.status === "ready" ? operators.data.length : "—", detail: "Facility access", accent: "text-sky-400" },
    { icon: <UserCheck />, label: "Active", value: operators.status === "ready" ? activeOperators.length : "—", detail: "Available now", accent: "text-emerald-400" },
    { icon: <AlertTriangle />, label: "Attention", value: operators.status === "ready" ? attentionCount : "—", detail: "Needs review", accent: attentionCount ? "text-amber-400" : "text-zinc-400" },
    { icon: <Activity />, label: "Audit Events", value: audit.status === "ready" ? audit.data.length : sourceLabel(audit, "—"), detail: "Recorded activity", accent: "text-violet-400" },
    { icon: <ShieldCheck />, label: "Access Health", value: attentionCount ? "Review" : "Stable", detail: attentionCount ? `${attentionCount} item(s)` : "All clear", accent: attentionCount ? "text-amber-400" : "text-emerald-400" },
  ];

  return (
    <div className="space-y-5">
      <Topbar title="Facility" subtitle="Manage your Facility identity, people, access and operating policies." />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((kpi) => <FacilityMetricCard key={kpi.label} icon={kpi.icon} label={kpi.label} value={kpi.value} detail={kpi.detail} accent={kpi.accent} />)}
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => <button key={item.key} type="button" onClick={() => setTab(item.key)} className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs transition ${tab === item.key ? "border-sky-400/35 bg-sky-500/10 text-sky-100" : "border-white/10 bg-white/5 text-zinc-400 hover:text-white"}`}><item.icon className="h-3.5 w-3.5" />{item.label}</button>)}
      </div>

      {["operators", "audit"].includes(tab) ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
          <Search className="h-4 w-4 text-zinc-500" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tab === "audit" ? "Search audit entries..." : "Search operators..."} className="min-w-[220px] flex-1 bg-transparent text-sm text-white outline-none" />
          {tab === "audit" ? <select value={auditFilter} onChange={(event) => setAuditFilter(event.target.value)} className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs text-white"><option value="all">All domains</option>{AUDIT_DOMAINS.map((domain) => <option key={domain} value={domain}>{domain}</option>)}</select> : null}
        </div>
      ) : null}

      {tab === "profile" ? <ProfileSection estate={estate} estateSource={estates} canSettings={canSettings} onSaved={load} /> : null}
      {tab === "operators" ? <OperatorsSection operators={filteredOperators} source={operators} invites={invites} canManage={canManageStaff} userRole={user?.role || ""} onOpen={setDetail} onReload={load} /> : null}
      {tab === "roles" ? <RolesSection roles={roleRows} onOpen={setDetail} /> : null}
      {tab === "permissions" ? <PermissionsSection roles={roleRows} /> : null}
      {tab === "audit" ? <AuditSection source={audit} rows={filteredAudit} onOpen={setDetail} /> : null}
      {tab === "automation" ? <AutomationSection /> : null}
      {tab === "integrations" ? <IntegrationsSection rows={integrations} onOpen={setDetail} /> : null}
      {tab === "notifications" ? <NotificationsSection push={pushReadiness} /> : null}
      {tab === "security" ? <SecuritySection userRole={user?.role || "operator"} canSettings={canSettings} canAudit={canAudit} audit={audit} operators={operators} /> : null}

      {detail ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm" onClick={() => setDetail(null)}>
          <section className="w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-950 p-5" onClick={(event) => event.stopPropagation()}>
            <header className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Details</p>
                <h2 className="mt-1 text-lg font-semibold text-white">{detail.title}</h2>
                {detail.subtitle ? <p className="mt-1 text-sm text-zinc-500">{detail.subtitle}</p> : null}
              </div>
              <button type="button" onClick={() => setDetail(null)} className="rounded-lg border border-white/10 p-2 text-zinc-400 hover:text-white"><X className="h-4 w-4" /></button>
            </header>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">{detail.rows.map(([label, value]) => <Field key={label} label={label} value={value} />)}</div>
            {detail.href ? <Link href={detail.href} className="mt-5 inline-flex items-center gap-2 text-sm text-sky-200 hover:text-sky-100">Open <ChevronRight className="h-4 w-4" /></Link> : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------
// OPERATORS
// ---------------------------
const GRANTABLE_ROLES: Array<{ value: string; label: string; minActorRole: string[] }> = [
  { value: "estate_admin", label: "Facility Owner", minActorRole: ["estate_admin"] },
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
      setShowInvite(false);
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

  async function changeRole(member: EstateMembershipRow, role: string) {
    if (!role || role === member.role) return;
    setRowBusy(member.id);
    try {
      await facilityService.updateEstateUser(member.id, { role });
      onReload();
    } catch (err: any) {
      window.alert(err?.response?.data?.error || err?.message || "Unable to update this team member's role.");
    } finally {
      setRowBusy(null);
    }
  }

  async function removeOperator(member: EstateMembershipRow) {
    if (!window.confirm(`Remove ${operatorName(member)} from this Facility?`)) return;
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

  return (
    <section className="space-y-4">
      <Registry
        title="Operators"
        subtitle="People with authorized access to this Facility's operating environment."
        toolbar={canManage ? <Button onClick={() => setShowInvite((v) => !v)}>{showInvite ? "Cancel" : "Invite Operator"}</Button> : undefined}
      >
        {showInvite ? (
          <div className="border-t border-white/[0.06] p-4">
            <div className="grid gap-2 sm:grid-cols-[1fr_200px_auto]">
              <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Email" className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-sky-400/40" />
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white">
                <option value="">Select a role</option>
                {grantable.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <Button disabled={inviteBusy || !inviteEmail.trim() || !inviteRole} onClick={() => void sendInvite()}>{inviteBusy ? "Sending..." : "Send invite"}</Button>
            </div>
            {inviteError ? <p className="mt-2 text-xs text-rose-300">{inviteError}</p> : null}
          </div>
        ) : null}
        {inviteResult ? <p className="border-t border-white/[0.06] px-4 py-2 text-xs text-emerald-300">{inviteResult}</p> : null}

        {source.status !== "ready" ? (
          <Table columns={["Operator", "Role", "Scope", "Status", "Actions"]}><Empty text={sourceLabel(source, "Awaiting activity source")} colSpan={5} /></Table>
        ) : (
          <Table columns={["Operator", "Role", "Scope", "Status", "Actions"]}>
            {operators.map((member) => {
              const name = operatorName(member);
              return (
                <Row key={member.id}>
                  <Cell>
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-sky-400/20 bg-sky-600/20 text-[10px] font-semibold text-zinc-100">{initials(name)}</span>
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px] font-medium text-zinc-100">{name}</p>
                        <p className="truncate text-[11px] text-zinc-500">{operatorEmail(member)}</p>
                      </div>
                    </div>
                  </Cell>
                  <Cell>
                    {canManage && grantableRolesFor(userRole).length ? (
                      <select value={member.role || ""} disabled={rowBusy === member.id} onChange={(e) => void changeRole(member, e.target.value)} className="rounded-md border border-white/10 bg-zinc-900 px-2 py-1 text-xs text-zinc-200">
                        <option value={member.role}>{String(member.role || "operator").replace(/_/g, " ")}</option>
                        {grantableRolesFor(userRole).filter((r) => r.value !== member.role).map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    ) : (
                      <span className="capitalize text-zinc-400">{String(member.role || "operator").replace(/_/g, " ")}</span>
                    )}
                  </Cell>
                  <Cell className="text-zinc-500">Facility</Cell>
                  <Cell><Status value={member.status || "unknown"} /></Cell>
                  <Cell>
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={() => onOpen({ title: name, subtitle: operatorEmail(member), rows: [["Role", member.role || "operator"], ["Status", member.status || "unknown"], ["Assigned scope", "Facility scope"]], href: "/homes" })} className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-zinc-300 hover:bg-white/5"><Eye className="mr-1 inline h-3 w-3" />Inspect</button>
                      {canManage ? <button type="button" disabled={rowBusy === member.id} onClick={() => void removeOperator(member)} className="rounded-md border border-rose-500/20 px-2 py-1 text-[11px] text-rose-300 hover:bg-rose-500/10">Remove</button> : null}
                    </div>
                  </Cell>
                </Row>
              );
            })}
            {!operators.length ? <Empty text="No operators found." colSpan={5} /> : null}
          </Table>
        )}
      </Registry>

      <Registry title="Pending Invitations" subtitle="Invited but not yet activated.">
        {invites.status !== "ready" ? (
          <Table columns={["Email", "Role", "Expires", "Actions"]}><Empty text={sourceLabel(invites, "No invitations")} colSpan={4} /></Table>
        ) : (
          <Table columns={["Email", "Role", "Expires", "Actions"]}>
            {pendingInvites.map((invite) => (
              <Row key={invite.id}>
                <Cell>{invite.invited_email}</Cell>
                <Cell className="capitalize text-zinc-400">{String(invite.role || "").replace(/_/g, " ")}</Cell>
                <Cell className="text-zinc-500">{dateLabel(invite.expires_at)}</Cell>
                <Cell>
                  {canManage ? (
                    <div className="flex items-center gap-1.5">
                      <button type="button" disabled={rowBusy === invite.id} onClick={() => void resend(invite.id)} className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-zinc-300 hover:bg-white/5">Resend</button>
                      <button type="button" disabled={rowBusy === invite.id} onClick={() => void revoke(invite.id)} className="rounded-md border border-rose-500/20 px-2 py-1 text-[11px] text-rose-300 hover:bg-rose-500/10">Revoke</button>
                    </div>
                  ) : null}
                </Cell>
              </Row>
            ))}
            {!pendingInvites.length ? <Empty text="No pending invitations." colSpan={4} /> : null}
          </Table>
        )}
      </Registry>
    </section>
  );
}

// ---------------------------
// ROLES
// ---------------------------
function RolesSection({ roles, onOpen }: { roles: Array<typeof ROLE_DEFINITIONS[number] & { permissions: string[] }>; onOpen: (detail: Detail) => void }) {
  return (
    <Registry title="Roles" subtitle="Canonical role definitions from the shared permission foundation. Custom role creation is read-only until backend support exists.">
      <Table columns={["Role", "Scope", "Permissions", "Inheritance", "Status", "Action"]}>
        {roles.map((role) => (
          <Row key={role.key}>
            <Cell>
              <p className="font-medium text-zinc-100">{role.label}</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">{role.description}</p>
            </Cell>
            <Cell className="text-zinc-400">{role.scope}</Cell>
            <Cell className="text-zinc-400">{role.permissions.length}</Cell>
            <Cell className="text-zinc-400">{role.inheritance}</Cell>
            <Cell><Status value="Read-only" /></Cell>
            <Cell>
              <button type="button" onClick={() => onOpen({ title: role.label, subtitle: role.description, rows: [["Scope", role.scope], ["Inheritance", role.inheritance], ["Assignment", "Supported through Operators role changes"], ["Custom role editing", "Not yet supported"], ["Permissions", role.permissions.join(", ") || "None"]] })} className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-zinc-300 hover:bg-white/5">Inspect</button>
            </Cell>
          </Row>
        ))}
      </Table>
    </Registry>
  );
}

// ---------------------------
// PERMISSIONS
// ---------------------------
function PermissionsSection({ roles }: { roles: Array<typeof ROLE_DEFINITIONS[number] & { permissions: string[] }> }) {
  const rows = PERMISSION_KEYS.map((key) => {
    const [domain, action] = key.split(".");
    const grantedTo = roles.filter((role) => role.permissions.includes(key)).map((role) => role.label);
    return { key, domain, action, grantedTo };
  });
  return (
    <Registry title="Permissions" subtitle="Access boundaries by domain and action. Server-authoritative -- this view cannot grant platform roles, cross-Facility access, or anything above the current actor's authority.">
      <Table columns={["Permission", "Domain", "Action", "Granted To", "Status"]}>
        {rows.map((row) => (
          <Row key={row.key}>
            <Cell className="font-mono text-[11px] text-zinc-400">{row.key}</Cell>
            <Cell className="capitalize text-zinc-300">{row.domain}</Cell>
            <Cell className="text-zinc-400">{row.action?.replace(/_/g, " ")}</Cell>
            <Cell className="text-zinc-400">{row.grantedTo.length ? row.grantedTo.join(", ") : "No canonical role"}</Cell>
            <Cell><Status value={row.grantedTo.length ? "Active" : "Unassigned"} /></Cell>
          </Row>
        ))}
      </Table>
    </Registry>
  );
}

// ---------------------------
// AUDIT
// ---------------------------
function AuditSection({ source, rows, onOpen }: { source: Source<any[]>; rows: any[]; onOpen: (detail: Detail) => void }) {
  return (
    <Registry title="Audit" subtitle="This Facility's own administrative and security events -- team changes, invitations, profile edits, permission denials.">
      {source.status !== "ready" ? (
        <Table columns={["Actor", "Action", "Domain", "Resource", "Result", "Timestamp"]}><Empty text={sourceLabel(source, "No audit entries")} colSpan={6} /></Table>
      ) : (
        <Table columns={["Actor", "Action", "Domain", "Resource", "Result", "Timestamp"]}>
          {rows.map((item) => (
            <Row key={item.id || `${item.action}-${item.occurred_at}`}>
              <Cell className="text-zinc-300">{item.actor_role || "system"}</Cell>
              <Cell className="text-zinc-100">{item.action || "Audit event"}</Cell>
              <Cell className="capitalize text-zinc-400">{String(item.resource_type || "").split("_")[0] || "general"}</Cell>
              <Cell className="text-zinc-500">{item.resource_id ? String(item.resource_id).slice(0, 8) : "n/a"}</Cell>
              <Cell><Status value={item.status || "recorded"} /></Cell>
              <Cell className="whitespace-nowrap text-zinc-500">
                <button type="button" onClick={() => onOpen({ title: item.action || "Audit event", subtitle: dateLabel(item.occurred_at), rows: [["Actor role", item.actor_role || "system"], ["Resource type", item.resource_type || "n/a"], ["Resource ID", item.resource_id || "n/a"], ["Status", item.status || "recorded"], ["Occurred", dateLabel(item.occurred_at)]] })} className="hover:text-zinc-300">{dateLabel(item.occurred_at)}</button>
              </Cell>
            </Row>
          ))}
          {!rows.length ? <Empty text="No audit entries match this filter." colSpan={6} /> : null}
        </Table>
      )}
    </Registry>
  );
}

// ---------------------------
// AUTOMATION (governance -- distinct from the operational Automation workspace)
// ---------------------------
function AutomationSection() {
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
    <section className="space-y-4">
      <Registry
        title="Automation Permissions"
        subtitle="What Oyi is authorized to do on this Facility's behalf, by action. This governs policy -- it does not run automations. Operate automations from the main Automation workspace."
        toolbar={<Link href="/automation" className="inline-flex items-center gap-1.5 text-sm text-sky-200 hover:text-sky-100">Open Automation Workspace <ChevronRight className="h-3.5 w-3.5" /></Link>}
      >
        {livePolicy.status !== "ready" ? (
          <Table columns={["Action", "Domain", "Current Policy", "Approval", "Auto Execution", "Status"]}><Empty text={sourceLabel(livePolicy)} colSpan={6} /></Table>
        ) : (
          <Table columns={["Action", "Domain", "Current Policy", "Approval", "Auto Execution", "Status"]}>
            {livePolicy.data.map((row) => {
              const requiresApproval = row.executionLevel === "approval_required";
              const autoAllowed = row.executionLevel === "auto_allowed";
              return (
                <Row key={row.actionId}>
                  <Cell>
                    <p className="text-zinc-100">{actionLabel(row.actionId)}</p>
                    <p className="mt-0.5 font-mono text-[10.5px] text-zinc-600">{row.actionId}</p>
                  </Cell>
                  <Cell className="text-zinc-400">{domainForAction(row.actionId)}</Cell>
                  <Cell className="capitalize text-zinc-300">{row.executionLevel.replace(/_/g, " ")}</Cell>
                  <Cell className="text-zinc-400">{requiresApproval ? "Operator" : "—"}</Cell>
                  <Cell><Status value={autoAllowed ? "On" : "Off"} /></Cell>
                  <Cell><Status value={row.executionLevel === "unsupported" ? "Unsupported" : "Active"} /></Cell>
                </Row>
              );
            })}
            {!livePolicy.data.length ? <Empty text="No policy data available." colSpan={6} /> : null}
          </Table>
        )}
      </Registry>

      <div className="grid gap-4 lg:grid-cols-2">
        <OisCard className="p-4">
          <h3 className="text-sm font-semibold text-white">Automatic Execution</h3>
          <p className="mt-2 text-xs leading-5 text-zinc-400">Only explicitly authorized, low-risk actions may execute without operator approval. Every action above defaults to requiring approval unless this Facility has explicitly changed that.</p>
        </OisCard>
        <OisCard className="p-4">
          <h3 className="text-sm font-semibold text-white">Safety Boundary</h3>
          <p className="mt-2 text-xs leading-5 text-zinc-400">Critical, irreversible or resident-impacting actions -- security, access and finance -- always require the configured authorization path and never execute automatically.</p>
        </OisCard>
      </div>
    </section>
  );
}

// ---------------------------
// INTEGRATIONS
// ---------------------------
function IntegrationsSection({ rows, onOpen }: { rows: Array<{ name: string; category: string; status: string; lastSync: string; detail: string }>; onOpen: (detail: Detail) => void }) {
  return (
    <Registry title="Integrations" subtitle="Connected providers and their readiness state.">
      <Table columns={["Integration", "Category", "Connection", "Last Sync", "Action"]}>
        {rows.map((item) => (
          <Row key={item.name}>
            <Cell className="text-zinc-100">{item.name}</Cell>
            <Cell className="text-zinc-400">{item.category}</Cell>
            <Cell><Status value={item.status} /></Cell>
            <Cell className="text-zinc-500">{item.lastSync}</Cell>
            <Cell><button type="button" onClick={() => onOpen({ title: item.name, subtitle: item.category, rows: [["Connection", item.status], ["Last sync", item.lastSync], ["Detail", item.detail]] })} className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-zinc-300 hover:bg-white/5">Inspect</button></Cell>
          </Row>
        ))}
      </Table>
    </Registry>
  );
}

// ---------------------------
// NOTIFICATIONS (Facility-wide delivery readiness; personal preferences live in Profile)
// ---------------------------
function NotificationsSection({ push }: { push: Source<any> }) {
  const rows = [
    { name: "Push delivery", status: push.status === "ready" ? "Ready" : "Setup required", detail: push.status === "ready" ? "Readiness source loaded." : sourceLabel(push, "No readiness source") },
    { name: "APNs", status: readinessStatus(push.data, "APNs"), detail: readinessDetail(push.data, "APNs") },
    { name: "FCM", status: readinessStatus(push.data, "FCM"), detail: readinessDetail(push.data, "FCM") },
    { name: "Email delivery", status: "Setup required", detail: "No canonical readiness source available yet." },
    { name: "SMS delivery", status: "Setup required", detail: "No canonical readiness source available yet." },
  ];
  return (
    <Registry title="Notifications" subtitle="Facility-wide delivery readiness. Your own category preferences (security, visitors, maintenance, automation and more) are managed in Profile.">
      <Table columns={["Channel", "Status", "Detail"]}>
        {rows.map((row) => (
          <Row key={row.name}>
            <Cell className="text-zinc-100">{row.name}</Cell>
            <Cell><Status value={row.status} /></Cell>
            <Cell className="text-zinc-500">{row.detail}</Cell>
          </Row>
        ))}
      </Table>
    </Registry>
  );
}

// ---------------------------
// SECURITY (account/access security administration -- not the operational Security module)
// ---------------------------
function SecuritySection({ userRole, canSettings, canAudit, audit, operators }: { userRole: string; canSettings: boolean; canAudit: boolean; audit: Source<any[]>; operators: Source<EstateMembershipRow[]> }) {
  const rows = [
    { name: "Authentication", value: "JWT-protected Facility routes" },
    { name: "Session handling", value: "Cleared on sign out by the protected shell" },
    { name: "Team access", value: operators.status === "ready" ? `${operators.data.length} Facility team memberships` : sourceLabel(operators) },
    { name: "Your role", value: userRole.replace(/_/g, " ") },
    { name: "Facility Profile control", value: canSettings ? "Available" : "Permission required" },
    { name: "Audit visibility", value: canAudit ? "Available" : "Permission required" },
  ];
  return (
    <section className="space-y-4">
      <Registry title="Security" subtitle="Account and access security for this Facility. Operational incidents, cameras and alarms remain in the main Security module.">
        <Table columns={["Setting", "State"]}>
          {rows.map((row) => (
            <Row key={row.name}>
              <Cell className="text-zinc-100">{row.name}</Cell>
              <Cell className="text-zinc-400">{row.value}</Cell>
            </Row>
          ))}
        </Table>
      </Registry>
      <OisCard className="p-4">
        <p className="text-sm text-zinc-400">Password changes and sign-out live in <Link href="/facility-administration?tab=profile" className="text-sky-200 hover:text-sky-100">Profile</Link>. Recent security-relevant events are visible under <Link href="/facility-administration?tab=audit" className="text-sky-200 hover:text-sky-100">Audit</Link>. {audit.status === "ready" ? `${audit.data.length} entries recorded.` : ""}</p>
      </OisCard>
    </section>
  );
}

// ---------------------------
// PROFILE (consolidated: Facility Information + Current Operator/Account)
// ---------------------------
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

function ProfileSection({ estate, estateSource, canSettings, onSaved }: { estate: any; estateSource: Source<any[]>; canSettings: boolean; onSaved: () => void }) {
  const { user, patchUser, clear } = useSessionStore() as any;

  const [form, setForm] = useState({ name: "", type: "", address: "", timezone: "", contact_email: "", contact_phone: "" });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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

  useEffect(() => {
    notificationService
      .preferences()
      .then((items) => setPreferences(items || []))
      .catch(() => setPreferences([]))
      .finally(() => setLoadingPreferences(false));
  }, []);

  function setField<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setSaved(false);
  }

  async function saveFacility() {
    if (!estate?.id) return;
    setSaving(true);
    setSaveError(null);
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
      setSaveError(err?.response?.data?.error || err?.message || "Unable to save Facility profile.");
    } finally {
      setSaving(false);
    }
  }

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
  const inputClass = "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-sky-400/40 disabled:opacity-50";

  return (
    <section className="grid gap-4 xl:grid-cols-2">
      <div className="space-y-4">
        <OisCard className="p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-white">Current Operator</h2>
          <p className="mt-1 text-xs leading-5 text-zinc-500">Your identity, contact details and photo.</p>
          <div className="mt-4 flex items-center gap-4">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-16 w-16 rounded-full border border-white/10 object-cover" />
            ) : (
              <div className="grid h-16 w-16 place-items-center rounded-full border border-sky-400/20 bg-sky-600/20 text-lg font-semibold text-zinc-100">{initials(displayName)}</div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-200 hover:bg-white/10">
                <Camera className="h-3.5 w-3.5" />
                {avatarBusy ? "Working..." : avatarUrl ? "Replace photo" : "Upload photo"}
                <input type="file" accept="image/*" className="hidden" disabled={avatarBusy} onChange={(event) => void onAvatarPick(event)} />
              </label>
              {avatarUrl ? <Button variant="ghost" disabled={avatarBusy} onClick={() => void removeAvatar()} className="gap-2 text-rose-300"><Trash2 className="h-3.5 w-3.5" />Remove</Button> : null}
            </div>
          </div>
          {avatarError ? <p className="mt-3 text-xs text-rose-300">{avatarError}</p> : null}
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Field label="Name" value={displayName} />
            <Field label="Email" value={user?.email || "Unavailable"} />
            <Field label="Phone" value={user?.phone || "Not provided"} />
            <Field label="Role" value={<OisStatusBadge status="stable" label={roleLabel} />} />
          </div>
        </OisCard>

        <OisCard className="p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-white">Account Security</h2>
          <p className="mt-1 text-xs leading-5 text-zinc-500">Password and session.</p>
          <div className="mt-4">
            {passwordStep === "idle" ? (
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                <p className="text-sm text-white">Change password</p>
                <p className="mt-1 text-xs leading-5 text-zinc-500">We'll send a one-time code to {user?.email || "your account email"}.</p>
                <Button className="mt-3" variant="ghost" disabled={passwordBusy || !user?.email} onClick={() => void sendPasswordResetCode()}>{passwordBusy ? "Sending..." : "Send code"}</Button>
              </div>
            ) : passwordStep === "code_sent" ? (
              <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                <p className="text-sm text-white">Enter the code and your new password</p>
                <input value={passwordCode} onChange={(event) => setPasswordCode(event.target.value)} placeholder="6-digit code" className={inputClass} />
                <input value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="New password" type="password" className={inputClass} />
                {passwordError ? <p className="text-xs text-rose-300">{passwordError}</p> : null}
                <div className="flex gap-2">
                  <Button disabled={passwordBusy || !passwordCode.trim() || newPassword.length < 8} onClick={() => void completePasswordChange()}>{passwordBusy ? "Updating..." : "Update password"}</Button>
                  <Button variant="ghost" onClick={() => { setPasswordStep("idle"); setPasswordError(null); }}>Cancel</Button>
                </div>
              </div>
            ) : (
              <Field label="Password" value="Updated." />
            )}
          </div>
          <div className="mt-4 border-t border-white/[0.06] pt-4">
            <p className="text-[10px] uppercase tracking-[0.1em] text-zinc-500">Danger Zone</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-xs leading-5 text-zinc-500">Leaving this Facility or deleting your account isn't self-service yet -- contact a Facility Owner.</p>
              <Button variant="danger" onClick={() => void signOut()}>Sign out</Button>
            </div>
          </div>
        </OisCard>

        <OisCard className="p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-white">Notification Preferences</h2>
          <p className="mt-1 text-xs leading-5 text-zinc-500">How you're notified, by category.</p>
          <div className="mt-4">
            {loadingPreferences ? (
              <p className="text-xs text-zinc-500">Loading preferences...</p>
            ) : preferences.length === 0 ? (
              <p className="text-xs text-zinc-500">Notification preferences are unavailable right now.</p>
            ) : (
              <div className="divide-y divide-white/[0.05]">
                {NOTIFICATION_CATEGORY_ORDER.map((category) => {
                  const pref = preferenceFor(category);
                  const label = NOTIFICATION_CATEGORY_LABEL[category];
                  const saving = savingCategory === category;
                  return (
                    <div key={category} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-[12.5px] text-zinc-200">{label.title}</p>
                        <p className="text-[10.5px] text-zinc-500">{label.detail}</p>
                      </div>
                      <div className="flex shrink-0 gap-3">
                        <label className="flex items-center gap-1.5 text-[11px] text-zinc-400"><input type="checkbox" checked={Boolean(pref?.in_app_enabled)} disabled={saving} onChange={(event) => void togglePreferenceChannel(category, "in_app_enabled", event.target.checked)} />In-app</label>
                        <label className="flex items-center gap-1.5 text-[11px] text-zinc-400"><input type="checkbox" checked={Boolean(pref?.push_enabled)} disabled={saving} onChange={(event) => void togglePreferenceChannel(category, "push_enabled", event.target.checked)} />Push</label>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {prefError ? <p className="mt-2 text-xs text-rose-300">{prefError}</p> : null}
          </div>
        </OisCard>
      </div>

      <div>
        {estateSource.status !== "ready" ? (
          <OisCard className="p-4 sm:p-5"><h2 className="text-sm font-semibold text-white">Facility Information</h2><p className="mt-3 text-sm text-zinc-500">{sourceLabel(estateSource)}</p></OisCard>
        ) : (
          <OisCard className="p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-white">Facility Information</h2>
            <p className="mt-1 text-xs leading-5 text-zinc-500">Customer-editable identity and location. Commercial/deployment status remains Ochiga-controlled.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-zinc-500">Facility name<input className={inputClass} value={form.name} disabled={!canSettings} onChange={(e) => setField("name", e.target.value)} /></label>
              <label className="text-xs text-zinc-500">Type<input className={inputClass} value={form.type} disabled={!canSettings} onChange={(e) => setField("type", e.target.value)} /></label>
              <label className="text-xs text-zinc-500 sm:col-span-2">Address<input className={inputClass} value={form.address} disabled={!canSettings} onChange={(e) => setField("address", e.target.value)} /></label>
              <label className="text-xs text-zinc-500">Timezone<input className={inputClass} value={form.timezone} disabled={!canSettings} placeholder="e.g. Africa/Lagos" onChange={(e) => setField("timezone", e.target.value)} /></label>
              <label className="text-xs text-zinc-500">Contact email<input className={inputClass} value={form.contact_email} disabled={!canSettings} onChange={(e) => setField("contact_email", e.target.value)} /></label>
              <label className="text-xs text-zinc-500">Contact phone<input className={inputClass} value={form.contact_phone} disabled={!canSettings} onChange={(e) => setField("contact_phone", e.target.value)} /></label>
              <Field label="Logo" value="Not yet supported" />
            </div>
            {saveError ? <p className="mt-3 text-xs text-rose-300">{saveError}</p> : null}
            {canSettings ? (
              <div className="mt-4 flex items-center gap-2">
                <Button disabled={!dirty || saving} onClick={() => void saveFacility()}>{saving ? "Saving..." : "Save changes"}</Button>
                {saved ? <span className="text-xs text-emerald-300">Saved.</span> : null}
              </div>
            ) : (
              <p className="mt-4 text-xs text-zinc-500">Permission required: settings.manage</p>
            )}
          </OisCard>
        )}
      </div>
    </section>
  );
}
