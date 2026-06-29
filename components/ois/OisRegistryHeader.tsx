import type { ReactNode } from "react";

export default function OisRegistryHeader({
  title,
  caption,
  action,
}: {
  title: string;
  caption?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--ois-text-primary)]">{title}</div>
        {caption ? <div className="mt-0.5 text-[11px] text-[var(--ois-text-muted)]">{caption}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
