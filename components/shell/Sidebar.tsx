"use client";

import Image from "next/image";
import Link from "next/link";
import { XMarkIcon } from "@heroicons/react/24/outline";
import SidebarContent from "./SidebarContent";

function SidebarBrand({ onClick }: { onClick?: () => void }) {
  return (
    <div className="px-6 py-6 border-b border-white/10 bg-zinc-950/40">
      <Link
        href="/overview"
        onClick={onClick}
        className="flex items-center gap-3 group"
      >
        <div className="relative h-10 w-10 shrink-0 rounded-lg bg-white/5 border border-white/10 overflow-hidden">
          <Image
            src="/oyi-logo-transparent.png"
            alt="Oyi"
            fill
            className="object-contain p-1.5"
            priority
          />
        </div>

        <div className="min-w-0">
          <div className="text-base font-semibold text-zinc-100 truncate group-hover:text-white">
            City Manager
          </div>
          <div className="text-xs text-zinc-400 truncate">
            Infrastructure control plane
          </div>
        </div>
      </Link>

      {/* small descriptor line (matches your sample) */}
      <div className="mt-3 text-sm text-zinc-500">
        Facility operations console
      </div>
    </div>
  );
}

function SidebarFooter() {
  return (
    <div className="p-4 border-t border-white/10 bg-zinc-950/40">
      <div className="flex items-center gap-3 px-3 py-3 rounded-xl border border-white/10 bg-white/5">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-100 truncate">
            Admin User
          </p>
          <p className="text-xs text-zinc-400 truncate">System Manager</p>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({
  mobileOpen,
  onClose,
}: {
  mobileOpen: boolean;
  onClose: () => void;
}) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex h-screen w-[280px] flex-col border-r border-white/10 bg-slate-950">
        {/* subtle panel tint like your sample */}
        <div className="flex h-full flex-col bg-white/[0.02]">
          <SidebarBrand />

          {/* Navigation (keep your current logic inside SidebarContent) */}
          <div className="flex-1 overflow-hidden px-3 py-4">
            <div className="h-full rounded-2xl border border-white/10 bg-black/20 overflow-hidden">
              <div className="h-full overflow-y-auto p-2">
                <SidebarContent />
              </div>
            </div>
          </div>

          <SidebarFooter />
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-[280px]
          bg-slate-950 border-r border-white/10
          transform transition-transform duration-200 ease-out lg:hidden
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="flex h-[100dvh] flex-col bg-white/[0.02]">
          <div className="flex items-start justify-between border-b border-white/10">
            <div className="flex-1">
              <SidebarBrand onClick={onClose} />
            </div>

            <button
              onClick={onClose}
              className="m-4 rounded-xl p-2 hover:bg-white/10"
              aria-label="Close navigation"
            >
              <XMarkIcon className="h-5 w-5 text-zinc-300" />
            </button>
          </div>

          <div className="flex-1 overflow-hidden px-3 py-4">
            <div className="h-full rounded-2xl border border-white/10 bg-black/20 overflow-hidden">
              <div className="h-full overflow-y-auto p-2">
                <SidebarContent onNavigate={onClose} />
              </div>
            </div>
          </div>

          <SidebarFooter />
        </div>
      </aside>
    </>
  );
}
