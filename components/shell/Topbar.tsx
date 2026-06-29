// components/shell/Topbar.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSessionStore } from "@/store/useSessionStore";
import NotificationsModal from "@/components/notifications/NotificationsModal";
import { notificationService } from "@/services/notificationService";
import { loadUnreadMessageCount } from "@/services/facilityCommunicationPostureService";
import { Bell, Search, Sparkles, UserCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useFacilityRealtimeStore } from "@/store/useFacilityRealtimeStore";
import { iconForDomain } from "@/lib/oisIconRegistry";
import { useFacilityAssistantStore } from "@/store/useFacilityAssistantStore";
import { useContextStore } from "@/store/useContextStore";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function getApiBase() {
  return (
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ""
  );
}

function StatusPill({ ok }: { ok: boolean | null }) {
  const label = ok === null ? "Checking" : ok ? "Connected" : "Degraded";

  const tone =
    ok === null
      ? "border-white/10 bg-white/5 text-white/70"
      : ok
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
      : "border-amber-500/20 bg-amber-500/10 text-amber-200";

  return (
    <div
      className={cn(
        "hidden md:inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium",
        tone
      )}
      title="System status"
      aria-label={`System status: ${label}`}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          ok === null ? "bg-zinc-500" : ok ? "bg-emerald-400" : "bg-amber-400"
        )}
      />
      <span>{label}</span>
    </div>
  );
}

function RealtimePill() {
  const status = useFacilityRealtimeStore((state) => state.status);
  const lastEventAt = useFacilityRealtimeStore((state) => state.lastEventAt);
  const label =
    status === "live"
      ? "Live"
      : status === "reconnecting" || status === "connecting"
      ? "Reconnecting"
      : status === "offline"
      ? "Polling fallback"
      : "Polling fallback";
  const tone =
    status === "live"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
      : status === "reconnecting" || status === "connecting"
      ? "border-amber-500/20 bg-amber-500/10 text-amber-200"
      : "border-white/10 bg-white/5 text-white/60";
  return (
    <div className={cn("hidden lg:inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium", tone)} title={lastEventAt ? `Last event ${lastEventAt}` : "Realtime bridge state"}>
      <span className={cn("h-1.5 w-1.5 rounded-full", status === "live" ? "bg-emerald-400" : status === "connecting" || status === "reconnecting" ? "bg-amber-400" : "bg-zinc-500")} />
      <span>{label}</span>
    </div>
  );
}

