import React, { useState } from "react";
import { Search, Replace, Check, X, CaseSensitive, Type } from "lucide-react";
import { SubtitleCue } from "../types";

interface FindAndReplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  cues: SubtitleCue[];
  onApplyReplace: (updatedCues: SubtitleCue[], count: number) => void;
  targetLanguageName: string;
}

export const FindAndReplaceModal: React.FC<FindAndReplaceModalProps> = ({
  isOpen,
  onClose,
  cues,
  onApplyReplace,
  targetLanguageName,
}) => {
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [targetScope, setTargetScope] = useState<"both" | "translated" | "original">("both");

  if (!isOpen) return null;

  // Calculate matches count in real-time
  const previewMatchesCount = () => {
    if (!findText.trim()) return 0;
    let count = 0;

    cues.forEach((cue) => {
      const textsToCheck: string[] = [];
      if (targetScope === "both" || targetScope === "translated") {
        textsToCheck.push(cue.hebrewText || "");
      }
      if (targetScope === "both" || targetScope === "original") {
        textsToCheck.push(cue.originalText || "");
      }

      textsToCheck.forEach((text) => {
        if (!text) return;
        if (matchCase) {
          const occurrences = text.split(findText).length - 1;
          count += occurrences;
        } else {
          const lowerText = text.toLowerCase();
          const lowerFind = findText.toLowerCase();
          const occurrences = lowerText.split(lowerFind).length - 1;
          count += occurrences;
        }
      });
    });

    return count;
  };

  const matchesCount = previewMatchesCount();

  const handleExecuteReplace = () => {
    if (!findText) return;

    let totalReplacements = 0;
    const updatedCues = cues.map((cue) => {
      let newHebrew = cue.hebrewText;
      let newOriginal = cue.originalText;
      let isModified = false;

      const replaceInStr = (str: string) => {
        if (!str) return str;
        if (matchCase) {
          const parts = str.split(findText);
          if (parts.length > 1) {
            totalReplacements += parts.length - 1;
            isModified = true;
            return parts.join(replaceText);
          }
          return str;
        } else {
          // Case-insensitive global replace preserving rest of string
          const escapedFind = findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const regex = new RegExp(escapedFind, "gi");
          const matchResult = str.match(regex);
          if (matchResult && matchResult.length > 0) {
            totalReplacements += matchResult.length;
            isModified = true;
            return str.replace(regex, replaceText);
          }
          return str;
        }
      };

      if (targetScope === "both" || targetScope === "translated") {
        newHebrew = replaceInStr(newHebrew);
      }
      if (targetScope === "both" || targetScope === "original") {
        newOriginal = replaceInStr(newOriginal);
      }

      if (isModified) {
        return {
          ...cue,
          hebrewText: newHebrew,
          originalText: newOriginal,
          isEdited: true,
        };
      }
      return cue;
    });

    onApplyReplace(updatedCues, totalReplacements);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-[#161616] border border-[#2e2e2e] rounded-xl w-full max-w-md shadow-2xl p-5 relative flex flex-col gap-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#262626] pb-3">
          <div className="flex items-center gap-2">
            <Replace className="w-5 h-5 text-blue-400" />
            <h3 className="text-sm font-bold text-white">חיפוש והחלפה גלובליים (Find & Replace)</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-[#222222] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Inputs */}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1">
              חפש טקסט:
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={findText}
                onChange={(e) => setFindText(e.target.value)}
                placeholder="הקלד מילה או ביטוי לחיפוש..."
                className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg pr-9 pl-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1">
              החלף בטקסט:
            </label>
            <div className="relative">
              <Replace className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                placeholder="הקלד טקסט חלופי..."
                className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg pr-9 pl-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Options: Scope and Case Sensitivity */}
          <div className="bg-[#101010] border border-[#242424] rounded-lg p-3 space-y-2.5">
            <div className="text-[11px] font-bold text-gray-400">הגדרות החלפה:</div>

            {/* Scope Selection */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-300 font-medium shrink-0">החלף בתוך:</label>
              <div className="grid grid-cols-3 gap-1 flex-1">
                <button
                  type="button"
                  onClick={() => setTargetScope("both")}
                  className={`px-2 py-1 rounded text-[11px] font-semibold border transition cursor-pointer ${
                    targetScope === "both"
                      ? "bg-blue-600/30 text-blue-300 border-blue-500/50"
                      : "bg-[#161616] text-gray-400 border-[#2b2b2b] hover:text-white"
                  }`}
                >
                  הכל
                </button>
                <button
                  type="button"
                  onClick={() => setTargetScope("translated")}
                  className={`px-2 py-1 rounded text-[11px] font-semibold border transition cursor-pointer truncate ${
                    targetScope === "translated"
                      ? "bg-blue-600/30 text-blue-300 border-blue-500/50"
                      : "bg-[#161616] text-gray-400 border-[#2b2b2b] hover:text-white"
                  }`}
                  title={`כתוביות מתורגמות (${targetLanguageName})`}
                >
                  תרגום בלבד
                </button>
                <button
                  type="button"
                  onClick={() => setTargetScope("original")}
                  className={`px-2 py-1 rounded text-[11px] font-semibold border transition cursor-pointer ${
                    targetScope === "original"
                      ? "bg-blue-600/30 text-blue-300 border-blue-500/50"
                      : "bg-[#161616] text-gray-400 border-[#2b2b2b] hover:text-white"
                  }`}
                >
                  מקור בלבד
                </button>
              </div>
            </div>

            {/* Match Case Option */}
            <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer pt-1 border-t border-[#1c1c1c]">
              <input
                type="checkbox"
                checked={matchCase}
                onChange={(e) => setMatchCase(e.target.checked)}
                className="rounded border-[#333333] text-blue-600 focus:ring-blue-500"
              />
              <CaseSensitive className="w-4 h-4 text-blue-400" />
              <span>התאם אותיות רישיות/קטנות (Match Case)</span>
            </label>
          </div>

          {/* Matches Info */}
          {findText && (
            <div className="text-xs px-3 py-2 rounded-lg bg-[#0d1624] border border-blue-500/30 text-blue-300 flex items-center justify-between">
              <span>תוצאות שנמצאו:</span>
              <span className="font-mono font-bold text-white bg-blue-600/40 px-2 py-0.5 rounded">
                {matchesCount} מופעים
              </span>
            </div>
          )}
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
            onClick={handleExecuteReplace}
            disabled={!findText || matchesCount === 0}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:pointer-events-none text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-blue-900/30 cursor-pointer"
          >
            <Replace className="w-3.5 h-3.5" />
            <span>החלף הכל ({matchesCount})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
