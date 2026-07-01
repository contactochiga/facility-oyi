import { RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import Button from "@/components/ui/Button";

export default function OisPageToolbar({
  searchValue = "",
  onSearchChange,
  searchPlaceholder = "Search registry...",
  filterSlot,
  sortSlot,
  bulkSlot,
  onRefresh,
  refreshing = false,
}: {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filterSlot?: React.ReactNode;
  sortSlot?: React.ReactNode;
  bulkSlot?: React.ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  return (
    <section className="rounded-[var(--ois-radius-card)] border border-[var(--ois-border-default)] bg-[var(--ois-surface)] p-2.5">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <label className="flex h-11 flex-1 items-center gap-2 rounded-[12px] border border-[var(--ois-border-default)] bg-[rgba(255,255,255,0.02)] px-3 text-base text-[var(--ois-text-secondary)] transition focus-within:border-sky-400/35 focus-within:bg-white/[0.035] md:text-sm">
          <Search className="h-4 w-4 text-[var(--ois-text-muted)]" />
          <input
            value={searchValue}
            onChange={(event) => onSearchChange?.(event.target.value)}
            placeholder={searchPlaceholder}
            disabled={!onSearchChange}
            className="w-full bg-transparent text-base text-[var(--ois-text-primary)] outline-none placeholder:text-[var(--ois-text-muted)] md:text-sm disabled:cursor-not-allowed"
          />
        </label>

        <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max flex-nowrap items-center gap-1.5 sm:flex-wrap">
            {filterSlot || <Button variant="ghost" className="h-11 gap-2 rounded-[12px] px-3"><SlidersHorizontal className="h-4 w-4" />Filters</Button>}
            {sortSlot || <Button variant="ghost" className="h-11 rounded-[12px] px-3">Sort</Button>}
            {bulkSlot || <Button variant="ghost" className="h-11 rounded-[12px] px-3">Bulk Action</Button>}
            {onRefresh ? (
              <Button
                variant="ghost"
                onClick={onRefresh}
                disabled={refreshing}
                className="h-11 w-11 rounded-[12px] px-0"
                aria-label="Refresh registry"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
