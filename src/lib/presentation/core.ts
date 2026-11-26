import type { Layer, LayerType, SheetDoc, Template } from "./types";

let counter = 0;
export const uid = (prefix = "l") => `${prefix}-${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export const SHEET_W = 5000;
export const SHEET_H = 2600;

export function makeLayer(partial: Partial<Layer> & Pick<Layer, "type" | "name">): Layer {
  return {
    id: uid(),
    x: 0, y: 0, w: 400, h: 400,
    rotation: 0, opacity: 1,
    fill: "#000000", stroke: "", strokeWidth: 0, radius: 0,
    visible: true, locked: false,
    ...partial,
  };
}

export function cloneDoc(doc: SheetDoc): SheetDoc {
  return JSON.parse(JSON.stringify(doc)) as SheetDoc;
}

/** Same layers, fresh ids (used by "Copy" and when loading a template). */
export function withFreshIds(doc: SheetDoc): SheetDoc {
  const copy = cloneDoc(doc);
  copy.layers = copy.layers.map((l) => ({ ...l, id: uid() }));
  return copy;
}

/** Grid-only version of a sheet (keeps background and tile style). */
export function compactOf(doc: SheetDoc): SheetDoc {
  const next = cloneDoc(doc);
  const grid = next.layers.find((l) => l.type === "grid");
  next.layers = grid ? [{ ...grid, id: uid(), name: "Icons Grid Area", x: 120, y: 120, w: next.width - 240, h: next.height - 240 }] : [];
  return next;
}

/* ------------------------------------------------- import / export / safety */

const LAYER_TYPES: LayerType[] = ["rect", "ellipse", "triangle", "line", "text", "grid", "featured", "pattern", "image"];
const NUMERIC_KEYS = [
  "x", "y", "w", "h", "rotation", "opacity", "strokeWidth", "radius", "gradAngle", "fillOpacity", "dash", "shadow", "blur",
  "fontSize", "fontWeight", "letterSpacing", "lineHeight", "patternGap", "cols", "rows", "gap", "cellPad", "cellFillOpacity",
  "cellStrokeWidth", "cellDash", "cellRadius", "cellShadow", "cellOffset",
] as const;
const COLOR_KEYS = ["fill", "stroke", "fill2", "shadowColor", "cellFill", "cellStroke", "cellOffsetColor"] as const;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number, min = -1e6, max = 1e6) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback);
const colour = (v: unknown) => (typeof v === "string" && /^(#[0-9a-f]{3,8}|none|transparent|)$/i.test(v.trim()) ? v.trim() : undefined);

function sanitizeLayer(raw: unknown): Layer | null {
  if (!isRecord(raw)) return null;
  const type = raw.type as LayerType;
  if (!LAYER_TYPES.includes(type)) return null;
  const layer = makeLayer({ type, name: typeof raw.name === "string" ? raw.name.slice(0, 80) : type });
  const target = layer as unknown as Record<string, unknown>;
  for (const key of NUMERIC_KEYS) if (raw[key] !== undefined) target[key] = num(raw[key], target[key] as number ?? 0);
  for (const key of COLOR_KEYS) {
    const c = colour(raw[key]);
    if (c !== undefined) target[key] = c;
  }
  layer.visible = raw.visible !== false;
  layer.locked = raw.locked === true;
  layer.w = Math.max(1, layer.w);
  layer.h = Math.max(1, layer.h);
  layer.opacity = Math.min(1, Math.max(0, layer.opacity));
  if (typeof raw.text === "string") layer.text = raw.text.slice(0, 600);
  if (raw.align === "left" || raw.align === "center" || raw.align === "right") layer.align = raw.align;
  if (raw.font === "sans" || raw.font === "serif" || raw.font === "mono") layer.font = raw.font;
  if (raw.pattern === "dots" || raw.pattern === "grid" || raw.pattern === "lines" || raw.pattern === "cross") layer.pattern = raw.pattern;
  if (raw.showLabels === true) layer.showLabels = true;
  if (typeof raw.groupId === "string") layer.groupId = raw.groupId.slice(0, 60);
  if (typeof raw.href === "string" && /^data:image\/(png|jpe?g|webp|gif|svg\+xml)[;,]/i.test(raw.href)) layer.href = raw.href;
  return layer;
}

/** Validates untrusted JSON (an imported template file) into a safe sheet. */
export function sanitizeDoc(raw: unknown): SheetDoc | null {
  if (!isRecord(raw) || !Array.isArray(raw.layers)) return null;
  const layers = raw.layers.slice(0, 400).map(sanitizeLayer).filter((l): l is Layer => !!l);
  const bg = colour(raw.background);
  const bgTo = colour(raw.backgroundTo);
  return {
    width: num(raw.width, SHEET_W, 400, 12000),
    height: num(raw.height, SHEET_H, 400, 12000),
    background: bg ?? "#FFFFFF",
    backgroundTo: bgTo || undefined,
    backgroundAngle: num(raw.backgroundAngle, 90, 0, 360),
    backgroundRadius: num(raw.backgroundRadius, 0, 0, 1000),
    title: typeof raw.title === "string" ? raw.title.slice(0, 120) : "VECTOR ICONS",
    iconFill: colour(raw.iconFill) || "#111111",
    labelColor: colour(raw.labelColor) || "#555555",
    layers,
  };
}

export const TEMPLATE_FILE_FORMAT = "mcustock-template";

export function serializeTemplate(tpl: Template): string {
  return JSON.stringify({ format: TEMPLATE_FILE_FORMAT, version: 1, name: tpl.name, doc: tpl.doc }, null, 2);
}

export function parseTemplateFile(text: string): { name: string; doc: SheetDoc } | null {
  try {
    const json = JSON.parse(text) as unknown;
    if (!isRecord(json)) return null;
    // Accept both the wrapped file and a bare sheet document.
    const source = json.format === TEMPLATE_FILE_FORMAT ? json.doc : json;
    const doc = sanitizeDoc(source);
    if (!doc || !doc.layers.length) return null;
    const name = typeof json.name === "string" && json.name.trim() ? json.name.trim().slice(0, 60) : "Imported template";
    return { name, doc };
  } catch {
    return null;
  }
}
