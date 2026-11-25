"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export interface PreviewItem {
  id: string;
  title: string;
  subtitle?: string;
}

interface IconPreviewModalProps {
  items: PreviewItem[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  /** Untouched pixels of the icon (the "before"). Omit when there is no source image. */
  getOriginal?: (item: PreviewItem) => string | null;
  /** The vector result as an image URL (the "after"). Omit before vectorizing. */
  getVector?: (item: PreviewItem) => string | null;
  actions?: (item: PreviewItem) => ReactNode;
}

function Pane({ label, src, alt }: { label: string; src: string; alt: string }) {
  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <figcaption className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">{label}</figcaption>
      <div className="flex h-[min(58vh,520px)] items-center justify-center rounded-xl border border-[var(--card-border)] bg-white p-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="max-h-full max-w-full object-contain" />
      </div>
    </figure>
  );
}

export function IconPreviewModal({ items, index, onIndexChange, onClose, getOriginal, getVector, actions }: IconPreviewModalProps) {
  const item = items[index];
  const original = useMemo(() => (item && getOriginal ? getOriginal(item) : null), [item, getOriginal]);
  const vector = useMemo(() => (item && getVector ? getVector(item) : null), [item, getVector]);
  const count = items.length;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowLeft" && index > 0) onIndexChange(index - 1);
      else if (event.key === "ArrowRight" && index < count - 1) onIndexChange(index + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, count, onClose, onIndexChange]);

  if (!item) return null;
  const both = !!original && !!vector;

  return (
    <div role="dialog" aria-modal="true" aria-label={`Preview of ${item.title}`} data-compact-ui className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4" onClick={onClose}>
      <div className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] text-foreground shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-[var(--card-border)] px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-black">{item.title}</p>
            {item.subtitle && <p className="truncate text-xs text-[var(--text-secondary)]">{item.subtitle}</p>}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-[var(--text-secondary)]">{index + 1} / {count}</span>
            <button type="button" autoFocus onClick={onClose} aria-label="Close preview" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--card-border)] text-foreground hover:border-primary"><X className="h-4 w-4" /></button>
          </div>
        </div>

        <div className={`grid gap-4 overflow-y-auto p-4 ${both ? "md:grid-cols-2" : "grid-cols-1"}`}>
          {original && <Pane label={vector ? "Original" : "Original · not vectorized yet"} src={original} alt={`${item.title} original`} />}
          {vector && <Pane label="Vector" src={vector} alt={`${item.title} vector`} />}
          {!original && !vector && <p className="p-8 text-center text-sm text-[var(--text-secondary)]">No preview available.</p>}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--card-border)] px-4 py-3">
          <button type="button" disabled={index <= 0} onClick={() => onIndexChange(index - 1)} className="inline-flex items-center gap-1 rounded-lg border border-[var(--card-border)] px-3 py-2 text-xs font-bold hover:border-primary disabled:opacity-40"><ChevronLeft className="h-3.5 w-3.5" />Previous</button>
          <div className="flex items-center gap-2">{actions?.(item)}</div>
          <button type="button" disabled={index >= count - 1} onClick={() => onIndexChange(index + 1)} className="inline-flex items-center gap-1 rounded-lg border border-[var(--card-border)] px-3 py-2 text-xs font-bold hover:border-primary disabled:opacity-40">Next<ChevronRight className="h-3.5 w-3.5" /></button>
        </div>
      </div>
    </div>
  );
}
