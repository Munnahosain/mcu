import { SHEET_H, SHEET_W, compactOf, makeLayer } from "./core";
import type { Layer, SheetDoc, Template } from "./types";

const W = SHEET_W;
const H = SHEET_H;

function gridLayer(partial: Partial<Layer> & Pick<Layer, "x" | "y" | "w" | "h">): Layer {
  return makeLayer({
    type: "grid", name: "Icons Grid", cols: 0, rows: 0, gap: 40, cellPad: 22,
    cellFill: "#FFFFFF", cellStroke: "", cellStrokeWidth: 0, cellRadius: 36, showLabels: false, fill: "",
    ...partial,
  });
}

function doc(partial: Partial<SheetDoc> & Pick<SheetDoc, "background" | "iconFill" | "labelColor" | "layers">): SheetDoc {
  return { width: W, height: H, backgroundRadius: 0, title: "VECTOR ICONS", ...partial };
}

function template(id: string, name: string, d: SheetDoc): Template {
  return { id, name, builtin: true, group: "Signature", doc: d, compact: compactOf(d) };
}

/* ---------------------------------------------------------------- Aurora */

function aurora(): Template {
  const layers: Layer[] = [
    makeLayer({ type: "pattern", name: "Dot Texture", x: 0, y: 0, w: W, h: H, fill: "#FFFFFF", pattern: "dots", patternGap: 56, strokeWidth: 5, opacity: 0.07 }),
    makeLayer({ type: "rect", name: "Brand Glass", x: 100, y: 100, w: 1250, h: 2400, fill: "#FFFFFF", fillOpacity: 0.07, stroke: "#4B4585", strokeWidth: 4, radius: 100 }),
    makeLayer({ type: "featured", name: "Featured Icon", x: 215, y: 215, w: 1020, h: 1020, fill: "#7C3AED", fill2: "#EC4899", gradAngle: 135, radius: 150, cellPad: 16 }),
    makeLayer({ type: "text", name: "Title Text", text: "{title}", x: 140, y: 1330, w: 1170, h: 200, fontSize: 120, fontWeight: 800, letterSpacing: 2, align: "center", fill: "#FFFFFF" }),
    makeLayer({ type: "text", name: "Subtitle", text: "PREMIUM ICON PACK", x: 140, y: 1500, w: 1170, h: 100, fontSize: 40, fontWeight: 600, letterSpacing: 14, align: "center", fill: "#A5B4FC" }),
    makeLayer({ type: "line", name: "Accent Line", x: 475, y: 1640, w: 400, h: 20, stroke: "#22D3EE", strokeWidth: 8 }),
    makeLayer({ type: "rect", name: "Count Badge", x: 250, y: 2180, w: 950, h: 160, fill: "#06B6D4", fill2: "#7C3AED", gradAngle: 0, radius: 80 }),
    makeLayer({ type: "text", name: "Badge Text", text: "{n} VECTOR ICONS", x: 250, y: 2180, w: 950, h: 160, fontSize: 56, fontWeight: 800, letterSpacing: 4, align: "center", fill: "#FFFFFF" }),
    makeLayer({ type: "rect", name: "Grid Glass", x: 1450, y: 100, w: 3450, h: 2400, fill: "#FFFFFF", fillOpacity: 0.06, stroke: "#4B4585", strokeWidth: 4, radius: 100 }),
    gridLayer({ x: 1560, y: 210, w: 3230, h: 2180, cellFill: "#FFFFFF", cellFillOpacity: 0.07, cellStroke: "#5B54A0", cellStrokeWidth: 3, cellRadius: 44 }),
  ];
  return template("sig-aurora", "Aurora Glass", doc({ background: "#0A0B1E", backgroundTo: "#1D1148", backgroundAngle: 135, iconFill: "#FFFFFF", labelColor: "#A5B4FC", layers }));
}

/* ----------------------------------------------------------- Neo Brutal */

