import { luminance, splitTwoTone } from "./twotone";
import type { FontFamily, IconStyle, Layer, PresentationIcon, RenderContext, SheetDoc } from "./types";

const SANS = "'Plus Jakarta Sans', 'Outfit', 'Segoe UI', Arial, sans-serif";
const FONTS: Record<FontFamily, string> = {
  sans: SANS,
  serif: "'Playfair Display', 'Cormorant Garamond', Georgia, 'Times New Roman', serif",
  mono: "'JetBrains Mono', 'SF Mono', Menlo, Consolas, 'Courier New', monospace",
};
const fontOf = (layer: Layer) => FONTS[layer.font ?? "sans"];

const esc = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const num = (value: number) => (Math.round(value * 100) / 100).toString();

/* ------------------------------------------------------------------ icons */

interface ParsedIcon { vw: number; vh: number; inner: string }
const parseCache = new Map<string, ParsedIcon>();

export function parseIconSvg(svg: string): ParsedIcon {
  const cached = parseCache.get(svg);
  if (cached) return cached;
  const box = /viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/.exec(svg);
  const open = svg.indexOf(">", svg.indexOf("<svg"));
  const close = svg.lastIndexOf("</svg>");
  let inner = open >= 0 && close > open ? svg.slice(open + 1, close) : "";
  // Our own single wrapper group is dropped here; the sheet / icon writers add a named one back.
  const wrapped = /^\s*<g>([\s\S]*)<\/g>\s*$/.exec(inner);
  if (wrapped && !wrapped[1].includes("<g")) inner = wrapped[1];
  const parsed: ParsedIcon = {
    vw: box ? Number(box[1]) || 100 : 100,
    vh: box ? Number(box[2]) || 100 : 100,
    inner,
  };
  if (parseCache.size > 800) parseCache.clear();
  parseCache.set(svg, parsed);
  return parsed;
}

function styleInner(inner: string, unitsPerPx: number, style: IconStyle, singleTone: boolean): string {
  const recolor = singleTone && style.fill;
  const tt = style.twoTone?.enabled ? style.twoTone : null;
  if (style.strokeStyle === "fill" && !recolor && !tt) return inner;

  // Multi-colour artwork: darkest colour becomes the main colour, every other colour the accent.
  let darkest = "";
  if (tt && !singleTone) {
    let best = Infinity;
    for (const m of inner.matchAll(/<path\b[^>]*?\sfill="(#[0-9a-fA-F]{3,6})"/g)) {
      const lum = luminance(m[1]);
      if (lum < best) { best = lum; darkest = m[1].toLowerCase(); }
    }
  }
  const width = num(Math.max(0, style.strokeWidth) * unitsPerPx);

  const draw = (attrs: string, d: string | null, paint: string, extra = "") => {
    const withD = d == null ? attrs : attrs.replace(/\sd="[^"]*"/, ` d="${d}"`);
    if (style.strokeStyle === "stroke") return `<path${withD}${extra} fill="none" stroke="${paint}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" />`;
    if (style.strokeStyle === "stroke-fill") return `<path${withD}${extra} fill="${paint}" stroke="${paint}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" />`;
    return `<path${withD}${extra} fill="${paint}" />`;
  };

  return inner.replace(/<path\b([^>]*?)\/?>/g, (_m, attrs: string) => {
    const originalFill = /\sfill="([^"]*)"/.exec(attrs)?.[1] ?? "none";
    const originalStroke = /\sstroke="([^"]*)"/.exec(attrs)?.[1];
    const strokeOnlyArtwork = originalFill === "none" && !!originalStroke && originalStroke !== "none";
    const original = originalFill !== "none" ? originalFill : originalStroke || "#000000";
    let paint = recolor ? (style.fill as string) : original;
    if (tt && !singleTone && darkest) paint = original.toLowerCase() === darkest ? style.fill || original : tt.secondary;

    if (strokeOnlyArtwork) {
      // Original line art: only recolour, never touch its own stroke weight.
      return `<path${attrs.replace(/\sstroke="[^"]*"/, ` stroke="${paint}"`)} />`;
    }
    const cleaned = attrs.replace(/\s(fill|stroke|stroke-width|stroke-linecap|stroke-linejoin)="[^"]*"/g, "");

    if (tt && singleTone) {
      const d = /\sd="([^"]*)"/.exec(cleaned)?.[1];
      const split = d ? splitTwoTone(d, tt) : null;
      if (split) {
        const tint = ` fill-opacity="${num(Math.min(100, Math.max(0, tt.tint)) / 100)}"`;
        const under = split.under.map((u) => `<path d="${u}" fill="${tt.secondary}"${tint} />`).join("");
        const main = split.main ? draw(cleaned, split.main, paint) : "";
        const accent = split.accent ? draw(cleaned, split.accent, tt.secondary) : "";
        return under + main + accent;
      }
    }
    return draw(cleaned, null, paint);
  });
}

