import { AnimationTrack, Keyframe, AnimProperty, EasingType } from './types';

const sortedKeyframesCache = new WeakMap<AnimationTrack, { length: number; keyframes: Keyframe[] }>();
const tracksByElementCache = new WeakMap<AnimationTrack[], Map<string, AnimationTrack[]>>();

function finiteNumber(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function getSortedKeyframes(track: AnimationTrack): Keyframe[] {
  const cached = sortedKeyframesCache.get(track);
  if (cached && cached.length === track.keyframes.length) return cached.keyframes;

  const keyframes = [...track.keyframes].sort((a, b) => a.time - b.time);
  sortedKeyframesCache.set(track, { length: keyframes.length, keyframes });
  return keyframes;
}

function getTracksByElement(tracks: AnimationTrack[]): Map<string, AnimationTrack[]> {
  const cached = tracksByElementCache.get(tracks);
  if (cached) return cached;

  const grouped = new Map<string, AnimationTrack[]>();
  tracks.forEach((track) => {
    const elementTracks = grouped.get(track.elementId);
    if (elementTracks) elementTracks.push(track);
    else grouped.set(track.elementId, [track]);
  });
  tracksByElementCache.set(tracks, grouped);
  return grouped;
}

// Easing mathematical functions
export function evaluateEasing(type: EasingType, t: number, bezier?: [number, number, number, number]): number {
  const clampT = Math.max(0, Math.min(1, t));

  switch (type) {
    case 'linear':
      return clampT;
    case 'easeIn':
      return clampT * clampT * clampT;
    case 'easeOut':
      return 1 - Math.pow(1 - clampT, 3);
    case 'easeInOut':
      return clampT < 0.5 ? 4 * clampT * clampT * clampT : 1 - Math.pow(-2 * clampT + 2, 3) / 2;
    case 'backIn': {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return c3 * clampT * clampT * clampT - c1 * clampT * clampT;
    }
    case 'backOut': {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(clampT - 1, 3) + c1 * Math.pow(clampT - 1, 2);
    }
    case 'backInOut': {
      const c1 = 1.70158;
      const c2 = c1 * 1.525;
      return clampT < 0.5
        ? (Math.pow(2 * clampT, 2) * ((c2 + 1) * 2 * clampT - c2)) / 2
        : (Math.pow(2 * clampT - 2, 2) * ((c2 + 1) * (clampT * 2 - 2) + c2) + 2) / 2;
    }
    case 'elasticOut': {
      const c4 = (2 * Math.PI) / 3;
      return clampT === 0 ? 0 : clampT === 1 ? 1 : Math.pow(2, -10 * clampT) * Math.sin((clampT * 10 - 0.75) * c4) + 1;
    }
    case 'bounceOut': {
      const n1 = 7.5625;
      const d1 = 2.75;
      let p = clampT;
      if (p < 1 / d1) {
        return n1 * p * p;
      } else if (p < 2 / d1) {
        p -= 1.5 / d1;
        return n1 * p * p + 0.75;
      } else if (p < 2.5 / d1) {
        p -= 2.25 / d1;
        return n1 * p * p + 0.9375;
      } else {
        p -= 2.625 / d1;
        return n1 * p * p + 0.984375;
      }
    }
    case 'custom':
      if (bezier && bezier.length === 4) {
        return solveCubicBezier(bezier[0], bezier[1], bezier[2], bezier[3], clampT);
      }
      return clampT;
    default:
      return clampT;
  }
}

// Simple Newton-Raphson solver for cubic bezier curve
function solveCubicBezier(x1: number, y1: number, x2: number, y2: number, x: number): number {
  let t = x;
  for (let i = 0; i < 5; i++) {
    const currentX = 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
    const dx = 3 * (1 - t) * (1 - t) * x1 + 6 * (1 - t) * t * (x2 - x1) + 3 * t * t * (1 - x2);
    if (Math.abs(currentX - x) < 0.001 || Math.abs(dx) < 0.0001) break;
    t -= (currentX - x) / dx;
    t = Math.max(0, Math.min(1, t));
  }
  return 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
}

export function interpolateTrackValue(track: AnimationTrack, time: number, defaultValue: number | string): number | string {
  if (!track || !track.keyframes || track.keyframes.length === 0) {
    return defaultValue;
  }

  const sorted = getSortedKeyframes(track);

  if (time <= sorted[0].time) {
    return sorted[0].value;
  }

  if (time >= sorted[sorted.length - 1].time) {
    return sorted[sorted.length - 1].value;
  }

  // Find surrounding keyframes
  for (let i = 0; i < sorted.length - 1; i++) {
    const kfA = sorted[i];
    const kfB = sorted[i + 1];

    if (time >= kfA.time && time <= kfB.time) {
      const duration = kfB.time - kfA.time;
      if (duration <= 0.0001) return kfB.value;

      const progress = (time - kfA.time) / duration;
      const eased = evaluateEasing(kfA.easing, progress, kfA.bezier);

      if (typeof kfA.value === 'number' && typeof kfB.value === 'number') {
        return kfA.value + (kfB.value - kfA.value) * eased;
      }

      // String fallback (e.g. colors or visibility)
      return progress < 0.5 ? kfA.value : kfB.value;
    }
  }

  return defaultValue;
}

export interface ComputedElementStyles {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
  skewX: number;
  skewY: number;
  originX: number;
  originY: number;
  strokeDashoffset?: number;
  strokeWidth?: number;
  fill?: string;
  stroke?: string;
}

export function computeElementStylesAtTime(
  tracks: AnimationTrack[],
  elementId: string,
  time: number,
  initialTransform?: {
    x?: number;
    y?: number;
    rotation?: number;
    scaleX?: number;
    scaleY?: number;
    skewX?: number;
    skewY?: number;
    originX?: number;
    originY?: number;
  },
  initialAppearance?: {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    opacity?: number;
    strokeDashoffset?: number;
  }
): ComputedElementStyles {
  const elementTracks = getTracksByElement(tracks).get(elementId) || [];

  const getProp = (prop: AnimProperty, fallback: number | string): any => {
    const track = elementTracks.find((t) => t.property === prop);
    if (!track) return fallback;
    return interpolateTrackValue(track, time, fallback);
  };

  const defaultX = finiteNumber(initialTransform?.x, 0);
  const defaultY = finiteNumber(initialTransform?.y, 0);
  const defaultRotation = finiteNumber(initialTransform?.rotation, 0);
  const defaultScaleX = finiteNumber(initialTransform?.scaleX, 100);
  const defaultScaleY = finiteNumber(initialTransform?.scaleY, 100);
  const defaultSkewX = finiteNumber(initialTransform?.skewX, 0);
  const defaultSkewY = finiteNumber(initialTransform?.skewY, 0);
  const defaultOpacity = finiteNumber(
    initialAppearance?.opacity === undefined ? 100 : initialAppearance.opacity * 100,
    100
  );
  const defaultOriginX = finiteNumber(initialTransform?.originX, 50);
  const defaultOriginY = finiteNumber(initialTransform?.originY, 50);
  const x = finiteNumber(getProp('x', defaultX), defaultX);
  const y = finiteNumber(getProp('y', defaultY), defaultY);
  const rotation = finiteNumber(getProp('rotation', defaultRotation), defaultRotation);
  const scaleX = finiteNumber(getProp('scaleX', defaultScaleX), defaultScaleX);
  const scaleY = finiteNumber(getProp('scaleY', defaultScaleY), defaultScaleY);
  const skewX = finiteNumber(getProp('skewX', defaultSkewX), defaultSkewX);
  const skewY = finiteNumber(getProp('skewY', defaultSkewY), defaultSkewY);
  const opacity = finiteNumber(getProp('opacity', defaultOpacity), defaultOpacity);
  const originX = finiteNumber(getProp('originX', defaultOriginX), defaultOriginX);
  const originY = finiteNumber(getProp('originY', defaultOriginY), defaultOriginY);

  const strokeDashoffsetTrack = elementTracks.find((t) => t.property === 'strokeDashoffset');
  const strokeDashoffset = strokeDashoffsetTrack
    ? Number(interpolateTrackValue(strokeDashoffsetTrack, time, initialAppearance?.strokeDashoffset ?? 0))
    : initialAppearance?.strokeDashoffset;

  const strokeWidthTrack = elementTracks.find((t) => t.property === 'strokeWidth');
  const strokeWidth = strokeWidthTrack
    ? Number(interpolateTrackValue(strokeWidthTrack, time, initialAppearance?.strokeWidth ?? 1))
    : initialAppearance?.strokeWidth;

  const fillTrack = elementTracks.find((t) => t.property === 'fill');
  const fill = fillTrack ? String(interpolateTrackValue(fillTrack, time, initialAppearance?.fill ?? '')) : initialAppearance?.fill;

  const strokeTrack = elementTracks.find((t) => t.property === 'stroke');
  const stroke = strokeTrack ? String(interpolateTrackValue(strokeTrack, time, initialAppearance?.stroke ?? '')) : initialAppearance?.stroke;

  return {
    x,
    y,
    rotation,
    scaleX,
    scaleY,
    opacity,
    skewX,
    skewY,
    originX,
    originY,
    strokeDashoffset,
    strokeWidth,
    fill,
    stroke,
  };
}

export function applyComputedStylesToElement(domElement: SVGElement, styles: ComputedElementStyles) {
  // Transform string
  const transform = `translate(${styles.x}px, ${styles.y}px) rotate(${styles.rotation}deg) scale(${styles.scaleX / 100}, ${styles.scaleY / 100}) skewX(${styles.skewX}deg) skewY(${styles.skewY}deg)`;

  domElement.style.transform = transform;
  domElement.style.transformOrigin = `${styles.originX}% ${styles.originY}%`;
  domElement.style.transformBox = 'fill-box';
  domElement.style.opacity = `${Math.max(0, Math.min(1, styles.opacity / 100))}`;

  if (styles.strokeDashoffset !== undefined) {
    domElement.style.strokeDashoffset = `${styles.strokeDashoffset}`;
  }
  if (styles.strokeWidth !== undefined) {
    domElement.style.strokeWidth = `${styles.strokeWidth}px`;
  }
  if (styles.fill) {
    domElement.style.fill = styles.fill;
  }
  if (styles.stroke) {
    domElement.style.stroke = styles.stroke;
  }
}
