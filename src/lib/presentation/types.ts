export type LayerType = "rect" | "ellipse" | "triangle" | "line" | "text" | "grid" | "featured" | "pattern" | "image";

export type FontFamily = "sans" | "serif" | "mono";
export type PatternKind = "dots" | "grid" | "lines" | "cross";

export interface Layer {
  id: string;
  type: LayerType;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  opacity: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  radius: number;
  visible: boolean;
  locked: boolean;
  groupId?: string;

  /** Second gradient colour (with `fill` as the first). Empty = flat fill. */
  fill2?: string;
  /** Gradient direction in degrees: 0 = left→right, 90 = top→bottom. */
  gradAngle?: number;
  /** Opacity of the fill only (stroke stays solid), 0–1. */
  fillOpacity?: number;
  /** Dash length of the stroke in px, 0 = solid. */
  dash?: number;

  /** text — `{n}` = icon count, `{title}` = sheet title, new lines allowed */
  text?: string;
  fontSize?: number;
  fontWeight?: number;
  letterSpacing?: number;
  align?: "left" | "center" | "right";
  font?: FontFamily;
  /** Line height in %, default 115. */
  lineHeight?: number;

  /** pattern — colour is `fill`, thickness is `strokeWidth` */
  pattern?: PatternKind;
  patternGap?: number;

  /** image — data URL */
  href?: string;

  /** grid — 0 = automatic */
  cols?: number;
  rows?: number;
  gap?: number;
  /** Icon padding inside a tile, % of the tile. */
  cellPad?: number;
  cellFill?: string;
  cellFillOpacity?: number;
  cellStroke?: string;
  cellStrokeWidth?: number;
  cellDash?: number;
  cellRadius?: number;
  /** Hard "offset" shadow behind every tile, in px. */
  cellOffset?: number;
  cellOffsetColor?: string;
  showLabels?: boolean;
}

export interface SheetDoc {
  width: number;
  height: number;
  background: string;
  /** Second background colour for a gradient; empty = flat. */
  backgroundTo?: string;
  backgroundAngle?: number;
  backgroundRadius: number;
  title: string;
  iconFill: string;
  labelColor: string;
  layers: Layer[];
}

export type StrokeStyle = "fill" | "stroke-fill" | "stroke";

/** Rule-based two-tone look: the main colour is the icon fill, this is the accent. */
export interface TwoToneStyle {
  enabled: boolean;
  /** Accent colour. */
  secondary: string;
  /** Tint areas enclosed by a shape (outline → duotone, panels, battery cells). */
  fillEnclosed: boolean;
  /** Tint strength in %. */
  tint: number;
  /** Give small separate shapes the accent colour. */
  accentSmall: boolean;
  /** A shape smaller than this % of the largest one counts as small. */
  smallRatio: number;
}

export const DEFAULT_TWO_TONE: TwoToneStyle = { enabled: false, secondary: "#34D399", fillEnclosed: true, tint: 35, accentSmall: true, smallRatio: 25 };

export interface IconStyle {
  /** Applied to single-tone icons; `null` keeps the traced colour. */
  fill: string | null;
  strokeStyle: StrokeStyle;
  /** Stroke width in px on a 512 px icon. */
  strokeWidth: number;
  twoTone?: TwoToneStyle;
}

export interface PresentationIcon {
  id: string;
  name: string;
  svg: string;
  singleTone: boolean;
}

export interface RenderContext {
  icons: PresentationIcon[];
  /** Icon ids in display order. */
  order: string[];
  featuredId: string | null;
  style: IconStyle;
  showNames: boolean;
}

export interface Template {
  id: string;
  name: string;
  builtin: boolean;
  /** Gallery section for built-ins. */
  group?: string;
  doc: SheetDoc;
  compact: SheetDoc;
}
