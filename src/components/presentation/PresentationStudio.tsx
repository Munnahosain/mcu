"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import {
  AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd, AlignHorizontalJustifyStart,
  AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, AlignVerticalJustifyStart,
  Circle, Copy, Download, Eye, EyeOff, GripVertical, Grid3x3, Group, Hand, Hash, Image as ImageIcon, LayoutGrid, Lock, LockOpen,
  Minus, Pencil, Plus, Maximize, Redo2, Shuffle, Square, Star, Trash2, Triangle, Type, Ungroup, Undo2, X,
} from "lucide-react";
import type { ExtractedIcon } from "@/types";
import { triggerDownload } from "@/services/exportEngine";
import { gridLayout, renderIconAt, renderLayer, renderPageBackground, renderSheetSvg, styledIconSvg } from "@/lib/presentation/render";
import { builtinTemplates, cloneDoc, compactOf, makeLayer, parseTemplateFile, serializeTemplate, uid, withFreshIds } from "@/lib/presentation/templates";
import { DEFAULT_TWO_TONE, type IconStyle, type Layer, type PresentationIcon, type RenderContext, type SheetDoc, type StrokeStyle, type Template, type TwoToneStyle } from "@/lib/presentation/types";
import { btnCls, btnPrimaryCls, ColorField, Field, inputCls, NumberField, Panel, Segmented, SliderField } from "./StudioControls";
import { TemplateGallery } from "./TemplateGallery";

const PRESETS_KEY = "mcustock_presentation_presets_v1";
const STATE_KEY = "mcustock_presentation_state_v1";

export interface PresentationStudioProps {
  icons: ExtractedIcon[];
  sheetName: string;
  /** Stroke look chosen in the left settings (applies to the sheet and exported icons). */
  strokeStyle: StrokeStyle;
  strokeWidth: number;
  onRename: (id: string, name: string) => void;
  /** Called before any download; throw to cancel (e.g. out of credits). */
  onBeforeExport: (units: number) => Promise<void>;
  onError: (message: string) => void;
}

interface Hist { past: SheetDoc[]; present: SheetDoc; future: SheetDoc[] }
type Armed = { kind: "cell"; index: number } | { kind: "tray"; id: string } | null;
type Handle = "nw" | "ne" | "sw" | "se";

type DragState =
  | { kind: "move"; start: { x: number; y: number }; origins: Map<string, { x: number; y: number }>; before: SheetDoc; moved: boolean; layerId: string; wasSelected: boolean; box: Box; lines: SnapLines }
  | { kind: "resize"; handle: Handle; start: { x: number; y: number }; orig: Layer; before: SheetDoc; moved: boolean; lines: SnapLines }
  | { kind: "icon"; from: { kind: "cell"; index: number } | { kind: "tray"; id: string }; iconId: string; layerId: string; start: { x: number; y: number }; moved: boolean; target: number };

interface Box { x0: number; y0: number; x1: number; y1: number }
interface SnapLines { xs: number[]; ys: number[] }
interface Guides { v: number[]; h: number[] }
interface IconGhost { id: string; x: number; y: number; size: number; target: { x: number; y: number; s: number } | null }
const NO_GUIDES: Guides = { v: [], h: [] };

/** Nearest candidate line within `threshold`, returns the correction to apply. */
function snapTo(values: number[], candidates: number[], threshold: number): { delta: number; at: number | null } {
  let best = { delta: 0, at: null as number | null };
  let bestDist = threshold + 1e-6;
  for (const v of values) {
    for (const c of candidates) {
      const d = c - v;
      if (Math.abs(d) < bestDist) { bestDist = Math.abs(d); best = { delta: d, at: c }; }
    }
  }
  return best;
}

/** A ref that always holds the latest value, updated after each render (safe to read from event handlers). */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => { ref.current = value; });
  return ref;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function writeJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

