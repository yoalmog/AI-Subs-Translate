export interface SafeFetchResult<T = any> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
}

/**
 * Safely fetches an API route and parses JSON without throwing native SyntaxErrors
 * on HTML error pages (e.g. 504 Gateway Timeout, 502 Bad Gateway, 404 HTML).
 */
export async function safeFetchJson<T = any>(
  url: string,
  options?: RequestInit
): Promise<SafeFetchResult<T>> {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get("content-type") || "";
    const text = await res.text();

    const isJson =
      contentType.includes("application/json") ||
      text.trim().startsWith("{") ||
      text.trim().startsWith("[");

    if (isJson) {
      try {
        const data = JSON.parse(text) as T;
        return {
          ok: res.ok && !(data as any)?.error,
          status: res.status,
          data,
          error: (data as any)?.error || (!res.ok ? `שגיאת שרת (${res.status})` : undefined),
        };
      } catch (jsonErr) {
        return {
          ok: false,
          status: res.status,
          data: null,
          error: "תגובת השרת לא הייתה בפורמט JSON תקין.",
        };
      }
    }

    // HTML response (e.g. 504 / 502 / 404 proxy page)
    const isTimeout = res.status === 504 || res.status === 502;
    const errorMsg = isTimeout
      ? "שרת ה-AI חווה עומס זמני או תפוס. מנגנון הגיבוי המקומי מופעל."
      : `שרת ה-API החזיר תגובה לא צפויה (סטטוס: ${res.status}).`;

    return {
      ok: false,
      status: res.status,
      data: null,
      error: errorMsg,
    };
  } catch (err: any) {
    if (err.name === "AbortError" || err.message?.includes("cancelled")) {
      throw err;
    }
    return {
      ok: false,
      status: 0,
      data: null,
      error: err.message || "שגיאת תקשורת ברשת.",
    };
  }
}
