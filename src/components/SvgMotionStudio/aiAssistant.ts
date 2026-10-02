import { SvgElementNode, CharacterSlot, AnimationTrack, Keyframe } from './types';
import { flattenElementTree } from './svgParser';
import { CHARACTER_PRESETS } from './characterMode';
import { ANIMATION_PRESETS } from './presets';

import { getProviderKeys } from '@/lib/ai-settings';

export interface AiAnimationPlan {
  prompt: string;
  summary: string[];
  duration: number;
  loop: boolean;
  tracks: AnimationTrack[];
}

let trackCounter = 500;
function genTrackId(): string {
  return `trk_ai_${Date.now()}_${trackCounter++}`;
}

function genKfId(): string {
  return `kf_ai_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

export async function generateAiAnimation(
  prompt: string,
  elements: SvgElementNode[],
  characterSlots: Partial<Record<CharacterSlot, string>>,
  selectedElementId: string | null,
  currentDuration: number = 4.0
): Promise<AiAnimationPlan> {
  const p = prompt.trim().toLowerCase();

  // Try calling server-side AI endpoint first
  try {
    const keys = getProviderKeys();
    const geminiKey = keys.find((k) => k.provider === 'Google Gemini' && k.key)?.key;

    const res = await fetch('/api/svg-motion/ai-assist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        elements: flattenElementTree(elements).map((e) => ({ id: e.id, name: e.name, tag: e.tagName })),
        characterSlots,
        selectedElementId,
        duration: currentDuration,
        apiKey: geminiKey,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.tracks && data.tracks.length > 0) {
        return {
          prompt,
          summary: data.summary || ['Generated custom AI motion keyframes'],
          duration: data.duration || currentDuration,
          loop: data.loop ?? true,
          tracks: data.tracks,
        };
      }
    }
  } catch {
    // Fall through to client semantic motion planner
  }

  // Robust Client-side Semantic Motion Planner (works 100% offline with zero dependencies)
  const flat = flattenElementTree(elements);
  const targetId = selectedElementId || elements[0]?.id || '';
  const targetNode = flat.find((e) => e.id === targetId);

  // 1. Natural breathing animation
  if (p.includes('breath') || p.includes('inhale') || p.includes('chest')) {
    const dur = 4.0;
    const bodyId = characterSlots.body || targetId;
    const headId = characterSlots.head;

    const tracks: AnimationTrack[] = [
      {
        id: genTrackId(),
        elementId: bodyId,
        property: 'scaleY',
        keyframes: [
          { id: genKfId(), time: 0, value: 100, easing: 'easeInOut' },
          { id: genKfId(), time: 2.0, value: 104, easing: 'easeInOut' },
          { id: genKfId(), time: dur, value: 100, easing: 'easeInOut' },
        ],
      },
      {
        id: genTrackId(),
        elementId: bodyId,
        property: 'scaleX',
        keyframes: [
          { id: genKfId(), time: 0, value: 100, easing: 'easeInOut' },
          { id: genKfId(), time: 2.0, value: 98.5, easing: 'easeInOut' },
          { id: genKfId(), time: dur, value: 100, easing: 'easeInOut' },
        ],
      },
    ];

    if (headId) {
      tracks.push({
        id: genTrackId(),
        elementId: headId,
        property: 'y',
        keyframes: [
          { id: genKfId(), time: 0, value: 0, easing: 'easeInOut' },
          { id: genKfId(), time: 2.0, value: -3, easing: 'easeInOut' },
          { id: genKfId(), time: dur, value: 0, easing: 'easeInOut' },
        ],
      });
    }

    return {
      prompt,
      duration: dur,
      loop: true,
      summary: [
        'Body Scale Y: 100% → 104% → 100% (Subtle ribcage expansion)',
        'Body Scale X: 100% → 98.5% → 100% (Natural volume preservation)',
        headId ? 'Head Vertical Translation: 0px → -3px → 0px' : 'Synchronized posture timing',
        'Duration: 4.0s | Loop: Enabled | Easing: easeInOut',
      ],
      tracks,
    };
  }

  // 2. Wave hand / arm
  if (p.includes('wave') || p.includes('greet') || p.includes('hello') || p.includes('say hi')) {
    const dur = 3.0;
    const armId = characterSlots.right_arm || characterSlots.left_arm || targetId;
    const headId = characterSlots.head;

    const tracks: AnimationTrack[] = [
      {
        id: genTrackId(),
        elementId: armId,
        property: 'rotation',
        keyframes: [
          { id: genKfId(), time: 0, value: 0, easing: 'easeOut' },
          { id: genKfId(), time: 0.6, value: -35, easing: 'easeInOut' },
          { id: genKfId(), time: 1.1, value: 20, easing: 'easeInOut' },
          { id: genKfId(), time: 1.6, value: -35, easing: 'easeInOut' },
          { id: genKfId(), time: 2.1, value: 20, easing: 'easeInOut' },
          { id: genKfId(), time: dur, value: 0, easing: 'easeInOut' },
        ],
      },
    ];

    if (headId) {
      tracks.push({
        id: genTrackId(),
        elementId: headId,
        property: 'rotation',
        keyframes: [
          { id: genKfId(), time: 0, value: 0, easing: 'easeInOut' },
          { id: genKfId(), time: 0.8, value: 4, easing: 'easeInOut' },
          { id: genKfId(), time: 2.2, value: 4, easing: 'easeInOut' },
          { id: genKfId(), time: dur, value: 0, easing: 'easeInOut' },
        ],
      });
    }

    return {
      prompt,
      duration: dur,
      loop: true,
      summary: [
        'Arm Rotation: 0° → -35° → +20° → -35° → +20° → 0°',
        headId ? 'Head Rotation: 0° → +4° tilted attention' : 'Smooth gesture deceleration',
        'Duration: 3.0s | Loop: Enabled | Easing: easeInOut',
      ],
      tracks,
    };
  }

  // 3. Idle animation
  if (p.includes('idle') || p.includes('stay') || p.includes('stand') || p.includes('rest')) {
    const idleDef = CHARACTER_PRESETS.find((cp) => cp.id === 'char-idle');
    const tracks = idleDef ? idleDef.generateTracks(characterSlots, 4.0) : [];

    return {
      prompt,
      duration: 4.0,
      loop: true,
      summary: [
        'Torso Breathing: scaleY 100% → 103% → 100%',
        'Head Vertical Sway: 0px → -3px → 0px with 1.5° counter-tilt',
        'Arm Balance: micro rotational stabilization (-2° to +2°)',
        'Duration: 4.0s | Loop: Enabled',
      ],
      tracks,
    };
  }

  // 4. Walk cycle
  if (p.includes('walk') || p.includes('step') || p.includes('stride')) {
    const walkDef = CHARACTER_PRESETS.find((cp) => cp.id === 'char-walk');
    const tracks = walkDef ? walkDef.generateTracks(characterSlots, 3.0) : [];

    return {
      prompt,
      duration: 3.0,
      loop: true,
      summary: [
        'Leg Strides: Alternating rotation cycle ±24°',
        'Arm Counter-Swings: Inverted rotation cycle ±20°',
        'Torso Vertical Bobbing: 0px → -6px dynamic gravity rhythm',
        'Duration: 3.0s | Loop: Continuous',
      ],
      tracks,
    };
  }

  // 5. Jump / Bounce
  if (p.includes('jump') || p.includes('hop') || p.includes('leap')) {
    const jumpDef = CHARACTER_PRESETS.find((cp) => cp.id === 'char-jump');
    const tracks = jumpDef ? jumpDef.generateTracks(characterSlots, 3.0) : [];

    return {
      prompt,
      duration: 3.0,
      loop: true,
      summary: [
        'Squat Anticipation (0.6s): scaleY 88%, y +16px compression',
        'Launch & Apex (1.6s): y -65px leap with vertical elongation',
        'Landing Recoil (2.5s): Impact absorption and elastic recovery',
        'Duration: 3.0s | Loop: Enabled',
      ],
      tracks,
    };
  }

  // 6. Pulse / Heartbeat
  if (p.includes('pulse') || p.includes('heartbeat') || p.includes('glow') || p.includes('throb')) {
    const pulseDef = ANIMATION_PRESETS.find((ap) => ap.id === 'pulse');
    const tracks = pulseDef ? pulseDef.createTracks(targetId, 2.5, 0) : [];

    return {
      prompt,
      duration: 2.5,
      loop: true,
      summary: [
        `Target Element: ${targetNode?.name || 'Selected Object'}`,
        'Scale X & Y: 100% → 110% → 96% → 106% → 100% heartbeat rhythm',
        'Easing: easeInOut | Duration: 2.5s',
      ],
      tracks,
    };
  }

  // 7. Float / Hover
  if (p.includes('float') || p.includes('hover') || p.includes('levitat')) {
    const floatDef = ANIMATION_PRESETS.find((ap) => ap.id === 'float');
    const tracks = floatDef ? floatDef.createTracks(targetId, 3.5, 0) : [];

    return {
      prompt,
      duration: 3.5,
      loop: true,
      summary: [
        `Target Element: ${targetNode?.name || 'Selected Object'}`,
        'Position Y: 0px → -18px → 0px continuous levitation',
        'Easing: easeInOut | Duration: 3.5s',
      ],
      tracks,
    };
  }

  // 8. Rotate / Spin
  if (p.includes('spin') || p.includes('rotate') || p.includes('turn')) {
    const rotDef = ANIMATION_PRESETS.find((ap) => ap.id === 'rotate');
    const tracks = rotDef ? rotDef.createTracks(targetId, 4.0, 0) : [];

    return {
      prompt,
      duration: 4.0,
      loop: true,
      summary: [
        `Target Element: ${targetNode?.name || 'Selected Object'}`,
        'Rotation: 0° → 360° continuous rotation',
        'Easing: linear | Duration: 4.0s',
      ],
      tracks,
    };
  }

  // 9. Path Drawing / Reveal
  if (p.includes('draw') || p.includes('reveal') || p.includes('write') || p.includes('stroke') || p.includes('line')) {
    const drawDef = ANIMATION_PRESETS.find((ap) => ap.id === 'draw-path');
    const pathLen = targetNode?.pathLength || 600;
    const tracks = drawDef ? drawDef.createTracks(targetId, 3.0, 0, pathLen) : [];

    return {
      prompt,
      duration: 3.0,
      loop: false,
      summary: [
        `Target Element: ${targetNode?.name || 'Selected Vector Path'}`,
        `Stroke Dashoffset: ${pathLen}px → 0px (Write-on path reveal)`,
        'Duration: 3.0s | Easing: easeInOut',
      ],
      tracks,
    };
  }

  // Default fallback: Custom kinetic bounce & entrance
  const bounceDef = ANIMATION_PRESETS.find((ap) => ap.id === 'scale-in');
  const tracks = bounceDef ? bounceDef.createTracks(targetId, 2.0, 0) : [];

  return {
    prompt,
    duration: 2.5,
    loop: false,
    summary: [
      `Target Element: ${targetNode?.name || 'Object'}`,
      'Spring Scale In: 0% → 100% with backOut overshoot',
      'Opacity Fade: 0% → 100%',
      'Duration: 2.5s | Easing: backOut',
    ],
    tracks,
  };
}
