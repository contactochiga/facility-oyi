"use client";

import React from "react";
import { Bars3Icon, BellIcon } from "@heroicons/react/24/outline";
import { useSessionStore } from "@/store/useSessionStore";

export default function Topbar({
  title,
  subtitle,
  onOpenMenu,
  showUser = false,                 // ✅ default: hide email/role in header
  showNotifications = true,          // ✅ default: show bell
  rightSlot,                         // ✅ optional: Refresh button, etc.
}: {
  title: string;
  subtitle?: string;
  onOpenMenu?: () => void;

  // ✅ NEW
  showUser?: boolean;
  showNotifications?: boolean;
  rightSlot?: React.ReactNode;
}) {
  const { user } = useSessionStore();

  return (
    <div className="flex items-center justify-between gap-4">
      {/* Left */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile hamburger */}
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
        {/* Any page-specific button (Refresh, Create, etc.) */}
        {rightSlot ? <div className="flex items-center">{rightSlot}</div> : null}

        {/* Notifications icon (ONLY place it should appear) */}
        {showNotifications ? (
          <button
            className="rounded-lg p-2 hover:bg-white/10"
            aria-label="Notifications"
            type="button"
          >
            <BellIcon className="h-5 w-5 text-zinc-300" />
          </button>
        ) : null}

        {/* Optional user info (OFF by default) */}
        {showUser ? (
          <div className="hidden sm:block text-right">
            <div className="text-sm text-zinc-200">{user?.email ?? "—"}</div>
            <div className="text-xs text-zinc-500">{user?.role ?? "operator"}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
