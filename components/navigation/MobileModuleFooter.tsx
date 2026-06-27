"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useRef } from "react";
import { Mic } from "lucide-react";
import { facilityMobileModules, type MobileModuleItem } from "./mobileNavConfig";
import { useSessionStore } from "@/store/useSessionStore";
import { FACILITY_MODULES, visibleModules } from "@/lib/moduleRegistry";
import { iconForDomain } from "@/lib/oisIconRegistry";

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
  const router = useRouter();
  const { user } = useSessionStore();
  const railRef = useRef<HTMLDivElement | null>(null);
  const openingIntelligenceRef = useRef(false);
  const IntelligenceIcon = iconForDomain("operationalIntelligence");
  const visibleKeys = useMemo(() => new Set(visibleModules(user, FACILITY_MODULES).map((module) => module.key)), [user]);
  const visibleItems = useMemo(() => items.filter((item) => visibleKeys.has(item.key)), [items, visibleKeys]);
  const activeKey = useMemo(() => visibleItems.find((item) => isActive(pathname, item))?.key || "", [pathname, visibleItems]);
  const intelligenceActive = routeMatches(pathname, "/facility-intelligence");
  const modulePages = useMemo(() => [visibleItems.slice(0, 5), visibleItems.slice(5, 10)].filter((page) => page.length > 0), [visibleItems]);

  function openIntelligence() {
    if (openingIntelligenceRef.current || intelligenceActive) return;
    openingIntelligenceRef.current = true;
    router.push("/facility-intelligence?module=mobile-footer&focus=1");
  }

  function handleRailScroll() {
    const rail = railRef.current;
    if (!rail || openingIntelligenceRef.current) return;
    // The third snap page is the Oyi composer: reaching it opens the conversation directly.
    if (rail.scrollLeft >= rail.clientWidth * 1.8) openIntelligence();
  }

  return (
    <nav
      aria-label="Facility mobile modules"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(10px+env(safe-area-inset-bottom))] md:hidden"
    >
      <div className="pointer-events-auto mx-auto w-[92vw] max-w-[430px] overflow-hidden rounded-[30px] border border-white/[0.08] bg-zinc-950/82 px-2 py-2 shadow-[0_18px_60px_rgba(0,0,0,0.48)] backdrop-blur-2xl">
        <div ref={railRef} onScroll={handleRailScroll} className="flex snap-x snap-mandatory gap-1 overflow-x-auto overscroll-x-contain scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {modulePages.map((page, index) => (
            <div key={`module-page-${index}`} className="grid min-w-full shrink-0 snap-start grid-cols-5 gap-1">
              {page.map((item) => {
                const Icon = item.icon;
                const active = activeKey === item.key;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex min-w-0 flex-col items-center justify-center rounded-[24px] px-2 py-1.5 text-center transition-all duration-300 active:scale-[0.98]",
                      active
                        ? "bg-[radial-gradient(circle_at_50%_12%,rgba(255,255,255,0.18),rgba(56,189,248,0.13)_42%,rgba(255,255,255,0.055)_100%)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_0_28px_rgba(56,189,248,0.22)]"
                        : "text-white/50 hover:bg-white/[0.04] hover:text-white/80"
                    )}
                  >
                    <span className={cn("grid h-9 w-9 place-items-center rounded-[16px] transition-all duration-300", active ? "text-sky-100" : "text-white/58")}>
                      <Icon size={18} />
                    </span>
                    <span className={cn("mt-0.5 block w-full truncate text-[10px] font-medium tracking-[-0.02em]", active ? "text-white" : "text-white/48")}>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
          <button
            type="button"
            onClick={openIntelligence}
            aria-label="Open Operational Intelligence"
            aria-current={intelligenceActive ? "page" : undefined}
            className={cn(
              "flex min-w-full shrink-0 snap-start items-center gap-3 rounded-[24px] border border-sky-300/15 bg-[radial-gradient(circle_at_14%_18%,rgba(56,189,248,0.18),rgba(255,255,255,0.052)_42%,rgba(255,255,255,0.025)_100%)] px-3 py-2.5 text-left text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_0_30px_rgba(56,189,248,0.18)] transition active:scale-[0.99]",
              intelligenceActive && "border-sky-200/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_0_34px_rgba(56,189,248,0.26)]"
            )}
          >
            <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full border border-sky-200/20 bg-sky-400/12 shadow-[0_0_24px_rgba(56,189,248,0.28)]">
              <IntelligenceIcon size={18} className="text-sky-100 drop-shadow-[0_0_10px_rgba(125,211,252,0.75)]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-medium tracking-[-0.02em] text-white/86">Operational Intelligence</span>
              <span className="mt-0.5 block text-[10px] text-white/42">Ask Oyi about attention, ownership, verification, or continuity</span>
            </span>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.055] text-sky-100 shadow-[0_0_20px_rgba(56,189,248,0.16)]">
              <Mic size={16} />
            </span>
          </button>
        </div>
      </div>
    </nav>
  );
}
