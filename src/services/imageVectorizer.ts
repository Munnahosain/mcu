/**
 * Icon-aware image → vector tracer.
 *
 * Unlike a generic "trace the whole bitmap" tool, this works the way an icon
 * production workflow does:
 *
 *   1. Detect the sheet background and build a soft "ink" coverage map.
 *   2. Find every connected piece of artwork, drop dust / JPEG noise.
 *   3. Group the pieces into icons (a badge + its glyph, a dot + its stem…)
 *      using an automatically chosen gap, so each icon becomes ONE unit.
 *   4. Order the icons in natural reading order (rows, left → right).
 *   5. Trace every icon on its own: bicubic up-sampling of the anti-aliased
 *      edge → sub-pixel iso-contour (marching squares) → corner detection with
 *      tangent-line intersection (crisp corners) → straight-line detection →
 *      least-squares cubic Bézier fitting (smooth curves, few nodes).
 *
 * The output is the same `VectorPath[]` model the SVG/EPS splitter already
 * uses, so grid split, manual split, export and 3D Studio all keep working.
 */

import type { BoundingBox, EPSDocument, ExtractedIcon } from '../types';
import { buildIconEPS, buildIconSvg, type RawPathSegment, type VectorPath } from './epsParser';

/* -------------------------------------------------------------------------- */
/*  Public types                                                              */
/* -------------------------------------------------------------------------- */

export type TraceMode = 'single' | 'multicolor';
export type TraceBackground = 'auto' | 'light' | 'dark';

export interface TraceOptions {
  mode: TraceMode;
  background: TraceBackground;
  /** Edge position, 5–95 (%). `null` = automatic (50 = exact half-coverage edge). */
  threshold: number | null;
  /** 0 = tight to the pixels, 100 = very smooth. */
  smoothness: number;
  /** 0 = round everything, 100 = keep every corner crisp. */
  corners: number;
  /** Up-sampling used for sub-pixel precision. 0 = automatic. */
  detail: 0 | 1 | 2 | 3 | 4;
  /** Smallest speck to keep, in source pixels². `null` = automatic. */
  noise: number | null;
  /** Max gap (source px) between pieces that still belong to one icon. `null` = automatic. */
  grouping: number | null;
  /** Colours to extract in multicolor mode (2–12). */
  colors: number;
  /** Fill colour for single tone (#rrggbb). `null` = keep the original ink colour. */
  fill: string | null;
}

export const DEFAULT_TRACE_OPTIONS: TraceOptions = {
  mode: 'single',
  background: 'auto',
  threshold: null,
  smoothness: 35,
  corners: 60,
  detail: 0,
  noise: null,
  grouping: null,
  colors: 6,
  fill: '#000000',
};

export interface RasterInput {
  /** RGBA, row-major. */
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

export interface TracedIcon {
  index: number;
  bbox: BoundingBox;
  paths: VectorPath[];
}

export interface TraceResult {
  width: number;
  height: number;
  icons: TracedIcon[];
  /** Diagnostics that are useful for the UI ("grouping gap used: 14px"). */
  info: { background: string; groupingGap: number; detail: number; rawPieces: number };
}

export type TraceProgress = (message: string, percent: number, stats?: { done: number; total: number }) => void;

/* -------------------------------------------------------------------------- */
/*  Small helpers                                                             */
/* -------------------------------------------------------------------------- */

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const yieldToUI = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function toHex(r: number, g: number, b: number) {
  const h = (n: number) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function hexToRgbString(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 'rgb(0, 0, 0)';
  const n = parseInt(m[1], 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

function rgbString(r: number, g: number, b: number) {
  return `rgb(${Math.round(clamp(r, 0, 255))}, ${Math.round(clamp(g, 0, 255))}, ${Math.round(clamp(b, 0, 255))})`;
}

/* -------------------------------------------------------------------------- */
/*  1. Background + ink analysis                                              */
/* -------------------------------------------------------------------------- */

interface Analysis {
  w: number;
  h: number;
  /** Raw distance from the background colour, 0..1. */
  d: Float32Array;
  bg: [number, number, number];
  useAlpha: boolean;
  otsu: number;
  /** Median distance of the foreground — what "full ink" looks like. */
  fgRef: number;
}

function dominantColor(
  data: ArrayLike<number>,
  w: number,
  h: number,
  pick: (x: number, y: number, r: number, g: number, b: number) => boolean
): [number, number, number] | null {
  const counts = new Uint32Array(32768);
  const sr = new Float64Array(32768);
  const sg = new Float64Array(32768);
  const sb = new Float64Array(32768);
  const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 250000)));
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (!pick(x, y, r, g, b)) continue;
      const k = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      counts[k]++;
      sr[k] += r; sg[k] += g; sb[k] += b;
    }
  }
  let best = -1, bestCount = 0;
  for (let k = 0; k < 32768; k++) {
    if (counts[k] > bestCount) { bestCount = counts[k]; best = k; }
  }
  if (best < 0) return null;
  return [sr[best] / bestCount, sg[best] / bestCount, sb[best] / bestCount];
}

function analyze(img: RasterInput, background: TraceBackground): Analysis {
  const { data, width: w, height: h } = img;
  const n = w * h;

  // Transparent PNG sheets: the alpha channel IS the ink.
  let transparentBorder = 0, borderCount = 0, transparentAll = 0;
  const stepA = Math.max(1, Math.floor(Math.sqrt(n / 200000)));
  for (let y = 0; y < h; y += stepA) {
    for (let x = 0; x < w; x += stepA) {
      const a = data[(y * w + x) * 4 + 3];
      if (a < 250) transparentAll++;
      if (x < 3 || y < 3 || x >= w - 3 || y >= h - 3) {
        borderCount++;
        if (a < 128) transparentBorder++;
      }
    }
  }
  const sampled = Math.ceil(w / stepA) * Math.ceil(h / stepA);
  const useAlpha = transparentAll / Math.max(1, sampled) > 0.02 && transparentBorder / Math.max(1, borderCount) > 0.5;

  let bg: [number, number, number] = [255, 255, 255];
  if (!useAlpha) {
    const lum = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;
    let found: [number, number, number] | null = null;
    if (background === 'light') {
      found = dominantColor(data, w, h, (_x, _y, r, g, b) => lum(r, g, b) > 140);
    } else if (background === 'dark') {
      found = dominantColor(data, w, h, (_x, _y, r, g, b) => lum(r, g, b) < 115);
    } else {
      const bw = Math.max(2, Math.round(Math.min(w, h) * 0.01));
      found = dominantColor(data, w, h, (x, y) => x < bw || y < bw || x >= w - bw || y >= h - bw);
      if (!found) found = dominantColor(data, w, h, () => true);
    }
    if (found) bg = found;
  }

  const d = new Float32Array(n);
  const hist = new Float64Array(256);
  const [br, bgG, bb] = bg;
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    let v: number;
    if (useAlpha) {
      v = data[p + 3] / 255;
    } else {
      const a = data[p + 3] / 255;
      const r = data[p] * a + br * (1 - a);
      const g = data[p + 1] * a + bgG * (1 - a);
      const b = data[p + 2] * a + bb * (1 - a);
      const dr = r - br, dg = g - bgG, db = b - bb;
      v = Math.sqrt((dr * dr + dg * dg + db * db) / 3) / 255;
    }
    d[i] = v;
    hist[Math.min(255, Math.round(v * 255))]++;
  }

  // Otsu on the distance histogram.
  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * hist[i];
  let wB = 0, sumB = 0, maxVar = -1, otsuBin = 40;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = n - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxVar) { maxVar = between; otsuBin = t; }
  }
  const otsu = clamp((otsuBin + 1) / 255, 0.03, 0.9);

  // Median of everything above the Otsu split = "full ink".
  let fgCount = 0;
  for (let i = Math.round(otsu * 255); i < 256; i++) fgCount += hist[i];
  if (fgCount < 4) throw new Error('No artwork was found on this image. Try a different background setting.');
  let acc = 0, fgRef = 1;
  for (let i = Math.round(otsu * 255); i < 256; i++) {
    acc += hist[i];
    if (acc >= fgCount / 2) { fgRef = Math.max(0.05, i / 255); break; }
  }

  return { w, h, d, bg, useAlpha, otsu, fgRef };
}

/* -------------------------------------------------------------------------- */
/*  2. Multicolor palette                                                     */
/* -------------------------------------------------------------------------- */

interface Palette {
  colors: [number, number, number][];
  /** 0 = background, 1..k = palette index + 1 */
  labels: Uint8Array;
  /** How much of the pixel is that colour (0..1) — keeps anti-aliased edges sub-pixel accurate. */
  alpha: Float32Array;
}

function colorDist(a: ArrayLike<number>, b: ArrayLike<number>) {
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return Math.sqrt((2 * dr * dr + 4 * dg * dg + 3 * db * db) / 9);
}

