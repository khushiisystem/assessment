import React, {
  useState,
  useRef,
  useEffect,
  useCallback
} from 'react';

import {
  Mic,
  StopCircle,
  CheckCircle,
  RotateCcw,
  ArrowRight,
  AlertCircle,
  Loader2,
  Clock,
  Volume2
} from 'lucide-react';

interface VoiceCheckPageProps {
  onComplete: (success: boolean) => void;
  assessmentId?: string;
}

// Constants
const BAR_COUNT = 60;
const BAR_W = 4;
const BAR_GAP = 3;
const CANVAS_H = 100;
const SILENCE_THRESH = 18;

const VoiceCheckPage: React.FC<
  VoiceCheckPageProps
> = ({ onComplete }) => {

  // Paragraph
  const checkParagraph =
    'Hello, this is a voice test. I am checking my microphone before starting the assessment. My voice should be clear and at a normal volume.';

  // States
  const [isRecording, setIsRecording] =
    useState(false);

  const [isProcessing, setIsProcessing] =
    useState(false);

  const [transcribedText, setTranscribedText] =
    useState('');

  const [isCorrect, setIsCorrect] =
    useState<boolean | null>(null);

  const [error, setError] = useState('');

  const [showRetry, setShowRetry] =
    useState(false);

  // Timer
  const [timeLeft, setTimeLeft] =
    useState(60);

  const [showTimerWarning, setShowTimerWarning] =
    useState(false);

  // Volume
  const [currentVolume, setCurrentVolume] =
    useState(0);

  // Warning
  const [warningText, setWarningText] =
    useState('');

  const [showWarning, setShowWarning] =
    useState(false);

  // Refs
  const hasSpokenRef = useRef(false);

  const lowVolumeWarningCount = useRef(0);
const highVolumeWarningCount = useRef(0);
const lastWarningTimeRef = useRef(0);

  // FE-only voice check metrics — collected live from the waveform analyser
  // so we can judge mic quality on the client without any backend call.
  const peakVolumeRef = useRef(0);

  const speechSamplesRef = useRef(0);

  const canvasRef =
    useRef<HTMLCanvasElement>(null);

  const lockedBars = useRef<
    { h: number; color: string }[]
  >([]);

  const headRef = useRef(0);

  const frameRef = useRef(0);

  const liveH = useRef(6);

  const liveColor = useRef('#3b82f6');

  const mediaRecorderRef =
    useRef<MediaRecorder | null>(null);

  const streamRef =
    useRef<MediaStream | null>(null);

  const chunksRef = useRef<Blob[]>([]);

  const timerRef = useRef<number | null>(
    null
  );

  const audioContextRef =
    useRef<AudioContext | null>(null);

  const analyserRef =
    useRef<AnalyserNode | null>(null);

  const animationFrameRef =
    useRef<number | null>(null);

  // Helpers
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);

    const secs = seconds % 60;

    return `${mins
      .toString()
      .padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  };

  function getFutureHeight(i: number): number {
    return Math.max(
      5,
      Math.abs(Math.sin(i * 0.5 + 1) * 14) +
        Math.abs(Math.cos(i * 1.1) * 8) +
        6
    );
  }

  function getBarColor(avg: number): string {
    if (avg < SILENCE_THRESH)
      return '#cbd5e1';

    const pct = (avg / 255) * 100;

    if (pct < 25) return '#3b82f6';

    if (pct < 50) return '#22c55e';

    if (pct < 75) return '#facc15';

    return '#ef4444';
  }

  // Rounded Rect
  function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) {
    ctx.beginPath();

    ctx.moveTo(x + r, y);

    ctx.lineTo(x + w - r, y);

    ctx.quadraticCurveTo(
      x + w,
      y,
      x + w,
      y + r
    );

    ctx.lineTo(x + w, y + h - r);

    ctx.quadraticCurveTo(
      x + w,
      y + h,
      x + w - r,
      y + h
    );

    ctx.lineTo(x + r, y + h);

    ctx.quadraticCurveTo(
      x,
      y + h,
      x,
      y + h - r
    );

    ctx.lineTo(x, y + r);

    ctx.quadraticCurveTo(x, y, x + r, y);

    ctx.closePath();
  }

  // Draw Waveform
  const draw = useCallback(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    const W = canvas.width;

    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    const centerY = H / 2;

    const totalW =
      BAR_COUNT * BAR_W +
      (BAR_COUNT - 1) * BAR_GAP;

    const startX = (W - totalW) / 2;

    for (let i = 0; i < BAR_COUNT; i++) {
      const x =
        startX + i * (BAR_W + BAR_GAP);

      let h = 10;

      let color = '#cbd5e1';

      let alpha = 0.3;

      if (i < headRef.current) {
        const b = lockedBars.current[i];

        if (b) {
          h = b.h;

          color = b.color;

          alpha = 0.9;
        }
      } else if (i === headRef.current) {
        h = liveH.current;

        color = liveColor.current;

        alpha = 1;
      } else {
        h = getFutureHeight(i);
      }

      ctx.globalAlpha = alpha;

      ctx.fillStyle = color;

      const y = centerY - h / 2;

      roundRect(
        ctx,
        x,
        y,
        BAR_W,
        h,
        BAR_W / 2
      );

      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }, []);

  // Reset Wave
  const resetWave = () => {
    lockedBars.current = [];

    headRef.current = 0;

    frameRef.current = 0;

    liveH.current = 8;

    liveColor.current = '#3b82f6';

    requestAnimationFrame(() => {
      draw();
    });
  };

  // Stop Wave
  const stopWaveformMonitoring =
    async () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(
          animationFrameRef.current
        );

        animationFrameRef.current = null;
      }

      if (audioContextRef.current) {
        try {
          await audioContextRef.current.close();
        } catch (e) {}

        audioContextRef.current = null;
      }

      analyserRef.current = null;
    };

  // Start Wave
  const startWaveformMonitoring =
    async (stream: MediaStream) => {
      await stopWaveformMonitoring();

      const AudioContextClass =
        window.AudioContext ||
        (window as any).webkitAudioContext;

      const audioContext =
        new AudioContextClass();

      audioContextRef.current = audioContext;

      const analyser =
        audioContext.createAnalyser();

      analyser.fftSize = 128;

      analyserRef.current = analyser;

      const source =
        audioContext.createMediaStreamSource(
          stream
        );

      source.connect(analyser);

      const data = new Uint8Array(
        analyser.frequencyBinCount
      );

      const tick = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(
          data
        );

        let sum = 0;

        for (const v of data) {
          sum += v;
        }

        const avg = sum / data.length;

        const volumePct = Math.min(
          100,
          Math.max(0, (avg / 255) * 100)
        );

        setCurrentVolume(volumePct);

        // Track FE-only voice-check metrics: peak loudness reached and the
        // number of samples where the mic registered audible (non-silent) sound.
        if (volumePct > peakVolumeRef.current) {
          peakVolumeRef.current = volumePct;
        }

        if (avg >= SILENCE_THRESH) {
          speechSamplesRef.current += 1;
        }

        // Warnings
       const now = Date.now();
const canShowWarning = now - lastWarningTimeRef.current > 4000;

if (volumePct < 15 && canShowWarning) {
  if (lowVolumeWarningCount.current < 3) {
    lowVolumeWarningCount.current++;
    lastWarningTimeRef.current = now;

    setWarningText('Speak louder');
    setShowWarning(true);

    setTimeout(() => {
      setShowWarning(false);
    }, 2000);
  }
} else if (volumePct > 80 && canShowWarning) {
  if (highVolumeWarningCount.current < 3) {
    highVolumeWarningCount.current++;
    lastWarningTimeRef.current = now;

    setWarningText('Voice too loud');
    setShowWarning(true);

    setTimeout(() => {
      setShowWarning(false);
    }, 2000);
  }
}

        if (avg > 10) {
          hasSpokenRef.current = true;
        }

        liveColor.current = getBarColor(avg);

        liveH.current =
          avg < SILENCE_THRESH
            ? getFutureHeight(
                headRef.current
              )
            : Math.max(
                10,
                (avg / 255) *
                  CANVAS_H *
                  1.2
              );

        frameRef.current++;

        if (frameRef.current % 3 === 0) {
          lockedBars.current[
            headRef.current
          ] = {
            h: liveH.current,
            color: liveColor.current
          };

          headRef.current++;

          if (headRef.current >= BAR_COUNT) {
            headRef.current = 0;

            lockedBars.current = [];
          }
        }

        draw();

        animationFrameRef.current =
          requestAnimationFrame(tick);
      };

      tick();
    };

  // Timer
  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);

      timerRef.current = null;
    }
  };

  const startTimer = () => {
    stopTimer();

    setTimeLeft(60);

    timerRef.current = window.setInterval(
      () => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            stopTimer();

            stopRecording();

            return 0;
          }

          if (prev === 11) {
            setShowTimerWarning(true);
          }

          return prev - 1;
        });
      },
      1000
    );
  };

  // FE-only voice check — no backend involved. We judge mic quality purely
  // from the live metrics gathered while recording: did the mic capture
  // sustained, audible speech at a reasonable level?
  const MIN_SPEECH_SAMPLES = 40; // sustained audible activity, not a brief blip
  const MIN_PEAK_VOLUME = 15;    // % — mic registered a clear speaking level

  const processRecording = async () => {
    // Brief pause so the analysing state is visible to the candidate.
    await new Promise(resolve => setTimeout(resolve, 600));

    const peak = peakVolumeRef.current;
    const speechSamples = speechSamplesRef.current;

    const heardEnough =
      hasSpokenRef.current &&
      speechSamples >= MIN_SPEECH_SAMPLES;

    const loudEnough = peak >= MIN_PEAK_VOLUME;

    // No transcription on the client — clear any stale transcript.
    setTranscribedText('');

    if (heardEnough && loudEnough) {
      setIsCorrect(true);

      setShowRetry(false);
    } else {
      setIsCorrect(false);

      setShowRetry(true);

      setError(
        !heardEnough
          ? "We couldn't hear enough of your voice. Please speak clearly for a few seconds."
          : 'Your microphone level seems too low. Move closer or speak louder, then try again.'
      );
    }

    setIsProcessing(false);
  };

  // Start Recording
  const startRecording = async () => {
    try {
      stopTimer();

      await stopWaveformMonitoring();

      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach(track => track.stop());
      }

      // Reset State
      setError('');

      setShowRetry(false);

      setIsCorrect(null);

      setTranscribedText('');

      setCurrentVolume(0);

      setShowWarning(false);

      setWarningText('');

      setIsProcessing(false);

      setShowTimerWarning(false);

      hasSpokenRef.current = false;

      peakVolumeRef.current = 0;

      speechSamplesRef.current = 0;
      
      lowVolumeWarningCount.current = 0;
      highVolumeWarningCount.current = 0;
      lastWarningTimeRef.current = 0;

      chunksRef.current = [];

      resetWave();

      // Mic Access
      const stream =
        await navigator.mediaDevices.getUserMedia(
          {
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          }
        );

      streamRef.current = stream;

      // Waveform
      await startWaveformMonitoring(
        stream
      );

      // Recorder
      const mediaRecorder =
        new MediaRecorder(stream);

      mediaRecorderRef.current =
        mediaRecorder;

      mediaRecorder.ondataavailable =
        event => {
          if (event.data.size > 0) {
            chunksRef.current.push(
              event.data
            );
          }
        };

      mediaRecorder.onstop = async () => {
        if (
          chunksRef.current.length > 0 &&
          hasSpokenRef.current
        ) {
          setIsProcessing(true);

          await processRecording();
        } else {
          setError(
            'No speech detected. Please try again.'
          );

          setShowRetry(true);

          setIsProcessing(false);
        }
      };

      mediaRecorder.start(200);

      setIsRecording(true);

      startTimer();
    } catch (err: any) {
      setError(
        err.message ||
          'Unable to access microphone'
      );

      setShowRetry(true);
    }
  };

  // Stop Recording
  const stopRecording = async () => {
    stopTimer();

    setShowWarning(false);

    await stopWaveformMonitoring();

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state ===
        'recording'
    ) {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current
        .getTracks()
        .forEach(track => track.stop());
    }

    setIsRecording(false);
  };

  // Retry
  const handleRetry = async () => {
    await startRecording();
  };

  // Continue
  const handleContinue = () => {
    if (isCorrect) {
      onComplete(true);
    }
  };

  // Initial Draw
  useEffect(() => {
    draw();
  }, [draw]);

  // Cleanup
  useEffect(() => {
    return () => {
      stopTimer();

      stopWaveformMonitoring();

      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach(track => track.stop());
      }
    };
  }, []);

  // UI
  return (
    <div className="relative min-h-screen text-slate-900 bg-[radial-gradient(120%_60%_at_50%_-10%,rgba(124,58,237,0.10)_0%,rgba(124,58,237,0)_60%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] flex items-center justify-center p-4 sm:p-6">

      {/* Aurora orbs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-12 h-72 w-72 rounded-full bg-brand-violet/15 blur-3xl" />
        <div className="absolute -right-24 top-24 h-80 w-80 rounded-full bg-brand-purple/15 blur-3xl" />
        <div className="absolute -bottom-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-violet/10 blur-3xl" />
      </div>

      {/* Floating volume warning toast */}
      {showWarning && isRecording && (
        <div className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 animate-in slide-in-from-bottom duration-300">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-slate-200/60 bg-white/85 px-4 py-2.5 shadow-[0_10px_30px_-12px_rgba(61,7,95,0.45)] backdrop-blur-xl">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-[0_4px_12px_-2px_rgba(245,158,11,0.45)] ring-1 ring-white/20">
              <Volume2 className="h-3.5 w-3.5" />
            </span>
            <span className="text-xs font-semibold text-slate-700">{warningText}</span>
          </div>
        </div>
      )}

      {/* Main glass card */}
      <div className="relative z-10 w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200/60 bg-white/85 shadow-[0_28px_72px_-20px_rgba(15,23,42,0.40),0_8px_24px_-12px_rgba(124,58,237,0.35)] backdrop-blur-xl">
        {/* Top accent strip */}
        <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-purple via-brand-violet to-brand-purple" />
        {/* Decorative ornaments */}
        <span aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-brand-violet/12 blur-3xl" />
        <span aria-hidden className="pointer-events-none absolute -left-16 -bottom-16 h-40 w-40 rounded-full bg-brand-purple/10 blur-3xl" />

        {/* Header */}
        <div className="relative px-7 pt-7 pb-5 text-center">
          <span className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-purple via-brand-purple to-brand-violet text-white shadow-[0_8px_22px_-6px_rgba(124,58,237,0.55)] ring-1 ring-white/20">
            <Volume2 className="h-6 w-6" />
            <span aria-hidden className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-white/0 via-white/25 to-white/0" />
          </span>
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand-violet">
            Step 1 of 2 · Voice Check
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Let's make sure we can hear you
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
            Read the paragraph below clearly and we'll verify your mic is working.
          </p>
        </div>

        {/* Paragraph card */}
        <div className="relative mx-7 mb-6 rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white to-slate-50/70 p-5 shadow-sm">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
            <span className="h-1 w-5 rounded-full bg-gradient-to-r from-brand-purple to-brand-violet" />
            Read this aloud
          </p>
          <p className="text-[15px] leading-relaxed text-slate-800">
            {checkParagraph}
          </p>
        </div>

        {/* Main panel */}
        <div className="relative px-7 pb-7 space-y-4">

          {/* Timer */}
          {isRecording && (
            <div
              className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 ring-1 ring-inset transition-all ${
                showTimerWarning
                  ? 'bg-gradient-to-br from-rose-50 to-rose-100/70 ring-rose-200 animate-pulse'
                  : 'bg-gradient-to-br from-slate-50 to-slate-100/70 ring-slate-200'
              }`}
            >
              <Clock className={`h-4 w-4 ${showTimerWarning ? 'text-rose-600' : 'text-slate-500'}`} />
              <span className={`font-mono text-base font-bold tabular-nums ${showTimerWarning ? 'text-rose-600' : 'text-slate-800'}`}>
                {formatTime(timeLeft)}
              </span>
              <span className={`text-xs ${showTimerWarning ? 'text-rose-600' : 'text-slate-500'}`}>
                remaining
              </span>
            </div>
          )}

          {/* Waveform */}
          {isRecording && (
            <div className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white to-slate-50/70 p-4 shadow-sm">
              <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-violet/30 to-transparent" />

              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500 opacity-75" />
                    <span className="relative h-full w-full rounded-full bg-emerald-500" />
                  </span>
                  <span className="text-xs font-bold uppercase tracking-[0.08em] text-emerald-700">
                    Recording
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-br from-emerald-50 to-emerald-100/70 px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-emerald-700 ring-1 ring-inset ring-emerald-200">
                  {Math.round(currentVolume)}%
                </span>
              </div>

              <div className="overflow-hidden rounded-xl bg-white" style={{ lineHeight: 0 }}>
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={CANVAS_H}
                  style={{
                    width: '100%',
                    height: CANVAS_H,
                    display: 'block'
                  }}
                />
              </div>
            </div>
          )}

          {/* Processing — premium animated loader */}
          {isProcessing && (
            <div className="relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/80 px-6 py-7 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_38px_-22px_rgba(61,7,95,0.30)] backdrop-blur-xl">
              <span aria-hidden className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-brand-violet/15 blur-2xl" />
              <span aria-hidden className="pointer-events-none absolute -left-12 -bottom-12 h-32 w-32 rounded-full bg-brand-purple/15 blur-2xl" />

              <div className="relative flex flex-col items-center text-center">
                {/* Concentric rotating ring around a brand-gradient mic */}
                <div className="relative mb-4 flex h-16 w-16 items-center justify-center">
                  <span
                    aria-hidden
                    className="absolute inset-0 rounded-full border-2 border-transparent border-t-brand-violet border-r-brand-violet/60 animate-spin"
                    style={{ animationDuration: '1.2s' }}
                  />
                  <span
                    aria-hidden
                    className="absolute inset-1.5 rounded-full border-2 border-transparent border-b-brand-purple/70 border-l-brand-purple/40 animate-spin"
                    style={{ animationDuration: '1.8s', animationDirection: 'reverse' }}
                  />
                  <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-purple via-brand-purple to-brand-violet text-white shadow-[0_6px_16px_-4px_rgba(124,58,237,0.55)] ring-1 ring-white/20">
                    <Mic className="h-5 w-5" />
                  </span>
                </div>

                <p className="text-sm font-bold tracking-tight text-slate-900">
                  Analysing your audio
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Checking that your microphone captured clear, audible speech.
                </p>

                {/* Animated dots */}
                <div className="mt-3 flex items-center gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-brand-violet animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>

                {/* Indeterminate progress sweep */}
                <div className="mt-4 h-1 w-48 overflow-hidden rounded-full bg-slate-200/80">
                  <div
                    className="h-full w-1/3 rounded-full bg-gradient-to-r from-brand-purple via-brand-violet to-brand-purple"
                    style={{
                      animation: 'voice-check-sweep 1.4s ease-in-out infinite'
                    }}
                  />
                </div>

                {/* Step pills */}
                <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em]">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 ring-1 ring-inset ring-emerald-200">
                    <CheckCircle className="h-2.5 w-2.5" /> Captured
                  </span>
                  <span aria-hidden className="text-slate-300">·</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-brand-violet ring-1 ring-inset ring-violet-200 animate-pulse">
                    <Loader2 className="h-2.5 w-2.5 animate-spin" /> Analysing
                  </span>
                  <span aria-hidden className="text-slate-300">·</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-slate-500 ring-1 ring-inset ring-slate-200">
                    Verifying
                  </span>
                </div>
              </div>

              {/* Keyframes for the indeterminate sweep */}
              <style>{`
                @keyframes voice-check-sweep {
                  0% { transform: translateX(-100%); }
                  60% { transform: translateX(200%); }
                  100% { transform: translateX(200%); }
                }
              `}</style>
            </div>
          )}

          {/* Action buttons */}
          {(!isRecording && !isProcessing && !isCorrect && !showRetry) && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={startRecording}
                className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-brand-purple via-brand-purple to-brand-violet px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_28px_-6px_rgba(124,58,237,0.55)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-6px_rgba(124,58,237,0.65)] active:translate-y-0"
              >
                <Mic className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                Start voice check
              </button>
            </div>
          )}

          {isRecording && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={stopRecording}
                className="group inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-6 py-3 text-sm font-semibold text-rose-600 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-rose-50 hover:shadow-md active:translate-y-0"
              >
                <StopCircle className="h-4 w-4" />
                Stop &amp; check
              </button>
            </div>
          )}

          {/* Transcript */}
          {transcribedText && !isRecording && !isProcessing && !showRetry && (
            <div className="relative rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white to-slate-50/70 p-4 shadow-sm">
              <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                <span className="h-1 w-5 rounded-full bg-gradient-to-r from-brand-purple to-brand-violet" />
                Transcript
              </p>
              <p className="text-[13px] leading-relaxed text-slate-700">{transcribedText}</p>
            </div>
          )}

          {/* Success */}
          {isCorrect === true && !showRetry && (
            <div className="relative overflow-hidden rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 to-emerald-100/70 p-4 shadow-sm">
              <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_6px_16px_-4px_rgba(16,185,129,0.55)] ring-1 ring-white/20">
                    <CheckCircle className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-bold tracking-tight text-emerald-900">Voice check passed</p>
                    <p className="text-[11px] text-emerald-700/80">You can now record your introduction.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleContinue}
                  className="group inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 px-3.5 py-2 text-xs font-semibold text-white shadow-[0_6px_18px_-4px_rgba(16,185,129,0.55)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_22px_-4px_rgba(16,185,129,0.65)] active:translate-y-0"
                >
                  Continue
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                </button>
              </div>
            </div>
          )}

          {/* Retry */}
          {showRetry && (
            <div className="relative overflow-hidden rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50 to-amber-100/70 p-4 shadow-sm">
              <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-[0_6px_16px_-4px_rgba(245,158,11,0.55)] ring-1 ring-white/20">
                  <AlertCircle className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-bold tracking-tight text-amber-900">Voice check didn't pass</p>
                  <p className="text-[11px] leading-relaxed text-amber-700/90">
                    {error || 'Please try again — speak clearly and at normal volume.'}
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleRetry}
                  className="group inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-[0_6px_18px_-4px_rgba(245,158,11,0.55)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_22px_-4px_rgba(245,158,11,0.65)] active:translate-y-0"
                >
                  <RotateCcw className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-rotate-90" />
                  Retry recording
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoiceCheckPage;