import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Play,
  Pause,
  Clock,
  AlertTriangle,
  MoveHorizontal,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  GripVertical,
  Activity,
  Flame,
} from "lucide-react";
import { SubtitleCue } from "../types";
import { formatTimeDisplay } from "../utils/timeFormat";
import { calculateSubtitleDensityHeatmap, SubtitleDensityBucket } from "../utils/subtitleTools";

interface InteractiveTimelineStripProps {
  cues: SubtitleCue[];
  activeCueId: string | null;
  currentTime: number;
  videoDuration: number;
  onSeekTo: (time: number) => void;
  onUpdateCue: (updatedCue: SubtitleCue) => void;
  onSelectCue?: (cueId: string) => void;
  overlappingCueIds?: Set<string>;
}

type DragMode = "left-edge" | "right-edge" | "move-body" | "scrub-playhead" | null;

interface DragState {
  mode: DragMode;
  cueId: string | null;
  initialPointerX: number;
  initialStartTime: number;
  initialEndTime: number;
  currentStartTime: number;
  currentEndTime: number;
}

export const InteractiveTimelineStrip: React.FC<InteractiveTimelineStripProps> = ({
  cues,
  activeCueId,
  currentTime,
  videoDuration = 10,
  onSeekTo,
  onUpdateCue,
  onSelectCue,
  overlappingCueIds = new Set(),
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Zoom Level: 1x (Fit), 2x, 3x, 4x, 6x
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true); // snap to 0.05s (50ms)
  const [showDensityHeatmap, setShowDensityHeatmap] = useState<boolean>(false);
  const [dragState, setDragState] = useState<DragState | null>(null);

  const effectiveDuration = Math.max(
    videoDuration || 10,
    cues.length > 0 ? Math.max(...cues.map((c) => c.endTime)) + 1 : 10
  );

  // Subtitle Density Heatmap buckets calculation
  const densityBuckets: SubtitleDensityBucket[] = useMemo(() => {
    if (!showDensityHeatmap) return [];
    return calculateSubtitleDensityHeatmap(cues, effectiveDuration, 75);
  }, [cues, effectiveDuration, showDensityHeatmap]);

  // Helper: Convert X position in track to seconds
  const getSecondsFromPointerX = useCallback(
    (clientX: number): number => {
      if (!trackRef.current) return 0;
      const rect = trackRef.current.getBoundingClientRect();
      const relativeX = clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, relativeX / rect.width));
      return ratio * effectiveDuration;
    },
    [effectiveDuration]
  );

  // Snap helper (50ms increments)
  const snapTime = useCallback(
    (val: number): number => {
      if (!snapToGrid) return Number(val.toFixed(3));
      const step = 0.05; // 50ms
      return Number((Math.round(val / step) * step).toFixed(3));
    },
    [snapToGrid]
  );

  // Handle Drag Start
  const handleStartDrag = (
    e: React.PointerEvent,
    mode: DragMode,
    cue?: SubtitleCue
  ) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

    if (mode === "scrub-playhead") {
      const time = getSecondsFromPointerX(e.clientX);
      onSeekTo(time);
      setDragState({
        mode: "scrub-playhead",
        cueId: null,
        initialPointerX: e.clientX,
        initialStartTime: 0,
        initialEndTime: 0,
        currentStartTime: time,
        currentEndTime: time,
      });
      return;
    }

    if (!cue) return;

    if (onSelectCue) {
      onSelectCue(cue.id);
    }

    setDragState({
      mode,
      cueId: cue.id,
      initialPointerX: e.clientX,
      initialStartTime: cue.startTime,
      initialEndTime: cue.endTime,
      currentStartTime: cue.startTime,
      currentEndTime: cue.endTime,
    });
  };

  // Handle Drag Pointer Move
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState || !trackRef.current) return;

    const trackWidth = trackRef.current.getBoundingClientRect().width;
    if (trackWidth <= 0) return;

    const deltaX = e.clientX - dragState.initialPointerX;
    const deltaSeconds = (deltaX / trackWidth) * effectiveDuration;

    if (dragState.mode === "scrub-playhead") {
      const newTime = Math.max(0, Math.min(effectiveDuration, getSecondsFromPointerX(e.clientX)));
      onSeekTo(newTime);
      setDragState((prev) => prev ? { ...prev, currentStartTime: newTime } : null);
      return;
    }

    if (!dragState.cueId) return;

    const minCueDuration = 0.25; // minimum 250ms duration

    if (dragState.mode === "left-edge") {
      // Adjust start time (clamp between 0 and endTime - minCueDuration)
      let newStart = snapTime(dragState.initialStartTime + deltaSeconds);
      newStart = Math.max(0, Math.min(dragState.initialEndTime - minCueDuration, newStart));

      setDragState((prev) => prev ? { ...prev, currentStartTime: newStart } : null);
    } else if (dragState.mode === "right-edge") {
      // Adjust end time (clamp between startTime + minCueDuration and effectiveDuration)
      let newEnd = snapTime(dragState.initialEndTime + deltaSeconds);
      newEnd = Math.max(dragState.initialStartTime + minCueDuration, Math.min(effectiveDuration, newEnd));

      setDragState((prev) => prev ? { ...prev, currentEndTime: newEnd } : null);
    } else if (dragState.mode === "move-body") {
      // Shift whole cue block
      const duration = dragState.initialEndTime - dragState.initialStartTime;
      let newStart = snapTime(dragState.initialStartTime + deltaSeconds);
      newStart = Math.max(0, Math.min(effectiveDuration - duration, newStart));
      const newEnd = Number((newStart + duration).toFixed(3));

      setDragState((prev) => prev ? { ...prev, currentStartTime: newStart, currentEndTime: newEnd } : null);
    }
  };

  // Handle Drag End
  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragState) return;

    if (dragState.mode && dragState.mode !== "scrub-playhead" && dragState.cueId) {
      const targetCue = cues.find((c) => c.id === dragState.cueId);
      if (targetCue) {
        const hasChanged =
          Math.abs(targetCue.startTime - dragState.currentStartTime) > 0.005 ||
          Math.abs(targetCue.endTime - dragState.currentEndTime) > 0.005;

        if (hasChanged) {
          onUpdateCue({
            ...targetCue,
            startTime: Number(dragState.currentStartTime.toFixed(3)),
            endTime: Number(dragState.currentEndTime.toFixed(3)),
            isEdited: true,
          });
        }
      }
    }

    setDragState(null);
  };

  // Scroll to active cue in zoomed view
  useEffect(() => {
    if (activeCueId && zoomLevel > 1 && containerRef.current && trackRef.current) {
      const activeCue = cues.find((c) => c.id === activeCueId);
      if (activeCue) {
        const centerTime = (activeCue.startTime + activeCue.endTime) / 2;
        const ratio = centerTime / effectiveDuration;
        const totalWidth = trackRef.current.scrollWidth;
        const targetScrollLeft = ratio * totalWidth - containerRef.current.clientWidth / 2;
        containerRef.current.scrollTo({
          left: Math.max(0, targetScrollLeft),
          behavior: "smooth",
        });
      }
    }
  }, [activeCueId, zoomLevel, effectiveDuration, cues]);

  // Generate Ruler Time Ticks
  const timeTicks = useMemo(() => {
    const ticks: { time: number; label: string; isMajor: boolean }[] = [];
    const step = zoomLevel >= 4 ? 1 : zoomLevel >= 2 ? 2.5 : effectiveDuration > 60 ? 10 : 5;

    for (let t = 0; t <= effectiveDuration; t += step) {
      ticks.push({
        time: t,
        label: formatTimeDisplay(t),
        isMajor: t % (step * 2) === 0 || t === 0,
      });
    }
    return ticks;
  }, [effectiveDuration, zoomLevel]);

  return (
    <div className="bg-[#121212] border border-[#262626] rounded-xl p-3 text-white flex flex-col gap-2 shadow-md select-none">
      {/* Header with Tools: Title, Snap Toggle, Zoom Controls */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-[#222222]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/30">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
              <span>ציר זמן חזותי וגרירת גבולות (Interactive Timeline Strip)</span>
              <span className="text-[10px] text-blue-400 font-mono px-1.5 py-0.2 bg-blue-950/70 border border-blue-600/40 rounded-full">
                D3/CSS Multi-Track
              </span>
            </h3>
            <span className="text-[11px] text-gray-400">
              גרור את קצוות הכתובית לעריכת משך התצוגה או הזז את גוף הכתובית לאורך הסרטון
            </span>
          </div>
        </div>

        {/* Zoom & Snap & Density Heatmap Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Subtitle Density Heatmap Toggle */}
          <button
            type="button"
            id="subtitle-density-heatmap-btn"
            onClick={() => setShowDensityHeatmap(!showDensityHeatmap)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition cursor-pointer flex items-center gap-1 ${
              showDensityHeatmap
                ? "bg-amber-950 text-amber-300 border-amber-500/80 shadow-md shadow-amber-950/40"
                : "bg-[#1c1c1c] text-gray-400 border-[#303030] hover:text-white"
            }`}
            title="מפת עומס כתוביות (Subtitle Density Heatmap): הצג עומס טקסט בצבעים לאורך ציר הזמן"
          >
            <Flame className={`w-3.5 h-3.5 ${showDensityHeatmap ? "text-amber-400 animate-pulse" : "text-gray-400"}`} />
            <span>{showDensityHeatmap ? "מפת עומס (פעיל)" : "מפת עומס כתוביות"}</span>
          </button>

          {/* Snap toggle */}
          <button
            type="button"
            onClick={() => setSnapToGrid(!snapToGrid)}
            className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition cursor-pointer ${
              snapToGrid
                ? "bg-blue-950 text-blue-300 border-blue-600/60"
                : "bg-[#1c1c1c] text-gray-400 border-[#303030] hover:text-white"
            }`}
            title="הצמדה למרווח של 50ms (Snap to 50ms)"
          >
            הצמדה (50ms)
          </button>

          {/* Zoom Buttons */}
          <div className="flex items-center bg-[#1a1a1a] rounded-lg p-0.5 border border-[#303030]">
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(1, z - 1))}
              disabled={zoomLevel <= 1}
              className="p-1 text-gray-400 hover:text-white disabled:opacity-30 rounded transition cursor-pointer"
              title="הקטן ציר זמן"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono font-bold px-1.5 text-blue-400">
              {zoomLevel}x
            </span>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(6, z + 1))}
              disabled={zoomLevel >= 6}
              className="p-1 text-gray-400 hover:text-white disabled:opacity-30 rounded transition cursor-pointer"
              title="הגדל ציר זמן"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            {zoomLevel > 1 && (
              <button
                type="button"
                onClick={() => setZoomLevel(1)}
                className="p-1 text-gray-400 hover:text-white rounded text-[10px] transition cursor-pointer"
                title="התאם למסך (Fit)"
              >
                <Maximize2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Timeline Visual Canvas Container with Horizontal Scroll */}
      <div
        ref={containerRef}
        className="relative w-full overflow-x-auto custom-scrollbar bg-[#0a0a0a] rounded-xl border border-[#242424] p-1.5 pt-6 pb-2 select-none"
        style={{ minHeight: "92px" }}
      >
        <div
          ref={trackRef}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onClick={(e) => {
            if (!dragState) {
              const time = getSecondsFromPointerX(e.clientX);
              onSeekTo(time);
            }
          }}
          className="relative h-14 bg-gradient-to-b from-[#141414] to-[#0d0d0d] rounded-lg border border-[#2a2a2a] cursor-crosshair"
          style={{
            width: `${zoomLevel * 100}%`,
            minWidth: "100%",
          }}
        >
          {/* Top Time Ruler with Ticks */}
          <div className="absolute -top-5 inset-x-0 h-5 pointer-events-none flex justify-between px-1">
            {timeTicks.map((tick, idx) => {
              const leftPct = (tick.time / effectiveDuration) * 100;
              return (
                <div
                  key={idx}
                  style={{ left: `${leftPct}%` }}
                  className="absolute top-0 bottom-0 flex flex-col items-center -translate-x-1/2"
                >
                  <span
                    className={`text-[9px] font-mono leading-none ${
                      tick.isMajor ? "text-gray-300 font-bold" : "text-gray-500"
                    }`}
                  >
                    {tick.label}
                  </span>
                  <div
                    className={`w-px mt-0.5 ${
                      tick.isMajor ? "h-2 bg-gray-500" : "h-1 bg-gray-700"
                    }`}
                  />
                </div>
              );
            })}
          </div>

          {/* Subtitle Density Heatmap Visual Overlay Bar */}
          {showDensityHeatmap && densityBuckets.length > 0 && (
            <div className="absolute inset-x-0 top-0 h-2 flex pointer-events-auto z-10 rounded-t overflow-hidden border-b border-white/10 opacity-90">
              {densityBuckets.map((b) => {
                const bWidthPct = 100 / densityBuckets.length;

                let colorClass = "bg-emerald-500/25";
                if (b.densityScore > 0.65) {
                  colorClass = "bg-rose-500/90 shadow-[0_0_8px_rgba(244,63,94,0.8)] animate-pulse";
                } else if (b.densityScore > 0.45) {
                  colorClass = "bg-amber-500/70";
                } else if (b.densityScore > 0.2) {
                  colorClass = "bg-yellow-400/50";
                }

                return (
                  <div
                    key={b.index}
                    style={{ width: `${bWidthPct}%` }}
                    className={`h-full transition-colors ${colorClass}`}
                    title={`מפת עומס [${formatTimeDisplay(b.startTime)} - ${formatTimeDisplay(b.endTime)}]: ${b.totalChars} תווים ב-${b.cueCount} כתוביות (${
                      b.isCluttered ? "אזור עמוס / דחוס!" : "עומס תקין"
                    })`}
                  />
                );
              })}
            </div>
          )}

          {/* Subtitle Cue Horizontal Blocks */}
          {cues.map((cue, idx) => {
            const isDraggingThis = dragState?.cueId === cue.id;
            const startVal = isDraggingThis && dragState ? dragState.currentStartTime : cue.startTime;
            const endVal = isDraggingThis && dragState ? dragState.currentEndTime : cue.endTime;

            const startPct = Math.max(0, Math.min(100, (startVal / effectiveDuration) * 100));
            const duration = Math.max(0.1, endVal - startVal);
            const widthPct = Math.max(0.8, Math.min(100 - startPct, (duration / effectiveDuration) * 100));

            const isActive = activeCueId === cue.id;
            const isOverlapping = overlappingCueIds.has(cue.id);
            const isOcrError = duration < 1.0; // < 1s OCR error highlight
            const isShort = duration >= 1.0 && duration < 1.2;
            const isLong = duration > 5.5;

            // Color scheme
            let blockBg = "bg-emerald-600/85 hover:bg-emerald-500 border-emerald-400/50";
            if (isOcrError) {
              blockBg = "bg-rose-600/90 hover:bg-rose-500 border-rose-300 animate-pulse";
            } else if (isShort) {
              blockBg = "bg-amber-600/85 hover:bg-amber-500 border-amber-400/50";
            } else if (isLong) {
              blockBg = "bg-purple-600/85 hover:bg-purple-500 border-purple-400/50";
            }

            if (isActive) {
              blockBg = "bg-blue-600 ring-2 ring-blue-300 border-white shadow-lg shadow-blue-500/40 z-20";
            }

            return (
              <div
                key={cue.id}
                style={{
                  left: `${startPct}%`,
                  width: `${widthPct}%`,
                }}
                className={`absolute top-1.5 bottom-1.5 rounded-lg border flex items-center justify-between text-[10px] text-white font-mono shadow transition-shadow group ${blockBg} ${
                  isDraggingThis ? "opacity-90 ring-2 ring-amber-300 z-30 cursor-grabbing" : "cursor-grab"
                }`}
                onPointerDown={(e) => handleStartDrag(e, "move-body", cue)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSeekTo(cue.startTime);
                  if (onSelectCue) onSelectCue(cue.id);
                }}
                title={`#${idx + 1}: ${formatTimeDisplay(startVal)} - ${formatTimeDisplay(endVal)} (${duration.toFixed(2)}s)\n${cue.hebrewText || cue.originalText}${
                  isOcrError ? "\n🚩 משך קצר מ-1 שניה (חשד לשגיאת OCR)" : ""
                }`}
              >
                {/* Left Resize Handle (Adjust Start Time) */}
                <div
                  onPointerDown={(e) => handleStartDrag(e, "left-edge", cue)}
                  className="h-full w-2.5 sm:w-3 flex items-center justify-center bg-black/40 hover:bg-white/40 hover:text-black rounded-r-md cursor-ew-resize transition touch-none shrink-0"
                  title="גרור לשינוי מועד ההתחלה (Start Time)"
                >
                  <div className="w-0.5 h-3 bg-white/70 rounded-full pointer-events-none" />
                </div>

                {/* Center Content / Label */}
                <div className="flex-1 truncate px-1 text-center pointer-events-none select-none flex items-center justify-center gap-1">
                  <span className="font-bold text-[10px]">#{idx + 1}</span>
                  {widthPct > 4 && (
                    <span className="hidden sm:inline opacity-90 truncate max-w-[120px]">
                      {cue.hebrewText || cue.originalText}
                    </span>
                  )}
                  {isOcrError && (
                    <span className="px-1 py-0.2 bg-black/70 text-rose-300 rounded text-[8px] font-bold shrink-0">
                      &lt;1s
                    </span>
                  )}
                  {widthPct > 7 && !isOcrError && (
                    <span className="text-[9px] opacity-80 shrink-0">
                      {duration.toFixed(1)}s
                    </span>
                  )}
                </div>

                {/* Right Resize Handle (Adjust End Time) */}
                <div
                  onPointerDown={(e) => handleStartDrag(e, "right-edge", cue)}
                  className="h-full w-2.5 sm:w-3 flex items-center justify-center bg-black/40 hover:bg-white/40 hover:text-black rounded-l-md cursor-ew-resize transition touch-none shrink-0"
                  title="גרור לשינוי מועד הסיום (End Time)"
                >
                  <div className="w-0.5 h-3 bg-white/70 rounded-full pointer-events-none" />
                </div>
              </div>
            );
          })}

          {/* Draggable Red Playhead Line */}
          <div
            style={{
              left: `${Math.max(0, Math.min(100, (currentTime / effectiveDuration) * 100))}%`,
            }}
            className="absolute top-0 bottom-0 w-0.5 bg-rose-500 pointer-events-none z-30 shadow-[0_0_10px_rgba(244,63,94,1)] transition-all duration-75"
          >
            {/* Scrubber Head Handle */}
            <div
              onPointerDown={(e) => handleStartDrag(e, "scrub-playhead")}
              className="pointer-events-auto absolute -top-3.5 -left-2 w-4 h-4 bg-rose-500 border-2 border-white rounded-full flex items-center justify-center cursor-ew-resize shadow-md hover:scale-125 transition-transform"
              title={`מיקום נוכחי בסרטון: ${formatTimeDisplay(currentTime)}`}
            >
              <div className="w-1 h-1 bg-white rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Floating Active Drag Tooltip */}
      {dragState && dragState.mode && (
        <div className="bg-blue-950 border border-blue-500/80 rounded-lg p-2 text-xs flex items-center justify-between text-blue-200 animate-in fade-in">
          <div className="flex items-center gap-2 font-mono">
            <span className="font-bold text-white">
              {dragState.mode === "left-edge"
                ? "התאמת התחלה:"
                : dragState.mode === "right-edge"
                ? "התאמת סיום:"
                : dragState.mode === "move-body"
                ? "הזזת כתובית:"
                : "גרירת נגן:"}
            </span>
            <span className="text-amber-300 font-bold">
              {formatTimeDisplay(dragState.currentStartTime)}
            </span>
            {dragState.mode !== "scrub-playhead" && (
              <>
                <span>→</span>
                <span className="text-amber-300 font-bold">
                  {formatTimeDisplay(dragState.currentEndTime)}
                </span>
                <span className="text-emerald-300 font-bold">
                  (משך: {(dragState.currentEndTime - dragState.currentStartTime).toFixed(2)}s)
                </span>
              </>
            )}
          </div>
          <span className="text-[10px] text-gray-400">שחרר כדי להחיל שינוי</span>
        </div>
      )}

      {/* Timeline Legend */}
      <div className="flex items-center justify-between flex-wrap gap-2 text-[10px] text-gray-400 pt-1 border-t border-[#1f1f1f]">
        <div className="flex items-center gap-3 flex-wrap">
          {showDensityHeatmap && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-950/80 border border-amber-500/50 rounded text-amber-300 font-bold">
              <Flame className="w-3 h-3 text-amber-400" />
              <span>מפת עומס: ירוק (תקין) → אדום (אזור עמוס/דחוס)</span>
            </span>
          )}
          <span className="flex items-center gap-1 text-rose-400 font-bold">
            <span className="w-2 h-2 rounded bg-rose-600 ring-1 ring-rose-300 inline-block animate-pulse"></span>
            שגיאת OCR (&lt;1.0s)
          </span>
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="w-2 h-2 rounded bg-emerald-600 inline-block"></span> תקין (1.2-5.5s)
          </span>
          <span className="flex items-center gap-1 text-amber-400">
            <span className="w-2 h-2 rounded bg-amber-600 inline-block"></span> קצר (1.0-1.2s)
          </span>
          <span className="flex items-center gap-1 text-purple-400">
            <span className="w-2 h-2 rounded bg-purple-600 inline-block"></span> ארוך (&gt;5.5s)
          </span>
        </div>
        <div className="text-[10px] text-gray-500 font-mono">
          סה"כ זמן וידאו: {formatTimeDisplay(effectiveDuration)}
        </div>
      </div>
    </div>
  );
};
