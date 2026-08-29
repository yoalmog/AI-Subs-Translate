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
    <header className="bg-[#111111] backdrop-blur border-b border-[#222222] sticky top-0 z-30 px-4 lg:px-6 py-3.5 shadow-xl" id="app-header">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand & Title */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30 ring-1 ring-blue-400/30">
              <Film className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white tracking-tight font-rubik">
                  SubTranslate <span className="text-blue-500 font-extrabold">AI</span>
                </h1>
                <div className="hidden sm:flex items-center gap-1.5 bg-[#1a1a1a] px-2.5 py-0.5 rounded-full border border-[#333333]">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-[10px] font-medium text-gray-400">מעבד OCR + תרגום לעברית</span>
                </div>
              </div>
              <p className="text-xs text-gray-400">
                זיהוי כתוביות מוטמעות (Hardcoded), הסתרת המקור ותרגום מדויק לעברית
              </p>
            </div>
          </div>

          {/* Quick Stats on Mobile */}
          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={onOpenStyles}
              className={`p-2 rounded-lg border text-xs font-medium transition ${
                showStyles
                  ? "bg-blue-600 text-white border-blue-500"
                  : "bg-[#1a1a1a] text-gray-300 border-[#333333] hover:bg-[#262626]"
              }`}
              title="עיצוב כתוביות"
            >
              <Sliders className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center flex-wrap gap-2.5 w-full md:w-auto justify-end">
          {/* Demo Videos dropdown */}
          <div className="relative">
            <button
              id="demo-videos-btn"
              onClick={() => setShowDemos(!showDemos)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-300 bg-[#1a1a1a] hover:bg-[#262626] border border-[#333333] rounded-lg transition hover:text-white"
            >
              <PlayCircle className="w-4 h-4 text-blue-400" />
              <span>סרטוני הדגמה</span>
            </button>

            {showDemos && (
              <div 
                className="absolute left-0 md:right-0 md:left-auto mt-2 w-72 bg-[#141414] border border-[#2e2e2e] rounded-xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2"
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
                      className="w-full text-right px-2.5 py-2 text-xs rounded-lg hover:bg-blue-600/20 hover:text-blue-200 text-gray-200 transition flex flex-col gap-0.5 border border-transparent hover:border-blue-500/30"
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
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-300 bg-[#1a1a1a] hover:bg-[#262626] border border-[#333333] hover:border-blue-500/50 rounded-lg transition hover:text-white cursor-pointer"
            title="טען קובץ פרויקט JSON שמור (כולל כתוביות, עיצוב ונתוני וידאו)"
          >
            <FolderOpen className="w-4 h-4 text-emerald-400" />
            <span>ייבוא פרויקט</span>
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
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-gray-200 bg-[#1a1a1a] hover:bg-[#262626] border border-[#333333] hover:border-gray-600 rounded-lg transition shadow-sm hover:text-white"
          >
            <Upload className="w-4 h-4 text-blue-400" />
            <span>העלה סרטון</span>
          </button>

          {/* Subtitle Styles Toggle */}
          <button
            id="toggle-styles-btn"
            onClick={onOpenStyles}
            className={`hidden md:flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition ${
              showStyles
                ? "bg-blue-600/20 text-blue-400 border-blue-500/50 shadow-inner"
                : "bg-[#1a1a1a] text-gray-300 border-[#333333] hover:bg-[#262626] hover:text-white"
            }`}
          >
            <Sliders className="w-4 h-4 text-blue-400" />
            <span>הגדרות כיסוי ועיצוב</span>
          </button>

          {/* AI Subtitle Scan & Translate Button */}
          <button
            id="start-ai-analysis-btn"
            disabled={!hasVideo || isAnalyzing}
            onClick={onStartAnalysis}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg shadow-md transition ${
              !hasVideo
                ? "bg-[#1a1a1a] text-gray-600 border border-[#262626] cursor-not-allowed"
                : isAnalyzing
                ? "bg-blue-700 text-white animate-pulse cursor-wait"
                : "bg-blue-600 hover:bg-blue-700 text-white shadow-[0_0_12px_rgba(59,130,246,0.45)] ring-1 ring-white/10 active:scale-95 cursor-pointer"
            }`}
          >
            <Sparkles className={`w-4 h-4 ${isAnalyzing ? "animate-spin" : "text-amber-300"}`} />
            <span>{isAnalyzing ? "סורק ומתרגם..." : "תרגם כתוביות ב-AI"}</span>
          </button>

          {/* Export Button */}
          <button
            id="open-export-btn"
            disabled={!hasVideo}
            onClick={onOpenExport}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg border transition ${
              !hasVideo
                ? "bg-[#141414] text-gray-600 border-[#222222] cursor-not-allowed"
                : "bg-[#1a1a1a] hover:bg-[#262626] text-white border-[#333333] hover:border-blue-500 shadow-sm"
            }`}
          >
            <Download className="w-4 h-4 text-blue-400" />
            <span>ייצוא סרטון</span>
          </button>
        </div>
      </div>
    </header>
  );
};
