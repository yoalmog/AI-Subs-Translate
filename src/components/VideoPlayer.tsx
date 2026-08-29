import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize2,
  Upload,
  Sparkles,
  Eye,
  EyeOff,
  Settings,
  Layers,
  AlertTriangle,
  RefreshCw,
  Subtitles,
} from "lucide-react";
import { SubtitleCue, SubtitleStyleSettings } from "../types";
import { formatTimeDisplay } from "../utils/timeFormat";
import { renderDemoFrame, DEMO_CONFIGS } from "../utils/demoVideoGenerator";
import { VideoFrameSource } from "../utils/frameSampler";

export interface VideoPlayerRef {
  getVideoElement: () => HTMLVideoElement | null;
  getCanvasElement: () => HTMLCanvasElement | null;
  getSourceHandle: () => VideoFrameSource;
  seekTo: (time: number) => void;
  play: () => void;
  pause: () => void;
}

interface VideoPlayerProps {
  videoUrl: string | null;
  videoName: string;
  cues: SubtitleCue[];
  activeCue: SubtitleCue | null;
  styles: SubtitleStyleSettings;
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  onFileDrop: (file: File) => void;
  onToggleStyles: () => void;
  onStartAnalysis: () => void;
  isAnalyzing: boolean;
  onReloadDemo?: () => void;
}

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  (
    {
      videoUrl,
      videoName,
      cues,
      activeCue,
      styles,
      onTimeUpdate,
      onDurationChange,
      onFileDrop,
      onToggleStyles,
      onStartAnalysis,
      isAnalyzing,
      onReloadDemo,
    },
    ref
  ) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Is this a demo video?
    const isDemo = Boolean(
      videoUrl &&
        (videoUrl.startsWith("demo:") ||
          DEMO_CONFIGS.some((d) => d.id === videoUrl) ||
          videoUrl === "demo-space" ||
          videoUrl === "demo-spanish" ||
          videoUrl === "demo-tech" ||
          videoUrl === "demo-nature")
    );

    const demoId = isDemo
      ? videoUrl?.replace("demo:", "") || "demo-space"
      : "demo-space";

    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [currentTime, setCurrentTime] = useState<number>(0);
    const [duration, setDuration] = useState<number>(10);
    const [volume, setVolume] = useState<number>(1);
    const [isMuted, setIsMuted] = useState<boolean>(false);
    const [playbackRate, setPlaybackRate] = useState<number>(1);
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [showControls, setShowControls] = useState<boolean>(true);
    const [showHebrewSubtitles, setShowHebrewSubtitles] = useState<boolean>(true);
    const [previewOriginal, setPreviewOriginal] = useState<boolean>(false);
    const [videoError, setVideoError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const animationFrameRef = useRef<number | null>(null);
    const lastTimestampRef = useRef<number | null>(null);
    const currentTimeRef = useRef<number>(0);
    const isPlayingRef = useRef<boolean>(false);
    const playbackRateRef = useRef<number>(1);
    const controlsTimeout = useRef<any>(null);

    currentTimeRef.current = currentTime;
    isPlayingRef.current = isPlaying;
    playbackRateRef.current = playbackRate;

    // Reset error when URL changes
    useEffect(() => {
      setVideoError(null);
      if (isDemo) {
        setIsLoading(false);
        setDuration(10);
        onDurationChange(10);
        setCurrentTime(0);
      } else if (videoUrl) {
        setIsLoading(true);
      }
    }, [videoUrl, isDemo, onDurationChange]);

    // Canvas render loop for Demo videos
    const drawDemoCanvas = useCallback(
      (time: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        renderDemoFrame(ctx, demoId, canvas.width, canvas.height, time);
      },
      [demoId]
    );

    // Initial render and redraw on demoId or resize
    useEffect(() => {
      if (isDemo) {
        drawDemoCanvas(currentTimeRef.current);
      }
    }, [isDemo, demoId, drawDemoCanvas]);

    // Animation ticker for demo playback
    useEffect(() => {
      if (!isDemo) return;

      if (isPlaying) {
        lastTimestampRef.current = performance.now();

        const loop = (now: number) => {
          if (!isPlayingRef.current) return;

          const deltaSec = (now - (lastTimestampRef.current || now)) / 1000;
          lastTimestampRef.current = now;

          let newTime = currentTimeRef.current + deltaSec * playbackRateRef.current;
          if (newTime >= 10) {
            newTime = 0; // Loop back
          }

          currentTimeRef.current = newTime;
          setCurrentTime(newTime);
          onTimeUpdate(newTime);
          drawDemoCanvas(newTime);

          animationFrameRef.current = requestAnimationFrame(loop);
        };

        animationFrameRef.current = requestAnimationFrame(loop);
      } else {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        drawDemoCanvas(currentTimeRef.current);
      }

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
      };
    }, [isDemo, isPlaying, onTimeUpdate, drawDemoCanvas]);

    // Seek helper
    const handleSeek = (time: number) => {
      const maxDur = duration > 0 ? duration : 10;
      const clamped = Math.max(0, Math.min(time, maxDur));
      setCurrentTime(clamped);
      currentTimeRef.current = clamped;
      onTimeUpdate(clamped);

      if (isDemo) {
        drawDemoCanvas(clamped);
      } else if (videoRef.current) {
        try {
          videoRef.current.currentTime = clamped;
        } catch (e) {
          // Ignore seek error
        }
      }
    };

    // Forward ref capabilities
    useImperativeHandle(ref, () => ({
      getVideoElement: () => (isDemo ? null : videoRef.current),
      getCanvasElement: () => (isDemo ? canvasRef.current : null),
      getSourceHandle: () => ({
        type: isDemo ? "demo" : "video",
        demoId,
        videoElement: isDemo ? null : videoRef.current,
        duration: duration > 0 ? duration : 10,
      }),
      seekTo: handleSeek,
      play: () => {
        if (isDemo) {
          setIsPlaying(true);
        } else if (videoRef.current && !videoError) {
          videoRef.current.play().catch((err) => {
            console.warn("Video play with audio prevented, trying muted:", err);
            if (videoRef.current) {
              videoRef.current.muted = true;
              setIsMuted(true);
              videoRef.current.play().catch(console.error);
            }
          });
        }
      },
      pause: () => {
        if (isDemo) {
          setIsPlaying(false);
        } else {
          videoRef.current?.pause();
        }
      },
    }));

    // Real HTML5 Video event listeners
    useEffect(() => {
      if (isDemo) return;

      const video = videoRef.current;
      if (!video) return;

      const handlePlay = () => setIsPlaying(true);
      const handlePause = () => setIsPlaying(false);
      const handleTime = () => {
        const cur = video.currentTime || 0;
        setCurrentTime(cur);
        currentTimeRef.current = cur;
        onTimeUpdate(cur);

        // Fallback for duration if initially Infinity
        if (!isFinite(duration) || duration <= 0) {
          if (video.duration && isFinite(video.duration) && video.duration > 0) {
            setDuration(video.duration);
            onDurationChange(video.duration);
          }
        }
      };
      const handleLoadedMeta = () => {
        setIsLoading(false);
        setVideoError(null);
        let dur = video.duration;
        if (dur && isFinite(dur) && dur > 0) {
          setDuration(dur);
          onDurationChange(dur);
        }
      };
      const handleDurationChange = () => {
        let dur = video.duration;
        if (dur && isFinite(dur) && dur > 0) {
          setDuration(dur);
          onDurationChange(dur);
        }
      };
      const handleCanPlay = () => {
        setIsLoading(false);
      };
      const handleEnded = () => setIsPlaying(false);
      const handleError = () => {
        if (!video.src || video.src === "" || video.src === window.location.href) return;
        // Ignore aborted requests during component switching
        if (video.error && video.error.code === 1) return;
        console.warn("HTML5 Video error:", video.error?.message || "Source error", video.src, video.error);
        setIsLoading(false);
        
        let msg = "לא ניתן לטעון את מקור הווידאו. נסה לטעון סרטון דוגמה או להעלות קובץ MP4 / WebM / MOV.";
        if (video.error) {
          if (video.error.code === 3) {
            msg = "שגיאת פענוח קובץ הווידאו. נסה קובץ בפורמט MP4 או WebM סטנדרטי.";
          } else if (video.error.code === 4) {
            msg = "פורמט הקובץ אינו נתמך בדפדפן זה. מומלץ להעלות קובץ MP4 / H.264 או WebM.";
          }
        }
        setVideoError(msg);
      };

      // Ensure load is triggered if source is present
      if (video.src && video.readyState === 0) {
        try {
          video.load();
        } catch (_) {}
      }

      video.addEventListener("play", handlePlay);
      video.addEventListener("pause", handlePause);
      video.addEventListener("timeupdate", handleTime);
      video.addEventListener("loadedmetadata", handleLoadedMeta);
      video.addEventListener("durationchange", handleDurationChange);
      video.addEventListener("canplay", handleCanPlay);
      video.addEventListener("ended", handleEnded);
      video.addEventListener("error", handleError);

      return () => {
        video.removeEventListener("play", handlePlay);
        video.removeEventListener("pause", handlePause);
        video.removeEventListener("timeupdate", handleTime);
        video.removeEventListener("loadedmetadata", handleLoadedMeta);
        video.removeEventListener("durationchange", handleDurationChange);
        video.removeEventListener("canplay", handleCanPlay);
        video.removeEventListener("ended", handleEnded);
        video.removeEventListener("error", handleError);
      };
    }, [isDemo, videoUrl, duration, onTimeUpdate, onDurationChange]);

    // Play/Pause toggle
    const togglePlay = () => {
      if (isDemo) {
        setIsPlaying(!isPlaying);
      } else if (videoRef.current) {
        if (isPlaying) {
          videoRef.current.pause();
        } else {
          videoRef.current.play().catch((err) => {
            console.warn("Play error, trying muted autoplay fallback:", err);
            if (videoRef.current) {
              videoRef.current.muted = true;
              setIsMuted(true);
              videoRef.current.play().catch(console.error);
            }
          });
        }
      }
    };

    // Step +/- 5 seconds
    const stepTime = (delta: number) => {
      handleSeek(currentTime + delta);
    };

    // Toggle mute
    const toggleMute = () => {
      if (!isDemo && videoRef.current) {
        videoRef.current.muted = !isMuted;
      }
      setIsMuted(!isMuted);
    };

    const handleSpeedChange = (rate: number) => {
      setPlaybackRate(rate);
      playbackRateRef.current = rate;
      if (!isDemo && videoRef.current) {
        videoRef.current.playbackRate = rate;
      }
    };

    const toggleFullscreen = () => {
      if (!containerRef.current) return;
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen().catch(console.error);
      } else {
        document.exitFullscreen().catch(console.error);
      }
    };

    // Auto-hide controls
    const handleMouseMove = () => {
      setShowControls(true);
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
      controlsTimeout.current = setTimeout(() => {
        if (isPlaying) {
          setShowControls(false);
        }
      }, 3000);
    };

    // Drag and Drop handlers
    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
    };

    const handleDragLeave = () => {
      setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        onFileDrop(e.dataTransfer.files[0]);
      }
    };

    // Font class
    const subtitleFontClass =
      styles.fontFamily === "Rubik"
        ? "font-rubik"
        : styles.fontFamily === "Assistant"
        ? "font-assistant"
        : styles.fontFamily === "Varela Round"
        ? "font-varela"
        : "font-heebo";

    return (
      <div
        ref={containerRef}
        id="video-player-container"
        onMouseMove={handleMouseMove}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-[#333333] flex items-center justify-center select-none group ${
          isDragging ? "ring-2 ring-blue-500 bg-[#151515]" : ""
        }`}
      >
        {!videoUrl ? (
          /* Empty dropzone state */
          <div className="flex flex-col items-center justify-center text-center p-8 max-w-md">
            <div className="w-16 h-16 rounded-xl bg-[#1a1a1a] border border-[#333333] flex items-center justify-center mb-4 text-blue-400 shadow-lg">
              <Upload className="w-7 h-7 animate-bounce" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">
              גרור ושחרר סרטון לכאן
            </h3>
            <p className="text-xs text-gray-400 mb-6">
              תומך בקבצי MP4, WebM, MOV. נזהה כתוביות מוטמעות (Hardcoded) ונתרגם אותן לעברית!
            </p>
            <div className="flex items-center gap-3">
              <label
                htmlFor="player-file-input"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-md cursor-pointer transition shadow-[0_0_10px_rgba(59,130,246,0.4)]"
              >
                בחר קובץ מהמחשב / נייד
              </label>
              <input
                id="player-file-input"
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    onFileDrop(e.target.files[0]);
                  }
                }}
              />
              {onReloadDemo && (
                <button
                  onClick={onReloadDemo}
                  className="px-3.5 py-2 bg-[#1a1a1a] hover:bg-[#262626] text-gray-300 text-xs font-semibold rounded-md border border-[#333333] transition"
                >
                  טען סרטון דוגמה
                </button>
              )}
            </div>
          </div>
        ) : videoError ? (
          /* Error recovery state */
          <div className="flex flex-col items-center justify-center text-center p-6 max-w-md z-20">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mb-3 border border-amber-500/30">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-white mb-1">שגיאה בטעינת הווידאו</h4>
            <p className="text-xs text-gray-400 mb-4">{videoError}</p>
            <div className="flex items-center flex-wrap justify-center gap-2">
              <button
                onClick={() => {
                  setVideoError(null);
                  setIsLoading(true);
                  if (videoRef.current && videoUrl) {
                    videoRef.current.src = videoUrl;
                    videoRef.current.load();
                  }
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-md transition shadow-md cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>נסה שוב</span>
              </button>
              {onReloadDemo && (
                <button
                  onClick={onReloadDemo}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#222222] hover:bg-[#2c2c2c] text-gray-200 text-xs font-semibold rounded-md transition border border-[#3a3a3a] cursor-pointer"
                >
                  <span>טען סרטון הדגמה</span>
                </button>
              )}
              <label
                htmlFor="player-error-file-input"
                className="px-3.5 py-1.5 bg-[#1a1a1a] hover:bg-[#262626] text-gray-300 text-xs font-semibold rounded-md border border-[#333333] cursor-pointer transition"
              >
                בחר קובץ אחר
              </label>
              <input
                id="player-error-file-input"
                type="file"
                accept="video/mp4,video/webm,video/ogg,video/quicktime,video/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    onFileDrop(e.target.files[0]);
                    e.target.value = "";
                  }
                }}
              />
            </div>
          </div>
        ) : (
          <>
            {/* 1. Video Display: Direct Canvas Engine (Demo) OR HTML5 Video (Uploaded) */}
            {isDemo ? (
              <canvas
                ref={canvasRef}
                width={960}
                height={540}
                onClick={togglePlay}
                className="w-full h-full object-contain cursor-pointer bg-black"
              />
            ) : (
              <video
                key={videoUrl}
                ref={videoRef}
                src={videoUrl || undefined}
                playsInline
                preload="metadata"
                controls={false}
                onClick={togglePlay}
                className="w-full h-full object-contain cursor-pointer"
              />
            )}

            {/* Loading spinner */}
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none z-10">
                <div className="w-10 h-10 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              </div>
            )}

            {/* OVERLAY LAYER 1: Hardcoded Subtitle Cover-up Mask */}
            {styles.hideOriginalSubtitles && !previewOriginal && (activeCue || styles.maskOpacity > 0.5) && (
              <div
                id="subtitle-cover-mask"
                style={{
                  bottom: `${styles.maskBottomPercent}%`,
                  height: `${styles.maskHeightPercent}%`,
                  backgroundColor: styles.maskColor || "#000000",
                  opacity: styles.maskOpacity,
                  backdropFilter: styles.maskBlur ? "blur(8px)" : "none",
                }}
                className="absolute inset-x-0 pointer-events-none transition-all duration-150 z-10"
              />
            )}

            {/* OVERLAY LAYER 2: Hebrew Subtitles Box with Smooth Fade-in/Fade-out Transition */}
            <AnimatePresence mode="wait">
              {showHebrewSubtitles && activeCue && activeCue.hebrewText.trim() && !previewOriginal && (
                <motion.div
                  key={activeCue.id}
                  initial={{ opacity: 0, y: 5, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -3, scale: 0.99 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  id="hebrew-subtitle-overlay"
                  style={{
                    bottom: `${styles.positionBottomPercent}%`,
                    textAlign: styles.align || "center",
                  }}
                  className="absolute inset-x-0 flex justify-center pointer-events-none z-20 px-4"
                >
                  <div
                    style={{
                      backgroundColor:
                        styles.backgroundOpacity > 0
                          ? `rgba(${parseInt(styles.backgroundColor.slice(1, 3), 16) || 0}, ${
                              parseInt(styles.backgroundColor.slice(3, 5), 16) || 0
                            }, ${
                              parseInt(styles.backgroundColor.slice(5, 7), 16) || 0
                            }, ${styles.backgroundOpacity})`
                          : "transparent",
                      color: styles.textColor || "#ffffff",
                      fontSize: `${Math.max(14, styles.fontSize)}px`,
                      padding: `${styles.boxPadding}px ${styles.boxPadding * 2}px`,
                      borderRadius: `${styles.borderRadius}px`,
                      textShadow:
                        styles.strokeWidth > 0
                          ? `-${styles.strokeWidth}px -${styles.strokeWidth}px 0 ${styles.strokeColor}, ${styles.strokeWidth}px -${styles.strokeWidth}px 0 ${styles.strokeColor}, -${styles.strokeWidth}px ${styles.strokeWidth}px 0 ${styles.strokeColor}, ${styles.strokeWidth}px ${styles.strokeWidth}px 0 ${styles.strokeColor}, 0 2px 8px rgba(0,0,0,0.8)`
                          : "0 2px 8px rgba(0,0,0,0.9)",
                      fontWeight: styles.bold ? 700 : 500,
                    }}
                    dir="rtl"
                    className={`inline-block max-w-[90%] transition-all duration-100 ${subtitleFontClass}`}
                  >
                    {activeCue.hebrewText}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* TOP BAR OVERLAY: Mode tag, Video Name, Quick Actions */}
            <div
              className={`absolute top-0 inset-x-0 p-2.5 sm:p-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between gap-2 transition-opacity duration-300 z-30 ${
                showControls ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              <div className="flex items-center gap-2 overflow-hidden min-w-0">
                <span className="h-8 px-2.5 flex items-center justify-center whitespace-nowrap rounded-md text-[11px] font-bold bg-blue-600/90 text-white border border-blue-400/30 shrink-0 shadow-sm">
                  {isDemo ? "סרטון הדגמה" : "קובץ מקומי"}
                </span>
                <span className="text-xs font-medium text-white truncate">
                  {videoName}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Instant toggle Hebrew subtitles button */}
                <button
                  id="toggle-hebrew-subtitles-top-btn"
                  onClick={() => setShowHebrewSubtitles((prev) => !prev)}
                  title={
                    showHebrewSubtitles
                      ? "הסתר כתוביות בעברית (לחץ להסרה מהתצוגה והשוואה למקור)"
                      : "הצג כתוביות בעברית (לחץ להפעלה מחדש)"
                  }
                  className={`h-8 px-2.5 flex items-center justify-center gap-1.5 text-[11px] font-semibold rounded-md border transition cursor-pointer shrink-0 shadow-sm ${
                    showHebrewSubtitles
                      ? "bg-blue-600/90 hover:bg-blue-500 text-white border-blue-400/40"
                      : "bg-red-950/80 hover:bg-red-900/80 text-red-200 border-red-500/40"
                  }`}
                >
                  <Subtitles className="w-3.5 h-3.5" />
                  <span className="whitespace-nowrap">
                    {showHebrewSubtitles ? "כתוביות עברית: פעיל" : "כתוביות עברית: כבוי"}
                  </span>
                </button>

                {/* Hold to preview original subtitle */}
                <button
                  onMouseDown={() => setPreviewOriginal(true)}
                  onMouseUp={() => setPreviewOriginal(false)}
                  onTouchStart={() => setPreviewOriginal(true)}
                  onTouchEnd={() => setPreviewOriginal(false)}
                  title="החזק כדי לראות את הכתובית המקורית המוטמעת (הצג מקור)"
                  className={`h-8 w-8 sm:w-auto sm:px-2.5 flex items-center justify-center gap-1 text-[11px] font-semibold rounded-md border transition cursor-pointer shrink-0 ${
                    previewOriginal
                      ? "bg-amber-600 text-white border-amber-500 shadow-sm"
                      : "bg-[#1f1f1f]/80 hover:bg-[#2c2c2c] text-gray-300 border-[#404040]"
                  }`}
                >
                  {previewOriginal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  <span className="hidden sm:inline whitespace-nowrap">
                    {previewOriginal ? "רואה מקור" : "הצג מקור"}
                  </span>
                </button>

                {/* Cover mask toggle */}
                <button
                  onClick={onToggleStyles}
                  title="הגדרות עיצוב וכיסוי כתוביות"
                  className="h-8 w-8 flex items-center justify-center bg-[#1f1f1f]/80 hover:bg-[#2c2c2c] text-gray-300 hover:text-white rounded-md border border-[#404040] transition cursor-pointer shrink-0"
                >
                  <Layers className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* BIG CENTER PLAY BUTTON when paused */}
            {!isPlaying && !isLoading && (
              <button
                onClick={togglePlay}
                aria-label="נגן"
                className="absolute inset-0 m-auto w-14 h-14 bg-blue-600/90 hover:bg-blue-600 text-white rounded-full flex items-center justify-center shadow-[0_0_25px_rgba(59,130,246,0.6)] transform hover:scale-110 transition duration-150 z-20"
              >
                <Play className="w-7 h-7 fill-white translate-x-0.5" />
              </button>
            )}

            {/* BOTTOM CONTROLS BAR */}
            <div
              className={`absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent flex flex-col gap-2 transition-opacity duration-300 z-30 ${
                showControls ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              {/* Scrubbing Timeline Progress Bar */}
              <div className="relative w-full flex items-center group/timeline py-1 cursor-pointer">
                {/* Visual cue markers on timeline */}
                <div className="absolute inset-x-0 h-1.5 bg-gray-700/80 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                    className="h-full bg-blue-500 rounded-full relative transition-[width] duration-75"
                  />
                </div>

                {/* Subtitle cue markers */}
                {duration > 0 &&
                  cues.map((cue) => {
                    const startPercent = (cue.startTime / duration) * 100;
                    const widthPercent = ((cue.endTime - cue.startTime) / duration) * 100;
                    return (
                      <div
                        key={cue.id}
                        style={{
                          left: `${startPercent}%`,
                          width: `${Math.max(0.5, widthPercent)}%`,
                        }}
                        title={`${cue.originalText} ➔ ${cue.hebrewText}`}
                        className="absolute h-1.5 bg-amber-400/80 rounded-sm pointer-events-none z-10"
                      />
                    );
                  })}

                {/* Native range input */}
                <input
                  type="range"
                  min={0}
                  max={duration || 10}
                  step={0.05}
                  value={currentTime}
                  onChange={(e) => handleSeek(parseFloat(e.target.value))}
                  className="w-full h-3 opacity-0 cursor-pointer z-20"
                />
              </div>

              {/* Action buttons row */}
              <div className="flex items-center justify-between text-xs text-white">
                <div className="flex items-center gap-2">
                  {/* Play / Pause */}
                  <button
                    onClick={togglePlay}
                    className="p-1.5 hover:bg-white/10 rounded-md transition text-white"
                  >
                    {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
                  </button>

                  {/* -5s / +5s */}
                  <button
                    onClick={() => stepTime(-3)}
                    title="3 שניות אחורה"
                    className="p-1 hover:bg-white/10 rounded text-gray-300 hover:text-white transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => stepTime(3)}
                    title="3 שניות קדימה"
                    className="p-1 hover:bg-white/10 rounded text-gray-300 hover:text-white transition"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>

                  {/* Volume / Mute */}
                  {!isDemo && (
                    <button
                      onClick={toggleMute}
                      className="p-1 hover:bg-white/10 rounded text-gray-300 hover:text-white transition"
                    >
                      {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                  )}

                  {/* Time indicator */}
                  <div className="text-[11px] font-mono text-gray-300 flex items-center gap-1 mr-1">
                    <span className="text-white font-semibold">
                      {formatTimeDisplay(currentTime)}
                    </span>
                    <span className="text-gray-500">/</span>
                    <span>{formatTimeDisplay(duration)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Instant Subtitle Visibility Toggle Button */}
                  <button
                    id="toggle-subtitles-bottom-btn"
                    onClick={() => setShowHebrewSubtitles((prev) => !prev)}
                    title={
                      showHebrewSubtitles
                        ? "הסתר כתוביות חדשות בעברית במהלך ניגון"
                        : "הצג כתוביות חדשות בעברית"
                    }
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border transition ${
                      showHebrewSubtitles
                        ? "bg-blue-600/30 text-blue-300 border-blue-500/40 hover:bg-blue-600/50"
                        : "bg-[#1e1e1e] text-gray-400 border-[#333] hover:text-white"
                    }`}
                  >
                    <Subtitles className="w-3.5 h-3.5" />
                    <span>עברית {showHebrewSubtitles ? "ON" : "OFF"}</span>
                  </button>

                  {/* Playback speed selector */}
                  <div className="flex items-center bg-[#1e1e1e] rounded border border-[#333] px-1 py-0.5">
                    {[0.75, 1, 1.25, 1.5].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => handleSpeedChange(rate)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition ${
                          playbackRate === rate
                            ? "bg-blue-600 text-white font-bold"
                            : "text-gray-400 hover:text-gray-200"
                        }`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>

                  {/* Fullscreen */}
                  <button
                    onClick={toggleFullscreen}
                    className="p-1 hover:bg-white/10 rounded text-gray-300 hover:text-white transition"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }
);