function neoBrutal(): Template {
  const ink = "#111111";
  const layers: Layer[] = [
    makeLayer({ type: "pattern", name: "Grid Paper", x: 0, y: 0, w: W, h: H, fill: ink, pattern: "grid", patternGap: 100, strokeWidth: 2, opacity: 0.07 }),
    makeLayer({ type: "rect", name: "Header Offset", x: 126, y: 126, w: 4800, h: 520, fill: ink, radius: 44 }),
    makeLayer({ type: "rect", name: "Header Block", x: 100, y: 100, w: 4800, h: 520, fill: "#FFE14D", stroke: ink, strokeWidth: 12, radius: 44 }),
    makeLayer({ type: "text", name: "Title Text", text: "{title}", x: 220, y: 100, w: 2800, h: 520, fontSize: 230, fontWeight: 900, letterSpacing: -4, align: "left", fill: ink }),
    makeLayer({ type: "rect", name: "Featured Offset", x: 3126, y: 186, w: 440, h: 440, fill: ink, radius: 64 }),
    makeLayer({ type: "featured", name: "Featured Icon", x: 3100, y: 160, w: 440, h: 440, fill: "#FFFFFF", stroke: ink, strokeWidth: 12, radius: 64, cellPad: 12 }),
    makeLayer({ type: "rect", name: "Sticker Offset", x: 3786, y: 236, w: 1080, h: 320, fill: ink, radius: 160, rotation: -4 }),
    makeLayer({ type: "rect", name: "Sticker", x: 3770, y: 220, w: 1080, h: 320, fill: "#FF6B9D", stroke: ink, strokeWidth: 12, radius: 160, rotation: -4 }),
    makeLayer({ type: "text", name: "Sticker Text", text: "{n} VECTOR\nICONS", x: 3770, y: 220, w: 1080, h: 320, fontSize: 82, fontWeight: 900, letterSpacing: 2, lineHeight: 105, align: "center", fill: ink, rotation: -4 }),
    makeLayer({ type: "rect", name: "Grid Offset", x: 126, y: 746, w: 4800, h: 1730, fill: ink, radius: 44 }),
    makeLayer({ type: "rect", name: "Grid Card", x: 100, y: 720, w: 4800, h: 1730, fill: "#FFFFFF", stroke: ink, strokeWidth: 12, radius: 44 }),
    gridLayer({ x: 200, y: 820, w: 4600, h: 1530, gap: 44, cellFill: "#FFFFFF", cellStroke: ink, cellStrokeWidth: 10, cellRadius: 34, cellOffset: 14, cellOffsetColor: ink, cellPad: 20 }),
  ];
  return template("sig-neo-brutal", "Neo Brutal", doc({ background: "#FFF4D6", iconFill: ink, labelColor: ink, layers }));
}

/* ------------------------------------------------------------ Editorial */

function editorial(): Template {
  const ink = "#1C1917";
  const layers: Layer[] = [
    makeLayer({ type: "text", name: "Kicker", text: "THE ICON COLLECTION · VOL. 01", x: 100, y: 120, w: 1400, h: 80, fontSize: 40, fontWeight: 600, letterSpacing: 10, align: "left", fill: "#78716C" }),
    makeLayer({ type: "line", name: "Top Rule", x: 100, y: 250, w: 1400, h: 10, stroke: ink, strokeWidth: 5 }),
    makeLayer({ type: "text", name: "Title Text", text: "{title}", x: 100, y: 330, w: 1400, h: 300, fontSize: 190, fontWeight: 500, letterSpacing: -4, align: "left", fill: ink, font: "serif" }),
    makeLayer({ type: "text", name: "Standfirst", text: "A considered set of clean,\nconsistent vector icons.", x: 100, y: 690, w: 1400, h: 200, fontSize: 52, fontWeight: 400, lineHeight: 130, align: "left", fill: "#57534E", font: "serif" }),
    makeLayer({ type: "ellipse", name: "Featured Dot", x: 520, y: 1000, w: 1000, h: 1000, fill: "#C2410C" }),
    makeLayer({ type: "featured", name: "Featured Icon", x: 400, y: 920, w: 1000, h: 1000, fill: "#F3EDE2", stroke: ink, strokeWidth: 6, radius: 9999, cellPad: 22 }),
    makeLayer({ type: "line", name: "Bottom Rule", x: 100, y: 2210, w: 1400, h: 10, stroke: ink, strokeWidth: 5 }),
    makeLayer({ type: "text", name: "Count Text", text: "{n} VECTOR ICONS", x: 100, y: 2280, w: 1400, h: 100, fontSize: 56, fontWeight: 700, letterSpacing: 10, align: "left", fill: "#C2410C" }),
    makeLayer({ type: "text", name: "Footnote", text: "Solid · Stroke · Fully editable", x: 100, y: 2380, w: 1400, h: 80, fontSize: 38, fontWeight: 400, align: "left", fill: "#78716C", font: "serif" }),
    makeLayer({ type: "line", name: "Column Rule", x: 360, y: 1290, w: 2400, h: 10, stroke: ink, strokeWidth: 4, rotation: 90 }),
    gridLayer({ x: 1680, y: 160, w: 3220, h: 2280, gap: 0, cellFill: "", cellStroke: "#CFC6B4", cellStrokeWidth: 3, cellRadius: 0, cellPad: 26 }),
  ];
  // Column rule: horizontal line rotated 90° around its centre → vertical at x = 1560.
  layers[9].x = 1560 - 1200;
  layers[9].y = 1300 - 5;
  return template("sig-editorial", "Editorial Paper", doc({ background: "#F3EDE2", iconFill: ink, labelColor: "#78716C", layers }));
}

