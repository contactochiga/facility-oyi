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
  Wallet,
  AlertTriangle,
  Car,
  Droplets,
  Wind,
  Users,
  Orbit,
  Cctv,
  ChevronDown,
  LogOut,
  Settings,
  User as UserIcon,
} from "lucide-react";

import { useSessionStore } from "@/store/useSessionStore";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type Item = {
  href: string;
  label: string;
  icon: any;
  startsWith?: string[];
};

const items: Item[] = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard, startsWith: ["/overview"] },

  // route stays /devices (so nothing breaks), label/icon becomes Energy
  { href: "/devices", label: "Energy", icon: Zap, startsWith: ["/devices", "/hardware", "/hardware-devices"] },

  // route stays /visitors (so nothing breaks), label/icon becomes Security
  { href: "/visitors", label: "Security", icon: Shield, startsWith: ["/visitors", "/security"] },

  { href: "/maintenance", label: "Maintenance", icon: Wrench, startsWith: ["/maintenance"] },

  { href: "/traffic", label: "Traffic", icon: Car, startsWith: ["/traffic"] },
  { href: "/water", label: "Water", icon: Droplets, startsWith: ["/water"] },
  { href: "/environment", label: "Environment", icon: Wind, startsWith: ["/environment"] },
  { href: "/occupancy", label: "Occupancy", icon: Users, startsWith: ["/occupancy"] },
  { href: "/cameras", label: "Cameras", icon: Cctv, startsWith: ["/cameras"] },
  { href: "/digital-twin", label: "Digital Twin", icon: Orbit, startsWith: ["/digital-twin"] },

  { href: "/wallets", label: "Billing & Finance", icon: Wallet, startsWith: ["/wallet", "/wallets"] },
  { href: "/community", label: "Community", icon: Users, startsWith: ["/community"] },

  // ✅ FIX: Alerts should go to /alerts
  { href: "/alerts", label: "Alerts", icon: AlertTriangle, startsWith: ["/alerts"] },
];

function getInitials(nameOrEmail?: string) {
  const s = String(nameOrEmail || "").trim();
  if (!s) return "U";
  const parts = s.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function useOutsideClick(
  ref: React.RefObject<HTMLElement>,
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

  // ✅ keep your existing store, but access it safely for logout
  const session = useSessionStore() as any;
  const user = session?.user;

  const [openAccount, setOpenAccount] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useOutsideClick(accountRef, () => setOpenAccount(false), openAccount);

  function isActive(it: Item) {
    if (pathname === it.href) return true;
    if (it.startsWith?.some((p) => pathname?.startsWith(p))) return true;
    return false;
  }

  const displayName = useMemo(() => {
    const name = (user as any)?.name || "";
    const email = user?.email || "";
    return String(name || email || "Facility Operator");
  }, [user]);

  const displaySub = useMemo(() => {
    const email = user?.email || "";
    const role = (user as any)?.role || "operator";
    return email ? email : String(role);
  }, [user]);

  const initials = useMemo(() => getInitials(displayName), [displayName]);

  async function handleLogout() {
    setOpenAccount(false);

    try {
      // ✅ Support whatever name you used in the store (logout/signOut/clearSession/etc.)
      const fn =
        session?.logout ||
        session?.signOut ||
        session?.clearSession ||
        session?.clear ||
        session?.reset;

      if (typeof fn === "function") {
        await fn();
      } else {
        // fallback: best-effort clear user if you store it directly
        if (typeof session?.setUser === "function") session.setUser(null);
      }
    } finally {
      onNavigate?.();
      router.replace("/login");
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* NAV */}
      <nav className="p-4 space-y-1">
        {items.map((it) => {
          const Icon = it.icon;
          const active = isActive(it);

          return (
            <Link
              key={it.href}
              href={it.href}
              onClick={() => {
                setOpenAccount(false);
                onNavigate?.();
              }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                active
                  ? "bg-blue-600 text-white"
                  : "text-zinc-400 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon size={20} className={cn(active ? "opacity-100" : "opacity-90")} />
              <span className="text-sm font-medium">{it.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ACCOUNT FOOTER (dropdown) */}
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
              {/* ✅ Account -> /account */}
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

              {/* ✅ Settings -> /settings */}
              <button
                type="button"
                onClick={() => {
                  setOpenAccount(false);
                  router.push("/account?tab=settings");
                  onNavigate?.();
                }}
                className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-200 hover:bg-white/5"
              >
                <Settings size={16} className="text-zinc-400" />
                Settings
              </button>

              <div className="my-2 h-px bg-white/10" />

              {/* ✅ Sign out -> real logout + /login */}
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
