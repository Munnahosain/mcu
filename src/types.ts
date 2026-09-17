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
