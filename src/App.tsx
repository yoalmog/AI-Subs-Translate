import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Header,
} from "./components/Header";
import {
  VideoPlayer,
  VideoPlayerRef,
} from "./components/VideoPlayer";
import {
  SubtitleEditor,
} from "./components/SubtitleEditor";
import {
  StyleControls,
} from "./components/StyleControls";
import {
  AnalysisModal,
} from "./components/AnalysisModal";
import {
  ExportModal,
} from "./components/ExportModal";
import {
  SubtitleCue,
  SubtitleStyleSettings,
  AnalysisProgress,
  DemoVideo,
  SubtitleProjectBundle,
  TonePreference,
} from "./types";
import { DEMO_VIDEOS } from "./data/demoVideos";
import { TARGET_LANGUAGES, TargetLanguage, DEFAULT_LANGUAGE } from "./data/languages";
import { sampleVideoFrames } from "./utils/frameSampler";
import {
  saveDraftToStorage,
  loadDraftFromStorage,
  clearDraftFromStorage,
  AutoSaveDraft,
} from "./utils/autoSave";
import { BulkShiftOptions } from "./components/BatchTimeShiftModal";
import {
  Sparkles,
  Sliders,
  Languages,
  Film,
  Info,
  CheckCircle,
  HelpCircle,
  FolderCheck,
  X,
  Undo2,
  Redo2,
} from "lucide-react";

const DEFAULT_STYLES: SubtitleStyleSettings = {
  fontSize: 26,
  fontFamily: "Heebo",
  textColor: "#FFFFFF",
  strokeColor: "#000000",
  strokeWidth: 2,
  backgroundColor: "#000000",
  backgroundOpacity: 0.6,
  boxPadding: 8,
  borderRadius: 8,
  positionBottomPercent: 8,
  align: "center",
  bold: true,
  
  // Hardcoded subtitle cover-mask default
  hideOriginalSubtitles: true,
  maskHeightPercent: 13,
  maskBottomPercent: 5,
  maskColor: "#000000",
  maskOpacity: 0.95,
  maskBlur: false,
};