function buildPalette(img: RasterInput, an: Analysis, wanted: number): Palette {
  const { data } = img;
  const { w, h, d, bg, otsu } = an;
  const n = w * h;
  const strong = Math.max(0.1, otsu * 0.9);

  // Deterministic sample of confident foreground pixels.
  const samples: number[] = [];
  const stride = Math.max(1, Math.floor(Math.sqrt(n / 40000)));
  for (let y = 0; y < h; y += stride) {
    for (let x = 0; x < w; x += stride) {
      const i = y * w + x;
      if (d[i] >= strong) samples.push(i * 4);
    }
  }
  if (samples.length === 0) throw new Error('No colour regions were found on this image.');

  const k = clamp(Math.round(wanted), 2, 12);
  let seed = 1234567;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  // k-means++ init
  const cents: number[][] = [];
  const first = samples[Math.floor(rand() * samples.length)];
  cents.push([data[first], data[first + 1], data[first + 2]]);
  const minD = new Float64Array(samples.length).fill(Infinity);
  while (cents.length < k) {
    const last = cents[cents.length - 1];
    let total = 0;
    for (let s = 0; s < samples.length; s++) {
      const p = samples[s];
      const dd = colorDist([data[p], data[p + 1], data[p + 2]], last);
      const d2 = dd * dd;
      if (d2 < minD[s]) minD[s] = d2;
      total += minD[s];
    }
    if (total <= 1e-6) break;
    let r = rand() * total;
    let chosen = samples.length - 1;
    for (let s = 0; s < samples.length; s++) {
      r -= minD[s];
      if (r <= 0) { chosen = s; break; }
    }
    const p = samples[chosen];
    cents.push([data[p], data[p + 1], data[p + 2]]);
  }

  // Lloyd iterations
  const assign = new Int32Array(samples.length);
  for (let iter = 0; iter < 12; iter++) {
    const sum = cents.map(() => [0, 0, 0, 0]);
    for (let s = 0; s < samples.length; s++) {
      const p = samples[s];
      const px = [data[p], data[p + 1], data[p + 2]];
      let best = 0, bd = Infinity;
      for (let c = 0; c < cents.length; c++) {
        const dd = colorDist(px, cents[c]);
        if (dd < bd) { bd = dd; best = c; }
      }
      assign[s] = best;
      sum[best][0] += px[0]; sum[best][1] += px[1]; sum[best][2] += px[2]; sum[best][3]++;
    }
    for (let c = 0; c < cents.length; c++) {
      if (sum[c][3] > 0) cents[c] = [sum[c][0] / sum[c][3], sum[c][1] / sum[c][3], sum[c][2] / sum[c][3]];
    }
  }

  // Drop tiny clusters and merge near-duplicates.
  const counts = new Array(cents.length).fill(0);
  for (let s = 0; s < samples.length; s++) counts[assign[s]]++;
  const kept: number[][] = [];
  const order = cents.map((_, i) => i).sort((a, b) => counts[b] - counts[a]);
  for (const c of order) {
    if (counts[c] < samples.length * 0.004) continue;
    if (kept.some((o) => colorDist(o, cents[c]) < 22)) continue;
    kept.push(cents[c]);
  }
  if (kept.length === 0) kept.push(cents[order[0]]);

  const colors = kept.map((c) => [c[0], c[1], c[2]] as [number, number, number]);

  // Classify every pixel against the segments "background → palette colour".
  // The projection gives the coverage (alpha) of an anti-aliased edge pixel, so
  // edges against the background stay smooth instead of snapping to the pixel grid.
  const labels = new Uint8Array(n);
  const alpha = new Float32Array(n);
  const low = Math.max(0.05, otsu * 0.55);
  const axes = colors.map((c) => {
    const vx = c[0] - bg[0], vy = c[1] - bg[1], vz = c[2] - bg[2];
    return { vx, vy, vz, vv: vx * vx + vy * vy + vz * vz || 1 };
  });
  for (let i = 0; i < n; i++) {
    if (d[i] < low) continue;
    const p = i * 4;
    const px = data[p] - bg[0], py = data[p + 1] - bg[1], pz = data[p + 2] - bg[2];
    let best = -1, bestRes = Infinity, bestT = 0;
    for (let c = 0; c < colors.length; c++) {
      const a = axes[c];
      const t = clamp((px * a.vx + py * a.vy + pz * a.vz) / a.vv, 0, 1);
      const rx = px - a.vx * t, ry = py - a.vy * t, rz = pz - a.vz * t;
      const res = (2 * rx * rx + 4 * ry * ry + 3 * rz * rz) / 9;
      if (res < bestRes - 1e-6 || (Math.abs(res - bestRes) <= 1e-6 && t > bestT)) { bestRes = res; best = c; bestT = t; }
    }
    if (best >= 0 && bestT > 0.12) {
      labels[i] = best + 1;
      alpha[i] = bestT > 0.92 ? 1 : bestT;
    }
  }

  // Majority filter on solid pixels only — removes one-pixel halos between two colours.
  const out = new Uint8Array(labels);
  const tally = new Uint16Array(colors.length + 1);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (labels[i] === 0 || alpha[i] < 1) continue;
      tally.fill(0);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const q = i + dy * w + dx;
          if (alpha[q] >= 1) tally[labels[q]]++;
        }
      }
      let best = labels[i], bc = tally[best];
      for (let c = 1; c < tally.length; c++) {
        if (tally[c] > bc + 1) { bc = tally[c]; best = c; }
      }
      out[i] = best;
    }
  }

  return { colors, labels: out, alpha };
}

/* -------------------------------------------------------------------------- */
/*  3. Connected pieces + icon grouping                                       */
/* -------------------------------------------------------------------------- */

interface Components {
  labels: Int32Array;
  count: number;
  area: Int32Array;
  minX: Int32Array;
  minY: Int32Array;
  maxX: Int32Array;
  maxY: Int32Array;
}

function labelComponents(mask: Uint8Array, w: number, h: number): Components {
  const labels = new Int32Array(w * h);
  const stack = new Int32Array(w * h);
  const areaL: number[] = [0], minXL: number[] = [0], minYL: number[] = [0], maxXL: number[] = [0], maxYL: number[] = [0];
  let count = 0;
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start]) continue;
    count++;
    let sp = 0;
    stack[sp++] = start;
    labels[start] = count;
    let area = 0, mnx = w, mny = h, mxx = 0, mxy = 0;
    while (sp > 0) {
      const p = stack[--sp];
      const px = p % w, py = (p - px) / w;
      area++;
      if (px < mnx) mnx = px;
      if (px > mxx) mxx = px;
      if (py < mny) mny = py;
      if (py > mxy) mxy = py;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = py + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = px + dx;
          if (nx < 0 || nx >= w) continue;
          const q = ny * w + nx;
          if (mask[q] && !labels[q]) {
            labels[q] = count;
            stack[sp++] = q;
          }
        }
      }
    }
    areaL.push(area); minXL.push(mnx); minYL.push(mny); maxXL.push(mxx); maxYL.push(mxy);
  }
  return {
    labels,
    count,
    area: Int32Array.from(areaL),
    minX: Int32Array.from(minXL),
    minY: Int32Array.from(minYL),
    maxX: Int32Array.from(maxXL),
    maxY: Int32Array.from(maxYL),
  };
}

/** Union-find grouping of component bounding boxes closer than `gap` px. */
function groupComponents(ids: number[], c: Components, gap: number): number[] {
  // ids must be sorted by minX
  const parent = ids.map((_, i) => i);
  const find = (a: number): number => {
    while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; }
    return a;
  };
  for (let i = 0; i < ids.length; i++) {
    const a = ids[i];
    const aMaxX = c.maxX[a] + gap;
    for (let j = i + 1; j < ids.length; j++) {
      const b = ids[j];
      if (c.minX[b] > aMaxX) break;
      const overlapY = !(c.minY[b] > c.maxY[a] + gap || c.maxY[b] < c.minY[a] - gap);
      if (!overlapY) continue;
      const ra = find(i), rb = find(j);
      if (ra !== rb) parent[ra] = rb;
    }
  }
  return ids.map((_, i) => find(i));
}

function countGroups(roots: number[]) {
  return new Set(roots).size;
}

/** Pick the grouping gap that stays stable the longest (log scale). */
function autoGap(ids: number[], c: Components, w: number, h: number): number {
  if (ids.length <= 1) return 0;
  const maxGap = Math.max(12, Math.round(Math.min(w, h) * 0.18));
  const gaps: number[] = [0];
  for (let g = 1; g <= maxGap; g = Math.max(g + 1, Math.round(g * 1.25))) gaps.push(g);
  const counts = gaps.map((g) => countGroups(groupComponents(ids, c, g)));

  type Run = { lo: number; hi: number; n: number; score: number };
  const runs: Run[] = [];
  let s = 0;
  for (let i = 1; i <= gaps.length; i++) {
    if (i === gaps.length || counts[i] !== counts[s]) {
      const lo = gaps[s];
      const hi = i === gaps.length ? gaps[i - 1] * 1.25 + 1 : gaps[i];
      runs.push({ lo, hi, n: counts[s], score: Math.log((hi + 2) / (lo + 2)) });
      s = i;
    }
  }
  const multi = runs.filter((r) => r.n >= 2);
  const pool = multi.length ? multi : runs;
  let best = pool[0];
  for (const r of pool) if (r.score > best.score) best = r;
  // The first plateau (tiny gaps) is nearly always the longest, yet detached
  // parts of one icon (a dot above a frame, two bars of a pause icon) sit just
  // beyond it. If a later plateau is still clearly stable, prefer it.
  const bestPos = pool.indexOf(best);
  for (let i = bestPos + 1; i < pool.length; i++) {
    if (pool[i].score >= best.score * 0.4) { best = pool[i]; break; }
  }
  // Middle of the plateau (geometric), nudged towards the safe (smaller) side.
  return Math.max(0, Math.round(Math.sqrt((best.lo + 1) * (best.hi + 1)) - 1));
}

