import React, { forwardRef, memo } from 'react';
import { AlertCircle, Camera, ShieldCheck, Video, VideoOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CameraTileSize = 'sm' | 'md' | 'lg';

export interface CameraTileProps {
  /** Whether the camera capture is currently active. */
  isCameraActive: boolean;
  /** Last camera error message — when present the error overlay is shown. */
  cameraError: string;
  /** When true, the video tile gets a rose ring (proctoring alert). */
  cameraBoxAlert: boolean;
  /** Whether AI proctoring is up (drives the "Live" pill). */
  isProctoringActive: boolean;
  /** Current tile size selection (drives the segmented S/M/L control). */
  cameraSize: CameraTileSize;
  onCameraSizeChange: (size: CameraTileSize) => void;
  /** Toggle the camera off/on (used by both overlays). */
  onToggleCamera: () => void;
}

const SIZES: readonly CameraTileSize[] = ['sm', 'md', 'lg'] as const;

/**
 * Self-contained "You" tile rendered in the left panel of the interview room.
 * The parent owns the camera stream / ref, this component just renders the
 * video element + overlays + size toggle.
 */
const CameraTileImpl = forwardRef<HTMLVideoElement, CameraTileProps>(
  (
    {
      isCameraActive,
      cameraError,
      cameraBoxAlert,
      isProctoringActive,
      cameraSize,
      onCameraSizeChange,
      onToggleCamera,
    },
    videoRef,
  ) => (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/85 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_38px_-22px_rgba(61,7,95,0.30)] backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-slate-200/60 bg-gradient-to-r from-white via-white to-violet-50/40 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-brand-purple via-brand-purple to-brand-violet text-white shadow-[0_4px_12px_-2px_rgba(124,58,237,0.45)] ring-1 ring-white/20">
            <Camera className="h-3 w-3" />
          </span>
          <h3 className="text-xs font-bold tracking-tight text-slate-900">You</h3>
        </div>
        <div className="flex items-center gap-0.5 rounded-full bg-slate-100/80 p-0.5">
          {SIZES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onCameraSizeChange(s)}
              title={`${s.toUpperCase()} size`}
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide transition-all',
                cameraSize === s ? 'bg-white text-brand-violet shadow-sm' : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className={cn('relative aspect-video overflow-hidden bg-slate-900', cameraBoxAlert && 'ring-2 ring-rose-500 ring-inset')}>
        <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-slate-950/60 via-slate-950/20 to-transparent" />

        {/* Live pill overlay */}
        <span
          className={cn(
            'absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ring-1 ring-inset backdrop-blur',
            isProctoringActive ? 'bg-emerald-500/80 text-white ring-white/30' : 'bg-rose-500/80 text-white ring-white/30',
          )}
        >
          {isProctoringActive ? (
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-white opacity-80" />
              <span className="relative h-full w-full rounded-full bg-white" />
            </span>
          ) : (
            <ShieldCheck className="h-2.5 w-2.5" />
          )}
          {isProctoringActive ? 'Live' : 'Off'}
        </span>

        {!isCameraActive && !cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/85 text-center backdrop-blur-sm">
            <VideoOff className="mb-2 h-7 w-7 text-white/60" />
            <p className="mb-2 text-[11px] text-white/70">Camera is off</p>
            <button
              type="button"
              onClick={onToggleCamera}
              className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-900 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              Turn camera on
            </button>
          </div>
        )}
        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 px-3 text-center backdrop-blur-sm">
            <AlertCircle className="mb-1 h-7 w-7 text-rose-400" />
            <p className="text-xs font-semibold text-white">Camera error</p>
            <p className="mb-2 text-[10px] text-white/70">{cameraError}</p>
            <button
              type="button"
              onClick={onToggleCamera}
              className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-900 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <Video className="h-3 w-3" /> Retry
            </button>
          </div>
        )}
      </div>
    </div>
  ),
);
CameraTileImpl.displayName = 'CameraTile';

export const CameraTile = memo(CameraTileImpl);
