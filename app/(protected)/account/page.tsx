"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import OisCard from "@/components/ois/OisCard";
import OisOperationalStrip from "@/components/ois/OisOperationalStrip";
import OisStatusBadge from "@/components/ois/OisStatusBadge";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import { facilityService } from "@/services/facilityService";
import { notificationService } from "@/services/notificationService";
import { useSessionStore } from "@/store/useSessionStore";

type Decoded = {
  id?: string;
  email?: string;
  username?: string;
  name?: string;
  role?: string;
};

type EstateItem = {
  id: string;
  name?: string | null;
  address?: string | null;
  type?: string | null;
  membership_role?: string | null;
  membership_status?: string | null;
};

type SettingsState = {
  notificationsEnabled: boolean;
  emailAlerts: boolean;
  pushAlerts: boolean;
  maintenanceAlerts: boolean;
  visitorAlerts: boolean;
  communityAlerts: boolean;
};

const SETTINGS_KEY = "oyi_facility_settings_v1";

function getCookie(name: string) {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[$()*+.?[\\\]^{|}-]/g, "\\$&")}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function normalizeRole(role?: string) {
  const value = String(role || "").trim().toLowerCase();
  if (!value || value === "resident") return "operator";
  if (value === "estate_admin") return "owner";
  return value;
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <OisCard className="p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>
      <div className="mt-4 space-y-3">{children}</div>
    </OisCard>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
      <div className="text-[11px] text-zinc-500">{label}</div>
      <div className="mt-1 text-sm text-white">{value}</div>
    </div>
  );
}

