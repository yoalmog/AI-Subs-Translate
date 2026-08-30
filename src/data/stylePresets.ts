import { SubtitleStylePreset, SubtitleStyleSettings } from "../types";

export const BUILT_IN_PRESETS: SubtitleStylePreset[] = [
  {
    id: "netflix-classic",
    name: "Netflix Style",
    nameHebrew: "סגנון נטפליקס",
    description: "גופן Assistant נקי עם רקע שחור חצי-שקוף וצללית עדינה, תואם תקן שידור נטפליקס",
    badge: "פופולרי",
    isBuiltIn: true,
    styles: {
      fontSize: 22,
      fontFamily: "Assistant",
      textColor: "#FFFFFF",
      strokeColor: "#000000",
      strokeWidth: 2,
      backgroundColor: "#000000",
      backgroundOpacity: 0.65,
      boxPadding: 8,
      borderRadius: 6,
      positionBottomPercent: 10,
      align: "center",
      bold: false,
      hideOriginalSubtitles: true,
      maskHeightPercent: 14,
      maskBottomPercent: 6,
      maskColor: "#000000",
      maskOpacity: 0.9,
      maskBlur: false,
    },
  },
  {
    id: "news-broadcast",
    name: "News Broadcast",
    nameHebrew: "סגנון חדשות ואולפן",
    description: "טקסט צהוב מודגש על רקע שחור מלא 100% עם פס כיסוי רחב להסתרת מבזקים קודמים",
    badge: "שידור חי",
    isBuiltIn: true,
    styles: {
      fontSize: 24,
      fontFamily: "Rubik",
      textColor: "#FBBF24",
      strokeColor: "#000000",
      strokeWidth: 3,
      backgroundColor: "#000000",
      backgroundOpacity: 1.0,
      boxPadding: 10,
      borderRadius: 4,
      positionBottomPercent: 8,
      align: "center",
      bold: true,
      hideOriginalSubtitles: true,
      maskHeightPercent: 18,
      maskBottomPercent: 4,
      maskColor: "#000000",
      maskOpacity: 1.0,
      maskBlur: false,
    },
  },
  {
    id: "tiktok-reels",
    name: "TikTok & Reels",
    nameHebrew: "סגנון טיקטוק ורילס",
    description: "טקסט לבן מודגש בגופן עגול, מסגרת שחורה עבה ללא תיבה קופסתית למראה דינמי",
    badge: "סושיאל",
    isBuiltIn: true,
    styles: {
      fontSize: 26,
      fontFamily: "Varela Round",
      textColor: "#FFFFFF",
      strokeColor: "#000000",
      strokeWidth: 4,
      backgroundColor: "#000000",
      backgroundOpacity: 0,
      boxPadding: 4,
      borderRadius: 8,
      positionBottomPercent: 14,
      align: "center",
      bold: true,
      hideOriginalSubtitles: true,
      maskHeightPercent: 12,
      maskBottomPercent: 8,
      maskColor: "#000000",
      maskOpacity: 0.85,
      maskBlur: false,
    },
  },
  {
    id: "cinema-gold",
    name: "Cinema Gold",
    nameHebrew: "זהב קולנועי",
    description: "גוון זהב קלאסי מעודן עם מסגרת כהה דקה למראה קולנועי יוקרתי",
    badge: "קולנוע",
    isBuiltIn: true,
    styles: {
      fontSize: 21,
      fontFamily: "Heebo",
      textColor: "#F59E0B",
      strokeColor: "#111111",
      strokeWidth: 2,
      backgroundColor: "#000000",
      backgroundOpacity: 0.4,
      boxPadding: 6,
      borderRadius: 4,
      positionBottomPercent: 11,
      align: "center",
      bold: true,
      hideOriginalSubtitles: true,
      maskHeightPercent: 12,
      maskBottomPercent: 7,
      maskColor: "#0F172A",
      maskOpacity: 0.9,
      maskBlur: false,
    },
  },
  {
    id: "minimalist-dark",
    name: "Minimalist Clean",
    nameHebrew: "מינימליסטי נקי",
    description: "טקסט לבן עדין עם הילה כהה בלבד, ללא קופסה אטומה להפרעה מינימלית",
    badge: "אלגנטי",
    isBuiltIn: true,
    styles: {
      fontSize: 20,
      fontFamily: "Heebo",
      textColor: "#F8FAFC",
      strokeColor: "#020617",
      strokeWidth: 2,
      backgroundColor: "#000000",
      backgroundOpacity: 0.15,
      boxPadding: 5,
      borderRadius: 4,
      positionBottomPercent: 9,
      align: "center",
      bold: false,
      hideOriginalSubtitles: false,
      maskHeightPercent: 10,
      maskBottomPercent: 5,
      maskColor: "#000000",
      maskOpacity: 0.7,
      maskBlur: false,
    },
  },
  {
    id: "high-contrast-accessibility",
    name: "High Contrast",
    nameHebrew: "ניגודיות גבוהה ומנגו",
    description: "גופן גדול ומודגש עם ניגודיות מרבית לקריאות מושלמת בכל תנאי תאורה",
    badge: "נגישות",
    isBuiltIn: true,
    styles: {
      fontSize: 25,
      fontFamily: "Rubik",
      textColor: "#FFFFFF",
      strokeColor: "#000000",
      strokeWidth: 3,
      backgroundColor: "#000000",
      backgroundOpacity: 0.95,
      boxPadding: 12,
      borderRadius: 8,
      positionBottomPercent: 12,
      align: "center",
      bold: true,
      hideOriginalSubtitles: true,
      maskHeightPercent: 16,
      maskBottomPercent: 6,
      maskColor: "#000000",
      maskOpacity: 1.0,
      maskBlur: false,
    },
  },
];

const CUSTOM_PRESETS_KEY = "subtranslate_custom_style_presets_v1";

export function getCustomPresets(): SubtitleStylePreset[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PRESETS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn("Failed to load custom presets:", err);
  }
  return [];
}

export function saveCustomPreset(name: string, styles: SubtitleStyleSettings): SubtitleStylePreset {
  const customPresets = getCustomPresets();
  const newPreset: SubtitleStylePreset = {
    id: `custom-${Date.now()}`,
    name: name,
    nameHebrew: name,
    description: `ערכה מותאמת אישית שנשמרה ב-${new Date().toLocaleDateString("he-IL")}`,
    badge: "אישי",
    isBuiltIn: false,
    styles: { ...styles },
  };

  const updated = [newPreset, ...customPresets];
  try {
    localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to save custom preset:", err);
  }
  return newPreset;
}

export function deleteCustomPreset(id: string): SubtitleStylePreset[] {
  const customPresets = getCustomPresets();
  const updated = customPresets.filter((p) => p.id !== id);
  try {
    localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to delete custom preset:", err);
  }
  return updated;
}
