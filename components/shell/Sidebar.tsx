"use client";

import Image from "next/image";
import Link from "next/link";
import SidebarContent from "./SidebarContent";

function SidebarBrand({ onClick }: { onClick?: () => void }) {
  return (
    <div className="p-6 border-b border-white/10">
      <Link
        href="/overview"
        onClick={onClick}
        className="flex items-center gap-3 group"
      >
        <div
          className="shrink-0 rounded-lg bg-white/5 border border-white/10 overflow-hidden"
          style={{ width: 40, height: 40 }}
        >
          <Image
            src="/oyi-logo-transparent.png"
            alt="Oyi Facility"
            width={40}
            height={40}
            className="object-contain p-1.5"
            priority
          />
        </div>

        <div className="min-w-0">
          <div className="text-base font-semibold text-zinc-100 truncate group-hover:text-white">
            Oyi Facility
          </div>
          <div className="text-xs text-zinc-400 truncate">
            Infrastructure operating system
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
      {/* Desktop */}
      <aside className="hidden xl:flex h-screen w-[280px] flex-col border-r border-white/10 bg-zinc-950">
        <SidebarBrand />
        <div className="flex-1 overflow-y-auto">
          <SidebarContent />
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[280px]
          bg-zinc-950 border-r border-white/10
          transform transition-transform duration-200 ease-out md:hidden
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="flex h-[100dvh] flex-col">
          <div className="border-b border-white/10">
            <SidebarBrand onClick={onClose} />
          </div>

          <div className="flex-1 overflow-y-auto">
            <SidebarContent onNavigate={onClose} />
          </div>
        </div>
      </aside>
    </>
  );
}
