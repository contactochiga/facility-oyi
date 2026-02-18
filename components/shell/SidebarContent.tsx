"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Cpu,
  Wrench,
  Users,
  Wallet,
  MessagesSquare,
  ConciergeBell,
} from "lucide-react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type Item = {
  href: string;
  label: string;
  icon: any;
  // optional extra match for nested routes
  startsWith?: string[];
};

const items: Item[] = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard, startsWith: ["/overview"] },
  // adjust this href ONLY if your real route differs
  { href: "/devices", label: "Hardware Devices", icon: Cpu, startsWith: ["/devices", "/hardware", "/hardware-devices"] },
  { href: "/maintenance", label: "Maintenance", icon: Wrench, startsWith: ["/maintenance"] },
  { href: "/visitors", label: "Visitors", icon: Users, startsWith: ["/visitors"] },
  { href: "/wallets", label: "Wallets", icon: Wallet, startsWith: ["/wallet", "/wallets"] },
  { href: "/community", label: "Community", icon: MessagesSquare, startsWith: ["/community"] },
  { href: "/facility-services", label: "Facility Services", icon: ConciergeBell, startsWith: ["/facility", "/facility-services"] },
];

export default function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  function isActive(it: Item) {
    if (pathname === it.href) return true;
    if (it.startsWith?.some((p) => pathname?.startsWith(p))) return true;
    return false;
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
              onClick={onNavigate}
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

      {/* ✅ Keep bottom space clean (no Admin User footer) */}
      <div className="mt-auto p-4">
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <div className="text-xs text-zinc-400">Signed in</div>
          <div className="mt-1 text-sm text-zinc-200 truncate">
            Facility operator
          </div>
        </div>
      </div>
    </div>
  );
}
