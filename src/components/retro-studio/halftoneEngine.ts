export interface HalftoneOptions {
  algorithm: 'am' | 'fm' | 'dotGain';
  fitMode: 'fit' | 'fill' | 'original';
  blur: number;
  gamma: number;
  contrast: number;
  gridType: 'square' | 'hexagonal' | 'radial';
  spacing: number;
  rotation: number;
  channel: 'invLum' | 'lum' | 'red' | 'green' | 'blue';
  invertChannel: boolean;
  dotStyle: 'circle' | 'square' | 'diamond' | 'cross' | 'ring' | 'line';
  outlineMode: boolean;
  minSize: number;
  maxSize: number;
  globalSize: number;
  colorCount: '2' | '3' | '4' | 'custom';
  fgColor: string;
  bgColor: string;
}

export const DEFAULT_HALFTONE_OPTIONS: HalftoneOptions = {
  algorithm: 'am',
  fitMode: 'fit',
  blur: 0,
  gamma: 1,
  contrast: 0,
  gridType: 'square',
  spacing: 10,
  rotation: 0,
  channel: 'invLum',
  invertChannel: false,
  dotStyle: 'circle',
  outlineMode: false,
  minSize: 0.1,
  maxSize: 1.0,
  globalSize: 1.0,
  colorCount: '2',
  fgColor: '#ffffff',
  bgColor: '#000000',
};

