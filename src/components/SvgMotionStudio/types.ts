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
  | 'custom';

export interface Keyframe {
  id: string;
  time: number; // in seconds
  value: number | string;
  easing: EasingType;
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
  className?: string;
  attributes?: Record<string, string>;
  parentId: string | null;
  children: SvgElementNode[];
  isGroup: boolean;
  visible: boolean;
  locked: boolean;
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

export interface ProjectState {
  version: string;
  name: string;
  document: DocumentSettings;
  svgRaw: string;
  elements: SvgElementNode[];
  tracks: AnimationTrack[];
  aiAnimationBaseTracks?: AnimationTrack[] | null;
  aiAnimationBaseDocument?: DocumentSettings | null;
  characterSlots: Partial<Record<CharacterSlot, string>>; // slot -> elementId
  isSingleFlattenedPath: boolean;
  selectedElementId: string | null;
  selectedKeyframeId: string | null;
  selectedKeyframeIds?: string[];
  currentTime: number; // 0 to duration
  isPlaying: boolean;
  autoKeyframe?: boolean;
  defaultEasing?: EasingType;
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
