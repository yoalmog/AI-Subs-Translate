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
} from "lucide-react";
import { SubtitleCue } from "../types";
import { formatTimeDisplay } from "../utils/timeFormat";

interface DurationDistributionChartProps {
  cues: SubtitleCue[];
  onSelectCue?: (cueId: string, startTime: number) => void;
  selectedCueId?: string | null;
}

export const DurationDistributionChart: React.FC<DurationDistributionChartProps> = ({
  cues,
  onSelectCue,
  selectedCueId,
}) => {
  const [viewMode, setViewMode] = useState<"cues" | "histogram">("cues");
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [filterOutliersOnly, setFilterOutliersOnly] = useState<boolean>(false);

  // Calculate duration statistics
  const stats = useMemo(() => {
    if (!cues.length) {
      return {
        count: 0,
        avgDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        shortCuesCount: 0,
        longCuesCount: 0,
        optimalCount: 0,
      };
    }

    const durations = cues.map((c) => Math.max(0.1, c.endTime - c.startTime));
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);
    const avgDuration = Number((totalDuration / cues.length).toFixed(2));
    const minDuration = Number(Math.min(...durations).toFixed(2));
    const maxDuration = Number(Math.max(...durations).toFixed(2));

    // Thresholds: Short < 1.2s, Long > 5.5s
    const shortCues = cues.filter((c) => c.endTime - c.startTime < 1.2);
    const longCues = cues.filter((c) => c.endTime - c.startTime > 5.5);
    const optimalCues = cues.filter(
      (c) => c.endTime - c.startTime >= 1.2 && c.endTime - c.startTime <= 5.5
    );

    return {
      count: cues.length,
      avgDuration,
      minDuration,
      maxDuration,
      shortCuesCount: shortCues.length,
      longCuesCount: longCues.length,
      optimalCount: optimalCues.length,
    };
  }, [cues]);

  // Data for Per-Cue Duration Chart
  const cueChartData = useMemo(() => {
    return cues.map((cue, idx) => {
      const duration = Number(Math.max(0.1, cue.endTime - cue.startTime).toFixed(2));
      let status: "short" | "optimal" | "long" = "optimal";
      if (duration < 1.2) status = "short";
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

  // Filtered Cues data if user toggles outlier filter
  const displayedCueData = useMemo(() => {
    if (!filterOutliersOnly) return cueChartData;
    return cueChartData.filter((d) => d.status !== "optimal");
  }, [cueChartData, filterOutliersOnly]);

  // Data for Histogram Buckets
  const histogramData = useMemo(() => {
    const buckets = [
      { range: "< 1.2s", label: "קצר מדי (<1.2s)", count: 0, color: "#f59e0b", desc: "עשוי לחלוף מהר מדי" },
      { range: "1.2 - 2.5s", label: "קצר (1.2-2.5s)", count: 0, color: "#3b82f6", desc: "מתאים למשפטים קצרים" },
      { range: "2.5 - 4.5s", label: "אידיאלי (2.5-4.5s)", count: 0, color: "#10b981", desc: "זמן קריאה אופטימלי" },
      { range: "4.5 - 5.5s", label: "בינוני-ארוך", count: 0, color: "#6366f1", desc: "מתאים לפסקאות מלאות" },
      { range: "> 5.5s", label: "ארוך מדי (>5.5s)", count: 0, color: "#ef4444", desc: "עומס קריאה על המסך" },
    ];

    cues.forEach((c) => {
      const d = c.endTime - c.startTime;
      if (d < 1.2) buckets[0].count++;
      else if (d <= 2.5) buckets[1].count++;
      else if (d <= 4.5) buckets[2].count++;
      else if (d <= 5.5) buckets[3].count++;
      else buckets[4].count++;
    });

    return buckets;
  }, [cues]);

  if (!cues.length) return null;

  return (
    <div className="bg-[#141414] border border-[#262626] rounded-xl p-3 sm:p-4 text-white flex flex-col gap-3 shadow-md">
      {/* Header with Stats and View Toggle */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-[#262626]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/30">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
              <span>התפלגות משך הכתוביות (קריאות ואופטימיזציה)</span>
            </h3>
            <span className="text-[11px] text-gray-400">
              ניתוח משך תצוגת הכתוביות לזיהוי מקטעים קצרים או ארוכים מדי
            </span>
          </div>
        </div>

        {/* View Mode & Collapse Controls */}
        <div className="flex items-center gap-1.5 mr-auto">
          <div className="flex items-center bg-[#1a1a1a] rounded-lg p-0.5 border border-[#333333] text-xs">
            <button
              onClick={() => setViewMode("cues")}
              className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                viewMode === "cues"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              לפי כתובית
            </button>
            <button
              onClick={() => setViewMode("histogram")}
              className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                viewMode === "histogram"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              היסטוגרמת טווחים
            </button>
          </div>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 bg-[#1e1e1e] hover:bg-[#2a2a2a] text-gray-400 hover:text-white rounded-lg border border-[#333] transition"
            title={isCollapsed ? "הרחב תרשים" : "כווץ תרשים"}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-[#1a1a1a] p-2.5 rounded-lg border border-[#2a2a2a] flex flex-col">
              <span className="text-[10px] text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3 text-blue-400" /> משך ממוצע
              </span>
              <span className="text-sm font-bold text-white font-mono mt-0.5">
                {stats.avgDuration}s
              </span>
            </div>

            <div className="bg-[#1a1a1a] p-2.5 rounded-lg border border-[#2a2a2a] flex flex-col">
              <span className="text-[10px] text-gray-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> טווח אידיאלי (1.2-5.5s)
              </span>
              <span className="text-sm font-bold text-emerald-400 font-mono mt-0.5">
                {stats.optimalCount} ({Math.round((stats.optimalCount / stats.count) * 100)}%)
              </span>
            </div>

            <div className="bg-[#1a1a1a] p-2.5 rounded-lg border border-[#2a2a2a] flex flex-col">
              <span className="text-[10px] text-amber-400 flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" /> קצר מדי (&lt;1.2s)
              </span>
              <span className="text-sm font-bold text-amber-300 font-mono mt-0.5">
                {stats.shortCuesCount} כתוביות
              </span>
            </div>

            <div className="bg-[#1a1a1a] p-2.5 rounded-lg border border-[#2a2a2a] flex flex-col">
              <span className="text-[10px] text-rose-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-rose-400" /> ארוך מדי (&gt;5.5s)
              </span>
              <span className="text-sm font-bold text-rose-300 font-mono mt-0.5">
                {stats.longCuesCount} כתוביות
              </span>
            </div>
          </div>

          {/* Outliers Alert & Quick Filter */}
          {(stats.shortCuesCount > 0 || stats.longCuesCount > 0) && (
            <div className="flex items-center justify-between flex-wrap gap-2 px-3 py-2 bg-amber-950/30 border border-amber-500/30 rounded-lg text-xs">
              <div className="flex items-center gap-2 text-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  זוהו <b>{stats.shortCuesCount + stats.longCuesCount}</b> כתוביות חריגות מקצב הקריאה המומלץ. לחץ על עמודה בתרשים כדי לקפוץ אליה.
                </span>
              </div>
              <button
                onClick={() => setFilterOutliersOnly(!filterOutliersOnly)}
                className={`text-[11px] font-bold px-2 py-1 rounded transition cursor-pointer ${
                  filterOutliersOnly
                    ? "bg-amber-600 text-white"
                    : "bg-[#2a2015] hover:bg-[#382b1c] text-amber-300 border border-amber-500/40"
                }`}
              >
                {filterOutliersOnly ? "הצג את כל הכתוביות" : "הצג חריגות בלבד"}
              </button>
            </div>
          )}

          {/* Chart Canvas */}
          <div className="h-52 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              {viewMode === "cues" ? (
                <BarChart
                  data={displayedCueData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                  onClick={(e: any) => {
                    if (e && e.activePayload && e.activePayload[0] && onSelectCue) {
                      const payload = e.activePayload[0].payload;
                      onSelectCue(payload.id, payload.startTime);
                    }
                  }}
                >
                  <XAxis
                    dataKey="label"
                    stroke="#666666"
                    fontSize={10}
                    tickLine={false}
                    interval={Math.ceil(displayedCueData.length / 20)}
                  />
                  <YAxis
                    stroke="#666666"
                    fontSize={10}
                    unit="s"
                    domain={[0, "auto"]}
                    tickLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-[#1f1f1f] border border-[#404040] p-2.5 rounded-lg shadow-xl text-right max-w-xs text-xs">
                            <div className="flex items-center justify-between gap-2 border-b border-[#333] pb-1 font-bold text-white">
                              <span>כתובית #{data.index}</span>
                              <span className="text-blue-400 font-mono">
                                {data.duration} שניות
                              </span>
                            </div>
                            <div className="text-[10px] text-gray-400 mt-1 font-mono">
                              תזמון: {formatTimeDisplay(data.startTime)} - {formatTimeDisplay(data.endTime)}
                            </div>
                            <div className="text-xs text-gray-200 mt-1.5 font-medium line-clamp-2">
                              {data.hebrewText}
                            </div>
                            <div className="mt-1.5 pt-1 border-t border-[#333] flex items-center justify-between text-[10px]">
                              {data.status === "short" && (
                                <span className="text-amber-400 font-semibold">⚡ קצר מדי לקריאה</span>
                              )}
                              {data.status === "long" && (
                                <span className="text-rose-400 font-semibold">⚠️ ארוך מדי</span>
                              )}
                              {data.status === "optimal" && (
                                <span className="text-emerald-400 font-semibold">✓ תזמון מעולה</span>
                              )}
                              <span className="text-blue-400">לחץ לקפיצה לנגן</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine
                    y={stats.avgDuration}
                    stroke="#3b82f6"
                    strokeDasharray="4 4"
                    label={{
                      value: `ממוצע: ${stats.avgDuration}s`,
                      fill: "#60a5fa",
                      fontSize: 10,
                      position: "insideTopLeft",
                    }}
                  />
                  <Bar dataKey="duration" radius={[3, 3, 0, 0]} cursor="pointer">
                    {displayedCueData.map((entry) => {
                      let fillColor = "#3b82f6";
                      if (entry.status === "short") fillColor = "#f59e0b"; // amber for fast/short
                      else if (entry.status === "long") fillColor = "#ef4444"; // red for too long
                      else fillColor = "#10b981"; // emerald for optimal

                      if (entry.isSelected) fillColor = "#a855f7"; // purple highlight

                      return <Cell key={entry.id} fill={fillColor} />;
                    })}
                  </Bar>
                </BarChart>
              ) : (
                <BarChart
                  data={histogramData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                >
                  <XAxis dataKey="range" stroke="#666666" fontSize={10} tickLine={false} />
                  <YAxis stroke="#666666" fontSize={10} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-[#1f1f1f] border border-[#404040] p-2.5 rounded-lg shadow-xl text-right text-xs">
                            <div className="font-bold text-white">{data.label}</div>
                            <div className="text-blue-400 font-bold mt-1">
                              {data.count} כתוביות ({Math.round((data.count / (cues.length || 1)) * 100)}%)
                            </div>
                            <div className="text-[11px] text-gray-400 mt-0.5">{data.desc}</div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {histogramData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center flex-wrap gap-4 text-[11px] text-gray-400 pt-1 border-t border-[#222]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block"></span>
              <span>קצר מדי (&lt;1.2s)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block"></span>
              <span>טווח קריאה אידיאלי (1.2s - 5.5s)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block"></span>
              <span>ארוך מדי (&gt;5.5s)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 border-t border-dashed border-blue-400 inline-block"></span>
              <span>משך ממוצע ({stats.avgDuration}s)</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
