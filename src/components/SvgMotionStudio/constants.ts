import { CharacterSlot, AnimProperty, EasingType } from './types';

export const CHARACTER_SLOT_LABELS: Record<CharacterSlot, { label: string; icon: string; description: string }> = {
  head: { label: 'Head', icon: 'Smile', description: 'Face, skull, and main head mass' },
  body: { label: 'Body / Torso', icon: 'Shirt', description: 'Core torso or body foundation' },
  left_arm: { label: 'Left Arm', icon: 'HandMetal', description: 'Left upper arm, forearm, hand' },
  right_arm: { label: 'Right Arm', icon: 'Hand', description: 'Right upper arm, forearm, hand' },
  left_leg: { label: 'Left Leg', icon: 'Footprints', description: 'Left thigh, shin, foot' },
  right_leg: { label: 'Right Leg', icon: 'Footprints', description: 'Right thigh, shin, foot' },
  eyes: { label: 'Eyes', icon: 'Eye', description: 'Left & right eyes, pupils' },
  mouth: { label: 'Mouth', icon: 'MessageCircle', description: 'Mouth / lips for speech & expression' },
  hair: { label: 'Hair', icon: 'Sparkles', description: 'Hair strands or head accessory' },
};

export const ANIMATABLE_PROPERTIES: {
  key: AnimProperty;
  label: string;
  unit: string;
  min?: number;
  max?: number;
  step?: number;
  defaultValue: number | string;
}[] = [
  { key: 'x', label: 'Position X', unit: 'px', step: 1, defaultValue: 0 },
  { key: 'y', label: 'Position Y', unit: 'px', step: 1, defaultValue: 0 },
  { key: 'rotation', label: 'Rotation', unit: '°', min: -360, max: 360, step: 1, defaultValue: 0 },
  { key: 'scaleX', label: 'Scale X', unit: '%', min: 0, max: 500, step: 1, defaultValue: 100 },
  { key: 'scaleY', label: 'Scale Y', unit: '%', min: 0, max: 500, step: 1, defaultValue: 100 },
  { key: 'opacity', label: 'Opacity', unit: '%', min: 0, max: 100, step: 1, defaultValue: 100 },
  { key: 'skewX', label: 'Skew X', unit: '°', min: -85, max: 85, step: 1, defaultValue: 0 },
  { key: 'skewY', label: 'Skew Y', unit: '°', min: -85, max: 85, step: 1, defaultValue: 0 },
  { key: 'originX', label: 'Origin X', unit: '%', min: 0, max: 100, step: 1, defaultValue: 50 },
  { key: 'originY', label: 'Origin Y', unit: '%', min: 0, max: 100, step: 1, defaultValue: 50 },
  { key: 'strokeDashoffset', label: 'Dash Offset', unit: 'px', step: 1, defaultValue: 0 },
  { key: 'strokeWidth', label: 'Stroke Width', unit: 'px', min: 0, max: 100, step: 0.5, defaultValue: 1 },
];

export const EASING_OPTIONS: { label: string; value: EasingType; curveName: string }[] = [
  { label: 'Linear', value: 'linear', curveName: 'Linear interpolation' },
  { label: 'Ease In', value: 'easeIn', curveName: 'Accelerate from zero' },
  { label: 'Ease Out', value: 'easeOut', curveName: 'Decelerate to zero' },
  { label: 'Ease In Out', value: 'easeInOut', curveName: 'Smooth acceleration & deceleration' },
  { label: 'Back In', value: 'backIn', curveName: 'Anticipate backward before moving' },
  { label: 'Back Out', value: 'backOut', curveName: 'Overshoot slightly and settle' },
  { label: 'Back In Out', value: 'backInOut', curveName: 'Overshoot on both ends' },
  { label: 'Elastic Out', value: 'elasticOut', curveName: 'Rubber band oscillation' },
  { label: 'Bounce Out', value: 'bounceOut', curveName: 'Bounces like a dropped ball' },
];

export const KEYBOARD_SHORTCUTS = [
  { key: 'Space', description: 'Play / Pause timeline' },
  { key: 'Delete / Backspace', description: 'Delete selected layer or keyframe' },
  { key: 'Ctrl/Cmd + Z', description: 'Undo last change' },
  { key: 'Ctrl/Cmd + Shift + Z', description: 'Redo' },
  { key: 'Ctrl/Cmd + S', description: 'Save project (.mcuproj)' },
  { key: 'Ctrl/Cmd + D', description: 'Duplicate selected keyframe or layer' },
  { key: 'Arrow keys', description: 'Nudge selected object (1px)' },
  { key: 'Shift + Arrow keys', description: 'Nudge selected object faster (10px)' },
  { key: 'Home / 0', description: 'Rewind to start of timeline' },
  { key: 'K', description: 'Add keyframe at current playhead' },
];

export const DEFAULT_VIEWBOX = { x: 0, y: 0, width: 800, height: 600 };
export const DEFAULT_FPS = 30;
export const DEFAULT_DURATION = 4.0;
