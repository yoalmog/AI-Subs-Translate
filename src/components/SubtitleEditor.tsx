import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Plus,
  Trash2,
  Play,
  Sparkles,
  Search,
  Clock,
  Languages,
  RotateCcw,
  FastForward,
  Rewind,
  FileCode,
  Wand2,
  Combine,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Check,
  X,
  Globe,
  ChevronDown,
  Loader2,
  Save,
  ShieldCheck,
  History,
  Info,
  Layers,
  Replace,
  SlidersHorizontal,
  CheckSquare,
  Square,
  Undo2,
  Redo2,
  Filter,
} from "lucide-react";
import { SubtitleCue, TonePreference } from "../types";
import { formatTimeDisplay } from "../utils/timeFormat";
import {
  bulkCleanOcrArtifacts,
  mergeShortOrOverlappingCues,
  validateSrtFile,
  SrtValidationResult,
} from "../utils/subtitleTools";
import { TARGET_LANGUAGES, TargetLanguage, DEFAULT_LANGUAGE } from "../data/languages";
import { AutoSaveDraft } from "../utils/autoSave";
import { SrtValidationModal } from "./SrtValidationModal";
import { FindAndReplaceModal } from "./FindAndReplaceModal";
import { BatchTimeShiftModal, BulkShiftOptions } from "./BatchTimeShiftModal";
import { SpellcheckSubtitleInput } from "./SpellcheckSubtitleInput";
import { DurationDistributionChart } from "./DurationDistributionChart";
import { autoFormatAllCues } from "../utils/subtitleFormatter";

interface SubtitleEditorProps {
  cues: SubtitleCue[];
  activeCueId: string | null;
  currentTime: number;
  videoDuration?: number;
  onUpdateCue: (updatedCue: SubtitleCue) => void;
  onDeleteCue: (cueId: string) => void;
  onAddCue: (newCue: Partial<SubtitleCue>) => void;
  onSeekTo: (time: number) => void;
  onRetranslateCue: (cue: SubtitleCue, targetLangName?: string, tone?: string) => Promise<void>;
  onShiftAllTimings: (seconds: number) => void;
  onApplyBulkShift?: (options: BulkShiftOptions) => void;
  onImportSrt: (cues: SubtitleCue[]) => void;
  isAnalyzing: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  undoCount?: number;
  redoCount?: number;
  selectedLanguage?: TargetLanguage;
  onLanguageChange?: (lang: TargetLanguage) => void;
  tonePreference?: TonePreference;
  onTonePreferenceChange?: (tone: TonePreference) => void;
  lastAutoSavedAt?: string | null;
  onManualSave?: () => void;
  savedDraftAvailable?: AutoSaveDraft | null;
  onRestoreDraft?: () => void;
  onClearSavedDraft?: () => void;
}

