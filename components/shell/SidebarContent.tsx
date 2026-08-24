// components/shell/SidebarContent.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  LogOut,
  SlidersHorizontal,
  User as UserIcon,
  LucideIcon,
} from "lucide-react";

import { useSessionStore } from "@/store/useSessionStore";
import { FACILITY_MODULES, visibleModules, type ModuleDefinition } from "@/lib/moduleRegistry";
import { iconForModule } from "@/lib/oisIconRegistry";
import { deleteCookie } from "@/lib/auth";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

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
        icon: iconForModule(item.key),
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
      <nav className="overflow-y-auto px-3 py-4">
        <div className="mb-1.5 px-2 text-[10.5px] font-normal uppercase tracking-[0.08em] text-zinc-500">
          Operations
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
                "mb-px flex min-h-9 w-full items-center gap-2.5 rounded-[4px] px-2 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-300/70",
                active
                  ? "bg-sky-500/[0.12] text-white"
                  : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"
              )}
            >
              <Icon size={16} strokeWidth={1.6} className={cn("shrink-0", active ? "text-sky-300 opacity-100" : "opacity-75")} />
              <span className="truncate text-[13px] font-normal">{it.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-white/[0.08] px-3 pb-3 pt-2.5">
        <div ref={accountRef} className="relative">
          <button
            type="button"
            onClick={() => setOpenAccount((v) => !v)}
            className={cn(
              "flex w-full items-center gap-2 rounded-[4px] px-2 py-1.5 text-left transition-colors",
              "hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/70"
            )}
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-sky-400/20 bg-sky-600/20 text-[10.5px] font-semibold text-zinc-100">
              {initials}
            </div>

            <div className="min-w-0 flex-1 text-left">
              <div className="truncate text-[12px] text-zinc-100">{displayName}</div>
              <div className="truncate text-[10.5px] text-zinc-500">{displaySub}</div>
            </div>

            <ChevronDown
              size={14}
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
