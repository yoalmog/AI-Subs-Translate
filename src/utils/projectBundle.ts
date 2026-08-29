import {
  SubtitleCue,
  SubtitleStyleSettings,
  SubtitleProjectBundle,
  TargetLanguageInfo,
  TonePreference,
} from "../types";
import { downloadFile } from "./timeFormat";

/**
 * Default fallback style settings in case some fields are missing in an imported JSON
 */
export const DEFAULT_STYLE_FALLBACK: SubtitleStyleSettings = {
  fontSize: 26,
  fontFamily: "Heebo",
  textColor: "#FFFFFF",
  strokeColor: "#000000",
  strokeWidth: 2,
  backgroundColor: "#000000",
  backgroundOpacity: 0.6,
  boxPadding: 8,
  borderRadius: 8,
  positionBottomPercent: 8,
  align: "center",
  bold: true,
  hideOriginalSubtitles: true,
  maskHeightPercent: 13,
  maskBottomPercent: 5,
  maskColor: "#000000",
  maskOpacity: 0.95,
  maskBlur: false,
};

/**
 * Builds a standardized, complete Project Bundle object containing all workspace state
 */
export function buildProjectBundle(params: {
  videoName: string;
  videoDuration: number;
  videoUrl?: string | null;
  videoWidth?: number;
  videoHeight?: number;
  videoAspectRatio?: number;
  targetLanguage: TargetLanguageInfo;
  styleSettings: SubtitleStyleSettings;
  cues: SubtitleCue[];
  tonePreference?: TonePreference;
  notes?: string;
}): SubtitleProjectBundle {
  const sanitizedProjectName =
    params.videoName.replace(/\.[^/.]+$/, "").trim() || "subtitle_project";

  const sortedCues = [...params.cues].sort((a, b) => a.startTime - b.startTime);

  return {
    version: "1.0.0",
    projectType: "subtranslate-ai-project",
    exportedAt: new Date().toISOString(),
    projectName: sanitizedProjectName,
    videoReference: {
      name: params.videoName,
      duration: parseFloat((params.videoDuration || 0).toFixed(2)),
      url: params.videoUrl?.startsWith("blob:") ? undefined : params.videoUrl || undefined,
      width: params.videoWidth,
      height: params.videoHeight,
      aspectRatio: params.videoAspectRatio,
    },
    targetLanguage: {
      code: params.targetLanguage.code,
      name: params.targetLanguage.name,
      nativeName: params.targetLanguage.nativeName,
      flag: params.targetLanguage.flag,
    },
    styleSettings: {
      ...DEFAULT_STYLE_FALLBACK,
      ...params.styleSettings,
    },
    cues: sortedCues,
    totalCues: sortedCues.length,
    metadata: {
      appVersion: "1.0.0",
      tonePreference: params.tonePreference || "informal",
      lastSavedTimestamp: Date.now(),
      notes: params.notes,
    },
  };
}

/**
 * Exports and downloads the SubtitleProjectBundle as a pretty-printed .json file
 */
export async function exportProjectAsJsonFile(
  bundle: SubtitleProjectBundle,
  customFilename?: string
): Promise<void> {
  const jsonContent = JSON.stringify(bundle, null, 2);
  const baseName =
    customFilename || `${bundle.projectName || "project"}_subtitle_project.json`;
  const sanitizedFilename = baseName.endsWith(".json") ? baseName : `${baseName}.json`;

  await downloadFile(jsonContent, sanitizedFilename, "application/json;charset=utf-8");
}

/**
 * Parses and validates an uploaded or stringified JSON project bundle
 */
