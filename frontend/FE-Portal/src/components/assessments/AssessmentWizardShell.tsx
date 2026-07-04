import React from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle, Loader2 } from "lucide-react";

export interface WizardStep {
  key: string;
  label: string;
}

export interface WizardSummary {
  /** Assessment name / title. */
  name?: string;
  /** Total selected questions. Omitted from the sidebar when `undefined` (e.g. AI wizard). */
  totalQuestions?: number;
  /** Total assigned/selected candidates. */
  totalCandidates?: number;
  /** Human-readable duration, e.g. "60 min". */
  duration?: string;
  /** Human-readable passing score, e.g. "70%" or "—". */
  passingScore?: string;
}

export interface AssessmentWizardShellProps {
  /** Ordered list of step descriptors. */
  steps: WizardStep[];
  /** Index of the active step (0-based). */
  currentIndex: number;
  /** Whether the Next/Finish action is allowed from the current step. */
  canProceed: boolean;
  /** Go back one step. */
  onBack: () => void;
  /** Advance to the next step (also used to create/save on step 1). */
  onNext: () => void;
  /** Finish the wizard (last step). */
  onFinish: () => void;
  /** Summary values rendered in the sidebar. */
  summary: WizardSummary;
  /** Show spinners + disable nav while an async action runs. */
  busy?: boolean;
  /** Optionally allow jumping to a step by clicking its label (e.g. edit mode). */
  onStepSelect?: (index: number) => void;
  /** The body of the current step. */
  children: React.ReactNode;
}

const PRIMARY_BTN =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-purple to-brand-violet px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50";
const OUTLINE_BTN =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Presentational wizard shell shared by the Regular and AI assessment creation
 * flows. Renders a step progress rail, the current step body, a summary sidebar,
 * and Back / Next / Finish footer navigation. All state lives in the parent —
 * this component is purely controlled via props.
 */
export const AssessmentWizardShell: React.FC<AssessmentWizardShellProps> = ({
  steps,
  currentIndex,
  canProceed,
  onBack,
  onNext,
  onFinish,
  busy = false,
  onStepSelect,
  children,
}) => {
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === steps.length - 1;

  return (
    <div className="mx-auto max-w-5xl">
      {/* Stepper — clean, flat, no card */}
      <nav aria-label="Progress" className="mb-8 flex items-center">
        {steps.map((step, idx) => {
          const done = idx < currentIndex;
          const active = idx === currentIndex;
          const clickable = Boolean(onStepSelect) && idx !== currentIndex;
          return (
            <React.Fragment key={step.key}>
              <button
                type="button"
                disabled={!clickable || busy}
                onClick={() => clickable && onStepSelect?.(idx)}
                className={`flex items-center gap-2.5 ${clickable ? "cursor-pointer" : "cursor-default"}`}
                title={step.label}
              >
                <span
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                    active
                      ? "bg-brand-violet text-white shadow-sm shadow-brand-violet/30"
                      : done
                      ? "bg-brand-violet/10 text-brand-violet"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {done ? <Check className="h-4 w-4" /> : idx + 1}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block text-[10px] font-medium uppercase tracking-wide text-slate-400">
                    Step {idx + 1}
                  </span>
                  <span
                    className={`block text-sm font-semibold leading-tight ${
                      active ? "text-slate-900" : done ? "text-slate-600" : "text-slate-400"
                    }`}
                  >
                    {step.label}
                  </span>
                </span>
              </button>
              {idx < steps.length - 1 && (
                <div
                  className={`mx-3 h-px flex-1 ${idx < currentIndex ? "bg-brand-violet/40" : "bg-slate-200"}`}
                />
              )}
            </React.Fragment>
          );
        })}
      </nav>

      {/* Step body — flat; each step provides its own surface */}
      <div>{children}</div>

      {/* Footer nav — divider, no card */}
      <div className="mt-8 flex items-center justify-between gap-2 border-t border-slate-100 pt-5">
        <button type="button" onClick={onBack} disabled={isFirst || busy} className={OUTLINE_BTN}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        {isLast ? (
          <button type="button" onClick={onFinish} disabled={!canProceed || busy} className={PRIMARY_BTN}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            Finish
          </button>
        ) : (
          <button type="button" onClick={onNext} disabled={!canProceed || busy} className={PRIMARY_BTN}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Next
            {!busy && <ArrowRight className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
};
