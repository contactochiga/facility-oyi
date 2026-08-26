import type { ReactNode } from "react";

export default function FacilityMetricCard({
  icon,
  label,
  value,
  detail,
  accent = "text-sky-400",
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  detail: string;
  accent?: string;
}) {
  return (
    <article className="rounded-[9px] border border-[var(--ois-border-subtle)] bg-[var(--ois-surface)] px-3 py-3">
      <div className="flex items-center gap-2.5">
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-md bg-black/20 [&>svg]:h-[15px] [&>svg]:w-[15px] [&>svg]:stroke-[1.6] ${accent}`}>
          {icon}
        </span>
        <span className="min-w-0">
          <small className="block truncate text-[8.5px] font-medium uppercase tracking-[.075em] text-zinc-500">{label}</small>
          <b className="mt-px block truncate text-[18px] font-semibold leading-5 tracking-[-.02em] text-white">{value}</b>
          <small className="block truncate text-[8.5px] leading-3 text-zinc-600">{detail}</small>
        </span>
      </div>
    </article>
  );
}
