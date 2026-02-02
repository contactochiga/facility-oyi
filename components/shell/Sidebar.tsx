"use client";

import Image from "next/image";
import Link from "next/link";
import { XMarkIcon } from "@heroicons/react/24/outline";
import SidebarContent from "./SidebarContent";

function SidebarBrand({ onClick }: { onClick?: () => void }) {
  return (
    <div className="p-5 border-b border-white/10">
      <Link
        href="/overview"
        onClick={onClick}
        className="flex items-center gap-3 group"
      >
        <div className="relative h-9 w-9 shrink-0">
          <Image
            src="/oyi-logo-transparent.png"
            alt="OI"
            fill
            className="object-contain"
            priority
          />
        </div>

        <div className="min-w-0">
          <div className="text-sm font-semibold text-zinc-100 truncate group-hover:text-white">
            facility.getoyi.com
          </div>
          <div className="text-xs text-zinc-500 truncate">
            Infrastructure control plane
          </div>
        </div>
      </Link>
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
      <aside className="hidden lg:flex h-screen w-[280px] flex-col border-r border-white/10 bg-zinc-950">
        <div className="flex h-full flex-col">
          {/* ✅ Brand header */}
          <SidebarBrand />

          {/* Navigation + user block */}
          <SidebarContent />
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[280px]
          bg-zinc-950 border-r border-white/10
          transform transition-transform duration-200 ease-out lg:hidden
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* ✅ Full height column */}
        <div className="flex h-[100dvh] flex-col">
          <div className="flex items-center justify-between border-b border-white/10">
            {/* ✅ Brand header (mobile) */}
            <div className="flex-1">
              <SidebarBrand onClick={onClose} />
            </div>

            <button
              onClick={onClose}
              className="m-3 rounded-lg p-2 hover:bg-white/10"
              aria-label="Close navigation"
            >
              <XMarkIcon className="h-5 w-5 text-zinc-300" />
            </button>
          </div>

          {/* ✅ SidebarContent gets a flex parent so mt-auto works */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <SidebarContent onNavigate={onClose} />
          </div>
        </div>
      </aside>
    </>
  );
}