/** A safe, readable id / layer name for an icon group. */
function groupId(name: string) {
  const id = name.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return /^[a-z_]/.test(id) ? id : `icon-${id || "x"}`;
}

/** A standalone SVG for one icon with the fill / stroke style applied, all shapes in one named group. */
export function styledIconSvg(icon: PresentationIcon, style: IconStyle): string {
  const p = parseIconSvg(icon.svg);
  const inner = styleInner(p.inner, Math.max(p.vw, p.vh) / 512, style, icon.singleTone);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${num(p.vw)} ${num(p.vh)}" width="${Math.round(p.vw)}" height="${Math.round(p.vh)}">\n<g id="${groupId(icon.name)}">\n${inner}</g>\n</svg>`;
}

/** Markup for one icon placed in a box: a single group holding every shape of that icon. */
export function renderIconAt(icon: PresentationIcon, x: number, y: number, w: number, h: number, style: IconStyle, idPrefix?: string): string {
  const p = parseIconSvg(icon.svg);
  const inner = styleInner(p.inner, Math.max(p.vw, p.vh) / 512, style, icon.singleTone);
  const k = Math.min(w / p.vw, h / p.vh);
  const tx = x + (w - p.vw * k) / 2;
  const ty = y + (h - p.vh * k) / 2;
  const id = idPrefix === undefined ? "" : ` id="${groupId(`${idPrefix}${icon.name}`)}"`;
  return `<g${id} transform="translate(${num(tx)} ${num(ty)}) scale(${Math.round(k * 100000) / 100000})">${inner}</g>`;
}

/* ------------------------------------------------------------------- grid */

export interface GridCell { x: number; y: number; size: number }
export interface GridLayout { cols: number; rows: number; size: number; capacity: number; cells: GridCell[] }

export function gridLayout(layer: Layer, count: number): GridLayout {
  const gap = layer.gap ?? 24;
  const n = Math.max(1, count);
  let cols = Math.max(0, Math.round(layer.cols || 0));
  let rows = Math.max(0, Math.round(layer.rows || 0));
  const fit = (c: number, r: number) => Math.min((layer.w - (c - 1) * gap) / c, (layer.h - (r - 1) * gap) / r);

  if (!cols && !rows) {
    let best = { c: 1, size: -1 };
    for (let c = 1; c <= n; c++) {
      const size = fit(c, Math.ceil(n / c));
      if (size > best.size + 0.5) best = { c, size };
    }
    cols = best.c;
    rows = Math.ceil(n / cols);
  } else if (!cols) {
    cols = Math.ceil(n / rows);
  } else if (!rows) {
    rows = Math.ceil(n / cols);
  }
  const size = Math.max(1, fit(cols, rows));
  const totalW = cols * size + (cols - 1) * gap;
  const totalH = rows * size + (rows - 1) * gap;
  const ox = layer.x + (layer.w - totalW) / 2;
  const oy = layer.y + (layer.h - totalH) / 2;
  const cells: GridCell[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) cells.push({ x: ox + c * (size + gap), y: oy + r * (size + gap), size });
  }
  return { cols, rows, size, capacity: cols * rows, cells };
}

/* ------------------------------------------------------- paint, gradient */

function fillOrNone(value: string) {
  return value ? esc(value) : "none";
}

/** Gradient running across a box at `angle` degrees (0 = left→right, 90 = top→bottom). */
function gradientDef(id: string, from: string, to: string, angle: number, x: number, y: number, w: number, h: number) {
  const a = (angle * Math.PI) / 180;
  const dx = Math.cos(a), dy = Math.sin(a);
  const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
  const cx = x + w / 2, cy = y + h / 2;
  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${num(cx - dx * half)}" y1="${num(cy - dy * half)}" x2="${num(cx + dx * half)}" y2="${num(cy + dy * half)}"><stop offset="0" stop-color="${esc(from)}"/><stop offset="1" stop-color="${esc(to)}"/></linearGradient>`;
}

