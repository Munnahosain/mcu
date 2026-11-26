import type { TwoToneStyle } from "./types";

/**
 * Rule-based two-tone splitting of a single SVG path (no AI):
 *  - sub-paths are grouped into shapes by nesting (outer contour + its holes and islands),
 *  - enclosed areas of a shape can be tinted (outline → duotone, panels, batteries…),
 *  - small separate shapes can take the accent colour (sun rays, dots, bolts…).
 */

type Pt = [number, number];
interface Sub { d: string; pts: Pt[] }

const f = (v: number) => String(Math.round(v * 100) / 100);

function cubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
}
function quad(p0: Pt, p1: Pt, p2: Pt, t: number): Pt {
  const u = 1 - t;
  return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]];
}

/** Samples an SVG elliptical arc (endpoint form) into points, ending at (x2, y2). */
function arcPoints(x1: number, y1: number, rxIn: number, ryIn: number, rotDeg: number, fa: number, fs: number, x2: number, y2: number): Pt[] {
  let rx = Math.abs(rxIn), ry = Math.abs(ryIn);
  if (!rx || !ry || (x1 === x2 && y1 === y2)) return [[x2, y2]];
  const phi = (rotDeg * Math.PI) / 180, cp = Math.cos(phi), sp = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cp * dx + sp * dy, y1p = -sp * dx + cp * dy;
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) { const k = Math.sqrt(lam); rx *= k; ry *= k; }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const coef = (fa === fs ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cxp = (coef * rx * y1p) / ry, cyp = (-coef * ry * x1p) / rx;
  const cx = cp * cxp - sp * cyp + (x1 + x2) / 2, cy = sp * cxp + cp * cyp + (y1 + y2) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const th1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dth = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!fs && dth > 0) dth -= 2 * Math.PI;
  else if (fs && dth < 0) dth += 2 * Math.PI;
  const steps = Math.max(6, Math.ceil(Math.abs(dth) / (Math.PI / 12)));
  const out: Pt[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = th1 + (dth * i) / steps;
    out.push([cx + rx * Math.cos(t) * cp - ry * Math.sin(t) * sp, cy + rx * Math.cos(t) * sp + ry * Math.sin(t) * cp]);
  }
  out[out.length - 1] = [x2, y2];
  return out;
}

/** Splits a path into closed sub-paths written with absolute commands, plus a polygon outline of each. */
export function parseSubpaths(d: string): Sub[] | null {
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g);
  if (!tokens) return null;
  const subs: Sub[] = [];
  let cur: { parts: string[]; pts: Pt[] } | null = null;
  let i = 0, cmd = "", cx = 0, cy = 0, sx = 0, sy = 0;
  let lastC: Pt | null = null, lastQ: Pt | null = null;

  const next = () => {
    const v = parseFloat(tokens[i++]);
    if (!Number.isFinite(v)) throw new Error("bad path");
    return v;
  };
  const flush = () => {
    if (cur && cur.pts.length > 2) subs.push({ d: `${cur.parts.join("")}Z`, pts: cur.pts });
    cur = null;
  };
  const begin = (x: number, y: number) => {
    flush();
    cur = { parts: [`M${f(x)} ${f(y)}`], pts: [[x, y]] };
    sx = x; sy = y; cx = x; cy = y;
  };
  const ensure = () => { if (!cur) begin(cx, cy); return cur as { parts: string[]; pts: Pt[] }; };

  try {
    while (i < tokens.length) {
      const t = tokens[i];
      if (/[A-Za-z]/.test(t)) {
        cmd = t; i++;
        if (cmd === "Z" || cmd === "z") { flush(); cx = sx; cy = sy; lastC = lastQ = null; continue; }
      } else if (!cmd) {
        return null;
      }
      const rel = cmd === cmd.toLowerCase();
      const ox = rel ? cx : 0, oy = rel ? cy : 0;
      switch (cmd.toUpperCase()) {
        case "M": { const x = next() + ox, y = next() + oy; begin(x, y); cmd = rel ? "l" : "L"; lastC = lastQ = null; break; }
        case "L": { const x = next() + ox, y = next() + oy; const c = ensure(); c.parts.push(`L${f(x)} ${f(y)}`); c.pts.push([x, y]); cx = x; cy = y; lastC = lastQ = null; break; }
        case "H": { const x = next() + ox; const c = ensure(); c.parts.push(`L${f(x)} ${f(cy)}`); c.pts.push([x, cy]); cx = x; lastC = lastQ = null; break; }
        case "V": { const y = next() + oy; const c = ensure(); c.parts.push(`L${f(cx)} ${f(y)}`); c.pts.push([cx, y]); cy = y; lastC = lastQ = null; break; }
        case "C": case "S": {
          const c = ensure();
          const p0: Pt = [cx, cy];
          let p1: Pt;
          if (cmd.toUpperCase() === "C") p1 = [next() + ox, next() + oy];
          else p1 = lastC ? [2 * cx - lastC[0], 2 * cy - lastC[1]] : [cx, cy];
          const p2: Pt = [next() + ox, next() + oy];
          const p3: Pt = [next() + ox, next() + oy];
          c.parts.push(`C${f(p1[0])} ${f(p1[1])} ${f(p2[0])} ${f(p2[1])} ${f(p3[0])} ${f(p3[1])}`);
          for (const k of [0.25, 0.5, 0.75, 1]) c.pts.push(cubic(p0, p1, p2, p3, k));
          cx = p3[0]; cy = p3[1]; lastC = p2; lastQ = null;
          break;
        }
        case "Q": case "T": {
          const c = ensure();
          const p0: Pt = [cx, cy];
          let p1: Pt;
          if (cmd.toUpperCase() === "Q") p1 = [next() + ox, next() + oy];
          else p1 = lastQ ? [2 * cx - lastQ[0], 2 * cy - lastQ[1]] : [cx, cy];
          const p2: Pt = [next() + ox, next() + oy];
          c.parts.push(`Q${f(p1[0])} ${f(p1[1])} ${f(p2[0])} ${f(p2[1])}`);
          for (const k of [0.5, 1]) c.pts.push(quad(p0, p1, p2, k));
          cx = p2[0]; cy = p2[1]; lastQ = p1; lastC = null;
          break;
        }
        case "A": {
          const c = ensure();
          const rx = next(), ry = next(), rot = next(), large = next(), sweep = next();
          const x = next() + ox, y = next() + oy;
          c.parts.push(`A${f(rx)} ${f(ry)} ${f(rot)} ${large ? 1 : 0} ${sweep ? 1 : 0} ${f(x)} ${f(y)}`);
          c.pts.push(...arcPoints(cx, cy, rx, ry, rot, large ? 1 : 0, sweep ? 1 : 0, x, y));
          cx = x; cy = y; lastC = lastQ = null;
          break;
        }
        default:
          return null;
      }
    }
    flush();
  } catch {
    return null;
  }
  return subs.length ? subs : null;
}

