// app/(protected)/account/page.tsx
"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Topbar from "@/components/shell/Topbar";
import Button from "@/components/ui/Button";
import API from "@/services/api";
import { jwtDecode } from "jwt-decode";

type Decoded = {
  id?: string;
  email?: string;
  username?: string;
  name?: string;
  role?: string;
  estate_id?: string;
  home_id?: string;
};

type EstateItem = {
  id: string;
  name?: string | null;
  address?: string | null;
  type?: string | null;
  created_at?: string | null;
};

type FacilityMyEstatesResponse =
  | { estates: EstateItem[] }
  | EstateItem[]
  | any;

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
  const m = document.cookie.match(
    new RegExp(
      `(?:^|; )${name.replace(/[$()*+.?[\\\]^{|}-]/g, "\\$&")}=([^;]*)`
    )
  );
  return m ? decodeURIComponent(m[1]) : null;
}

function when(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function labelValue(label: string, value?: string | null) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-[11px] text-zinc-400">{label}</div>
      <div className="text-sm text-white mt-1 break-all">{value || "—"}</div>
    </div>
  );
}

function SwitchRow({
  title,
  desc,
  value,
  onChange,
  disabled,
}: {
  title: string;
  desc?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-white">{title}</div>
        {desc ? (
          <div className="text-xs text-zinc-400 mt-1 leading-relaxed">
            {desc}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={`shrink-0 w-12 h-7 rounded-full border transition ${
          value
            ? "bg-emerald-500/20 border-emerald-500/30"
            : "bg-zinc-900/50 border-white/10"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        aria-label={`toggle ${title}`}
      >
        <span
          className={`block w-6 h-6 rounded-full transition translate-y-[1px] ${
            value
              ? "translate-x-[22px] bg-emerald-300"
              : "translate-x-[2px] bg-zinc-300"
          }`}
        />
      </button>
    </div>
  );
}

/**
 * ✅ REQUIRED by Next.js: useSearchParams must be inside Suspense
 */
export default function AccountPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-7">
          <Topbar title="Account" subtitle="Profile • Settings • Permissions" />
          <div className="glass border border-white/10 rounded-2xl p-6">
            <div className="text-sm text-zinc-400">Loading account…</div>
          </div>
        </div>
      }
    >
      <AccountInner />
    </Suspense>
  );
}

function AccountInner() {
  const router = useRouter();
  const params = useSearchParams();

  const tab = (params.get("tab") || "profile") as "profile" | "settings";

  const token = useMemo(() => {
    if (typeof window === "undefined") return null;
    return (
      getCookie("oyi_facility_token") ||
      getCookie("facility_token") ||
      getCookie("oyi_consumer_token") ||
      localStorage.getItem("oyi_facility_token") ||
      localStorage.getItem("facility_token") ||
      localStorage.getItem("oyi_consumer_token") ||
      localStorage.getItem("token")
    );
  }, []);

  const decoded = useMemo<Decoded | null>(() => {
    if (!token) return null;
    try {
      return jwtDecode<Decoded>(token);
    } catch {
      return null;
    }
  }, [token]);

  const displayName =
    decoded?.username ||
    decoded?.name ||
    (decoded?.email ? decoded.email.split("@")[0] : null) ||
    "Operator";

  const displayEmail = decoded?.email || "—";
  const userId = decoded?.id || "—";
  const role = decoded?.role || "—";

  const [loadingEstate, setLoadingEstate] = useState(false);
  const [estate, setEstate] = useState<EstateItem | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [settings, setSettings] = useState<SettingsState>({
    notificationsEnabled: true,
    emailAlerts: false,
    pushAlerts: true,
    maintenanceAlerts: true,
    visitorAlerts: true,
    communityAlerts: true,
  });

  const [saving, setSaving] = useState(false);
  const [testingNotif, setTestingNotif] = useState(false);

  function setTab(next: "profile" | "settings") {
    router.push(`/account?tab=${next}`);
  }

  async function loadEstate() {
    setErr(null);
    setLoadingEstate(true);
    try {
      const res = await API.get("/facility/my-estates");
      const data: FacilityMyEstatesResponse = res.data;

      const estates: EstateItem[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.estates)
        ? data.estates
        : [];

      setEstate(estates?.[0] || null);
    } catch (e: any) {
      const msg =
        e?.response?.data?.error || e?.message || "Failed to load estate";
      setErr(String(msg));
      setEstate(null);
    } finally {
      setLoadingEstate(false);
    }
  }

  function loadSettingsLocal() {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setSettings((prev) => ({ ...prev, ...parsed }));
    } catch {
      // ignore
    }
  }

  async function saveSettings() {
    setSaving(true);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      }
    } finally {
      setSaving(false);
    }
  }

  async function testNotification() {
    setTestingNotif(true);
    setErr(null);
    try {
      if (!settings.notificationsEnabled) {
        setErr("Enable notifications first.");
        return;
      }

      // If your backend doesn't support POST /notifications yet, this will show the error cleanly.
      await API.post("/notifications", {
        title: "Facility Test Notification",
        type: "system",
        message:
          "If you can see this on consumer, notifications are wired correctly.",
        // estate_id: estate?.id, // add only if backend requires it
      });
    } catch (e: any) {
      const msg =
        e?.response?.data?.error ||
        e?.message ||
        "Test notification failed (backend may not support POST /notifications yet)";
      setErr(String(msg));
    } finally {
      setTestingNotif(false);
    }
  }

  useEffect(() => {
    loadSettingsLocal();
    loadEstate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-7">
      <Topbar title="Account" subtitle="Profile • Settings • Permissions" />

      {/* TAB SWITCH */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2">
          <Button
            variant={tab === "profile" ? "primary" : "ghost"}
            onClick={() => setTab("profile")}
          >
            Profile
          </Button>
          <Button
            variant={tab === "settings" ? "primary" : "ghost"}
            onClick={() => setTab("settings")}
          >
            Settings
          </Button>
        </div>

        <div className="text-xs text-zinc-500">
          {loadingEstate
            ? "Syncing site..."
            : estate?.id
            ? `Site: ${estate.id}`
            : "Site: —"}
        </div>
      </div>

      {!!err && (
        <div className="glass border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-200 rounded-2xl">
          {err}
        </div>
      )}

      {/* PROFILE TAB */}
      {tab === "profile" && (
        <div className="grid gap-4 lg:gap-5 grid-cols-1 xl:grid-cols-2">
          <div className="glass border border-white/10 rounded-2xl p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-white">
                  Operator Profile
                </div>
                <div className="text-sm text-zinc-400 mt-1">
                  Who is currently running this control plane session.
                </div>
              </div>

              <span className="text-[11px] px-2 py-1 rounded-full border border-white/10 bg-white/5 text-zinc-300">
                {role}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
              {labelValue("Name", displayName)}
              {labelValue("Email", displayEmail)}
              {labelValue("User ID", userId)}
              {labelValue("Auth Token", token ? "Present" : "Missing")}
            </div>

            <div className="text-xs text-zinc-500 mt-4">
              If any of this looks wrong, logout and login again.
            </div>
          </div>

          <div className="glass border border-white/10 rounded-2xl p-6">
            <div className="text-lg font-semibold text-white">Site Context</div>
            <div className="text-sm text-zinc-400 mt-1">
              The facility site you’re currently operating.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
              {labelValue("Site Name", estate?.name || "—")}
              {labelValue("Site Type", estate?.type || "—")}
              {labelValue("Address", estate?.address || "—")}
              {labelValue("Created", when(estate?.created_at || null))}
            </div>

            <div className="mt-4 flex gap-2">
              <Button variant="ghost" onClick={loadEstate} disabled={loadingEstate}>
                {loadingEstate ? "Refreshing..." : "Refresh Site"}
              </Button>
            </div>

            <div className="text-xs text-zinc-500 mt-3">
              This pulls from{" "}
              <span className="text-zinc-200">/facility/my-estates</span>.
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS TAB */}
      {tab === "settings" && (
        <div className="grid gap-4 lg:gap-5 grid-cols-1 xl:grid-cols-2">
          <div className="glass border border-white/10 rounded-2xl p-6">
            <div className="text-lg font-semibold text-white">
              Notification Settings
            </div>
            <div className="text-sm text-zinc-400 mt-1">
              What this operator account should send/receive.
            </div>

            <div className="space-y-3 mt-5">
              <SwitchRow
                title="Enable notifications"
                desc="Master switch for all notifications from facility control."
                value={settings.notificationsEnabled}
                onChange={(v) =>
                  setSettings((p) => ({ ...p, notificationsEnabled: v }))
                }
              />
              <SwitchRow
                title="Push alerts"
                desc="Show real-time alerts in the apps (recommended)."
                value={settings.pushAlerts}
                onChange={(v) => setSettings((p) => ({ ...p, pushAlerts: v }))}
                disabled={!settings.notificationsEnabled}
              />
              <SwitchRow
                title="Email alerts"
                desc="Send important alerts to email (optional)."
                value={settings.emailAlerts}
                onChange={(v) => setSettings((p) => ({ ...p, emailAlerts: v }))}
                disabled={!settings.notificationsEnabled}
              />
              <SwitchRow
                title="Maintenance alerts"
                desc="Notify residents when maintenance updates happen."
                value={settings.maintenanceAlerts}
                onChange={(v) =>
                  setSettings((p) => ({ ...p, maintenanceAlerts: v }))
                }
                disabled={!settings.notificationsEnabled}
              />
              <SwitchRow
                title="Visitor alerts"
                desc="Notify residents of approvals/entry/exit events."
                value={settings.visitorAlerts}
                onChange={(v) =>
                  setSettings((p) => ({ ...p, visitorAlerts: v }))
                }
                disabled={!settings.notificationsEnabled}
              />
              <SwitchRow
                title="Community alerts"
                desc="Push estate-wide updates to consumer accounts."
                value={settings.communityAlerts}
                onChange={(v) =>
                  setSettings((p) => ({ ...p, communityAlerts: v }))
                }
                disabled={!settings.notificationsEnabled}
              />
            </div>

            <div className="mt-5 flex gap-2 flex-wrap">
              <Button onClick={saveSettings} disabled={saving}>
                {saving ? "Saving..." : "Save Settings"}
              </Button>

              <Button variant="ghost" onClick={testNotification} disabled={testingNotif}>
                {testingNotif ? "Sending..." : "Send Test Notification"}
              </Button>
            </div>

            <div className="text-xs text-zinc-500 mt-3">
              Settings are saved locally for now. Next step is persisting to DB.
            </div>
          </div>

          <div className="glass border border-white/10 rounded-2xl p-6">
            <div className="text-lg font-semibold text-white">Permissions</div>
            <div className="text-sm text-zinc-400 mt-1">
              Role-based access will govern what the operator can change.
            </div>

            <div className="mt-5 grid gap-3">
              {labelValue("Current role", role)}
              {labelValue("Scope", estate?.id ? `Estate: ${estate.id}` : "—")}
              {labelValue("Policy", "RBAC (phase 2)")}
            </div>

            <div className="text-xs text-zinc-500 mt-4">
              Next: wire a permissions matrix and lock sensitive actions.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