interface Paint { defs: string; fill: string }

/** Resolves a layer's fill into a flat colour or a gradient reference. */
function paintOf(layer: Layer): Paint {
  if (layer.fill && layer.fill2) {
    const id = `gr-${layer.id}`;
    return { defs: gradientDef(id, layer.fill, layer.fill2, layer.gradAngle ?? 90, layer.x, layer.y, layer.w, layer.h), fill: `url(#${id})` };
  }
  return { defs: "", fill: fillOrNone(layer.fill) };
}

function fitText(text: string, maxChars: number) {
  return text.length > maxChars ? `${text.slice(0, Math.max(1, maxChars - 1))}…` : text;
}

function resolveText(text: string, doc: SheetDoc, ctx: RenderContext) {
  return text.replace(/\{n\}/g, String(ctx.icons.length)).replace(/\{title\}/g, doc.title);
}

function patternMarkup(layer: Layer): { defs: string; body: string } {
  const gap = Math.max(8, layer.patternGap ?? 60);
  const t = layer.strokeWidth > 0 ? layer.strokeWidth : 4;
  const color = esc(layer.fill || "#000000");
  const id = `pt-${layer.id}`;
  let inner = "";
  let extra = "";
  switch (layer.pattern ?? "dots") {
    case "grid":
      inner = `<path d="M ${num(gap)} 0 L 0 0 0 ${num(gap)}" fill="none" stroke="${color}" stroke-width="${num(t)}"/>`;
      break;
    case "lines":
      inner = `<line x1="0" y1="0" x2="0" y2="${num(gap)}" stroke="${color}" stroke-width="${num(t)}"/>`;
      extra = ` patternTransform="rotate(45)"`;
      break;
    case "cross": {
      const c = gap / 2, r = Math.min(gap * 0.18, 18);
      inner = `<path d="M ${num(c - r)} ${num(c)} H ${num(c + r)} M ${num(c)} ${num(c - r)} V ${num(c + r)}" fill="none" stroke="${color}" stroke-width="${num(Math.max(2, t * 0.6))}" stroke-linecap="round"/>`;
      break;
    }
    default:
      inner = `<circle cx="${num(gap / 2)}" cy="${num(gap / 2)}" r="${num(t / 2)}" fill="${color}"/>`;
  }
  return {
    defs: `<pattern id="${id}" patternUnits="userSpaceOnUse" x="${num(layer.x)}" y="${num(layer.y)}" width="${num(gap)}" height="${num(gap)}"${extra}>${inner}</pattern>`,
    body: `<rect x="${num(layer.x)}" y="${num(layer.y)}" width="${num(layer.w)}" height="${num(layer.h)}" rx="${num(Math.min(layer.radius, layer.w / 2, layer.h / 2))}" fill="url(#${id})"/>`,
  };
}

/* ----------------------------------------------------------------- layers */

