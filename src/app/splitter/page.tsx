"use client";

import { useMemo, useRef, useState } from "react";
import { Box, Check, Download, RotateCcw, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ManualSplitModal } from "@/components/ManualSplitModal";
import { WorkspaceToolbar } from "@/components/WorkspaceToolbar";
import { processEPSFile, splitDocumentIntoGrid } from "@/services/epsParser";
import { batchExportIcons, generateSingleIconBlob, triggerDownload } from "@/services/exportEngine";
import type { EPSDocument, ExtractedIcon, ExportFormat, ExportSettings } from "@/types";
import { writeSessionValue } from "@/lib/safeStorage";

const defaultExportSettings: ExportSettings = {
  format: "svg", multiFormat: false, selectedFormats: ["svg"], size: "512", customWidth: 512, customHeight: 512,
  lockAspectRatio: true, background: "transparent", customBgColor: "#ffffff", padding: 4, namingPattern: "custom",
  customPrefix: "icon", svgPreserveVectors: true, svgOptimize: false, svgResponsive: false, pdfMultiPage: false,
};

function makePreview(icon: ExtractedIcon): string {
  return icon.previewDataUrl || `data:image/svg+xml;charset=utf-8,${encodeURIComponent(icon.svgContent)}`;
}

function SplitterWorkspace() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [document, setDocument] = useState<EPSDocument | null>(null);
  const [icons, setIcons] = useState<ExtractedIcon[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "selected" | "unselected">("all");
  const [sort, setSort] = useState<"order" | "name" | "size" | "paths">("order");
  const [showManual, setShowManual] = useState(false);
  const [prefix, setPrefix] = useState("icon");
  const [format, setFormat] = useState<ExportFormat>("svg");
  const settings = useMemo<ExportSettings>(() => ({ ...defaultExportSettings, format, customPrefix: prefix || "icon" }), [format, prefix]);
  const visibleIcons = useMemo(() => icons.filter((icon) => icon.name.toLowerCase().includes(search.toLowerCase())).filter((icon) => filter === "all" || (filter === "selected" ? icon.selected : !icon.selected)).sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "size" ? b.width * b.height - a.width * a.height : sort === "paths" ? b.pathCount - a.pathCount : a.index - b.index), [icons, search, filter, sort]);
  const selectedIcons = icons.filter((icon) => icon.selected);

  const loadFile = async (file: File) => {
    setBusy(true); setError("");
    try { const parsed = await processEPSFile(file, undefined, "balanced"); setDocument(parsed); setIcons(parsed.icons); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not parse this vector file."); }
    finally { setBusy(false); }
  };
  const replaceIcons = (nextIcons: ExtractedIcon[]) => { setIcons(nextIcons); setError(nextIcons.length ? "" : "No icons were found in those regions."); };
  const applyGrid = (columns: number, rows: number) => { if (document) replaceIcons(splitDocumentIntoGrid(document, columns, rows)); };
  const exportSelected = async (all = false) => {
    const target = all ? icons.map((icon) => ({ ...icon, selected: true })) : selectedIcons; if (!target.length) return; setBusy(true);
    try { await batchExportIcons(target, { ...settings, multiFormat: false }, `${prefix || "icons"}.zip`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Export failed."); }
    finally { setBusy(false); }
  };
  const exportOne = async (icon: ExtractedIcon) => {
    setBusy(true);
    try { const result = await generateSingleIconBlob(icon, format, settings); triggerDownload(result.blob, result.filename); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Export failed."); }
    finally { setBusy(false); }
  };
  const openStudio = (icon: ExtractedIcon) => {
    if (!writeSessionValue("mcustock_studio_import", { svg: icon.svgContent, name: `${icon.name}.svg`, createdAt: Date.now() })) { setError("Temporary browser storage is unavailable."); return; }
    router.push("/dashboard/3d-icon-studio");
  };
  const toggleIcon = (id: string) => setIcons((current) => current.map((icon) => icon.id === id ? { ...icon, selected: !icon.selected } : icon));
  const clearWorkspace = () => { setDocument(null); setIcons([]); setError(""); setSearch(""); setFilter("all"); setShowManual(false); };

  return <div className="space-y-5 pb-8 text-slate-100" style={{ "--foreground": "#f1f5f9" } as React.CSSProperties}>
    <input ref={inputRef} type="file" accept=".svg,.eps,.ai,image/svg+xml,application/postscript" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void loadFile(file); event.currentTarget.value = ""; }} />
    <section className="rounded-[24px] border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-xl sm:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Vector production tool</p><h1 className="mt-3 text-3xl font-black text-foreground sm:text-5xl">Vector Sheet <span className="text-primary">Splitter</span></h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">Extract isolated SVG paths from SVG, EPS, and Illustrator export sheets.</p></div><button type="button" onClick={() => router.push("/dashboard/3d-icon-studio")} className="!transform-none inline-flex h-10 items-center gap-2 rounded-full border border-transparent bg-primary px-4 text-[11px] font-extrabold uppercase tracking-[0.1em] text-white shadow-[0_4px_16px_rgba(22,199,132,0.3)] transition-colors hover:!transform-none hover:bg-primary-hover hover:shadow-[0_4px_18px_rgba(22,199,132,0.4)]"><Box className="h-4 w-4" />3D Studio</button></div></section>
    {document && <WorkspaceToolbar totalCount={icons.length} selectedCount={selectedIcons.length} onSelectAll={() => setIcons((current) => current.map((icon) => ({ ...icon, selected: true })))} onDeselectAll={() => setIcons((current) => current.map((icon) => ({ ...icon, selected: false })))} onExportSelected={() => void exportSelected()} onExportAll={() => void exportSelected(true)} onReprocess={() => { if (document) void loadFile(new File([document.rawContent], document.filename)); }} onManualSplit={() => setShowManual(true)} onGridSplit={applyGrid} searchQuery={search} onSearchChange={setSearch} filterMode={filter} onFilterModeChange={setFilter} sortBy={sort} onSortByChange={setSort} />}
    {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
    {!document ? <button type="button" onClick={() => inputRef.current?.click()} className="group flex min-h-[360px] w-full flex-col items-center justify-center rounded-[24px] border-2 border-dashed border-primary/40 bg-[var(--card-bg)] p-8 text-center shadow-xl transition hover:border-primary hover:bg-primary/[0.04]"><span className="mb-4 rounded-2xl bg-primary/10 p-4 text-primary transition group-hover:scale-105"><UploadCloud className="h-10 w-10" /></span><h2 className="text-xl font-black text-foreground">{busy ? "Processing vector sheet..." : "Upload a vector sheet"}</h2><p className="mt-2 text-sm text-[var(--text-secondary)]">SVG, outlined EPS, and Illustrator exports are processed locally.</p><span className="mt-5 rounded-xl bg-primary px-4 py-2.5 text-xs font-black text-white shadow-[0_4px_16px_rgba(22,199,132,0.25)]">Choose file</span></button> : <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-xl"><div><p className="font-black text-foreground">{document.filename}</p><p className="text-xs text-[var(--text-secondary)]">{icons.length} icons · {selectedIcons.length} selected</p></div><div className="flex flex-wrap items-center gap-2"><input value={prefix} onChange={(event) => setPrefix(event.target.value.replace(/[^a-z0-9-_]/gi, "-"))} aria-label="Filename prefix" className="w-24 rounded-lg border border-[var(--card-border)] bg-[var(--input-bg)] px-2 py-2 text-xs text-foreground" /><select value={format} onChange={(event) => setFormat(event.target.value as ExportFormat)} className="rounded-lg border border-[var(--card-border)] bg-[var(--input-bg)] px-2 py-2 text-xs text-foreground"><option value="svg">SVG</option><option value="eps">EPS</option><option value="png">PNG</option><option value="jpg">JPG</option><option value="webp">WebP</option><option value="pdf">PDF</option></select><button type="button" onClick={clearWorkspace} className="inline-flex items-center gap-2 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-400 transition hover:bg-red-500/20"><RotateCcw className="h-3.5 w-3.5" />Clear</button></div></div>
      {visibleIcons.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{visibleIcons.map((icon) => <article key={icon.id} className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a1915]"><button type="button" onClick={() => toggleIcon(icon.id)} className="relative block aspect-square w-full bg-white p-4"><img src={makePreview(icon)} alt={icon.name} className="h-full w-full object-contain" />{icon.selected && <span className="absolute right-2 top-2 rounded-full bg-primary p-1 text-black"><Check className="h-3 w-3" /></span>}</button><div className="p-3"><p className="truncate text-xs font-bold text-white">{icon.name}</p><div className="mt-3 flex gap-1"><button type="button" onClick={() => void exportOne(icon)} title="Download" className="rounded-lg border border-white/10 p-2 text-slate-300"><Download className="h-3.5 w-3.5" /></button><button type="button" onClick={() => openStudio(icon)} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary/10 text-[10px] font-black text-primary"><Box className="h-3.5 w-3.5" />3D Studio</button></div></div></article>)}</div> : <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center text-sm text-slate-400">No icons match this filter.</div>}
    </>}
    {showManual && document && <ManualSplitModal isOpen={showManual} document={document} onClose={() => setShowManual(false)} onApplyManualSplit={replaceIcons} />}
  </div>;
}

export default function SheetSplitterPage() { return <ErrorBoundary><SplitterWorkspace /></ErrorBoundary>; }
