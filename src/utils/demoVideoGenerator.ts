import { SubtitleCue } from "../types";

export interface DemoVideoData {
  id: string;
  title: string;
  description: string;
  duration: string;
  durationSeconds: number;
  language: string;
  sampleCues: SubtitleCue[];
  renderScene: (ctx: CanvasRenderingContext2D, width: number, height: number, time: number) => void;
}

export const DEMO_CONFIGS: DemoVideoData[] = [
  {
    id: "demo-space",
    title: "מסע בחלל: חקר היקום (כתוביות באנגלית)",
    description: "סרטון חלל מרהיב עם כתוביות מוטמעות באנגלית על גלקסיות וחקר כוכבים.",
    duration: "00:10",
    durationSeconds: 10,
    language: "English",
    sampleCues: [
      {
        id: "cue-space-1",
        startTime: 0.5,
        endTime: 3.3,
        originalText: "The universe is vast and full of hidden wonders.",
        hebrewText: "היקום עצום ומלא בפלאים נסתרים.",
        detectedLanguage: "English",
        position: { bottomPercent: 8, heightPercent: 12 },
      },
      {
        id: "cue-space-2",
        startTime: 3.6,
        endTime: 6.6,
        originalText: "Telescopes capture light from billions of years ago.",
        hebrewText: "טלסקופים קולטים אור שנפלט לפני מיליארדי שנים.",
        detectedLanguage: "English",
        position: { bottomPercent: 8, heightPercent: 12 },
      },
      {
        id: "cue-space-3",
        startTime: 6.9,
        endTime: 9.6,
        originalText: "Discovering new planets opens endless possibilities.",
        hebrewText: "גילוי כוכבי לכת חדשים פותח אינספור אפשרויות.",
        detectedLanguage: "English",
        position: { bottomPercent: 8, heightPercent: 12 },
      },
    ],
    renderScene: (ctx, width, height, t) => {
      // Space background
      const grad = ctx.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, width * 0.7);
      grad.addColorStop(0, "#0d1b2a");
      grad.addColorStop(0.5, "#0b0c10");
      grad.addColorStop(1, "#020408");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Starfield
      ctx.fillStyle = "#ffffff";
      for (let i = 0; i < 90; i++) {
        const x = (i * 137.5) % width;
        const y = (i * 293.7 + t * (10 + (i % 15))) % height;
        const size = (i % 3) + 1;
        const alpha = 0.4 + 0.6 * Math.sin(t * 3 + i);
        ctx.globalAlpha = Math.max(0.1, alpha);
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;

      // Rotating planet with glowing ring
      const planetX = width * 0.5 + Math.sin(t * 0.4) * 45;
      const planetY = height * 0.42 + Math.cos(t * 0.4) * 15;
      const planetR = 70;

      // Glow
      const glow = ctx.createRadialGradient(planetX, planetY, planetR * 0.8, planetX, planetY, planetR * 1.5);
      glow.addColorStop(0, "rgba(59, 130, 246, 0.4)");
      glow.addColorStop(1, "rgba(59, 130, 246, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(planetX, planetY, planetR * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Planet sphere
      const pGrad = ctx.createLinearGradient(planetX - planetR, planetY - planetR, planetX + planetR, planetY + planetR);
      pGrad.addColorStop(0, "#3b82f6");
      pGrad.addColorStop(0.5, "#1e3a8a");
      pGrad.addColorStop(1, "#0f172a");
      ctx.fillStyle = pGrad;
      ctx.beginPath();
      ctx.arc(planetX, planetY, planetR, 0, Math.PI * 2);
      ctx.fill();

      // Ring
      ctx.save();
      ctx.translate(planetX, planetY);
      ctx.rotate(0.35 + Math.sin(t * 0.2) * 0.05);
      ctx.scale(1, 0.28);
      ctx.strokeStyle = "rgba(147, 197, 253, 0.6)";
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.arc(0, 0, planetR * 1.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Title overlay on video
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.font = "bold 20px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("SPACE EXPLORATION DOCUMENTARY", width / 2, 46);
    },
  },
  {
    id: "demo-spanish",
    title: "דרמה קולנועית (כתוביות בספרדית)",
    description: "קטע דרמה עם כתוביות מוטמעות בספרדית לזיהוי ותרגום לעברית.",
    duration: "00:10",
    durationSeconds: 10,
    language: "Spanish",
    sampleCues: [
      {
        id: "cue-es-1",
        startTime: 0.5,
        endTime: 3.3,
        originalText: "Debe revisar las Mezuzot de toda la casa.",
        hebrewText: "חובה לבדוק את כל המזוזות בבית.",
        detectedLanguage: "Spanish",
        position: { bottomPercent: 8, heightPercent: 12 },
      },
      {
        id: "cue-es-2",
        startTime: 3.6,
        endTime: 6.6,
        originalText: "Y no sabemos el motivo de esta situación.",
        hebrewText: "ואנחנו לא יודעים מה הסיבה למצב הזה.",
        detectedLanguage: "Spanish",
        position: { bottomPercent: 8, heightPercent: 12 },
      },
      {
        id: "cue-es-3",
        startTime: 6.9,
        endTime: 9.6,
        originalText: "Él ha tenido fiebre dos días seguidos.",
        hebrewText: "היה לו חום גבוה יומיים ברציפות.",
        detectedLanguage: "Spanish",
        position: { bottomPercent: 8, heightPercent: 12 },
      },
    ],
    renderScene: (ctx, width, height, t) => {
      // Cinematic warm sepia/dark dramatic film atmosphere
      const grad = ctx.createRadialGradient(width * 0.45, height * 0.45, 80, width / 2, height / 2, width * 0.7);
      grad.addColorStop(0, "#2c1d11");
      grad.addColorStop(0.5, "#170f09");
      grad.addColorStop(1, "#0a0604");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Film grain particles
      ctx.fillStyle = "rgba(255, 230, 200, 0.08)";
      for (let i = 0; i < 60; i++) {
        const x = (i * 191.3 + t * 45) % width;
        const y = (i * 127.1 + t * 30) % height;
        ctx.fillRect(x, y, 2, 2);
      }

      // Warm cinematic spotlight
      const spotGrad = ctx.createRadialGradient(width * 0.4, height * 0.38, 20, width * 0.4, height * 0.38, 220);
      spotGrad.addColorStop(0, "rgba(255, 200, 140, 0.25)");
      spotGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = spotGrad;
      ctx.beginPath();
      ctx.arc(width * 0.4, height * 0.38, 220, 0, Math.PI * 2);
      ctx.fill();

      // Film Camera Frame & Timecode
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.font = "14px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`REC  [00:0${Math.floor(t)}:${Math.floor((t % 1) * 30).toString().padStart(2, "0")}]`, 30, 36);

      // Red recording dot
      ctx.fillStyle = Math.floor(t * 2) % 2 === 0 ? "#ef4444" : "rgba(239, 68, 68, 0.2)";
      ctx.beginPath();
      ctx.arc(20, 31, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(255, 215, 160, 0.85)";
      ctx.font = "bold 18px serif";
      ctx.textAlign = "center";
      ctx.fillText("ESCENA CINEMATOGRÁFICA DRAMÁTICA", width / 2, 46);
    },
  },
  {
    id: "demo-tech",
    title: "בינה מלאכותית וטכנולוגיה (כתוביות באנגלית)",
    description: "הסבר מונפש על עיבוד תמונה ותרגום בזמן אמת עם כתוביות מוטמעות.",
    duration: "00:10",
    durationSeconds: 10,
    language: "English",
    sampleCues: [
      {
        id: "cue-tech-1",
        startTime: 0.5,
        endTime: 3.3,
        originalText: "Neural networks analyze visual patterns in milliseconds.",
        hebrewText: "רשתות נוירונים מנתחות תבניות חזותיות באלפיות השנייה.",
        detectedLanguage: "English",
        position: { bottomPercent: 8, heightPercent: 12 },
      },
      {
        id: "cue-tech-2",
        startTime: 3.6,
        endTime: 6.6,
        originalText: "Deep learning algorithms detect multilingual text on screen.",
        hebrewText: "אלגוריתמי למידה עמוקה מזהים טקסט רב-לשוני על גבי המסך.",
        detectedLanguage: "English",
        position: { bottomPercent: 8, heightPercent: 12 },
      },
      {
        id: "cue-tech-3",
        startTime: 6.9,
        endTime: 9.6,
        originalText: "Automated translation bridges language barriers instantly.",
        hebrewText: "תרגום אוטומטי מגשר על מחסומי שפה באופן מיידי.",
        detectedLanguage: "English",
        position: { bottomPercent: 8, heightPercent: 12 },
      },
    ],
    renderScene: (ctx, width, height, t) => {
      // Tech matrix dark background
      ctx.fillStyle = "#050b14";
      ctx.fillRect(0, 0, width, height);

      // Animated grid
      ctx.strokeStyle = "rgba(30, 58, 138, 0.35)";
      ctx.lineWidth = 1;
      const gridSize = 40;
      const offset = (t * 20) % gridSize;

      for (let x = offset; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = offset; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Digital neural nodes
      const nodes = [
        { x: width * 0.25, y: height * 0.35 },
        { x: width * 0.45, y: height * 0.28 },
        { x: width * 0.55, y: height * 0.5 },
        { x: width * 0.75, y: height * 0.38 },
        { x: width * 0.38, y: height * 0.6 },
        { x: width * 0.68, y: height * 0.62 },
      ];

      // Draw connecting lines
      ctx.strokeStyle = "rgba(59, 130, 246, 0.4)";
      ctx.lineWidth = 2;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }

      // Draw glowing nodes
      nodes.forEach((n, idx) => {
        const pulse = 1 + 0.3 * Math.sin(t * 4 + idx);
        ctx.fillStyle = "#3b82f6";
        ctx.beginPath();
        ctx.arc(n.x, n.y, 7 * pulse, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#93c5fd";
        ctx.beginPath();
        ctx.arc(n.x, n.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // Title overlay
      ctx.fillStyle = "#60a5fa";
      ctx.font = "bold 20px monospace";
      ctx.textAlign = "center";
      ctx.fillText("[AI VISION & OCR NEURAL ENGINE]", width / 2, 46);
    },
  },
  {
    id: "demo-nature",
    title: "עולם הטבע והחי (כתוביות באנגלית)",
    description: "נופי טבע מרהיבים עם כתוביות מוטמעות באנגלית על חיות בר והסביבה.",
    duration: "00:10",
    durationSeconds: 10,
    language: "English",
    sampleCues: [
      {
        id: "cue-nature-1",
        startTime: 0.5,
        endTime: 3.3,
        originalText: "Nature reveals the most breathtaking scenery on Earth.",
        hebrewText: "הטבע חושף את הנופים עוצרי הנשימה ביותר בכדור הארץ.",
        detectedLanguage: "English",
        position: { bottomPercent: 8, heightPercent: 12 },
      },
      {
        id: "cue-nature-2",
        startTime: 3.6,
        endTime: 6.6,
        originalText: "Every ecosystem plays a vital role in our planet's balance.",
        hebrewText: "כל מערכת אקולוגית ממלאת תפקיד חיוני באיזון כדור הארץ.",
        detectedLanguage: "English",
        position: { bottomPercent: 8, heightPercent: 12 },
      },
      {
        id: "cue-nature-3",
        startTime: 6.9,
        endTime: 9.6,
        originalText: "Protecting wildlife preserves beauty for future generations.",
        hebrewText: "שמירה על חיות הבר מבטיחה את היופי למען הדורות הבאים.",
        detectedLanguage: "English",
        position: { bottomPercent: 8, heightPercent: 12 },
      },
    ],
    renderScene: (ctx, width, height, t) => {
      // Nature sunset gradient
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, "#0f172a");
      grad.addColorStop(0.4, "#1e293b");
      grad.addColorStop(0.7, "#047857");
      grad.addColorStop(1, "#064e3b");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Glowing sun
      const sunY = height * 0.45;
      const sGrad = ctx.createRadialGradient(width * 0.5, sunY, 10, width * 0.5, sunY, 90);
      sGrad.addColorStop(0, "rgba(251, 191, 36, 0.9)");
      sGrad.addColorStop(0.4, "rgba(245, 158, 11, 0.4)");
      sGrad.addColorStop(1, "rgba(245, 158, 11, 0)");
      ctx.fillStyle = sGrad;
      ctx.beginPath();
      ctx.arc(width * 0.5, sunY, 90, 0, Math.PI * 2);
      ctx.fill();

      // Mountain silhouettes
      ctx.fillStyle = "#064e3b";
      ctx.beginPath();
      ctx.moveTo(0, height);
      ctx.lineTo(0, height * 0.6);
      ctx.lineTo(width * 0.25, height * 0.4);
      ctx.lineTo(width * 0.5, height * 0.58);
      ctx.lineTo(width * 0.75, height * 0.38);
      ctx.lineTo(width, height * 0.65);
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fill();

      // Floating fireflies/particles
      ctx.fillStyle = "#fef08a";
      for (let i = 0; i < 30; i++) {
        const px = (i * 187 + Math.sin(t + i) * 30) % width;
        const py = height * 0.5 + ((i * 83 + Math.cos(t * 1.5 + i) * 25) % (height * 0.4));
        const alpha = 0.3 + 0.7 * Math.sin(t * 2 + i);
        ctx.globalAlpha = Math.max(0.1, alpha);
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;

      // Title overlay
      ctx.fillStyle = "#a7f3d0";
      ctx.font = "bold 20px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("NATURE & WILDLIFE CINEMATICS", width / 2, 46);
    },
  },
];

/**
 * Render a complete frame from a demo video directly into a canvas context,
 * including the realistic burned-in hardcoded subtitle.
 */
export function renderDemoFrame(
  ctx: CanvasRenderingContext2D,
  demoId: string,
  width: number,
  height: number,
  time: number
) {
  const config = DEMO_CONFIGS.find((d) => d.id === demoId) || DEMO_CONFIGS[0];

  // 1. Draw animated scene
  config.renderScene(ctx, width, height, time);

  // 2. Draw hardcoded subtitle burned onto video
  const activeCue = config.sampleCues.find((c) => time >= c.startTime && time <= c.endTime);
  if (activeCue) {
    ctx.save();
    const text = activeCue.originalText;
    ctx.font = "bold 24px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const subY = height - 54;
    const textWidth = ctx.measureText(text).width;

    // Dark background pill with smooth rounded corners
    ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    const boxW = textWidth + 36;
    const boxH = 44;
    const boxX = width / 2 - boxW / 2;
    const boxY = subY - boxH / 2;

    ctx.beginPath();
    if (typeof (ctx as any).roundRect === "function") {
      (ctx as any).roundRect(boxX, boxY, boxW, boxH, 8);
    } else {
      ctx.rect(boxX, boxY, boxW, boxH);
    }
    ctx.fill();

    // Soft crisp yellow hardcoded text with subtle drop-shadow
    ctx.fillStyle = "#fef08a";
    ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
    ctx.shadowBlur = 4;
    ctx.fillText(text, width / 2, subY);
    ctx.restore();
  }
}
