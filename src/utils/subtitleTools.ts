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

export interface SmartMergeResult {
  mergedCues: SubtitleCue[];
  mergedCount: number;
  speakerMergeCount: number;
  sentenceMergeCount: number;
}

/**
 * Smart Merge: Identifies consecutive cues with identical speakers or overlapping/continuing sentences
 * and merges them into a single cohesive subtitle cue while maintaining correct timestamps.
 */
export function smartMergeCues(cues: SubtitleCue[]): SmartMergeResult {
  if (!cues || cues.length <= 1) {
    return { mergedCues: cues || [], mergedCount: 0, speakerMergeCount: 0, sentenceMergeCount: 0 };
  }

  const sorted = [...cues].sort((a, b) => a.startTime - b.startTime);
  const result: SubtitleCue[] = [];
  let mergedCount = 0;
  let speakerMergeCount = 0;
  let sentenceMergeCount = 0;

  let current = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];

    const currentSpeaker = (current.speaker || "").trim();
    const nextSpeaker = (next.speaker || "").trim();
    const gap = next.startTime - current.endTime;
    const isOverlappingOrVeryClose = gap <= 1.2;

    const currentHeb = (current.hebrewText || "").trim();
    const nextHeb = (next.hebrewText || "").trim();
    const currentOrig = (current.originalText || "").trim();

    // Sentence continuation check: current text does NOT end with terminal punctuation (. ? ! …)
    const endsWithTerminalPunctuation = /[.?!…:;"]$/.test(currentHeb) || /[.?!…:;"]$/.test(currentOrig);
    const isSentenceContinuation = !endsWithTerminalPunctuation && gap <= 1.5;

    // Identical speakers check
    const hasSameSpeaker = currentSpeaker.length > 0 && currentSpeaker.toLowerCase() === nextSpeaker.toLowerCase() && gap <= 1.5;

    // Combined text length constraint
    const combinedLength = (currentHeb + " " + nextHeb).length;
    const isReasonableLength = combinedLength <= 130;

    // Decision to merge:
    if ((hasSameSpeaker || isSentenceContinuation || gap < 0.4) && isOverlappingOrVeryClose && isReasonableLength) {
      if (hasSameSpeaker) speakerMergeCount++;
      if (isSentenceContinuation) sentenceMergeCount++;
      mergedCount++;

      // Merge timestamps
      current.endTime = Math.max(current.endTime, next.endTime);

      // Merge text
      if (nextHeb && !currentHeb.endsWith(nextHeb)) {
        current.hebrewText = currentHeb ? `${currentHeb} ${nextHeb}` : nextHeb;
      }
      const nextOrig = (next.originalText || "").trim();
      if (nextOrig && !currentOrig.endsWith(nextOrig)) {
        current.originalText = currentOrig ? `${currentOrig} ${nextOrig}` : nextOrig;
      }

      current.speaker = currentSpeaker || nextSpeaker;
      current.isEdited = true;
    } else {
      result.push(current);
      current = { ...next };
    }
  }

  result.push(current);

  return {
    mergedCues: result,
    mergedCount,
    speakerMergeCount,
    sentenceMergeCount,
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
 * Automatically fixes overlapping cues by adjusting end times of earlier cues.
 */
export function autoFixOverlappingCues(cues: SubtitleCue[]): SubtitleCue[] {
  const result = resolveAllSyncConflicts(cues, {
    minGapSeconds: 0.05,
    strategy: "smart-balance",
  });
  return result.resolvedCues;
}

/**
 * Options for resolving timing sync conflicts and adjusting gaps between adjacent cues.
 */
export interface ConflictResolutionOptions {
  minGapSeconds: number; // e.g. 0, 0.05, 0.1, 0.15, 0.2
  strategy: "trim-preceding" | "push-succeeding" | "smart-balance";
  minAllowedDuration?: number; // e.g. 0.35s
  maxVideoDuration?: number;
}

export interface ConflictResolutionResult {
  resolvedCues: SubtitleCue[];
  conflictsResolvedCount: number;
  gapAdjustmentsCount: number;
  details: string[];
}

/**
 * Automatically adjusts timing gaps between adjacent cues to ensure perfect continuity without overlapping,
 * based on user-defined minimum gap settings and resolution strategies.
 */
export function resolveAllSyncConflicts(
  cues: SubtitleCue[],
  options: ConflictResolutionOptions
): ConflictResolutionResult {
  if (!cues || cues.length <= 1) {
    return {
      resolvedCues: cues ? [...cues] : [],
      conflictsResolvedCount: 0,
      gapAdjustmentsCount: 0,
      details: ["אין מספיק כתוביות לבדיקת קונפליקטים"],
    };
  }

  const minGap = Math.max(0, options.minGapSeconds ?? 0.05);
  const strategy = options.strategy || "smart-balance";
  const minDuration = options.minAllowedDuration ?? 0.35;

  // Preserve original map order
  const sortedWithIndex = cues.map((cue, originalIndex) => ({
    cue: { ...cue },
    originalIndex,
  })).sort((a, b) => a.cue.startTime - b.cue.startTime);

  let conflictsResolvedCount = 0;
  let gapAdjustmentsCount = 0;
  const details: string[] = [];

  for (let i = 1; i < sortedWithIndex.length; i++) {
    const prev = sortedWithIndex[i - 1].cue;
    const curr = sortedWithIndex[i].cue;

    const currentGap = curr.startTime - prev.endTime;
    const isOverlap = curr.startTime < prev.endTime - 0.002;
    const isUnderMinGap = currentGap < minGap - 0.002;

    if (isOverlap || isUnderMinGap) {
      if (isOverlap) {
        conflictsResolvedCount++;
      } else {
        gapAdjustmentsCount++;
      }

      const prevOriginalEnd = prev.endTime;
      const currOriginalStart = curr.startTime;
      const currDuration = Math.max(minDuration, curr.endTime - curr.startTime);

      if (strategy === "trim-preceding") {
        // Trim preceding cue end time to allow minGap before curr.startTime
        const targetEnd = curr.startTime - minGap;
        if (targetEnd >= prev.startTime + minDuration) {
          prev.endTime = Number(targetEnd.toFixed(3));
          prev.isEdited = true;
        } else {
          // Preceding would become too short: cap prev at minDuration and push curr
          prev.endTime = Number((prev.startTime + minDuration).toFixed(3));
          prev.isEdited = true;
          curr.startTime = Number((prev.endTime + minGap).toFixed(3));
          curr.endTime = Number((curr.startTime + currDuration).toFixed(3));
          curr.isEdited = true;
        }
      } else if (strategy === "push-succeeding") {
        // Push succeeding cue start time forward to prev.endTime + minGap
        curr.startTime = Number((prev.endTime + minGap).toFixed(3));
        curr.endTime = Number((curr.startTime + currDuration).toFixed(3));
        curr.isEdited = true;
      } else {
        // smart-balance: Distribute the overlap/gap deficit evenly
        const requiredStart = prev.endTime + minGap;
        const deficit = requiredStart - curr.startTime;

        // Split deficit: half from prev.endTime, half pushed to curr.startTime
        const halfDeficit = deficit / 2;
        const potentialPrevEnd = prev.endTime - halfDeficit;

        if (potentialPrevEnd >= prev.startTime + minDuration) {
          prev.endTime = Number(potentialPrevEnd.toFixed(3));
          prev.isEdited = true;
          curr.startTime = Number((prev.endTime + minGap).toFixed(3));
          curr.endTime = Number((curr.startTime + currDuration).toFixed(3));
          curr.isEdited = true;
        } else {
          // Keep prev at minDuration and push curr by remaining amount
          prev.endTime = Number((prev.startTime + minDuration).toFixed(3));
          prev.isEdited = true;
          curr.startTime = Number((prev.endTime + minGap).toFixed(3));
          curr.endTime = Number((curr.startTime + currDuration).toFixed(3));
          curr.isEdited = true;
        }
      }

      details.push(
        `כתוביות #${sortedWithIndex[i - 1].originalIndex + 1} ו-#${sortedWithIndex[i].originalIndex + 1}: תוקנה חפיפה מ-${prevOriginalEnd.toFixed(2)}s / ${currOriginalStart.toFixed(2)}s לרווח של ${(curr.startTime - prev.endTime).toFixed(2)}s`
      );
    }
  }

  // Restore original ordering if desired, or return sorted
  // Generally, sorted by start time is the most accurate for subtitle workflows
  const resolvedCues = sortedWithIndex.map((item) => item.cue);

  return {
    resolvedCues,
    conflictsResolvedCount,
    gapAdjustmentsCount,
    details,
  };
}

/**
 * Automatically adjusts overlapping subtitle timings to maintain a clean sequence with no overlaps.
 */
export interface SubtitleCleanupIssue {
  id: string;
  cueId: string;
  cueIndex: number;
  type: "empty" | "suspicious-duration-short" | "suspicious-duration-long" | "text-overflow" | "invalid-timestamps";
  severity: "error" | "warning";
  message: string;
  details: string;
  suggestedFixAction: string;
}

export interface SubtitleCleanupReport {
  totalCues: number;
  issuesCount: number;
  emptyCount: number;
  suspiciousShortCount: number;
  suspiciousLongCount: number;
  overflowCount: number;
  invalidTimingCount: number;
  issues: SubtitleCleanupIssue[];
  fixedCues: SubtitleCue[];
}

/**
 * Subtitle Clean-up Wizard: Analyzes all current cues and flags common errors like:
 * - Empty text fields
 * - Text that exceeds safe display areas (when rendered)
 * - Cues that have suspicious duration values (< 300ms or > 15s)
 * - Invalid timestamps (endTime <= startTime)
 * Also provides a clean array of auto-trimmed/fixed cues for 'Fix All'.
 */
export function runSubtitleCleanupWizard(cues: SubtitleCue[]): SubtitleCleanupReport {
  if (!cues) {
    return {
      totalCues: 0,
      issuesCount: 0,
      emptyCount: 0,
      suspiciousShortCount: 0,
      suspiciousLongCount: 0,
      overflowCount: 0,
      invalidTimingCount: 0,
      issues: [],
      fixedCues: [],
    };
  }

  const issues: SubtitleCleanupIssue[] = [];
  let emptyCount = 0;
  let suspiciousShortCount = 0;
  let suspiciousLongCount = 0;
  let overflowCount = 0;
  let invalidTimingCount = 0;

  const fixedCues: SubtitleCue[] = [];

  cues.forEach((cue, index) => {
    const cueNum = index + 1;
    const duration = cue.endTime - cue.startTime;
    const heb = (cue.hebrewText || "").trim();
    const orig = (cue.originalText || "").trim();

    let isCueRemoved = false;
    let updatedCue = { ...cue };

    // 1. Check for empty text
    if (!heb && !orig) {
      emptyCount++;
      isCueRemoved = true;
      issues.push({
        id: `empty-${cue.id}`,
        cueId: cue.id,
        cueIndex: cueNum,
        type: "empty",
        severity: "error",
        message: `כתובית #${cueNum} ריקה מתוכן`,
        details: "גם טקסט המקור וגם הטקסט בעברית ריקים מתוכן.",
        suggestedFixAction: "מחיקת כתובית ריקה",
      });
    }

    // 2. Check invalid timing
    if (duration <= 0) {
      invalidTimingCount++;
      issues.push({
        id: `invalid-${cue.id}`,
        cueId: cue.id,
        cueIndex: cueNum,
        type: "invalid-timestamps",
        severity: "error",
        message: `כתובית #${cueNum}: זמן סיום שגוי או שווה למועד התחלה`,
        details: `משך נוכחי: ${duration.toFixed(2)} שניות (מועד התחלה ${cue.startTime}s, סיום ${cue.endTime}s).`,
        suggestedFixAction: "תיקון משך ל-1.5 שניות תקינות",
      });
      updatedCue.endTime = Number((updatedCue.startTime + 1.5).toFixed(3));
      updatedCue.isEdited = true;
    }
    // 3. Suspicious duration < 300ms (0.3s)
    else if (duration < 0.3) {
      suspiciousShortCount++;
      issues.push({
        id: `short-${cue.id}`,
        cueId: cue.id,
        cueIndex: cueNum,
        type: "suspicious-duration-short",
        severity: "warning",
        message: `כתובית #${cueNum}: משך תצוגה קצר מדי (פחות מ-300ms)`,
        details: `משך נוכחי: ${(duration * 1000).toFixed(0)}ms (${duration.toFixed(2)} שניות) - הטקסט ייעלם מהר מדי מהמסך.`,
        suggestedFixAction: "הרחבת משך התצוגה ל-1.2 שניות",
      });
      updatedCue.endTime = Number((updatedCue.startTime + 1.2).toFixed(3));
      updatedCue.isEdited = true;
    }
    // 4. Suspicious duration > 15.0s
    else if (duration > 15.0) {
      suspiciousLongCount++;
      issues.push({
        id: `long-${cue.id}`,
        cueId: cue.id,
        cueIndex: cueNum,
        type: "suspicious-duration-long",
        severity: "warning",
        message: `כתובית #${cueNum}: משך תצוגה ארוך מדי (מעל 15 שניות)`,
        details: `משך נוכחי: ${duration.toFixed(1)} שניות - חשד לכתובית שנגררת לאורך סצינה שלמה.`,
        suggestedFixAction: "קיצוץ משך תצוגה מקסימלי ל-8.0 שניות",
      });
      updatedCue.endTime = Number((updatedCue.startTime + 8.0).toFixed(3));
      updatedCue.isEdited = true;
    }

    // 5. Exceeds safe display area (overflow text)
    const lineBreakCount = (heb.match(/\n/g) || []).length;
    const isSingleLineTooLong = heb.length > 75 || orig.length > 85;
    const hasTooManyLines = lineBreakCount >= 3;

    if (isSingleLineTooLong || hasTooManyLines) {
      overflowCount++;
      issues.push({
        id: `overflow-${cue.id}`,
        cueId: cue.id,
        cueIndex: cueNum,
        type: "text-overflow",
        severity: "warning",
        message: `כתובית #${cueNum}: הטקסט חורג מגבולות התצוגה הבטוחים`,
        details: `אורך טקסט: ${heb.length} תווים, ${lineBreakCount + 1} שורות. חריגה מהמגבלה של 75 תווים / 2 שורות.`,
        suggestedFixAction: "פיצול אוטומטי לשורות מאוזנות וקיטום תווים חורגים",
      });

      // Auto-wrap/trim for fix
      if (heb.length > 75 && !heb.includes("\n")) {
        const words = heb.split(" ");
        const mid = Math.ceil(words.length / 2);
        updatedCue.hebrewText = words.slice(0, mid).join(" ") + "\n" + words.slice(mid).join(" ");
        updatedCue.isEdited = true;
      }
    }

    if (!isCueRemoved) {
      fixedCues.push(updatedCue);
    }
  });

  return {
    totalCues: cues.length,
    issuesCount: issues.length,
    emptyCount,
    suspiciousShortCount,
    suspiciousLongCount,
    overflowCount,
    invalidTimingCount,
    issues,
    fixedCues,
  };
}

export interface SubtitleDensityBucket {
  index: number;
  startTime: number;
  endTime: number;
  totalChars: number;
  cueCount: number;
  densityScore: number; // 0.0 (empty) to 1.0 (extreme clutter)
  isCluttered: boolean;
}

/**
 * Calculates a Subtitle Density Heatmap across the video timeline,
 * identifying cluttered scenes with high text volume or rapid subtitle cues.
 */
export function calculateSubtitleDensityHeatmap(
  cues: SubtitleCue[],
  totalDuration: number,
  numBuckets: number = 60
): SubtitleDensityBucket[] {
  if (!totalDuration || totalDuration <= 0) return [];
  const bucketWidth = totalDuration / Math.max(10, numBuckets);
  const buckets: SubtitleDensityBucket[] = [];

  for (let b = 0; b < numBuckets; b++) {
    const bStart = b * bucketWidth;
    const bEnd = (b + 1) * bucketWidth;

    let totalChars = 0;
    let cueCount = 0;

    cues.forEach((c) => {
      // Check overlap between cue and bucket
      if (c.startTime < bEnd && c.endTime > bStart) {
        cueCount++;
        const hebLen = (c.hebrewText || "").length;
        const origLen = (c.originalText || "").length;
        const charLen = Math.max(hebLen, origLen);
        totalChars += charLen;
      }
    });

    // Score calculation:
    // Standard comfortable density is ~25 chars per 3 seconds.
    // > 60 chars or > 2 cues in a bucket window indicates clutter.
    const expectedCharsMax = Math.max(30, bucketWidth * 18);
    let densityScore = Math.min(1.0, totalChars / expectedCharsMax);

    if (cueCount >= 3) {
      densityScore = Math.min(1.0, densityScore + 0.25);
    }

    buckets.push({
      index: b,
      startTime: bStart,
      endTime: bEnd,
      totalChars,
      cueCount,
      densityScore: Number(densityScore.toFixed(2)),
      isCluttered: densityScore > 0.65,
    });
  }

  return buckets;
}


