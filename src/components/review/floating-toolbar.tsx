"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import type { AnnotationTool } from "./types";

type FloatingToolbarProps = {
  activeTool: AnnotationTool;
  onToggleTool: (tool: Exclude<AnnotationTool, "none">) => void;
  onSetTool: (tool: AnnotationTool) => void;
  onSubmitFeedback: () => Promise<void> | void;
  onUndoLast: () => Promise<void> | void;
  canUndo: boolean;
  submitting?: boolean;
};

const TOOL_BUTTONS: Array<{ tool: Exclude<AnnotationTool, "none">; label: string; icon: string; hint: string }> = [
  { tool: "pin", label: "Pin", icon: "📌", hint: "Click anywhere to drop a pin and add a comment" },
  { tool: "highlight", label: "Highlight", icon: "🟨", hint: "Click and drag to highlight a rectangular area" },
  { tool: "draw", label: "Draw", icon: "✏️", hint: "Click and drag to freehand draw on the page" },
];

export function FloatingToolbar({
  activeTool,
  onToggleTool,
  onSetTool,
  onSubmitFeedback,
  onUndoLast,
  canUndo,
  submitting = false,
}: FloatingToolbarProps) {
  const [showHelp, setShowHelp] = useState(false);
  const activeHint = TOOL_BUTTONS.find((t) => t.tool === activeTool)?.hint;

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 w-full -translate-x-1/2 px-4">
      {/* Tool instruction bar */}
      {activeHint && (
        <div className="pointer-events-auto mx-auto mb-2 w-fit rounded-lg border border-violet-500/30 bg-violet-900/60 px-3 py-1.5 text-xs text-violet-200 backdrop-blur-sm">
          {activeHint}
        </div>
      )}

      <div className="pointer-events-auto mx-auto flex w-fit items-center gap-2 rounded-2xl border border-white/10 bg-[rgb(var(--surface-2))]/70 p-2 shadow-xl shadow-black/50 backdrop-blur-md">
        {/* Update 7: Cursor/pointer tool */}
        <button
          type="button"
          onClick={() => onSetTool("none")}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl border border-transparent px-3 py-2 text-sm text-[rgb(var(--muted))] transition hover:text-white",
            activeTool === "none" &&
              "border-violet-400/60 bg-violet-600/20 text-violet-100 ring-2 ring-violet-500/60"
          )}
          aria-pressed={activeTool === "none"}
          title="Select / interact with page"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
            <path d="m13 13 6 6" />
          </svg>
          Select
        </button>

        <div className="mx-0.5 h-6 w-px bg-white/15" />

        {TOOL_BUTTONS.map((tool) => {
          const active = activeTool === tool.tool;
          return (
            <button
              key={tool.tool}
              type="button"
              onClick={() => onToggleTool(tool.tool)}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border border-transparent px-3 py-2 text-sm text-[rgb(var(--muted))] transition hover:text-white",
                active &&
                  "border-violet-400/60 bg-violet-600/20 text-violet-100 ring-2 ring-violet-500/60"
              )}
              aria-pressed={active}
              title={tool.hint}
            >
              <span aria-hidden>{tool.icon}</span>
              {tool.label}
            </button>
          );
        })}

        <div className="mx-0.5 h-6 w-px bg-white/15" />

        {/* Undo button */}
        <button
          type="button"
          onClick={() => void onUndoLast()}
          disabled={!canUndo}
          className="rounded-xl border border-transparent px-3 py-2 text-sm text-[rgb(var(--muted))] transition hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          title="Undo last annotation"
        >
          ↩ Undo
        </button>

        {/* Help toggle */}
        <button
          type="button"
          onClick={() => setShowHelp((p) => !p)}
          className="relative rounded-xl border border-transparent px-2 py-2 text-sm text-[rgb(var(--muted))] transition hover:text-white"
          title="Help"
        >
          ?
          {showHelp && (
            <div className="absolute bottom-full left-1/2 mb-2 w-64 -translate-x-1/2 rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-left text-xs text-zinc-300 shadow-xl">
              <p className="font-semibold text-white mb-2">How to annotate</p>
              {TOOL_BUTTONS.map((t) => (
                <p key={t.tool} className="mb-1">
                  <span className="mr-1">{t.icon}</span> <strong>{t.label}:</strong> {t.hint}
                </p>
              ))}
              <p className="mt-2 text-zinc-500">Click Select (↖) to interact with the page normally.</p>
            </div>
          )}
        </button>

        <div className="mx-0.5 h-6 w-px bg-white/15" />

        <button
          type="button"
          onClick={() => void onSubmitFeedback()}
          disabled={submitting}
          className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? "Submitting..." : "Submit Feedback"}
        </button>
      </div>
    </div>
  );
}
