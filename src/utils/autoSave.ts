import { SubtitleCue } from "../types";

export interface AutoSaveDraft {
  cues: SubtitleCue[];
  videoName: string;
  targetLanguageCode?: string;
  savedAt: string; // formatted time or ISO
  timestamp: number;
  cueCount: number;
}

const AUTOSAVE_STORAGE_KEY = "subtranslate_autosave_draft_v1";

/**
 * Save current cues draft to localStorage
 */
export function saveDraftToStorage(draft: {
  cues: SubtitleCue[];
  videoName: string;
  targetLanguageCode?: string;
}): boolean {
  try {
    if (!draft.cues || draft.cues.length === 0) return false;
    const data: AutoSaveDraft = {
      cues: draft.cues,
      videoName: draft.videoName || "Untitled Video",
      targetLanguageCode: draft.targetLanguageCode || "he",
      savedAt: new Date().toLocaleTimeString("he-IL", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      timestamp: Date.now(),
      cueCount: draft.cues.length,
    };
    localStorage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    console.warn("Failed to auto-save cues to localStorage:", err);
    return false;
  }
}

/**
 * Load draft from localStorage
 */
export function loadDraftFromStorage(): AutoSaveDraft | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_STORAGE_KEY);
    if (!raw) return null;
    const parsed: AutoSaveDraft = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.cues) && parsed.cues.length > 0) {
      return parsed;
    }
    return null;
  } catch (err) {
    console.warn("Failed to load auto-saved cues from localStorage:", err);
    return null;
  }
}

/**
 * Clear auto-save draft from localStorage
 */
export function clearDraftFromStorage(): void {
  try {
    localStorage.removeItem(AUTOSAVE_STORAGE_KEY);
  } catch (err) {
    console.warn("Failed to clear auto-save draft:", err);
  }
}