// Sample high-contrast silhouette portrait in case user doesn't have an image ready
export function createSamplePortrait(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 750;
  const ctx = canvas.getContext('2d')!;

  // Dark background
  ctx.fillStyle = '#05070a';
  ctx.fillRect(0, 0, 600, 750);

  // Gradient backdrop
  const grad = ctx.createRadialGradient(300, 320, 50, 300, 350, 350);
  grad.addColorStop(0, '#334155');
  grad.addColorStop(1, '#05070a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 600, 750);

  // Silhouette shoulders & body
  ctx.fillStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.moveTo(100, 750);
  ctx.quadraticCurveTo(150, 520, 230, 480);
  ctx.quadraticCurveTo(240, 440, 270, 430);
  ctx.quadraticCurveTo(250, 380, 255, 320); // neck
  ctx.quadraticCurveTo(220, 260, 220, 190); // head left
  ctx.quadraticCurveTo(220, 90, 300, 90);   // head top
  ctx.quadraticCurveTo(380, 90, 380, 190);  // head right
  ctx.quadraticCurveTo(380, 260, 345, 320);
  ctx.quadraticCurveTo(350, 380, 330, 430);
  ctx.quadraticCurveTo(360, 440, 370, 480);
  ctx.quadraticCurveTo(450, 520, 500, 750);
  ctx.closePath();
  ctx.fill();

  // Glasses & Beard detailing
  ctx.fillStyle = '#1e293b';
  // Glasses
  ctx.fillRect(250, 185, 35, 20);
  ctx.fillRect(315, 185, 35, 20);
  ctx.fillRect(285, 192, 30, 6);
  // Beard
  ctx.beginPath();
  ctx.moveTo(250, 250);
  ctx.quadraticCurveTo(300, 350, 350, 250);
  ctx.lineTo(340, 320);
  ctx.quadraticCurveTo(300, 370, 260, 320);
  ctx.closePath();
  ctx.fill();

  // Folded arms
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(300, 570, 110, 0.2, Math.PI - 0.2);
  ctx.stroke();

  return canvas.toDataURL('image/png');
}

export function processHalftoneCanvas(
  sourceImg: HTMLImageElement,
  options: HalftoneOptions,
  scale = 1
): HTMLCanvasElement {
  const targetW = Math.round(sourceImg.width * scale);
  const targetH = Math.round(sourceImg.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = options.bgColor;
  ctx.fillRect(0, 0, targetW, targetH);

  // Offscreen sampling canvas
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = targetW;
  sampleCanvas.height = targetH;
  const sampleCtx = sampleCanvas.getContext('2d')!;

  // Optional blur
  if (options.blur > 0) {
    sampleCtx.filter = `blur(${options.blur * scale}px)`;
  }
  sampleCtx.drawImage(sourceImg, 0, 0, targetW, targetH);

  const imgData = sampleCtx.getImageData(0, 0, targetW, targetH);
  const pixels = imgData.data;

  const spacing = Math.max(3, options.spacing * scale);
  const rad = (options.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const contrastFactor = (259 * (options.contrast + 255)) / (255 * (259 - options.contrast));

  const sampleIntensity = (px: number, py: number): number => {
    const x = Math.min(Math.max(0, Math.floor(px)), targetW - 1);
    const y = Math.min(Math.max(0, Math.floor(py)), targetH - 1);
    const i = (y * targetW + x) * 4;

    let r = pixels[i];
    let g = pixels[i + 1];
    let b = pixels[i + 2];

    // Contrast adjustment
    if (options.contrast !== 0) {
      r = Math.min(255, Math.max(0, contrastFactor * (r - 128) + 128));
      g = Math.min(255, Math.max(0, contrastFactor * (g - 128) + 128));
      b = Math.min(255, Math.max(0, contrastFactor * (b - 128) + 128));
    }

    let val = 0;
    if (options.channel === 'red') val = r;
    else if (options.channel === 'green') val = g;
    else if (options.channel === 'blue') val = b;
    else {
      // Luminance
      val = 0.299 * r + 0.587 * g + 0.114 * b;
    }

    let norm = val / 255;
    if (options.channel === 'invLum') {
      norm = 1 - norm;
    }
    if (options.invertChannel) {
      norm = 1 - norm;
    }

    // Gamma
    if (options.gamma !== 1 && norm > 0) {
      norm = Math.pow(norm, 1 / options.gamma);
    }

    return Math.min(1, Math.max(0, norm));
  };

  ctx.fillStyle = options.fgColor;
  ctx.strokeStyle = options.fgColor;

  const drawShape = (cx: number, cy: number, size: number) => {
    if (size <= 0.2) return;
    const r = size / 2;

    ctx.beginPath();
    switch (options.dotStyle) {
      case 'circle':
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        break;
      case 'square':
        ctx.rect(cx - r, cy - r, size, size);
        break;
      case 'diamond':
        ctx.moveTo(cx, cy - r * 1.2);
        ctx.lineTo(cx + r * 1.2, cy);
        ctx.lineTo(cx, cy + r * 1.2);
        ctx.lineTo(cx - r * 1.2, cy);
        ctx.closePath();
        break;
      case 'cross': {
        const arm = r * 0.35;
        ctx.rect(cx - arm, cy - r, arm * 2, size);
        ctx.rect(cx - r, cy - arm, size, arm * 2);
        break;
      }
      case 'ring':
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        if (options.outlineMode) {
          ctx.lineWidth = Math.max(1, r * 0.2);
          ctx.stroke();
          return;
        } else {
          ctx.fill();
          ctx.beginPath();
          ctx.fillStyle = options.bgColor;
          ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = options.fgColor;
          return;
        }
      case 'line':
        ctx.rect(cx - spacing * 0.45, cy - r, spacing * 0.9, size);
        break;
    }

    if (options.outlineMode) {
      ctx.lineWidth = Math.max(1, scale * 1.2);
      ctx.stroke();
    } else {
      ctx.fill();
    }
  };

  const maxDotRadius = (spacing / 2) * options.maxSize * options.globalSize;
  const minDotRadius = (spacing / 2) * options.minSize * options.globalSize;

  if (options.gridType === 'radial') {
    const centerX = targetW / 2;
    const centerY = targetH / 2;
    const maxDist = Math.hypot(centerX, centerY);

    for (let ring = spacing; ring < maxDist; ring += spacing) {
      const circum = 2 * Math.PI * ring;
      const count = Math.max(6, Math.floor(circum / spacing));
      const step = (Math.PI * 2) / count;

      for (let i = 0; i < count; i++) {
        const a = i * step + rad;
        const x = centerX + Math.cos(a) * ring;
        const y = centerY + Math.sin(a) * ring;

        if (x >= 0 && x < targetW && y >= 0 && y < targetH) {
          const intensity = sampleIntensity(x, y);
          const size = (minDotRadius + intensity * (maxDotRadius - minDotRadius)) * 2;
          drawShape(x, y, size);
        }
      }
    }
  } else {
    // Square or Hexagonal Grid with Rotation
    const diag = Math.hypot(targetW, targetH);
    const centerX = targetW / 2;
    const centerY = targetH / 2;

    const rowHeight = options.gridType === 'hexagonal' ? spacing * 0.866 : spacing;

    for (let gy = -diag; gy <= diag; gy += rowHeight) {
      const rowIndex = Math.round(gy / rowHeight);
      const rowOffset = options.gridType === 'hexagonal' && rowIndex % 2 !== 0 ? spacing * 0.5 : 0;

      for (let gx = -diag; gx <= diag; gx += spacing) {
        const xRot = (gx + rowOffset) * cos - gy * sin + centerX;
        const yRot = (gx + rowOffset) * sin + gy * cos + centerY;

        if (xRot >= -spacing && xRot <= targetW + spacing && yRot >= -spacing && yRot <= targetH + spacing) {
          const intensity = sampleIntensity(xRot, yRot);
          const size = (minDotRadius + intensity * (maxDotRadius - minDotRadius)) * 2;
          drawShape(xRot, yRot, size);
        }
      }
    }
  }

  return canvas;
}

export function generateHalftoneSVG(
  sourceImg: HTMLImageElement,
  options: HalftoneOptions
): string {
  const w = sourceImg.width;
  const h = sourceImg.height;

  // Offscreen sampling
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = w;
  sampleCanvas.height = h;
  const sampleCtx = sampleCanvas.getContext('2d')!;
  if (options.blur > 0) {
    sampleCtx.filter = `blur(${options.blur}px)`;
  }
  sampleCtx.drawImage(sourceImg, 0, 0, w, h);
  const pixels = sampleCtx.getImageData(0, 0, w, h).data;

  const spacing = Math.max(3, options.spacing);
  const rad = (options.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const sampleIntensity = (px: number, py: number): number => {
    const x = Math.min(Math.max(0, Math.floor(px)), w - 1);
    const y = Math.min(Math.max(0, Math.floor(py)), h - 1);
    const i = (y * w + x) * 4;

    const val = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
    let norm = val / 255;
    if (options.channel === 'invLum') norm = 1 - norm;
    if (options.invertChannel) norm = 1 - norm;
    if (options.gamma !== 1 && norm > 0) norm = Math.pow(norm, 1 / options.gamma);
    return Math.min(1, Math.max(0, norm));
  };

  const maxDotRadius = (spacing / 2) * options.maxSize * options.globalSize;
  const minDotRadius = (spacing / 2) * options.minSize * options.globalSize;

  const svgParts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">`,
    `<rect width="100%" height="100%" fill="${options.bgColor}" />`,
    `<g fill="${options.outlineMode ? 'none' : options.fgColor}" stroke="${options.outlineMode ? options.fgColor : 'none'}" stroke-width="${options.outlineMode ? 1.5 : 0}">`,
  ];

  const diag = Math.hypot(w, h);
  const cx = w / 2;
  const cy = h / 2;
  const rowHeight = options.gridType === 'hexagonal' ? spacing * 0.866 : spacing;

  for (let gy = -diag; gy <= diag; gy += rowHeight) {
    const rowIndex = Math.round(gy / rowHeight);
    const rowOffset = options.gridType === 'hexagonal' && rowIndex % 2 !== 0 ? spacing * 0.5 : 0;

    for (let gx = -diag; gx <= diag; gx += spacing) {
      const xRot = (gx + rowOffset) * cos - gy * sin + cx;
      const yRot = (gx + rowOffset) * sin + gy * cos + cy;

      if (xRot >= 0 && xRot <= w && yRot >= 0 && yRot <= h) {
        const intensity = sampleIntensity(xRot, yRot);
        const r = (minDotRadius + intensity * (maxDotRadius - minDotRadius));
        if (r > 0.4) {
          if (options.dotStyle === 'square') {
            svgParts.push(`<rect x="${(xRot - r).toFixed(1)}" y="${(yRot - r).toFixed(1)}" width="${(r * 2).toFixed(1)}" height="${(r * 2).toFixed(1)}" />`);
          } else {
            svgParts.push(`<circle cx="${xRot.toFixed(1)}" cy="${yRot.toFixed(1)}" r="${r.toFixed(1)}" />`);
          }
        }
      }
    }
  }

  svgParts.push(`</g></svg>`);
  return svgParts.join('\n');
}
