"use client";

import OisStatusBadge, { type OisStatus } from "@/components/ois/OisStatusBadge";

export type VerificationState = "verified" | "pending" | "failed" | "overdue" | "attention" | "unavailable" | "not_required";

const labels: Record<Exclude<VerificationState, "not_required">, string> = {
  verified: "Verified",
  pending: "Pending verification",
  failed: "Verification failed",
  overdue: "Verification overdue",
  attention: "Verification required",
  unavailable: "Verification unavailable",
};

export function normalizeVerificationState(value?: unknown, overdue = false): VerificationState {
  if (value == null || value === "") return "not_required";
  const state = String(value).toLowerCase().trim().replace(/[\s-]+/g, "_");
  if (/verified/.test(state)) return "verified";
  if (/failed|timeout/.test(state)) return "failed";
  if (overdue || /overdue/.test(state)) return "overdue";
  if (/required/.test(state)) return "attention";
  if (/pending|awaiting/.test(state)) return "pending";
  if (/unknown|unavailable|not_available/.test(state)) return "unavailable";
  if (/not_required|none|n_a/.test(state)) return "not_required";
  return "unavailable";
}

export default function VerificationBadge({ state, className = "" }: { state?: unknown; className?: string }) {
  const normalized = normalizeVerificationState(state);
  if (normalized === "not_required") return null;
  return <OisStatusBadge status={normalized as OisStatus} label={labels[normalized]} className={className} />;
}
