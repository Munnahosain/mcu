export type ElementType = 'shape' | 'path' | 'text' | 'image';

export type ShapeKind =
  | 'circle'
  | 'rect'
  | 'star'
  | 'heart'
  | 'leaf'
  | 'monstera'
  | 'flower'
  | 'paisley'
  | 'petal'
  | 'diamond'
  | 'wave'
  | 'blob'
  | 'sunburst'
  | 'butterfly'
  | 'crescent'
  | 'custom-path';

export interface DesignElement {
  id: string;
  name: string;
  type: ElementType;
  x: number; // center or top-left position in artboard coords (0 to artboardSize)
  y: number;
  width: number;
  height: number;
  rotation: number; // in degrees 0-360
  scaleX: number; // 1 or -1 (flipped)
  scaleY: number; // 1 or -1 (flipped)
  opacity: number; // 0 to 1
  fill: string;
  stroke: string;
  strokeWidth: number;
  shapeKind?: ShapeKind;
  pathData?: string;
  textContent?: string;
  fontFamily?: string;
  fontSize?: number;
  imageUrl?: string;
  groupId?: string;
  groupName?: string;
  sourceFormat?: 'svg' | 'eps' | 'image';
  zIndex: number;
  locked?: boolean;
}

export type RepeatType = 'grid' | 'half-drop' | 'half-brick';

export type PhysicalUnit = 'cm' | 'inch' | 'mm';

export interface PatternSettings {
  artboardSize: number; // in virtual canvas pixels, always 1:1, e.g. 500
  physicalUnit: PhysicalUnit;
  physicalSize: number; // e.g., 15 cm or 6 inches
  dpi: number; // e.g. 300 dpi for fabric printing
  repeatType: RepeatType;
  backgroundColor: string;
  backgroundTransparent: boolean;
  showBleedGuide: boolean;
  seamAllowance: number; // in physicalUnit (e.g. 1.0 cm)
  showRulers: boolean;
  showGhostWraps: boolean; // Show wrapped shapes on opposite sides
  showGridLines: boolean;
  gridSnap: boolean;
  gridSize: number;
  fabricBoltWidth: number; // e.g. 110 or 140 cm / 44" or 54"
  fabricLength: number; // e.g. 100 cm or 1 yard
}

export type ToolMode = 'select' | 'draw' | 'shape' | 'text' | 'pan';

export type ActiveTab = 'artboard' | 'tiling' | 'fabric-spec' | 'mockups';
