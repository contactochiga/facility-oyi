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
    <section className={`ois-operational-strip px-[var(--ois-space-3)] py-2.5 ${className}`.trim()}>
      <div className="flex gap-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <div key={`${item.label}:${item.value}`} className="min-w-[128px] flex-1 border-l border-white/5 px-2.5 first:border-l-0 first:pl-0 last:pr-0">
            <div className={`flex items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold leading-4 ${toneClass(item.tone)}`}>
              {item.icon ? <span className="shrink-0">{item.icon}</span> : null}
              <span className="truncate">{item.value}</span>
            </div>
            <div className="mt-0.5 truncate text-[10px] uppercase tracking-[0.08em] text-[var(--ois-text-secondary)]">{item.label}</div>
            {item.detail ? <div className="truncate text-[10px] text-[var(--ois-text-muted)]">{item.detail}</div> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
