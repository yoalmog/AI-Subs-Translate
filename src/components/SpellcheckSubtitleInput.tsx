import React, { useState, useMemo, useRef, useEffect } from "react";
import { Check, Sparkles, AlertCircle, X, CheckCheck, Mic, MicOff } from "lucide-react";
import { checkHebrewSpelling, SpellcheckIssue } from "../utils/hebrewSpellchecker";
import { TargetLanguage } from "../data/languages";
import { SubtitleVoiceTranscriber } from "../utils/speechRecognition";

interface SpellcheckSubtitleInputProps {
  value: string;
  onChange: (newValue: string) => void;
  targetLanguage: TargetLanguage;
  placeholder?: string;
  dir?: "rtl" | "ltr";
  cueId: string;
}

export const SpellcheckSubtitleInput: React.FC<SpellcheckSubtitleInputProps> = ({
  value,
  onChange,
  targetLanguage,
  placeholder,
  dir = "rtl",
  cueId,
}) => {
  const [activeIssue, setActiveIssue] = useState<SpellcheckIssue | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [ignoredWords, setIgnoredWords] = useState<Set<string>>(new Set());
  const [isRecordingVoice, setIsRecordingVoice] = useState<boolean>(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const transcriberRef = useRef<SubtitleVoiceTranscriber | null>(null);

  // Initialize Speech Transcriber
  useEffect(() => {
    transcriberRef.current = new SubtitleVoiceTranscriber(targetLanguage.code);
    return () => {
      if (transcriberRef.current) {
        transcriberRef.current.stop();
      }
    };
  }, [targetLanguage.code]);

  // Handle Voice Recording toggle
  const toggleVoiceRecording = () => {
    setVoiceError(null);
    if (!transcriberRef.current) return;

    if (isRecordingVoice) {
      transcriberRef.current.stop();
      setIsRecordingVoice(false);
    } else {
      transcriberRef.current.setLanguage(targetLanguage.code);
      transcriberRef.current.start({
        onStart: () => {
          setIsRecordingVoice(true);
        },
        onResult: (transcriptText) => {
          if (!value.trim()) {
            onChange(transcriptText);
          } else {
            onChange(transcriptText);
          }
        },
        onError: (err) => {
          setVoiceError(err);
          setIsRecordingVoice(false);
        },
        onEnd: () => {
          setIsRecordingVoice(false);
        },
      });
    }
  };

  // Run real-time Hebrew spellchecker if text contains Hebrew characters
  const isHebrewActive = targetLanguage.code === "he" || /[\u0590-\u05FF]/.test(value);

  const issues = useMemo(() => {
    if (!isHebrewActive || !value.trim()) return [];
    return checkHebrewSpelling(value).filter((iss) => !ignoredWords.has(iss.word));
  }, [value, isHebrewActive, ignoredWords]);

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveIssue(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle applying a correction suggestion
  const handleApplySuggestion = (issue: SpellcheckIssue, suggestion: string) => {
    const before = value.substring(0, issue.startIndex);
    const after = value.substring(issue.endIndex);
    const newValue = before + suggestion + after;
    onChange(newValue);
    setActiveIssue(null);
  };

  // Ignore word
  const handleIgnore = (word: string) => {
    setIgnoredWords((prev) => new Set([...prev, word]));
    setActiveIssue(null);
  };

  // Open context menu for an issue
  const handleWordClick = (e: React.MouseEvent, issue: SpellcheckIssue) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();

    if (containerRect) {
      setMenuPosition({
        top: rect.bottom - containerRect.top + 4,
        left: Math.max(10, rect.left - containerRect.left - 40),
      });
    }
    setActiveIssue(issue);
  };

  // Quick apply all suggested fixes if unique
  const handleApplyAllFixes = () => {
    let updatedText = value;
    // Apply issues in reverse order so indices stay valid
    const sortedIssues = [...issues].sort((a, b) => b.startIndex - a.startIndex);
    for (const iss of sortedIssues) {
      if (iss.suggestions && iss.suggestions.length > 0) {
        const bestSuggestion = iss.suggestions[0];
        const before = updatedText.substring(0, iss.startIndex);
        const after = updatedText.substring(iss.endIndex);
        updatedText = before + bestSuggestion + after;
      }
    }
    onChange(updatedText);
    setActiveIssue(null);
  };

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1">
      {/* Textarea with embedded voice recording button */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          rows={2}
          dir={dir}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full bg-[#161616] border rounded-lg p-2 pl-9 text-xs text-white placeholder-gray-500 focus:outline-none font-medium resize-none leading-relaxed transition ${
            isRecordingVoice
              ? "border-rose-500 ring-2 ring-rose-500/30 bg-rose-950/10"
              : issues.length > 0
              ? "border-amber-500/50 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40"
              : "border-[#2e2e2e] focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          }`}
          placeholder={placeholder || `הזן טקסט כתובית ב-${targetLanguage.nativeName}...`}
        />

        {/* Microphone Recording Action Button */}
        <button
          type="button"
          onClick={toggleVoiceRecording}
          title={isRecordingVoice ? "עצור הקלטה קולית (מדבר עכשיו)" : "הקלט קול והמר לטקסט (Speech-to-Text בעברית)"}
          className={`absolute left-2 top-2 p-1 rounded-md transition cursor-pointer flex items-center justify-center ${
            isRecordingVoice
              ? "bg-rose-600 text-white animate-pulse shadow-lg shadow-rose-600/40"
              : "bg-[#252525] hover:bg-[#333333] text-gray-400 hover:text-white"
          }`}
        >
          {isRecordingVoice ? (
            <Mic className="w-3.5 h-3.5 text-white" />
          ) : (
            <Mic className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Voice Error notice if any */}
      {voiceError && (
        <div className="flex items-center justify-between text-[10px] text-rose-400 bg-rose-950/40 border border-rose-500/30 rounded px-2 py-1">
          <span>{voiceError}</span>
          <button onClick={() => setVoiceError(null)} className="text-gray-400 hover:text-white cursor-pointer">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Real-time Spellcheck Issue Pills and Underline Tokens */}
      {issues.length > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-1.5 px-1 py-0.5 bg-[#18120d] border border-amber-500/30 rounded-md animate-in fade-in">
          <div className="flex items-center flex-wrap gap-1.5 text-[10px]">
            <span className="flex items-center gap-1 font-bold text-amber-400">
              <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
              <span>{issues.length} הצעות כתיב/דקדוק:</span>
            </span>

            {/* Individual issue clickable chips */}
            {issues.map((iss, idx) => (
              <button
                key={`${iss.word}-${idx}`}
                type="button"
                onClick={(e) => handleWordClick(e, iss)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition cursor-pointer flex items-center gap-1 ${
                  activeIssue?.startIndex === iss.startIndex
                    ? "bg-amber-600 text-white border-amber-400 shadow-sm"
                    : "bg-[#251a14] hover:bg-[#34241b] text-amber-200 border-amber-500/40"
                }`}
                title={`לחץ להצעות תיקון עבור: "${iss.word}" (${iss.reason})`}
              >
                <span className="border-b-2 border-dotted border-rose-400 font-bold">{iss.word}</span>
                <span className="text-gray-400 text-[9px]">→</span>
                <span className="text-emerald-300 font-semibold">{iss.suggestions[0] || "הצעה"}</span>
              </button>
            ))}
          </div>

          {/* Quick Apply All Button */}
          <button
            type="button"
            onClick={handleApplyAllFixes}
            className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 px-1.5 py-0.5 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/40 rounded transition cursor-pointer"
            title="החל את כל התיקונים המומלצים בבת אחת"
          >
            <CheckCheck className="w-3 h-3" />
            <span>תקן הכל</span>
          </button>
        </div>
      )}

      {/* Spellcheck Suggestion Context Menu Popover */}
      {activeIssue && (
        <div
          className="absolute z-50 bg-[#1f1a18] border border-amber-500/60 rounded-lg p-2.5 shadow-2xl min-w-[220px] max-w-xs animate-in zoom-in-95 text-right flex flex-col gap-2"
          style={{
            top: menuPosition ? `${menuPosition.top}px` : "100%",
            right: "8px",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-amber-500/30 pb-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>הצעות לתיקון</span>
            </div>
            <button
              onClick={() => setActiveIssue(null)}
              className="text-gray-400 hover:text-white p-0.5 rounded cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {/* Issue Reason / Description */}
          <div className="text-[11px] text-gray-300 leading-tight">
            <span className="font-bold text-rose-300">"{activeIssue.word}"</span>:{" "}
            <span>{activeIssue.reason}</span>
          </div>

          {/* Suggestions List */}
          <div className="flex flex-col gap-1 pt-1">
            <span className="text-[10px] font-semibold text-gray-400">בחר חלופה:</span>
            {activeIssue.suggestions.map((suggestion, sIdx) => (
              <button
                key={sIdx}
                type="button"
                onClick={() => handleApplySuggestion(activeIssue, suggestion)}
                className="w-full text-right px-2 py-1.5 bg-[#2a221d] hover:bg-emerald-900/60 hover:border-emerald-500/50 border border-[#3e322a] rounded text-xs font-bold text-white flex items-center justify-between transition cursor-pointer group"
              >
                <span className="text-emerald-300 group-hover:text-emerald-200">{suggestion}</span>
                <Check className="w-3 h-3 text-emerald-400 opacity-0 group-hover:opacity-100 transition" />
              </button>
            ))}
          </div>

          {/* Ignore option */}
          <div className="pt-1 border-t border-[#332720] flex justify-end">
            <button
              type="button"
              onClick={() => handleIgnore(activeIssue.word)}
              className="text-[10px] text-gray-400 hover:text-gray-200 transition cursor-pointer"
            >
              התעלם ממילה זו
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
