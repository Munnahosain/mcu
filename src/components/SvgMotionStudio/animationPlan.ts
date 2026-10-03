import { AnimProperty, AnimationTrack, EasingType, Keyframe, SvgElementNode } from './types';
import { flattenElementTree } from './svgParser';

export type AnimationPlanProperty = AnimProperty | 'transform';
export type TransformFrameValue = Partial<Record<'x' | 'y' | 'rotation' | 'scaleX' | 'scaleY' | 'skewX' | 'skewY' | 'opacity', number>>;
export type AnimationValue = number | string | TransformFrameValue;

export interface AnimationPlanKeyframe {
  time: number;
  value: AnimationValue;
}

export interface AnimationPlanAnimation {
  target: string;
  property: AnimationPlanProperty;
  keyframes: AnimationPlanKeyframe[];
  easing: EasingType;
}

export interface AnimationPlanJson {
  duration: number;
  fps: number;
  loop: boolean;
  description: string;
  animations: AnimationPlanAnimation[];
}

export interface AiAnimationPlan extends AnimationPlanJson {
  prompt: string;
  summary: string[];
  tracks: AnimationTrack[];
}

export interface AnimationTarget {
  id: string;
  originalId?: string;
  name: string;
}

const EASINGS = new Set<EasingType>([
  'linear', 'easeIn', 'easeOut', 'easeInOut', 'backIn', 'backOut', 'backInOut',
  'elasticOut', 'bounceOut', 'custom',
]);
const PROPERTIES = new Set<AnimProperty>([
  'x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity', 'skewX', 'skewY',
  'fill', 'stroke', 'strokeWidth', 'strokeDashoffset', 'originX', 'originY',
]);
const TRANSFORM_PROPERTIES: Array<keyof TransformFrameValue> = [
  'x', 'y', 'rotation', 'scaleX', 'scaleY', 'skewX', 'skewY', 'opacity',
];
const ID_PREFIX = `ai_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
let idCounter = 0;

function nextId(prefix: 'trk' | 'kf') {
  idCounter += 1;
  return `${prefix}_${ID_PREFIX}_${idCounter}`;
}

function fail(message: string): never {
  throw new Error(message);
}

function parseAnimationValue(property: AnimProperty, value: unknown): number | string {
  if (property === 'fill' || property === 'stroke') {
    if (typeof value !== 'string' || value.length > 64) fail(`Invalid ${property} color value.`);
    const color = value.trim();
    const validColor = /^(#[\da-f]{3,8}|[a-z]{1,24}|(?:rgb|rgba|hsl|hsla)\([\d.%\s,+/-]+\))$/i.test(color);
    if (!validColor) fail(`Invalid ${property} color value.`);
    return color;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(`Animation value for ${property} must be a finite number.`);
  }

  const limits: Partial<Record<AnimProperty, [number, number]>> = {
    x: [-100000, 100000],
    y: [-100000, 100000],
    rotation: [-360000, 360000],
    scaleX: [0, 400],
    scaleY: [0, 400],
    opacity: [0, 100],
    skewX: [-89, 89],
    skewY: [-89, 89],
    strokeWidth: [0, 200],
    strokeDashoffset: [-100000, 100000],
    originX: [0, 100],
    originY: [0, 100],
  };
  const range = limits[property];
  if (range && (value < range[0] || value > range[1])) {
    fail(`Animation value for ${property} must be between ${range[0]} and ${range[1]}.`);
  }
  return value;
}

function valuesMatch(property: AnimProperty, first: number | string, last: number | string) {
  if (property === 'rotation' && typeof first === 'number' && typeof last === 'number') {
    return Math.abs((last - first) % 360) < 0.001;
  }
  return first === last || (typeof first === 'number' && typeof last === 'number' && Math.abs(first - last) < 0.001);
}

function normalizeKeyframes(
  property: AnimProperty,
  frames: AnimationPlanKeyframe[],
  duration: number,
  loop: boolean,
  easing: EasingType
): Keyframe[] {
  if (!Array.isArray(frames) || frames.length < 2 || frames.length > 32) {
    fail(`Each ${property} animation must contain 2 to 32 keyframes.`);
  }

  const parsed = frames.map((frame) => {
    if (!frame || typeof frame !== 'object' || !Number.isFinite(frame.time) || frame.time < 0 || frame.time > duration) {
      fail(`Keyframe times for ${property} must be within the animation duration.`);
    }
    return {
      id: nextId('kf'),
      time: frame.time,
      value: parseAnimationValue(property, frame.value),
      easing,
    } satisfies Keyframe;
  }).sort((a, b) => a.time - b.time);

  for (let i = 1; i < parsed.length; i += 1) {
    if (Math.abs(parsed[i].time - parsed[i - 1].time) < 0.0001) {
      fail(`Duplicate keyframe times are not allowed for ${property}.`);
    }
  }

  if (!loop) return parsed;

  const first = parsed[0];
  if (first.time > 0) parsed.unshift({ ...first, id: nextId('kf'), time: 0 });

  const firstValue = parsed[0].value;
  const finalIndex = parsed.length - 1;
  if (parsed[finalIndex].time < duration) {
    parsed.push({ ...parsed[0], id: nextId('kf'), time: duration });
  } else if (!valuesMatch(property, firstValue, parsed[finalIndex].value)) {
    parsed[finalIndex] = { ...parsed[finalIndex], value: firstValue };
  }
  return parsed;
}

function resolveTarget(target: string, targets: AnimationTarget[]): AnimationTarget {
  const value = target.trim();
  const exact = targets.find((item) => item.id === value || item.originalId === value);
  if (exact) return exact;
  const named = targets.filter((item) => item.name.toLowerCase() === value.toLowerCase());
  if (named.length === 1) return named[0];
  fail('AI referenced an unavailable SVG element. Please regenerate the animation.');
}

export function getAnimationTargets(elements: SvgElementNode[]): AnimationTarget[] {
  return flattenElementTree(elements).map(({ id, originalId, name }) => ({ id, originalId, name }));
}

export function validateAnimationPlan(
  input: unknown,
  targets: AnimationTarget[],
  prompt = ''
): AiAnimationPlan {
  if (!input || typeof input !== 'object') fail('The AI returned an invalid animation plan. Please regenerate.');
  const candidate = input as Partial<AnimationPlanJson>;
  const duration = candidate.duration;
  const fps = candidate.fps;
  const loop = candidate.loop;
  const description = typeof candidate.description === 'string' ? candidate.description.trim().slice(0, 500) : '';

  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration < 1 || duration > 30) {
    fail('Animation duration must be between 1 and 30 seconds.');
  }
  if (typeof fps !== 'number' || !Number.isInteger(fps) || ![12, 24, 30, 60].includes(fps)) {
    fail('Animation frame rate must be 12, 24, 30, or 60 FPS.');
  }
  if (typeof loop !== 'boolean') fail('The animation plan must specify whether it loops.');
  if (!Array.isArray(candidate.animations) || candidate.animations.length === 0 || candidate.animations.length > 100) {
    fail('The AI did not return any usable animations. Please regenerate.');
  }

  const normalizedAnimations: AnimationPlanAnimation[] = [];
  const tracksByKey = new Map<string, AnimationTrack>();
  const addTrack = (track: AnimationTrack) => {
    const key = `${track.elementId}:${track.property}`;
    if (tracksByKey.has(key)) fail(`The plan contains duplicate ${track.property} animations for one SVG element.`);
    tracksByKey.set(key, track);
  };

  for (const animation of candidate.animations) {
    if (!animation || typeof animation !== 'object' || typeof animation.target !== 'string') {
      fail('An animation is missing its target SVG element.');
    }
    const target = resolveTarget(animation.target, targets);
    const property = animation.property;
    if (property !== 'transform' && !PROPERTIES.has(property as AnimProperty)) {
      fail(`Unsupported animation property: ${String(property)}.`);
    }
    if (animation.easing !== undefined && !EASINGS.has(animation.easing as EasingType)) {
      fail(`Unsupported easing: ${String(animation.easing)}.`);
    }
    const easing = animation.easing ?? 'easeInOut';

    if (property === 'transform') {
      if (!Array.isArray(animation.keyframes) || animation.keyframes.length < 2 || animation.keyframes.length > 32) {
        fail('Each transform animation must contain 2 to 32 keyframes.');
      }
      const componentFrames = new Map<keyof TransformFrameValue, AnimationPlanKeyframe[]>();
      animation.keyframes.forEach((frame) => {
        if (!frame || typeof frame !== 'object' || !Number.isFinite(frame.time) || frame.time < 0 || frame.time > duration) {
          fail('Transform keyframe times must be within the animation duration.');
        }
        if (!frame.value || typeof frame.value !== 'object' || Array.isArray(frame.value)) {
          fail('Transform keyframes must contain a structured transform object.');
        }
        const value = frame.value as Record<string, unknown>;
        const cleanValue: TransformFrameValue = {};
        for (const [key, rawValue] of Object.entries(value)) {
          if (!TRANSFORM_PROPERTIES.includes(key as keyof TransformFrameValue)) {
            fail(`Unsupported transform component: ${key}.`);
          }
          cleanValue[key as keyof TransformFrameValue] = parseAnimationValue(key as AnimProperty, rawValue) as number;
        }
        if (Object.keys(cleanValue).length === 0) fail('Transform keyframes must animate at least one component.');
        for (const component of Object.keys(cleanValue) as Array<keyof TransformFrameValue>) {
          const keyframes = componentFrames.get(component) ?? [];
          keyframes.push({ time: frame.time, value: cleanValue[component]! });
          componentFrames.set(component, keyframes);
        }
      });

      for (const [component, frames] of componentFrames) {
        const animProperty = component as AnimProperty;
        const keyframes = normalizeKeyframes(animProperty, frames, duration, loop, easing);
        addTrack({
          id: nextId('trk'),
          elementId: target.id,
          property: animProperty,
          keyframes,
        });
        normalizedAnimations.push({
          target: target.id,
          property: animProperty,
          keyframes: keyframes.map(({ time, value }) => ({ time, value })),
          easing,
        });
      }
      continue;
    }

    const animProperty = property as AnimProperty;
    const keyframes = normalizeKeyframes(animProperty, animation.keyframes, duration, loop, easing);
    normalizedAnimations.push({
      target: target.id,
      property: animProperty,
      keyframes: keyframes.map(({ time, value }) => ({ time, value })),
      easing,
    });
    addTrack({
      id: nextId('trk'),
      elementId: target.id,
      property: animProperty,
      keyframes,
    });
  }

  const animations = Array.from(tracksByKey.values());
  if (animations.length === 0) fail('The AI did not return any supported animation properties.');

  return {
    prompt,
    description: description || 'Abstract SVG motion animation',
    summary: normalizedAnimations.map((item) => `${targets.find((target) => target.id === item.target)?.name ?? item.target}: ${item.property} (${item.keyframes.length} keyframes)`),
    duration,
    fps,
    loop,
    animations: normalizedAnimations,
    tracks: animations,
  };
}

export function planJson(plan: AiAnimationPlan): AnimationPlanJson {
  return {
    duration: plan.duration,
    fps: plan.fps,
    loop: plan.loop,
    description: plan.description,
    animations: plan.animations,
  };
}
