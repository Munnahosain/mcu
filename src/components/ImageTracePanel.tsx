"use client";

import { RotateCcw, SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { DEFAULT_TRACE_OPTIONS, type TraceBackground, type TraceMode, type TraceOptions } from "@/services/imageVectorizer";

interface ImageTracePanelProps {
  options: TraceOptions;
  onChange: (next: TraceOptions) => void;
  disabled?: boolean;
}

function Segmented<T extends string | number>({ value, options, onChange, disabled }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <div className="inline-flex w-full overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] p-0.5">
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={`flex-1 rounded-[10px] px-2.5 py-1.5 text-[11px] font-extrabold transition-colors ${value === option.value ? "bg-primary text-[#071b17]" : "text-[var(--text-secondary)] hover:text-foreground"}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Row({ label, hint, right, children }: { label: string; hint?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--text-secondary)]">{label}</span>
        {right}
      </div>
      {children}
      {hint && <p className="text-[11px] leading-4 text-[var(--text-secondary)] opacity-80">{hint}</p>}
    </div>
  );
}

function Slider({ value, min, max, onChange, disabled, label }: { value: number; min: number; max: number; onChange: (v: number) => void; disabled?: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <input type="range" aria-label={label} min={min} max={max} value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} className="h-1.5 w-full cursor-pointer accent-[var(--primary,#16c784)] disabled:opacity-40" />
      <span className="w-9 text-right font-mono text-[11px] font-bold text-foreground">{value}</span>
    </div>
  );
}

function AutoToggle({ auto, onChange, disabled }: { auto: boolean; onChange: (auto: boolean) => void; disabled?: boolean }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-bold text-[var(--text-secondary)]">
      <input type="checkbox" checked={auto} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="h-3.5 w-3.5 accent-[var(--primary,#16c784)]" />
      Auto
    </label>
  );
}

export function ImageTracePanel({ options, onChange, disabled }: ImageTracePanelProps) {
  const set = <K extends keyof TraceOptions>(key: K, value: TraceOptions[K]) => onChange({ ...options, [key]: value });
  const multicolor = options.mode === "multicolor";

  return (
    <div data-compact-ui className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-xl">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="text-sm font-black text-foreground">Icon trace settings</div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange({ ...DEFAULT_TRACE_OPTIONS })}
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--card-border)] px-2 py-1 text-[11px] font-bold text-[var(--text-secondary)] hover:text-foreground disabled:opacity-40"
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </button>
      </div>

      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
        <Row label="Vector mode" hint={multicolor ? "Each colour becomes its own clean layer." : "One solid colour per icon — best for line / glyph icons."}>
          <Segmented<TraceMode>
            value={options.mode}
            disabled={disabled}
            onChange={(mode) => set("mode", mode)}
            options={[{ value: "single", label: "Single tone" }, { value: "multicolor", label: "Multicolor" }]}
          />
        </Row>

        {multicolor ? (
          <Row label="Colours" hint="Maximum colours to extract per sheet.">
            <Slider label="Number of colours" value={options.colors} min={2} max={12} disabled={disabled} onChange={(v) => set("colors", v)} />
          </Row>
        ) : (
          <Row
            label="Fill colour"
            right={
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-bold text-[var(--text-secondary)]">
                <input type="checkbox" checked={options.fill == null} disabled={disabled} onChange={(event) => set("fill", event.target.checked ? null : "#000000")} className="h-3.5 w-3.5 accent-[var(--primary,#16c784)]" />
                Keep original
              </label>
            }
          >
            <div className="flex items-center gap-2">
              <input type="color" aria-label="Fill colour" value={options.fill ?? "#000000"} disabled={disabled || options.fill == null} onChange={(event) => set("fill", event.target.value)} className="h-8 w-12 cursor-pointer rounded-lg border border-[var(--card-border)] bg-transparent p-0.5 disabled:opacity-40" />
              <span className="font-mono text-[11px] text-[var(--text-secondary)]">{options.fill ?? "from artwork"}</span>
            </div>
          </Row>
        )}

        <Row label="Sheet background" hint="Auto reads the border. Pick Dark for white icons on a dark sheet.">
          <Segmented<TraceBackground>
            value={options.background}
            disabled={disabled}
            onChange={(background) => set("background", background)}
            options={[{ value: "auto", label: "Auto" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]}
          />
        </Row>

        <Row label="Edge position" hint="Lower = bolder shapes, higher = thinner. Auto finds the exact half-coverage edge." right={<AutoToggle auto={options.threshold == null} disabled={disabled} onChange={(auto) => set("threshold", auto ? null : 50)} />}>
          <Slider label="Edge position" value={options.threshold ?? 50} min={5} max={95} disabled={disabled || options.threshold == null} onChange={(v) => set("threshold", v)} />
        </Row>

        <Row label="Smoothness" hint="Low follows every pixel, high gives fewer, silkier curves.">
          <Slider label="Smoothness" value={options.smoothness} min={0} max={100} disabled={disabled} onChange={(v) => set("smoothness", v)} />
        </Row>

        <Row label="Sharp corners" hint="Keeps real corners crisp (squares, arrows, stars) while circles stay round.">
          <Slider label="Corner sharpness" value={options.corners} min={0} max={100} disabled={disabled} onChange={(v) => set("corners", v)} />
        </Row>

        <Row label="Icon slicing" hint="Auto cuts along the blank bands between rows and columns. Turn Auto off to merge every piece closer than this gap (px) into one icon." right={<AutoToggle auto={options.grouping == null} disabled={disabled} onChange={(auto) => set("grouping", auto ? null : 24)} />}>
          <Slider label="Icon grouping gap in pixels" value={options.grouping ?? 24} min={0} max={200} disabled={disabled || options.grouping == null} onChange={(v) => set("grouping", v)} />
        </Row>

        <Row label="Noise filter" hint="Removes dust and JPEG specks smaller than this many pixels." right={<AutoToggle auto={options.noise == null} disabled={disabled} onChange={(auto) => set("noise", auto ? null : 8)} />}>
          <Slider label="Noise filter in pixels" value={options.noise ?? 8} min={1} max={200} disabled={disabled || options.noise == null} onChange={(v) => set("noise", v)} />
        </Row>

        <Row label="Precision" hint="Sub-pixel up-sampling. Auto picks the best level for each icon's size.">
          <Segmented<number>
            value={options.detail}
            disabled={disabled}
            onChange={(detail) => set("detail", detail as TraceOptions["detail"])}
            options={[{ value: 0, label: "Auto" }, { value: 1, label: "1×" }, { value: 2, label: "2×" }, { value: 3, label: "3×" }, { value: 4, label: "4×" }]}
          />
        </Row>
      </div>
    </div>
  );
}
