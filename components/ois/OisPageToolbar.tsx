import { RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import Button from "@/components/ui/Button";

export default function OisPageToolbar({
  searchValue = "",
  onSearchChange,
  searchPlaceholder = "Search registry...",
  filterSlot,
  sortSlot,
  bulkSlot,
  refreshLabel = "Refresh",
  onRefresh,
  refreshing = false,
}: {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filterSlot?: React.ReactNode;
  sortSlot?: React.ReactNode;
  bulkSlot?: React.ReactNode;
  refreshLabel?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  return (
    <section className="rounded-[var(--ois-radius-card)] border border-[var(--ois-border-default)] bg-[var(--ois-surface)] p-[var(--ois-space-3)]">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <label className="flex h-11 flex-1 items-center gap-2 rounded-[12px] border border-[var(--ois-border-default)] bg-[rgba(255,255,255,0.02)] px-3 text-sm text-[var(--ois-text-secondary)]">
          <Search className="h-4 w-4 text-[var(--ois-text-muted)]" />
          <input
            value={searchValue}
            onChange={(event) => onSearchChange?.(event.target.value)}
            placeholder={searchPlaceholder}
            disabled={!onSearchChange}
            className="w-full bg-transparent text-sm text-[var(--ois-text-primary)] outline-none placeholder:text-[var(--ois-text-muted)] disabled:cursor-not-allowed"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          {filterSlot || <Button variant="ghost" className="gap-2"><SlidersHorizontal className="h-4 w-4" />Filters</Button>}
          {sortSlot || <Button variant="ghost">Sort</Button>}
          {bulkSlot || <Button variant="ghost">Bulk Action</Button>}
          <Button variant="ghost" onClick={onRefresh} disabled={!onRefresh || refreshing} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshLabel}
          </Button>
        </div>
      </div>
    </section>
  );
}
