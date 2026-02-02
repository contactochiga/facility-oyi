"use client";

import { Bars3Icon, BellIcon } from "@heroicons/react/24/outline";

export default function Topbar({
  title,
  subtitle,
  onOpenMenu,
  showNotifications = true,
  rightSlot,
}: {
  title: string;
  subtitle?: string;
  onOpenMenu?: () => void;

  // show bell ONLY here (single source of truth)
  showNotifications?: boolean;

  // optional: page actions (Refresh, Create, etc.)
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      {/* LEFT */}
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
          {subtitle && <div className="muted mt-1 truncate">{subtitle}</div>}
        </div>
      </div>

      {/* RIGHT */}
      <div className="flex items-center gap-2">
        {rightSlot}

        {showNotifications && (
          <button
            className="rounded-lg p-2 hover:bg-white/10"
            aria-label="Notifications"
            // we’ll wire this to a dropdown/panel later
            onClick={() => {}}
          >
            <BellIcon className="h-5 w-5 text-zinc-200" />
          </button>
        )}
      </div>
    </div>
  );
}
