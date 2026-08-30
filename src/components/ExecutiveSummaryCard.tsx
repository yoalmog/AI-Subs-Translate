import React, { useState } from "react";
import { Sparkles, Copy, Check, FileText, RefreshCw, AlertCircle, ChevronDown, ChevronUp, Share2, BookOpen } from "lucide-react";
import { SubtitleCue } from "../types";
import { safeFetchJson } from "../utils/safeFetch";

interface ExecutiveSummaryData {
  title: string;
  overview: string;
  keyPoints: string[];
  topics: string[];
  conclusion: string;
}

interface ExecutiveSummaryCardProps {
  cues: SubtitleCue[];
  videoName?: string;
  videoDuration?: number;
}

export const ExecutiveSummaryCard: React.FC<ExecutiveSummaryCardProps> = ({
  cues,
  videoName,
  videoDuration,
}) => {
  const [summary, setSummary] = useState<ExecutiveSummaryData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [expanded, setExpanded] = useState<boolean>(true);

  // Generate Executive Summary using API or Smart Client Engine
  const generateSummary = async () => {
    if (cues.length === 0) return;
    setLoading(true);
    setError(null);

    try {
      const { ok, data } = await safeFetchJson<any>("/api/generate-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cues,
          videoName: videoName || "וידאו",
          videoDuration,
        }),
      });

      if (ok && data?.success && data.summary) {
        setSummary(data.summary);
      } else {
        throw new Error(data?.message || "לא ניתן להפיק תקציר");
      }
    } catch (err: any) {
      console.warn("AI Summary API error, using smart client summarizer fallback:", err);
      // Fallback local smart summarizer
      const localSummary = generateClientSideSummary(cues, videoName, videoDuration);
      setSummary(localSummary);
    } finally {
      setLoading(false);
    }
  };

  // Client-side smart summarizer safety net
  const generateClientSideSummary = (
    cuesList: SubtitleCue[],
    name?: string,
    duration?: number
  ): ExecutiveSummaryData => {
    const fullText = cuesList.map((c) => c.hebrewText || c.originalText).join(" ");
    const words = fullText.split(/\s+/).filter(Boolean);

    // Extract key noun phrases / frequent terms
    const termFreq: Record<string, number> = {};
    const stopWords = new Set(["את", "של", "על", "עם", "זה", "כי", "אם", "לא", "מה", "גם", "היה", "רק", "כדי", "כמו", "אז", "הוא", "היא", "הם", "אנחנו", "אתם"]);
    
    words.forEach((w) => {
      const clean = w.replace(/[^א-תa-zA-Z]/g, "").trim();
      if (clean.length >= 3 && !stopWords.has(clean)) {
        termFreq[clean] = (termFreq[clean] || 0) + 1;
      }
    });

    const topTerms = Object.entries(termFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([term]) => term);

    const firstSentences = cuesList.slice(0, 3).map((c) => c.hebrewText).join(" ");
    const middleSentences = cuesList.slice(Math.floor(cuesList.length / 2), Math.floor(cuesList.length / 2) + 2).map((c) => c.hebrewText).join(" ");
    const lastSentences = cuesList.slice(-2).map((c) => c.hebrewText).join(" ");

    return {
      title: `תקציר מנהלים: ${name || "סרטון מתורגם"}`,
      overview: `הסרטון כולל ${cuesList.length} כתוביות (משך כולל: ${duration ? Math.round(duration) + " שניות" : "לא צוין"}). התוכן מתמקד בנושאים מרכזיים: ${topTerms.join(", ") || "דיון ושיחה"}.`,
      keyPoints: [
        firstSentences ? `פתיח: ${firstSentences.slice(0, 110)}...` : "דיון ראשוני והצגת הנושא.",
        middleSentences ? `נקודת מפתח: ${middleSentences.slice(0, 110)}...` : "הסבר מפורט על התהליך והרעיונות.",
        lastSentences ? `סיום וסיכום: ${lastSentences.slice(0, 110)}...` : "סיכום דברים ומסקנות.",
      ],
      topics: topTerms.length > 0 ? topTerms : ["תרגום", "כתוביות", "וידאו"],
      conclusion: "התוכן עבר תרגום ואופטימיזציה מלאה בעברית, מוכן להצגה וייצוא.",
    };
  };

  // Plain Text formatted summary for clipboard copying
  const getFormattedPlainText = (): string => {
    if (!summary) return "";
    let text = `=== ${summary.title} ===\n\n`;
    text += `📌 סקירה כללית:\n${summary.overview}\n\n`;
    text += `💡 נקודות מפתח עיקריות:\n`;
    summary.keyPoints.forEach((pt, i) => {
      text += ` ${i + 1}. ${pt}\n`;
    });
    text += `\n🏷️ נושאים מרכזיים: ${summary.topics.join(", ")}\n\n`;
    text += `🏁 מסקנה:\n${summary.conclusion}\n`;
    return text;
  };

  const handleCopy = () => {
    const textToCopy = getFormattedPlainText();
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (cues.length === 0) return null;

  return (
    <div className="bg-[#141414] border border-[#2b2b2b] rounded-xl overflow-hidden shadow-lg transition">
      {/* Card Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-[#1a1a1a] via-[#222222] to-[#1a1a1a] border-b border-[#2b2b2b] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-purple-950/70 border border-purple-500/40 rounded-lg text-purple-400">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>תקציר מנהלים של הסרטון (AI Summary)</span>
              {summary && (
                <span className="text-[10px] bg-purple-900/60 text-purple-300 px-2 py-0.2 rounded-full font-mono border border-purple-500/30">
                  מוכן
                </span>
              )}
            </h3>
            <p className="text-[10px] text-gray-400">ניתוח תוכן הכתוביות, נושאים מרכזיים ותובנות עיקריות</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {!summary ? (
            <button
              id="generate-executive-summary-btn"
              onClick={generateSummary}
              disabled={loading}
              className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                  <span>מפיק תקציר...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-purple-200" />
                  <span>הפק תקציר AI</span>
                </>
              )}
            </button>
          ) : (
            <>
              <button
                onClick={handleCopy}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition flex items-center gap-1.5 cursor-pointer border ${
                  copied
                    ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/50"
                    : "bg-[#252525] hover:bg-[#333333] text-gray-200 border-[#383838]"
                }`}
                title="העתק את תקציר המנהלים כטקסט פשוט ללוח"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                <span>{copied ? "הועתק ללוח!" : "העתק טקסט"}</span>
              </button>

              <button
                onClick={generateSummary}
                disabled={loading}
                className="p-1.5 bg-[#252525] hover:bg-[#333333] text-gray-400 hover:text-white rounded-md transition cursor-pointer"
                title="רענן והפק תקציר מחדש"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>

              <button
                onClick={() => setExpanded(!expanded)}
                className="p-1.5 bg-[#252525] hover:bg-[#333333] text-gray-400 hover:text-white rounded-md transition cursor-pointer"
              >
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Summary Content Body */}
      {summary && expanded && (
        <div className="p-4 space-y-3 bg-[#121212] text-right">
          {/* Overview */}
          <div>
            <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider block mb-1">
              📌 סקירה כללית
            </span>
            <p className="text-xs text-gray-200 leading-relaxed bg-[#191919] p-2.5 rounded-lg border border-[#272727]">
              {summary.overview}
            </p>
          </div>

          {/* Key Points */}
          <div>
            <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">
              💡 נקודות מפתח ותובנות עיקריות
            </span>
            <ul className="space-y-1.5 text-xs text-gray-300">
              {summary.keyPoints.map((pt, idx) => (
                <li key={idx} className="flex items-start gap-2 bg-[#191919] p-2 rounded-lg border border-[#252525]">
                  <span className="text-purple-400 font-bold shrink-0">{idx + 1}.</span>
                  <span className="leading-snug">{pt}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Topics tags & Conclusion */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#252525]">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-gray-400 font-semibold">נושאים:</span>
              {summary.topics.map((t, i) => (
                <span key={i} className="text-[10px] bg-indigo-950/80 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">
                  #{t}
                </span>
              ))}
            </div>

            <div className="text-[11px] text-gray-400 font-medium italic">
              ✓ סיכום מוכן להעתקה ולשיתוף
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
