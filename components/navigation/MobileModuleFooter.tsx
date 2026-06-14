"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { Bot } from "lucide-react";
import MobileAiChip from "./MobileAiChip";
import { facilityMobileModules, type MobileModuleItem } from "./mobileNavConfig";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function routeMatches(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function isActive(pathname: string, item: MobileModuleItem) {
  return (item.activeRoutes || [item.href]).some((route) => routeMatches(pathname, route));
}

export default function MobileModuleFooter({ items = facilityMobileModules }: { items?: MobileModuleItem[] }) {
  const pathname = usePathname() || "/overview";
  const activeKey = useMemo(() => items.find((item) => isActive(pathname, item))?.key || "", [items, pathname]);

  return (
    <nav
      aria-label="Facility mobile modules"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(10px+env(safe-area-inset-bottom))] xl:hidden"
    >
      <div className="pointer-events-auto mx-auto w-[92vw] max-w-[430px] overflow-hidden rounded-[30px] border border-white/[0.08] bg-zinc-950/82 px-2 py-2 shadow-[0_18px_60px_rgba(0,0,0,0.48)] backdrop-blur-2xl">
        <div className="flex snap-x snap-mandatory gap-1 overflow-x-auto overscroll-x-contain scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item) => {
            const Icon = item.icon;
            const active = activeKey === item.key;
            const isAi = item.key === "ai";
            return (
              <Link
                key={item.key}
                href={item.href}
                style={{ minWidth: "calc((100% - 16px) / 5)" }}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex shrink-0 snap-start flex-col items-center justify-center rounded-[24px] px-2 py-1.5 text-center transition-all duration-300 active:scale-[0.98]",
                  active
                    ? "bg-[radial-gradient(circle_at_50%_12%,rgba(255,255,255,0.18),rgba(56,189,248,0.13)_42%,rgba(255,255,255,0.055)_100%)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_0_28px_rgba(56,189,248,0.22)]"
                    : "text-white/50 hover:bg-white/[0.04] hover:text-white/80"
                )}
              >
                {isAi ? (
                  <MobileAiChip icon={Bot} active={active} />
                ) : (
                  <span className={cn("grid h-9 w-9 place-items-center rounded-[16px] transition-all duration-300", active ? "text-sky-100" : "text-white/58")}>
                    <Icon size={18} />
                  </span>
                )}
                <span className={cn("mt-0.5 max-w-full truncate text-[10px] font-medium tracking-[-0.02em]", active ? "text-white" : "text-white/48")}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