export default function App() {
  const [videoUrl, setVideoUrl] = useState<string | null>("demo:demo-space");
  const [videoName, setVideoName] = useState<string>(DEMO_VIDEOS[0].title);
  const [videoDuration, setVideoDuration] = useState<number>(10);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [cues, setCues] = useState<SubtitleCue[]>(DEMO_VIDEOS[0].sampleCues || []);
  
  // Undo / Redo history state arrays
  const [undoHistory, setUndoHistory] = useState<SubtitleCue[][]>([]);
  const [redoHistory, setRedoHistory] = useState<SubtitleCue[][]>([]);

  const pushToUndoHistory = (prevCues: SubtitleCue[]) => {
    setUndoHistory((prev) => [...prev.slice(-30), prevCues]);
    setRedoHistory([]); // Clear redo stack on new user actions
  };

  const handleUndo = () => {
    if (undoHistory.length === 0) return;
    const historyCopy = [...undoHistory];
    const previousState = historyCopy.pop()!;
    setRedoHistory((prev) => [cues, ...prev]);
    setUndoHistory(historyCopy);
    setCues(previousState);
    setProjectBannerMessage({
      type: "info",
      text: "בוצע ביטול (Undo): שוחזר מצב כתוביות קודם.",
    });
    setTimeout(() => setProjectBannerMessage(null), 3000);
  };

  const handleRedo = () => {
    if (redoHistory.length === 0) return;
    const redoCopy = [...redoHistory];
    const nextState = redoCopy.shift()!;
    setUndoHistory((prev) => [...prev.slice(-30), cues]);
    setRedoHistory(redoCopy);
    setCues(nextState);
    setProjectBannerMessage({
      type: "info",
      text: "בוצע שחזור (Redo): הוחל השינוי שוב.",
    });
    setTimeout(() => setProjectBannerMessage(null), 3000);
  };

  // Keyboard shortcut listener for Ctrl+Z / Cmd+Z (Undo) and Ctrl+Y / Cmd+Shift+Z (Redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is actively typing in a standard input or textarea
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))
      ) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undoHistory, redoHistory, cues]);

  const [styles, setStyles] = useState<SubtitleStyleSettings>(DEFAULT_STYLES);
  const [targetLanguage, setTargetLanguage] = useState<TargetLanguage>(DEFAULT_LANGUAGE);
  const [tonePreference, setTonePreference] = useState<TonePreference>("informal");
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<string | null>(null);
  const [savedDraftAvailable, setSavedDraftAvailable] = useState<AutoSaveDraft | null>(null);
  const [projectBannerMessage, setProjectBannerMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [showAnalysisModal, setShowAnalysisModal] = useState<boolean>(false);
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress>({
    status: "idle",
    currentFrame: 0,
    totalFrames: 0,
    percent: 0,
    message: "",
  });
  const [recentFrames, setRecentFrames] = useState<string[]>([]);

  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [showStyles, setShowStyles] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"editor" | "styles">("editor");

  const playerRef = useRef<VideoPlayerRef>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const progressTimerRef = useRef<any>(null);

  // Check on mount for existing saved draft in localStorage
  useEffect(() => {
    const draft = loadDraftFromStorage();
    if (draft && draft.cues && draft.cues.length > 0) {
      setSavedDraftAvailable(draft);
      setLastAutoSavedAt(draft.savedAt);
    }
  }, []);

  // Periodic and change-based auto-save to localStorage
  useEffect(() => {
    if (!cues || cues.length === 0) return;
    const timer = setTimeout(() => {
      const success = saveDraftToStorage({
        cues,
        videoName,
        targetLanguageCode: targetLanguage.code,
      });
      if (success) {
        setLastAutoSavedAt(
          new Date().toLocaleTimeString("he-IL", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
        );
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [cues, videoName, targetLanguage]);

  // Manual save trigger
  const handleManualSave = () => {
    if (!cues || cues.length === 0) return;
    const success = saveDraftToStorage({
      cues,
      videoName,
      targetLanguageCode: targetLanguage.code,
    });
    if (success) {
      const nowStr = new Date().toLocaleTimeString("he-IL", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      setLastAutoSavedAt(nowStr);
    }
  };

  // Restore saved draft
  const handleRestoreDraft = () => {
    if (savedDraftAvailable && savedDraftAvailable.cues.length > 0) {
      setCues(savedDraftAvailable.cues);
      if (savedDraftAvailable.targetLanguageCode) {
        const matchingLang = TARGET_LANGUAGES.find(
          (l) => l.code === savedDraftAvailable.targetLanguageCode
        );
        if (matchingLang) {
          setTargetLanguage(matchingLang);
        }
      }
    }
  };

  // Clear saved draft
  const handleClearDraft = () => {
    clearDraftFromStorage();
    setSavedDraftAvailable(null);
    setLastAutoSavedAt(null);
  };

  // Initialize initial demo video instantly without any network/MediaRecorder delay
  useEffect(() => {
    setVideoUrl("demo:demo-space");
    setVideoName(DEMO_VIDEOS[0].title);
    setCues(DEMO_VIDEOS[0].sampleCues || []);
    setVideoDuration(10);
  }, []);

  // Active cue calculation based on currentTime
  const activeCue = useMemo(() => {
    return cues.find(
      (cue) => currentTime >= cue.startTime && currentTime <= cue.endTime
    ) || null;
  }, [cues, currentTime]);

  // Handle uploaded video file with robust MIME validation and cleanup
  const handleFileUpload = (file: File) => {
    if (videoUrl && videoUrl.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(videoUrl);
      } catch (_) {}
    }

    let mimeType = file.type;
    const nameLower = file.name.toLowerCase();
    if (!mimeType || mimeType === "application/octet-stream" || mimeType === "") {
      if (nameLower.endsWith(".mp4") || nameLower.endsWith(".m4v")) mimeType = "video/mp4";
      else if (nameLower.endsWith(".webm")) mimeType = "video/webm";
      else if (nameLower.endsWith(".mov") || nameLower.endsWith(".qt")) mimeType = "video/quicktime";
      else if (nameLower.endsWith(".ogg") || nameLower.endsWith(".ogv")) mimeType = "video/ogg";
      else if (nameLower.endsWith(".mkv")) mimeType = "video/x-matroska";
      else mimeType = "video/mp4";
    }

    const safeBlob = file.type ? file : new Blob([file], { type: mimeType });
    const url = URL.createObjectURL(safeBlob);
    setVideoUrl(url);
    setVideoName(file.name);
    setCues([]); // Reset cues for new video
    setCurrentTime(0);
  };

  // Handle selecting a demo video
  const handleSelectDemo = (demo: DemoVideo) => {
    setVideoUrl(`demo:${demo.id}`);
    setVideoName(demo.title);
    setCues(demo.sampleCues ? [...demo.sampleCues] : []);
    setCurrentTime(0);
    setVideoDuration(10);
    playerRef.current?.seekTo(0);
  };

  // Cancel ongoing AI analysis
  const handleCancelAnalysis = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    setIsAnalyzing(false);
    setShowAnalysisModal(false);
  };

  // AI Subtitle Scanning & Hebrew Translation
  const handleStartAnalysis = async () => {
    const handle = playerRef.current?.getSourceHandle();
    if (!handle) return;

    // Reset previous controller if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
    }

    setIsAnalyzing(true);
    setShowAnalysisModal(true);
    setRecentFrames([]);
    
    // Estimate frames based on duration to cover full dialogue
    const duration = handle.duration || videoDuration || 10;
    let targetFrames = 18;
    if (duration <= 12) targetFrames = 14;
    else if (duration <= 30) targetFrames = 22;
    else if (duration <= 60) targetFrames = 28;
    else targetFrames = Math.min(36, Math.round(duration / 1.5));

    setAnalysisProgress({
      status: "sampling",
      currentFrame: 0,
      totalFrames: targetFrames,
      percent: 5,
      message: "דוגם פריימים ברזולוציה גבוהה לכיסוי מלא של כל הדיאלוגים...",
    });

    try {
      // Step 1: Sample video frames adaptively with high clarity
      const sampledFrames = await sampleVideoFrames(
        handle,
        1.0,
        (curr, total, time) => {
          if (controller.signal.aborted) return;
          const percent = Math.min(45, Math.round((curr / total) * 40) + 5);
          setAnalysisProgress({
            status: "sampling",
            currentFrame: curr,
            totalFrames: total,
            percent,
            message: `דוגם פריים ${curr} מתוך ${total} (${time.toFixed(1)} שניות)...`,
          });
        },
        targetFrames,
        controller.signal
      );

      if (controller.signal.aborted) return;

      // Keep recent frame preview thumbnails
      setRecentFrames(sampledFrames.slice(0, 8).map((f) => f.dataUrl));

      if (sampledFrames.length === 0) {
        throw new Error("לא ניתן היה לדגום פריימים מהסרטון.");
      }

      // Step 2: Send frames to Gemini backend for Subtitle OCR & Hebrew translation
      setAnalysisProgress({
        status: "analyzing",
        currentFrame: sampledFrames.length,
        totalFrames: sampledFrames.length,
        percent: 50,
        message: `Gemini Vision מפענח טקסט מ-${sampledFrames.length} פריימים ומבצע תרגום מלא...`,
      });

      // Smooth progress ticker during AI processing
      let currentProgress = 50;
      progressTimerRef.current = setInterval(() => {
        currentProgress = Math.min(94, currentProgress + 3);
        setAnalysisProgress((prev) => {
          if (prev.status !== "analyzing") return prev;
          let msg = "Gemini Vision מפענח טקסט מהפריימים שנדגמו...";
          if (currentProgress > 68) {
            msg = "מזהה שפת מקור ומיקום כתוביות מוטמעות...";
          }
          if (currentProgress > 82) {
            msg = "מתרגם לעברית ומסנכרן חותמות זמן...";
          }
          return {
            ...prev,
            percent: currentProgress,
            message: msg,
          };
        });
      }, 400);

      const response = await fetch("/api/analyze-frames", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frames: sampledFrames,
          videoDuration: duration,
          languageHint: "Auto-detect",
          targetLanguage: targetLanguage.name,
        }),
        signal: controller.signal,
      });

      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }

      let data: any = null;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json().catch(() => null);
      }

      if (!response.ok || !data) {
        let errMsg = data?.error;
        if (!errMsg) {
          if (response.status === 413) {
            errMsg = "גודל הפריימים גדול מדי. אנא נסה לדגום פחות פריימים.";
          } else if (response.status === 503 || response.status === 504) {
            errMsg = "שרת ה-AI חווה עומס רגעי. לחץ 'נסה שוב'.";
          } else if (response.status === 404) {
            errMsg = "שירות ה-AI אינו זמין כרגע בשרת.";
          } else {
            errMsg = `שגיאה בתקשורת עם שרת ה-AI (${response.status || "תגובה לא תקינה"}).`;
          }
        }
        throw new Error(errMsg);
      }

      const detectedCues: SubtitleCue[] = data.cues || [];

      setAnalysisProgress({
        status: "completed",
        currentFrame: sampledFrames.length,
        totalFrames: sampledFrames.length,
        percent: 100,
        message: detectedCues.length > 0
          ? `סריקה הושלמה! זוהו ${detectedCues.length} כתוביות מתורגמות ל-${targetLanguage.nativeName}.`
          : "לא זוהו כתוביות מובנות בפריימים שנדגמו.",
        extractedCuesCount: detectedCues.length,
      });

      if (detectedCues.length > 0) {
        setCues(detectedCues);
      }

      setTimeout(() => {
        setShowAnalysisModal(false);
        setIsAnalyzing(false);
        playerRef.current?.seekTo(0);
        playerRef.current?.play();
      }, 1200);
    } catch (err: any) {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }

      if (err.name === "AbortError" || err.message?.includes("cancelled")) {
        console.log("Analysis was cancelled by user.");
        return;
      }

      console.error("AI Analysis failed:", err);
      let friendlyMessage = err.message || "שגיאה בזיהוי הכתוביות. אנא נסה שוב.";
      if (
        friendlyMessage.includes("503") ||
        friendlyMessage.includes("high demand") ||
        friendlyMessage.includes("UNAVAILABLE")
      ) {
        friendlyMessage = "עומס זמני בשירות ה-AI (503). המערכת מוכנה - לחץ על 'נסה שוב'.";
      } else if (
        friendlyMessage.includes("429") ||
        friendlyMessage.includes("RESOURCE_EXHAUSTED")
      ) {
        friendlyMessage = "הגעת למגבלת בקשות רגעית. אנא המתן מספר שניות ולחץ 'נסה שוב'.";
      }

      setAnalysisProgress({
        status: "error",
        currentFrame: 0,
        totalFrames: 0,
        percent: 0,
        message: friendlyMessage,
      });
      setIsAnalyzing(false);
    }
  };

  // Re-translate a specific subtitle cue using Gemini
  const handleRetranslateCue = async (
    cue: SubtitleCue,
    targetLangName?: string,
    tone?: string
  ) => {
    const langToUse = targetLangName || targetLanguage.name;
    const response = await fetch("/api/translate-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: cue.originalText || cue.hebrewText,
        context: `Subtitle cue at timestamp ${cue.startTime}s`,
        targetLanguage: langToUse,
        tone: tone || "informal",
      }),
    });

    let data: any = null;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      data = await response.json().catch(() => null);
    }

    if (!response.ok || !data) {
      throw new Error(data?.error || `שגיאה בתרגום הכתובית (${response.status}).`);
    }

    if (data.hebrewText) {
      handleUpdateCue({
        ...cue,
        hebrewText: data.hebrewText,
        isEdited: true,
      });
    }
  };

  // Cue management with Undo History tracking
  const handleUpdateCue = (updatedCue: SubtitleCue) => {
    pushToUndoHistory(cues);
    setCues((prev) => prev.map((c) => (c.id === updatedCue.id ? updatedCue : c)));
  };

  const handleDeleteCue = (cueId: string) => {
    pushToUndoHistory(cues);
    setCues((prev) => prev.filter((c) => c.id !== cueId));
  };

  const handleAddCue = (newCueData: Partial<SubtitleCue>) => {
    pushToUndoHistory(cues);
    const newCue: SubtitleCue = {
      id: `cue-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      startTime: newCueData.startTime || currentTime,
      endTime: newCueData.endTime || currentTime + 3.0,
      originalText: newCueData.originalText || "",
      hebrewText: newCueData.hebrewText || "כתובית חדשה בעברית",
      detectedLanguage: "Custom",
      ...newCueData,
    };
    setCues((prev) => [...prev, newCue].sort((a, b) => a.startTime - b.startTime));
  };

  const handleShiftAllTimings = (seconds: number) => {
    pushToUndoHistory(cues);
    setCues((prev) =>
      prev.map((c) => ({
        ...c,
        startTime: Math.max(0, parseFloat((c.startTime + seconds).toFixed(2))),
        endTime: Math.max(0.2, parseFloat((c.endTime + seconds).toFixed(2))),
      }))
    );
  };

  // Bulk Offset / Synchronization Handler supporting Fixed, Percentage, and Time-Range scopes
  const handleApplyBulkShift = (options: BulkShiftOptions) => {
    pushToUndoHistory(cues);
    const {
      mode,
      shiftSeconds,
      percentage,
      stretchAnchor,
      scope,
      rangeStartTime,
      rangeEndTime,
      selectedCueIds,
    } = options;

    const minCueTime = cues.length > 0 ? Math.min(...cues.map((c) => c.startTime)) : 0;
    let anchorTime = 0;
    if (stretchAnchor === "first_cue") anchorTime = minCueTime;
    if (stretchAnchor === "range_start" && rangeStartTime !== undefined) anchorTime = rangeStartTime;

    const factor = 1 + percentage / 100;

    const updated = cues.map((cue) => {
      let isTarget = false;
      if (scope === "all") isTarget = true;
      else if (scope === "selected" && selectedCueIds) isTarget = selectedCueIds.includes(cue.id);
      else if (
        scope === "time_range" &&
        rangeStartTime !== undefined &&
        rangeEndTime !== undefined
      ) {
        isTarget = cue.startTime >= rangeStartTime && cue.startTime <= rangeEndTime;
      }

      if (!isTarget) return cue;

      if (mode === "fixed") {
        const newStart = Math.max(0, parseFloat((cue.startTime + shiftSeconds).toFixed(3)));
        const newEnd = Math.max(newStart + 0.1, parseFloat((cue.endTime + shiftSeconds).toFixed(3)));
        return {
          ...cue,
          startTime: newStart,
          endTime: newEnd,
          isEdited: true,
        };
      } else {
        // Percentage / Drift mode
        const newStart = Math.max(
          0,
          parseFloat((anchorTime + (cue.startTime - anchorTime) * factor).toFixed(3))
        );
        const newEnd = Math.max(
          newStart + 0.1,
          parseFloat((anchorTime + (cue.endTime - anchorTime) * factor).toFixed(3))
        );
        return {
          ...cue,
          startTime: newStart,
          endTime: newEnd,
          isEdited: true,
        };
      }
    });

    updated.sort((a, b) => a.startTime - b.startTime);
    setCues(updated);

    const affectedCount = updated.filter((c, i) => c !== cues[i]).length;
    setProjectBannerMessage({
      type: "success",
      text: `הושלם שינוי תזמון קבוצתי עבור ${affectedCount} כתוביות! (ניתן לבטל עם Ctrl+Z)`,
    });
    setTimeout(() => setProjectBannerMessage(null), 5000);
  };

  const handleImportSrt = (importedCues: SubtitleCue[]) => {
    pushToUndoHistory(cues);
    setCues(importedCues);
  };

  // Import full Project Bundle (.json) to resume work
  const handleImportProjectBundle = (bundle: SubtitleProjectBundle) => {
    if (bundle.cues && Array.isArray(bundle.cues)) {
      setCues(bundle.cues);
    }
    if (bundle.styleSettings) {
      setStyles(bundle.styleSettings);
    }
    if (bundle.targetLanguage) {
      const match = TARGET_LANGUAGES.find((l) => l.code === bundle.targetLanguage.code);
      if (match) {
        setTargetLanguage(match);
      } else {
        setTargetLanguage(bundle.targetLanguage);
      }
    }
    if (bundle.metadata?.tonePreference) {
      setTonePreference(bundle.metadata.tonePreference);
    }
    if (bundle.videoReference) {
      if (bundle.videoReference.name) {
        setVideoName(bundle.videoReference.name);
      }
      if (bundle.videoReference.duration) {
        setVideoDuration(bundle.videoReference.duration);
      }
      if (bundle.videoReference.url && !bundle.videoReference.url.startsWith("blob:")) {
        setVideoUrl(bundle.videoReference.url);
      }
    }
    setProjectBannerMessage({
      type: "success",
      text: `הפרויקט "${bundle.projectName || bundle.videoReference?.name || "ללא שם"}" נטען בהצלחה! שוחזרו ${bundle.cues.length} כתוביות, הגדרות העיצוב המותאמות אישית והעדפות התרגום.`,
    });
    setTimeout(() => {
      setProjectBannerMessage(null);
    }, 6000);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e0e0e0] flex flex-col font-sans selection:bg-blue-600 selection:text-white" dir="rtl">
      {/* Top Navigation Bar */}
      <Header
        onFileUpload={handleFileUpload}
        onSelectDemo={handleSelectDemo}
        onStartAnalysis={handleStartAnalysis}
        onOpenExport={() => setShowExportModal(true)}
        onOpenStyles={() => setShowStyles(!showStyles)}
        onImportProject={handleImportProjectBundle}
        hasVideo={!!videoUrl}
        hasCues={cues.length > 0}
        isAnalyzing={isAnalyzing}
        showStyles={showStyles}
      />

      {/* Project Status Notification Banner */}
      {projectBannerMessage && (
        <div className="bg-gradient-to-r from-emerald-950/90 via-[#0f241a] to-emerald-950/90 border-b border-emerald-500/40 px-4 py-2.5 flex items-center justify-between text-xs text-emerald-200 z-20 shadow-lg animate-in slide-in-from-top duration-300">
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <FolderCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-medium text-emerald-100">{projectBannerMessage.text}</span>
            </div>
            <button
              onClick={() => setProjectBannerMessage(null)}
              className="p-1 text-emerald-400 hover:text-white hover:bg-emerald-800/40 rounded transition cursor-pointer"
              title="סגור הודעה"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-2.5 sm:p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start">
        {/* LEFT COLUMN: Video Player & Quick Settings (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <VideoPlayer
            ref={playerRef}
            videoUrl={videoUrl}
            videoName={videoName}
            cues={cues}
            activeCue={activeCue}
            styles={styles}
            onTimeUpdate={setCurrentTime}
            onDurationChange={setVideoDuration}
            onFileDrop={handleFileUpload}
            onToggleStyles={() => setShowStyles(!showStyles)}
            onStartAnalysis={handleStartAnalysis}
            isAnalyzing={isAnalyzing}
            onReloadDemo={() => handleSelectDemo(DEMO_VIDEOS[0])}
          />

          {/* Quick Helper Banner */}
          <div className="bg-[#141414] border border-[#222222] rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs text-gray-300 shadow-md">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0">
                <Info className="w-4 h-4" />
              </div>
              <div>
                <span className="font-semibold text-gray-200 block">
                  הסתרת כתוביות מוטמעות + הטמעת עברית:
                </span>
                <span className="text-[11px] text-gray-400">
                  האפליקציה מכסה את הכתוביות המקוריות המוטמעות בסרטון ומציגה מעליהן כתוביות מעוצבות בעברית.
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowStyles(!showStyles)}
              className="shrink-0 px-3 py-1.5 bg-[#1a1a1a] hover:bg-[#262626] text-blue-400 text-xs font-semibold rounded-md border border-[#333333] transition cursor-pointer"
            >
              הגדרות כיסוי
            </button>
          </div>

          {/* Expandable Styles Panel (Inline for larger screens when toggled) */}
          {showStyles && (
            <div className="animate-in fade-in slide-in-from-top-2">
              <StyleControls
                styles={styles}
                onChange={setStyles}
                onReset={() => setStyles(DEFAULT_STYLES)}
              />
            </div>
          )}

          {/* Action trigger banner for Subtitle Scanning */}
          <div className="bg-gradient-to-r from-blue-900/30 to-[#141414] border border-blue-600/30 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/30">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">סריקה ותרגום אוטומטי מבוסס Gemini</h4>
                <p className="text-[11px] text-gray-400">דוגם פריימים ומזהה טקסט מוטמע בסרטון, מתרגם לעברית ויוצר כתוביות מסונכרנות.</p>
              </div>
            </div>

            <button
              onClick={handleStartAnalysis}
              disabled={isAnalyzing || !videoUrl}
              className="shrink-0 w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition shadow-md shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isAnalyzing ? "סורק פריימים..." : "סרוק ותרגם עכשיו"}</span>
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Subtitle Editor & Tools (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Mobile Tab switcher between Editor and Styles */}
          <div className="flex lg:hidden bg-[#111111] p-1 rounded-lg border border-[#222222] text-xs font-bold">
            <button
              onClick={() => setActiveTab("editor")}
              className={`flex-1 py-2 rounded-md flex items-center justify-center gap-2 transition cursor-pointer ${
                activeTab === "editor"
                  ? "bg-blue-600 text-white shadow"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <Languages className="w-4 h-4" />
              <span>עורך כתוביות ({cues.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("styles")}
              className={`flex-1 py-2 rounded-md flex items-center justify-center gap-2 transition cursor-pointer ${
                activeTab === "styles"
                  ? "bg-blue-600 text-white shadow"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>עיצוב וכיסוי</span>
            </button>
          </div>

          {/* Subtitle Editor / Timeline view */}
          {activeTab === "editor" ? (
            <SubtitleEditor
              cues={cues}
              activeCueId={activeCue?.id || null}
              currentTime={currentTime}
              videoDuration={videoDuration}
              onSeekTo={(time) => {
                playerRef.current?.seekTo(time);
              }}
              onUpdateCue={handleUpdateCue}
              onDeleteCue={handleDeleteCue}
              onAddCue={handleAddCue}
              onRetranslateCue={handleRetranslateCue}
              onShiftAllTimings={handleShiftAllTimings}
              onApplyBulkShift={handleApplyBulkShift}
              onImportSrt={handleImportSrt}
              isAnalyzing={isAnalyzing}
              canUndo={undoHistory.length > 0}
              canRedo={redoHistory.length > 0}
              onUndo={handleUndo}
              onRedo={handleRedo}
              undoCount={undoHistory.length}
              redoCount={redoHistory.length}
              selectedLanguage={targetLanguage}
              onLanguageChange={setTargetLanguage}
              tonePreference={tonePreference}
              onTonePreferenceChange={setTonePreference}
              lastAutoSavedAt={lastAutoSavedAt}
              onManualSave={handleManualSave}
              savedDraftAvailable={savedDraftAvailable}
              onRestoreDraft={handleRestoreDraft}
              onClearSavedDraft={handleClearDraft}
            />
          ) : (
            <div className="lg:hidden">
              <StyleControls
                styles={styles}
                onChange={setStyles}
                onReset={() => setStyles(DEFAULT_STYLES)}
              />
            </div>
          )}
        </div>
      </main>

      {/* MODAL 1: Gemini AI Scanning & Translation Progress */}
      <AnalysisModal
        isOpen={showAnalysisModal}
        onCancel={handleCancelAnalysis}
        onRetry={handleStartAnalysis}
        progress={analysisProgress}
        recentFrames={recentFrames}
      />

      {/* MODAL 2: Export Subtitles & Burned-in Video */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        videoElement={playerRef.current?.getVideoElement() || null}
        sourceHandle={playerRef.current?.getSourceHandle() || null}
        videoName={videoName}
        videoDuration={videoDuration}
        videoUrl={videoUrl}
        cues={cues}
        styles={styles}
        targetLanguage={targetLanguage}
        targetLanguageName={targetLanguage.nativeName}
        tonePreference={tonePreference}
        onUpdateCues={setCues}
      />
    </div>
  );
}
