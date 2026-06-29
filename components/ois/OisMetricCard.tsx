import type { ReactNode } from "react";

export default function OisMetricCard({
  label,
  value,
  hint,
  accent = "text-sky-300",
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: string;
  icon?: ReactNode;
}) {
  return (
    <section className="rounded-[var(--ois-radius-card)] border border-[var(--ois-border-default)] bg-[var(--ois-surface)] px-[var(--ois-space-3)] py-[var(--ois-space-3)] shadow-[var(--ois-elevation-card)]">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--ois-text-muted)]">{label}</div>
        {icon ? <span className={`shrink-0 ${accent}`}>{icon}</span> : null}
      </div>
      <div className={`mt-3 text-[32px] font-semibold leading-none tracking-[-0.04em] ${accent}`}>{value}</div>
      {hint ? <div className="mt-2 text-[12px] text-[var(--ois-text-secondary)]">{hint}</div> : null}
    </section>
  );
}
