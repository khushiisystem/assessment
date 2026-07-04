import { motion } from "framer-motion";
import { Search, ArrowUpDown, LayoutGrid, X, Star, ArrowDownAZ, BookOpen, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { themeForCategory, labelForCategory } from "./courseTheme";
import { Dropdown, type DropdownOption } from "@/components/common/Dropdown";

export type CourseSort = "featured" | "name" | "questions" | "candidates";

export interface CategoryOption {
  value: string; // raw category key ("all" for the All pill)
  count: number;
}

interface CourseFilterBarProps {
  categories: CategoryOption[]; // categories present in the data (excluding "all")
  totalCount: number;
  activeCategory: string;
  onCategoryChange: (value: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  sort: CourseSort;
  onSortChange: (value: CourseSort) => void;
}

const SORT_OPTIONS: DropdownOption<CourseSort>[] = [
  { value: "featured", label: "Featured", icon: Star },
  { value: "name", label: "Name (A–Z)", icon: ArrowDownAZ },
  { value: "questions", label: "Most Questions", icon: BookOpen },
  { value: "candidates", label: "Most Candidates", icon: Users },
];

function FilterPill({
  active,
  label,
  count,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold capitalize transition-colors duration-200",
        active ? "text-white" : "text-slate-600 hover:text-brand-violet"
      )}
    >
      {active && (
        <motion.span
          layoutId="courseFilterActive"
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
          className="absolute inset-0 -z-0 rounded-full bg-gradient-to-r from-brand-purple to-brand-violet shadow-[0_6px_16px_-6px_rgba(61,7,95,0.6)]"
        />
      )}
      <span className="relative z-10 flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" />
        {label}
        <span
          className={cn(
            "rounded-full px-1.5 text-[10px] font-bold",
            active ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500"
          )}
        >
          {count}
        </span>
      </span>
    </button>
  );
}

export function CourseFilterBar({
  categories,
  totalCount,
  activeCategory,
  onCategoryChange,
  search,
  onSearchChange,
  sort,
  onSortChange,
}: CourseFilterBarProps) {
  return (
    <div className="space-y-3">
      {/* search + sort */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search courses by name…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-9 text-sm text-slate-700 shadow-sm transition-shadow placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/50"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <Dropdown
          value={sort}
          onChange={onSortChange}
          options={SORT_OPTIONS}
          icon={ArrowUpDown}
          align="right"
          className="sm:w-52"
        />
      </div>

      {/* category segmented filters */}
      <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <FilterPill
          active={activeCategory === "all"}
          label="All"
          count={totalCount}
          icon={LayoutGrid}
          onClick={() => onCategoryChange("all")}
        />
        {categories.map((cat) => {
          const theme = themeForCategory(cat.value);
          return (
            <FilterPill
              key={cat.value}
              active={activeCategory === cat.value}
              label={labelForCategory(cat.value)}
              count={cat.count}
              icon={theme.icon}
              onClick={() => onCategoryChange(cat.value)}
            />
          );
        })}
      </div>
    </div>
  );
}