/* -------------------------------------------------------------------------- */
/*  Grid-aware slicing (XY-cut)                                               */
/*                                                                            */
/*  Icon sheets are laid out in rows and columns, so instead of guessing one  */
/*  global "closeness" for every piece we cut the sheet along the blank       */
/*  bands that separate rows, then the blank bands that separate columns.     */
/*  A blank band only counts when it clears every piece on the sheet, which   */
/*  is why a dot above a frame (or the bars of a pause icon) never splits.    */
/* -------------------------------------------------------------------------- */

interface AxisRun { lo: number; hi: number; ids: number[] }

function axisRuns(ids: number[], c: Components, axis: 'x' | 'y'): AxisRun[] {
  const lo = axis === 'x' ? c.minX : c.minY;
  const hi = axis === 'x' ? c.maxX : c.maxY;
  const sorted = [...ids].sort((a, b) => lo[a] - lo[b]);
  const runs: AxisRun[] = [];
  for (const id of sorted) {
    const last = runs[runs.length - 1];
    if (last && lo[id] <= last.hi + 1) {
      last.hi = Math.max(last.hi, hi[id]);
      last.ids.push(id);
    } else {
      runs.push({ lo: lo[id], hi: hi[id], ids: [id] });
    }
  }
  return runs;
}

/**
 * Which blank bands separate icons and which only separate the parts of one?
 * Look for the biggest jump between sorted gap sizes; with no jump, every gap
 * that clears `floor` is a separator.
 */
function pickGapThreshold(gaps: number[], floor: number): number {
  const s = [...gaps].sort((a, b) => a - b);
  if (s.length === 1) return s[0] >= floor ? s[0] : Infinity;
  // Separators are the LARGEST gaps, so take the last clear jump. Picking the
  // biggest ratio instead would stop at the gap between two bars of one icon
  // (8px → 40px) and cut pause / equals / dotted icons in half. Anything bigger
  // than an icon that this leaves merged is split later by the size-based pass.
  let bestIdx = -1;
  for (let i = 0; i < s.length - 1; i++) {
    if (s[i + 1] < floor) continue;
    if ((s[i + 1] + 1) / (s[i] + 1) >= 2) bestIdx = i;
  }
  if (bestIdx >= 0) return s[bestIdx + 1];
  const t = Math.max(s[0], floor);
  return t > s[s.length - 1] ? Infinity : t;
}

function cutIds(ids: number[], c: Components, axis: 'x' | 'y', floorFrac: number, absFloor: number): number[][] | null {
  const runs = axisRuns(ids, c, axis);
  if (runs.length < 2) return null;
  const extent = runs[runs.length - 1].hi - runs[0].lo + 1;
  const gaps = runs.slice(1).map((r, i) => r.lo - runs[i].hi - 1);
  const thr = pickGapThreshold(gaps, Math.max(absFloor, extent * floorFrac));
  if (!Number.isFinite(thr)) return null;
  const parts: number[][] = [[...runs[0].ids]];
  for (let i = 1; i < runs.length; i++) {
    if (gaps[i - 1] >= thr) parts.push([...runs[i].ids]);
    else parts[parts.length - 1].push(...runs[i].ids);
  }
  return parts.length > 1 ? parts : null;
}

function idsBox(ids: number[], c: Components) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const id of ids) {
    minX = Math.min(minX, c.minX[id]); minY = Math.min(minY, c.minY[id]);
    maxX = Math.max(maxX, c.maxX[id]); maxY = Math.max(maxY, c.maxY[id]);
  }
  return { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function sliceAuto(ids: number[], c: Components): number[][] {
  let cells: number[][];
  const rows = cutIds(ids, c, 'y', 0.004, 2);
  if (rows) {
    cells = rows.flatMap((band) => cutIds(band, c, 'x', 0.012, 3) ?? [band]);
  } else {
    const cols = cutIds(ids, c, 'x', 0.012, 3);
    cells = cols ? cols.flatMap((col) => cutIds(col, c, 'y', 0.004, 2) ?? [col]) : [ids];
  }

  // Reference icon size → catches layouts that are not perfectly aligned.
  // Only cells that look like a single icon (not a long merged row / column or
  // a line of text) vote; if none do, fall back to the shorter side.
  const boxes = cells.map((cell) => idsBox(cell, c));
  const single = boxes.filter((b) => Math.max(b.w, b.h) / Math.max(1, Math.min(b.w, b.h)) <= 2);
  const sizes = (single.length ? single.map((b) => Math.max(b.w, b.h)) : boxes.map((b) => Math.min(b.w, b.h))).sort((a, b) => a - b);
  const U = sizes[Math.floor(sizes.length / 2)] || 1;
  const refine = (cell: number[], depth: number): number[][] => {
    const b = idsBox(cell, c);
    if (depth > 3 || Math.max(b.w, b.h) <= U * 1.7) return [cell];
    const longAxis = b.h >= b.w ? 'y' : 'x';
    const parts = cutIds(cell, c, longAxis, 0, U * 0.18);
    // A cut that only chips off a speck is a detail inside one icon, not a separator.
    const sane = parts && parts.every((part) => { const pb = idsBox(part, c); return Math.max(pb.w, pb.h) >= U * 0.3; });
    return parts && sane ? parts.flatMap((p) => refine(p, depth + 1)) : [cell];
  };
  cells = cells.flatMap((cell) => refine(cell, 0));

  // Specks that survived the noise filter are not icons.
  if (cells.length > 3) {
    cells = cells.filter((cell) => {
      const b = idsBox(cell, c);
      return Math.max(b.w, b.h) >= U * 0.12;
    });
  }
  return cells;
}

interface Group {
  ids: number[];
  minX: number; minY: number; maxX: number; maxY: number;
}

function orderGroups(groups: Group[]): Group[] {
  if (groups.length < 2) return groups;
  const heights = groups.map((g) => g.maxY - g.minY + 1).sort((a, b) => a - b);
  const medH = heights[Math.floor(heights.length / 2)];
  const byCy = [...groups].sort((a, b) => (a.minY + a.maxY) - (b.minY + b.maxY));
  const rows: Group[][] = [];
  let rowMean = 0;
  for (const g of byCy) {
    const cy = (g.minY + g.maxY) / 2;
    const row = rows[rows.length - 1];
    if (row && Math.abs(cy - rowMean) <= medH * 0.55) {
      row.push(g);
      rowMean = row.reduce((s, r) => s + (r.minY + r.maxY) / 2, 0) / row.length;
    } else {
      rows.push([g]);
      rowMean = cy;
    }
  }
  return rows.flatMap((row) => row.sort((a, b) => a.minX - b.minX));
}

/* -------------------------------------------------------------------------- */
/*  4. Sub-pixel field: bicubic up-sample + gaussian                          */
/* -------------------------------------------------------------------------- */

interface Field {
  f: Float32Array;
  W: number;
  H: number;
}

function catmullWeights(t: number): [number, number, number, number] {
  const t2 = t * t, t3 = t2 * t;
  return [
    -0.5 * t3 + t2 - 0.5 * t,
    1.5 * t3 - 2.5 * t2 + 1,
    -1.5 * t3 + 2 * t2 + 0.5 * t,
    0.5 * t3 - 0.5 * t2,
  ];
}

function gaussianKernel(sigma: number): Float32Array {
  const radius = Math.max(1, Math.ceil(sigma * 3));
  const k = new Float32Array(radius * 2 + 1);
  let sum = 0;
  for (let i = -radius; i <= radius; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    k[i + radius] = v;
    sum += v;
  }
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  return k;
}

function blurInPlace(f: Float32Array, W: number, H: number, sigma: number) {
  if (sigma < 0.3) return;
  const k = gaussianKernel(sigma);
  const r = (k.length - 1) / 2;
  const tmp = new Float32Array(f.length);
  for (let y = 0; y < H; y++) {
    const row = y * W;
    for (let x = 0; x < W; x++) {
      let acc = 0;
      for (let t = -r; t <= r; t++) {
        const xx = x + t;
        acc += k[t + r] * f[row + (xx < 0 ? 0 : xx >= W ? W - 1 : xx)];
      }
      tmp[row + x] = acc;
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let acc = 0;
      for (let t = -r; t <= r; t++) {
        const yy = y + t;
        acc += k[t + r] * tmp[(yy < 0 ? 0 : yy >= H ? H - 1 : yy) * W + x];
      }
      f[y * W + x] = acc;
    }
  }
}

/**
 * Up-samples `src` (cw × ch) by an integer factor. The returned grid has a
 * one-node zero border so every contour closes. Node (X, Y) lies at
 * source-space position ((X - 0.5) / s, (Y - 0.5) / s) in pixel-edge units.
 */
function buildField(src: Float32Array, cw: number, ch: number, s: number, sigmaUp: number): Field {
  const uw = cw * s, uh = ch * s;
  const tmp = new Float32Array(uw * ch);
  // horizontal pass
  for (let ux = 0; ux < uw; ux++) {
    const sx = (ux + 0.5) / s - 0.5;
    const ix = Math.floor(sx);
    const wts = catmullWeights(sx - ix);
    for (let y = 0; y < ch; y++) {
      const row = y * cw;
      let acc = 0;
      for (let t = 0; t < 4; t++) {
        const xx = clamp(ix - 1 + t, 0, cw - 1);
        acc += wts[t] * src[row + xx];
      }
      tmp[y * uw + ux] = acc;
    }
  }
  const W = uw + 2, H = uh + 2;
  const f = new Float32Array(W * H);
  for (let uy = 0; uy < uh; uy++) {
    const sy = (uy + 0.5) / s - 0.5;
    const iy = Math.floor(sy);
    const wts = catmullWeights(sy - iy);
    const y0 = clamp(iy - 1, 0, ch - 1), y1 = clamp(iy, 0, ch - 1), y2 = clamp(iy + 1, 0, ch - 1), y3 = clamp(iy + 2, 0, ch - 1);
    const outRow = (uy + 1) * W + 1;
    for (let ux = 0; ux < uw; ux++) {
      const v = wts[0] * tmp[y0 * uw + ux] + wts[1] * tmp[y1 * uw + ux] + wts[2] * tmp[y2 * uw + ux] + wts[3] * tmp[y3 * uw + ux];
      f[outRow + ux] = v < 0 ? 0 : v > 1.2 ? 1.2 : v;
    }
  }
  blurInPlace(f, W, H, sigmaUp);
  return { f, W, H };
}

/* -------------------------------------------------------------------------- */
/*  5. Marching squares                                                       */
/* -------------------------------------------------------------------------- */

type EdgeName = 0 | 1 | 2 | 3; // T, R, B, L
const CORNER_PT = [[0, 0], [1, 0], [1, 1], [0, 1]]; // TL TR BR BL
const EDGE_MID = [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]]; // T R B L
const CORNER_EDGES: [EdgeName, EdgeName][] = [[0, 3], [0, 1], [1, 2], [2, 3]];

