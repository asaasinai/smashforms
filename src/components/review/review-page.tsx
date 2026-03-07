"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { AnnotationSidebar } from "./annotation-sidebar";
import { FloatingToolbar } from "./floating-toolbar";
import { IframeOverlay } from "./iframe-overlay";
import type { AnnotationTool, CreateAnnotationInput, ReviewAnnotation, ReviewRecord } from "./types";

type JumpRequest = { annotationId: string; nonce: number };
type AiMessage = { role: "user" | "assistant"; content: string };

export function ReviewPage({ id }: { id: string }) {
  const [review, setReview] = useState<ReviewRecord | null>(null);
  const [annotations, setAnnotations] = useState<ReviewAnnotation[]>([]);
  const [activeTool, setActiveTool] = useState<AnnotationTool>("none");
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [jumpRequest, setJumpRequest] = useState<JumpRequest | null>(null);
  const [pulsePinId, setPulsePinId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentSection, setCurrentSection] = useState(0);
  const annotationCounter = useRef(0);

  useEffect(() => {
    api<{ review: ReviewRecord }>(`/api/reviews/${id}`)
      .then(({ review: r }) => {
        setReview(r);
        setAnnotations(r.annotations ?? []);
        annotationCounter.current = r.annotations?.length ?? 0;
      })
      .catch((err) => setError(`Failed to load review: ${String(err)}`));
  }, [id]);

  // Scroll tracking for section indicator
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const data = e.data;
      if (data && typeof data === "object" && (data as { type?: string }).type === "smashforms-scroll") {
        const scrollY = (data as { scrollY: number }).scrollY || 0;
        setCurrentSection(Math.floor(scrollY / 900));
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const toggleTool = (tool: Exclude<AnnotationTool, "none">) => {
    setActiveTool((prev) => (prev === tool ? "none" : tool));
  };

  const setTool = (tool: AnnotationTool) => setActiveTool(tool);

  const createAnnotation = async (input: CreateAnnotationInput): Promise<ReviewAnnotation | null> => {
    try {
      annotationCounter.current += 1;
      const { annotation } = await api<{ annotation: ReviewAnnotation }>("/api/annotations", {
        method: "POST",
        body: JSON.stringify({
          reviewId: id,
          type: input.type,
          position: {
            x: input.positionX,
            y: input.positionY,
            scrollY: input.scrollY,
            viewportWidth: input.viewportWidth,
            viewportHeight: input.viewportHeight,
            elementSelector: input.elementSelector,
          },
          comment: input.comment,
          order: annotationCounter.current,
        }),
      });
      setAnnotations((prev) => [...prev, annotation]);
      return annotation;
    } catch (err) {
      setError(`Failed to create annotation: ${String(err)}`);
      return null;
    }
  };

  const updateComment = async (annotationId: string, comment: string | null) => {
    try {
      const { annotation } = await api<{ annotation: ReviewAnnotation }>(`/api/annotations/${annotationId}`, {
        method: "PATCH",
        body: JSON.stringify({ comment }),
      });
      setAnnotations((prev) => prev.map((a) => (a.id === annotationId ? { ...a, ...annotation } : a)));
    } catch (err) {
      setError(`Failed to update: ${String(err)}`);
    }
  };

  const deleteAnnotation = async (annotationId: string) => {
    try {
      await api(`/api/annotations/${annotationId}`, { method: "DELETE" });
      setAnnotations((prev) => prev.filter((a) => a.id !== annotationId));
      if (selectedAnnotationId === annotationId) setSelectedAnnotationId(null);
    } catch (err) {
      setError(`Failed to delete: ${String(err)}`);
    }
  };

  // Update 2: Undo last annotation
  const undoLast = async () => {
    if (annotations.length === 0) return;
    const last = annotations[annotations.length - 1];
    await deleteAnnotation(last.id);
  };

  // Update 5: Trigger AI followup with conversation history
  const triggerAiFollowup = async (annotationId: string, messages: AiMessage[]) => {
    if (!review) return;
    try {
      const { messages: updatedMessages } = await api<{ messages: AiMessage[] }>("/api/ai/followup", {
        method: "POST",
        body: JSON.stringify({ annotationId, reviewId: id, messages }),
      });
      setAnnotations((prev) =>
        prev.map((a) => (a.id === annotationId ? { ...a, aiFollowups: updatedMessages } : a))
      );
    } catch (err) {
      console.error("AI followup error:", err);
    }
  };

  const selectAnnotation = (annotationId: string) => {
    setSelectedAnnotationId(annotationId);
    setJumpRequest({ annotationId, nonce: Date.now() });
    setPulsePinId(annotationId);
    setTimeout(() => setPulsePinId(null), 1200);
  };

  const submitFeedback = async () => {
    if (!review || annotations.length === 0) return;
    setSubmitting(true);
    try {
      await api("/api/webhook/submit", { method: "POST", body: JSON.stringify({ reviewId: id }) });
      setReview((prev) => (prev ? { ...prev, status: "COMPLETED" } : prev));
    } catch (err) {
      setError(`Submit failed: ${String(err)}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!review) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-[rgb(var(--muted))]">Loading review…</p>
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col bg-[rgb(var(--surface))]">
      {/* Header bar */}
      <header className="flex shrink-0 items-center gap-4 border-b border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-4 py-2">
        <Link href="/" className="text-sm font-semibold text-violet-400">⚡ SmashForms</Link>
        <span className="text-xs text-[rgb(var(--muted))]">{review.title || review.targetUrl}</span>
        <span className="ml-auto rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">{review.status}</span>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <IframeOverlay
          targetUrl={review.targetUrl}
          annotations={annotations}
          activeTool={activeTool}
          selectedAnnotationId={selectedAnnotationId}
          jumpRequest={jumpRequest}
          pulsePinId={pulsePinId}
          onCreateAnnotation={createAnnotation}
          onUpdateComment={updateComment}
          onDeleteAnnotation={deleteAnnotation}
          onSelectAnnotation={selectAnnotation}
        />
        <AnnotationSidebar
          annotations={annotations}
          selectedAnnotationId={selectedAnnotationId}
          onSelectAnnotation={selectAnnotation}
          onUpdateComment={updateComment}
          onDeleteAnnotation={deleteAnnotation}
          onTriggerAiFollowup={triggerAiFollowup}
          currentSection={currentSection}
        />
      </div>

      {/* Toolbar */}
      <FloatingToolbar
        activeTool={activeTool}
        onToggleTool={toggleTool}
        onSetTool={setTool}
        onSubmitFeedback={submitFeedback}
        onUndoLast={undoLast}
        canUndo={annotations.length > 0}
        submitting={submitting}
      />

      {error ? (
        <div className="pointer-events-none fixed right-4 top-4 z-50 rounded-lg border border-red-500/40 bg-red-900/60 px-3 py-2 text-sm text-red-100 shadow-lg">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-300 hover:text-white">✕</button>
        </div>
      ) : null}
    </main>
  );
}
