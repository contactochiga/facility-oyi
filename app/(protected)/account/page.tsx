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
import { notificationService, type NotificationPreference, type NotificationCategory } from "@/services/notificationService";
import { authService } from "@/services/authService";
import { cleanupFacilityPushRegistration } from "@/services/pushRegistrationService";
import { useContextStore } from "@/store/useContextStore";
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

function AccountInner() {
  const router = useRouter();
  const { clear } = useSessionStore();
  const { context } = useContextStore();
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

  // Phase 2 commercial-hardening -- real, server-persisted preferences
  // (GET/PATCH /notifications/preferences), replacing the previous
  // localStorage-only fake toggle set.
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [loadingPreferences, setLoadingPreferences] = useState(true);
  const [savingCategory, setSavingCategory] = useState<NotificationCategory | null>(null);

  // Real password-change flow, reusing the same OTP forgot/verify/reset
  // primitive the standalone forgot-password screen already uses -- there
  // is no "enter current password" endpoint in Backend, so this is framed
  // honestly as sending a one-time code to the account's own email, not a
  // fabricated in-place password field.
  const [passwordStep, setPasswordStep] = useState<"idle" | "code_sent" | "done">("idle");
  const [passwordCode, setPasswordCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const activeEstateName = context?.estate?.name || estate?.name || (context ? "Estate context unavailable" : "Loading estate context...");

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

  async function loadPreferences() {
    setLoadingPreferences(true);
    try {
      const items = await notificationService.preferences();
      setPreferences(items || []);
    } catch {
      setPreferences([]);
    } finally {
      setLoadingPreferences(false);
    }
  }

  useEffect(() => {
    void loadEstate();
    void loadPreferences();
  }, []);

  function preferenceFor(category: NotificationCategory): NotificationPreference | undefined {
    return preferences.find((item) => item.category === category);
  }

  async function togglePreferenceChannel(category: NotificationCategory, channel: "push_enabled" | "in_app_enabled", next: boolean) {
    setSavingCategory(category);
    setMessage(null);
    try {
      const updated = await notificationService.updatePreference(category, { [channel]: next });
      setPreferences((current) => {
        const withoutCategory = current.filter((item) => item.category !== category);
        return [...withoutCategory, updated];
      });
    } catch (err: any) {
      setMessage(err?.response?.data?.error || err?.message || "Could not update that preference.");
    } finally {
      setSavingCategory(null);
    }
  }

  async function testNotifications() {
    try {
      const unread = await notificationService.unread();
      setMessage(unread?.length ? `Notifications active. ${unread.length} unread item(s) found.` : "Notifications endpoint is reachable. No unread items right now.");
    } catch (err: any) {
      setMessage(err?.message || "Notifications could not be checked.");
    }
  }

  async function sendPasswordResetCode() {
    if (!decoded?.email) return;
    setPasswordBusy(true);
    setPasswordError(null);
    try {
      const res = await authService.requestPasswordReset(decoded.email);
      if (!res.ok) {
        setPasswordError(res.error || "Unable to send a reset code.");
        return;
      }
      setPasswordStep("code_sent");
    } finally {
      setPasswordBusy(false);
    }
  }

  async function completePasswordChange() {
    if (!decoded?.email) return;
    setPasswordBusy(true);
    setPasswordError(null);
    try {
      const res = await authService.completePasswordReset(decoded.email, passwordCode.trim(), newPassword);
      if (!res.ok) {
        setPasswordError(res.error || "Unable to update your password.");
        return;
      }
      setPasswordStep("done");
      setPasswordCode("");
      setNewPassword("");
      setMessage("Password updated.");
    } finally {
      setPasswordBusy(false);
    }
  }

  async function signOut() {
    await cleanupFacilityPushRegistration();
    clear();
    router.replace("/login");
  }

  async function deleteSession() {
    await cleanupFacilityPushRegistration();
    clear();
    router.replace("/login");
  }

  return (
    <div className="space-y-6">
      <Topbar title="Operator Account" subtitle="Account, preferences and access" />
      <OisOperationalStrip items={[{ label: "Role", value: role, tone: "stable" }, { label: "Estate", value: loadingEstate && !context?.estate?.name ? "Loading" : activeEstateName, tone: context?.estate?.name || estate?.name ? "attention" : "warning" }, { label: "Notifications", value: loadingPreferences ? "Loading" : `${preferences.filter((p) => p.in_app_enabled || p.push_enabled).length}/${preferences.length} on`, tone: "stable" }, { label: "Session", value: token ? "Active" : "Missing", tone: token ? "stable" : "critical" }]} />
      {message ? <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-300">{message}</div> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Account" subtitle="Current operator identity and estate scope.">
          <Field label="Name" value={displayName} />
          <Field label="Email" value={decoded?.email || "Unavailable"} />
          <Field label="User ID" value={decoded?.id || "Unavailable"} />
          <Field label="Estate" value={activeEstateName} />
        </Section>

        <Section title="Permissions" subtitle="Operator role and current control posture.">
          <Field label="Role" value={<OisStatusBadge status="stable" label={role} />} />
          <Field label="Membership" value={estate?.membership_role || "Operator"} />
          <Field label="Status" value={estate?.membership_status || "Active"} />
          <Field label="Scope" value={estate?.id ? `Estate ${estate.id}` : "Scope unavailable"} />
        </Section>

        <Section title="Security" subtitle="Session and password.">
          <Field label="Session token" value={token ? "Present" : "Unavailable"} />
          <Field label="Authentication" value="JWT protected operator session" />
          <Field label="Estate context" value={activeEstateName} />
          {passwordStep === "idle" ? (
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
              <p className="text-sm text-white">Change password</p>
              <p className="mt-1 text-xs leading-5 text-zinc-500">We'll send a one-time code to {decoded?.email || "your account email"}.</p>
              <Button className="mt-3" variant="ghost" disabled={passwordBusy || !decoded?.email} onClick={() => void sendPasswordResetCode()}>
                {passwordBusy ? "Sending..." : "Send code"}
              </Button>
            </div>
          ) : passwordStep === "code_sent" ? (
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 space-y-2">
              <p className="text-sm text-white">Enter the code and your new password</p>
              <input
                value={passwordCode}
                onChange={(event) => setPasswordCode(event.target.value)}
                placeholder="6-digit code"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-sky-400/40"
              />
              <input
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="New password"
                type="password"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-sky-400/40"
              />
              {passwordError ? <p className="text-xs text-rose-300">{passwordError}</p> : null}
              <div className="flex gap-2">
                <Button disabled={passwordBusy || !passwordCode.trim() || newPassword.length < 8} onClick={() => void completePasswordChange()}>
                  {passwordBusy ? "Updating..." : "Update password"}
                </Button>
                <Button variant="ghost" onClick={() => { setPasswordStep("idle"); setPasswordError(null); }}>Cancel</Button>
              </div>
            </div>
          ) : (
            <Field label="Password" value="Updated." />
          )}
        </Section>

        <Section title="Notifications" subtitle="Real, server-persisted delivery preferences by category.">
          {loadingPreferences ? (
            <p className="text-xs text-zinc-500">Loading preferences…</p>
          ) : preferences.length === 0 ? (
            <p className="text-xs text-zinc-500">Notification preferences are unavailable right now.</p>
          ) : (
            NOTIFICATION_CATEGORY_ORDER.map((category) => {
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
                      <input
                        type="checkbox"
                        checked={Boolean(pref?.in_app_enabled)}
                        disabled={saving}
                        onChange={(event) => void togglePreferenceChannel(category, "in_app_enabled", event.target.checked)}
                      />
                      In-app
                    </label>
                    <label className="flex items-center gap-2 text-xs text-zinc-300">
                      <input
                        type="checkbox"
                        checked={Boolean(pref?.push_enabled)}
                        disabled={saving}
                        onChange={(event) => void togglePreferenceChannel(category, "push_enabled", event.target.checked)}
                      />
                      Push
                    </label>
                  </div>
                </div>
              );
            })
          )}
          <Button variant="ghost" onClick={() => void testNotifications()}>Check notifications</Button>
        </Section>

        <Section title="About" subtitle="Facility OS native release candidate.">
          <Field label="Surface" value="Facility OS" />
          <Field label="Mode" value="Native command center shell" />
          <Field label="Environment" value="Operator control plane" />
          <Field label="Build state" value="RC5 native polish" />
        </Section>
      </div>

      <Section title="Danger Zone" subtitle="End this session before handing over the device.">
        <div className="flex flex-wrap gap-2">
          <Button variant="danger" onClick={() => void signOut()}>Sign out</Button>
          <Button variant="ghost" onClick={() => void deleteSession()}>Delete session</Button>
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
