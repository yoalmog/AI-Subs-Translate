import { renderDemoFrame } from "./demoVideoGenerator";

export interface SampledFrame {
  timestamp: number;
  dataUrl: string;
}

export interface VideoFrameSource {
  type: "video" | "demo";
  videoElement?: HTMLVideoElement | null;
  demoId?: string;
  duration?: number;
}

/**
 * Capture a single snapshot frame from a video element at its current time.
 */
export function captureVideoFrame(
  video: HTMLVideoElement,
  maxWidth: number = 480,
  quality: number = 0.70
): string {
  try {
    const canvas = document.createElement("canvas");
    const origW = video.videoWidth || video.clientWidth || 640;
    const origH = video.videoHeight || video.clientHeight || 360;
    const scale = Math.min(1, maxWidth / Math.max(1, origW));
    const width = Math.max(240, Math.floor(origW * scale));
    const height = Math.max(135, Math.floor(origH * scale));

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return "";

    ctx.drawImage(video, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", quality);
  } catch (err) {
    console.warn("Failed to capture video frame:", err);
    return "";
  }
}

/**
 * Capture a single snapshot frame from a demo scene at a specific time.
 */
export function captureDemoFrame(
  demoId: string,
  time: number,
  maxWidth: number = 480,
  quality: number = 0.70
): string {
  const canvas = document.createElement("canvas");
  const width = maxWidth;
  const height = Math.round((maxWidth * 9) / 16);
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  renderDemoFrame(ctx, demoId, width, height, time);
  return canvas.toDataURL("image/jpeg", quality);
}

/**
 * Sample sequential frames from a video source across its duration with complete coverage
 */
export async function sampleVideoFrames(
  source: VideoFrameSource | HTMLVideoElement,
  intervalSeconds: number = 1.0,
  onProgress?: (current: number, total: number, timestamp: number) => void,
  maxFrames: number = 24,
  signal?: AbortSignal
): Promise<SampledFrame[]> {
  // Normalize source
  let isDemo = false;
  let demoId = "demo-space";
  let videoElem: HTMLVideoElement | null = null;
  let duration = 10;

  if (source instanceof HTMLVideoElement) {
    videoElem = source;
    duration = source.duration && isFinite(source.duration) ? source.duration : 10;
  } else if (source.type === "demo") {
    isDemo = true;
    demoId = source.demoId || "demo-space";
    duration = source.duration && isFinite(source.duration) ? source.duration : 10;
  } else {
    videoElem = source.videoElement || null;
    const dur = source.duration || videoElem?.duration;
    duration = dur && isFinite(dur) ? dur : 10;
  }

  // Calculate timestamps adaptively across the duration so no subtitles are skipped
  const timestamps: number[] = [];
  
  // Choose step interval based on video duration to get full dialogue coverage
  let step = 1.0;
  if (duration <= 12) {
    step = 0.8; // Dense sampling for short clips
  } else if (duration <= 30) {
    step = 1.1; // Moderate sampling
  } else if (duration <= 60) {
    step = 1.6;
  } else {
    step = Math.max(1.8, duration / 36);
  }

  // Generate timestamps from 0.4s to end
  for (let t = 0.4; t < duration; t += step) {
    timestamps.push(parseFloat(t.toFixed(2)));
    if (timestamps.length >= maxFrames) break;
  }

  // Ensure near-end portion is included
  if (duration > 2) {
    const lastT = parseFloat(Math.max(0.5, duration - 0.6).toFixed(2));
    if (!timestamps.some((t) => Math.abs(t - lastT) < 0.6) && timestamps.length < maxFrames) {
      timestamps.push(lastT);
    }
  }

  // Sort timestamps chronologically
  timestamps.sort((a, b) => a - b);

  const frames: SampledFrame[] = [];

  // FAST PATH: Demo Scene (Instant sampling, 0ms seek latency, 100% reliable)
  if (isDemo) {
    for (let i = 0; i < timestamps.length; i++) {
      if (signal?.aborted) {
        throw new Error("Sampling cancelled by user");
      }
      const time = timestamps[i];
      const dataUrl = captureDemoFrame(demoId, time, 640, 0.82);
      if (dataUrl) {
        frames.push({ timestamp: time, dataUrl });
      }
      if (onProgress) {
        onProgress(i + 1, timestamps.length, time);
      }
      // Quick tick for visual smoothness
      await new Promise((r) => setTimeout(r, 12));
    }
    return frames;
  }

  // VIDEO ELEMENT PATH (for user uploaded files)
  if (!videoElem) {
    throw new Error("לא נמצא נגן וידאו פעיל לדגימת פריימים");
  }

  const originalTime = videoElem.currentTime;
  const originalPaused = videoElem.paused;

  if (!videoElem.paused) {
    videoElem.pause();
  }

  const seekTo = (time: number): Promise<void> => {
    return new Promise((resolve) => {
      if (signal?.aborted) return resolve();

      let timeoutId: any = null;
      const finish = () => {
        if (timeoutId) clearTimeout(timeoutId);
        videoElem?.removeEventListener("seeked", finish);
        videoElem?.removeEventListener("canplay", finish);
        resolve();
      };

      // 1500ms safety timeout to handle mobile video decoder seek latency
      timeoutId = setTimeout(finish, 1500);

      videoElem?.addEventListener("seeked", finish, { once: true });
      videoElem?.addEventListener("canplay", finish, { once: true });
      if (videoElem) {
        try {
          videoElem.currentTime = Math.max(0, Math.min(time, duration));
        } catch (e) {
          finish();
        }
      }
    });
  };

  try {
    for (let i = 0; i < timestamps.length; i++) {
      if (signal?.aborted) {
        throw new Error("Sampling cancelled by user");
      }

      const time = timestamps[i];
      await seekTo(time);

      if (signal?.aborted) {
        throw new Error("Sampling cancelled by user");
      }

      // Settle time for hardware frame buffer decoding on mobile
      await new Promise((r) => setTimeout(r, 60));

      const dataUrl = captureVideoFrame(videoElem, 480, 0.70);
      if (dataUrl) {
        frames.push({
          timestamp: time,
          dataUrl,
        });
      }

      if (onProgress) {
        onProgress(i + 1, timestamps.length, time);
      }
    }
  } finally {
    try {
      if (videoElem) {
        videoElem.currentTime = originalTime;
        if (!originalPaused) {
          videoElem.play().catch(() => {});
        }
      }
    } catch (e) {
      // Ignore cleanup error
    }
  }

  return frames;
}
