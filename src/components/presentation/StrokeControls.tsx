"use client";

import type { StrokeStyle } from "@/lib/presentation/types";
import { inputCls } from "./StudioControls";

export interface StrokeSettings {
  enabled: boolean;
  width: number;
  style: StrokeStyle;
}

export const DEFAULT_STROKE: StrokeSettings = { enabled: false, width: 2, style: "stroke-fill" };

const PRESETS = [0.5, 1, 2, 3, 4, 6];

export function StrokeControls({ value, onChange }: { value: StrokeSettings; onChange: (next: StrokeSettings) => void }) {
  return (
    <div data-compact-ui className="space-y-3 rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] p-3">
      <div className="flex items-center justify-between gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-extrabold text-foreground">
          <input type="checkbox" checked={value.enabled} onChange={(event) => onChange({ ...value, enabled: event.target.checked })} className="h-3.5 w-3.5 accent-[var(--primary,#16c784)]" />
          Editable stroke
        </label>
        <span className="rounded-md border border-[var(--card-border)] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--text-secondary)]">{value.width} px</span>
      </div>
      {value.enabled && (
        <>
          <input type="range" aria-label="Stroke width" min={0.5} max={12} step={0.5} value={value.width} onChange={(event) => onChange({ ...value, width: Number(event.target.value) })} className="h-1.5 w-full cursor-pointer accent-[var(--primary,#16c784)]" />
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button key={p} type="button" onClick={() => onChange({ ...value, width: p })} className={`rounded-md border px-2 py-1 text-[11px] font-bold ${value.width === p ? "border-primary bg-primary/15 text-foreground" : "border-[var(--card-border)] text-[var(--text-secondary)] hover:text-foreground"}`}>{p}px</button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-[11px] font-bold text-[var(--text-secondary)]">
            Style
            <select className={inputCls} value={value.style} onChange={(event) => onChange({ ...value, style: event.target.value as StrokeStyle })}>
              <option value="stroke-fill">Stroke + fill (solid)</option>
              <option value="stroke">Outline only</option>
            </select>
          </label>
        </>
      )}
    </div>
  );
}
