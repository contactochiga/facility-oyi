"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useViewportDockLayout } from "@/hooks/useViewportDockLayout";

const LOGO_SRC = "/oyi-logo-transparent.png";

export function AuthShell({
  eyebrow = "Oyi Facility",
  title,
  subtitle,
  children,
  footer,
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useViewportDockLayout({ active: true });

  return (
    <div className="overflow-x-hidden bg-zinc-950 text-white" style={{ minHeight: "var(--oyi-viewport-height)" }}>
      <div className="absolute inset-0 bg-[radial-gradient(900px_560px_at_50%_-10%,rgba(56,189,248,0.18),transparent_58%),radial-gradient(760px_520px_at_100%_20%,rgba(37,99,235,0.12),transparent_52%),linear-gradient(180deg,#09090b_0%,#0a0d13_100%)]" />
      <div className="absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:34px_34px]" />

      <div className="relative z-10 flex items-center justify-center px-5 py-[calc(28px+env(safe-area-inset-top))] pb-[calc(28px+env(safe-area-inset-bottom))]" style={{ minHeight: "var(--oyi-viewport-height)" }}>
        <div className="w-full max-w-sm rounded-[32px] border border-white/[0.08] bg-white/[0.045] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:p-6">
          <div className="flex items-center gap-3">
            <div className="relative h-11 w-11 shrink-0 rounded-2xl border border-white/[0.08] bg-white/[0.05] p-2.5">
              <Image src={LOGO_SRC} alt="Oyi" fill priority className="object-contain p-2.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{eyebrow}</p>
              <h1 className="truncate text-[22px] font-semibold tracking-[-0.04em] text-white">{title}</h1>
            </div>
          </div>

          <p className="mt-3 text-sm leading-6 text-zinc-400">{subtitle}</p>

          <div className="mt-6 space-y-3">{children}</div>

          {footer ? <div className="mt-5">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function AuthLink({
  href,
  children,
  align = "left",
}: {
  href: string;
  children: ReactNode;
  align?: "left" | "right" | "center";
}) {
  const justify = align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";
  return (
    <div className={`flex ${justify}`}>
      <Link href={href} className="text-sm text-sky-200 transition hover:text-sky-100">
        {children}
      </Link>
    </div>
  );
}
