/**
 * Video Type Helper & Compatibility Engine
 * Handles binary format inspection, MIME type normalization,
 * browser codec capability checking, and fallback frame extraction.
 */

export interface VideoFormatInfo {
  mimeType: string;
  detectedFormat: string;
  isNativelyPlayable: boolean;
  fileSize: number;
  fileName: string;
  magicHeader: string;
  suggestion?: string;
}

/**
 * Sniff magic bytes from file header to accurately identify video container
 */
export async function detectVideoFormat(file: File): Promise<VideoFormatInfo> {
  const fileName = file.name || "video.mp4";
  const nameLower = fileName.toLowerCase();
  const fileSize = file.size;

  // Read first 64 bytes
  let headerHex = "";
  let headerAscii = "";
  try {
    const buffer = await file.slice(0, 64).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    headerHex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" ");
    headerAscii = Array.from(bytes)
      .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : "."))
      .join("");
  } catch (err) {
    console.warn("Could not read file header bytes:", err);
  }

  let detectedFormat = "MP4";
  let mimeType = "video/mp4";
  let isNativelyPlayable = true;
  let suggestion = "";

  // 1. Matroska / WebM (EBML header: 1A 45 DF A3)
  if (headerHex.startsWith("1a 45 df a3") || nameLower.endsWith(".mkv") || nameLower.endsWith(".webm")) {
    if (headerAscii.includes("webm") || nameLower.endsWith(".webm")) {
      detectedFormat = "WebM";
      mimeType = "video/webm";
      isNativelyPlayable = true;
    } else {
      detectedFormat = "MKV (Matroska)";
      mimeType = "video/x-matroska";
      // Test if browser supports MKV container
      const testVid = document.createElement("video");
      const mkvCanPlay = testVid.canPlayType("video/x-matroska") || testVid.canPlayType("video/mkv");
      isNativelyPlayable = Boolean(mkvCanPlay);
      if (!isNativelyPlayable) {
        suggestion = "קובץ MKV אינו נתמך ישירות בחלק מדפדפני כרום/אנדרואיד. המרנו אותו אוטומטית לקריאת פריימים לתאימות מושלמת.";
      }
    }
  }
  // 2. MP4 / MOV / M4V (ISO Base Media: ftyp box)
  else if (
    headerAscii.includes("ftyp") ||
    headerAscii.includes("moov") ||
    headerAscii.includes("mdat") ||
    nameLower.endsWith(".mp4") ||
    nameLower.endsWith(".m4v") ||
    nameLower.endsWith(".mov") ||
    nameLower.endsWith(".qt")
  ) {
    if (nameLower.endsWith(".mov") || headerAscii.includes("qt  ")) {
      detectedFormat = "QuickTime (MOV)";
      mimeType = "video/quicktime";
    } else if (nameLower.endsWith(".m4v") || headerAscii.includes("M4V ")) {
      detectedFormat = "M4V";
      mimeType = "video/mp4";
    } else {
      detectedFormat = "MP4 (H.264/AVC/HEVC)";
      mimeType = "video/mp4";
    }
    isNativelyPlayable = true;
  }
  // 3. AVI (RIFF .... AVI )
  else if (headerAscii.startsWith("RIFF") && headerAscii.includes("AVI ")) {
    detectedFormat = "AVI (Audio Video Interleave)";
    mimeType = "video/x-msvideo";
    const testVid = document.createElement("video");
    const canPlay = testVid.canPlayType("video/x-msvideo") || testVid.canPlayType("video/avi");
    isNativelyPlayable = Boolean(canPlay);
    if (!isNativelyPlayable) {
      suggestion = "קובץ AVI ישן אינו נתמך ישירות בדפדפנים מודרניים. מומלץ להשתמש במצב תאימות או להמיר ל-MP4.";
    }
  }
  // 4. OGG / OGV (OggS)
  else if (headerAscii.startsWith("OggS") || nameLower.endsWith(".ogv") || nameLower.endsWith(".ogg")) {
    detectedFormat = "Ogg Theora";
    mimeType = "video/ogg";
    isNativelyPlayable = true;
  }
  // 5. 3GP / 3G2 (3gp)
  else if (nameLower.endsWith(".3gp") || nameLower.endsWith(".3g2") || headerAscii.includes("3gp")) {
    detectedFormat = "3GPP Mobile Video";
    mimeType = "video/3gpp";
    isNativelyPlayable = true;
  }
  // 6. MPEG Transport Stream (.ts, .m2ts)
  else if (nameLower.endsWith(".ts") || nameLower.endsWith(".m2ts") || headerHex.startsWith("47 ")) {
    detectedFormat = "MPEG-TS";
    mimeType = "video/mp2t";
    isNativelyPlayable = false;
    suggestion = "קובץ MPEG-TS דורש פיענוח פריימים מותאם או המרה ל-MP4.";
  }
  // 7. Fallback based on extension or MP4 default
  else {
    if (nameLower.endsWith(".mp4")) {
      detectedFormat = "MP4";
      mimeType = "video/mp4";
    } else if (nameLower.endsWith(".webm")) {
      detectedFormat = "WebM";
      mimeType = "video/webm";
    } else {
      detectedFormat = "Standard Video";
      mimeType = file.type || "video/mp4";
    }
  }

  return {
    mimeType,
    detectedFormat,
    isNativelyPlayable,
    fileSize,
    fileName,
    magicHeader: headerHex.slice(0, 30),
    suggestion,
  };
}

