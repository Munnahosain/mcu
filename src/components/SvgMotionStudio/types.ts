export type SvgTagName =
  | 'path'
  | 'rect'
  | 'circle'
  | 'ellipse'
  | 'polygon'
  | 'polyline'
  | 'line'
  | 'text'
  | 'image'
  | 'g'
  | 'svg'
  | 'use'
  | 'defs'
  | 'mask'
  | 'clipPath';

export type SvgPrimitiveKind = 'text' | 'rect' | 'circle' | 'ellipse' | 'triangle';

export type CharacterSlot =
  | 'head'
  | 'body'
  | 'left_arm'
  | 'right_arm'
  | 'left_leg'
  | 'right_leg'
  | 'eyes'
  | 'mouth'
  | 'hair';

export type AnimProperty =
  | 'x'
  | 'y'
  | 'rotation'
  | 'scaleX'
  | 'scaleY'
  | 'opacity'
  | 'skewX'
  | 'skewY'
  | 'fill'
  | 'stroke'
  | 'strokeWidth'
  | 'strokeDashoffset'
  | 'originX'
  | 'originY';

export type EasingType =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'backIn'
  | 'backOut'
  | 'backInOut'
  | 'elasticOut'
  | 'bounceOut'
  | 'custom'
  | 'cubicBezier';

export type KeyframeInterpolation = 'linear' | 'bezier' | 'hold';

export interface BezierHandles {
  out: { x: number; y: number };
  in: { x: number; y: number };
}

export interface Keyframe {
  id: string;
  time: number; // in seconds
  value: number | string;
  easing: EasingType;
  interpolation?: KeyframeInterpolation;
  bezier?: [number, number, number, number];
  bezierHandles?: BezierHandles;
}

export interface KeyframeClipboardEntry {
  property: AnimProperty;
  offset: number;
  value: number | string;
  easing: EasingType;
  interpolation?: KeyframeInterpolation;
  bezier?: [number, number, number, number];
}

export interface AnimationTrack {
  id: string;
  elementId: string;
  property: AnimProperty;
  keyframes: Keyframe[];
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SvgElementNode {
  id: string; // Internal mcu_el_... id
  originalId: string; // from svg if present
  tagName: SvgTagName;
  name: string; // user-friendly label
  textContent?: string;
  isTextEditable?: boolean;
  className?: string;
  attributes?: Record<string, string>;
  parentId: string | null;
  animParentId?: string | null;
  children: SvgElementNode[];
  isGroup: boolean;
  visible: boolean;
  locked: boolean;
  inPoint?: number;
  outPoint?: number;
  colorLabel?: number;
  solo?: boolean;
  shy?: boolean;
  motionBlur?: boolean;
  blendMode?: 'normal' | 'multiply' | 'screen' | 'overlay' | 'add';
  semanticSlot?: CharacterSlot;
  bbox?: BoundingBox;
  initialTransform?: {
    x: number;
    y: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
    skewX: number;
    skewY: number;
    originX: number;
    originY: number;
  };
  initialAppearance?: {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    opacity?: number;
    strokeDasharray?: string;
    strokeDashoffset?: number;
    filter?: string;
  };
  pathLength?: number;
}

export interface DocumentSettings {
  width: number;
  height: number;
  viewBox: { x: number; y: number; width: number; height: number };
  backgroundColor: string; // 'transparent', '#0e1015', '#ffffff', etc.
  fps: number; // 12, 24, 30, 60
  duration: number; // in seconds
  loop: boolean;
  name: string;
}

export interface RasterImageSource {
  dataUrl: string;
  width: number;
  height: number;
  name: string;
  elementOriginalId: string;
  x: number;
  y: number;
  displayWidth: number;
  displayHeight: number;
}

export interface ProjectMarker {
  id: string;
  time: number;
  label: string;
}

export interface WorkArea {
  start: number;
  end: number;
}

export interface CompositionInfo {
  id: string;
  name: string;
  width: number;
  height: number;
  duration: number;
  fps: number;
}

export interface ProjectItem {
  id: string;
  name: string;
  type: 'composition' | 'folder' | 'svg' | 'image';
  kind?: 'composition' | 'folder' | 'svg' | 'image';
  parentId?: string | null;
  size?: number;
  width?: number;
  height?: number;
  dataUrl?: string;
  svgText?: string;
  layerId?: string;
  layerIds?: string[];
  createdAt?: string;
}

export interface ProjectState {
  version: string;
  name: string;
  document: DocumentSettings;
  svgRaw: string;
  rasterSources?: RasterImageSource[];
  elements: SvgElementNode[];
  tracks: AnimationTrack[];
  aiAnimationBaseTracks?: AnimationTrack[] | null;
  aiAnimationBaseDocument?: DocumentSettings | null;
  characterSlots: Partial<Record<CharacterSlot, string>>; // slot -> elementId
  isSingleFlattenedPath: boolean;
  selectedElementId: string | null;
  selectedElementIds?: string[];
  selectedKeyframeId: string | null;
  selectedKeyframeIds?: string[];
  currentTime: number; // 0 to duration
  isPlaying: boolean;
  autoKeyframe?: boolean;
  defaultEasing?: EasingType;
  markers?: ProjectMarker[];
  workArea?: WorkArea;
  compositions?: CompositionInfo[];
  projectItems?: ProjectItem[];
}

export interface AnimationPreset {
  id: string;
  name: string;
  description: string;
  category: 'general' | 'entrance' | 'exit' | 'loop' | 'character' | 'path';
  apply: (elementId: string, duration: number, playhead: number) => AnimationTrack[];
}

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type?: 'success' | 'info' | 'warning' | 'error';
}
