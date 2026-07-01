"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, ChevronDown, MessageSquare, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import NotificationsModal from "@/components/notifications/NotificationsModal";
import { notificationService } from "@/services/notificationService";
import { loadUnreadMessageCount } from "@/services/facilityCommunicationPostureService";
import { useFacilityAssistantStore } from "@/store/useFacilityAssistantStore";
import { useContextStore } from "@/store/useContextStore";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function ShellTopbar() {
  const router = useRouter();
  const { context, loading } = useContextStore();
  const openAssistant = useFacilityAssistantStore((state) => state.openAssistant);
  const [openNotif, setOpenNotif] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);

  const estateLabel = useMemo(() => {
    const name = String(context?.estate?.name || "").trim();
    if (name) return name;
    return loading ? "Loading estate context..." : "Estate context unavailable";
  }, [context?.estate?.name, loading]);

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
        className="sticky top-0 z-50 border-b border-[var(--ois-border-subtle)] bg-[rgba(7,10,15,0.92)] backdrop-blur-xl"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex h-14 max-w-[1680px] items-center gap-3 px-3 sm:h-[68px] sm:px-5 xl:px-7">
          <button
            type="button"
            className="flex min-w-0 items-center gap-2 rounded-[14px] border border-[var(--ois-border-default)] bg-[var(--ois-surface)] px-3 py-2 text-left text-sm text-[var(--ois-text-primary)] transition hover:border-sky-400/20 hover:bg-[var(--ois-surface-raised)]"
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400" />
            <span className="truncate">{estateLabel}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-[var(--ois-text-muted)]" />
          </button>

          <button
            type="button"
            onClick={() => openAssistant("Search the current estate, module registry, runtime signals, and operational context.")}
            className={cn(
              "hidden h-11 flex-1 items-center justify-between rounded-[14px] border border-[var(--ois-border-default)] bg-[var(--ois-surface)] px-3 text-left text-sm text-[var(--ois-text-muted)] md:flex",
              "transition hover:border-sky-400/20 hover:bg-[var(--ois-surface-raised)]"
            )}
            aria-label="Search operational context"
          >
            <span className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              <span className="truncate">Search anything...</span>
            </span>
            <span className="hidden rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-[var(--ois-text-faint)] md:inline-flex">
              K
            </span>
          </button>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/messages")}
              className="relative grid h-11 w-11 place-items-center rounded-[14px] border border-[var(--ois-border-default)] bg-[var(--ois-surface)] text-[var(--ois-text-secondary)] transition hover:border-sky-400/20 hover:bg-[var(--ois-surface-raised)] hover:text-[var(--ois-text-primary)]"
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
              className="relative grid h-11 w-11 place-items-center rounded-[14px] border border-[var(--ois-border-default)] bg-[var(--ois-surface)] text-[var(--ois-text-secondary)] transition hover:border-sky-400/20 hover:bg-[var(--ois-surface-raised)] hover:text-[var(--ois-text-primary)]"
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