function area(pts: Pt[]) {
  let a = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % n];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

function inside(p: Pt, poly: Pt[]) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

interface Shape { subs: string[]; outer: string; ink: number; holes: boolean }

const cache = new Map<string, Shape[] | null>();

/** Groups sub-paths into shapes: one outer contour together with everything nested inside it. */
function shapesOf(d: string): Shape[] | null {
  if (cache.has(d)) return cache.get(d) ?? null;
  let result: Shape[] | null = null;
  const subs = parseSubpaths(d);
  if (subs && subs.length <= 160) {
    const areas = subs.map((s) => area(s.pts));
    const parent = subs.map((s, i) => {
      let best = -1;
      for (let j = 0; j < subs.length; j++) {
        if (j === i || areas[j] <= areas[i]) continue;
        if (best >= 0 && areas[j] >= areas[best]) continue;
        if (inside(s.pts[0], subs[j].pts)) best = j;
      }
      return best;
    });
    const depth = (i: number) => { let n = 0; for (let p = parent[i]; p >= 0; p = parent[p]) n++; return n; };
    const rootOf = (i: number) => { let p = i; while (parent[p] >= 0) p = parent[p]; return p; };
    const byRoot = new Map<number, Shape>();
    subs.forEach((s, i) => {
      const root = rootOf(i);
      const shape = byRoot.get(root) ?? { subs: [], outer: subs[root].d, ink: 0, holes: false };
      const dep = depth(i);
      shape.subs.push(s.d);
      shape.ink += (dep % 2 === 0 ? 1 : -1) * areas[i];
      if (dep === 1) shape.holes = true;
      byRoot.set(root, shape);
    });
    result = [...byRoot.values()].sort((a, b) => b.ink - a.ink);
  }
  if (cache.size > 1500) cache.clear();
  cache.set(d, result);
  return result;
}

export interface TwoToneSplit {
  /** Outer contours to fill with the tint underneath (enclosed areas). */
  under: string[];
  main: string;
  accent: string;
}

export function splitTwoTone(d: string, o: TwoToneStyle): TwoToneSplit | null {
  const shapes = shapesOf(d);
  if (!shapes || !shapes.length) return null;
  const largest = shapes[0];
  const accent = o.accentSmall && shapes.length > 1 ? shapes.slice(1).filter((s) => s.ink < largest.ink * (o.smallRatio / 100)) : [];
  const main = shapes.filter((s) => !accent.includes(s));
  const under = o.fillEnclosed ? main.filter((s) => s.holes).map((s) => s.outer) : [];
  if (!accent.length && !under.length) return null;
  return { under, main: main.flatMap((s) => s.subs).join(""), accent: accent.flatMap((s) => s.subs).join("") };
}

export function luminance(hex: string) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0.5;
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  const n = parseInt(h, 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}
