import { DesignElement, PatternSettings } from '../types';
import { getPresetByKind } from './shapeLibrary';
import { getToroidalInstances, calculateFabricMetrics } from './seamlessMath';

/**
 * Draws the master 1:1 pattern tile onto an HTML5 canvas context.
 * If clipToArtboard is true, anything outside [0, size] is clipped.
 * Toroidal wrapped instances are drawn seamlessly.
 */
const imageCache = new Map<string, HTMLImageElement>();

function loadImage(source: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(source);
  if (cached?.complete && cached.naturalWidth > 0) return Promise.resolve(cached);
  return new Promise((resolve, reject) => {
    const image = cached ?? new Image();
    image.onload = () => { imageCache.set(source, image); resolve(image); };
    image.onerror = () => {
      imageCache.delete(source);
      reject(new Error('Unable to load uploaded pattern image'));
    };
    if (!cached) {
      imageCache.set(source, image);
      image.src = source;
    }
  });
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function drawTileToCanvas(
  ctx: CanvasRenderingContext2D,
  elements: DesignElement[],
  settings: PatternSettings,
  targetWidth: number,
  targetHeight: number,
  clipToArtboard: boolean = true
): Promise<void> {
  const svg = generateTileSvg(elements, settings);
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));

  try {
    const image = await loadImage(svgUrl);
    ctx.clearRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

/**
 * Generates an SVG string representation of the 1:1 seamless tile
 */
export function generateTileSvg(
  elements: DesignElement[],
  settings: PatternSettings
): string {
  const size = settings.artboardSize;
  const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);

  let elementsSvg = '';

  for (const el of sorted) {
    const instances = getToroidalInstances(el, size);
    for (const inst of instances) {
      if (el.type === 'shape' && el.shapeKind) {
        const preset = getPresetByKind(el.shapeKind);
        const transform = `translate(${inst.x} ${inst.y}) rotate(${el.rotation}) scale(${el.scaleX} ${el.scaleY}) translate(${-el.width / 2} ${-el.height / 2}) scale(${el.width / 100} ${el.height / 100})`;
        elementsSvg += `
          <g transform="${transform}" opacity="${el.opacity}">
            <path d="${preset.path}" fill="${el.fill}" stroke="${el.stroke || 'none'}" stroke-width="${el.strokeWidth || 0}" />
          </g>`;
      } else if (el.type === 'path' && el.pathData) {
        const transform = `translate(${inst.x} ${inst.y}) rotate(${el.rotation}) scale(${el.scaleX} ${el.scaleY}) translate(${-el.width / 2} ${-el.height / 2})`;
        elementsSvg += `
          <g transform="${transform}" opacity="${el.opacity}">
            <path d="${el.pathData}" fill="${el.fill}" stroke="${el.stroke || 'none'}" stroke-width="${el.strokeWidth || 0}" stroke-linecap="round" stroke-linejoin="round" />
          </g>`;
      } else if (el.type === 'text' && el.textContent) {
        const transform = `translate(${inst.x} ${inst.y}) rotate(${el.rotation}) scale(${el.scaleX} ${el.scaleY})`;
        elementsSvg += `
          <g transform="${transform}" opacity="${el.opacity}">
            <text x="0" y="0" font-family="${escapeXml(el.fontFamily || 'sans-serif')}" font-size="${el.fontSize || 32}" fill="${escapeXml(el.fill)}" text-anchor="middle" dominant-baseline="central">
              ${escapeXml(el.textContent)}
            </text>
          </g>`;
      } else if (el.type === 'image' && el.imageUrl) {
        const transform = `translate(${inst.x} ${inst.y}) rotate(${el.rotation}) scale(${el.scaleX} ${el.scaleY})`;
        const embeddedImage = escapeXml(el.imageUrl);
        elementsSvg += `<g transform="${transform}" opacity="${el.opacity}"><image xlink:href="${embeddedImage}" href="${embeddedImage}" x="${-el.width / 2}" y="${-el.height / 2}" width="${el.width}" height="${el.height}" preserveAspectRatio="xMidYMid meet" /></g>`;
      }
    }
  }

  const bgRect = !settings.backgroundTransparent
    ? `<rect width="${size}" height="${size}" fill="${settings.backgroundColor}" />`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <defs>
    <clipPath id="artboard-clip">
      <rect width="${size}" height="${size}" />
    </clipPath>
  </defs>
  ${bgRect}
  <g clip-path="url(#artboard-clip)">
    ${elementsSvg}
  </g>
</svg>`;
}

/**
 * Triggers browser download of a blob or data URL
 */
export function triggerDownload(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Exports high-resolution 1:1 seamless tile as PNG
 */
export async function exportHighResTile(
  elements: DesignElement[],
  settings: PatternSettings,
  resolutionMultiplier: number = 3 // 500px -> 1500px or up to 3000px
): Promise<void> {
  const canvas = document.createElement('canvas');
  const size = settings.artboardSize * resolutionMultiplier;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  await drawTileToCanvas(ctx, elements, settings, size, size, true);

  const filename = `fabric-pattern-tile-${settings.physicalSize}${settings.physicalUnit}-${size}x${size}px.png`;
  triggerDownload(canvas.toDataURL('image/png'), filename);
}

/**
 * Exports tiled yardage sheet as PNG (e.g. 3x3 or 4x4 repeat)
 */
export async function exportTiledFabric(
  elements: DesignElement[],
  settings: PatternSettings,
  repeatCols: number = 4,
  repeatRows: number = 4,
  tileSizePx: number = 400
): Promise<void> {
  const canvas = document.createElement('canvas');
  const totalW = repeatCols * tileSizePx;
  const totalH = repeatRows * tileSizePx;
  canvas.width = totalW;
  canvas.height = totalH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Render tile onto an offscreen canvas
  const tileCanvas = document.createElement('canvas');
  tileCanvas.width = tileSizePx;
  tileCanvas.height = tileSizePx;
  const tileCtx = tileCanvas.getContext('2d');
  if (!tileCtx) return;
  await drawTileToCanvas(tileCtx, elements, settings, tileSizePx, tileSizePx, true);

  // Background
  if (!settings.backgroundTransparent) {
    ctx.fillStyle = settings.backgroundColor;
    ctx.fillRect(0, 0, totalW, totalH);
  }

  // Draw repeats with repeatType offset (Grid, Half-Drop, Half-Brick)
  for (let c = 0; c < repeatCols; c++) {
    for (let r = 0; r < repeatRows; r++) {
      let x = c * tileSizePx;
      let y = r * tileSizePx;

      if (settings.repeatType === 'half-drop') {
        if (c % 2 === 1) {
          y += tileSizePx / 2;
        }
      } else if (settings.repeatType === 'half-brick') {
        if (r % 2 === 1) {
          x += tileSizePx / 2;
        }
      }

      ctx.drawImage(tileCanvas, x, y);

      // Wrap if half-drop or half-brick leaves top/left gap
      if (settings.repeatType === 'half-drop' && c % 2 === 1) {
        ctx.drawImage(tileCanvas, x, y - tileSizePx * repeatRows);
      }
      if (settings.repeatType === 'half-brick' && r % 2 === 1) {
        ctx.drawImage(tileCanvas, x - tileSizePx * repeatCols, y);
      }
    }
  }

  const filename = `fabric-yardage-${repeatCols}x${repeatRows}-repeat-${settings.repeatType}.png`;
  triggerDownload(canvas.toDataURL('image/png'), filename);
}

/**
 * Generates and downloads Fabric Cutting Spec Sheet (with repeat dimensions, seam guide & metrics)
 */
export async function exportFabricSpecSheet(
  elements: DesignElement[],
  settings: PatternSettings
): Promise<void> {
  const metrics = calculateFabricMetrics(
    settings.physicalSize,
    settings.physicalUnit,
    settings.fabricBoltWidth,
    settings.fabricLength,
    settings.dpi
  );

  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = 1200;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Header Banner
  ctx.fillStyle = '#1c1917'; // stone-900
  ctx.fillRect(0, 0, canvas.width, 110);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('FABRIC CUTTING & PATTERN SPECIFICATION MAP', 50, 60);

  ctx.fillStyle = '#f59e0b'; // amber-500
  ctx.font = '500 18px "JetBrains Mono", monospace';
  ctx.fillText(`REPEAT SIZE: ${metrics.tileSizeCm} cm x ${metrics.tileSizeCm} cm (${metrics.tileSizeInches}" x ${metrics.tileSizeInches}") | ${settings.repeatType.toUpperCase()} REPEAT`, 50, 92);

  // Render 1:1 Pattern Tile (Centered Left: 600x600 px)
  const tileX = 60;
  const tileY = 160;
  const tileW = 600;
  const tileH = 600;

  // Draw tile preview
  const tileCanvas = document.createElement('canvas');
  tileCanvas.width = tileW;
  tileCanvas.height = tileH;
  const tileCtx = tileCanvas.getContext('2d');
  if (tileCtx) {
    await drawTileToCanvas(tileCtx, elements, settings, tileW, tileH, true);
    ctx.drawImage(tileCanvas, tileX, tileY);
  }

  // Draw artboard border and seam allowance overlay
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.strokeRect(tileX, tileY, tileW, tileH);

  // Cutting allowance dashed line
  ctx.strokeStyle = '#ef4444';
  ctx.setLineDash([8, 6]);
  ctx.lineWidth = 2;
  const seamPx = (settings.seamAllowance / settings.physicalSize) * tileW;
  if (seamPx > 0 && seamPx < tileW / 2) {
    ctx.strokeRect(tileX + seamPx, tileY + seamPx, tileW - seamPx * 2, tileH - seamPx * 2);
  }
  ctx.setLineDash([]);

  // Labels under tile
  ctx.fillStyle = '#44403c';
  ctx.font = '14px "JetBrains Mono", monospace';
  ctx.fillText(`1:1 Master Tile: ${metrics.tileSizeCm} cm (${settings.artboardSize}x${settings.artboardSize} px virtual)`, tileX, tileY + tileH + 30);
  ctx.fillStyle = '#ef4444';
  ctx.fillText(`Dashed Line = Seam Allowance / Safe Cut Zone (${settings.seamAllowance} ${settings.physicalUnit})`, tileX, tileY + tileH + 52);

  // Technical Specification Table on Right
  const rightX = 720;
  let curY = 180;

  ctx.fillStyle = '#1c1917';
  ctx.font = 'bold 24px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Production & Tailoring Guidelines', rightX, curY);
  curY += 40;

  const specRows = [
    ['Pattern Repeat Type', `${settings.repeatType.toUpperCase()} (Seamless Toroidal Edge)`],
    ['Physical Tile Dimensions', `${metrics.tileSizeCm} cm × ${metrics.tileSizeCm} cm (${metrics.tileSizeInches}" × ${metrics.tileSizeInches}")`],
    ['Recommended Print DPI', `${metrics.dpiResolution} DPI (High Definition Textile)`],
    ['Output Pixel Dimensions', `${metrics.pixelWidthForPrint} × ${metrics.pixelWidthForPrint} px`],
    ['Standard Fabric Bolt Width', `${metrics.boltWidthCm} cm (${metrics.boltWidthInches} inches)`],
    ['Fabric Bolt Yardage Length', `${metrics.fabricLengthCm} cm (${metrics.fabricLengthInches} inches)`],
    ['Full Repeats Across Width', `${metrics.repeatsAcrossWidth} pattern units`],
    ['Recommended Cut Width', `${metrics.recommendedCutWidthCm} cm (${metrics.remainingWidthCm} cm selvage waste)`],
    ['Full Repeats Along Length', `${metrics.repeatsAlongLength} pattern units`],
    ['Total Pattern Yield (per length)', `${metrics.totalRepeatsInYardage} whole pattern tiles`],
    ['Seam Allowance Boundary', `${settings.seamAllowance} ${settings.physicalUnit}`],
  ];

  ctx.font = '14px "Plus Jakarta Sans", sans-serif';
  for (const [label, val] of specRows) {
    ctx.fillStyle = '#78716c';
    ctx.fillText(label, rightX, curY);

    ctx.fillStyle = '#1c1917';
    ctx.font = 'bold 14px "JetBrains Mono", monospace';
    ctx.fillText(val, rightX + 380, curY);
    ctx.font = '14px "Plus Jakarta Sans", sans-serif';

    // Divider line
    ctx.strokeStyle = '#e7e5e4';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rightX, curY + 12);
    ctx.lineTo(canvas.width - 60, curY + 12);
    ctx.stroke();

    curY += 36;
  }

  // Color Swatches Palette extracted from elements
  curY += 20;
  ctx.fillStyle = '#1c1917';
  ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Design Color Swatches (Pantone / Dye Map)', rightX, curY);
  curY += 35;

  const uniqueColors = Array.from(
    new Set(
      elements
        .map((e) => e.fill)
        .filter((c) => c && c !== 'none')
        .concat(settings.backgroundTransparent ? [] : [settings.backgroundColor])
    )
  ).slice(0, 8);

  let swatchX = rightX;
  for (const col of uniqueColors) {
    ctx.fillStyle = col;
    ctx.fillRect(swatchX, curY, 44, 44);
    ctx.strokeStyle = '#d6d3d1';
    ctx.lineWidth = 1;
    ctx.strokeRect(swatchX, curY, 44, 44);

    ctx.fillStyle = '#57534e';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillText(col.toUpperCase(), swatchX, curY + 62);
    swatchX += 95;
  }

  // Footer Calibration Scale (10 cm physical check ruler)
  const footerY = 1120;
  ctx.fillStyle = '#fafaf9';
  ctx.fillRect(0, footerY, canvas.width, 80);
  ctx.strokeStyle = '#e7e5e4';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, footerY);
  ctx.lineTo(canvas.width, footerY);
  ctx.stroke();

  ctx.fillStyle = '#44403c';
  ctx.font = '13px "JetBrains Mono", monospace';
  ctx.fillText('PRINT CALIBRATION SCALE: Measure after printing on paper/fabric to verify 100% scale accuracy.', 50, footerY + 35);

  // Draw 10 cm calibration bar
  const calibStartX = 900;
  const calibWidth = 378; // approx 10cm on 96dpi screen
  ctx.strokeStyle = '#1c1917';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(calibStartX, footerY + 35);
  ctx.lineTo(calibStartX + calibWidth, footerY + 35);
  ctx.stroke();

  // Tick marks
  for (let i = 0; i <= 10; i++) {
    const tx = calibStartX + (i / 10) * calibWidth;
    const h = i % 5 === 0 ? 14 : 7;
    ctx.beginPath();
    ctx.moveTo(tx, footerY + 35 - h);
    ctx.lineTo(tx, footerY + 35 + h);
    ctx.stroke();
    if (i % 2 === 0) {
      ctx.fillStyle = '#1c1917';
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillText(`${i}cm`, tx - 10, footerY + 35 + 24);
    }
  }

  triggerDownload(canvas.toDataURL('image/png'), `fabric-cutting-spec-sheet-${settings.physicalSize}${settings.physicalUnit}.png`);
}
