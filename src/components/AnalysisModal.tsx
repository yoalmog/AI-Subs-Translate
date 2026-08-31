import React, { useState, useEffect } from "react";
import { Sparkles, CheckCircle2, AlertCircle, Loader2, Film, RefreshCw, X, SlidersHorizontal, Globe, Eye, Zap, Search } from "lucide-react";
import { AnalysisProgress } from "../types";

export interface SourceLanguageOption {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

export interface DetectedLanguage5sResult {
  detectedLanguageName: string;
  detectedLanguageCode: string;
  nativeName: string;
  flag: string;
  sampleText?: string;
  confidence?: number;
}

export const AVAILABLE_SOURCE_LANGUAGES: SourceLanguageOption[] = [
  { code: "auto", name: "Auto-detect", nativeName: "זיהוי שפה אוטומטי", flag: "🌐" },
  { code: "en", name: "English", nativeName: "אנגלית", flag: "🇬🇧" },
  { code: "es", name: "Spanish", nativeName: "ספרדית", flag: "🇪🇸" },
  { code: "fr", name: "French", nativeName: "צרפתית", flag: "🇫🇷" },
  { code: "de", name: "German", nativeName: "גרמנית", flag: "🇩🇪" },
  { code: "ar", name: "Arabic", nativeName: "ערבית", flag: "🇸🇦" },
  { code: "ru", name: "Russian", nativeName: "רוסית", flag: "🇷🇺" },
  { code: "it", name: "Italian", nativeName: "איטלקית", flag: "🇮🇹" },
  { code: "pt", name: "Portuguese", nativeName: "פורטוגזית", flag: "🇵🇹" },
  { code: "ja", name: "Japanese", nativeName: "יפנית", flag: "🇯🇵" },
  { code: "zh", name: "Chinese", nativeName: "סינית", flag: "🇨🇳" },
  { code: "he", name: "Hebrew", nativeName: "עברית", flag: "🇮🇱" },
];

interface AnalysisModalProps {
  isOpen: boolean;
  progress: AnalysisProgress;
  recentFrames: string[];
  onCancel: () => void;
  onRetry?: () => void;
  // Frame Enhancement
  enhanceFrames?: boolean;
  onToggleEnhanceFrames?: (enabled: boolean) => void;
  // Secondary Source Languages
  selectedSourceLanguages?: string[];
  onSourceLanguagesChange?: (langs: string[]) => void;
  // Feature: 5s Language Auto-Detection
  onDetectLanguageFirst5s?: () => Promise<DetectedLanguage5sResult | null>;
}

export const AnalysisModal: React.FC<AnalysisModalProps> = ({
  isOpen,
  progress,
  recentFrames,
  onCancel,
  onRetry,
  enhanceFrames = true,
  onToggleEnhanceFrames,
  selectedSourceLanguages = ["Auto-detect"],
  onSourceLanguagesChange,
  onDetectLanguageFirst5s,
}) => {
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [isDetecting5s, setIsDetecting5s] = useState(false);
  const [detected5sResult, setDetected5sResult] = useState<DetectedLanguage5sResult | null>(null);
  const [hasApplied5s, setHasApplied5s] = useState(false);
  const [hasAutoRun5s, setHasAutoRun5s] = useState(false);

  // Auto-run 5s language detection when modal opens if not run yet
  useEffect(() => {
    if (isOpen && onDetectLanguageFirst5s && !hasAutoRun5s && !isDetecting5s && !detected5sResult) {
      setHasAutoRun5s(true);
      run5sDetection();
    }
  }, [isOpen, onDetectLanguageFirst5s, hasAutoRun5s]);

  const run5sDetection = async () => {
    if (!onDetectLanguageFirst5s) return;
    setIsDetecting5s(true);
    setHasApplied5s(false);
    try {
      const result = await onDetectLanguageFirst5s();
      if (result) {
        setDetected5sResult(result);
      }
    } catch (e) {
      console.warn("Auto 5s language detection failed:", e);
    } finally {
      setIsDetecting5s(false);
    }
  };

  if (!isOpen) return null;

  const toggleSourceLang = (langName: string) => {
    if (!onSourceLanguagesChange) return;

    if (langName === "Auto-detect") {
      onSourceLanguagesChange(["Auto-detect"]);
      return;
    }

    let updated = selectedSourceLanguages.filter((l) => l !== "Auto-detect");
    if (updated.includes(langName)) {
      updated = updated.filter((l) => l !== langName);
    } else {
      updated.push(langName);
    }

    if (updated.length === 0) {
      updated = ["Auto-detect"];
    }
    onSourceLanguagesChange(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in" id="analysis-modal" dir="rtl">
      <div className="bg-[#141414] border border-[#222222] rounded-xl max-w-lg w-full p-6 shadow-2xl relative overflow-hidden flex flex-col gap-5 max-h-[92vh] overflow-y-auto custom-scrollbar">
        {/* Top ambient glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-rubik">
                זיהוי ותרגום כתוביות מובנות ב-AI
              </h3>
              <p className="text-xs text-gray-400">
                סורק פריימים, מזהה טקסט מוטמע ומתרגם מול מנוע Gemini
              </p>
            </div>
          </div>

          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-[#222222] transition cursor-pointer"
            title="סגור / ביטול"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 5-Second Source Language Auto-Detection & Suggestion Banner */}
        <div className="bg-[#111927] border border-blue-500/30 rounded-lg p-3 space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <div>
                <span className="text-xs font-bold text-gray-200 block">
                  אבחון שפת מקור מ-5 השניות הראשונות
                </span>
                <span className="text-[10px] text-gray-400">
                  דוגם 5 שניות ראשונות ומזהה אוטומטית את שפת הכתוביות המקורית
                </span>
              </div>
            </div>

            {onDetectLanguageFirst5s && (
              <button
                type="button"
                id="detect-5s-lang-btn"
                onClick={run5sDetection}
                disabled={isDetecting5s}
                className="px-2.5 py-1 bg-purple-950/80 hover:bg-purple-900 border border-purple-500/40 text-purple-200 text-[11px] font-bold rounded-md transition cursor-pointer flex items-center gap-1 disabled:opacity-50"
                title="הפעל אבחון 5 שניות מחדש"
              >
                {isDetecting5s ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-purple-300" />
                    <span>מזהה...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3 h-3 text-purple-300" />
                    <span>{detected5sResult ? "אבחן מחדש" : "אבחן שפה"}</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Active detection state */}
          {isDetecting5s && (
            <div className="flex items-center gap-2 p-2 bg-purple-950/40 border border-purple-800/40 rounded-md text-[11px] text-purple-200 animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400 shrink-0" />
              <span>סורק 5 שניות ראשונות... מזהה טקסט מוטמע ושפת מקור ב-Gemini AI</span>
            </div>
          )}

          {/* Detected language suggestion banner */}
          {!isDetecting5s && detected5sResult && (
            <div className="p-2.5 bg-gradient-to-r from-purple-950/70 via-indigo-950/70 to-slate-900 border border-purple-500/50 rounded-md space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{detected5sResult.flag}</span>
                  <div>
                    <span className="text-xs font-bold text-white block">
                      שפת מקור מומלצת: {detected5sResult.nativeName} ({detected5sResult.detectedLanguageName})
                    </span>
                    {detected5sResult.confidence && (
                      <span className="text-[10px] text-purple-300">
                        רמת ודאות זיהוי: {Math.round(detected5sResult.confidence * 100)}%
                      </span>
                    )}
                  </div>
                </div>

                {hasApplied5s ? (
                  <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold rounded-md flex items-center gap-1 shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>הוגדרה בהצלחה ✓</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    id="apply-detected-lang-btn"
                    onClick={() => {
                      if (onSourceLanguagesChange) {
                        const matchedOpt = AVAILABLE_SOURCE_LANGUAGES.find(
                          (o) =>
                            o.name.toLowerCase() === detected5sResult.detectedLanguageName.toLowerCase() ||
                            o.nativeName === detected5sResult.nativeName ||
                            o.code === detected5sResult.detectedLanguageCode
                        );
                        const targetName = matchedOpt ? matchedOpt.name : detected5sResult.detectedLanguageName;
                        onSourceLanguagesChange([targetName]);
                        setHasApplied5s(true);
                      }
                    }}
                    className="px-3 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-[11px] font-bold rounded-md transition shadow-md cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>החל והגדר שפה זו</span>
                  </button>
                )}
              </div>

              {detected5sResult.sampleText && (
                <div className="text-[10px] text-gray-300 bg-black/40 px-2 py-1 rounded border border-purple-900/40 font-mono truncate">
                  <span className="text-purple-400 font-semibold">טקסט מזוהה (0-5s): </span>
                  <span>"{detected5sResult.sampleText}"</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* OCR Pre-Processing Controls & Language Selector */}
        <div className="bg-[#0f141d] border border-blue-900/30 rounded-lg p-3 space-y-2.5">
          {/* Frame Enhancement Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-md ${enhanceFrames ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-gray-800 text-gray-400"}`}>
                <Zap className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-gray-200 block">
                  שיפור פריים ופילטר ניגודיות ל-OCR
                </span>
                <span className="text-[10px] text-gray-400">
                  מפעיל חידוד קצוות וניגודיות (+45%) לזיהוי טקסט קטן או חלש
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onToggleEnhanceFrames && onToggleEnhanceFrames(!enhanceFrames)}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition cursor-pointer flex items-center gap-1 ${
                enhanceFrames
                  ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              <span>{enhanceFrames ? "פעיל ✨" : "כבוי"}</span>
            </button>
          </div>

          <div className="border-t border-gray-800/80 my-1" />

          {/* Source Language Selector */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <div className="flex items-center gap-1.5 text-blue-300 font-medium">
                <Globe className="w-3.5 h-3.5 text-blue-400" />
                <span>שפות מקור לזיהוי (ראשי/משני):</span>
              </div>
              <button
                type="button"
                onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                className="text-[11px] text-blue-400 hover:text-blue-300 hover:underline cursor-pointer font-medium"
              >
                {showLanguageDropdown ? "סגור רשימה" : "שנה שפות מקור"}
              </button>
            </div>

            {/* Active Source Language Badges */}
            <div className="flex flex-wrap gap-1.5">
              {selectedSourceLanguages.map((langName) => {
                const opt = AVAILABLE_SOURCE_LANGUAGES.find((o) => o.name === langName || o.nativeName === langName) || {
                  flag: "🌐",
                  nativeName: langName,
                };
                return (
                  <span
                    key={langName}
                    className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[11px] font-medium flex items-center gap-1"
                  >
                    <span>{opt.flag}</span>
                    <span>{opt.nativeName}</span>
                  </span>
                );
              })}
            </div>

            {/* Source Language Selector Dropdown Grid */}
            {showLanguageDropdown && (
              <div className="mt-2.5 p-2 bg-[#121824] border border-[#232f48] rounded-lg grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                {AVAILABLE_SOURCE_LANGUAGES.map((opt) => {
                  const isSelected = selectedSourceLanguages.includes(opt.name) || (opt.code === "auto" && selectedSourceLanguages.includes("Auto-detect"));
                  return (
                    <button
                      key={opt.code}
                      type="button"
                      onClick={() => toggleSourceLang(opt.name)}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium transition cursor-pointer text-right ${
                        isSelected
                          ? "bg-blue-600 text-white shadow-sm"
                          : "bg-[#1a2336] text-gray-300 hover:bg-[#24314c]"
                      }`}
                    >
                      <span className="text-xs">{opt.flag}</span>
                      <span className="truncate flex-1">{opt.nativeName}</span>
                      {isSelected && <CheckCircle2 className="w-3 h-3 text-white shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Progress Stages */}
        <div className="space-y-3 bg-[#0d0d0d] p-4 rounded-lg border border-[#222222]">
          {/* Stage 1: Frame Sampling */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              {progress.status === "sampling" ? (
                <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
              ) : progress.status === "analyzing" || progress.status === "completed" ? (
                <CheckCircle2 className="w-4 h-4 text-green-400" />
              ) : (
                <div className="w-4 h-4 rounded-full border border-[#333333]" />
              )}
              <span className={progress.status === "sampling" ? "text-blue-300 font-bold" : "text-gray-300"}>
                דגימת פריימים מהסרטון {enhanceFrames && "(עם שיפור פילטרים)"}
              </span>
            </div>
            <span className="font-mono text-gray-400">
              {progress.currentFrame}/{progress.totalFrames || 24}
            </span>
          </div>

          {/* Stage 2: Gemini Multimodal Subtitle OCR */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              {progress.status === "analyzing" ? (
                <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
              ) : progress.status === "completed" ? (
                <CheckCircle2 className="w-4 h-4 text-green-400" />
              ) : (
                <div className="w-4 h-4 rounded-full border border-[#333333]" />
              )}
              <span className={progress.status === "analyzing" ? "text-blue-300 font-bold" : "text-gray-300"}>
                זיהוי OCR מוטמע ב-Gemini Vision
              </span>
            </div>
            <span className="text-[11px] text-blue-400 font-medium font-mono">
              {progress.status === "analyzing" ? "מעבד..." : progress.status === "completed" ? "הושלם" : ""}
            </span>
          </div>

          {/* Stage 3: Hebrew Translation */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              {progress.status === "completed" ? (
                <CheckCircle2 className="w-4 h-4 text-green-400" />
              ) : progress.status === "analyzing" ? (
                <div className="w-4 h-4 rounded-full border border-[#333333] animate-pulse" />
              ) : (
                <div className="w-4 h-4 rounded-full border border-[#333333]" />
              )}
              <span className={progress.status === "completed" ? "text-green-300 font-bold" : "text-gray-400"}>
                תרגום מדויק לעברית וסינכרון עיתוי
              </span>
            </div>
            {progress.extractedCuesCount !== undefined && progress.extractedCuesCount > 0 && (
              <span className="text-green-400 font-bold font-mono">
                {progress.extractedCuesCount} כתוביות זוהו
              </span>
            )}
          </div>
        </div>

        {/* Live Progress Bar */}
        <div>
          <div className="flex items-center justify-between text-xs text-gray-300 mb-1.5 font-medium">
            <span>{progress.message || "מבצע סריקה..."}</span>
            <span className="font-mono font-bold text-blue-400">{progress.percent}%</span>
          </div>
          <div className="w-full h-2 bg-[#222222] rounded-full overflow-hidden">
            <div
              style={{ width: `${Math.min(100, Math.max(5, progress.percent))}%` }}
              className="h-full bg-blue-600 transition-all duration-300 rounded-full shadow-lg shadow-blue-500/50"
            />
          </div>
        </div>

        {/* Thumbnail Preview strip of sampled video frames */}
        {recentFrames.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold text-gray-400 mb-1.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5 text-blue-400" />
                <span>פריימים שנדגמו:</span>
              </div>
              {enhanceFrames && (
                <span className="text-[10px] text-amber-400 font-semibold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                  ✨ פילטר ניגודיות + חידוד מופעל
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
              {recentFrames.map((frameUrl, idx) => (
                <div key={idx} className="relative shrink-0">
                  <img
                    src={frameUrl}
                    alt={`Sample frame ${idx}`}
                    className="w-16 h-10 object-cover rounded-md border border-[#2e2e2e] shadow"
                  />
                  {enhanceFrames && (
                    <span className="absolute bottom-0.5 right-0.5 bg-black/70 text-[8px] text-amber-300 font-bold px-1 rounded">
                      HQ
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error message display if any */}
        {progress.status === "error" && (
          <div className="flex items-center gap-2 p-3 bg-rose-950/40 border border-rose-900/60 rounded-lg text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span className="flex-1">{progress.message || "שגיאה בניתוח הסרטון. אנא נסה שוב."}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {progress.status === "error" ? (
            <>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md transition shadow-md cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>נסה שוב</span>
                </button>
              )}
              <button
                onClick={onCancel}
                className="px-4 py-2 bg-[#1a1a1a] hover:bg-[#262626] text-white text-xs font-semibold rounded-md border border-[#333333] transition cursor-pointer"
              >
                סגור
              </button>
            </>
          ) : (
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-[#1a1a1a] hover:bg-[#262626] text-gray-300 text-xs font-medium rounded-md transition border border-[#333333] cursor-pointer hover:text-white"
            >
              ביטול
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
