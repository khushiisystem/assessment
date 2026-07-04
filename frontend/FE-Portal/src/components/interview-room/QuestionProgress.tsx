import React from "react";
import { CheckCircle2, Circle, Sparkles, Flag } from "lucide-react";
import { cn } from "@/lib/utils";

export type SegmentStatus = "answered" | "current" | "upcoming" | "skipped";

export interface QuestionProgressProps {
  /** Zero-indexed current question. */
  current: number;
  /** Total number of questions. */
  total: number;
  /** Set of question indexes that have been answered. */
  answered?: Set<number>;
  /** Set of question indexes that have been skipped. */
  skipped?: Set<number>;
  /** Optional eyebrow line under the title — e.g. "Frontend Developer · Mid-level". */
  subtitle?: string;
}

const segmentStatus = (
  i: number,
  current: number,
  answered: Set<number>,
  skipped: Set<number>
): SegmentStatus => {
  if (answered.has(i)) return "answered";
  if (skipped.has(i)) return "skipped";
  if (i === current) return "current";
  return "upcoming";
};

const pad2 = (n: number) => n.toString().padStart(2, "0");

/**
 * Premium progress strip with a large monospaced question counter, a soft
 * segmented bar, and inline activity chips.
 */
export const QuestionProgress: React.FC<QuestionProgressProps> = ({
  current,
  total,
  answered = new Set(),
  skipped = new Set(),
  subtitle,
}) => {
  const answeredCount = answered.size;
  const skippedCount = skipped.size;
  // "Remaining" = questions that still need an answer. Do NOT subtract the
  // current question separately — if it's unanswered it's part of remaining,
  // and if it's answered it's already in answeredCount. The old `- 1` made
  // answered + remaining fall short of total (the current question vanished
  // from the tally).
  const remainingCount = Math.max(0, total - answeredCount - skippedCount);
  const completionPct = total > 0 ? Math.round((answeredCount / total) * 100) : 0;

  return (
    <div className="group relative shrink-0 overflow-hidden rounded-2xl border border-slate-200/60 bg-white/80 px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_16px_36px_-20px_rgba(61,7,95,0.28)] backdrop-blur-xl">
      {/* Decorative gradient hairline on top */}
      <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-violet/40 to-transparent" />
      {/* Decorative gradient orb */}
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-brand-violet/10 blur-2xl" />

      <div className="relative flex items-center gap-4">
        {/* Big question counter */}
        <div className="flex shrink-0 items-baseline gap-1.5">
          <span className="bg-gradient-to-br from-brand-purple via-brand-purple to-brand-violet bg-clip-text text-3xl font-black leading-none tracking-tight text-transparent tabular-nums">
            {pad2(current + 1)}
          </span>
          <span className="text-sm font-bold text-slate-400">/ {pad2(total)}</span>
        </div>

        {/* Vertical divider */}
        <span aria-hidden className="h-10 w-px bg-gradient-to-b from-transparent via-slate-200 to-transparent" />

        {/* Middle column: subtitle + segmented bar + activity */}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 font-bold uppercase tracking-[0.08em] text-brand-violet">
              <Sparkles className="h-3 w-3" />
              In progress
            </span>
            {subtitle && (
              <>
                <span className="text-slate-300">·</span>
                <span className="truncate font-medium text-slate-600">{subtitle}</span>
              </>
            )}
          </div>

          {/* Segmented bar */}
          <div className="flex items-center gap-0.5" role="progressbar" aria-valuenow={completionPct} aria-valuemin={0} aria-valuemax={100}>
            {Array.from({ length: total }).map((_, i) => {
              const status = segmentStatus(i, current, answered, skipped);
              const baseCls = "h-1.5 flex-1 rounded-full transition-all duration-300";
              const colorCls =
                status === "answered"
                  ? "bg-gradient-to-r from-brand-purple to-brand-violet"
                  : status === "current"
                    ? "bg-brand-violet shadow-[0_0_0_2px_rgba(124,58,237,0.18)] animate-pulse"
                    : status === "skipped"
                      ? "bg-amber-300"
                      : "bg-slate-200/80";
              return <span key={i} className={cn(baseCls, colorCls)} />;
            })}
          </div>
        </div>

        {/* Right column: activity chips */}
        <div className="hidden shrink-0 flex-col items-end gap-1 lg:flex">
          <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-brand-purple/10 via-brand-violet/10 to-brand-purple/10 px-2.5 py-1 text-[11px] font-bold tracking-tight text-brand-violet ring-1 ring-inset ring-brand-violet/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
            <span className="tabular-nums">{completionPct}%</span>
            <span className="text-[9px] font-semibold uppercase tracking-wide opacity-70">complete</span>
          </span>
          <div className="flex items-center gap-1.5 text-[10px]">
            <ActivityChip icon={CheckCircle2} value={answeredCount} tone="emerald" label="Answered" />
            {skippedCount > 0 && <ActivityChip icon={Flag} value={skippedCount} tone="amber" label="Skipped" />}
            <ActivityChip icon={Circle} value={remainingCount} tone="slate" label="Remaining" />
          </div>
        </div>
      </div>
    </div>
  );
};

const ActivityChip: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  tone: "emerald" | "amber" | "slate";
  label: string;
}> = ({ icon: Icon, value, tone, label }) => {
  const toneCls =
    tone === "emerald"
      ? "text-emerald-600"
      : tone === "amber"
        ? "text-amber-600"
        : "text-slate-400";
  return (
    <span title={label} className="inline-flex items-center gap-0.5 rounded-md bg-slate-50/70 px-1.5 py-0.5 ring-1 ring-inset ring-slate-200/60">
      <Icon className={cn("h-2.5 w-2.5", toneCls)} />
      <span className="font-bold tabular-nums text-slate-700">{value}</span>
    </span>
  );
};