/** Downscales a picked image to a data URL small enough to live inside a saved sheet. */
async function imageFileToDataUrl(file: File): Promise<{ href: string; ratio: number }> {
  if (file.size > 8 * 1024 * 1024) throw new Error("Image is larger than 8 MB.");
  if (file.type === "image/svg+xml" || /\.svg$/i.test(file.name)) {
    const text = await file.text();
    const box = /viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/.exec(text);
    const ratio = box ? Number(box[2]) / Number(box[1]) || 1 : 1;
    return { href: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`, ratio };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const max = 1800;
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * k));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * k));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available in this browser.");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const keepsAlpha = file.type === "image/png" || file.type === "image/webp" || file.type === "image/gif";
    return { href: canvas.toDataURL(keepsAlpha ? "image/png" : "image/jpeg", 0.9), ratio: canvas.height / canvas.width };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function safeFile(name: string) {
  return name.trim().replace(/[^a-z0-9-_ ]/gi, "-").replace(/\s+/g, "-").replace(/-+/g, "-") || "icon";
}

async function rasterize(svg: string, width: number, height: number, mime: "image/png" | "image/jpeg"): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available in this browser.");
    if (mime === "image/jpeg") { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, width, height); }
    ctx.drawImage(img, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode the image."))), mime, 0.92));
  } finally {
    URL.revokeObjectURL(url);
  }
}

const LayerMarkup = memo(function LayerMarkup({ markup }: { markup: string }) {
  return <g pointerEvents="none" dangerouslySetInnerHTML={{ __html: markup }} />;
});

export function PresentationStudio({ icons, sheetName, strokeStyle, strokeWidth, onRename, onBeforeExport, onError }: PresentationStudioProps) {
  const builtins = useMemo(() => builtinTemplates(), []);
  const [customs, setCustoms] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState(builtins[0].id);
  const [layoutMode, setLayoutMode] = useState<"branded" | "compact">("branded");
  const [hist, setHist] = useState<Hist>(() => ({ past: [], present: withFreshIds(builtins[0].doc), future: [] }));
  const [order, setOrder] = useState<string[]>(() => icons.map((i) => i.id));
  const [featuredId, setFeaturedId] = useState<string | null>(icons[0]?.id ?? null);
  const [selection, setSelection] = useState<string[]>([]);
  const [zoomMode, setZoomMode] = useState<"fit" | number>("fit");
  const [fitScale, setFitScale] = useState(0.2);
  const [panMode, setPanMode] = useState(false);
  const [spaceDown, setSpaceDown] = useState(false);
  const [armed, setArmed] = useState<Armed>(null);
  const [namesOpen, setNamesOpen] = useState(false);
  const [twoTone, setTwoTone] = useState<TwoToneStyle>(DEFAULT_TWO_TONE);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryMessage, setGalleryMessage] = useState("");
  const [snapOn, setSnapOn] = useState(true);
  const [guides, setGuides] = useState<Guides>(NO_GUIDES);
  const [iconGhost, setIconGhost] = useState<IconGhost | null>(null);
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const [dragLayer, setDragLayer] = useState<string | null>(null);
  const [dropMark, setDropMark] = useState<{ id: string; below: boolean } | null>(null);
  const cancelEdit = useRef(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const [format, setFormat] = useState<"svg" | "png" | "jpg">("svg");
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);

  const doc = hist.present;
  const scrollRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const lastKey = useRef<{ key: string; t: number } | null>(null);
  const panRef = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);
  const docRef = useLatest(doc);
  const selectionRef = useLatest(selection);
  const snapRef = useLatest(snapOn);
  const modalOpenRef = useLatest(galleryOpen || namesOpen);
  const [markupCache] = useState(() => new Map<string, { layer: Layer; env: string; markup: string }>());

  /* ------------------------------------------------------------ history */
  const commit = useCallback((fn: (d: SheetDoc) => SheetDoc, key?: string) => {
    setHist((h) => {
      const next = fn(h.present);
      if (next === h.present) return h;
      const now = Date.now();
      const coalesce = !!key && lastKey.current?.key === key && now - lastKey.current.t < 900;
      lastKey.current = key ? { key, t: now } : null;
      return coalesce ? { ...h, present: next } : { past: [...h.past.slice(-59), h.present], present: next, future: [] };
    });
  }, []);
  const live = useCallback((fn: (d: SheetDoc) => SheetDoc) => setHist((h) => ({ ...h, present: fn(h.present) })), []);
  const pushPast = useCallback((snapshot: SheetDoc) => setHist((h) => ({ past: [...h.past.slice(-59), snapshot], present: h.present, future: [] })), []);
  const undo = useCallback(() => setHist((h) => (h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h)), []);
  const redo = useCallback(() => setHist((h) => (h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h)), []);

  /* ----------------------------------------------------------- hydrate */
  useEffect(() => {
    const savedPresets = readJson<Template[]>(PRESETS_KEY);
    if (Array.isArray(savedPresets)) setCustoms(savedPresets);
    const saved = readJson<{ doc: SheetDoc; templateId: string; layoutMode: "branded" | "compact"; twoTone?: Partial<TwoToneStyle> }>(STATE_KEY);
    if (saved?.twoTone) setTwoTone({ ...DEFAULT_TWO_TONE, ...saved.twoTone });
    if (saved?.doc && Array.isArray(saved.doc.layers)) {
      setHist({ past: [], present: saved.doc, future: [] });
      setTemplateId(saved.templateId || builtins[0].id);
      setLayoutMode(saved.layoutMode === "compact" ? "compact" : "branded");
    }
    setHydrated(true);
  }, [builtins]);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => writeJson(STATE_KEY, { doc, templateId, layoutMode, twoTone }), 400);
    return () => window.clearTimeout(timer);
  }, [doc, templateId, layoutMode, twoTone, hydrated]);

  useEffect(() => {
    setOrder((prev) => {
      const ids = icons.map((i) => i.id);
      const kept = prev.filter((id) => ids.includes(id));
      const next = [...kept, ...ids.filter((id) => !kept.includes(id))];
      return next.length === prev.length && next.every((v, i) => v === prev[i]) ? prev : next;
    });
    setFeaturedId((f) => (f && icons.some((i) => i.id === f) ? f : icons[0]?.id ?? null));
  }, [icons]);

  /* ------------------------------------------------------------ context */
  const presIcons = useMemo<PresentationIcon[]>(() => icons.map((i) => ({ id: i.id, name: i.name, svg: i.svgContent, singleTone: !!i.color })), [icons]);
  const style = useMemo<IconStyle>(() => ({ fill: doc.iconFill || null, strokeStyle, strokeWidth, twoTone }), [doc.iconFill, strokeStyle, strokeWidth, twoTone]);
  const ctx = useMemo<RenderContext>(() => ({ icons: presIcons, order, featuredId, style, showNames: false }), [presIcons, order, featuredId, style]);

  const envKey = [doc.title, doc.labelColor, order.join(","), featuredId, style.fill, style.strokeStyle, style.strokeWidth, JSON.stringify(twoTone), presIcons.map((i) => `${i.id}:${i.name}`).join(",")].join("|");
  const markups = useMemo(() => {
    const cache = markupCache;
    const alive = new Set<string>();
    const out = doc.layers.map((layer) => {
      alive.add(layer.id);
      const hit = cache.get(layer.id);
      if (hit && hit.layer === layer && hit.env === envKey) return { id: layer.id, markup: hit.markup };
      const markup = renderLayer(layer, doc, ctx);
      cache.set(layer.id, { layer, env: envKey, markup });
      return { id: layer.id, markup };
    });
    for (const id of cache.keys()) if (!alive.has(id)) cache.delete(id);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.layers, envKey]);

  const mainGrid = useMemo(() => doc.layers.find((l) => l.type === "grid" && l.visible), [doc.layers]);
  const gridInfo = useMemo(() => (mainGrid ? gridLayout(mainGrid, order.length) : null), [mainGrid, order.length]);
  const trayIds = gridInfo ? order.slice(gridInfo.capacity) : [];
  const iconById = useMemo(() => new Map(icons.map((i) => [i.id, i])), [icons]);

  /* --------------------------------------------------------------- zoom */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => {
      const fit = Math.min((el.clientWidth - 32) / docRef.current.width, (el.clientHeight - 32) / docRef.current.height);
      setFitScale(Math.max(0.03, Math.min(2, fit)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [doc.width, doc.height]);
  const scale = zoomMode === "fit" ? fitScale : zoomMode / 100;
  const scaleRef = useLatest(scale);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const current = scaleRef.current * 100;
      const next = Math.round(Math.max(10, Math.min(300, current * (event.deltaY < 0 ? 1.1 : 0.9))));
      setZoomMode(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  /* ----------------------------------------------------------- helpers */
  const selectedLayers = doc.layers.filter((l) => selection.includes(l.id));
  const single = selectedLayers.length === 1 ? selectedLayers[0] : null;
  const isShape = !!single && (single.type === "rect" || single.type === "ellipse" || single.type === "triangle" || single.type === "featured");

  const expandGroup = useCallback((id: string) => {
    const layer = docRef.current.layers.find((l) => l.id === id);
    if (!layer) return [id];
    return layer.groupId ? docRef.current.layers.filter((l) => l.groupId === layer.groupId).map((l) => l.id) : [id];
  }, []);

  const updateSelected = useCallback((patch: Partial<Layer>, key: string) => {
    const ids = new Set(selectionRef.current);
    commit((d) => ({ ...d, layers: d.layers.map((l) => (ids.has(l.id) && !l.locked ? { ...l, ...patch } : l)) }), key);
  }, [commit]);

  const updateDoc = useCallback((patch: Partial<SheetDoc>, key: string) => commit((d) => ({ ...d, ...patch }), key), [commit]);

  const deleteSelected = useCallback(() => {
    const ids = new Set(selectionRef.current);
    if (!ids.size) return;
    commit((d) => ({ ...d, layers: d.layers.filter((l) => !ids.has(l.id)) }));
    setSelection([]);
  }, [commit]);

  const addLayer = (partial: Partial<Layer> & Pick<Layer, "type" | "name">) => {
    const d = docRef.current;
    const w = partial.w ?? 600, h = partial.h ?? 400;
    const layer = makeLayer({ x: Math.round((d.width - w) / 2), y: Math.round((d.height - h) / 2), w, h, ...partial });
    commit((cur) => ({ ...cur, layers: [...cur.layers, layer] }));
    setSelection([layer.id]);
  };

  const copySelected = () => {
    const ids = new Set(selectionRef.current);
    if (!ids.size) return;
    const groupMap = new Map<string, string>();
    const copies: Layer[] = [];
    docRef.current.layers.forEach((l) => {
      if (!ids.has(l.id)) return;
      let groupId = l.groupId;
      if (groupId) { if (!groupMap.has(groupId)) groupMap.set(groupId, uid("g")); groupId = groupMap.get(groupId); }
      copies.push({ ...l, id: uid(), name: `${l.name} Copy`, x: l.x + 60, y: l.y + 60, groupId });
    });
    commit((d) => ({ ...d, layers: [...d.layers, ...copies] }));
    setSelection(copies.map((c) => c.id));
  };

  const groupSelected = () => {
    const ids = new Set(selectionRef.current);
    if (ids.size < 2) return;
    const groupId = uid("g");
    commit((d) => ({ ...d, layers: d.layers.map((l) => (ids.has(l.id) ? { ...l, groupId } : l)) }));
  };
  const ungroupSelected = () => {
    const ids = new Set(selectionRef.current);
    commit((d) => ({ ...d, layers: d.layers.map((l) => (ids.has(l.id) ? { ...l, groupId: undefined } : l)) }));
  };

  const moveLayer = (id: string, direction: 1 | -1) => {
    commit((d) => {
      const i = d.layers.findIndex((l) => l.id === id);
      const j = i + direction;
      if (i < 0 || j < 0 || j >= d.layers.length) return d;
      const layers = [...d.layers];
      [layers[i], layers[j]] = [layers[j], layers[i]];
      return { ...d, layers };
    });
  };

  const alignSelected = (mode: "left" | "centerH" | "right" | "top" | "centerV" | "bottom") => {
    const targets = docRef.current.layers.filter((l) => selectionRef.current.includes(l.id) && !l.locked);
    if (!targets.length) return;
    const d = docRef.current;
    const box = targets.length > 1
      ? { x0: Math.min(...targets.map((l) => l.x)), y0: Math.min(...targets.map((l) => l.y)), x1: Math.max(...targets.map((l) => l.x + l.w)), y1: Math.max(...targets.map((l) => l.y + l.h)) }
      : { x0: 0, y0: 0, x1: d.width, y1: d.height };
    const ids = new Set(targets.map((t) => t.id));
    commit((cur) => ({
      ...cur,
      layers: cur.layers.map((l) => {
        if (!ids.has(l.id)) return l;
        switch (mode) {
          case "left": return { ...l, x: box.x0 };
          case "centerH": return { ...l, x: (box.x0 + box.x1) / 2 - l.w / 2 };
          case "right": return { ...l, x: box.x1 - l.w };
          case "top": return { ...l, y: box.y0 };
          case "centerV": return { ...l, y: (box.y0 + box.y1) / 2 - l.h / 2 };
          default: return { ...l, y: box.y1 - l.h };
        }
      }),
    }));
  };

  /* ------------------------------------------------------- text + layer order */
  const startEdit = (layer: Layer) => {
    cancelEdit.current = false;
    setEditing({ id: layer.id, value: layer.text === "{title}" ? docRef.current.title : layer.text ?? "" });
  };
  const finishEdit = () => {
    const current = editing;
    setEditing(null);
    if (!current || cancelEdit.current) return;
    const layer = docRef.current.layers.find((l) => l.id === current.id);
    if (!layer) return;
    if (layer.text === "{title}") commit((d) => ({ ...d, title: current.value }));
    else commit((d) => ({ ...d, layers: d.layers.map((l) => (l.id === current.id ? { ...l, text: current.value } : l)) }));
  };

  const reorderLayer = (id: string, targetId: string, below: boolean) => {
    commit((d) => {
      if (id === targetId) return d;
      const moving = d.layers.find((l) => l.id === id);
      if (!moving) return d;
      const rest = d.layers.filter((l) => l.id !== id);
      const at = rest.findIndex((l) => l.id === targetId);
      if (at < 0) return d;
      // The list shows the front on top, so "below" in the list is a lower index.
      rest.splice(below ? at : at + 1, 0, moving);
      return { ...d, layers: rest };
    });
  };

  /* ----------------------------------------------------------- templates */
  const allTemplates = useMemo(() => [...builtins, ...customs], [builtins, customs]);
  const currentTemplate = allTemplates.find((t) => t.id === templateId);

  const templateDoc = useCallback((tpl: Template, mode: "branded" | "compact") => {
    const base = mode === "compact" ? tpl.compact ?? compactOf(tpl.doc) : tpl.doc;
    return withFreshIds(base);
  }, []);

  const applyTemplate = (id: string, mode = layoutMode) => {
    const tpl = allTemplates.find((t) => t.id === id);
    if (!tpl) return;
    const next = templateDoc(tpl, mode);
    next.title = docRef.current.title;
    setTemplateId(id);
    setLayoutMode(mode);
    commit(() => next);
    setSelection([]);
    setArmed(null);
    setEditing(null);
  };

  const storeCustoms = (next: Template[]) => {
    setCustoms(next);
    writeJson(PRESETS_KEY, next);
  };
  const saveTemplate = (name: string) => {
    const snapshot = cloneDoc(docRef.current);
    const preset: Template = { id: uid("tpl"), name, builtin: false, doc: snapshot, compact: compactOf(snapshot) };
    storeCustoms([...customs, preset]);
    setTemplateId(preset.id);
    setGalleryMessage(`Saved "${name}". It now lives under My templates.`);
  };
  const updateTemplate = (id: string) => {
    const snapshot = cloneDoc(docRef.current);
    storeCustoms(customs.map((t) => (t.id === id ? { ...t, doc: snapshot, compact: compactOf(snapshot) } : t)));
    setGalleryMessage("Template updated with the current sheet.");
  };
  const renameTemplate = (id: string, name: string) => storeCustoms(customs.map((t) => (t.id === id ? { ...t, name } : t)));
  const deleteTemplate = (id: string) => {
    storeCustoms(customs.filter((t) => t.id !== id));
    if (templateId === id) setTemplateId(builtins[0].id);
  };
  const exportTemplate = (id: string) => {
    const tpl = customs.find((t) => t.id === id);
    if (!tpl) return;
    triggerDownload(new Blob([serializeTemplate(tpl)], { type: "application/json" }), `${safeFile(tpl.name)}.template.json`);
  };
  const importTemplate = async (file: File) => {
    if (file.size > 25 * 1024 * 1024) { setGalleryMessage("That file is too large to be a template."); return; }
    const parsed = parseTemplateFile(await file.text());
    if (!parsed) { setGalleryMessage("That file is not a valid template."); return; }
    const preset: Template = { id: uid("tpl"), name: parsed.name, builtin: false, doc: parsed.doc, compact: compactOf(parsed.doc) };
    storeCustoms([...customs, preset]);
    setGalleryMessage(`Imported "${preset.name}".`);
  };

  const addImageLayer = async (file: File) => {
    try {
      const { href, ratio } = await imageFileToDataUrl(file);
      const w = 1200;
      addLayer({ type: "image", name: file.name.replace(/\.[^.]+$/, "").slice(0, 40) || "Image", href, w, h: Math.max(40, Math.round(w * ratio)) });
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Could not load that image.");
    }
  };

  /* --------------------------------------------------------- interaction */
  const toSheet = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: ((clientX - rect.left) / rect.width) * docRef.current.width, y: ((clientY - rect.top) / rect.height) * docRef.current.height };
  };

  const cellAt = (layer: Layer, p: { x: number; y: number }) => {
    const lay = gridLayout(layer, orderRef.current.length);
    const shown = Math.min(orderRef.current.length, lay.capacity);
    for (let i = 0; i < shown; i++) {
      const c = lay.cells[i];
      if (p.x >= c.x && p.x <= c.x + c.size && p.y >= c.y && p.y <= c.y + c.size) return i;
    }
    return -1;
  };
  const orderRef = useLatest(order);
  const armedRef = useLatest<Armed>(armed);

  const swapOrder = (a: number, b: number) => {
    setOrder((prev) => {
      if (a < 0 || b < 0 || a >= prev.length || b >= prev.length || a === b) return prev;
      const next = [...prev];
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });
  };

  /** Cell under (or magnetically near) a sheet point; -1 when none is close enough. */
  const nearestCell = (layer: Layer, p: { x: number; y: number }) => {
    const lay = gridLayout(layer, orderRef.current.length);
    const shown = Math.min(orderRef.current.length, lay.capacity);
    let best = -1, bestDist = Infinity;
    for (let i = 0; i < shown; i++) {
      const c = lay.cells[i];
      const d = Math.hypot(p.x - (c.x + c.size / 2), p.y - (c.y + c.size / 2));
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best >= 0 && bestDist <= lay.size * 0.75 ? best : -1;
  };

  /** Static alignment lines: sheet edges / centre plus every other visible layer. */
  const snapLinesFor = (exclude: Set<string>): SnapLines => {
    const d = docRef.current;
    const xs = [0, d.width / 2, d.width], ys = [0, d.height / 2, d.height];
    d.layers.forEach((l) => {
      if (exclude.has(l.id) || !l.visible || l.type === "pattern") return;
      if (l.w >= d.width * 0.98 && l.h >= d.height * 0.98) return;
      xs.push(l.x, l.x + l.w / 2, l.x + l.w);
      ys.push(l.y, l.y + l.h / 2, l.y + l.h);
    });
    return { xs, ys };
  };

  const onWindowMove = useCallback((event: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const p = toSheet(event.clientX, event.clientY);
    const dx = p.x - drag.start.x, dy = p.y - drag.start.y;
    if (!drag.moved && Math.hypot(dx, dy) * scaleRef.current < 3) return;
    drag.moved = true;
    const threshold = 10 / scaleRef.current;
    const snapping = snapRef.current && !event.altKey;

    if (drag.kind === "icon") {
      const layer = docRef.current.layers.find((l) => l.id === drag.layerId);
      if (!layer) return;
      const lay = gridLayout(layer, orderRef.current.length);
      const target = nearestCell(layer, p);
      drag.target = target;
      const cell = target >= 0 ? lay.cells[target] : null;
      // Magnetic pull: the ghost leans toward the tile it would drop into.
      const gx = cell ? p.x + (cell.x + cell.size / 2 - p.x) * 0.55 : p.x;
      const gy = cell ? p.y + (cell.y + cell.size / 2 - p.y) * 0.55 : p.y;
      setIconGhost({ id: drag.iconId, x: gx, y: gy, size: lay.size, target: cell ? { x: cell.x, y: cell.y, s: cell.size } : null });
      return;
    }

    if (drag.kind === "move") {
      let ax = dx, ay = dy;
      let gv: number[] = [], gh: number[] = [];
      if (snapping) {
        const b = drag.box;
        const sx = snapTo([b.x0 + dx, (b.x0 + b.x1) / 2 + dx, b.x1 + dx], drag.lines.xs, threshold);
        const sy = snapTo([b.y0 + dy, (b.y0 + b.y1) / 2 + dy, b.y1 + dy], drag.lines.ys, threshold);
        ax = dx + sx.delta; ay = dy + sy.delta;
        if (sx.at != null) gv = [sx.at];
        if (sy.at != null) gh = [sy.at];
      }
      setGuides({ v: gv, h: gh });
      live((d) => ({ ...d, layers: d.layers.map((l) => { const o = drag.origins.get(l.id); return o ? { ...l, x: o.x + ax, y: o.y + ay } : l; }) }));
    } else {
      const o = drag.orig;
      let { x, y, w, h } = o;
      const minH = o.type === "line" ? 4 : 20;
      const east = drag.handle.includes("e"), west = drag.handle.includes("w"), south = drag.handle.includes("s"), north = drag.handle.includes("n");
      let gv: number[] = [], gh: number[] = [];
      let ex = dx, ey = dy;
      if (snapping) {
        if (east) { const s = snapTo([o.x + o.w + dx], drag.lines.xs, threshold); ex = dx + s.delta; if (s.at != null) gv = [s.at]; }
        if (west) { const s = snapTo([o.x + dx], drag.lines.xs, threshold); ex = dx + s.delta; if (s.at != null) gv = [s.at]; }
        if (south) { const s = snapTo([o.y + o.h + dy], drag.lines.ys, threshold); ey = dy + s.delta; if (s.at != null) gh = [s.at]; }
        if (north) { const s = snapTo([o.y + dy], drag.lines.ys, threshold); ey = dy + s.delta; if (s.at != null) gh = [s.at]; }
      }
      setGuides({ v: gv, h: gh });
      if (east) w = Math.max(20, o.w + ex);
      if (west) { w = Math.max(20, o.w - ex); x = o.x + (o.w - w); }
      if (south) h = Math.max(minH, o.h + ey);
      if (north) { h = Math.max(minH, o.h - ey); y = o.y + (o.h - h); }
      live((d) => ({ ...d, layers: d.layers.map((l) => (l.id === o.id ? { ...l, x, y, w, h } : l)) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  const upHandlerRef = useRef<(event: PointerEvent) => void>(() => undefined);
  const onWindowUp = useCallback((event: PointerEvent) => upHandlerRef.current(event), []);
  useEffect(() => {
    upHandlerRef.current = (event: PointerEvent) => {
      window.removeEventListener("pointermove", onWindowMove);
      window.removeEventListener("pointerup", onWindowUp);
      const drag = dragRef.current;
      dragRef.current = null;
      setGuides(NO_GUIDES);
      setIconGhost(null);
      if (!drag) return;

      if (drag.kind === "icon") {
        const order = orderRef.current;
        const fromIndex = drag.from.kind === "cell" ? drag.from.index : order.indexOf(drag.from.id);
        if (drag.moved) {
          if (drag.target >= 0) swapOrder(fromIndex, drag.target);
          setArmed(null);
          return;
        }
        if (drag.from.kind === "tray") return; // the tray button's own click toggles it
        const current = armedRef.current;
        if (current?.kind === "cell") { swapOrder(current.index, drag.from.index); setArmed(null); }
        else if (current?.kind === "tray") { swapOrder(order.indexOf(current.id), drag.from.index); setArmed(null); }
        else setArmed({ kind: "cell", index: drag.from.index });
        return;
      }

      if (drag.moved) { pushPast(drag.before); return; }
      if (drag.kind !== "move") return;
      const layer = docRef.current.layers.find((l) => l.id === drag.layerId);
      if (layer?.type !== "grid") return;
      const cell = cellAt(layer, toSheet(event.clientX, event.clientY));
      if (cell < 0) return;
      const current = armedRef.current;
      if (current?.kind === "cell") { swapOrder(current.index, cell); setArmed(null); }
      else if (current?.kind === "tray") { swapOrder(orderRef.current.indexOf(current.id), cell); setArmed(null); }
    };
  });

  const beginMove = (event: React.PointerEvent, layer: Layer) => {
    if (panMode || spaceDown || event.button !== 0) return;
    event.stopPropagation();
    const wasSelected = selectionRef.current.includes(layer.id);
    let nextSel = selectionRef.current;
    if (event.shiftKey || event.metaKey || event.ctrlKey) {
      const group = expandGroup(layer.id);
      nextSel = wasSelected ? nextSel.filter((id) => !group.includes(id)) : [...new Set([...nextSel, ...group])];
    } else if (!wasSelected) {
      nextSel = expandGroup(layer.id);
    }
    setSelection(nextSel);
    selectionRef.current = nextSel;
    if (!nextSel.includes(layer.id)) return;
    const start = toSheet(event.clientX, event.clientY);

    // A selected grid: dragging one of its icons swaps it with another tile.
    if (layer.type === "grid" && wasSelected && nextSel.length === 1 && !layer.locked) {
      const index = cellAt(layer, start);
      const iconId = index >= 0 ? orderRef.current[index] : undefined;
      if (index >= 0 && iconId) {
        dragRef.current = { kind: "icon", from: { kind: "cell", index }, iconId, layerId: layer.id, start, moved: false, target: -1 };
        window.addEventListener("pointermove", onWindowMove);
        window.addEventListener("pointerup", onWindowUp);
        return;
      }
    }

    const origins = new Map<string, { x: number; y: number }>();
    const moving = docRef.current.layers.filter((l) => nextSel.includes(l.id) && !l.locked);
    moving.forEach((l) => origins.set(l.id, { x: l.x, y: l.y }));
    const box: Box = moving.length
      ? { x0: Math.min(...moving.map((l) => l.x)), y0: Math.min(...moving.map((l) => l.y)), x1: Math.max(...moving.map((l) => l.x + l.w)), y1: Math.max(...moving.map((l) => l.y + l.h)) }
      : { x0: 0, y0: 0, x1: 0, y1: 0 };
    dragRef.current = { kind: "move", start, origins, before: docRef.current, moved: false, layerId: layer.id, wasSelected, box, lines: snapLinesFor(new Set(origins.keys())) };
    window.addEventListener("pointermove", onWindowMove);
    window.addEventListener("pointerup", onWindowUp);
  };

  const beginResize = (event: React.PointerEvent, layer: Layer, handle: Handle) => {
    event.stopPropagation();
    dragRef.current = { kind: "resize", handle, start: toSheet(event.clientX, event.clientY), orig: layer, before: docRef.current, moved: false, lines: snapLinesFor(new Set([layer.id])) };
    window.addEventListener("pointermove", onWindowMove);
    window.addEventListener("pointerup", onWindowUp);
  };

  /** Drag an unused-tray icon onto a grid tile. */
  const beginTrayDrag = (event: React.PointerEvent, id: string) => {
    if (event.button !== 0 || !mainGrid) return;
    dragRef.current = { kind: "icon", from: { kind: "tray", id }, iconId: id, layerId: mainGrid.id, start: toSheet(event.clientX, event.clientY), moved: false, target: -1 };
    window.addEventListener("pointermove", onWindowMove);
    window.addEventListener("pointerup", onWindowUp);
  };

  const onPanDown = (event: React.PointerEvent) => {
    if (!(panMode || spaceDown) || !scrollRef.current) return;
    panRef.current = { x: event.clientX, y: event.clientY, sl: scrollRef.current.scrollLeft, st: scrollRef.current.scrollTop };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPanMove = (event: React.PointerEvent) => {
    const pan = panRef.current;
    if (!pan || !scrollRef.current) return;
    scrollRef.current.scrollLeft = pan.sl - (event.clientX - pan.x);
    scrollRef.current.scrollTop = pan.st - (event.clientY - pan.y);
  };
  const onPanUp = () => { panRef.current = null; };

  useEffect(() => {
    const typing = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
    };
    const down = (event: KeyboardEvent) => {
      if (typing(event.target) || modalOpenRef.current) return;
      if (event.code === "Space") { setSpaceDown(true); event.preventDefault(); return; }
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key.toLowerCase() === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return; }
      if (mod && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); return; }
      if (event.key === "Delete" || event.key === "Backspace") { if (selectionRef.current.length) { event.preventDefault(); deleteSelected(); } return; }
      if (event.key === "Escape") { setSelection([]); setArmed(null); return; }
      if (event.key === "Enter" && selectionRef.current.length === 1) {
        const layer = docRef.current.layers.find((l) => l.id === selectionRef.current[0]);
        if (layer?.type === "text" && !layer.locked) { event.preventDefault(); startEdit(layer); return; }
      }
      if ((event.key === "[" || event.key === "]") && selectionRef.current.length === 1) { event.preventDefault(); moveLayer(selectionRef.current[0], event.key === "]" ? 1 : -1); return; }
      const step = event.shiftKey ? 50 : 10;
      const dir: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (dir[event.key] && selectionRef.current.length) {
        event.preventDefault();
        const [dx, dy] = dir[event.key];
        const ids = new Set(selectionRef.current);
        commit((d) => ({ ...d, layers: d.layers.map((l) => (ids.has(l.id) && !l.locked ? { ...l, x: l.x + dx, y: l.y + dy } : l)) }), "nudge");
      }
    };
    const up = (event: KeyboardEvent) => { if (event.code === "Space") setSpaceDown(false); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commit, deleteSelected, redo, undo]);

  useEffect(() => () => {
    window.removeEventListener("pointermove", onWindowMove);
    window.removeEventListener("pointerup", onWindowUp);
  }, [onWindowMove, onWindowUp]);

  /* ------------------------------------------------------------- downloads */
  const buildSheetSvg = () => renderSheetSvg(doc, ctx);

  const downloadSheet = async () => {
    setBusy(true);
    try {
      await onBeforeExport(1);
      const base = safeFile(sheetName || doc.title);
      const svg = buildSheetSvg();
      if (format === "svg") triggerDownload(new Blob([svg], { type: "image/svg+xml" }), `${base}-presentation.svg`);
      else triggerDownload(await rasterize(svg, Math.round(doc.width), Math.round(doc.height), format === "png" ? "image/png" : "image/jpeg"), `${base}-presentation.${format}`);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Download failed.");
    } finally { setBusy(false); }
  };

  const downloadAll = async () => {
    setBusy(true);
    try {
      await onBeforeExport(Math.max(1, presIcons.length));
      const base = safeFile(sheetName || doc.title);
      const zip = new JSZip();
      zip.file(`${base}-presentation.svg`, buildSheetSvg());
      const folder = zip.folder("icons");
      const used = new Map<string, number>();
      presIcons.forEach((icon) => {
        let name = safeFile(icon.name);
        const n = (used.get(name) ?? 0) + 1;
        used.set(name, n);
        if (n > 1) name = `${name}-${n}`;
        folder?.file(`${name}.svg`, styledIconSvg(icon, style));
      });
      triggerDownload(await zip.generateAsync({ type: "blob" }), `${base}-icon-set.zip`);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Download failed.");
    } finally { setBusy(false); }
  };

  const shuffle = () => {
    setOrder((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
      }
      return next;
    });
    setArmed(null);
  };

  const setShowLabels = (on: boolean) => commit((d) => ({ ...d, layers: d.layers.map((l) => (l.type === "grid" ? { ...l, showLabels: on } : l)) }));
  const labelsOn = doc.layers.some((l) => l.type === "grid" && l.showLabels);

  const clearCanvas = () => {
    if (!doc.layers.length || !window.confirm("Remove every layer from the sheet? You can undo this.")) return;
    commit((d) => ({ ...d, layers: [] }));
    setSelection([]);
  };

  /* ---------------------------------------------------------------- render */
  const stroke = "var(--primary, #16c784)";
  const hs = 11 / scale;
  const armedBox = (() => {
    if (!mainGrid || !gridInfo || armed?.kind !== "cell") return null;
    return gridInfo.cells[armed.index] ?? null;
  })();

  const handlePositions = (l: Layer): [Handle, number, number][] => [["nw", l.x, l.y], ["ne", l.x + l.w, l.y], ["sw", l.x, l.y + l.h], ["se", l.x + l.w, l.y + l.h]];
  const hitBox = (l: Layer) => (l.type === "line" ? { x: l.x, y: l.y + l.h / 2 - 30, w: l.w, h: 60 } : { x: l.x, y: l.y, w: l.w, h: l.h });
  const rotateAttr = (l: Layer) => (l.rotation ? `rotate(${l.rotation} ${l.x + l.w / 2} ${l.y + l.h / 2})` : undefined);

  const layerIcon = (type: Layer["type"]) => ({ rect: Square, ellipse: Circle, triangle: Triangle, line: Minus, text: Type, grid: LayoutGrid, featured: Star, pattern: Grid3x3, image: ImageIcon }[type]);

  return (
    <div className="space-y-3" data-compact-ui>
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-2.5">
        <div className="flex items-center gap-1">
          <button type="button" className={btnCls} onClick={undo} disabled={!hist.past.length} title="Undo (Ctrl+Z)"><Undo2 className="h-3.5 w-3.5" /></button>
          <button type="button" className={btnCls} onClick={redo} disabled={!hist.future.length} title="Redo (Ctrl+Y)"><Redo2 className="h-3.5 w-3.5" /></button>
        </div>
        <span className="mx-1 hidden h-5 w-px bg-[var(--card-border)] sm:block" aria-hidden />
        <button type="button" className={btnCls} onClick={() => setNamesOpen(true)}><Pencil className="h-3.5 w-3.5" />Edit names</button>
        <button type="button" className={btnCls} onClick={shuffle} title="Randomise icon order"><Shuffle className="h-3.5 w-3.5" />Shuffle</button>
        <button type="button" className={`${btnCls} ${snapOn ? "!border-primary !bg-primary/15" : ""}`} aria-pressed={snapOn} onClick={() => setSnapOn((v) => !v)} title="Snap to edges, centres and other layers. Hold Alt while dragging to ignore.">Snap</button>
        <div className="ml-auto flex items-center gap-1.5">
          <select aria-label="Download format" className={`${inputCls} !w-[4.5rem]`} value={format} onChange={(event) => setFormat(event.target.value as "svg" | "png" | "jpg")}>
            <option value="svg">SVG</option><option value="png">PNG</option><option value="jpg">JPG</option>
          </select>
          <button type="button" className={btnPrimaryCls} disabled={busy || !icons.length} onClick={() => void downloadSheet()}><Download className="h-3.5 w-3.5" />Download</button>
          <button type="button" className={btnCls} disabled={busy || !icons.length} onClick={() => void downloadAll()} title="Presentation sheet + every icon as its own SVG (ZIP)">Download all</button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[250px_minmax(0,1fr)_230px]">
        {/* left */}
        <div className="space-y-3 lg:max-h-[calc(100vh-190px)] lg:overflow-y-auto lg:pr-1">
          <Panel title="Presentation layout">
            <Segmented value={layoutMode} options={[{ value: "branded", label: "Branded sheet" }, { value: "compact", label: "Compact grid" }]} onChange={(m) => applyTemplate(templateId, m)} />
          </Panel>

          <Panel title="Theme & branding">
            <div className="space-y-2">
              <button type="button" className={`${btnCls} w-full !justify-between`} onClick={() => { setGalleryMessage(""); setGalleryOpen(true); }}>
                <span className="min-w-0 truncate">{currentTemplate?.name ?? "Custom design"}</span>
                <span className="shrink-0 text-primary">Templates</span>
              </button>
              <div className="space-y-2 border-t border-[var(--card-border)] pt-2">
                <Field label="Sheet title"><input className={inputCls} value={doc.title} onChange={(event) => updateDoc({ title: event.target.value }, "title")} /></Field>
                {doc.layers.some((l) => l.type === "featured") && (
                  <Field label="Featured icon">
                    <select className={inputCls} value={featuredId ?? ""} onChange={(event) => setFeaturedId(event.target.value)}>
                      {icons.map((icon) => <option key={icon.id} value={icon.id}>{icon.name}</option>)}
                    </select>
                  </Field>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <ColorField label="Icon fill" value={doc.iconFill} onChange={(v) => updateDoc({ iconFill: v }, "iconFill")} />
                  <ColorField label="Label colour" value={doc.labelColor} onChange={(v) => updateDoc({ labelColor: v }, "labelColor")} />
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Two-tone icons">
            <div className="space-y-2">
              <label className="flex cursor-pointer items-center gap-2 text-[11px] font-bold text-foreground">
                <input type="checkbox" className="h-3.5 w-3.5 accent-[var(--primary,#16c784)]" checked={twoTone.enabled} onChange={(event) => setTwoTone((t) => ({ ...t, enabled: event.target.checked }))} />
                Use two colours
              </label>
              {twoTone.enabled && (
                <>
                  <p className="text-[10px] leading-4 text-[var(--text-secondary)]">Main colour is the Icon fill above. The accent is applied by shape rules, no AI.</p>
                  <ColorField label="Accent colour" value={twoTone.secondary} onChange={(v) => setTwoTone((t) => ({ ...t, secondary: v }))} />
                  <label className="flex cursor-pointer items-center gap-2 text-[11px] font-bold text-foreground">
                    <input type="checkbox" className="h-3.5 w-3.5 accent-[var(--primary,#16c784)]" checked={twoTone.fillEnclosed} onChange={(event) => setTwoTone((t) => ({ ...t, fillEnclosed: event.target.checked }))} />
                    Tint enclosed areas
                  </label>
                  {twoTone.fillEnclosed && <SliderField label="Tint strength" value={twoTone.tint} min={5} max={100} suffix="%" onChange={(v) => setTwoTone((t) => ({ ...t, tint: v }))} />}
                  <label className="flex cursor-pointer items-center gap-2 text-[11px] font-bold text-foreground">
                    <input type="checkbox" className="h-3.5 w-3.5 accent-[var(--primary,#16c784)]" checked={twoTone.accentSmall} onChange={(event) => setTwoTone((t) => ({ ...t, accentSmall: event.target.checked }))} />
                    Accent small parts
                  </label>
                  {twoTone.accentSmall && <SliderField label="Small part size" value={twoTone.smallRatio} min={2} max={80} suffix="%" onChange={(v) => setTwoTone((t) => ({ ...t, smallRatio: v }))} />}
                </>
              )}
            </div>
          </Panel>

          <Panel title="Add elements">
            <div className="grid grid-cols-2 gap-1.5">
              <button type="button" className={btnCls} onClick={() => addLayer({ type: "rect", name: "Rectangle", fill: "#D4D4D8", radius: 40 })}><Square className="h-3.5 w-3.5" />Rect</button>
              <button type="button" className={btnCls} onClick={() => addLayer({ type: "ellipse", name: "Ellipse", w: 400, h: 400, fill: "#D4D4D8" })}><Circle className="h-3.5 w-3.5" />Ellipse</button>
              <button type="button" className={btnCls} onClick={() => addLayer({ type: "triangle", name: "Triangle", w: 400, h: 360, fill: "#D4D4D8" })}><Triangle className="h-3.5 w-3.5" />Triangle</button>
              <button type="button" className={btnCls} onClick={() => addLayer({ type: "line", name: "Line", w: 800, h: 20, stroke: "#71717A", strokeWidth: 8 })}><Minus className="h-3.5 w-3.5" />Line</button>
              <button type="button" className={btnCls} onClick={() => addLayer({ type: "text", name: "Text", text: "Text", w: 800, h: 140, fontSize: 90, fontWeight: 600, fill: "#27272A" })}><Type className="h-3.5 w-3.5" />Text</button>
              <button type="button" className={btnCls} onClick={() => addLayer({ type: "text", name: "Title Text", text: "{title}", w: 1600, h: 220, fontSize: 160, fontWeight: 800, fill: "#27272A" })}><Type className="h-3.5 w-3.5" />Title</button>
              <button type="button" className={btnCls} onClick={() => addLayer({ type: "text", name: "Icon Count", text: "{n} ICONS", w: 900, h: 140, fontSize: 70, fontWeight: 800, letterSpacing: 3, fill: "#27272A" })}><Hash className="h-3.5 w-3.5" />Icon count</button>
              <button type="button" className={btnCls} onClick={() => addLayer({ type: "grid", name: "Icons Grid", w: 2400, h: 1600, cols: 0, rows: 0, gap: 40, cellPad: 22, cellFill: "#FFFFFF", cellStroke: "#D4D4D8", cellStrokeWidth: 4, cellRadius: 36, fill: "" })}><LayoutGrid className="h-3.5 w-3.5" />Icons grid</button>
              <button type="button" className={btnCls} onClick={() => addLayer({ type: "featured", name: "Featured Icon", w: 900, h: 900, fill: "#FFFFFF", radius: 70, cellPad: 14 })}><Star className="h-3.5 w-3.5" />Featured</button>
              <button type="button" className={btnCls} onClick={() => addLayer({ type: "pattern", name: "Pattern", w: 1600, h: 900, fill: "#000000", pattern: "dots", patternGap: 56, strokeWidth: 5, opacity: 0.15 })}><Grid3x3 className="h-3.5 w-3.5" />Pattern</button>
              <button type="button" className={btnCls} onClick={() => imageInput.current?.click()}><ImageIcon className="h-3.5 w-3.5" />Image</button>
              <button type="button" className="inline-flex h-7 items-center justify-center gap-1.5 rounded-md border border-red-500/60 bg-red-500/10 px-2.5 text-[11px] font-bold text-red-500 hover:bg-red-500/20" onClick={clearCanvas}><Trash2 className="h-3.5 w-3.5" />Clear</button>
            </div>
            <input ref={imageInput} type="file" accept="image/*,.svg" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void addImageLayer(file); event.target.value = ""; }} />
          </Panel>

          <Panel title={single ? `Properties: ${single.name}` : selection.length > 1 ? `${selection.length} layers selected` : "Properties: sheet"}>
            {!single && selection.length === 0 && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <NumberField label="Width (px)" value={doc.width} min={400} max={12000} onChange={(v) => updateDoc({ width: v }, "w")} />
                  <NumberField label="Height (px)" value={doc.height} min={400} max={12000} onChange={(v) => updateDoc({ height: v }, "h")} />
                </div>
                <ColorField label="Fill colour" value={doc.background} allowEmpty onChange={(v) => updateDoc({ background: v }, "bg")} />
                <ColorField label="Gradient to" value={doc.backgroundTo ?? ""} allowEmpty onChange={(v) => updateDoc({ backgroundTo: v || undefined }, "bg2")} />
                {doc.backgroundTo && <SliderField label="Gradient angle" value={doc.backgroundAngle ?? 90} min={0} max={360} onChange={(v) => updateDoc({ backgroundAngle: v }, "bga")} suffix="°" />}
                <SliderField label="Corner radius" value={doc.backgroundRadius} min={0} max={400} onChange={(v) => updateDoc({ backgroundRadius: v }, "bgr")} />
              </div>
            )}
            {selection.length > 1 && <p className="text-[11px] text-[var(--text-secondary)]">Use Align, Group, Copy or Delete. Select one layer to edit its properties.</p>}
            {single && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <NumberField label="X" value={single.x} onChange={(v) => updateSelected({ x: v }, "x")} />
                  <NumberField label="Y" value={single.y} onChange={(v) => updateSelected({ y: v }, "y")} />
                  <NumberField label="Width" value={single.w} min={4} onChange={(v) => updateSelected({ w: v }, "pw")} />
                  <NumberField label="Height" value={single.h} min={4} onChange={(v) => updateSelected({ h: v }, "ph")} />
                </div>
                {single.type !== "grid" && single.type !== "line" && single.type !== "image" && single.type !== "pattern" && <ColorField label="Fill" value={single.fill} allowEmpty onChange={(v) => updateSelected({ fill: v }, "fill")} />}
                {isShape && (
                  <>
                    <ColorField label="Gradient to" value={single.fill2 ?? ""} allowEmpty onChange={(v) => updateSelected({ fill2: v }, "fill2")} />
                    {single.fill2 && <SliderField label="Gradient angle" value={single.gradAngle ?? 90} min={0} max={360} onChange={(v) => updateSelected({ gradAngle: v }, "ga")} suffix="°" />}
                    <SliderField label="Fill opacity" value={Math.round((single.fillOpacity ?? 1) * 100)} min={0} max={100} onChange={(v) => updateSelected({ fillOpacity: v / 100 }, "fo")} suffix="%" />
                  </>
                )}
                {single.type !== "text" && single.type !== "grid" && single.type !== "image" && single.type !== "pattern" && (
                  <>
                    <ColorField label={single.type === "line" ? "Line colour" : "Stroke"} value={single.stroke} allowEmpty onChange={(v) => updateSelected({ stroke: v }, "stroke")} />
                    <SliderField label="Stroke width" value={single.strokeWidth} min={0} max={60} onChange={(v) => updateSelected({ strokeWidth: v }, "sw")} suffix="px" />
                    <SliderField label="Dashed stroke" value={single.dash ?? 0} min={0} max={80} onChange={(v) => updateSelected({ dash: v }, "dash")} suffix="px" />
                  </>
                )}
                {single.type === "pattern" && (
                  <>
                    <Field label="Pattern">
                      <select className={inputCls} value={single.pattern ?? "dots"} onChange={(event) => updateSelected({ pattern: event.target.value as Layer["pattern"] }, "pat")}>
                        <option value="dots">Dots</option><option value="grid">Grid</option><option value="lines">Diagonal lines</option><option value="cross">Crosses</option>
                      </select>
                    </Field>
                    <ColorField label="Colour" value={single.fill} onChange={(v) => updateSelected({ fill: v }, "fill")} />
                    <SliderField label="Spacing" value={single.patternGap ?? 60} min={12} max={600} onChange={(v) => updateSelected({ patternGap: v }, "pg")} suffix="px" />
                    <SliderField label="Thickness" value={single.strokeWidth || 4} min={1} max={60} onChange={(v) => updateSelected({ strokeWidth: v }, "sw")} suffix="px" />
                    <SliderField label="Corner radius" value={single.radius} min={0} max={500} onChange={(v) => updateSelected({ radius: v }, "rad")} />
                  </>
                )}
                {(single.type === "rect" || single.type === "featured") && <SliderField label="Corner radius" value={single.radius} min={0} max={500} onChange={(v) => updateSelected({ radius: v }, "rad")} />}
                {single.type === "text" && (
                  <>
                    <Field label="Text ({n} = count, {title} = sheet title)"><textarea className={`${inputCls} !h-14 resize-none !py-1`} value={single.text ?? ""} onChange={(event) => updateSelected({ text: event.target.value }, "text")} /></Field>
                    <Segmented value={single.font ?? "sans"} options={[{ value: "sans", label: "Sans" }, { value: "serif", label: "Serif" }, { value: "mono", label: "Mono" }]} onChange={(v) => updateSelected({ font: v }, "font")} />
                    <div className="grid grid-cols-2 gap-2">
                      <NumberField label="Font size" value={single.fontSize ?? 100} min={8} max={800} onChange={(v) => updateSelected({ fontSize: v }, "fs")} />
                      <NumberField label="Weight" value={single.fontWeight ?? 700} min={100} max={900} step={100} onChange={(v) => updateSelected({ fontWeight: v }, "fw")} />
                    </div>
                    <SliderField label="Letter spacing" value={single.letterSpacing ?? 0} min={-10} max={60} onChange={(v) => updateSelected({ letterSpacing: v }, "ls")} />
                    <SliderField label="Line height" value={single.lineHeight ?? 115} min={80} max={220} onChange={(v) => updateSelected({ lineHeight: v }, "lh")} suffix="%" />
                    <Segmented value={single.align ?? "left"} options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]} onChange={(v) => updateSelected({ align: v }, "al")} />
                  </>
                )}
                {single.type === "featured" && <SliderField label="Icon padding" value={single.cellPad ?? 14} min={0} max={40} onChange={(v) => updateSelected({ cellPad: v }, "cp")} suffix="%" />}
                {single.type === "grid" && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <NumberField label="Columns (0 = auto)" value={single.cols ?? 0} min={0} max={40} onChange={(v) => updateSelected({ cols: v }, "cols")} />
                      <NumberField label="Rows (0 = auto)" value={single.rows ?? 0} min={0} max={40} onChange={(v) => updateSelected({ rows: v }, "rows")} />
                    </div>
                    <SliderField label="Gap" value={single.gap ?? 24} min={0} max={200} onChange={(v) => updateSelected({ gap: v }, "gap")} />
                    <SliderField label="Icon padding" value={single.cellPad ?? 18} min={0} max={40} onChange={(v) => updateSelected({ cellPad: v }, "cp")} suffix="%" />
                    <ColorField label="Tile fill" value={single.cellFill ?? ""} allowEmpty onChange={(v) => updateSelected({ cellFill: v }, "cf")} />
                    <ColorField label="Tile border" value={single.cellStroke ?? ""} allowEmpty onChange={(v) => updateSelected({ cellStroke: v }, "cs")} />
                    <SliderField label="Tile border width" value={single.cellStrokeWidth ?? 0} min={0} max={20} onChange={(v) => updateSelected({ cellStrokeWidth: v }, "csw")} suffix="px" />
                    <SliderField label="Tile fill opacity" value={Math.round((single.cellFillOpacity ?? 1) * 100)} min={0} max={100} onChange={(v) => updateSelected({ cellFillOpacity: v / 100 }, "cfo")} suffix="%" />
                    <SliderField label="Tile dashed border" value={single.cellDash ?? 0} min={0} max={60} onChange={(v) => updateSelected({ cellDash: v }, "cd")} suffix="px" />
                    <SliderField label="Tile shadow" value={single.cellShadow ?? 0} min={0} max={60} onChange={(v) => updateSelected({ cellShadow: v }, "csh")} />
                    <SliderField label="Tile hard offset" value={single.cellOffset ?? 0} min={0} max={60} onChange={(v) => updateSelected({ cellOffset: v }, "co")} suffix="px" />
                    {(single.cellOffset ?? 0) > 0 && <ColorField label="Offset colour" value={single.cellOffsetColor ?? "#000000"} onChange={(v) => updateSelected({ cellOffsetColor: v }, "coc")} />}
                    <SliderField label="Tile corner radius" value={single.cellRadius ?? 0} min={0} max={200} onChange={(v) => updateSelected({ cellRadius: v }, "cr")} />
                    <label className="flex items-center gap-2 text-[11px] font-bold text-foreground"><input type="checkbox" className="h-3.5 w-3.5 accent-[var(--primary,#16c784)]" checked={!!single.showLabels} onChange={(event) => updateSelected({ showLabels: event.target.checked }, "sl")} />Show icon names</label>
                  </>
                )}
                {single.type !== "grid" && (
                  <>
                    <SliderField label="Shadow" value={single.shadow ?? 0} min={0} max={100} onChange={(v) => updateSelected({ shadow: v }, "shd")} />
                    {(single.shadow ?? 0) > 0 && <ColorField label="Shadow colour" value={single.shadowColor ?? "#000000"} onChange={(v) => updateSelected({ shadowColor: v }, "shc")} />}
                    <SliderField label="Blur (glow)" value={single.blur ?? 0} min={0} max={400} onChange={(v) => updateSelected({ blur: v }, "blr")} suffix="px" />
                  </>
                )}
                <SliderField label="Rotation" value={single.rotation} min={-180} max={180} onChange={(v) => updateSelected({ rotation: v }, "rot")} suffix="°" />
                <SliderField label="Opacity" value={Math.round(single.opacity * 100)} min={0} max={100} onChange={(v) => updateSelected({ opacity: v / 100 }, "op")} suffix="%" />
              </div>
            )}
          </Panel>

          <Panel title="Align elements" right={<span className="text-[10px] font-bold text-[var(--text-secondary)]">{selection.length ? `${selection.length} selected` : ""}</span>}>
            <p className="mb-2 text-[10px] text-[var(--text-secondary)]">{selection.length > 1 ? "Aligns the selected layers to each other." : "Aligns one layer to the sheet."}</p>
            <div className="grid grid-cols-3 gap-1.5">
              {([
                ["left", AlignHorizontalJustifyStart, "Left"], ["centerH", AlignHorizontalJustifyCenter, "Center H"], ["right", AlignHorizontalJustifyEnd, "Right"],
                ["top", AlignVerticalJustifyStart, "Top"], ["centerV", AlignVerticalJustifyCenter, "Center V"], ["bottom", AlignVerticalJustifyEnd, "Bottom"],
              ] as const).map(([mode, Icon, label]) => (
                <button key={mode} type="button" disabled={!selection.length} className={btnCls} onClick={() => alignSelected(mode)} title={label} aria-label={label}><Icon className="h-3.5 w-3.5" /></button>
              ))}
            </div>
          </Panel>
        </div>

        {/* center */}
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-2">
            <span className="px-1 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--text-secondary)]">Zoom</span>
            <button type="button" className={btnCls} onClick={() => setZoomMode(Math.max(10, Math.round(scale * 100) - 10))} aria-label="Zoom out"><Minus className="h-3.5 w-3.5" /></button>
            <select aria-label="Zoom level" className={`${inputCls} !w-28`} value={zoomMode === "fit" ? "fit" : String(zoomMode)} onChange={(event) => setZoomMode(event.target.value === "fit" ? "fit" : Number(event.target.value))}>
              <option value="fit">Fit ({Math.round(fitScale * 100)}%)</option>
              {[25, 50, 75, 100, 150, 200].map((z) => <option key={z} value={z}>{z}%</option>)}
              {typeof zoomMode === "number" && ![25, 50, 75, 100, 150, 200].includes(zoomMode) && <option value={zoomMode}>{zoomMode}%</option>}
            </select>
            <button type="button" className={btnCls} onClick={() => setZoomMode(Math.min(300, Math.round(scale * 100) + 10))} aria-label="Zoom in"><Plus className="h-3.5 w-3.5" /></button>
            <button type="button" className={btnCls} onClick={() => setZoomMode("fit")}><Maximize className="h-3.5 w-3.5" />Fit</button>
            <button type="button" className={`${btnCls} ${panMode ? "!border-primary !bg-primary/15" : ""}`} onClick={() => setPanMode((v) => !v)} aria-pressed={panMode}><Hand className="h-3.5 w-3.5" />Pan</button>
            <span className="ml-auto hidden text-[10px] text-[var(--text-secondary)] md:inline">Ctrl + scroll to zoom · hold Space to pan · arrows nudge</span>
          </div>

          <div
            ref={scrollRef}
            className={`relative h-[58vh] min-h-[380px] overflow-auto rounded-xl border border-[var(--card-border)] bg-[#e7e5e4] dark:bg-[#0a1210] ${panMode || spaceDown ? "cursor-grab" : ""}`}
            onPointerDown={onPanDown}
            onPointerMove={onPanMove}
            onPointerUp={onPanUp}
          >
            <div style={{ width: doc.width * scale + 32, height: doc.height * scale + 32, padding: 16, minWidth: "100%", boxSizing: "border-box" }}>
              <div className="relative mx-auto" style={{ width: doc.width * scale, height: doc.height * scale }}>
              <svg
                ref={svgRef}
                viewBox={`0 0 ${doc.width} ${doc.height}`}
                width={doc.width * scale}
                height={doc.height * scale}
                className="block shadow-[0_8px_30px_rgba(0,0,0,0.25)]"
                style={{ pointerEvents: panMode || spaceDown ? "none" : "auto", touchAction: "none" }}
              >
                <rect width={doc.width} height={doc.height} fill="#ffffff" rx={doc.backgroundRadius} />
                <g pointerEvents="none" dangerouslySetInnerHTML={{ __html: renderPageBackground(doc) }} />
                <rect width={doc.width} height={doc.height} fill="transparent" onPointerDown={(event) => { if (event.button !== 0) return; setSelection([]); setArmed(null); }} />
                {markups.map((m) => (m.id === editing?.id ? null : <LayerMarkup key={m.id} markup={m.markup} />))}

                {doc.layers.map((l) => {
                  if (!l.visible || l.locked) return null;
                  const b = hitBox(l);
                  return <rect key={`hit-${l.id}`} x={b.x} y={b.y} width={b.w} height={b.h} fill="transparent" transform={rotateAttr(l)} style={{ cursor: l.type === "text" ? "text" : "move" }} onPointerDown={(event) => beginMove(event, l)} onDoubleClick={() => { if (l.type === "text") startEdit(l); }} />;
                })}

                {guides.v.map((x) => <line key={`gv-${x}`} x1={x} y1={0} x2={x} y2={doc.height} stroke="#FF2D95" strokeWidth={1.5 / scale} strokeDasharray={`${8 / scale} ${6 / scale}`} pointerEvents="none" />)}
                {guides.h.map((y) => <line key={`gh-${y}`} x1={0} y1={y} x2={doc.width} y2={y} stroke="#FF2D95" strokeWidth={1.5 / scale} strokeDasharray={`${8 / scale} ${6 / scale}`} pointerEvents="none" />)}
                {iconGhost && (
                  <g pointerEvents="none">
                    {iconGhost.target && <rect x={iconGhost.target.x} y={iconGhost.target.y} width={iconGhost.target.s} height={iconGhost.target.s} rx={24} fill={stroke} fillOpacity={0.18} stroke={stroke} strokeWidth={5 / scale} />}
                    {(() => {
                      const icon = presIcons.find((i) => i.id === iconGhost.id);
                      if (!icon) return null;
                      const size = iconGhost.size * 0.85;
                      const rgb = /^#([0-9a-f]{6})$/i.exec(style.fill ?? "");
                      const lum = rgb ? (0.299 * parseInt(rgb[1].slice(0, 2), 16) + 0.587 * parseInt(rgb[1].slice(2, 4), 16) + 0.114 * parseInt(rgb[1].slice(4, 6), 16)) / 255 : 0;
                      const ghostBg = lum > 0.65 ? "#111827" : "#ffffff";
                      const markup = `<rect x="${iconGhost.x - size / 2}" y="${iconGhost.y - size / 2}" width="${size}" height="${size}" rx="28" fill="${ghostBg}" fill-opacity="0.94" stroke="#16c784" stroke-width="${5 / scale}"/>${renderIconAt(icon, iconGhost.x - size / 2 + size * 0.14, iconGhost.y - size / 2 + size * 0.14, size * 0.72, size * 0.72, { ...style, fill: style.fill })}`;
                      return <g dangerouslySetInnerHTML={{ __html: markup }} />;
                    })()}
                  </g>
                )}
                {armedBox && <rect x={armedBox.x} y={armedBox.y} width={armedBox.size} height={armedBox.size} fill="none" stroke={stroke} strokeWidth={5 / scale} strokeDasharray={`${14 / scale} ${8 / scale}`} pointerEvents="none" />}

                {selectedLayers.map((l) => {
                  const b = hitBox(l);
                  return (
                    <g key={`sel-${l.id}`} transform={rotateAttr(l)} pointerEvents="none">
                      <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="none" stroke={stroke} strokeWidth={2 / scale} strokeDasharray={l.locked ? `${6 / scale} ${4 / scale}` : undefined} />
                    </g>
                  );
                })}
                {single && !single.locked && (
                  <g transform={rotateAttr(single)}>
                    {handlePositions(single.type === "line" ? { ...single, y: single.y + single.h / 2 - 30, h: 60 } : single).map(([h, x, y]) => (
                      <rect key={h} x={x - hs / 2} y={y - hs / 2} width={hs} height={hs} fill="#fff" stroke={stroke} strokeWidth={2 / scale} style={{ cursor: h === "nw" || h === "se" ? "nwse-resize" : "nesw-resize" }} onPointerDown={(event) => beginResize(event, single, h)} />
                    ))}
                  </g>
                )}
              </svg>
              {editing && (() => {
                const l = doc.layers.find((x) => x.id === editing.id);
                if (!l) return null;
                const fs = l.fontSize ?? 120;
                const lines = editing.value.split("\n");
                const px = Math.max(13, fs * scale);
                const lhPx = px * ((l.lineHeight ?? 115) / 100);
                const widest = Math.max(...lines.map((t) => t.length), 1);
                const width = Math.max(l.w * scale, widest * px * 0.62 + 24);
                const align = l.align ?? "left";
                const left = align === "center" ? (l.x + l.w / 2) * scale - width / 2 : align === "right" ? (l.x + l.w) * scale - width : l.x * scale;
                const height = lines.length * lhPx + 6;
                return (
                  <textarea
                    autoFocus
                    wrap="off"
                    spellCheck={false}
                    aria-label={`Edit ${l.name}`}
                    value={editing.value}
                    onFocus={(event) => event.currentTarget.select()}
                    onChange={(event) => setEditing({ id: editing.id, value: event.target.value })}
                    onBlur={finishEdit}
                    onKeyDown={(event) => {
                      event.stopPropagation();
                      if (event.key === "Escape") { cancelEdit.current = true; event.currentTarget.blur(); }
                      else if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.blur(); }
                    }}
                    style={{ position: "absolute", left, top: (l.y + l.h / 2) * scale - height / 2, width, height, fontFamily: "inherit", fontSize: px, fontWeight: l.fontWeight ?? 700, letterSpacing: (l.letterSpacing ?? 0) * scale, lineHeight: `${lhPx}px`, textAlign: align, color: l.fill || "#000", background: "rgba(255,255,255,0.14)", outline: "2px solid var(--primary, #16c784)", outlineOffset: 2, border: 0, padding: 0, resize: "none", overflow: "hidden", whiteSpace: "pre", transform: l.rotation ? `rotate(${l.rotation}deg)` : undefined }}
                  />
                );
              })()}
              </div>
            </div>
          </div>

          <section className={`${"rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3"}`}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--text-secondary)]">Unused icons</h3>
              <span className="text-[10px] text-[var(--text-secondary)]">{trayIds.length ? "Drag an icon onto a grid tile to swap them." : gridInfo ? "Select the grid, then drag one icon onto another to swap them." : "Add an Icons grid to place your icons."}</span>
            </div>
            {trayIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {trayIds.map((id) => {
                  const icon = iconById.get(id);
                  if (!icon) return null;
                  const on = armed?.kind === "tray" && armed.id === id;
                  return (
                    <button key={id} type="button" title={icon.name} onPointerDown={(event) => beginTrayDrag(event, id)} onClick={() => setArmed(on ? null : { kind: "tray", id })} style={{ touchAction: "none" }} className={`h-12 w-12 rounded-lg border bg-white p-1.5 transition-colors ${on ? "border-primary ring-2 ring-primary/40" : "border-[var(--card-border)] hover:border-primary"}`}>
                      <img alt={icon.name} className="h-full w-full object-contain" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(icon.svgContent)}`} />
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* right: layers */}
        <div className="lg:max-h-[calc(100vh-190px)] lg:overflow-y-auto">
          <Panel title="Layers">
            <div className="mb-2 grid grid-cols-4 gap-1">
              <button type="button" className={btnCls} onClick={copySelected} disabled={!selection.length} title="Copy"><Copy className="h-3.5 w-3.5" /></button>
              <button type="button" className={btnCls} onClick={groupSelected} disabled={selection.length < 2} title="Group"><Group className="h-3.5 w-3.5" /></button>
              <button type="button" className={btnCls} onClick={ungroupSelected} disabled={!selectedLayers.some((l) => l.groupId)} title="Ungroup"><Ungroup className="h-3.5 w-3.5" /></button>
              <button type="button" className={btnCls} onClick={deleteSelected} disabled={!selection.length} title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
            <ul className="space-y-1">
              {[...doc.layers].reverse().map((l) => {
                const Icon = layerIcon(l.type);
                const on = selection.includes(l.id);
                const mark = dropMark?.id === l.id && dragLayer && dragLayer !== l.id ? (dropMark.below ? "shadow-[inset_0_-2px_0_0_var(--primary,#16c784)]" : "shadow-[inset_0_2px_0_0_var(--primary,#16c784)]") : "";
                return (
                  <li
                    key={l.id}
                    draggable={renaming !== l.id}
                    onDragStart={(event) => { setDragLayer(l.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", l.id); }}
                    onDragOver={(event) => {
                      if (!dragLayer) return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      const rect = event.currentTarget.getBoundingClientRect();
                      const below = event.clientY > rect.top + rect.height / 2;
                      setDropMark((cur) => (cur && cur.id === l.id && cur.below === below ? cur : { id: l.id, below }));
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (dragLayer && dropMark) reorderLayer(dragLayer, dropMark.id, dropMark.below);
                      setDragLayer(null);
                      setDropMark(null);
                    }}
                    onDragEnd={() => { setDragLayer(null); setDropMark(null); }}
                    className={`flex items-center gap-1 rounded-lg border px-1 py-1 ${on ? "border-primary bg-primary/10" : "border-transparent hover:bg-white/5"} ${dragLayer === l.id ? "opacity-40" : ""} ${mark}`}
                  >
                    <span className="cursor-grab text-[var(--text-secondary)]" title="Drag to reorder" aria-hidden><GripVertical className="h-3.5 w-3.5" /></span>
                    <input type="checkbox" aria-label={`Select ${l.name}`} className="h-3.5 w-3.5 shrink-0 accent-[var(--primary,#16c784)]" checked={on} onChange={(event) => setSelection((cur) => (event.target.checked ? [...new Set([...cur, ...expandGroup(l.id)])] : cur.filter((id) => !expandGroup(l.id).includes(id))))} />
                    <Icon className="h-3 w-3 shrink-0 text-[var(--text-secondary)]" />
                    {renaming === l.id ? (
                      <input autoFocus className={`${inputCls} !h-6`} defaultValue={l.name} onBlur={(event) => { const name = event.target.value.trim() || l.name; commit((d) => ({ ...d, layers: d.layers.map((x) => (x.id === l.id ? { ...x, name } : x)) })); setRenaming(null); }} onKeyDown={(event) => { if (event.key === "Enter") (event.target as HTMLInputElement).blur(); if (event.key === "Escape") setRenaming(null); }} />
                    ) : (
                      <button type="button" className="min-w-0 flex-1 truncate text-left text-[11px] font-bold text-foreground" onClick={() => setSelection(expandGroup(l.id))} onDoubleClick={() => setRenaming(l.id)} title={l.groupId ? `${l.name} (grouped)` : l.name}>
                        {l.name}{l.groupId ? " ·g" : ""}
                      </button>
                    )}
                    <button type="button" className="rounded p-0.5 text-[var(--text-secondary)] hover:text-foreground" onClick={() => commit((d) => ({ ...d, layers: d.layers.map((x) => (x.id === l.id ? { ...x, visible: !x.visible } : x)) }))} aria-label={l.visible ? "Hide" : "Show"}>{l.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}</button>
                    <button type="button" className="rounded p-0.5 text-[var(--text-secondary)] hover:text-foreground" onClick={() => commit((d) => ({ ...d, layers: d.layers.map((x) => (x.id === l.id ? { ...x, locked: !x.locked } : x)) }))} aria-label={l.locked ? "Unlock" : "Lock"}>{l.locked ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}</button>
                    <button type="button" className="rounded p-0.5 text-red-500 hover:text-red-400" onClick={() => { commit((d) => ({ ...d, layers: d.layers.filter((x) => x.id !== l.id) })); setSelection((cur) => cur.filter((id) => id !== l.id)); }} aria-label="Delete layer"><X className="h-3 w-3" /></button>
                  </li>
                );
              })}
              {!doc.layers.length && <li className="py-4 text-center text-[11px] text-[var(--text-secondary)]">No layers. Add elements or pick a template.</li>}
            </ul>
            <p className="mt-2 text-[10px] text-[var(--text-secondary)]">Drag a row to reorder. Double-click a name to rename. Top of the list is the front. Keys [ and ] move the selected layer.</p>
          </Panel>
        </div>
      </div>

      {galleryOpen && (
        <TemplateGallery
          builtins={builtins}
          customs={customs}
          currentId={templateId}
          icons={presIcons}
          featuredId={featuredId}
          strokeStyle={strokeStyle}
          strokeWidth={strokeWidth}
          message={galleryMessage}
          onApply={(id) => { applyTemplate(id); setGalleryOpen(false); }}
          onSave={saveTemplate}
          onUpdate={updateTemplate}
          onRename={renameTemplate}
          onExport={exportTemplate}
          onDelete={deleteTemplate}
          onImport={(file) => void importTemplate(file)}
          onClose={() => setGalleryOpen(false)}
        />
      )}

      {namesOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Edit icon names" onClick={() => setNamesOpen(false)}>
          <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 border-b border-[var(--card-border)] px-4 py-3">
              <h2 className="text-sm font-black text-foreground">Edit icon names</h2>
              <button type="button" className={btnCls} onClick={() => setNamesOpen(false)} aria-label="Close"><X className="h-3.5 w-3.5" /></button>
            </div>
            <label className="flex items-center gap-2 border-b border-[var(--card-border)] px-4 py-2 text-[11px] font-bold text-foreground">
              <input type="checkbox" className="h-3.5 w-3.5 accent-[var(--primary,#16c784)]" checked={labelsOn} onChange={(event) => setShowLabels(event.target.checked)} />
              Show names under icons on the sheet
            </label>
            <div className="space-y-1.5 overflow-y-auto p-4">
              {icons.map((icon) => (
                <div key={icon.id} className="flex items-center gap-2">
                  <img alt="" className="h-9 w-9 shrink-0 rounded-md bg-white object-contain p-1" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(icon.svgContent)}`} />
                  <input className={inputCls} value={icon.name} onChange={(event) => onRename(icon.id, event.target.value)} aria-label={`Name for ${icon.name}`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
