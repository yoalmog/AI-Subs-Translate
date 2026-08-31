import React, { useState, useEffect } from "react";
import {
  Cpu,
  Trash2,
  HardDrive,
  Layers,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Info,
} from "lucide-react";
import {
  getMemoryStats,
  clearApplicationMemoryCache,
  MemoryStats,
} from "../utils/memoryDiagnostic";

interface MemoryDiagnosticOverlayProps {
  onCacheCleared?: (stats: { revokedUrlsCount: number; freedMB: number }) => void;
  className?: string;
}

export const MemoryDiagnosticOverlay: React.FC<MemoryDiagnosticOverlayProps> = ({
  onCacheCleared,
  className = "",
}) => {
  const [stats, setStats] = useState<MemoryStats>(getMemoryStats());
  const [isClearing, setIsClearing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Poll memory stats every 2.5 seconds
  useEffect(() => {
    const updateStats = () => setStats(getMemoryStats());
    updateStats();
    const interval = setInterval(updateStats, 2500);
    return () => clearInterval(interval);
  }, []);

  const handleClearCache = () => {
    setIsClearing(true);
    setTimeout(() => {
      const result = clearApplicationMemoryCache();
      const updated = getMemoryStats();
      setStats(updated);
      setIsClearing(false);

      const msg = `ניקוי זיכרון הושלם: שוחררו ${result.revokedUrlsCount} אובייקטי URL ופוסנה זיכרון מטמון.`;
      setFeedback(msg);

      if (onCacheCleared) {
        onCacheCleared(result);
      }

      setTimeout(() => setFeedback(null), 4000);
    }, 300);
  };

  const getHeapColor = (percentage: number | null) => {
    if (percentage === null) return "bg-blue-500";
    if (percentage > 80) return "bg-rose-500";
    if (percentage > 60) return "bg-amber-500";
    return "bg-emerald-500";
  };

  return (
    <div
      className={`bg-[#0d121d] border border-blue-900/40 rounded-xl p-3 shadow-md text-xs text-gray-300 font-sans transition-all ${className}`}
      id="memory-diagnostic-sidebar-card"
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 shrink-0">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="font-bold text-white text-xs">דיאגנוסטיקת זיכרון (Memory Diagnostic)</h4>
              <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.2 rounded font-mono border border-blue-500/30">
                Heap & Cache
              </span>
            </div>
            <p className="text-[10.5px] text-gray-400">
              ניטור ניצול זיכרון הדפדפן ואובייקטי וידאו בזמן אמת
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-[11px] text-blue-400 hover:text-blue-300 font-medium px-2 py-1 rounded bg-[#131926] border border-[#232f46] transition cursor-pointer"
        >
          {isExpanded ? "צמצם" : "הצג פרטים"}
        </button>
      </div>

      {/* Main Stats Row */}
      <div className="grid grid-cols-2 gap-2 mt-2.5">
        {/* Memory Heap Metric */}
        <div className="bg-[#111726] border border-[#1f2a40] rounded-lg p-2 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10.5px] text-gray-400 mb-1">
            <span className="flex items-center gap-1">
              <HardDrive className="w-3 h-3 text-blue-400" />
              <span>זיכרון Heap:</span>
            </span>
            <span className="font-mono text-white font-bold">
              {stats.usedHeapMB !== null ? `${stats.usedHeapMB} MB` : "משוער"}
            </span>
          </div>

          {stats.heapPercentage !== null ? (
            <div className="w-full bg-[#1b2438] h-2 rounded-full overflow-hidden mb-1 border border-[#2b3956]">
              <div
                className={`h-full transition-all duration-500 ${getHeapColor(stats.heapPercentage)}`}
                style={{ width: `${Math.min(100, stats.heapPercentage)}%` }}
              />
            </div>
          ) : (
            <div className="text-[9.5px] text-gray-500 italic mb-1">זמין בדפדפני Chromium</div>
          )}

          <div className="flex items-center justify-between text-[9.5px] text-gray-400 font-mono">
            <span>תפוסה: {stats.heapPercentage !== null ? `${stats.heapPercentage}%` : "נורמלית"}</span>
            {stats.heapLimitMB && <span>מתוך {stats.heapLimitMB} MB</span>}
          </div>
        </div>

        {/* Active Object URLs & Canvas Cache */}
        <div className="bg-[#111726] border border-[#1f2a40] rounded-lg p-2 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10.5px] text-gray-400 mb-1">
            <span className="flex items-center gap-1">
              <Layers className="w-3 h-3 text-purple-400" />
              <span>Object URLs פעילים:</span>
            </span>
            <span className="font-mono text-purple-300 font-bold text-xs">
              {stats.activeObjectUrlsCount}
            </span>
          </div>

          <div className="text-[10px] text-gray-300 font-mono flex items-center justify-between mb-1">
            <span>מטמון נגן מוקצה:</span>
            <span className="text-amber-300">~{stats.estimatedCacheSizeMB} MB</span>
          </div>

          <div className="text-[9.5px] text-gray-400 truncate">
            {stats.activeObjectUrlsCount > 3 ? (
              <span className="text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-2.5 h-2.5" />
                <span>מומלץ לבצע ניקוי</span>
              </span>
            ) : (
              <span className="text-emerald-400">סטטוס: אופטימלי</span>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Details Panel */}
      {isExpanded && (
        <div className="mt-2.5 pt-2 border-t border-[#1d273c] text-[11px] space-y-1.5 text-gray-300 animate-in fade-in">
          <div className="flex items-center justify-between text-[10.5px]">
            <span className="text-gray-400">סה"כ זיכרון מוקצה במעבד:</span>
            <span className="font-mono text-gray-200">{stats.totalHeapMB ? `${stats.totalHeapMB} MB` : "ללא מגבלה"}</span>
          </div>
          <div className="flex items-center justify-between text-[10.5px]">
            <span className="text-gray-400">תמיכת דפדפן ב-Performance API:</span>
            <span className="font-mono text-emerald-400">{stats.isSupported ? "פעיל (Full)" : "חלקי"}</span>
          </div>
          <div className="p-2 bg-[#131a29] rounded border border-[#212d46] text-[10px] text-gray-400 leading-relaxed flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
            <span>
              בעריכת סרטונים ארוכים, דפדפנים שומרים אובייקטי Blob בזיכרון המטמון. ניקוי יזום משחרר את הזיכרון ומבטיח זרימה חלקית ללא השהיות.
            </span>
          </div>
        </div>
      )}

      {/* Feedback Message */}
      {feedback && (
        <div className="mt-2 p-1.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-[11px] flex items-center gap-1.5 animate-in fade-in">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Manual Clear Cache Button */}
      <div className="mt-2.5 flex items-center justify-end">
        <button
          type="button"
          id="clear-memory-cache-btn"
          onClick={handleClearCache}
          disabled={isClearing}
          className="w-full sm:w-auto px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-lg text-xs shadow transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          title="שחרר אובייקטי Blob ומטמון זיכרון של הנגן"
        >
          {isClearing ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Trash2 className="w-3.5 h-3.5 text-rose-300" />
          )}
          <span>שחרר זיכרון ומטמון (Clear Cache)</span>
        </button>
      </div>
    </div>
  );
};
