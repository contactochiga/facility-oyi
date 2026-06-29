"use client";

import OisOperationalStrip, { type OisOperationalStripItem } from "@/components/ois/OisOperationalStrip";

export default function Topbar({
  title,
  subtitle,
  strip,
  showUser: _showUser = false,
  showNotifications: _showNotifications = true,
  rightSlot: _rightSlot,
}: {
  title: string;
  subtitle?: string;
  strip?: Array<{ label: string; value: string | number; detail?: string; tone?: OisOperationalStripItem["tone"] }>;
  showUser?: boolean;
  showNotifications?: boolean;
  rightSlot?: React.ReactNode;
}) {
  return (
    <header className="space-y-3">
      <div>
        {subtitle ? (
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--ois-text-secondary)]">
            {subtitle}
          </p>
        ) : null}
        <h1 className="mt-1 text-[var(--ois-type-page-title)] font-semibold tracking-[-0.04em] text-[var(--ois-text-primary)]">
          {title}
        </h1>
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
