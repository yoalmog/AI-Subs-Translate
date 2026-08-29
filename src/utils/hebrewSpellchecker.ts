/**
 * Real-time Hebrew Spellchecker and Correction Suggestions Engine
 */

export interface SpellcheckIssue {
  word: string;
  startIndex: number;
  endIndex: number;
  suggestions: string[];
  reason: string;
  type: "grammar" | "typo" | "final_letter" | "keyboard_layout" | "repeated_char";
}

// Common Hebrew words / spelling corrections dictionary
const COMMON_HEBREW_FIXES: Record<string, { suggestions: string[]; reason: string; type: SpellcheckIssue["type"] }> = {
  // Common grammatical / colloquial typos
  "יומולדת": { suggestions: ["יום הולדת", "יומולדת"], reason: "כתיב מומלץ: יום הולדת", type: "typo" },
  "ביגלל": { suggestions: ["בגלל"], reason: "כתיב חסר יוד: בגלל", type: "typo" },
  "ביכלל": { suggestions: ["בכלל"], reason: "כתיב תקני: בכלל", type: "typo" },
  "בישביל": { suggestions: ["בשביל"], reason: "כתיב תקני ללא יוד: בשביל", type: "typo" },
  "איפשר": { suggestions: ["אי אפשר", "אפשר"], reason: "הפרדת מילים: אי אפשר", type: "typo" },
  "במידהו": { suggestions: ["במידה ש-", "אם"], reason: "שימוש תקני: אם / במידה ש-", type: "grammar" },
  "בגללש": { suggestions: ["מפני ש-", "מכיוון ש-", "משום ש-"], reason: "עדיף 'מפני ש' או 'משום ש'", type: "grammar" },
  "אני יעשה": { suggestions: ["אני אעשה"], reason: "גוף ראשון עתיד מתחיל באות א': אעשה", type: "grammar" },
  "אני יבוא": { suggestions: ["אני אבוא"], reason: "גוף ראשון עתיד מתחיל באות א': אבוא", type: "grammar" },
  "אני ילך": { suggestions: ["אני אלך"], reason: "גוף ראשון עתיד מתחיל באות א': אלך", type: "grammar" },
  "אני יגיד": { suggestions: ["אני אגיד", "אומר"], reason: "גוף ראשון עתיד מתחיל באות א': אגיד", type: "grammar" },
  "אני יתן": { suggestions: ["אני אתן"], reason: "גוף ראשון עתיד מתחיל באות א': אתן", type: "grammar" },
  "אני יקח": { suggestions: ["אני אקח"], reason: "גוף ראשון עתיד מתחיל באות א': אקח", type: "grammar" },
  "אני יראה": { suggestions: ["אני אראה"], reason: "גוף ראשון עתיד מתחיל באות א': אראה", type: "grammar" },
  "אני ישמע": { suggestions: ["אני אשמע"], reason: "גוף ראשון עתיד מתחיל באות א': אשמע", type: "grammar" },
  "עשר שקל": { suggestions: ["עשרה שקלים"], reason: "זכר ונקבה במספרים: עשרה שקלים", type: "grammar" },
  "חמש שקל": { suggestions: ["חמישה שקלים"], reason: "זכר ונקבה במספרים: חמישה שקלים", type: "grammar" },
  "שתי שקל": { suggestions: ["שני שקלים"], reason: "זכר ונקבה במספרים: שני שקלים", type: "grammar" },
  "במידה ו": { suggestions: ["במידה ש-", "אם"], reason: "תקנית בעברית: 'במידה ש' או 'אם'", type: "grammar" },
  "לגמריי": { suggestions: ["לגמרי"], reason: "כתיב תקני: לגמרי (יוד אחת)", type: "typo" },
  "אחריי": { suggestions: ["אחרי"], reason: "כתיב תקני: אחרי (יוד אחת בסוף)", type: "typo" },
  "לפניי": { suggestions: ["לפני"], reason: "כתיב תקני: לפני", type: "typo" },
  "אוקיי": { suggestions: ["אוקיי", "בסדר", "טוב"], reason: "חלופות עבריות: בסדר / טוב", type: "typo" },
  "סבבה": { suggestions: ["מצוין", "בסדר גמור", "סבבה"], reason: "סלנג - מומלץ לתרגום רשמי", type: "grammar" },
  "ווליום": { suggestions: ["עוצמת שמע", "ווליום"], reason: "חלופה עברית: עוצמת שמע", type: "grammar" },
  "אפליקציה": { suggestions: ["יישומון", "אפליקציה"], reason: "חלופה עברית: יישומון", type: "grammar" },
};

// English QWERTY to Hebrew Keyboard mapping for accidentally typed words
const EN_TO_HE_MAP: Record<string, string> = {
  q: "/", w: "'", e: "ק", r: "ר", t: "א", y: "ט", u: "ו", i: "ן", o: "ם", p: "פ",
  a: "ש", s: "ד", d: "ג", f: "כ", g: "ע", h: "י", j: "ח", k: "ל", l: "ך",
  z: "ז", x: "ס", c: "ב", v: "ה", b: "נ", n: "מ", m: "צ",
};

/**
 * Convert accidentally typed English characters to Hebrew equivalent
 */
export function convertEnLayoutToHe(text: string): string {
  return text
    .split("")
    .map((char) => EN_TO_HE_MAP[char.toLowerCase()] || char)
    .join("");
}

/**
 * Check if a word ends with a regular letter that should be a final letter (ם, ן, ץ, ף, ך)
 */
