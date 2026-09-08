export type GridType =
  | "smart"
  | "golden"
  | "fibonacci"
  | "thirds"
  | "modular"
  | "columns"
  | "rows"
  | "isometric"
  | "diagonal"
  | "baseline";

export type LineStyle = "solid" | "dashed" | "dotted";
export type BgMode = "transparent" | "dark" | "light" | "custom";

export type CanvasPreset = {
  id: string;
  name: string;
  category: "Social" | "Web & UI" | "Print" | "Video";
  width: number;
  height: number;
  icon?: string;
};

export type GridConfig = {
  type: GridType;
  columns: number;
  rows: number;
  margin: number; // percentage 0-30
  gutter: number; // px 0-60
  focalX: number; // percentage 0-100
  focalY: number; // percentage 0-100
  gridColor: string;
  accentColor: string;
  opacity: number; // 0.1 - 1
  lineWidth: number; // 0.5 - 5
  lineStyle: LineStyle;
  showMargins: boolean;
  showColumns: boolean;
  showRows: boolean;
  showGutters: boolean;
  showGoldenSpiral: boolean;
  showFibonacciSpiral: boolean;
  showThirds: boolean;
  showDiagonals: boolean;
  showFocal: boolean;
  showBaseline: boolean;
  baselineStep: number;
  isometricAngle: number;
  bgMode: BgMode;
  bgColor: string;
  seed: string;
};

export type CompositionScores = {
  overallScore: number;
  hierarchy: number;
  balance: number;
  alignment: number;
  proportion: number;
  rhythm: number;
  negativeSpace: number;
  goldenMatch: number;
  thirdsMatch: number;
};

export type ReferenceAnalysis = {
  width: number;
  height: number;
  aspectRatio: string;
  aspectRatioDecimal: number;
  dominantComposition: string;
  goldenRatioDeviation: number;
  symmetryScore: number;
  ruleOfThirdsScore: number;
  recommendations: string[];
};
