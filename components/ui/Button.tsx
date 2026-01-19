"use client";

import React from "react";

export default function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  className = "",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed";

  const styles: Record<string, string> = {
    primary: "bg-[#E11D2E] text-white hover:bg-[#C81E2A]",
    ghost: "bg-white/5 text-zinc-100 hover:bg-white/10 border border-white/10",
    danger:
      "bg-red-500/10 text-red-300 hover:bg-red-500/15 border border-red-500/20",
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
