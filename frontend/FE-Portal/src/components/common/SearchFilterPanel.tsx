import React from "react";
import { Search, X } from "lucide-react";

export interface SearchFieldConfig {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  inputClassName?: string;
}

export interface FilterSelectOption {
  value: string;
  label: string;
}

export interface FilterSelectConfig {
  id: string;
  label: string;
  value: string;
  options: FilterSelectOption[];
  onChange: (value: string) => void;
  className?: string;
  selectClassName?: string;
}

export interface ActiveFilterChip {
  id: string;
  label: string;
  value: string;
  onRemove: () => void;
  tone?: "blue" | "green" | "purple" | "amber" | "yellow" | "gray" | "emerald";
  quoteValue?: boolean;
}

interface SearchFilterPanelProps {
  search: SearchFieldConfig;
  filters?: FilterSelectConfig[];
  activeFilters?: ActiveFilterChip[];
  onClearAll?: () => void;
  clearAllLabel?: string;
  containerClassName?: string;
  fieldsLayoutClassName?: string;
  extraFields?: React.ReactNode;
}

const CHIP_TONE_CLASSES: Record<NonNullable<ActiveFilterChip["tone"]>, string> = {
  blue: "bg-blue-100 text-blue-700 hover:text-blue-900",
  green: "bg-green-100 text-green-700 hover:text-green-900",
  purple: "bg-purple-100 text-purple-700 hover:text-purple-900",
  amber: "bg-amber-100 text-amber-700 hover:text-amber-900",
  yellow: "bg-yellow-100 text-yellow-700 hover:text-yellow-900",
  gray: "bg-gray-200 text-gray-700 hover:text-gray-900",
  emerald: "bg-emerald-100 text-emerald-700 hover:text-emerald-900",
};

export const SearchFilterPanel: React.FC<SearchFilterPanelProps> = ({
  search,
  filters = [],
  activeFilters = [],
  onClearAll,
  clearAllLabel = "Clear All",
  containerClassName = "bg-white rounded shadow-sm border border-gray-200 px-4 pt-2 pb-3 mb-6",
  fieldsLayoutClassName = "grid grid-cols-1 md:grid-cols-4 gap-2 items-end",
  extraFields,
}) => {
  const hasActiveFilters = activeFilters.length > 0;

  return (
    <div className={containerClassName}>
      <div className={fieldsLayoutClassName}>
        <div className={search.className || "md:col-span-2"}>
          <label className="block text-[14px] font-medium text-slate-700 mb-0.5">
            {search.label}
          </label>
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={search.placeholder}
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              className={
                search.inputClassName ||
                "pl-7 pr-3 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs w-full"
              }
            />
          </div>
        </div>

        {filters.map((filter) => (
          <div key={filter.id} className={filter.className}>
            <label className="block text-[14px] font-medium text-slate-700 mb-1">{filter.label}</label>
            <select
              value={filter.value}
              onChange={(e) => filter.onChange(e.target.value)}
              className={
                filter.selectClassName ||
                "w-full px-3 py-1.5 border bg-transparent border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
              }
            >
              {filter.options.map((option) => (
                <option key={`${filter.id}-${option.value}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ))}
        {extraFields}
      </div>

      {hasActiveFilters && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-600 mb-1">Active Filters:</p>
            {onClearAll && (
              <button
                onClick={onClearAll}
                className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800"
              >
                <X size={10} />
                {clearAllLabel}
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1 mt-1">
            {activeFilters.map((chip) => {
              const tone = chip.tone || "blue";
              const toneClass = CHIP_TONE_CLASSES[tone];

              return (
                <span key={chip.id} className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${toneClass}`}>
                  {chip.label}: {chip.quoteValue ? `"${chip.value}"` : chip.value}
                  <button onClick={chip.onRemove} title={`Remove ${chip.label.toLowerCase()} filter`}>
                    <X size={10} />
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
