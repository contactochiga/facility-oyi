"use client";

import Image from "next/image";
import Link from "next/link";
import SidebarContent from "./SidebarContent";

function SidebarBrand({ onClick }: { onClick?: () => void }) {
  return (
    <div className="border-b border-white/[0.07] px-5 py-4">
      <Link
        href="/overview"
        onClick={onClick}
        className="group flex items-center gap-2.5 rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/70"
      >
        <div
          className="shrink-0 overflow-hidden"
          style={{ width: 28, height: 28 }}
        >
          <Image
            src="/oyi-logo-transparent.png"
            alt="Oyi Facility"
            width={28}
            height={28}
            className="object-contain"
            priority
          />
        </div>

        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold leading-[18px] text-zinc-100 group-hover:text-white">
            Oyi Facility
          </div>
          <div className="truncate text-[10.5px] leading-[15px] text-zinc-400">
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
      <aside className="hidden h-screen w-[236px] flex-col border-r border-white/[0.08] bg-[#050b13] xl:flex">
        <SidebarBrand />
        <div className="flex-1 overflow-y-auto">
          <SidebarContent />
        </div>
      </aside>
    </>
  );
}
