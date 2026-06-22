"use client";

export type VerificationSummaryValue = {
  pending: number;
  overdue: number;
  failed: number;
  verifiedToday: number;
};

export default function VerificationSummary({ summary, loading = false }: { summary: VerificationSummaryValue; loading?: boolean }) {
  const metrics: Array<[string, number, string]> = [
    ["Pending", summary.pending, "text-sky-100"],
    ["Overdue", summary.overdue, "text-amber-100"],
    ["Failed", summary.failed, "text-rose-100"],
    ["Verified today", summary.verifiedToday, "text-emerald-100"],
  ];

  return <div className="grid grid-cols-4 gap-2 text-center text-xs">
    {metrics.map(([label, value, color]) => <div key={label} className="rounded-xl bg-black/20 p-2">
      <b className={`block ${color}`}>{loading ? "—" : value}</b>
      <span className="block text-[10px] text-zinc-500">{label}</span>
    </div>)}
  </div>;
}
