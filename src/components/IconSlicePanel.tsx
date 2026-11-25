"use client";

import { Check, RotateCcw, X } from "lucide-react";
import type { SlicePiece } from "@/services/imageVectorizer";

export interface SliceOptions {
  shuffle: boolean;
  autoDuplicates: boolean;
}

function CheckOption({ label, checked, onToggle, disabled }: { label: string; checked: boolean; onToggle: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-foreground">
      <input type="checkbox" disabled={disabled} checked={checked} onChange={(event) => onToggle(event.target.checked)} className="h-3.5 w-3.5 accent-[var(--primary,#16c784)]" />
      {label}
    </label>
  );
}

export function SliceOptionsStrip({ options, onChange, disabled }: { options: SliceOptions; onChange: (next: SliceOptions) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <CheckOption disabled={disabled} label="Shuffle icon positions" checked={options.shuffle} onToggle={(shuffle) => onChange({ ...options, shuffle })} />
      <CheckOption disabled={disabled} label="Auto-detect duplicate icons" checked={options.autoDuplicates} onToggle={(autoDuplicates) => onChange({ ...options, autoDuplicates })} />
    </div>
  );
}

interface IconSlicePanelProps {
  fileName: string;
  pieces: SlicePiece[];
  thumbs: string[];
  removed: Set<number>;
  textLike: Set<number>;
  duplicates: Set<number>;
  busy: boolean;
  options: SliceOptions;
  onOptionsChange: (next: SliceOptions) => void;
  onToggle: (index: number) => void;
  onRemoveText: () => void;
  onRemoveDuplicates: () => void;
  onCheckDuplicates: () => void;
  onRestoreAll: () => void;
  onVectorize: () => void;
  onOpenSettings: () => void;
  onCancel: () => void;
}

export function IconSlicePanel(props: IconSlicePanelProps) {
  const { pieces, thumbs, removed, textLike, duplicates, busy } = props;
  const kept = pieces.length - removed.size;
  const textToRemove = [...textLike].filter((i) => !removed.has(i)).length;
  const dupToRemove = [...duplicates].filter((i) => !removed.has(i)).length;

  return (
    <div className="space-y-3">
      <div className="space-y-3 rounded-[24px] border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black text-foreground">{pieces.length} icons found in {props.fileName}</p>
            <p className="text-xs text-[var(--text-secondary)]">Remove anything that is not an icon (titles, captions, stray marks), then vectorize. {kept} of {pieces.length} will be vectorized.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={props.onOpenSettings} className="rounded-xl border border-[var(--card-border)] px-3 py-2 text-xs font-bold text-foreground hover:border-primary">Slice &amp; trace settings</button>
            <button type="button" onClick={props.onCancel} className="rounded-xl border border-[var(--card-border)] px-3 py-2 text-xs font-bold text-foreground hover:border-primary">Choose another image</button>
            <button type="button" disabled={busy || kept < 1} onClick={props.onVectorize} className="rounded-xl bg-primary px-4 py-2 text-xs font-black text-[#071b17] hover:bg-primary-hover disabled:opacity-50">Vectorize {kept} icon{kept === 1 ? "" : "s"}</button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--card-border)] pt-3">
          <SliceOptionsStrip options={props.options} onChange={props.onOptionsChange} disabled={busy} />
          <div className="flex flex-wrap items-center gap-2">
            {!props.options.autoDuplicates && <button type="button" onClick={props.onCheckDuplicates} className="rounded-lg border border-[var(--card-border)] px-2.5 py-1.5 text-[11px] font-bold text-foreground hover:border-primary">Check duplicate icons</button>}
            {textLike.size > 0 && <button type="button" disabled={!textToRemove} onClick={props.onRemoveText} className="rounded-lg border border-[var(--card-border)] px-2.5 py-1.5 text-[11px] font-bold text-foreground hover:border-primary disabled:opacity-40">Remove text-like pieces ({textToRemove})</button>}
            {duplicates.size > 0 && <button type="button" disabled={!dupToRemove} onClick={props.onRemoveDuplicates} className="rounded-lg border border-[var(--card-border)] px-2.5 py-1.5 text-[11px] font-bold text-foreground hover:border-primary disabled:opacity-40">Remove duplicates ({dupToRemove})</button>}
            {removed.size > 0 && <button type="button" onClick={props.onRestoreAll} className="inline-flex items-center gap-1 rounded-lg border border-[var(--card-border)] px-2.5 py-1.5 text-[11px] font-bold text-foreground hover:border-primary"><RotateCcw className="h-3 w-3" />Restore all</button>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
        {pieces.map((piece) => {
          const off = removed.has(piece.index);
          return (
            <article key={piece.index} className={`group relative overflow-hidden rounded-2xl border bg-[var(--card-bg)] transition-all ${off ? "border-[var(--card-border)] opacity-45" : "border-primary/40"}`}>
              <button type="button" onClick={() => props.onToggle(piece.index)} className="block aspect-square w-full bg-white p-3" title={off ? "Click to restore" : "Click to remove"}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumbs[piece.index]} alt={`Piece ${piece.index + 1}`} className="h-full w-full object-contain" />
              </button>
              <span className="absolute left-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-black text-white">#{piece.index + 1}</span>
              <button type="button" onClick={() => props.onToggle(piece.index)} aria-label={off ? "Restore piece" : "Remove piece"} className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full shadow ${off ? "bg-primary text-[#071b17]" : "bg-red-600 text-white hover:bg-red-500"}`}>
                {off ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
              </button>
              <div className="flex items-center justify-between gap-1 px-2.5 py-2">
                <span className="truncate text-[10px] font-bold text-[var(--text-secondary)]">{Math.round(piece.bbox.width)} × {Math.round(piece.bbox.height)}</span>
                <span className="flex gap-1">
                  {textLike.has(piece.index) && <span className="rounded bg-amber-500/20 px-1 py-0.5 text-[9px] font-black uppercase text-amber-500">Text?</span>}
                  {duplicates.has(piece.index) && <span className="rounded bg-sky-500/20 px-1 py-0.5 text-[9px] font-black uppercase text-sky-500">Duplicate</span>}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
