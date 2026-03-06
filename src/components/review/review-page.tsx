"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { AnnotationSidebar } from "./annotation-sidebar";
import { FloatingToolbar } from "./floating-toolbar";
import { IframeOverlay } from "./iframe-overlay";
import type { AnnotationTool, CreateAnnotationInput, ReviewAnnotation, ReviewRecord } from "./types";

type ReviewPageProps = {
  reviewId: string;
};

type ReviewResponse = {
  review: ReviewRecord;
};

type AnnotationResponse = {
  annotation: ReviewAnnotation;
};

function sortAnnotations(annotations: ReviewAnnotation[]) {
  return [...annotations].sort((left, right) => {
    if (left.order !== right.order) {
      return left.order - right.order;
    }
    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  });
}

export function ReviewPage({ reviewId }: ReviewPageProps) {
  const [review, setReview] = useState<ReviewRecord | null>(null);
  const [annotations, setAnnotations] = useState<ReviewAnnotation[]>([]);
  const [activeTool, setActiveTool] = useState<AnnotationTool>("none");
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [jumpRequest, setJumpRequest] = useState<{ annotationId: string; nonce: number } | null>(null);
  const [pulsePinId, setPulsePinId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const annotationsRef = useRef<ReviewAnnotation[]>([]);

  useEffect(() => {
    const loadReview = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await api<ReviewResponse>(`/api/reviews/${reviewId}`);
        setReview(payload.review);
        setAnnotations(sortAnnotations(payload.review.annotations));
      } catch (loadError) {
        console.error(loadError);
        setError(loadError instanceof Error ? loadError.message : "Failed to load review");
      } finally {
        setLoading(false);
      }
    };

    void loadReview();
  }, [reviewId]);

  useEffect(() => {
    if (!pulsePinId) {
      return;
    }

    const timeout = window.setTimeout(() => setPulsePinId(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [pulsePinId]);

  useEffect(() => {
    annotationsRef.current = annotations;
  }, [annotations]);

  const createAnnotation = async (input: CreateAnnotationInput): Promise<ReviewAnnotation | null> => {
    try {
      setError(null);
      const payload = await api<AnnotationResponse>("/api/annotations", {
        method: "POST",
        body: JSON.stringify({
          reviewId,
          type: input.type,
          position: {
            x: input.positionX,
            y: input.positionY,
            scrollY: input.scrollY,
            viewportWidth: input.viewportWidth,
            viewportHeight: input.viewportHeight,
            elementSelector: input.elementSelector
          },
          comment: input.comment,
          order:
            annotationsRef.current.reduce((max, annotation, index) => {
              const value = annotation.order > 0 ? annotation.order : index + 1;
              return Math.max(max, value);
            }, 0) + 1
        })
      });

      setAnnotations((previous) => sortAnnotations([...previous, payload.annotation]));
      if (payload.annotation.type === "PIN") {
        setPulsePinId(payload.annotation.id);
      }

      return payload.annotation;
    } catch (createError) {
      console.error(createError);
      setError(createError instanceof Error ? createError.message : "Failed to create annotation");
      return null;
    }
  };

  const updateAnnotationComment = async (annotationId: string, comment: string | null) => {
    setError(null);
    await api<AnnotationResponse>(`/api/annotations/${annotationId}`, {
      method: "PATCH",
      body: JSON.stringify({ comment })
    });

    setAnnotations((previous) =>
      previous.map((annotation) =>
        annotation.id === annotationId ? { ...annotation, comment } : annotation
      )
    );
  };

  const deleteAnnotation = async (annotationId: string) => {
    setError(null);
    await api<{ success: true }>(`/api/annotations/${annotationId}`, {
      method: "DELETE"
    });

    setAnnotations((previous) => previous.filter((annotation) => annotation.id !== annotationId));
    if (selectedAnnotationId === annotationId) {
      setSelectedAnnotationId(null);
    }
  };

  const handleSubmitFeedback = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const payload = await api<{ review: { status: ReviewRecord["status"] } }>("/api/webhook/submit", {
        method: "POST",
        body: JSON.stringify({ reviewId })
      });

      setReview((previous) => (previous ? { ...previous, status: payload.review.status } : previous));
      setActiveTool("none");
    } catch (submitError) {
      console.error(submitError);
      setError(submitError instanceof Error ? submitError.message : "Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-sm text-[rgb(var(--muted))]">Loading review...</p>
      </main>
    );
  }

  if (!review) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-sm text-red-300">{error ?? "Review not found."}</p>
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col bg-[rgb(var(--background))]">
      <header className="flex items-center justify-between border-b border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-6 py-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">SmashForms</p>
          <h1 className="truncate text-lg font-semibold text-white">
            {review.title?.trim() || "Untitled review"}
          </h1>
          <p className="truncate text-xs text-[rgb(var(--muted))]">{review.targetUrl}</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="rounded-full border border-violet-700/60 bg-violet-900/30 px-3 py-1 text-xs font-medium text-violet-200">
            {review.status}
          </span>
          <Link
            href={`/review/${review.id}/spec`}
            className="text-sm text-violet-300 transition hover:text-violet-200"
          >
            Dev Spec
          </Link>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_360px] pb-24">
        <section className="min-h-0">
          <IframeOverlay
            targetUrl={review.targetUrl}
            annotations={annotations}
            activeTool={activeTool}
            selectedAnnotationId={selectedAnnotationId}
            jumpRequest={jumpRequest}
            pulsePinId={pulsePinId}
            onCreateAnnotation={createAnnotation}
            onUpdateComment={updateAnnotationComment}
            onDeleteAnnotation={deleteAnnotation}
            onSelectAnnotation={setSelectedAnnotationId}
          />
        </section>

        <AnnotationSidebar
          annotations={annotations}
          selectedAnnotationId={selectedAnnotationId}
          onSelectAnnotation={(annotationId) => {
            setSelectedAnnotationId(annotationId);
            setJumpRequest({ annotationId, nonce: Date.now() });
          }}
          onUpdateComment={updateAnnotationComment}
          onDeleteAnnotation={deleteAnnotation}
        />
      </div>

      <FloatingToolbar
        activeTool={activeTool}
        onToggleTool={(tool) => setActiveTool((previous) => (previous === tool ? "none" : tool))}
        onSubmitFeedback={handleSubmitFeedback}
        submitting={submitting}
      />

      {error ? (
        <div className="pointer-events-none fixed right-4 top-4 z-50 rounded-lg border border-red-500/40 bg-red-900/60 px-3 py-2 text-sm text-red-100 shadow-lg">
          {error}
        </div>
      ) : null}
    </main>
  );
}