/* ------------------------------------------------------------ Blueprint */

function blueprint(): Template {
  const layers: Layer[] = [
    makeLayer({ type: "pattern", name: "Fine Grid", x: 0, y: 0, w: W, h: H, fill: "#FFFFFF", pattern: "grid", patternGap: 100, strokeWidth: 2, opacity: 0.1 }),
    makeLayer({ type: "pattern", name: "Major Grid", x: 0, y: 0, w: W, h: H, fill: "#FFFFFF", pattern: "grid", patternGap: 500, strokeWidth: 3, opacity: 0.14 }),
    makeLayer({ type: "rect", name: "Outer Frame", x: 100, y: 100, w: 4800, h: 2400, fill: "", stroke: "#FFFFFF", strokeWidth: 6 }),
    makeLayer({ type: "rect", name: "Inner Frame", x: 160, y: 160, w: 4680, h: 2280, fill: "", stroke: "#93C5FD", strokeWidth: 3, dash: 24 }),
    makeLayer({ type: "featured", name: "Featured Icon", x: 260, y: 260, w: 820, h: 820, fill: "", stroke: "#FFFFFF", strokeWidth: 5, dash: 22, cellPad: 16 }),
    makeLayer({ type: "text", name: "Figure Label", text: "FIG. 01", x: 260, y: 1110, w: 820, h: 70, fontSize: 42, fontWeight: 700, letterSpacing: 8, align: "left", fill: "#93C5FD", font: "mono" }),
    makeLayer({ type: "text", name: "Spec List", text: "SPECIFICATION\n— Pure vector SVG\n— Fully editable paths\n— Scales without loss\n— Consistent grid", x: 260, y: 1250, w: 820, h: 620, fontSize: 46, fontWeight: 500, letterSpacing: 2, lineHeight: 150, align: "left", fill: "#BFDBFE", font: "mono" }),
    gridLayer({ x: 1200, y: 260, w: 3540, h: 1700, gap: 36, cellFill: "", cellStroke: "#FFFFFF", cellStrokeWidth: 3, cellDash: 14, cellRadius: 0, cellPad: 22 }),
    makeLayer({ type: "rect", name: "Title Block", x: 1200, y: 2060, w: 3540, h: 300, fill: "", stroke: "#FFFFFF", strokeWidth: 5 }),
    makeLayer({ type: "text", name: "Title Text", text: "{title}", x: 1270, y: 2060, w: 1700, h: 300, fontSize: 84, fontWeight: 700, letterSpacing: 6, align: "left", fill: "#FFFFFF", font: "mono" }),
    makeLayer({ type: "text", name: "Count Text", text: "{n} ICONS", x: 2900, y: 2060, w: 900, h: 300, fontSize: 56, fontWeight: 700, letterSpacing: 6, align: "center", fill: "#93C5FD", font: "mono" }),
    makeLayer({ type: "text", name: "Scale Text", text: "SCALE 1:1\nFORMAT SVG", x: 3800, y: 2060, w: 880, h: 300, fontSize: 38, fontWeight: 500, letterSpacing: 4, lineHeight: 140, align: "right", fill: "#BFDBFE", font: "mono" }),
  ];
  return template("sig-blueprint", "Blueprint", doc({ background: "#0B3A8C", backgroundTo: "#082B6B", backgroundAngle: 160, iconFill: "#FFFFFF", labelColor: "#BFDBFE", layers }));
}

/* ----------------------------------------------------------- Pastel Pop */

