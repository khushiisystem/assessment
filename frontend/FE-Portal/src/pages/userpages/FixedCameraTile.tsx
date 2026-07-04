import React, { useCallback, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Video, VideoOff, Minus, Maximize2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface FixedCameraTileProps {
  cameraStream: MediaStream | null
  isProctoringActive?: boolean
}

/**
 * Fixed bottom-right camera tile — replaces the legacy DraggableCamera.
 * Dragging was the source of off-screen positioning bugs and visual clutter;
 * a pinned, premium-styled tile matches LeetCode/HackerRank conventions and
 * keeps the candidate's attention on the question.
 */
const FixedCameraTile: React.FC<FixedCameraTileProps> = ({ cameraStream, isProctoringActive = true }) => {
  const videoElRef = useRef<HTMLVideoElement | null>(null)
  const [minimized, setMinimized] = useState(false)
  const [videoReady, setVideoReady] = useState(false)

  // Callback ref so we bind the stream as soon as the <video> mounts,
  // not on the next render cycle. AnimatePresence(mode="wait") only
  // mounts the maximised branch AFTER the minimised branch finishes
  // its exit animation — so a useEffect tied to `minimized` fires
  // before the new element exists and `videoRef.current` is null at
  // that point, leaving the candidate stuck on "Connecting…" forever.
  // React calls a callback ref with the element on mount and with null
  // on unmount, which sidesteps the timing problem entirely.
  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    videoElRef.current = el
    if (!el) return
    if (!cameraStream) return

    el.srcObject = cameraStream
    setVideoReady(false)
    const onPlaying = () => setVideoReady(true)
    const tryPlay = () => {
      el.play().catch((err) => console.warn("[camera] autoplay blocked:", err))
    }
    el.addEventListener("playing", onPlaying, { once: true })
    if (el.readyState >= 2) tryPlay()
    else el.addEventListener("loadedmetadata", tryPlay, { once: true })
  }, [cameraStream])

  return (
    <motion.div
      layout
      initial={false}
      animate={{ width: minimized ? 56 : 200, height: minimized ? 56 : 156 }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
      className="fixed bottom-20 right-4 z-40 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_18px_40px_-12px_rgba(15,23,42,0.35)]"
    >
      {/* brand ribbon */}
      <span aria-hidden className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-brand-purple via-brand-violet to-brand-purple z-10" />

      <AnimatePresence mode="wait">
        {minimized ? (
          <motion.button
            key="mini"
            type="button"
            onClick={() => setMinimized(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            title="Show camera"
            className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-brand-purple to-brand-violet text-white hover:opacity-95"
          >
            <Video className="h-4 w-4" />
            <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-emerald-300 ring-2 ring-white/40 animate-pulse" />
          </motion.button>
        ) : (
          <motion.div
            key="full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="flex h-full w-full flex-col"
          >
            {/* header */}
            <div className="flex shrink-0 items-center justify-between gap-1 px-2 pt-2 pb-1">
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  isProctoringActive && videoReady ? "bg-emerald-500 animate-pulse" : "bg-rose-500",
                )} />
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-700">
                  {isProctoringActive && videoReady ? "Live" : "Off"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMinimized(true)}
                title="Minimize"
                className="inline-flex h-5 w-5 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <Minus className="h-3 w-3" />
              </button>
            </div>

            {/* video */}
            <div className="relative flex-1 overflow-hidden rounded-md bg-slate-900 mx-2 mb-2">
              <video
                ref={attachVideo}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
                style={{ transform: "scaleX(-1)" }}
              />
              {!videoReady && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-slate-900 text-slate-300">
                  {cameraStream ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                        className="h-4 w-4 rounded-full border-2 border-slate-600 border-t-brand-violet"
                      />
                      <span className="text-[10px] font-medium">Connecting…</span>
                    </>
                  ) : (
                    <>
                      <VideoOff className="h-4 w-4" />
                      <span className="text-[10px] font-medium">No camera</span>
                    </>
                  )}
                </div>
              )}
              {/* corner REC pill */}
              {videoReady && (
                <div className="absolute left-1.5 bottom-1.5 inline-flex items-center gap-1 rounded-full bg-rose-600/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow">
                  <span className="h-1 w-1 rounded-full bg-white animate-pulse" /> Rec
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default FixedCameraTile
