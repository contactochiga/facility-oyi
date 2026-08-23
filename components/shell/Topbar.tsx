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
    <header className="space-y-2.5" aria-label={`${title}${subtitle ? ` — ${subtitle}` : ""}`}>
      {rightSlot ? <div className="flex justify-end"><div className="flex shrink-0 items-center gap-2">{rightSlot}</div></div> : null}

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
