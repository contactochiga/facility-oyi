"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/shell/Sidebar";
import Topbar from "@/components/shell/Topbar";
import { useSessionStore } from "@/store/useSessionStore";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { hydrate } = useSessionStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="absolute inset-0 bg-grid opacity-[0.10]" />

      <div className="relative flex min-h-screen">
        <Sidebar
          mobileOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Topbar gives mobile the hamburger */}
          <div className="p-6 lg:p-10 pb-0">
            <Topbar
              title="Facility Control"
              subtitle="Infrastructure control plane"
              onOpenMenu={() => setMobileOpen(true)}
            />
          </div>

          <main className="flex-1 p-6 lg:p-10 pt-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
