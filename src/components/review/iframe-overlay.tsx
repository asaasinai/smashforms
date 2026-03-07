"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { CommentDialog } from "./comment-dialog";
import { PinMarker } from "./pin-marker";
import type { AnnotationTool, CreateAnnotationInput, ReviewAnnotation } from "./types";

type JumpRequest = {
  annotationId: string;
  nonce: number;
};

type IframeOverlayProps = {
  targetUrl: string;
  annotations: ReviewAnnotation[];
  activeTool: AnnotationTool;
  selectedAnnotationId: string | null;
  jumpRequest: JumpRequest | null;
  pulsePinId: string | null;
  onCreateAnnotation: (input: CreateAnnotationInput) => Promise<ReviewAnnotation | null>;
  onUpdateComment: (annotationId: string, comment: string | null) => Promise<void>;
  onDeleteAnnotation: (annotationId: string) => Promise<void>;
  onSelectAnnotation: (annotationId: string) => void;
};

type Point = { x: number; y: number };

type HighlightShape = {
  kind: "highlight";
  x: number;
  y: number;
  width: number;
  height: number;
};

type DrawShape = {
  kind: "draw";
  points: Point[];
};

type ShapeData = HighlightShape | DrawShape;

type PendingComment = {
  annotationId: string;
  x: number;
  y: number;
  initialComment: string;
};

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function buildRect(start: Point, current: Point): HighlightShape {
  return {
    kind: "highlight",
    x: Math.min(start.x, current.x),
    y: Math.min(start.y, current.y),
    width: Math.abs(start.x - current.x),
    height: Math.abs(start.y - current.y),
  };
}

function parseShapeData(elementSelector: string | null): ShapeData | null {
  if (!elementSelector) return null;
  try {
    const parsed = JSON.parse(elementSelector) as Partial<ShapeData> & { kind?: string };
    if (
      parsed.kind === "highlight" &&
      typeof parsed.x === "number" &&
      typeof parsed.y === "number" &&
      typeof parsed.width === "number" &&
      typeof parsed.height === "number"
    ) {
      return { kind: "highlight", x: parsed.x, y: parsed.y, width: parsed.width, height: parsed.height };
    }
    if (
      parsed.kind === "draw" &&
      Array.isArray(parsed.points) &&
      parsed.points.every((p: unknown) => p && typeof p === "object" && typeof (p as Point).x === "number" && typeof (p as Point).y === "number")
    ) {
      return { kind: "draw", points: parsed.points as Point[] };
    }
  } catch { /* ignore */ }
  return null;
}

function pointsToPath(points: Point[]) {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  return `M ${first.x} ${first.y} ${rest.map((p) => `L ${p.x} ${p.y}`).join(" ")}`;
}

// Draw stroke colors — RED for clarity (Update 3)
const DRAW_COLOR = "#ef4444";
const DRAW_COLOR_SELECTED = "#f87171";

