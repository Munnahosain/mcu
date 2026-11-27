import { SHEET_H, SHEET_W, compactOf, makeLayer } from "./core";
import { signatureTemplates } from "./signature";
import type { Layer, SheetDoc, Template } from "./types";

export * from "./core";

/** True for light colours such as #E5E7EB, which vanish on a white tile. */
function isLightColor(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.65;
}

/** Linear blend of two #RRGGBB colours, t = 0..1. */
function mix(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")}`;
}

interface Palette {
  id: string;
  name: string;
  layout: "side" | "top";
  bg: string;
  dark: string;
  accent: string;
  onDark: string;
  card: string;
  cardStroke: string;
  icon: string;
  label: string;
  tile: string;
  tileStroke: string;
  radius: number;
}

const PALETTES: Palette[] = [
  { id: "warm-terracotta", name: "Warm Terracotta", layout: "side", bg: "#FFF7ED", dark: "#4A1D0B", accent: "#EA580C", onDark: "#FFFFFF", card: "#FFFFFF", cardStroke: "#FED7AA", icon: "#3A3B40", label: "#922F2F", tile: "#FFFFFF", tileStroke: "#F3D9BF", radius: 90 },
  { id: "electric-forest", name: "Electric Forest Emerald", layout: "side", bg: "#F0FDF4", dark: "#052E1C", accent: "#84CC16", onDark: "#FFFFFF", card: "#FFFFFF", cardStroke: "#BBF7D0", icon: "#064E3B", label: "#166534", tile: "#F7FEE7", tileStroke: "#CDEBB8", radius: 90 },
  { id: "midnight-indigo", name: "Midnight Indigo", layout: "side", bg: "#EEF2FF", dark: "#1E1B4B", accent: "#6366F1", onDark: "#FFFFFF", card: "#FFFFFF", cardStroke: "#C7D2FE", icon: "#312E81", label: "#4338CA", tile: "#FFFFFF", tileStroke: "#DDE3FF", radius: 90 },
  { id: "ocean-slate", name: "Ocean Slate", layout: "top", bg: "#F0F9FF", dark: "#0C4A6E", accent: "#0EA5E9", onDark: "#FFFFFF", card: "#FFFFFF", cardStroke: "#BAE6FD", icon: "#0F172A", label: "#0369A1", tile: "#FFFFFF", tileStroke: "#D5EEFC", radius: 70 },
  { id: "rose-quartz", name: "Rose Quartz", layout: "side", bg: "#FFF1F2", dark: "#881337", accent: "#F43F5E", onDark: "#FFFFFF", card: "#FFFFFF", cardStroke: "#FECDD3", icon: "#4C0519", label: "#9F1239", tile: "#FFFFFF", tileStroke: "#FFD9DE", radius: 90 },
  { id: "charcoal-mono", name: "Charcoal Mono", layout: "top", bg: "#F4F4F5", dark: "#18181B", accent: "#71717A", onDark: "#FFFFFF", card: "#FFFFFF", cardStroke: "#E4E4E7", icon: "#18181B", label: "#52525B", tile: "#FFFFFF", tileStroke: "#E4E4E7", radius: 60 },
  { id: "dark-studio", name: "Dark Studio", layout: "side", bg: "#0B1220", dark: "#111827", accent: "#22D3EE", onDark: "#F8FAFC", card: "#111827", cardStroke: "#1F2937", icon: "#E5E7EB", label: "#94A3B8", tile: "#0F172A", tileStroke: "#334155", radius: 90 },
  { id: "sand-minimal", name: "Sand Minimal", layout: "top", bg: "#FAF7F2", dark: "#292524", accent: "#B45309", onDark: "#FAFAF9", card: "#FFFFFF", cardStroke: "#E7E5E4", icon: "#292524", label: "#78716C", tile: "#FFFFFF", tileStroke: "#E7E5E4", radius: 40 },
];

function gridLayer(p: Palette, x: number, y: number, w: number, h: number): Layer {
  return makeLayer({
    type: "grid", name: "Icons Grid Area", x, y, w, h,
    cols: 0, rows: 0, gap: 40, cellPad: 22,
    cellFill: p.tile, cellStroke: p.tileStroke, cellStrokeWidth: 3, cellRadius: 36,
    showLabels: false, fill: "",
  });
}

