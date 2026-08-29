import { SubtitleCue } from "../types";

/**
 * Format seconds to standard display time "00:00" or "00:00.0"
 */
export function formatTimeDisplay(seconds: number, includeMs: boolean = false): string {
  if (isNaN(seconds) || seconds < 0) return includeMs ? "00:00.0" : "00:00";
  
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);

  const minsStr = mins.toString().padStart(2, "0");
  const secsStr = secs.toString().padStart(2, "0");

  if (includeMs) {
    return `${minsStr}:${secsStr}.${ms}`;
  }
  return `${minsStr}:${secsStr}`;
}

/**
 * Format seconds to SRT timestamp: 00:01:23,456
 */
export function formatSrtTimestamp(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  const hrsStr = hrs.toString().padStart(2, "0");
  const minsStr = mins.toString().padStart(2, "0");
  const secsStr = secs.toString().padStart(2, "0");
  const msStr = ms.toString().padStart(3, "0");

  return `${hrsStr}:${minsStr}:${secsStr},${msStr}`;
}

/**
 * Format seconds to VTT timestamp: 00:01:23.456
 */
export function formatVttTimestamp(seconds: number): string {
  return formatSrtTimestamp(seconds).replace(",", ".");
}

/**
 * Parse time string (00:01:23,456 or 01:23.456 or 1:23) into seconds
 */
export function parseTimestampToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  const cleaned = timeStr.trim().replace(",", ".");
  const parts = cleaned.split(":");
  
  if (parts.length === 3) {
    const hours = parseFloat(parts[0]) || 0;
    const minutes = parseFloat(parts[1]) || 0;
    const seconds = parseFloat(parts[2]) || 0;
    return hours * 3600 + minutes * 60 + seconds;
  } else if (parts.length === 2) {
    const minutes = parseFloat(parts[0]) || 0;
    const seconds = parseFloat(parts[1]) || 0;
    return minutes * 60 + seconds;
  } else {
    return parseFloat(cleaned) || 0;
  }
}

/**
 * Generate standard .SRT subtitle file content with UTF-8 BOM
 */
export function generateSrtContent(cues: SubtitleCue[], useHebrew: boolean = true): string {
  let srt = "";
  const sortedCues = [...cues].sort((a, b) => a.startTime - b.startTime);

  sortedCues.forEach((cue, index) => {
    const cueNumber = index + 1;
    const startTimeStr = formatSrtTimestamp(cue.startTime);
    const endTimeStr = formatSrtTimestamp(cue.endTime);
    const text = (useHebrew ? cue.hebrewText : cue.originalText).trim();

    srt += `${cueNumber}\r\n`;
    srt += `${startTimeStr} --> ${endTimeStr}\r\n`;
    srt += `${text}\r\n\r\n`;
  });

  return srt;
}

/**
 * Generate standard WebVTT file content
 */
export function generateVttContent(cues: SubtitleCue[], useHebrew: boolean = true): string {
  let vtt = "WEBVTT\r\n\r\n";
  const sortedCues = [...cues].sort((a, b) => a.startTime - b.startTime);

  sortedCues.forEach((cue, index) => {
    const startTimeStr = formatVttTimestamp(cue.startTime);
    const endTimeStr = formatVttTimestamp(cue.endTime);
    const text = (useHebrew ? cue.hebrewText : cue.originalText).trim();

    vtt += `${index + 1}\r\n`;
    vtt += `${startTimeStr} --> ${endTimeStr}\r\n`;
    vtt += `${text}\r\n\r\n`;
  });

  return vtt;
}

/**
 * Parse an uploaded .SRT text into SubtitleCue[]
 */
export function parseSrtFile(srtContent: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const normalized = srtContent.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  const blocks = normalized.split(/\n\n+/);

  for (let i = 0; i < blocks.length; i++) {
    const lines = blocks[i].split("\n");
    if (lines.length < 2) continue;

    // Line 0 is usually index or timing
    let timeLineIdx = lines[0].includes("-->") ? 0 : 1;
    if (!lines[timeLineIdx] || !lines[timeLineIdx].includes("-->")) continue;

    const timeParts = lines[timeLineIdx].split("-->");
    const startTime = parseTimestampToSeconds(timeParts[0]);
    const endTime = parseTimestampToSeconds(timeParts[1]);

    const textLines = lines.slice(timeLineIdx + 1).join(" ").trim();
    if (!textLines) continue;

    cues.push({
      id: `cue-imported-${i}-${Date.now()}`,
      startTime,
      endTime,
      originalText: textLines,
      hebrewText: textLines,
      detectedLanguage: "Imported",
    });
  }

  return cues;
}

/**
 * Convert Blob to Base64 string
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Trigger robust file download in browser (with server fallback for mobile/iframe sandboxes)
 */
export async function downloadFile(
  content: string,
  filename: string,
  mimeType: string = "text/plain;charset=utf-8"
): Promise<boolean> {
  // Add UTF-8 BOM for text files so Hebrew displays properly in all players
  const blob = new Blob(["\uFEFF" + content], { type: mimeType });
  return downloadBlob(blob, filename);
}

/**
 * Download a Blob with automatic iframe sandbox handling and server download fallback
 */
export async function downloadBlob(blob: Blob, filename: string): Promise<boolean> {
  try {
    // Attempt standard browser download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1500);
    return true;
  } catch (err) {
    console.warn("Direct blob download failed, falling back to server route:", err);
    return false;
  }
}

/**
 * Native Web Share API for Mobile devices (Android / iOS)
 */
export async function shareBlobFile(blob: Blob, filename: string, title: string = "קובץ כתוביות"): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title,
          text: `קובץ מוכן: ${filename}`,
        });
        return true;
      }
    }
  } catch (err: any) {
    if (err?.name !== "AbortError") {
      console.warn("Web Share API error:", err);
    }
  }
  return false;
}

/**
 * Server-assisted download link creator
 */
export async function prepareServerDownload(blob: Blob, filename: string): Promise<string | null> {
  try {
    const base64 = await blobToBase64(blob);
    const res = await fetch("/api/prepare-download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        base64Data: base64,
        filename,
        mimeType: blob.type || "application/octet-stream",
      }),
    });
    if (!res.ok) throw new Error("Failed to prepare download");
    const data = await res.json();
    return data.downloadUrl;
  } catch (e) {
    console.warn("Server prepare download error:", e);
    return null;
  }
}

