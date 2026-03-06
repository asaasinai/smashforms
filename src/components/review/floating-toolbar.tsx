"use client";

import { cn } from "@/lib/utils";
import type { AnnotationTool } from "./types";

type FloatingToolbarProps = {
  activeTool: AnnotationTool;
  onToggleTool: (tool: Exclude<AnnotationTool, "none">) => void;
  onSubmitFeedback: () => Promise<void> | void;
  submitting?: boolean;
};

const TOOL_BUTTONS: Array<{ tool: Exclude<AnnotationTool, "none">; label: string; icon: string }> = [
  { tool: "pin", label: "Pin", icon: "📌" },
  { tool: "highlight", label: "Highlight", icon: "🟨" },
  { tool: "draw", label: "Draw", icon: "✏️" }
];

export function FloatingToolbar({
  activeTool,
  onToggleTool,
  onSubmitFeedback,
  submitting = false
}: FloatingToolbarProps) {
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 w-full -translate-x-1/2 px-4">
      <div className="pointer-events-auto mx-auto flex w-fit items-center gap-2 rounded-2xl border border-white/10 bg-[rgb(var(--surface-2))]/70 p-2 shadow-xl shadow-black/50 backdrop-blur-md">
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
            >
              <span aria-hidden>{tool.icon}</span>
              {tool.label}
            </button>
          );
        })}
        <div className="mx-1 h-6 w-px bg-white/15" />
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
