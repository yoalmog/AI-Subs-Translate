import React, { useState } from "react";
import {
  Download,
  Film,
  FileText,
  FileCode,
  CheckCircle2,
  Loader2,
  Sparkles,
  X,
  Share2,
  Copy,
  ExternalLink,
  Info,
  Eye,
  Play,
  RotateCcw,
  Printer,
  FolderArchive,
  PackageCheck,
} from "lucide-react";
import {
  SubtitleCue,
  SubtitleStyleSettings,
  TargetLanguageInfo,
  TonePreference,
} from "../types";
import {
  generateSrtContent,
  generateVttContent,
  downloadFile,
  downloadBlob,
  shareBlobFile,
  prepareServerDownload,
  formatTimeDisplay,
} from "../utils/timeFormat";
import { exportCueListAsPdf } from "../utils/pdfExporter";
import {
  buildProjectBundle,
  exportProjectAsJsonFile,
} from "../utils/projectBundle";
import {
  exportVideoWithHebrewSubtitles,
  exportVideoPreviewSample,
  ExportProgress,
  ExportSource,
} from "../utils/videoExporter";
import { VideoFrameSource } from "../utils/frameSampler";
import { autoFormatAllCues } from "../utils/subtitleFormatter";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoElement: HTMLVideoElement | null;
  sourceHandle?: VideoFrameSource | null;
  videoName: string;
  videoDuration?: number;
  videoUrl?: string | null;
  cues: SubtitleCue[];
  styles: SubtitleStyleSettings;
  targetLanguage?: TargetLanguageInfo;
  targetLanguageName?: string;
  tonePreference?: TonePreference;
  onUpdateCues?: (cues: SubtitleCue[]) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  videoElement,
  sourceHandle,
  videoName,
  videoDuration,
  videoUrl,
  cues,
  styles,
  targetLanguage,
  targetLanguageName = "עברית",
  tonePreference = "informal",
  onUpdateCues,
}) => {
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [renderedBlob, setRenderedBlob] = useState<Blob | null>(null);
  const [renderedBlobUrl, setRenderedBlobUrl] = useState<string | null>(null);
  const [serverDownloadUrl, setServerDownloadUrl] = useState<string | null>(null);
  const [autoFormatMessage, setAutoFormatMessage] = useState<string | null>(null);

  // Preview Burn-in state (3-second sample)
  const [isPreviewingSample, setIsPreviewingSample] = useState<boolean>(false);
  const [previewSampleProgress, setPreviewSampleProgress] = useState<number>(0);
  const [previewSampleBlobUrl, setPreviewSampleBlobUrl] = useState<string | null>(null);
  const [previewSampleStartTime, setPreviewSampleStartTime] = useState<number>(0);

  const [activeTab, setActiveTab] = useState<"video" | "subtitles">("video");
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [isPreparingServerDl, setIsPreparingServerDl] = useState<boolean>(false);

  // Handle Auto-Format before export
  const handleAutoFormatBeforeExport = () => {
    const { formattedCues, modifiedCount } = autoFormatAllCues(cues, true);
    if (onUpdateCues) {
      onUpdateCues(formattedCues);
    }
    if (modifiedCount > 0) {
      setAutoFormatMessage(`הושלם ניקוי ועיצוב אוטומטי עבור ${modifiedCount} כתוביות!`);
    } else {
      setAutoFormatMessage("כל הכתוביות כבר מעוצבות ותקינות.");
    }
    setTimeout(() => setAutoFormatMessage(null), 3500);
  };

  if (!isOpen) return null;

  const baseFileName = videoName.replace(/\.[^/.]+$/, "") || "video";
  const videoFileName = `${baseFileName}_hebrew_subtitles.webm`;

  const totalDuration = sourceHandle?.duration || videoElement?.duration || 10;

  // Handle Generating 3-Second Burn-in Sample Preview
  const handleGeneratePreviewSample = async (customStartSec?: number) => {
    const src: ExportSource = sourceHandle || {
      type: "video",
      videoElement,
      duration: totalDuration,
    };

    const startSec = typeof customStartSec === "number" ? customStartSec : previewSampleStartTime;

    setIsPreviewingSample(true);
    setPreviewSampleProgress(10);

    try {
      const sampleBlob = await exportVideoPreviewSample(
        src,
        cues,
        styles,
        startSec,
        3,
        (prog) => {
          setPreviewSampleProgress(prog.percent);
        }
      );

      const url = URL.createObjectURL(sampleBlob);
      if (previewSampleBlobUrl) {
        try {
          URL.revokeObjectURL(previewSampleBlobUrl);
        } catch (_) {}
      }
      setPreviewSampleBlobUrl(url);
    } catch (err: any) {
      console.error("Preview sample error:", err);
    } finally {
      setIsPreviewingSample(false);
    }
  };

  // Handle Video Burn-in Export
  const handleStartVideoExport = async () => {
    const src: ExportSource = sourceHandle || {
      type: "video",
      videoElement,
      duration: totalDuration,
    };

    setRenderedBlob(null);
    setRenderedBlobUrl(null);
    setServerDownloadUrl(null);
    setExportProgress({
      percent: 0,
      currentSecond: 0,
      totalSeconds: totalDuration,
      status: "rendering",
    });

    try {
      const blob = await exportVideoWithHebrewSubtitles(
        src,
        cues,
        styles,
        (prog) => {
          setExportProgress(prog);
        }
      );

      const url = URL.createObjectURL(blob);
      setRenderedBlob(blob);
      setRenderedBlobUrl(url);

      // Pre-generate server download URL in background
      prepareServerDownload(blob, videoFileName).then((sUrl) => {
        if (sUrl) setServerDownloadUrl(sUrl);
      });
    } catch (err: any) {
      console.error("Export error:", err);
      setExportProgress({
        percent: 0,
        currentSecond: 0,
        totalSeconds: 0,
        status: "error",
        error: err.message || "שגיאה בייצוא הווידאו.",
      });
    }
  };

  // Download rendered video file via browser blob
  const handleDownloadRenderedVideo = async () => {
    if (!renderedBlob) {
      if (renderedBlobUrl) {
        const a = document.createElement("a");
        a.href = renderedBlobUrl;
        a.download = videoFileName;
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        setTimeout(() => document.body.removeChild(a), 500);
      }
      return;
    }

    // Try direct blob download
    downloadBlob(renderedBlob, videoFileName);

    // If server download link is ready, also provide it as active fallback
    if (!serverDownloadUrl) {
      setIsPreparingServerDl(true);
      const sUrl = await prepareServerDownload(renderedBlob, videoFileName);
      if (sUrl) {
        setServerDownloadUrl(sUrl);
      }
      setIsPreparingServerDl(false);
    }
  };

  // Share via mobile Share API
  const handleShareVideo = async () => {
    if (!renderedBlob) return;
    const shared = await shareBlobFile(renderedBlob, videoFileName, "סרטון עם כתוביות בעברית");
    if (!shared) {
      // Fallback to opening video in new tab
      if (renderedBlobUrl) {
        window.open(renderedBlobUrl, "_blank");
      }
    }
  };

  // Download SRT
  const handleDownloadSrt = async (useHebrew: boolean = true) => {
    const content = generateSrtContent(cues, useHebrew);
    const suffix = useHebrew ? "_hebrew.srt" : "_original.srt";
    const filename = `${baseFileName}${suffix}`;
    await downloadFile(content, filename, "application/x-subrip;charset=utf-8");
  };

  // Download VTT
  const handleDownloadVtt = async () => {
    const content = generateVttContent(cues, true);
    const filename = `${baseFileName}_hebrew.vtt`;
    await downloadFile(content, filename, "text/vtt;charset=utf-8");
  };

  // Download JSON transcript
  const handleDownloadJson = async () => {
    const content = JSON.stringify(cues, null, 2);
    const filename = `${baseFileName}_subtitles.json`;
    await downloadFile(content, filename, "application/json;charset=utf-8");
  };

  const currentTargetLangInfo: TargetLanguageInfo = targetLanguage || {
    code: "he",
    name: targetLanguageName || "Hebrew",
    nativeName: targetLanguageName || "עברית",
    flag: "🇮🇱",
  };

  // Generate complete SubtitleProjectBundle
  const generateCurrentProjectBundle = () => {
    return buildProjectBundle({
      videoName,
      videoDuration: videoDuration || totalDuration,
      videoUrl,
      targetLanguage: currentTargetLangInfo,
      styleSettings: styles,
      cues,
      tonePreference: (tonePreference as TonePreference) || "informal",
    });
  };

  // Download complete SubtitleProjectBundle as .json file
  const handleDownloadProjectBundle = async () => {
    const bundle = generateCurrentProjectBundle();
    await exportProjectAsJsonFile(bundle, `${baseFileName}_project.json`);
  };

  // Copy Project Bundle JSON to clipboard
  const handleCopyProjectBundle = () => {
    const bundle = generateCurrentProjectBundle();
    navigator.clipboard.writeText(JSON.stringify(bundle, null, 2)).then(() => {
      setCopiedType("project");
      setTimeout(() => setCopiedType(null), 2500);
    });
  };

  // Copy Subtitles content to clipboard
  const handleCopyText = (type: "srt" | "vtt" | "json") => {
    let text = "";
    if (type === "srt") text = generateSrtContent(cues, true);
    else if (type === "vtt") text = generateVttContent(cues, true);
    else if (type === "json") text = JSON.stringify(cues, null, 2);

    navigator.clipboard.writeText(text).then(() => {
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2500);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in overflow-y-auto" id="export-modal">
      <div className="bg-[#141414] border border-[#222222] rounded-xl max-w-xl w-full p-4 sm:p-6 shadow-2xl relative overflow-hidden flex flex-col gap-4 my-auto">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#222222]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-rubik">
                ייצוא והורדה
              </h3>
              <p className="text-xs text-gray-400">
                הורדת הווידאו המעובד או קובצי כתוביות בעברית
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-md hover:bg-[#222222] transition cursor-pointer"
            aria-label="סגור חלון"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Auto-Format Pre-Export Card */}
        <div className="bg-[#171c19] border border-emerald-500/30 rounded-lg p-2.5 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-emerald-200">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <span className="font-bold text-white">עיצוב וניקוי אוטומטי (Auto-Format):</span>{" "}
              <span className="text-gray-300 text-[11px]">מנקה רווחים מיותרים, מיישר פיסוק ומתקן אותיות לפני הייצוא.</span>
            </div>
          </div>
          <button
            type="button"
            id="export-modal-auto-format-btn"
            onClick={handleAutoFormatBeforeExport}
            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs transition shrink-0 cursor-pointer shadow-sm flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3 text-amber-300" />
            <span>הפעל עיצוב אוטומטי</span>
          </button>
        </div>

        {/* Auto-format Success Toast if any */}
        {autoFormatMessage && (
          <div className="p-2 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs rounded-md flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{autoFormatMessage}</span>
          </div>
        )}

        {/* Tab Selectors */}
        <div className="flex bg-[#0d0d0d] p-1 rounded-lg border border-[#222222] text-xs font-semibold">
          <button
            onClick={() => setActiveTab("video")}
            className={`flex-1 py-2 rounded-md flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === "video"
                ? "bg-blue-600 text-white shadow"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <Film className="w-4 h-4" />
            <span>ייצוא סרטון וידאו (Burn-in)</span>
          </button>

          <button
            onClick={() => setActiveTab("subtitles")}
            className={`flex-1 py-2 rounded-md flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === "subtitles"
                ? "bg-blue-600 text-white shadow"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>הורדת קבצי כתוביות (SRT / VTT)</span>
          </button>
        </div>

        {/* TAB 1: VIDEO BURN-IN EXPORT */}
        {activeTab === "video" && (
          <div className="flex flex-col gap-3">
            <div className="bg-[#0d0d0d] p-3.5 sm:p-4 rounded-lg border border-[#222222] flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white mb-0.5">
                    הטמעת כתוביות ופס כיסוי לתוך הווידאו
                  </h4>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    מייצר קובץ וידאו חדש שבו הכתוביות בעברית ופס הסתרת הכתוביות המקוריות מוטמעים ישירות בקובץ.
                  </p>
                </div>
              </div>

              {/* Render Status & Progress */}
              {exportProgress && exportProgress.status === "rendering" && (
                <div className="space-y-2 pt-2 border-t border-[#222222]">
                  <div className="flex items-center justify-between text-xs text-gray-300">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                      <span>מעבד פריימים ומטמיע כתוביות...</span>
                    </span>
                    <span className="font-mono text-blue-400 font-bold">
                      {exportProgress.percent}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#222222] rounded-full overflow-hidden">
                    <div
                      style={{ width: `${exportProgress.percent}%` }}
                      className="h-full bg-blue-600 transition-all duration-150"
                    />
                  </div>
                </div>
              )}

              {/* Completed Ready to download */}
              {renderedBlobUrl && (
                <div className="flex flex-col gap-3 pt-2 border-t border-[#222222]">
                  <div className="flex items-center gap-2 text-green-400 text-xs font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>הסרטון עובד בהצלחה ומוכן להורדה!</span>
                  </div>

                  {/* Video Preview Player with native controls (allows 3-dots download) */}
                  <div className="rounded-lg overflow-hidden border border-[#333333] bg-black">
                    <video
                      src={renderedBlobUrl}
                      controls
                      playsInline
                      className="w-full max-h-52 object-contain"
                    />
                  </div>

                  {/* Primary Download Buttons */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      onClick={handleDownloadRenderedVideo}
                      className="py-2.5 px-3 bg-green-600 hover:bg-green-500 text-white font-bold text-xs rounded-lg transition flex items-center justify-center gap-2 shadow-lg shadow-green-900/30 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>הורד סרטון למכשיר</span>
                    </button>

                    <button
                      onClick={handleShareVideo}
                      className="py-2.5 px-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg transition flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30 cursor-pointer"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>שתף / שמור לגלריה</span>
                    </button>
                  </div>

                  {/* Server Download Link (Bypasses mobile iframe download blocks) */}
                  {serverDownloadUrl && (
                    <a
                      href={serverDownloadUrl}
                      download={videoFileName}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2 px-3 bg-[#1c1c1c] hover:bg-[#252525] border border-[#333333] text-gray-200 text-xs font-medium rounded-lg transition flex items-center justify-center gap-2 text-center"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
                      <span>קישור הורדה ישיר (שרת)</span>
                    </a>
                  )}

                  {/* Mobile Tip Box */}
                  <div className="bg-[#181818] p-2.5 rounded-lg border border-[#2a2a2a] flex items-start gap-2 text-[11px] text-gray-400">
                    <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-gray-200">טיפ למשתמשי כרום במובייל:</strong> אם ההורדה בדפדפן נחסמת, לחצו על <span className="text-blue-400 font-semibold">"שתף / שמור לגלריה"</span>, או לחצו על 3 הנקודות בנגן הווידאו למעלה ובחרו <span className="text-gray-200 font-semibold">"הורדה"</span>.
                    </div>
                  </div>
                </div>
              )}

              {/* Start export button and Preview Burn-in section */}
              {(!exportProgress || exportProgress.status === "error") && !renderedBlobUrl && (
                <div className="flex flex-col gap-3 pt-1 border-t border-[#222222]">
                  {/* Preview Burn-in Box */}
                  <div className="p-3 bg-[#121212] rounded-lg border border-[#262626] flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                        <Eye className="w-4 h-4" />
                        <span>תצוגה מקדימה מהירה (דוגמית 3 שניות)</span>
                      </div>
                      <span className="text-[10px] text-gray-400">
                        ללא המתנה לייצוא מלא
                      </span>
                    </div>

                    <p className="text-[11px] text-gray-400 leading-normal">
                      מייצר קליפ וידאו קצר באורך 3 שניות כדי לוודא שעיצוב הכתוביות, הגופן ופס הכיסוי מושלמים לפני הרינדור המלא.
                    </p>

                    {/* Choose sample start time */}
                    <div className="flex items-center gap-2 text-xs text-gray-300">
                      <span className="text-[11px] text-gray-400">התחל משנייה:</span>
                      <select
                        value={previewSampleStartTime}
                        onChange={(e) => setPreviewSampleStartTime(Number(e.target.value))}
                        className="bg-[#1a1a1a] border border-[#333333] rounded px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-none"
                      >
                        <option value={0}>0:00 (התחלת הסרטון)</option>
                        {cues.slice(0, 10).map((cue, idx) => (
                          <option key={cue.id} value={Math.floor(cue.startTime)}>
                            {formatTimeDisplay(cue.startTime)} - {cue.hebrewText.substring(0, 20) || cue.originalText.substring(0, 20)}...
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() => handleGeneratePreviewSample()}
                        disabled={isPreviewingSample}
                        className="mr-auto px-3 py-1 bg-amber-600/90 hover:bg-amber-500 text-white font-semibold text-xs rounded transition flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                      >
                        {isPreviewingSample ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>מרנדר {previewSampleProgress}%</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3 fill-current" />
                            <span>הפק דוגמית (3s)</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Preview Sample Player */}
                    {previewSampleBlobUrl && (
                      <div className="mt-1 flex flex-col gap-2 p-2 bg-black/60 rounded-lg border border-amber-500/30">
                        <div className="flex items-center justify-between text-[11px] text-amber-300 font-medium">
                          <span>דוגמית בת 3 שניות מוכנה:</span>
                          <button
                            onClick={() => handleGeneratePreviewSample()}
                            className="text-gray-400 hover:text-white flex items-center gap-1 text-[10px]"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>הפק מחדש</span>
                          </button>
                        </div>
                        <video
                          src={previewSampleBlobUrl}
                          controls
                          autoPlay
                          loop
                          playsInline
                          className="w-full max-h-44 object-contain rounded bg-black"
                        />
                      </div>
                    )}
                  </div>

                  {/* Primary Full Video Export Button */}
                  <button
                    onClick={handleStartVideoExport}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>התחל ייצוא סרטון מלא</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: SUBTITLE FILES DOWNLOAD & PROJECT EXPORT */}
        {activeTab === "subtitles" && (
          <div className="grid grid-cols-1 gap-2.5">
            {/* FULL PROJECT BUNDLE (.json) FOR RESUMPTION OF WORK */}
            <div className="bg-gradient-to-r from-blue-950/40 via-[#121218] to-[#0f0f0f] p-4 rounded-xl border border-blue-500/40 hover:border-blue-400/60 transition shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <FolderArchive className="w-5 h-5 text-blue-400" />
                  <span className="text-sm font-bold text-white">ייצוא פרויקט מלא (Project Bundle JSON)</span>
                  <span className="px-2 py-0.5 bg-blue-900/60 text-blue-300 border border-blue-500/40 text-[10px] rounded-full font-bold">
                    Project Backup
                  </span>
                </div>
                <p className="text-[11px] text-gray-300 mt-1 leading-relaxed max-w-md">
                  מאגד את כל נתוני הווידאו, כל הכתוביות והזמנים, הגדרות העיצוב המותאמות אישית (צבעים, פונטים, מיקום, כיסוי), שפת היעד וההגדרות — לשמירה והמשך עבודה מאוחר יותר.
                </p>
                <div className="flex items-center gap-3 mt-2 text-[10px] text-blue-300/80 font-mono">
                  <span>כתוביות: {cues.length}</span>
                  <span>•</span>
                  <span>פונט: {styles.fontFamily}</span>
                  <span>•</span>
                  <span>שפה: {currentTargetLangInfo.nativeName}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  id="copy-project-json-btn"
                  onClick={handleCopyProjectBundle}
                  className="px-3 py-2 bg-[#1c1c1c] hover:bg-[#282828] text-gray-200 text-xs font-medium rounded-lg border border-[#333333] hover:border-gray-500 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                  title="העתק את קובץ ה-JSON של הפרויקט ללוח"
                >
                  <Copy className="w-3.5 h-3.5 text-gray-400" />
                  <span>{copiedType === "project" ? "הועתק ללוח!" : "העתק JSON"}</span>
                </button>
                <button
                  id="export-project-bundle-btn"
                  onClick={handleDownloadProjectBundle}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-lg transition flex items-center gap-2 shadow-md shadow-blue-600/30 cursor-pointer active:scale-98"
                  title="הורד קובץ פרויקט JSON מלא לשמירה ולהמשך עבודה"
                >
                  <PackageCheck className="w-4 h-4 text-white" />
                  <span>הורד חבילת פרויקט</span>
                </button>
              </div>
            </div>

            {/* SRT Download */}
            <div className="bg-[#0d0d0d] p-3.5 rounded-lg border border-[#222222] flex items-center justify-between hover:border-[#333333] transition">
              <div>
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-bold text-white">קובץ SRT בעברית (SubRip)</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  קידוד UTF-8 מלא ל-VLC, טלוויזיות ונגני מדיה.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleCopyText("srt")}
                  className="px-2.5 py-1.5 bg-[#1c1c1c] hover:bg-[#282828] text-gray-300 text-xs font-medium rounded-md border border-[#333333] transition flex items-center gap-1 cursor-pointer"
                  title="העתק תוכן SRT"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedType === "srt" ? "הועתק!" : "העתק"}</span>
                </button>
                <button
                  onClick={() => handleDownloadSrt(true)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-md transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>הורד SRT</span>
                </button>
              </div>
            </div>

            {/* WebVTT Download */}
            <div className="bg-[#0d0d0d] p-3.5 rounded-lg border border-[#222222] flex items-center justify-between hover:border-[#333333] transition">
              <div>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-bold text-white">קובץ WebVTT (.vtt)</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  מתאים לנגני אינטרנט, HTML5 Video ואתרים.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleCopyText("vtt")}
                  className="px-2.5 py-1.5 bg-[#1c1c1c] hover:bg-[#282828] text-gray-300 text-xs font-medium rounded-md border border-[#333333] transition flex items-center gap-1 cursor-pointer"
                  title="העתק תוכן VTT"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedType === "vtt" ? "הועתק!" : "העתק"}</span>
                </button>
                <button
                  onClick={handleDownloadVtt}
                  className="px-3 py-1.5 bg-[#1a1a1a] hover:bg-[#262626] text-gray-200 text-xs font-semibold rounded-md border border-[#333333] transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>הורד VTT</span>
                </button>
              </div>
            </div>

            {/* JSON / Transcript */}
            <div className="bg-[#0d0d0d] p-3.5 rounded-lg border border-[#222222] flex items-center justify-between hover:border-[#333333] transition">
              <div>
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-green-400" />
                  <span className="text-xs font-bold text-white">קובץ JSON מלא</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  מכיל את הטקסט המקורי, התרגום וזמני התחלה וסיום.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleCopyText("json")}
                  className="px-2.5 py-1.5 bg-[#1c1c1c] hover:bg-[#282828] text-gray-300 text-xs font-medium rounded-md border border-[#333333] transition flex items-center gap-1 cursor-pointer"
                  title="העתק JSON"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedType === "json" ? "הועתק!" : "העתק"}</span>
                </button>
                <button
                  onClick={handleDownloadJson}
                  className="px-3 py-1.5 bg-[#1a1a1a] hover:bg-[#262626] text-gray-200 text-xs font-semibold rounded-md border border-[#333333] transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>הורד JSON</span>
                </button>
              </div>
            </div>

            {/* PDF Cue List for External Proofreading & Review */}
            <div className="bg-[#0d0d0d] p-3.5 rounded-lg border border-red-500/30 hover:border-red-500/50 transition flex items-center justify-between shadow-sm">
              <div>
                <div className="flex items-center gap-2">
                  <Printer className="w-4 h-4 text-red-400" />
                  <span className="text-xs font-bold text-white">מסמך הגהה וסקירה PDF (Cue List)</span>
                  <span className="px-1.5 py-0.5 bg-red-950/80 text-red-300 border border-red-500/40 text-[10px] rounded font-bold">PDF / Print</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  טבלה מסודרת להדפסה ולסקירה חיצונית הכוללת עמודות עבור: 'Start Time', 'End Time', ו-'Hebrew Text'.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  id="export-pdf-btn"
                  onClick={() => exportCueListAsPdf(cues, videoName, targetLanguageName)}
                  className="px-3.5 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold rounded-md transition flex items-center gap-1.5 shadow-md cursor-pointer active:scale-98"
                  title="פתח והדפס רשימת כתוביות כקובץ PDF להגהה וסקירה"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>ייצוא PDF להגהה</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer info */}
        <div className="flex items-center justify-between pt-2 border-t border-[#222222] text-xs text-gray-500">
          <span>סך הכול {cues.length} כתוביות מוכנות לייצוא</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#1a1a1a] hover:bg-[#262626] text-gray-300 rounded-md border border-[#333333] transition cursor-pointer hover:text-white"
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
};

