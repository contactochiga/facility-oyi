"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { facilityMobileModules } from "./mobileNavConfig";
import { FACILITY_MODULES, visibleModules } from "@/lib/moduleRegistry";
import { useSessionStore } from "@/store/useSessionStore";

export default function TabletModuleRail() {
  const pathname = usePathname() || "/overview";
  const { user } = useSessionStore();
  const visible = useMemo(() => new Set(visibleModules(user, FACILITY_MODULES).map((item) => item.key)), [user]);
  const items = facilityMobileModules.filter((item) => visible.has(item.key));

  return <aside className="hidden h-screen w-[76px] shrink-0 flex-col border-r border-white/[0.08] bg-zinc-950/92 py-4 md:flex xl:hidden">
    <Link href="/overview" className="mx-auto grid h-10 w-10 place-items-center rounded-2xl border border-sky-300/15 bg-sky-400/10 text-xs font-semibold text-sky-100">O</Link>
    <nav className="mt-5 flex-1 space-y-1 overflow-y-auto px-2" aria-label="Facility tablet modules">
      {items.map((item) => {
        const Icon = item.icon;
        const active = (item.activeRoutes || [item.href]).some((route) => pathname === route || pathname.startsWith(`${route}/`));
        return <Link key={item.key} href={item.href} title={item.label} className={`grid h-12 w-full place-items-center rounded-2xl transition ${active ? "bg-sky-400/15 text-sky-100 shadow-[0_0_22px_rgba(56,189,248,0.17)]" : "text-white/48 hover:bg-white/[0.05] hover:text-white/80"}`}><Icon size={19} /></Link>;
      })}
    </nav>
  </aside>;
}
