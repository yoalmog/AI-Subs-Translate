/**
 * Memory Diagnostic & Cache Release Manager
 * Monitors browser heap memory, tracks active Blob Object URLs,
 * and provides manual cache purging to prevent browser slowdowns.
 */

export interface MemoryStats {
  usedHeapMB: number | null;
  totalHeapMB: number | null;
  heapLimitMB: number | null;
  heapPercentage: number | null;
  activeObjectUrlsCount: number;
  estimatedCacheSizeMB: number;
  isSupported: boolean;
}

// Global registry of created Blob Object URLs
const activeObjectUrls = new Set<string>();

// Intercept window.URL.createObjectURL to automatically track object URLs
if (typeof window !== "undefined" && window.URL) {
  const originalCreate = window.URL.createObjectURL;
  const originalRevoke = window.URL.revokeObjectURL;

  window.URL.createObjectURL = function (obj: Blob | MediaSource): string {
    const url = originalCreate.call(window.URL, obj);
    activeObjectUrls.add(url);
    return url;
  };

  window.URL.revokeObjectURL = function (url: string): void {
    activeObjectUrls.delete(url);
    originalRevoke.call(window.URL, url);
  };
}

/**
 * Register a Blob Object URL manually in tracking
 */
export function registerTrackedObjectURL(url: string): void {
  if (url && url.startsWith("blob:")) {
    activeObjectUrls.add(url);
  }
}

/**
 * Revoke a tracked Blob Object URL manually
 */
export function revokeTrackedObjectURL(url: string): void {
  if (url && url.startsWith("blob:")) {
    try {
      window.URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
    activeObjectUrls.delete(url);
  }
}

/**
 * Get current browser memory statistics
 */
export function getMemoryStats(): MemoryStats {
  const perfMemory = (performance as any)?.memory;
  const activeCount = activeObjectUrls.size;

  if (perfMemory && typeof perfMemory.usedJSHeapSize === "number") {
    const usedMB = Math.round(perfMemory.usedJSHeapSize / (1024 * 1024));
    const totalMB = Math.round(perfMemory.totalJSHeapSize / (1024 * 1024));
    const limitMB = Math.round(perfMemory.jsHeapSizeLimit / (1024 * 1024));
    const percentage = Math.round((usedMB / limitMB) * 100);

    return {
      usedHeapMB: usedMB,
      totalHeapMB: totalMB,
      heapLimitMB: limitMB,
      heapPercentage: percentage,
      activeObjectUrlsCount: activeCount,
      estimatedCacheSizeMB: Math.round(activeCount * 8 + usedMB * 0.15),
      isSupported: true,
    };
  }

  // Fallback for browsers without performance.memory (e.g. Firefox/Safari)
  return {
    usedHeapMB: null,
    totalHeapMB: null,
    heapLimitMB: null,
    heapPercentage: null,
    activeObjectUrlsCount: activeCount,
    estimatedCacheSizeMB: activeCount * 8,
    isSupported: false,
  };
}

/**
 * Force clear application caches and release object URLs
 */
export function clearApplicationMemoryCache(): {
  revokedUrlsCount: number;
  freedMB: number;
} {
  const count = activeObjectUrls.size;
  const urlsToRevoke = Array.from(activeObjectUrls);

  urlsToRevoke.forEach((url) => {
    try {
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.warn("Failed revoking URL during memory purge:", e);
    }
  });

  activeObjectUrls.clear();

  // Dispatch global custom event for components to clear local canvas/image caches
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("app-clear-memory-cache"));

    // Attempt browser garbage collection if exposed (e.g. Chrome with flag)
    if (typeof (window as any).gc === "function") {
      try {
        (window as any).gc();
      } catch (e) {
        // ignore
      }
    }
  }

  return {
    revokedUrlsCount: count,
    freedMB: Math.max(5, count * 8),
  };
}
