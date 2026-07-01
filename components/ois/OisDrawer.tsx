"use client";

import { useEffect, type CSSProperties, type ReactNode } from "react";
import { X } from "lucide-react";

const widths = { sm: "32rem", md: "40rem", lg: "48rem" };

export default function OisDrawer({ open, onClose, title, subtitle, children, footer, width = "md" }: { open: boolean; onClose: () => void; title?: string; subtitle?: string; children: ReactNode; footer?: ReactNode; width?: "sm" | "md" | "lg" | string }) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);
  if (!open) return null;
  const drawerWidth = widths[width as keyof typeof widths] || width;
  return <div className="fixed inset-0 z-[100] overflow-x-hidden bg-black/70 backdrop-blur-sm animate-in fade-in duration-200" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className="ml-auto flex w-full max-w-full flex-col overflow-x-hidden rounded-tl-[24px] border-l border-[var(--ois-border-default)] bg-[var(--ois-canvas-overlay)] shadow-[var(--ois-elevation-overlay)] transition-transform duration-300 animate-in slide-in-from-right-4 md:w-[var(--ois-drawer-width)] md:rounded-none" style={{ "--ois-drawer-width": drawerWidth, height: "var(--oyi-viewport-height)" } as CSSProperties}><header className="sticky top-0 z-10 border-b border-[var(--ois-border-subtle)] bg-[var(--ois-canvas-overlay)] px-[var(--ois-space-4)] py-3 pt-[calc(var(--ois-space-4)+var(--ois-safe-top))] backdrop-blur md:pt-3"><div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/10 transition-opacity md:hidden" /><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-[var(--ois-type-section-title)] font-semibold leading-[var(--ois-line-section-title)] text-[var(--ois-text-primary)]">{title || "Overview"}</h2>{subtitle ? <p className="mt-0.5 text-[var(--ois-type-meta)] leading-[var(--ois-line-meta)] text-[var(--ois-text-muted)]">{subtitle}</p> : null}</div><button type="button" onClick={onClose} aria-label="Close drawer" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[var(--ois-border-default)] bg-white/[0.03] text-[var(--ois-text-secondary)] transition hover:bg-white/[0.06] hover:text-[var(--ois-text-primary)]"><X className="h-4 w-4" /></button></div></header><div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-[var(--ois-space-4)] pb-[calc(var(--ois-space-8)+var(--ois-safe-bottom))]">{children}</div>{footer ? <footer className="sticky bottom-0 border-t border-[var(--ois-border-subtle)] bg-[var(--ois-canvas-overlay)] p-[var(--ois-space-4)] pb-[calc(var(--ois-space-4)+var(--ois-safe-bottom))] backdrop-blur">{footer}</footer> : null}</aside></div>;
}
