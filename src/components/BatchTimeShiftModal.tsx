import React, { useState } from "react";
import { Clock, Rewind, FastForward, Check, X, Layers, ArrowLeftRight } from "lucide-react";
import { SubtitleCue } from "../types";

interface BatchTimeShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  cues: SubtitleCue[];
  selectedCueIds?: string[];
  onApplyShift: (shiftSeconds: number, targetScope: "all" | "selected") => void;
}

export const BatchTimeShiftModal: React.FC<BatchTimeShiftModalProps> = ({
  isOpen,
  onClose,
  cues,
  selectedCueIds = [],
  onApplyShift,
}) => {
  const [shiftDirection, setShiftDirection] = useState<"forward" | "backward">("forward");
  const [amountMs, setAmountMs] = useState<number>(250);
  const [targetScope, setTargetScope] = useState<"all" | "selected">(
    selectedCueIds.length > 0 ? "selected" : "all"
  );

  if (!isOpen) return null;

  const presetAmounts = [50, 100, 250, 500, 1000, 2000];

  const handleExecuteShift = () => {
    const deltaMs = shiftDirection === "forward" ? amountMs : -amountMs;
    const deltaSeconds = deltaMs / 1000;
    onApplyShift(deltaSeconds, targetScope);
    onClose();
  };

  const countToAffect = targetScope === "selected" && selectedCueIds.length > 0
    ? selectedCueIds.length
    : cues.length;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-[#161616] border border-[#2e2e2e] rounded-xl w-full max-w-md shadow-2xl p-5 relative flex flex-col gap-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#262626] pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-400" />
            <h3 className="text-sm font-bold text-white">הזזת תזמון קבוצתית (Batch Time Shift)</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-[#222222] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Direction Selection */}
        <div>
          <label className="text-xs font-semibold text-gray-300 block mb-1.5">
            כיוון הזזת התזמון:
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setShiftDirection("forward")}
              className={`p-2.5 rounded-lg border flex items-center justify-center gap-2 text-xs font-bold transition cursor-pointer ${
                shiftDirection === "forward"
                  ? "bg-blue-600/30 text-blue-300 border-blue-500 shadow-sm"
                  : "bg-[#111111] text-gray-400 border-[#262626] hover:text-white hover:bg-[#1c1c1c]"
              }`}
            >
              <FastForward className="w-4 h-4 text-blue-400" />
              <span>קדימה (איחור / +)</span>
            </button>
            <button
              type="button"
              onClick={() => setShiftDirection("backward")}
              className={`p-2.5 rounded-lg border flex items-center justify-center gap-2 text-xs font-bold transition cursor-pointer ${
                shiftDirection === "backward"
                  ? "bg-blue-600/30 text-blue-300 border-blue-500 shadow-sm"
                  : "bg-[#111111] text-gray-400 border-[#262626] hover:text-white hover:bg-[#1c1c1c]"
              }`}
            >
              <Rewind className="w-4 h-4 text-blue-400" />
              <span>אחורה (הקדמה / -)</span>
            </button>
          </div>
        </div>

        {/* Amount in Milliseconds */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-gray-300">
              כמות מילישניות להזזה (ms):
            </label>
            <span className="text-xs font-mono font-bold text-blue-400 bg-blue-950/60 border border-blue-800/40 px-2 py-0.5 rounded">
              {(amountMs / 1000).toFixed(3)} שניות
            </span>
          </div>

          <div className="relative mb-2">
            <input
              type="number"
              min="1"
              max="60000"
              step="50"
              value={amountMs}
              onChange={(e) => setAmountMs(Math.max(1, parseInt(e.target.value) || 0))}
              className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
                    ? "bg-blue-600 text-white border-blue-400 font-bold"
                    : "bg-[#111] text-gray-400 border-[#262626] hover:text-white hover:bg-[#202020]"
                }`}
              >
                {p >= 1000 ? `${p / 1000}s` : `${p}ms`}
              </button>
            ))}
          </div>
        </div>

        {/* Scope Selection (All vs Selected) */}
        {selectedCueIds.length > 0 && (
          <div className="bg-[#101010] border border-[#242424] rounded-lg p-3 space-y-2">
            <label className="text-xs text-gray-300 font-semibold block">החל שינוי על:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTargetScope("all")}
                className={`p-2 rounded text-xs font-semibold border transition cursor-pointer ${
                  targetScope === "all"
                    ? "bg-blue-600/30 text-blue-300 border-blue-500"
                    : "bg-[#161616] text-gray-400 border-[#2b2b2b]"
                }`}
              >
                כל {cues.length} הכתוביות
              </button>
              <button
                type="button"
                onClick={() => setTargetScope("selected")}
                className={`p-2 rounded text-xs font-semibold border transition cursor-pointer ${
                  targetScope === "selected"
                    ? "bg-blue-600/30 text-blue-300 border-blue-500"
                    : "bg-[#161616] text-gray-400 border-[#2b2b2b]"
                }`}
              >
                {selectedCueIds.length} כתוביות שנבחרו
              </button>
            </div>
          </div>
        )}

        {/* Preview Message */}
        <div className="text-xs p-3 rounded-lg bg-[#0d1624] border border-blue-500/30 text-blue-200">
          יבוצע שינוי תזמון של{" "}
          <span className="font-bold text-white font-mono">
            {shiftDirection === "forward" ? "+" : "-"}
            {amountMs}ms ({shiftDirection === "forward" ? "+" : "-"}
            {(amountMs / 1000).toFixed(3)}s)
          </span>{" "}
          עבור <span className="font-bold text-white">{countToAffect} כתוביות</span>.
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#262626]">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-[#1f1f1f] hover:bg-[#282828] text-gray-300 rounded-lg text-xs font-semibold transition cursor-pointer"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={handleExecuteShift}
            disabled={amountMs <= 0}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:pointer-events-none text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-blue-900/30 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>בצע הזזת תזמון</span>
          </button>
        </div>
      </div>
    </div>
  );
};
