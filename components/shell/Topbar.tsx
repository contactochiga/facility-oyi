// components/shell/Topbar.tsx
"use client";

import React, { useEffect, useState } from "react";
import { Bars3Icon, BellIcon } from "@heroicons/react/24/outline";
import { useSessionStore } from "@/store/useSessionStore";
import NotificationsModal from "@/components/notifications/NotificationsModal";
import { notificationService } from "@/services/notificationService";

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

  const [openNotif, setOpenNotif] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  async function refreshUnread() {
    try {
      const items = await notificationService.unread();
      setUnreadCount(items?.length || 0);
    } catch {
      setUnreadCount(0);
    }
  }

  useEffect(() => {
    if (!showNotifications) return;

    refreshUnread();

    // ✅ light polling (safe): every 25s
    const t = setInterval(refreshUnread, 25000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showNotifications]);

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        {/* Left */}
        <div className="flex items-center gap-3 min-w-0">
          {onOpenMenu && (
            <button
              onClick={onOpenMenu}
              className="lg:hidden rounded-lg p-2 hover:bg-white/10"
              aria-label="Open navigation"
            >
              <Bars3Icon className="h-5 w-5 text-zinc-300" />
            </button>
          )}

          <div className="min-w-0">
            <div className="title truncate">{title}</div>
            {subtitle ? <div className="muted mt-1 truncate">{subtitle}</div> : null}
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-3">
          {rightSlot ? <div className="flex items-center">{rightSlot}</div> : null}

          {showNotifications ? (
            <button
              className="rounded-lg p-2 hover:bg-white/10 relative"
              aria-label="Notifications"
              type="button"
              onClick={() => setOpenNotif(true)}
            >
              <BellIcon className="h-5 w-5 text-zinc-300" />

              {/* ✅ Badge */}
              {unreadCount > 0 ? (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#E11D2E] text-white text-[11px] flex items-center justify-center">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </button>
          ) : null}

          {showUser ? (
            <div className="hidden sm:block text-right">
              <div className="text-sm text-zinc-200">{user?.email ?? "—"}</div>
              <div className="text-xs text-zinc-500">{user?.role ?? "operator"}</div>
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
