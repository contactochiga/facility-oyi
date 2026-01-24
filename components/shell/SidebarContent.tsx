"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FiChevronDown, FiChevronUp, FiLogOut } from "react-icons/fi";
import { MdOutlinePerson, MdSettings } from "react-icons/md";
import useAuth from "@/hooks/useAuth";

const NAV = [
  { href: "/overview", label: "Overview" },
  { href: "/devices", label: "Devices" },
  { href: "/maintenance", label: "Maintenance" },
  { href: "/visitors", label: "Visitors" },
  { href: "/alerts", label: "Alerts" },
];

export default function SidebarContent({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const [profileOpen, setProfileOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const initials = useMemo(() => {
    const name =
      (user as any)?.username ||
      (user as any)?.name ||
      (user as any)?.email ||
      "U";
    return String(name).trim().charAt(0).toUpperCase() || "U";
  }, [user]);

  const displayName =
    (user as any)?.username || (user as any)?.name || "Operator";
  const displayEmail = (user as any)?.email || "Account";

  const closeAll = () => {
    setProfileOpen(false);
    setShowLogoutConfirm(false);
    onNavigate?.();
  };

  const goToAccount = (tab?: "profile" | "settings") => {
    closeAll();
    router.push(tab ? `/account?tab=${tab}` : "/account");
  };

  const handleLogout = async () => {
    closeAll();
    await logout?.();
    try {
      localStorage.clear();
    } catch {}
    router.replace("/auth/login");
  };

  return (
    <>
      {/* Make the sidebar a full-height column so footer can sit at bottom */}
      <div className="flex h-full flex-col">
        {/* HEADER */}
        <div className="p-6">
          <div className="text-lg font-semibold tracking-tight">
            facility.oyi.com
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            Infrastructure control plane
          </div>
        </div>

        {/* NAV */}
        <nav className="px-4 pb-6 space-y-1">
          {NAV.map((n) => {
            const active = pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={closeAll}
                className={`block rounded-xl px-4 py-3 text-sm transition ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-zinc-300 hover:bg-white/5"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        {/* OPS CARD */}
        <div className="mt-auto p-4">
          <div className="glass p-4 text-xs text-zinc-400">
            <div className="font-medium text-zinc-200">Ops philosophy</div>
            <div className="mt-1">Simple UI. Hard control.</div>
          </div>

          {/* PROFILE / ACCOUNT FOOTER (Consumer-style) */}
          <div className="mt-4 border-t border-white/10 pt-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => goToAccount("profile")}
                className="flex items-center gap-3"
              >
                <div
                  className="w-12 h-12 rounded-full bg-[#E11D2E]
                             flex items-center justify-center
                             text-white font-semibold"
                >
                  {initials}
                </div>

                <div className="text-left">
                  <p className="text-white text-sm font-semibold">
                    {displayName}
                  </p>
                  <p className="text-white/50 text-xs">{displayEmail}</p>
                </div>
              </button>

              <button
                onClick={() => setProfileOpen((v) => !v)}
                className="text-white/70"
                aria-label="Toggle account menu"
              >
                {profileOpen ? <FiChevronUp /> : <FiChevronDown />}
              </button>
            </div>

            {profileOpen && (
              <div
                className="mt-3 bg-zinc-950/60
                           border border-white/10
                           rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => goToAccount("profile")}
                  className="w-full flex items-center gap-3
                             px-4 py-3 hover:bg-white/5 transition
                             text-zinc-200"
                >
                  <MdOutlinePerson /> Profile
                </button>

                <button
                  onClick={() => goToAccount("settings")}
                  className="w-full flex items-center gap-3
                             px-4 py-3 hover:bg-white/5 transition
                             text-zinc-200"
                >
                  <MdSettings /> Settings
                </button>

                <button
                  onClick={() => setShowLogoutConfirm(true)}
                  className="w-full flex items-center gap-3
                             px-4 py-3 text-[#E11D2E]
                             hover:bg-white/5 transition"
                >
                  <FiLogOut /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* LOGOUT CONFIRM (same behavior as consumer) */}
      {showLogoutConfirm && (
        <div
          className="fixed inset-0 z-[120]
                     bg-black/70 backdrop-blur
                     flex items-center justify-center px-6"
        >
          <div
            className="bg-zinc-950 p-6 rounded-2xl
                       w-full max-w-sm
                       border border-white/10"
          >
            <p className="text-white text-center font-semibold text-lg mb-6">
              Logout from Facility Control?
            </p>

            <div className="flex gap-4">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-white/10 text-white"
              >
                Cancel
              </button>

              <button
                onClick={handleLogout}
                className="flex-1 py-3 rounded-xl bg-[#E11D2E] text-white"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