function pastelPop(): Template {
  const ink = "#4C1D95";
  const layers: Layer[] = [
    makeLayer({ type: "ellipse", name: "Blob Pink", x: -450, y: -550, w: 1900, h: 1900, fill: "#FBCFE8" }),
    makeLayer({ type: "ellipse", name: "Blob Sky", x: 3150, y: -750, w: 1600, h: 1500, fill: "#BAE6FD" }),
    makeLayer({ type: "ellipse", name: "Blob Yellow", x: 3750, y: 1650, w: 1900, h: 1700, fill: "#FEF08A" }),
    makeLayer({ type: "ellipse", name: "Blob Mint", x: -350, y: 1950, w: 1500, h: 1300, fill: "#BBF7D0" }),
    makeLayer({ type: "rect", name: "Main Card", x: 200, y: 200, w: 4600, h: 2200, fill: "#FFFFFF", radius: 170 }),
    makeLayer({ type: "text", name: "Title Text", text: "{title}", x: 200, y: 290, w: 4600, h: 300, fontSize: 190, fontWeight: 900, letterSpacing: 0, align: "center", fill: ink }),
    makeLayer({ type: "rect", name: "Count Badge", x: 1950, y: 640, w: 1100, h: 140, fill: "#8B5CF6", fill2: "#EC4899", gradAngle: 0, radius: 70 }),
    makeLayer({ type: "text", name: "Badge Text", text: "{n} VECTOR ICONS", x: 1950, y: 640, w: 1100, h: 140, fontSize: 52, fontWeight: 800, letterSpacing: 4, align: "center", fill: "#FFFFFF" }),
    makeLayer({ type: "featured", name: "Featured Icon", x: 330, y: 270, w: 520, h: 520, fill: "#FDE68A", stroke: "#FFFFFF", strokeWidth: 22, radius: 9999, cellPad: 20, rotation: -8 }),
    gridLayer({ x: 340, y: 880, w: 4320, h: 1400, gap: 36, cellFill: "#F5F3FF", cellStroke: "", cellStrokeWidth: 0, cellRadius: 999, cellPad: 26 }),
  ];
  return template("sig-pastel-pop", "Pastel Pop", doc({ background: "#F5F0FF", iconFill: ink, labelColor: ink, layers }));
}

/* ------------------------------------------------------------- Gold Noir */

function goldNoir(): Template {
  const gold = "#CBA35C";
  const layers: Layer[] = [
    makeLayer({ type: "pattern", name: "Fine Lines", x: 0, y: 0, w: W, h: H, fill: gold, pattern: "lines", patternGap: 36, strokeWidth: 2, opacity: 0.045 }),
    makeLayer({ type: "rect", name: "Outer Frame", x: 100, y: 100, w: 4800, h: 2400, fill: "", stroke: gold, strokeWidth: 5 }),
    makeLayer({ type: "rect", name: "Inner Frame", x: 150, y: 150, w: 4700, h: 2300, fill: "", stroke: gold, strokeWidth: 2, opacity: 0.55 }),
    makeLayer({ type: "text", name: "Title Text", text: "{title}", x: 150, y: 230, w: 4700, h: 260, fontSize: 150, fontWeight: 400, letterSpacing: 44, align: "center", fill: "#E8C987", font: "serif" }),
    makeLayer({ type: "line", name: "Ornament Left", x: 1900, y: 550, w: 520, h: 10, stroke: gold, strokeWidth: 3 }),
    makeLayer({ type: "rect", name: "Ornament Diamond", x: 2482, y: 532, w: 36, h: 36, fill: gold, rotation: 45 }),
    makeLayer({ type: "line", name: "Ornament Right", x: 2580, y: 550, w: 520, h: 10, stroke: gold, strokeWidth: 3 }),
    makeLayer({ type: "text", name: "Subtitle", text: "{n} PREMIUM VECTOR ICONS", x: 150, y: 600, w: 4700, h: 100, fontSize: 50, fontWeight: 400, letterSpacing: 24, align: "center", fill: "#A8895A", font: "serif" }),
    gridLayer({ x: 400, y: 790, w: 4200, h: 1460, gap: 44, cellFill: "", cellStroke: "#8A6D3B", cellStrokeWidth: 3, cellRadius: 22, cellPad: 24 }),
    makeLayer({ type: "text", name: "Footer", text: "FULLY EDITABLE · SCALABLE · COMMERCIAL READY", x: 150, y: 2310, w: 4700, h: 80, fontSize: 38, fontWeight: 400, letterSpacing: 20, align: "center", fill: "#7C6A48", font: "serif" }),
  ];
  return template("sig-gold-noir", "Gold Noir", doc({ background: "#0C0A09", backgroundTo: "#1C1917", backgroundAngle: 90, iconFill: "#E8C987", labelColor: "#A8895A", layers }));
}

export function signatureTemplates(): Template[] {
  return [aurora(), neoBrutal(), editorial(), blueprint(), pastelPop(), goldNoir()];
}
