import React from "react";
import {
  Search,
  Filter,
  ArrowUpDown,
  ChevronDown,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ActiveFilterChip } from "@/components/common/SearchFilterPanel";

export interface SortOption {
  value: string;
  label: string;
}

const CHIP_TONE_CLASSES: Record<NonNullable<ActiveFilterChip["tone"]>, string> = {
  blue: "border-blue-200 bg-blue-50 text-blue-800",
  green: "border-green-200 bg-green-50 text-green-800",
  purple: "border-purple-200 bg-purple-50 text-purple-800",
  amber: "border-amber-200 bg-amber-50 text-amber-900",
  yellow: "border-yellow-200 bg-yellow-50 text-yellow-800",
  gray: "border-gray-200 bg-gray-100 text-gray-800",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

export interface ListPageToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filterPanelOpen?: boolean;
  onFilterPanelToggle?: () => void;
  filterPanel?: React.ReactNode;
  sortValue?: string;
  onSortChange?: (value: string) => void;
  sortOptions?: SortOption[];
  sortMenuLabel?: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
    className?: string;
  };
  trailingActions?: React.ReactNode;
  moreMenuItems?: React.ReactNode;
  activeFilters?: ActiveFilterChip[];
  onClearAllFilters?: () => void;
  className?: string;
  showFilterButton?: boolean;
  showSortButton?: boolean;
}

export function ListPageToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search by name or email…",
  filterPanelOpen = false,
  onFilterPanelToggle,
  filterPanel,
  sortValue,
  onSortChange,
  sortOptions = [],
  sortMenuLabel = "Sort list",
  primaryAction,
  trailingActions,
  moreMenuItems,
  activeFilters = [],
  onClearAllFilters,
  className,
  showFilterButton = true,
  showSortButton = true,
}: ListPageToolbarProps) {
  const hasFilterPanel = Boolean(filterPanel);
  const showFilter = showFilterButton && hasFilterPanel && onFilterPanelToggle;
  const showSort = showSortButton && sortOptions.length > 0 && sortValue !== undefined && onSortChange;

  return (
    <div className={cn("rounded-t-2xl border border-slate-200/70 border-b-0 bg-white shadow-sm", className)}>
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-700 placeholder:text-slate-400 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/50"
            aria-label={searchPlaceholder}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {showSort && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5 rounded-lg border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  <ArrowUpDown className="h-4 w-4" />
                  Sort
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{sortMenuLabel}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={sortValue} onValueChange={onSortChange}>
                  {sortOptions.map((opt) => (
                    <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {trailingActions}

          {primaryAction && (
            <Button
              type="button"
              size="sm"
              className={cn(
                "h-9 gap-1.5 rounded-lg bg-brand-purple px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#ff5a1f]",
                primaryAction.className
              )}
              onClick={primaryAction.onClick}
            >
              {primaryAction.icon}
              {primaryAction.label}
            </Button>
          )}

          {moreMenuItems && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-lg border-slate-200 bg-white shadow-sm"
                  aria-label="More actions"
                >
                  <MoreHorizontal className="h-4 w-4 text-gray-700" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {moreMenuItems}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {filterPanel && (
        <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-3">
          {filterPanel}

          {activeFilters.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              <span className="text-xs font-medium text-slate-500">Active filters</span>
              {activeFilters.map((chip) => (
                <span
                  key={chip.id}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium",
                    CHIP_TONE_CLASSES[chip.tone ?? "blue"]
                  )}
                >
                  {chip.label}: {chip.quoteValue ? `"${chip.value}"` : chip.value}
                  <button
                    type="button"
                    onClick={chip.onRemove}
                    className="ml-0.5 rounded p-0.5 hover:bg-black/5"
                    aria-label={`Remove ${chip.label}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              {onClearAllFilters && (
                <button
                  type="button"
                  onClick={onClearAllFilters}
                  className="ml-auto text-xs font-semibold text-red-600 hover:text-red-700"
                >
                  Clear all
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
