// app/(protected)/layout.tsx
"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/shell/Sidebar";
import { FacilityShellProvider } from "@/components/shell/FacilityShellContext";
import { isExpired } from "@/lib/auth";
import { useSessionStore } from "@/store/useSessionStore";
import { usePathname, useRouter } from "next/navigation";
import { connectFacilityRealtime, disconnectFacilityRealtime } from "@/services/facilityRealtime";
import MobileModuleFooter from "@/components/navigation/MobileModuleFooter";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { hydrate, hydrated, token, user } = useSessionStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

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
      disconnectFacilityRealtime();
      return;
    }
    connectFacilityRealtime({
      token,
      estateId: (user as any)?.estate_id || null,
      userId: user.id,
    });
    return () => disconnectFacilityRealtime();
  }, [hydrated, token, user]);

  // Close drawer on route change (mobile nav feels clean)
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

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
        <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

        <div className="flex min-w-0 flex-1 flex-col h-screen overflow-hidden">
          <FacilityShellProvider openMenu={() => setMobileOpen(true)}>
            <main className="flex-1 min-h-0 overflow-y-auto p-4 pb-[calc(112px+env(safe-area-inset-bottom))] sm:p-6 sm:pb-[calc(118px+env(safe-area-inset-bottom))] xl:p-8">
              {children}
            </main>
            <MobileModuleFooter />
          </FacilityShellProvider>
        </div>
      </div>
    </div>
  );
}
