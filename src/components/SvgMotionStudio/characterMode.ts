import { SvgElementNode, CharacterSlot, AnimationTrack, Keyframe } from './types';
import { flattenElementTree } from './svgParser';

let trackIdCounter = 100;
function genTrackId(): string {
  return `trk_char_${Date.now()}_${trackIdCounter++}`;
}

function genKfId(): string {
  return `kf_char_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

interface SlotMatcher {
  slot: CharacterSlot;
  patterns: RegExp[];
}

const SLOT_MATCHERS: SlotMatcher[] = [
  { slot: 'hair', patterns: [/hair/i, /wig/i, /bangs/i, /coif/i] },
  { slot: 'eyes', patterns: [/eye/i, /pupil/i, /iris/i, /eyebrow/i, /brow/i] },
  { slot: 'mouth', patterns: [/mouth/i, /lip/i, /teeth/i, /smile/i, /jaw/i] },
  { slot: 'head', patterns: [/head/i, /face/i, /skull/i, /cranium/i] },
  { slot: 'body', patterns: [/body/i, /torso/i, /chest/i, /trunk/i, /shirt/i, /suit/i] },
  {
    slot: 'left_arm',
    patterns: [
      /left.*arm/i,
      /arm.*left/i,
      /l.*arm/i,
      /left.*hand/i,
      /hand.*left/i,
      /l.*hand/i,
      /left.*shoulder/i,
      /shoulder.*left/i,
      /arm_l/i,
      /l_arm/i,
    ],
  },
  {
    slot: 'right_arm',
    patterns: [
      /right.*arm/i,
      /arm.*right/i,
      /r.*arm/i,
      /right.*hand/i,
      /hand.*right/i,
      /r.*hand/i,
      /right.*shoulder/i,
      /shoulder.*right/i,
      /arm_r/i,
      /r_arm/i,
    ],
  },
  {
    slot: 'left_leg',
    patterns: [
      /left.*leg/i,
      /leg.*left/i,
      /l.*leg/i,
      /left.*foot/i,
      /foot.*left/i,
      /l.*foot/i,
      /left.*shoe/i,
      /shoe.*left/i,
      /leg_l/i,
      /l_leg/i,
    ],
  },
  {
    slot: 'right_leg',
    patterns: [
      /right.*leg/i,
      /leg.*right/i,
      /r.*leg/i,
      /right.*foot/i,
      /foot.*right/i,
      /r.*foot/i,
      /right.*shoe/i,
      /shoe.*right/i,
      /leg_r/i,
      /r_leg/i,
    ],
  },
];

export function autoDetectCharacterSlots(elements: SvgElementNode[]): Partial<Record<CharacterSlot, string>> {
  const flat = flattenElementTree(elements);
  const result: Partial<Record<CharacterSlot, string>> = {};
  const assignedElementIds = new Set<string>();

  for (const matcher of SLOT_MATCHERS) {
    for (const node of flat) {
      if (assignedElementIds.has(node.id)) continue;

      const searchableText = `${node.name} ${node.originalId} ${node.tagName}`.toLowerCase();
      const matches = matcher.patterns.some((pattern) => pattern.test(searchableText));

      if (matches) {
        result[matcher.slot] = node.id;
        assignedElementIds.add(node.id);
        break;
      }
    }
  }

  return result;
}

export interface CharacterPresetDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'core' | 'locomotion' | 'expressive';
  requiredSlots: CharacterSlot[];
  generateTracks: (slots: Partial<Record<CharacterSlot, string>>, duration: number) => AnimationTrack[];
}

export const CHARACTER_PRESETS: CharacterPresetDef[] = [
  {
    id: 'char-idle',
    name: 'Idle & Natural Breathing',
    description: 'Subtle breathing torso expansion, head bob, and micro arm balance',
    icon: 'Wind',
    category: 'core',
    requiredSlots: ['body'],
    generateTracks: (slots, duration) => {
      const tracks: AnimationTrack[] = [];
      const dur = duration || 4.0;
      const half = dur / 2;

      if (slots.body) {
        tracks.push({
          id: genTrackId(),
          elementId: slots.body,
          property: 'scaleY',
          keyframes: [
            { id: genKfId(), time: 0, value: 100, easing: 'easeInOut' },
            { id: genKfId(), time: half, value: 103, easing: 'easeInOut' },
            { id: genKfId(), time: dur, value: 100, easing: 'easeInOut' },
          ],
        });
      }

      if (slots.head) {
        tracks.push({
          id: genTrackId(),
          elementId: slots.head,
          property: 'y',
          keyframes: [
            { id: genKfId(), time: 0, value: 0, easing: 'easeInOut' },
            { id: genKfId(), time: half, value: -3, easing: 'easeInOut' },
            { id: genKfId(), time: dur, value: 0, easing: 'easeInOut' },
          ],
        });
        tracks.push({
          id: genTrackId(),
          elementId: slots.head,
          property: 'rotation',
          keyframes: [
            { id: genKfId(), time: 0, value: 0, easing: 'easeInOut' },
            { id: genKfId(), time: half, value: 1.5, easing: 'easeInOut' },
            { id: genKfId(), time: dur, value: 0, easing: 'easeInOut' },
          ],
        });
      }

      if (slots.left_arm) {
        tracks.push({
          id: genTrackId(),
          elementId: slots.left_arm,
          property: 'rotation',
          keyframes: [
            { id: genKfId(), time: 0, value: 0, easing: 'easeInOut' },
            { id: genKfId(), time: half, value: -2, easing: 'easeInOut' },
            { id: genKfId(), time: dur, value: 0, easing: 'easeInOut' },
          ],
        });
      }

      if (slots.right_arm) {
        tracks.push({
          id: genTrackId(),
          elementId: slots.right_arm,
          property: 'rotation',
          keyframes: [
            { id: genKfId(), time: 0, value: 0, easing: 'easeInOut' },
            { id: genKfId(), time: half, value: 2, easing: 'easeInOut' },
            { id: genKfId(), time: dur, value: 0, easing: 'easeInOut' },
          ],
        });
      }

      return tracks;
    },
  },
  {
    id: 'char-blink',
    name: 'Eye Blink',
    category: 'expressive',
    description: 'Realistic eye blink cycle at 1.5s intervals',
    icon: 'Eye',
    requiredSlots: ['eyes'],
    generateTracks: (slots, duration) => {
      const tracks: AnimationTrack[] = [];
      const eyeId = slots.eyes;
      if (!eyeId) return tracks;

      const dur = duration || 4.0;
      const blinkPoints = [dur * 0.35, dur * 0.8];
      const kfs: Keyframe[] = [{ id: genKfId(), time: 0, value: 100, easing: 'linear' }];

      for (const bp of blinkPoints) {
        kfs.push({ id: genKfId(), time: bp - 0.08, value: 100, easing: 'easeIn' });
        kfs.push({ id: genKfId(), time: bp, value: 10, easing: 'linear' });
        kfs.push({ id: genKfId(), time: bp + 0.08, value: 100, easing: 'easeOut' });
      }

      kfs.push({ id: genKfId(), time: dur, value: 100, easing: 'linear' });

      tracks.push({
        id: genTrackId(),
        elementId: eyeId,
        property: 'scaleY',
        keyframes: kfs,
      });

      return tracks;
    },
  },
  {
    id: 'char-wave',
    name: 'Arm Wave',
    category: 'expressive',
    description: 'Friendly right arm waving gesture',
    icon: 'Hand',
    requiredSlots: ['right_arm'],
    generateTracks: (slots, duration) => {
      const tracks: AnimationTrack[] = [];
      const armId = slots.right_arm || slots.left_arm;
      if (!armId) return tracks;

      const dur = duration || 3.0;
      const t1 = dur * 0.2;
      const t2 = dur * 0.35;
      const t3 = dur * 0.5;
      const t4 = dur * 0.65;
      const t5 = dur * 0.8;

      tracks.push({
        id: genTrackId(),
        elementId: armId,
        property: 'rotation',
        keyframes: [
          { id: genKfId(), time: 0, value: 0, easing: 'easeOut' },
          { id: genKfId(), time: t1, value: -35, easing: 'easeInOut' },
          { id: genKfId(), time: t2, value: 15, easing: 'easeInOut' },
          { id: genKfId(), time: t3, value: -35, easing: 'easeInOut' },
          { id: genKfId(), time: t4, value: 15, easing: 'easeInOut' },
          { id: genKfId(), time: t5, value: -35, easing: 'easeInOut' },
          { id: genKfId(), time: dur, value: 0, easing: 'easeInOut' },
        ],
      });

      if (slots.head) {
        tracks.push({
          id: genTrackId(),
          elementId: slots.head,
          property: 'rotation',
          keyframes: [
            { id: genKfId(), time: 0, value: 0, easing: 'easeInOut' },
            { id: genKfId(), time: t1, value: 5, easing: 'easeInOut' },
            { id: genKfId(), time: t5, value: 5, easing: 'easeInOut' },
            { id: genKfId(), time: dur, value: 0, easing: 'easeInOut' },
          ],
        });
      }

      return tracks;
    },
  },
  {
    id: 'char-walk',
    name: 'Walk Cycle',
    category: 'locomotion',
    description: 'Alternating leg stride with counter-swinging arms and body bounce',
    icon: 'Footprints',
    requiredSlots: ['left_leg', 'right_leg'],
    generateTracks: (slots, duration) => {
      const tracks: AnimationTrack[] = [];
      const dur = duration || 3.0;
      const q1 = dur * 0.25;
      const q2 = dur * 0.5;
      const q3 = dur * 0.75;

      if (slots.left_leg) {
        tracks.push({
          id: genTrackId(),
          elementId: slots.left_leg,
          property: 'rotation',
          keyframes: [
            { id: genKfId(), time: 0, value: 0, easing: 'easeInOut' },
            { id: genKfId(), time: q1, value: 24, easing: 'easeInOut' },
            { id: genKfId(), time: q2, value: 0, easing: 'easeInOut' },
            { id: genKfId(), time: q3, value: -24, easing: 'easeInOut' },
            { id: genKfId(), time: dur, value: 0, easing: 'easeInOut' },
          ],
        });
      }

      if (slots.right_leg) {
        tracks.push({
          id: genTrackId(),
          elementId: slots.right_leg,
          property: 'rotation',
          keyframes: [
            { id: genKfId(), time: 0, value: 0, easing: 'easeInOut' },
            { id: genKfId(), time: q1, value: -24, easing: 'easeInOut' },
            { id: genKfId(), time: q2, value: 0, easing: 'easeInOut' },
            { id: genKfId(), time: q3, value: 24, easing: 'easeInOut' },
            { id: genKfId(), time: dur, value: 0, easing: 'easeInOut' },
          ],
        });
      }

      if (slots.left_arm) {
        tracks.push({
          id: genTrackId(),
          elementId: slots.left_arm,
          property: 'rotation',
          keyframes: [
            { id: genKfId(), time: 0, value: 0, easing: 'easeInOut' },
            { id: genKfId(), time: q1, value: -20, easing: 'easeInOut' },
            { id: genKfId(), time: q2, value: 0, easing: 'easeInOut' },
            { id: genKfId(), time: q3, value: 20, easing: 'easeInOut' },
            { id: genKfId(), time: dur, value: 0, easing: 'easeInOut' },
          ],
        });
      }

      if (slots.right_arm) {
        tracks.push({
          id: genTrackId(),
          elementId: slots.right_arm,
          property: 'rotation',
          keyframes: [
            { id: genKfId(), time: 0, value: 0, easing: 'easeInOut' },
            { id: genKfId(), time: q1, value: 20, easing: 'easeInOut' },
            { id: genKfId(), time: q2, value: 0, easing: 'easeInOut' },
            { id: genKfId(), time: q3, value: -20, easing: 'easeInOut' },
            { id: genKfId(), time: dur, value: 0, easing: 'easeInOut' },
          ],
        });
      }

      if (slots.body) {
        tracks.push({
          id: genTrackId(),
          elementId: slots.body,
          property: 'y',
          keyframes: [
            { id: genKfId(), time: 0, value: 0, easing: 'easeInOut' },
            { id: genKfId(), time: dur * 0.125, value: -6, easing: 'easeInOut' },
            { id: genKfId(), time: q1, value: 0, easing: 'easeInOut' },
            { id: genKfId(), time: dur * 0.375, value: -6, easing: 'easeInOut' },
            { id: genKfId(), time: q2, value: 0, easing: 'easeInOut' },
            { id: genKfId(), time: dur * 0.625, value: -6, easing: 'easeInOut' },
            { id: genKfId(), time: q3, value: 0, easing: 'easeInOut' },
            { id: genKfId(), time: dur * 0.875, value: -6, easing: 'easeInOut' },
            { id: genKfId(), time: dur, value: 0, easing: 'easeInOut' },
          ],
        });
      }

      return tracks;
    },
  },
  {
    id: 'char-jump',
    name: 'Joyful Jump',
    category: 'locomotion',
    description: 'Squat anticipation, upward leap, apex float, and landing recoil',
    icon: 'Zap',
    requiredSlots: ['body'],
    generateTracks: (slots, duration) => {
      const tracks: AnimationTrack[] = [];
      const bodyId = slots.body;
      if (!bodyId) return tracks;

      const dur = duration || 3.0;
      const tAnticipate = dur * 0.2;
      const tLaunch = dur * 0.35;
      const tApex = dur * 0.55;
      const tLand = dur * 0.75;
      const tRecoil = dur * 0.85;

      tracks.push({
        id: genTrackId(),
        elementId: bodyId,
        property: 'y',
        keyframes: [
          { id: genKfId(), time: 0, value: 0, easing: 'easeInOut' },
          { id: genKfId(), time: tAnticipate, value: 16, easing: 'easeIn' },
          { id: genKfId(), time: tLaunch, value: -30, easing: 'easeOut' },
          { id: genKfId(), time: tApex, value: -65, easing: 'easeInOut' },
          { id: genKfId(), time: tLand, value: 0, easing: 'easeIn' },
          { id: genKfId(), time: tRecoil, value: 12, easing: 'easeOut' },
          { id: genKfId(), time: dur, value: 0, easing: 'easeInOut' },
        ],
      });

      tracks.push({
        id: genTrackId(),
        elementId: bodyId,
        property: 'scaleY',
        keyframes: [
          { id: genKfId(), time: 0, value: 100, easing: 'easeInOut' },
          { id: genKfId(), time: tAnticipate, value: 88, easing: 'easeIn' },
          { id: genKfId(), time: tLaunch, value: 110, easing: 'easeOut' },
          { id: genKfId(), time: tApex, value: 102, easing: 'easeInOut' },
          { id: genKfId(), time: tLand, value: 92, easing: 'easeIn' },
          { id: genKfId(), time: dur, value: 100, easing: 'easeInOut' },
        ],
      });

      return tracks;
    },
  },
  {
    id: 'char-nod',
    name: 'Head Nod',
    category: 'expressive',
    description: 'Affirmative head nod gesture',
    icon: 'Smile',
    requiredSlots: ['head'],
    generateTracks: (slots, duration) => {
      const tracks: AnimationTrack[] = [];
      const headId = slots.head;
      if (!headId) return tracks;

      const dur = duration || 2.5;
      tracks.push({
        id: genTrackId(),
        elementId: headId,
        property: 'rotation',
        keyframes: [
          { id: genKfId(), time: 0, value: 0, easing: 'easeInOut' },
          { id: genKfId(), time: dur * 0.2, value: 14, easing: 'easeInOut' },
          { id: genKfId(), time: dur * 0.4, value: -3, easing: 'easeInOut' },
          { id: genKfId(), time: dur * 0.6, value: 10, easing: 'easeInOut' },
          { id: genKfId(), time: dur * 0.8, value: -1, easing: 'easeInOut' },
          { id: genKfId(), time: dur, value: 0, easing: 'easeInOut' },
        ],
      });

      return tracks;
    },
  },
  {
    id: 'char-shake-head',
    name: 'Head Shake',
    category: 'expressive',
    description: 'Disapproving or puzzled side-to-side head turn',
    icon: 'RotateCcw',
    requiredSlots: ['head'],
    generateTracks: (slots, duration) => {
      const tracks: AnimationTrack[] = [];
      const headId = slots.head;
      if (!headId) return tracks;

      const dur = duration || 2.5;
      tracks.push({
        id: genTrackId(),
        elementId: headId,
        property: 'rotation',
        keyframes: [
          { id: genKfId(), time: 0, value: 0, easing: 'easeInOut' },
          { id: genKfId(), time: dur * 0.15, value: -14, easing: 'easeInOut' },
          { id: genKfId(), time: dur * 0.35, value: 14, easing: 'easeInOut' },
          { id: genKfId(), time: dur * 0.55, value: -10, easing: 'easeInOut' },
          { id: genKfId(), time: dur * 0.75, value: 10, easing: 'easeInOut' },
          { id: genKfId(), time: dur, value: 0, easing: 'easeInOut' },
        ],
      });

      return tracks;
    },
  },
  {
    id: 'char-talk',
    name: 'Talking Animation',
    category: 'expressive',
    description: 'Mouth movement and expressive head cadence',
    icon: 'MessageCircle',
    requiredSlots: ['mouth'],
    generateTracks: (slots, duration) => {
      const tracks: AnimationTrack[] = [];
      const mouthId = slots.mouth;
      if (!mouthId) return tracks;

      const dur = duration || 3.0;
      const step = 0.2;
      const kfs = [{ id: genKfId(), time: 0, value: 100, easing: 'easeInOut' as const }];
      const scales = [50, 120, 70, 130, 40, 110, 60, 125, 45, 100];

      for (let i = 0; i < scales.length && (i + 1) * step < dur; i++) {
        kfs.push({
          id: genKfId(),
          time: (i + 1) * step,
          value: scales[i],
          easing: 'easeInOut',
        });
      }
      kfs.push({ id: genKfId(), time: dur, value: 100, easing: 'easeInOut' });

      tracks.push({
        id: genTrackId(),
        elementId: mouthId,
        property: 'scaleY',
        keyframes: kfs,
      });

      return tracks;
    },
  },
];
