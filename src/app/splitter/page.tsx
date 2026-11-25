"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Check, Download, FileImage, RotateCcw, SlidersHorizontal, Sparkles, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ImageTracePanel } from "@/components/ImageTracePanel";
import { IconSlicePanel, SliceOptionsStrip, type SliceOptions } from "@/components/IconSlicePanel";
import { VectorizeProgress, type VectorizeProgressState } from "@/components/VectorizeProgress";
import { DEFAULT_STROKE, StrokeControls, type StrokeSettings } from "@/components/presentation/StrokeControls";
import { PresentationStudio } from "@/components/presentation/PresentationStudio";
import { styledIconSvg } from "@/lib/presentation/render";
import { ManualSplitModal } from "@/components/ManualSplitModal";
import { WorkspaceToolbar } from "@/components/WorkspaceToolbar";
import { processEPSFile, splitDocumentIntoGrid } from "@/services/epsParser";
import { batchExportIcons, generateSingleIconBlob, triggerDownload } from "@/services/exportEngine";
import {
  DEFAULT_TRACE_OPTIONS, findDuplicatePieces, findTextLikePieces, renderPieceThumbnails, sliceImageFile, traceResultToDocument, traceSession,
  type TraceOptions, type TraceResult, type TraceSession,
} from "@/services/imageVectorizer";
import type { EPSDocument, ExtractedIcon, ExportFormat, ExportSettings } from "@/types";
import { idbGet, idbGetSync, idbSet, idbRemove, readSessionValue, removeSessionValue, writeSessionValue } from "@/lib/safeStorage";
import { consumeFeatureCredit } from "@/lib/feature-credits";
import { prepareSvgFor3D } from "@/lib/prepare-svg-for-3d";
import FeaturePageGate from "@/components/dashboard/FeaturePageGate";

const defaultExportSettings: ExportSettings = {
  format: "svg", multiFormat: false, selectedFormats: ["svg"], size: "512", customWidth: 512, customHeight: 512,
  lockAspectRatio: true, background: "transparent", customBgColor: "#ffffff", padding: 4, namingPattern: "custom",
  customPrefix: "icon", svgPreserveVectors: true, svgOptimize: false, svgResponsive: false, pdfMultiPage: false,
};

const SPLITTER_WORKSPACE_KEY = "mcustock_splitter_workspace";
const SPLITTER_SETTINGS_KEY = "mcustock_splitter_settings";
const SPLITTER_TRACE_KEY = "mcustock_splitter_trace_options";
const SPLITTER_PREFS_KEY = "mcustock_splitter_prefs_v1";
const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|gif|bmp|avif)$/i;
const VECTOR_EXTENSIONS = /\.(svg|eps|ai)$/i;

