import React, { useState, useMemo } from "react";
import {
  X,
  AlertCircle,
  CheckCircle2,
  Sliders,
  Sparkles,
  ArrowRightLeft,
  Clock,
  Split,
  FastForward,
  ShieldCheck,
  Info,
} from "lucide-react";
import { SubtitleCue } from "../types";
import { formatTimeDisplay } from "../utils/timeFormat";
import {
  resolveAllSyncConflicts,
  ConflictResolutionOptions,
  ConflictResolutionResult,
} from "../utils/subtitleTools";

interface SyncConflictsModalProps {
  isOpen: boolean;
  onClose: () => void;
  cues: SubtitleCue[];
  onApplyResolution: (resolvedCues: SubtitleCue[], result: ConflictResolutionResult) => void;
}

export const SyncConflictsModal: React.FC<SyncConflictsModalProps> = ({
  isOpen,
  onClose,
  cues,
  onApplyResolution,
}) => {
  const [minGapMs, setMinGapMs] = useState<number>(50); // default 50ms (0.05s)
  const [strategy, setStrategy] = useState<"smart-balance" | "trim-preceding" | "push-succeeding">(
    "smart-balance"
  );
  const [minAllowedDurationMs, setMinAllowedDurationMs] = useState<number>(400); // 0.4s

  // Compute current conflicts and simulated resolution
  const simulation = useMemo(() => {
    const options: ConflictResolutionOptions = {
      minGapSeconds: minGapMs / 1000,
      strategy,
      minAllowedDuration: minAllowedDurationMs / 1000,
    };
    return resolveAllSyncConflicts(cues, options);
  }, [cues, minGapMs, strategy, minAllowedDurationMs]);

  // Find current actual overlaps
  const currentOverlaps = useMemo(() => {
    const sorted = [...cues].sort((a, b) => a.startTime - b.startTime);
    const conflicts: {
      indexA: number;
      indexB: number;
      cueA: SubtitleCue;
      cueB: SubtitleCue;
      gapSeconds: number;
      isOverlap: boolean;
    }[] = [];

    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1];
      const b = sorted[i];
      const gap = b.startTime - a.endTime;
      const isOverlap = b.startTime < a.endTime - 0.002;
      const isUnderMinGap = gap < minGapMs / 1000 - 0.002;

      if (isOverlap || isUnderMinGap) {
        conflicts.push({
          indexA: i,
          indexB: i + 1,
          cueA: a,
          cueB: b,
          gapSeconds: gap,
          isOverlap,
        });
      }
    }

    return conflicts;
  }, [cues, minGapMs]);

  if (!isOpen) return null;

  const handleApply = () => {
    onApplyResolution(simulation.resolvedCues, simulation);
    onClose();
  };

  const totalConflictsToFix = simulation.conflictsResolvedCount + simulation.gapAdjustmentsCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div
        className="bg-[#121212] border border-[#2a2a2a] rounded-2xl w-full max-w-2xl text-right overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        dir="rtl"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[#222222] flex items-center justify-between bg-gradient-to-r from-blue-950/40 via-[#161616] to-[#121212]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/40 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>פתרון קונפליקטים וסנכרון רווחים</span>
                {totalConflictsToFix > 0 ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-600/50 font-mono">
                    {totalConflictsToFix} בעיות לתיקון
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-600/50 flex items-center gap-1 font-mono">
                    <CheckCircle2 className="w-3 h-3" /> מושלם
                  </span>
                )}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                מבצע התאמה אוטומטית של זמני סיום והתחלה בין כתוביות סמוכות למניעת חפיפה ושמירה על רצף קריאה אופטימלי
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#252525] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex flex-col gap-4 text-xs">
          {/* Status Summary Banner */}
          {totalConflictsToFix > 0 ? (
            <div className="p-3.5 bg-amber-950/30 border border-amber-500/40 rounded-xl flex items-start gap-3 text-amber-200">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-bold text-white text-xs">
                  זוהו {simulation.conflictsResolvedCount} חפיפות זמנים ו-{simulation.gapAdjustmentsCount} רווחים הקצרים מ-{minGapMs}ms
                </div>
                <div className="text-[11px] text-amber-300/90 mt-1">
                  הכלי יתאים את נקודות המעבר בין הכתוביות באופן מדויק כך שלא תהיינה כתוביות שמופיעות יחד על המסך באותו רגע, תוך שמירה על משך תצוגה מינימלי לקריאה נוחה.
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-emerald-950/30 border border-emerald-500/40 rounded-xl flex items-center gap-3 text-emerald-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <div className="font-bold text-white text-xs">כל הכתוביות מסונכרנות ללא חפיפות!</div>
                <div className="text-[11px] text-emerald-300/80 mt-0.5">
                  כל מרווחי הזמן בין הכתוביות הסמוכות תקינים ועומדים בהגדרת המינימום של {minGapMs}ms.
                </div>
              </div>
            </div>
          )}

          {/* Configuration Settings */}
          <div className="bg-[#181818] border border-[#282828] rounded-xl p-3.5 flex flex-col gap-3.5">
            <div className="font-bold text-white text-xs flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-400" />
              <span>הגדרות מרווח ואסטרטגיית התאמה</span>
            </div>

            {/* 1. Minimum Gap Selection */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-semibold text-gray-300">
                  מרווח מינימלי בין כתוביות סמוכות (Minimum Gap):
                </label>
                <span className="text-xs font-mono font-bold text-blue-400">{minGapMs} ms ({minGapMs / 1000}s)</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                {[
                  { value: 0, label: "0ms (רציף)" },
                  { value: 50, label: "50ms (מומלץ)" },
                  { value: 100, label: "100ms" },
                  { value: 150, label: "150ms" },
                  { value: 200, label: "200ms" },
                ].map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setMinGapMs(preset.value)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium transition cursor-pointer border ${
                      minGapMs === preset.value
                        ? "bg-blue-600 text-white border-blue-400 font-bold shadow-xs"
                        : "bg-[#222222] text-gray-300 border-[#333333] hover:border-gray-500"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Strategy Mode */}
            <div>
              <label className="text-[11px] font-semibold text-gray-300 block mb-1.5">
                אופן פתרון ההתנגשויות (Resolution Strategy):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setStrategy("smart-balance")}
                  className={`p-2.5 rounded-xl border text-right transition cursor-pointer flex flex-col gap-1 ${
                    strategy === "smart-balance"
                      ? "bg-blue-950/50 border-blue-500 text-white shadow-sm ring-1 ring-blue-500/50"
                      : "bg-[#202020] border-[#303030] text-gray-300 hover:border-gray-600"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <ArrowRightLeft className="w-3.5 h-3.5 text-blue-400" />
                    <span>איזון חכם (Smart Balance)</span>
                  </div>
                  <span className="text-[10px] text-gray-400 leading-tight">
                    מפצל את החפיפה שווה בשווה בין סיום הכתובית הקודמת לתחילת הבאה.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setStrategy("trim-preceding")}
                  className={`p-2.5 rounded-xl border text-right transition cursor-pointer flex flex-col gap-1 ${
                    strategy === "trim-preceding"
                      ? "bg-blue-950/50 border-blue-500 text-white shadow-sm ring-1 ring-blue-500/50"
                      : "bg-[#202020] border-[#303030] text-gray-300 hover:border-gray-600"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <Clock className="w-3.5 h-3.5 text-purple-400" />
                    <span>חיתוך סיום הקודמת (Trim End)</span>
                  </div>
                  <span className="text-[10px] text-gray-400 leading-tight">
                    שומר על מועד תחילת הדיבור של הכתובית החדשה ומקצר את סיום הקודמת.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setStrategy("push-succeeding")}
                  className={`p-2.5 rounded-xl border text-right transition cursor-pointer flex flex-col gap-1 ${
                    strategy === "push-succeeding"
                      ? "bg-blue-950/50 border-blue-500 text-white shadow-sm ring-1 ring-blue-500/50"
                      : "bg-[#202020] border-[#303030] text-gray-300 hover:border-gray-600"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <FastForward className="w-3.5 h-3.5 text-amber-400" />
                    <span>דחיית התחלת הבאה (Push Start)</span>
                  </div>
                  <span className="text-[10px] text-gray-400 leading-tight">
                    שומר על סיום הכתובית הקודמת ודוחה את תחילת הכתובית הבאה קדימה.
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* List of Detected Overlaps & Previews */}
          {currentOverlaps.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="text-[11px] font-bold text-gray-400 flex items-center justify-between">
                <span>פירוט הקונפליקטים שזוהו ({currentOverlaps.length}):</span>
                <span className="text-gray-500 font-normal">תצוגה מקדימה של השינויים</span>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1.5 custom-scrollbar pr-0.5">
                {currentOverlaps.map((conflict, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-[#171717] border border-[#292929] rounded-xl flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 font-mono font-bold text-[10px] border border-blue-800/60">
                          #{conflict.indexA} ↔ #{conflict.indexB}
                        </span>
                        {conflict.isOverlap ? (
                          <span className="text-rose-400 font-bold text-[10px] flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
                            חפיפה של {Math.abs(conflict.gapSeconds).toFixed(2)}s
                          </span>
                        ) : (
                          <span className="text-amber-400 font-semibold text-[10px]">
                            רווח צר ({Math.max(0, conflict.gapSeconds * 1000).toFixed(0)}ms)
                          </span>
                        )}
                      </div>
                      <div className="text-gray-300 truncate text-[11px]">
                        <span className="text-gray-400">1:</span> "{conflict.cueA.hebrewText || conflict.cueA.originalText}"
                        <br />
                        <span className="text-gray-400">2:</span> "{conflict.cueB.hebrewText || conflict.cueB.originalText}"
                      </div>
                    </div>

                    <div className="text-left font-mono text-[10px] text-gray-400 shrink-0">
                      <div>
                        {formatTimeDisplay(conflict.cueA.startTime)} - {formatTimeDisplay(conflict.cueA.endTime)}
                      </div>
                      <div className="text-blue-400">
                        {formatTimeDisplay(conflict.cueB.startTime)} - {formatTimeDisplay(conflict.cueB.endTime)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#222222] bg-[#141414] flex items-center justify-between gap-3">
          <div className="text-[11px] text-gray-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>פעולה זו נתמכת בביטול מלא (Undo / Ctrl+Z)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-gray-300 hover:text-white bg-[#1f1f1f] hover:bg-[#2a2a2a] text-xs font-semibold transition border border-[#333333] cursor-pointer"
            >
              ביטול
            </button>
            <button
              onClick={handleApply}
              disabled={totalConflictsToFix === 0}
              className="px-4 py-2 rounded-xl text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-xs font-bold transition shadow-md shadow-blue-900/30 disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>פתור את כל {totalConflictsToFix} הקונפליקטים עכשיו</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
