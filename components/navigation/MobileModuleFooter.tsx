"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useRef } from "react";
import { Mic } from "lucide-react";
import { facilityMobileModules, type MobileModuleItem } from "./mobileNavConfig";
import { useSessionStore } from "@/store/useSessionStore";
import { FACILITY_MODULES, visibleModules } from "@/lib/moduleRegistry";
import { iconForDomain } from "@/lib/oisIconRegistry";
import { useFacilityAssistantStore } from "@/store/useFacilityAssistantStore";

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
  const { user } = useSessionStore();
  const railRef = useRef<HTMLDivElement | null>(null);
  const openingIntelligenceRef = useRef(false);
  const openAssistant = useFacilityAssistantStore((state) => state.openAssistant);
  const IntelligenceIcon = iconForDomain("operationalIntelligence");
  const visibleKeys = useMemo(() => new Set(visibleModules(user, FACILITY_MODULES).map((module) => module.key)), [user]);
  const visibleItems = useMemo(() => items.filter((item) => visibleKeys.has(item.key)), [items, visibleKeys]);
  const activeKey = useMemo(() => visibleItems.find((item) => isActive(pathname, item))?.key || "", [pathname, visibleItems]);
  const intelligenceActive = routeMatches(pathname, "/facility-intelligence");
  function openIntelligence() {
    if (openingIntelligenceRef.current || intelligenceActive) return;
    openingIntelligenceRef.current = true;
    openAssistant("Summarize current operational attention and verification priority.");
    window.setTimeout(() => {
      openingIntelligenceRef.current = false;
    }, 240);
  }

  function handleRailScroll() {
    const rail = railRef.current;
    if (!rail || openingIntelligenceRef.current) return;
    if (rail.scrollWidth - rail.clientWidth - rail.scrollLeft <= 16) openIntelligence();
  }

  return (
    <nav
      aria-label="Facility mobile modules"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(10px+env(safe-area-inset-bottom))] md:hidden"
    >
      <div className="pointer-events-auto mx-auto w-[94vw] max-w-[430px] overflow-hidden rounded-[28px] border border-white/[0.08] bg-zinc-950/84 px-2 py-2 shadow-[0_18px_60px_rgba(0,0,0,0.48)] backdrop-blur-2xl">
        <div ref={railRef} onScroll={handleRailScroll} className="flex items-center gap-1.5 overflow-x-auto overscroll-x-contain scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = activeKey === item.key;
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-w-[68px] shrink-0 flex-col items-center justify-center rounded-[22px] px-2 py-1.5 text-center transition-all duration-300 active:scale-[0.98]",
                  active
                    ? "bg-[radial-gradient(circle_at_50%_12%,rgba(255,255,255,0.18),rgba(56,189,248,0.13)_42%,rgba(255,255,255,0.055)_100%)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_0_24px_rgba(56,189,248,0.18)]"
                    : "text-white/48 hover:bg-white/[0.04] hover:text-white/78"
                )}
              >
                <span className={cn("grid h-8 w-8 place-items-center rounded-[14px] transition-all duration-300", active ? "text-sky-100" : "text-white/56")}>
                  <Icon size={17} />
                </span>
                <span className={cn("mt-0.5 block w-full truncate text-[10px] font-medium tracking-[-0.02em]", active ? "text-white" : "text-white/46")}>{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={openIntelligence}
            aria-label="Open Operational Intelligence"
            aria-current={intelligenceActive ? "page" : undefined}
            className={cn(
              "ml-1 flex shrink-0 items-center gap-2 rounded-[22px] border border-sky-300/15 bg-[radial-gradient(circle_at_14%_18%,rgba(56,189,248,0.18),rgba(255,255,255,0.052)_42%,rgba(255,255,255,0.025)_100%)] px-3 py-2 text-left text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_0_24px_rgba(56,189,248,0.16)] transition active:scale-[0.99]",
              intelligenceActive && "border-sky-200/30"
            )}
          >
            <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full border border-sky-200/20 bg-sky-400/12">
              <IntelligenceIcon size={16} className="text-sky-100" />
            </span>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.055] text-sky-100">
              <Mic size={14} />
            </span>
          </button>
        </div>
      </div>
    </nav>
  );
}