function orientSegment(a: EdgeName, b: EdgeName, ref: number[], refInside: boolean): [EdgeName, EdgeName] {
  const p1 = EDGE_MID[a], p2 = EDGE_MID[b];
  const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
  const side = (ref[0] - p1[0]) * -dy + (ref[1] - p1[1]) * dx; // > 0 → ref on the right
  const wantRight = refInside;
  return (side > 0) === wantRight ? [a, b] : [b, a];
}

// Segment tables, inside (>= level) kept on the right-hand side.
const MS_TABLE: [EdgeName, EdgeName][][] = [];
const MS_SADDLE: [EdgeName, EdgeName][][][] = []; // [idx][centerInside]
(function buildTables() {
  for (let idx = 0; idx < 16; idx++) {
    const inside = [0, 1, 2, 3].filter((c) => idx & (1 << c));
    const outside = [0, 1, 2, 3].filter((c) => !(idx & (1 << c)));
    const segs: [EdgeName, EdgeName][] = [];
    if (idx === 0 || idx === 15) {
      MS_TABLE[idx] = segs;
      continue;
    }
    if (idx === 5 || idx === 10) {
      const make = (corners: number[], refInside: boolean) =>
        corners.map((c) => orientSegment(CORNER_EDGES[c][0], CORNER_EDGES[c][1], CORNER_PT[c], refInside));
      MS_SADDLE[idx] = [make(inside, true), make(outside, false)];
      MS_TABLE[idx] = [];
      continue;
    }
    if (inside.length === 1) {
      const c = inside[0];
      segs.push(orientSegment(CORNER_EDGES[c][0], CORNER_EDGES[c][1], CORNER_PT[c], true));
    } else if (inside.length === 3) {
      const c = outside[0];
      segs.push(orientSegment(CORNER_EDGES[c][0], CORNER_EDGES[c][1], CORNER_PT[c], false));
    } else {
      // two adjacent inside corners → segment joins the two opposite edges
      const c = inside[0];
      const horizontal = (idx === 3 || idx === 12); // inside pair shares a top/bottom side
      segs.push(orientSegment(horizontal ? 3 : 0, horizontal ? 1 : 2, CORNER_PT[c], true));
    }
    MS_TABLE[idx] = segs;
  }
})();

/** Returns closed loops as flat [x0,y0,x1,y1,…] in node coordinates. */
function marchingSquares(fld: Field, level: number): Float64Array[] {
  const { f, W, H } = fld;
  const vOff = W * H;
  const next = new Map<number, number>();
  const edgeId = (name: EdgeName, x: number, y: number) =>
    name === 0 ? y * W + x : name === 2 ? (y + 1) * W + x : name === 3 ? vOff + y * W + x : vOff + y * W + x + 1;

  for (let y = 0; y < H - 1; y++) {
    for (let x = 0; x < W - 1; x++) {
      const tl = f[y * W + x], tr = f[y * W + x + 1], br = f[(y + 1) * W + x + 1], bl = f[(y + 1) * W + x];
      const idx = (tl >= level ? 1 : 0) | (tr >= level ? 2 : 0) | (br >= level ? 4 : 0) | (bl >= level ? 8 : 0);
      if (idx === 0 || idx === 15) continue;
      let segs: [EdgeName, EdgeName][];
      if (idx === 5 || idx === 10) {
        // [0] = inside corners are isolated (centre is outside), [1] = inside is connected
        const centerInside = (tl + tr + br + bl) / 4 >= level ? 1 : 0;
        segs = MS_SADDLE[idx][centerInside];
      } else {
        segs = MS_TABLE[idx];
      }
      for (const [a, b] of segs) next.set(edgeId(a, x, y), edgeId(b, x, y));
    }
  }

  const point = (id: number, out: number[]) => {
    if (id < vOff) {
      const y = Math.floor(id / W), x = id - y * W;
      const a = f[y * W + x], b = f[y * W + x + 1];
      out.push(x + (level - a) / (b - a), y);
    } else {
      const k = id - vOff;
      const y = Math.floor(k / W), x = k - y * W;
      const a = f[y * W + x], b = f[(y + 1) * W + x];
      out.push(x, y + (level - a) / (b - a));
    }
  };

  const loops: Float64Array[] = [];
  const seen = new Set<number>();
  for (const start of next.keys()) {
    if (seen.has(start)) continue;
    const pts: number[] = [];
    let cur: number | undefined = start;
    let closed = false;
    while (cur !== undefined && !seen.has(cur)) {
      seen.add(cur);
      point(cur, pts);
      cur = next.get(cur);
      if (cur === start) { closed = true; break; }
    }
    if (closed && pts.length >= 12) loops.push(Float64Array.from(pts));
  }
  return loops;
}

/* -------------------------------------------------------------------------- */
/*  6. Corner detection + Bézier fitting (Schneider)                          */
/* -------------------------------------------------------------------------- */

interface Pt { x: number; y: number }
interface Bez { p0: Pt; p1: Pt; p2: Pt; p3: Pt }

const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a: Pt, s: number): Pt => ({ x: a.x * s, y: a.y * s });
const dot = (a: Pt, b: Pt) => a.x * b.x + a.y * b.y;
const len = (a: Pt) => Math.hypot(a.x, a.y);
const norm = (a: Pt): Pt => { const l = len(a) || 1; return { x: a.x / l, y: a.y / l }; };

function bezierAt(b: Bez, t: number): Pt {
  const mt = 1 - t;
  const a = mt * mt * mt, bb = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t;
  return {
    x: a * b.p0.x + bb * b.p1.x + c * b.p2.x + d * b.p3.x,
    y: a * b.p0.y + bb * b.p1.y + c * b.p2.y + d * b.p3.y,
  };
}

function bezierD1(b: Bez, t: number): Pt {
  const mt = 1 - t;
  return {
    x: 3 * mt * mt * (b.p1.x - b.p0.x) + 6 * mt * t * (b.p2.x - b.p1.x) + 3 * t * t * (b.p3.x - b.p2.x),
    y: 3 * mt * mt * (b.p1.y - b.p0.y) + 6 * mt * t * (b.p2.y - b.p1.y) + 3 * t * t * (b.p3.y - b.p2.y),
  };
}

function bezierD2(b: Bez, t: number): Pt {
  const mt = 1 - t;
  return {
    x: 6 * mt * (b.p2.x - 2 * b.p1.x + b.p0.x) + 6 * t * (b.p3.x - 2 * b.p2.x + b.p1.x),
    y: 6 * mt * (b.p2.y - 2 * b.p1.y + b.p0.y) + 6 * t * (b.p3.y - 2 * b.p2.y + b.p1.y),
  };
}

function chordParams(d: Pt[], first: number, last: number): number[] {
  const u = [0];
  for (let i = first + 1; i <= last; i++) u.push(u[i - first - 1] + len(sub(d[i], d[i - 1])));
  const total = u[u.length - 1] || 1;
  for (let i = 1; i < u.length; i++) u[i] /= total;
  return u;
}

function generateBezier(d: Pt[], first: number, last: number, u: number[], t1: Pt, t2: Pt): Bez {
  const n = last - first + 1;
  const p0 = d[first], p3 = d[last];
  let c00 = 0, c01 = 0, c11 = 0, x0 = 0, x1 = 0;
  for (let i = 0; i < n; i++) {
    const t = u[i], mt = 1 - t;
    const b0 = mt * mt * mt, b1 = 3 * mt * mt * t, b2 = 3 * mt * t * t, b3 = t * t * t;
    const a1 = mul(t1, b1), a2 = mul(t2, b2);
    c00 += dot(a1, a1);
    c01 += dot(a1, a2);
    c11 += dot(a2, a2);
    const tmp = sub(d[first + i], add(mul(p0, b0 + b1), mul(p3, b2 + b3)));
    x0 += dot(a1, tmp);
    x1 += dot(a2, tmp);
  }
  const det = c00 * c11 - c01 * c01;
  let alphaL: number, alphaR: number;
  if (Math.abs(det) > 1e-12) {
    alphaL = (x0 * c11 - x1 * c01) / det;
    alphaR = (c00 * x1 - c01 * x0) / det;
  } else {
    alphaL = alphaR = 0;
  }
  const seg = len(sub(p3, p0));
  const eps = 1e-6 * seg;
  if (alphaL < eps || alphaR < eps || alphaL > seg * 2.5 || alphaR > seg * 2.5) {
    alphaL = alphaR = seg / 3;
  }
  return { p0, p1: add(p0, mul(t1, alphaL)), p2: add(p3, mul(t2, alphaR)), p3 };
}