/**
 * Creates a normalized safe Blob URL for video playback.
 * If file.type is non-standard or missing, re-wraps it with standard video MIME.
 */
export function createNormalizedVideoBlob(file: File, mimeTypeOverride?: string | boolean): {
  url: string;
  mimeType: string;
} {
  let targetMime = typeof mimeTypeOverride === "string" ? mimeTypeOverride : (mimeTypeOverride === true ? "video/mp4" : file.type);
  const nameLower = file.name.toLowerCase();

  // Fix known problematic MIME types for browser HTML5 video
  if (
    !targetMime ||
    targetMime === "application/octet-stream" ||
    targetMime === "" ||
    targetMime === "video/x-matroska" ||
    targetMime === "video/mkv"
  ) {
    if (nameLower.endsWith(".webm")) {
      targetMime = "video/webm";
    } else if (nameLower.endsWith(".ogg") || nameLower.endsWith(".ogv")) {
      targetMime = "video/ogg";
    } else if (nameLower.endsWith(".mov") || nameLower.endsWith(".qt")) {
      // In Chrome/Edge/Android, video/mp4 often plays MOV files better than video/quicktime
      targetMime = "video/mp4";
    } else {
      // For MP4, MKV (which often contains H.264 streams) or unknown, video/mp4 has maximum browser hardware acceleration
      targetMime = "video/mp4";
    }
  }

  // Create a clean new blob with explicit MIME type
  try {
    const safeBlob = new Blob([file], { type: targetMime });
    return {
      url: URL.createObjectURL(safeBlob),
      mimeType: targetMime,
    };
  } catch (err) {
    console.warn("Failed to create explicit Blob, falling back to direct file object URL:", err);
    return {
      url: URL.createObjectURL(file),
      mimeType: targetMime || "video/mp4",
    };
  }
}

/**
 * Converts or extracts frames from an unsupported video file into a standard playable WebM video
 * using client-side Canvas and MediaRecorder.
 */
export async function transcodeVideoToWebM(
  sourceVideo: HTMLVideoElement,
  onProgress?: (percent: number, message: string) => void
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const width = sourceVideo.videoWidth || 854;
  const height = sourceVideo.videoHeight || 480;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not initialize 2D canvas context for transcoding");

  const duration = sourceVideo.duration && isFinite(sourceVideo.duration) ? sourceVideo.duration : 10;
  const stream = canvas.captureStream(25);

  let mimeType = "video/webm;codecs=vp8";
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = "video/webm";
  }

  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2500000 });
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  recorder.start(100);

  const fps = 25;
  const totalFrames = Math.ceil(duration * fps);
  const frameInterval = 1 / fps;

  sourceVideo.pause();

  for (let f = 0; f < totalFrames; f++) {
    const targetTime = Math.min(duration, f * frameInterval);
    sourceVideo.currentTime = targetTime;

    await new Promise<void>((resolve) => {
      const onSeeked = () => {
        sourceVideo.removeEventListener("seeked", onSeeked);
        resolve();
      };
      sourceVideo.addEventListener("seeked", onSeeked, { once: true });
      setTimeout(resolve, 150); // Timeout safety
    });

    ctx.drawImage(sourceVideo, 0, 0, width, height);
    if (onProgress) {
      const pct = Math.round((f / totalFrames) * 100);
      onProgress(pct, `ממיר וידאו: פריים ${f + 1}/${totalFrames} (${pct}%)`);
    }
  }

  recorder.stop();
  await new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  return new Blob(chunks, { type: "video/webm" });
}
