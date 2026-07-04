import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DateRangePickerProps {
  /** ISO date string YYYY-MM-DD (or "") */
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  align?: "left" | "right";
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const parseISO = (s?: string): Date | null => {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

const fmtShort = (s?: string) => {
  const d = parseISO(s);
  return d ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : null;
};

const todayISO = () => toISO(new Date());

export function DateRangePicker({
  from,
  to,
  onChange,
  placeholder = "Joined: any date",
  className,
  buttonClassName,
  align = "left",
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [viewDate, setViewDate] = useState<Date>(() => parseISO(from) || parseISO(to) || new Date());

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  // When opening, jump the calendar to the selected range
  useEffect(() => {
    if (open) setViewDate(parseISO(from) || parseISO(to) || new Date());
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const grid = useMemo(() => {
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(toISO(new Date(year, month, d)));
    return cells;
  }, [year, month]);

  const hasRange = Boolean(from);
  const display = !from
    ? placeholder
    : to
      ? `${fmtShort(from)} – ${fmtShort(to)}`
      : `${fmtShort(from)} – …`;

  const handleDayClick = (iso: string) => {
    if (!from || (from && to)) {
      onChange(iso, ""); // start a new range
    } else if (from && !to) {
      if (iso < from) onChange(iso, from);
      else onChange(from, iso);
    }
  };

  // effective range bounds for highlighting (includes hover preview)
  const previewEnd = from && !to ? hovered : null;
  let lo = from || "";
  let hi = to || previewEnd || "";
  if (lo && hi && lo > hi) [lo, hi] = [hi, lo];

  const applyPreset = (days: number | "month" | "clear") => {
    if (days === "clear") {
      onChange("", "");
      return;
    }
    const end = new Date();
    if (days === "month") {
      const start = new Date(end.getFullYear(), end.getMonth(), 1);
      onChange(toISO(start), toISO(end));
    } else {
      const start = new Date();
      start.setDate(end.getDate() - (days - 1));
      onChange(toISO(start), toISO(end));
    }
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={cn(
          "flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all duration-200 hover:border-slate-300",
          "focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/50",
          open && "border-transparent ring-2 ring-brand-violet/50",
          buttonClassName
        )}
      >
        <Calendar className="h-4 w-4 shrink-0 text-slate-400" />
        <span className={cn("flex-1 truncate text-left", !hasRange && "text-slate-400")}>{display}</span>
        {hasRange ? (
          <span
            role="button"
            tabIndex={0}
            aria-label="Clear dates"
            onClick={(e) => {
              e.stopPropagation();
              onChange("", "");
            }}
            className="flex h-4 w-4 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-3 w-3" />
          </span>
        ) : null}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: "top" }}
            className={cn(
              "absolute z-50 mt-2 w-[280px] overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_16px_48px_-12px_rgba(15,23,42,0.3)] ring-1 ring-black/5",
              align === "right" ? "right-0" : "left-0"
            )}
          >
            {/* header: month nav */}
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setViewDate(new Date(year, month - 1, 1))}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-brand-violet"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold text-slate-800">
                {MONTHS[month]} {year}
              </span>
              <button
                type="button"
                onClick={() => setViewDate(new Date(year, month + 1, 1))}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-brand-violet"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* weekday row */}
            <div className="grid grid-cols-7 gap-0.5">
              {WEEKDAYS.map((w, i) => (
                <div key={i} className="flex h-7 items-center justify-center text-[10px] font-semibold uppercase text-slate-400">
                  {w}
                </div>
              ))}
            </div>

            {/* days */}
            <div className="mt-0.5 grid grid-cols-7 gap-0.5" onMouseLeave={() => setHovered(null)}>
              {grid.map((iso, i) => {
                if (!iso) return <div key={i} />;
                const inRange = lo && hi && iso >= lo && iso <= hi;
                const isStart = iso === lo && Boolean(hi);
                const isEnd = iso === hi && Boolean(lo);
                const isSingle = iso === from && !to && !previewEnd;
                const isToday = iso === todayISO();
                const selectedEdge = isStart || isEnd || isSingle;
                return (
                  <button
                    key={i}
                    type="button"
                    onMouseEnter={() => setHovered(iso)}
                    onClick={() => handleDayClick(iso)}
                    className={cn(
                      "relative flex h-8 items-center justify-center text-xs font-medium transition-colors",
                      inRange && !selectedEdge && "bg-violet-100/70 text-brand-purple",
                      inRange && isStart && "rounded-l-lg",
                      inRange && isEnd && "rounded-r-lg",
                      !inRange && "rounded-lg",
                      selectedEdge
                        ? "rounded-lg bg-gradient-to-br from-brand-purple to-brand-violet font-semibold text-white shadow-sm"
                        : !inRange && "text-slate-600 hover:bg-slate-100",
                      isToday && !selectedEdge && "ring-1 ring-inset ring-brand-violet/40"
                    )}
                  >
                    {parseISO(iso)!.getDate()}
                  </button>
                );
              })}
            </div>

            {/* presets + clear */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
              {[
                { label: "7d", days: 7 as const },
                { label: "30d", days: 30 as const },
                { label: "This month", days: "month" as const },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p.days)}
                  className="rounded-lg bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-inset ring-slate-200 transition-colors hover:bg-violet-50 hover:text-brand-violet hover:ring-violet-200"
                >
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => applyPreset("clear")}
                className="ml-auto text-[11px] font-semibold text-slate-400 transition-colors hover:text-red-600"
              >
                Clear
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