export default function Topbar({
  title,
  subtitle,
  strip,
  showUser = false,
  showNotifications = true,
  rightSlot,
}: {
  title: string;
  subtitle?: string;
  strip?: Array<{ label: string; value: string | number }>;

  showUser?: boolean;
  showNotifications?: boolean;
  rightSlot?: React.ReactNode;
}) {
  const { user } = useSessionStore();
  const router = useRouter();
  const CommunicationIcon = iconForDomain("communicationOperations");
  const openAssistant = useFacilityAssistantStore((state) => state.openAssistant);
  const { context } = useContextStore();

  const [openNotif, setOpenNotif] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);

  // optional status indicator (doesn't affect anything if API missing)
  const [backendOk, setBackendOk] = useState<boolean | null>(null);

  async function refreshUnread() {
    try {
      const items = await notificationService.unread();
      setUnreadCount(items?.length || 0);
    } catch {
      setUnreadCount(0);
    }
  }

  async function refreshMessages() {
    try {
      setMessageCount(await loadUnreadMessageCount());
    } catch {
      setMessageCount(0);
    }
  }

  useEffect(() => {
    if (!showNotifications) return;

    refreshUnread();
    refreshMessages();

    // ✅ light polling (safe): every 25s
    const t1 = setInterval(refreshUnread, 25000);
    const t2 = setInterval(refreshMessages, 20000);
    return () => {
      clearInterval(t1);
      clearInterval(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showNotifications]);

  // backend status ping (light)
  useEffect(() => {
    const API = getApiBase();
    if (!API) {
      setBackendOk(false);
      return;
    }

    let alive = true;
    setBackendOk(null);

    (async () => {
      try {
        const res = await fetch(`${API}/health`, { method: "GET", cache: "no-store" });
        if (!alive) return;
        setBackendOk(res.ok);
      } catch {
        if (!alive) return;
        setBackendOk(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const userLabel = useMemo(() => {
    const email = user?.email ?? "—";
    const role = String(user?.role ?? "operator").replace(/_/g, " ");
    const estate = (user as any)?.estate_name
      ? String((user as any).estate_name)
      : user?.estate_id
      ? "Estate scope"
      : "No estate scope";
    return { email, role, estate };
  }, [user]);
  const estateContextLabel = useMemo(() => String(context?.estate?.name || userLabel.estate || "Facility context"), [context?.estate?.name, userLabel.estate]);

  const stripItems = useMemo(() => {
    if (!strip?.length) return [];
    const hasRefresh = strip.some((item) => /refresh/i.test(item.label));
    const refreshLabel = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return hasRefresh
      ? strip.slice(0, 5)
      : [...strip.slice(0, 4), { label: "Refresh", value: refreshLabel }];
  }, [strip]);

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        {/* Left */}
        <div className="min-w-0 flex-1">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2.5">
              <h1 className="truncate text-[17px] font-semibold tracking-[-0.03em] text-white md:text-[19px]">
                {title}
              </h1>
              <StatusPill ok={backendOk} />
              <RealtimePill />
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-white/46">
              <span className="truncate text-white/58">{estateContextLabel}</span>
              {subtitle ? <span className="hidden text-white/24 sm:inline">•</span> : null}
              {subtitle ? <span className="truncate">{subtitle}</span> : null}
            </div>
            {stripItems.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-white/42">
                {stripItems.map((item) => (
                  <span key={`${item.label}:${item.value}`} className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-[5px]">
                    <span className="text-white/36">{item.label}</span>{" "}
                    <span className="text-white/72">{item.value}</span>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* Right */}
        <div className="flex shrink-0 items-center gap-2">
          {rightSlot ? <div className="flex items-center">{rightSlot}</div> : null}

          <button
            className="grid h-9 w-9 place-items-center rounded-full border border-white/[0.08] bg-white/[0.04] text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
            aria-label="Search operational context"
            type="button"
            onClick={() => openAssistant("Search the current operational context, active module, and runtime state.")}
          >
            <Search className="h-4 w-4" />
          </button>

          <button
            className="grid h-9 w-9 place-items-center rounded-full border border-sky-300/16 bg-sky-400/[0.09] text-sky-100 transition hover:bg-sky-400/[0.16]"
            aria-label="Open Operational Intelligence"
            type="button"
            onClick={() => openAssistant("Summarize the current operational attention, verification risk, and recommended next action.")}
          >
            <Sparkles className="h-4 w-4" />
          </button>

          <button
            className="relative grid h-9 w-9 place-items-center rounded-full border border-white/[0.08] bg-white/[0.04] text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
            aria-label="Messages"
            type="button"
            onClick={() => router.push("/messages")}
          >
            <CommunicationIcon className="h-4 w-4" />
            {messageCount > 0 ? (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-600 text-white text-[11px] flex items-center justify-center border border-emerald-500/30">
                {messageCount > 99 ? "99+" : messageCount}
              </span>
            ) : null}
          </button>

          {showNotifications ? (
            <button
              className="relative grid h-9 w-9 place-items-center rounded-full border border-white/[0.08] bg-white/[0.04] text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
              aria-label="Notifications"
              type="button"
              onClick={() => setOpenNotif(true)}
            >
              <Bell className="h-4 w-4" />

              {/* ✅ Badge (brand-blue, not red) */}
              {unreadCount > 0 ? (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[11px] flex items-center justify-center border border-blue-400/30">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => router.push("/account")}
            className="hidden sm:grid h-9 w-9 place-items-center rounded-full border border-white/[0.08] bg-white/[0.04] text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
            aria-label="Open account"
          >
            <UserCircle2 className="h-4 w-4" />
          </button>

          {showUser ? (
            <div className="hidden sm:flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <div className="min-w-0 text-right">
                <div className="text-sm text-white/85 truncate max-w-[220px]">
                  {userLabel.email}
                </div>
                <div className="text-[11px] text-white/45">
                  {userLabel.role}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <NotificationsModal
        open={openNotif}
        onClose={() => setOpenNotif(false)}
        onChanged={refreshUnread}
      />
    </>
  );
}
