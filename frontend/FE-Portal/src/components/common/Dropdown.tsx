import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DropdownOption<T extends string | number> {
  value: T;
  label: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface DropdownProps<T extends string | number> {
  value: T;
  onChange: (value: T) => void;
  options: DropdownOption<T>[];
  /** Leading icon inside the trigger button. */
  icon?: React.ComponentType<{ className?: string }>;
  placeholder?: string;
  /** "auto" (default) shows a search box once options exceed `searchThreshold`. */
  searchable?: boolean | "auto";
  searchThreshold?: number;
  align?: "left" | "right";
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
}

export function Dropdown<T extends string | number>({
  value,
  onChange,
  options,
  icon: LeadingIcon,
  placeholder = "Select…",
  searchable = "auto",
  searchThreshold = 8,
  align = "left",
  className,
  buttonClassName,
  disabled,
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const showSearch =
    searchable === true || (searchable === "auto" && options.length >= searchThreshold);

  const filtered = useMemo(() => {
    if (!showSearch || !query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.description?.toLowerCase().includes(q)
    );
  }, [options, query, showSearch]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // On open: focus search, reset query, point active index at the selected option
  useLayoutEffect(() => {
    if (!open) return;
    setQuery("");
    const idx = options.findIndex((o) => o.value === value);
    setActiveIndex(idx >= 0 ? idx : 0);
    if (showSearch) requestAnimationFrame(() => searchRef.current?.focus());
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep active option scrolled into view
  useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIndex}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const commit = (v: T) => {
    onChange(v);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filtered[activeIndex]) commit(filtered[activeIndex].value);
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((p) => !p)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 shadow-sm",
          "transition-all duration-200 hover:border-slate-300",
          "focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/50",
          open && "border-transparent ring-2 ring-brand-violet/50",
          disabled && "cursor-not-allowed opacity-60",
          buttonClassName
        )}
      >
        {LeadingIcon ? <LeadingIcon className="h-4 w-4 shrink-0 text-slate-400" /> : null}
        {selected?.icon ? <selected.icon className="h-4 w-4 shrink-0 text-brand-violet" /> : null}
        <span className={cn("flex-1 truncate text-left", !selected && "text-slate-400")}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200",
            open && "rotate-180 text-brand-violet"
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: "top" }}
            role="listbox"
            className={cn(
              "absolute z-50 mt-2 min-w-full overflow-hidden rounded-xl border border-slate-200/80 bg-white p-1.5 shadow-[0_12px_40px_-12px_rgba(15,23,42,0.25)] ring-1 ring-black/5",
              align === "right" ? "right-0" : "left-0"
            )}
          >
            {showSearch && (
              <div className="sticky top-0 mb-1.5 bg-white p-1">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setActiveIndex(0);
                    }}
                    onKeyDown={onKeyDown}
                    placeholder="Search…"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/40"
                  />
                </div>
              </div>
            )}

            <div ref={listRef} className="max-h-64 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-slate-400">No matches found</p>
              ) : (
                filtered.map((opt, i) => {
                  const isSelected = opt.value === value;
                  const isActive = i === activeIndex;
                  const OptIcon = opt.icon;
                  return (
                    <button
                      key={String(opt.value)}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      data-idx={i}
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => commit(opt.value)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors duration-150",
                        isActive ? "bg-violet-50" : "bg-transparent",
                        isSelected ? "font-semibold text-brand-violet" : "text-slate-700"
                      )}
                    >
                      {OptIcon ? (
                        <OptIcon className={cn("h-4 w-4 shrink-0", isSelected ? "text-brand-violet" : "text-slate-400")} />
                      ) : null}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{opt.label}</span>
                        {opt.description ? (
                          <span className="block truncate text-xs font-normal text-slate-400">
                            {opt.description}
                          </span>
                        ) : null}
                      </span>
                      {isSelected ? <Check className="h-4 w-4 shrink-0 text-brand-violet" /> : null}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
