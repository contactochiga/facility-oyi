// components/shell/SidebarContent.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { FiChevronDown, FiChevronUp, FiLogOut } from "react-icons/fi";
import { MdOutlinePerson, MdSettings } from "react-icons/md";

const NAV = [
  { href: "/overview", label: "Overview" },

  // ✅ rename to feel infra-grade
  { href: "/devices", label: "Hardware Devices" },

  { href: "/maintenance", label: "Maintenance" },
  { href: "/visitors", label: "Visitors" },

  // ✅ Alerts removed, Wallet + Community added
  { href: "/wallets", label: "Wallets" },
  { href: "/community", label: "Community" },

  // ✅ NEW: Facility Services (utilities + estate payments)
  { href: "/services", label: "Facility Services" },
];

// --- tiny cookie helpers ---
function getCookie(name: string) {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(
    new RegExp(
      `(?:^|; )${name.replace(/[$()*+.?[\\\]^{|}-]/g, "\\$&")}=([^;]*)`
    )
  );
  return m ? decodeURIComponent(m[1]) : null;
}

function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
}

type Decoded = {
  email?: string;
  username?: string;
  name?: string;
  role?: string;
  id?: string;
};

export default function SidebarContent({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [profileOpen, setProfileOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const token = useMemo(() => {
    if (typeof window === "undefined") return null;
    return (
      getCookie("oyi_facility_token") ||
      getCookie("facility_token") ||
      getCookie("oyi_consumer_token") ||
      localStorage.getItem("oyi_facility_token") ||
      localStorage.getItem("facility_token") ||
      localStorage.getItem("oyi_consumer_token")
    );
  }, []);

  const decoded = useMemo<Decoded | null>(() => {
    if (!token) return null;
    try {
      return jwtDecode<Decoded>(token);
    } catch {
      return null;
    }
  }, [token]);

  const displayName =
    decoded?.username ||
    decoded?.name ||
    (decoded?.email ? decoded.email.split("@")[0] : null) ||
    "Operator";

  const displayEmail = decoded?.email || "Account";

  const initials = useMemo(() => {
    const s = (displayName || "O").trim();
    return s ? s[0].toUpperCase() : "O";
  }, [displayName]);

  const closeAll = () => {
    setProfileOpen(false);
    setShowLogoutConfirm(false);
    onNavigate?.();
  };

  const goToAccount = (tab?: "profile" | "settings") => {
    closeAll();
    router.push(tab ? `/account?tab=${tab}` : "/account");
  };

  const logout = () => {
    deleteCookie("oyi_facility_token");
    deleteCookie("facility_token");
    deleteCookie("oyi_consumer_token");

    if (typeof window !== "undefined") {
      localStorage.removeItem("oyi_facility_token");
      localStorage.removeItem("facility_token");
      localStorage.removeItem("oyi_consumer_token");
      localStorage.removeItem("token");
    }

    closeAll();
    router.replace("/auth/login");
  };

  return (
    <div className="flex h-full flex-col">
      {/* NAV */}
      <nav className="px-4 pb-6 pt-4 space-y-1">
        {NAV.map((n) => {
          const active =
            pathname === n.href || pathname.startsWith(`${n.href}/`);

          return (
            <Link
              key={n.href}
              href={n.href}
              onClick={onNavigate}
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

      {/* FOOTER ACCOUNT AREA */}
      <div className="mt-auto">
        <div className="px-4 pb-5 border-t border-white/10 bg-black/30">
          <div className="pt-5 flex items-center justify-between">
            <button
              onClick={() => goToAccount("profile")}
              className="flex items-center gap-3"
            >
              <div className="w-12 h-12 rounded-full bg-[#E11D2E] flex items-center justify-center text-white font-semibold">
                {initials}
              </div>

              <div className="text-left">
                <p className="text-white text-sm font-semibold">{displayName}</p>
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
            <div className="mt-3 bg-gray-900 border border-white/10 rounded-xl overflow-hidden">
              <button
                onClick={() => goToAccount("profile")}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800 transition text-white"
              >
                <MdOutlinePerson /> Profile
              </button>

              <button
                onClick={() => goToAccount("settings")}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800 transition text-white"
              >
                <MdSettings /> Settings
              </button>

              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="w-full flex items-center gap-3 px-4 py-3 text-[#E11D2E] hover:bg-gray-800 transition"
              >
                <FiLogOut /> Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* LOGOUT CONFIRM */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur flex items-center justify-center px-6">
          <div className="bg-gray-900 p-6 rounded-2xl w-full max-w-sm border border-gray-700">
            <p className="text-white text-center font-semibold text-lg mb-6">
              Logout from Facility Control?
            </p>

            <div className="flex gap-4">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-gray-700 text-white"
              >
                Cancel
              </button>

              <button
                onClick={logout}
                className="flex-1 py-3 rounded-xl bg-[#E11D2E] text-white"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
