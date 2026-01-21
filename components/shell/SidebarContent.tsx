"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/overview", label: "Overview" },
  { href: "/devices", label: "Devices" },
  { href: "/maintenance", label: "Maintenance" },
  { href: "/visitors", label: "Visitors" },
  { href: "/alerts", label: "Alerts" },
];

export default function SidebarContent({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      <div className="p-6">
        <div className="text-lg font-semibold tracking-tight">
          facility.oyi.com
        </div>
        <div className="mt-1 text-xs text-zinc-500">
          Infrastructure control plane
        </div>
      </div>

      <nav className="px-4 pb-6 space-y-1">
        {NAV.map((n) => {
          const active = pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              onClick={onNavigate}
              className={`block rounded-xl px-4 py-3 text-sm transition
                ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-zinc-300 hover:bg-white/5"
                }
              `}
            >
              {n.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto p-4">
        <div className="glass p-4 text-xs text-zinc-400">
          <div className="font-medium text-zinc-200">Ops philosophy</div>
          <div className="mt-1">Simple UI. Hard control.</div>
        </div>
      </div>
    </>
  );
}
