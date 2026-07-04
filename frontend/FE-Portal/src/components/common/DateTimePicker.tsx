import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, ChevronLeft, ChevronRight, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DateTimePickerProps {
  /** datetime-local string "YYYY-MM-DDTHH:mm" (or "") */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  align?: "left" | "right";
  disabled?: boolean;
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const todayISO = () => toISODate(new Date());

const parseValue = (value?: string): { date: string; time: string } => {
  if (!value) return { date: "", time: "" };
  const [date, time] = value.split("T");
  return { date: date || "", time: (time || "").slice(0, 5) };
};

const parseISODate = (s: string): Date | null => {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

const combine = (date: string, time: string) => (date ? `${date}T${time || "09:00"}` : "");

const fmtDisplay = (value?: string) => {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Select date & time",
  className,
  buttonClassName,
  align = "left",
  disabled,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const { date: selDate, time: selTime } = parseValue(value);
  const [viewDate, setViewDate] = useState<Date>(() => parseISODate(selDate) || new Date());

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

  useEffect(() => {
    if (open) setViewDate(parseISODate(selDate) || new Date());
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const grid = useMemo(() => {
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(toISODate(new Date(year, month, d)));
    return cells;
  }, [year, month]);

  const display = fmtDisplay(value);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((p) => !p)}
        className={cn(
          "flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all duration-200 hover:border-slate-300",
          "focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/50",
          open && "border-transparent ring-2 ring-brand-violet/50",
          disabled && "cursor-not-allowed opacity-60",
          buttonClassName,
        )}
      >
        <Calendar className="h-4 w-4 shrink-0 text-slate-400" />
        <span className={cn("flex-1 truncate text-left", !value && "text-slate-400")}>
          {display ?? placeholder}
        </span>
        {value ? (
          <span
            role="button"
            tabIndex={0}
            aria-label="Clear"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
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
              align === "right" ? "right-0" : "left-0",
            )}
          >
            {/* month nav */}
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

            {/* weekdays */}
            <div className="grid grid-cols-7 gap-0.5">
              {WEEKDAYS.map((w, i) => (
                <div key={i} className="flex h-7 items-center justify-center text-[10px] font-semibold uppercase text-slate-400">
                  {w}
                </div>
              ))}
            </div>

            {/* days */}
            <div className="mt-0.5 grid grid-cols-7 gap-0.5">
              {grid.map((iso, i) => {
                if (!iso) return <div key={i} />;
                const isSelected = iso === selDate;
                const isToday = iso === todayISO();
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onChange(combine(iso, selTime || "09:00"))}
                    className={cn(
                      "flex h-8 items-center justify-center rounded-lg text-xs font-medium transition-colors",
                      isSelected
                        ? "bg-gradient-to-br from-brand-purple to-brand-violet font-semibold text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100",
                      isToday && !isSelected && "ring-1 ring-inset ring-brand-violet/40",
                    )}
                  >
                    {parseISODate(iso)!.getDate()}
                  </button>
                );
              })}
            </div>

            {/* time + done */}
            <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
              <Clock className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                type="time"
                value={selTime}
                onChange={(e) => onChange(combine(selDate || todayISO(), e.target.value))}
                className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/40"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-gradient-to-r from-brand-purple to-brand-violet px-3 py-2 text-xs font-semibold text-white transition-all hover:brightness-110"
              >
                Done
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
