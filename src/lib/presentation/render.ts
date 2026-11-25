import type { IconStyle, Layer, PresentationIcon, RenderContext, SheetDoc } from "./types";

const FONT = "'Plus Jakarta Sans', 'Outfit', 'Segoe UI', Arial, sans-serif";

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
  const parsed: ParsedIcon = {
    vw: box ? Number(box[1]) || 100 : 100,
    vh: box ? Number(box[2]) || 100 : 100,
    inner: open >= 0 && close > open ? svg.slice(open + 1, close) : "",
  };
  if (parseCache.size > 800) parseCache.clear();
  parseCache.set(svg, parsed);
  return parsed;
}

function styleInner(inner: string, unitsPerPx: number, style: IconStyle, singleTone: boolean): string {
  const recolor = singleTone && style.fill;
  if (style.strokeStyle === "fill" && !recolor) return inner;
  return inner.replace(/<path\b([^>]*?)\/?>/g, (_m, attrs: string) => {
    const originalFill = /\sfill="([^"]*)"/.exec(attrs)?.[1] ?? "none";
    const originalStroke = /\sstroke="([^"]*)"/.exec(attrs)?.[1];
    const strokeOnlyArtwork = originalFill === "none" && !!originalStroke && originalStroke !== "none";
    const paint = recolor ? (style.fill as string) : originalFill !== "none" ? originalFill : originalStroke || "#000000";

    if (strokeOnlyArtwork) {
      // Original line art: only recolour, never touch its own stroke weight.
      return `<path${attrs.replace(/\sstroke="[^"]*"/, ` stroke="${paint}"`)} />`;
    }
    const cleaned = attrs.replace(/\s(fill|stroke|stroke-width|stroke-linecap|stroke-linejoin)="[^"]*"/g, "");
    const width = num(Math.max(0, style.strokeWidth) * unitsPerPx);
    if (style.strokeStyle === "stroke") {
      return `<path${cleaned} fill="none" stroke="${paint}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" />`;
    }
    if (style.strokeStyle === "stroke-fill") {
      return `<path${cleaned} fill="${paint}" stroke="${paint}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" />`;
    }
    return `<path${cleaned} fill="${paint}" />`;
  });
}

/** A standalone SVG for one icon with the fill / stroke style applied. */
export function styledIconSvg(icon: PresentationIcon, style: IconStyle): string {
  const p = parseIconSvg(icon.svg);
  const inner = styleInner(p.inner, Math.max(p.vw, p.vh) / 512, style, icon.singleTone);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${num(p.vw)} ${num(p.vh)}" width="${Math.round(p.vw)}" height="${Math.round(p.vh)}">\n${inner}</svg>`;
}

