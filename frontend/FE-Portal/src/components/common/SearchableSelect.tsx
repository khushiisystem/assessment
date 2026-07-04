import React, { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, ChevronDown, Plus, X } from "lucide-react";

// Searchable multi-select with chip tags. Shared by the Profile page and the
// AI Assessment wizard.
export interface SearchableSelectProps {
  options: string[];
  selected: string[];
  onSelect: (value: string) => void;
  onRemove: (value: string) => void;
  placeholder: string;
  label: string;
  icon?: React.ReactNode;
  variant?: "blue" | "emerald" | "purple";
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  selected,
  onSelect,
  onRemove,
  placeholder,
  label,
  icon,
  variant = "blue",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const variantStyles = {
    blue: {
      border: "border-blue-200 focus:border-blue-400",
      focusRing: "focus:ring-blue-500/20",
      selectedBg: "bg-blue-50 text-blue-700 border-blue-200",
      selectedIcon: "text-blue-500",
      optionHover: "hover:bg-blue-50",
      labelColor: "text-blue-600",
    },
    emerald: {
      border: "border-emerald-200 focus:border-emerald-400",
      focusRing: "focus:ring-emerald-500/20",
      selectedBg: "bg-emerald-50 text-emerald-700 border-emerald-200",
      selectedIcon: "text-emerald-500",
      optionHover: "hover:bg-emerald-50",
      labelColor: "text-emerald-600",
    },
    purple: {
      border: "border-purple-200 focus:border-purple-400",
      focusRing: "focus:ring-purple-500/20",
      selectedBg: "bg-purple-50 text-purple-700 border-purple-200",
      selectedIcon: "text-purple-500",
      optionHover: "hover:bg-purple-50",
      labelColor: "text-purple-600",
    },
  };

  const styles = variantStyles[variant];

  // Filter options based on search term and exclude already selected ones
  const filteredOptions = options.filter(
    (opt) =>
      opt.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !selected.includes(opt)
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (option: string) => {
    onSelect(option);
    setSearchTerm("");
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Label className={`text-xs font-semibold ${styles.labelColor} mb-1.5 block`}>
        {icon && <span className="inline-block mr-1.5">{icon}</span>}
        {label}
      </Label>

      {/* Selected Tags */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((item) => (
            <div
              key={item}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${styles.selectedBg} border`}
            >
              <span>{item}</span>
              <button
                onClick={() => onRemove(item)}
                className="hover:opacity-70 transition-opacity"
                type="button"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search Input with Dropdown */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">
          <Search className="w-3.5 h-3.5" />
        </div>
        <Input
          ref={inputRef}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className={`h-9 text-sm pl-8 pr-8 rounded-lg bg-white ${styles.border} ${styles.focusRing} transition-all duration-200`}
        />
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
          type="button"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* Dropdown Options */}
      {isOpen && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-400 text-center">
              {searchTerm ? `No matches found for "${searchTerm}"` : "Type to search..."}
            </div>
          ) : (
            filteredOptions.map((option) => (
              <button
                key={option}
                onClick={() => handleSelect(option)}
                className={`w-full text-left px-3 py-2 text-xs ${styles.optionHover} transition-colors duration-150 flex items-center justify-between`}
              >
                <span className="text-slate-700">{option}</span>
                <Plus className="w-3 h-3 text-slate-400" />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
