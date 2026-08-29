import { SubtitleCue } from "../types";
import { parseTimestampToSeconds, formatSrtTimestamp } from "./timeFormat";

export interface SrtValidationError {
  line?: number;
  blockIndex: number;
  type: "syntax" | "timing" | "empty";
  message: string;
  snippet?: string;
}

export interface SrtTimingOverlap {
  cueIndex1: number;
  cueIndex2: number;
  cue1Text: string;
  cue2Text: string;
  timeRange1: string;
  timeRange2: string;
  overlapSeconds: number;
}

export interface SrtValidationResult {
  isValid: boolean;
  totalParsed: number;
  errors: SrtValidationError[];
  warnings: SrtValidationError[];
  overlaps: SrtTimingOverlap[];
  cues: SubtitleCue[];
}

/**
 * Cleans common OCR noise, stray characters, and redundant punctuation from a text string.
 */
export function cleanOcrText(rawText: string): string {
  if (!rawText) return "";

  let text = rawText;

  // 1. Normalize line endings and multiple spaces
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  text = text.replace(/[ \t]+/g, " ");

  // 2. Remove common OCR stray symbols at start or end of text/lines (pipes, backslashes, tildes, underscores, stray hashes)
  text = text
    .split("\n")
    .map((line) => {
      let l = line.trim();

      // Remove leading stray OCR artifacts: |, \, /, ~, _, ^, #, *, ;, :, `, ¬, §
      l = l.replace(/^[|\\/~_\^#\*;:`¬§•\-–—]+\s*/g, "");
      // Remove trailing stray OCR artifacts: |, \, /, ~, _, ^, #, *, ;, `, ¬, §
      l = l.replace(/\s*[|\\/~_\^#\*;`¬§•]+$/g, "");

      // Remove single isolated stray pipe or slash in between words: e.g. "שלום | עולם" -> "שלום עולם"
      l = l.replace(/\s+[|\\/]\s+/g, " ");

      // Clean redundant consecutive punctuation:
      // More than 3 dots -> 3 dots (...)
      l = l.replace(/\.{4,}/g, "...");
      // Multiple consecutive commas -> single comma
      l = l.replace(/,{2,}/g, ",");
      // Multiple exclamation marks -> single or double
      l = l.replace(/!{3,}/g, "!");
      // Multiple question marks -> single
      l = l.replace(/\?{2,}/g, "?");
      // Stray isolated brackets: "[]", "()", "{}"
      l = l.replace(/\[\s*\]|\(\s*\)|\{\s*\}/g, "");

      // Clean stray unclosed leading/trailing non-paired quotation marks
      if ((l.startsWith('"') && !l.slice(1).includes('"')) || (l.startsWith("'") && !l.slice(1).includes("'"))) {
        l = l.slice(1).trim();
      }
      if ((l.endsWith('"') && !l.slice(0, -1).includes('"')) || (l.endsWith("'") && !l.slice(0, -1).includes("'"))) {
        l = l.slice(0, -1).trim();
      }

      return l.trim();
    })
    .filter((line) => line.length > 0)
    .join("\n");

  return text.trim();
}

/**
 * Bulk cleans OCR artifacts across all existing cues in the workspace.
 */
export function bulkCleanOcrArtifacts(cues: SubtitleCue[]): {
  cleanedCues: SubtitleCue[];
  modifiedCount: number;
  originalFixedCount: number;
  hebrewFixedCount: number;
} {
  let modifiedCount = 0;
  let originalFixedCount = 0;
  let hebrewFixedCount = 0;

  const cleanedCues = cues.map((cue) => {
    const cleanedOriginal = cleanOcrText(cue.originalText);
    const cleanedHebrew = cleanOcrText(cue.hebrewText);

    const origChanged = cleanedOriginal !== cue.originalText;
    const hebChanged = cleanedHebrew !== cue.hebrewText;

    if (origChanged) originalFixedCount++;
    if (hebChanged) hebrewFixedCount++;

    if (origChanged || hebChanged) {
      modifiedCount++;
      return {
        ...cue,
        originalText: cleanedOriginal,
        hebrewText: cleanedHebrew,
        isEdited: true,
      };
    }

    return cue;
  });

  return {
    cleanedCues,
    modifiedCount,
    originalFixedCount,
    hebrewFixedCount,
  };
}

/**
 * Automatically merges short adjacent cues or cues with overlapping/very close timings
 * to improve subtitle readability.
 */
export function mergeShortOrOverlappingCues(
  cues: SubtitleCue[],
  options: { minDuration?: number; maxGap?: number; maxTotalDuration?: number } = {}
): {
  mergedCues: SubtitleCue[];
  mergedCount: number;
} {
  if (cues.length <= 1) {
    return { mergedCues: [...cues], mergedCount: 0 };
  }

  const minDuration = options.minDuration ?? 1.4; // seconds
  const maxGap = options.maxGap ?? 0.45; // seconds
  const maxTotalDuration = options.maxTotalDuration ?? 6.5; // seconds

  const sorted = [...cues].sort((a, b) => a.startTime - b.startTime);
  const result: SubtitleCue[] = [];
  let mergedCount = 0;

  let current = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];

    const currentDuration = current.endTime - current.startTime;
    const nextDuration = next.endTime - next.startTime;
    const gap = next.startTime - current.endTime;
    const isOverlapping = next.startTime < current.endTime;
    const isVeryClose = gap <= maxGap;
    const isEitherShort = currentDuration < minDuration || nextDuration < minDuration;
    const combinedDuration = Math.max(current.endTime, next.endTime) - current.startTime;

    // Merge conditions:
    // 1. If overlapping OR (very close AND either cue is short)
    // 2. AND total combined duration doesn't exceed maximum threshold
    if ((isOverlapping || (isVeryClose && isEitherShort)) && combinedDuration <= maxTotalDuration) {
      // Merge texts avoiding duplicate repetitions
      const orig1 = current.originalText.trim();
      const orig2 = next.originalText.trim();
      let mergedOrig = orig1;
      if (orig2 && orig2 !== orig1) {
        mergedOrig = orig1 ? `${orig1} ${orig2}` : orig2;
      }

      const heb1 = current.hebrewText.trim();
      const heb2 = next.hebrewText.trim();
      let mergedHeb = heb1;
      if (heb2 && heb2 !== heb1) {
        mergedHeb = heb1 ? `${heb1} ${heb2}` : heb2;
      }

      current.endTime = Math.max(current.endTime, next.endTime);
      current.originalText = mergedOrig;
      current.hebrewText = mergedHeb;
      current.detectedLanguage = current.detectedLanguage || next.detectedLanguage;
      current.isEdited = true;
      mergedCount++;
    } else {
      result.push(current);
      current = { ...next };
    }
  }

  result.push(current);

  return {
    mergedCues: result,
    mergedCount,
  };
}

/**
 * Validates an SRT/VTT file string for syntax errors, malformed timecodes,
 * inverted start/end times, and overlapping cues.
 */
export function validateSrtFile(rawContent: string): SrtValidationResult {
  const errors: SrtValidationError[] = [];
  const warnings: SrtValidationError[] = [];
  const overlaps: SrtTimingOverlap[] = [];
  const cues: SubtitleCue[] = [];

  if (!rawContent || !rawContent.trim()) {
    return {
      isValid: false,
      totalParsed: 0,
      errors: [
        {
          blockIndex: 0,
          type: "empty",
          message: "הקובץ ריק או שאינו מכיל תוכן טקסטואלי תקין.",
        },
      ],
      warnings: [],
      overlaps: [],
      cues: [],
    };
  }

  const normalized = rawContent.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  const rawBlocks = normalized.split(/\n\s*\n+/);

  let parsedCount = 0;

  for (let bIdx = 0; bIdx < rawBlocks.length; bIdx++) {
    const block = rawBlocks[bIdx].trim();
    if (!block) continue;

    // Ignore WEBVTT header block
    if (block.toUpperCase().startsWith("WEBVTT") && !block.includes("-->")) {
      continue;
    }

    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    // Find the timecode line containing '-->'
    const timeLineIndex = lines.findIndex((line) => line.includes("-->"));

    if (timeLineIndex === -1) {
      errors.push({
        blockIndex: bIdx + 1,
        type: "syntax",
        message: `בבלוק #${bIdx + 1} חסרה שורת חותמת זמן תקינה הכוללת חץ תזמון (-->).`,
        snippet: block.substring(0, 80),
      });
      continue;
    }

    const timeLine = lines[timeLineIndex];
    const timeParts = timeLine.split("-->").map((s) => s.trim());

    if (timeParts.length !== 2) {
      errors.push({
        blockIndex: bIdx + 1,
        type: "syntax",
        message: `פורמט תזמון לא תקין בבלוק #${bIdx + 1}: '${timeLine}'.`,
        snippet: timeLine,
      });
      continue;
    }

    const startTime = parseTimestampToSeconds(timeParts[0]);
    const endTime = parseTimestampToSeconds(timeParts[1]);

    if (isNaN(startTime) || isNaN(endTime)) {
      errors.push({
        blockIndex: bIdx + 1,
        type: "syntax",
        message: `לא ניתן לפענח את זמני ההתחלה או הסיום בבלוק #${bIdx + 1}: '${timeLine}'.`,
        snippet: timeLine,
      });
      continue;
    }

    if (startTime < 0 || endTime < 0) {
      errors.push({
        blockIndex: bIdx + 1,
        type: "timing",
        message: `חותמות זמן שליליות אינן חוקיות בבלוק #${bIdx + 1}.`,
        snippet: timeLine,
      });
      continue;
    }

    if (endTime <= startTime) {
      errors.push({
        blockIndex: bIdx + 1,
        type: "timing",
        message: `זמן הסיום (${timeParts[1]}) חייב להיות מאוחר יותר מזמן ההתחלה (${timeParts[0]}) בבלוק #${bIdx + 1}.`,
        snippet: timeLine,
      });
      continue;
    }

    // Text content lines
    const textLines = lines.slice(timeLineIndex + 1).join("\n").trim();
    if (!textLines) {
      warnings.push({
        blockIndex: bIdx + 1,
        type: "empty",
        message: `בלוק #${bIdx + 1} מכיל תזמון אך ללא תוכן טקסט כתובית.`,
        snippet: timeLine,
      });
      continue;
    }

    parsedCount++;
    cues.push({
      id: `cue-imported-${bIdx}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      startTime: parseFloat(startTime.toFixed(3)),
      endTime: parseFloat(endTime.toFixed(3)),
      originalText: textLines,
      hebrewText: textLines,
      detectedLanguage: "Imported",
    });
  }

  // Sort chronologically to inspect overlapping timings
  cues.sort((a, b) => a.startTime - b.startTime);

  for (let i = 1; i < cues.length; i++) {
    const prev = cues[i - 1];
    const curr = cues[i];

    if (curr.startTime < prev.endTime) {
      const overlapSec = parseFloat((prev.endTime - curr.startTime).toFixed(2));
      overlaps.push({
        cueIndex1: i,
        cueIndex2: i + 1,
        cue1Text: prev.hebrewText.substring(0, 35) + (prev.hebrewText.length > 35 ? "..." : ""),
        cue2Text: curr.hebrewText.substring(0, 35) + (curr.hebrewText.length > 35 ? "..." : ""),
        timeRange1: `${formatSrtTimestamp(prev.startTime)} → ${formatSrtTimestamp(prev.endTime)}`,
        timeRange2: `${formatSrtTimestamp(curr.startTime)} → ${formatSrtTimestamp(curr.endTime)}`,
        overlapSeconds: overlapSec,
      });
    }
  }

  const isValid = errors.length === 0 && cues.length > 0;

  return {
    isValid,
    totalParsed: cues.length,
    errors,
    warnings,
    overlaps,
    cues,
  };
}

/**
 * Automatically adjusts overlapping subtitle timings to maintain a clean sequence with no overlaps.
 */
export function autoFixOverlappingCues(cues: SubtitleCue[], bufferSeconds: number = 0.05): SubtitleCue[] {
  if (cues.length <= 1) return [...cues];

  const sorted = [...cues].sort((a, b) => a.startTime - b.startTime);
  const fixed: SubtitleCue[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const cue = { ...sorted[i] };
    if (i > 0) {
      const prev = fixed[i - 1];
      // If current cue starts before prev ended
      if (cue.startTime < prev.endTime) {
        // Adjust prev endTime to end just before current cue starts
        if (prev.startTime + 0.3 < cue.startTime) {
          prev.endTime = Math.max(prev.startTime + 0.2, cue.startTime - bufferSeconds);
        } else {
          // If prev cue is too tight, shift current cue startTime
          cue.startTime = prev.endTime + bufferSeconds;
          if (cue.endTime <= cue.startTime) {
            cue.endTime = cue.startTime + 1.2;
          }
        }
      }
    }
    fixed.push(cue);
  }

  return fixed;
}