function layerBody(layer: Layer, doc: SheetDoc, ctx: RenderContext): { defs: string; body: string } {
  const dash = layer.dash && layer.dash > 0 ? ` stroke-dasharray="${num(layer.dash)} ${num(layer.dash * 0.7)}"` : "";
  const stroke = layer.stroke && layer.strokeWidth > 0 ? ` stroke="${esc(layer.stroke)}" stroke-width="${num(layer.strokeWidth)}" stroke-linejoin="round"${dash}` : "";
  const fo = layer.fillOpacity != null && layer.fillOpacity < 1 ? ` fill-opacity="${num(layer.fillOpacity)}"` : "";
  switch (layer.type) {
    case "rect": {
      const p = paintOf(layer);
      return { defs: p.defs, body: `<rect x="${num(layer.x)}" y="${num(layer.y)}" width="${num(layer.w)}" height="${num(layer.h)}" rx="${num(Math.min(layer.radius, layer.w / 2, layer.h / 2))}" fill="${p.fill}"${fo}${stroke}/>` };
    }
    case "ellipse": {
      const p = paintOf(layer);
      return { defs: p.defs, body: `<ellipse cx="${num(layer.x + layer.w / 2)}" cy="${num(layer.y + layer.h / 2)}" rx="${num(layer.w / 2)}" ry="${num(layer.h / 2)}" fill="${p.fill}"${fo}${stroke}/>` };
    }
    case "triangle": {
      const p = paintOf(layer);
      return { defs: p.defs, body: `<polygon points="${num(layer.x + layer.w / 2)},${num(layer.y)} ${num(layer.x + layer.w)},${num(layer.y + layer.h)} ${num(layer.x)},${num(layer.y + layer.h)}" fill="${p.fill}"${fo}${stroke}/>` };
    }
    case "line": {
      const color = layer.stroke || layer.fill || "#000000";
      const width = layer.strokeWidth > 0 ? layer.strokeWidth : 6;
      const cy = layer.y + layer.h / 2;
      return { defs: "", body: `<line x1="${num(layer.x)}" y1="${num(cy)}" x2="${num(layer.x + layer.w)}" y2="${num(cy)}" stroke="${esc(color)}" stroke-width="${num(width)}" stroke-linecap="round"${dash}/>` };
    }
    case "text": {
      const size = layer.fontSize ?? 120;
      const align = layer.align ?? "left";
      const x = align === "center" ? layer.x + layer.w / 2 : align === "right" ? layer.x + layer.w : layer.x;
      const anchor = align === "center" ? "middle" : align === "right" ? "end" : "start";
      const lines = resolveText(layer.text ?? "", doc, ctx).split("\n");
      const lh = size * ((layer.lineHeight ?? 115) / 100);
      const cy = layer.y + layer.h / 2;
      const attrs = `font-family="${esc(fontOf(layer))}" font-size="${num(size)}" font-weight="${layer.fontWeight ?? 700}" letter-spacing="${num(layer.letterSpacing ?? 0)}" text-anchor="${anchor}" dominant-baseline="central" fill="${fillOrNone(layer.fill)}"`;
      if (lines.length === 1) return { defs: "", body: `<text x="${num(x)}" y="${num(cy)}" ${attrs}>${esc(lines[0])}</text>` };
      const top = cy - (lh * (lines.length - 1)) / 2;
      const spans = lines.map((line, i) => `<tspan x="${num(x)}" y="${num(top + i * lh)}">${esc(line) || " "}</tspan>`).join("");
      return { defs: "", body: `<text ${attrs} xml:space="preserve">${spans}</text>` };
    }
    case "featured": {
      const icon = ctx.icons.find((i) => i.id === ctx.featuredId) ?? ctx.icons[0];
      const pad = (layer.cellPad ?? 14) / 100;
      const p = paintOf(layer);
      const bg = `<rect x="${num(layer.x)}" y="${num(layer.y)}" width="${num(layer.w)}" height="${num(layer.h)}" rx="${num(Math.min(layer.radius, layer.w / 2, layer.h / 2))}" fill="${p.fill}"${fo}${stroke}/>`;
      if (!icon) return { defs: p.defs, body: bg };
      const px = layer.w * pad, py = layer.h * pad;
      return { defs: p.defs, body: bg + renderIconAt(icon, layer.x + px, layer.y + py, layer.w - px * 2, layer.h - py * 2, ctx.style, "featured-") };
    }
    case "pattern":
      return patternMarkup(layer);
    case "image": {
      if (!layer.href) return { defs: "", body: `<rect x="${num(layer.x)}" y="${num(layer.y)}" width="${num(layer.w)}" height="${num(layer.h)}" fill="none" stroke="#9CA3AF" stroke-width="4" stroke-dasharray="20 14"/>` };
      return { defs: "", body: `<image href="${esc(layer.href)}" x="${num(layer.x)}" y="${num(layer.y)}" width="${num(layer.w)}" height="${num(layer.h)}" preserveAspectRatio="xMidYMid meet"/>` };
    }
    case "grid": {
      const byId = new Map(ctx.icons.map((i) => [i.id, i]));
      const shown = ctx.order.map((id) => byId.get(id)).filter((i): i is PresentationIcon => !!i);
      const lay = gridLayout(layer, shown.length);
      const pad = (layer.cellPad ?? 18) / 100;
      const labelH = layer.showLabels ? 0.2 : 0;
      const cellStrokeOn = !!layer.cellStroke && (layer.cellStrokeWidth ?? 0) > 0;
      const cellFo = layer.cellFillOpacity != null && layer.cellFillOpacity < 1 ? ` fill-opacity="${num(layer.cellFillOpacity)}"` : "";
      const cellDash = layer.cellDash && layer.cellDash > 0 ? ` stroke-dasharray="${num(layer.cellDash)} ${num(layer.cellDash * 0.7)}"` : "";
      const defs = "";
      const filterAttr = "";
      let out = "";
      shown.slice(0, lay.capacity).forEach((icon, i) => {
        const cell = lay.cells[i];
        if (!cell) return;
        const s = cell.size;
        const rx = num(Math.min(layer.cellRadius ?? 0, s / 2));
        if (layer.cellOffset && layer.cellOffset > 0) {
          out += `<rect x="${num(cell.x + layer.cellOffset)}" y="${num(cell.y + layer.cellOffset)}" width="${num(s)}" height="${num(s)}" rx="${rx}" fill="${fillOrNone(layer.cellOffsetColor || "#000000")}"/>`;
        }
        if (layer.cellFill || cellStrokeOn) {
          const cs = cellStrokeOn ? ` stroke="${esc(layer.cellStroke ?? "")}" stroke-width="${num(layer.cellStrokeWidth ?? 0)}"${cellDash}` : "";
          out += `<rect x="${num(cell.x)}" y="${num(cell.y)}" width="${num(s)}" height="${num(s)}" rx="${rx}" fill="${fillOrNone(layer.cellFill ?? "")}"${cellFo}${cs}${filterAttr}/>`;
        }
        const areaH = s * (1 - labelH);
        const p = s * pad;
        out += renderIconAt(icon, cell.x + p, cell.y + p, s - p * 2, areaH - p * 2 + (labelH ? p * 0.4 : 0), ctx.style, "");
        if (layer.showLabels || ctx.showNames) {
          const fs = s * 0.085;
          out += `<text x="${num(cell.x + s / 2)}" y="${num(cell.y + s - s * 0.1)}" font-family="${esc(SANS)}" font-size="${num(fs)}" font-weight="600" text-anchor="middle" fill="${esc(doc.labelColor)}">${esc(fitText(icon.name, Math.max(6, Math.floor(s / (fs * 0.62)))))}</text>`;
        }
      });
      return { defs, body: out };
    }
  }
}

