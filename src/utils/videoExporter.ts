import { SubtitleCue, SubtitleStyleSettings } from "../types";
import { renderDemoFrame } from "./demoVideoGenerator";

export interface ExportProgress {
  percent: number;
  currentSecond: number;
  totalSeconds: number;
  status: "rendering" | "encoding" | "completed" | "error";
  blobUrl?: string;
  error?: string;
}

export interface ExportSource {
  type: "video" | "demo";
  videoElement?: HTMLVideoElement | null;
  demoId?: string;
  duration?: number;
}

/**
 * Render video with burned-in cover mask and styled Hebrew subtitles to a WebM video file
 */
export async function exportVideoWithHebrewSubtitles(
  source: ExportSource | HTMLVideoElement,
  cues: SubtitleCue[],
  styles: SubtitleStyleSettings,
  onProgress?: (progress: ExportProgress) => void
): Promise<Blob> {
  let isDemo = false;
  let demoId = "demo-space";
  let videoElement: HTMLVideoElement | null = null;
  let duration = 10;

  if (source instanceof HTMLVideoElement) {
    videoElement = source;
    duration = source.duration || 10;
  } else if (source.type === "demo") {
    isDemo = true;
    demoId = source.demoId || "demo-space";
    duration = source.duration || 10;
  } else {
    videoElement = source.videoElement || null;
    duration = source.duration || videoElement?.duration || 10;
  }

  const width = videoElement?.videoWidth || 1280;
  const height = videoElement?.videoHeight || 720;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Could not create canvas 2D rendering context.");
  }

  const canvasStream = canvas.captureStream(30);

  // Attempt to capture audio stream from video if available
  let combinedStream = canvasStream;
  if (!isDemo && videoElement) {
    try {
      // @ts-ignore
      const videoStream = videoElement.captureStream ? videoElement.captureStream() : (videoElement as any).mozCaptureStream?.();
      if (videoStream) {
        const audioTracks = videoStream.getAudioTracks();
        if (audioTracks && audioTracks.length > 0) {
          audioTracks.forEach((track: MediaStreamTrack) => canvasStream.addTrack(track));
        }
      }
    } catch (e) {
      console.warn("Could not capture direct audio stream, continuing with video stream:", e);
    }
  }

  // Determine supported mimeType
  let mimeType = "video/webm;codecs=vp9";
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = "video/webm;codecs=vp8";
  }
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = "video/webm";
  }

  const recordedChunks: Blob[] = [];
  const recorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: 4000000,
  });

  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  const initialTime = videoElement?.currentTime || 0;
  const initialMuted = videoElement?.muted || false;

  // Frame rendering helper
  const renderFrameAt = (currentTime: number) => {
    if (isDemo) {
      renderDemoFrame(ctx, demoId, width, height, currentTime);
    } else if (videoElement) {
      ctx.drawImage(videoElement, 0, 0, width, height);
    }

    // Active subtitle cue for currentTime
    const activeCue = cues.find(
      (cue) => currentTime >= cue.startTime && currentTime <= cue.endTime
    );

    // Cover mask
    if (styles.hideOriginalSubtitles && (activeCue || styles.maskOpacity > 0.5)) {
      const maskHeight = (styles.maskHeightPercent / 100) * height;
      const maskBottom = (styles.maskBottomPercent / 100) * height;
      const maskY = height - maskBottom - maskHeight;

      ctx.save();
      ctx.globalAlpha = styles.maskOpacity;
      ctx.fillStyle = styles.maskColor || "#000000";
      ctx.fillRect(0, maskY, width, maskHeight);
      ctx.restore();
    }

    // Hebrew subtitle
    if (activeCue && activeCue.hebrewText.trim()) {
      ctx.save();
      const fontSizePx = Math.floor((styles.fontSize / 1080) * height * 1.5) || 36;
      ctx.font = `${styles.bold ? "bold " : ""}${fontSizePx}px '${styles.fontFamily}', Heebo, Rubik, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.direction = "rtl";

      const text = activeCue.hebrewText.trim();
      const textMetrics = ctx.measureText(text);
      const textWidth = textMetrics.width;
      const textHeight = fontSizePx;

      const subBottomPx = (styles.positionBottomPercent / 100) * height;
      const textY = height - subBottomPx - fontSizePx / 2;
      const textX = width / 2;

      // Subtitle Background Box
      if (styles.backgroundOpacity > 0) {
        const padX = styles.boxPadding * 2 + 16;
        const padY = styles.boxPadding + 8;
        const boxX = textX - textWidth / 2 - padX / 2;
        const boxY = textY - textHeight / 2 - padY / 2;
        const boxW = textWidth + padX;
        const boxH = textHeight + padY;

        ctx.save();
        ctx.globalAlpha = styles.backgroundOpacity;
        ctx.fillStyle = styles.backgroundColor || "#000000";
        
        const r = styles.borderRadius || 6;
        ctx.beginPath();
        if (typeof (ctx as any).roundRect === "function") {
          (ctx as any).roundRect(boxX, boxY, boxW, boxH, r);
        } else {
          ctx.rect(boxX, boxY, boxW, boxH);
        }
        ctx.fill();
        ctx.restore();
      }

      // Text Stroke
      if (styles.strokeWidth > 0) {
        ctx.lineWidth = styles.strokeWidth * 2;
        ctx.strokeStyle = styles.strokeColor || "#000000";
        ctx.lineJoin = "round";
        ctx.strokeText(text, textX, textY);
      }

      // Text Fill
      ctx.fillStyle = styles.textColor || "#FFFFFF";
      ctx.fillText(text, textX, textY);

      ctx.restore();
    }
  };

  return new Promise(async (resolve, reject) => {
    try {
      recorder.start(100);

      if (videoElement) {
        videoElement.currentTime = 0;
        videoElement.muted = true;
      }

      const fps = 25;
      const interval = 1 / fps;
      let cur = 0;

      const step = async () => {
        if (cur >= duration) {
          recorder.stop();
          return;
        }

        if (!isDemo && videoElement) {
          videoElement.currentTime = cur;
          await new Promise<void>((r) => {
            const onSeek = () => {
              videoElement?.removeEventListener("seeked", onSeek);
              r();
            };
            videoElement?.addEventListener("seeked", onSeek, { once: true });
            setTimeout(r, 100); // Safety timeout
          });
        }

        renderFrameAt(cur);

        const progressPercent = Math.min(99, Math.round((cur / duration) * 100));
        if (onProgress) {
          onProgress({
            percent: progressPercent,
            currentSecond: cur,
            totalSeconds: duration,
            status: "rendering",
          });
        }

        cur += interval;
        setTimeout(step, isDemo ? 12 : 25);
      };

      recorder.onstop = () => {
        const completeBlob = new Blob(recordedChunks, { type: mimeType });
        const blobUrl = URL.createObjectURL(completeBlob);

        if (videoElement) {
          videoElement.currentTime = initialTime;
          videoElement.muted = initialMuted;
        }

        if (onProgress) {
          onProgress({
            percent: 100,
            currentSecond: duration,
            totalSeconds: duration,
            status: "completed",
            blobUrl,
          });
        }

        resolve(completeBlob);
      };

      await step();
    } catch (err: any) {
      if (videoElement) {
        videoElement.currentTime = initialTime;
        videoElement.muted = initialMuted;
      }
      if (recorder.state === "recording") {
        recorder.stop();
      }
      if (onProgress) {
        onProgress({
          percent: 0,
          currentSecond: 0,
          totalSeconds: duration,
          status: "error",
          error: err.message || "Failed to export video.",
        });
      }
      reject(err);
    }
  });
}

/**
 * Render a fast 3-second sample preview clip of burned-in subtitles and cover-mask
 */
export async function exportVideoPreviewSample(
  source: ExportSource | HTMLVideoElement,
  cues: SubtitleCue[],
  styles: SubtitleStyleSettings,
  sampleStartTime: number = 0,
  sampleDuration: number = 3,
  onProgress?: (progress: ExportProgress) => void
): Promise<Blob> {
  let isDemo = false;
  let demoId = "demo-space";
  let videoElement: HTMLVideoElement | null = null;
  let totalVideoDuration = 10;

  if (source instanceof HTMLVideoElement) {
    videoElement = source;
    totalVideoDuration = source.duration || 10;
  } else if (source.type === "demo") {
    isDemo = true;
    demoId = source.demoId || "demo-space";
    totalVideoDuration = source.duration || 10;
  } else {
    videoElement = source.videoElement || null;
    totalVideoDuration = source.duration || videoElement?.duration || 10;
  }

  // Calculate safe window for 3-second sample
  let startSec = Math.max(0, sampleStartTime);
  if (startSec + sampleDuration > totalVideoDuration) {
    startSec = Math.max(0, totalVideoDuration - sampleDuration);
  }
  const endSec = Math.min(totalVideoDuration, startSec + sampleDuration);
  const actualDuration = Math.max(1, endSec - startSec);

  const width = videoElement?.videoWidth || 1280;
  const height = videoElement?.videoHeight || 720;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Could not create canvas 2D context for preview.");
  }

  const canvasStream = canvas.captureStream(30);

  let mimeType = "video/webm;codecs=vp9";
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = "video/webm;codecs=vp8";
  }
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = "video/webm";
  }

  const recordedChunks: Blob[] = [];
  const recorder = new MediaRecorder(canvasStream, {
    mimeType,
    videoBitsPerSecond: 3000000,
  });

  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  const initialTime = videoElement?.currentTime || 0;
  const initialMuted = videoElement?.muted || false;

  const renderFrameAt = (currentTime: number) => {
    if (isDemo) {
      renderDemoFrame(ctx, demoId, width, height, currentTime);
    } else if (videoElement) {
      ctx.drawImage(videoElement, 0, 0, width, height);
    }

    const activeCue = cues.find(
      (cue) => currentTime >= cue.startTime && currentTime <= cue.endTime
    );

    if (styles.hideOriginalSubtitles && (activeCue || styles.maskOpacity > 0.5)) {
      const maskHeight = (styles.maskHeightPercent / 100) * height;
      const maskBottom = (styles.maskBottomPercent / 100) * height;
      const maskY = height - maskBottom - maskHeight;

      ctx.save();
      ctx.globalAlpha = styles.maskOpacity;
      ctx.fillStyle = styles.maskColor || "#000000";
      ctx.fillRect(0, maskY, width, maskHeight);
      ctx.restore();
    }

    if (activeCue && activeCue.hebrewText.trim()) {
      ctx.save();
      const fontSizePx = Math.floor((styles.fontSize / 1080) * height * 1.5) || 36;
      ctx.font = `${styles.bold ? "bold " : ""}${fontSizePx}px '${styles.fontFamily}', Heebo, Rubik, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.direction = "rtl";

      const text = activeCue.hebrewText.trim();
      const textMetrics = ctx.measureText(text);
      const textWidth = textMetrics.width;
      const textHeight = fontSizePx;

      const subBottomPx = (styles.positionBottomPercent / 100) * height;
      const textY = height - subBottomPx - fontSizePx / 2;
      const textX = width / 2;

      if (styles.backgroundOpacity > 0) {
        const padX = styles.boxPadding * 2 + 16;
        const padY = styles.boxPadding + 8;
        const boxX = textX - textWidth / 2 - padX / 2;
        const boxY = textY - textHeight / 2 - padY / 2;
        const boxW = textWidth + padX;
        const boxH = textHeight + padY;

        ctx.save();
        ctx.globalAlpha = styles.backgroundOpacity;
        ctx.fillStyle = styles.backgroundColor || "#000000";
        
        const r = styles.borderRadius || 6;
        ctx.beginPath();
        if (typeof (ctx as any).roundRect === "function") {
          (ctx as any).roundRect(boxX, boxY, boxW, boxH, r);
        } else {
          ctx.rect(boxX, boxY, boxW, boxH);
        }
        ctx.fill();
        ctx.restore();
      }

      if (styles.strokeWidth > 0) {
        ctx.lineWidth = styles.strokeWidth * 2;
        ctx.strokeStyle = styles.strokeColor || "#000000";
        ctx.lineJoin = "round";
        ctx.strokeText(text, textX, textY);
      }

      ctx.fillStyle = styles.textColor || "#FFFFFF";
      ctx.fillText(text, textX, textY);

      ctx.restore();
    }
  };

  return new Promise(async (resolve, reject) => {
    try {
      recorder.start(100);

      if (videoElement) {
        videoElement.currentTime = startSec;
        videoElement.muted = true;
      }

      const fps = 25;
      const interval = 1 / fps;
      let cur = startSec;

      const step = async () => {
        if (cur >= endSec) {
          recorder.stop();
          return;
        }

        if (!isDemo && videoElement) {
          videoElement.currentTime = cur;
          await new Promise<void>((r) => {
            const onSeek = () => {
              videoElement?.removeEventListener("seeked", onSeek);
              r();
            };
            videoElement?.addEventListener("seeked", onSeek, { once: true });
            setTimeout(r, 80);
          });
        }

        renderFrameAt(cur);

        const progressPercent = Math.min(99, Math.round(((cur - startSec) / actualDuration) * 100));
        if (onProgress) {
          onProgress({
            percent: progressPercent,
            currentSecond: cur - startSec,
            totalSeconds: actualDuration,
            status: "rendering",
          });
        }

        cur += interval;
        setTimeout(step, isDemo ? 10 : 20);
      };

      recorder.onstop = () => {
        const sampleBlob = new Blob(recordedChunks, { type: mimeType });
        const blobUrl = URL.createObjectURL(sampleBlob);

        if (videoElement) {
          videoElement.currentTime = initialTime;
          videoElement.muted = initialMuted;
        }

        if (onProgress) {
          onProgress({
            percent: 100,
            currentSecond: actualDuration,
            totalSeconds: actualDuration,
            status: "completed",
            blobUrl,
          });
        }

        resolve(sampleBlob);
      };

      await step();
    } catch (err: any) {
      if (videoElement) {
        videoElement.currentTime = initialTime;
        videoElement.muted = initialMuted;
      }
      if (recorder.state === "recording") {
        recorder.stop();
      }
      reject(err);
    }
  });
}

