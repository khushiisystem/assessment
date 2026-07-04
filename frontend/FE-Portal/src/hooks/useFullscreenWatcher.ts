import { useEffect } from 'react';

export interface UseFullscreenWatcherOpts {
  /** When true (assessment in progress), a fullscreen exit fires `onExit`. */
  isAssessmentStarted: boolean;
  /** When true, re-entering fullscreen fires `onEnter` (used to dismiss the exit modal). */
  isModalOpen: boolean;
  /** Fired when the candidate drops out of fullscreen while the assessment is active. */
  onExit: () => void;
  /** Fired when the candidate returns to fullscreen while the exit modal is open. */
  onEnter: () => void;
}

/**
 * Watches `fullscreenchange` (and the webkit prefix) and dispatches to the
 * supplied callbacks. The handler body mirrors the inline effect that used
 * to live inside AiAssessmentTestInterface — same gating, same behaviour.
 *
 * The caller is expected to pass stable callbacks (via `useCallback`) so the
 * effect doesn't re-attach the DOM listener on every parent render.
 */
export function useFullscreenWatcher({
  isAssessmentStarted,
  isModalOpen,
  onExit,
  onEnter,
}: UseFullscreenWatcherOpts): void {
  useEffect(() => {
    const handler = () => {
      const isFullscreen = !!document.fullscreenElement;
      if (!isFullscreen && isAssessmentStarted) {
        onExit();
      } else if (isFullscreen && isModalOpen) {
        onEnter();
      }
    };
    document.addEventListener('fullscreenchange', handler);
    document.addEventListener('webkitfullscreenchange', handler);
    return () => {
      document.removeEventListener('fullscreenchange', handler);
      document.removeEventListener('webkitfullscreenchange', handler);
    };
  }, [isAssessmentStarted, isModalOpen, onExit, onEnter]);
}
