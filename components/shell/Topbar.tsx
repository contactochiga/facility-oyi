"use client";

import OisOperationalStrip, { type OisOperationalStripItem } from "@/components/ois/OisOperationalStrip";

export default function Topbar({
  title,
  subtitle,
  strip,
  showUser: _showUser = false,
  showNotifications: _showNotifications = true,
  rightSlot,
}: {
  title: string;
  subtitle?: string;
  strip?: Array<{ label: string; value: string | number; detail?: string; tone?: OisOperationalStripItem["tone"] }>;
  showUser?: boolean;
  showNotifications?: boolean;
  rightSlot?: React.ReactNode;
}) {
  return (
    <header className="space-y-2.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[var(--ois-type-page-title)] font-semibold tracking-[-0.04em] text-[var(--ois-text-primary)]">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-0.5 text-[12px] text-[var(--ois-text-secondary)]">
              {subtitle}
            </p>
          ) : null}
        </div>
        {rightSlot ? <div className="flex shrink-0 items-center gap-2">{rightSlot}</div> : null}
      </div>

      {strip?.length ? (
        <OisOperationalStrip
          items={strip.map((item, index) => ({
            label: item.label,
            value: item.value,
            detail: item.detail || (index === 0 ? "All systems" : undefined),
            tone: item.tone || (index === 0 ? "stable" : index === 2 ? "warning" : "info"),
          }))}
        />
      ) : null}
    </header>
  );
}
