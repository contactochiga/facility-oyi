// src/components/shell/Topbar.tsx
"use client";

import { Bars3Icon, BellIcon } from "@heroicons/react/24/outline";

export default function Topbar({
  title,
  subtitle,
  onOpenMenu,

  // ✅ new
  showUser = false, // default off (we don’t want email/role in header)
  showNotifications = true,
  onOpenNotifications,
}: {
  title: string;
  subtitle?: string;
  onOpenMenu?: () => void;

  showUser?: boolean;
  showNotifications?: boolean;
  onOpenNotifications?: () => void;
}) {
  return (
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
          {subtitle && <div className="muted mt-1 truncate">{subtitle}</div>}
        </div>
      </div>

      {/* Right (icons only) */}
      <div className="flex items-center gap-2">
        {showNotifications && (
          <button
            onClick={onOpenNotifications}
            className="rounded-lg p-2 hover:bg-white/10"
            aria-label="Notifications"
            title="Notifications"
          >
            <BellIcon className="h-5 w-5 text-zinc-300" />
          </button>
        )}

        {/* ✅ reserved space for future icons: settings/profile/help */}
        {/* {showUser && <UserMenu />} */}
      </div>
    </div>
  );
}
