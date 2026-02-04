// app/(protected)/layout.tsx
"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/shell/Sidebar";
import { useSessionStore } from "@/store/useSessionStore";
import { usePathname } from "next/navigation";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { hydrate } = useSessionStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

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

  return (
    // ✅ Key change: lock the shell to the viewport; prevent page scroll
    <div className="h-screen overflow-hidden bg-zinc-950">
      <div className="absolute inset-0 bg-grid opacity-[0.10]" />

      {/* ✅ Key change: also lock this container to screen height */}
      <div className="relative flex h-screen overflow-hidden">
        {/* Sidebar: already h-screen in your Sidebar.tsx for desktop */}
        <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

        {/* ✅ Key change: min-w-0 + h-screen + overflow-hidden */}
        <div className="flex min-w-0 flex-1 flex-col h-screen overflow-hidden">
          {/* No global Topbar here (pages handle Topbar individually) */}

          {/* ✅ Key change: ONLY main scrolls */}
          <main className="flex-1 min-h-0 overflow-y-auto p-6 lg:p-10">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
