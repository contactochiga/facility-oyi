"use client";

import { useEffect, useState } from "react";
import { Bell, MessageSquare } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import NotificationsModal from "@/components/notifications/NotificationsModal";
import { notificationService } from "@/services/notificationService";
import { loadUnreadMessageCount } from "@/services/facilityCommunicationPostureService";
import { FACILITY_MODULES } from "@/lib/moduleRegistry";

const DOMAIN_SUBTITLES: Record<string, string> = {
  overview: "Real-time facility operations at a glance",
  "estate-structure": "Homes and building registry",
  "hardware-devices": "Asset registry and edge operations",
  "security-access": "Cameras, incidents and emergency operations",
  utilities: "Infrastructure services and providers",
  "environment-sensors": "Environmental monitoring, air quality, and sustainability management",
  "traffic-mobility": "Access control, visitors, gates and entry management",
  maintenance: "Work order management, preventive maintenance and asset reliability",
  community: "Community management, engagement, and moderation",
  wallets: "Wallet activity, service payments, and financial operations",
  // Final UI/UX consistency pass -- this key was missing, so the
  // Automation page's required subtitle was set on the per-page Topbar
  // (which only ever renders it into an aria-label, never visibly) and
  // never actually appeared on screen. This is the map ShellTopbar
  // genuinely reads from for the visible title/subtitle.
  automation: "Automate operations across your facility with safety, approvals and full audit.",
};

export default function ShellTopbar() {
  const router = useRouter();
  const pathname = usePathname() || "/overview";
  const [openNotif, setOpenNotif] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);

  const activeDomain = FACILITY_MODULES.find((item) =>
    pathname === item.href || item.startsWith?.some((prefix) => pathname.startsWith(prefix))
  );

  async function refreshUnread() {
    try {
      const items = await notificationService.unread();
      setUnreadCount(items?.length || 0);
    } catch {
      setUnreadCount(0);
    }
  }

  async function refreshMessages() {
    try {
      setMessageCount(await loadUnreadMessageCount());
    } catch {
      setMessageCount(0);
    }
  }

  useEffect(() => {
    void refreshUnread();
    void refreshMessages();
    const t1 = window.setInterval(() => void refreshUnread(), 25000);
    const t2 = window.setInterval(() => void refreshMessages(), 20000);
    return () => {
      window.clearInterval(t1);
      window.clearInterval(t2);
    };
  }, []);

  return (
    <>
      <header
        className="sticky top-0 z-50 border-b border-[var(--ois-border-subtle)] bg-[#070a0f]"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex h-14 max-w-[1680px] items-center gap-3 px-4 sm:px-5">
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold text-[var(--ois-text-primary)]">{activeDomain?.label || "Oyi Facility"}</h1>
            <p className="hidden truncate text-[11.5px] text-[var(--ois-text-secondary)] sm:block">{activeDomain ? DOMAIN_SUBTITLES[activeDomain.key] : "Building Operations"}</p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/messages")}
              className="relative grid h-8 w-8 place-items-center rounded-[4px] text-[var(--ois-text-secondary)] transition-colors hover:bg-white/[0.04] hover:text-[var(--ois-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/70"
              aria-label="Messages"
            >
              <MessageSquare className="h-4 w-4" />
              {messageCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-600 px-1 text-[10px] text-white">
                  {messageCount > 99 ? "99+" : messageCount}
                </span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => setOpenNotif(true)}
              className="relative grid h-8 w-8 place-items-center rounded-[4px] text-[var(--ois-text-secondary)] transition-colors hover:bg-white/[0.04] hover:text-[var(--ois-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/70"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-blue-400/30 bg-blue-600 px-1 text-[10px] text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </button>
          </div>
        </div>
      </header>

      <NotificationsModal
        open={openNotif}
        onClose={() => setOpenNotif(false)}
        onChanged={refreshUnread}
      />
    </>
  );
}