function newtonReparam(b: Bez, pts: Pt[], first: number, u: number[]): number[] {
  return u.map((t, i) => {
    const p = pts[first + i];
    const q = bezierAt(b, t);
    const q1 = bezierD1(b, t);
    const q2 = bezierD2(b, t);
    const num = (q.x - p.x) * q1.x + (q.y - p.y) * q1.y;
    const den = q1.x * q1.x + q1.y * q1.y + (q.x - p.x) * q2.x + (q.y - p.y) * q2.y;
    if (Math.abs(den) < 1e-12) return t;
    return clamp(t - num / den, 0, 1);
  });
}

function maxError(d: Pt[], first: number, last: number, b: Bez, u: number[]): { err: number; split: number } {
  let split = Math.floor((last - first + 1) / 2) + first;
  let maxD = 0;
  for (let i = first + 1; i < last; i++) {
    const p = bezierAt(b, u[i - first]);
    const v = sub(p, d[i]);
    const dist = v.x * v.x + v.y * v.y;
    if (dist >= maxD) { maxD = dist; split = i; }
  }
  return { err: maxD, split };
}

function centerTangent(d: Pt[], c: number): Pt {
  const v1 = sub(d[c - 1], d[c]);
  const v2 = sub(d[c], d[c + 1]);
  return norm({ x: (v1.x + v2.x) / 2, y: (v1.y + v2.y) / 2 });
}

function fitCubic(d: Pt[], first: number, last: number, t1: Pt, t2: Pt, error: number, out: Bez[], depth = 0) {
  const n = last - first + 1;
  if (n === 2) {
    const dist = len(sub(d[last], d[first])) / 3;
    out.push({ p0: d[first], p1: add(d[first], mul(t1, dist)), p2: add(d[last], mul(t2, dist)), p3: d[last] });
    return;
  }
  let u = chordParams(d, first, last);
  let bez = generateBezier(d, first, last, u, t1, t2);
  let { err, split } = maxError(d, first, last, bez, u);
  const e2 = error * error;
  if (err < e2) { out.push(bez); return; }
  if (err < e2 * 16) {
    for (let i = 0; i < 5; i++) {
      u = newtonReparam(bez, d, first, u);
      bez = generateBezier(d, first, last, u, t1, t2);
      ({ err, split } = maxError(d, first, last, bez, u));
      if (err < e2) { out.push(bez); return; }
    }
  }
  if (depth > 24 || split <= first || split >= last) { out.push(bez); return; }
  const tc = centerTangent(d, split);
  fitCubic(d, first, split, t1, tc, error, out, depth + 1);
  fitCubic(d, split, last, mul(tc, -1), t2, error, out, depth + 1);
}

function fitOpen(pts: Pt[], error: number): Bez[] {
  if (pts.length < 2) return [];
  const k = Math.min(3, pts.length - 1);
  const t1 = norm(sub(pts[k], pts[0]));
  const t2 = norm(sub(pts[pts.length - 1 - k], pts[pts.length - 1]));
  const out: Bez[] = [];
  fitCubic(pts, 0, pts.length - 1, t1, t2, error, out);
  return out;
}

function maxLineDeviation(pts: Pt[], a: Pt, b: Pt): number {
  const ab = sub(b, a);
  const l = len(ab);
  if (l < 1e-9) return Infinity;
  let m = 0;
  for (const p of pts) {
    const dev = Math.abs((p.x - a.x) * ab.y - (p.y - a.y) * ab.x) / l;
    if (dev > m) m = dev;
  }
  return m;
}

function turnAngle(pts: Pt[], i: number, w: number): number {
  const n = pts.length;
  const a = pts[(i - w + n * 4) % n], b = pts[i], c = pts[(i + w) % n];
  const v1 = sub(b, a), v2 = sub(c, b);
  const l1 = len(v1), l2 = len(v2);
  if (l1 < 1e-9 || l2 < 1e-9) return 0;
  return Math.acos(clamp(dot(v1, v2) / (l1 * l2), -1, 1));
}

interface CornerInfo { index: number; point: Pt; refined: boolean }

function detectCorners(pts: Pt[], w: number, thetaRad: number): CornerInfo[] {
  const n = pts.length;
  const W1 = w * 2; // measuring window (longer than the blur radius, so rounded corners still register)
  const W2 = w * 4; // control window: an arc doubles its turn here, a true corner does not
  if (n < W2 * 3) return [];
  const turn1 = new Float64Array(n);
  const turn2 = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    turn1[i] = turnAngle(pts, i, W1);
    turn2[i] = turnAngle(pts, i, W2);
  }
  const cands: number[] = [];
  for (let i = 0; i < n; i++) {
    if (turn1[i] < thetaRad) continue;
    if (turn2[i] > turn1[i] * 1.6) continue;
    let isMax = true;
    for (let t = -W1; t <= W1 && isMax; t++) {
      if (t === 0) continue;
      const j = (i + t + n) % n;
      if (turn1[j] > turn1[i] || (turn1[j] === turn1[i] && t < 0)) isMax = false;
    }
    if (isMax) cands.push(i);
  }
  const corners: CornerInfo[] = cands.map((i) => ({ index: i, point: pts[i], refined: false }));
  // Refine by intersecting the two straight edges that meet at the corner.
  for (let c = 0; c < corners.length; c++) {
    const prev = corners[(c - 1 + corners.length) % corners.length].index;
    const nextI = corners[(c + 1) % corners.length].index;
    const i = corners[c].index;
    const distBack = corners.length === 1 ? n : (i - prev + n) % n || n;
    const distFwd = corners.length === 1 ? n : (nextI - i + n) % n || n;
    const reachBack = Math.min(4 * w, Math.floor(distBack / 2));
    const reachFwd = Math.min(4 * w, Math.floor(distFwd / 2));
    if (reachBack <= w * 1.5 || reachFwd <= w * 1.5) continue;
    const near = Math.round(w * 1.2);
    const q1 = pts[(i - near + n) % n], f1 = pts[(i - reachBack + n) % n];
    const q2 = pts[(i + near) % n], f2 = pts[(i + reachFwd) % n];
    const d1 = sub(q1, f1), d2 = sub(f2, q2);
    const cross = d1.x * d2.y - d1.y * d2.x;
    if (Math.abs(cross) < 1e-6 * len(d1) * len(d2)) continue;
    const diff = sub(q2, q1);
    const t = (diff.x * d2.y - diff.y * d2.x) / cross;
    const X = add(q1, mul(d1, t));
    if (len(sub(X, pts[i])) <= 4 * w) {
      corners[c].point = X;
      corners[c].refined = true;
    }
  }
  return corners;
}

type OutSeg = { type: 'L'; to: Pt } | { type: 'C'; c1: Pt; c2: Pt; to: Pt };

/** Turns one dense closed polyline into [start, segments…] (implicitly closed). */
function fitClosedLoop(pts: Pt[], errUp: number, cornerWin: number, thetaRad: number): { start: Pt; segs: OutSeg[] } | null {
  const n = pts.length;
  if (n < 4) return null;
  const corners = detectCorners(pts, cornerWin, thetaRad);
  const segs: OutSeg[] = [];
  const emit = (stretch: Pt[]) => {
    if (stretch.length < 2) return;
    const a = stretch[0], b = stretch[stretch.length - 1];
    if (len(sub(b, a)) < 1e-6) {
      // A loop with a single corner starts and ends on the same point. Split it
      // in the middle so both halves are fitted (otherwise the whole loop — for
      // example a tick-shaped hole inside a badge — silently disappears).
      if (stretch.length >= 6) {
        const mid = Math.floor(stretch.length / 2);
        emit(stretch.slice(0, mid + 1));
        emit(stretch.slice(mid));
      }
      return;
    }
    if (stretch.length <= 3 || maxLineDeviation(stretch, a, b) <= errUp * 0.55) {
      segs.push({ type: 'L', to: b });
      return;
    }
    for (const bz of fitOpen(stretch, errUp)) segs.push({ type: 'C', c1: bz.p1, c2: bz.p2, to: bz.p3 });
  };

  if (corners.length === 0) {
    // Smooth closed loop: fit once with periodic end tangents.
    const loop = [...pts, pts[0]];
    const k = Math.min(3, n - 1);
    const tan = norm(sub(pts[k % n], pts[(n - k) % n]));
    const out: Bez[] = [];
    fitCubic(loop, 0, loop.length - 1, tan, mul(tan, -1), errUp, out);
    for (const bz of out) segs.push({ type: 'C', c1: bz.p1, c2: bz.p2, to: bz.p3 });
    return { start: pts[0], segs };
  }

  const m = corners.length;
  for (let c = 0; c < m; c++) {
    const a = corners[c], b = corners[(c + 1) % m];
    const span = m === 1 ? n : (b.index - a.index + n) % n || n;
    const skip = Math.round(cornerWin * 1.4);
    const skipA = a.refined ? skip : 0;
    const skipB = b.refined ? skip : 0;
    const stretch: Pt[] = [a.point];
    for (let t = skipA + 1; t < span - skipB; t++) stretch.push(pts[(a.index + t) % n]);
    stretch.push(b.point);
    emit(stretch);
  }
  // Safety net: never lose a contour. If corner handling produced nothing,
  // trace the loop as a smooth closed curve instead.
  if (!segs.length) return fitClosedLoop(pts, errUp, Number.MAX_SAFE_INTEGER, thetaRad);
  return { start: corners[0].point, segs: simplifySegments(corners[0].point, segs, errUp) };
}

