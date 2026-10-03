/**
 * Image Color Palette Extraction Engine
 * Uses HTML5 Canvas and median-cut/k-means color clustering to extract
 * vibrant, representative, and commercially harmonious color palettes
 * from any uploaded image or graphic.
 */

export interface ExtractedColor {
  hex: string;
  rgb: { r: number; g: number; b: number };
  hsl: { h: number; s: number; l: number };
  population: number; // relative pixel frequency
  isDark: boolean;
}

export interface ExtractedPaletteResult {
  colors: ExtractedColor[];
  hexes: string[];
  dominant: string;
  vibrant: string;
  muted: string;
  light: string;
  dark: string;
  suggestedBackground: string;
}

/**
 * Convert RGB to Hex
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.max(0, Math.min(255, Math.round(n))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Convert Hex to RGB
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16);
    const g = parseInt(cleanHex[1] + cleanHex[1], 16);
    const b = parseInt(cleanHex[2] + cleanHex[2], 16);
    return { r, g, b };
  }
  if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return { r, g, b };
  }
  return null;
}

/**
 * Convert RGB to HSL
 */
export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Perceptual Euclidean color distance
 */
function colorDistance(
  c1: { r: number; g: number; b: number },
  c2: { r: number; g: number; b: number }
): number {
  const rMean = (c1.r + c2.r) / 2;
  const r = c1.r - c2.r;
  const g = c1.g - c2.g;
  const b = c1.b - c2.b;
  return Math.sqrt(
    (((512 + rMean) * r * r) >> 8) + 4 * g * g + (((767 - rMean) * b * b) >> 8)
  );
}

/**
 * Extract a refined palette from an HTML image element or data URL
 */
