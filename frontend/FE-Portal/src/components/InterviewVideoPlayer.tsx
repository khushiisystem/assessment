import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Maximize2, Minimize2, Download, Loader2, BookOpen
} from "lucide-react";

interface QuestionChapter {
  question_number: number;
  question_text: string;
  timestamp_seconds?: number;
}

interface InterviewVideoPlayerProps {
  src: string;
  candidateName?: string;
  questions?: QuestionChapter[];
  onDownload?: () => void;
  isDownloading?: boolean;
  accentColor?: "blue" | "green";
  jumpToTime?: number | null;
  onJumpComplete?: () => void;
  initialDuration?: number;
}

function fmt(s: number): string {
  if (!isFinite(s) || s < 0 || isNaN(s)) return "--:--";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

const InterviewVideoPlayer: React.FC<InterviewVideoPlayerProps> = ({
  src,
  candidateName,
  questions = [],
  onDownload,
  isDownloading = false,
  accentColor = "blue",
  jumpToTime,
  onJumpComplete,
  initialDuration,
}) => {
  if (!src) return null;

  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  // ✅ containerRef ab poore player pe lagega, sirf video div pe nahi
  const containerRef = useRef<HTMLDivElement>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration ?? 0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(2);
  const [fullscreen, setFullscreen] = useState(false);
  const [buffered, setBuffered] = useState(0);
  const [activeChapter, setActiveChapter] = useState<number | null>(null);
  const [showChapters, setShowChapters] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);
  const [isVideoLoading, setIsVideoLoading] = useState(false);

  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
  const chapters = questions.filter(q => typeof q.timestamp_seconds === "number");

  const accentRing = accentColor === "green" ? "#22c55e" : "#3b82f6";
  const accentTextClass = accentColor === "green" ? "text-green-600" : "text-blue-600";
  const accentBorderClass = accentColor === "green" ? "border-green-200" : "border-blue-200";
  const accentBgClass = accentColor === "green" ? "bg-green-600" : "bg-blue-600";
  const accentHeaderBg = accentColor === "green" ? "bg-green-50" : "bg-blue-50";
  const accentHeaderText = accentColor === "green" ? "text-green-700" : "text-blue-700";

  const onTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setCurrentTime(v.currentTime);
    if (v.buffered.length > 0) {
      setBuffered(v.buffered.end(v.buffered.length - 1));
    }
    if (chapters.length > 0) {
      let active: number | null = null;
      for (let i = chapters.length - 1; i >= 0; i--) {
        if (v.currentTime >= (chapters[i].timestamp_seconds ?? 0)) {
          active = chapters[i].question_number;
          break;
        }
      }
      setActiveChapter(active);
    }
  }, [chapters]);

  const onEnded = useCallback(() => setPlaying(false), []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    v.addEventListener("timeupdate", onTimeUpdate);
    v.addEventListener("ended", onEnded);

  // ✅ Main video se directly try karo — fastest path
    const onMainDuration = () => {
      const d = v.duration;
      if (d && isFinite(d) && d > 0) setDuration(d);
    };
    v.addEventListener("durationchange", onMainDuration);
    v.addEventListener("loadedmetadata", onMainDuration);

  // ✅ Ghost fallback — WebM ke liye
    const ghost = document.createElement("video");
    ghost.preload = "metadata";
    ghost.muted = true;
    ghost.style.cssText = "display:none;position:absolute;";
    document.body.appendChild(ghost);
    ghost.src = src;

    let trickDone = false;

    const trySetDuration = () => {
      if (trickDone) return;
      const d = ghost.duration;
      if (d && isFinite(d) && d > 0) {
        trickDone = true;
        setDuration(d);
        cleanup();
      }
    };

    const onGhostMeta = () => {
      const d = ghost.duration;
      if (d && isFinite(d) && d > 0) {
        trickDone = true;
        setDuration(d);
        cleanup();
      } else {
      // WebM Infinity trick
        ghost.currentTime = 1e101;
      }
    };

    const cleanup = () => {
      ghost.removeEventListener("loadedmetadata", onGhostMeta);
      ghost.removeEventListener("durationchange", trySetDuration);
      ghost.removeEventListener("seeked", trySetDuration);
      ghost.src = "";
      if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
    };

    ghost.addEventListener("loadedmetadata", onGhostMeta);
    ghost.addEventListener("durationchange", trySetDuration);
    ghost.addEventListener("seeked", trySetDuration);

    return () => {
      v.removeEventListener("timeupdate", onTimeUpdate);
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("durationchange", onMainDuration);
      v.removeEventListener("loadedmetadata", onMainDuration);
      cleanup();
    };
  }, [src, onTimeUpdate, onEnded]);

  // Jump to timestamp
  useEffect(() => {
    if (jumpToTime === null || jumpToTime === undefined) return;
    const v = videoRef.current;
    if (!v) return;

    const doJump = () => {
      v.currentTime = jumpToTime;
      setCurrentTime(jumpToTime);
      v.play().catch(() => {});
      setPlaying(true);
      onJumpComplete?.();
    };

    if (v.readyState >= 2) {
      doJump();
    } else {
      const onReady = () => {
        doJump();
        v.removeEventListener("loadeddata", onReady);
        v.removeEventListener("canplay", onReady);
      };
      v.addEventListener("loadeddata", onReady);
      v.addEventListener("canplay", onReady);
      v.load();
    }
  }, [jumpToTime]);

  useEffect(() => {
    if (fullscreen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [fullscreen]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  };

  const skip = (sec: number) => {
    const v = videoRef.current;
    if (!v) return;
    const newTime = Math.max(0, v.currentTime + sec);
    v.currentTime = newTime;
    setCurrentTime(newTime);
  };
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const rect = progressRef.current!.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const v = videoRef.current;
    if (!v || !duration) return;
    
    try {
      const target = Math.max(0, Math.min(1, pct)) * duration;
      if (v.seeking) {
        setTimeout(() => { v.currentTime = target; }, 100);
      } else {
        v.currentTime = target;
      }
      setCurrentTime(target);
    } catch (err) {
      console.error("Error seeking:", err);
    }
  };

  const handleProgressHover = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = progressRef.current!.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    setHoverTime(Math.max(0, Math.min(1, pct)) * duration);
    setHoverX(e.clientX - rect.left);
  };

  const cycleSpeed = () => {
    const next = (speedIdx + 1) % speeds.length;
    setSpeedIdx(next);
    if (videoRef.current) videoRef.current.playbackRate = speeds[next];
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !muted;
    setMuted(!muted);
  };

  const changeVolume = (val: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = val;
    setVolume(val);
    if (val === 0) { v.muted = true; setMuted(true); }
    else { v.muted = false; setMuted(false); }
  };

  const jumpToChapter = (ts: number) => {
    const v = videoRef.current;
    if (!v) return;
    
    try {
      if (v.seeking) {
        setTimeout(() => {
          v.currentTime = ts;
          setCurrentTime(ts);
          if (v.paused) { v.play(); setPlaying(true); }
        }, 100);
      } else {
        v.currentTime = ts;
        setCurrentTime(ts);
        if (v.paused) { v.play(); setPlaying(true); }
      }
    } catch (err) {
      console.error("Error jumping to chapter:", err);
    }
    
    setShowChapters(false);
  };

  const toggleFullscreen = () => {
    setFullscreen(f => !f);
  };

  useEffect(() => {
    if (!fullscreen) return;

    window.history.pushState({ fullscreenVideo: true }, "");

    const handlePopState = () => {
     
      setFullscreen(false);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [fullscreen]);

  const safeDuration = isFinite(duration) && duration > 0 ? duration : 0;
  const progress = safeDuration ? Math.min((currentTime / safeDuration) * 100, 100) : 0;
  const bufferedPct = safeDuration ? (buffered / safeDuration) * 100 : 0;

  return (
  
    <div
      ref={containerRef}
      className={`bg-white ${
        fullscreen
          ? "fixed inset-0 z-[9999] flex flex-col rounded-none border-none"
          : "rounded-xl overflow-hidden border border-gray-200 shadow-sm"
      }`}
    >

      
      <div className={`relative bg-black ${fullscreen ? "flex-1 overflow-hidden" : ""}`}>
        <video
          ref={videoRef}
          
          className={`block cursor-pointer ${
            fullscreen
              ? "w-full h-full object-contain"
              : "w-full h-auto max-h-96"
          }`}
          preload="auto"
          src={src}
          onClick={togglePlay}
          onLoadedMetadata={(e) => {
            const d = (e.target as HTMLVideoElement).duration;
            if (d && isFinite(d) && d > 0) setDuration(d);
          }}
          onDurationChange={(e) => {
            const d = (e.target as HTMLVideoElement).duration;
            if (d && isFinite(d) && d > 0) setDuration(d);
          }}
          onWaiting={() => setIsVideoLoading(true)}
          onCanPlay={() => setIsVideoLoading(false)}
          onPlaying={() => setIsVideoLoading(false)}
        />

        {isVideoLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-12 h-12 text-white animate-spin drop-shadow-lg" />
          </div>
        )}

        {!playing && !isVideoLoading && (
          <div
            className="absolute inset-0 flex items-center justify-center cursor-pointer"
            onClick={togglePlay}
          >
            <div className="bg-black/40 rounded-full p-4 border border-white/20 hover:bg-black/60 transition-all">
              <Play className="w-10 h-10 text-white fill-white" />
            </div>
          </div>
        )}

        <div className="absolute top-3 right-3 bg-black/60 text-white text-sm font-mono px-3 py-1.5 rounded-full select-none">
          {fmt(currentTime)} / {duration > 0 ? fmt(duration) : "--:--"}
        </div>

        {activeChapter !== null && (
          <div className="absolute top-3 left-3 bg-black/60 text-white text-sm px-3 py-1.5 rounded-full max-w-xs truncate">
            Q{activeChapter}
          </div>
        )}

        
        {fullscreen && (
          <button
            onClick={toggleFullscreen}
            className="absolute top-3 right-36 bg-black/60 text-white text-sm font-semibold px-4 py-1.5 rounded-full hover:bg-black/80 transition-colors"
          >
            ✕ Exit Fullscreen
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className={`px-3 pt-3 pb-1 ${fullscreen ? "bg-white" : ""}`}>
        <div className="flex justify-between text-xs font-mono text-gray-400 mb-1.5 select-none">
          <span>{fmt(currentTime)}</span>
          <span>{fmt(duration)}</span>
        </div>

        <div
          ref={progressRef}
          className="relative h-3 rounded-full cursor-pointer"
          style={{ background: "#e5e7eb" }}
          onClick={handleProgressClick}
          onMouseMove={handleProgressHover}
          onMouseLeave={() => setHoverTime(null)}
        >
          <div
            className="absolute top-0 left-0 h-full rounded-full"
            style={{ width: `${bufferedPct}%`, background: "#d1d5db" }}
          />
          <div
            className="absolute top-0 left-0 h-full rounded-full"
            style={{ width: `${progress}%`, background: accentRing }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow-md"
            style={{ left: `calc(${progress}% - 8px)`, background: accentRing }}
          />
          {chapters.map(ch => {
            const pct = duration > 0 ? ((ch.timestamp_seconds ?? 0) / duration) * 100 : 0;
            return (
              <div
                key={ch.question_number}
                title={`Q${ch.question_number}: ${ch.question_text.substring(0, 60)}`}
                className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-white cursor-pointer z-10 hover:scale-150 transition-transform"
                style={{ left: `calc(${pct}% - 5px)`, background: "#f59e0b" }}
                onClick={e => { e.stopPropagation(); jumpToChapter(ch.timestamp_seconds ?? 0); }}
              />
            );
          })}
          {hoverTime !== null && (
            <div
              className="absolute -top-8 bg-gray-900 text-white text-xs px-2 py-0.5 rounded pointer-events-none font-mono"
              style={{ left: hoverX, transform: "translateX(-50%)" }}
            >
              {fmt(hoverTime)}
            </div>
          )}
        </div>
      </div>

      
      <div className={`px-3 pt-2 pb-1 flex items-center gap-1 ${fullscreen ? "bg-white border-t border-gray-100" : ""}`}>
        <button onClick={togglePlay} className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-700">
          {playing ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
        </button>
        
        <button onClick={() => skip(-10)} title="Back 10s" className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-700 flex items-center gap-0.5 text-xs font-medium">
          <SkipBack className="w-4 h-4" />10s
        </button>
       
        <button onClick={() => skip(10)} title="Forward 10s" className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-700 flex items-center gap-0.5 text-xs font-medium">
          10s<SkipForward className="w-4 h-4" />
        </button>
        
        <button onClick={cycleSpeed} className="px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold min-w-[38px] text-center">
          {speeds[speedIdx]}×
        </button>
      
        <button onClick={toggleMute} className="p-2 rounded-lg hover:bg-gray-100 text-gray-700">
          {muted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume} onChange={e => changeVolume(Number(e.target.value))} className="w-20" />

        <div className="flex-1" />
        <button
          onClick={toggleFullscreen}
          title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-700 transition-colors"
        >
          {fullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
        </button>
      </div>
      {(chapters.length > 0 || onDownload) && (
        <div className={`px-3 pb-2 flex items-center gap-2 border-t border-gray-100 pt-2 ${fullscreen ? "bg-white" : ""}`}>
          {chapters.length > 0 && (
            <button
              onClick={() => setShowChapters(s => !s)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border transition-colors ${showChapters ? `${accentBgClass} text-white border-transparent` : `bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100`}`}
            >
            <BookOpen className="w-3.5 h-3.5" />Chapters
            </button>
          )}

          {onDownload && (
          <button onClick={onDownload} disabled={isDownloading} className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border transition-colors ${accentTextClass} ${accentBorderClass} bg-white hover:bg-gray-50 disabled:opacity-50`}>
              {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {isDownloading ? "Downloading..." : "Download"}
            </button>
          )}
        </div>
      )}

      {/* Chapters Panel */}
      {showChapters && chapters.length > 0 && (
        <div className={`border-t border-gray-100 bg-gray-50 px-3 py-2 max-h-52 overflow-y-auto ${fullscreen ? "bg-white" : ""}`}>
          <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Question chapters</p>
          <div className="space-y-1">
            {chapters.map(ch => {
              const isActive = activeChapter === ch.question_number;
              return (
                <button
                  key={ch.question_number}
                  onClick={() => jumpToChapter(ch.timestamp_seconds ?? 0)}
                  className={`w-full flex items-center gap-3 px-2 py-1.5 rounded-lg text-left text-sm transition-colors ${isActive ? `${accentHeaderBg} ${accentHeaderText} font-medium` : "hover:bg-white text-gray-700"}`}
                >
                  <span className="text-xs font-mono shrink-0 px-1.5 py-0.5 rounded" style={{ background: isActive ? accentRing : "#e5e7eb", color: isActive ? "#fff" : "#6b7280" }}>
                    {fmt(ch.timestamp_seconds ?? 0)}
                  </span>
                  <span className="truncate">Q{ch.question_number}: {ch.question_text.substring(0, 80)}{ch.question_text.length > 80 ? "…" : ""}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default InterviewVideoPlayer;