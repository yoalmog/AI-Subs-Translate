import { SubtitleCue } from "../types";

/**
 * Auto-formats and cleans up a single subtitle string using regex-based cleanup passes:
 * - Trims redundant spaces and tabs
 * - Fixes whitespace around punctuation (no space before commas/periods/question marks, exactly one space after)
 * - Normalizes quotes, dashes, ellipses, and parentheses
 * - Fixes capitalization for Latin script sentences
 * - Removes orphan punctuation marks
 */
export function autoFormatSubtitleText(text: string, isRtl: boolean = false): string {
  if (!text || typeof text !== "string") return "";

  let cleaned = text;

  // 1. Normalize line breaks and multiple spaces
  cleaned = cleaned.replace(/\r\n/g, "\n");
  cleaned = cleaned.replace(/[ \t]+/g, " ");

  // 2. Remove space before common punctuation: , . ! ? : ; % ) ] }
  cleaned = cleaned.replace(/\s+([,.:;!?%)}\]])/g, "$1");

  // 3. Ensure single space after punctuation when followed by a word character
  // E.g., "שלום,עולם" -> "שלום, עולם", "Hello,world" -> "Hello, world"
  cleaned = cleaned.replace(/([,.:;!?])([a-zA-Z\u0590-\u05FF0-9])/g, "$1 $2");

  // 4. Fix space inside opening brackets: ( text ) -> (text), [ text ] -> [text]
  cleaned = cleaned.replace(/([({\[])\s+/g, "$1");
  cleaned = cleaned.replace(/\s+([)}\]])/g, "$1");

  // 5. Normalize ellipsis: 2 or 4+ dots -> standard 3 dots (...)
  cleaned = cleaned.replace(/\.{2,}/g, "...");

  // 6. Fix space after ellipsis if followed by a letter
  cleaned = cleaned.replace(/\.\.\.([a-zA-Z\u0590-\u05FF])/g, "... $1");

  // 7. Normalize multiple exclamation or question marks e.g. "???" -> "?" or "!!!" -> "!" if desired, or keep max 1
  cleaned = cleaned.replace(/!{2,}/g, "!");
  cleaned = cleaned.replace(/\?{2,}/g, "?");

  // 8. Trim spaces around hyphens and dashes when used as punctuation ( - ) -> -
  cleaned = cleaned.replace(/\s*—\s*/g, " — ");
  cleaned = cleaned.replace(/\s*–\s*/g, " – ");

  // 9. Capitalize first letter of Latin sentences if not RTL
  if (!isRtl && /^[a-z]/.test(cleaned)) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  // 10. Capitalize Latin letters after period + space (e.g., ". hello" -> ". Hello")
  if (!isRtl) {
    cleaned = cleaned.replace(/(\.\s+)([a-z])/g, (_, p1, p2) => p1 + p2.toUpperCase());
  }

  // 11. Final clean trim
  return cleaned.trim();
}

/**
 * Calculates CPS (Characters Per Second) for a cue
 */
export function calculateCueCps(cue: SubtitleCue): number {
  const text = (cue.hebrewText || cue.originalText || "").trim();
  const charCount = text.length;
  const duration = Math.max(0.1, cue.endTime - cue.startTime);
  return parseFloat((charCount / duration).toFixed(1));
}

/**
 * Auto-optimizes subtitle cues with high CPS (> 16 CPS) or long text.
 * 1. Adjusts timing: extends endTime into trailing gaps or advances startTime into leading gaps.
 * 2. Splits cues that remain too long or fast into two sequential, comfortably timed cues.
 */
