import { SubtitleCue } from "../types";
import { formatTimeDisplay } from "./timeFormat";

/**
 * Escapes HTML characters to prevent XSS in the generated document
 */
function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Generates an elegant, high-contrast, print-ready HTML document for Cue List review / proofreading
 * with columns for 'Start Time' (זמן התחלה), 'End Time' (זמן סיום), and 'Hebrew Text' (טקסט בעברית).
 */
export function generateCueListPrintHtml(
  cues: SubtitleCue[],
  videoName: string = "video",
  targetLanguageName: string = "עברית"
): string {
  const sortedCues = [...cues].sort((a, b) => a.startTime - b.startTime);
  const now = new Date();
  const dateStr = now.toLocaleDateString("he-IL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const rowsHtml = sortedCues
    .map((cue, index) => {
      const startTime = formatTimeDisplay(cue.startTime, true);
      const endTime = formatTimeDisplay(cue.endTime, true);
      const duration = (cue.endTime - cue.startTime).toFixed(2);
      const hebrewText = escapeHtml(cue.hebrewText);
      const originalText = escapeHtml(cue.originalText);

      return `
        <tr>
          <td class="col-num">${index + 1}</td>
          <td class="col-time">${startTime}</td>
          <td class="col-time">${endTime}</td>
          <td class="col-duration">${duration}s</td>
          <td class="col-hebrew" dir="rtl">${hebrewText || '<span class="empty-text">(ריק)</span>'}</td>
          ${
            originalText && originalText !== hebrewText
              ? `<td class="col-original" dir="ltr">${originalText}</td>`
              : `<td class="col-original muted">-</td>`
          }
        </tr>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>רשימת כתוביות להגהה וסקירה - ${escapeHtml(videoName)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700;800&family=Heebo:wght@400;500;700&family=JetBrains+Mono:wght@500;700&display=swap');

    @page {
      size: A4 portrait;
      margin: 15mm 12mm 15mm 12mm;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      font-family: 'Assistant', 'Heebo', -apple-system, BlinkMacSystemFont, sans-serif;
      margin: 0;
      padding: 24px;
      color: #1a1a1a;
      background-color: #ffffff;
      font-size: 13px;
      line-height: 1.5;
    }

    .header-container {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 14px;
      margin-bottom: 20px;
    }

    .title-area h1 {
      margin: 0 0 4px 0;
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
    }

    .title-area p {
      margin: 0;
      font-size: 12px;
      color: #64748b;
    }

    .meta-area {
      text-align: left;
      font-size: 11px;
      color: #475569;
    }

    .meta-tag {
      display: inline-block;
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
      padding: 3px 8px;
      border-radius: 4px;
      font-weight: 700;
      font-size: 11px;
      margin-bottom: 4px;
    }

    .action-bar {
      display: flex;
      gap: 10px;
      margin-bottom: 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
      align-items: center;
      justify-content: space-between;
    }

    .btn-print {
      background: #2563eb;
      color: white;
      border: none;
      padding: 8px 18px;
      border-radius: 6px;
      font-family: inherit;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.2s;
    }

    .btn-print:hover {
      background: #1d4ed8;
    }

    .table-wrapper {
      width: 100%;
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      text-align: right;
    }

    thead th {
      background: #0f172a;
      color: #ffffff;
      padding: 10px 12px;
      font-weight: 700;
      font-size: 12px;
      letter-spacing: 0.2px;
      border: 1px solid #0f172a;
    }

    tbody td {
      padding: 8px 12px;
      border: 1px solid #e2e8f0;
      vertical-align: middle;
    }

    tbody tr:nth-child(even) {
      background-color: #f8fafc;
    }

    tbody tr:hover {
      background-color: #f1f5f9;
    }

    .col-num {
      width: 38px;
      text-align: center;
      font-weight: 700;
      color: #64748b;
    }

    .col-time {
      width: 95px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 600;
      color: #1e293b;
      direction: ltr;
      text-align: center;
      background: #fdfdfd;
    }

    .col-duration {
      width: 55px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      color: #64748b;
      direction: ltr;
      text-align: center;
    }

    .col-hebrew {
      font-weight: 600;
      color: #0f172a;
      font-size: 13.5px;
      line-height: 1.5;
    }

    .col-original {
      font-size: 11.5px;
      color: #64748b;
      max-width: 200px;
      word-break: break-word;
    }

    .muted {
      color: #cbd5e1;
      text-align: center;
    }

    .empty-text {
      color: #ef4444;
      font-style: italic;
      font-weight: normal;
    }

    .footer {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      color: #94a3b8;
      font-size: 11px;
    }

    @media print {
      body {
        padding: 0;
        font-size: 11px;
      }
      .action-bar, .no-print {
        display: none !important;
      }
      thead th {
        background: #1e293b !important;
        color: #ffffff !important;
      }
      tbody tr:nth-child(even) {
        background-color: #f8fafc !important;
      }
      tr {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="action-bar no-print">
    <div>
      <strong>מסמך PDF / הגהה מוכן להדפסה או שמירה.</strong> לחץ על הכפתור כדי לשמור כקובץ PDF דרך חלון ההדפסה של הדפדפן (בחר "Save as PDF" / "שמור כ-PDF").
    </div>
    <button class="btn-print" onclick="window.print()">
      🖨️ הדפס / שמור כ-PDF
    </button>
  </div>

  <div class="header-container">
    <div class="title-area">
      <h1>סקירה והגהת כתוביות (Subtitle Proofreading & Cue List)</h1>
      <p>שם הקובץ: <strong>${escapeHtml(videoName)}</strong> &bull; סך הכול כתוביות: <strong>${sortedCues.length}</strong></p>
    </div>
    <div class="meta-area">
      <div class="meta-tag">שפת יעד: ${escapeHtml(targetLanguageName)}</div>
      <div>תאריך: ${dateStr} ${timeStr}</div>
    </div>
  </div>

  <div class="table-wrapper">
    <table>
      <thead>
        <tr>
          <th class="col-num">#</th>
          <th class="col-time">זמן התחלה (Start Time)</th>
          <th class="col-time">זמן סיום (End Time)</th>
          <th class="col-duration">משך</th>
          <th class="col-hebrew">טקסט בעברית (Hebrew Text)</th>
          <th class="col-original">טקסט מקורי (Original)</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  </div>

  <div class="footer">
    <span>הופק באמצעות Subtitle AI Translator & Editor</span>
    <span>עמוד 1 מתוך מסמך כתוביות</span>
  </div>

  <script>
    // Auto-trigger print dialog after slight rendering delay if query param set
    window.addEventListener('load', () => {
      if (window.location.search.includes('autoprint=true')) {
        setTimeout(() => window.print(), 350);
      }
    });
  </script>
</body>
</html>`;
}

/**
 * Open the Cue List PDF export in a new tab / print preview dialog
 */
export function exportCueListAsPdf(
  cues: SubtitleCue[],
  videoName: string = "video",
  targetLanguageName: string = "עברית"
): void {
  const htmlContent = generateCueListPrintHtml(cues, videoName, targetLanguageName);
  const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  
  const printWindow = window.open(url, "_blank");
  if (!printWindow) {
    // If popup blocked, create a temporary download link
    const a = document.createElement("a");
    a.href = url;
    a.download = `${videoName.replace(/\.[^/.]+$/, "")}_cues_proofreading.html`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 2000);
  }
}
