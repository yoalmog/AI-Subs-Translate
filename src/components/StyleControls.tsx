import React, { useState, useEffect } from "react";
import {
  Sliders,
  Type,
  EyeOff,
  Layers,
  Palette,
  RotateCcw,
  Sparkles,
  Check,
  Bookmark,
  Plus,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { SubtitleStyleSettings, SubtitleStylePreset } from "../types";
import {
  BUILT_IN_PRESETS,
  getCustomPresets,
  saveCustomPreset,
  deleteCustomPreset,
} from "../data/stylePresets";

interface StyleControlsProps {
  styles: SubtitleStyleSettings;
  onChange: (newStyles: SubtitleStyleSettings) => void;
  onReset: () => void;
}

export const StyleControls: React.FC<StyleControlsProps> = ({
  styles,
  onChange,
  onReset,
}) => {
  const [customPresets, setCustomPresets] = useState<SubtitleStylePreset[]>([]);
  const [activePresetId, setActivePresetId] = useState<string | null>("netflix-classic");
  const [isSavingPreset, setIsSavingPreset] = useState<boolean>(false);
  const [newPresetName, setNewPresetName] = useState<string>("");
  const [presetSavedNotice, setPresetSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    setCustomPresets(getCustomPresets());
  }, []);

  const allPresets = [...BUILT_IN_PRESETS, ...customPresets];

  const handleSelectPreset = (preset: SubtitleStylePreset) => {
    setActivePresetId(preset.id);
    onChange({ ...preset.styles });
  };

  const handleSaveCustomPresetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;

    const created = saveCustomPreset(newPresetName.trim(), styles);
    setCustomPresets(getCustomPresets());
    setActivePresetId(created.id);
    setNewPresetName("");
    setIsSavingPreset(false);
    setPresetSavedNotice(`ערכת העיצוב "${created.name}" נשמרה בהצלחה!`);
    setTimeout(() => setPresetSavedNotice(null), 3000);
  };

  const handleDeleteCustomPreset = (id: string, name: string) => {
    const updated = deleteCustomPreset(id);
    setCustomPresets(updated);
    if (activePresetId === id) {
      setActivePresetId("netflix-classic");
    }
    setPresetSavedNotice(`ערכת העיצוב "${name}" הוסרה.`);
    setTimeout(() => setPresetSavedNotice(null), 3000);
  };

  const colorPresets = [
    { label: "לבן", value: "#FFFFFF" },
    { label: "צהוב", value: "#FBBF24" },
    { label: "זהב", value: "#F59E0B" },
    { label: "תכלת", value: "#38BDF8" },
    { label: "ירוק בהיר", value: "#4ADE80" },
  ];

  const maskColorPresets = [
    { label: "שחור", value: "#000000" },
    { label: "אפור כהה", value: "#0F172A" },
    { label: "שחור פחם", value: "#18181B" },
  ];

  return (
    <div className="bg-[#141414] border border-[#222222] rounded-xl p-4 lg:p-5 flex flex-col gap-5 shadow-xl" id="style-controls-panel">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#222222]">
        <div className="flex items-center gap-2">
          <Sliders className="w-5 h-5 text-blue-400" />
          <h2 className="text-base font-bold text-white font-rubik">
            עיצוב כתוביות והסתרת מקור
          </h2>
        </div>
        <button
          onClick={onReset}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-white px-2.5 py-1 rounded-md bg-[#1a1a1a] hover:bg-[#262626] border border-[#333333] transition cursor-pointer"
          title="איפוס להגדרות ברירת מחדל"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>איפוס</span>
        </button>
      </div>

      {/* SECTION 0: Style Presets Manager (ערכות עיצוב מוכנות) */}
      <div className="bg-[#111111] border border-[#262626] rounded-lg p-3.5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-bold text-gray-200">
              ערכות עיצוב מוכנות (Presets System)
            </span>
          </div>
          <button
            onClick={() => setIsSavingPreset(!isSavingPreset)}
            className="flex items-center gap-1 text-xs text-purple-300 hover:text-white px-2.5 py-1 rounded bg-purple-600/20 border border-purple-500/30 hover:bg-purple-600/30 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>שמור ערכה מותאמת אישית</span>
          </button>
        </div>

        {presetSavedNotice && (
          <div className="bg-purple-950/70 border border-purple-500/40 text-purple-200 text-xs px-3 py-1.5 rounded-md flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
            <span>{presetSavedNotice}</span>
          </div>
        )}

        {/* Form to save new custom preset */}
        {isSavingPreset && (
          <form onSubmit={handleSaveCustomPresetSubmit} className="flex items-center gap-2 bg-[#181818] p-2 rounded-lg border border-[#333333] animate-in fade-in duration-200">
            <input
              type="text"
              placeholder="שם ערכת העיצוב החדשה (לדוגמה: הסגנון שלי ליוטיוב)"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              className="flex-1 bg-[#111111] border border-[#333333] text-white text-xs px-3 py-1.5 rounded focus:outline-none focus:border-purple-500"
              autoFocus
            />
            <button
              type="submit"
              disabled={!newPresetName.trim()}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold rounded transition cursor-pointer"
            >
              שמור
            </button>
            <button
              type="button"
              onClick={() => setIsSavingPreset(false)}
              className="px-2.5 py-1.5 text-gray-400 hover:text-white text-xs"
            >
              ביטול
            </button>
          </form>
        )}

        {/* Presets Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
          {allPresets.map((preset) => {
            const isActive = activePresetId === preset.id;
            return (
              <div
                key={preset.id}
                onClick={() => handleSelectPreset(preset)}
                className={`relative p-2.5 rounded-lg border text-right transition cursor-pointer flex flex-col justify-between gap-1.5 ${
                  isActive
                    ? "bg-purple-950/30 border-purple-500 shadow-md ring-1 ring-purple-500/40"
                    : "bg-[#161616] border-[#292929] hover:bg-[#1f1f1f] hover:border-[#383838]"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold text-white truncate">{preset.nameHebrew}</span>
                  {preset.badge && (
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold shrink-0 ${
                      preset.isBuiltIn ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    }`}>
                      {preset.badge}
                    </span>
                  )}
                </div>

                <p className="text-[10px] text-gray-400 line-clamp-2 leading-tight">
                  {preset.description}
                </p>

                <div className="flex items-center justify-between pt-1 border-t border-[#222222] mt-0.5">
                  <div className="flex items-center gap-1 text-[10px] text-gray-300">
                    <span className="w-2.5 h-2.5 rounded-full border border-gray-600" style={{ backgroundColor: preset.styles.textColor }}></span>
                    <span>{preset.styles.fontFamily}</span>
                  </div>

                  {!preset.isBuiltIn && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCustomPreset(preset.id, preset.nameHebrew);
                      }}
                      className="text-gray-500 hover:text-red-400 p-0.5 rounded transition"
                      title="מחק ערכה מותאמת אישית"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 1: Hardcoded Subtitle Cover-up Mask (הסתרת כתוביות מקוריות) */}
      <div className="bg-[#111111] border border-[#262626] rounded-lg p-3.5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <EyeOff className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold text-gray-200">
              הסתרת כתוביות מוטמעות מקוריות (Mask)
            </span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={styles.hideOriginalSubtitles}
              onChange={(e) =>
                onChange({ ...styles, hideOriginalSubtitles: e.target.checked })
              }
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-[#262626] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <p className="text-[11px] text-gray-400 leading-normal">
          יוצר פס כיסוי חלק בחלק התחתון של הסרטון כדי להסתיר לחלוטין את הכיתוב הזר המוטמע.
        </p>

        {styles.hideOriginalSubtitles && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-[#222222]">
            {/* Mask Height */}
            <div>
              <div className="flex items-center justify-between text-xs text-gray-300 mb-1">
                <span>גובה פס הכיסוי:</span>
                <span className="font-mono text-blue-400 font-bold">{styles.maskHeightPercent}%</span>
              </div>
              <input
                type="range"
                min="6"
                max="25"
                step="1"
                value={styles.maskHeightPercent}
                onChange={(e) =>
                  onChange({ ...styles, maskHeightPercent: parseInt(e.target.value) })
                }
                className="w-full h-1.5 bg-[#222222] rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Mask Bottom Position */}
            <div>
              <div className="flex items-center justify-between text-xs text-gray-300 mb-1">
                <span>מרחק מתחתית הסרטון:</span>
                <span className="font-mono text-blue-400 font-bold">{styles.maskBottomPercent}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                step="1"
                value={styles.maskBottomPercent}
                onChange={(e) =>
                  onChange({ ...styles, maskBottomPercent: parseInt(e.target.value) })
                }
                className="w-full h-1.5 bg-[#222222] rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Mask Opacity */}
            <div>
              <div className="flex items-center justify-between text-xs text-gray-300 mb-1">
                <span>אטימות הפס:</span>
                <span className="font-mono text-blue-400 font-bold">{Math.round(styles.maskOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.3"
                max="1.0"
                step="0.05"
                value={styles.maskOpacity}
                onChange={(e) =>
                  onChange({ ...styles, maskOpacity: parseFloat(e.target.value) })
                }
                className="w-full h-1.5 bg-[#222222] rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Mask Color Presets */}
            <div>
              <span className="text-xs text-gray-300 block mb-1">צבע פס כיסוי:</span>
              <div className="flex items-center gap-1.5">
                {maskColorPresets.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => onChange({ ...styles, maskColor: m.value })}
                    className={`px-2 py-1 rounded text-[11px] border transition flex items-center gap-1 cursor-pointer ${
                      styles.maskColor === m.value
                        ? "bg-blue-600/30 border-blue-500 text-white font-bold"
                        : "bg-[#1a1a1a] border-[#333333] text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-[#444444]"
                      style={{ backgroundColor: m.value }}
                    />
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: Hebrew Subtitle Typography & Colors */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-xs font-bold text-gray-200">
          <Type className="w-4 h-4 text-blue-400" />
          <span>עיצוב גופן וטקסט בעברית</span>
        </div>

        {/* Font Family Selector */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { id: "Heebo", label: "Heebo (מודרני)" },
            { id: "Rubik", label: "Rubik (עגול)" },
            { id: "Assistant", label: "Assistant (נקי)" },
            { id: "Varela Round", label: "Varela Round" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => onChange({ ...styles, fontFamily: f.id as any })}
              className={`p-2 rounded-lg text-xs font-medium border text-center transition cursor-pointer ${
                styles.fontFamily === f.id
                  ? "bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/20"
                  : "bg-[#111111] border-[#262626] text-gray-300 hover:border-gray-600"
              }`}
            >
              <div className="font-bold text-sm mb-0.5">אבגדה</div>
              <div className="text-[10px] opacity-80">{f.label}</div>
            </button>
          ))}
        </div>

        {/* Font Size & Weight */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between text-xs text-gray-300 mb-1">
              <span>גודל גופן:</span>
              <span className="font-mono text-blue-400 font-bold">{styles.fontSize}px</span>
            </div>
            <input
              type="range"
              min="16"
              max="44"
              step="1"
              value={styles.fontSize}
              onChange={(e) =>
                onChange({ ...styles, fontSize: parseInt(e.target.value) })
              }
              className="w-full h-1.5 bg-[#222222] rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          <div className="flex items-center justify-between bg-[#111111] p-2.5 rounded-lg border border-[#262626]">
            <span className="text-xs text-gray-300 font-medium">הדגשת טקסט (Bold):</span>
            <button
              onClick={() => onChange({ ...styles, bold: !styles.bold })}
              className={`px-3 py-1 text-xs rounded-md font-bold transition border cursor-pointer ${
                styles.bold
                  ? "bg-blue-600 text-white border-blue-500"
                  : "bg-[#1a1a1a] text-gray-400 border-[#333333] hover:text-white"
              }`}
            >
              {styles.bold ? "מודגש (פעיל)" : "רגיל"}
            </button>
          </div>
        </div>

        {/* Text Color Presets */}
        <div>
          <span className="text-xs text-gray-300 block mb-1.5">צבע כתוביות בעברית:</span>
          <div className="flex items-center flex-wrap gap-2">
            {colorPresets.map((c) => (
              <button
                key={c.value}
                onClick={() => onChange({ ...styles, textColor: c.value })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border transition cursor-pointer ${
                  styles.textColor.toLowerCase() === c.value.toLowerCase()
                    ? "bg-blue-600/30 border-blue-500 text-white font-bold ring-1 ring-blue-500"
                    : "bg-[#111111] border-[#262626] text-gray-300 hover:border-gray-600"
                }`}
              >
                <span
                  className="w-3 h-3 rounded-full border border-gray-600 shadow-sm"
                  style={{ backgroundColor: c.value }}
                />
                <span>{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Subtitle Background Pill & Stroke */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[#222222]">
          <div>
            <div className="flex items-center justify-between text-xs text-gray-300 mb-1">
              <span>רקע תיבת כתובית (Pill):</span>
              <span className="font-mono text-blue-400 font-bold">
                {styles.backgroundOpacity === 0
                  ? "ללא רקע"
                  : `${Math.round(styles.backgroundOpacity * 100)}%`}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={styles.backgroundOpacity}
              onChange={(e) =>
                onChange({ ...styles, backgroundOpacity: parseFloat(e.target.value) })
              }
              className="w-full h-1.5 bg-[#222222] rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs text-gray-300 mb-1">
              <span>קו מתאר / צל (Outline):</span>
              <span className="font-mono text-blue-400 font-bold">
                {styles.strokeWidth > 0 ? `${styles.strokeWidth}px` : "ללא"}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="4"
              step="1"
              value={styles.strokeWidth}
              onChange={(e) =>
                onChange({ ...styles, strokeWidth: parseInt(e.target.value) })
              }
              className="w-full h-1.5 bg-[#222222] rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>
        </div>

        {/* Subtitle Vertical Position */}
        <div>
          <div className="flex items-center justify-between text-xs text-gray-300 mb-1">
            <span>מיקום אנכי של הכתובית החדשה (גובה מהתחתית):</span>
            <span className="font-mono text-blue-400 font-bold">{styles.positionBottomPercent}%</span>
          </div>
          <input
            type="range"
            min="4"
            max="25"
            step="1"
            value={styles.positionBottomPercent}
            onChange={(e) =>
              onChange({ ...styles, positionBottomPercent: parseInt(e.target.value) })
            }
            className="w-full h-1.5 bg-[#222222] rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>
      </div>
    </div>
  );
};