function checkFinalLetterErrors(word: string): { suggestion: string; reason: string } | null {
  if (word.length <= 1) return null;

  const lastChar = word[word.length - 1];
  const prefix = word.substring(0, word.length - 1);

  const nonFinalToFinal: Record<string, string> = {
    מ: "ם",
    נ: "ן",
    צ: "ץ",
    פ: "ף",
    כ: "ך",
  };

  if (nonFinalToFinal[lastChar]) {
    return {
      suggestion: prefix + nonFinalToFinal[lastChar],
      reason: `אות סופית בסוף מילה: ${nonFinalToFinal[lastChar]} במקום ${lastChar}`,
    };
  }

  // Check if a final letter was placed in the middle of a word (e.g. "םילה" -> "מילה")
  const finalToNonFinal: Record<string, string> = {
    ם: "מ",
    ן: "נ",
    ץ: "צ",
    ף: "פ",
    ך: "כ",
  };

  for (let i = 0; i < word.length - 1; i++) {
    const ch = word[i];
    if (finalToNonFinal[ch]) {
      const fixed = word.substring(0, i) + finalToNonFinal[ch] + word.substring(i + 1);
      return {
        suggestion: fixed,
        reason: `אות אמצעית: ${finalToNonFinal[ch]} במקום אות סופית ${ch}`,
      };
    }
  }

  return null;
}

/**
 * Check for repeated identical characters (stutter / typo e.g. "שללום" -> "שלום")
 */
function checkRepeatedChars(word: string): string | null {
  const repeatedRegex = /([א-ת])\1{2,}/g; // 3 or more identical hebrew letters
  if (repeatedRegex.test(word)) {
    return word.replace(/([א-ת])\1+/g, "$1");
  }
  // 2 identical letters for letters that rarely duplicate at start or end
  const doubleStartRegex = /^([בגדהוזחטיכלמנסעפצקרשת])\1/g;
  if (doubleStartRegex.test(word) && word.length > 3) {
    return word.substring(1);
  }
  return null;
}

/**
 * Analyze a subtitle text string and return detected spelling/grammar issues with suggestions
 */
export function checkHebrewSpelling(text: string): SpellcheckIssue[] {
  if (!text || typeof text !== "string") return [];

  const issues: SpellcheckIssue[] = [];

  // Check 2-word phrase patterns first (e.g. "אני יעשה")
  for (const [phrase, fix] of Object.entries(COMMON_HEBREW_FIXES)) {
    if (phrase.includes(" ")) {
      const idx = text.indexOf(phrase);
      if (idx !== -1) {
        issues.push({
          word: phrase,
          startIndex: idx,
          endIndex: idx + phrase.length,
          suggestions: fix.suggestions,
          reason: fix.reason,
          type: fix.type,
        });
      }
    }
  }

  // Tokenize words with regex preserving positions
  const wordRegex = /[a-zA-Zא-ת'״]+/g;
  let match: RegExpExecArray | null;

  while ((match = wordRegex.exec(text)) !== null) {
    const rawWord = match[0];
    const startIndex = match.index;
    const endIndex = startIndex + rawWord.length;

    // Skip if already covered by multi-word phrase
    const alreadyCovered = issues.some(
      (iss) => startIndex >= iss.startIndex && endIndex <= iss.endIndex
    );
    if (alreadyCovered) continue;

    // Check English keyboard layout mistakenly typed (e.g. "akuo" -> "שלום")
    if (/^[a-zA-Z]{2,}$/.test(rawWord)) {
      const converted = convertEnLayoutToHe(rawWord);
      // If conversion produces Hebrew text
      if (/[\u0590-\u05FF]/.test(converted)) {
        issues.push({
          word: rawWord,
          startIndex,
          endIndex,
          suggestions: [converted],
          reason: "אותיות באנגלית - מקלדת לא הוחלפה לעברית",
          type: "keyboard_layout",
        });
        continue;
      }
    }

    // Check dictionary fixes for single words
    const cleanWord = rawWord.replace(/^[והבכלמש]/, ""); // Try stripping single prefix
    if (COMMON_HEBREW_FIXES[rawWord]) {
      const fix = COMMON_HEBREW_FIXES[rawWord];
      issues.push({
        word: rawWord,
        startIndex,
        endIndex,
        suggestions: fix.suggestions,
        reason: fix.reason,
        type: fix.type,
      });
      continue;
    } else if (cleanWord && COMMON_HEBREW_FIXES[cleanWord]) {
      const prefix = rawWord.substring(0, rawWord.length - cleanWord.length);
      const fix = COMMON_HEBREW_FIXES[cleanWord];
      issues.push({
        word: rawWord,
        startIndex,
        endIndex,
        suggestions: fix.suggestions.map((s) => prefix + s),
        reason: fix.reason,
        type: fix.type,
      });
      continue;
    }

    // Check final letter errors (e.g. מילה עם מ בסוף במקום ם)
    const finalLetterCheck = checkFinalLetterErrors(rawWord);
    if (finalLetterCheck) {
      issues.push({
        word: rawWord,
        startIndex,
        endIndex,
        suggestions: [finalLetterCheck.suggestion],
        reason: finalLetterCheck.reason,
        type: "final_letter",
      });
      continue;
    }

    // Check repeated character typos (e.g. "שללום" -> "שלום", "תוודה" -> "תודה")
    const repeatedCheck = checkRepeatedChars(rawWord);
    if (repeatedCheck && repeatedCheck !== rawWord) {
      issues.push({
        word: rawWord,
        startIndex,
        endIndex,
        suggestions: [repeatedCheck],
        reason: "אותיות כפולות שגויות",
        type: "repeated_char",
      });
      continue;
    }
  }

  return issues;
}