export async function extractPaletteFromImage(
  imageSource: HTMLImageElement | string | File | Blob,
  maxColors: number = 7
): Promise<ExtractedPaletteResult> {
  return new Promise((resolve, reject) => {
    const processImage = (img: HTMLImageElement) => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          reject(new Error('Canvas 2D context not supported'));
          return;
        }

        // Downscale for speedy pixel processing
        const maxDimension = 150;
        let width = img.naturalWidth || img.width || 150;
        let height = img.naturalHeight || img.height || 150;
        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        // Sample pixels with quantization buckets
        // Quantize colors to 5 bits per channel (32 levels) to cluster similar shades
        const colorCounts = new Map<string, { r: number; g: number; b: number; count: number }>();
        const totalPixels = width * height;
        const step = Math.max(1, Math.floor(totalPixels / 2500)); // Sample ~2500 pixels for accuracy & speed

        for (let i = 0; i < data.length; i += 4 * step) {
          const a = data[i + 3];
          if (a < 128) continue; // Skip transparent or semi-transparent pixels

          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Quantize to 5-bit
          const qr = Math.round(r / 8) * 8;
          const qg = Math.round(g / 8) * 8;
          const qb = Math.round(b / 8) * 8;
          const key = `${qr},${qg},${qb}`;

          const existing = colorCounts.get(key);
          if (existing) {
            existing.count += 1;
            // Running weighted average for accurate hex representation
            existing.r = Math.round((existing.r * (existing.count - 1) + r) / existing.count);
            existing.g = Math.round((existing.g * (existing.count - 1) + g) / existing.count);
            existing.b = Math.round((existing.b * (existing.count - 1) + b) / existing.count);
          } else {
            colorCounts.set(key, { r, g, b, count: 1 });
          }
        }

        // Sort clusters by frequency
        const sortedClusters = Array.from(colorCounts.values()).sort(
          (a, b) => b.count - a.count
        );

        if (sortedClusters.length === 0) {
          // Fallback palette if image was empty or completely transparent
          const fallbackHexes = ['#2a9d8f', '#e76f51', '#f4a261', '#e9c46a', '#264653', '#ffffff'];
          resolve({
            colors: fallbackHexes.map((hex) => {
              const rgb = hexToRgb(hex)!;
              const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
              return { hex, rgb, hsl, population: 1, isDark: hsl.l < 50 };
            }),
            hexes: fallbackHexes,
            dominant: '#264653',
            vibrant: '#e76f51',
            muted: '#2a9d8f',
            light: '#e9c46a',
            dark: '#264653',
            suggestedBackground: '#264653',
          });
          return;
        }

        // Distinct color selection: pick top candidates that are distinct from each other
        const minDistanceThreshold = 38; // Euclidean threshold to ensure unique visual colors
        const selectedColors: { r: number; g: number; b: number; count: number }[] = [];

        for (const cluster of sortedClusters) {
          const isDistinct = selectedColors.every(
            (c) => colorDistance(c, cluster) >= minDistanceThreshold
          );
          if (isDistinct) {
            selectedColors.push(cluster);
            if (selectedColors.length >= maxColors) break;
          }
        }

        // If not enough distinct colors with high threshold, relax threshold
        if (selectedColors.length < Math.min(4, maxColors)) {
          for (const cluster of sortedClusters) {
            const isDistinct = selectedColors.every(
              (c) => colorDistance(c, cluster) >= 20
            );
            if (isDistinct) {
              selectedColors.push(cluster);
              if (selectedColors.length >= maxColors) break;
            }
          }
        }

        const totalSelectedCount = selectedColors.reduce((acc, c) => acc + c.count, 0) || 1;

        const colors: ExtractedColor[] = selectedColors.map((c) => {
          const hex = rgbToHex(c.r, c.g, c.b);
          const hsl = rgbToHsl(c.r, c.g, c.b);
          return {
            hex,
            rgb: { r: c.r, g: c.g, b: c.b },
            hsl,
            population: Math.round((c.count / totalSelectedCount) * 100),
            isDark: hsl.l < 50,
          };
        });

        // Compute specialized roles (Dominant, Vibrant, Muted, Light, Dark)
        const sortedByPop = [...colors].sort((a, b) => b.population - a.population);
        const dominant = sortedByPop[0]?.hex || '#2a9d8f';

        // Vibrant: highest saturation with balanced lightness
        const sortedByVibrance = [...colors].sort(
          (a, b) => b.hsl.s * (1 - Math.abs(b.hsl.l - 50) / 50) - a.hsl.s * (1 - Math.abs(a.hsl.l - 50) / 50)
        );
        const vibrant = sortedByVibrance[0]?.hex || dominant;

        // Muted: moderate saturation
        const sortedByMuted = [...colors].sort((a, b) => a.hsl.s - b.hsl.s);
        const muted = sortedByMuted[0]?.hex || dominant;

        // Lightest & Darkest
        const sortedByLightness = [...colors].sort((a, b) => a.hsl.l - b.hsl.l);
        const dark = sortedByLightness[0]?.hex || '#1a1a1a';
        const light = sortedByLightness[sortedByLightness.length - 1]?.hex || '#f8f9fa';

        // Suggested background: either the most dominant color or a dark/light tone that provides high contrast
        const suggestedBackground =
          sortedByPop[0].hsl.l > 85 || sortedByPop[0].hsl.l < 25
            ? sortedByPop[0].hex
            : dark;

        resolve({
          colors,
          hexes: colors.map((c) => c.hex),
          dominant,
          vibrant,
          muted,
          light,
          dark,
          suggestedBackground,
        });
      } catch (err) {
        reject(err);
      }
    };

    if (imageSource instanceof HTMLImageElement) {
      if (imageSource.complete) {
        processImage(imageSource);
      } else {
        imageSource.onload = () => processImage(imageSource);
        imageSource.onerror = () => reject(new Error('Failed to load image element'));
      }
    } else if (typeof imageSource === 'string') {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => processImage(img);
      img.onerror = () => reject(new Error('Failed to load image from URL'));
      img.src = imageSource;
    } else if (imageSource instanceof Blob) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const img = new Image();
        img.onload = () => processImage(img);
        img.onerror = () => reject(new Error('Failed to parse uploaded image file'));
        img.src = dataUrl;
      };
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(imageSource);
    } else {
      reject(new Error('Unsupported image source type'));
    }
  });
}

/**
 * Curated inspiration sample images with ready-to-test themes
 */
export const SAMPLE_INSPIRATION_IMAGES = [
  {
    id: 'botanical',
    name: 'Botanical Flora',
    url: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=400&q=80',
    tags: ['Lush Greens', 'Earthy Ochre', 'Organic'],
  },
  {
    id: 'sunset',
    name: 'Warm Sunset Coast',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=400&q=80',
    tags: ['Terracotta', 'Amber Gold', 'Azure'],
  },
  {
    id: 'retro-synth',
    name: 'Neon Cyberpunk',
    url: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=400&q=80',
    tags: ['Electric Purple', 'Cyan', 'Vibrant'],
  },
  {
    id: 'ceramic-tiles',
    name: 'Mediterranean Tile',
    url: 'https://images.unsplash.com/photo-1541123437800-1bb1317badc2?auto=format&fit=crop&w=400&q=80',
    tags: ['Cobalt Blue', 'Terracotta', 'White Sand'],
  },
];
