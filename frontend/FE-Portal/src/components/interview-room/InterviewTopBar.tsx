import React from "react";
import { Pause, Play, LogOut, Mic, MicOff, Video, VideoOff, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";

/** Status-pill state. */
type Status = "ok" | "warn" | "error" | "off";

const STATUS_CLS: Record<Status, string> = {
  ok: "bg-emerald-50/80 text-emerald-700 ring-emerald-200/80 shadow-[0_0_0_1px_rgba(16,185,129,0.06)]",
  warn: "bg-amber-50/80 text-amber-700 ring-amber-200/80 shadow-[0_0_0_1px_rgba(245,158,11,0.06)]",
  error: "bg-rose-50/80 text-rose-700 ring-rose-200/80 shadow-[0_0_0_1px_rgba(244,63,94,0.06)]",
  off: "bg-slate-100/80 text-slate-500 ring-slate-200/80",
};

const STATUS_DOT_CLS: Record<Status, string> = {
  ok: "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]",
  warn: "bg-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.18)]",
  error: "bg-rose-500 shadow-[0_0_0_3px_rgba(244,63,94,0.18)]",
  off: "bg-slate-400",
};

/** Two-state status pill (icon + short label) used for REC / mic / cam. */
const StatusPill: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  status: Status;
  /** When true, the leading dot pulses (used for REC). */
  pulse?: boolean;
}> = ({ icon: Icon, label, status, pulse = false }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset backdrop-blur transition-all duration-200 hover:-translate-y-px",
      STATUS_CLS[status]
    )}
    aria-label={`${label}: ${status}`}
  >
    {pulse && status !== "off" ? (
      <span className={cn("relative h-2 w-2 rounded-full", STATUS_DOT_CLS[status])}>
        <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-40" />
      </span>
    ) : (
      <Icon className="h-3 w-3" />
    )}
    {label}
  </span>
);

/** mm:ss formatter; spent always grows, total is the budget (may be undefined). */
const formatClock = (seconds: number) => {
  const m = Math.floor(Math.abs(seconds) / 60);
  const s = Math.floor(Math.abs(seconds) % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

export interface InterviewTopBarProps {
  /** Display role string, e.g. "Frontend Developer". */
  role?: string;
  /** Display experience chip, e.g. "Mid-level". */
  experience?: string;
  /** Variant — drives the small badge after the title. */
  variant?: "regular" | "premium";
  /** Seconds elapsed since interview started. */
  elapsedSec: number;
  /** Optional total budget (seconds). When set, drives amber/rose color tiers. */
  budgetSec?: number;
  /** Live status indicators. */
  recording: Status;
  mic: Status;
  camera: Status;
  /** Paused state — flips the pause icon to play and dims the timer. */
  paused?: boolean;
  /** Handlers. */
  onPauseToggle: () => void;
  onExit: () => void;
}

export const InterviewTopBar: React.FC<InterviewTopBarProps> = ({
  role,
  experience,
  variant = "regular",
  elapsedSec,
  budgetSec,
  recording,
  mic,
  camera,
  paused = false,
  onPauseToggle,
  onExit,
}) => {
  // Timer color tier: ok / amber 80% / rose 95% of budget.
  const ratio = budgetSec ? elapsedSec / budgetSec : 0;
  const timerTone =
    ratio >= 0.95
      ? "text-rose-600"
      : ratio >= 0.8
        ? "text-amber-600"
        : paused
          ? "text-slate-400"
          : "text-slate-900";

  const MicIcon = mic === "off" ? MicOff : Mic;
  const CamIcon = camera === "off" ? VideoOff : Video;

  return (
    <header
      role="banner"
      className="sticky top-0 z-50 flex h-16 items-center justify-between gap-4 border-b border-slate-200/60 bg-white/75 px-4 backdrop-blur-xl backdrop-saturate-150 supports-[backdrop-filter]:bg-white/70 sm:px-6 after:absolute after:inset-x-0 after:bottom-[-1px] after:h-px after:bg-gradient-to-r after:from-transparent after:via-brand-violet/30 after:to-transparent"
    >
      {/* LEFT — logo + interview title */}
      <div className="flex min-w-0 items-center gap-3">
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-purple via-brand-purple to-brand-violet text-white shadow-[0_4px_14px_-2px_rgba(124,58,237,0.45)] ring-1 ring-white/20">
          <img src="/SkilTechyFavicon.png" alt="" className="h-5 w-5" />
          <span aria-hidden className="absolute inset-0 rounded-xl bg-gradient-to-tr from-white/0 via-white/20 to-white/0" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-bold tracking-tight text-slate-900">
              AI Interview
            </p>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset",
                variant === "premium"
                  ? "bg-violet-50 text-brand-violet ring-violet-200"
                  : "bg-sky-50 text-sky-700 ring-sky-200"
              )}
            >
              {variant === "premium" ? "Premium" : "Regular"}
            </span>
          </div>
          {(role || experience) && (
            <p className="truncate text-[11px] text-slate-500">
              {role}
              {role && experience ? " · " : ""}
              {experience}
            </p>
          )}
        </div>
      </div>

      {/* MIDDLE — status pills (hidden on small screens, shown md+) */}
      <div className="hidden items-center gap-1.5 md:flex">
        <StatusPill icon={CircleDot} label={recording === "off" ? "Stopped" : "REC"} status={recording} pulse />
        <StatusPill icon={MicIcon} label={mic === "off" ? "Mic off" : "Mic"} status={mic} />
        <StatusPill icon={CamIcon} label={camera === "off" ? "Cam off" : "Cam"} status={camera} />
      </div>

      {/* RIGHT — timer + pause + exit */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div
          className={cn(
            "relative rounded-xl border border-slate-200/60 bg-gradient-to-b from-white to-slate-50/80 px-3.5 py-1.5 text-sm font-bold tabular-nums shadow-[0_1px_2px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur",
            timerTone
          )}
          aria-live="off"
        >
          {formatClock(elapsedSec)}
          {budgetSec ? (
            <span className="ml-1 text-[10px] font-medium text-slate-400">/ {formatClock(budgetSec)}</span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onPauseToggle}
          className="group inline-flex items-center gap-1.5 rounded-xl border border-slate-200/70 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-violet/40 hover:bg-violet-50/80 hover:text-brand-violet hover:shadow-md active:translate-y-0 active:shadow-sm"
          title={paused ? "Resume" : "Pause"}
        >
          {paused ? <Play className="h-3.5 w-3.5 transition-transform duration-200 group-hover:scale-110" /> : <Pause className="h-3.5 w-3.5 transition-transform duration-200 group-hover:scale-110" />}
          <span className="hidden sm:inline">{paused ? "Resume" : "Pause"}</span>
        </button>

        <button
          type="button"
          onClick={onExit}
          className="group inline-flex items-center gap-1.5 rounded-xl border border-rose-200/80 bg-white/80 px-3 py-1.5 text-xs font-semibold text-rose-600 shadow-sm backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:bg-rose-50 hover:shadow-md active:translate-y-0 active:shadow-sm"
          title="Exit interview"
        >
          <LogOut className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
          <span className="hidden sm:inline">Exit</span>
        </button>
      </div>
    </header>
  );
};
