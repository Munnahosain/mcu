export type SourceMode = "text" | "svg";

export type TextAlign = "left" | "center" | "right";

export type FontFamily = 
  | "Pretendard" 
  | "Myungjo" 
  | "Inter" 
  | "Outfit" 
  | "Orbitron" 
  | "Oswald" 
  | "Caveat" 
  | "Custom";

export type FontWeight = "100" | "300" | "400" | "500" | "600" | "700" | "900";

export type EffectType = "type" | "dither" | "line" | "slice" | "boom" | "crack";

export type DitherShape = "dot" | "square";

export type SliceMode = "alternate" | "random";

export type BoomOrigin = 
  | "glyph" 
  | "center" 
  | "top" 
  | "bottom" 
  | "left" 
  | "right" 
  | "top-left" 
  | "top-right" 
  | "bottom-left" 
  | "bottom-right";

export type BoomShape = "dot" | "square" | "triangle" | "svg";

export interface TransformSettings {
  x: number; // -500 to 500
  y: number; // -500 to 500
  rotate: number; // -180 to 180
  perspectiveV: number; // -100 to 100
  perspectiveH: number; // -100 to 100
}

export interface ColorSettings {
  textColor: string;
  bgColor: string;
  transparent: boolean;
}

export interface DitherSettings {
  shape: DitherShape;
  cellSize: number; // 4 to 50
  dotSize: number; // 0.1 to 1.5
  angle: number; // 0 to 360
}

export interface LineSettings {
  thickness: number; // 1 to 30
  gap: number; // 1 to 40
  angle: number; // 0 to 360
  offset: number; // 0 to 100
  seed: number;
}

export interface SliceSettings {
  pieces: number; // 2 to 50
  offset: number; // -200 to 200
  mode: SliceMode;
  seed: number;
}

export interface BoomSettings {
  origin: BoomOrigin;
  shape: BoomShape;
  shardSize: number; // 2 to 60
  spread: number; // 0 to 200
  shardSvgContent: string | null;
  shardSvgName: string | null;
  seed: number;
}

export interface CrackSettings {
  pieces: number; // 5 to 80
  gap: number; // 0 to 30
  scatter: number; // 0 to 100
  spread: number; // 0 to 100
  seed: number;
}

export interface ArtboardPreset {
  id: string;
  label: string;
  category: "sns" | "print";
  width: number;
  height: number;
}

export interface TypeboxState {
  // Source
  sourceMode: SourceMode;
  text: string;
  textAlign: TextAlign;
  svgContent: string | null;
  svgFileName: string | null;
  svgScale: number; // 0.1 to 3.0

  // Font
  fontFamily: FontFamily;
  customFontName: string | null;
  customFontUrl: string | null;
  fontWeight: FontWeight;
  fontSize: number; // 10 to 300
  letterSpacing: number; // -20 to 100
  lineHeight: number; // 0.8 to 3.0

  // Transform
  transform: TransformSettings;

  // Color
  color: ColorSettings;

  // Effect
  activeEffect: EffectType;
  dither: DitherSettings;
  line: LineSettings;
  slice: SliceSettings;
  boom: BoomSettings;
  crack: CrackSettings;

  // Artboard
  artboardWidth: number;
  artboardHeight: number;

  // Export
  exportScale: 1 | 2 | 3 | 4;

  // Language
  language: "en" | "ko";
}