export const SubtitleEditor: React.FC<SubtitleEditorProps> = ({
  cues,
  activeCueId,
  currentTime,
  videoDuration = 10,
  onUpdateCue,
  onDeleteCue,
  onAddCue,
  onSeekTo,
  onRetranslateCue,
  onShiftAllTimings,
  onApplyBulkShift,
  onImportSrt,
  isAnalyzing,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  undoCount = 0,
  redoCount = 0,
  selectedLanguage: externalSelectedLanguage,
  onLanguageChange,
  tonePreference: externalTonePreference,
  onTonePreferenceChange,
  lastAutoSavedAt,
  onManualSave,
  savedDraftAvailable,
  onRestoreDraft,
  onClearSavedDraft,
}) => {
  const [internalLanguage, setInternalLanguage] = useState<TargetLanguage>(DEFAULT_LANGUAGE);
  const selectedLang = externalSelectedLanguage || internalLanguage;

  // Tone Preference State: 'informal' (default), 'formal', 'literal'
  const [internalTonePreference, setInternalTonePreference] = useState<TonePreference>("informal");
  const tonePreference = externalTonePreference || internalTonePreference;

  const setTonePreference = (tone: TonePreference) => {
    setInternalTonePreference(tone);
    if (onTonePreferenceChange) {
      onTonePreferenceChange(tone);
    }
  };
  const [showToneMenu, setShowToneMenu] = useState<boolean>(false);

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [retranslatingId, setRetranslatingId] = useState<string | null>(null);
  const [isTranslatingAll, setIsTranslatingAll] = useState<boolean>(false);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [showLanguageMenu, setShowLanguageMenu] = useState<boolean>(false);
  const [dismissDraftPrompt, setDismissDraftPrompt] = useState<boolean>(false);

  // Selection state for batch operations
  const [selectedCueIds, setSelectedCueIds] = useState<string[]>([]);

  // Modals state
  const [findReplaceModalOpen, setFindReplaceModalOpen] = useState<boolean>(false);
  const [batchShiftModalOpen, setBatchShiftModalOpen] = useState<boolean>(false);
  const [validationModalOpen, setValidationModalOpen] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<SrtValidationResult | null>(null);
  const [uploadFileName, setUploadFileName] = useState<string>("");

  // Feedback toast banner
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: "success" | "info" | "warning" | "error";
    text: string;
  } | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const effectiveDuration = Math.max(
    videoDuration || 10,
    cues.length > 0 ? Math.max(...cues.map((c) => c.endTime)) + 1 : 10
  );

  // Real-time Timing Overlap Detection Map
  // Map of cue.id -> list of overlapping cue indexes/IDs
  const overlappingCuesMap = useMemo(() => {
    const map = new Map<string, { overlappingIds: string[]; overlappingIndexes: number[] }>();

    for (let i = 0; i < cues.length; i++) {
      const cueA = cues[i];
      for (let j = i + 1; j < cues.length; j++) {
        const cueB = cues[j];

        // Check if [cueA.startTime, cueA.endTime] overlaps with [cueB.startTime, cueB.endTime]
        // An overlap occurs if startA < endB && startB < endA (excluding exact point touches < 0.005s)
        const isOverlapping = cueA.startTime < cueB.endTime - 0.005 && cueB.startTime < cueA.endTime - 0.005;

        if (isOverlapping) {
          // Add B to A's overlap list
          const existingA = map.get(cueA.id) || { overlappingIds: [], overlappingIndexes: [] };
          existingA.overlappingIds.push(cueB.id);
          existingA.overlappingIndexes.push(j + 1);
          map.set(cueA.id, existingA);

          // Add A to B's overlap list
          const existingB = map.get(cueB.id) || { overlappingIds: [], overlappingIndexes: [] };
          existingB.overlappingIds.push(cueA.id);
          existingB.overlappingIndexes.push(i + 1);
          map.set(cueB.id, existingB);
        }
      }
    }
    return map;
  }, [cues]);

  const totalOverlapCount = overlappingCuesMap.size;

  const handleSelectLanguage = (lang: TargetLanguage) => {
    setInternalLanguage(lang);
    if (onLanguageChange) {
      onLanguageChange(lang);
    }
    setShowLanguageMenu(false);
    setFeedbackMessage({
      type: "info",
      text: `שפת היעד הוגדרה: ${lang.flag} ${lang.nativeName} (${lang.name})`,
    });
  };

  // Auto-clear feedback toast after 4.5 seconds
  useEffect(() => {
    if (feedbackMessage) {
      const timer = setTimeout(() => setFeedbackMessage(null), 4500);
      return () => clearTimeout(timer);
    }
  }, [feedbackMessage]);

  // Auto-scroll active subtitle cue into view
  useEffect(() => {
    if (autoScroll && activeCueId && activeItemRef.current && listRef.current) {
      activeItemRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [activeCueId, autoScroll]);

  const [filterType, setFilterType] = useState<"all" | "short" | "long" | "overlapping">("all");

  // Filtered cues based on search term & category filter
  const filteredCues = useMemo(() => {
    return cues.filter((cue, idx) => {
      const cueDuration = cue.endTime - cue.startTime;
      if (filterType === "short" && cueDuration >= 1.2) return false;
      if (filterType === "long" && cueDuration <= 5.5) return false;
      if (filterType === "overlapping" && !overlappingCuesMap.has(cue.id)) return false;

      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase().trim();
      const matchHebrew = (cue.hebrewText || "").toLowerCase().includes(term);
      const matchOriginal = (cue.originalText || "").toLowerCase().includes(term);
      const matchNumber = `#${idx + 1}`.includes(term) || `${idx + 1}` === term;

      return matchHebrew || matchOriginal || matchNumber;
    });
  }, [cues, searchTerm, filterType, overlappingCuesMap]);

  // Chronologically sorted cues list for accurate adjacent cue operations
  const sortedChronologicalCues = useMemo(
    () => [...cues].sort((a, b) => a.startTime - b.startTime),
    [cues]
  );

  const handleRetranslate = async (cue: SubtitleCue) => {
    setRetranslatingId(cue.id);
    try {
      await onRetranslateCue(cue, selectedLang.name, tonePreference);
      setFeedbackMessage({
        type: "success",
        text: `הכתובית תורגמה בהצלחה ל-${selectedLang.nativeName} (בסגנון ${
          tonePreference === "formal" ? "רשמי" : tonePreference === "literal" ? "מילולי" : "יומיומי"
        })!`,
      });
    } catch (err: any) {
      setFeedbackMessage({
        type: "error",
        text: err.message || "שגיאה בתרגום הכתובית.",
      });
    } finally {
      setRetranslatingId(null);
    }
  };

  // Bulk / Translate All handler
  const handleTranslateAll = async () => {
    if (cues.length === 0 || isTranslatingAll) return;

    setIsTranslatingAll(true);
    try {
      const itemsToTranslate = cues.map((cue) => ({
        id: cue.id,
        originalText: cue.originalText || cue.hebrewText,
      }));

      const response = await fetch("/api/batch-translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: itemsToTranslate,
          targetLanguage: selectedLang.name,
          tone: tonePreference,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "שגיאה בביצוע תרגום גורף.");
      }

      const data = await response.json();
      const translations: Record<string, string> = data.translations || {};

      let updatedCount = 0;
      const updatedCues = cues.map((cue) => {
        if (translations[cue.id]) {
          updatedCount++;
          return {
            ...cue,
            hebrewText: translations[cue.id],
            isEdited: true,
          };
        }
        return cue;
      });

      onImportSrt(updatedCues);
      setFeedbackMessage({
        type: "success",
        text: `תורגמו בהצלחה ${updatedCount} כתוביות ל-${selectedLang.flag} ${selectedLang.nativeName} (בסגנון ${
          tonePreference === "formal" ? "רשמי" : tonePreference === "literal" ? "מילולי" : "יומיומי"
        })!`,
      });
    } catch (err: any) {
      console.error("Batch translate error:", err);
      setFeedbackMessage({
        type: "error",
        text: err.message || "שגיאה בתרגום הגורף. אנא נסה שוב.",
      });
    } finally {
      setIsTranslatingAll(false);
    }
  };

  const handleAddAtCurrentTime = () => {
    onAddCue({
      startTime: Math.max(0, currentTime),
      endTime: currentTime + 3.0,
      originalText: "",
      hebrewText: `כתובית חדשה (${selectedLang.nativeName})`,
      detectedLanguage: selectedLang.name,
    });
  };

  // Bulk OCR artifact cleaner
  const handleBulkCleanOcr = () => {
    if (cues.length === 0) return;
    const { cleanedCues, modifiedCount } = bulkCleanOcrArtifacts(cues);
    if (modifiedCount > 0) {
      onImportSrt(cleanedCues);
      setFeedbackMessage({
        type: "success",
        text: `נוקו בהצלחה סימני OCR ורעשי פיסוק מ-${modifiedCount} כתוביות!`,
      });
    } else {
      setFeedbackMessage({
        type: "info",
        text: "כל הכתוביות כבר נקיות מסימני OCR ורעשי פיסוק.",
      });
    }
  };

  // Merge Short Cues
  const handleMergeShortCues = () => {
    if (cues.length <= 1) return;
    const { mergedCues, mergedCount } = mergeShortOrOverlappingCues(cues, {
      minDuration: 1.4,
      maxGap: 0.45,
      maxTotalDuration: 6.5,
    });

    if (mergedCount > 0) {
      onImportSrt(mergedCues);
      setFeedbackMessage({
        type: "success",
        text: `אוחדו ${mergedCount} כתוביות קצרות/חופפות לשיפור רציפות הקריאה!`,
      });
    } else {
      setFeedbackMessage({
        type: "info",
        text: "לא נמצאו כתוביות קצרות מדי או חופפות לאיחוד.",
      });
    }
  };

  // Auto-Format all cues (regex cleanup pass)
  const handleAutoFormat = () => {
    if (cues.length === 0) return;
    const isRtl = selectedLang.dir === "rtl";
    const { formattedCues, modifiedCount } = autoFormatAllCues(cues, isRtl);

    if (modifiedCount > 0) {
      onImportSrt(formattedCues);
      setFeedbackMessage({
        type: "success",
        text: `עיצוב וניקוי אוטומטי (רווחים, פיסוק, אותיות) בוצע בהצלחה עבור ${modifiedCount} כתוביות!`,
      });
    } else {
      setFeedbackMessage({
        type: "info",
        text: "כל הכתוביות כבר מעוצבות ותקינות לחלוטין ללא שגיאות פיסוק או ריווח.",
      });
    }
  };

  // Handle Find and Replace apply
  const handleApplyFindAndReplace = (updatedCues: SubtitleCue[], count: number) => {
    onImportSrt(updatedCues);
    setFeedbackMessage({
      type: "success",
      text: `הוחלפו בהצלחה ${count} מופעים ברחבי הכתוביות!`,
    });
  };

  // Handle Batch Time Shift apply
  const handleApplyBatchShift = (options: BulkShiftOptions) => {
    if (onApplyBulkShift) {
      onApplyBulkShift(options);
    } else {
      const {
        mode,
        shiftSeconds,
        percentage,
        stretchAnchor,
        scope,
        rangeStartTime,
        rangeEndTime,
        selectedCueIds: optSelected,
      } = options;
      const targetIds = optSelected || selectedCueIds;
      const minCueTime = cues.length > 0 ? Math.min(...cues.map((c) => c.startTime)) : 0;
      let anchorTime = 0;
      if (stretchAnchor === "first_cue") anchorTime = minCueTime;
      if (stretchAnchor === "range_start" && rangeStartTime !== undefined) anchorTime = rangeStartTime;
      const factor = 1 + percentage / 100;

      const updated = cues.map((cue) => {
        let isTarget = false;
        if (scope === "all") isTarget = true;
        else if (scope === "selected") isTarget = targetIds.includes(cue.id);
        else if (
          scope === "time_range" &&
          rangeStartTime !== undefined &&
          rangeEndTime !== undefined
        ) {
          isTarget = cue.startTime >= rangeStartTime && cue.startTime <= rangeEndTime;
        }

        if (!isTarget) return cue;

        if (mode === "fixed") {
          const newStart = Math.max(0, +(cue.startTime + shiftSeconds).toFixed(3));
          const newEnd = Math.max(newStart + 0.1, +(cue.endTime + shiftSeconds).toFixed(3));
          return { ...cue, startTime: newStart, endTime: newEnd, isEdited: true };
        } else {
          const newStart = Math.max(
            0,
            +(anchorTime + (cue.startTime - anchorTime) * factor).toFixed(3)
          );
          const newEnd = Math.max(
            newStart + 0.1,
            +(anchorTime + (cue.endTime - anchorTime) * factor).toFixed(3)
          );
          return { ...cue, startTime: newStart, endTime: newEnd, isEdited: true };
        }
      });

      updated.sort((a, b) => a.startTime - b.startTime);
      onImportSrt(updated);
    }

    setFeedbackMessage({
      type: "success",
      text: `שינוי תזמון קבוצתי הושלם בהצלחה!`,
    });
  };

  // Toggle selection for a cue
  const toggleCueSelection = (cueId: string) => {
    setSelectedCueIds((prev) =>
      prev.includes(cueId) ? prev.filter((id) => id !== cueId) : [...prev, cueId]
    );
  };

  // Select all or clear selection
  const toggleSelectAll = () => {
    if (selectedCueIds.length === cues.length) {
      setSelectedCueIds([]);
    } else {
      setSelectedCueIds(cues.map((c) => c.id));
    }
  };

  // Merge multiple selected adjacent cues into a single cue
  const handleMergeSelectedCues = () => {
    if (selectedCueIds.length < 2) {
      setFeedbackMessage({
        type: "warning",
        text: "אנא בחר לפחות 2 כתוביות כדי לאחד אותן.",
      });
      return;
    }

    const selectedCues = cues
      .filter((c) => selectedCueIds.includes(c.id))
      .sort((a, b) => a.startTime - b.startTime);

    if (selectedCues.length < 2) return;

    const minStartTime = Math.min(...selectedCues.map((c) => c.startTime));
    const maxEndTime = Math.max(...selectedCues.map((c) => c.endTime));

    const combinedOriginal = selectedCues
      .map((c) => c.originalText.trim())
      .filter(Boolean)
      .join(" ");

    const combinedTranslated = selectedCues
      .map((c) => c.hebrewText.trim())
      .filter(Boolean)
      .join(" ");

    const mergedCue: SubtitleCue = {
      id: `cue-merged-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      startTime: minStartTime,
      endTime: maxEndTime,
      originalText: combinedOriginal,
      hebrewText: combinedTranslated,
      detectedLanguage: selectedCues[0].detectedLanguage || selectedLang.name,
      position: selectedCues[0].position,
      confidence: 1.0,
      isEdited: true,
    };

    const firstIndex = cues.findIndex((c) => c.id === selectedCues[0].id);
    const newCues = cues.filter((c) => !selectedCueIds.includes(c.id));
    newCues.splice(firstIndex !== -1 ? Math.min(firstIndex, newCues.length) : 0, 0, mergedCue);
    newCues.sort((a, b) => a.startTime - b.startTime);

    onImportSrt(newCues);
    setSelectedCueIds([mergedCue.id]);

    setFeedbackMessage({
      type: "success",
      text: `אוחדו ${selectedCues.length} כתוביות לכתובית אחת (${(maxEndTime - minStartTime).toFixed(1)}s)!`,
    });
  };

  // Merge individual cue with the next consecutive chronological cue
  const handleMergeWithNext = (cueId: string) => {
    const sortedCues = [...cues].sort((a, b) => a.startTime - b.startTime);
    const index = sortedCues.findIndex((c) => c.id === cueId);
    if (index === -1 || index >= sortedCues.length - 1) {
      setFeedbackMessage({
        type: "warning",
        text: "לא נמצאה כתובית עוקבת לאיחוד.",
      });
      return;
    }
    const cueA = sortedCues[index];
    const cueB = sortedCues[index + 1];

    const minStart = Math.min(cueA.startTime, cueB.startTime);
    const maxEnd = Math.max(cueA.endTime, cueB.endTime);

    const mergedCue: SubtitleCue = {
      id: `cue-merged-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      startTime: minStart,
      endTime: maxEnd,
      originalText: [cueA.originalText.trim(), cueB.originalText.trim()].filter(Boolean).join(" "),
      hebrewText: [cueA.hebrewText.trim(), cueB.hebrewText.trim()].filter(Boolean).join(" "),
      detectedLanguage: cueA.detectedLanguage || cueB.detectedLanguage || selectedLang.name,
      position: cueA.position,
      confidence: 1.0,
      isEdited: true,
    };

    const newCues = sortedCues.filter((c) => c.id !== cueA.id && c.id !== cueB.id);
    newCues.splice(index, 0, mergedCue);
    newCues.sort((a, b) => a.startTime - b.startTime);

    onImportSrt(newCues);
    setFeedbackMessage({
      type: "success",
      text: `אוחדו בהצלחה כתובית #${index + 1} וכתובית #${index + 2} לכתובית אחת (${(maxEnd - minStart).toFixed(1)}s)!`,
    });
  };

  // Handle File Upload with syntax and timing validation
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadFileName(file.name);
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result as string;
        if (text) {
          const result = validateSrtFile(text);
          setValidationResult(result);
          setValidationModalOpen(true);
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    }
  };

  const handleConfirmImport = (importedCues: SubtitleCue[]) => {
    onImportSrt(importedCues);
    setFeedbackMessage({
      type: "success",
      text: `יובאו בהצלחה ${importedCues.length} כתוביות לאחר אימות!`,
    });
  };

  // Manual save click
  const handleSaveClick = () => {
    if (onManualSave) {
      onManualSave();
      setFeedbackMessage({
        type: "success",
        text: "כל הכתוביות והשינויים נשמרו ב-localStorage בהצלחה!",
      });
    }
  };

  return (
    <div className="bg-[#141414] border border-[#222222] rounded-xl p-3 sm:p-4 lg:p-5 flex flex-col h-full shadow-xl relative w-full overflow-hidden" id="subtitle-editor">
      {/* Top Header */}
      <div className="flex flex-col gap-2.5 pb-3 border-b border-[#222222]">
        {/* Row 1: Title, Count & Status Badges */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          {/* Title & Count */}
          <div className="flex items-center gap-2 min-w-0">
            <Languages className="w-5 h-5 text-blue-400 shrink-0" />
            <h2 className="text-sm sm:text-base font-bold text-white font-rubik whitespace-nowrap">
              עורך כתוביות ותרגום
            </h2>
            <span className="bg-[#1a1a1a] text-blue-400 text-xs px-2 sm:px-2.5 py-0.5 rounded-full font-mono border border-[#333333] shrink-0 whitespace-nowrap">
              {cues.length} שורות
            </span>
          </div>

          {/* Badges: Overlap Warning & Auto-Save */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {totalOverlapCount > 0 && (
              <div
                className="flex items-center gap-1 bg-rose-950/80 border border-rose-500/60 text-rose-300 px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-bold animate-pulse shadow-xs shrink-0 whitespace-nowrap"
                title={`${totalOverlapCount} כתוביות בעלות חפיפת זמנים (מודגשות במסגרת אדומה)`}
              >
                <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
                <span>{totalOverlapCount} חפיפות</span>
              </div>
            )}

            {/* Auto-save status indicator */}
            <div
              className="flex items-center gap-1.5 bg-[#111827] border border-blue-900/40 text-blue-300 px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-mono shadow-inner shrink-0 whitespace-nowrap"
              title={
                lastAutoSavedAt
                  ? `נשמר אוטומטית בדפדפן (localStorage) ב-${lastAutoSavedAt}`
                  : "שמירה אוטומטית פעילה ברקע"
              }
            >
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
              <span>
                {lastAutoSavedAt ? `נשמר ${lastAutoSavedAt}` : "שמירה אוטומטית"}
              </span>
            </div>
          </div>
        </div>

        {/* Row 2 Controls: Undo/Redo, Manual Save, Tone Preference & Target Language */}
        <div className="flex items-center justify-start sm:justify-end flex-wrap gap-1.5 sm:gap-2 pt-1 border-t border-[#1a1a1a]">
          {/* Undo and Redo History Stack Controls */}
          <div className="flex items-center gap-1 bg-[#1a1a1a] p-0.5 sm:p-1 rounded-lg border border-[#2e2e2e] shrink-0">
            <button
              id="undo-history-btn"
              onClick={onUndo}
              disabled={!canUndo}
              className="h-7 sm:h-8 flex items-center gap-1 px-2 sm:px-2.5 text-xs font-semibold rounded-md transition cursor-pointer disabled:opacity-30 disabled:pointer-events-none text-gray-300 hover:text-white hover:bg-[#282828] whitespace-nowrap"
              title={`בטל שינוי אחרון (Ctrl+Z / Cmd+Z) - ${undoCount} פעולות לביטול`}
            >
              <Undo2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="hidden xs:inline">בטל</span>
              {undoCount > 0 && (
                <span className="bg-blue-950 text-blue-300 text-[10px] px-1.5 py-0.2 rounded-full border border-blue-500/30">
                  {undoCount}
                </span>
              )}
            </button>

            <button
              id="redo-history-btn"
              onClick={onRedo}
              disabled={!canRedo}
              className="h-7 sm:h-8 flex items-center gap-1 px-2 sm:px-2.5 text-xs font-semibold rounded-md transition cursor-pointer disabled:opacity-30 disabled:pointer-events-none text-gray-300 hover:text-white hover:bg-[#282828] whitespace-nowrap"
              title={`בצע שוב (Ctrl+Y / Cmd+Shift+Z) - ${redoCount} פעולות לשחזור`}
            >
              <Redo2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="hidden xs:inline">שחזר</span>
              {redoCount > 0 && (
                <span className="bg-blue-950 text-blue-300 text-[10px] px-1.5 py-0.2 rounded-full border border-blue-500/30">
                  {redoCount}
                </span>
              )}
            </button>
          </div>

          {/* Quick Save Now Button */}
          <button
            onClick={handleSaveClick}
            className="h-7 sm:h-8 flex items-center gap-1 px-2 sm:px-2.5 bg-[#1c1c1c] hover:bg-[#262626] text-gray-200 hover:text-white border border-[#333333] hover:border-emerald-500/50 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 whitespace-nowrap"
            title="שמור את השינויים מיד ב-localStorage"
          >
            <Save className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="hidden sm:inline">שמור עכשיו</span>
            <span className="sm:hidden">שמור</span>
          </button>

          {/* Tone Preference Dropdown */}
          <div className="relative shrink-0">
            <button
              id="tone-preference-select-btn"
              onClick={() => {
                setShowToneMenu(!showToneMenu);
                setShowLanguageMenu(false);
              }}
              className="h-7 sm:h-8 flex items-center gap-1 px-2 sm:px-2.5 bg-[#1c1c1c] hover:bg-[#262626] text-white border border-[#333333] hover:border-purple-500/50 rounded-lg text-xs font-semibold transition shadow-xs cursor-pointer whitespace-nowrap"
              title="בחר סגנון ותרגום (Tone Preference): רשמי, יומיומי או מילולי"
            >
              <SlidersHorizontal className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-purple-400 shrink-0" />
              <span className="text-gray-400 text-[10px] sm:text-[11px] hidden xs:inline">סגנון:</span>
              <span className="font-bold text-purple-300">
                {tonePreference === "formal" ? "רשמי" : tonePreference === "literal" ? "מילולי" : "יומיומי"}
              </span>
              <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
            </button>

            {showToneMenu && (
              <div
                className="absolute right-0 sm:left-0 sm:right-auto mt-1.5 w-60 max-w-[calc(100vw-2.5rem)] bg-[#161616] border border-[#2e2e2e] rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in slide-in-from-top-2"
                onMouseLeave={() => setShowToneMenu(false)}
              >
                <div className="text-[11px] font-bold text-gray-400 px-2 py-1 border-b border-[#222222] mb-1">
                  סגנון תרגום AI (Tone Preference):
                </div>

                {/* Informal (Default) */}
                <button
                  onClick={() => {
                    setTonePreference("informal");
                    setShowToneMenu(false);
                    setFeedbackMessage({
                      type: "info",
                      text: "סגנון התרגום הוגדר כ-יומיומי / טבעי (Informal)",
                    });
                  }}
                  className={`w-full text-right px-2.5 py-2 rounded-lg text-xs flex flex-col gap-0.5 transition cursor-pointer ${
                    tonePreference === "informal"
                      ? "bg-purple-600/30 text-purple-200 font-bold border border-purple-500/40"
                      : "text-gray-200 hover:bg-[#242424] hover:text-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold">יומיומי / טבעי (Informal)</span>
                    {tonePreference === "informal" && <Check className="w-3.5 h-3.5 text-purple-400" />}
                  </div>
                  <span className="text-[10px] text-gray-400">שפה שוטפת, קולנועית ומדוברת המתאימה לסרטונים</span>
                </button>

                {/* Formal */}
                <button
                  onClick={() => {
                    setTonePreference("formal");
                    setShowToneMenu(false);
                    setFeedbackMessage({
                      type: "info",
                      text: "סגנון התרגום הוגדר כ-רשמי / גבוה (Formal)",
                    });
                  }}
                  className={`w-full text-right px-2.5 py-2 rounded-lg text-xs flex flex-col gap-0.5 transition cursor-pointer mt-1 ${
                    tonePreference === "formal"
                      ? "bg-purple-600/30 text-purple-200 font-bold border border-purple-500/40"
                      : "text-gray-200 hover:bg-[#242424] hover:text-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold">רשמי / גבוה (Formal)</span>
                    {tonePreference === "formal" && <Check className="w-3.5 h-3.5 text-purple-400" />}
                  </div>
                  <span className="text-[10px] text-gray-400">משלב לשוני מוקפד, מתאים לדוקומנטרי וחדשות</span>
                </button>

                {/* Literal */}
                <button
                  onClick={() => {
                    setTonePreference("literal");
                    setShowToneMenu(false);
                    setFeedbackMessage({
                      type: "info",
                      text: "סגנון התרגום הוגדר כ-מילולי ומדויק (Literal)",
                    });
                  }}
                  className={`w-full text-right px-2.5 py-2 rounded-lg text-xs flex flex-col gap-0.5 transition cursor-pointer mt-1 ${
                    tonePreference === "literal"
                      ? "bg-purple-600/30 text-purple-200 font-bold border border-purple-500/40"
                      : "text-gray-200 hover:bg-[#242424] hover:text-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold">מילולי ומדויק (Literal)</span>
                    {tonePreference === "literal" && <Check className="w-3.5 h-3.5 text-purple-400" />}
                  </div>
                  <span className="text-[10px] text-gray-400">תרגום צמוד למילים המקוריות ללא פרפרזה חופשית</span>
                </button>
              </div>
            )}
          </div>

          {/* Target Language Dropdown */}
          <div className="relative shrink-0">
            <button
              id="target-language-select-btn"
              onClick={() => {
                setShowLanguageMenu(!showLanguageMenu);
                setShowToneMenu(false);
              }}
              className="h-7 sm:h-8 flex items-center gap-1 px-2 sm:px-2.5 bg-[#1c1c1c] hover:bg-[#262626] text-white border border-[#333333] hover:border-blue-500/50 rounded-lg text-xs font-semibold transition shadow-xs cursor-pointer whitespace-nowrap"
              title="בחר שפת יעד לתרגום"
            >
              <Globe className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-400 shrink-0" />
              <span className="text-xs sm:text-sm">{selectedLang.flag}</span>
              <span className="font-bold">{selectedLang.nativeName}</span>
              <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
            </button>

            {showLanguageMenu && (
              <div
                className="absolute right-0 sm:left-0 sm:right-auto mt-1.5 w-56 max-w-[calc(100vw-2.5rem)] bg-[#161616] border border-[#2e2e2e] rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in slide-in-from-top-2 max-h-72 overflow-y-auto custom-scrollbar"
                onMouseLeave={() => setShowLanguageMenu(false)}
              >
                <div className="text-[11px] font-bold text-gray-400 px-2 py-1 border-b border-[#222222] mb-1">
                  בחר שפת יעד לתרגום (Target Language):
                </div>
                {TARGET_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => handleSelectLanguage(lang)}
                    className={`w-full text-right px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition cursor-pointer ${
                      selectedLang.code === lang.code
                        ? "bg-blue-600/30 text-blue-300 font-bold border border-blue-500/40"
                        : "text-gray-200 hover:bg-[#242424] hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{lang.flag}</span>
                      <span>{lang.nativeName}</span>
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono">{lang.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Auto-save Restore Banner (if draft found from previous session) */}
        {savedDraftAvailable && !dismissDraftPrompt && (
          <div className="bg-gradient-to-r from-blue-950/80 to-indigo-950/80 border border-blue-500/40 rounded-lg p-2.5 flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2 text-xs text-blue-200">
              <History className="w-4 h-4 text-blue-400 shrink-0" />
              <span>
                נמצאה טיוטה שנשמרה אוטומטית בדפדפן (
                <span className="font-bold text-white">{savedDraftAvailable.cueCount} כתוביות</span>{" "}
                מ-{savedDraftAvailable.savedAt}).
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {onRestoreDraft && (
                <button
                  onClick={() => {
                    onRestoreDraft();
                    setDismissDraftPrompt(true);
                    setFeedbackMessage({
                      type: "success",
                      text: "הטיוטה השמורה שוחזרה בהצלחה!",
                    });
                  }}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold transition shadow cursor-pointer"
                >
                  שחזר טיוטה
                </button>
              )}
              {onClearSavedDraft && (
                <button
                  onClick={() => {
                    onClearSavedDraft();
                    setDismissDraftPrompt(true);
                  }}
                  className="px-2 py-1 bg-[#1a1a1a] hover:bg-[#282828] text-gray-400 hover:text-white rounded text-xs transition border border-[#333333] cursor-pointer"
                  title="מחק טיוטה שמורה זו"
                >
                  מחק
                </button>
              )}
              <button
                onClick={() => setDismissDraftPrompt(true)}
                className="text-gray-400 hover:text-white p-1 rounded cursor-pointer"
                title="סגור הודעה"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Action Tools Bar: Translate All, Add Cue, Import SRT */}
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {/* 1. Bulk 'Translate All' Button */}
            <button
              id="translate-all-btn"
              onClick={handleTranslateAll}
              disabled={cues.length === 0 || isTranslatingAll}
              className="col-span-2 sm:col-span-2 flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold transition shadow-md shadow-blue-900/30 disabled:opacity-40 disabled:pointer-events-none cursor-pointer active:scale-98"
              title={`תרגם את כל ${cues.length} הכתוביות בבת אחת ל-${selectedLang.nativeName} באמצעות Gemini`}
            >
              {isTranslatingAll ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                  <span>מתרגם {cues.length} כתוביות ל-{selectedLang.nativeName}...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                  <span>תרגם הכל ל-{selectedLang.nativeName} ({selectedLang.flag})</span>
                </>
              )}
            </button>

            {/* 2. Add Cue */}
            <button
              onClick={handleAddAtCurrentTime}
              className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-[#1c1c1c] hover:bg-[#262626] text-gray-200 hover:text-white border border-[#333333] rounded-lg text-xs font-semibold transition cursor-pointer"
              title="הוסף כתובית בנקודת הזמן הנוכחית"
            >
              <Plus className="w-3.5 h-3.5 text-blue-400" />
              <span>הוסף כתובית</span>
            </button>

            {/* 3. Import SRT */}
            <input
              type="file"
              ref={fileInputRef}
              accept=".srt,.vtt"
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-1 px-2.5 py-1.5 bg-[#1c1c1c] hover:bg-[#262626] text-gray-300 hover:text-white rounded-lg border border-[#333333] transition cursor-pointer text-xs font-semibold"
              title="ייבא קובץ כתוביות SRT/VTT עם אימות שגיאות"
            >
              <FileCode className="w-3.5 h-3.5 text-blue-400" />
              <span>ייבא SRT</span>
            </button>
          </div>

          {/* Secondary Utilities: Find & Replace, Batch Time Shift, OCR Cleaner, Merge Short Cues, Auto-Format */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-[#1f1f1f]">
            <div className="flex items-center gap-1.5 flex-wrap flex-1">
              {/* Find & Replace Button */}
              <button
                id="find-and-replace-btn"
                onClick={() => setFindReplaceModalOpen(true)}
                disabled={cues.length === 0}
                className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-[#1c1c1c] hover:bg-[#282828] text-purple-300 hover:text-purple-200 border border-purple-500/30 hover:border-purple-500/50 rounded-md text-xs font-medium transition disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                title="חפש והחלף מילים וביטויים בכל הכתוביות"
              >
                <Replace className="w-3.5 h-3.5 text-purple-400" />
                <span>חיפוש והחלפה</span>
              </button>

              {/* Batch Time Shift / Bulk Offset Button */}
              <button
                id="batch-time-shift-btn"
                onClick={() => setBatchShiftModalOpen(true)}
                disabled={cues.length === 0}
                className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-[#1c1c1c] hover:bg-[#282828] text-cyan-300 hover:text-cyan-200 border border-cyan-500/30 hover:border-cyan-500/50 rounded-md text-xs font-medium transition disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                title="הזזת תזמון קבוצתית (מילישניות, אחוזים, טווח זמנים ובחירה)"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
                <span>הזזת תזמון קבוצתית (ms/%)</span>
                {selectedCueIds.length > 0 && (
                  <span className="bg-cyan-950 text-cyan-300 text-[10px] px-1.5 py-0.2 rounded-full border border-cyan-500/40 font-mono">
                    {selectedCueIds.length}
                  </span>
                )}
              </button>

              {/* Auto-Format Regex Cleanup Button */}
              <button
                id="auto-format-btn"
                onClick={handleAutoFormat}
                disabled={cues.length === 0}
                className="flex items-center justify-center gap-1 px-2.5 py-1.5 bg-gradient-to-r from-emerald-950/70 to-teal-950/70 hover:from-emerald-900/80 hover:to-teal-900/80 text-emerald-300 hover:text-emerald-200 border border-emerald-500/40 hover:border-emerald-400 rounded-md text-xs font-semibold transition disabled:opacity-40 disabled:pointer-events-none cursor-pointer shadow-sm"
                title="עיצוב וניקוי אוטומטי (Auto-Format): מחיקת רווחים מיותרים, תיקון אותיות גדולות, יישור סימני פיסוק, סוגריים ומרכאות"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>עיצוב אוטומטי</span>
              </button>

              {/* Clean OCR Artifacts */}
              <button
                onClick={handleBulkCleanOcr}
                disabled={cues.length === 0}
                className="flex items-center justify-center gap-1 px-2 py-1.5 bg-[#1a1a1a] hover:bg-[#242424] text-amber-300 hover:text-amber-200 border border-amber-500/20 hover:border-amber-500/40 rounded-md text-xs font-medium transition disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                title="הסר סימני OCR, רעשי פיסוק, קווים ותווים מיותרים"
              >
                <Wand2 className="w-3 h-3 text-amber-400" />
                <span className="hidden sm:inline">ניקוי OCR</span>
              </button>

              {/* Merge Short Cues */}
              <button
                onClick={handleMergeShortCues}
                disabled={cues.length <= 1}
                className="flex items-center justify-center gap-1 px-2 py-1.5 bg-[#1a1a1a] hover:bg-[#242424] text-blue-300 hover:text-blue-200 border border-blue-500/20 hover:border-blue-500/40 rounded-md text-xs font-medium transition disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                title="איחוד כתוביות קצרות או חופפות"
              >
                <Combine className="w-3 h-3 text-blue-400" />
                <span className="hidden sm:inline">איחוד קצרות</span>
              </button>
            </div>
          </div>

          {/* Dedicated Subtitle Search & Filter Bar */}
          <div className="bg-[#0f0f0f] border border-[#262626] rounded-xl p-2.5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 shadow-inner">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                id="subtitle-search-input"
                type="text"
                placeholder="חפש בתוכן הכתוביות (עברית, אנגלית/מקור או מספר כתובית #1)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#181818] border border-[#333333] rounded-lg pr-9 pl-9 py-1.5 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1 rounded hover:bg-[#2a2a2a] transition cursor-pointer"
                  title="נקה חיפוש"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Category Chips & Counter */}
            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              <span className="text-[11px] text-gray-400 flex items-center gap-1">
                <Filter className="w-3 h-3 text-blue-400" />
                <span>סינון:</span>
              </span>

              {/* All */}
              <button
                onClick={() => setFilterType("all")}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                  filterType === "all"
                    ? "bg-blue-600/30 text-blue-300 border border-blue-500/50"
                    : "bg-[#1c1c1c] text-gray-400 hover:text-white border border-[#2e2e2e]"
                }`}
              >
                הכל ({cues.length})
              </button>

              {/* Short */}
              <button
                onClick={() => setFilterType(filterType === "short" ? "all" : "short")}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                  filterType === "short"
                    ? "bg-amber-600/30 text-amber-300 border border-amber-500/50"
                    : "bg-[#1c1c1c] text-gray-400 hover:text-amber-300 border border-[#2e2e2e]"
                }`}
                title="הצג כתוביות קצרות מ-1.2 שניות"
              >
                קצרות (&lt;1.2s)
              </button>

              {/* Long */}
              <button
                onClick={() => setFilterType(filterType === "long" ? "all" : "long")}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                  filterType === "long"
                    ? "bg-purple-600/30 text-purple-300 border border-purple-500/50"
                    : "bg-[#1c1c1c] text-gray-400 hover:text-purple-300 border border-[#2e2e2e]"
                }`}
                title="הצג כתוביות ארוכות מ-5.5 שניות"
              >
                ארוכות (&gt;5.5s)
              </button>

              {/* Overlapping */}
              {totalOverlapCount > 0 && (
                <button
                  onClick={() => setFilterType(filterType === "overlapping" ? "all" : "overlapping")}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                    filterType === "overlapping"
                      ? "bg-rose-600/40 text-rose-200 border border-rose-500/70"
                      : "bg-rose-950/50 text-rose-300 hover:text-rose-200 border border-rose-800/60"
                  }`}
                  title="הצג רק כתוביות בעלות חפיפת זמנים"
                >
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                  <span>חפיפות ({totalOverlapCount})</span>
                </button>
              )}

              {/* Results counter badge */}
              {(searchTerm || filterType !== "all") && (
                <span className="bg-blue-950/80 text-blue-300 border border-blue-500/40 text-[11px] px-2.5 py-0.5 rounded-full font-mono font-medium">
                  {filteredCues.length} תוצאות
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Global Interactive Timeline Bar (Overview across Video Duration) */}
        {cues.length > 0 && (
          <div className="pt-2 border-t border-[#1f1f1f]">
            <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
              <div className="flex items-center gap-1.5 font-semibold">
                <Layers className="w-3 h-3 text-blue-400" />
                <span>ציר זמן כתוביות כולל ({formatTimeDisplay(effectiveDuration)})</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[9px] flex-wrap">
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> תקין (1.2-5.5s)
                </span>
                <span className="flex items-center gap-1 text-amber-400">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span> קצר (&lt;1.2s)
                </span>
                <span className="flex items-center gap-1 text-purple-400">
                  <span className="w-2 h-2 rounded-full bg-purple-500 inline-block"></span> ארוך (&gt;5.5s)
                </span>
                <span className="flex items-center gap-1 text-rose-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block ring-1 ring-rose-300"></span> חפיפת זמנים
                </span>
              </div>
            </div>

            {/* Timeline Track */}
            <div
              className="relative w-full h-6 bg-[#0a0a0a] rounded-lg border border-[#252525] overflow-hidden select-none cursor-pointer"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const percent = Math.max(0, Math.min(1, clickX / rect.width));
                onSeekTo(percent * effectiveDuration);
              }}
              title="לחץ בכל נקודה בציר הזמן כדי לקפוץ אליה בסרטון"
            >
              {/* Scale Ticks */}
              <div className="absolute inset-0 flex justify-between px-1 pointer-events-none opacity-20">
                {[0, 0.25, 0.5, 0.75, 1].map((frac, idx) => (
                  <div key={idx} className="h-full border-r border-gray-400 flex flex-col justify-end">
                    <span className="text-[8px] text-gray-300 font-mono scale-90 -mr-2">
                      {Math.round(frac * effectiveDuration)}s
                    </span>
                  </div>
                ))}
              </div>

              {/* Subtitle Cue Blocks */}
              {cues.map((cue, i) => {
                const startPct = Math.max(0, Math.min(100, (cue.startTime / effectiveDuration) * 100));
                const cueDuration = Math.max(0.1, cue.endTime - cue.startTime);
                const widthPct = Math.max(1.8, Math.min(100 - startPct, (cueDuration / effectiveDuration) * 100));
                const isActive = activeCueId === cue.id;
                const isOverlapping = overlappingCuesMap.has(cue.id);
                const isShort = cueDuration < 1.2;
                const isLong = cueDuration > 5.5;

                return (
                  <div
                    key={cue.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSeekTo(cue.startTime);
                    }}
                    style={{
                      left: `${startPct}%`,
                      width: `${widthPct}%`,
                    }}
                    title={`#${i + 1}: ${formatTimeDisplay(cue.startTime)} - ${formatTimeDisplay(cue.endTime)} (${cueDuration.toFixed(1)}s)\n${cue.hebrewText}${isOverlapping ? "\n⚠️ חפיפת זמנים!" : ""}`}
                    className={`absolute top-0.5 bottom-0.5 rounded transition-all flex items-center justify-center text-[9px] font-mono font-bold text-white shadow-sm hover:z-20 cursor-pointer ${
                      isActive
                        ? "bg-blue-500 ring-2 ring-blue-300 z-10 shadow-blue-500/50"
                        : isOverlapping
                        ? "bg-rose-600 ring-2 ring-rose-400 animate-pulse z-10"
                        : isShort
                        ? "bg-amber-500/80 hover:bg-amber-400 border border-amber-300/40"
                        : isLong
                        ? "bg-purple-600/80 hover:bg-purple-500 border border-purple-300/40"
                        : "bg-emerald-600/80 hover:bg-emerald-500 border border-emerald-300/40"
                    }`}
                  >
                    {widthPct > 5 && (
                      <span className="truncate px-0.5 pointer-events-none scale-90">
                        {cueDuration.toFixed(1)}s
                      </span>
                    )}
                  </div>
                );
              })}

              {/* Playhead Marker */}
              <div
                style={{
                  left: `${Math.max(0, Math.min(100, (currentTime / effectiveDuration) * 100))}%`,
                }}
                className="absolute top-0 bottom-0 w-0.5 bg-rose-500 pointer-events-none z-30 shadow-[0_0_8px_rgba(244,63,94,0.9)] transition-all duration-75"
              >
                <div className="w-2 h-2 -ml-[3.5px] -mt-0.5 bg-rose-500 rotate-45 border border-white"></div>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Feedback Toast Banner */}
        {feedbackMessage && (
          <div
            className={`p-2.5 rounded-lg text-xs flex items-center justify-between transition animate-in fade-in ${
              feedbackMessage.type === "success"
                ? "bg-green-950/50 border border-green-500/40 text-green-300"
                : feedbackMessage.type === "warning"
                ? "bg-amber-950/50 border border-amber-500/40 text-amber-300"
                : feedbackMessage.type === "error"
                ? "bg-rose-950/50 border border-rose-500/40 text-rose-300"
                : "bg-blue-950/50 border border-blue-500/40 text-blue-300"
            }`}
          >
            <div className="flex items-center gap-2">
              {feedbackMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-green-400" />
              ) : feedbackMessage.type === "error" ? (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{feedbackMessage.text}</span>
            </div>
            <button
              onClick={() => setFeedbackMessage(null)}
              className="text-gray-400 hover:text-white p-0.5 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Recharts Duration Distribution Visualizer */}
        {cues.length > 0 && (
          <DurationDistributionChart
            cues={cues}
            selectedCueId={activeCueId}
            onSelectCue={(_cueId, startTime) => {
              onSeekTo(startTime);
            }}
          />
        )}
      </div>

      {/* Subtitles List Header with Select All */}
      {cues.length > 0 && (
        <div className="flex items-center justify-between px-1 py-1.5 text-xs text-gray-400 border-b border-[#1f1f1f]">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 text-gray-400 hover:text-white transition cursor-pointer text-[11px]"
              title="בחר את כל הכתוביות לפעולות קבוצתיות"
            >
              {selectedCueIds.length === cues.length ? (
                <CheckSquare className="w-3.5 h-3.5 text-blue-400" />
              ) : (
                <Square className="w-3.5 h-3.5 text-gray-500" />
              )}
              <span>
                {selectedCueIds.length > 0
                  ? `נבחרו ${selectedCueIds.length} מתוך ${cues.length}`
                  : "בחר הכל"}
              </span>
            </button>
          </div>

          {selectedCueIds.length > 0 && (
            <div className="flex items-center gap-2">
              {/* Merge Selected Cues button */}
              {selectedCueIds.length >= 2 && (
                <button
                  id="merge-selected-cues-btn"
                  onClick={handleMergeSelectedCues}
                  className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 bg-blue-950/70 hover:bg-blue-900/80 px-2 py-0.5 rounded border border-blue-500/40 transition cursor-pointer"
                  title="אחד את כל הכתוביות שנבחרו לכתובית אחת רציפה"
                >
                  <Combine className="w-3 h-3" />
                  <span>אחד {selectedCueIds.length} נבחרות</span>
                </button>
              )}

              <button
                onClick={() => setBatchShiftModalOpen(true)}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <SlidersHorizontal className="w-3 h-3" />
                <span>הזז {selectedCueIds.length} נבחרות</span>
              </button>
              <button
                onClick={() => setSelectedCueIds([])}
                className="text-[11px] text-gray-500 hover:text-gray-300 cursor-pointer"
              >
                נקה בחירה
              </button>
            </div>
          )}
        </div>
      )}

      {/* Subtitles List */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto pr-1 pl-1 py-2 space-y-2.5 min-h-[300px] max-h-[520px] custom-scrollbar"
      >
        {cues.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 text-gray-500">
            <Languages className="w-10 h-10 mb-2 opacity-40 text-blue-400" />
            <p className="text-sm font-semibold text-gray-300 mb-1">
              עדיין לא זוהו כתוביות
            </p>
            <p className="text-xs max-w-xs text-gray-400">
              לחץ על "תרגם כתוביות ב-AI" כדי לסרוק את הסרטון, או על "תרגם הכל" לאחר הוספת שורות.
            </p>
          </div>
        ) : filteredCues.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center bg-[#111111] rounded-xl border border-[#222222] my-4">
            <Search className="w-8 h-8 mb-2 text-gray-500 opacity-60" />
            <p className="text-xs font-semibold text-gray-300 mb-1">
              לא נמצאו כתוביות התואמות לחיפוש "{searchTerm}"
            </p>
            <p className="text-[11px] text-gray-500 mb-3">
              נסה לחפש מילה אחרת, מספר כתובית (כגון #1) או לשנות את הסינון הנבחר.
            </p>
            <button
              onClick={() => {
                setSearchTerm("");
                setFilterType("all");
              }}
              className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-md text-xs font-semibold transition cursor-pointer"
            >
              נקה חיפוש וסינון
            </button>
          </div>
        ) : (
          filteredCues.map((cue, idx) => {
            const isActive = activeCueId === cue.id;
            const isSelected = selectedCueIds.includes(cue.id);
            const duration = Math.max(0.1, +(cue.endTime - cue.startTime).toFixed(1));
            const isShort = duration < 1.2;
            const isLong = duration > 5.5;
            // Gauge percentage on a 0 to 7 seconds scale
            const gaugePercent = Math.min(100, Math.max(5, (duration / 7.0) * 100));

            // Overlap detection for this cue
            const overlapInfo = overlappingCuesMap.get(cue.id);
            const isOverlapping = !!overlapInfo;

            // Sequential / Chronological next cue for 'Merge with next'
            const cueOrderIndex = sortedChronologicalCues.findIndex((c) => c.id === cue.id);
            const hasNextChronologicalCue =
              cueOrderIndex !== -1 && cueOrderIndex < sortedChronologicalCues.length - 1;
            const nextCue = hasNextChronologicalCue
              ? sortedChronologicalCues[cueOrderIndex + 1]
              : null;

            return (
              <div
                key={cue.id}
                ref={isActive ? activeItemRef : null}
                className={`group rounded-lg border p-3 transition-all duration-200 relative ${
                  isOverlapping
                    ? "bg-[#181113] border-rose-600 shadow-md shadow-rose-950/50 ring-2 ring-rose-500/70"
                    : isActive
                    ? "bg-[#181818] border-blue-500 shadow-md shadow-blue-950/40 ring-1 ring-blue-500/50"
                    : isSelected
                    ? "bg-[#121926] border-blue-500/60"
                    : "bg-[#111111] hover:bg-[#161616] border-[#222222]"
                }`}
              >
                {/* Real-time Overlap Warning Banner */}
                {isOverlapping && (
                  <div className="mb-2 px-2.5 py-1 bg-rose-950/90 border border-rose-500/80 rounded-md text-[11px] text-rose-200 flex items-center justify-between gap-2 animate-in fade-in">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>
                        אזהרת סנכרון: חפיפת זמנים עם כתובית{" "}
                        {overlapInfo.overlappingIndexes.map((num) => `#${num}`).join(", ")}
                      </span>
                    </div>
                    <span className="text-[10px] text-rose-300 font-mono">
                      (בדוק זמני התחלה/סיום)
                    </span>
                  </div>
                )}

                {/* Top Row: Selection Checkbox, Cue Number, Timestamps, Visual Duration Indicator & Action Buttons */}
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <div className="flex items-center flex-wrap gap-2">
                    {/* Selection Checkbox */}
                    <button
                      type="button"
                      onClick={() => toggleCueSelection(cue.id)}
                      className="text-gray-500 hover:text-blue-400 transition cursor-pointer"
                      title={isSelected ? "בטל בחירת כתובית זו" : "בחר כתובית זו לפעולה קבוצתית"}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-3.5 h-3.5 text-blue-400" />
                      ) : (
                        <Square className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <span className="text-[11px] font-bold text-gray-500 font-mono">
                      #{idx + 1}
                    </span>

                    {/* Timestamp range inputs / badges */}
                    <div className={`flex items-center gap-1.5 bg-[#0d0d0d] border px-2 py-0.5 rounded text-[11px] font-mono transition ${
                      isOverlapping ? "border-rose-500/80 text-rose-300" : "border-[#262626] text-gray-300"
                    }`}>
                      <Clock className={`w-3 h-3 ${isOverlapping ? "text-rose-400" : "text-blue-400"}`} />
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={cue.startTime}
                        onChange={(e) =>
                          onUpdateCue({
                            ...cue,
                            startTime: Math.max(0, parseFloat(e.target.value) || 0),
                          })
                        }
                        className="w-12 bg-transparent text-center focus:outline-none focus:text-blue-300 font-bold"
                      />
                      <span className={isOverlapping ? "text-rose-500" : "text-gray-600"}>→</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={cue.endTime}
                        onChange={(e) =>
                          onUpdateCue({
                            ...cue,
                            endTime: Math.max(cue.startTime + 0.1, parseFloat(e.target.value) || 0),
                          })
                        }
                        className="w-12 bg-transparent text-center focus:outline-none focus:text-blue-300 font-bold"
                      />
                    </div>

                    {/* Visual Duration Health Badge & Mini Timeline Gauge */}
                    <div className="flex items-center gap-1.5">
                      {/* Health Pill */}
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded flex items-center gap-1 border transition ${
                          isShort
                            ? "bg-amber-950/70 border-amber-500/40 text-amber-300"
                            : isLong
                            ? "bg-purple-950/70 border-purple-500/40 text-purple-300"
                            : "bg-emerald-950/70 border-emerald-500/40 text-emerald-300"
                        }`}
                        title={
                          isShort
                            ? `משך קצר (${duration}s) - מומלץ לפחות 1.2 שניות לקריאה נוחה`
                            : isLong
                            ? `משך ארוך (${duration}s) - מעל 5.5 שניות, שקול פיצול לשתי כתוביות`
                            : `משך אידיאלי לקריאה (${duration}s)`
                        }
                      >
                        {isShort ? (
                          <>
                            <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                            <span>{duration}s קצר</span>
                          </>
                        ) : isLong ? (
                          <>
                            <Clock className="w-2.5 h-2.5 text-purple-400" />
                            <span>{duration}s ארוך</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-2.5 h-2.5 text-emerald-400" />
                            <span>{duration}s תקין</span>
                          </>
                        )}
                      </span>

                      {/* Mini Visual Gauge Bar (0 to 7s scale) */}
                      <div
                        className="w-14 sm:w-20 h-2 bg-[#1f1f1f] rounded-full overflow-hidden border border-[#2d2d2d] relative flex items-center"
                        title={`מדד משך זמן כתובית: ${duration} שניות מתוך סקאלה של 7 שניות`}
                      >
                        {/* Safe Reading Zone Markers (1.2s to 5.5s) */}
                        <div
                          className="absolute h-full bg-[#2a2a2a] opacity-60"
                          style={{
                            left: `${(1.2 / 7) * 100}%`,
                            width: `${((5.5 - 1.2) / 7) * 100}%`,
                          }}
                        />
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isShort
                              ? "bg-gradient-to-r from-amber-500 to-amber-400"
                              : isLong
                              ? "bg-gradient-to-r from-purple-500 to-indigo-400"
                              : "bg-gradient-to-r from-emerald-500 to-teal-400"
                          }`}
                          style={{ width: `${gaugePercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions for this cue */}
                  <div className="flex items-center gap-1">
                    {/* Merge with next cue */}
                    {hasNextChronologicalCue && (
                      <button
                        id={`merge-with-next-btn-${cue.id}`}
                        onClick={() => handleMergeWithNext(cue.id)}
                        className="px-2 py-1 rounded bg-[#1c1c1c] hover:bg-blue-600/90 text-blue-400 hover:text-white border border-[#2d2d2d] hover:border-blue-500/50 transition cursor-pointer flex items-center gap-1 text-[11px] font-semibold shadow-xs"
                        title={
                          nextCue
                            ? `אחד עם הכתובית הבאה (#${cueOrderIndex + 2}: "${(nextCue.hebrewText || nextCue.originalText).slice(0, 25)}...")`
                            : "אחד עם הכתובית הבאה (Merge with next)"
                        }
                      >
                        <Combine className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">אחד עם הבאה</span>
                      </button>
                    )}

                    {/* Play from this timestamp */}
                    <button
                      onClick={() => onSeekTo(cue.startTime)}
                      className="p-1 rounded bg-[#1e1e1e] hover:bg-blue-600 text-gray-300 hover:text-white transition cursor-pointer"
                      title="קפוץ לנקודת הזמן בסרטון"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>

                    {/* AI Re-translate Button */}
                    <button
                      disabled={retranslatingId === cue.id}
                      onClick={() => handleRetranslate(cue)}
                      className="p-1 rounded bg-[#1e1e1e] hover:bg-blue-600 text-gray-300 hover:text-white transition disabled:opacity-50 cursor-pointer"
                      title={`תרגם מחדש ל-${selectedLang.nativeName} (${selectedLang.name})`}
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${retranslatingId === cue.id ? "animate-spin text-amber-300" : "text-amber-400"}`} />
                    </button>

                    {/* Delete cue */}
                    <button
                      onClick={() => onDeleteCue(cue.id)}
                      className="p-1 rounded bg-[#1e1e1e] hover:bg-rose-600 text-gray-400 hover:text-white transition cursor-pointer"
                      title="מחק כתובית"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Subtitle Content: Original vs Translated */}
                <div className="space-y-1.5">
                  {/* Translated Text (Target Language) with Real-time Spellcheck */}
                  <div className="relative">
                    <label className="text-[10px] font-semibold text-blue-400 flex items-center justify-between mb-0.5">
                      <span className="flex items-center gap-1">
                        <span>תרגום ל-{selectedLang.nativeName}:</span>
                        <span className="text-xs">{selectedLang.flag}</span>
                      </span>
                      <span className="text-[9px] text-gray-500 font-mono">{selectedLang.name}</span>
                    </label>

                    <SpellcheckSubtitleInput
                      cueId={cue.id}
                      value={cue.hebrewText}
                      onChange={(newVal) =>
                        onUpdateCue({
                          ...cue,
                          hebrewText: newVal,
                          isEdited: true,
                        })
                      }
                      targetLanguage={selectedLang}
                      dir={selectedLang.dir}
                      placeholder={`הזן טקסט כתובית ב-${selectedLang.nativeName}...`}
                    />
                  </div>

                  {/* Original Detected Hardcoded Text */}
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 flex items-center justify-between mb-0.5">
                      <span>טקסט מקורי שזוהה בסרטון:</span>
                      <span className="text-[9px] text-gray-600 font-mono">{cue.detectedLanguage || "מקור"}</span>
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={cue.originalText}
                      onChange={(e) =>
                        onUpdateCue({
                          ...cue,
                          originalText: e.target.value,
                          isEdited: true,
                        })
                      }
                      className="w-full bg-[#0d0d0d] border border-[#222222] rounded-md px-2 py-1 text-[11px] text-gray-400 font-mono focus:outline-none focus:border-gray-600"
                      placeholder="Original detected text..."
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Footer Info */}
      <div className="pt-3 border-t border-[#222222] flex items-center justify-between flex-wrap gap-2 text-xs text-gray-400">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="rounded border-[#333333] text-blue-600 focus:ring-blue-500"
          />
          <span>גלילה אוטומטית לפי ניגון הסרטון</span>
        </label>

        <div className="flex items-center gap-3 text-[11px] text-gray-500">
          <span>
            שפת יעד: {selectedLang.flag} {selectedLang.nativeName}
          </span>
          {lastAutoSavedAt && (
            <span className="text-emerald-400 flex items-center gap-1 font-mono">
              <ShieldCheck className="w-3 h-3" />
              נשמר {lastAutoSavedAt}
            </span>
          )}
        </div>
      </div>

      {/* Find and Replace Modal */}
      <FindAndReplaceModal
        isOpen={findReplaceModalOpen}
        onClose={() => setFindReplaceModalOpen(false)}
        cues={cues}
        onApplyReplace={handleApplyFindAndReplace}
        targetLanguageName={selectedLang.nativeName}
      />

      {/* Batch Time Shift Modal */}
      <BatchTimeShiftModal
        isOpen={batchShiftModalOpen}
        onClose={() => setBatchShiftModalOpen(false)}
        cues={cues}
        selectedCueIds={selectedCueIds}
        currentTime={currentTime}
        onApplyBulkShift={handleApplyBatchShift}
      />

      {/* SRT / VTT Validation and Import Modal */}
      <SrtValidationModal
        isOpen={validationModalOpen}
        onClose={() => setValidationModalOpen(false)}
        validationResult={validationResult}
        fileName={uploadFileName}
        onConfirmImport={handleConfirmImport}
      />
    </div>
  );
};
