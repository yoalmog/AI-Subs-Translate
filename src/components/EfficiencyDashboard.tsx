import React, { useMemo } from "react";
import {
  BarChart3,
  Clock,
  Gauge,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Scissors,
  FastForward,
  Info,
  ChevronLeft,
  Eye,
} from "lucide-react";
import { SubtitleCue } from "../types";
import { formatTimeDisplay } from "../utils/timeFormat";

interface EfficiencyDashboardProps {
  cues: SubtitleCue[];
  videoDuration: number;
  onSeekTo: (time: number) => void;
  onSelectCue?: (cueId: string) => void;
  onSplitCue?: (cueId: string) => void;
  onExtendCue?: (cueId: string) => void;
  onClose?: () => void;
}

export interface FlaggedCueIssue {
  cue: SubtitleCue;
  index: number;
  cps: number;
  wpm: number;
  duration: number;
  charCount: number;
  severity: "high" | "medium" | "info";
  reason: string;
}

export const EfficiencyDashboard: React.FC<EfficiencyDashboardProps> = ({
  cues,
  videoDuration,
  onSeekTo,
  onSelectCue,
  onSplitCue,
  onExtendCue,
  onClose,
}) => {
  const safeDuration = videoDuration && isFinite(videoDuration) && videoDuration > 0 ? videoDuration : 10;

  // Calculate detailed reading efficiency metrics
  const analytics = useMemo(() => {
    if (cues.length === 0) {
      return {
        totalReadingTime: 0,
        readingPercent: 0,
        avgCps: 0,
        avgWpm: 0,
        totalChars: 0,
        totalWords: 0,
        optimalCount: 0,
        heavyCount: 0,
        overcrowdedCount: 0,
        flaggedIssues: [] as FlaggedCueIssue[],
      };
    }

    let totalReadingTime = 0;
    let totalChars = 0;
    let totalWords = 0;
    let optimalCount = 0;
    let heavyCount = 0;
    let overcrowdedCount = 0;

    const flaggedIssues: FlaggedCueIssue[] = [];

    cues.forEach((cue, index) => {
      const dur = Math.max(0.1, cue.endTime - cue.startTime);
      totalReadingTime += dur;

      const txt = (cue.hebrewText || cue.originalText || "").trim();
      const charCount = txt.length;
      const wordCount = txt ? txt.split(/\s+/).length : 0;

      totalChars += charCount;
      totalWords += wordCount;

      const cps = Number((charCount / dur).toFixed(1));
      const wpm = Math.round((wordCount / dur) * 60);

      if (cps <= 16) {
        optimalCount++;
      } else if (cps <= 21) {
        heavyCount++;
      } else {
        overcrowdedCount++;
      }

      // Check for flagged issues
      if (cps > 21) {
        flaggedIssues.push({
          cue,
          index: index + 1,
          cps,
          wpm,
          duration: Number(dur.toFixed(2)),
          charCount,
          severity: "high",
          reason: `מהירות קריאה גבוהה מדי (${cps} תווים לשנייה) - הטקסט צפוף מדי לקריאה נוחה`,
        });
      } else if (dur < 1.1 && charCount > 15) {
        flaggedIssues.push({
          cue,
          index: index + 1,
          cps,
          wpm,
          duration: Number(dur.toFixed(2)),
          charCount,
          severity: "medium",
          reason: `זמן תצוגה קצר מדי (${dur.toFixed(1)} שניות) ביחס לאורך הטקסט`,
        });
      } else if (cps >= 17 && cps <= 21) {
        flaggedIssues.push({
          cue,
          index: index + 1,
          cps,
          wpm,
          duration: Number(dur.toFixed(2)),
          charCount,
          severity: "info",
          reason: `טקסט עמוס (${cps} תווים לשנייה) - מומלץ להאריך תצוגה מעט`,
        });
      }
    });

    const readingPercent = Math.min(100, Math.round((totalReadingTime / safeDuration) * 100));
    const avgCps = totalReadingTime > 0 ? Number((totalChars / totalReadingTime).toFixed(1)) : 0;
    const avgWpm = totalReadingTime > 0 ? Math.round((totalWords / totalReadingTime) * 60) : 0;

    return {
      totalReadingTime: Number(totalReadingTime.toFixed(1)),
      readingPercent,
      avgCps,
      avgWpm,
      totalChars,
      totalWords,
      optimalCount,
      heavyCount,
      overcrowdedCount,
      flaggedIssues,
    };
  }, [cues, safeDuration]);

  return (
    <div className="bg-[#141414] border border-[#222222] rounded-xl p-4 lg:p-5 flex flex-col gap-5 shadow-2xl animate-in fade-in duration-200" id="efficiency-dashboard-panel">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#222222]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
            <Gauge className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white font-rubik flex items-center gap-2">
              <span>דאשבורד יתרות ומהירות קריאה (Efficiency Dashboard)</span>
            </h2>
            <p className="text-[11px] text-gray-400">
              מחשב ומציג את זמן הצפייה שהקהל משקיע בקריאה ומזהה סצנות עם עומס טקסט חריג
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="text-xs text-gray-400 hover:text-white px-2.5 py-1 rounded-md bg-[#1a1a1a] hover:bg-[#262626] border border-[#333333] transition cursor-pointer"
          >
            סגור
          </button>
        )}
      </div>

      {/* METRIC CARDS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Card 1: Total Reading Time */}
        <div className="bg-[#111111] border border-[#242424] rounded-xl p-3.5 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="flex items-center gap-1.5 font-medium">
              <Clock className="w-4 h-4 text-blue-400" />
              זמן קריאה כולל בסרטון
            </span>
            <span className="font-mono text-blue-400 font-bold">{analytics.readingPercent}%</span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white font-mono">
              {formatTimeDisplay(analytics.totalReadingTime)}
            </span>
            <span className="text-xs text-gray-400">
              מתוך {formatTimeDisplay(safeDuration)}
            </span>
          </div>

          {/* Reading duration bar */}
          <div className="w-full h-2 bg-[#222222] rounded-full overflow-hidden mt-1">
            <div
              style={{ width: `${analytics.readingPercent}%` }}
              className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full"
            />
          </div>
        </div>

        {/* Card 2: Average Reading Speed */}
        <div className="bg-[#111111] border border-[#242424] rounded-xl p-3.5 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="flex items-center gap-1.5 font-medium">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              מהירות קריאה ממוצעת
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-bold">
              {analytics.avgCps <= 16 ? "קצב מצוין" : "קצב גבוה"}
            </span>
          </div>

          <div className="flex items-baseline gap-3">
            <div>
              <span className="text-2xl font-black text-white font-mono">{analytics.avgCps}</span>
              <span className="text-xs text-gray-400 ml-1">תווים/שנייה</span>
            </div>
            <div className="text-xs text-gray-400 font-mono border-r border-[#333333] pr-2">
              <span className="font-bold text-gray-200">{analytics.avgWpm}</span> WPM
            </div>
          </div>

          <p className="text-[11px] text-gray-400">
            יעד מומלץ: 12-16 תווים לשנייה (~150 מילים בדקה)
          </p>
        </div>

        {/* Card 3: Density Distribution */}
        <div className="bg-[#111111] border border-[#242424] rounded-xl p-3.5 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="flex items-center gap-1.5 font-medium">
              <Eye className="w-4 h-4 text-purple-400" />
              חלוקת צפיפות כתוביות
            </span>
            <span className="text-xs text-gray-300 font-mono font-bold">{cues.length} כתוביות</span>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span className="text-gray-300 font-semibold">{analytics.optimalCount} אופטימלי</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span className="text-gray-300 font-semibold">{analytics.heavyCount} עמוס</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
              <span className="text-gray-300 font-semibold">{analytics.overcrowdedCount} צפוף</span>
            </div>
          </div>

          {/* Combined distribution bar */}
          <div className="w-full h-2 bg-[#222222] rounded-full overflow-hidden flex mt-1">
            {cues.length > 0 && (
              <>
                <div
                  style={{ width: `${(analytics.optimalCount / cues.length) * 100}%` }}
                  className="h-full bg-emerald-500"
                  title="אופטימלי"
                />
                <div
                  style={{ width: `${(analytics.heavyCount / cues.length) * 100}%` }}
                  className="h-full bg-amber-500"
                  title="עמוס"
                />
                <div
                  style={{ width: `${(analytics.overcrowdedCount / cues.length) * 100}%` }}
                  className="h-full bg-red-500"
                  title="צפוף"
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* FLAGGED SCENES LIST */}
      <div className="bg-[#111111] border border-[#242424] rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#222222]">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-white">
              סצנות המצריכות התאמה ושיפור קריאות ({analytics.flaggedIssues.length})
            </h3>
          </div>
          {analytics.flaggedIssues.length === 0 && (
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-xs font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              כל הכתוביות בקצב קריאה מעולה!
            </span>
          )}
        </div>

        {analytics.flaggedIssues.length === 0 ? (
          <div className="py-6 text-center flex flex-col items-center justify-center text-gray-400 text-xs">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2" />
            <p className="font-semibold text-gray-200">לא נמצאו סצנות עם עומס טקסט חריג!</p>
            <p className="text-[11px] text-gray-400">כל הכתוביות מתוזמנות בקצב קריאה נוח המאפשר לקהל לעקוב בקלות.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 max-h-80 overflow-y-auto pr-1">
            {analytics.flaggedIssues.map((issue) => (
              <div
                key={issue.cue.id}
                className={`p-3 rounded-lg border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition ${
                  issue.severity === "high"
                    ? "bg-red-950/20 border-red-500/30 hover:bg-red-950/30"
                    : issue.severity === "medium"
                    ? "bg-amber-950/20 border-amber-500/30 hover:bg-amber-950/30"
                    : "bg-[#181818] border-[#2c2c2c] hover:bg-[#202020]"
                }`}
              >
                {/* Right Info */}
                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono shrink-0 ${
                      issue.severity === "high"
                        ? "bg-red-500/20 text-red-300 border border-red-500/30"
                        : issue.severity === "medium"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                    }`}
                  >
                    #{issue.index}
                  </span>

                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-gray-300 font-bold">
                        {formatTimeDisplay(issue.cue.startTime)} - {formatTimeDisplay(issue.cue.endTime)}
                      </span>
                      <span className="text-[11px] text-gray-400">({issue.duration} שניות)</span>
                      <span className="font-mono text-amber-400 font-bold text-[11px] border-r border-[#333333] pr-2">
                        {issue.cps} CPS
                      </span>
                    </div>

                    <p className="text-xs text-white font-medium truncate max-w-md">
                      "{issue.cue.hebrewText || issue.cue.originalText}"
                    </p>

                    <p className="text-[11px] text-gray-400 leading-tight">
                      💡 {issue.reason}
                    </p>
                  </div>
                </div>

                {/* Left Action Buttons */}
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                  <button
                    onClick={() => {
                      onSeekTo(issue.cue.startTime);
                      if (onSelectCue) onSelectCue(issue.cue.id);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold rounded transition shadow-xs cursor-pointer"
                    title="קפוץ לנגן והצג כתובית"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>קפוץ לסצנה</span>
                  </button>

                  {onSplitCue && issue.charCount > 25 && (
                    <button
                      onClick={() => onSplitCue(issue.cue.id)}
                      className="flex items-center gap-1 px-2.5 py-1 bg-[#222222] hover:bg-[#2e2e2e] text-purple-300 hover:text-white text-[11px] font-semibold rounded border border-[#3a3a3a] transition cursor-pointer"
                      title="פצל כתובית זו ל-2 כתוביות קצרות"
                    >
                      <Scissors className="w-3 h-3 text-purple-400" />
                      <span>פצל</span>
                    </button>
                  )}

                  {onExtendCue && (
                    <button
                      onClick={() => onExtendCue(issue.cue.id)}
                      className="flex items-center gap-1 px-2.5 py-1 bg-[#222222] hover:bg-[#2e2e2e] text-emerald-300 hover:text-white text-[11px] font-semibold rounded border border-[#3a3a3a] transition cursor-pointer"
                      title="הארך את זמן התצוגה ב-0.8 שניות"
                    >
                      <FastForward className="w-3 h-3 text-emerald-400" />
                      <span>הארך תצוגה</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
