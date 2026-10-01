import { AnimationTrack, Keyframe, AnimProperty, EasingType } from './types';

let trackIdCounter = 1;
function genTrackId(): string {
  return `trk_${Date.now()}_${trackIdCounter++}`;
}

function genKfId(): string {
  return `kf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

export interface PresetDef {
  id: string;
  name: string;
  category: 'entrance' | 'exit' | 'motion' | 'emphasis' | 'svg';
  description: string;
  icon: string;
  createTracks: (elementId: string, duration: number, startTime: number, pathLength?: number) => AnimationTrack[];
}

export const ANIMATION_PRESETS: PresetDef[] = [
  {
    id: 'fade-in',
    name: 'Fade In',
    category: 'entrance',
    description: 'Smooth opacity reveal from 0% to 100%',
    icon: 'Sun',
    createTracks: (elementId, duration, startTime) => {
      const animDur = Math.min(1.0, duration - startTime);
      return [
        {
          id: genTrackId(),
          elementId,
          property: 'opacity',
          keyframes: [
            { id: genKfId(), time: startTime, value: 0, easing: 'easeOut' },
            { id: genKfId(), time: startTime + animDur, value: 100, easing: 'easeOut' },
          ],
        },
      ];
    },
  },
  {
    id: 'fade-out',
    name: 'Fade Out',
    category: 'exit',
    description: 'Fade out to complete transparency',
    icon: 'Moon',
    createTracks: (elementId, duration, startTime) => {
      const animDur = Math.min(1.0, duration - startTime);
      return [
        {
          id: genTrackId(),
          elementId,
          property: 'opacity',
          keyframes: [
            { id: genKfId(), time: startTime, value: 100, easing: 'easeIn' },
            { id: genKfId(), time: startTime + animDur, value: 0, easing: 'easeIn' },
          ],
        },
      ];
    },
  },
  {
    id: 'scale-in',
    name: 'Scale In',
    category: 'entrance',
    description: 'Pop up from scale 0 to 100% with spring overshoot',
    icon: 'Maximize2',
    createTracks: (elementId, duration, startTime) => {
      const animDur = Math.min(1.2, duration - startTime);
      return [
        {
          id: genTrackId(),
          elementId,
          property: 'scaleX',
          keyframes: [
            { id: genKfId(), time: startTime, value: 0, easing: 'backOut' },
            { id: genKfId(), time: startTime + animDur, value: 100, easing: 'backOut' },
          ],
        },
        {
          id: genTrackId(),
          elementId,
          property: 'scaleY',
          keyframes: [
            { id: genKfId(), time: startTime, value: 0, easing: 'backOut' },
            { id: genKfId(), time: startTime + animDur, value: 100, easing: 'backOut' },
          ],
        },
        {
          id: genTrackId(),
          elementId,
          property: 'opacity',
          keyframes: [
            { id: genKfId(), time: startTime, value: 0, easing: 'easeOut' },
            { id: genKfId(), time: startTime + animDur * 0.4, value: 100, easing: 'easeOut' },
          ],
        },
      ];
    },
  },
  {
    id: 'slide-up',
    name: 'Slide Up',
    category: 'entrance',
    description: 'Slide up into place with deceleration',
    icon: 'ArrowUp',
    createTracks: (elementId, duration, startTime) => {
      const animDur = Math.min(1.0, duration - startTime);
      return [
        {
          id: genTrackId(),
          elementId,
          property: 'y',
          keyframes: [
            { id: genKfId(), time: startTime, value: 60, easing: 'easeOut' },
            { id: genKfId(), time: startTime + animDur, value: 0, easing: 'easeOut' },
          ],
        },
        {
          id: genTrackId(),
          elementId,
          property: 'opacity',
          keyframes: [
            { id: genKfId(), time: startTime, value: 0, easing: 'easeOut' },
            { id: genKfId(), time: startTime + animDur * 0.6, value: 100, easing: 'easeOut' },
          ],
        },
      ];
    },
  },
  {
    id: 'slide-down',
    name: 'Slide Down',
    category: 'entrance',
    description: 'Slide downward from above into view',
    icon: 'ArrowDown',
    createTracks: (elementId, duration, startTime) => {
      const animDur = Math.min(1.0, duration - startTime);
      return [
        {
          id: genTrackId(),
          elementId,
          property: 'y',
          keyframes: [
            { id: genKfId(), time: startTime, value: -60, easing: 'easeOut' },
            { id: genKfId(), time: startTime + animDur, value: 0, easing: 'easeOut' },
          ],
        },
      ];
    },
  },
  {
    id: 'slide-left',
    name: 'Slide Left',
    category: 'entrance',
    description: 'Slide in from the right edge',
    icon: 'ArrowLeft',
    createTracks: (elementId, duration, startTime) => {
      const animDur = Math.min(1.0, duration - startTime);
      return [
        {
          id: genTrackId(),
          elementId,
          property: 'x',
          keyframes: [
            { id: genKfId(), time: startTime, value: 80, easing: 'easeOut' },
            { id: genKfId(), time: startTime + animDur, value: 0, easing: 'easeOut' },
          ],
        },
      ];
    },
  },
  {
    id: 'slide-right',
    name: 'Slide Right',
    category: 'entrance',
    description: 'Slide in from the left edge',
    icon: 'ArrowRight',
    createTracks: (elementId, duration, startTime) => {
      const animDur = Math.min(1.0, duration - startTime);
      return [
        {
          id: genTrackId(),
          elementId,
          property: 'x',
          keyframes: [
            { id: genKfId(), time: startTime, value: -80, easing: 'easeOut' },
            { id: genKfId(), time: startTime + animDur, value: 0, easing: 'easeOut' },
          ],
        },
      ];
    },
  },
  {
    id: 'float',
    name: 'Float',
    category: 'motion',
    description: 'Gentle levitating hover loop',
    icon: 'Cloud',
    createTracks: (elementId, duration) => {
      const half = duration / 2;
      return [
        {
          id: genTrackId(),
          elementId,
          property: 'y',
          keyframes: [
            { id: genKfId(), time: 0, value: 0, easing: 'easeInOut' },
            { id: genKfId(), time: half, value: -16, easing: 'easeInOut' },
            { id: genKfId(), time: duration, value: 0, easing: 'easeInOut' },
          ],
        },
      ];
    },
  },
  {
    id: 'pulse',
    name: 'Pulse',
    category: 'emphasis',
    description: 'Smooth heartbeat scale loop',
    icon: 'Activity',
    createTracks: (elementId, duration) => {
      const p1 = duration * 0.25;
      const p2 = duration * 0.5;
      const p3 = duration * 0.75;
      return [
        {
          id: genTrackId(),
          elementId,
          property: 'scaleX',
          keyframes: [
            { id: genKfId(), time: 0, value: 100, easing: 'easeInOut' },
            { id: genKfId(), time: p1, value: 110, easing: 'easeInOut' },
            { id: genKfId(), time: p2, value: 96, easing: 'easeInOut' },
            { id: genKfId(), time: p3, value: 106, easing: 'easeInOut' },
            { id: genKfId(), time: duration, value: 100, easing: 'easeInOut' },
          ],
        },
        {
          id: genTrackId(),
          elementId,
          property: 'scaleY',
          keyframes: [
            { id: genKfId(), time: 0, value: 100, easing: 'easeInOut' },
            { id: genKfId(), time: p1, value: 110, easing: 'easeInOut' },
            { id: genKfId(), time: p2, value: 96, easing: 'easeInOut' },
            { id: genKfId(), time: p3, value: 106, easing: 'easeInOut' },
            { id: genKfId(), time: duration, value: 100, easing: 'easeInOut' },
          ],
        },
      ];
    },
  },
  {
    id: 'rotate',
    name: 'Rotate 360°',
    category: 'motion',
    description: 'Continuous full 360-degree rotation',
    icon: 'RotateCw',
    createTracks: (elementId, duration) => {
      return [
        {
          id: genTrackId(),
          elementId,
          property: 'rotation',
          keyframes: [
            { id: genKfId(), time: 0, value: 0, easing: 'linear' },
            { id: genKfId(), time: duration, value: 360, easing: 'linear' },
          ],
        },
      ];
    },
  },
  {
    id: 'bounce',
    name: 'Bounce',
    category: 'emphasis',
    description: 'Realistic squash & bounce landing',
    icon: 'Zap',
    createTracks: (elementId, duration, startTime) => {
      const animDur = Math.min(1.5, duration - startTime);
      return [
        {
          id: genTrackId(),
          elementId,
          property: 'y',
          keyframes: [
            { id: genKfId(), time: startTime, value: -120, easing: 'bounceOut' },
            { id: genKfId(), time: startTime + animDur, value: 0, easing: 'bounceOut' },
          ],
        },
      ];
    },
  },
  {
    id: 'shake',
    name: 'Shake',
    category: 'emphasis',
    description: 'Quick horizontal jitter/rumble',
    icon: 'Vibrate',
    createTracks: (elementId, duration, startTime) => {
      const step = 0.08;
      return [
        {
          id: genTrackId(),
          elementId,
          property: 'x',
          keyframes: [
            { id: genKfId(), time: startTime, value: 0, easing: 'linear' },
            { id: genKfId(), time: startTime + step, value: -12, easing: 'linear' },
            { id: genKfId(), time: startTime + step * 2, value: 12, easing: 'linear' },
            { id: genKfId(), time: startTime + step * 3, value: -8, easing: 'linear' },
            { id: genKfId(), time: startTime + step * 4, value: 8, easing: 'linear' },
            { id: genKfId(), time: startTime + step * 5, value: 0, easing: 'linear' },
          ],
        },
      ];
    },
  },
  {
    id: 'wiggle',
    name: 'Wiggle',
    category: 'motion',
    description: 'Playful rotational wiggle back and forth',
    icon: 'Sparkle',
    createTracks: (elementId, duration) => {
      const step = duration / 6;
      return [
        {
          id: genTrackId(),
          elementId,
          property: 'rotation',
          keyframes: [
            { id: genKfId(), time: 0, value: 0, easing: 'easeInOut' },
            { id: genKfId(), time: step, value: 14, easing: 'easeInOut' },
            { id: genKfId(), time: step * 2, value: -12, easing: 'easeInOut' },
            { id: genKfId(), time: step * 3, value: 8, easing: 'easeInOut' },
            { id: genKfId(), time: step * 4, value: -6, easing: 'easeInOut' },
            { id: genKfId(), time: step * 5, value: 2, easing: 'easeInOut' },
            { id: genKfId(), time: duration, value: 0, easing: 'easeInOut' },
          ],
        },
      ];
    },
  },
  {
    id: 'draw-path',
    name: 'Draw Path',
    category: 'svg',
    description: 'SVG stroke reveal write-on line drawing animation',
    icon: 'PenTool',
    createTracks: (elementId, duration, startTime, pathLength = 500) => {
      const animDur = Math.min(2.0, duration - startTime);
      return [
        {
          id: genTrackId(),
          elementId,
          property: 'strokeDashoffset',
          keyframes: [
            { id: genKfId(), time: startTime, value: pathLength, easing: 'easeInOut' },
            { id: genKfId(), time: startTime + animDur, value: 0, easing: 'easeInOut' },
          ],
        },
      ];
    },
  },
];
