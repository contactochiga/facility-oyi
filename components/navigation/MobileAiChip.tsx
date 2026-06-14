import type { LucideIcon } from "lucide-react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function MobileAiChip({
  icon: Icon,
  active,
  label = "AI",
}: {
  icon: LucideIcon;
  active?: boolean;
  label?: string;
}) {
  return (
    <span
      className={cn(
        "grid h-9 w-9 place-items-center rounded-[16px] border transition-all duration-300",
        active
          ? "border-sky-200/25 bg-sky-300/15 text-sky-50 shadow-[0_0_28px_rgba(56,189,248,0.34)]"
          : "border-white/10 bg-white/[0.055] text-white/62"
      )}
      aria-hidden="true"
      title={label}
    >
      <Icon size={18} />
    </span>
  );
}
