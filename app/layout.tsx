"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/shell/Sidebar";
import Topbar from "@/components/shell/Topbar";
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <html lang="en">
      <body className="bg-zinc-950 text-white">
        <div className="flex min-h-screen">
          <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="p-4 lg:p-6">
              <Topbar
                title="Facility Control"
                subtitle="Infrastructure control plane"
                onOpenMenu={() => setMobileOpen(true)}
              />
            </div>

            <main className="flex-1 overflow-y-auto px-4 pb-4 lg:px-6 lg:pb-6">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
