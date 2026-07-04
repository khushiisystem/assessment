import { motion } from "framer-motion";
import { ArrowUpRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountUp } from "./chartKit";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CARD_SHADOW } from "@/lib/uiStyles";

export type StatTone =
  | "violet" | "purple" | "indigo" | "fuchsia" | "sky" | "emerald" | "amber" | "orange";

export interface StatCardProps {
  label: string;
  value: number;
  /** Optional unit appended to the animated number, e.g. "%". */
  suffix?: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Tailwind gradient stops, e.g. "from-brand-purple to-brand-violet". */
  gradient: string;
  /** Soft surface/ring tint. Auto-derived from `gradient` when omitted. */
  tone?: StatTone;
  /** Optional contextual footnote, e.g. "62% of total". */
  footnote?: string;
  /** Optional explanation shown via an info icon + tooltip (what the value means / how it's derived). */
  hint?: string;
  /** 0-100 share rendered as a thin progress meter when provided. */
  share?: number;
  /** Dense horizontal layout (default). Pass `compact={false}` for the tall stacked card. */
  compact?: boolean;
  index?: number;
  onClick?: () => void;
}

/* Soft per-tone wash so each card wears a light tint of its own brand color (matches dashboard KPI cards). */
const TINTS: Record<StatTone, { surface: string; border: string; ring: string; chip: string }> = {
  violet: { surface: "from-white to-violet-50/70", border: "border-violet-100", ring: "ring-violet-100/70", chip: "bg-violet-100 text-violet-700" },
  purple: { surface: "from-white to-purple-50/70", border: "border-purple-100", ring: "ring-purple-100/70", chip: "bg-purple-100 text-purple-700" },
  indigo: { surface: "from-white to-indigo-50/70", border: "border-indigo-100", ring: "ring-indigo-100/70", chip: "bg-indigo-100 text-indigo-700" },
  fuchsia: { surface: "from-white to-fuchsia-50/70", border: "border-fuchsia-100", ring: "ring-fuchsia-100/70", chip: "bg-fuchsia-100 text-fuchsia-700" },
  sky: { surface: "from-white to-sky-50/70", border: "border-sky-100", ring: "ring-sky-100/70", chip: "bg-sky-100 text-sky-700" },
  emerald: { surface: "from-white to-emerald-50/70", border: "border-emerald-100", ring: "ring-emerald-100/70", chip: "bg-emerald-100 text-emerald-700" },
  amber: { surface: "from-white to-amber-50/70", border: "border-amber-100", ring: "ring-amber-100/70", chip: "bg-amber-100 text-amber-700" },
  orange: { surface: "from-white to-orange-50/70", border: "border-orange-100", ring: "ring-orange-100/70", chip: "bg-orange-100 text-orange-700" },
};

/* Map the brand gradient stops used across pages → a tint family, so existing call sites tint automatically. */
const GRADIENT_TONE: Record<string, StatTone> = {
  "from-brand-purple to-brand-violet": "violet",
  "from-[#5b21b6] to-[#8b5cf6]": "purple",
  "from-[#5b21b6] to-[#9d5bd2]": "purple",
  "from-[#4338ca] to-[#6366f1]": "indigo",
  "from-brand-violet to-[#a855f7]": "fuchsia",
  "from-[#0955a7] to-[#2f9cd4]": "sky",
  "from-[#0e9f6e] to-[#23c366]": "emerald",
  "from-[#c2790b] to-[#eab40b]": "amber",
  "from-[#ff5a1f] to-[#ff8a4c]": "orange",
};

const resolveTone = (gradient: string, tone?: StatTone): StatTone =>
  tone ?? GRADIENT_TONE[gradient] ?? "violet";

export function StatCard({
  label,
  value,
  suffix = "",
  icon: Icon,
  gradient,
  tone,
  footnote,
  hint,
  share,
  compact = true,
  index = 0,
  onClick,
}: StatCardProps) {
  const clickable = typeof onClick === "function";
  const tint = TINTS[resolveTone(gradient, tone)];

  if (compact) {
    return (
      <motion.button
        type="button"
        onClick={onClick}
        disabled={!clickable}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
        whileHover={clickable ? { y: -2 } : undefined}
        className={cn(
          "group relative flex w-full items-center gap-3 overflow-hidden rounded-xl border bg-gradient-to-br px-3 py-2.5 text-left",
          "transition-shadow duration-300",
          tint.surface,
          tint.border,
          CARD_SHADOW,
          clickable &&
            "cursor-pointer hover:shadow-[0_2px_6px_rgba(15,23,42,0.06),0_14px_30px_-16px_rgba(61,7,95,0.45)]"
        )}
      >
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm ring-4",
            gradient,
            tint.ring
          )}
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold leading-none tracking-tight text-slate-900 tabular-nums">
            <CountUp value={value} suffix={suffix} />
          </p>
          <p className="mt-1 truncate text-[11px] font-medium text-slate-500">{label}</p>
        </div>
        {hint ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                role="img"
                aria-label="More information"
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 text-slate-300 transition-colors hover:text-brand-violet"
              >
                <Info className="h-3.5 w-3.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px] text-xs leading-relaxed">
              {hint}
            </TooltipContent>
          </Tooltip>
        ) : null}
        {clickable ? (
          <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 transition-colors duration-300 group-hover:text-brand-violet" />
        ) : null}
      </motion.button>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
      whileHover={clickable ? { y: -3 } : undefined}
      className={cn(
        "group relative flex w-full flex-col overflow-hidden rounded-2xl border bg-gradient-to-br p-4 text-left",
        "transition-shadow duration-300",
        tint.surface,
        tint.border,
        CARD_SHADOW,
        clickable &&
          "cursor-pointer hover:shadow-[0_2px_6px_rgba(15,23,42,0.06),0_18px_38px_-18px_rgba(61,7,95,0.5)]"
      )}
    >
      <div className="flex items-start justify-between">
        <span
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-sm ring-4",
            gradient,
            tint.ring
          )}
        >
          <Icon className="h-[22px] w-[22px]" />
        </span>

        <div className="flex items-center gap-1">
          {hint ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  role="img"
                  aria-label="More information"
                  onClick={(e) => e.stopPropagation()}
                  className="text-slate-300 transition-colors hover:text-brand-violet"
                >
                  <Info className="h-3.5 w-3.5" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[240px] text-xs leading-relaxed">
                {hint}
              </TooltipContent>
            </Tooltip>
          ) : null}
          {clickable ? (
            <ArrowUpRight className="h-4 w-4 text-slate-300 transition-colors duration-300 group-hover:text-brand-violet" />
          ) : null}
        </div>
      </div>

      <p className="mt-3 text-2xl font-bold leading-none tracking-tight text-slate-900 tabular-nums">
        <CountUp value={value} suffix={suffix} />
      </p>
      <p className="mt-1.5 text-xs font-medium text-slate-500">{label}</p>

      {typeof share === "number" ? (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/70 ring-1 ring-inset ring-slate-200/60">
            <motion.span
              className={cn("block h-full rounded-full bg-gradient-to-r", gradient)}
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(0, Math.min(100, share))}%` }}
              transition={{ duration: 0.9, delay: 0.2 + index * 0.05, ease: "easeOut" }}
            />
          </div>
          {footnote ? <p className="mt-1.5 text-[11px] text-slate-400">{footnote}</p> : null}
        </div>
      ) : null}
    </motion.button>
  );
}
