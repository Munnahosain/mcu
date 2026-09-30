export type DitherMethod =
  | 'bayer8'
  | 'bayer4'
  | 'bayer2'
  | 'floydSteinberg'
  | 'atkinson'
  | 'sierraLite'
  | 'burkes'
  | 'stucki'
  | 'noise';

export interface DitherOptions {
  highlights: number; // -100 to 100
  midtones: number;   // -100 to 100
  shadows: number;    // -100 to 100
  brightness: number; // -100 to 100
  contrast: number;   // -100 to 100
  invertSource: boolean;
  method: DitherMethod;
  pixelSize: number;  // 1 to 20
  filterThreshold: number; // 0 to 255
  blur: number;       // 0 to 20
  grain: number;      // 0 to 100
  posterize: number;  // 0 to 16
  pixelate: number;   // 0 to 20
  colorCount: '2' | '4' | 'cyberpunk' | 'amber' | 'sepia';
  colors: string[];
}

export const DEFAULT_DITHER_OPTIONS: DitherOptions = {
  highlights: 0,
  midtones: 0,
  shadows: 0,
  brightness: 0,
  contrast: 0,
  invertSource: false,
  method: 'bayer8',
  pixelSize: 1,
  filterThreshold: 127,
  blur: 0,
  grain: 0,
  posterize: 0,
  pixelate: 0,
  colorCount: '2',
  colors: ['#000000', '#ffffff'],
};

export const PRESET_PALETTES: Record<string, string[]> = {
  '2': ['#000000', '#ffffff'],
  '4': ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'], // Game Boy
  'cyberpunk': ['#0d0221', '#541388', '#f1e9da', '#ff4365', '#00e5ff'],
  'amber': ['#050200', '#3d1a00', '#944b00', '#ffb000'],
  'sepia': ['#1f1610', '#5e4534', '#b0977a', '#f5ece1'],
};

// Bayer Matrices normalized to 0..255
const BAYER_2X2 = [
  [0, 2],
  [3, 1],
].map(r => r.map(v => (v / 4) * 255));

const BAYER_4X4 = [
  [ 0,  8,  2, 10],
  [12,  4, 14,  6],
  [ 3, 11,  1,  9],
  [15,  7, 13,  5],
].map(r => r.map(v => (v / 16) * 255));

const BAYER_8X8 = [
  [ 0, 32,  8, 40,  2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44,  4, 36, 14, 46,  6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [ 3, 35, 11, 43,  1, 33,  9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47,  7, 39, 13, 45,  5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
].map(r => r.map(v => (v / 64) * 255));

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ];
  }
  return [
    parseInt(clean.slice(0, 2), 16) || 0,
    parseInt(clean.slice(2, 4), 16) || 0,
    parseInt(clean.slice(4, 6), 16) || 0,
  ];
}

function findNearestColor(
  r: number,
  g: number,
  b: number,
  paletteRgb: [number, number, number][]
): [number, number, number] {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < paletteRgb.length; i++) {
    const pr = paletteRgb[i][0];
    const pg = paletteRgb[i][1];
    const pb = paletteRgb[i][2];
    const dist = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return paletteRgb[bestIdx];
}