export function renderLayer(layer: Layer, doc: SheetDoc, ctx: RenderContext): string {
  if (!layer.visible) return "";
  const { defs, body } = layerBody(layer, doc, ctx);
  if (!body) return "";

  const attrs: string[] = [];
  const extraDefs = defs;
  if (layer.opacity < 1) attrs.push(`opacity="${num(layer.opacity)}"`);
  if (layer.rotation) attrs.push(`transform="rotate(${num(layer.rotation)} ${num(layer.x + layer.w / 2)} ${num(layer.y + layer.h / 2)})"`);
  return `<g id="${esc(layer.id)}"${attrs.length ? ` ${attrs.join(" ")}` : ""}>${extraDefs ? `<defs>${extraDefs}</defs>` : ""}${body}</g>`;
}

export function renderPageBackground(doc: SheetDoc): string {
  if (!doc.background) return "";
  const radius = num(doc.backgroundRadius);
  if (doc.backgroundTo) {
    const def = gradientDef("bg-grad", doc.background, doc.backgroundTo, doc.backgroundAngle ?? 90, 0, 0, doc.width, doc.height);
    return `<defs>${def}</defs><rect width="${num(doc.width)}" height="${num(doc.height)}" rx="${radius}" fill="url(#bg-grad)"/>`;
  }
  return `<rect width="${num(doc.width)}" height="${num(doc.height)}" rx="${radius}" fill="${esc(doc.background)}"/>`;
}

export function renderSheetSvg(doc: SheetDoc, ctx: RenderContext): string {
  const layers = doc.layers.map((layer) => renderLayer(layer, doc, ctx)).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${num(doc.width)} ${num(doc.height)}" width="${num(doc.width)}" height="${num(doc.height)}">\n${renderPageBackground(doc)}\n${layers}\n</svg>`;
}

/** Bounds of a layer in sheet coordinates (ignores rotation). */
export function layerBounds(layer: Layer) {
  return { x: layer.x, y: layer.y, w: layer.w, h: layer.h };
}
