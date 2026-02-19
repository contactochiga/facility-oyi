// components/shell/SidebarContent.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Zap,
  Wrench,
  Shield,
  Wallet,
  MessagesSquare,
  AlertTriangle,
} from "lucide-react";

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

  // ✅ changed label + icon (route still /devices so nothing breaks)
  { href: "/devices", label: "Energy", icon: Zap, startsWith: ["/devices", "/hardware", "/hardware-devices"] },

  { href: "/maintenance", label: "Maintenance", icon: Wrench, startsWith: ["/maintenance"] },

  // ✅ Security (still /visitors route so nothing breaks)
  { href: "/visitors", label: "Security", icon: Shield, startsWith: ["/visitors", "/security"] },

  { href: "/wallets", label: "Wallets", icon: Wallet, startsWith: ["/wallet", "/wallets"] },
  { href: "/community", label: "Community", icon: MessagesSquare, startsWith: ["/community"] },

  // ✅ changed label + icon (route still /facility-services so nothing breaks)
  { href: "/facility-services", label: "Alerts", icon: AlertTriangle, startsWith: ["/facility", "/facility-services", "/alerts"] },
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

      {/* ✅ IMPORTANT:
          We are NOT adding any footer card (no Admin User, no Signed-in card).
          Your existing dropdown account button should remain wherever it currently lives
          (usually in your Sidebar layout file or another component).
      */}
    </div>
  );
}
