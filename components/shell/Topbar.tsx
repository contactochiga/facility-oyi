"use client";

import Button from "@/components/ui/Button";
import { deleteCookie } from "@/lib/auth";
import { useSessionStore } from "@/store/useSessionStore";
import { useRouter } from "next/navigation";
import { Bars3Icon } from "@heroicons/react/24/outline";

export default function Topbar({
  title,
  subtitle,
  onOpenMenu,
}: {
  title: string;
  subtitle?: string;
  onOpenMenu?: () => void;
}) {
  const router = useRouter();
  const { user, clear } = useSessionStore();

  function logout() {
    deleteCookie("oyi_facility_token");
    clear();
    router.replace("/login");
  }

  return (
    <div className="flex items-center justify-between gap-4">
      {/* Left section */}
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

      {/* Right section */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:block text-right">
          <div className="text-sm text-zinc-200">
            {user?.email ?? "—"}
          </div>
          <div className="text-xs text-zinc-500">
            {user?.role ?? "operator"}
          </div>
        </div>

        <Button variant="ghost" onClick={logout}>
          Logout
        </Button>
      </div>
    </div>
  );
}