export function IframeOverlay({
  targetUrl,
  annotations,
  activeTool,
  selectedAnnotationId,
  jumpRequest,
  pulsePinId,
  onCreateAnnotation,
  onUpdateComment,
  onDeleteAnnotation,
  onSelectAnnotation,
}: IframeOverlayProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const captureLayerRef = useRef<HTMLDivElement | null>(null);
  const [currentScrollY, setCurrentScrollY] = useState(0);
  const [activePointerId, setActivePointerId] = useState<number | null>(null);
  const [highlightStart, setHighlightStart] = useState<Point | null>(null);
  const [highlightCurrent, setHighlightCurrent] = useState<Point | null>(null);
  const [drawPoints, setDrawPoints] = useState<Point[]>([]);
  const [pendingComment, setPendingComment] = useState<PendingComment | null>(null);
  const [savingComment, setSavingComment] = useState(false);

  // Scroll tracking
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (data && typeof data === "object" && (data as { type?: string }).type === "smashforms-scroll" && typeof (data as { scrollY?: number }).scrollY === "number") {
        setCurrentScrollY((data as { scrollY: number }).scrollY);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    let cleanup: (() => void) | null = null;
    const bind = () => {
      cleanup?.();
      cleanup = null;
      const fw = iframe.contentWindow;
      if (!fw) return;
      try {
        const sync = () => { try { setCurrentScrollY(fw.scrollY ?? 0); } catch { /* cross-origin */ } };
        sync();
        fw.addEventListener("scroll", sync, { passive: true });
        cleanup = () => fw.removeEventListener("scroll", sync);
      } catch { /* cross-origin */ }
    };
    iframe.addEventListener("load", bind);
    return () => { iframe.removeEventListener("load", bind); cleanup?.(); };
  }, [targetUrl]);

  // Jump to annotation
  useEffect(() => {
    if (!jumpRequest) return;
    const ann = annotations.find((a) => a.id === jumpRequest.annotationId);
    if (!ann) return;
    try { iframeRef.current?.contentWindow?.scrollTo({ top: ann.scrollY, behavior: "smooth" }); } catch { /* cross-origin */ }
  }, [annotations, jumpRequest]);

  const shapeMap = useMemo(() => {
    return annotations.reduce<Record<string, ShapeData | null>>((acc, a) => {
      acc[a.id] = parseShapeData(a.elementSelector);
      return acc;
    }, {});
  }, [annotations]);

  const highlightPreview = highlightStart && highlightCurrent ? buildRect(highlightStart, highlightCurrent) : null;

  // FIX (Update 3): Use the captureLayerRef bounding rect directly for accurate coords
  const getPointFromEvent = (event: React.PointerEvent<HTMLDivElement>): Point | null => {
    const el = captureLayerRef.current;
    if (!el) return null;
    const bounds = el.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) return null;
    return {
      x: clampPercent(((event.clientX - bounds.left) / bounds.width) * 100),
      y: clampPercent(((event.clientY - bounds.top) / bounds.height) * 100),
    };
  };

  const getViewportMeta = () => {
    const bounds = captureLayerRef.current?.getBoundingClientRect();
    return {
      viewportWidth: Math.round(bounds?.width ?? 0) || 1,
      viewportHeight: Math.round(bounds?.height ?? 0) || 1,
    };
  };

  const completeDrawAnnotation = async (points: Point[]) => {
    if (points.length < 2) return;
    const { viewportWidth, viewportHeight } = getViewportMeta();
    const created = await onCreateAnnotation({
      type: "DRAW",
      positionX: points[0].x,
      positionY: points[0].y,
      scrollY: currentScrollY,
      viewportWidth,
      viewportHeight,
      elementSelector: JSON.stringify({ kind: "draw", points }),
    });
    if (created) onSelectAnnotation(created.id);
  };

  const completeHighlightAnnotation = async (rect: HighlightShape) => {
    if (rect.width < 0.6 || rect.height < 0.6) return;
    const { viewportWidth, viewportHeight } = getViewportMeta();
    const created = await onCreateAnnotation({
      type: "HIGHLIGHT",
      positionX: rect.x,
      positionY: rect.y,
      scrollY: currentScrollY,
      viewportWidth,
      viewportHeight,
      elementSelector: JSON.stringify(rect),
    });
    if (created) onSelectAnnotation(created.id);
  };

  const completePinAnnotation = async (point: Point) => {
    const { viewportWidth, viewportHeight } = getViewportMeta();
    const created = await onCreateAnnotation({
      type: "PIN",
      positionX: point.x,
      positionY: point.y,
      scrollY: currentScrollY,
      viewportWidth,
      viewportHeight,
    });
    if (!created) return;
    onSelectAnnotation(created.id);
    setPendingComment({ annotationId: created.id, x: point.x, y: point.y, initialComment: created.comment ?? "" });
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (activeTool === "none" || event.button !== 0) return;
    const point = getPointFromEvent(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setActivePointerId(event.pointerId);
    if (activeTool === "pin") {
      void completePinAnnotation(point);
      setActivePointerId(null);
      event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }
    if (activeTool === "highlight") { setHighlightStart(point); setHighlightCurrent(point); return; }
    if (activeTool === "draw") { setDrawPoints([point]); }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId === null || activePointerId !== event.pointerId) return;
    const point = getPointFromEvent(event);
    if (!point) return;
    if (activeTool === "highlight") { setHighlightCurrent(point); return; }
    if (activeTool === "draw") {
      setDrawPoints((prev) => {
        const last = prev[prev.length - 1];
        if (!last) return [point];
        if (Math.abs(last.x - point.x) + Math.abs(last.y - point.y) < 0.2) return prev;
        return [...prev, point];
      });
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId === null || activePointerId !== event.pointerId) return;
    if (activeTool === "highlight" && highlightStart && highlightCurrent) {
      void completeHighlightAnnotation(buildRect(highlightStart, highlightCurrent));
    }
    if (activeTool === "draw" && drawPoints.length > 1) {
      void completeDrawAnnotation(drawPoints);
    }
    setHighlightStart(null); setHighlightCurrent(null); setDrawPoints([]); setActivePointerId(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleCancelComment = async () => {
    if (!pendingComment) return;
    const id = pendingComment.annotationId;
    setPendingComment(null);
    try { await onDeleteAnnotation(id); } catch (e) { console.error(e); }
  };

  const handleSaveComment = async (comment: string) => {
    if (!pendingComment) return;
    setSavingComment(true);
    try {
      await onUpdateComment(pendingComment.annotationId, comment.trim() || null);
      setPendingComment(null);
    } catch (e) { console.error(e); }
    finally { setSavingComment(false); }
  };

  // Update 6: Compute current section index from scrollY
  const viewportHeight = captureLayerRef.current?.getBoundingClientRect().height || 900;
  const currentSection = Math.floor(currentScrollY / viewportHeight);

  // Filter visible annotations: show annotations whose scrollY falls within +/- half a viewport of current scroll
  const visibleAnnotations = annotations.filter((a) => {
    const sectionDiff = Math.abs(a.scrollY - currentScrollY);
    return sectionDiff < viewportHeight * 0.75;
  });

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {/* Section indicator (Update 6) */}
      <div className="absolute left-3 top-3 z-50 rounded-lg bg-zinc-900/80 px-2 py-1 text-xs text-zinc-400 backdrop-blur-sm">
        Section {currentSection + 1}
      </div>

      <iframe
        ref={iframeRef}
        src={targetUrl}
        title="Review target"
        className="h-full w-full border-0"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
      />

      {/* Shape overlays */}
      <div className="pointer-events-none absolute inset-0 z-20">
        {visibleAnnotations.map((annotation) => {
          if (annotation.type !== "HIGHLIGHT") return null;
          const shape = shapeMap[annotation.id];
          if (!shape || shape.kind !== "highlight") return null;
          return (
            <div
              key={annotation.id}
              className={cn(
                "absolute border border-yellow-300/80 bg-yellow-200/30",
                selectedAnnotationId === annotation.id && "border-violet-300"
              )}
              style={{ left: `${shape.x}%`, top: `${shape.y}%`, width: `${shape.width}%`, height: `${shape.height}%` }}
            />
          );
        })}

        {/* Draw annotations — RED (Update 3) */}
        {visibleAnnotations.map((annotation) => {
          if (annotation.type !== "DRAW") return null;
          const shape = shapeMap[annotation.id];
          if (!shape || shape.kind !== "draw" || shape.points.length < 2) return null;
          return (
            <svg key={annotation.id} className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path
                d={pointsToPath(shape.points)}
                fill="none"
                stroke={selectedAnnotationId === annotation.id ? DRAW_COLOR_SELECTED : DRAW_COLOR}
                strokeWidth={0.45}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          );
        })}

        {/* Highlight preview */}
        {highlightPreview && (
          <div
            className="absolute border border-yellow-200/70 bg-yellow-100/25"
            style={{ left: `${highlightPreview.x}%`, top: `${highlightPreview.y}%`, width: `${highlightPreview.width}%`, height: `${highlightPreview.height}%` }}
          />
        )}

        {/* Draw preview — RED (Update 3) */}
        {drawPoints.length > 1 && (
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path
              d={pointsToPath(drawPoints)}
              fill="none"
              stroke={DRAW_COLOR}
              strokeWidth={0.45}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}
      </div>

      {/* Pin markers — only visible ones (Update 6) */}
      <div className="pointer-events-none absolute inset-0 z-30">
        {visibleAnnotations.map((annotation, index) => {
          if (annotation.type !== "PIN") return null;
          return (
            <PinMarker
              key={annotation.id}
              number={annotation.order > 0 ? annotation.order : index + 1}
              x={annotation.positionX}
              y={annotation.positionY}
              selected={selectedAnnotationId === annotation.id}
              pulse={pulsePinId === annotation.id}
              onClick={() => onSelectAnnotation(annotation.id)}
            />
          );
        })}
      </div>

      {/* Capture layer */}
      <div
        ref={captureLayerRef}
        className={cn(
          "absolute inset-0 z-40",
          activeTool === "none" ? "pointer-events-none" : "pointer-events-auto",
          activeTool === "pin" && "cursor-crosshair",
          activeTool === "highlight" && "cursor-cell",
          activeTool === "draw" && "cursor-crosshair"
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />

      <CommentDialog
        open={Boolean(pendingComment)}
        x={pendingComment?.x ?? 0}
        y={pendingComment?.y ?? 0}
        initialComment={pendingComment?.initialComment ?? ""}
        saving={savingComment}
        onSave={handleSaveComment}
        onCancel={() => void handleCancelComment()}
      />
    </div>
  );
}
