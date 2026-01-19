"use client";

import Link from "next/link";
import React from "react";

export default function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  href,
  onClick,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "good" | "warn" | "bad";
  href?: string;
  onClick?: () => void;
}) {
  const toneMap: Record<string, string> = {
    neutral: "border-white/10 bg-white/5",
    good: "border-emerald-500/20 bg-emerald-500/10",
    warn: "border-yellow-500/20 bg-yellow-500/10",
    bad: "border-red-500/20 bg-red-500/10",
  };

  const clickable = Boolean(href || onClick);

  const card = (
    <div
      className={`glass p-5 border ${toneMap[tone]} rounded-2xl transition ${
        clickable ? "cursor-pointer hover:bg-white/10" : ""
      }`}
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : -1}
      onKeyDown={(e) => {
        if (!onClick) return;
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
    >
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="mt-2 text-xs text-zinc-500">{hint}</div>}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {card}
      </Link>
    );
  }

  return card;
}
