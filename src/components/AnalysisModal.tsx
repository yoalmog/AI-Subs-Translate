import React from "react";
import { Sparkles, CheckCircle2, AlertCircle, Loader2, Film, RefreshCw, X } from "lucide-react";
import { AnalysisProgress } from "../types";

interface AnalysisModalProps {
  isOpen: boolean;
  progress: AnalysisProgress;
  recentFrames: string[];
  onCancel: () => void;
  onRetry?: () => void;
}

export const AnalysisModal: React.FC<AnalysisModalProps> = ({
  isOpen,
  progress,
  recentFrames,
  onCancel,
  onRetry,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in" id="analysis-modal" dir="rtl">
      <div className="bg-[#141414] border border-[#222222] rounded-xl max-w-lg w-full p-6 shadow-2xl relative overflow-hidden flex flex-col gap-5">
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
                סורק פריימים, מזהה טקסט מוטמע ומתרגם לעברית
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
                דגימת פריימים מהסרטון
              </span>
            </div>
            <span className="font-mono text-gray-400">
              {progress.currentFrame}/{progress.totalFrames || 18}
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
                זיהוי טקסט מוטמע ב-OCR (Gemini Vision)
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
            <div className="text-[11px] font-semibold text-gray-400 mb-1.5 flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5 text-blue-400" />
              <span>פריימים שנדגמו:</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
              {recentFrames.map((frameUrl, idx) => (
                <img
                  key={idx}
                  src={frameUrl}
                  alt={`Sample frame ${idx}`}
                  className="w-16 h-10 object-cover rounded-md border border-[#2e2e2e] shadow shrink-0"
                />
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
