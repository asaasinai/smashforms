"use client";

import { cn } from "@/lib/utils";

type PinMarkerProps = {
  number: number;
  x: number;
  y: number;
  selected?: boolean;
  pulse?: boolean;
  onClick?: () => void;
};

export function PinMarker({ number, x, y, selected = false, pulse = false, onClick }: PinMarkerProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "absolute z-30 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-violet-600 text-xs font-semibold text-white shadow-lg transition hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300",
        selected && "ring-2 ring-violet-200 ring-offset-2 ring-offset-transparent",
        pulse && "animate-pulse"
      )}
      style={{ left: `${x}%`, top: `${y}%` }}
      aria-label={`Select annotation ${number}`}
    >
      {number}
    </button>
  );
}
