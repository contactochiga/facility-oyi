"use client";

import Image from "next/image";
import Link from "next/link";
import SidebarContent from "./SidebarContent";

function SidebarBrand({ onClick }: { onClick?: () => void }) {
  return (
    <div className="px-5 py-5 border-b border-white/[0.07]">
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
            Building Operations
          </div>
        </div>
      </Link>
    </div>
  );
}

export default function Sidebar({
  mobileOpen: _mobileOpen,
  onClose: _onClose,
}: {
  mobileOpen: boolean;
  onClose: () => void;
}) {
  return (
    <>
      {/* Desktop */}
      <aside className="hidden xl:flex h-screen w-[264px] flex-col border-r border-white/[0.08] bg-[#050b13]">
        <SidebarBrand />
        <div className="flex-1 overflow-y-auto">
          <SidebarContent />
        </div>
      </aside>
    </>
  );
}
