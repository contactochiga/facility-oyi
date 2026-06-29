import type { ReactNode } from "react";

export type OisOperationalStripItem = {
  label: string;
  value: string | number;
  detail?: string;
  tone?: "stable" | "attention" | "warning" | "critical" | "info";
  icon?: ReactNode;
};

function toneClass(tone?: OisOperationalStripItem["tone"]) {
  if (tone === "stable") return "text-emerald-300";
  if (tone === "warning") return "text-amber-300";
  if (tone === "critical") return "text-rose-300";
  if (tone === "attention") return "text-sky-300";
  return "text-white";
}

export default function OisOperationalStrip({ items, className = "" }: { items: OisOperationalStripItem[]; className?: string }) {
  return (
    <section className={`ois-operational-strip px-[var(--ois-space-4)] py-[var(--ois-space-3)] ${className}`.trim()}>
      <div className="grid gap-3 sm:grid-cols-4">
        {items.map((item) => (
          <div key={`${item.label}:${item.value}`} className="min-w-0 border-l border-white/5 pl-3 first:border-l-0 first:pl-0">
            <div className={`flex items-center gap-2 text-[13px] font-medium ${toneClass(item.tone)}`}>
              {item.icon ? <span className="shrink-0">{item.icon}</span> : null}
              <span className="truncate">{item.value}</span>
            </div>
            <div className="mt-1 text-[11px] text-[var(--ois-text-secondary)]">{item.label}</div>
            {item.detail ? <div className="mt-0.5 text-[11px] text-[var(--ois-text-muted)]">{item.detail}</div> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
