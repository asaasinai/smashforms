"use client";

import { useEffect, useState } from "react";

type CommentDialogProps = {
  open: boolean;
  x: number;
  y: number;
  initialComment?: string;
  saving?: boolean;
  onSave: (comment: string) => Promise<void> | void;
  onCancel: () => void;
};

export function CommentDialog({
  open,
  x,
  y,
  initialComment = "",
  saving = false,
  onSave,
  onCancel
}: CommentDialogProps) {
  const [comment, setComment] = useState(initialComment);

  useEffect(() => {
    if (open) {
      setComment(initialComment);
    }
  }, [initialComment, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="absolute z-40 w-72 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))]/95 p-3 shadow-2xl backdrop-blur"
      style={{
        left: `clamp(12px, calc(${x}% + 12px), calc(100% - 304px))`,
        top: `clamp(12px, calc(${y}% + 12px), calc(100% - 190px))`
      }}
      role="dialog"
      aria-label="Add annotation comment"
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-violet-300">
        New annotation
      </p>
      <textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        rows={4}
        className="w-full resize-none rounded-lg border border-[rgb(var(--border))] bg-black/20 px-3 py-2 text-sm text-white outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-700/40"
        placeholder="What needs to change here?"
      />
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          className="rounded-lg border border-[rgb(var(--border))] px-3 py-1.5 text-xs text-[rgb(var(--muted))] transition hover:text-white"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="button"
          className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:opacity-70"
          onClick={() => void onSave(comment)}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
