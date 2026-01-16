export default function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const toneMap: Record<string, string> = {
    neutral: "border-white/10 bg-white/5",
    good: "border-emerald-500/20 bg-emerald-500/10",
    warn: "border-yellow-500/20 bg-yellow-500/10",
    bad: "border-red-500/20 bg-red-500/10",
  };

  return (
    <div className={`glass p-5 ${toneMap[tone]}`}>
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="mt-2 text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}
