// components/shell/Topbar.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Bars3Icon, BellIcon } from "@heroicons/react/24/outline";
import { useSessionStore } from "@/store/useSessionStore";
import NotificationsModal from "@/components/notifications/NotificationsModal";
import { notificationService } from "@/services/notificationService";
import { messagesService } from "@/services/messagesService";
import { MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";

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

export default function Topbar({
  title,
  subtitle,
  onOpenMenu,
  showUser = false,
  showNotifications = true,
  rightSlot,
}: {
  title: string;
  subtitle?: string;
  onOpenMenu?: () => void;

  showUser?: boolean;
  showNotifications?: boolean;
  rightSlot?: React.ReactNode;
}) {
  const { user } = useSessionStore();
  const router = useRouter();

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
      const threads = await messagesService.listInbox();
      const totalUnread = (threads || []).reduce(
        (sum, t) => sum + Number(t?.unread_count || 0),
        0
      );
      setMessageCount(totalUnread);
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
    const role = user?.role ?? "operator";
    return { email, role };
  }, [user?.email, user?.role]);

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        {/* Left */}
        <div className="flex items-center gap-3 min-w-0">
          {onOpenMenu && (
            <button
              onClick={onOpenMenu}
              className="lg:hidden rounded-xl border border-white/10 bg-white/5 p-2 hover:bg-white/10 transition"
              aria-label="Open navigation"
              type="button"
            >
              <Bars3Icon className="h-5 w-5 text-zinc-200" />
            </button>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <h1 className="truncate text-lg md:text-xl font-semibold tracking-tight text-white">
                {title}
              </h1>
              <StatusPill ok={backendOk} />
            </div>

            {subtitle ? (
              <p className="mt-1 truncate text-sm text-white/55">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2 sm:gap-3">
          {rightSlot ? <div className="flex items-center">{rightSlot}</div> : null}

          <button
            className="rounded-xl border border-white/10 bg-white/5 p-2 hover:bg-white/10 transition relative"
            aria-label="Messages"
            type="button"
            onClick={() => router.push("/messages")}
          >
            <MessageSquare className="h-5 w-5 text-zinc-200" />
            {messageCount > 0 ? (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-600 text-white text-[11px] flex items-center justify-center border border-emerald-500/30">
                {messageCount > 99 ? "99+" : messageCount}
              </span>
            ) : null}
          </button>

          {showNotifications ? (
            <button
              className="rounded-xl border border-white/10 bg-white/5 p-2 hover:bg-white/10 transition relative"
              aria-label="Notifications"
              type="button"
              onClick={() => setOpenNotif(true)}
            >
              <BellIcon className="h-5 w-5 text-zinc-200" />

              {/* ✅ Badge (brand-blue, not red) */}
              {unreadCount > 0 ? (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[11px] flex items-center justify-center border border-blue-400/30">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </button>
          ) : null}

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
