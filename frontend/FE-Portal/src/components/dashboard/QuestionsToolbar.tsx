import { Search, X, BarChart3, Layers, FilterX } from "lucide-react";
import { Dropdown, type DropdownOption } from "@/components/common/Dropdown";
import { cn } from "@/lib/utils";

interface QuestionsToolbarProps {
  search: string;
  onSearchChange: (v: string) => void;
  difficulty: string;
  onDifficultyChange: (v: string) => void;
  level: string;
  onLevelChange: (v: string) => void;
  difficultyOptions: DropdownOption<string>[];
  levelOptions: DropdownOption<string>[];
  /** label lookup for the level chip */
  levelLabel?: (value: string) => string;
  resultCount: number;
  totalCount: number;
}

function Chip({
  label,
  value,
  tone,
  onRemove,
}: {
  label: string;
  value: string;
  tone: string;
  onRemove: () => void;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full py-1 pl-2.5 pr-1.5 text-[11px] font-medium ring-1 ring-inset",
        tone
      )}
    >
      <span className="opacity-70">{label}:</span>
      <span className="font-semibold">{value}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Clear ${label}`}
        className="flex h-4 w-4 items-center justify-center rounded-full transition-colors hover:bg-black/10"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

export function QuestionsToolbar({
  search,
  onSearchChange,
  difficulty,
  onDifficultyChange,
  level,
  onLevelChange,
  difficultyOptions,
  levelOptions,
  levelLabel,
  resultCount,
  totalCount,
}: QuestionsToolbarProps) {
  const hasFilters = Boolean(search) || difficulty !== "all" || level !== "all";

  const clearAll = () => {
    onSearchChange("");
    onDifficultyChange("all");
    onLevelChange("all");
  };

  return (
    <div className="space-y-3">
      {/* search + filter dropdowns */}
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search questions or answers…"
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

        <div className="flex items-center gap-2.5">
          <Dropdown
            value={difficulty}
            onChange={onDifficultyChange}
            options={difficultyOptions}
            icon={BarChart3}
            className="w-40"
            buttonClassName="py-2.5"
          />
          <Dropdown
            value={level}
            onChange={onLevelChange}
            options={levelOptions}
            icon={Layers}
            className="w-40"
            buttonClassName="py-2.5"
          />
        </div>
      </div>

      {/* result count + active filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500">
          Showing <span className="font-semibold text-slate-700">{resultCount}</span> of {totalCount} questions
        </span>

        {hasFilters && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-300">·</span>
            {search && (
              <Chip
                label="Search"
                value={`"${search}"`}
                tone="bg-violet-50 text-violet-700 ring-violet-200"
                onRemove={() => onSearchChange("")}
              />
            )}
            {difficulty !== "all" && (
              <Chip
                label="Difficulty"
                value={difficulty}
                tone="bg-amber-50 text-amber-700 ring-amber-200"
                onRemove={() => onDifficultyChange("all")}
              />
            )}
            {level !== "all" && (
              <Chip
                label="Level"
                value={levelLabel ? levelLabel(level) : level}
                tone="bg-sky-50 text-sky-700 ring-sky-200"
                onRemove={() => onLevelChange("all")}
              />
            )}
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:text-brand-violet"
            >
              <FilterX className="h-3 w-3" />
              Clear all
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
