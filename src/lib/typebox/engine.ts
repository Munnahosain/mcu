import { TypeboxState } from "./types";

/**
 * Pseudo-random generator with seed
 */
function seededRandom(seed: number) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

/**
 * Get CSS font family string
 */
export function getFontFamilyCSS(fontFamily: string, customFontName: string | null): string {
  switch (fontFamily) {
    case "Pretendard":
      return "'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif";
    case "Myungjo":
      return "'Noto Serif KR', 'Nanum Myeongjo', 'Batang', serif";
    case "Inter":
      return "'Inter', sans-serif";
    case "Outfit":
      return "'Outfit', sans-serif";
    case "Orbitron":
      return "'Orbitron', monospace, sans-serif";
    case "Oswald":
      return "'Oswald', sans-serif";
    case "Caveat":
      return "'Caveat', cursive";
    case "Custom":
      return customFontName ? `'${customFontName}', sans-serif` : "sans-serif";
    default:
      return "'Pretendard', sans-serif";
  }
}

/**
 * Load an SVG string into an HTMLImageElement
 */
export function loadSvgImage(svgContent: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

/**
 * Main Render Engine for Typebox Studio
 */
export async function renderTypeboxToCanvas(
  targetCanvas: HTMLCanvasElement,
  state: TypeboxState,
  scaleMultiplier = 1
): Promise<void> {
  const width = state.artboardWidth * scaleMultiplier;
  const height = state.artboardHeight * scaleMultiplier;

  targetCanvas.width = width;
  targetCanvas.height = height;

  const ctx = targetCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;

  ctx.clearRect(0, 0, width, height);

  // 1. Draw Background
  if (!state.color.transparent) {
    ctx.fillStyle = state.color.bgColor;
    ctx.fillRect(0, 0, width, height);
  }

  // 2. Offscreen Canvas for Base Shape/Text
  const offCanvas = document.createElement("canvas");
  offCanvas.width = width;
  offCanvas.height = height;
  const offCtx = offCanvas.getContext("2d", { willReadFrequently: true });
  if (!offCtx) return;

  // Render Base Content (Text or SVG)
  offCtx.save();
  offCtx.translate(width / 2, height / 2);

  // Apply Transform: X, Y, Rotate
  const transX = state.transform.x * scaleMultiplier;
  const transY = state.transform.y * scaleMultiplier;
  offCtx.translate(transX, transY);
  offCtx.rotate((state.transform.rotate * Math.PI) / 180);

  // Apply Perspective skew/scale simulation
  const skewX = (state.transform.perspectiveH * Math.PI) / 360;
  const skewY = (state.transform.perspectiveV * Math.PI) / 360;
  offCtx.transform(1, Math.tan(skewY), Math.tan(skewX), 1, 0, 0);

  offCtx.fillStyle = state.color.textColor;
  offCtx.strokeStyle = state.color.textColor;

  if (state.sourceMode === "text") {
    const fontSize = state.fontSize * scaleMultiplier;
    const fontCSS = getFontFamilyCSS(state.fontFamily, state.customFontName);
    offCtx.font = `${state.fontWeight} ${fontSize}px ${fontCSS}`;
    offCtx.textBaseline = "middle";

    const lines = state.text.split("\n");
    const lineHeightPx = fontSize * state.lineHeight;
    const totalTextHeight = lines.length * lineHeightPx;
    const startY = -totalTextHeight / 2 + lineHeightPx / 2;

    lines.forEach((line, lineIdx) => {
      const curY = startY + lineIdx * lineHeightPx;
      const letterSpacingPx = state.letterSpacing * scaleMultiplier;

      if (letterSpacingPx === 0) {
        if (state.textAlign === "left") {
          offCtx.textAlign = "left";
          offCtx.fillText(line, -width * 0.35, curY);
        } else if (state.textAlign === "right") {
          offCtx.textAlign = "right";
          offCtx.fillText(line, width * 0.35, curY);
        } else {
          offCtx.textAlign = "center";
          offCtx.fillText(line, 0, curY);
        }
      } else {
        // Render letter-by-letter for custom letter spacing
        const chars = Array.from(line);
        const charWidths = chars.map((c) => offCtx.measureText(c).width);
        const lineContentWidth =
          charWidths.reduce((a, b) => a + b, 0) + (chars.length - 1) * letterSpacingPx;

        let curX = 0;
        if (state.textAlign === "center") {
          curX = -lineContentWidth / 2;
        } else if (state.textAlign === "right") {
          curX = width * 0.35 - lineContentWidth;
        } else {
          curX = -width * 0.35;
        }

        chars.forEach((char, cIdx) => {
          offCtx.textAlign = "left";
          offCtx.fillText(char, curX, curY);
          curX += charWidths[cIdx] + letterSpacingPx;
        });
      }
    });
  } else if (state.sourceMode === "svg" && state.svgContent) {
    try {
      const img = await loadSvgImage(state.svgContent);
      const aspect = img.width > 0 && img.height > 0 ? img.width / img.height : 1;
      const baseSize = Math.min(width, height) * 0.5 * state.svgScale;
      const drawW = aspect >= 1 ? baseSize : baseSize * aspect;
      const drawH = aspect >= 1 ? baseSize / aspect : baseSize;

      // Draw SVG tinted to text color
      const svgTemp = document.createElement("canvas");
      svgTemp.width = drawW;
      svgTemp.height = drawH;
      const svgCtx = svgTemp.getContext("2d");
      if (svgCtx) {
        svgCtx.drawImage(img, 0, 0, drawW, drawH);
        svgCtx.globalCompositeOperation = "source-in";
        svgCtx.fillStyle = state.color.textColor;
        svgCtx.fillRect(0, 0, drawW, drawH);
        offCtx.drawImage(svgTemp, -drawW / 2, -drawH / 2);
      }
    } catch {
      offCtx.font = `600 ${24 * scaleMultiplier}px sans-serif`;
      offCtx.textAlign = "center";
      offCtx.fillText("Invalid SVG File", 0, 0);
    }
  }
  offCtx.restore();

  // 3. Apply Selected Graphic Effect
  const effect = state.activeEffect;

  if (effect === "type") {
    // 6.1 Clean Type
    ctx.drawImage(offCanvas, 0, 0);
  } else if (effect === "dither") {
    // 6.2 Halftone / Dither
    renderDitherEffect(ctx, offCanvas, state.dither, state.color.textColor, scaleMultiplier);
  } else if (effect === "line") {
    // 6.3 Line Pattern
    renderLineEffect(ctx, offCanvas, state.line, state.color.textColor, scaleMultiplier);
  } else if (effect === "slice") {
    // 6.4 Slice & Displacement
    renderSliceEffect(ctx, offCanvas, state.slice, scaleMultiplier);
  } else if (effect === "boom") {
    // 6.5 Boom / Explosion Particle
    await renderBoomEffect(ctx, offCanvas, state.boom, state.color.textColor, scaleMultiplier);
  } else if (effect === "crack") {
    // 6.6 Crack / Fractured Glass
    renderCrackEffect(ctx, offCanvas, state.crack, state.color.textColor, scaleMultiplier);
  }
}

/**
 * 6.2 Halftone / Dither Effect
 */
function renderDitherEffect(
  ctx: CanvasRenderingContext2D,
  offCanvas: HTMLCanvasElement,
  dither: TypeboxState["dither"],
  textColor: string,
  scale: number
) {
  const width = offCanvas.width;
  const height = offCanvas.height;
  const offCtx = offCanvas.getContext("2d");
  if (!offCtx) return;

  const imgData = offCtx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const cellSize = Math.max(3, Math.round(dither.cellSize * scale));
  const angleRad = (dither.angle * Math.PI) / 180;
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);

  ctx.fillStyle = textColor;

  // Grid sampling
  const diag = Math.sqrt(width * width + height * height);
  const start = -diag / 2;
  const end = diag / 2;

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate(angleRad);

  for (let y = start; y < end; y += cellSize) {
    for (let x = start; x < end; x += cellSize) {
      // Map rotated (x, y) back to original canvas coords
      const origX = Math.round(x * cosA - y * sinA + width / 2);
      const origY = Math.round(x * sinA + y * cosA + height / 2);

      if (origX >= 0 && origX < width && origY >= 0 && origY < height) {
        const idx = (origY * width + origX) * 4;
        const alpha = data[idx + 3] / 255;

        if (alpha > 0.05) {
          const radius = (cellSize / 2) * alpha * dither.dotSize;
          if (radius > 0.5) {
            if (dither.shape === "dot") {
              ctx.beginPath();
              ctx.arc(x, y, radius, 0, Math.PI * 2);
              ctx.fill();
            } else {
              const sz = radius * 2;
              ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
            }
          }
        }
      }
    }
  }
  ctx.restore();
}