function sideLayers(p: Palette): Layer[] {
  const cardX = 100, cardY = 100, cardW = 1250, cardH = SHEET_H - 200;
  const featSize = cardW - 220;
  const featFill = isLightColor(p.icon) ? p.tile : "#FFFFFF";
  return [
    makeLayer({ type: "rect", name: "Brand Card", x: cardX, y: cardY, w: cardW, h: cardH, fill: p.dark, fill2: mix(p.dark, p.accent, 0.22), gradAngle: 150, radius: p.radius }),
    makeLayer({ type: "pattern", name: "Card Texture", x: cardX, y: cardY, w: cardW, h: cardH, fill: p.onDark, pattern: "dots", patternGap: 52, strokeWidth: 5, radius: p.radius, opacity: 0.08 }),
    makeLayer({ type: "rect", name: "Featured Frame", x: cardX + 134, y: cardY + 134, w: featSize, h: featSize, fill: "", stroke: p.accent, strokeWidth: 8, radius: 70, rotation: 5 }),
    makeLayer({ type: "featured", name: "Featured Icon", x: cardX + 110, y: cardY + 110, w: featSize, h: featSize, fill: featFill, radius: 70, cellPad: 14 }),
    makeLayer({ type: "text", name: "Title Text", text: "{title}", x: cardX + 60, y: cardY + cardW - 20, w: cardW - 120, h: 160, fontSize: 112, fontWeight: 800, letterSpacing: 2, align: "center", fill: p.onDark }),
    makeLayer({ type: "text", name: "Subtitle", text: "PREMIUM ICON PACK", x: cardX + 60, y: cardY + cardW + 130, w: cardW - 120, h: 80, fontSize: 38, fontWeight: 600, letterSpacing: 14, align: "center", fill: mix(p.onDark, p.accent, 0.55) }),
    makeLayer({ type: "line", name: "Accent Line", x: cardX + cardW / 2 - 200, y: cardY + cardW + 270, w: 400, h: 20, stroke: p.accent, strokeWidth: 8 }),
    makeLayer({ type: "rect", name: "Count Badge", x: cardX + 150, y: cardY + cardH - 260, w: cardW - 300, h: 150, fill: p.accent, radius: 75}),
    makeLayer({ type: "text", name: "Badge Text", text: "{n} VECTOR ICONS", x: cardX + 150, y: cardY + cardH - 260, w: cardW - 300, h: 150, fontSize: 60, fontWeight: 800, letterSpacing: 3, align: "center", fill: isLightColor(p.accent) ? p.dark : "#FFFFFF" }),
    makeLayer({ type: "rect", name: "Grid Card", x: 1450, y: cardY, w: SHEET_W - 1450 - 100, h: cardH, fill: p.card, stroke: p.cardStroke, strokeWidth: 4, radius: p.radius }),
    gridLayer(p, 1450 + 110, cardY + 110, SHEET_W - 1450 - 100 - 220, cardH - 220),
  ];
}

function topLayers(p: Palette): Layer[] {
  const m = 100;
  const headH = 420;
  const gridY = m + headH + 100;
  const gridH = SHEET_H - m * 2 - headH - 100;
  return [
    makeLayer({ type: "rect", name: "Header Card", x: m, y: m, w: SHEET_W - m * 2, h: headH, fill: p.dark, fill2: mix(p.dark, p.accent, 0.25), gradAngle: 0, radius: p.radius }),
    makeLayer({ type: "pattern", name: "Header Texture", x: m, y: m, w: SHEET_W - m * 2, h: headH, fill: p.onDark, pattern: "dots", patternGap: 52, strokeWidth: 5, radius: p.radius, opacity: 0.08 }),
    makeLayer({ type: "featured", name: "Featured Icon", x: m + 70, y: m + 50, w: 320, h: 320, fill: isLightColor(p.icon) ? p.tile : "#FFFFFF", radius: 60, cellPad: 14 }),
    makeLayer({ type: "text", name: "Title Text", text: "{title}", x: m + 500, y: m + 60, w: 2800, h: 200, fontSize: 150, fontWeight: 800, letterSpacing: 2, align: "left", fill: p.onDark }),
    makeLayer({ type: "text", name: "Subtitle", text: "PREMIUM ICON PACK", x: m + 500, y: m + 250, w: 2800, h: 90, fontSize: 42, fontWeight: 600, letterSpacing: 14, align: "left", fill: mix(p.onDark, p.accent, 0.55) }),
    makeLayer({ type: "rect", name: "Count Badge", x: SHEET_W - m - 160 - 760, y: m + headH / 2 - 85, w: 760, h: 170, fill: p.accent, radius: 85}),
    makeLayer({ type: "text", name: "Badge Text", text: "{n} VECTOR ICONS", x: SHEET_W - m - 160 - 760, y: m + headH / 2 - 85, w: 760, h: 170, fontSize: 58, fontWeight: 800, letterSpacing: 3, align: "center", fill: isLightColor(p.accent) ? p.dark : "#FFFFFF" }),
    makeLayer({ type: "rect", name: "Grid Card", x: m, y: gridY, w: SHEET_W - m * 2, h: gridH, fill: p.card, stroke: p.cardStroke, strokeWidth: 4, radius: p.radius }),
    gridLayer(p, m + 110, gridY + 100, SHEET_W - m * 2 - 220, gridH - 200),
  ];
}

function baseDoc(p: Palette, layers: Layer[]): SheetDoc {
  return {
    width: SHEET_W,
    height: SHEET_H,
    background: p.bg,
    backgroundRadius: 0,
    title: "VECTOR ICONS",
    iconFill: p.icon,
    labelColor: p.label,
    layers,
  };
}

export function buildTemplate(p: Palette): Template {
  const doc = baseDoc(p, p.layout === "side" ? sideLayers(p) : topLayers(p));
  return { id: p.id, name: p.name, builtin: true, group: "Classic colours", doc, compact: compactOf(doc) };
}

export function builtinTemplates(): Template[] {
  return [...signatureTemplates(), ...PALETTES.map(buildTemplate)];
}
