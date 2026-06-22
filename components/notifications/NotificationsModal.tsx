// components/notifications/NotificationsModal.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { notificationService, type AlertItem } from "@/services/notificationService";
import { useContextStore } from "@/store/useContextStore";
import { openWorkflowDrawer } from "@/components/modules/WorkflowDetailDrawer";
import { openInfrastructureDrawer } from "@/components/modules/InfrastructureDetailDrawer";

function when(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotificationsModal({
  open,
  onClose,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  onChanged?: () => void; // lets Topbar refresh badge after mark read
}) {
  const router = useRouter();
  const { context, selectEstate } = useContextStore();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AlertItem[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await notificationService.unread();
      setItems(res || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load notifications");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function markRead(id: string) {
    // If backend supports it, this removes it from unread list.
    const ok = await notificationService.markRead(id);
    if (ok) {
      setItems((prev) => prev.filter((x) => x.id !== id));
      onChanged?.();
    }
  }

  async function openNotification(item: AlertItem) {
    const routing = item.routing;
    if (!routing?.target || routing.destination === "none") {
      setErr("This notification does not have an available source destination.");
      return;
    }
    if (item.estate_id && context?.estate_id && item.estate_id !== context.estate_id) {
      const switchContext = window.confirm("This update belongs to another facility context. Switch context to open it?");
      if (!switchContext) return;
      const result = await selectEstate(item.estate_id);
      if (!result.ok) {
        setErr("That facility context is no longer available under your current role.");
        return;
      }
    }
    const target = routing.target;
    if (target.target_type === "workflow" && target.target_id) {
      openWorkflowDrawer(target.target_id);
      onClose();
      return;
    }
    if (target.target_type === "infrastructure" && target.infrastructure_source) {
      openInfrastructureDrawer(target.infrastructure_source);
      onClose();
      return;
    }
    const pageByTarget: Record<string, string> = {
      visitor: "/visitors",
      maintenance: "/maintenance",
      incident: "/alerts",
      prediction: "/facility-intelligence?module=predictions",
      device: "/hardware-devices",
      camera: "/cameras",
      wallet: "/wallets",
      service: "/services",
      community: "/community",
      message: "/messages",
      handover: "/facility-intelligence?module=handover",
    };
    const href = pageByTarget[target.target_type];
    if (!href) {
      setErr("This notification source is unavailable in Facility OS.");
      return;
    }
    router.push(href);
    onClose();
  }

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120]">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />

      <div className="absolute right-3 left-3 top-16 md:left-auto md:right-4 w-auto md:w-[380px] max-w-[92vw]">
        <div className="glass border border-white/10 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div>
              <div className="text-sm font-semibold text-white">
                Notifications
              </div>
              <div className="text-xs text-zinc-500">Unread alerts</div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={load} disabled={loading}>
                {loading ? "Refreshing..." : "Refresh"}
              </Button>

              <button
                onClick={onClose}
                className="rounded-lg px-2 py-1 text-zinc-300 hover:bg-white/5"
                aria-label="Close notifications"
              >
                ✕
              </button>
            </div>
          </div>

          {err && (
            <div className="m-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {err}
            </div>
          )}

          <div className="max-h-[70vh] overflow-auto">
            {loading ? (
              <div className="p-4 text-sm text-zinc-400">Loading…</div>
            ) : items.length === 0 ? (
              <div className="p-4 text-sm text-zinc-400">
                No unread notifications.
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {items.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => void openNotification(n)}
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void openNotification(n); } }}
                    role="button"
                    tabIndex={0}
                    className="rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white truncate">
                          {n.title || "Notification"}
                        </div>
                        <div className="text-xs text-zinc-500 mt-1">
                          {when(n.created_at)}{" "}
                          {n.status ? `• ${n.status}` : ""}
                        </div>
                      </div>

                      {/* ✅ Only show if you want. If backend doesn't support, it just won't remove. */}
                      <Button variant="ghost" onClick={(event) => { event.stopPropagation(); void markRead(n.id); }}>
                        Mark read
                      </Button>
                    </div>

                    {n.message ? (
                      <div className="text-sm text-zinc-300 mt-2 whitespace-pre-wrap">
                        {n.message}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-4 py-3 border-t border-white/10 text-[11px] text-zinc-500">
            Tap a card to clear it from the unread stack.
          </div>
        </div>
      </div>
    </div>
  );
}
