import React, { memo } from 'react';
import { AlertTriangle, Maximize2 } from 'lucide-react';

export interface FullscreenExitModalProps {
  open: boolean;
  /** Number of times the candidate has already exited fullscreen. */
  exitCount: number;
  /** Resume the assessment in fullscreen. */
  onContinue: () => void;
  /** Auto-submit and exit. */
  onAutoSubmit: () => void;
}

/**
 * Modal surfaced when the candidate drops out of fullscreen mid-session.
 * Pure presentational — the parent owns the exit counter + handlers.
 */
const FullscreenExitModalImpl: React.FC<FullscreenExitModalProps> = ({
  open,
  exitCount,
  onContinue,
  onAutoSubmit,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-[0_24px_60px_-12px_rgba(15,23,42,0.45),0_8px_24px_-12px_rgba(124,58,237,0.35)]">
        <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-amber-300/20 blur-3xl" />
        <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-rose-500" />

        <div className="relative px-7 pt-8 pb-2 text-center">
          <span className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100 text-amber-600 ring-1 ring-inset ring-amber-200 shadow-[0_8px_22px_-6px_rgba(245,158,11,0.45)]">
            <AlertTriangle className="h-7 w-7" />
          </span>
          <h3 className="text-xl font-bold tracking-tight text-slate-900">Assessment interrupted</h3>
          <p className="mt-1.5 text-sm text-slate-600">
            This session must stay in fullscreen mode.
          </p>

          <div className="mt-5 rounded-xl border border-slate-200/70 bg-slate-50/70 px-4 py-3 text-left">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Exits so far</span>
              <span className="text-lg font-bold tabular-nums text-slate-900">{exitCount}</span>
            </div>
            {exitCount >= 3 && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
                <AlertTriangle className="h-3 w-3" />
                Next exit will auto-submit your session
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-3 px-7 py-5">
          <button
            type="button"
            onClick={onContinue}
            className="group inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-brand-purple via-brand-purple to-brand-violet px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_22px_-6px_rgba(124,58,237,0.55)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-6px_rgba(124,58,237,0.6)] active:translate-y-0"
          >
            <Maximize2 className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
            Resume in fullscreen
          </button>
          <button
            type="button"
            onClick={onAutoSubmit}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-600 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-rose-50 hover:shadow-md active:translate-y-0"
          >
            Submit &amp; exit
          </button>
        </div>
      </div>
    </div>
  );
};

export const FullscreenExitModal = memo(FullscreenExitModalImpl);