export function processDitherCanvas(
  sourceImg: HTMLImageElement,
  options: DitherOptions,
  scale = 1
): HTMLCanvasElement {
  const pixelBlock = Math.max(1, Math.round(options.pixelSize * scale));
  const effPixelate = Math.max(pixelBlock, options.pixelate ? options.pixelate * scale : pixelBlock);

  // Source dimensions
  const srcW = Math.round(sourceImg.width * scale);
  const srcH = Math.round(sourceImg.height * scale);

  // Render to internal downscaled grid if pixelated
  const w = Math.max(1, Math.floor(srcW / effPixelate));
  const h = Math.max(1, Math.floor(srcH / effPixelate));

  const offscreen = document.createElement('canvas');
  offscreen.width = w;
  offscreen.height = h;
  const offCtx = offscreen.getContext('2d')!;

  if (options.blur > 0) {
    offCtx.filter = `blur(${options.blur}px)`;
  }
  offCtx.drawImage(sourceImg, 0, 0, w, h);

  const imgData = offCtx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Palette RGBs
  const palette = options.colors.length >= 2 ? options.colors : PRESET_PALETTES['2'];
  const paletteRgb = palette.map(hexToRgb);

  // Contrast factor
  const contrastFactor = (259 * (options.contrast + 255)) / (255 * (259 - options.contrast));
  const brightnessOffset = options.brightness * 1.5;

  // Step 1: Pre-adjust pixels (Brightness, Contrast, Highlights/Midtones/Shadows, Invert, Grain, Posterize)
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // Brightness & Contrast
    r = contrastFactor * (r - 128) + 128 + brightnessOffset;
    g = contrastFactor * (g - 128) + 128 + brightnessOffset;
    b = contrastFactor * (b - 128) + 128 + brightnessOffset;

    // Highlights, Midtones, Shadows
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum > 170 && options.highlights !== 0) {
      const hDelta = options.highlights * 0.7;
      r += hDelta; g += hDelta; b += hDelta;
    } else if (lum < 85 && options.shadows !== 0) {
      const sDelta = options.shadows * 0.7;
      r += sDelta; g += sDelta; b += sDelta;
    } else if (options.midtones !== 0) {
      const mDelta = options.midtones * 0.7;
      r += mDelta; g += mDelta; b += mDelta;
    }

    // Film Grain
    if (options.grain > 0) {
      const noise = (Math.random() - 0.5) * options.grain * 1.2;
      r += noise; g += noise; b += noise;
    }

    // Invert
    if (options.invertSource) {
      r = 255 - r;
      g = 255 - g;
      b = 255 - b;
    }

    // Posterize
    if (options.posterize > 1) {
      const step = 255 / (options.posterize - 1);
      r = Math.round(r / step) * step;
      g = Math.round(g / step) * step;
      b = Math.round(b / step) * step;
    }

    data[i] = Math.min(255, Math.max(0, r));
    data[i + 1] = Math.min(255, Math.max(0, g));
    data[i + 2] = Math.min(255, Math.max(0, b));
  }

  // Step 2: Dither application
  const isBayer = options.method.startsWith('bayer');

  if (isBayer) {
    const bayerMat =
      options.method === 'bayer2'
        ? BAYER_2X2
        : options.method === 'bayer4'
        ? BAYER_4X4
        : BAYER_8X8;
    const bSize = bayerMat.length;

    const thresholdBias = (options.filterThreshold - 127) * 0.6;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const bThresh = bayerMat[y % bSize][x % bSize] + thresholdBias;

        const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];

        if (paletteRgb.length === 2) {
          // Fast 1-bit / 2-color thresholding
          const chosen = lum >= bThresh ? paletteRgb[1] : paletteRgb[0];
          data[idx] = chosen[0];
          data[idx + 1] = chosen[1];
          data[idx + 2] = chosen[2];
        } else {
          // Multi-color palette dithering with Bayer bias
          const bias = (bThresh - 128) * 0.35;
          const rBiased = Math.min(255, Math.max(0, data[idx] + bias));
          const gBiased = Math.min(255, Math.max(0, data[idx + 1] + bias));
          const bBiased = Math.min(255, Math.max(0, data[idx + 2] + bias));
          const chosen = findNearestColor(rBiased, gBiased, bBiased, paletteRgb);
          data[idx] = chosen[0];
          data[idx + 1] = chosen[1];
          data[idx + 2] = chosen[2];
        }
      }
    }
  } else if (options.method === 'noise') {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        const noiseThresh = Math.random() * 255;
        const chosen = lum >= noiseThresh ? paletteRgb[paletteRgb.length - 1] : paletteRgb[0];
        data[idx] = chosen[0];
        data[idx + 1] = chosen[1];
        data[idx + 2] = chosen[2];
      }
    }
  } else {
    // Error Diffusion: Floyd-Steinberg, Atkinson, Sierra Lite, Burkes, Stucki
    // Copy into floating point arrays for precision
    const rBuf = new Float32Array(w * h);
    const gBuf = new Float32Array(w * h);
    const bBuf = new Float32Array(w * h);

    for (let i = 0; i < w * h; i++) {
      rBuf[i] = data[i * 4];
      gBuf[i] = data[i * 4 + 1];
      bBuf[i] = data[i * 4 + 2];
    }

    type ErrorKernel = [number, number, number][]; // [dx, dy, weight]
    let kernel: ErrorKernel;
    let divisor: number;

    if (options.method === 'atkinson') {
      kernel = [
        [1, 0, 1], [2, 0, 1],
        [-1, 1, 1], [0, 1, 1], [1, 1, 1],
        [0, 2, 1],
      ];
      divisor = 8;
    } else if (options.method === 'sierraLite') {
      kernel = [
        [1, 0, 2],
        [-1, 1, 1], [0, 1, 1],
      ];
      divisor = 4;
    } else if (options.method === 'burkes') {
      kernel = [
        [1, 0, 8], [2, 0, 4],
        [-2, 1, 2], [-1, 1, 4], [0, 1, 8], [1, 1, 4], [2, 1, 2],
      ];
      divisor = 32;
    } else if (options.method === 'stucki') {
      kernel = [
        [1, 0, 8], [2, 0, 4],
        [-2, 1, 2], [-1, 1, 4], [0, 1, 8], [1, 1, 4], [2, 1, 2],
        [-2, 2, 1], [-1, 2, 2], [0, 2, 4], [1, 2, 2], [2, 2, 1],
      ];
      divisor = 42;
    } else {
      // Floyd-Steinberg
      kernel = [
        [1, 0, 7],
        [-1, 1, 3], [0, 1, 5], [1, 1, 1],
      ];
      divisor = 16;
    }

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const pIdx = y * w + x;
        const oldR = Math.min(255, Math.max(0, rBuf[pIdx]));
        const oldG = Math.min(255, Math.max(0, gBuf[pIdx]));
        const oldB = Math.min(255, Math.max(0, bBuf[pIdx]));

        let chosen: [number, number, number];
        if (paletteRgb.length === 2) {
          const lum = 0.299 * oldR + 0.587 * oldG + 0.114 * oldB;
          chosen = lum >= options.filterThreshold ? paletteRgb[1] : paletteRgb[0];
        } else {
          chosen = findNearestColor(oldR, oldG, oldB, paletteRgb);
        }

        const dIdx = pIdx * 4;
        data[dIdx] = chosen[0];
        data[dIdx + 1] = chosen[1];
        data[dIdx + 2] = chosen[2];

        const errR = oldR - chosen[0];
        const errG = oldG - chosen[1];
        const errB = oldB - chosen[2];

        for (const [dx, dy, weight] of kernel) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            const nIdx = ny * w + nx;
            const factor = weight / divisor;
            rBuf[nIdx] += errR * factor;
            gBuf[nIdx] += errG * factor;
            bBuf[nIdx] += errB * factor;
          }
        }
      }
    }
  }

  offCtx.putImageData(imgData, 0, 0);

  // Upscale to final canvas using nearest-neighbor crisp pixels
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = srcW;
  finalCanvas.height = srcH;
  const finalCtx = finalCanvas.getContext('2d')!;
  finalCtx.imageSmoothingEnabled = false;
  finalCtx.drawImage(offscreen, 0, 0, srcW, srcH);

  return finalCanvas;
}

export function generateDitherSVG(
  sourceImg: HTMLImageElement,
  options: DitherOptions
): string {
  const pixelBlock = Math.max(1, options.pixelSize);
  const effPixelate = Math.max(pixelBlock, options.pixelate || pixelBlock);

  const dithered = processDitherCanvas(sourceImg, options, 1);
  const ctx = dithered.getContext('2d')!;
  const data = ctx.getImageData(0, 0, sourceImg.width, sourceImg.height).data;

  const bg = options.colors[0] || '#000000';
  const fg = options.colors[1] || '#ffffff';

  const svgParts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sourceImg.width} ${sourceImg.height}" width="${sourceImg.width}" height="${sourceImg.height}">`,
    `<rect width="100%" height="100%" fill="${bg}" />`,
    `<g fill="${fg}">`,
  ];

  const step = effPixelate;
  for (let y = 0; y < sourceImg.height; y += step) {
    for (let x = 0; x < sourceImg.width; x += step) {
      const idx = (y * sourceImg.width + x) * 4;
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      if (lum > 127) {
        svgParts.push(`<rect x="${x}" y="${y}" width="${step}" height="${step}" />`);
      }
    }
  }

  svgParts.push('</g></svg>');
  return svgParts.join('\n');
}
