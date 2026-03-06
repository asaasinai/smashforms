"use client";

import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";
import type { ReviewAnnotation } from "./types";

type AnnotationSidebarProps = {
  annotations: ReviewAnnotation[];
  selectedAnnotationId: string | null;
  onSelectAnnotation: (annotationId: string) => void;
  onUpdateComment: (annotationId: string, comment: string | null) => Promise<void>;
  onDeleteAnnotation: (annotationId: string) => Promise<void>;
};

const TYPE_ICON: Record<ReviewAnnotation["type"], string> = {
  PIN: "📌",
  HIGHLIGHT: "🟨",
  DRAW: "✏️"
};

export function AnnotationSidebar({
  annotations,
  selectedAnnotationId,
  onSelectAnnotation,
  onUpdateComment,
  onDeleteAnnotation
}: AnnotationSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftComment, setDraftComment] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const orderLookup = useMemo(() => {
    return annotations.reduce<Record<string, number>>((acc, annotation, index) => {
      acc[annotation.id] = annotation.order > 0 ? annotation.order : index + 1;
      return acc;
    }, {});
  }, [annotations]);

  const startEditing = (annotation: ReviewAnnotation) => {
    setEditingId(annotation.id);
    setDraftComment(annotation.comment ?? "");
  };

  const handleSaveComment = async () => {
    if (!editingId) {
      return;
    }

    setSavingId(editingId);
    try {
      const normalized = draftComment.trim();
      await onUpdateComment(editingId, normalized.length > 0 ? normalized : null);
      setEditingId(null);
    } catch (error) {
      console.error("Failed to update annotation comment", error);
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (annotationId: string) => {
    setDeletingId(annotationId);
    try {
      await onDeleteAnnotation(annotationId);
      if (editingId === annotationId) {
        setEditingId(null);
      }
    } catch (error) {
      console.error("Failed to delete annotation", error);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <aside className="h-full w-[360px] shrink-0 border-l border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
      <div className="flex h-full flex-col">
        <header className="border-b border-[rgb(var(--border))] px-5 py-4">
          <h2 className="text-lg font-semibold text-white">Annotations</h2>
          <p className="mt-1 text-xs text-[rgb(var(--muted))]">
            {annotations.length} total annotation{annotations.length === 1 ? "" : "s"}
          </p>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {annotations.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[rgb(var(--border))] p-4 text-sm text-[rgb(var(--muted))]">
              Add a pin, highlight, or drawing to start collecting feedback.
            </p>
          ) : (
            annotations.map((annotation, index) => {
              const selected = selectedAnnotationId === annotation.id;
              const displayOrder = orderLookup[annotation.id] ?? index + 1;
              const isEditing = editingId === annotation.id;
              const isSaving = savingId === annotation.id;
              const isDeleting = deletingId === annotation.id;
              return (
                <article
                  key={annotation.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectAnnotation(annotation.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectAnnotation(annotation.id);
                    }
                  }}
                  className={cn(
                    "rounded-xl border border-[rgb(var(--border))] bg-black/20 p-3 transition",
                    selected && "border-violet-500/80 bg-violet-900/20"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-xs font-semibold text-white">
                        {displayOrder}
                      </span>
                      <p className="text-sm text-white">
                        <span aria-hidden>{TYPE_ICON[annotation.type]}</span> {annotation.type}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-red-300 transition hover:text-red-200"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleDelete(annotation.id);
                      }}
                      disabled={isDeleting}
                    >
                      {isDeleting ? "Deleting..." : "Delete"}
                    </button>
                  </div>

                  <div className="mt-2">
                    {isEditing ? (
                      <div
                        className="space-y-2"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <textarea
                          value={draftComment}
                          onChange={(event) => setDraftComment(event.target.value)}
                          rows={3}
                          className="w-full resize-none rounded-lg border border-[rgb(var(--border))] bg-black/25 px-2 py-1.5 text-sm text-white outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-700/40"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            className="rounded-lg border border-[rgb(var(--border))] px-2 py-1 text-xs text-[rgb(var(--muted))]"
                            onClick={() => setEditingId(null)}
                            disabled={isSaving}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="rounded-lg bg-violet-600 px-2 py-1 text-xs font-semibold text-white"
                            onClick={() => void handleSaveComment()}
                            disabled={isSaving}
                          >
                            {isSaving ? "Saving..." : "Save"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="block text-left text-sm text-[rgb(var(--foreground))] transition hover:text-violet-200"
                        onClick={(event) => {
                          event.stopPropagation();
                          startEditing(annotation);
                        }}
                      >
                        {annotation.comment?.trim() || (
                          <span className="text-[rgb(var(--muted))]">Click to add comment...</span>
                        )}
                      </button>
                    )}
                  </div>

                  <p className="mt-2 text-xs text-[rgb(var(--muted))]">
                    {new Date(annotation.createdAt).toLocaleString()}
                  </p>

                  {annotation.aiFollowups ? (
                    <div className="mt-3 rounded-lg border border-[rgb(var(--border))] bg-black/30 p-2">
                      <p className="text-[11px] uppercase tracking-[0.12em] text-violet-300">
                        AI Follow-up
                      </p>
                      <pre className="mt-1 max-h-28 overflow-y-auto whitespace-pre-wrap break-all text-xs text-[rgb(var(--muted))]">
                        {JSON.stringify(annotation.aiFollowups, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
}
