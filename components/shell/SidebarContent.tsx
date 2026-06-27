// components/shell/SidebarContent.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard,
  Zap,
  Wrench,
  Shield,
  Car,
  Wind,
  Orbit,
  ChevronDown,
  LogOut,
  SlidersHorizontal,
  User as UserIcon,
  ShieldCheck,
  Home,
  BarChart3,
  UserCog,
  Wallet,
  MessageSquare,
  LucideIcon,
} from "lucide-react";

import { useSessionStore } from "@/store/useSessionStore";
import { FACILITY_MODULES, visibleModules, type ModuleDefinition } from "@/lib/moduleRegistry";
import { deleteCookie } from "@/lib/auth";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const MODULE_ICONS: Record<string, LucideIcon> = {
  overview: LayoutDashboard,
  "live-infrastructure": Orbit,
  "estate-structure": Home,
  "hardware-devices": ShieldCheck,
  "security-access": Shield,
  utilities: Zap,
  "environment-sensors": Wind,
  "traffic-mobility": Car,
  maintenance: Wrench,
  community: MessageSquare,
  wallets: Wallet,
  intelligence: BarChart3,
  administration: UserCog,
};

type NavItem = ModuleDefinition & { icon: LucideIcon };

function getInitials(nameOrEmail?: string) {
  const s = String(nameOrEmail || "").trim();
  if (!s) return "U";
  const parts = s.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function useOutsideClick(
  ref: React.RefObject<HTMLElement | null>,
  onOutside: () => void,
  enabled: boolean
) {
  useEffect(() => {
    if (!enabled) return;

    function onDown(e: MouseEvent | TouchEvent) {
      const el = ref.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      onOutside();
    }

    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [ref, onOutside, enabled]);
}

export default function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  const session = useSessionStore() as any;
  const user = session?.user;

  const [openAccount, setOpenAccount] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useOutsideClick(accountRef, () => setOpenAccount(false), openAccount);

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
  const navItems = useMemo<NavItem[]>(
    () =>
      visibleModules(user, FACILITY_MODULES).map((item) => ({
        ...item,
        icon: MODULE_ICONS[item.key] || LayoutDashboard,
      })),
    [user]
  );

  async function handleLogout() {
    setOpenAccount(false);

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
      <nav className="p-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Infrastructure OS
        </div>
        {navItems.map((it) => {
          const Icon = it.icon;
          const active = isActive(it);

          return (
            <Link
              key={it.label}
              href={it.href}
              onClick={() => {
                setOpenAccount(false);
                onNavigate?.();
              }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all",
                active
                  ? "border-sky-400/35 bg-sky-500/10 text-sky-50 shadow-[0_12px_30px_rgba(14,165,233,0.12)]"
                  : "border-transparent text-zinc-400 hover:border-white/10 hover:bg-white/5 hover:text-white"
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border",
                  active
                    ? "border-white/15 bg-white/15 text-white"
                    : "border-white/10 bg-white/5 text-zinc-400"
                )}
              >
                <Icon size={15.5} className={cn(active ? "opacity-100" : "opacity-90")} />
              </span>
              <span className="text-[13px] font-medium truncate">{it.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto p-4">
        <div ref={accountRef} className="relative">
          <button
            type="button"
            onClick={() => setOpenAccount((v) => !v)}
            className={cn(
              "w-full flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3",
              "hover:bg-white/10 transition"
            )}
          >
            <div className="h-10 w-10 rounded-full bg-blue-600/30 border border-blue-500/30 flex items-center justify-center text-zinc-100 font-semibold">
              {initials}
            </div>

            <div className="min-w-0 flex-1 text-left">
              <div className="text-sm font-semibold text-zinc-100 truncate">{displayName}</div>
              <div className="text-xs text-zinc-400 truncate">{displaySub}</div>
            </div>

            <ChevronDown
              size={18}
              className={cn("text-zinc-400 transition", openAccount ? "rotate-180" : "")}
            />
          </button>

          {openAccount && (
            <div className="absolute bottom-[calc(100%+10px)] left-0 w-full rounded-xl border border-white/10 bg-zinc-950/90 backdrop-blur p-2 shadow-xl">
              <button
                type="button"
                onClick={() => {
                  setOpenAccount(false);
                  router.push("/account");
                  onNavigate?.();
                }}
                className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-200 hover:bg-white/5"
              >
                <UserIcon size={16} className="text-zinc-400" />
                Account
              </button>

              <button
                type="button"
                onClick={() => {
                  setOpenAccount(false);
                  router.push("/account?tab=settings");
                  onNavigate?.();
                }}
                className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-200 hover:bg-white/5"
              >
                <SlidersHorizontal size={16} className="text-zinc-400" />
                Preferences
              </button>

              <div className="my-2 h-px bg-white/10" />

              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-200 hover:bg-red-500/10"
              >
                <LogOut size={16} className="text-red-200" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
