import { useEffect, useRef } from 'react';

export interface UseQuestionTimerOpts {
  /** Master gate (`isTimerRunning && isAssessmentStarted`). */
  enabled: boolean;
  /** Current remaining seconds. The effect re-runs whenever this changes, mirroring the
   * pre-extraction inline pattern (interval is cleared+recreated each second). */
  remainingSec: number;
  /** Fired roughly every 1000ms while the timer is running. Owner is expected to
   * call the appropriate state setter (and handle expiration via the `prev <= 1` branch). */
  onSecondElapsed: () => void;
}

/**
 * One-second countdown timer for the per-question clock. Faithfully mirrors
 * the original inline effect's behaviour, including its restart-on-tick
 * pattern (which keeps the drift profile identical to the pre-extraction code).
 *
 * The `onSecondElapsed` callback is stored in a ref so the parent doesn't need
 * to wrap it in `useCallback` — useful while we hold off on Phase 4's reducer
 * consolidation.
 */
export function useQuestionTimer({
  enabled,
  remainingSec,
  onSecondElapsed,
}: UseQuestionTimerOpts): void {
  const cbRef = useRef(onSecondElapsed);
  useEffect(() => {
    cbRef.current = onSecondElapsed;
  }, [onSecondElapsed]);

  useEffect(() => {
    if (!enabled || remainingSec <= 0) return;
    const id = window.setInterval(() => cbRef.current(), 1000);
    return () => window.clearInterval(id);
  }, [enabled, remainingSec]);
}