/**
 * 6.3 Line Pattern Effect
 */
function renderLineEffect(
  ctx: CanvasRenderingContext2D,
  offCanvas: HTMLCanvasElement,
  line: TypeboxState["line"],
  textColor: string,
  scale: number
) {
  const width = offCanvas.width;
  const height = offCanvas.height;

  const lineCanvas = document.createElement("canvas");
  lineCanvas.width = width;
  lineCanvas.height = height;
  const lineCtx = lineCanvas.getContext("2d");
  if (!lineCtx) return;

  const thickness = Math.max(1, line.thickness * scale);
  const gap = Math.max(1, line.gap * scale);
  const period = thickness + gap;
  const angleRad = (line.angle * Math.PI) / 180;
  const offset = ((line.offset + line.seed * 7) % period) * scale;

  lineCtx.save();
  lineCtx.translate(width / 2, height / 2);
  lineCtx.rotate(angleRad);

  const diag = Math.sqrt(width * width + height * height);
  lineCtx.strokeStyle = textColor;
  lineCtx.lineWidth = thickness;

  for (let y = -diag / 2 + offset; y < diag / 2; y += period) {
    lineCtx.beginPath();
    lineCtx.moveTo(-diag / 2, y);
    lineCtx.lineTo(diag / 2, y);
    lineCtx.stroke();
  }
  lineCtx.restore();

  // Mask line pattern using offscreen text/SVG shape
  lineCtx.globalCompositeOperation = "destination-in";
  lineCtx.drawImage(offCanvas, 0, 0);

  ctx.drawImage(lineCanvas, 0, 0);
}

