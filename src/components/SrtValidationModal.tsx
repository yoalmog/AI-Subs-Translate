import React, { useState } from "react";
import {
  FileCode,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Wand2,
  ArrowRight,
  X,
  Layers,
} from "lucide-react";
import { SubtitleCue } from "../types";
import { SrtValidationResult, autoFixOverlappingCues } from "../utils/subtitleTools";

interface SrtValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  validationResult: SrtValidationResult | null;
  fileName: string;
  onConfirmImport: (cues: SubtitleCue[]) => void;
}

export const SrtValidationModal: React.FC<SrtValidationModalProps> = ({
  isOpen,
  onClose,
  validationResult,
  fileName,
  onConfirmImport,
}) => {
  const [activeTab, setActiveTab] = useState<"summary" | "overlaps" | "errors">("summary");

  if (!isOpen || !validationResult) return null;

  const { isValid, totalParsed, errors, warnings, overlaps, cues } = validationResult;
  const hasErrors = errors.length > 0;
  const hasOverlaps = overlaps.length > 0;
  const hasWarnings = warnings.length > 0;

  const handleImportDirect = () => {
    onConfirmImport(cues);
    onClose();
  };

  const handleImportWithAutoFix = () => {
    const fixedCues = autoFixOverlappingCues(cues);
    onConfirmImport(fixedCues);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in"
      id="srt-validation-modal"
      dir="rtl"
    >
      <div className="bg-[#141414] border border-[#262626] rounded-xl max-w-xl w-full p-4 sm:p-6 shadow-2xl relative flex flex-col gap-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#222222]">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-lg border ${
                hasErrors
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                  : hasOverlaps
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                  : "bg-green-500/10 border-green-500/30 text-green-400"
              }`}
            >
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-rubik">
                אימות תקינות קובץ כתוביות (SRT / VTT)
              </h3>
              <p className="text-xs text-gray-400 font-mono truncate max-w-xs sm:max-w-sm">
                {fileName || "קובץ כתוביות"}
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

        {/* Status Indicator Cards */}
        <div className="grid grid-cols-3 gap-2">
          {/* Total Cues */}
          <div className="bg-[#0d0d0d] border border-[#222222] p-2.5 rounded-lg flex flex-col items-center justify-center text-center">
            <span className="text-lg font-bold text-white font-mono">{totalParsed}</span>
            <span className="text-[11px] text-gray-400">כתוביות זוהו</span>
          </div>

          {/* Overlaps Status */}
          <div
            className={`border p-2.5 rounded-lg flex flex-col items-center justify-center text-center ${
              hasOverlaps
                ? "bg-amber-950/20 border-amber-500/30 text-amber-300"
                : "bg-[#0d0d0d] border-[#222222] text-gray-400"
            }`}
          >
            <span className="text-lg font-bold font-mono">{overlaps.length}</span>
            <span className="text-[11px]">חפיפות זמנים</span>
          </div>

          {/* Syntax Errors Status */}
          <div
            className={`border p-2.5 rounded-lg flex flex-col items-center justify-center text-center ${
              hasErrors
                ? "bg-rose-950/20 border-rose-500/30 text-rose-300"
                : "bg-[#0d0d0d] border-[#222222] text-gray-400"
            }`}
          >
            <span className="text-lg font-bold font-mono">{errors.length}</span>
            <span className="text-[11px]">שגיאות תחביר</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        {(hasOverlaps || hasErrors || hasWarnings) && (
          <div className="flex border-b border-[#222222] text-xs font-semibold">
            <button
              onClick={() => setActiveTab("summary")}
              className={`py-2 px-3 border-b-2 transition ${
                activeTab === "summary"
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-gray-400 hover:text-gray-200"
              }`}
            >
              סיכום אימות
            </button>
            {hasOverlaps && (
              <button
                onClick={() => setActiveTab("overlaps")}
                className={`py-2 px-3 border-b-2 transition flex items-center gap-1.5 ${
                  activeTab === "overlaps"
                    ? "border-amber-500 text-amber-400"
                    : "border-transparent text-gray-400 hover:text-gray-200"
                }`}
              >
                <span>חפיפות זמנים</span>
                <span className="bg-amber-500/20 text-amber-300 text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                  {overlaps.length}
                </span>
              </button>
            )}
            {hasErrors && (
              <button
                onClick={() => setActiveTab("errors")}
                className={`py-2 px-3 border-b-2 transition flex items-center gap-1.5 ${
                  activeTab === "errors"
                    ? "border-rose-500 text-rose-400"
                    : "border-transparent text-gray-400 hover:text-gray-200"
                }`}
              >
                <span>שגיאות קריטיות</span>
                <span className="bg-rose-500/20 text-rose-300 text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                  {errors.length}
                </span>
              </button>
            )}
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto max-h-[300px] space-y-2.5 custom-scrollbar pr-1 pl-1">
          {/* TAB 1: SUMMARY */}
          {activeTab === "summary" && (
            <div className="space-y-3">
              {!hasErrors && !hasOverlaps && !hasWarnings ? (
                <div className="bg-green-950/20 border border-green-500/30 p-4 rounded-lg flex items-center gap-3 text-green-300">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <div className="text-xs leading-relaxed">
                    <strong>קובץ ה-SRT תקין לחלוטין!</strong> כל חותמות הזמן, המבנה והכתוביות אומתו בהצלחה ללא שגיאות או חפיפות.
                  </div>
                </div>
              ) : null}

              {hasOverlaps && (
                <div className="bg-amber-950/20 border border-amber-500/30 p-3 rounded-lg flex items-start gap-2.5 text-amber-200 text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold mb-0.5">זוהו {overlaps.length} חפיפות זמנים בקובץ:</strong>
                    <span>
                      חלק מהכתוביות מתחילות לפני שהכתובית הקודמת הסתיימה. באפשרותך לבחור בתיקון אוטומטי אשר מיישר את התזמונים מבלי לאבד תוכן.
                    </span>
                  </div>
                </div>
              )}

              {hasErrors && (
                <div className="bg-rose-950/20 border border-rose-500/30 p-3 rounded-lg flex items-start gap-2.5 text-rose-200 text-xs">
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold mb-0.5">זוהו {errors.length} שגיאות תחביר בקובץ:</strong>
                    <span>
                      הקובץ מכיל בלוקים עם שגיאות תזמון לא חוקיות (כגון חותמת זמן הפוכה או מבנה פגום). כתוביות פגומות ידולגו או ימנעו ייבוא תקין.
                    </span>
                  </div>
                </div>
              )}

              {/* Quick sample preview of valid cues */}
              {cues.length > 0 && (
                <div className="bg-[#0d0d0d] p-3 rounded-lg border border-[#222222] space-y-2">
                  <span className="text-[11px] font-semibold text-gray-400 block">
                    תצוגה מקדימה של הכתוביות לייבוא:
                  </span>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {cues.slice(0, 4).map((c, i) => (
                      <div
                        key={c.id}
                        className="bg-[#141414] p-2 rounded text-xs flex items-center justify-between border border-[#222222]"
                      >
                        <span className="text-gray-200 truncate max-w-[280px]">{c.hebrewText}</span>
                        <span className="text-[10px] text-blue-400 font-mono">
                          {c.startTime.toFixed(1)}s → {c.endTime.toFixed(1)}s
                        </span>
                      </div>
                    ))}
                    {cues.length > 4 && (
                      <span className="text-[10px] text-gray-500 text-center block pt-1">
                        ...ועוד {cues.length - 4} כתוביות
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: OVERLAPS DETAILS */}
          {activeTab === "overlaps" && (
            <div className="space-y-2">
              {overlaps.map((ov, idx) => (
                <div
                  key={idx}
                  className="bg-[#0d0d0d] border border-amber-500/20 p-2.5 rounded-lg text-xs space-y-1"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-amber-400">
                      חפיפה #{idx + 1} (חופף ב-{ov.overlapSeconds} שניות)
                    </span>
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="text-gray-300 bg-[#161616] p-1.5 rounded border border-[#2a2a2a] text-[11px]">
                    <div className="text-gray-400">כתובית #{ov.cueIndex1}: "{ov.cue1Text}" ({ov.timeRange1})</div>
                    <div className="text-amber-300 mt-0.5">כתובית #{ov.cueIndex2}: "{ov.cue2Text}" ({ov.timeRange2})</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: ERRORS DETAILS */}
          {activeTab === "errors" && (
            <div className="space-y-2">
              {errors.map((err, idx) => (
                <div
                  key={idx}
                  className="bg-[#0d0d0d] border border-rose-500/20 p-2.5 rounded-lg text-xs space-y-1"
                >
                  <div className="font-bold text-rose-400 flex items-center justify-between">
                    <span>שגיאה #{idx + 1}: {err.message}</span>
                    <span className="font-mono text-[10px] text-rose-500">בלוק #{err.blockIndex}</span>
                  </div>
                  {err.snippet && (
                    <pre className="bg-[#181818] p-1.5 rounded text-[10px] font-mono text-gray-300 overflow-x-auto">
                      {err.snippet}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-[#222222] flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 bg-[#1c1c1c] hover:bg-[#282828] text-gray-300 text-xs font-semibold rounded-lg border border-[#333333] transition cursor-pointer"
          >
            ביטול
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {hasOverlaps && (
              <button
                onClick={handleImportWithAutoFix}
                className="flex-1 sm:flex-initial px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 shadow-md shadow-amber-900/30 cursor-pointer"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>תקן חפיפות וייבא</span>
              </button>
            )}

            {cues.length > 0 && (
              <button
                onClick={handleImportDirect}
                className="flex-1 sm:flex-initial px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 shadow-md shadow-blue-900/30 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{hasOverlaps ? "ייבא כפי שהוא" : `ייבא ${cues.length} כתוביות`}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
