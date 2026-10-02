import { AnimProperty, AnimationTrack, EasingType, Keyframe } from './types';

export interface EasingPreset {
  id: EasingType;
  label: string;
  shortLabel: string;
  description: string;
  shortcut?: string;
  curveSvgPath: string; // SVG path for mini curve thumbnail
}

export const EASING_PRESETS: EasingPreset[] = [
  {
    id: 'easeInOut',
    label: 'Easy Ease',
    shortLabel: 'Ease In/Out',
    description: 'Smooth organic acceleration and deceleration (After Effects F9)',
    shortcut: 'F9',
    curveSvgPath: 'M 2 18 C 8 18, 8 2, 18 2',
  },
  {
    id: 'easeOut',
    label: 'Ease Out',
    shortLabel: 'Ease Out',
    description: 'Fast energetic start, softly gliding to a stop',
    shortcut: 'Ctrl+Shift+F9',
    curveSvgPath: 'M 2 18 C 2 2, 10 2, 18 2',
  },
  {
    id: 'easeIn',
    label: 'Ease In',
    shortLabel: 'Ease In',
    description: 'Starts slowly with anticipation, accelerating to finish',
    shortcut: 'Shift+F9',
    curveSvgPath: 'M 2 18 C 10 18, 18 18, 18 2',
  },
  {
    id: 'linear',
    label: 'Linear',
    shortLabel: 'Linear',
    description: 'Uniform mechanical speed from start to finish',
    curveSvgPath: 'M 2 18 L 18 2',
  },
  {
    id: 'backOut',
    label: 'Back / Pop',
    shortLabel: 'Overshoot',
    description: 'Overshoots the target value slightly then snaps back',
    curveSvgPath: 'M 2 18 C 6 12, 12 -4, 18 2',
  },
  {
    id: 'bounceOut',
    label: 'Bounce',
    shortLabel: 'Bounce',
    description: 'Dynamic impact with decaying bounces',
    curveSvgPath: 'M 2 18 C 6 2, 8 2, 10 2 C 11 10, 13 10, 14 2 C 15 5, 17 5, 18 2',
  },
  {
    id: 'elasticOut',
    label: 'Spring / Elastic',
    shortLabel: 'Spring',
    description: 'Organic rubbery oscillation before settling',
    curveSvgPath: 'M 2 18 C 6 -3, 9 6, 12 0 C 14 3, 16 1, 18 2',
  },
];

export function generateKeyframeId(): string {
  return `kf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

export function generateTrackId(prop: AnimProperty): string {
  return `trk_${Date.now()}_${prop}`;
}

/**
 * Record or update a single property keyframe on a track
 */
export function recordPropertyKeyframe(
  tracks: AnimationTrack[],
  elementId: string,
  property: AnimProperty,
  value: number | string,
  time: number,
  easing: EasingType = 'easeInOut'
): AnimationTrack[] {
  const updatedTracks = [...tracks];
  let track = updatedTracks.find((t) => t.elementId === elementId && t.property === property);

  if (!track) {
    track = {
      id: generateTrackId(property),
      elementId,
      property,
      keyframes: [],
    };
    updatedTracks.push(track);
  }

  const existingIndex = track.keyframes.findIndex(
    (k) => Math.abs(k.time - time) < 0.04
  );

  if (existingIndex >= 0) {
    // Update existing keyframe value while preserving easing
    track.keyframes[existingIndex] = {
      ...track.keyframes[existingIndex],
      value,
    };
  } else {
    // Add new keyframe with easing
    track.keyframes.push({
      id: generateKeyframeId(),
      time,
      value,
      easing,
    });
    track.keyframes.sort((a, b) => a.time - b.time);
  }

  return updatedTracks;
}

/**
 * Record keyframes for all major transform properties (scale, rotation, opacity, position)
 */
export function recordAllTransformKeyframes(
  tracks: AnimationTrack[],
  elementId: string,
  values: {
    scaleX?: number;
    scaleY?: number;
    rotation?: number;
    opacity?: number;
    x?: number;
    y?: number;
  },
  time: number,
  easing: EasingType = 'easeInOut'
): AnimationTrack[] {
  let result = [...tracks];

  const propsToRecord: Array<{ prop: AnimProperty; val: number | undefined }> = [
    { prop: 'scaleX', val: values.scaleX },
    { prop: 'scaleY', val: values.scaleY },
    { prop: 'rotation', val: values.rotation },
    { prop: 'opacity', val: values.opacity },
    { prop: 'x', val: values.x },
    { prop: 'y', val: values.y },
  ];

  propsToRecord.forEach(({ prop, val }) => {
    if (val !== undefined) {
      result = recordPropertyKeyframe(result, elementId, prop, val, time, easing);
    }
  });

  return result;
}

/**
 * Check if an element has a keyframe at the specified playhead time
 */
export function hasKeyframeAtTime(
  tracks: AnimationTrack[],
  elementId: string,
  property: AnimProperty,
  time: number
): boolean {
  const track = tracks.find((t) => t.elementId === elementId && t.property === property);
  if (!track) return false;
  return track.keyframes.some((k) => Math.abs(k.time - time) < 0.04);
}

/**
 * Find adjacent keyframes around playhead (Previous / Next navigation)
 */
export function getAdjacentKeyframes(
  tracks: AnimationTrack[],
  elementId: string | null,
  currentTime: number,
  specificProperty?: AnimProperty
): {
  prevTime: number | null;
  nextTime: number | null;
  hasAtCurrent: boolean;
} {
  const allTimes = new Set<number>();
  let hasAtCurrent = false;

  tracks.forEach((track) => {
    if (elementId && track.elementId !== elementId) return;
    if (specificProperty && track.property !== specificProperty) return;

    track.keyframes.forEach((k) => {
      allTimes.add(Math.round(k.time * 100) / 100);
      if (Math.abs(k.time - currentTime) < 0.04) {
        hasAtCurrent = true;
      }
    });
  });

  const sortedTimes = Array.from(allTimes).sort((a, b) => a - b);
  const roundedCur = Math.round(currentTime * 100) / 100;

  let prevTime: number | null = null;
  let nextTime: number | null = null;

  for (const t of sortedTimes) {
    if (t < roundedCur - 0.04) {
      prevTime = t;
    } else if (t > roundedCur + 0.04 && nextTime === null) {
      nextTime = t;
    }
  }

  return { prevTime, nextTime, hasAtCurrent };
}

/**
 * Batch update easing for all keyframes in an element's transform tracks
 */
export function applyEasingToElementTransforms(
  tracks: AnimationTrack[],
  elementId: string,
  easing: EasingType
): AnimationTrack[] {
  const transformProps: AnimProperty[] = ['scaleX', 'scaleY', 'rotation', 'opacity', 'x', 'y'];

  return tracks.map((track) => {
    if (track.elementId === elementId && transformProps.includes(track.property)) {
      return {
        ...track,
        keyframes: track.keyframes.map((kf) => ({ ...kf, easing })),
      };
    }
    return track;
  });
}

/**
 * Apply easing to all keyframes across the entire project
 */
export function applyEasingToAllTracks(
  tracks: AnimationTrack[],
  easing: EasingType
): AnimationTrack[] {
  return tracks.map((track) => ({
    ...track,
    keyframes: track.keyframes.map((kf) => ({ ...kf, easing })),
  }));
}
