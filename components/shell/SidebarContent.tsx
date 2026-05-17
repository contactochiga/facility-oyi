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
  ShieldCheck,
  Home,
  FileText,
  BarChart3,
  UserCog,
} from "lucide-react";

import { useSessionStore } from "@/store/useSessionStore";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type Item = {
  href: string;
  label: string;
  icon: any;
  domain: string;
  startsWith?: string[];
};

const items: Item[] = [
  { domain: "Command", href: "/overview", label: "Estate Overview", icon: LayoutDashboard, startsWith: ["/overview"] },
  { domain: "Command", href: "/alerts", label: "Alerts & Incidents", icon: AlertTriangle, startsWith: ["/alerts"] },

  { domain: "Estate Facility", href: "/homes", label: "Homes & Units", icon: Home, startsWith: ["/homes"] },
  { domain: "Estate Facility", href: "/occupancy", label: "Residents & Occupancy", icon: Users, startsWith: ["/occupancy"] },

  { domain: "Hardware Devices", href: "/devices", label: "Device Registry", icon: ShieldCheck, startsWith: ["/devices", "/hardware", "/hardware-devices"] },

  { domain: "Security & Access", href: "/security", label: "Security Dashboard", icon: Shield, startsWith: ["/security"] },
  { domain: "Security & Access", href: "/visitors", label: "Visitors & Access", icon: Users, startsWith: ["/visitors"] },
  { domain: "Security & Access", href: "/cameras", label: "Cameras & Surveillance", icon: Cctv, startsWith: ["/cameras"] },

  { domain: "Utilities", href: "/utilities", label: "Utilities Dashboard", icon: Zap, startsWith: ["/utilities"] },
  { domain: "Utilities", href: "/water", label: "Water Systems", icon: Droplets, startsWith: ["/water"] },

  { domain: "Environment & Sensors", href: "/environment", label: "Environment Dashboard", icon: Wind, startsWith: ["/environment"] },

  { domain: "Traffic & Mobility", href: "/traffic", label: "Traffic Dashboard", icon: Car, startsWith: ["/traffic"] },

  { domain: "Operations", href: "/maintenance", label: "Maintenance Operations", icon: Wrench, startsWith: ["/maintenance"] },
  { domain: "Operations", href: "/community", label: "Community & Comms", icon: Users, startsWith: ["/community"] },
  { domain: "Operations", href: "/wallets", label: "Wallet Operations", icon: BarChart3, startsWith: ["/wallets"] },

  { domain: "Digital Twin & Spatial", href: "/digital-twin", label: "Digital Twin", icon: Orbit, startsWith: ["/digital-twin"] },

  { domain: "Documents & Plans", href: "/services", label: "Services & Plans", icon: FileText, startsWith: ["/services"] },

  { domain: "Intelligence", href: "/overview", label: "Analytics & Activity", icon: BarChart3, startsWith: ["/analytics"] },
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
  const isAdmin = String((user as any)?.role || "").toLowerCase() === "admin";
  const navItems = useMemo(
    () =>
      isAdmin
        ? [
            ...items,
            {
              domain: "Administration",
              href: "/super-admin",
              label: "Super Admin",
              icon: UserCog,
              startsWith: ["/super-admin"],
            } as Item,
          ]
        : items,
    [isAdmin]
  );

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

  const groupedNav = useMemo(() => {
    return navItems.reduce<Array<{ domain: string; items: Item[] }>>((groups, item) => {
      const last = groups[groups.length - 1];
      if (last?.domain === item.domain) {
        last.items.push(item);
      } else {
        groups.push({ domain: item.domain, items: [item] });
      }
      return groups;
    }, []);
  }, [navItems]);

  const [openDomains, setOpenDomains] = useState<Record<string, boolean>>({});

  function collapsedDomainLabel(domain: string) {
    if (domain === "Command") return "Estate Overview";
    return domain;
  }

  function toggleDomain(group: { domain: string; items: Item[] }) {
    const first = group.items[0];
    if (first?.href) {
      router.push(first.href);
      onNavigate?.();
    }
    setOpenDomains((current) => ({ ...current, [group.domain]: !current[group.domain] }));
  }

  return (
    <div className="flex h-full flex-col">
      {/* NAV */}
      <nav className="p-4 space-y-1 overflow-y-auto">
        {groupedNav.map((group, groupIndex) => {
          const collapsed = !openDomains[group.domain];
          const PrimaryIcon = group.items[0]?.icon || LayoutDashboard;
          const groupActive = group.items.some((item) => isActive(item));

          return (
            <div key={group.domain} className="space-y-1">
              <button
                type="button"
                onClick={() => toggleDomain(group)}
                className={cn(
                  "w-full text-left transition-all",
                  collapsed
                    ? cn(
                        "mt-2 flex min-h-[38px] items-center justify-between rounded-lg border px-3 py-2.5 text-[13px] font-medium",
                        groupActive
                          ? "border-violet-500/45 bg-gradient-to-r from-violet-600 to-blue-600/70 text-white shadow-[0_12px_30px_rgba(99,102,241,0.2)]"
                          : "border-white/10 bg-white/5 text-zinc-200"
                      )
                    : cn(
                        "px-4 pt-4 pb-1 text-[9.5px] font-semibold uppercase tracking-[0.16em]",
                        groupActive ? "text-zinc-200" : "text-zinc-500"
                      ),
                  groupIndex === 0 && !collapsed ? "pt-0" : ""
                )}
                aria-expanded={!collapsed}
              >
                {collapsed ? (
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 text-zinc-400">
                      <PrimaryIcon size={15.5} />
                    </span>
                    <span className="truncate">{collapsedDomainLabel(group.domain)}</span>
                  </span>
                ) : (
                  group.domain
                )}
                {collapsed ? <span className="text-zinc-500">+</span> : null}
              </button>

              {!collapsed &&
                group.items.map((it) => {
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
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all",
                        active
                          ? "border-violet-500/45 bg-gradient-to-r from-violet-600 to-blue-600/70 text-white shadow-[0_12px_30px_rgba(99,102,241,0.2)]"
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
                      <span className="text-[13px] font-medium">{it.label}</span>
                    </Link>
                  );
                })}
            </div>
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
