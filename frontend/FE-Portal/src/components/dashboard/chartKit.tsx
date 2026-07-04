import { useEffect, useRef } from "react";
import { animate } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Brand-aligned palette for all dashboard data-viz.
 * Derived from the app's primary purple (#3d075f) and the legacy
 * stat-card accents defined in index.css.
 */
export const CHART = {
  primary: "#3d075f",
  primaryLight: "#7c3aed",
  violet: "#9d5bd2",
  indigo: "#0955a7",
  sky: "#2f9cd4",
  teal: "#14b8a6",
  green: "#23c366",
  amber: "#eab40b",
  red: "#ef6262",
  slate: "#94a3b8",
} as const;

/** Ordered palette used to color categorical series (techs, categories). */
export const SERIES_COLORS = [
  CHART.primary,
  CHART.sky,
  CHART.green,
  CHART.amber,
  CHART.indigo,
  CHART.red,
  CHART.violet,
  CHART.teal,
];

/**
 * Animated integer that counts up from 0 on mount/value change.
 * Honors prefers-reduced-motion by snapping straight to the value.
 */
export function CountUp({
  value,
  duration = 1.1,
  suffix = "",
  className,
}: {
  value: number;
  duration?: number;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !Number.isFinite(value)) {
      node.textContent = `${Math.round(value || 0)}${suffix}`;
      return;
    }

    const controls = animate(0, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        node.textContent = `${Math.round(latest)}${suffix}`;
      },
    });
    return () => controls.stop();
  }, [value, duration, suffix]);

  return (
    <span ref={ref} className={className}>
      0{suffix}
    </span>
  );
}

/**
 * Consistent premium container for every chart on the dashboard:
 * soft border, layered shadow, gradient title strip and an icon chip.
 */
export function ChartCard({
  title,
  subtitle,
  icon: Icon,
  action,
  className,
  bodyClassName,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-2xl border border-slate-200/70 bg-white/90 backdrop-blur-sm",
        "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(61,7,95,0.18)]",
        "transition-all duration-300 hover:shadow-[0_1px_2px_rgba(15,23,42,0.06),0_18px_40px_-16px_rgba(61,7,95,0.28)]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="flex items-center gap-3 min-w-0">
          {Icon ? (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-purple to-brand-violet text-white shadow-sm">
              <Icon className="h-4 w-4" />
            </span>
          ) : null}
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-800">{title}</h3>
            {subtitle ? (
              <p className="truncate text-xs text-slate-500">{subtitle}</p>
            ) : null}
          </div>
        </div>
        {action}
      </div>
      <div className={cn("px-3 pb-4", bodyClassName)}>{children}</div>
    </div>
  );
}

/** Themed tooltip shared across recharts charts. */
export function ChartTooltip({
  active,
  payload,
  label,
  valueSuffix = "",
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
  valueSuffix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
      {label ? (
        <p className="mb-1 text-xs font-semibold text-slate-700">{label}</p>
      ) : null}
      <div className="space-y-0.5">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: entry.color || entry.payload?.fill }}
            />
            <span className="text-slate-500">{entry.name}</span>
            <span className="ml-auto font-semibold text-slate-800">
              {entry.value}
              {valueSuffix}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Empty-state used when a chart has no data to render. */
export function ChartEmpty({ message = "No data to display yet" }: { message?: string }) {
  return (
    <div className="flex h-full min-h-[180px] flex-col items-center justify-center gap-2 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
        <svg viewBox="0 0 24 24" className="h-6 w-6 text-slate-300" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M3 3v18h18" strokeLinecap="round" />
          <path d="M7 14l3-3 3 3 4-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <p className="text-xs text-slate-400">{message}</p>
    </div>
  );
}
