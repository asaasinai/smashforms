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
    height: Math.abs(start.y - current.y)
  };
}

function parseShapeData(elementSelector: string | null): ShapeData | null {
  if (!elementSelector) {
    return null;
  }

  try {
    const parsed = JSON.parse(elementSelector) as Partial<ShapeData> & {
      kind?: string;
    };

    if (
      parsed.kind === "highlight" &&
      typeof parsed.x === "number" &&
      typeof parsed.y === "number" &&
      typeof parsed.width === "number" &&
      typeof parsed.height === "number"
    ) {
      return {
        kind: "highlight",
        x: parsed.x,
        y: parsed.y,
        width: parsed.width,
        height: parsed.height
      };
    }

    if (
      parsed.kind === "draw" &&
      Array.isArray(parsed.points) &&
      parsed.points.every(
        (point) =>
          point &&
          typeof point === "object" &&
          typeof point.x === "number" &&
          typeof point.y === "number"
      )
    ) {
      return { kind: "draw", points: parsed.points };
    }
  } catch {
    return null;
  }

  return null;
}

function pointsToPath(points: Point[]) {
  if (points.length === 0) {
    return "";
  }

  const [first, ...rest] = points;
  return `M ${first.x} ${first.y} ${rest.map((point) => `L ${point.x} ${point.y}`).join(" ")}`;
}

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
  onSelectAnnotation
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

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (
        data &&
        typeof data === "object" &&
        "type" in data &&
        (data as { type?: string }).type === "smashforms-scroll" &&
        "scrollY" in data &&
        typeof (data as { scrollY?: number }).scrollY === "number"
      ) {
        setCurrentScrollY((data as { scrollY: number }).scrollY);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) {
      return;
    }

    let cleanupScrollListener: (() => void) | null = null;

    const bindScrollTracking = () => {
      cleanupScrollListener?.();
      cleanupScrollListener = null;

      const frameWindow = iframe.contentWindow;
      if (!frameWindow) {
        return;
      }

      try {
        const syncScroll = () => {
          try {
            setCurrentScrollY(frameWindow.scrollY ?? 0);
          } catch {
            // Ignore cross-origin frame access errors.
          }
        };
        syncScroll();
        frameWindow.addEventListener("scroll", syncScroll, { passive: true });
        cleanupScrollListener = () => frameWindow.removeEventListener("scroll", syncScroll);
      } catch {
        // Ignore cross-origin frame access errors.
      }
    };

    iframe.addEventListener("load", bindScrollTracking);
    return () => {
      iframe.removeEventListener("load", bindScrollTracking);
      cleanupScrollListener?.();
    };
  }, [targetUrl]);

  useEffect(() => {
    if (!jumpRequest) {
      return;
    }

    const annotation = annotations.find((item) => item.id === jumpRequest.annotationId);
    if (!annotation) {
      return;
    }

    try {
      iframeRef.current?.contentWindow?.scrollTo({
        top: annotation.scrollY,
        behavior: "smooth"
      });
    } catch {
      // Ignore cross-origin frame access errors.
    }
  }, [annotations, jumpRequest]);

  const shapeMap = useMemo(() => {
    return annotations.reduce<Record<string, ShapeData | null>>((acc, annotation) => {
      acc[annotation.id] = parseShapeData(annotation.elementSelector);
      return acc;
    }, {});
  }, [annotations]);

  const highlightPreview = highlightStart && highlightCurrent ? buildRect(highlightStart, highlightCurrent) : null;

  const getPointFromEvent = (event: React.PointerEvent<HTMLDivElement>): Point | null => {
    const bounds = captureLayerRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width === 0 || bounds.height === 0) {
      return null;
    }

    return {
      x: clampPercent(((event.clientX - bounds.left) / bounds.width) * 100),
      y: clampPercent(((event.clientY - bounds.top) / bounds.height) * 100)
    };
  };

  const getViewportMeta = () => {
    const bounds = captureLayerRef.current?.getBoundingClientRect();
    return {
      viewportWidth: Math.round(bounds?.width ?? 0) || 1,
      viewportHeight: Math.round(bounds?.height ?? 0) || 1
    };
  };

  const completeDrawAnnotation = async (points: Point[]) => {
    if (points.length < 2) {
      return;
    }

    const { viewportWidth, viewportHeight } = getViewportMeta();
    const firstPoint = points[0];
    const created = await onCreateAnnotation({
      type: "DRAW",
      positionX: firstPoint.x,
      positionY: firstPoint.y,
      scrollY: currentScrollY,
      viewportWidth,
      viewportHeight,
      elementSelector: JSON.stringify({
        kind: "draw",
        points
      })
    });

    if (created) {
      onSelectAnnotation(created.id);
    }
  };

  const completeHighlightAnnotation = async (rect: HighlightShape) => {
    if (rect.width < 0.6 || rect.height < 0.6) {
      return;
    }

    const { viewportWidth, viewportHeight } = getViewportMeta();
    const created = await onCreateAnnotation({
      type: "HIGHLIGHT",
      positionX: rect.x,
      positionY: rect.y,
      scrollY: currentScrollY,
      viewportWidth,
      viewportHeight,
      elementSelector: JSON.stringify(rect)
    });

    if (created) {
      onSelectAnnotation(created.id);
    }
  };

  const completePinAnnotation = async (point: Point) => {
    const { viewportWidth, viewportHeight } = getViewportMeta();
    const created = await onCreateAnnotation({
      type: "PIN",
      positionX: point.x,
      positionY: point.y,
      scrollY: currentScrollY,
      viewportWidth,
      viewportHeight
    });

    if (!created) {
      return;
    }

    onSelectAnnotation(created.id);
    setPendingComment({
      annotationId: created.id,
      x: point.x,
      y: point.y,
      initialComment: created.comment ?? ""
    });
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (activeTool === "none" || event.button !== 0) {
      return;
    }

    const point = getPointFromEvent(event);
    if (!point) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    setActivePointerId(event.pointerId);

    if (activeTool === "pin") {
      void completePinAnnotation(point);
      setActivePointerId(null);
      event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }

    if (activeTool === "highlight") {
      setHighlightStart(point);
      setHighlightCurrent(point);
      return;
    }

    if (activeTool === "draw") {
      setDrawPoints([point]);
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId === null || activePointerId !== event.pointerId) {
      return;
    }

    const point = getPointFromEvent(event);
    if (!point) {
      return;
    }

    if (activeTool === "highlight") {
      setHighlightCurrent(point);
      return;
    }

    if (activeTool === "draw") {
      setDrawPoints((previous) => {
        const lastPoint = previous[previous.length - 1];
        if (!lastPoint) {
          return [point];
        }
        const distance = Math.abs(lastPoint.x - point.x) + Math.abs(lastPoint.y - point.y);
        if (distance < 0.2) {
          return previous;
        }
        return [...previous, point];
      });
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId === null || activePointerId !== event.pointerId) {
      return;
    }

    if (activeTool === "highlight" && highlightStart && highlightCurrent) {
      const rect = buildRect(highlightStart, highlightCurrent);
      void completeHighlightAnnotation(rect);
    }

    if (activeTool === "draw" && drawPoints.length > 1) {
      void completeDrawAnnotation(drawPoints);
    }

    setHighlightStart(null);
    setHighlightCurrent(null);
    setDrawPoints([]);
    setActivePointerId(null);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleCancelComment = async () => {
    if (!pendingComment) {
      return;
    }

    const annotationId = pendingComment.annotationId;
    setPendingComment(null);
    try {
      await onDeleteAnnotation(annotationId);
    } catch (error) {
      console.error("Failed to cancel annotation comment", error);
    }
  };

  const handleSaveComment = async (comment: string) => {
    if (!pendingComment) {
      return;
    }

    setSavingComment(true);
    try {
      await onUpdateComment(pendingComment.annotationId, comment.trim() ? comment.trim() : null);
      setPendingComment(null);
    } catch (error) {
      console.error("Failed to save annotation comment", error);
    } finally {
      setSavingComment(false);
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <iframe
        ref={iframeRef}
        src={targetUrl}
        title="Review target"
        className="h-full w-full border-0"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
      />

      <div className="pointer-events-none absolute inset-0 z-20">
        {annotations.map((annotation) => {
          if (annotation.type !== "HIGHLIGHT") {
            return null;
          }

          const shape = shapeMap[annotation.id];
          if (!shape || shape.kind !== "highlight") {
            return null;
          }

          return (
            <div
              key={annotation.id}
              className={cn(
                "absolute border border-yellow-300/80 bg-yellow-200/30",
                selectedAnnotationId === annotation.id && "border-violet-300"
              )}
              style={{
                left: `${shape.x}%`,
                top: `${shape.y}%`,
                width: `${shape.width}%`,
                height: `${shape.height}%`
              }}
            />
          );
        })}

        {annotations.map((annotation) => {
          if (annotation.type !== "DRAW") {
            return null;
          }

          const shape = shapeMap[annotation.id];
          if (!shape || shape.kind !== "draw" || shape.points.length < 2) {
            return null;
          }

          return (
            <svg key={annotation.id} className="absolute inset-0 h-full w-full" viewBox="0 0 100 100">
              <path
                d={pointsToPath(shape.points)}
                fill="none"
                stroke={selectedAnnotationId === annotation.id ? "#c4b5fd" : "#f5d0fe"}
                strokeWidth={0.45}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          );
        })}

        {highlightPreview ? (
          <div
            className="absolute border border-yellow-200/70 bg-yellow-100/25"
            style={{
              left: `${highlightPreview.x}%`,
              top: `${highlightPreview.y}%`,
              width: `${highlightPreview.width}%`,
              height: `${highlightPreview.height}%`
            }}
          />
        ) : null}

        {drawPoints.length > 1 ? (
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100">
            <path
              d={pointsToPath(drawPoints)}
              fill="none"
              stroke="#ddd6fe"
              strokeWidth={0.45}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </div>

      <div className="pointer-events-none absolute inset-0 z-30">
        {annotations.map((annotation, index) => {
          if (annotation.type !== "PIN") {
            return null;
          }

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
