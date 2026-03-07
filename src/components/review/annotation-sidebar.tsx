"use client";

import { cn } from "@/lib/utils";
import { useCallback, useMemo, useState } from "react";
import type { ReviewAnnotation } from "./types";

type AiMessage = { role: "user" | "assistant"; content: string };

type AnnotationSidebarProps = {
  annotations: ReviewAnnotation[];
  selectedAnnotationId: string | null;
  onSelectAnnotation: (annotationId: string) => void;
  onUpdateComment: (annotationId: string, comment: string | null) => Promise<void>;
  onDeleteAnnotation: (annotationId: string) => Promise<void>;
  onTriggerAiFollowup: (annotationId: string, messages: AiMessage[]) => Promise<void>;
  currentSection: number;
};

const TYPE_ICON: Record<string, string> = { PIN: "📌", HIGHLIGHT: "🟨", DRAW: "✏️" };

function parseAiFollowups(raw: unknown): AiMessage[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    // New format: array of {role, content}
    if (raw.length > 0 && raw[0] && typeof raw[0] === "object" && "role" in raw[0]) {
      return raw as AiMessage[];
    }
    // Legacy format: array of question strings
    return raw.map((q) => ({ role: "assistant" as const, content: String(q) }));
  }
  return [];
}

export function AnnotationSidebar({
  annotations,
  selectedAnnotationId,
  onSelectAnnotation,
  onUpdateComment,
  onDeleteAnnotation,
  onTriggerAiFollowup,
  currentSection,
}: AnnotationSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyValue, setReplyValue] = useState("");
  const [loadingAiId, setLoadingAiId] = useState<string | null>(null);

  // Group by section (Update 6)
  const grouped = useMemo(() => {
    const groups: Record<number, ReviewAnnotation[]> = {};
    for (const ann of annotations) {
      const section = Math.floor(ann.scrollY / 900); // approximate viewport height
      if (!groups[section]) groups[section] = [];
      groups[section].push(ann);
    }
    return Object.entries(groups)
      .map(([section, anns]) => ({ section: Number(section), annotations: anns }))
      .sort((a, b) => a.section - b.section);
  }, [annotations]);

  const startEdit = useCallback(
    (annotation: ReviewAnnotation) => {
      setEditingId(annotation.id);
      setEditValue(annotation.comment ?? "");
    },
    []
  );

  const cancelEdit = useCallback(() => { setEditingId(null); setEditValue(""); }, []);

  const saveEdit = useCallback(
    async (annotationId: string) => {
      await onUpdateComment(annotationId, editValue.trim() || null);
      setEditingId(null);
      setEditValue("");
      // Trigger AI followup after saving comment (Update 5)
      if (editValue.trim()) {
        setLoadingAiId(annotationId);
        try {
          const ann = annotations.find((a) => a.id === annotationId);
          const existing = parseAiFollowups(ann?.aiFollowups);
          const messages: AiMessage[] = [...existing, { role: "user", content: editValue.trim() }];
          await onTriggerAiFollowup(annotationId, messages);
        } finally {
          setLoadingAiId(null);
        }
      }
    },
    [editValue, onUpdateComment, annotations, onTriggerAiFollowup]
  );

  const handleReply = useCallback(
    async (annotationId: string) => {
      if (!replyValue.trim()) return;
      setLoadingAiId(annotationId);
      try {
        const ann = annotations.find((a) => a.id === annotationId);
        const existing = parseAiFollowups(ann?.aiFollowups);
        const messages: AiMessage[] = [...existing, { role: "user", content: replyValue.trim() }];
        await onTriggerAiFollowup(annotationId, messages);
        setReplyingId(null);
        setReplyValue("");
      } finally {
        setLoadingAiId(null);
      }
    },
    [replyValue, annotations, onTriggerAiFollowup]
  );

  return (
    <aside className="flex w-[360px] shrink-0 flex-col border-l border-[rgb(var(--border))] bg-[rgb(var(--surface-2))]">
      <div className="flex items-center justify-between border-b border-[rgb(var(--border))] px-4 py-3">
        <h2 className="text-sm font-semibold text-white">
          Annotations <span className="ml-1 text-xs text-[rgb(var(--muted))]">({annotations.length})</span>
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        {annotations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="mb-2 text-4xl">💬</span>
            <p className="text-sm text-[rgb(var(--muted))]">No annotations yet</p>
            <p className="mt-1 text-xs text-[rgb(var(--muted))]/60">Select a tool and click on the page</p>
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.section} className="mb-4">
              <div className={cn(
                "sticky top-0 z-10 mb-2 rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-sm",
                group.section === currentSection
                  ? "bg-violet-900/40 text-violet-300"
                  : "bg-zinc-800/60 text-zinc-500"
              )}>
                Section {group.section + 1}
              </div>
              {group.annotations.map((annotation, groupIdx) => {
                const aiMessages = parseAiFollowups(annotation.aiFollowups);
                const isEditing = editingId === annotation.id;
                const isSelected = selectedAnnotationId === annotation.id;
                const isLoading = loadingAiId === annotation.id;

                return (
                  <article
                    key={annotation.id}
                    onClick={() => onSelectAnnotation(annotation.id)}
                    className={cn(
                      "group relative mb-2 cursor-pointer rounded-lg border p-3 transition",
                      isSelected
                        ? "border-violet-400/60 bg-violet-600/10"
                        : "border-transparent bg-[rgb(var(--surface))]/40 hover:border-white/10 hover:bg-[rgb(var(--surface))]/70"
                    )}
                  >
                    {/* Header */}
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">
                        {annotation.order > 0 ? annotation.order : groupIdx + 1}
                      </span>
                      <span className="text-xs">{TYPE_ICON[annotation.type] ?? "•"}</span>
                      <span className="text-xs text-[rgb(var(--muted))]">
                        ({annotation.positionX.toFixed(0)}%, {annotation.positionY.toFixed(0)}%)
                      </span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); void onDeleteAnnotation(annotation.id); }}
                        className="ml-auto text-xs text-red-400 opacity-0 transition group-hover:opacity-100 hover:text-red-300"
                        title="Delete annotation"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Comment */}
                    {isEditing ? (
                      <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                        <textarea
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          rows={2}
                          className="w-full resize-none rounded border border-[rgb(var(--border))] bg-black/40 px-2 py-1 text-xs text-white outline-none focus:border-violet-500"
                        />
                        <div className="mt-1 flex gap-2">
                          <button onClick={() => void saveEdit(annotation.id)} className="text-xs text-violet-400 hover:text-violet-300">Save</button>
                          <button onClick={cancelEdit} className="text-xs text-[rgb(var(--muted))]">Cancel</button>
                        </div>
                      </div>
                    ) : annotation.comment ? (
                      <p
                        onClick={(e) => { e.stopPropagation(); startEdit(annotation); }}
                        className="mt-2 cursor-text text-xs leading-relaxed text-[rgb(var(--fg))]"
                        title="Click to edit"
                      >
                        {annotation.comment}
                      </p>
                    ) : (
                      <p
                        onClick={(e) => { e.stopPropagation(); startEdit(annotation); }}
                        className="mt-2 cursor-text text-xs italic text-[rgb(var(--muted))]/50"
                      >
                        Click to add a comment…
                      </p>
                    )}

                    {/* AI conversation (Update 5) */}
                    {aiMessages.length > 0 && (
                      <div className="mt-2 space-y-1.5 border-t border-zinc-800 pt-2">
                        {aiMessages.map((msg, i) => (
                          <div key={i} className={cn("text-xs", msg.role === "assistant" ? "text-violet-300" : "text-zinc-300")}>
                            <span className="font-semibold">{msg.role === "assistant" ? "🤖 AI" : "💬 You"}:</span>{" "}
                            {msg.content}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Loading indicator */}
                    {isLoading && (
                      <div className="mt-2 text-xs text-violet-400 animate-pulse">AI is thinking...</div>
                    )}

                    {/* Reply to AI (Update 5) */}
                    {aiMessages.length > 0 && aiMessages[aiMessages.length - 1]?.role === "assistant" && !isLoading && (
                      <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                        {replyingId === annotation.id ? (
                          <div>
                            <textarea
                              value={replyValue}
                              onChange={(e) => setReplyValue(e.target.value)}
                              placeholder="Reply to AI..."
                              rows={2}
                              className="w-full resize-none rounded border border-zinc-700 bg-black/40 px-2 py-1 text-xs text-white outline-none focus:border-violet-500"
                            />
                            <div className="mt-1 flex gap-2">
                              <button onClick={() => void handleReply(annotation.id)} className="text-xs text-violet-400 hover:text-violet-300">Send</button>
                              <button onClick={() => { setReplyingId(null); setReplyValue(""); }} className="text-xs text-zinc-500">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setReplyingId(annotation.id); setReplyValue(""); }}
                            className="text-xs text-violet-400/70 hover:text-violet-300"
                          >
                            Reply to AI →
                          </button>
                        )}
                      </div>
                    )}

                    {/* Timestamp */}
                    <p className="mt-1 text-[10px] text-[rgb(var(--muted))]/50">
                      {new Date(annotation.createdAt).toLocaleTimeString()}
                    </p>
                  </article>
                );
              })}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
