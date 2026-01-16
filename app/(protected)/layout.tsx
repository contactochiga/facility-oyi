"use client";

import Sidebar from "@/components/shell/Sidebar";
import { useEffect } from "react";
import { useSessionStore } from "@/store/useSessionStore";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { hydrate } = useSessionStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="absolute inset-0 bg-grid opacity-[0.10]" />
      <div className="relative flex">
        <Sidebar />
        <main className="flex-1 p-6 lg:p-10">{children}</main>
      </div>
    </div>
  );
}
