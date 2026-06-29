import type { ReactNode } from "react";

export default function OisRuntimeCard({
  title,
  items,
  chart,
}: {
  title: string;
  items: Array<{ label: string; value: string | number; delta?: string }>;
  chart?: ReactNode;
}) {
  return (
    <section className="ois-runtime-card px-[var(--ois-space-4)] py-[var(--ois-space-4)]">
      <div className="text-[13px] font-medium uppercase tracking-[0.12em] text-[var(--ois-text-secondary)]">{title}</div>
      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_120px]">
        {items.map((item) => (
          <div key={item.label} className="border-r border-white/5 pr-4 last:border-r-0 last:pr-0">
            <div className="text-[12px] text-[var(--ois-text-muted)]">{item.label}</div>
            <div className="mt-2 text-[40px] font-semibold leading-none tracking-[-0.05em] text-emerald-300">{item.value}</div>
            {item.delta ? <div className="mt-2 text-[12px] text-[var(--ois-text-secondary)]">{item.delta}</div> : null}
          </div>
        ))}
        {chart ? <div className="hidden md:block">{chart}</div> : null}
      </div>
    </section>
  );
}
