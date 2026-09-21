export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExtractedIcon {
  id: string;
  name: string;
  index: number;
  bbox: BoundingBox;
  originalBbox: [number, number, number, number]; // [llx, lly, urx, ury] in PostScript coordinates
  svgContent: string;
  epsContent: string;
  width: number;
  height: number;
  pathCount: number;
  color?: string;
  selected: boolean;
  previewDataUrl?: string;
  aspectRatio: number;
}

export interface EPSDocument {
  id: string;
  filename: string;
  filesize: string;
  bbox: [number, number, number, number];
  width: number;
  height: number;
  rawContent: string;
  fullSvg: string;
  icons: ExtractedIcon[];
  processedAt: string;
  parsedVectorPaths?: any[];
}

export type ExportFormat = 'svg' | 'png' | 'jpg' | 'webp' | 'eps' | 'pdf';

export type ExportSize = 'original' | '256' | '512' | '1024' | '2048' | '4096' | 'custom';

export type ExportBackground = 'transparent' | 'white' | 'black' | 'custom';

export interface ExportSettings {
  format: ExportFormat;
  multiFormat: boolean;
  selectedFormats: ExportFormat[];
  size: ExportSize;
  customWidth: number;
  customHeight: number;
  lockAspectRatio: boolean;
  background: ExportBackground;
  customBgColor: string;
  padding: number; // 0, 5, 10, 15, 20
  namingPattern: 'icon-{number}' | 'icon-{index}' | 'icon-{name}' | 'custom';
  customPrefix: string;
  svgPreserveVectors: boolean;
  svgOptimize: boolean;
  svgResponsive: boolean;
  pdfMultiPage: boolean;
}

export interface HistorySession {
  id: string;
  filename: string;
  iconCount: number;
  timestamp: string;
  format: string;
  previewIconSvg: string;
  fileSize: string;
  iconsData: ExtractedIcon[];
  fullSvg: string;
  epsWidth: number;
  epsHeight: number;
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  defaultFormat: ExportFormat;
  defaultSize: ExportSize;
  defaultBackground: ExportBackground;
  defaultPadding: number;
  defaultPrefix: string;
  detectionSensitivity: 'balanced' | 'high' | 'grid';
  localProcessingPreference: boolean;
}

export interface ManualRegion {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
}


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