export function optimizeSubtitleCpsAndTiming(
  cues: SubtitleCue[],
  maxTargetCps: number = 15,
  videoDuration?: number
): {
  optimizedCues: SubtitleCue[];
  modifiedCount: number;
  splitCount: number;
} {
  if (!cues || cues.length === 0) {
    return { optimizedCues: [], modifiedCount: 0, splitCount: 0 };
  }

  // Sort cues chronologically first
  const sorted = [...cues].sort((a, b) => a.startTime - b.startTime);
  let modifiedCount = 0;
  let splitCount = 0;

  const result: SubtitleCue[] = [];

  for (let i = 0; i < sorted.length; i++) {
    let cue = { ...sorted[i] };
    const prevCue = result.length > 0 ? result[result.length - 1] : null;
    const nextCue = i < sorted.length - 1 ? sorted[i + 1] : null;

    const text = (cue.hebrewText || cue.originalText || "").trim();
    let charCount = text.length;
    let duration = Math.max(0.1, cue.endTime - cue.startTime);
    let cps = charCount / duration;

    let wasModified = false;

    // Phase 1: Try extending duration into available gaps
    if (cps > maxTargetCps && charCount > 0) {
      const idealDuration = charCount / maxTargetCps;
      const neededExtraDuration = idealDuration - duration;

      // Available gap ahead before next cue
      const nextStartTime = nextCue ? nextCue.startTime : (videoDuration || cue.endTime + 10);
      const gapAfter = Math.max(0, nextStartTime - cue.endTime - 0.08);

      // Available gap behind after previous cue
      const prevEndTime = prevCue ? prevCue.endTime : 0;
      const gapBefore = Math.max(0, cue.startTime - prevEndTime - 0.08);

      if (gapAfter > 0 || gapBefore > 0) {
        // Extend endTime into gapAfter
        const extendEnd = Math.min(gapAfter, neededExtraDuration);
        if (extendEnd > 0) {
          cue.endTime = parseFloat((cue.endTime + extendEnd).toFixed(2));
          wasModified = true;
        }

        // Re-evaluate CPS
        duration = cue.endTime - cue.startTime;
        cps = charCount / duration;

        // If still fast, shift startTime earlier into gapBefore
        if (cps > maxTargetCps && gapBefore > 0) {
          const shiftStart = Math.min(gapBefore, (charCount / maxTargetCps) - duration);
          if (shiftStart > 0) {
            cue.startTime = parseFloat((cue.startTime - shiftStart).toFixed(2));
            wasModified = true;
          }
        }
      }
    }

    // Re-evaluate CPS after timing extension
    duration = Math.max(0.1, cue.endTime - cue.startTime);
    cps = charCount / duration;

    // Phase 2: If CPS is still high (> 18) OR text is long (> 40 chars) and contains natural split points, split into 2 cues
    if ((cps > 17 || charCount > 40) && text.length > 15) {
      // Find optimal split index (near middle, preferentially at punctuation or space)
      const mid = Math.floor(text.length / 2);
      let splitIdx = -1;

      for (let offset = 0; offset < Math.floor(text.length / 2) - 2; offset++) {
        const left = mid - offset;
        const right = mid + offset;

        if (left > 3 && /[,.:;!?\s—–-]/.test(text[left])) {
          splitIdx = left;
          break;
        }
        if (right < text.length - 3 && /[,.:;!?\s—–-]/.test(text[right])) {
          splitIdx = right;
          break;
        }
      }

      if (splitIdx > 3 && splitIdx < text.length - 3) {
        const part1Text = text.slice(0, splitIdx + 1).trim();
        const part2Text = text.slice(splitIdx + 1).trim();

        if (part1Text.length > 2 && part2Text.length > 2) {
          const ratio = part1Text.length / text.length;
          const totalDur = cue.endTime - cue.startTime;

          const cue1End = parseFloat((cue.startTime + totalDur * ratio - 0.04).toFixed(2));
          const cue2Start = parseFloat((cue1End + 0.08).toFixed(2));

          const cue1: SubtitleCue = {
            ...cue,
            id: `${cue.id}-opt1`,
            endTime: cue1End,
            hebrewText: part1Text,
            originalText: part1Text,
            isEdited: true,
          };

          const cue2: SubtitleCue = {
            ...cue,
            id: `${cue.id}-opt2`,
            startTime: cue2Start,
            hebrewText: part2Text,
            originalText: part2Text,
            isEdited: true,
          };

          result.push(cue1);
          result.push(cue2);
          splitCount++;
          modifiedCount++;
          continue;
        }
      }
    }

    if (wasModified) {
      cue.isEdited = true;
      modifiedCount++;
    }

    result.push(cue);
  }

  return {
    optimizedCues: result,
    modifiedCount,
    splitCount,
  };
}

/**
 * Runs a complete Auto-Format pass over an entire array of subtitle cues
 */
export function autoFormatAllCues(cues: SubtitleCue[], isRtl: boolean = true): {
  formattedCues: SubtitleCue[];
  modifiedCount: number;
} {
  let modifiedCount = 0;

  const formattedCues = cues.map((cue) => {
    const formattedHebrew = autoFormatSubtitleText(cue.hebrewText, isRtl);
    const formattedOriginal = autoFormatSubtitleText(cue.originalText, false);

    const isChanged =
      formattedHebrew !== cue.hebrewText || formattedOriginal !== cue.originalText;

    if (isChanged) {
      modifiedCount++;
      return {
        ...cue,
        hebrewText: formattedHebrew,
        originalText: formattedOriginal,
        isEdited: true,
      };
    }

    return cue;
  });

  return {
    formattedCues,
    modifiedCount,
  };
}
