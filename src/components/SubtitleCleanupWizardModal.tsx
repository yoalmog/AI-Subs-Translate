import React, { useState } from "react";
import {
  Wrench,
  CheckCircle2,
  AlertTriangle,
  X,
  Sparkles,
  Trash2,
  Clock,
  Maximize2,
  AlertCircle,
  ShieldCheck,
  Check,
  ArrowRight,
  Eye,
} from "lucide-react";
import { SubtitleCue } from "../types";
import {
  runSubtitleCleanupWizard,
  SubtitleCleanupReport,
  SubtitleCleanupIssue,
} from "../utils/subtitleTools";
import { formatTimeDisplay } from "../utils/timeFormat";

interface SubtitleCleanupWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  cues: SubtitleCue[];
  videoDuration?: number;
  onApplyFixedCues: (fixedCues: SubtitleCue[], summaryText?: string) => void;
  onSeekToCue?: (startTime: number) => void;
}

export const SubtitleCleanupWizardModal: React.FC<SubtitleCleanupWizardModalProps> = ({
  isOpen,
  onClose,
  cues,
  onApplyFixedCues,
  onSeekToCue,
}) => {
  const [activeTab, setActiveTab] = useState<"all" | "empty" | "duration" | "overflow">("all");
  const [fixedNotice, setFixedNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const report: SubtitleCleanupReport = runSubtitleCleanupWizard(cues);

  const filteredIssues = report.issues.filter((issue) => {
    if (activeTab === "empty") return issue.type === "empty";
    if (activeTab === "duration")
      return issue.type === "suspicious-duration-short" || issue.type === "suspicious-duration-long" || issue.type === "invalid-timestamps";
    if (activeTab === "overflow") return issue.type === "text-overflow";
    return true;
  });

  const handleFixAllClick = () => {
    onApplyFixedCues(report.fixedCues);
    setFixedNotice(`כל השגיאות (${report.issuesCount}) תוקנו אוטומטית בהצלחה!`);
    setTimeout(() => {
      setFixedNotice(null);
      onClose();
    }, 1800);
  };

  const handleFixSingleIssue = (issue: SubtitleCleanupIssue) => {
    // Single issue fix logic
    let updatedCues = [...cues];
    if (issue.type === "empty") {
      updatedCues = updatedCues.filter((c) => c.id !== issue.cueId);
    } else {
      updatedCues = updatedCues.map((c) => {
        if (c.id !== issue.cueId) return c;
        const dur = c.endTime - c.startTime;
        let newEnd = c.endTime;
        let newHeb = c.hebrewText;

        if (dur < 0.3 || dur <= 0) {
          newEnd = Number((c.startTime + 1.2).toFixed(3));
        } else if (dur > 15.0) {
          newEnd = Number((c.startTime + 8.0).toFixed(3));
        }

        if (newHeb.length > 75 && !newHeb.includes("\n")) {
          const words = newHeb.split(" ");
          const mid = Math.ceil(words.length / 2);
          newHeb = words.slice(0, mid).join(" ") + "\n" + words.slice(mid).join(" ");
        }

        return {
          ...c,
          endTime: newEnd,
          hebrewText: newHeb,
          isEdited: true,
        };
      });
    }

    onApplyFixedCues(updatedCues);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in"
      id="subtitle-cleanup-modal"
      dir="rtl"
    >
      <div className="bg-[#141414] border border-[#262626] rounded-xl max-w-2xl w-full p-6 shadow-2xl relative overflow-hidden flex flex-col gap-4 max-h-[90vh] custom-scrollbar">
        {/* Top ambient background glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#222222] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-md">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>אשף ניקוי ותיקון שגיאות כתוביות (Subtitle Clean-up Wizard)</span>
                <span className="text-[10px] bg-purple-950 text-purple-300 font-mono px-2 py-0.5 rounded-full border border-purple-600/40">
                  Auto-Audit & Trim
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                סורק ומזהה כתוביות ריקות, משכי זמן חריגים (&lt;300ms / &gt;15s), וחריגות מאזור התצוגה הבטוח
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-[#222222] rounded-lg transition"
            title="סגור חלון"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Notice */}
        {fixedNotice && (
          <div className="p-3 bg-emerald-950/80 border border-emerald-500/60 rounded-lg text-emerald-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{fixedNotice}</span>
          </div>
        )}

        {/* Metrics Overview Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-[#0f0f0f] border border-[#242424] rounded-lg p-2.5 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] text-gray-400 block font-medium">סה"כ בעיות</span>
            <span className={`text-base font-bold font-mono ${report.issuesCount > 0 ? "text-amber-400" : "text-emerald-400"}`}>
              {report.issuesCount}
            </span>
          </div>

          <div className="bg-[#0f0f0f] border border-[#242424] rounded-lg p-2.5 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] text-gray-400 block font-medium">כתוביות ריקות</span>
            <span className={`text-base font-bold font-mono ${report.emptyCount > 0 ? "text-rose-400" : "text-gray-300"}`}>
              {report.emptyCount}
            </span>
          </div>

          <div className="bg-[#0f0f0f] border border-[#242424] rounded-lg p-2.5 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] text-gray-400 block font-medium">משך חריג (&lt;300ms/&gt;15s)</span>
            <span className={`text-base font-bold font-mono ${report.suspiciousShortCount + report.suspiciousLongCount > 0 ? "text-amber-400" : "text-gray-300"}`}>
              {report.suspiciousShortCount + report.suspiciousLongCount}
            </span>
          </div>

          <div className="bg-[#0f0f0f] border border-[#242424] rounded-lg p-2.5 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] text-gray-400 block font-medium">חריגה מאזור תצוגה</span>
            <span className={`text-base font-bold font-mono ${report.overflowCount > 0 ? "text-purple-400" : "text-gray-300"}`}>
              {report.overflowCount}
            </span>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 border-b border-[#222222] pb-2 text-xs">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-md font-bold transition ${
              activeTab === "all"
                ? "bg-purple-600 text-white"
                : "bg-[#1c1c1c] text-gray-400 hover:text-white"
            }`}
          >
            הכל ({report.issuesCount})
          </button>
          <button
            onClick={() => setActiveTab("empty")}
            className={`px-3 py-1.5 rounded-md font-bold transition ${
              activeTab === "empty"
                ? "bg-rose-600 text-white"
                : "bg-[#1c1c1c] text-gray-400 hover:text-white"
            }`}
          >
            כתוביות ריקות ({report.emptyCount})
          </button>
          <button
            onClick={() => setActiveTab("duration")}
            className={`px-3 py-1.5 rounded-md font-bold transition ${
              activeTab === "duration"
                ? "bg-amber-600 text-white"
                : "bg-[#1c1c1c] text-gray-400 hover:text-white"
            }`}
          >
            משך חריג ({report.suspiciousShortCount + report.suspiciousLongCount + report.invalidTimingCount})
          </button>
          <button
            onClick={() => setActiveTab("overflow")}
            className={`px-3 py-1.5 rounded-md font-bold transition ${
              activeTab === "overflow"
                ? "bg-indigo-600 text-white"
                : "bg-[#1c1c1c] text-gray-400 hover:text-white"
            }`}
          >
            חריגת טקסט ({report.overflowCount})
          </button>
        </div>

        {/* Issues List */}
        <div className="flex-1 overflow-y-auto max-h-[340px] space-y-2 pr-1 custom-scrollbar">
          {report.issuesCount === 0 ? (
            <div className="p-8 text-center flex flex-col items-center justify-center gap-2 bg-[#0c131d] border border-emerald-500/30 rounded-xl text-emerald-300">
              <ShieldCheck className="w-10 h-10 text-emerald-400" />
              <span className="font-bold text-sm">כל הכתוביות תקינות לחלוטין!</span>
              <span className="text-xs text-gray-400">
                לא נמצאו כתוביות ריקות, משכי זמן חשודים או חריגות משטח תצוגה.
              </span>
            </div>
          ) : filteredIssues.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-xs">
              אין שגיאות בקטגוריה זו.
            </div>
          ) : (
            filteredIssues.map((issue) => {
              const cue = cues.find((c) => c.id === issue.cueId);

              return (
                <div
                  key={issue.id}
                  className="bg-[#111622] border border-[#232d3f] hover:border-purple-500/40 rounded-lg p-3 flex flex-col gap-2 transition"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                          issue.severity === "error"
                            ? "bg-rose-950 text-rose-300 border border-rose-600/40"
                            : "bg-amber-950 text-amber-300 border border-amber-600/40"
                        }`}
                      >
                        #{issue.cueIndex}
                      </span>
                      <span className="text-xs font-bold text-white">
                        {issue.message}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {cue && onSeekToCue && (
                        <button
                          onClick={() => onSeekToCue(cue.startTime)}
                          className="px-2 py-1 bg-[#1a2332] hover:bg-[#253247] text-gray-300 text-[11px] rounded transition flex items-center gap-1 cursor-pointer"
                          title="קפוץ לכתובית בסרטון"
                        >
                          <Eye className="w-3 h-3 text-blue-400" />
                          <span>צפה בסרטון</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleFixSingleIssue(issue)}
                        className="px-2.5 py-1 bg-purple-900/80 hover:bg-purple-800 text-purple-200 border border-purple-500/40 text-[11px] font-bold rounded transition flex items-center gap-1 cursor-pointer"
                      >
                        <Wrench className="w-3 h-3 text-purple-300" />
                        <span>{issue.suggestedFixAction}</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-gray-400 leading-snug">
                    {issue.details}
                  </p>

                  {cue && (
                    <div className="bg-black/50 p-2 rounded text-[11px] font-mono text-gray-300 flex items-center justify-between gap-2 border border-[#1e2634]">
                      <span className="truncate">
                        "{cue.hebrewText || cue.originalText || "(ריקה)"}"
                      </span>
                      <span className="text-[10px] text-blue-400 shrink-0">
                        {formatTimeDisplay(cue.startTime)} - {formatTimeDisplay(cue.endTime)} ({(cue.endTime - cue.startTime).toFixed(2)}s)
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-[#222222] pt-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#1c1c1c] hover:bg-[#282828] text-gray-300 text-xs font-semibold rounded-lg transition"
          >
            סגור
          </button>

          {report.issuesCount > 0 && (
            <button
              onClick={handleFixAllClick}
              className="px-5 py-2.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold text-xs rounded-lg shadow-lg shadow-indigo-600/30 transition flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-purple-200 animate-pulse" />
              <span>תקן את כל השגיאות אוטומטית (Fix All {report.issuesCount} Issues)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
