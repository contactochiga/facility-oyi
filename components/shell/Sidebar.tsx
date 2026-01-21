"use client";

import { XMarkIcon } from "@heroicons/react/24/outline";
import SidebarContent from "./SidebarContent";

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
        <SidebarContent />
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
        className={`fixed inset-y-0 left-0 z-50 w-[280px] bg-zinc-950 border-r border-white/10
          transform transition-transform duration-200 ease-out lg:hidden
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="text-sm font-medium text-zinc-300">Navigation</div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-white/10"
          >
            <XMarkIcon className="h-5 w-5 text-zinc-300" />
          </button>
        </div>

        <SidebarContent onNavigate={onClose} />
      </aside>
    </>
  );
}
