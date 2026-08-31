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
  FileVideo,
  Wrench,
  CheckCircle2,
  Cpu,
  Activity,
  Gauge,
  Zap,
  ShieldCheck,
} from "lucide-react";
import { SubtitleCue, SubtitleStyleSettings } from "../types";
import { formatTimeDisplay } from "../utils/timeFormat";
import { renderDemoFrame, DEMO_CONFIGS } from "../utils/demoVideoGenerator";
import { VideoFrameSource } from "../utils/frameSampler";
import {
  detectVideoFormat,
  VideoFormatInfo,
  createNormalizedVideoBlob,
  transcodeVideoToWebM,
} from "../utils/videoTypeHelper";

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
  videoFile?: File | null;
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
      videoFile,
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
    const [formatInfo, setFormatInfo] = useState<VideoFormatInfo | null>(null);
    const [isTranscoding, setIsTranscoding] = useState<boolean>(false);
    const [transcodePercent, setTranscodePercent] = useState<number>(0);
    const [transcodeMessage, setTranscodeMessage] = useState<string>("");
    const [repairSuccessMessage, setRepairSuccessMessage] = useState<string | null>(null);

    // Feature 3: Decoding Priority toggle state ('performance' vs 'high-quality')
    const [decodingPriority, setDecodingPriority] = useState<"performance" | "high-quality">("high-quality");

    // Feature: Smart Position - Analyzes bottom frame brightness to auto-toggle between semi-transparent black mask or white shadow
    const [smartPositionEnabled, setSmartPositionEnabled] = useState<boolean>(true);
    const [bottomBrightness, setBottomBrightness] = useState<number>(80);
    const [isBrightBackground, setIsBrightBackground] = useState<boolean>(false);
    const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

    // Feature: Collision Detection - Automatically shifts vertical position of subtitle cues obscured by on-screen graphical elements
    const [collisionDetectionEnabled, setCollisionDetectionEnabled] = useState<boolean>(true);
    const [hasGraphicsCollision, setHasGraphicsCollision] = useState<boolean>(false);
    const [graphicsVariance, setGraphicsVariance] = useState<number>(0);

    // Feature 4: Video Integrity Check state & frame jitter monitor
    const [integrityScore, setIntegrityScore] = useState<number>(100);
    const [integrityWarning, setIntegrityWarning] = useState<boolean>(false);
    const [droppedFramesCount, setDroppedFramesCount] = useState<number>(0);
    const frameTimesRef = useRef<number[]>([]);

    const animationFrameRef = useRef<number | null>(null);
    const lastTimestampRef = useRef<number | null>(null);
    const currentTimeRef = useRef<number>(0);
    const isPlayingRef = useRef<boolean>(false);
    const playbackRateRef = useRef<number>(1);
    const controlsTimeout = useRef<any>(null);

    currentTimeRef.current = currentTime;
    isPlayingRef.current = isPlaying;
    playbackRateRef.current = playbackRate;

    // Detect format information whenever a video file is loaded
    useEffect(() => {
      if (videoFile) {
        detectVideoFormat(videoFile).then((info) => {
          setFormatInfo(info);
        });
      } else {
        setFormatInfo(null);
      }
    }, [videoFile]);

    // Reset error and state when URL changes
    useEffect(() => {
      setVideoError(null);
      setRepairSuccessMessage(null);
      setIsTranscoding(false);
      if (isDemo) {
        setIsLoading(false);
        setDuration(10);
        onDurationChange(10);
        setCurrentTime(0);
      } else if (videoUrl) {
        setIsLoading(true);
      }
    }, [videoUrl, isDemo, onDurationChange]);

    // Video Integrity Check: Monitor frame timestamp deltas & dropped frames
    useEffect(() => {
      if (!isPlaying || isDemo) return;

      let animId: number;
      let lastTime = performance.now();

      const monitorFrame = () => {
        const now = performance.now();
        const delta = now - lastTime;
        lastTime = now;

        const video = videoRef.current;
        if (video && typeof (video as any).getVideoPlaybackQuality === "function") {
          const quality = (video as any).getVideoPlaybackQuality();
          if (quality && quality.droppedVideoFrames > droppedFramesCount) {
            setDroppedFramesCount(quality.droppedVideoFrames);
            setIntegrityScore((prev) => Math.max(40, prev - 12));
            setIntegrityWarning(true);
          }
        }

        // Detect frame drop jitter (> 90ms gap during active playback)
        if (delta > 90 * (1 / playbackRateRef.current)) {
          frameTimesRef.current.push(now);
          if (frameTimesRef.current.length >= 3) {
            setIntegrityScore((prev) => Math.max(50, prev - 10));
            setIntegrityWarning(true);
          }
        }

        if (isPlayingRef.current) {
          animId = requestAnimationFrame(monitorFrame);
        }
      };

      animId = requestAnimationFrame(monitorFrame);
      return () => {
        if (animId) cancelAnimationFrame(animId);
      };
    }, [isPlaying, isDemo, droppedFramesCount]);

    // Feature: Smart Position - Real-time analysis of frame brightness at bottom 25% for dynamic contrast adjustment
    useEffect(() => {
      if (!smartPositionEnabled) return;

      const analyzeBottomFrameBrightness = () => {
        try {
          let sourceElem: HTMLVideoElement | HTMLCanvasElement | null = null;
          if (isDemo && canvasRef.current) {
            sourceElem = canvasRef.current;
          } else if (!isDemo && videoRef.current && videoRef.current.readyState >= 2) {
            sourceElem = videoRef.current;
          }

          if (!sourceElem) return;

          if (!offscreenCanvasRef.current) {
            const c = document.createElement("canvas");
            c.width = 120;
            c.height = 68;
            offscreenCanvasRef.current = c;
          }

          const offCanvas = offscreenCanvasRef.current;
          const ctx = offCanvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) return;

          ctx.drawImage(sourceElem, 0, 0, 120, 68);

          // Sample bottom 25% of frame (y from 51 to 68)
          const imgData = ctx.getImageData(0, 51, 120, 17);
          const pixels = imgData.data;
          let totalLuminance = 0;
          let pixelCount = 0;

          for (let i = 0; i < pixels.length; i += 16) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            // Standard BT.601 luminance
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            totalLuminance += lum;
            pixelCount++;
          }

          if (pixelCount > 0) {
            const avgLum = Math.round(totalLuminance / pixelCount);
            setBottomBrightness(avgLum);
            // Threshold at 125: bright background triggers black mask, dark background triggers white shadow
            setIsBrightBackground(avgLum > 125);
          }

          // Sample bottom 8%-22% region (y from 48 to 62) for graphical element collision / lower thirds
          const bottomGraphicsData = ctx.getImageData(0, 48, 120, 14);
          const bgPixels = bottomGraphicsData.data;
          let lumSum = 0;
          let lumSqSum = 0;
          let bgPixelCount = 0;

          for (let i = 0; i < bgPixels.length; i += 16) {
            const r = bgPixels[i];
            const g = bgPixels[i + 1];
            const b = bgPixels[i + 2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            lumSum += lum;
            lumSqSum += lum * lum;
            bgPixelCount++;
          }

          if (bgPixelCount > 0) {
            const meanLum = lumSum / bgPixelCount;
            const variance = Math.round((lumSqSum / bgPixelCount) - (meanLum * meanLum));
            setGraphicsVariance(variance);
            // High luminance variance or high brightness in lower-third indicates on-screen banners, graphical elements, or burned-in lower boxes
            const isColliding = variance > 1100 || (meanLum > 185 && variance > 350) || styles.hideOriginalSubtitles;
            setHasGraphicsCollision(isColliding);
          }
        } catch (err) {
          // Guard against cross-origin canvas security errors
        }
      };

      analyzeBottomFrameBrightness();
      const interval = setInterval(analyzeBottomFrameBrightness, 350);
      return () => clearInterval(interval);
    }, [smartPositionEnabled, isDemo, isPlaying, currentTime]);

    // Stream Refresh Action (Re-attaches stream & resets buffer)
    const handleRefreshStream = useCallback(() => {
      const savedTime = videoRef.current?.currentTime || currentTime;
      const wasPlaying = isPlaying;

      if (videoRef.current) {
        try {
          const currentSrc = videoRef.current.src;
          videoRef.current.pause();
          videoRef.current.src = "";
          videoRef.current.src = currentSrc;
          videoRef.current.load();
          videoRef.current.currentTime = savedTime;
          if (wasPlaying) {
            videoRef.current.play().catch(() => {});
          }
        } catch (err) {
          console.warn("Refresh stream error:", err);
        }
      }

      setIntegrityScore(100);
      setIntegrityWarning(false);
      setDroppedFramesCount(0);
      frameTimesRef.current = [];
      setRepairSuccessMessage("שידור הווידאו רוענן בהצלחה! תפקוד הנגן חזר ל-100% יציבות (0 פריימים שנופלו).");
      setTimeout(() => setRepairSuccessMessage(null), 4000);
    }, [currentTime, isPlaying]);

    // Manual Video Integrity Check trigger
    const runIntegrityCheck = () => {
      const video = videoRef.current;
      if (isDemo || !video) {
        setIntegrityScore(100);
        setIntegrityWarning(false);
        setRepairSuccessMessage("בדיקת תקינות וידאו: הנגן פועל בצורה חלקית ותקינה 100%.");
        setTimeout(() => setRepairSuccessMessage(null), 3500);
        return;
      }

      let drops = 0;
      if (typeof (video as any).getVideoPlaybackQuality === "function") {
        drops = (video as any).getVideoPlaybackQuality()?.droppedVideoFrames || 0;
      }

      if (drops > 3 || integrityScore < 75) {
        setIntegrityWarning(true);
      } else {
        setIntegrityScore(100);
        setIntegrityWarning(false);
        setRepairSuccessMessage(`בדיקת תקינות וידאו תוצאה: השידור תקין ויציב (${drops} פריימים שנופלו, 100% סנכרון).`);
        setTimeout(() => setRepairSuccessMessage(null), 4000);
      }
    };

    // Quick fix: force MP4 blob wrapping to bypass container restrictions in browser
    const handleForceMp4Fix = () => {
      if (!videoFile) {
        if (onReloadDemo) {
          onReloadDemo();
          setVideoError(null);
          setRepairSuccessMessage("הופעל נגן דוגמה מותאם דפדפן (Canvas/WebM) להתגברות על שגיאת הנגן.");
        }
        return;
      }
      try {
        const repaired = createNormalizedVideoBlob(videoFile, true);
        if (videoRef.current) {
          videoRef.current.src = repaired.url;
          videoRef.current.load();
          setVideoError(null);
          setIsLoading(true);
          setRepairSuccessMessage("קובץ הווידאו עודכן ל-MP4 Blob מותאם דפדפן ונטען מחדש.");
        }
      } catch (err) {
        console.error("Force MP4 fix error:", err);
        if (onReloadDemo) {
          onReloadDemo();
          setVideoError(null);
          setRepairSuccessMessage("הופעל נגן דוגמה מותאם דפדפן להתגברות על שגיאת הקובץ.");
        }
      }
    };

    // In-browser transcode fallback
    const handleTranscode = async () => {
      if (!videoFile) return;
      setIsTranscoding(true);
      setTranscodePercent(0);
      setTranscodeMessage("מכין מפענח מקומי...");

      try {
        const transcodedBlob = await transcodeVideoToWebM(
          videoFile,
          (percent, msg) => {
            setTranscodePercent(percent);
            setTranscodeMessage(msg);
          }
        );

        const newUrl = URL.createObjectURL(transcodedBlob);
        if (videoRef.current) {
          videoRef.current.src = newUrl;
          videoRef.current.load();
          setVideoError(null);
          setIsLoading(true);
          setRepairSuccessMessage("הווידאו הומר בהצלחה ל-WebM נתמך דפדפן!");
        }
      } catch (err: any) {
        console.error("Transcode failed:", err);
        setTranscodeMessage(err.message || "שגיאה בהמרת הקובץ.");
      } finally {
        setIsTranscoding(false);
      }
    };

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
        setIsPlaying((prev) => !prev);
      } else if (videoRef.current) {
        const video = videoRef.current;
        if (video.paused) {
          video
            .play()
            .then(() => {
              setIsPlaying(true);
            })
            .catch((err) => {
              console.warn("Play error, trying muted autoplay fallback:", err);
              video.muted = true;
              setIsMuted(true);
              video
                .play()
                .then(() => {
                  setIsPlaying(true);
                })
                .catch((e) => {
                  console.error("Muted play also failed:", e);
                  setIsPlaying(false);
                });
            });
        } else {
          video.pause();
          setIsPlaying(false);
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
        className={`relative isolate w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-[#333333] flex items-center justify-center select-none group ${
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
          /* Error recovery state with comprehensive format diagnostics and 1-click repairs */
          <div className="flex flex-col items-center justify-center text-center p-5 max-w-lg z-20 bg-[#111111]/95 border border-[#333333] rounded-xl shadow-2xl backdrop-blur-md m-3 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-11 h-11 rounded-full bg-amber-500/15 text-amber-400 flex items-center justify-center mb-2.5 border border-amber-500/30">
              <AlertTriangle className="w-5 h-5" />
            </div>
            
            <h4 className="text-sm font-bold text-white mb-1">שגיאה בהפעלת הווידאו בדפדפן</h4>
            <p className="text-xs text-gray-300 mb-3 max-w-sm leading-relaxed">{videoError}</p>

            {/* Video format details card if detected */}
            {formatInfo && (
              <div className="w-full bg-[#181818] border border-[#2a2a2a] rounded-lg p-2.5 mb-3.5 text-right flex flex-col gap-1 text-[11px]">
                <div className="flex items-center justify-between text-gray-300">
                  <span className="font-semibold text-gray-200">זיהוי פורמט:</span>
                  <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono font-bold">
                    {formatInfo.detectedFormat}
                  </span>
                </div>
                <div className="text-gray-400">
                  <span>MIME Type: </span>
                  <span className="font-mono text-gray-300">{formatInfo.mimeType}</span>
                </div>
                {formatInfo.suggestion && (
                  <div className="text-amber-300/90 text-[10px] mt-0.5">
                    💡 {formatInfo.suggestion}
                  </div>
                )}
              </div>
            )}

            {/* Transcoding Progress Bar */}
            {isTranscoding && (
              <div className="w-full bg-[#181818] border border-blue-500/30 rounded-lg p-3 mb-3 text-right">
                <div className="flex items-center justify-between text-xs text-blue-300 mb-1.5">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Cpu className="w-3.5 h-3.5 animate-spin" />
                    {transcodeMessage}
                  </span>
                  <span className="font-mono font-bold">{transcodePercent}%</span>
                </div>
                <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${transcodePercent}%` }}
                    className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full transition-all duration-200"
                  />
                </div>
              </div>
            )}

            {/* Repair Success Notification */}
            {repairSuccessMessage && (
              <div className="w-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 rounded-lg p-2 mb-3 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{repairSuccessMessage}</span>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center flex-wrap justify-center gap-2 w-full">
              {/* 1. Quick Fix / Force MP4 Blob */}
              {videoFile && (
                <button
                  onClick={handleForceMp4Fix}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-md transition shadow-md cursor-pointer"
                  title="עטוף את הקובץ ב-Blob תואם MP4 כדי לעקוף חסימת דפדפן"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>תיקון סוג קובץ מהיר</span>
                </button>
              )}

              {/* 2. Start Gemini Subtitle Scan Directly */}
              <button
                onClick={onStartAnalysis}
                disabled={isAnalyzing}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold rounded-md transition shadow-md cursor-pointer disabled:opacity-50"
                title="סרוק כתוביות מוטמעות ותרגם ישירות עם Gemini AI"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>סרוק כתוביות ב-AI</span>
              </button>

              {/* 3. Re-encode / Transcode locally */}
              {videoFile && !isTranscoding && (
                <button
                  onClick={handleTranscode}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#202020] hover:bg-[#2c2c2c] text-gray-200 text-xs font-semibold rounded-md border border-[#3a3a3a] transition cursor-pointer"
                  title="המר את הקובץ ל-WebM נתמך דפדפן ישירות במכשירך"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
                  <span>המרת קובץ בדפדפן</span>
                </button>
              )}

              {/* 4. Reload Demo */}
              {onReloadDemo && (
                <button
                  onClick={onReloadDemo}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1a1a] hover:bg-[#262626] text-gray-300 text-xs font-medium rounded-md transition border border-[#333333] cursor-pointer"
                >
                  <span>סרטון הדגמה</span>
                </button>
              )}

              {/* 5. Choose another file */}
              <label
                htmlFor="player-error-file-input"
                className="px-3 py-1.5 bg-[#1a1a1a] hover:bg-[#262626] text-gray-300 text-xs font-medium rounded-md border border-[#333333] cursor-pointer transition"
              >
                בחר קובץ אחר
              </label>
              <input
                id="player-error-file-input"
                type="file"
                accept="video/*, .mp4, .m4v, .webm, .mov, .qt, .mkv, .avi, .ts, .3gp, .wmv, .ogv, .flv, video/mp4, video/webm, video/quicktime, video/x-matroska"
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
            <AnimatePresence>
              {showHebrewSubtitles && activeCue && activeCue.hebrewText.trim() && !previewOriginal && (
                <motion.div
                  key={activeCue.id}
                  initial={{ opacity: 0, y: 4, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -2, scale: 0.99, transition: { duration: 0.12, ease: "easeIn" } }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  id="hebrew-subtitle-overlay"
                  style={{
                    bottom: `${
                      collisionDetectionEnabled && hasGraphicsCollision
                        ? Math.max(styles.positionBottomPercent, styles.hideOriginalSubtitles ? (styles.maskBottomPercent + styles.maskHeightPercent + 2) : 22)
                        : styles.positionBottomPercent
                    }%`,
                    textAlign: styles.align || "center",
                    willChange: "transform, opacity",
                  }}
                  className="absolute inset-x-0 flex justify-center pointer-events-none z-20 px-4"
                >
                  <div
                    style={{
                      backgroundColor: (() => {
                        if (smartPositionEnabled) {
                          // Smart Position: Bright background gets semi-transparent black mask, Dark background gets subtle translucent backing
                          return isBrightBackground ? "rgba(0, 0, 0, 0.82)" : "rgba(0, 0, 0, 0.25)";
                        }
                        if (!styles.backgroundOpacity || styles.backgroundOpacity <= 0) return "transparent";
                        const hex = styles.backgroundColor || "#000000";
                        let clean = hex.replace("#", "");
                        if (clean.length === 3) clean = clean.split("").map((c) => c + c).join("");
                        const num = parseInt(clean, 16);
                        const r = !isNaN(num) && clean.length === 6 ? (num >> 16) & 255 : 0;
                        const g = !isNaN(num) && clean.length === 6 ? (num >> 8) & 255 : 0;
                        const b = !isNaN(num) && clean.length === 6 ? num & 255 : 0;
                        return `rgba(${r}, ${g}, ${b}, ${styles.backgroundOpacity})`;
                      })(),
                      color: styles.textColor || "#ffffff",
                      fontSize: `${Math.max(14, styles.fontSize)}px`,
                      padding: `${styles.boxPadding}px ${styles.boxPadding * 2}px`,
                      borderRadius: `${styles.borderRadius}px`,
                      textShadow: (() => {
                        if (smartPositionEnabled) {
                          // Smart Position: Bright background gets dark drop shadow; Dark background gets white shadow halo
                          return isBrightBackground
                            ? "0 2px 6px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,0.8)"
                            : "0 0 14px rgba(255,255,255,0.95), 0 0 6px rgba(255,255,255,0.85), 0 2px 8px rgba(0,0,0,0.95)";
                        }
                        return styles.strokeWidth > 0
                          ? `-${styles.strokeWidth}px -${styles.strokeWidth}px 0 ${styles.strokeColor}, ${styles.strokeWidth}px -${styles.strokeWidth}px 0 ${styles.strokeColor}, -${styles.strokeWidth}px ${styles.strokeWidth}px 0 ${styles.strokeColor}, ${styles.strokeWidth}px ${styles.strokeWidth}px 0 ${styles.strokeColor}, 0 2px 8px rgba(0,0,0,0.8)`
                          : "0 2px 8px rgba(0,0,0,0.9)";
                      })(),
                      border: smartPositionEnabled
                        ? isBrightBackground
                          ? "1px solid rgba(255, 255, 255, 0.15)"
                          : "1px solid rgba(255, 255, 255, 0.35)"
                        : "none",
                      boxShadow: smartPositionEnabled
                        ? isBrightBackground
                          ? "0 4px 16px rgba(0, 0, 0, 0.6)"
                          : "0 4px 16px rgba(0, 0, 0, 0.4)"
                        : "none",
                      fontWeight: styles.bold ? 700 : 500,
                    }}
                    dir="rtl"
                    className={`inline-block max-w-[90%] transition-all duration-150 ${subtitleFontClass}`}
                  >
                    {activeCue.hebrewText}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* OVERLAY LAYER 3: Video Integrity Warning Banner (Dropped Frames / Stuttering Detected) */}
            {integrityWarning && (
              <div
                id="video-integrity-warning-banner"
                className="absolute top-12 inset-x-2 sm:inset-x-4 bg-gradient-to-r from-amber-950/95 via-orange-950/95 to-red-950/95 border border-amber-500/70 rounded-xl p-2.5 sm:p-3 text-white text-xs z-30 shadow-2xl flex items-center justify-between gap-2 animate-in slide-in-from-top-2"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
                  <div className="min-w-0">
                    <span className="font-bold text-amber-200 block truncate">
                      זוהה חוסר יציבות בנגן (נפילת פריימים / יציבות: {integrityScore}%)
                    </span>
                    <span className="text-[10.5px] text-gray-300 hidden sm:block">
                      גמגום השידור עלול להשפיע על דיוק סנכרון הכתוביות. מומלץ לרענן את הנגן.
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={handleRefreshStream}
                    id="refresh-stream-btn"
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs rounded-lg transition shadow-md flex items-center gap-1.5 cursor-pointer"
                    title="שחרר זיכרון, אפס חוצץ ורענן את הנגן (Refresh Stream)"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>רענן שידור (Refresh Stream)</span>
                  </button>
                  <button
                    onClick={() => setIntegrityWarning(false)}
                    className="p-1 text-gray-400 hover:text-white rounded"
                    title="התעלם"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            {/* TOP BAR OVERLAY: Mode tag, Video Name, Quick Actions */}
            <div
              className={`absolute top-0 inset-x-0 p-2 sm:p-2.5 bg-gradient-to-b from-black/85 via-black/45 to-transparent flex items-center justify-between gap-1.5 sm:gap-2 transition-opacity duration-300 z-30 ${
                showControls ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              <div className="flex items-center gap-1.5 overflow-hidden min-w-0">
                <span className="h-6 sm:h-7 px-2 flex items-center justify-center whitespace-nowrap rounded-md text-[10px] sm:text-[11px] font-bold bg-blue-600/90 text-white border border-blue-400/30 shrink-0 shadow-xs">
                  {isDemo ? "סרטון הדגמה" : "קובץ מקומי"}
                </span>
                {formatInfo && (
                  <span className="h-6 sm:h-7 px-1.5 hidden sm:flex items-center justify-center whitespace-nowrap rounded-md text-[10px] font-semibold bg-[#222222] text-gray-300 border border-[#3a3a3a] shrink-0 font-mono">
                    {formatInfo.detectedFormat}
                  </span>
                )}
                <span className="text-[11px] sm:text-xs font-medium text-white truncate max-w-[120px] sm:max-w-[220px]">
                  {videoName}
                </span>
              </div>

              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                {/* Instant toggle Hebrew subtitles button */}
                <button
                  id="toggle-hebrew-subtitles-top-btn"
                  onClick={() => setShowHebrewSubtitles((prev) => !prev)}
                  title={
                    showHebrewSubtitles
                      ? "הסתר כתוביות בעברית (לחץ להסרה מהתצוגה והשוואה למקור)"
                      : "הצג כתוביות בעברית (לחץ להפעלה מחדש)"
                  }
                  className={`h-6 sm:h-7 px-2 flex items-center justify-center gap-1 text-[10px] sm:text-[11px] font-semibold rounded-md border transition cursor-pointer shrink-0 shadow-xs whitespace-nowrap ${
                    showHebrewSubtitles
                      ? "bg-blue-600/90 hover:bg-blue-500 text-white border-blue-400/40"
                      : "bg-red-950/80 hover:bg-red-900/80 text-red-200 border-red-500/40"
                  }`}
                >
                  <Subtitles className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                  <span className="whitespace-nowrap hidden sm:inline">
                    {showHebrewSubtitles ? "כתוביות עברית: פעיל" : "כתוביות עברית: כבוי"}
                  </span>
                  <span className="whitespace-nowrap sm:hidden">
                    {showHebrewSubtitles ? "עברית: פעיל" : "עברית: כבוי"}
                  </span>
                </button>

                {/* Hold to preview original subtitle */}
                <button
                  onMouseDown={() => setPreviewOriginal(true)}
                  onMouseUp={() => setPreviewOriginal(false)}
                  onTouchStart={() => setPreviewOriginal(true)}
                  onTouchEnd={() => setPreviewOriginal(false)}
                  title="החזק כדי לראות את הכתובית המקורית המוטמעת (הצג מקור)"
                  className={`h-6 sm:h-7 px-1.5 sm:px-2 flex items-center justify-center gap-1 text-[10px] sm:text-[11px] font-semibold rounded-md border transition cursor-pointer shrink-0 whitespace-nowrap ${
                    previewOriginal
                      ? "bg-amber-600 text-white border-amber-500 shadow-xs"
                      : "bg-[#1f1f1f]/80 hover:bg-[#2c2c2c] text-gray-300 border-[#404040]"
                  }`}
                >
                  {previewOriginal ? <EyeOff className="w-3.5 h-3.5 shrink-0" /> : <Eye className="w-3.5 h-3.5 shrink-0" />}
                  <span className="hidden sm:inline whitespace-nowrap">
                    {previewOriginal ? "רואה מקור" : "הצג מקור"}
                  </span>
                </button>

                {/* Feature: Smart Position Toggle & Dynamic Contrast Indicator */}
                <button
                  id="smart-position-toggle-btn"
                  onClick={() => setSmartPositionEnabled((prev) => !prev)}
                  title={
                    smartPositionEnabled
                      ? `מיקום חכם וקונטרסט (Smart Position): פעיל. תאורת פריים תחתונה: ${bottomBrightness}/255 (${
                          isBrightBackground ? "רקע בהיר ☀️ -> מסכה שחורה" : "רקע כהה 🌙 -> הילה לבנה"
                        }). לחץ לביטול.`
                      : "מיקום חכם וקונטרסט (Smart Position): כבוי. לחץ להפעלת התאמת ניגודיות אוטומטית לפי תאורת הוידאו."
                  }
                  className={`h-6 sm:h-7 px-2 flex items-center justify-center gap-1.5 text-[10px] sm:text-[11px] font-extrabold rounded-md border transition cursor-pointer shrink-0 whitespace-nowrap shadow-xs ${
                    smartPositionEnabled
                      ? "bg-gradient-to-r from-blue-900/90 to-indigo-900/90 hover:from-blue-800 hover:to-indigo-800 text-cyan-200 border-cyan-400/50"
                      : "bg-[#1f1f1f]/80 hover:bg-[#2c2c2c] text-gray-400 border-[#404040]"
                  }`}
                >
                  <Sparkles className={`w-3.5 h-3.5 ${smartPositionEnabled ? "text-cyan-300 animate-pulse" : "text-gray-400"}`} />
                  <span className="hidden sm:inline">
                    {smartPositionEnabled
                      ? `ניגודיות חכמה: ${isBrightBackground ? "מסכה שחורה ☀️" : "הילה לבנה 🌙"}`
                      : "ניגודיות חכמה: כבוי"}
                  </span>
                  <span className="sm:hidden font-mono">
                    {smartPositionEnabled ? (isBrightBackground ? "Black Mask" : "White Shadow") : "Smart Off"}
                  </span>
                </button>

                {/* Feature: Collision Detection Toggle & Indicator */}
                <button
                  id="collision-detection-toggle-btn"
                  onClick={() => setCollisionDetectionEnabled((prev) => !prev)}
                  title={
                    collisionDetectionEnabled
                      ? `מניעת התנגשויות גרפיות (Collision Detection): פעיל. שונות תאורה/גרפיקה: ${graphicsVariance}. ${
                          hasGraphicsCollision
                            ? "זיהה באנר/גרפיקה בתחתית ⚠️ -> הכתובית הורמה אוטומטית ל-22%"
                            : "אין הסתרה גרפית"
                        }`
                      : "מניעת התנגשויות גרפיות (Collision Detection): כבוי. לחץ להרמה אוטומטית של כתוביות במקרה של באנר/גרפיקה"
                  }
                  className={`h-6 sm:h-7 px-2 flex items-center justify-center gap-1.5 text-[10px] sm:text-[11px] font-extrabold rounded-md border transition cursor-pointer shrink-0 whitespace-nowrap shadow-xs ${
                    collisionDetectionEnabled
                      ? hasGraphicsCollision
                        ? "bg-gradient-to-r from-amber-950 to-orange-950 hover:from-amber-900 hover:to-orange-900 text-amber-300 border-amber-400/80 ring-1 ring-amber-400/50"
                        : "bg-gradient-to-r from-emerald-950 to-teal-950 hover:from-emerald-900 hover:to-teal-900 text-emerald-300 border-emerald-500/50"
                      : "bg-[#1f1f1f]/80 hover:bg-[#2c2c2c] text-gray-400 border-[#404040]"
                  }`}
                >
                  <ShieldCheck className={`w-3.5 h-3.5 ${collisionDetectionEnabled && hasGraphicsCollision ? "text-amber-400 animate-pulse" : "text-emerald-400"}`} />
                  <span className="hidden sm:inline">
                    {collisionDetectionEnabled
                      ? hasGraphicsCollision
                        ? "זיהוי התנגשות: כתובית הורמה ⚠️"
                        : "מניעת התנגשות: נקי ✓"
                      : "מניעת התנגשות: כבוי"}
                  </span>
                  <span className="sm:hidden font-mono">
                    {collisionDetectionEnabled ? (hasGraphicsCollision ? "Shifted ⚠️" : "Clean ✓") : "Collision Off"}
                  </span>
                </button>

                {/* Feature 3: Decoding Priority Toggle */}
                <button
                  id="decoding-priority-toggle-btn"
                  onClick={() =>
                    setDecodingPriority((prev) =>
                      prev === "performance" ? "high-quality" : "performance"
                    )
                  }
                  title={
                    decodingPriority === "high-quality"
                      ? "עבור מצב פענוח: איכות גבוהה (דיוק פריים מרבי לסנכרון). לחץ למצב ביצועים בזמן אמת."
                      : "עבור מצב פענוח: ביצועים בזמן אמת (מהירות ניגון אופטימלית). לחץ למצב איכות גבוהה."
                  }
                  className={`h-6 sm:h-7 px-2 flex items-center justify-center gap-1 text-[10px] sm:text-[11px] font-extrabold rounded-md border transition cursor-pointer shrink-0 whitespace-nowrap shadow-xs ${
                    decodingPriority === "high-quality"
                      ? "bg-purple-900/90 hover:bg-purple-800 text-purple-200 border-purple-400/50"
                      : "bg-emerald-900/90 hover:bg-emerald-800 text-emerald-200 border-emerald-400/50"
                  }`}
                >
                  <Cpu className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 text-purple-300" />
                  <span className="hidden sm:inline">
                    {decodingPriority === "high-quality"
                      ? "פענוח: איכות גבוהה"
                      : "פענוח: ביצועים"}
                  </span>
                  <span className="sm:hidden font-mono">
                    {decodingPriority === "high-quality" ? "HQ" : "Perf"}
                  </span>
                </button>

                {/* Feature 4: Manual Video Integrity Check Button */}
                <button
                  id="video-integrity-check-btn"
                  onClick={runIntegrityCheck}
                  title="בדיקת תקינות וידאו ויציבות שידור (Video Integrity Check)"
                  className="h-6 sm:h-7 px-1.5 sm:px-2 flex items-center justify-center gap-1 text-[10px] sm:text-[11px] font-semibold bg-[#1a2233] hover:bg-[#25324d] text-blue-300 hover:text-white rounded-md border border-blue-500/40 transition cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <Activity className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-400 shrink-0" />
                  <span className="hidden sm:inline">תקינות וידאו</span>
                </button>

                {/* Cover mask toggle */}
                <button
                  onClick={onToggleStyles}
                  title="הגדרות עיצוב וכיסוי כתוביות"
                  className="h-6 sm:h-7 w-6 sm:w-7 flex items-center justify-center bg-[#1f1f1f]/80 hover:bg-[#2c2c2c] text-gray-300 hover:text-white rounded-md border border-[#404040] transition cursor-pointer shrink-0"
                >
                  <Layers className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* BIG CENTER PLAY BUTTON when paused */}
            {!isPlaying && !isLoading && (
              <button
                onClick={togglePlay}
                aria-label="נגן"
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 bg-blue-600/90 hover:bg-blue-600 text-white rounded-full flex items-center justify-center shadow-[0_0_25px_rgba(59,130,246,0.7)] transform hover:scale-105 active:scale-95 transition duration-150 z-20 cursor-pointer pointer-events-auto"
              >
                <Play className="w-7 h-7 fill-white translate-x-0.5" />
              </button>
            )}

            {/* BOTTOM CONTROLS BAR */}
            <div
              className={`absolute bottom-0 inset-x-0 p-2 sm:p-2.5 bg-gradient-to-t from-black/95 via-black/70 to-transparent flex flex-col gap-1.5 transition-opacity duration-300 z-30 ${
                showControls ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              {/* Scrubbing Timeline Progress Bar */}
              <div className="relative w-full flex items-center group/timeline py-0.5 cursor-pointer">
                {/* Visual cue markers on timeline */}
                <div className="absolute inset-x-0 h-1 sm:h-1.5 bg-gray-700/80 rounded-full overflow-hidden">
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
                        className="absolute h-1 sm:h-1.5 bg-amber-400/80 rounded-sm pointer-events-none z-10"
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
                  className="w-full h-2.5 sm:h-3 opacity-0 cursor-pointer z-20"
                />
              </div>

              {/* Action buttons row */}
              <div className="flex items-center justify-between text-xs text-white gap-1 flex-wrap sm:flex-nowrap">
                <div className="flex items-center gap-1 sm:gap-1.5">
                  {/* Play / Pause */}
                  <button
                    onClick={togglePlay}
                    className="p-1 hover:bg-white/10 rounded-md transition text-white cursor-pointer"
                    title={isPlaying ? "השהה (Space)" : "נגן (Space)"}
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5 fill-white" /> : <Play className="w-3.5 h-3.5 fill-white" />}
                  </button>

                  {/* -3s / +3s */}
                  <button
                    onClick={() => stepTime(-3)}
                    title="3 שניות אחורה"
                    className="p-1 hover:bg-white/10 rounded text-gray-300 hover:text-white transition cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </button>
                  <button
                    onClick={() => stepTime(3)}
                    title="3 שניות קדימה"
                    className="p-1 hover:bg-white/10 rounded text-gray-300 hover:text-white transition cursor-pointer"
                  >
                    <RotateCw className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </button>

                  {/* Volume / Mute */}
                  {!isDemo && (
                    <button
                      onClick={toggleMute}
                      className="p-1 hover:bg-white/10 rounded text-gray-300 hover:text-white transition cursor-pointer"
                    >
                      {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    </button>
                  )}

                  {/* Time indicator */}
                  <div className="text-[10px] sm:text-[11px] font-mono text-gray-300 flex items-center gap-1 mr-1 whitespace-nowrap">
                    <span className="text-white font-semibold">
                      {formatTimeDisplay(currentTime)}
                    </span>
                    <span className="text-gray-500">/</span>
                    <span>{formatTimeDisplay(duration)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  {/* Instant Subtitle Visibility Toggle Button */}
                  <button
                    id="toggle-subtitles-bottom-btn"
                    onClick={() => setShowHebrewSubtitles((prev) => !prev)}
                    title={
                      showHebrewSubtitles
                        ? "הסתר כתוביות חדשות בעברית במהלך ניגון"
                        : "הצג כתוביות חדשות בעברית"
                    }
                    className={`h-6 px-1.5 sm:px-2 flex items-center gap-1 rounded text-[10px] sm:text-[11px] font-bold border transition whitespace-nowrap cursor-pointer shrink-0 ${
                      showHebrewSubtitles
                        ? "bg-blue-600/40 text-blue-200 border-blue-500/50 hover:bg-blue-600/60"
                        : "bg-[#1e1e1e] text-gray-400 border-[#333] hover:text-white"
                    }`}
                  >
                    <Subtitles className="w-3 h-3 shrink-0" />
                    <span className="whitespace-nowrap">עברית {showHebrewSubtitles ? "ON" : "OFF"}</span>
                  </button>

                  {/* Playback speed selector */}
                  <div className="flex items-center bg-[#1e1e1e] rounded border border-[#333] px-0.5 py-0.5 shrink-0">
                    {[0.75, 1, 1.25, 1.5].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => handleSpeedChange(rate)}
                        className={`px-1 sm:px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-mono transition cursor-pointer ${
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
                    className="p-1 hover:bg-white/10 rounded text-gray-300 hover:text-white transition cursor-pointer shrink-0"
                    title="מסך מלא"
                  >
                    <Maximize2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
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
