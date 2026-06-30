// app/(protected)/layout.tsx
"use client";

import { useEffect } from "react";
import Sidebar from "@/components/shell/Sidebar";
import { FacilityShellProvider } from "@/components/shell/FacilityShellContext";
import { isExpired } from "@/lib/auth";
import { useSessionStore } from "@/store/useSessionStore";
import { usePathname, useRouter } from "next/navigation";
import { connectFacilityRealtime, disconnectFacilityRealtime } from "@/services/facilityRealtime";
import MobileModuleFooter from "@/components/navigation/MobileModuleFooter";
import TabletModuleRail from "@/components/navigation/TabletModuleRail";
import { WorkflowDetailDrawerHost } from "@/components/modules/WorkflowDetailDrawer";
import { PredictionDetailDrawerHost } from "@/components/modules/PredictionDetailDrawer";
import { InfrastructureDetailDrawerHost } from "@/components/modules/InfrastructureDetailDrawer";
import { useContextStore } from "@/store/useContextStore";
import FacilityAssistantSheet from "@/components/shell/FacilityAssistantSheet";
import ShellTopbar from "@/components/shell/ShellTopbar";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { hydrate, hydrated, token, user } = useSessionStore();
  const { context, refresh: refreshContext, clear: clearContext } = useContextStore();
  const pathname = usePathname();
  const router = useRouter();
  const fullScreenIntelligence = pathname === "/facility-intelligence";

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    if (token && user && !isExpired(user)) return;
    const query = typeof window === "undefined" ? "" : window.location.search.replace(/^\?/, "");
    const destination = `${pathname || "/overview"}${query ? `?${query}` : ""}`;
    router.replace(`/login?next=${encodeURIComponent(destination)}`);
  }, [hydrated, pathname, router, token, user]);

  useEffect(() => {
    if (!hydrated || !token || !user || isExpired(user)) {
      clearContext();
      return;
    }
    void refreshContext();
  }, [clearContext, hydrated, refreshContext, token, user]);

  useEffect(() => {
    if (!hydrated || !token || !user || isExpired(user)) {
      disconnectFacilityRealtime();
      return;
    }
    connectFacilityRealtime({
      token,
      estateId: context?.estate_id || (user as any)?.estate_id || null,
      userId: user.id,
    });
    return () => disconnectFacilityRealtime();
  }, [context?.estate_id, hydrated, token, user]);

  if (!hydrated || !token || !user || isExpired(user)) {
    return (
      <div className="grid h-screen place-items-center overflow-hidden bg-zinc-950">
        <div className="absolute inset-0 bg-grid opacity-[0.10]" />
        <div className="relative flex items-center gap-3 text-sm text-zinc-400">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-sky-400" />
          Securing operator session
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-zinc-950">
      <div className="absolute inset-0 bg-grid opacity-[0.10]" />

      <div className="relative flex h-screen overflow-hidden">
        <Sidebar mobileOpen={false} onClose={() => undefined} />
        <TabletModuleRail />

        <div className="flex min-w-0 flex-1 flex-col h-screen overflow-hidden">
          <FacilityShellProvider openMenu={() => undefined}>
            {fullScreenIntelligence ? <div className="hidden md:block"><ShellTopbar /></div> : <ShellTopbar />}
            <main key={context?.estate_id || (user as any)?.estate_id || "facility"} className={`flex-1 min-h-0 overflow-y-auto ${fullScreenIntelligence ? "px-0 pb-0 pt-0 md:px-5 md:pb-6 md:pt-5 xl:px-7 xl:pt-6" : "px-3 pb-[calc(104px+env(safe-area-inset-bottom))] pt-3 sm:px-5 sm:pb-6 sm:pt-5 xl:px-7 xl:pt-6"}`}>
              {children}
            </main>
            {!fullScreenIntelligence ? <MobileModuleFooter /> : null}
            <FacilityAssistantSheet />
            <WorkflowDetailDrawerHost />
            <PredictionDetailDrawerHost />
            <InfrastructureDetailDrawerHost />
          </FacilityShellProvider>
        </div>
      </div>
    </div>
  );
}