function nestedIcon(icon: PresentationIcon, x: number, y: number, w: number, h: number, style: IconStyle): string {
  const p = parseIconSvg(icon.svg);
  const inner = styleInner(p.inner, Math.max(p.vw, p.vh) / 512, style, icon.singleTone);
  return `<svg x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" viewBox="0 0 ${num(p.vw)} ${num(p.vh)}" preserveAspectRatio="xMidYMid meet" overflow="visible">${inner}</svg>`;
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

/* ----------------------------------------------------------------- layers */

function fillOrNone(value: string) {
  return value ? esc(value) : "none";
}

function fitText(text: string, maxChars: number) {
  return text.length > maxChars ? `${text.slice(0, Math.max(1, maxChars - 1))}…` : text;
}

function resolveText(text: string, doc: SheetDoc, ctx: RenderContext) {
  return text.replace(/\{n\}/g, String(ctx.icons.length)).replace(/\{title\}/g, doc.title);
}

function layerBody(layer: Layer, doc: SheetDoc, ctx: RenderContext): string {
  const stroke = layer.stroke && layer.strokeWidth > 0 ? ` stroke="${esc(layer.stroke)}" stroke-width="${num(layer.strokeWidth)}" stroke-linejoin="round"` : "";
  switch (layer.type) {
    case "rect":
      return `<rect x="${num(layer.x)}" y="${num(layer.y)}" width="${num(layer.w)}" height="${num(layer.h)}" rx="${num(Math.min(layer.radius, layer.w / 2, layer.h / 2))}" fill="${fillOrNone(layer.fill)}"${stroke}/>`;
    case "ellipse":
      return `<ellipse cx="${num(layer.x + layer.w / 2)}" cy="${num(layer.y + layer.h / 2)}" rx="${num(layer.w / 2)}" ry="${num(layer.h / 2)}" fill="${fillOrNone(layer.fill)}"${stroke}/>`;
    case "triangle":
      return `<polygon points="${num(layer.x + layer.w / 2)},${num(layer.y)} ${num(layer.x + layer.w)},${num(layer.y + layer.h)} ${num(layer.x)},${num(layer.y + layer.h)}" fill="${fillOrNone(layer.fill)}"${stroke}/>`;
    case "line": {
      const color = layer.stroke || layer.fill || "#000000";
      const width = layer.strokeWidth > 0 ? layer.strokeWidth : 6;
      const cy = layer.y + layer.h / 2;
      return `<line x1="${num(layer.x)}" y1="${num(cy)}" x2="${num(layer.x + layer.w)}" y2="${num(cy)}" stroke="${esc(color)}" stroke-width="${num(width)}" stroke-linecap="round"/>`;
    }
    case "text": {
      const size = layer.fontSize ?? 120;
      const align = layer.align ?? "left";
      const x = align === "center" ? layer.x + layer.w / 2 : align === "right" ? layer.x + layer.w : layer.x;
      const anchor = align === "center" ? "middle" : align === "right" ? "end" : "start";
      return `<text x="${num(x)}" y="${num(layer.y + layer.h / 2)}" font-family="${FONT}" font-size="${num(size)}" font-weight="${layer.fontWeight ?? 700}" letter-spacing="${num(layer.letterSpacing ?? 0)}" text-anchor="${anchor}" dominant-baseline="central" fill="${fillOrNone(layer.fill)}">${esc(resolveText(layer.text ?? "", doc, ctx))}</text>`;
    }
    case "featured": {
      const icon = ctx.icons.find((i) => i.id === ctx.featuredId) ?? ctx.icons[0];
      const pad = (layer.cellPad ?? 14) / 100;
      const bg = `<rect x="${num(layer.x)}" y="${num(layer.y)}" width="${num(layer.w)}" height="${num(layer.h)}" rx="${num(Math.min(layer.radius, layer.w / 2, layer.h / 2))}" fill="${fillOrNone(layer.fill)}"${stroke}/>`;
      if (!icon) return bg;
      const px = layer.w * pad, py = layer.h * pad;
      return bg + nestedIcon(icon, layer.x + px, layer.y + py, layer.w - px * 2, layer.h - py * 2, ctx.style);
    }
    case "grid": {
      const byId = new Map(ctx.icons.map((i) => [i.id, i]));
      const shown = ctx.order.map((id) => byId.get(id)).filter((i): i is PresentationIcon => !!i);
      const lay = gridLayout(layer, shown.length);
      const pad = (layer.cellPad ?? 18) / 100;
      const labelH = layer.showLabels ? 0.2 : 0;
      let out = "";
      shown.slice(0, lay.capacity).forEach((icon, i) => {
        const cell = lay.cells[i];
        if (!cell) return;
        const s = cell.size;
        if (layer.cellFill || (layer.cellStroke && (layer.cellStrokeWidth ?? 0) > 0)) {
          const cs = layer.cellStroke && (layer.cellStrokeWidth ?? 0) > 0 ? ` stroke="${esc(layer.cellStroke)}" stroke-width="${num(layer.cellStrokeWidth ?? 0)}"` : "";
          out += `<rect x="${num(cell.x)}" y="${num(cell.y)}" width="${num(s)}" height="${num(s)}" rx="${num(layer.cellRadius ?? 0)}" fill="${fillOrNone(layer.cellFill ?? "")}"${cs}/>`;
        }
        const areaH = s * (1 - labelH);
        const p = s * pad;
        out += nestedIcon(icon, cell.x + p, cell.y + p, s - p * 2, areaH - p * 2 + (labelH ? p * 0.4 : 0), ctx.style);
        if (layer.showLabels || ctx.showNames) {
          const fs = s * 0.085;
          out += `<text x="${num(cell.x + s / 2)}" y="${num(cell.y + s - s * 0.1)}" font-family="${FONT}" font-size="${num(fs)}" font-weight="600" text-anchor="middle" fill="${esc(doc.labelColor)}">${esc(fitText(icon.name, Math.max(6, Math.floor(s / (fs * 0.62)))))}</text>`;
        }
      });
      return out;
    }
  }
}

export function renderLayer(layer: Layer, doc: SheetDoc, ctx: RenderContext): string {
  if (!layer.visible) return "";
  const body = layerBody(layer, doc, ctx);
  if (!body) return "";
  const attrs: string[] = [];
  if (layer.opacity < 1) attrs.push(`opacity="${num(layer.opacity)}"`);
  if (layer.rotation) attrs.push(`transform="rotate(${num(layer.rotation)} ${num(layer.x + layer.w / 2)} ${num(layer.y + layer.h / 2)})"`);
  return `<g id="${esc(layer.id)}"${attrs.length ? ` ${attrs.join(" ")}` : ""}>${body}</g>`;
}

export function renderPageBackground(doc: SheetDoc): string {
  if (!doc.background) return "";
  return `<rect width="${num(doc.width)}" height="${num(doc.height)}" rx="${num(doc.backgroundRadius)}" fill="${esc(doc.background)}"/>`;
}

export function renderSheetSvg(doc: SheetDoc, ctx: RenderContext): string {
  const layers = doc.layers.map((layer) => renderLayer(layer, doc, ctx)).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${num(doc.width)} ${num(doc.height)}" width="${num(doc.width)}" height="${num(doc.height)}">\n${renderPageBackground(doc)}\n${layers}\n</svg>`;
}

/** Bounds of a layer in sheet coordinates (ignores rotation). */
export function layerBounds(layer: Layer) {
  return { x: layer.x, y: layer.y, w: layer.w, h: layer.h };
}
