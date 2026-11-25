"use client";

import type { ReactNode } from "react";

export const panelCls = "rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3";
export const panelTitleCls = "mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--text-secondary)]";
export const inputCls = "h-7 w-full min-w-0 rounded-md border border-[var(--card-border)] bg-[var(--input-bg)] px-2 text-[11px] font-semibold text-foreground outline-none focus:border-primary";
export const btnCls = "inline-flex h-7 items-center justify-center gap-1.5 rounded-md border border-[var(--card-border)] bg-[var(--input-bg)] px-2.5 text-[11px] font-bold text-foreground transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-40";
export const btnPrimaryCls = "inline-flex h-7 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-[11px] font-black text-[#071b17] transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40";

export function Panel({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className={panelCls}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--text-secondary)]">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[10px] font-bold text-[var(--text-secondary)]">{label}</span>
      {children}
    </label>
  );
}

export function NumberField({ label, value, onChange, min, max, step = 1 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <Field label={label}>
      <input
        type="number"
        className={inputCls}
        value={Number.isFinite(value) ? Math.round(value * 100) / 100 : 0}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const v = Number(event.target.value);
          if (Number.isFinite(v)) onChange(max != null ? Math.min(max, Math.max(min ?? -Infinity, v)) : Math.max(min ?? -Infinity, v));
        }}
      />
    </Field>
  );
}

export function ColorField({ label, value, onChange, allowEmpty }: { label: string; value: string; onChange: (v: string) => void; allowEmpty?: boolean }) {
  const safe = /^#[0-9a-f]{6}$/i.test(value) ? value : "#000000";
  return (
    <Field label={label}>
      <div className="flex items-center gap-1.5">
        <input type="color" aria-label={label} value={safe} onChange={(event) => onChange(event.target.value)} className="h-7 w-8 shrink-0 cursor-pointer rounded-md border border-[var(--card-border)] bg-transparent p-0.5" />
        <input
          className={`${inputCls} font-mono uppercase`}
          value={value}
          placeholder={allowEmpty ? "none" : "#000000"}
          onChange={(event) => {
            const v = event.target.value.trim();
            if (allowEmpty && v === "") onChange("");
            else if (/^#?[0-9a-f]{0,6}$/i.test(v)) onChange(v.startsWith("#") ? v : `#${v}`);
          }}
        />
      </div>
    </Field>
  );
}

export function SliderField({ label, value, onChange, min, max, step = 1, suffix = "" }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; suffix?: string }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-1.5 w-full cursor-pointer accent-[var(--primary,#16c784)]" />
        <span className="w-11 shrink-0 text-right font-mono text-[10px] font-bold text-foreground">{Math.round(value * 100) / 100}{suffix}</span>
      </div>
    </Field>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex w-full overflow-hidden rounded-lg border border-[var(--card-border)] bg-[var(--input-bg)] p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`flex-1 rounded-md px-2 py-1 text-[11px] font-extrabold transition-colors ${value === option.value ? "bg-primary text-[#071b17]" : "text-[var(--text-secondary)] hover:text-foreground"}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
