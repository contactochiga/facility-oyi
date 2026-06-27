"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Bell,
  Building2,
  ChevronRight,
  Clock3,
  Eye,
  KeyRound,
  LockKeyhole,
  PlugZap,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  Users,
  X,
} from "lucide-react";
import OisCard from "@/components/ois/OisCard";
import OisListItem from "@/components/ois/OisListItem";
import OisStatusBadge from "@/components/ois/OisStatusBadge";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { facilityService, type EstateMembershipRow, type InfrastructureOperations } from "@/services/facilityService";
import { notificationService, type AlertItem } from "@/services/notificationService";
import superAdminService from "@/services/superAdminService";
import { hasPermission, PERMISSION_KEYS, permissionsForRole } from "@/lib/oyiFoundation";
import { useSessionStore } from "@/store/useSessionStore";

type Tab = "operators" | "roles" | "permissions" | "audit" | "integrations" | "notifications" | "security" | "settings";
type LoadStatus = "loading" | "ready" | "error" | "permission";
type Source<T> = { status: LoadStatus; data: T; message?: string };
type Detail = { title: string; subtitle?: string; rows: Array<[string, string]>; href?: string };

const TABS: Array<{ key: Tab; label: string; icon: typeof Users }> = [
  { key: "operators", label: "Operators", icon: Users },
  { key: "roles", label: "Roles", icon: UserCog },
  { key: "permissions", label: "Permissions", icon: ShieldCheck },
  { key: "audit", label: "Audit", icon: Activity },
  { key: "integrations", label: "Integrations", icon: PlugZap },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "security", label: "Security", icon: LockKeyhole },
  { key: "settings", label: "Estate Controls", icon: Settings },
];

