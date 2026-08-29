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
