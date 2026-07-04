import React, { memo } from 'react';
import { ArrowRight, CheckCircle, Info, Loader2, Send, Sparkles } from 'lucide-react';

export interface SubmitConfirmModalProps {
  open: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Final "Submit interview" confirmation. The parent owns the submit handler
 * and the in-flight `isSubmitting` flag.
 *
 * Pure presentational — same brand-glass treatment as the start gate and the
 * fullscreen-exit modal.
 */
const SubmitConfirmModalImpl: React.FC<SubmitConfirmModalProps> = ({
  open,
  isSubmitting,
  onCancel,
  onConfirm,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 backdrop-blur-md">
      {/* Decorative aurora orbs behind the card */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-1/4 h-80 w-80 rounded-full bg-brand-violet/15 blur-3xl" />
        <div className="absolute -right-32 bottom-1/4 h-80 w-80 rounded-full bg-brand-purple/15 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-[0_28px_72px_-16px_rgba(15,23,42,0.55),0_8px_24px_-12px_rgba(124,58,237,0.45)]">
        {/* Top brand-gradient accent */}
        <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-purple via-brand-violet to-brand-purple" />
        {/* Decorative ornaments inside card */}
        <span aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-brand-violet/12 blur-3xl" />
        <span aria-hidden className="pointer-events-none absolute -left-16 -bottom-16 h-40 w-40 rounded-full bg-brand-purple/10 blur-3xl" />

        <div className="relative px-7 pt-7 pb-2 text-center">
          {/* Brand-gradient send icon square (sheen + shadow) */}
          <span className="relative mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-purple via-brand-purple to-brand-violet text-white shadow-[0_8px_22px_-6px_rgba(124,58,237,0.55)] ring-1 ring-white/20">
            <Send className="h-6 w-6" />
            <span aria-hidden className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-white/0 via-white/25 to-white/0" />
          </span>

          <p className="flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-violet">
            <Sparkles className="h-3 w-3" />
            Final step
          </p>
          <h3 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
            Submit your interview?
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
            Your answers will be sent for evaluation. You won't be able to make changes after this.
          </p>

          {/* Info card — what happens next */}
          <div className="relative mt-5 overflow-hidden rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white to-slate-50/70 p-3.5 text-left shadow-sm">
            <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-violet/30 to-transparent" />
            <div className="flex items-start gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-[0_4px_12px_-2px_rgba(99,102,241,0.45)] ring-1 ring-white/20">
                <Info className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold tracking-tight text-slate-900">What happens next</p>
                <ul className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-slate-600">
                  <li className="flex items-start gap-1.5">
                    <CheckCircle className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
                    Final upload + scoring runs in the background.
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
                    You'll see results on your dashboard within a minute.
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
                    Answers cannot be edited once submitted.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* CTA row */}
        <div className="relative flex gap-3 px-7 pb-6 pt-5">
          {/* <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-violet/40 hover:text-brand-violet hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
          >
            Keep editing
          </button> */}
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="group inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-brand-purple via-brand-purple to-brand-violet px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_28px_-6px_rgba(124,58,237,0.55)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-6px_rgba(124,58,237,0.65)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-[0_10px_28px_-6px_rgba(124,58,237,0.35)]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting…
              </>
            ) : (
              <>
                Submit interview
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export const SubmitConfirmModal = memo(SubmitConfirmModalImpl);
