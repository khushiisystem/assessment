import React, { memo, useEffect, useRef } from 'react';
import { Pause } from 'lucide-react';

export interface VoiceWaveformProps {
  /** Live audio stream — usually `mediaRecorder.stream`. */
  stream: MediaStream | null;
  /** Freeze the bars when the recording is paused. */
  paused?: boolean;
  /** Number of vertical bars (default 11). */
  barCount?: number;
}

/**
 * Reactive voice waveform — connects an AnalyserNode to the live audio
 * stream and animates a row of vertical bars to the candidate's actual
 * voice levels via requestAnimationFrame.
 *
 * Bars are updated directly through `style.height` (no React re-render per
 * frame), so 60fps motion is essentially free.
 */
const VoiceWaveformImpl: React.FC<VoiceWaveformProps> = ({ stream, paused = false, barCount = 11 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const dataRef = useRef<Uint8Array | null>(null);
  const rafRef = useRef<number | null>(null);
  const pausedRef = useRef(paused);

  // Keep a ref of `paused` so the animation loop sees the latest value without
  // re-binding the rAF callback.
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // Spin up / tear down the analyser when the stream changes.
  useEffect(() => {
    if (!stream) return undefined;
    let cancelled = false;

    try {
      const AudioCtx =
        (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      const audioCtx = new AudioCtx();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64; // 32 frequency bins — plenty for 11 bars
      analyser.smoothingTimeConstant = 0.55;
      source.connect(analyser);

      audioCtxRef.current = audioCtx;
      sourceRef.current = source;
      analyserRef.current = analyser;
      dataRef.current = new Uint8Array(analyser.frequencyBinCount);

      // Some browsers leave the context suspended until a user gesture; the
      // Start-recording click is the gesture, so this resume is harmless.
      audioCtx.resume?.().catch(() => {});

      const tick = () => {
        if (cancelled) return;
        const a = analyserRef.current;
        const data = dataRef.current;
        const container = containerRef.current;
        if (a && data && container) {
          if (pausedRef.current) {
            // Don't read fresh data while paused — bars hold their position.
          } else {
            a.getByteFrequencyData(data);
            const bins = data.length;
            const binSize = Math.max(1, Math.floor(bins / barCount));
            const bars = container.children;
            for (let i = 0; i < barCount; i += 1) {
              let sum = 0;
              const start = i * binSize;
              for (let j = 0; j < binSize; j += 1) {
                sum += data[start + j] ?? 0;
              }
              const avg = sum / binSize / 255; // 0..1
              // Apply a gentle curve so quiet voices still produce visible motion.
              const eased = Math.min(1, Math.pow(avg, 0.6) * 1.2);
              const heightPct = 14 + eased * 86; // 14..100
              const bar = bars[i] as HTMLElement | undefined;
              if (bar) bar.style.height = `${heightPct}%`;
            }
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      // Older browsers / autoplay restrictions — silently fall back to no animation.
    }

    return () => {
      cancelled = true;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      try {
        sourceRef.current?.disconnect();
        audioCtxRef.current?.close();
      } catch {
        // ignore teardown errors
      }
      sourceRef.current = null;
      analyserRef.current = null;
      audioCtxRef.current = null;
      dataRef.current = null;
    };
  }, [stream, barCount]);

  return (
    <div
      ref={containerRef}
      className="relative flex h-16 items-end justify-center gap-1 overflow-hidden rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/40 px-4 py-3 ring-1 ring-inset ring-slate-200/70"
      aria-hidden
    >
      {Array.from({ length: barCount }).map((_, i) => (
        <span
          key={i}
          className="block w-1.5 rounded-full bg-gradient-to-b from-brand-purple to-brand-violet transition-[height] duration-75 ease-out"
          style={{ height: '14%' }}
        />
      ))}
      {paused && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-700 shadow-sm ring-1 ring-inset ring-slate-200 backdrop-blur">
            <Pause className="h-3 w-3" /> Paused
          </span>
        </span>
      )}
    </div>
  );
};

export const VoiceWaveform = memo(VoiceWaveformImpl);
