import { GridConfig, CompositionScores, ReferenceAnalysis } from "./types";

export const PHI = 1.61803398875;

// Hash generator for unique random grid seed
export function generateSeed(prefix = "GRID"): string {
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${rand}`;
}

export function seedToFloat(seed: string, offset = 0): number {
  let hash = 2166136261;
  const combined = seed + ":" + offset;
  for (let i = 0; i < combined.length; i++) {
    hash = Math.imul(hash ^ combined.charCodeAt(i), 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
}

// Generate smart layout defaults based on grid type
export function createDefaultConfig(type: GridConfig["type"] = "smart", seed = generateSeed()): GridConfig {
  const r1 = seedToFloat(seed, 1);
  const r2 = seedToFloat(seed, 2);
  const r3 = seedToFloat(seed, 3);
  const r4 = seedToFloat(seed, 4);

  let columns = 12;
  let rows = 8;
  let showGoldenSpiral = false;
  let showFibonacciSpiral = false;
  let showThirds = true;
  let showDiagonals = false;
  let showBaseline = false;

  switch (type) {
    case "golden":
      columns = 5;
      rows = 3;
      showGoldenSpiral = true;
      showThirds = false;
      break;
    case "fibonacci":
      columns = 8;
      rows = 5;
      showFibonacciSpiral = true;
      showThirds = false;
      break;
    case "thirds":
      columns = 3;
      rows = 3;
      showThirds = true;
      break;
    case "columns":
      columns = 12;
      rows = 1;
      showThirds = false;
      break;
    case "rows":
      columns = 1;
      rows = 8;
      showThirds = false;
      break;
    case "modular":
      columns = 6;
      rows = 4;
      showThirds = false;
      break;
    case "isometric":
      columns = 12;
      rows = 12;
      showThirds = false;
      break;
    case "diagonal":
      columns = 4;
      rows = 4;
      showDiagonals = true;
      break;
    case "baseline":
      columns = 12;
      rows = 16;
      showBaseline = true;
      break;
    case "smart":
    default:
      columns = 4 + Math.floor(r1 * 9); // 4-12 columns
      rows = 3 + Math.floor(r2 * 6); // 3-8 rows
      showThirds = true;
      showGoldenSpiral = r3 > 0.5;
      break;
  }

  return {
    type,
    columns,
    rows,
    margin: 4 + Math.floor(r3 * 8), // 4% - 12%
    gutter: 12 + Math.floor(r4 * 20), // 12px - 32px
    focalX: Math.round(30 + r1 * 40), // 30% - 70%
    focalY: Math.round(30 + r2 * 40),
    gridColor: "#16c784",
    accentColor: "#f5c451",
    opacity: 0.75,
    lineWidth: 1.5,
    lineStyle: "solid",
    showMargins: true,
    showColumns: true,
    showRows: true,
    showGutters: true,
    showGoldenSpiral,
    showFibonacciSpiral,
    showThirds,
    showDiagonals,
    showFocal: true,
    showBaseline,
    baselineStep: 16,
    isometricAngle: 30,
    bgMode: "dark",
    bgColor: "#0c131a",
    seed,
  };
}

// Calculate mathematically sound composition scores
export function calculateCompositionScores(config: GridConfig, width: number, height: number): CompositionScores {
  const aspect = width / Math.max(height, 1);
  const goldenDev = Math.abs(aspect - PHI);
  const goldenMatch = Math.max(50, Math.min(100, Math.round((1 - goldenDev / 1.2) * 100)));

  // Thirds alignment of focal point
  const thirdsXDev = Math.min(
    Math.abs(config.focalX - 33.33),
    Math.abs(config.focalX - 66.66),
    Math.abs(config.focalX - 50)
  );
  const thirdsYDev = Math.min(
    Math.abs(config.focalY - 33.33),
    Math.abs(config.focalY - 66.66),
    Math.abs(config.focalY - 50)
  );
  const thirdsMatch = Math.max(60, Math.min(99, Math.round(100 - (thirdsXDev + thirdsYDev) * 1.2)));

  // Balance (how well distributed focal is vs center)
  const balance = Math.max(68, Math.min(98, Math.round(98 - Math.abs(config.focalX - 50) * 0.4 - Math.abs(config.focalY - 50) * 0.4)));

  // Hierarchy (columns + rows visual nesting)
  const hierarchy = Math.max(70, Math.min(99, Math.round(75 + (config.columns % 2 === 0 ? 10 : 5) + (config.rows % 2 === 0 ? 10 : 5))));

  // Alignment
  const alignment = Math.max(72, Math.min(98, Math.round(80 + (config.showGutters ? 10 : 0) + (config.showMargins ? 8 : 0))));

  // Proportion
  const proportion = Math.max(65, Math.min(99, Math.round((goldenMatch * 0.6) + (thirdsMatch * 0.4))));

  // Rhythm
  const rhythm = Math.max(70, Math.min(97, Math.round(72 + Math.min(config.columns * 2 + config.rows * 1.5, 25))));

  // Negative space
  const negativeSpace = Math.max(65, Math.min(96, Math.round(100 - config.margin * 1.8)));

  // Overall Score
  const overallScore = Math.round((hierarchy * 0.2 + balance * 0.2 + alignment * 0.2 + proportion * 0.2 + rhythm * 0.1 + negativeSpace * 0.1));

  return {
    overallScore,
    hierarchy,
    balance,
    alignment,
    proportion,
    rhythm,
    negativeSpace,
    goldenMatch,
    thirdsMatch,
  };
}

// Generate Full SVG Graphic with accurate vectors
export function buildGridSvg(
  config: GridConfig,
  width: number,
  height: number,
  options?: { isExport?: boolean }
): string {
  const marginX = (width * config.margin) / 100;
  const marginY = (height * config.margin) / 100;
  const contentWidth = Math.max(width - marginX * 2, 10);
  const contentHeight = Math.max(height - marginY * 2, 10);

  const elements: string[] = [];
  const primaryColor = config.gridColor || "#16c784";
  const accentColor = config.accentColor || "#f5c451";
  const strokeDash =
    config.lineStyle === "dashed" ? 'stroke-dasharray="8 6"' : config.lineStyle === "dotted" ? 'stroke-dasharray="2 4"' : "";

  // 1. Column Guidelines & Gutters
  if (config.showColumns && config.columns > 0) {
    const totalGutters = (config.columns - 1) * config.gutter;
    const colWidth = Math.max((contentWidth - totalGutters) / config.columns, 1);

    for (let c = 0; c < config.columns; c++) {
      const colX = marginX + c * (colWidth + config.gutter);

      // Column fill highlight
      elements.push(
        `<rect x="${colX}" y="${marginY}" width="${colWidth}" height="${contentHeight}" fill="${primaryColor}" fill-opacity="0.04" stroke="${primaryColor}" stroke-opacity="${config.opacity * 0.35}" stroke-width="${config.lineWidth * 0.7}" ${strokeDash}/>`
      );

      // Gutter visualization
      if (config.showGutters && c < config.columns - 1 && config.gutter > 0) {
        elements.push(
          `<rect x="${colX + colWidth}" y="${marginY}" width="${config.gutter}" height="${contentHeight}" fill="${accentColor}" fill-opacity="0.08" stroke="${accentColor}" stroke-opacity="0.2" stroke-width="0.5" stroke-dasharray="3 3"/>`
        );
      }
    }
  }

  // 2. Row Guidelines & Row Gutters
  if (config.showRows && config.rows > 0) {
    const totalRowGutters = (config.rows - 1) * (config.gutter * 0.75);
    const rowHeight = Math.max((contentHeight - totalRowRowGutters(config.rows, config.gutter)) / config.rows, 1);

    for (let r = 0; r < config.rows; r++) {
      const rowY = marginY + r * (rowHeight + config.gutter * 0.75);

      elements.push(
        `<line x1="${marginX}" y1="${rowY}" x2="${width - marginX}" y2="${rowY}" stroke="${primaryColor}" stroke-opacity="${config.opacity * 0.4}" stroke-width="${config.lineWidth * 0.7}" ${strokeDash}/>`
      );

      if (r === config.rows - 1) {
        elements.push(
          `<line x1="${marginX}" y1="${rowY + rowHeight}" x2="${width - marginX}" y2="${rowY + rowHeight}" stroke="${primaryColor}" stroke-opacity="${config.opacity * 0.4}" stroke-width="${config.lineWidth * 0.7}" ${strokeDash}/>`
        );
      }
    }
  }

  // 3. Margin Boundary
  if (config.showMargins && config.margin > 0) {
    elements.push(
      `<rect x="${marginX}" y="${marginY}" width="${contentWidth}" height="${contentHeight}" fill="none" stroke="${accentColor}" stroke-width="${config.lineWidth * 1.2}" stroke-opacity="${config.opacity * 0.85}" stroke-dasharray="10 8"/>`
    );

    // Margin Corner Marks
    const cornerSize = Math.min(24, marginX * 0.8, marginY * 0.8);
    elements.push(
      `<path d="M${marginX},${marginY + cornerSize} L${marginX},${marginY} L${marginX + cornerSize},${marginY}" fill="none" stroke="${accentColor}" stroke-width="${config.lineWidth * 1.8}"/>`,
      `<path d="M${width - marginX - cornerSize},${marginY} L${width - marginX},${marginY} L${width - marginX},${marginY + cornerSize}" fill="none" stroke="${accentColor}" stroke-width="${config.lineWidth * 1.8}"/>`,
      `<path d="M${marginX},${height - marginY - cornerSize} L${marginX},${height - marginY} L${marginX + cornerSize},${height - marginY}" fill="none" stroke="${accentColor}" stroke-width="${config.lineWidth * 1.8}"/>`,
      `<path d="M${width - marginX - cornerSize},${height - marginY} L${width - marginX},${height - marginY} L${width - marginX},${height - marginY - cornerSize}" fill="none" stroke="${accentColor}" stroke-width="${config.lineWidth * 1.8}"/>`
    );
  }

  // 4. Rule of Thirds Overlays
  if (config.showThirds) {
    const tX1 = width / 3;
    const tX2 = (width * 2) / 3;
    const tY1 = height / 3;
    const tY2 = (height * 2) / 3;

    elements.push(
      `<g stroke="${accentColor}" stroke-width="${config.lineWidth}" stroke-opacity="${config.opacity * 0.6}" stroke-dasharray="6 4">`,
      `<line x1="${tX1}" y1="0" x2="${tX1}" y2="${height}"/>`,
      `<line x1="${tX2}" y1="0" x2="${tX2}" y2="${height}"/>`,
      `<line x1="0" y1="${tY1}" x2="${width}" y2="${tY1}"/>`,
      `<line x1="0" y1="${tY2}" x2="${width}" y2="${tY2}"/>`,
      `</g>`
    );

    // 4 Power Intersections
    const points = [
      [tX1, tY1],
      [tX2, tY1],
      [tX1, tY2],
      [tX2, tY2],
    ];
    for (const [px, py] of points) {
      elements.push(
        `<circle cx="${px}" cy="${py}" r="${Math.min(width, height) * 0.024}" fill="none" stroke="${accentColor}" stroke-width="${config.lineWidth * 1.5}" stroke-opacity="${config.opacity * 0.9}"/>`,
        `<circle cx="${px}" cy="${py}" r="${Math.min(width, height) * 0.008}" fill="${accentColor}" fill-opacity="${config.opacity * 0.9}"/>`
      );
    }
  }

  // 5. True Golden Ratio Harmonic Spiral & Whirling Squares
  if (config.showGoldenSpiral) {
    elements.push(renderGoldenSpiral(width, height, accentColor, config.lineWidth, config.opacity));
  }

  // 6. True Fibonacci Spiral
  if (config.showFibonacciSpiral) {
    elements.push(renderFibonacciSpiral(width, height, primaryColor, config.lineWidth, config.opacity));
  }

  // 7. Dynamic Symmetry Diagonals
  if (config.showDiagonals) {
    elements.push(
      `<g stroke="${primaryColor}" stroke-width="${config.lineWidth}" stroke-opacity="${config.opacity * 0.5}">`,
      `<line x1="0" y1="0" x2="${width}" y2="${height}"/>`,
      `<line x1="0" y1="${height}" x2="${width}" y2="0"/>`,
      `<line x1="${width / 2}" y1="0" x2="${width}" y2="${height / 2}"/>`,
      `<line x1="0" y1="${height / 2}" x2="${width / 2}" y2="${height}"/>`,
      `<line x1="${width / 2}" y1="0" x2="0" y2="${height / 2}"/>`,
      `<line x1="${width}" y1="${height / 2}" x2="${width / 2}" y2="${height}"/>`,
      `</g>`
    );
  }

  // 8. Typographic Baseline Grid
  if (config.showBaseline) {
    const step = Math.max(config.baselineStep, 8);
    const baselineLines: string[] = [];
    for (let y = step; y < height; y += step) {
      baselineLines.push(
        `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="${primaryColor}" stroke-opacity="${config.opacity * 0.18}" stroke-width="0.75"/>`
      );
    }
    elements.push(`<g>${baselineLines.join("")}</g>`);
  }

  // 9. Isometric Grid Mesh
  if (config.type === "isometric") {
    elements.push(renderIsometricMesh(width, height, primaryColor, config.lineWidth, config.opacity));
  }

  // 10. Focal Point Target Crosshair & Radar Rings
  if (config.showFocal) {
    const fx = (width * config.focalX) / 100;
    const fy = (height * config.focalY) / 100;
    const rOuter = Math.min(width, height) * 0.05;
    const rMid = Math.min(width, height) * 0.025;
    const rCore = Math.min(width, height) * 0.008;

    elements.push(
      `<g id="focal-point-group" transform="translate(${fx}, ${fy})">`,
      `<circle r="${rOuter}" fill="none" stroke="${accentColor}" stroke-width="${config.lineWidth}" stroke-opacity="${config.opacity * 0.4}" stroke-dasharray="4 4"/>`,
      `<circle r="${rMid}" fill="none" stroke="${accentColor}" stroke-width="${config.lineWidth * 1.5}" stroke-opacity="${config.opacity * 0.9}"/>`,
      `<circle r="${rCore}" fill="${accentColor}" fill-opacity="1"/>`,
      `<line x1="-${rOuter * 1.3}" y1="0" x2="${rOuter * 1.3}" y2="0" stroke="${accentColor}" stroke-width="${config.lineWidth * 1.2}"/>`,
      `<line x1="0" y1="-${rOuter * 1.3}" x2="0" y2="${rOuter * 1.3}" stroke="${accentColor}" stroke-width="${config.lineWidth * 1.2}"/>`,
      `</g>`
    );
  }

  // Background Rect
  let bgFill = "";
  if (config.bgMode === "dark") bgFill = `<rect width="100%" height="100%" fill="${config.bgColor || "#0c131a"}"/>`;
  else if (config.bgMode === "light") bgFill = `<rect width="100%" height="100%" fill="#f4f7f6"/>`;
  else if (config.bgMode === "custom") bgFill = `<rect width="100%" height="100%" fill="${config.bgColor}"/>`;

  // HUD Metadata text banner (top margin or bottom margin)
  const hudText = !options?.isExport
    ? `<text x="${marginX}" y="${Math.max(marginY - 12, 20)}" fill="${primaryColor}" fill-opacity="0.8" font-size="${Math.max(12, Math.round(width / 95))}" font-family="monospace" font-weight="700" letter-spacing="1.5">${config.seed} · ${config.type.toUpperCase()} GRID · ${width}×${height}px</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" style="display:block;width:100%;height:100%;aspect-ratio:${width}/${height};shape-rendering:geometricPrecision;text-rendering:geometricPrecision;">
    <defs>
      <linearGradient id="primaryGlow" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${primaryColor}" stop-opacity="0.8"/>
        <stop offset="100%" stop-color="${accentColor}" stop-opacity="0.8"/>
      </linearGradient>
    </defs>
    ${bgFill}
    ${elements.join("\n")}
    ${hudText}
  </svg>`;
}

