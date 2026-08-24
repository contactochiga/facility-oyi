"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import { facilityMobileModules, type MobileModuleItem } from "./mobileNavConfig";
import { useSessionStore } from "@/store/useSessionStore";
import { FACILITY_MODULES, visibleModules } from "@/lib/moduleRegistry";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function routeMatches(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function isActive(pathname: string, item: MobileModuleItem) {
  return (item.activeRoutes || [item.href]).some((route) => routeMatches(pathname, route));
}

const PAGE_ONE_KEYS = ["overview", "estate-structure", "hardware-devices", "security-access", "utilities"];
const PAGE_TWO_KEYS = ["environment-sensors", "traffic-mobility", "maintenance", "community", "wallets"];

export default function MobileModuleFooter({ items = facilityMobileModules }: { items?: MobileModuleItem[] }) {
  const pathname = usePathname() || "/overview";
  const { user } = useSessionStore();
  const visibleKeys = useMemo(() => new Set(visibleModules(user, FACILITY_MODULES).map((module) => module.key)), [user]);
  const visibleItems = useMemo(() => items.filter((item) => visibleKeys.has(item.key)), [items, visibleKeys]);
  const pages = useMemo(() => [
    visibleItems.filter((item) => PAGE_ONE_KEYS.includes(item.key)),
    visibleItems.filter((item) => PAGE_TWO_KEYS.includes(item.key)),
  ], [visibleItems]);
  const detectedPage = useMemo(() => {
    const activeKey = visibleItems.find((item) => isActive(pathname, item))?.key;
    return PAGE_TWO_KEYS.includes(String(activeKey)) ? 1 : 0;
  }, [pathname, visibleItems]);
  const [pageIndex, setPageIndex] = useState(detectedPage);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    setPageIndex(detectedPage);
  }, [detectedPage]);

  function onTouchStart(event: TouchEvent<HTMLDivElement>) {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  }

  function onTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (touchStartX.current == null) return;
    const delta = (event.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 24) return;
    if (delta < 0 && pageIndex < 1) setPageIndex(1);
    if (delta > 0 && pageIndex > 0) setPageIndex(0);
  }

  return (
    <nav
      aria-label="Facility mobile modules"
      className="pointer-events-none fixed left-0 right-0 z-40 md:hidden"
      style={{ bottom: "0px", width: "100%", maxWidth: "100vw", transform: "translate3d(0, calc(-1 * var(--oyi-visual-bottom, 0px)), 0)" }}
    >
      <div className="pointer-events-auto mx-auto overflow-hidden rounded-[28px] border border-white/[0.08] bg-zinc-950/86 px-2.5 py-2 shadow-[0_18px_60px_rgba(0,0,0,0.48)] backdrop-blur-2xl" style={{ width: "min(calc(100% - 24px), 430px)", maxWidth: "calc(100vw - 24px)", marginBottom: "calc(10px + env(safe-area-inset-bottom))", transform: "translate3d(0, 0, 0)" }}>
        <div className="overflow-hidden" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <div
            className="flex w-[200%] transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${pageIndex * 50}%)` }}
          >
            {pages.map((pageItems, pageNumber) => (
              <div key={pageNumber} className="w-1/2 shrink-0">
                <div className={cn("grid gap-1.5", pageItems.length === 6 ? "grid-cols-6" : "grid-cols-5")}>
                  {pageItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(pathname, item);
                    return (
                      <Link
                        key={item.key}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "relative flex min-w-0 flex-col items-center justify-center rounded-[22px] px-1.5 py-1.5 text-center transition-all duration-300 active:scale-[0.98]",
                          active
                            ? "bg-[radial-gradient(circle_at_50%_12%,rgba(255,255,255,0.18),rgba(56,189,248,0.13)_42%,rgba(255,255,255,0.055)_100%)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_0_24px_rgba(56,189,248,0.18)]"
                            : "text-white/48 hover:bg-white/[0.04] hover:text-white/78"
                        )}
                      >
                        <span className={cn("grid h-8 w-8 place-items-center rounded-[14px] transition-all duration-300", active ? "text-sky-100" : "text-white/56")}>
                          <Icon size={17} />
                        </span>
                        <span className={cn("mt-0.5 block w-full truncate text-[10px] font-medium tracking-[-0.02em]", active ? "text-white" : "text-white/46")}>
                          {item.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-2 flex items-center justify-center gap-1.5">
            {[0, 1].map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setPageIndex(page)}
                aria-label={`Show navigation set ${page + 1}`}
                className={cn(
                  "h-2 rounded-full transition-all",
                  pageIndex === page ? "w-5 bg-sky-300" : "w-2 bg-white/20"
                )}
              />
            ))}
        </div>
      </div>
    </nav>
  );
}
