// components/shell/SidebarContent.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";
import { LogOut, LucideIcon } from "lucide-react";

import { useSessionStore } from "@/store/useSessionStore";
import { FACILITY_MODULES, visibleModules, type ModuleDefinition } from "@/lib/moduleRegistry";
import { iconForModule } from "@/lib/oisIconRegistry";
import { deleteCookie } from "@/lib/auth";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type NavItem = ModuleDefinition & { icon: LucideIcon };

function SidebarNavLink({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "mb-px flex min-h-9 w-full items-center gap-2.5 rounded-[4px] px-2 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-300/70",
        active ? "bg-sky-500/[0.12] text-white" : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"
      )}
    >
      <Icon size={16} strokeWidth={1.6} className={cn("shrink-0", active ? "text-sky-300 opacity-100" : "opacity-75")} />
      <span className="truncate text-[13px] font-normal">{item.label}</span>
    </Link>
  );
}

function getInitials(nameOrEmail?: string) {
  const s = String(nameOrEmail || "").trim();
  if (!s) return "U";
  const parts = s.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  const session = useSessionStore() as any;
  const user = session?.user;

  function isActive(it: NavItem) {
    if (pathname === it.href) return true;
    if (it.startsWith?.some((p) => pathname?.startsWith(p))) return true;
    return false;
  }

  const displayName = useMemo(() => {
    const name = (user as any)?.full_name || (user as any)?.name || "";
    const email = user?.email || "";
    return String(name || email || "Facility Operator");
  }, [user]);

  const displaySub = useMemo(() => {
    const role = (user as any)?.role || "operator";
    return String(role).replace(/_/g, " ");
  }, [user]);

  const initials = useMemo(() => getInitials(displayName), [displayName]);
  // PHASE 3 UX closure -- OPERATIONS / ADMIN sidebar sections.
  const allNavItems = useMemo<NavItem[]>(
    () =>
      visibleModules(user, FACILITY_MODULES).map((item) => ({
        ...item,
        icon: iconForModule(item.key),
      })),
    [user]
  );
  const operationsItems = useMemo(() => allNavItems.filter((item) => (item.section || "operations") === "operations"), [allNavItems]);
  const adminItems = useMemo(() => allNavItems.filter((item) => item.section === "admin"), [allNavItems]);
  const avatarUrl = user?.avatar_url || user?.profile_image_url || null;

  async function handleLogout() {
    try {
      const fn =
        session?.logout ||
        session?.signOut ||
        session?.clearSession ||
        session?.clear ||
        session?.reset;

      if (typeof fn === "function") {
        await fn();
      } else if (typeof session?.setUser === "function") {
        session.setUser(null);
      }
    } finally {
      deleteCookie("oyi_facility_token");
      onNavigate?.();
      router.replace("/login");
    }
  }

  return (
    <div className="flex h-full flex-col">
      <nav className="overflow-y-auto px-3 py-4">
        <div className="mb-1.5 px-2 text-[10.5px] font-normal uppercase tracking-[0.08em] text-zinc-500">
          Operations
        </div>
        {operationsItems.map((it) => (
          <SidebarNavLink key={it.label} item={it} active={isActive(it)} onClick={() => onNavigate?.()} />
        ))}

        {adminItems.length ? (
          <>
            <div className="mb-1.5 mt-4 px-2 text-[10.5px] font-normal uppercase tracking-[0.08em] text-zinc-500">
              Admin
            </div>
            {adminItems.map((it) => (
              <SidebarNavLink key={it.label} item={it} active={isActive(it)} onClick={() => onNavigate?.()} />
            ))}
          </>
        ) : null}
      </nav>

      {/* Final commercial UX closure -- the footer identity control is
         identity/session display only, not another navigation menu.
         Facility Administration lives under the ADMIN section above. */}
      <div className="mt-auto flex items-center gap-2 border-t border-white/[0.08] px-3 pb-3 pt-2.5">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-7 w-7 shrink-0 rounded-full border border-sky-400/20 object-cover" />
        ) : (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-sky-400/20 bg-sky-600/20 text-[10.5px] font-semibold text-zinc-100">
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] text-zinc-100">{displayName}</div>
          <div className="truncate text-[10.5px] text-zinc-500">{displaySub}</div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          aria-label="Sign out"
          title="Sign out"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-zinc-500 transition hover:bg-white/[0.04] hover:text-red-300"
        >
          <LogOut size={15} />
        </button>
      </div>
    </div>
  );
}
