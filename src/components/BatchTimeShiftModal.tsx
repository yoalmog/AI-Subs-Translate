import React, { useState, useMemo } from "react";
import {
  Clock,
  Rewind,
  FastForward,
  Check,
  X,
  Layers,
  Percent,
  Timer,
  Sliders,
  Filter,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { SubtitleCue } from "../types";
import { formatTimeDisplay, parseTimestampToSeconds } from "../utils/timeFormat";

export type BulkShiftMode = "fixed" | "percentage";
export type BulkShiftScope = "all" | "selected" | "time_range";

export interface BulkShiftOptions {
  mode: BulkShiftMode;
  // For fixed shift
  shiftSeconds: number; // positive = forward/delay, negative = backward/earlier
  // For percentage shift
  percentage: number; // e.g. +4.1% or -2.5%
  stretchAnchor: "zero" | "first_cue" | "range_start";
  // Scope
  scope: BulkShiftScope;
  rangeStartTime?: number;
  rangeEndTime?: number;
  selectedCueIds?: string[];
}

interface BatchTimeShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  cues: SubtitleCue[];
  selectedCueIds?: string[];
  currentTime?: number;
  onApplyBulkShift: (options: BulkShiftOptions) => void;
}

export const BatchTimeShiftModal: React.FC<BatchTimeShiftModalProps> = ({
  isOpen,
  onClose,
  cues,
  selectedCueIds = [],
  currentTime = 0,
  onApplyBulkShift,
}) => {
  const [shiftMode, setShiftMode] = useState<BulkShiftMode>("fixed");
  const [shiftDirection, setShiftDirection] = useState<"forward" | "backward">("forward");
  const [amountMs, setAmountMs] = useState<number>(250);
  const [percentageShift, setPercentageShift] = useState<number>(4.1); // e.g. PAL -> 24fps default
  const [stretchAnchor, setStretchAnchor] = useState<"zero" | "first_cue" | "range_start">("first_cue");

  const [scope, setScope] = useState<BulkShiftScope>(
    selectedCueIds.length > 0 ? "selected" : "all"
  );

  // Time range filtering
  const minCueTime = useMemo(
    () => (cues.length > 0 ? Math.min(...cues.map((c) => c.startTime)) : 0),
    [cues]
  );
  const maxCueTime = useMemo(
    () => (cues.length > 0 ? Math.max(...cues.map((c) => c.endTime)) : 10),
    [cues]
  );

  const [rangeStartInput, setRangeStartInput] = useState<string>("00:00.000");
  const [rangeEndInput, setRangeEndInput] = useState<string>(
    formatTimeDisplay(maxCueTime || 60)
  );

  if (!isOpen) return null;

  const parsedRangeStart = Math.max(0, parseTimestampToSeconds(rangeStartInput));
  const parsedRangeEnd = Math.max(parsedRangeStart, parseTimestampToSeconds(rangeEndInput));

  // Determine affected cues
  const affectedCues = cues.filter((cue) => {
    if (scope === "selected") {
      return selectedCueIds.includes(cue.id);
    }
    if (scope === "time_range") {
      return cue.startTime >= parsedRangeStart && cue.startTime <= parsedRangeEnd;
    }
    return true; // "all"
  });

  const presetAmounts = [50, 100, 250, 500, 1000, 2000, 5000];
  const percentagePresets = [
    { label: "+0.1% (23.976 → 24fps)", val: 0.1 },
    { label: "+4.1% (24 → 25fps PAL)", val: 4.1 },
    { label: "-4.1% (25fps PAL → 24)", val: -4.1 },
    { label: "+5.0% (האטה קלה)", val: 5.0 },
    { label: "-5.0% (האצה קלה)", val: -5.0 },
    { label: "+10.0%", val: 10.0 },
    { label: "-10.0%", val: -10.0 },
  ];

  const handleExecute = () => {
    const deltaMs = shiftDirection === "forward" ? amountMs : -amountMs;
    const deltaSeconds = deltaMs / 1000;

    onApplyBulkShift({
      mode: shiftMode,
      shiftSeconds: deltaSeconds,
      percentage: percentageShift,
      stretchAnchor,
      scope,
      rangeStartTime: scope === "time_range" ? parsedRangeStart : undefined,
      rangeEndTime: scope === "time_range" ? parsedRangeEnd : undefined,
      selectedCueIds: scope === "selected" ? selectedCueIds : undefined,
    });
    onClose();
  };

  // Sample preview of first affected cue
  const sampleCue = affectedCues[0];
  let sampleShiftedStart = 0;
  let sampleShiftedEnd = 0;

  if (sampleCue) {
    if (shiftMode === "fixed") {
      const deltaSeconds = (shiftDirection === "forward" ? amountMs : -amountMs) / 1000;
      sampleShiftedStart = Math.max(0, sampleCue.startTime + deltaSeconds);
      sampleShiftedEnd = Math.max(sampleShiftedStart + 0.1, sampleCue.endTime + deltaSeconds);
    } else {
      const factor = 1 + percentageShift / 100;
      let anchor = 0;
      if (stretchAnchor === "first_cue") anchor = minCueTime;
      if (stretchAnchor === "range_start") anchor = parsedRangeStart;

      sampleShiftedStart = Math.max(0, anchor + (sampleCue.startTime - anchor) * factor);
      sampleShiftedEnd = Math.max(
        sampleShiftedStart + 0.1,
        anchor + (sampleCue.endTime - anchor) * factor
      );
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in" dir="rtl">
      <div className="bg-[#141414] border border-[#2b2b2b] rounded-2xl w-full max-w-lg shadow-2xl p-5 relative flex flex-col gap-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#242424] pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-950/70 border border-cyan-500/40 rounded-xl text-cyan-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                הזזת וסנכרון תזמון קבוצתי (Bulk Offset & Sync)
              </h3>
              <p className="text-[11px] text-gray-400">
                הזזת זמנים במילישניות, התאמה באחוזים (Time Stretch) או לפי טווח זמנים
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-[#222222] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-[#0c0c0c] border border-[#222] rounded-xl">
          <button
            type="button"
            onClick={() => setShiftMode("fixed")}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              shiftMode === "fixed"
                ? "bg-cyan-600 text-white shadow-md shadow-cyan-900/30"
                : "text-gray-400 hover:text-white hover:bg-[#1a1a1a]"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>הזזה קבועה (ms / שניות)</span>
          </button>
          <button
            type="button"
            onClick={() => setShiftMode("percentage")}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              shiftMode === "percentage"
                ? "bg-cyan-600 text-white shadow-md shadow-cyan-900/30"
                : "text-gray-400 hover:text-white hover:bg-[#1a1a1a]"
            }`}
          >
            <Percent className="w-4 h-4" />
            <span>התאמה באחוזים (Sync Drift)</span>
          </button>
        </div>

        {/* MODE 1: FIXED OFFSET */}
        {shiftMode === "fixed" && (
          <div className="space-y-3.5 bg-[#0f0f0f] p-3.5 rounded-xl border border-[#202020]">
            {/* Direction Selection */}
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1.5">
                כיוון הזזת התזמון:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShiftDirection("forward")}
                  className={`p-2 rounded-lg border flex items-center justify-center gap-2 text-xs font-bold transition cursor-pointer ${
                    shiftDirection === "forward"
                      ? "bg-cyan-600/30 text-cyan-300 border-cyan-500 shadow-xs"
                      : "bg-[#141414] text-gray-400 border-[#262626] hover:text-white hover:bg-[#1c1c1c]"
                  }`}
                >
                  <FastForward className="w-4 h-4 text-cyan-400" />
                  <span>קדימה (איחור / +)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShiftDirection("backward")}
                  className={`p-2 rounded-lg border flex items-center justify-center gap-2 text-xs font-bold transition cursor-pointer ${
                    shiftDirection === "backward"
                      ? "bg-cyan-600/30 text-cyan-300 border-cyan-500 shadow-xs"
                      : "bg-[#141414] text-gray-400 border-[#262626] hover:text-white hover:bg-[#1c1c1c]"
                  }`}
                >
                  <Rewind className="w-4 h-4 text-cyan-400" />
                  <span>אחורה (הקדמה / -)</span>
                </button>
              </div>
            </div>

            {/* Amount Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-gray-300">
                  כמות מילישניות להזזה (ms):
                </label>
                <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/60 border border-cyan-800/40 px-2 py-0.5 rounded">
                  {(amountMs / 1000).toFixed(3)} שניות
                </span>
              </div>

              <div className="relative mb-2">
                <input
                  type="number"
                  min="1"
                  max="120000"
                  step="50"
                  value={amountMs}
                  onChange={(e) => setAmountMs(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-full bg-[#161616] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-cyan-500"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-gray-500">
                  ms
                </span>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-gray-500 font-medium ml-1">מהיר:</span>
                {presetAmounts.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setAmountMs(p)}
                    className={`px-2 py-1 rounded text-[11px] font-mono transition border cursor-pointer ${
                      amountMs === p
                        ? "bg-cyan-600 text-white border-cyan-400 font-bold"
                        : "bg-[#161616] text-gray-400 border-[#262626] hover:text-white hover:bg-[#222]"
                    }`}
                  >
                    {p >= 1000 ? `${p / 1000}s` : `${p}ms`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* MODE 2: PERCENTAGE SHIFT & DRIFT */}
        {shiftMode === "percentage" && (
          <div className="space-y-3.5 bg-[#0f0f0f] p-3.5 rounded-xl border border-[#202020]">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-gray-300">
                  אחוז שינוי מהירות / מתיחת תזמון (%):
                </label>
                <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/60 border border-cyan-800/40 px-2 py-0.5 rounded">
                  {percentageShift > 0 ? `+${percentageShift}%` : `${percentageShift}%`} (פקטור{" "}
                  {(1 + percentageShift / 100).toFixed(4)})
                </span>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="-15"
                  max="15"
                  step="0.1"
                  value={percentageShift}
                  onChange={(e) => setPercentageShift(parseFloat(e.target.value) || 0)}
                  className="flex-1 accent-cyan-500 cursor-pointer"
                />
                <input
                  type="number"
                  step="0.1"
                  value={percentageShift}
                  onChange={(e) => setPercentageShift(parseFloat(e.target.value) || 0)}
                  className="w-20 bg-[#161616] border border-[#2a2a2a] rounded-lg px-2 py-1 text-xs font-mono text-white text-center focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Percentage Presets */}
            <div>
              <label className="text-[11px] font-semibold text-gray-400 block mb-1.5">
                הגדרות קבועות מראש (Sync Presets):
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {percentagePresets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setPercentageShift(preset.val)}
                    className={`px-2 py-1.5 rounded-lg text-[11px] font-mono text-right transition border cursor-pointer ${
                      percentageShift === preset.val
                        ? "bg-cyan-600/40 text-cyan-200 border-cyan-400 font-bold"
                        : "bg-[#141414] text-gray-400 border-[#242424] hover:text-white hover:bg-[#1a1a1a]"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Stretch Anchor Point */}
            <div>
              <label className="text-[11px] font-semibold text-gray-400 block mb-1">
                נקודת עוגן למתיחה (Anchor Point):
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStretchAnchor("first_cue")}
                  className={`p-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                    stretchAnchor === "first_cue"
                      ? "bg-cyan-600/30 text-cyan-300 border-cyan-500"
                      : "bg-[#141414] text-gray-400 border-[#262626]"
                  }`}
                >
                  הכתובית הראשונה שנבחרה
                </button>
                <button
                  type="button"
                  onClick={() => setStretchAnchor("zero")}
                  className={`p-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                    stretchAnchor === "zero"
                      ? "bg-cyan-600/30 text-cyan-300 border-cyan-500"
                      : "bg-[#141414] text-gray-400 border-[#262626]"
                  }`}
                >
                  תחילת הווידאו (00:00)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TARGET SCOPE SELECTION */}
        <div className="bg-[#0f0f0f] border border-[#222] rounded-xl p-3 space-y-2.5">
          <label className="text-xs text-gray-300 font-bold flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-cyan-400" />
            <span>החל שינוי על (Target Scope):</span>
          </label>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setScope("all")}
              className={`p-2 rounded-lg text-xs font-semibold border transition cursor-pointer flex flex-col items-center gap-0.5 ${
                scope === "all"
                  ? "bg-cyan-600/30 text-cyan-200 border-cyan-500 font-bold"
                  : "bg-[#141414] text-gray-400 border-[#262626] hover:text-white"
              }`}
            >
              <span>כל הכתוביות</span>
              <span className="text-[10px] font-mono opacity-80">({cues.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setScope("selected")}
              disabled={selectedCueIds.length === 0}
              className={`p-2 rounded-lg text-xs font-semibold border transition cursor-pointer flex flex-col items-center gap-0.5 disabled:opacity-30 disabled:pointer-events-none ${
                scope === "selected"
                  ? "bg-cyan-600/30 text-cyan-200 border-cyan-500 font-bold"
                  : "bg-[#141414] text-gray-400 border-[#262626] hover:text-white"
              }`}
            >
              <span>כתוביות מסומנות</span>
              <span className="text-[10px] font-mono opacity-80">({selectedCueIds.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setScope("time_range")}
              className={`p-2 rounded-lg text-xs font-semibold border transition cursor-pointer flex flex-col items-center gap-0.5 ${
                scope === "time_range"
                  ? "bg-cyan-600/30 text-cyan-200 border-cyan-500 font-bold"
                  : "bg-[#141414] text-gray-400 border-[#262626] hover:text-white"
              }`}
            >
              <span>לפי טווח זמנים</span>
              <span className="text-[10px] font-mono opacity-80">Range Filter</span>
            </button>
          </div>

          {/* Time Range Input Fields */}
          {scope === "time_range" && (
            <div className="bg-[#141414] p-3 rounded-lg border border-[#282828] space-y-2 animate-in fade-in">
              <div className="text-[11px] text-cyan-300 font-semibold flex items-center justify-between">
                <span>ציין טווח זמני התחלה של כתוביות (Start Time Range):</span>
                <button
                  type="button"
                  onClick={() => {
                    setRangeStartInput(formatTimeDisplay(currentTime));
                    setRangeEndInput(formatTimeDisplay(maxCueTime));
                  }}
                  className="text-[10px] text-gray-400 hover:text-white underline cursor-pointer"
                >
                  מהנקודה הנוכחית ({formatTimeDisplay(currentTime)}) והלאה
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1">מזמן התחלה:</label>
                  <input
                    type="text"
                    value={rangeStartInput}
                    onChange={(e) => setRangeStartInput(e.target.value)}
                    placeholder="00:00.000"
                    className="w-full bg-[#0d0d0d] border border-[#333] rounded px-2.5 py-1.5 text-xs font-mono text-white text-center focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1">עד זמן התחלה:</label>
                  <input
                    type="text"
                    value={rangeEndInput}
                    onChange={(e) => setRangeEndInput(e.target.value)}
                    placeholder="05:00.000"
                    className="w-full bg-[#0d0d0d] border border-[#333] rounded px-2.5 py-1.5 text-xs font-mono text-white text-center focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="text-[10px] text-gray-400 text-left">
                נמצאו {affectedCues.length} כתוביות בטווח שנבחר ({formatTimeDisplay(parsedRangeStart)} -{" "}
                {formatTimeDisplay(parsedRangeEnd)})
              </div>
            </div>
          )}
        </div>

        {/* Live Preview Summary Box */}
        <div className="text-xs p-3 rounded-xl bg-[#091522] border border-cyan-500/30 text-cyan-200 space-y-1.5">
          <div className="flex items-center justify-between font-semibold text-white">
            <span>סיכום שינוי תזמון:</span>
            <span className="bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded font-mono text-[11px] border border-cyan-700/50">
              {affectedCues.length} כתוביות יושפעו
            </span>
          </div>

          <div className="text-[11px] text-cyan-300/90 leading-relaxed">
            {shiftMode === "fixed" ? (
              <span>
                הזזה של{" "}
                <span className="font-bold text-white font-mono">
                  {shiftDirection === "forward" ? "+" : "-"}
                  {amountMs}ms ({(amountMs / 1000).toFixed(3)}s)
                </span>{" "}
                {scope === "all"
                  ? "לכל הכתוביות בפרויקט"
                  : scope === "selected"
                  ? `ל-${affectedCues.length} הכתוביות שנבחרו`
                  : `לכתוביות בטווח הזמנים המוגדר`}
                .
              </span>
            ) : (
              <span>
                מתיחה / כיווץ באחוזים של{" "}
                <span className="font-bold text-white font-mono">
                  {percentageShift > 0 ? `+${percentageShift}%` : `${percentageShift}%`}
                </span>{" "}
                ביחס לעוגן ({stretchAnchor === "first_cue" ? "כתובית ראשונה" : "00:00"}).
              </span>
            )}
          </div>

          {sampleCue && (
            <div className="mt-1 pt-1.5 border-t border-cyan-800/40 text-[10px] font-mono flex items-center justify-between text-cyan-300">
              <span>דוגמה לכתובית ראשונה:</span>
              <span className="flex items-center gap-1.5">
                <span className="text-gray-400">{formatTimeDisplay(sampleCue.startTime)}</span>
                <ArrowRight className="w-3 h-3 text-cyan-400 rotate-180" />
                <span className="font-bold text-white">{formatTimeDisplay(sampleShiftedStart)}</span>
              </span>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#242424]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#1c1c1c] hover:bg-[#282828] text-gray-300 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            ביטול
          </button>
          <button
            type="button"
            id="apply-bulk-shift-btn"
            onClick={handleExecute}
            disabled={affectedCues.length === 0}
            className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40 disabled:pointer-events-none text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-cyan-900/40 cursor-pointer active:scale-98"
          >
            <Check className="w-4 h-4" />
            <span>החל שינוי תזמון ({affectedCues.length})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
