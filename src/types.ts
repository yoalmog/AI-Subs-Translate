export type TonePreference = 'formal' | 'informal' | 'literal';

export interface SubtitleCue {
  id: string;
  startTime: number; // in seconds (e.g. 1.25)
  endTime: number;   // in seconds (e.g. 4.50)
  originalText: string;
  hebrewText: string;
  detectedLanguage?: string;
  position?: {
    bottomPercent?: number; // e.g. 8%
    heightPercent?: number; // e.g. 12%
    widthPercent?: number;
    leftPercent?: number;
  };
  confidence?: number;
  isEdited?: boolean;
}

export interface VideoMetadata {
  name: string;
  duration: number;
  width: number;
  height: number;
  aspectRatio: number;
  url: string;
  file?: File;
}

export interface SubtitleStylePreset {
  id: string;
  name: string;
  nameHebrew: string;
  description: string;
  badge?: string;
  isBuiltIn?: boolean;
  styles: SubtitleStyleSettings;
}

export interface SubtitleStyleSettings {
  fontSize: number; // in px or rem relative
  fontFamily: 'Heebo' | 'Rubik' | 'Assistant' | 'Varela Round' | 'sans-serif';
  textColor: string;
  strokeColor: string;
  strokeWidth: number;
  backgroundColor: string;
  backgroundOpacity: number;
  boxPadding: number;
  borderRadius: number;
  positionBottomPercent: number;
  align: 'center' | 'right' | 'left';
  bold: boolean;
  
  // Hardcoded subtitle mask settings
  hideOriginalSubtitles: boolean;
  maskHeightPercent: number;
  maskBottomPercent: number;
  maskColor: string;
  maskOpacity: number;
  maskBlur: boolean;
}

export interface AnalysisProgress {
  status: 'idle' | 'sampling' | 'analyzing' | 'translating' | 'completed' | 'error';
  currentFrame: number;
  totalFrames: number;
  percent: number;
  message: string;
  extractedCuesCount?: number;
}

export interface DemoVideo {
  id: string;
  title: string;
  description: string;
  duration: string;
  language: string;
  url?: string;
  sampleCues?: SubtitleCue[];
}

export interface TargetLanguageInfo {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

export interface SubtitleProjectBundle {
  version: string;
  projectType: "subtranslate-ai-project";
  exportedAt: string;
  projectName: string;
  videoReference: {
    name: string;
    duration: number;
    url?: string;
    width?: number;
    height?: number;
    aspectRatio?: number;
  };
  targetLanguage: TargetLanguageInfo;
  styleSettings: SubtitleStyleSettings;
  cues: SubtitleCue[];
  totalCues: number;
  metadata?: {
    appVersion?: string;
    tonePreference?: TonePreference;
    lastSavedTimestamp?: number;
    notes?: string;
  };
}