/**
 * 6.4 Slice & Displacement Effect
 */
function renderSliceEffect(
  ctx: CanvasRenderingContext2D,
  offCanvas: HTMLCanvasElement,
  slice: TypeboxState["slice"],
  scale: number
) {
  const width = offCanvas.width;
  const height = offCanvas.height;
  const pieces = Math.max(2, slice.pieces);
  const pieceHeight = height / pieces;

  for (let i = 0; i < pieces; i++) {
    const sy = i * pieceHeight;
    const sh = pieceHeight + 1; // avoid subpixel seams

    let shift = 0;
    if (slice.mode === "alternate") {
      shift = (i % 2 === 0 ? 1 : -1) * slice.offset * scale;
    } else {
      const rand = seededRandom(slice.seed + i * 17);
      shift = (rand * 2 - 1) * slice.offset * scale;
    }

    ctx.drawImage(
      offCanvas,
      0,
      sy,
      width,
      sh,
      shift,
      sy,
      width,
      sh
    );
  }
}

/**
 * 6.5 Boom / Explosion Particle Effect
 */
async function renderBoomEffect(
  ctx: CanvasRenderingContext2D,
  offCanvas: HTMLCanvasElement,
  boom: TypeboxState["boom"],
  textColor: string,
  scale: number
) {
  const width = offCanvas.width;
  const height = offCanvas.height;
  const offCtx = offCanvas.getContext("2d");
  if (!offCtx) return;

  const imgData = offCtx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // Origin point
  let ox = width / 2;
  let oy = height / 2;

  switch (boom.origin) {
    case "top":
      ox = width / 2;
      oy = 0;
      break;
    case "bottom":
      ox = width / 2;
      oy = height;
      break;
    case "left":
      ox = 0;
      oy = height / 2;
      break;
    case "right":
      ox = width;
      oy = height / 2;
      break;
    case "top-left":
      ox = 0;
      oy = 0;
      break;
    case "top-right":
      ox = width;
      oy = 0;
      break;
    case "bottom-left":
      ox = 0;
      oy = height;
      break;
    case "bottom-right":
      ox = width;
      oy = height;
      break;
    case "glyph":
    case "center":
    default:
      ox = width / 2;
      oy = height / 2;
      break;
  }

  // Load custom shard SVG if any
  let shardImg: HTMLImageElement | null = null;
  if (boom.shape === "svg" && boom.shardSvgContent) {
    try {
      shardImg = await loadSvgImage(boom.shardSvgContent);
    } catch {
      shardImg = null;
    }
  }

  const shardSize = Math.max(2, boom.shardSize * scale);
  const spreadMax = boom.spread * scale;
  const step = Math.max(3, Math.round(shardSize * 0.9));

  ctx.fillStyle = textColor;
  ctx.strokeStyle = textColor;

  let shardIndex = 0;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = (y * width + x) * 4;
      const alpha = data[idx + 3] / 255;

      if (alpha > 0.25) {
        shardIndex++;
        const randA = seededRandom(boom.seed + shardIndex * 13);
        const randB = seededRandom(boom.seed + shardIndex * 29);
        const randAngle = seededRandom(boom.seed + shardIndex * 37) * Math.PI * 2;

        // Vector from origin
        let dx = x - ox;
        let dy = y - oy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        dx /= dist;
        dy /= dist;

        const pushDist = (randA * 0.8 + 0.2) * spreadMax;
        const finalX = x + dx * pushDist + (randB - 0.5) * (spreadMax * 0.4);
        const finalY = y + dy * pushDist + (randA - 0.5) * (spreadMax * 0.4);
        const curShardSize = shardSize * (0.6 + randB * 0.8) * alpha;

        ctx.save();
        ctx.translate(finalX, finalY);
        ctx.rotate(randAngle);

        if (shardImg && boom.shape === "svg") {
          ctx.drawImage(shardImg, -curShardSize / 2, -curShardSize / 2, curShardSize, curShardSize);
        } else if (boom.shape === "dot" || (boom.shape === "svg" && !shardImg)) {
          ctx.beginPath();
          ctx.arc(0, 0, curShardSize / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (boom.shape === "square") {
          ctx.fillRect(-curShardSize / 2, -curShardSize / 2, curShardSize, curShardSize);
        } else if (boom.shape === "triangle") {
          ctx.beginPath();
          ctx.moveTo(0, -curShardSize / 2);
          ctx.lineTo(curShardSize / 2, curShardSize / 2);
          ctx.lineTo(-curShardSize / 2, curShardSize / 2);
          ctx.closePath();
          ctx.fill();
        }

        ctx.restore();
      }
    }
  }
}

