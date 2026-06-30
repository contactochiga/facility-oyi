"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Brain, Mic, Pause, SendHorizontal } from "lucide-react";
import { facilityMobileModules, type MobileModuleItem } from "./mobileNavConfig";
import { useSessionStore } from "@/store/useSessionStore";
import { FACILITY_MODULES, visibleModules } from "@/lib/moduleRegistry";
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

const PAGE_ONE_KEYS = ["overview", "live-infrastructure", "estate-structure", "hardware-devices", "security-access"];
const PAGE_TWO_KEYS = ["utilities", "community", "wallets", "administration"];

export default function MobileModuleFooter({ items = facilityMobileModules }: { items?: MobileModuleItem[] }) {
  const pathname = usePathname() || "/overview";
  const router = useRouter();
  const { user } = useSessionStore();
  const openVoiceAssistant = useFacilityAssistantStore((state) => state.openVoiceAssistant);
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
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setPageIndex(detectedPage);
  }, [detectedPage]);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  function startRecording() {
    setElapsed(0);
    setRecording(true);
  }

  function stopRecording() {
    setRecording(false);
  }

  function sendRecording() {
    setRecording(false);
    setElapsed(0);
    openVoiceAssistant("Review the current operational situation from the operator voice note.");
  }

  function formatTimer(seconds: number) {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }

  const currentPage = pages[pageIndex] || [];

  return (
    <nav
      aria-label="Facility mobile modules"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(10px+env(safe-area-inset-bottom))] md:hidden"
    >
      <div className="pointer-events-auto mx-auto w-[94vw] max-w-[430px] overflow-hidden rounded-[28px] border border-white/[0.08] bg-zinc-950/86 px-2.5 py-2 shadow-[0_18px_60px_rgba(0,0,0,0.48)] backdrop-blur-2xl">
        <div className={cn("grid gap-1.5", currentPage.length === 4 ? "grid-cols-4" : "grid-cols-5")}>
          {currentPage.map((item) => {
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

        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
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

          {recording ? (
            <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
              <div className="flex min-w-0 items-center gap-2 rounded-full border border-rose-300/14 bg-rose-400/[0.08] px-3 py-1.5 text-[11px] text-rose-50/88">
                <span className="flex items-end gap-[2px]">
                  {[10, 14, 8, 16].map((height, index) => (
                    <span
                      key={index}
                      className="w-[3px] animate-pulse rounded-full bg-rose-200/85"
                      style={{ height }}
                    />
                  ))}
                </span>
                <span className="tabular-nums">{formatTimer(elapsed)}</span>
              </div>
              <button
                type="button"
                onClick={stopRecording}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.045] text-white/84"
                aria-label="Stop recording"
              >
                <Pause className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={sendRecording}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sky-300 text-slate-950"
                aria-label="Send recording"
              >
                <SendHorizontal className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => startRecording()}
                className="grid h-9 w-9 place-items-center rounded-full border border-white/[0.08] bg-white/[0.045] text-white/84"
                aria-label="Start recording"
              >
                <Mic className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => router.push("/facility-intelligence")}
                className="grid h-9 w-9 place-items-center rounded-full border border-sky-300/18 bg-sky-400/[0.10] text-sky-100 shadow-[0_0_20px_rgba(56,189,248,0.18)]"
                aria-label="Open Operational Intelligence"
              >
                <Brain className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
