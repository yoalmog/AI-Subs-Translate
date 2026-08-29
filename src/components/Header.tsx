import React, { useRef, useState } from "react";
import {
  Video,
  Upload,
  Sparkles,
  Download,
  Film,
  FileText,
  Sliders,
  PlayCircle,
  HelpCircle,
  FolderOpen,
  FolderArchive,
  Package,
} from "lucide-react";
import { DEMO_VIDEOS } from "../data/demoVideos";
import { DemoVideo, SubtitleProjectBundle } from "../types";
import { readProjectBundleFromFile } from "../utils/projectBundle";

interface HeaderProps {
  onFileUpload: (file: File) => void;
  onSelectDemo: (demo: DemoVideo) => void;
  onStartAnalysis: () => void;
  onOpenExport: () => void;
  onOpenStyles: () => void;
  onImportProject?: (bundle: SubtitleProjectBundle) => void;
  hasVideo: boolean;
  hasCues: boolean;
  isAnalyzing: boolean;
  showStyles: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onFileUpload,
  onSelectDemo,
  onStartAnalysis,
  onOpenExport,
  onOpenStyles,
  onImportProject,
  hasVideo,
  hasCues,
  isAnalyzing,
  showStyles,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectFileInputRef = useRef<HTMLInputElement>(null);
  const [showDemos, setShowDemos] = useState(false);
  const [showProjectMenu, setShowProjectMenu] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileUpload(e.target.files[0]);
      e.target.value = "";
    }
  };

  const handleProjectFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const res = await readProjectBundleFromFile(file);
      if (res.success && res.project && onImportProject) {
        onImportProject(res.project);
      } else {
        alert(res.error || "נכשלה טעינת קובץ הפרויקט.");
      }
      e.target.value = "";
    }
  };

  return (
    <header className="bg-[#111111]/95 backdrop-blur border-b border-[#222222] sticky top-0 z-40 px-3 sm:px-4 lg:px-6 py-2.5 sm:py-3 shadow-xl" id="app-header">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 md:gap-4">
        {/* Brand & Title Row */}
        <div className="flex items-center justify-between gap-2.5 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-blue-600 flex items-center justify-center shadow-md shadow-blue-600/30 ring-1 ring-blue-400/30 shrink-0">
              <Film className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-white tracking-tight font-rubik whitespace-nowrap">
                  SubTranslate <span className="text-blue-500 font-extrabold">AI</span>
                </h1>
                <div className="hidden sm:flex items-center gap-1.5 bg-[#1a1a1a] px-2 py-0.5 rounded-full border border-[#333333]">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-[10px] font-medium text-gray-400">מעבד OCR + תרגום לעברית</span>
                </div>
              </div>
              <p className="text-[11px] sm:text-xs text-gray-400 truncate hidden xs:block">
                זיהוי כתוביות מוטמעות (Hardcoded), הסתרת המקור ותרגום מדויק לעברית
              </p>
            </div>
          </div>

          {/* Quick Style Settings Toggle on Mobile */}
          <div className="md:hidden flex items-center gap-1.5 shrink-0">
            <button
              onClick={onOpenStyles}
              className={`h-8 px-2.5 rounded-lg border text-xs font-semibold transition flex items-center gap-1 cursor-pointer ${
                showStyles
                  ? "bg-blue-600 text-white border-blue-500 shadow-sm"
                  : "bg-[#1a1a1a] text-gray-300 border-[#333333] hover:bg-[#262626]"
              }`}
              title="עיצוב וכיסוי כתוביות"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="text-[11px]">עיצוב</span>
            </button>
          </div>
        </div>

        {/* Action Controls Toolbar - Responsive single/two-row with clean button sizes */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-0.5 md:pb-0 scrollbar-none justify-start md:justify-end">
          {/* Demo Videos dropdown */}
          <div className="relative shrink-0">
            <button
              id="demo-videos-btn"
              onClick={() => setShowDemos(!showDemos)}
              className="h-8 px-2.5 sm:px-3 flex items-center gap-1.5 text-xs font-medium text-gray-300 bg-[#1a1a1a] hover:bg-[#262626] border border-[#333333] hover:border-gray-500 rounded-lg transition hover:text-white cursor-pointer whitespace-nowrap shadow-xs"
            >
              <PlayCircle className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="hidden sm:inline">סרטוני הדגמה</span>
              <span className="sm:hidden">הדגמות</span>
            </button>

            {showDemos && (
              <div 
                className="absolute right-0 md:right-0 mt-2 w-72 bg-[#141414] border border-[#2e2e2e] rounded-xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2"
                onMouseLeave={() => setShowDemos(false)}
              >
                <div className="text-xs font-semibold text-gray-400 px-2 py-1.5 border-b border-[#222222]">
                  בחר סרטון דוגמה עם כתוביות מובנות:
                </div>
                <div className="py-1 space-y-1">
                  {DEMO_VIDEOS.map((demo) => (
                    <button
                      key={demo.id}
                      onClick={() => {
                        onSelectDemo(demo);
                        setShowDemos(false);
                      }}
                      className="w-full text-right px-2.5 py-2 text-xs rounded-lg hover:bg-blue-600/20 hover:text-blue-200 text-gray-200 transition flex flex-col gap-0.5 border border-transparent hover:border-blue-500/30 cursor-pointer"
                    >
                      <div className="font-medium text-gray-100 flex items-center justify-between">
                        <span>{demo.title}</span>
                        <span className="text-[10px] text-gray-400 font-mono">{demo.duration}</span>
                      </div>
                      <span className="text-[11px] text-gray-400 line-clamp-1">{demo.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Import Project (.json) */}
          <input
            type="file"
            ref={projectFileInputRef}
            onChange={handleProjectFileChange}
            accept=".json,application/json"
            className="hidden"
          />
          <button
            id="import-project-btn"
            onClick={() => projectFileInputRef.current?.click()}
            className="h-8 px-2.5 sm:px-3 flex items-center gap-1.5 text-xs font-medium text-gray-300 bg-[#1a1a1a] hover:bg-[#262626] border border-[#333333] hover:border-blue-500/50 rounded-lg transition hover:text-white cursor-pointer whitespace-nowrap shrink-0 shadow-xs"
            title="טען קובץ פרויקט JSON שמור"
          >
            <FolderOpen className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="hidden sm:inline">ייבוא פרויקט</span>
            <span className="sm:hidden">ייבוא</span>
          </button>

          {/* Upload Button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="video/*"
            className="hidden"
          />
          <button
            id="upload-video-btn"
            onClick={() => fileInputRef.current?.click()}
            className="h-8 px-2.5 sm:px-3.5 flex items-center gap-1.5 text-xs font-medium text-gray-200 bg-[#1a1a1a] hover:bg-[#262626] border border-[#333333] hover:border-gray-500 rounded-lg transition shadow-xs hover:text-white cursor-pointer whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="hidden sm:inline">העלה סרטון</span>
            <span className="sm:hidden">העלאה</span>
          </button>

          {/* Subtitle Styles Toggle (Desktop) */}
          <button
            id="toggle-styles-btn"
            onClick={onOpenStyles}
            className={`hidden md:flex h-8 items-center gap-1.5 px-3 text-xs font-medium rounded-lg border transition whitespace-nowrap shrink-0 cursor-pointer ${
              showStyles
                ? "bg-blue-600/20 text-blue-400 border-blue-500/50 shadow-inner"
                : "bg-[#1a1a1a] text-gray-300 border-[#333333] hover:bg-[#262626] hover:text-white"
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>הגדרות כיסוי ועיצוב</span>
          </button>

          {/* AI Subtitle Scan & Translate Button */}
          <button
            id="start-ai-analysis-btn"
            disabled={!hasVideo || isAnalyzing}
            onClick={onStartAnalysis}
            className={`h-8 flex items-center gap-1.5 px-3 sm:px-4 text-xs font-bold rounded-lg shadow-sm transition whitespace-nowrap shrink-0 ${
              !hasVideo
                ? "bg-[#1a1a1a] text-gray-600 border border-[#262626] cursor-not-allowed"
                : isAnalyzing
                ? "bg-blue-700 text-white animate-pulse cursor-wait"
                : "bg-blue-600 hover:bg-blue-700 text-white shadow-[0_0_10px_rgba(59,130,246,0.4)] active:scale-95 cursor-pointer"
            }`}
          >
            <Sparkles className={`w-3.5 h-3.5 shrink-0 ${isAnalyzing ? "animate-spin" : "text-amber-300"}`} />
            <span className="hidden sm:inline">{isAnalyzing ? "סורק ומתרגם..." : "תרגם כתוביות ב-AI"}</span>
            <span className="sm:hidden">{isAnalyzing ? "סורק..." : "תרגם ב-AI"}</span>
          </button>

          {/* Export Button */}
          <button
            id="open-export-btn"
            disabled={!hasVideo}
            onClick={onOpenExport}
            className={`h-8 flex items-center gap-1.5 px-3 sm:px-3.5 text-xs font-bold rounded-lg border transition whitespace-nowrap shrink-0 ${
              !hasVideo
                ? "bg-[#141414] text-gray-600 border-[#222222] cursor-not-allowed"
                : "bg-[#1a1a1a] hover:bg-[#262626] text-white border-[#333333] hover:border-blue-500 shadow-xs cursor-pointer"
            }`}
          >
            <Download className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="hidden sm:inline">ייצוא סרטון</span>
            <span className="sm:hidden">ייצוא</span>
          </button>
        </div>
      </div>
    </header>
  );
};