/**
 * 6.6 Crack / Fractured Glass Effect
 */
function renderCrackEffect(
  ctx: CanvasRenderingContext2D,
  offCanvas: HTMLCanvasElement,
  crack: TypeboxState["crack"],
  textColor: string,
  scale: number
) {
  const width = offCanvas.width;
  const height = offCanvas.height;
  const pieces = Math.max(4, crack.pieces);
  const gap = crack.gap * scale;
  const scatter = crack.scatter * scale;
  const spread = crack.spread * scale;

  // Generate crack polygon segments
  const cols = Math.ceil(Math.sqrt(pieces * 1.5));
  const rows = Math.ceil(pieces / cols);
  const cellW = width / cols;
  const cellH = height / rows;

  let pIndex = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      pIndex++;
      const rand1 = seededRandom(crack.seed + pIndex * 19);
      const rand2 = seededRandom(crack.seed + pIndex * 31);
      const rand3 = seededRandom(crack.seed + pIndex * 43);

      const sx = c * cellW;
      const sy = r * cellH;

      // Displacement
      const offsetX = (rand1 * 2 - 1) * scatter;
      const offsetY = (rand2 * 2 - 1) * scatter;
      const rot = (rand3 * 2 - 1) * (spread * 0.08);

      const cx = sx + cellW / 2;
      const cy = sy + cellH / 2;

      ctx.save();
      ctx.translate(cx + offsetX, cy + offsetY);
      ctx.rotate((rot * Math.PI) / 180);

      // Clip cracked tile with gap
      ctx.beginPath();
      const shrink = gap / 2;
      ctx.rect(-cellW / 2 + shrink, -cellH / 2 + shrink, Math.max(1, cellW - gap), Math.max(1, cellH - gap));
      ctx.clip();

      ctx.drawImage(offCanvas, -cx, -cy);
      ctx.restore();
    }
  }

  // Draw subtle fracture lines
  if (gap > 0) {
    ctx.save();
    ctx.strokeStyle = textColor;
    ctx.lineWidth = Math.min(1.5 * scale, gap * 0.3);
    ctx.globalAlpha = 0.3;

    for (let i = 0; i < pieces; i++) {
      const rx1 = seededRandom(crack.seed + i * 53) * width;
      const ry1 = seededRandom(crack.seed + i * 67) * height;
      const rx2 = rx1 + (seededRandom(crack.seed + i * 79) * 2 - 1) * 120 * scale;
      const ry2 = ry1 + (seededRandom(crack.seed + i * 97) * 2 - 1) * 120 * scale;

      ctx.beginPath();
      ctx.moveTo(rx1, ry1);
      ctx.lineTo(rx2, ry2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/**
 * Generate Standalone Vector SVG String (no external fonts required)
 */
export function generateSvgExport(state: TypeboxState): string {
  const width = state.artboardWidth;
  const height = state.artboardHeight;
  const bg = state.color.transparent ? "" : `<rect width="100%" height="100%" fill="${state.color.bgColor}"/>`;

  const fontCSS = getFontFamilyCSS(state.fontFamily, state.customFontName);
  const lines = state.text.split("\n");
  const fontSize = state.fontSize;
  const lineHeightPx = fontSize * state.lineHeight;
  const totalH = lines.length * lineHeightPx;
  const startY = height / 2 - totalH / 2 + lineHeightPx / 2 + state.transform.y;

  const textAnchor = state.textAlign === "center" ? "middle" : state.textAlign === "right" ? "end" : "start";
  const anchorX = state.textAlign === "center" ? width / 2 : state.textAlign === "right" ? width * 0.85 : width * 0.15;
  const finalAnchorX = anchorX + state.transform.x;

  let textNodes = "";
  lines.forEach((line, i) => {
    const y = startY + i * lineHeightPx;
    textNodes += `<text x="${finalAnchorX}" y="${y}" text-anchor="${textAnchor}" fill="${state.color.textColor}" font-family="${fontCSS}" font-size="${fontSize}px" font-weight="${state.fontWeight}" letter-spacing="${state.letterSpacing}px" dominant-baseline="central">${escapeXml(line)}</text>\n`;
  });

  const transformAttr = state.transform.rotate !== 0 
    ? `transform="rotate(${state.transform.rotate} ${width / 2} ${height / 2})"` 
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;700;900&amp;family=Orbitron:wght@400;700;900&amp;family=Inter:wght@400;700;900&amp;family=Outfit:wght@400;700;900&amp;display=swap');
    text { user-select: none; }
  </style>
  ${bg}
  <g ${transformAttr}>
    ${textNodes}
  </g>
</svg>`;
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case '"': return "&quot;";
      default: return c;
    }
  });
}