function isImageFile(file: File) {
  return file.type.startsWith("image/") && file.type !== "image/svg+xml" ? true : IMAGE_EXTENSIONS.test(file.name);
}

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
  const [settingsHydrated, setSettingsHydrated] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [inputMode, setInputMode] = useState<"vector" | "image">("vector");
  const [traceOptions, setTraceOptions] = useState<TraceOptions>(DEFAULT_TRACE_OPTIONS);
  const [traceHydrated, setTraceHydrated] = useState(false);
  const [sourceImage, setSourceImage] = useState<File | null>(null);
  const [traceInfo, setTraceInfo] = useState<TraceResult["info"] | null>(null);
  const [traceStatus, setTraceStatus] = useState<{ message: string; percent: number } | null>(null);
  const [session, setSession] = useState<TraceSession | null>(null);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  const [textLike, setTextLike] = useState<Set<number>>(new Set());
  const [dupGroups, setDupGroups] = useState<number[][]>([]);
  const [sliceOptions, setSliceOptions] = useState<SliceOptions>({ shuffle: false, autoDuplicates: true });
  const [stroke, setStroke] = useState<StrokeSettings>(DEFAULT_STROKE);
  const [progress, setProgress] = useState<VectorizeProgressState | null>(null);
  const [progressHidden, setProgressHidden] = useState(false);
  const [viewMode, setViewMode] = useState<"tiles" | "presentation">("tiles");
  const abortRef = useRef<AbortController | null>(null);
  const [showTraceSettings, setShowTraceSettings] = useState(false);
  const [dragging, setDragging] = useState(false);
  const restoredWorkspace = useRef(false);
  const settings = useMemo<ExportSettings>(() => ({ ...defaultExportSettings, format, customPrefix: prefix || "icon" }), [format, prefix]);
  const displayIcons = useMemo(() => !stroke.enabled ? icons : icons.map((icon) => ({
    ...icon,
    previewDataUrl: undefined,
    svgContent: styledIconSvg({ id: icon.id, name: icon.name, svg: icon.svgContent, singleTone: !!icon.color }, { fill: null, strokeStyle: stroke.style, strokeWidth: stroke.width }),
  })), [icons, stroke]);
  const duplicateSet = useMemo(() => new Set(dupGroups.flat()), [dupGroups]);
  const visibleIcons = useMemo(() => displayIcons.filter((icon) => icon.name.toLowerCase().includes(search.toLowerCase())).filter((icon) => filter === "all" || (filter === "selected" ? icon.selected : !icon.selected)).sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "size" ? b.width * b.height - a.width * a.height : sort === "paths" ? b.pathCount - a.pathCount : a.index - b.index), [displayIcons, search, filter, sort]);
  const selectedIcons = displayIcons.filter((icon) => icon.selected);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SPLITTER_SETTINGS_KEY);
      if (saved) {
        const settings = JSON.parse(saved) as { prefix?: string; format?: ExportFormat };
        if (typeof settings.prefix === "string") setPrefix(settings.prefix);
        if (["svg", "eps", "png", "jpg", "webp", "pdf"].includes(settings.format || "")) {
          setFormat(settings.format!);
        }
      }
    } catch {
    } finally {
      setSettingsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!settingsHydrated) return;
    try {
      localStorage.setItem(SPLITTER_SETTINGS_KEY, JSON.stringify({ prefix, format }));
    } catch {
    }
  }, [prefix, format, settingsHydrated]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SPLITTER_TRACE_KEY);
      if (saved) setTraceOptions({ ...DEFAULT_TRACE_OPTIONS, ...(JSON.parse(saved) as Partial<TraceOptions>) });
    } catch {
    } finally {
      setTraceHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!traceHydrated) return;
    try {
      localStorage.setItem(SPLITTER_TRACE_KEY, JSON.stringify(traceOptions));
    } catch {
    }
  }, [traceOptions, traceHydrated]);

  const [prefsHydrated, setPrefsHydrated] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SPLITTER_PREFS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { slice?: Partial<SliceOptions>; stroke?: Partial<StrokeSettings> };
        setSliceOptions((cur) => ({ ...cur, ...parsed.slice }));
        setStroke((cur) => ({ ...cur, ...parsed.stroke }));
      }
    } catch {
    } finally {
      setPrefsHydrated(true);
    }
  }, []);
  useEffect(() => {
    if (!prefsHydrated) return;
    try { localStorage.setItem(SPLITTER_PREFS_KEY, JSON.stringify({ slice: sliceOptions, stroke })); } catch { }
  }, [sliceOptions, stroke, prefsHydrated]);

  useEffect(() => {
    // 1. Instant sync restore from memory cache
    const syncSaved = idbGetSync<{ document: EPSDocument; icons: ExtractedIcon[] }>(SPLITTER_WORKSPACE_KEY)
      || readSessionValue<{ document: EPSDocument; icons: ExtractedIcon[] }>(SPLITTER_WORKSPACE_KEY);
    if (syncSaved?.document && Array.isArray(syncSaved.icons) && syncSaved.icons.length > 0) {
      setDocument(syncSaved.document);
      setIcons(syncSaved.icons);
      restoredWorkspace.current = true;
      return;
    }

    // 2. Async restore from IndexedDB (e.g. after browser refresh)
    void idbGet<{ document: EPSDocument; icons: ExtractedIcon[] }>(SPLITTER_WORKSPACE_KEY).then((asyncSaved) => {
      if (asyncSaved?.document && Array.isArray(asyncSaved.icons) && asyncSaved.icons.length > 0) {
        setDocument(asyncSaved.document);
        setIcons(asyncSaved.icons);
      }
      restoredWorkspace.current = true;
    });
  }, []);

  useEffect(() => {
    if (!restoredWorkspace.current) return;
    if (!document || !icons.length) {
      removeSessionValue(SPLITTER_WORKSPACE_KEY);
      void idbRemove(SPLITTER_WORKSPACE_KEY);
      return;
    }
    writeSessionValue(SPLITTER_WORKSPACE_KEY, { document, icons });
    void idbSet(SPLITTER_WORKSPACE_KEY, { document, icons });
  }, [document, icons]);

  const loadFile = async (file: File) => {
    setBusy(true); setError("");
    try { const parsed = await processEPSFile(file, undefined, "balanced"); setDocument(parsed); setIcons(parsed.icons); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not parse this vector file."); }
    finally { setBusy(false); }
  };
  const resetSlicing = () => {
    setSession(null); setThumbs([]); setRemoved(new Set()); setTextLike(new Set()); setDupGroups([]);
  };
  /** Stage 1: find and separate every icon (fast, nothing is vectorized yet). */
  const sliceImage = async (file: File, options: TraceOptions = traceOptions) => {
    setBusy(true); setError(""); setTraceStatus({ message: "Reading image…", percent: 1 });
    try {
      const next = await sliceImageFile(file, options, (message, percent) => setTraceStatus({ message, percent: Math.min(95, percent) }));
      setTraceStatus({ message: "Preparing previews…", percent: 97 });
      await new Promise((resolve) => setTimeout(resolve, 0));
      setThumbs(renderPieceThumbnails(next));
      setSession(next);
      setSourceImage(file);
      setTraceInfo(next.info);
      setRemoved(new Set());
      setTextLike(new Set(findTextLikePieces(next)));
      setDupGroups(sliceOptions.autoDuplicates ? findDuplicatePieces(next) : []);
      setDocument(null); setIcons([]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not read this image."); }
    finally { setBusy(false); setTraceStatus(null); }
  };
  const togglePiece = (index: number) => setRemoved((cur) => { const next = new Set(cur); if (next.has(index)) next.delete(index); else next.add(index); return next; });
  const removeTextPieces = () => setRemoved((cur) => new Set([...cur, ...textLike]));
  const removeDuplicatePieces = () => setRemoved((cur) => new Set([...cur, ...dupGroups.flatMap((group) => group.slice(1))]));
  const checkDuplicates = () => { if (session) setDupGroups(findDuplicatePieces(session)); };
  /** Stage 2: trace the pieces that were kept. */
  const vectorize = async () => {
    if (!session || !sourceImage) return;
    const indexes = session.pieces.map((piece) => piece.index).filter((index) => !removed.has(index));
    if (!indexes.length) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true); setError(""); setProgressHidden(false);
    setProgress({ fileName: sourceImage.name, message: "Starting…", percent: 0, done: 0, total: indexes.length });
    try {
      const result = await traceSession(session, indexes, (message, percent, stats) => setProgress((cur) => ({ fileName: sourceImage.name, message, percent, done: stats?.done ?? cur?.done ?? 0, total: stats?.total ?? indexes.length })), controller.signal);
      const size = sourceImage.size > 1024 * 1024 ? `${(sourceImage.size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(sourceImage.size / 1024))} KB`;
      const traced = traceResultToDocument(result, sourceImage.name, size);
      const list = [...traced.icons];
      if (sliceOptions.shuffle) {
        for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
      }
      setTraceInfo(result.info); setDocument(traced); setIcons(list); setViewMode("tiles");
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") setError("Vectorizing was stopped. Your slices are kept, so you can start again.");
      else setError(cause instanceof Error ? cause.message : "Could not vectorize this image.");
    } finally { setBusy(false); setProgress(null); abortRef.current = null; }
  };
  const stopVectorizing = () => abortRef.current?.abort();
  const renameIcon = (id: string, name: string) => setIcons((current) => current.map((icon) => icon.id === id ? { ...icon, name } : icon));
  const handleFile = (file: File) => {
    if (isImageFile(file)) { setInputMode("image"); void sliceImage(file); return; }
    if (VECTOR_EXTENSIONS.test(file.name) || file.type === "image/svg+xml" || file.type === "application/postscript") { setSourceImage(null); setTraceInfo(null); resetSlicing(); void loadFile(file); return; }
    setError("Unsupported file. Upload an SVG / EPS / AI vector sheet, or a PNG / JPG / WebP icon sheet to trace.");
  };
  const replaceIcons = (nextIcons: ExtractedIcon[]) => { setIcons(nextIcons); setError(nextIcons.length ? "" : "No icons were found in those regions."); };
  const applyGrid = (columns: number, rows: number) => { if (document) replaceIcons(splitDocumentIntoGrid(document, columns, rows)); };
  const exportSelected = async (all = false) => {
    const target = all ? displayIcons.map((icon) => ({ ...icon, selected: true })) : selectedIcons; if (!target.length) return; setBusy(true);
    try { await consumeFeatureCredit("splitter_export", target.length); await batchExportIcons(target, { ...settings, multiFormat: false }, `${prefix || "icons"}.zip`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Export failed."); }
    finally { setBusy(false); }
  };
  const exportOne = async (icon: ExtractedIcon) => {
    setBusy(true);
    try { await consumeFeatureCredit("splitter_export"); const result = await generateSingleIconBlob(icon, format, settings); triggerDownload(result.blob, result.filename); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Export failed."); }
    finally { setBusy(false); }
  };
  const openStudio = async (icon: ExtractedIcon) => {
    const payload = [{ svg: icon.svgContent, name: `${icon.name}.svg`, createdAt: Date.now() }];
    writeSessionValue("mcustock_studio_import", payload);
    await idbSet("mcustock_studio_import", payload);
    router.push("/dashboard/3d-icon-studio");
  };
  const openSelectedInStudio = async () => {
    if (!selectedIcons.length) return;
    const payload = selectedIcons.map((icon, index) => ({ svg: icon.svgContent, name: `${icon.name}.svg`, createdAt: Date.now() + index }));
    writeSessionValue("mcustock_studio_import", payload);
    await idbSet("mcustock_studio_import", payload);
    router.push("/dashboard/3d-icon-studio");
  };
  const prepareFor3D = async (targetIcons: ExtractedIcon[]) => {
    if (!targetIcons.length) return;
    setBusy(true);
    setError("");
    try {
      const warnings: string[] = [];
      const payload = targetIcons.map((icon, index) => {
        const prepared = prepareSvgFor3D(icon.svgContent);
        if (prepared.skippedStrokePathCount > 0) {
          warnings.push(`${icon.name}: ${prepared.skippedStrokePathCount} stroke-only path(s)`);
        }
        return {
          svg: prepared.svg,
          name: `${icon.name}.svg`,
          createdAt: Date.now() + index,
          preparedFor3D: true,
        };
      });

      if (warnings.length > 0) {
        const shouldContinue = window.confirm(
          `${warnings.join("\n")} could not be filled for extrusion. Continue with the closed shapes that were prepared?`
        );
        if (!shouldContinue) return;
      }

      writeSessionValue("mcustock_studio_import", payload);
      await idbSet("mcustock_studio_import", payload);
      router.push("/dashboard/3d-icon-studio");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not prepare these icons for 3D.");
    } finally {
      setBusy(false);
    }
  };
  const prepareSelectedFor3D = () => prepareFor3D(selectedIcons);
  const toggleIcon = (id: string) => setIcons((current) => current.map((icon) => icon.id === id ? { ...icon, selected: !icon.selected } : icon));
  const clearWorkspace = () => {
    removeSessionValue("mcustock_studio_import");
    void idbRemove("mcustock_studio_import");
    removeSessionValue(SPLITTER_WORKSPACE_KEY);
    void idbRemove(SPLITTER_WORKSPACE_KEY);
    setDocument(null);
    setIcons([]);
    setSourceImage(null);
    setTraceInfo(null);
    resetSlicing();
    setViewMode("tiles");
    setShowTraceSettings(false);
    setError("");
    setSearch("");
    setFilter("all");
    setShowManual(false);
  };

  return <div className="space-y-5 pb-8 text-slate-100" style={{ "--foreground": "#f1f5f9" } as React.CSSProperties}>
    <input ref={inputRef} type="file" accept=".svg,.eps,.ai,image/svg+xml,application/postscript" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) handleFile(file); event.currentTarget.value = ""; }} />
    <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif,.png,.jpg,.jpeg,.webp,.gif,.bmp,.avif" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) handleFile(file); event.currentTarget.value = ""; }} />
    <section className="rounded-[24px] border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-xl sm:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Vector production tool</p><h1 className="mt-3 text-3xl font-black text-foreground sm:text-5xl">Vector Sheet <span className="text-primary">Splitter</span></h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">Extract isolated SVG paths from SVG, EPS, and Illustrator sheets — or trace a PNG / JPG icon sheet into clean, separated vector icons.</p></div><button type="button" onClick={() => router.push("/dashboard/3d-icon-studio")} className="!transform-none inline-flex h-10 items-center gap-2 rounded-full border border-transparent bg-red-600 px-4 text-[11px] font-extrabold uppercase tracking-[0.1em] text-white shadow-[0_4px_16px_rgba(220,38,38,0.3)] transition-colors hover:!transform-none hover:bg-red-500 hover:shadow-[0_4px_18px_rgba(220,38,38,0.4)]"><Box className="h-4 w-4" />3D Studio</button></div></section>
    {document && viewMode === "tiles" && <WorkspaceToolbar totalCount={icons.length} selectedCount={selectedIcons.length} onSelectAll={() => setIcons((current) => current.map((icon) => ({ ...icon, selected: true })))} onDeselectAll={() => setIcons((current) => current.map((icon) => ({ ...icon, selected: false })))} onOpenInStudio={openSelectedInStudio} onPrepareFor3D={() => void prepareSelectedFor3D()} onExportSelected={() => void exportSelected()} onExportAll={() => void exportSelected(true)} onReprocess={() => { if (sourceImage) { setDocument(null); setIcons([]); if (!session) void sliceImage(sourceImage); } else if (document) void loadFile(new File([document.rawContent], document.filename)); }} onManualSplit={() => setShowManual(true)} onGridSplit={applyGrid} searchQuery={search} onSearchChange={setSearch} filterMode={filter} onFilterModeChange={setFilter} sortBy={sort} onSortByChange={setSort} />}
    {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
    {!document ? <div className="space-y-4">
      <div className="inline-flex rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-1 shadow-xl" role="tablist" aria-label="Input type">
        <button type="button" role="tab" aria-selected={inputMode === "vector"} onClick={() => setInputMode("vector")} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition-colors ${inputMode === "vector" ? "bg-primary text-[#071b17]" : "text-[var(--text-secondary)] hover:text-foreground"}`}><UploadCloud className="h-4 w-4" />Vector sheet</button>
        <button type="button" role="tab" aria-selected={inputMode === "image"} onClick={() => setInputMode("image")} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition-colors ${inputMode === "image" ? "bg-primary text-[#071b17]" : "text-[var(--text-secondary)] hover:text-foreground"}`}><FileImage className="h-4 w-4" />Image → Vector<span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">New</span></button>
      </div>
      {inputMode === "vector" ? <button type="button" onClick={() => inputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files?.[0]; if (file) handleFile(file); }} className={`group flex min-h-[360px] w-full flex-col items-center justify-center rounded-[24px] border-2 border-dashed bg-[var(--card-bg)] p-8 text-center shadow-xl transition hover:border-primary hover:bg-primary/[0.04] ${dragging ? "border-primary bg-primary/[0.06]" : "border-primary/40"}`}><span className="mb-4 rounded-2xl bg-primary/10 p-4 text-primary transition group-hover:scale-105"><UploadCloud className="h-10 w-10" /></span><h2 className="text-xl font-black text-foreground">{busy ? "Processing vector sheet..." : "Upload a vector sheet"}</h2><p className="mt-2 text-sm text-[var(--text-secondary)]">SVG, outlined EPS, and Illustrator exports are processed locally.</p><span className="mt-5 rounded-xl bg-primary px-4 py-2.5 text-xs font-black text-white shadow-[0_4px_16px_rgba(22,199,132,0.25)]">Choose file</span></button> : session ? <>
        <IconSlicePanel fileName={sourceImage?.name ?? "the image"} pieces={session.pieces} thumbs={thumbs} removed={removed} textLike={textLike} duplicates={duplicateSet} busy={busy} options={sliceOptions} onOptionsChange={setSliceOptions} onToggle={togglePiece} onRemoveText={removeTextPieces} onRemoveDuplicates={removeDuplicatePieces} onCheckDuplicates={checkDuplicates} onRestoreAll={() => setRemoved(new Set())} onVectorize={() => void vectorize()} onOpenSettings={() => setShowTraceSettings((open) => !open)} onCancel={() => { resetSlicing(); setSourceImage(null); setTraceInfo(null); setShowTraceSettings(false); }} />
        {showTraceSettings && <div className="space-y-3"><ImageTracePanel options={traceOptions} onChange={setTraceOptions} disabled={busy} /><div className="flex flex-wrap items-start justify-between gap-3"><div className="w-full max-w-md"><StrokeControls value={stroke} onChange={setStroke} /></div>{sourceImage && <button type="button" disabled={busy} onClick={() => void sliceImage(sourceImage)} className="rounded-xl border border-[var(--card-border)] px-3 py-2 text-xs font-bold text-foreground hover:border-primary disabled:opacity-50">Re-slice with these settings</button>}</div></div>}
      </> : <>
        <button type="button" disabled={busy} onClick={() => imageInputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files?.[0]; if (file) handleFile(file); }} className={`group flex min-h-[300px] w-full flex-col items-center justify-center rounded-[24px] border-2 border-dashed bg-[var(--card-bg)] p-8 text-center shadow-xl transition hover:border-primary hover:bg-primary/[0.04] disabled:cursor-wait ${dragging ? "border-primary bg-primary/[0.06]" : "border-primary/40"}`}>
          <span className="mb-4 rounded-2xl bg-primary/10 p-4 text-primary transition group-hover:scale-105"><FileImage className="h-10 w-10" /></span>
          <h2 className="text-xl font-black text-foreground">{traceStatus ? traceStatus.message : "Upload an icon sheet image"}</h2>
          {traceStatus ? <span className="mt-4 block h-2 w-full max-w-sm overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-primary transition-all" style={{ width: `${traceStatus.percent}%` }} /></span> : <><p className="mt-2 max-w-xl text-sm text-[var(--text-secondary)]">Drop a PNG, JPG or WebP sheet. Every icon is detected, separated, ordered left-to-right and traced to clean vector paths — all locally in your browser.</p><span className="mt-5 rounded-xl bg-primary px-4 py-2.5 text-xs font-black text-white shadow-[0_4px_16px_rgba(22,199,132,0.25)]">Choose image</span></>}
        </button>
        <ImageTracePanel options={traceOptions} onChange={setTraceOptions} disabled={busy} />
      </>}
    </div> : <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-xl"><div><p className="font-black text-foreground">{document.filename}</p><p className="text-xs text-[var(--text-secondary)]">{icons.length} icons · {selectedIcons.length} selected</p></div><div className="flex flex-wrap items-center gap-2"><div className="inline-flex rounded-lg border border-[var(--card-border)] bg-[var(--input-bg)] p-0.5" role="tablist" aria-label="View">{(["tiles", "presentation"] as const).map((mode) => <button key={mode} type="button" role="tab" aria-selected={viewMode === mode} onClick={() => setViewMode(mode)} className={`rounded-md px-3 py-1.5 text-xs font-bold capitalize transition-colors ${viewMode === mode ? "bg-primary text-[#071b17]" : "text-[var(--text-secondary)] hover:text-foreground"}`}>{mode}</button>)}</div><input value={prefix} onChange={(event) => setPrefix(event.target.value.replace(/[^a-z0-9-_]/gi, "-"))} aria-label="Filename prefix" className="w-24 rounded-lg border border-[var(--card-border)] bg-[var(--input-bg)] px-2 py-2 text-xs text-foreground" /><select value={format} onChange={(event) => setFormat(event.target.value as ExportFormat)} className="rounded-lg border border-[var(--card-border)] bg-[var(--input-bg)] px-2 py-2 text-xs text-foreground"><option value="svg">SVG</option><option value="eps">EPS</option><option value="png">PNG</option><option value="jpg">JPG</option><option value="webp">WebP</option><option value="pdf">PDF</option></select><button type="button" onClick={clearWorkspace} className="inline-flex items-center gap-1.5 rounded-xl border border-red-600 bg-red-600 px-3 py-2 text-xs font-bold text-white hover:border-red-500 hover:bg-red-500 dark:border-red-600 dark:bg-red-600 dark:text-white dark:hover:border-red-500 dark:hover:bg-red-500 transition-all duration-150 active:scale-95 shadow-xs" title="Clear workspace"><RotateCcw className="h-3.5 w-3.5" />Clear</button></div></div>
      {sourceImage && <div className="space-y-3 rounded-[24px] border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3"><span className="rounded-xl bg-primary/10 p-2 text-primary"><FileImage className="h-4 w-4" /></span><div><p className="text-sm font-black text-foreground">Vectorized from {sourceImage.name}</p><p className="text-xs text-[var(--text-secondary)]">{traceOptions.mode === "multicolor" ? "Multicolor" : "Single tone"}{traceOptions.grouping == null ? " · automatic icon detection" : traceInfo ? ` · grouping gap ${traceInfo.groupingGap}px` : ""}</p></div></div>
          <div className="flex items-center gap-2"><button type="button" onClick={() => setShowTraceSettings((open) => !open)} className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--card-border)] px-3 py-2 text-xs font-bold text-foreground hover:border-primary"><SlidersHorizontal className="h-3.5 w-3.5" />Trace settings</button><button type="button" disabled={busy} onClick={() => { setDocument(null); setIcons([]); void sliceImage(sourceImage); }} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-black text-[#071b17] hover:bg-primary-hover disabled:opacity-50"><Sparkles className="h-3.5 w-3.5" />{busy && traceStatus ? `${traceStatus.percent}%` : "Re-slice"}</button></div>
        </div>
        {showTraceSettings && <ImageTracePanel options={traceOptions} onChange={setTraceOptions} disabled={busy} />}
      </div>}
      <div className="max-w-md"><StrokeControls value={stroke} onChange={setStroke} /></div>
      {viewMode === "presentation" ? <PresentationStudio icons={icons} sheetName={document.filename.replace(/\.[^.]+$/, "")} strokeStyle={stroke.enabled ? stroke.style : "fill"} strokeWidth={stroke.enabled ? stroke.width : 0} onRename={renameIcon} onBeforeExport={(units) => consumeFeatureCredit("splitter_export", units)} onError={setError} /> : visibleIcons.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{visibleIcons.map((icon) => <article key={icon.id} className={`overflow-hidden rounded-2xl border transition-all ${icon.selected ? "border-primary bg-primary/5 shadow-[0_0_0_1px_rgba(52,211,153,0.15)]" : "border-white/10 bg-[#0a1915]"}`}><button type="button" onClick={() => toggleIcon(icon.id)} className="relative block aspect-square w-full bg-white p-4"><img src={makePreview(icon)} alt={icon.name} className="h-full w-full object-contain" />{icon.selected ? <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-black shadow-lg ring-2 ring-white"><Check className="h-3.5 w-3.5" /></span> : <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 border-slate-300 bg-white/80 text-transparent"><Check className="h-3.5 w-3.5" /></span>}</button><div className="p-3"><p className="truncate text-xs font-bold text-white">{icon.name}</p><div className="mt-3 flex gap-1"><button type="button" onClick={() => void exportOne(icon)} title="Download" className="rounded-lg border border-white/10 p-2 text-slate-300"><Download className="h-3.5 w-3.5" /></button><button type="button" onClick={() => void openStudio(icon)} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-red-600 text-[10px] font-black text-white hover:bg-red-500"><Box className="h-3.5 w-3.5" />3D Studio</button><button type="button" onClick={() => void prepareFor3D([icon])} title={`Prepare ${icon.name} for 3D extrusion`} aria-label={`Prepare ${icon.name} for 3D extrusion`} className="rounded-lg bg-primary p-2 text-[#071b17] hover:bg-primary-hover"><Sparkles className="h-3.5 w-3.5" /></button></div></div></article>)}</div> : <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center text-sm text-slate-400">No icons match this filter.</div>}
    </>}
    {progress && <VectorizeProgress state={progress} hidden={progressHidden} onHide={() => setProgressHidden(true)} onShow={() => setProgressHidden(false)} onStop={stopVectorizing} />}
    {showManual && document && <ManualSplitModal isOpen={showManual} document={document} onClose={() => setShowManual(false)} onApplyManualSplit={replaceIcons} />}
  </div>;
}

export default function SheetSplitterPage() {
  return (
    <FeaturePageGate feature="Vector Sheet Splitter" keys={["vector_splitter", "splitter_export"]}>
      <ErrorBoundary><SplitterWorkspace /></ErrorBoundary>
    </FeaturePageGate>
  );
}
