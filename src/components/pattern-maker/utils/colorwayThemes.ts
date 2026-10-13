import { DesignElement, PatternSettings } from '../types';

export interface ColorwayTheme {
  id: string;
  name: string;
  description: string;
  colors: string[];
  backgroundColor: string;
}

export const COLORWAY_THEMES: ColorwayTheme[] = [
  {
    id: 'botanical-sage',
    name: 'Botanical Sage',
    description: 'Earthy organic greens, olive, soft cream & terracotta',
    backgroundColor: '#f4f6f0',
    colors: ['#386641', '#6a994e', '#a7c957', '#bc4749', '#f2e8cf'],
  },
  {
    id: 'warm-terrazzo',
    name: 'Warm Terrazzo',
    description: 'Earthy ochre, rust terracotta, deep charcoal & warm sand',
    backgroundColor: '#faf6f0',
    colors: ['#e76f51', '#f4a261', '#e9c46a', '#264653', '#2a9d8f'],
  },
  {
    id: 'nordic-slate',
    name: 'Nordic Slate',
    description: 'Scandinavian cool slate, denim blue, charcoal & mist',
    backgroundColor: '#f1f5f9',
    colors: ['#1e293b', '#334155', '#475569', '#0284c7', '#38bdf8'],
  },
  {
    id: 'cyber-mint',
    name: 'Cyber Mint & Violet',
    description: 'Vibrant electric mint, neon violet & deep midnight',
    backgroundColor: '#0a0d14',
    colors: ['#18c98a', '#27e39a', '#8b5cf6', '#ec4899', '#06b6d4'],
  },
  {
    id: 'boho-sunset',
    name: 'Boho Sunset',
    description: 'Dusty rose, warm peach, spiced apricot & deep maroon',
    backgroundColor: '#fdf8f6',
    colors: ['#d97706', '#f59e0b', '#fb7185', '#e11d48', '#881337'],
  },
  {
    id: 'monochrome-luxe',
    name: 'Monochrome Luxe',
    description: 'High-contrast luxury black, platinum grey & emerald accent',
    backgroundColor: '#0f1115',
    colors: ['#ffffff', '#e2e8f0', '#94a3b8', '#475569', '#18c98a'],
  },
  {
    id: 'pastel-bloom',
    name: 'Pastel Bloom',
    description: 'Soft buttercup yellow, lilac, blush pink & mint',
    backgroundColor: '#fffdfa',
    colors: ['#fbcfe8', '#e9d5ff', '#a7f3d0', '#fef08a', '#fda4af'],
  },
  {
    id: 'royal-heritage',
    name: 'Royal Heritage',
    description: 'Deep navy, imperial emerald, burnished gold & ruby',
    backgroundColor: '#0b132b',
    colors: ['#f5c451', '#1c2541', '#3a506b', '#5bc0be', '#ef4444'],
  },
];

/**
 * Harmonize / apply colorway to all pattern elements
 */
export function applyColorway(
  elements: DesignElement[],
  theme: ColorwayTheme,
  shuffle: boolean = false
): { updatedElements: DesignElement[]; newBg: string } {
  let palette = [...theme.colors];
  if (shuffle) {
    palette = palette.sort(() => Math.random() - 0.5);
  }

  const updatedElements = elements.map((el, index) => {
    if (el.type === 'image') return el;
    const assignedFill = palette[index % palette.length];
    return {
      ...el,
      fill: assignedFill,
      stroke: el.stroke && el.stroke !== 'none' ? palette[(index + 2) % palette.length] : 'none',
    };
  });

  return {
    updatedElements,
    newBg: theme.backgroundColor,
  };
}

/**
 * Intelligent Auto-Scatter Motif Generator
 * Takes current motifs and creates an organic, balanced seamless repeat across the artboard
 */
export function autoScatterMotifs(
  elements: DesignElement[],
  artboardSize: number
): DesignElement[] {
  if (elements.length === 0) return elements;

  const basePool = elements.slice(0, Math.min(6, elements.length));
  const S = artboardSize;
  const count = Math.max(8, basePool.length * 2);
  const result: DesignElement[] = [];

  // Distribution points: grid jitter + edge straddlers for seamless wrapping
  const cols = 3;
  const rows = 3;
  const cellW = S / cols;
  const cellH = S / rows;

  let currentZ = 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const source = basePool[(r * cols + c) % basePool.length];
      const jitterX = (Math.random() - 0.5) * (cellW * 0.65);
      const jitterY = (Math.random() - 0.5) * (cellH * 0.65);
      const x = Math.round(c * cellW + cellW / 2 + jitterX);
      const y = Math.round(r * cellH + cellH / 2 + jitterY);
      const rotation = Math.round((Math.random() * 4) * 45); // 0, 45, 90, 135, 180, etc.
      const scaleVariance = 0.8 + Math.random() * 0.45; // 0.8x to 1.25x

      result.push({
        ...source,
        id: `scatter-${Date.now()}-${r}-${c}-${Math.random().toString(36).substr(2, 4)}`,
        x,
        y,
        width: Math.round(source.width * scaleVariance),
        height: Math.round(source.height * scaleVariance),
        rotation,
        zIndex: currentZ++,
      });
    }
  }

  // Add 2 edge straddlers to showcase seamless boundary wrapping
  if (basePool.length > 0) {
    const edgeSource1 = basePool[0];
    result.push({
      ...edgeSource1,
      id: `scatter-edge-1-${Date.now()}`,
      x: S, // right border
      y: Math.round(S * 0.4),
      rotation: 15,
      zIndex: currentZ++,
    });

    const edgeSource2 = basePool[1 % basePool.length];
    result.push({
      ...edgeSource2,
      id: `scatter-edge-2-${Date.now()}`,
      x: Math.round(S * 0.3),
      y: S, // bottom border
      rotation: -30,
      zIndex: currentZ++,
    });
  }

  return result;
}
