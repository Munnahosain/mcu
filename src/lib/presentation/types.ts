export type LayerType = "rect" | "ellipse" | "triangle" | "line" | "text" | "grid" | "featured";

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

  /** text — `{n}` = icon count, `{title}` = sheet title */
  text?: string;
  fontSize?: number;
  fontWeight?: number;
  letterSpacing?: number;
  align?: "left" | "center" | "right";

  /** grid — 0 = automatic */
  cols?: number;
  rows?: number;
  gap?: number;
  /** Icon padding inside a tile, % of the tile. */
  cellPad?: number;
  cellFill?: string;
  cellStroke?: string;
  cellStrokeWidth?: number;
  cellRadius?: number;
  showLabels?: boolean;
}

export interface SheetDoc {
  width: number;
  height: number;
  background: string;
  backgroundRadius: number;
  title: string;
  iconFill: string;
  labelColor: string;
  layers: Layer[];
}

export type StrokeStyle = "fill" | "stroke-fill" | "stroke";

export interface IconStyle {
  /** Applied to single-tone icons; `null` keeps the traced colour. */
  fill: string | null;
  strokeStyle: StrokeStyle;
  /** Stroke width in px on a 512 px icon. */
  strokeWidth: number;
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
  doc: SheetDoc;
  compact: SheetDoc;
}
