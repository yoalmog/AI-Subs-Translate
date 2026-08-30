import React, { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  Cell,
} from "recharts";
import {
  BarChart3,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Info,
  ChevronDown,
  ChevronUp,
  Flame,
  AlertOctagon,
} from "lucide-react";
import { SubtitleCue } from "../types";
import { formatTimeDisplay } from "../utils/timeFormat";

interface DurationDistributionChartProps {
  cues: SubtitleCue[];
  onSelectCue?: (cueId: string, startTime: number) => void;
  selectedCueId?: string | null;
  compact?: boolean;
}

export const DurationDistributionChart: React.FC<DurationDistributionChartProps> = ({
  cues,
  onSelectCue,
  selectedCueId,
  compact = false,
}) => {
  const [viewMode, setViewMode] = useState<"cues" | "histogram">("cues");
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [filterMode, setFilterMode] = useState<"all" | "ocr-only" | "outliers">("all");

  // Calculate duration statistics with explicit < 1.0s OCR error category
  const stats = useMemo(() => {
    if (!cues.length) {
      return {
        count: 0,
        avgDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        ocrErrorCount: 0,
        shortCuesCount: 0,
        longCuesCount: 0,
        optimalCount: 0,
      };
    }

    const durations = cues.map((c) => Math.max(0.05, c.endTime - c.startTime));
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);
    const avgDuration = Number((totalDuration / cues.length).toFixed(2));
    const minDuration = Number(Math.min(...durations).toFixed(2));
    const maxDuration = Number(Math.max(...durations).toFixed(2));

    // Thresholds:
    // OCR Errors: < 1.0s
    // Fast / Short: 1.0s <= d < 1.4s
    // Long: > 5.5s
    // Optimal: 1.4s <= d <= 5.5s
    const ocrErrorCues = cues.filter((c) => c.endTime - c.startTime < 1.0);
    const shortCues = cues.filter(
      (c) => c.endTime - c.startTime >= 1.0 && c.endTime - c.startTime < 1.4
    );
    const longCues = cues.filter((c) => c.endTime - c.startTime > 5.5);
    const optimalCues = cues.filter(
      (c) => c.endTime - c.startTime >= 1.4 && c.endTime - c.startTime <= 5.5
    );

    return {
      count: cues.length,
      avgDuration,
      minDuration,
      maxDuration,
      ocrErrorCount: ocrErrorCues.length,
      shortCuesCount: shortCues.length,
      longCuesCount: longCues.length,
      optimalCount: optimalCues.length,
    };
  }, [cues]);

  // Data for Per-Cue Duration Chart
  const cueChartData = useMemo(() => {
    return cues.map((cue, idx) => {
      const duration = Number(Math.max(0.05, cue.endTime - cue.startTime).toFixed(2));
      let status: "ocr-error" | "short" | "optimal" | "long" = "optimal";
      if (duration < 1.0) status = "ocr-error"; // Highlight in RED as OCR error
      else if (duration < 1.4) status = "short";
      else if (duration > 5.5) status = "long";

      return {
        id: cue.id,
        index: idx + 1,
        label: `#${idx + 1}`,
        duration,
        startTime: cue.startTime,
        endTime: cue.endTime,
        hebrewText: cue.hebrewText || cue.originalText,
        originalText: cue.originalText,
        status,
        isSelected: cue.id === selectedCueId,
      };
    });
  }, [cues, selectedCueId]);

  // Filtered Cues data if user toggles OCR or outlier filter
  const displayedCueData = useMemo(() => {
    if (filterMode === "ocr-only") {
      return cueChartData.filter((d) => d.status === "ocr-error");
    }
    if (filterMode === "outliers") {
      return cueChartData.filter((d) => d.status !== "optimal");
    }
    return cueChartData;
  }, [cueChartData, filterMode]);

  // Data for Histogram Buckets
  const histogramData = useMemo(() => {
    const buckets = [
      {
        range: "< 1.0s",
        label: "שגיאת OCR (<1.0s)",
        count: 0,
        color: "#ef4444",
        desc: "קצר מדי, לרוב רעש זיהוי",
      },
      {
        range: "1.0 - 1.4s",
        label: "קצר (1.0-1.4s)",
        count: 0,
        color: "#f59e0b",
        desc: "מתאים למילה בודדת",
      },
      {
        range: "1.4 - 3.5s",
        label: "אידיאלי (1.4-3.5s)",
        count: 0,
        color: "#10b981",
        desc: "זמן קריאה אופטימלי",
      },
      {
        range: "3.5 - 5.5s",
        label: "בינוני-ארוך",
        count: 0,
        color: "#6366f1",
        desc: "מתאים לפסקאות מלאות",
      },
      {
        range: "> 5.5s",
        label: "ארוך מדי (>5.5s)",
        count: 0,
        color: "#a855f7",
        desc: "עומס קריאה על המסך",
      },
    ];

    cues.forEach((c) => {
      const d = c.endTime - c.startTime;
      if (d < 1.0) buckets[0].count++;
      else if (d < 1.4) buckets[1].count++;
      else if (d <= 3.5) buckets[2].count++;
      else if (d <= 5.5) buckets[3].count++;
      else buckets[4].count++;
    });

    return buckets;
  }, [cues]);

  if (!cues.length) return null;

  return (
    <div
      className={`bg-[#141414] border border-[#262626] rounded-xl text-white flex flex-col gap-2.5 shadow-md ${
        compact ? "p-2.5" : "p-3 sm:p-4"
      }`}
    >
      {/* Header with Stats and View Toggle */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-[#242424]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/30">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
              <span>התפלגות משך הכתוביות (Duration Distribution)</span>
              {stats.ocrErrorCount > 0 && (
                <span className="bg-rose-950 text-rose-300 border border-rose-600/60 text-[10px] px-1.5 py-0.2 rounded-full font-mono flex items-center gap-0.5 animate-pulse">
                  <AlertOctagon className="w-3 h-3 text-rose-400" />
                  {stats.ocrErrorCount} שגיאות OCR (&lt;1s)
                </span>
              )}
            </h3>
            <span className="text-[11px] text-gray-400">
              הדגשה אוטומטית באדום של כתוביות קצרות מ-1 שנ' (חשד לרעש OCR)
            </span>
          </div>
        </div>

        {/* View Mode & Collapse Controls */}
        <div className="flex items-center gap-1.5 mr-auto">
          <div className="flex items-center bg-[#1a1a1a] rounded-lg p-0.5 border border-[#333333] text-xs">
            <button
              onClick={() => setViewMode("cues")}
              className={`px-2 py-0.5 rounded-md font-medium transition cursor-pointer text-xs ${
                viewMode === "cues"
                  ? "bg-blue-600 text-white shadow-xs font-bold"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              לפי כתובית
            </button>
            <button
              onClick={() => setViewMode("histogram")}
              className={`px-2 py-0.5 rounded-md font-medium transition cursor-pointer text-xs ${
                viewMode === "histogram"
                  ? "bg-blue-600 text-white shadow-xs font-bold"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              טווחים
            </button>
          </div>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 bg-[#1e1e1e] hover:bg-[#2a2a2a] text-gray-400 hover:text-white rounded-lg border border-[#333] transition"
            title={isCollapsed ? "הרחב תרשים" : "כווץ תרשים"}
          >
            {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            <div className="bg-[#1a1a1a] p-2 rounded-lg border border-[#282828] flex flex-col">
              <span className="text-[10px] text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3 text-blue-400" /> משך ממוצע
              </span>
              <span className="text-xs sm:text-sm font-bold text-white font-mono mt-0.5">
                {stats.avgDuration}s
              </span>
            </div>

            <div className="bg-[#1a1a1a] p-2 rounded-lg border border-[#282828] flex flex-col">
              <span className="text-[10px] text-gray-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> אידיאלי (1.4-5.5s)
              </span>
              <span className="text-xs sm:text-sm font-bold text-emerald-400 font-mono mt-0.5">
                {stats.optimalCount} ({Math.round((stats.optimalCount / stats.count) * 100)}%)
              </span>
            </div>

            <div className="bg-[#1a1a1a] p-2 rounded-lg border border-[#282828] flex flex-col">
              <span className="text-[10px] text-rose-400 font-semibold flex items-center gap-1">
                <AlertOctagon className="w-3 h-3 text-rose-400" /> שגיאות OCR (&lt;1s)
              </span>
              <span className="text-xs sm:text-sm font-bold text-rose-400 font-mono mt-0.5">
                {stats.ocrErrorCount} כתוביות
              </span>
            </div>

            <div className="bg-[#1a1a1a] p-2 rounded-lg border border-[#282828] flex flex-col">
              <span className="text-[10px] text-purple-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-purple-400" /> ארוכות (&gt;5.5s)
              </span>
              <span className="text-xs sm:text-sm font-bold text-purple-300 font-mono mt-0.5">
                {stats.longCuesCount} כתוביות
              </span>
            </div>
          </div>

          {/* OCR Errors & Outliers Alert Banner */}
          {stats.ocrErrorCount > 0 && (
            <div className="flex items-center justify-between flex-wrap gap-2 px-2.5 py-1.5 bg-rose-950/40 border border-rose-500/40 rounded-lg text-xs">
              <div className="flex items-center gap-2 text-rose-200">
                <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
                <span>
                  זוהו <b>{stats.ocrErrorCount}</b> כתוביות קצרות מ-1.0 שניות (מודגשות באדום). לחץ עליהן לצפייה וסנכרון.
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() =>
                    setFilterMode(filterMode === "ocr-only" ? "all" : "ocr-only")
                  }
                  className={`text-[10px] font-bold px-2 py-0.5 rounded transition cursor-pointer ${
                    filterMode === "ocr-only"
                      ? "bg-rose-600 text-white"
                      : "bg-[#2a1518] hover:bg-[#381c20] text-rose-300 border border-rose-500/40"
                  }`}
                >
                  {filterMode === "ocr-only" ? "הצג הכל" : "הצג שגיאות OCR בלבד"}
                </button>
              </div>
            </div>
          )}

          {/* Chart Canvas */}
          <div className={`${compact ? "h-40" : "h-48"} w-full pt-1`}>
            <ResponsiveContainer width="100%" height="100%">
              {viewMode === "cues" ? (
                <BarChart
                  data={displayedCueData}
                  margin={{ top: 8, right: 8, left: -24, bottom: 16 }}
                  onClick={(e: any) => {
                    if (e && e.activePayload && e.activePayload[0] && onSelectCue) {
                      const payload = e.activePayload[0].payload;
                      onSelectCue(payload.id, payload.startTime);
                    }
                  }}
                >
                  <XAxis
                    dataKey="label"
                    stroke="#555555"
                    fontSize={9}
                    tickLine={false}
                    interval={Math.ceil(displayedCueData.length / 20)}
                  />
                  <YAxis
                    stroke="#555555"
                    fontSize={9}
                    unit="s"
                    domain={[0, "auto"]}
                    tickLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-[#1a1a1a] border border-[#404040] p-2 rounded-lg shadow-xl text-right max-w-xs text-xs">
                            <div className="flex items-center justify-between gap-2 border-b border-[#333] pb-1 font-bold text-white">
                              <span>כתובית #{data.index}</span>
                              <span
                                className={`font-mono ${
                                  data.status === "ocr-error"
                                    ? "text-rose-400 font-bold"
                                    : "text-blue-400"
                                }`}
                              >
                                {data.duration} שניות
                              </span>
                            </div>
                            <div className="text-[10px] text-gray-400 mt-1 font-mono">
                              תזמון: {formatTimeDisplay(data.startTime)} -{" "}
                              {formatTimeDisplay(data.endTime)}
                            </div>
                            <div className="text-xs text-gray-200 mt-1 font-medium line-clamp-2">
                              {data.hebrewText}
                            </div>
                            <div className="mt-1.5 pt-1 border-t border-[#333] flex items-center justify-between text-[10px]">
                              {data.status === "ocr-error" && (
                                <span className="text-rose-400 font-bold flex items-center gap-1">
                                  <AlertOctagon className="w-3 h-3" /> 🚩 שגיאת OCR (&lt;1s)
                                </span>
                              )}
                              {data.status === "short" && (
                                <span className="text-amber-400 font-semibold">
                                  ⚡ קצר (1.0-1.4s)
                                </span>
                              )}
                              {data.status === "long" && (
                                <span className="text-purple-400 font-semibold">
                                  ⚠️ ארוך (&gt;5.5s)
                                </span>
                              )}
                              {data.status === "optimal" && (
                                <span className="text-emerald-400 font-semibold">
                                  ✓ תזמון אידיאלי
                                </span>
                              )}
                              <span className="text-blue-400">לחץ לנגן</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine
                    y={1.0}
                    stroke="#ef4444"
                    strokeDasharray="3 3"
                    label={{
                      value: "סף OCR (1.0s)",
                      fill: "#f87171",
                      fontSize: 8,
                      position: "insideBottomRight",
                    }}
                  />
                  <ReferenceLine
                    y={stats.avgDuration}
                    stroke="#3b82f6"
                    strokeDasharray="4 4"
                    label={{
                      value: `ממוצע: ${stats.avgDuration}s`,
                      fill: "#60a5fa",
                      fontSize: 8,
                      position: "insideTopLeft",
                    }}
                  />
                  <Bar dataKey="duration" radius={[2, 2, 0, 0]} cursor="pointer">
                    {displayedCueData.map((entry) => {
                      let fillColor = "#10b981"; // emerald for optimal
                      if (entry.status === "ocr-error") fillColor = "#ef4444"; // RED for < 1s OCR error
                      else if (entry.status === "short") fillColor = "#f59e0b"; // amber
                      else if (entry.status === "long") fillColor = "#a855f7"; // purple

                      if (entry.isSelected) fillColor = "#3b82f6"; // blue highlight

                      return <Cell key={entry.id} fill={fillColor} />;
                    })}
                  </Bar>
                </BarChart>
              ) : (
                <BarChart
                  data={histogramData}
                  margin={{ top: 8, right: 8, left: -24, bottom: 16 }}
                >
                  <XAxis dataKey="range" stroke="#555555" fontSize={9} tickLine={false} />
                  <YAxis stroke="#555555" fontSize={9} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-[#1a1a1a] border border-[#404040] p-2 rounded-lg shadow-xl text-right text-xs">
                            <div className="font-bold text-white">{data.label}</div>
                            <div className="text-blue-400 font-bold mt-1">
                              {data.count} כתוביות (
                              {Math.round((data.count / (cues.length || 1)) * 100)}%)
                            </div>
                            <div className="text-[10px] text-gray-400 mt-0.5">{data.desc}</div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                    {histogramData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center flex-wrap gap-3 text-[10px] text-gray-400 pt-1 border-t border-[#222]">
            <div className="flex items-center gap-1 text-rose-400 font-semibold">
              <span className="w-2 h-2 rounded-sm bg-rose-500 inline-block"></span>
              <span>שגיאת OCR (&lt;1.0s)</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block"></span>
              <span>אידיאלי (1.4-5.5s)</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-amber-500 inline-block"></span>
              <span>קצר (1.0-1.4s)</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-purple-500 inline-block"></span>
              <span>ארוך (&gt;5.5s)</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