function Toggle({ title, detail, value, onChange, disabled }: { title: string; detail: string; value: boolean; onChange: (next: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
      <div className="min-w-0">
        <p className="text-sm text-white">{title}</p>
        <p className="mt-1 text-xs leading-5 text-zinc-500">{detail}</p>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={`h-7 w-12 shrink-0 rounded-full border transition ${value ? "border-emerald-400/30 bg-emerald-500/20" : "border-white/10 bg-zinc-900/60"} ${disabled ? "opacity-50" : ""}`}
      >
        <span className={`block h-6 w-6 rounded-full transition ${value ? "translate-x-[22px] bg-emerald-300" : "translate-x-[2px] bg-zinc-300"}`} />
      </button>
    </div>
  );
}

function AccountInner() {
  const router = useRouter();
  const { clear } = useSessionStore();
  const token = useMemo(() => (typeof window === "undefined" ? null : getCookie("oyi_facility_token") || localStorage.getItem("oyi_facility_token")), []);
  const decoded = useMemo(() => {
    if (!token) return null;
    try {
      return jwtDecode<Decoded>(token);
    } catch {
      return null;
    }
  }, [token]);
  const role = normalizeRole(decoded?.role);
  const displayName = decoded?.username || decoded?.name || decoded?.email?.split("@")[0] || "Operator";

  const [estate, setEstate] = useState<EstateItem | null>(null);
  const [loadingEstate, setLoadingEstate] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [settings, setSettings] = useState<SettingsState>({
    notificationsEnabled: true,
    emailAlerts: false,
    pushAlerts: true,
    maintenanceAlerts: true,
    visitorAlerts: true,
    communityAlerts: true,
  });

  async function loadEstate() {
    setLoadingEstate(true);
    try {
      const result = await facilityService.myEstates();
      setEstate(result?.estates?.[0] || null);
    } catch {
      setEstate(null);
    } finally {
      setLoadingEstate(false);
    }
  }

  useEffect(() => {
    void loadEstate();
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return;
    try {
      setSettings((current) => ({ ...current, ...JSON.parse(raw) }));
    } catch {
      // ignore malformed local preference snapshots
    }
  }, []);

  async function saveSettings() {
    if (typeof window !== "undefined") window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    setMessage("Preferences saved on this device.");
  }

  async function testNotifications() {
    try {
      const unread = await notificationService.unread();
      setMessage(unread?.length ? `Notifications active. ${unread.length} unread item(s) found.` : "Notifications endpoint is reachable. No unread items right now.");
    } catch (err: any) {
      setMessage(err?.message || "Notifications could not be checked.");
    }
  }

  function signOut() {
    clear();
    router.replace("/login");
  }

  function deleteSession() {
    if (typeof window !== "undefined") window.localStorage.removeItem(SETTINGS_KEY);
    clear();
    router.replace("/login");
  }

  return (
    <div className="space-y-6">
      <Topbar title="Operator Account" subtitle="Account, preferences and access" />
      <OisOperationalStrip items={[{ label: "Role", value: role, tone: "stable" }, { label: "Estate", value: loadingEstate ? "Loading" : estate?.name || "Unavailable", tone: estate?.name ? "attention" : "warning" }, { label: "Notifications", value: settings.notificationsEnabled ? "On" : "Off", tone: settings.notificationsEnabled ? "stable" : "warning" }, { label: "Session", value: token ? "Active" : "Missing", tone: token ? "stable" : "critical" }]} />
      {message ? <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-300">{message}</div> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Account" subtitle="Current operator identity and estate scope.">
          <Field label="Name" value={displayName} />
          <Field label="Email" value={decoded?.email || "Unavailable"} />
          <Field label="User ID" value={decoded?.id || "Unavailable"} />
          <Field label="Estate" value={estate?.name || "Estate context unavailable"} />
        </Section>

        <Section title="Preferences" subtitle="Local operator behavior and delivery settings.">
          <Toggle title="Notifications" detail="Master switch for operator notifications." value={settings.notificationsEnabled} onChange={(next) => setSettings((current) => ({ ...current, notificationsEnabled: next }))} />
          <Toggle title="Email alerts" detail="Receive important alerts by email when enabled." value={settings.emailAlerts} onChange={(next) => setSettings((current) => ({ ...current, emailAlerts: next }))} disabled={!settings.notificationsEnabled} />
          <Toggle title="Push alerts" detail="Keep realtime push-style alerts available." value={settings.pushAlerts} onChange={(next) => setSettings((current) => ({ ...current, pushAlerts: next }))} disabled={!settings.notificationsEnabled} />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void saveSettings()}>Save preferences</Button>
            <Button variant="ghost" onClick={() => void testNotifications()}>Check notifications</Button>
          </div>
        </Section>

        <Section title="Permissions" subtitle="Operator role and current control posture.">
          <Field label="Role" value={<OisStatusBadge status="stable" label={role} />} />
          <Field label="Membership" value={estate?.membership_role || "Operator"} />
          <Field label="Status" value={estate?.membership_status || "Active"} />
          <Field label="Scope" value={estate?.id ? `Estate ${estate.id}` : "Scope unavailable"} />
        </Section>

        <Section title="Security" subtitle="Session and operator security posture.">
          <Field label="Session token" value={token ? "Present" : "Unavailable"} />
          <Field label="Authentication" value="JWT protected operator session" />
          <Field label="Estate context" value={estate?.name || "Unavailable"} />
          <Field label="Recovery" value="Password recovery depends on backend availability." />
        </Section>

        <Section title="Notifications" subtitle="Estate delivery preferences in this shell.">
          <Toggle title="Maintenance alerts" detail="Send maintenance-related updates." value={settings.maintenanceAlerts} onChange={(next) => setSettings((current) => ({ ...current, maintenanceAlerts: next }))} disabled={!settings.notificationsEnabled} />
          <Toggle title="Visitor alerts" detail="Notify on approvals and access changes." value={settings.visitorAlerts} onChange={(next) => setSettings((current) => ({ ...current, visitorAlerts: next }))} disabled={!settings.notificationsEnabled} />
          <Toggle title="Community alerts" detail="Keep community notices and moderation visible." value={settings.communityAlerts} onChange={(next) => setSettings((current) => ({ ...current, communityAlerts: next }))} disabled={!settings.notificationsEnabled} />
        </Section>

        <Section title="About" subtitle="Facility OS product freeze release candidate.">
          <Field label="Surface" value="Facility OS" />
          <Field label="Mode" value="Native command center shell" />
          <Field label="Environment" value="Operator control plane" />
          <Field label="Build state" value="RC4 product freeze" />
        </Section>
      </div>

      <Section title="Danger Zone" subtitle="End this session before handing over the device.">
        <div className="flex flex-wrap gap-2">
          <Button variant="danger" onClick={signOut}>Sign out</Button>
          <Button variant="ghost" onClick={deleteSession}>Delete session</Button>
        </div>
      </Section>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<div className="space-y-6"><Topbar title="Operator Account" subtitle="Preparing operator account." /></div>}>
      <AccountInner />
    </Suspense>
  );
}
