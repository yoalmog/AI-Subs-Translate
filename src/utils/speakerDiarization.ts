import { SubtitleCue } from "../types";

export const SPEAKER_COLORS = [
  "#3b82f6", // Blue
  "#ec4899", // Pink
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#8b5cf6", // Purple
  "#06b6d4", // Cyan
  "#f97316", // Orange
  "#e11d48", // Rose
];

export function getSpeakerColor(speakerName?: string, speakerMap: Record<string, string> = {}): string {
  if (!speakerName) return "#3b82f6";
  if (speakerMap[speakerName]) return speakerMap[speakerName];

  // Derive color deterministically
  let hash = 0;
  for (let i = 0; i < speakerName.length; i++) {
    hash = speakerName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % SPEAKER_COLORS.length;
  return SPEAKER_COLORS[index];
}

/**
 * Ensures all cues with speaker names have corresponding speakerColors assigned.
 */
export function syncSpeakerColors(cues: SubtitleCue[]): SubtitleCue[] {
  const speakerMap: Record<string, string> = {};
  let colorIdx = 0;

  // First pass: register colors
  cues.forEach((cue) => {
    if (cue.speaker && !speakerMap[cue.speaker]) {
      if (cue.speakerColor) {
        speakerMap[cue.speaker] = cue.speakerColor;
      } else {
        speakerMap[cue.speaker] = SPEAKER_COLORS[colorIdx % SPEAKER_COLORS.length];
        colorIdx++;
      }
    }
  });

  return cues.map((cue) => {
    if (!cue.speaker) return cue;
    return {
      ...cue,
      speakerColor: cue.speakerColor || speakerMap[cue.speaker] || SPEAKER_COLORS[0],
    };
  });
}

/**
 * Intelligent client-side speaker diarization based on text cues, dialog markers (-), and pauses.
 */
export function autoDiarizeCuesClientSide(cues: SubtitleCue[]): {
  diarizedCues: SubtitleCue[];
  speakersFound: string[];
} {
  if (!cues || cues.length === 0) return { diarizedCues: [], speakersFound: [] };

  const sorted = [...cues].sort((a, b) => a.startTime - b.startTime);
  const speakersSet = new Set<string>();

  let currentSpeaker = "דובר 1";
  let speakerCount = 1;

  const result: SubtitleCue[] = sorted.map((cue, idx) => {
    const text = cue.hebrewText || cue.originalText;

    // Check if text already starts with a speaker name (e.g. "אלון: שלום", "דובר 2:", "[John]:")
    const matchPrefix = text.match(/^([A-Za-z0-9\u0590-\u05FF\s]{2,15})[::\-]\s*(.+)/);
    let explicitSpeaker: string | null = null;
    let cleanText = text;

    if (matchPrefix && !text.startsWith("http")) {
      explicitSpeaker = matchPrefix[1].trim();
      cleanText = matchPrefix[2].trim();
    } else if (text.startsWith("- ")) {
      // Dialog dash "-" often indicates speaker change
      if (idx > 0) {
        currentSpeaker = currentSpeaker === "דובר 1" ? "דובר 2" : "דובר 1";
      }
      cleanText = text.replace(/^-\s*/, "").trim();
    } else if (idx > 0) {
      const prevCue = sorted[idx - 1];
      const prevText = prevCue.hebrewText || prevCue.originalText;
      const gap = cue.startTime - prevCue.endTime;

      // Question mark at end of prev cue often indicates turn change
      const isPrevQuestion = prevText.endsWith("?") || prevText.endsWith("?");
      if (isPrevQuestion || gap > 1.8) {
        currentSpeaker = currentSpeaker === "דובר 1" ? "דובר 2" : "דובר 1";
      }
    }

    const assignedSpeaker = explicitSpeaker || currentSpeaker;
    speakersSet.add(assignedSpeaker);

    return {
      ...cue,
      hebrewText: cleanText,
      speaker: assignedSpeaker,
      isEdited: true,
    };
  });

  const finalCues = syncSpeakerColors(result);

  return {
    diarizedCues: finalCues,
    speakersFound: Array.from(speakersSet),
  };
}
