"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { renderSheetSvg } from "@/lib/presentation/render";
import type { IconStyle, PresentationIcon, Template } from "@/lib/presentation/types";
import { btnCls, btnPrimaryCls, inputCls } from "./StudioControls";

interface TemplateGalleryProps {
  builtins: Template[];
  customs: Template[];
  currentId: string;
  icons: PresentationIcon[];
  featuredId: string | null;
  strokeStyle: IconStyle["strokeStyle"];
  strokeWidth: number;
  message: string;
  onApply: (id: string) => void;
  onSave: (name: string) => void;
  onUpdate: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onExport: (id: string) => void;
  onDelete: (id: string) => void;
  onImport: (file: File) => void;
  onClose: () => void;
}

const linkBtn = "rounded px-1 py-0.5 text-[10px] font-bold text-[var(--text-secondary)] hover:text-foreground";

export function TemplateGallery(props: TemplateGalleryProps) {
  const { builtins, customs, currentId, icons, featuredId, strokeStyle, strokeWidth, message } = props;
  const [name, setName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // One stable listener: re-registering while the key event is still being dispatched would skip it.
  const closeRef = useRef(props.onClose);
  useEffect(() => { closeRef.current = props.onClose; });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") closeRef.current(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const thumbs = useMemo(() => {
    const sample = icons.slice(0, 40);
    const order = sample.map((i) => i.id);
    const out = new Map<string, string>();
    [...builtins, ...customs].forEach((tpl) => {
      const style: IconStyle = { fill: tpl.doc.iconFill || null, strokeStyle, strokeWidth };
      const svg = renderSheetSvg(tpl.doc, { icons: sample, order, featuredId: sample.some((i) => i.id === featuredId) ? featuredId : sample[0]?.id ?? null, style, showNames: false });
      out.set(tpl.id, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
    });
    return out;
  }, [builtins, customs, icons, featuredId, strokeStyle, strokeWidth]);

  const groups = useMemo(() => {
    const map = new Map<string, Template[]>();
    builtins.forEach((t) => map.set(t.group ?? "Templates", [...(map.get(t.group ?? "Templates") ?? []), t]));
    return [...map.entries()];
  }, [builtins]);

  const card = (tpl: Template) => {
    const active = tpl.id === currentId;
    return (
      <div key={tpl.id} className={`overflow-hidden rounded-xl border bg-[var(--input-bg)] ${active ? "border-primary ring-2 ring-primary/30" : "border-[var(--card-border)] hover:border-primary"}`}>
        <button type="button" onClick={() => props.onApply(tpl.id)} className="block w-full" aria-label={`Use ${tpl.name}`} aria-pressed={active}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumbs.get(tpl.id)} alt="" loading="lazy" className="block aspect-[5000/2600] w-full bg-white object-cover" />
        </button>
        <div className="flex items-center gap-1 px-2 py-1.5">
          <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-foreground">{tpl.name}</span>
          {!tpl.builtin && (
            <>
              <button type="button" className={linkBtn} onClick={() => props.onUpdate(tpl.id)} title="Replace this template with the current sheet">Update</button>
              <button type="button" className={linkBtn} onClick={() => { const next = window.prompt("Template name", tpl.name); if (next?.trim()) props.onRename(tpl.id, next.trim()); }}>Rename</button>
              <button type="button" className={linkBtn} onClick={() => props.onExport(tpl.id)} title="Download as a .json template file">Export</button>
              <button type="button" className={`${linkBtn} !text-red-500`} onClick={() => { if (window.confirm(`Delete "${tpl.name}"?`)) props.onDelete(tpl.id); }}>Delete</button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Templates" data-compact-ui onClick={props.onClose}>
      <div className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] text-foreground shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-[var(--card-border)] px-4 py-3">
          <div>
            <h2 className="text-sm font-black">Templates</h2>
            <p className="text-xs text-[var(--text-secondary)]">Pick a look. It keeps your icons and sheet title.</p>
          </div>
          <button type="button" autoFocus className={btnCls} onClick={props.onClose} aria-label="Close"><X className="h-3.5 w-3.5" /></button>
        </div>

        <div className="space-y-5 overflow-y-auto p-4">
          {groups.map(([group, list]) => (
            <section key={group}>
              <h3 className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--text-secondary)]">{group}</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{list.map(card)}</div>
            </section>
          ))}
          <section>
            <h3 className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--text-secondary)]">My templates</h3>
            {customs.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{customs.map(card)}</div>
            ) : (
              <p className="rounded-xl border border-dashed border-[var(--card-border)] p-4 text-xs text-[var(--text-secondary)]">
                Nothing here yet. Design a sheet in the editor, then save it below. You can also import a template file.
              </p>
            )}
          </section>
        </div>

        <div className="space-y-2 border-t border-[var(--card-border)] px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <input className={`${inputCls} !w-56`} placeholder="Name for the current sheet" value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && name.trim()) { props.onSave(name.trim()); setName(""); } }} />
            <button type="button" className={btnPrimaryCls} disabled={!name.trim()} onClick={() => { props.onSave(name.trim()); setName(""); }}>Save as template</button>
            <button type="button" className={btnCls} onClick={() => fileRef.current?.click()}>Import template file</button>
            <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) props.onImport(file); event.target.value = ""; }} />
          </div>
          <p className={`text-[11px] ${message ? "text-primary" : "text-[var(--text-secondary)]"}`}>
            {message || "Saving keeps every layer, colour and image on the sheet. Export a template to share it or reuse it elsewhere."}
          </p>
        </div>
      </div>
    </div>
  );
}