export function parseProjectBundle(rawInput: unknown): {
  success: boolean;
  project?: SubtitleProjectBundle;
  error?: string;
} {
  try {
    let data: any = rawInput;
    if (typeof rawInput === "string") {
      data = JSON.parse(rawInput);
    }

    if (!data || typeof data !== "object") {
      return { success: false, error: "קובץ הפרויקט אינו בפורמט JSON תקין." };
    }

    // Check if it is a list of cues directly (legacy JSON transcript format)
    if (Array.isArray(data)) {
      const cues: SubtitleCue[] = data.map((item, idx) => ({
        id: item.id || `cue-imported-${idx}-${Date.now()}`,
        startTime: typeof item.startTime === "number" ? item.startTime : 0,
        endTime: typeof item.endTime === "number" ? item.endTime : 3,
        originalText: item.originalText || item.text || "",
        hebrewText: item.hebrewText || item.translatedText || item.text || "",
        detectedLanguage: item.detectedLanguage || "Hebrew",
        position: item.position,
        confidence: item.confidence,
        isEdited: true,
      }));

      const fallbackBundle = buildProjectBundle({
        videoName: "imported_subtitles",
        videoDuration: cues.length > 0 ? cues[cues.length - 1].endTime : 10,
        targetLanguage: {
          code: "he",
          name: "Hebrew",
          nativeName: "עברית",
          flag: "🇮🇱",
        },
        styleSettings: DEFAULT_STYLE_FALLBACK,
        cues,
      });

      return { success: true, project: fallbackBundle };
    }

    // Validate standard project bundle
    const cuesArray: SubtitleCue[] = Array.isArray(data.cues)
      ? data.cues.map((item: any, idx: number) => ({
          id: String(item.id || `cue-proj-${idx}-${Date.now()}`),
          startTime: typeof item.startTime === "number" ? item.startTime : parseFloat(item.startTime) || 0,
          endTime: typeof item.endTime === "number" ? item.endTime : parseFloat(item.endTime) || 3,
          originalText: String(item.originalText || ""),
          hebrewText: String(item.hebrewText || item.translatedText || ""),
          detectedLanguage: item.detectedLanguage ? String(item.detectedLanguage) : undefined,
          position: item.position,
          confidence: item.confidence,
          isEdited: Boolean(item.isEdited),
        }))
      : [];

    const videoRef = data.videoReference || {};
    const targetLang = data.targetLanguage || {
      code: "he",
      name: "Hebrew",
      nativeName: "עברית",
      flag: "🇮🇱",
    };

    const styleSettings: SubtitleStyleSettings = {
      ...DEFAULT_STYLE_FALLBACK,
      ...(data.styleSettings || {}),
    };

    const parsedBundle: SubtitleProjectBundle = {
      version: data.version || "1.0.0",
      projectType: "subtranslate-ai-project",
      exportedAt: data.exportedAt || new Date().toISOString(),
      projectName: data.projectName || videoRef.name || "פרויקט כתוביות",
      videoReference: {
        name: videoRef.name || "וידאו ללא שם",
        duration: typeof videoRef.duration === "number" ? videoRef.duration : 10,
        url: videoRef.url,
        width: videoRef.width,
        height: videoRef.height,
        aspectRatio: videoRef.aspectRatio,
      },
      targetLanguage: {
        code: targetLang.code || "he",
        name: targetLang.name || "Hebrew",
        nativeName: targetLang.nativeName || "עברית",
        flag: targetLang.flag || "🇮🇱",
      },
      styleSettings,
      cues: cuesArray,
      totalCues: cuesArray.length,
      metadata: {
        appVersion: data.metadata?.appVersion || "1.0.0",
        tonePreference: data.metadata?.tonePreference || "informal",
        lastSavedTimestamp: data.metadata?.lastSavedTimestamp || Date.now(),
        notes: data.metadata?.notes,
      },
    };

    return { success: true, project: parsedBundle };
  } catch (err: any) {
    return {
      success: false,
      error: `שגיאה בפענוח קובץ הפרויקט: ${err.message || "קובץ שגוי"}`,
    };
  }
}

/**
 * Reads a File object and returns parsed SubtitleProjectBundle
 */
export function readProjectBundleFromFile(file: File): Promise<{
  success: boolean;
  project?: SubtitleProjectBundle;
  error?: string;
}> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const result = parseProjectBundle(content);
      resolve(result);
    };
    reader.onerror = () => {
      resolve({ success: false, error: "נכשלה קריאת קובץ הפרויקט מהמכשיר." });
    };
    reader.readAsText(file, "UTF-8");
  });
}
