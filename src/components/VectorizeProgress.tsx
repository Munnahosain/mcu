"use client";

import { Check } from "lucide-react";

export interface VectorizeProgressState {
  fileName: string;
  message: string;
  percent: number;
  done: number;
  total: number;
}

const STAGES = ["Slicing", "Topology", "Bézier", "Vector"] as const;

function stageIndex(percent: number) {
  if (percent < 8) return 1;
  if (percent < 40) return 1;
  if (percent < 90) return 2;
  return 3;
}

export function VectorizeProgress({ state, hidden, onHide, onShow, onStop }: { state: VectorizeProgressState; hidden: boolean; onHide: () => void; onShow: () => void; onStop: () => void }) {
  const active = stageIndex(state.percent);
  const remaining = Math.max(0, state.total - state.done);

  if (hidden) {
    return (
      <div className="fixed bottom-4 right-4 z-[90] flex items-center gap-3 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3 shadow-2xl">
        <div className="w-40">
          <p className="text-[11px] font-black text-foreground">Vectorizing · {state.percent}%</p>
          <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-primary transition-all" style={{ width: `${state.percent}%` }} /></span>
        </div>
        <button type="button" onClick={onShow} className="rounded-lg border border-[var(--card-border)] px-2.5 py-1.5 text-[11px] font-bold text-foreground hover:border-primary">Show</button>
        <button type="button" onClick={onStop} className="rounded-lg bg-red-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-red-500">Stop</button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Vectorizing icons">
      <div className="w-full max-w-md rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 shadow-2xl">
        <h2 className="text-lg font-black text-foreground">Vectorizing sheet</h2>
        <p className="mt-1 truncate text-xs text-[var(--text-secondary)]" title={state.fileName}>{state.fileName}</p>

        <div className="mt-5 grid grid-cols-4 gap-2">
          {STAGES.map((label, i) => {
            const done = i < active || state.percent >= 100;
            const current = i === active && state.percent < 100;
            return (
              <div key={label} className={`rounded-xl border px-2 py-2.5 text-center text-[11px] font-extrabold ${current ? "border-primary bg-primary/10 text-foreground" : done ? "border-[var(--card-border)] text-foreground" : "border-[var(--card-border)] text-[var(--text-secondary)] opacity-60"}`}>
                <span className="mb-1 flex h-4 items-center justify-center">{done ? <Check className="h-3.5 w-3.5 text-primary" /> : <span className="text-[10px] font-mono">{i + 1}</span>}</span>
                {label}
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex items-baseline justify-between">
          <span className="text-3xl font-black text-foreground">{state.percent}%</span>
          <span className="rounded-full border border-[var(--card-border)] px-2.5 py-1 font-mono text-[11px] font-bold text-[var(--text-secondary)]">{state.done} / {state.total} icons</span>
        </div>
        <span className="mt-2 block h-2 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-primary transition-all" style={{ width: `${state.percent}%` }} /></span>
        <p className="mt-2 min-h-[16px] text-[11px] text-[var(--text-secondary)]">{state.message}</p>

        <div className="mt-4 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl border border-[var(--card-border)] py-2.5"><p className="text-xl font-black text-foreground">{state.done}</p><p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">Vectorized</p></div>
          <div className="rounded-xl border border-[var(--card-border)] py-2.5"><p className="text-xl font-black text-foreground">{remaining}</p><p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">Remaining</p></div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={onHide} className="rounded-xl border border-[var(--card-border)] px-3 py-2.5 text-xs font-bold text-foreground hover:border-primary">Hide (keep running)</button>
          <button type="button" onClick={onStop} className="rounded-xl bg-red-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-red-500">Stop vectorizing</button>
        </div>
      </div>
    </div>
  );
}