const ROLE_DEFINITIONS = [
  { key: "estate_admin", label: "Estate Governor", description: "Owns estate-level governance, homes, staff, residents and operational continuity.", inheritance: "Top estate role", scope: "Estate-wide" },
  { key: "facility_manager", label: "Facility Manager", description: "Runs daily facility operations across homes, staff, support, residents and devices.", inheritance: "Operational manager", scope: "Estate-wide" },
  { key: "security_operator", label: "Security Operator", description: "Handles visitors, gate access, cameras, incidents and security workflows.", inheritance: "Security-focused", scope: "Estate/security domains" },
  { key: "maintenance_operator", label: "Maintenance Operator", description: "Handles maintenance, support tickets, device posture and resident service workflows.", inheritance: "Support-focused", scope: "Maintenance/support domains" },
  { key: "finance_operator", label: "Finance Operator", description: "Handles wallet, payment and finance operations where enabled.", inheritance: "Finance-focused", scope: "Wallet/service domains" },
  { key: "ochiga_staff", label: "Ochiga Staff", description: "Ochiga support staff with read/support/moderation visibility but not full estate ownership.", inheritance: "Platform staff", scope: "Support-limited" },
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
  const [tab, setTab] = useState<Tab>("operators");
  const [operators, setOperators] = useState<Source<EstateMembershipRow[]>>(source([]));
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
    const [operatorState, estateState, auditState, infraState, notificationState, pushState] = await Promise.all([
      loadSource(facilityService.listEstateUsers().then((res) => res.users || []), []),
      loadSource(facilityService.myEstates().then((res) => res.estates || []), []),
      canAudit ? loadSource(superAdminService.auditLogs(160).then((res) => res.items || []), []) : Promise.resolve(source<any[]>([], "permission", "Permission required")),
      loadSource(facilityService.infrastructureOperations(), null),
      canNotifications ? loadSource(notificationService.unread(), []) : Promise.resolve(source<AlertItem[]>([], "permission", "Permission required")),
      loadSource(facilityService.platformDeploymentReadiness(), null),
    ]);
    setOperators(operatorState);
    setEstates(estateState);
    setAudit(auditState);
    setInfra(infraState);
    setNotifications(notificationState);
    setPushReadiness(pushState);
    setLoading(false);
  }, [canAudit, canNotifications]);

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
    const hay = `${item.action || ""} ${item.actor_role || ""} ${item.target_type || ""} ${item.target_id || ""}`.toLowerCase();
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
      <Topbar title="Operational Governance" subtitle="Operators, roles, permissions, audit, integrations, notifications, security and estate controls." rightSlot={<Button variant="ghost" onClick={() => void load()} disabled={loading} className="gap-2"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button>} />

      <section className="rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.12),transparent_34%),linear-gradient(145deg,rgba(255,255,255,0.055),rgba(255,255,255,0.018))] p-5">
        <p className="text-[10px] uppercase tracking-[0.18em] text-sky-200/80">Operational governance</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">{estate?.name || "Estate governance"}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">Review Facility operators and governance state using live contracts. Unsupported custom-role, delivery-metric, provider-readiness and branding edits remain read-only pending backend support.</p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Operators" value={operators.status === "ready" ? operators.data.length : sourceLabel(operators)} hint="Estate staff and operator memberships" />
        <Metric label="Active" value={operators.status === "ready" ? activeOperators.length : sourceLabel(operators)} hint="Operators with active estate access" />
        <Metric label="Suspended/removed" value={operators.status === "ready" ? suspendedOperators.length : sourceLabel(operators)} hint="Access requires review" />
        <Metric label="Audit source" value={audit.status === "ready" ? audit.data.length : sourceLabel(audit)} hint="Administrative and operational audit entries" />
      </section>

      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => <button key={item.key} type="button" onClick={() => setTab(item.key)} className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs transition ${tab === item.key ? "border-sky-400/35 bg-sky-500/10 text-sky-100" : "border-white/10 bg-white/5 text-zinc-400 hover:text-white"}`}><item.icon className="h-3.5 w-3.5" />{item.label}</button>)}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
        <Search className="h-4 w-4 text-zinc-500" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search operators, audit entries, roles, permissions..." className="min-w-[260px] flex-1 bg-transparent text-sm text-white outline-none" />
        {tab === "audit" ? <select value={auditFilter} onChange={(event) => setAuditFilter(event.target.value)} className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"><option value="all">All domains</option>{AUDIT_DOMAINS.map((domain) => <option key={domain} value={domain}>{domain}</option>)}</select> : null}
      </div>

      {tab === "operators" ? <OperatorsSection operators={filteredOperators} source={operators} canManage={canManageStaff} pendingOperators={pendingOperators.length} onOpen={setDetail} /> : null}
      {tab === "roles" ? <RolesSection roles={roleRows} onOpen={setDetail} /> : null}
      {tab === "permissions" ? <PermissionsSection roles={roleRows} /> : null}
      {tab === "audit" ? <AuditSection source={audit} rows={filteredAudit} /> : null}
      {tab === "integrations" ? <IntegrationsSection rows={integrations} infra={infra} /> : null}
      {tab === "notifications" ? <NotificationsSection notifications={notifications} push={pushReadiness} /> : null}
      {tab === "security" ? <SecuritySection userRole={user?.role || "operator"} canSettings={canSettings} canAudit={canAudit} audit={audit} operators={operators} /> : null}
      {tab === "settings" ? <EstateSettingsSection estate={estate} source={estates} canSettings={canSettings} /> : null}

      {detail ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm"><section className="w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-950 p-5"><header className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Governance overview</p><h2 className="mt-1 text-lg font-semibold text-white">{detail.title}</h2>{detail.subtitle ? <p className="mt-1 text-sm text-zinc-500">{detail.subtitle}</p> : null}</div><button type="button" onClick={() => setDetail(null)} className="rounded-lg border border-white/10 p-2 text-zinc-400 hover:text-white"><X className="h-4 w-4" /></button></header><div className="mt-5 grid gap-2 sm:grid-cols-2">{detail.rows.map(([label, value]) => <Field key={label} label={label} value={value} />)}</div>{detail.href ? <Link href={detail.href} className="mt-5 inline-flex items-center gap-2 text-sm text-sky-200 hover:text-sky-100">Open source workflow <ChevronRight className="h-4 w-4" /></Link> : null}</section></div> : null}
    </div>
  );
}

function OperatorsSection({ operators, source, canManage, pendingOperators, onOpen }: { operators: EstateMembershipRow[]; source: Source<EstateMembershipRow[]>; canManage: boolean; pendingOperators: number; onOpen: (detail: Detail) => void }) {
  if (source.status !== "ready") return <Panel title="Operator Governance" subtitle="Operator source state"><p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-zinc-500">{sourceLabel(source, "Awaiting activity source")}</p></Panel>;
  return <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]"><Panel title="Operator Governance" subtitle="Estate operators, roles, status, assigned scope and honest activity state."><div className="space-y-2">{operators.map((member) => <div key={member.id} className="flex items-center gap-3"><div className="min-w-0 flex-1"><OisListItem title={operatorName(member)} description={`${operatorEmail(member)} · ${member.role || "operator"}`} status={statusTone(member.status || "unknown")} /></div><Button variant="ghost" onClick={() => onOpen({ title: operatorName(member), subtitle: operatorEmail(member), rows: [["Role", member.role || "operator"], ["Status", member.status || "unknown"], ["Assigned scope", "Estate scope"], ["Last login", "Awaiting activity source"], ["Activity", "Awaiting activity source"], ["Suspension state", /suspended/.test(lower(member.status)) ? "Suspended" : "Not suspended"]], href: "/homes" })} className="gap-2"><Eye className="h-4 w-4" />Inspect</Button></div>)}{!operators.length ? <p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-zinc-500">No operators returned by the estate user source.</p> : null}</div></Panel><Panel title="Lifecycle Controls" subtitle="Mutation support is limited to existing backend contracts."><div className="space-y-3 text-sm text-zinc-400"><Field label="Pending operators" value={String(pendingOperators)} /><Field label="Role assignment" value={canManage ? "Supported through estate/home membership update workflows" : "Permission required: staff.manage"} /><Field label="Suspend / remove" value={canManage ? "Supported where backend membership routes permit it" : "Permission required: staff.manage"} /><Field label="Last login" value="Awaiting activity source" /></div></Panel></section>;
}

function RolesSection({ roles, onOpen }: { roles: Array<typeof ROLE_DEFINITIONS[number] & { permissions: string[] }>; onOpen: (detail: Detail) => void }) {
  return <Panel title="Role Governance" subtitle="Current role definitions from the shared permission foundation. Custom role creation is read-only until backend support exists."><div className="grid gap-3 lg:grid-cols-2">{roles.map((role) => <OisCard key={role.key} variant="evidence" className="p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-white">{role.label}</h3><p className="mt-1 text-xs leading-5 text-zinc-500">{role.description}</p></div><Status value="Read-only" /></div><div className="mt-4 grid gap-2 sm:grid-cols-3"><Field label="Permissions" value={String(role.permissions.length)} /><Field label="Inheritance" value={role.inheritance} /><Field label="Scope" value={role.scope} /></div><Button variant="ghost" className="mt-3 gap-2" onClick={() => onOpen({ title: role.label, subtitle: role.description, rows: [["Role", role.key], ["Inheritance", role.inheritance], ["Operational scope", role.scope], ["Assignment", "Supported through existing membership update flows"], ["Custom role editing", "Pending backend support"], ["Permissions", role.permissions.join(", ") || "None"]] })}><SlidersHorizontal className="h-4 w-4" />Review role</Button></OisCard>)}</div></Panel>;
}

function PermissionsSection({ roles }: { roles: Array<typeof ROLE_DEFINITIONS[number] & { permissions: string[] }> }) {
  return <section className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]"><Panel title="Permission Registry" subtitle="All permissions currently supported by the Facility permission foundation."><div className="max-h-[520px] space-y-2 overflow-auto pr-1">{PERMISSION_KEYS.map((permission) => <div key={permission} className="rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-sm text-zinc-300">{permission}</div>)}</div></Panel><Panel title="Role-to-Permission Mapping" subtitle="Read-only matrix unless backend custom-role editing is added."><div className="space-y-3">{roles.map((role) => <div key={role.key} className="rounded-2xl border border-white/10 bg-black/15 p-4"><h3 className="text-sm font-semibold text-white">{role.label}</h3><div className="mt-3 flex flex-wrap gap-2">{role.permissions.map((permission) => <span key={permission} className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-zinc-300">{permission}</span>)}</div></div>)}</div></Panel></section>;
}

function AuditSection({ source, rows }: { source: Source<any[]>; rows: any[] }) {
  if (source.status !== "ready") return <Panel title="Audit Center" subtitle="Audit visibility"><p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-zinc-500">{sourceLabel(source, "No audit entries")}</p></Panel>;
  return <Panel title="Audit Center" subtitle="Authentication, resident lifecycle, invitations, devices, visitors, moderation and administrative actions from backend audit logs."><div className="space-y-2">{rows.map((item) => <OisListItem key={item.id || `${item.action}-${item.created_at}`} title={item.action || "Audit event"} description={`${item.target_type || "target"}:${item.target_id || "n/a"} · actor:${item.actor_role || "n/a"}`} meta={dateLabel(item.created_at)} status={statusTone(item.status || "recorded")} />)}{!rows.length ? <p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-zinc-500">No audit entries match this filter.</p> : null}</div></Panel>;
}

function IntegrationsSection({ rows, infra }: { rows: Array<{ name: string; status: string; detail: string }>; infra: Source<InfrastructureOperations | null> }) {
  return <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]"><Panel title="Integration Readiness" subtitle="Provider readiness without exposing secrets or unsupported connection states."><div className="grid gap-3 lg:grid-cols-2">{rows.map((item) => <OisCard key={item.name} variant="evidence" className="p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-white">{item.name}</h3><p className="mt-2 text-xs leading-5 text-zinc-500">{item.detail}</p></div><Status value={item.status} /></div></OisCard>)}</div></Panel><Panel title="Provider Source" subtitle="Backend provider and Edge source availability."><div className="space-y-2 text-sm text-zinc-400"><Field label="Infrastructure source" value={infra.status === "ready" ? "Available" : sourceLabel(infra)} /><Field label="Provider sync" value={infra.data?.sources?.providers?.available ? "Connected" : "Pending readiness"} /><Field label="Oyi Edge" value={infra.data?.edge_nodes?.length ? `${infra.data.edge_nodes.length} node(s)` : "Pending readiness"} /></div></Panel></section>;
}

function NotificationsSection({ notifications, push }: { notifications: Source<AlertItem[]>; push: Source<any> }) {
  return <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]"><Panel title="Notification Controls" subtitle="Push, email and SMS readiness. Delivery metrics are shown only when a backend source exists."><div className="grid gap-3 lg:grid-cols-2"><Field label="Unread notifications" value={notifications.status === "ready" ? String(notifications.data.length) : sourceLabel(notifications)} /><Field label="Push readiness" value={push.status === "ready" ? "Readiness source loaded" : sourceLabel(push, "Pending readiness")} /><Field label="Email readiness" value="Pending readiness" /><Field label="SMS readiness" value="Pending readiness" /><Field label="APNs" value={`${readinessStatus(push.data, "APNs")} · ${readinessDetail(push.data, "APNs")}`} /><Field label="FCM" value={`${readinessStatus(push.data, "FCM")} · ${readinessDetail(push.data, "FCM")}`} /></div></Panel><Panel title="Notification Activity" subtitle="Readiness inspection only until provider readiness contracts exist."><p className="text-sm leading-6 text-zinc-400">Provider state is displayed from available readiness sources. Delivery counts, delivery success rates and campaign metrics are not shown because no Facility delivery analytics contract is available.</p></Panel></section>;
}

function SecuritySection({ userRole, canSettings, canAudit, audit, operators }: { userRole: string; canSettings: boolean; canAudit: boolean; audit: Source<any[]>; operators: Source<EstateMembershipRow[]> }) {
  return <section className="grid gap-5 xl:grid-cols-2"><Panel title="Security Policies" subtitle="Authentication, session, role and operator posture."><div className="grid gap-3 sm:grid-cols-2"><Field label="Authentication posture" value="JWT-protected Facility routes" /><Field label="Session posture" value="Cookie/local token cleared on logout by protected shell" /><Field label="Operator access" value={operators.status === "ready" ? `${operators.data.length} estate memberships` : sourceLabel(operators)} /><Field label="Current operator role" value={userRole.replace(/_/g, " ")} /><Field label="Control permission" value={canSettings ? "settings.manage available" : "Permission required"} /><Field label="Audit permission" value={canAudit ? "audit.read available" : "Permission required"} /></div></Panel><Panel title="Security Activity" subtitle="Audit-backed security visibility."><p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-zinc-500">{audit.status === "ready" ? `${audit.data.length} audit entries loaded. Use Audit tab for filtering.` : sourceLabel(audit, "Awaiting security event source")}</p></Panel></section>;
}

function EstateSettingsSection({ estate, source, canSettings }: { estate: any; source: Source<any[]>; canSettings: boolean }) {
  if (source.status !== "ready") return <Panel title="Estate Controls" subtitle="Estate control source"><p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-zinc-500">{sourceLabel(source)}</p></Panel>;
  return <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]"><Panel title="Estate Controls" subtitle="Operational control center. Editing is only enabled where backend persistence exists."><div className="grid gap-3 sm:grid-cols-2"><Field label="Estate name" value={estate?.name || "Pending source"} /><Field label="Address" value={estate?.address || "Pending source"} /><Field label="Type" value={estate?.type || "Pending source"} /><Field label="Timezone" value="Pending backend support" /><Field label="Branding" value="Pending backend support" /><Field label="Communication readiness" value="Pending backend support" /><Field label="Access readiness" value="Owned through Homes/Members access workflows" /><Field label="Operational readiness" value="Pending backend support" /></div></Panel><Panel title="Readiness Controls" subtitle="Fail-closed editing posture."><div className="space-y-3 text-sm text-zinc-400"><Field label="Edit permission" value={canSettings ? "settings.manage available" : "Permission required: settings.manage"} /><Field label="Persistence" value="Estate create/update fields are available in Homes/Estate workflows. Branding/timezone/communication readiness needs backend contracts." /><Button variant="ghost" disabled={!canSettings}>Readiness editor pending backend support</Button></div></Panel></section>;
}
