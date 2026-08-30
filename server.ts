import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Middleware for parsing JSON with a generous limit for base64 frame images
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Express JSON parsing error handler to return clean JSON error instead of HTML
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err && (err.type === "entity.too.large" || err.status === 413)) {
    return res.status(413).json({ error: "גודל הבקשה חורג מהמגבלה המותרת. אנא נסה לדגום פחות פריימים." });
  }
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ error: "פורמט בקשת ה-JSON שגוי." });
  }
  next(err);
});

// Lazy/Safe Gemini SDK initialization
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error("מפתח GEMINI_API_KEY אינו מוגדר בשרת. אנא הגדר את המפתח בהגדרות המערכת.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

/**
 * Execute Gemini generateContent with automatic multi-model fallback and retry on 503 / 429 / UNAVAILABLE
 */
async function generateContentWithResilience(
  ai: GoogleGenAI,
  models: string[],
  requestGenerator: (model: string) => any
) {
  let lastError: any = null;

  // Attempt up to 2 full passes across candidate models
  for (let pass = 1; pass <= 2; pass++) {
    for (const model of models) {
      try {
        const reqConfig = requestGenerator(model);
        const response = await ai.models.generateContent({
          model,
          ...reqConfig,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const errMsg = String(err?.message || "");
        const status = err?.status || err?.code;
        const is503 =
          errMsg.includes("503") ||
          errMsg.includes("high demand") ||
          errMsg.includes("UNAVAILABLE") ||
          status === 503;

        const is429 =
          errMsg.includes("429") ||
          errMsg.includes("RESOURCE_EXHAUSTED") ||
          errMsg.includes("quota") ||
          status === 429;

        console.warn(`[Pass ${pass}] Gemini model ${model} encountered error (${status || "unknown"}):`, errMsg.substring(0, 150));

        // Immediately try the next candidate model in the pool
        continue;
      }
    }

    // If pass 1 across all models failed with transient 503/429, wait 1.2 seconds before pass 2
    if (pass === 1) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  }

  throw lastError || new Error("Failed to process with Gemini models");
}

// Analyze video frames for hardcoded subtitles & translate to target language (default Hebrew)
app.post("/api/analyze-frames", async (req, res) => {
  try {
    const { frames, videoDuration, languageHint, targetLanguage = "Hebrew" } = req.body;

    if (!frames || !Array.isArray(frames) || frames.length === 0) {
      return res.status(400).json({ error: "No video frames provided for analysis." });
    }

    // Filter out invalid/empty frame data URLs
    const validFrames = frames.filter(
      (f: any) => f && f.dataUrl && typeof f.dataUrl === "string" && f.dataUrl.length > 100
    );

    if (validFrames.length === 0) {
      return res.status(400).json({ error: "כל הפריימים שנדגמו היו ריקים או בלתי תקינים." });
    }

    const ai = getGeminiClient();

    // Prepare multimodal parts: Frame images with metadata and timestamps
    const parts: any[] = [];

    // System instruction / prompt for OCR and translation
    const promptText = `
You are a high-accuracy video subtitle OCR recognition and ${targetLanguage} localization engine.
The user provided ${validFrames.length} sequential frame snapshots sampled chronologically from a video (duration: ~${videoDuration || "unknown"}s).

TASK & STRICT RULES:
1. Thoroughly inspect EVERY SINGLE frame snapshot from Frame #1 to Frame #${validFrames.length}.
2. Detect, transcribe, and extract ALL burned-in subtitles, captions, and on-screen dialogue visible on any frame (in any source language: Spanish, English, French, Arabic, Russian, Japanese, German, etc.).
3. EXHAUSTIVE COVERAGE: Do NOT skip, omit, or truncate any subtitle sentences. Capture the full spoken dialogue from the beginning of the clip to the end.
4. TIMING & MERGING:
   - For consecutive frames showing the same subtitle line, merge them into a single cue: startTime = first frame timestamp, endTime = last frame timestamp + 0.8s.
   - For separate/different subtitle lines, generate distinct sequential cues.
5. ${targetLanguage.toUpperCase()} LOCALIZATION:
   - Provide a natural, grammatically correct, idiomatic ${targetLanguage} translation for every single subtitle line in the 'hebrewText' property.
   - Ensure the translated text accurately reflects the meaning and tone of the original dialogue.
6. If no on-screen subtitles/captions are visible in the provided frames, return an empty array [].

Return a valid JSON array of objects with keys:
- startTime (number in seconds)
- endTime (number in seconds)
- originalText (string with the exact original detected words)
- hebrewText (string with the fluent modern translation in ${targetLanguage})
- detectedLanguage (string, e.g. "Spanish", "English", "French")
- position: { bottomPercent: number, heightPercent: number }
`;

    parts.push({ text: promptText });

    for (let i = 0; i < validFrames.length; i++) {
      const frame = validFrames[i];
      parts.push({
        text: `[Frame #${i + 1} at ${Number(frame.timestamp).toFixed(2)}s]:`,
      });

      // Strip mime prefix if present
      let base64Data = frame.dataUrl;
      let mimeType = "image/jpeg";
      if (base64Data.includes(";base64,")) {
        const matches = base64Data.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
        if (matches) {
          mimeType = matches[1];
          base64Data = matches[2];
        }
      }

      parts.push({
        inlineData: {
          mimeType,
          data: base64Data,
        },
      });
    }

    // Standard Gemini candidate models with high-availability flash
    const candidateModels = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];

    const response = await generateContentWithResilience(
      ai,
      candidateModels,
      (model) => {
        const config: any = {
          systemInstruction:
            `You are a specialized video subtitle recognition and ${targetLanguage} translator system. Always return a valid JSON array.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            description: "List of detected and translated subtitle cues",
            items: {
              type: Type.OBJECT,
              properties: {
                startTime: {
                  type: Type.NUMBER,
                  description: "Start timestamp in seconds",
                },
                endTime: {
                  type: Type.NUMBER,
                  description: "End timestamp in seconds",
                },
                originalText: {
                  type: Type.STRING,
                  description: "The original detected hardcoded subtitle text",
                },
                hebrewText: {
                  type: Type.STRING,
                  description: `Accurate, natural ${targetLanguage} translation of the subtitle`,
                },
                detectedLanguage: {
                  type: Type.STRING,
                  description: "Detected source language (e.g. Spanish, English, French)",
                },
                position: {
                  type: Type.OBJECT,
                  description: "Estimated bounding area of the original hardcoded subtitle",
                  properties: {
                    bottomPercent: {
                      type: Type.NUMBER,
                      description: "Distance from bottom of video as percentage (e.g. 8 for 8%)",
                    },
                    heightPercent: {
                      type: Type.NUMBER,
                      description: "Height of subtitle area as percentage (e.g. 12 for 12%)",
                    },
                  },
                },
              },
              required: ["startTime", "endTime", "originalText", "hebrewText"],
            },
          },
        };

        return {
          contents: { parts },
          config,
        };
      }
    );

    let rawText = response.text || "[]";
    // Strip markdown code fences if model enclosed JSON
    rawText = rawText.trim().replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```$/, "").trim();

    let cues: any[] = [];
    try {
      const parsed = JSON.parse(rawText);
      cues = Array.isArray(parsed) ? parsed : parsed.cues || [];
    } catch (e) {
      console.warn("JSON parse warning, trying fallback regex:", e);
      const matches = rawText.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (matches) {
        try {
          cues = JSON.parse(matches[0]);
        } catch (err) {
          cues = [];
        }
      }
    }

    // Format and sanitize cues
    const formattedCues = cues
      .filter((c) => c && (c.hebrewText || c.originalText))
      .map((cue: any, idx: number) => {
        const start = Math.max(0, Number(cue.startTime) || 0);
        let end = Math.max(start + 0.6, Number(cue.endTime) || start + 2.5);
        if (videoDuration && end > videoDuration) {
          end = videoDuration;
        }

        return {
          id: `cue-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
          startTime: parseFloat(start.toFixed(2)),
          endTime: parseFloat(end.toFixed(2)),
          originalText: String(cue.originalText || "").trim(),
          hebrewText: String(cue.hebrewText || cue.originalText || "").trim(),
          detectedLanguage: cue.detectedLanguage || "Detected",
          position: {
            bottomPercent:
              typeof cue.position?.bottomPercent === "number" ? cue.position.bottomPercent : 8,
            heightPercent:
              typeof cue.position?.heightPercent === "number" ? cue.position.heightPercent : 12,
          },
          confidence: 0.95,
        };
      })
      .sort((a, b) => a.startTime - b.startTime);

    res.json({
      success: true,
      cues: formattedCues,
      count: formattedCues.length,
    });
  } catch (error: any) {
    console.error("Error analyzing video frames:", error);
    const errMsg = String(error?.message || "");
    const is429 = errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("quota");
    const is503 = errMsg.includes("503") || errMsg.includes("high demand") || errMsg.includes("UNAVAILABLE");
    const status = is429 ? 429 : is503 ? 503 : 500;
    
    let userMessage = error?.message || "שגיאה בניתוח הפריימים ותרגום הכתוביות.";
    if (is429) {
      userMessage = "הגעת למגבלת קצב רגעית של ה-AI. אנא המתן מספר שניות ולחץ 'נסה שוב'.";
    } else if (is503) {
      userMessage = "שרת ה-AI חווה עומס רגעי זמני. אנא המתן 2-3 שניות ולחץ 'נסה שוב'.";
    } else if (errMsg.includes('{"error"')) {
      try {
        const parsed = JSON.parse(errMsg);
        if (parsed.error?.code === 503 || parsed.error?.status === "UNAVAILABLE") {
          userMessage = "שרת ה-AI חווה עומס רגעי זמני. אנא המתן 2-3 שניות ולחץ 'נסה שוב'.";
        }
      } catch (_) {}
    }

    res.status(status).json({
      error: userMessage,
    });
  }
});

// Helper to describe tone instructions for Gemini
function getToneInstruction(tone?: string, targetLanguage: string = "Hebrew"): string {
  if (!tone) return `Ensure natural, idiomatic, and modern phrasing in ${targetLanguage}.`;
  const toneLower = tone.toLowerCase();
  if (toneLower === "formal") {
    return `Tone Preference: FORMAL (רשמי/גבוה). Use polite, refined, polished, and grammatically elevated phrasing suitable for news, documentaries, or formal speech in ${targetLanguage}. Avoid street slang and overly casual colloquialisms.`;
  }
  if (toneLower === "informal") {
    return `Tone Preference: INFORMAL (יומיומי/סלנג קל). Use natural, conversational, friendly everyday speech with contemporary colloquial expressions in ${targetLanguage} suitable for movies, vlogs, comedy, and casual conversation.`;
  }
  if (toneLower === "literal") {
    return `Tone Preference: LITERAL (מילולי ומדויק). Translate as close as possible word-for-word and structurally to the original text while maintaining basic grammatical correctness in ${targetLanguage}. Preserve specific technical terms and original phrasing without creative paraphrasing.`;
  }
  return `Tone Preference: ${tone}. Ensure natural, idiomatically accurate translation in ${targetLanguage}.`;
}

// Re-translate or refine a specific subtitle or text
app.post("/api/translate-text", async (req, res) => {
  try {
    const { text, context, tone = "informal", targetLanguage = "Hebrew" } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Text is required for translation." });
    }

    const ai = getGeminiClient();
    const candidateModels = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
    const toneGuideline = getToneInstruction(tone, targetLanguage);

    const response = await generateContentWithResilience(
      ai,
      candidateModels,
      (model) => {
        const config: any = {
          temperature: tone?.toLowerCase() === "literal" ? 0.0 : 0.2,
        };
        return {
          contents: `
Translate the following subtitle text into ${targetLanguage}.
${context ? `Video context / timestamp context: "${context}"` : ""}
${toneGuideline}

Original Text: "${text}"

Rules:
1. Provide ONLY the ${targetLanguage} translation text. No quotes, explanations or brackets.
2. Keep it concise and natural as a screen subtitle.
3. Adhere strictly to the requested tone (${tone}).
`,
          config,
        };
      }
    );

    const translatedText = (response.text || "").trim().replace(/^["']|["']$/g, "") || text;

    res.json({
      success: true,
      originalText: text,
      hebrewText: translatedText,
      targetLanguage,
      tone,
    });
  } catch (error: any) {
    console.error("Error translating text:", error);
    const errMsg = String(error?.message || "");
    const is429 = errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("quota");
    const is503 = errMsg.includes("503") || errMsg.includes("high demand") || errMsg.includes("UNAVAILABLE");
    const status = is429 ? 429 : is503 ? 503 : 500;
    const userMessage = is429
      ? "מגבלת בקשות זמנית. אנא המתן מספר שניות ונסה שוב."
      : is503
      ? "שרת ה-AI חווה עומס רגעי זמני. אנא נסה שוב בעוד מספר שניות."
      : error.message || "שגיאה בתרגום הטקסט.";

    res.status(status).json({
      error: userMessage,
    });
  }
});

// Bulk/Batch translate multiple cues at once
app.post("/api/batch-translate", async (req, res) => {
  try {
    const { items, tone = "informal", targetLanguage = "Hebrew" } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "No items provided for batch translation." });
    }

    const ai = getGeminiClient();
    const candidateModels = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
    const toneGuideline = getToneInstruction(tone, targetLanguage);

    // Format list of cues for translation
    const itemsToTranslate = items.map((item, index) => ({
      index,
      id: item.id || `item-${index}`,
      sourceText: item.originalText || item.text || "",
    }));

    const response = await generateContentWithResilience(
      ai,
      candidateModels,
      (model) => {
        const config: any = {
          systemInstruction: `You are a professional subtitle translator. Translate all input subtitle lines into ${targetLanguage}.
${toneGuideline}
Return a JSON array matching the inputs.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            description: "List of translated subtitle items",
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                translatedText: { type: Type.STRING, description: `The fluent ${targetLanguage} translation in ${tone} tone` },
              },
              required: ["id", "translatedText"],
            },
          },
        };

        const contents = `
Translate each of the following subtitle lines into ${targetLanguage} matching the ${tone} style/tone:
${JSON.stringify(itemsToTranslate, null, 2)}

Provide concise, context-aware translations suitable for video subtitles.
`;

        return {
          contents,
          config,
        };
      }
    );

    let rawText = response.text || "[]";
    rawText = rawText.trim().replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```$/, "").trim();

    let translations: any[] = [];
    try {
      translations = JSON.parse(rawText);
    } catch (e) {
      console.warn("Batch JSON parse warning:", e);
      const matches = rawText.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (matches) {
        try {
          translations = JSON.parse(matches[0]);
        } catch (_) {}
      }
    }

    // Build translation map
    const resultMap: Record<string, string> = {};
    if (Array.isArray(translations)) {
      translations.forEach((t) => {
        if (t && t.id && t.translatedText) {
          resultMap[t.id] = String(t.translatedText).trim();
        }
      });
    }

    res.json({
      success: true,
      translations: resultMap,
      count: Object.keys(resultMap).length,
      targetLanguage,
    });
  } catch (error: any) {
    console.error("Error in batch translation:", error);
    const errMsg = String(error?.message || "");
    const is429 = errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("quota");
    const is503 = errMsg.includes("503") || errMsg.includes("high demand") || errMsg.includes("UNAVAILABLE");
    const status = is429 ? 429 : is503 ? 503 : 500;
    const userMessage = is429
      ? "מגבלת בקשות זמנית. אנא המתן מספר שניות ונסה שוב."
      : is503
      ? "שרת ה-AI חווה עומס רגעי זמני. אנא נסה שוב בעוד מספר שניות."
      : error.message || "שגיאה בתרגום מרוכז.";

    res.status(status).json({
      error: userMessage,
    });
  }
});

// In-memory download cache for iframe-safe server downloads
const downloadCache = new Map<string, { buffer: Buffer; filename: string; mimeType: string; expiresAt: number }>();

// Clean up expired downloads periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, item] of downloadCache.entries()) {
    if (item.expiresAt < now) {
      downloadCache.delete(key);
    }
  }
}, 60000);

// Prepare a downloadable file on the server
app.post("/api/prepare-download", (req, res) => {
  try {
    const { base64Data, filename, mimeType } = req.body;
    if (!base64Data || !filename) {
      return res.status(400).json({ error: "Missing file data or filename." });
    }

    const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(cleanBase64, "base64");
    const downloadToken = `dl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    downloadCache.set(downloadToken, {
      buffer,
      filename,
      mimeType: mimeType || "application/octet-stream",
      expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutes TTL
    });

    res.json({
      success: true,
      downloadUrl: `/api/download-file/${downloadToken}`,
    });
  } catch (error: any) {
    console.error("Error preparing download:", error);
    res.status(500).json({ error: "Failed to prepare download." });
  }
});

// Download endpoint with proper Content-Disposition header
app.get("/api/download-file/:token", (req, res) => {
  const { token } = req.params;
  const item = downloadCache.get(token);

  if (!item) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html dir="rtl">
        <head><meta charset="utf-8"><title>קישור ההורדה פג תוקף</title></head>
        <body style="font-family:sans-serif;text-align:center;padding:50px;background:#111;color:#eee;">
          <h2>קישור ההורדה פג תוקף</h2>
          <p>אנא חזור לאפליקציה ולחץ על כפתור הייצוא מחדש.</p>
        </body>
      </html>
    `);
  }

  // Encode filename for RFC 5987 / UTF-8 support
  const encodedFilename = encodeURIComponent(item.filename);

  res.setHeader("Content-Type", item.mimeType);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${item.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}"; filename*=UTF-8''${encodedFilename}`
  );
  res.setHeader("Content-Length", item.buffer.length);
  res.send(item.buffer);
});

// Explicit 404 handler for any unmatched /api/* routes so they never fall through to Vite SPA index.html
app.all("/api/*", (req, res) => {
  res.status(404).json({ error: `API route ${req.method} ${req.path} not found` });
});

// API Error Handler
app.use("/api", (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("API Error:", err);
  res.status(err.status || 500).json({
    error: err.message || "שגיאה פנימית בשרת ה-API.",
  });
});

// Vite middleware & Static Serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Subtitle Translation Server running on http://0.0.0.0:${PORT}`);
  });

  // Set 2 minute timeout for long-running multimodal Gemini analysis
  server.setTimeout(120000);
}

startServer();