/**
 * Clean-up pass for the corner-preserving branch:
 *   1. a cubic whose control points hug its chord is really a straight edge → `L`
 *   2. consecutive, (nearly) collinear `L` runs collapse into a single line
 * This removes the redundant nodes that make traced icons look "lumpy" in an
 * editor and keeps straight edges (squares, stars, arrows) perfectly straight.
 */
function simplifySegments(start: Pt, segs: OutSeg[], errUp: number): OutSeg[] {
  const flatTol = errUp * 0.6;
  const pointLineDist = (p: Pt, a: Pt, b: Pt) => {
    const ab = sub(b, a);
    const l = len(ab);
    return l < 1e-9 ? len(sub(p, a)) : Math.abs((p.x - a.x) * ab.y - (p.y - a.y) * ab.x) / l;
  };

  // 1. flat cubics → lines
  let prev = start;
  const flattened: OutSeg[] = segs.map((sg) => {
    const from = prev;
    prev = sg.to;
    if (sg.type === 'C' && len(sub(sg.to, from)) > 1e-6
      && pointLineDist(sg.c1, from, sg.to) <= flatTol
      && pointLineDist(sg.c2, from, sg.to) <= flatTol
      && dot(sub(sg.c1, from), sub(sg.to, from)) >= 0
      && dot(sub(sg.to, sg.c2), sub(sg.to, from)) >= 0) {
      return { type: 'L', to: sg.to } as OutSeg;
    }
    return sg;
  });

  // 2. merge collinear line runs
  const out: OutSeg[] = [];
  for (const sg of flattened) {
    const last = out[out.length - 1];
    if (sg.type === 'L' && last && last.type === 'L') {
      const lastFrom = out.length >= 2 ? out[out.length - 2].to : start;
      const d1 = norm(sub(last.to, lastFrom));
      const d2 = norm(sub(sg.to, last.to));
      const cos = dot(d1, d2);
      if (cos > 0.9995 && pointLineDist(last.to, lastFrom, sg.to) <= flatTol) {
        out[out.length - 1] = { type: 'L', to: sg.to };
        continue;
      }
    }
    out.push(sg);
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  7. Contours → VectorPaths                                                 */
/* -------------------------------------------------------------------------- */

function signedArea(p: Pt[]): number {
  let a = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j].x + p[i].x) * (p[i].y - p[j].y);
  return a / 2;
}