function totalRowRowGutters(rows: number, gutter: number): number {
  return Math.max(rows - 1, 0) * (gutter * 0.75);
}

// Generate Continuous Logarithmic Golden & Fibonacci Spiral
function renderLogarithmicSpiral(
  width: number,
  height: number,
  color: string,
  lineWidth: number,
  opacity: number,
  kind: "golden" | "fibonacci"
): string {
  // Center near the golden section pole
  const cx = width * 0.618033;
  const cy = height * 0.618033;
  const maxDim = Math.max(width, height) * 0.95;

  const points: [number, number][] = [];
  const b = kind === "golden" ? Math.log(PHI) / (Math.PI / 2) : 0.306349;
  const totalSteps = 160;
  const maxTheta = 4.25 * Math.PI;

  const a = maxDim / Math.exp(b * maxTheta);

  for (let i = 0; i <= totalSteps; i++) {
    const theta = (i / totalSteps) * maxTheta;
    const r = a * Math.exp(b * theta);
    const px = cx + r * Math.cos(theta);
    const py = cy + r * Math.sin(theta);
    points.push([px, py]);
  }

  const pathD = points
    .map((p, idx) => `${idx === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(" ");

  // Whirling Golden Rectangles Bounds
  const rects: string[] = [];
  let rx = 0, ry = 0, rw = width, rh = height;
  for (let step = 0; step < 6; step++) {
    const isW = rw >= rh;
    const side = isW ? rh : rw;
    if (side < 8) break;
    rects.push(
      `<rect x="${rx.toFixed(1)}" y="${ry.toFixed(1)}" width="${(isW ? side : rw).toFixed(1)}" height="${(isW ? rh : side).toFixed(1)}" fill="none" stroke="${color}" stroke-opacity="${opacity * 0.25}" stroke-width="${lineWidth * 0.75}" stroke-dasharray="4 4"/>`
    );
    if (isW) {
      rx += side;
      rw -= side;
    } else {
      ry += side;
      rh -= side;
    }
  }

  return `<g id="${kind}-spiral-group">
    ${rects.join("\n")}
    <path d="${pathD}" fill="none" stroke="${color}" stroke-width="${lineWidth * 2}" stroke-opacity="${opacity * 0.95}" stroke-linecap="round" stroke-linejoin="round"/>
  </g>`;
}

function renderGoldenSpiral(width: number, height: number, color: string, lineWidth: number, opacity: number): string {
  return renderLogarithmicSpiral(width, height, color, lineWidth, opacity, "golden");
}

function renderFibonacciSpiral(width: number, height: number, color: string, lineWidth: number, opacity: number): string {
  return renderLogarithmicSpiral(width, height, color, lineWidth, opacity, "fibonacci");
}

// Generate Isometric 3D Mesh
function renderIsometricMesh(width: number, height: number, color: string, lineWidth: number, opacity: number): string {
  const lines: string[] = [];
  const step = Math.max(Math.min(width, height) / 16, 24);
  const tan30 = Math.tan((30 * Math.PI) / 180);

  // Diagonal 30 deg lines
  for (let y = -height; y < height * 2; y += step) {
    lines.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y + width * tan30}" stroke="${color}" stroke-opacity="${opacity * 0.25}" stroke-width="${lineWidth * 0.75}"/>`);
    lines.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y - width * tan30}" stroke="${color}" stroke-opacity="${opacity * 0.25}" stroke-width="${lineWidth * 0.75}"/>`);
  }

  // Vertical lines
  for (let x = 0; x <= width; x += step * 1.5) {
    lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="${color}" stroke-opacity="${opacity * 0.3}" stroke-width="${lineWidth * 0.75}"/>`);
  }

  return `<g id="isometric-mesh">${lines.join("\n")}</g>`;
}

// Analyze image composition & harmony
export function analyzeComposition(imgWidth: number, imgHeight: number): ReferenceAnalysis {
  const ratio = imgWidth / Math.max(imgHeight, 1);
  const goldenDev = Math.abs(ratio - PHI);

  let dominant = "Balanced Modular Grid";
  const recommendations: string[] = [];

  if (goldenDev < 0.12) {
    dominant = "Golden Ratio (1:1.618 Phi)";
    recommendations.push("Hero elements naturally align with the logarithmic Phi curve.");
  } else if (Math.abs(ratio - 1) < 0.08) {
    dominant = "Centered Radial / Square Balance";
    recommendations.push("Square composition best utilizes centralized radial focal anchors.");
  } else if (ratio > 1.6) {
    dominant = "Cinematic Panoramic Rule of Thirds";
    recommendations.push("Use left/right thirds power vertices for dynamic storytelling.");
  } else if (ratio < 0.75) {
    dominant = "Vertical Portrait Hierarchy";
    recommendations.push("Stack vertical focal anchors using top-third eye-line guides.");
  }

  recommendations.push("Follow margin gutter bounds to ensure negative space breathing room.");

  return {
    width: imgWidth,
    height: imgHeight,
    aspectRatio: ratio > 1 ? `${(ratio).toFixed(2)}:1` : `1:${(1 / ratio).toFixed(2)}`,
    aspectRatioDecimal: Number(ratio.toFixed(3)),
    dominantComposition: dominant,
    goldenRatioDeviation: Number(goldenDev.toFixed(3)),
    symmetryScore: Math.round(92 - Math.abs(ratio - 1) * 8),
    ruleOfThirdsScore: Math.round(95 - Math.abs(ratio - 1.5) * 6),
    recommendations,
  };
}

// Generate Copyable CSS Grid & Tailwind Code
export function generateCssGridCode(config: GridConfig, width: number, height: number): { css: string; tailwind: string } {
  const marginX = `${config.margin}%`;
  const gutterPx = `${config.gutter}px`;

  const css = `/* MCUSTOCK AI Smart Grid - ${config.seed} */
.smart-grid-container {
  display: grid;
  grid-template-columns: repeat(${config.columns}, minmax(0, 1fr));
  grid-template-rows: repeat(${config.rows}, minmax(0, 1fr));
  gap: ${gutterPx};
  padding: ${config.margin}% ${config.margin}%;
  width: 100%;
  max-width: ${width}px;
  height: ${height}px;
  box-sizing: border-box;
}

.smart-grid-item {
  grid-column: span 1;
  grid-row: span 1;
}`;

  const tailwind = `<!-- Tailwind CSS Smart Grid -->
<div class="grid grid-cols-${config.columns} grid-rows-${config.rows} gap-[${gutterPx}] p-[${marginX}] max-w-[${width}px] h-[${height}px] w-full">
  <div class="col-span-1 row-span-1"></div>
</div>`;

  return { css, tailwind };
}
