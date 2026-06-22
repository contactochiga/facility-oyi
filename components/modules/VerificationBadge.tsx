"use client";

export type VerificationState = "verified" | "pending" | "failed" | "overdue" | "not_required";

export function normalizeVerificationState(value?: unknown, overdue = false): VerificationState {
  const state = String(value || "").toLowerCase();
  if (/verified/.test(state)) return "verified";
  if (/failed|timeout/.test(state)) return "failed";
  if (overdue || /overdue/.test(state)) return "overdue";
  if (/pending|required|awaiting/.test(state)) return "pending";
  return "not_required";
}

export default function VerificationBadge({ state, className = "" }: { state?: unknown; className?: string }) {
  const normalized = normalizeVerificationState(state);
  if (normalized === "not_required") return null;
  const styles: Record<Exclude<VerificationState, "not_required">, string> = { verified: "border-emerald-400/20 bg-emerald-500/10 text-emerald-100", pending: "border-sky-400/20 bg-sky-500/10 text-sky-100", failed: "border-rose-400/20 bg-rose-500/10 text-rose-100", overdue: "border-amber-400/20 bg-amber-500/10 text-amber-100" };
  const labels: Record<Exclude<VerificationState, "not_required">, string> = { verified: "Verified", pending: "Pending verification", failed: "Verification failed", overdue: "Verification overdue" };
  return <span className={`rounded-full border px-2 py-1 text-[10px] uppercase ${styles[normalized]} ${className}`}>{labels[normalized]}</span>;
}