function pointInPoly(pt: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

interface TraceParams {
  s: number;
  errUp: number;
  cornerWin: number;
  thetaRad: number;
  minAreaUp: number;
}

function contoursToPaths(
  loops: Float64Array[],
  params: TraceParams,
  toSource: (p: Pt) => Pt,
  fillColor: string
): VectorPath[] {
  // dense polylines (node space)
  const polys: Pt[][] = [];
  for (const l of loops) {
    const pts: Pt[] = [];
    for (let i = 0; i < l.length; i += 2) {
      const p = { x: l[i], y: l[i + 1] };
      const prev = pts[pts.length - 1];
      if (!prev || Math.abs(prev.x - p.x) > 1e-4 || Math.abs(prev.y - p.y) > 1e-4) pts.push(p);
    }
    if (pts.length >= 4) polys.push(pts);
  }
  if (!polys.length) return [];

  const areas = polys.map(signedArea);
  let bigIdx = 0;
  for (let i = 1; i < polys.length; i++) if (Math.abs(areas[i]) > Math.abs(areas[bigIdx])) bigIdx = i;
  const outerSign = Math.sign(areas[bigIdx]) || 1;

  const keep = polys.map((_, i) => Math.abs(areas[i]) >= params.minAreaUp);
  const outers: number[] = [];
  const holes: number[] = [];
  polys.forEach((_, i) => {
    if (!keep[i]) return;
    (Math.sign(areas[i]) === outerSign ? outers : holes).push(i);
  });

  const holesOf = new Map<number, number[]>();
  for (const h of holes) {
    let parent = -1, parentArea = Infinity;
    for (const o of outers) {
      if (Math.abs(areas[o]) <= Math.abs(areas[h])) continue;
      if (Math.abs(areas[o]) >= parentArea) continue;
      if (pointInPoly(polys[h][0], polys[o])) { parent = o; parentArea = Math.abs(areas[o]); }
    }
    if (parent >= 0) {
      if (!holesOf.has(parent)) holesOf.set(parent, []);
      holesOf.get(parent)!.push(h);
    }
  }

  const result: VectorPath[] = [];
  for (const o of outers) {
    const members = [o, ...(holesOf.get(o) || [])];
    const segments: RawPathSegment[] = [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const idx of members) {
      const fit = fitClosedLoop(polys[idx], params.errUp, params.cornerWin, params.thetaRad);
      if (!fit || !fit.segs.length) continue;
      const s0 = toSource(fit.start);
      segments.push({ type: 'M', args: [s0.x, s0.y] });
      for (const sg of fit.segs) {
        if (sg.type === 'L') {
          const t = toSource(sg.to);
          segments.push({ type: 'L', args: [t.x, t.y] });
        } else {
          const a = toSource(sg.c1), b = toSource(sg.c2), t = toSource(sg.to);
          segments.push({ type: 'C', args: [a.x, a.y, b.x, b.y, t.x, t.y] });
        }
      }
      segments.push({ type: 'Z', args: [] });
      if (idx === o) {
        for (const p of polys[idx]) {
          const q = toSource(p);
          if (q.x < minX) minX = q.x;
          if (q.x > maxX) maxX = q.x;
          if (q.y < minY) minY = q.y;
          if (q.y > maxY) maxY = q.y;
        }
      }
    }
    if (!segments.length || !isFinite(minX)) continue;
    result.push({
      segments,
      fillColor,
      fillRule: 'evenodd',
      isClosed: true,
      hasFill: true,
      hasStroke: false,
      bbox: { minX, minY, maxX, maxY },
    });
  }
  return result;
}

/* -------------------------------------------------------------------------- */
/*  8. Main pipeline                                                          */
/* -------------------------------------------------------------------------- */

export interface SlicePiece {
  index: number;
  /** In source-image pixels. */
  bbox: BoundingBox;
  /** Ink pixels, handy for sorting out specks. */
  ink: number;
}

interface SessionState {
  img: RasterInput;
  opt: TraceOptions;
  an: Analysis;
  ink: Float32Array;
  comps: Components;
  groups: Group[];
  groupOf: Int32Array;
  palette: Palette | null;
  level: number;
  minArea: number;
  sigmaSrc: number;
  errSrc: number;
  thetaRad: number;
}

/** Result of stage 1 (slicing). Pass it to `traceSession` for stage 2. */
export interface TraceSession {
  width: number;
  height: number;
  pieces: SlicePiece[];
  info: TraceResult['info'];
  /** @internal */
  state: SessionState;
}

export async function prepareSlices(
  img: RasterInput,
  options: Partial<TraceOptions> = {},
  onProgress?: TraceProgress
): Promise<TraceSession> {
  const opt: TraceOptions = { ...DEFAULT_TRACE_OPTIONS, ...options };
  const { width: w, height: h } = img;
  if (w < 8 || h < 8) throw new Error('This image is too small to trace.');

  onProgress?.('Detecting background and artwork…', 4);
  const an = analyze(img, opt.background);
  const { d, fgRef } = an;
  const n = w * h;
  const multicolor = opt.mode === 'multicolor';

  const pct = opt.threshold == null ? 50 : clamp(opt.threshold, 5, 95);
  const level = pct / 100;

  // Normalised coverage: 1 = full ink.
  const ink = new Float32Array(n);
  for (let i = 0; i < n; i++) ink[i] = Math.min(1, d[i] / fgRef);

  let palette: Palette | null = null;
  if (multicolor) {
    onProgress?.('Extracting colours…', 8);
    await yieldToUI();
    palette = buildPalette(img, an, opt.colors);
  }

  // Foreground mask → pieces.
  onProgress?.('Finding separate pieces of artwork…', 12);
  const mask = new Uint8Array(n);
  if (palette) {
    for (let i = 0; i < n; i++) mask[i] = palette.labels[i] > 0 ? 1 : 0;
  } else {
    const thr = level * 0.7;
    for (let i = 0; i < n; i++) mask[i] = ink[i] >= thr ? 1 : 0;
  }
  const comps = labelComponents(mask, w, h);
  const minArea = opt.noise == null ? Math.max(4, Math.round((n / 1_000_000) * 2)) : Math.max(1, Math.round(opt.noise));

  let ids: number[] = [];
  for (let id = 1; id <= comps.count; id++) if (comps.area[id] >= minArea) ids.push(id);
  const rawPieces = ids.length;

  // Table / frame lines that wrap many icons would glue everything together.
  if (ids.length > 3) {
    const bigFrame = ids.filter((id) => {
      const bw = comps.maxX[id] - comps.minX[id] + 1, bh = comps.maxY[id] - comps.minY[id] + 1;
      return bw * bh > n * 0.35 && comps.area[id] / (bw * bh) < 0.2;
    });
    if (bigFrame.length && ids.length - bigFrame.length >= 2) {
      const drop = new Set(bigFrame);
      ids = ids.filter((id) => !drop.has(id));
    }
  }
  if (!ids.length) throw new Error('No artwork was found on this image. Try a different threshold or background.');

  ids.sort((a, b) => comps.minX[a] - comps.minX[b]);
  onProgress?.('Slicing the sheet into icons…', 18);
  let gap = 0;
  const groups: Group[] = [];
  if (opt.grouping == null) {
    for (const cell of sliceAuto(ids, comps)) {
      const b = idsBox(cell, comps);
      groups.push({ ids: cell, minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY });
    }
  } else {
    gap = Math.max(0, Math.round(opt.grouping));
    const roots = groupComponents(ids, comps, gap);
    const byRoot = new Map<number, Group>();
    ids.forEach((id, i) => {
      const r = roots[i];
      let g = byRoot.get(r);
      if (!g) { g = { ids: [], minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }; byRoot.set(r, g); }
      g.ids.push(id);
      g.minX = Math.min(g.minX, comps.minX[id]);
      g.minY = Math.min(g.minY, comps.minY[id]);
      g.maxX = Math.max(g.maxX, comps.maxX[id]);
      g.maxY = Math.max(g.maxY, comps.maxY[id]);
    });
    groups.push(...byRoot.values());
  }
  const ordered = orderGroups(groups);

  const groupOf = new Int32Array(comps.count + 1);
  ordered.forEach((g, gi) => g.ids.forEach((id) => { groupOf[id] = gi + 1; }));

  // Tuning derived from the sliders.
  const sm = clamp(opt.smoothness, 0, 100) / 100;
  const cn = clamp(opt.corners, 0, 100) / 100;
  const sigmaSrc = lerp(0.3, 1.1, sm);
  const errSrc = lerp(0.07, 0.6, sm);
  const thetaRad = (lerp(75, 30, cn) * Math.PI) / 180;

  const pieces: SlicePiece[] = ordered.map((g, gi) => {
    let inkPx = 0;
    for (const id of g.ids) inkPx += comps.area[id];
    return {
      index: gi,
      bbox: { x: g.minX, y: g.minY, width: g.maxX - g.minX + 1, height: g.maxY - g.minY + 1 },
      ink: inkPx,
    };
  });
  onProgress?.(`${pieces.length} icons found`, 100);

  return {
    width: w,
    height: h,
    pieces,
    info: { background: toHex(an.bg[0], an.bg[1], an.bg[2]), groupingGap: gap, detail: 0, rawPieces },
    state: { img, opt, an, ink, comps, groups: ordered, groupOf, palette, level, minArea, sigmaSrc, errSrc, thetaRad },
  };
}

/**
 * Stage 2: trace the chosen pieces (default: all). Pieces are traced one by
 * one so the caller can show progress and stop at any time.
 */
export async function traceSession(
  session: TraceSession,
  pieceIndexes?: number[],
  onProgress?: TraceProgress,
  signal?: AbortSignal,
  range: [number, number] = [0, 100]
): Promise<TraceResult> {
  const { img, opt, ink, comps, groups, groupOf, palette, level, minArea, sigmaSrc, errSrc, thetaRad } = session.state;
  const { width: w, height: h } = img;
  const targets = (pieceIndexes ?? groups.map((_, i) => i)).filter((i) => i >= 0 && i < groups.length);
  if (!targets.length) throw new Error('Select at least one icon to vectorize.');

  const icons: TracedIcon[] = [];
  let usedDetail = 1;

  for (let t = 0; t < targets.length; t++) {
    const gi = targets[t];
    const g = groups[gi];
    const pad = 4;
    const x0 = Math.max(0, g.minX - pad), y0 = Math.max(0, g.minY - pad);
    const x1 = Math.min(w, g.maxX + 1 + pad), y1 = Math.min(h, g.maxY + 1 + pad);
    const cw = x1 - x0, ch = y1 - y0;
    const maxDim = Math.max(g.maxX - g.minX + 1, g.maxY - g.minY + 1);
    const s = opt.detail > 0 ? opt.detail : maxDim >= 700 ? 1 : maxDim >= 350 ? 2 : maxDim >= 180 ? 3 : 4;
    usedDetail = Math.max(usedDetail, s);

    // membership = this group's pixels, dilated so the anti-aliased fringe stays
    const member = new Uint8Array(cw * ch);
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const lb = comps.labels[(y0 + y) * w + x0 + x];
        if (lb && groupOf[lb] === gi + 1) member[y * cw + x] = 1;
      }
    }
    const dil = new Uint8Array(cw * ch);
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        let on = 0;
        for (let dy = -2; dy <= 2 && !on; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= ch) continue;
          for (let dx = -2; dx <= 2; dx++) {
            const xx = x + dx;
            if (xx >= 0 && xx < cw && member[yy * cw + xx]) { on = 1; break; }
          }
        }
        dil[y * cw + x] = on;
      }
    }

    const params: TraceParams = {
      s,
      errUp: errSrc * s,
      cornerWin: Math.max(3, Math.round((0.9 + sigmaSrc * 1.6) * s)),
      thetaRad,
      minAreaUp: Math.max(1, minArea * 0.5) * s * s,
    };
    const toSource = (p: Pt): Pt => ({ x: x0 + (p.x - 0.5) / s, y: y0 + (p.y - 0.5) / s });

    const paths: VectorPath[] = [];

    if (palette) {
      // One layer per colour, big areas first so details overprint them.
      const layerAreas = new Map<number, number>();
      for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
          if (!member[y * cw + x]) continue;
          const lb = palette.labels[(y0 + y) * w + x0 + x];
          if (lb) layerAreas.set(lb, (layerAreas.get(lb) || 0) + 1);
        }
      }
      const layerOrder = [...layerAreas.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]);
      for (const lb of layerOrder) {
        const src = new Float32Array(cw * ch);
        for (let y = 0; y < ch; y++) {
          for (let x = 0; x < cw; x++) {
            const ci = y * cw + x;
            if (!dil[ci]) continue;
            const gi2 = (y0 + y) * w + x0 + x;
            if (palette.labels[gi2] === lb) src[ci] = palette.alpha[gi2];
          }
        }
        const fld = buildField(src, cw, ch, s, sigmaSrc * s);
        const loops = marchingSquares(fld, 0.42); // slightly generous so layers overlap, no seams
        const c = palette.colors[lb - 1];
        paths.push(...contoursToPaths(loops, params, toSource, rgbString(c[0], c[1], c[2])));
      }
    } else {
      const src = new Float32Array(cw * ch);
      let sr = 0, sg = 0, sb = 0, sc = 0;
      for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
          const ci = y * cw + x;
          if (!dil[ci]) continue;
          const gi2 = (y0 + y) * w + x0 + x;
          src[ci] = ink[gi2];
          if (opt.fill == null && ink[gi2] > 0.92) {
            const p = gi2 * 4;
            sr += img.data[p]; sg += img.data[p + 1]; sb += img.data[p + 2]; sc++;
          }
        }
      }
      const fld = buildField(src, cw, ch, s, sigmaSrc * s);
      const loops = marchingSquares(fld, level);
      const color = opt.fill != null ? hexToRgbString(opt.fill) : sc ? rgbString(sr / sc, sg / sc, sb / sc) : 'rgb(0, 0, 0)';
      paths.push(...contoursToPaths(loops, params, toSource, color));
    }

    if (paths.length) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of paths) {
        minX = Math.min(minX, p.bbox.minX); minY = Math.min(minY, p.bbox.minY);
        maxX = Math.max(maxX, p.bbox.maxX); maxY = Math.max(maxY, p.bbox.maxY);
      }
      icons.push({
        index: icons.length + 1,
        bbox: { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) },
        paths,
      });
    }

    if (signal?.aborted) throw new DOMException('Vectorizing was stopped.', 'AbortError');
    const frac = (t + 1) / targets.length;
    onProgress?.(`Tracing icon ${t + 1} of ${targets.length}…`, Math.round(range[0] + frac * (range[1] - range[0])), { done: t + 1, total: targets.length });
    await yieldToUI();
  }

  if (!icons.length) throw new Error('Nothing could be traced. Try lowering the noise filter or changing the threshold.');
  onProgress?.(`${icons.length} icons traced`, range[1], { done: icons.length, total: targets.length });

  return {
    width: w,
    height: h,
    icons,
    info: { ...session.info, detail: usedDetail },
  };
}


export async function vectorizeRaster(
  img: RasterInput,
  options: Partial<TraceOptions> = {},
  onProgress?: TraceProgress
): Promise<TraceResult> {
  const session = await prepareSlices(img, options, (m, p) => onProgress?.(m, Math.round(p * 0.2)));
  return traceSession(session, undefined, onProgress, undefined, [20, 100]);
}

/* -------------------------------------------------------------------------- */
/*  Slice helpers: thumbnails, text-like pieces, duplicates                    */
/* -------------------------------------------------------------------------- */

/** Pieces much bigger than the typical icon are almost always a title or caption. */
export function findTextLikePieces(session: TraceSession): number[] {
  const sizes = session.pieces.map((p) => Math.max(p.bbox.width, p.bbox.height)).sort((a, b) => a - b);
  if (sizes.length < 4) return [];
  const median = sizes[Math.floor(sizes.length / 2)];
  return session.pieces
    .filter((p) => {
      const longest = Math.max(p.bbox.width, p.bbox.height);
      const aspect = p.bbox.width / Math.max(1, p.bbox.height);
      return longest > median * 2 || aspect > 3 || aspect < 1 / 3;
    })
    .map((p) => p.index);
}

function pieceMask(session: TraceSession, index: number, size: number): Uint8Array {
  const { comps, groupOf, ink } = session.state;
  const { width: w } = session.state.img;
  const b = session.pieces[index].bbox;
  const x0 = Math.floor(b.x), y0 = Math.floor(b.y);
  const bw = Math.ceil(b.width), bh = Math.ceil(b.height);
  const side = Math.max(bw, bh);
  const out = new Uint8Array(size * size);
  const hit = new Float32Array(size * size);
  const ox = (side - bw) / 2, oy = (side - bh) / 2;
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const i = (y0 + y) * w + x0 + x;
      const lb = comps.labels[i];
      if (!lb || groupOf[lb] !== index + 1) continue;
      const cx = Math.min(size - 1, Math.floor(((x + ox) / side) * size));
      const cy = Math.min(size - 1, Math.floor(((y + oy) / side) * size));
      hit[cy * size + cx] += ink[i];
    }
  }
  const cellArea = (side / size) * (side / size);
  for (let i = 0; i < out.length; i++) out[i] = hit[i] / cellArea > 0.3 ? 1 : 0;
  return out;
}

/** Groups of piece indexes that look identical (same shape, any size). */
export function findDuplicatePieces(session: TraceSession): number[][] {
  const size = 24;
  const masks = session.pieces.map((p) => pieceMask(session, p.index, size));
  const seen = new Set<number>();
  const groups: number[][] = [];
  for (let i = 0; i < masks.length; i++) {
    if (seen.has(i)) continue;
    const group = [i];
    for (let j = i + 1; j < masks.length; j++) {
      if (seen.has(j)) continue;
      const a = session.pieces[i].bbox, b = session.pieces[j].bbox;
      const ra = a.width / a.height, rb = b.width / b.height;
      if (Math.abs(Math.log(ra / rb)) > 0.15) continue;
      let inter = 0, union = 0;
      for (let k = 0; k < masks[i].length; k++) {
        const x = masks[i][k], y = masks[j][k];
        if (x && y) inter++;
        if (x || y) union++;
      }
      if (union > 0 && inter / union >= 0.9) group.push(j);
    }
    if (group.length > 1) { group.forEach((g) => seen.add(g)); groups.push(group); }
  }
  return groups;
}

/** Small PNG crops of each piece (artwork only, on the sheet background). Browser only. */
export function renderPieceThumbnails(session: TraceSession, maxSize = 160): string[] {
  const { img, an, comps, groupOf } = session.state;
  const { width: w } = img;
  const [br, bg, bb] = an.bg;
  return session.pieces.map((piece) => {
    const b = piece.bbox;
    const pad = 6;
    const x0 = Math.max(0, Math.floor(b.x) - pad), y0 = Math.max(0, Math.floor(b.y) - pad);
    const x1 = Math.min(img.width, Math.ceil(b.x + b.width) + pad), y1 = Math.min(img.height, Math.ceil(b.y + b.height) + pad);
    const cw = x1 - x0, ch = y1 - y0;
    const full = document.createElement('canvas');
    full.width = cw; full.height = ch;
    const fctx = full.getContext('2d');
    if (!fctx) return '';
    const data = fctx.createImageData(cw, ch);
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const gi = (y0 + y) * w + x0 + x;
        const o = (y * cw + x) * 4;
        // keep anti-aliased fringe: show original pixel next to this piece's ink, background elsewhere
        let mine = false;
        for (let dy = -2; dy <= 2 && !mine; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const yy = y0 + y + dy, xx = x0 + x + dx;
            if (yy < 0 || xx < 0 || yy >= img.height || xx >= w) continue;
            const lb = comps.labels[yy * w + xx];
            if (lb && groupOf[lb] === piece.index + 1) { mine = true; break; }
          }
        }
        if (mine) {
          data.data[o] = img.data[gi * 4]; data.data[o + 1] = img.data[gi * 4 + 1]; data.data[o + 2] = img.data[gi * 4 + 2];
        } else {
          data.data[o] = br; data.data[o + 1] = bg; data.data[o + 2] = bb;
        }
        data.data[o + 3] = 255;
      }
    }
    fctx.putImageData(data, 0, 0);
    const k = Math.min(1, maxSize / Math.max(cw, ch));
    if (k >= 1) return full.toDataURL('image/png');
    const small = document.createElement('canvas');
    small.width = Math.max(1, Math.round(cw * k)); small.height = Math.max(1, Math.round(ch * k));
    const sctx = small.getContext('2d');
    if (!sctx) return full.toDataURL('image/png');
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(full, 0, 0, small.width, small.height);
    return small.toDataURL('image/png');
  });
}

/* -------------------------------------------------------------------------- */
/*  9. Bridge into the splitter's document model                              */
/* -------------------------------------------------------------------------- */

function pathToD(p: VectorPath): string {
  let d = '';
  const f = (v: number) => (Math.round(v * 100) / 100).toString();
  for (const seg of p.segments) {
    if (seg.type === 'M') d += `M${f(seg.args[0])} ${f(seg.args[1])}`;
    else if (seg.type === 'L') d += `L${f(seg.args[0])} ${f(seg.args[1])}`;
    else if (seg.type === 'C') d += `C${f(seg.args[0])} ${f(seg.args[1])} ${f(seg.args[2])} ${f(seg.args[3])} ${f(seg.args[4])} ${f(seg.args[5])}`;
    else if (seg.type === 'Z') d += 'Z';
  }
  return d;
}

export function traceResultToDocument(result: TraceResult, filename: string, filesize = ''): EPSDocument {
  const { width, height } = result;
  const stamp = Date.now();
  const base = filename.replace(/\.[^.]+$/, '') || 'sheet';

  const allPaths: VectorPath[] = [];
  const icons: ExtractedIcon[] = result.icons.map((ti, idx) => {
    allPaths.push(...ti.paths);
    const num = idx + 1;
    const name = `icon-${num.toString().padStart(2, '0')}`;
    const bbox = ti.bbox;
    const colors = new Set(ti.paths.map((p) => p.fillColor));
    return {
      id: `icon-${stamp}-${idx}`,
      name,
      index: num,
      bbox,
      originalBbox: [bbox.x, height - (bbox.y + bbox.height), bbox.x + bbox.width, height - bbox.y],
      svgContent: buildIconSvg(ti.paths, bbox, 6),
      epsContent: buildIconEPS(ti.paths, bbox, height),
      width: Math.round(bbox.width),
      height: Math.round(bbox.height),
      pathCount: ti.paths.length,
      color: colors.size === 1 ? [...colors][0] : undefined,
      selected: true,
      aspectRatio: bbox.width / Math.max(1, bbox.height),
    };
  });

  const body = result.icons
    .map((ti, idx) => {
      const id = `icon-${(idx + 1).toString().padStart(2, '0')}`;
      const inner = ti.paths.map((p) => `<path d="${pathToD(p)}" fill="${p.fillColor}" fill-rule="evenodd"/>`).join('');
      return `<g id="${id}">${inner}</g>`;
    })
    .join('\n');
  const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">\n${body}\n</svg>`;

  return {
    id: `trace-${stamp}`,
    filename: `${base}-traced.svg`,
    filesize,
    bbox: [0, 0, width, height],
    width,
    height,
    rawContent: fullSvg,
    fullSvg,
    icons,
    parsedVectorPaths: allPaths,
    processedAt: new Date().toISOString(),
  };
}

/* -------------------------------------------------------------------------- */
/*  10. Browser loader                                                        */
/* -------------------------------------------------------------------------- */

export const MAX_TRACE_DIMENSION = 4096;

export async function loadRasterFromFile(file: Blob): Promise<RasterInput> {
  const bitmap = await createImageBitmap(file);
  try {
    let w = bitmap.width, h = bitmap.height;
    const longest = Math.max(w, h);
    if (longest > MAX_TRACE_DIMENSION) {
      const k = MAX_TRACE_DIMENSION / longest;
      w = Math.round(w * k);
      h = Math.round(h * k);
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas is not available in this browser.');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h);
    return { data: data.data, width: w, height: h };
  } finally {
    bitmap.close?.();
  }
}

export async function sliceImageFile(
  file: File,
  options: Partial<TraceOptions> = {},
  onProgress?: TraceProgress
): Promise<TraceSession> {
  onProgress?.('Reading image…', 1);
  const raster = await loadRasterFromFile(file);
  return prepareSlices(raster, options, onProgress);
}

export async function traceImageFile(
  file: File,
  options: Partial<TraceOptions> = {},
  onProgress?: TraceProgress
): Promise<{ document: EPSDocument; info: TraceResult['info'] }> {
  onProgress?.('Reading image…', 1);
  const raster = await loadRasterFromFile(file);
  const result = await vectorizeRaster(raster, options, onProgress);
  const size = file.size > 1024 * 1024 ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1024))} KB`;
  return { document: traceResultToDocument(result, file.name, size), info: result.info };
}

/** Exposed for the test harness only. */
export const _internals = { buildField, marchingSquares, detectCorners, fitClosedLoop, analyze, autoGap, labelComponents };
