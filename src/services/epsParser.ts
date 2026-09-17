import { ExtractedIcon, EPSDocument, BoundingBox } from '../types';

export interface RawPathSegment {
  type: 'M' | 'L' | 'C' | 'Z' | 'A' | 'R';
  args: number[];
}

export interface VectorPath {
  segments: RawPathSegment[];
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  strokeLineCap?: string;
  strokeLineJoin?: string;
  fillRule?: 'nonzero' | 'evenodd';
  isClosed?: boolean;
  hasFill: boolean;
  hasStroke: boolean;
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
}

/**
 * Parses DOS EPS binary header or ASCII PostScript string
 */
export function extractPostScriptText(bufferOrString: ArrayBuffer | string): string {
  if (typeof bufferOrString === 'string') {
    return bufferOrString;
  }

  const bytes = new Uint8Array(bufferOrString);
  // Check for DOS EPS binary header magic: 0xC5, 0xD0, 0xD3, 0xC6
  if (bytes.length >= 30 && bytes[0] === 0xc5 && bytes[1] === 0xd0 && bytes[2] === 0xd3 && bytes[3] === 0xc6) {
    const dataView = new DataView(bufferOrString);
    const psOffset = dataView.getUint32(4, true);
    const psLength = dataView.getUint32(8, true);
    const subBytes = bytes.subarray(psOffset, Math.min(bytes.length, psOffset + psLength));
    return new TextDecoder('utf-8', { fatal: false }).decode(subBytes);
  }

  // Check if PostScript starts slightly later (e.g. after a custom binary header or thumbnail)
  for (let i = 0; i < Math.min(bytes.length - 4, 8192); i++) {
    if (bytes[i] === 0x25 && bytes[i + 1] === 0x21 && bytes[i + 2] === 0x50 && bytes[i + 3] === 0x53) { // '%!PS'
      if (i > 0) {
        return new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(i));
      }
      break;
    }
  }

  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

/**
 * Extracts BoundingBox from EPS headers
 */
export function parseEPSBoundingBox(psText: string): { bbox: [number, number, number, number]; width: number; height: number } {
  // Check for %%HiResBoundingBox first, then %%BoundingBox
  const hiresMatch = psText.match(/%%HiResBoundingBox:\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/i);
  if (hiresMatch) {
    const llx = parseFloat(hiresMatch[1]);
    const lly = parseFloat(hiresMatch[2]);
    const urx = parseFloat(hiresMatch[3]);
    const ury = parseFloat(hiresMatch[4]);
    return {
      bbox: [llx, lly, urx, ury],
      width: Math.max(1, Math.round(urx - llx)),
      height: Math.max(1, Math.round(ury - lly)),
    };
  }

  const bboxMatch = psText.match(/%%BoundingBox:\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/i);
  if (bboxMatch) {
    const llx = parseFloat(bboxMatch[1]);
    const lly = parseFloat(bboxMatch[2]);
    const urx = parseFloat(bboxMatch[3]);
    const ury = parseFloat(bboxMatch[4]);
    return {
      bbox: [llx, lly, urx, ury],
      width: Math.max(1, Math.round(urx - llx)),
      height: Math.max(1, Math.round(ury - lly)),
    };
  }

  // Fallback if no BoundingBox header
  return {
    bbox: [0, 0, 800, 800],
    width: 800,
    height: 800,
  };
}

/**
 * Checks if the EPS has an embedded standard SVG block (common in modern asset exports)
 */
export function extractEmbeddedSVG(psText: string): string | null {
  const svgMatch = psText.match(/<svg[\s\S]*?<\/svg>/i);
  if (svgMatch) {
    return svgMatch[0];
  }
  return null;
}

/**
 * Robust number extractor for SVG paths handling negative numbers, exponents, and concatenated decimals
 */
function extractSvgNumbers(str: string): number[] {
  const numRegex = /-?(?:\d*\.\d+|\d+)(?:[eE][+-]?\d+)?/g;
  const nums: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = numRegex.exec(str)) !== null) {
    const val = parseFloat(m[0]);
    if (!isNaN(val)) nums.push(val);
  }
  return nums;
}

/**
 * Parses SVG markup into VectorPath structures for clustering
 */
export function parseSvgToVectorPaths(svgString: string): VectorPath[] {
  const paths: VectorPath[] = [];

  // Match all <path ...> elements
  const pathRegex = /<path\b([^>]*)>/gi;
  let match: RegExpExecArray | null;

  while ((match = pathRegex.exec(svgString)) !== null) {
    const attrs = match[1];
    const dMatch = attrs.match(/\bd\s*=\s*["']([^"']+)["']/i);
    if (!dMatch) continue;

    const d = dMatch[1];
    const fillMatch = attrs.match(/\bfill\s*=\s*["']([^"']+)["']/i);
    const strokeMatch = attrs.match(/\bstroke\s*=\s*["']([^"']+)["']/i);
    const strokeWidthMatch = attrs.match(/\bstroke-width\s*=\s*["']([^"']+)["']/i);
    const fillRuleMatch = attrs.match(/\bfill-rule\s*=\s*["']([^"']+)["']/i);
    const strokeLineCapMatch = attrs.match(/\bstroke-linecap\s*=\s*["']([^"']+)["']/i);
    const strokeLineJoinMatch = attrs.match(/\bstroke-linejoin\s*=\s*["']([^"']+)["']/i);

    const fillColor = fillMatch && fillMatch[1] !== 'none' ? fillMatch[1] : 'currentColor';
    const strokeColor = strokeMatch && strokeMatch[1] !== 'none' ? strokeMatch[1] : 'none';
    const hasFill = !fillMatch || fillMatch[1] !== 'none';
    const hasStroke = strokeMatch ? strokeMatch[1] !== 'none' : false;
    const strokeWidth = strokeWidthMatch ? parseFloat(strokeWidthMatch[1]) || 1 : 1;
    const fillRule = fillRuleMatch ? (fillRuleMatch[1].toLowerCase() as 'nonzero' | 'evenodd') : undefined;
    const strokeLineCap = strokeLineCapMatch ? strokeLineCapMatch[1] : undefined;
    const strokeLineJoin = strokeLineJoinMatch ? strokeLineJoinMatch[1] : undefined;

    let currentSegments: RawPathSegment[] = [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let currX = 0, currY = 0;
    let startX = 0, startY = 0;
    let prevCtrlX: number | null = null;
    let prevCtrlY: number | null = null;

    const commitSubPath = () => {
      if (currentSegments.length > 0 && isFinite(minX) && minX < maxX && minY < maxY) {
        paths.push({
          segments: [...currentSegments],
          fillColor,
          strokeColor,
          strokeWidth,
          strokeLineCap,
          strokeLineJoin,
          fillRule,
          hasFill,
          hasStroke,
          bbox: { minX, minY, maxX, maxY },
        });
      }
      currentSegments = [];
      minX = Infinity;
      minY = Infinity;
      maxX = -Infinity;
      maxY = -Infinity;
    };

    const updateBounds = (x: number, y: number) => {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    };

    const cmdRegex = /([a-df-z])([^a-df-z]*)/gi;
    let cmdMatch: RegExpExecArray | null;

    while ((cmdMatch = cmdRegex.exec(d)) !== null) {
      const type = cmdMatch[1];
      const upperType = type.toUpperCase();
      const isRelative = type !== upperType;
      const nums = extractSvgNumbers(cmdMatch[2]);

      if (upperType === 'M' && nums.length >= 2) {
        const nextX = isRelative ? currX + nums[0] : nums[0];
        const nextY = isRelative ? currY + nums[1] : nums[1];

        // Only split if the new subpath is completely in a distant area of the sheet (> 80px apart),
        // which means multiple separate icons were merged into a single path.
        // If it's nearby/overlapping (cutout, hole, compound shape), keep it together!
        if (currentSegments.length >= 3 && isFinite(minX) && isFinite(maxX)) {
          const bbWidth = maxX - minX;
          const bbHeight = maxY - minY;
          const distToBboxX = Math.max(0, minX - nextX, nextX - maxX);
          const distToBboxY = Math.max(0, minY - nextY, nextY - maxY);
          const dist = Math.hypot(distToBboxX, distToBboxY);

          if (dist > 80 && dist > Math.max(bbWidth, bbHeight) * 1.6) {
            commitSubPath();
          }
        }

        for (let i = 0; i < nums.length; i += 2) {
          const x = isRelative ? currX + nums[i] : nums[i];
          const y = isRelative ? currY + nums[i + 1] : nums[i + 1];
          currX = x;
          currY = y;
          if (i === 0) {
            startX = x;
            startY = y;
            currentSegments.push({ type: 'M', args: [x, y] });
          } else {
            currentSegments.push({ type: 'L', args: [x, y] });
          }
          updateBounds(x, y);
        }
        prevCtrlX = null;
        prevCtrlY = null;
      } else if (upperType === 'L' && nums.length >= 2) {
        for (let i = 0; i < nums.length; i += 2) {
          const x = isRelative ? currX + nums[i] : nums[i];
          const y = isRelative ? currY + nums[i + 1] : nums[i + 1];
          currX = x;
          currY = y;
          currentSegments.push({ type: 'L', args: [x, y] });
          updateBounds(x, y);
        }
        prevCtrlX = null;
        prevCtrlY = null;
      } else if (upperType === 'H' && nums.length >= 1) {
        for (let i = 0; i < nums.length; i++) {
          const x = isRelative ? currX + nums[i] : nums[i];
          currX = x;
          currentSegments.push({ type: 'L', args: [x, currY] });
          updateBounds(x, currY);
        }
        prevCtrlX = null;
        prevCtrlY = null;
      } else if (upperType === 'V' && nums.length >= 1) {
        for (let i = 0; i < nums.length; i++) {
          const y = isRelative ? currY + nums[i] : nums[i];
          currY = y;
          currentSegments.push({ type: 'L', args: [currX, y] });
          updateBounds(currX, y);
        }
        prevCtrlX = null;
        prevCtrlY = null;
      } else if (upperType === 'C' && nums.length >= 6) {
        for (let i = 0; i < nums.length; i += 6) {
          const x1 = isRelative ? currX + nums[i] : nums[i];
          const y1 = isRelative ? currY + nums[i + 1] : nums[i + 1];
          const x2 = isRelative ? currX + nums[i + 2] : nums[i + 2];
          const y2 = isRelative ? currY + nums[i + 3] : nums[i + 3];
          const x = isRelative ? currX + nums[i + 4] : nums[i + 4];
          const y = isRelative ? currY + nums[i + 5] : nums[i + 5];
          currX = x;
          currY = y;
          prevCtrlX = x2;
          prevCtrlY = y2;
          currentSegments.push({ type: 'C', args: [x1, y1, x2, y2, x, y] });
          updateBounds(x1, y1);
          updateBounds(x2, y2);
          updateBounds(x, y);
        }
      } else if (upperType === 'S' && nums.length >= 4) {
        for (let i = 0; i < nums.length; i += 4) {
          const x1 = prevCtrlX !== null ? 2 * currX - prevCtrlX : currX;
          const y1 = prevCtrlY !== null ? 2 * currY - prevCtrlY : currY;
          const x2 = isRelative ? currX + nums[i] : nums[i];
          const y2 = isRelative ? currY + nums[i + 1] : nums[i + 1];
          const x = isRelative ? currX + nums[i + 2] : nums[i + 2];
          const y = isRelative ? currY + nums[i + 3] : nums[i + 3];
          currX = x;
          currY = y;
          prevCtrlX = x2;
          prevCtrlY = y2;
          currentSegments.push({ type: 'C', args: [x1, y1, x2, y2, x, y] });
          updateBounds(x1, y1);
          updateBounds(x2, y2);
          updateBounds(x, y);
        }
      } else if (upperType === 'Q' && nums.length >= 4) {
        for (let i = 0; i < nums.length; i += 4) {
          const qx = isRelative ? currX + nums[i] : nums[i];
          const qy = isRelative ? currY + nums[i + 1] : nums[i + 1];
          const x = isRelative ? currX + nums[i + 2] : nums[i + 2];
          const y = isRelative ? currY + nums[i + 3] : nums[i + 3];
          // Convert Quadratic Bezier to Cubic Bezier
          const cx1 = currX + (2 / 3) * (qx - currX);
          const cy1 = currY + (2 / 3) * (qy - currY);
          const cx2 = x + (2 / 3) * (qx - x);
          const cy2 = y + (2 / 3) * (qy - y);
          currX = x;
          currY = y;
          prevCtrlX = qx;
          prevCtrlY = qy;
          currentSegments.push({ type: 'C', args: [cx1, cy1, cx2, cy2, x, y] });
          updateBounds(qx, qy);
          updateBounds(x, y);
        }
      } else if (upperType === 'A' && nums.length >= 7) {
        for (let i = 0; i < nums.length; i += 7) {
          const rx = Math.abs(nums[i]);
          const ry = Math.abs(nums[i + 1]);
          const x = isRelative ? currX + nums[i + 5] : nums[i + 5];
          const y = isRelative ? currY + nums[i + 6] : nums[i + 6];
          currX = x;
          currY = y;
          currentSegments.push({ type: 'L', args: [x, y] });
          updateBounds(x - rx, y - ry);
          updateBounds(x + rx, y + ry);
        }
        prevCtrlX = null;
        prevCtrlY = null;
      } else if (upperType === 'Z') {
        currentSegments.push({ type: 'Z', args: [] });
        currX = startX;
        currY = startY;
        prevCtrlX = null;
        prevCtrlY = null;
      }
    }

    commitSubPath();
  }

  // Extract <circle ...> elements
  const circleRegex = /<circle\b([^>]*)>/gi;
  while ((match = circleRegex.exec(svgString)) !== null) {
    const attrs = match[1];
    const cx = parseFloat((attrs.match(/\bcx\s*=\s*["']([^"']+)["']/i) || [])[1] || '0');
    const cy = parseFloat((attrs.match(/\bcy\s*=\s*["']([^"']+)["']/i) || [])[1] || '0');
    const r = parseFloat((attrs.match(/\br\s*=\s*["']([^"']+)["']/i) || [])[1] || '0');
    if (r > 0) {
      const fillMatch = attrs.match(/\bfill\s*=\s*["']([^"']+)["']/i);
      const strokeMatch = attrs.match(/\bstroke\s*=\s*["']([^"']+)["']/i);
      const strokeWidthMatch = attrs.match(/\bstroke-width\s*=\s*["']([^"']+)["']/i);
      const k = 0.5522847498 * r;
      paths.push({
        segments: [
          { type: 'M', args: [cx, cy - r] },
          { type: 'C', args: [cx + k, cy - r, cx + r, cy - k, cx + r, cy] },
          { type: 'C', args: [cx + r, cy + k, cx + k, cy + r, cx, cy + r] },
          { type: 'C', args: [cx - k, cy + r, cx - r, cy + k, cx - r, cy] },
          { type: 'C', args: [cx - r, cy - k, cx - k, cy - r, cx, cy - r] },
          { type: 'Z', args: [] },
        ],
        fillColor: fillMatch && fillMatch[1] !== 'none' ? fillMatch[1] : 'currentColor',
        strokeColor: strokeMatch && strokeMatch[1] !== 'none' ? strokeMatch[1] : 'none',
        strokeWidth: strokeWidthMatch ? parseFloat(strokeWidthMatch[1]) || 1 : 1,
        hasFill: !fillMatch || fillMatch[1] !== 'none',
        hasStroke: strokeMatch ? strokeMatch[1] !== 'none' : false,
        bbox: { minX: cx - r, minY: cy - r, maxX: cx + r, maxY: cy + r },
      });
    }
  }

  // Extract <ellipse ...> elements
  const ellipseRegex = /<ellipse\b([^>]*)>/gi;
  while ((match = ellipseRegex.exec(svgString)) !== null) {
    const attrs = match[1];
    const cx = parseFloat((attrs.match(/\bcx\s*=\s*["']([^"']+)["']/i) || [])[1] || '0');
    const cy = parseFloat((attrs.match(/\bcy\s*=\s*["']([^"']+)["']/i) || [])[1] || '0');
    const rx = parseFloat((attrs.match(/\brx\s*=\s*["']([^"']+)["']/i) || [])[1] || '0');
    const ry = parseFloat((attrs.match(/\bry\s*=\s*["']([^"']+)["']/i) || [])[1] || '0');
    if (rx > 0 && ry > 0) {
      paths.push({
        segments: [
          { type: 'M', args: [cx, cy - ry] },
          { type: 'C', args: [cx + 0.552 * rx, cy - ry, cx + rx, cy - 0.552 * ry, cx + rx, cy] },
          { type: 'C', args: [cx + rx, cy + 0.552 * ry, cx + 0.552 * rx, cy + ry, cx, cy + ry] },
          { type: 'C', args: [cx - 0.552 * rx, cy + ry, cx - rx, cy + 0.552 * ry, cx - rx, cy] },
          { type: 'C', args: [cx - rx, cy - 0.552 * ry, cx - 0.552 * rx, cy - ry, cx, cy - ry] },
          { type: 'Z', args: [] },
        ],
        fillColor: 'currentColor',
        strokeColor: 'none',
        strokeWidth: 1,
        hasFill: true,
        hasStroke: false,
        bbox: { minX: cx - rx, minY: cy - ry, maxX: cx + rx, maxY: cy + ry },
      });
    }
  }

  // Extract <polygon ...> and <polyline ...> elements
  const polyRegex = /<(polygon|polyline)\b([^>]*)>/gi;
  while ((match = polyRegex.exec(svgString)) !== null) {
    const tag = match[1].toLowerCase();
    const attrs = match[2];
    const pointsMatch = attrs.match(/\bpoints\s*=\s*["']([^"']+)["']/i);
    if (!pointsMatch) continue;

    const coords = extractSvgNumbers(pointsMatch[1]);
    if (coords.length >= 4) {
      const segs: RawPathSegment[] = [];
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i < coords.length; i += 2) {
        const x = coords[i];
        const y = coords[i + 1];
        segs.push({ type: i === 0 ? 'M' : 'L', args: [x, y] });
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
      if (tag === 'polygon') {
        segs.push({ type: 'Z', args: [] });
      }
      paths.push({
        segments: segs,
        fillColor: 'currentColor',
        strokeColor: 'none',
        strokeWidth: 1,
        hasFill: tag === 'polygon',
        hasStroke: tag === 'polyline',
        bbox: { minX, minY, maxX, maxY },
      });
    }
  }

  // Extract <rect ...> elements
  const rectRegex = /<rect\b([^>]*)>/gi;
  while ((match = rectRegex.exec(svgString)) !== null) {
    const attrs = match[1];
    const x = parseFloat((attrs.match(/\bx\s*=\s*["']([^"']+)["']/i) || [])[1] || '0');
    const y = parseFloat((attrs.match(/\by\s*=\s*["']([^"']+)["']/i) || [])[1] || '0');
    const w = parseFloat((attrs.match(/\bwidth\s*=\s*["']([^"']+)["']/i) || [])[1] || '0');
    const h = parseFloat((attrs.match(/\bheight\s*=\s*["']([^"']+)["']/i) || [])[1] || '0');
    if (w > 0 && h > 0) {
      paths.push({
        segments: [{ type: 'R', args: [x, y, w, h] }],
        fillColor: 'currentColor',
        strokeColor: 'none',
        strokeWidth: 1,
        hasFill: true,
        hasStroke: false,
        bbox: { minX: x, minY: y, maxX: x + w, maxY: y + h },
      });
    }
  }

  return paths;
}

/**
 * PostScript Vector Tokenizer & Path Extractor
 */
export function parsePostScriptVectors(psText: string, pageHeight: number): VectorPath[] {
  // Support all line endings: Windows (\r\n), Classic Mac (\r), Unix (\n)
  const lines = psText.split(/\r\n|\r|\n/);

  function tokenize(ignoreProlog: boolean = false): string[] {
    const tokens: string[] = [];
    let inProlog = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Handle PostScript Document Structuring Comments
      if (trimmed.startsWith('%')) {
        if (!ignoreProlog) {
          if (
            trimmed.startsWith('%%BeginProlog') ||
            trimmed.startsWith('%%BeginResource') ||
            trimmed.startsWith('%%BeginProcSet')
          ) {
            inProlog = true;
          } else if (
            trimmed.startsWith('%%EndProlog') ||
            trimmed.startsWith('%EndProlog') ||
            trimmed.startsWith('%%EndResource') ||
            trimmed.startsWith('%%EndProcSet') ||
            trimmed.startsWith('%%BeginSetup') ||
            trimmed.startsWith('%%EndSetup') ||
            trimmed.startsWith('%%Page:') ||
            trimmed.startsWith('%%Trailer') ||
            trimmed.startsWith('%%EOF')
          ) {
            inProlog = false;
          }
        }
        continue; // Skip comment lines from executable tokens
      }

      if (inProlog && !ignoreProlog) continue;

      // Tokenize words, numbers, and operators
      const matches = trimmed.match(/[^\s()<>\[\]]+|\([^)]*\)|<[^>]*>/g);
      if (matches) {
        for (const m of matches) {
          if (!m.startsWith('%')) {
            tokens.push(m);
          } else {
            break; // Rest of line is comment
          }
        }
      }
    }
    return tokens;
  }

  let cleanTokens = tokenize(false);
  // If prolog filtering resulted in 0 tokens, run without prolog filtering
  if (cleanTokens.length === 0) {
    cleanTokens = tokenize(true);
  }

  const paths: VectorPath[] = [];

  // State machine & Graphics State stack
  let currentFill = 'currentColor';
  let currentStroke = 'none';
  let currentLineWidth = 2;
  let currentSegments: RawPathSegment[] = [];
  const stack: number[] = [];
  let procDepth = 0; // Track { ... } procedure depth so macro definitions don't execute as drawing commands

  // Graphics state stack for gsave/grestore
  const gstateStack: { fill: string; stroke: string; lineWidth: number }[] = [];

  // Helper to convert polar arc to cubic bezier segments
  function arcToBeziers(
    cx: number,
    cy: number,
    r: number,
    startDeg: number,
    endDeg: number,
    anticlockwise: boolean = false
  ) {
    const a1 = (startDeg * Math.PI) / 180;
    const a2 = (endDeg * Math.PI) / 180;

    let delta = a2 - a1;
    if (anticlockwise) {
      if (delta > 0) delta -= 2 * Math.PI;
    } else {
      if (delta < 0) delta += 2 * Math.PI;
    }

    const segmentsCount = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2)));
    const segDelta = delta / segmentsCount;

    let currentAngle = a1;
    const startX = cx + r * Math.cos(currentAngle);
    const startY = pageHeight - (cy + r * Math.sin(currentAngle));

    if (currentSegments.length === 0) {
      currentSegments.push({ type: 'M', args: [startX, startY] });
    } else {
      currentSegments.push({ type: 'L', args: [startX, startY] });
    }

    for (let s = 0; s < segmentsCount; s++) {
      const nextAngle = currentAngle + segDelta;
      const alpha = segDelta / 2;
      const k = (4 / 3) * Math.tan(alpha / 2);

      const p0x = cx + r * Math.cos(currentAngle);
      const p0y = cy + r * Math.sin(currentAngle);
      const p3x = cx + r * Math.cos(nextAngle);
      const p3y = cy + r * Math.sin(nextAngle);

      const c1x = p0x - k * r * Math.sin(currentAngle);
      const c1y = p0y + k * r * Math.cos(currentAngle);
      const c2x = p3x + k * r * Math.sin(nextAngle);
      const c2y = p3y - k * r * Math.cos(nextAngle);

      currentSegments.push({
        type: 'C',
        args: [
          c1x,
          pageHeight - c1y,
          c2x,
          pageHeight - c2y,
          p3x,
          pageHeight - p3y,
        ],
      });

      currentAngle = nextAngle;
    }
  }

  function computeBBox(segments: RawPathSegment[]) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const seg of segments) {
      if (seg.type === 'M' || seg.type === 'L') {
        const [x, y] = seg.args;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      } else if (seg.type === 'C') {
        const [x1, y1, x2, y2, x3, y3] = seg.args;
        minX = Math.min(minX, x1, x2, x3);
        minY = Math.min(minY, y1, y2, y3);
        maxX = Math.max(maxX, x1, x2, x3);
        maxY = Math.max(maxY, y1, y2, y3);
      } else if (seg.type === 'R') {
        const [x, y, w, h] = seg.args;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + w);
        maxY = Math.max(maxY, y + h);
      }
    }

    if (!isFinite(minX)) {
      minX = 0;
      minY = 0;
      maxX = 0;
      maxY = 0;
    }

    return { minX, minY, maxX, maxY };
  }

  function commitPath(fill: boolean, stroke: boolean) {
    if (currentSegments.length === 0) return;
    const bbox = computeBBox(currentSegments);
    if (bbox.maxX - bbox.minX > 1 || bbox.maxY - bbox.minY > 1) {
      paths.push({
        segments: [...currentSegments],
        fillColor: fill ? currentFill : 'none',
        strokeColor: stroke ? currentStroke : 'none',
        strokeWidth: currentLineWidth,
        hasFill: fill,
        hasStroke: stroke,
        bbox,
      });
    }
    currentSegments = [];
  }

  // Process tokens
  for (let i = 0; i < cleanTokens.length; i++) {
    const token = cleanTokens[i];

    // Track procedure depth { ... } so macro definitions don't execute as page drawing commands
    if (token === '{') {
      procDepth++;
      continue;
    }
    if (token === '}') {
      procDepth = Math.max(0, procDepth - 1);
      continue;
    }
    if (procDepth > 0) {
      continue;
    }

    // Numbers
    if (/^[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?$/.test(token)) {
      stack.push(parseFloat(token));
      continue;
    }

    // PostScript Operators
    switch (token) {
      // moveto / m
      case 'moveto':
      case 'm': {
        if (stack.length >= 2) {
          const y = stack.pop()!;
          const x = stack.pop()!;
          // Convert PS coordinate (origin bottom-left) to SVG coordinate (origin top-left)
          const svgY = pageHeight - y;
          currentSegments.push({ type: 'M', args: [x, svgY] });
        }
        break;
      }

      // rmoveto
      case 'rmoveto': {
        if (stack.length >= 2) {
          const dy = stack.pop()!;
          const dx = stack.pop()!;
          const lastSeg = currentSegments[currentSegments.length - 1];
          const lastX = lastSeg ? lastSeg.args[lastSeg.args.length - 2] || 0 : 0;
          const lastY = lastSeg ? lastSeg.args[lastSeg.args.length - 1] || 0 : 0;
          currentSegments.push({ type: 'M', args: [lastX + dx, lastY - dy] });
        }
        break;
      }

      // lineto / l
      case 'lineto':
      case 'l': {
        if (stack.length >= 2) {
          const y = stack.pop()!;
          const x = stack.pop()!;
          const svgY = pageHeight - y;
          currentSegments.push({ type: 'L', args: [x, svgY] });
        }
        break;
      }

      // rlineto
      case 'rlineto': {
        if (stack.length >= 2 && currentSegments.length > 0) {
          const dy = stack.pop()!;
          const dx = stack.pop()!;
          const lastSeg = currentSegments[currentSegments.length - 1];
          const lastX = lastSeg.args[lastSeg.args.length - 2] || 0;
          const lastY = lastSeg.args[lastSeg.args.length - 1] || 0;
          currentSegments.push({ type: 'L', args: [lastX + dx, lastY - dy] });
        }
        break;
      }

      // curveto / c / v / y
      case 'curveto':
      case 'c': {
        if (stack.length >= 6) {
          const y3 = stack.pop()!;
          const x3 = stack.pop()!;
          const y2 = stack.pop()!;
          const x2 = stack.pop()!;
          const y1 = stack.pop()!;
          const x1 = stack.pop()!;
          currentSegments.push({
            type: 'C',
            args: [x1, pageHeight - y1, x2, pageHeight - y2, x3, pageHeight - y3],
          });
        } else if (stack.length >= 4 && currentSegments.length > 0) {
          // Quad / Conic curve shorthand (cx cy x y) often produced by Illustrator/shorthands
          const y = stack.pop()!;
          const x = stack.pop()!;
          const cy = stack.pop()!;
          const cx = stack.pop()!;
          const lastSeg = currentSegments[currentSegments.length - 1];
          const x0 = lastSeg.args[lastSeg.args.length - 2] || 0;
          const y0 = pageHeight - (lastSeg.args[lastSeg.args.length - 1] || 0);

          // Standard quad to cubic bezier control points:
          // cp1 = p0 + 2/3 * (c - p0)
          // cp2 = p1 + 2/3 * (c - p1)
          const cp1x = x0 + (2 / 3) * (cx - x0);
          const cp1y = y0 + (2 / 3) * (cy - y0);
          const cp2x = x + (2 / 3) * (cx - x);
          const cp2y = y + (2 / 3) * (cy - y);

          currentSegments.push({
            type: 'C',
            args: [cp1x, pageHeight - cp1y, cp2x, pageHeight - cp2y, x, pageHeight - y],
          });
        }
        break;
      }

      // v operator: curveto with current point as first control point (x2 y2 x3 y3 v)
      case 'v': {
        if (stack.length >= 4 && currentSegments.length > 0) {
          const y3 = stack.pop()!;
          const x3 = stack.pop()!;
          const y2 = stack.pop()!;
          const x2 = stack.pop()!;
          const lastSeg = currentSegments[currentSegments.length - 1];
          const x0 = lastSeg.args[lastSeg.args.length - 2] || 0;
          const y0 = lastSeg.args[lastSeg.args.length - 1] || 0;
          currentSegments.push({
            type: 'C',
            args: [x0, y0, x2, pageHeight - y2, x3, pageHeight - y3],
          });
        }
        break;
      }

      // y operator: curveto with endpoint as second control point (x1 y1 x3 y3 y)
      case 'y': {
        if (stack.length >= 4) {
          const y3 = stack.pop()!;
          const x3 = stack.pop()!;
          const y1 = stack.pop()!;
          const x1 = stack.pop()!;
          currentSegments.push({
            type: 'C',
            args: [x1, pageHeight - y1, x3, pageHeight - y3, x3, pageHeight - y3],
          });
        }
        break;
      }

      // rcurveto
      case 'rcurveto': {
        if (stack.length >= 6 && currentSegments.length > 0) {
          const dy3 = stack.pop()!;
          const dx3 = stack.pop()!;
          const dy2 = stack.pop()!;
          const dx2 = stack.pop()!;
          const dy1 = stack.pop()!;
          const dx1 = stack.pop()!;
          const lastSeg = currentSegments[currentSegments.length - 1];
          const lx = lastSeg.args[lastSeg.args.length - 2] || 0;
          const ly = lastSeg.args[lastSeg.args.length - 1] || 0;
          currentSegments.push({
            type: 'C',
            args: [lx + dx1, ly - dy1, lx + dx2, ly - dy2, lx + dx3, ly - dy3],
          });
        }
        break;
      }

      // arc (x y r ang1 ang2)
      case 'arc': {
        if (stack.length >= 5) {
          const ang2 = stack.pop()!;
          const ang1 = stack.pop()!;
          const r = stack.pop()!;
          const y = stack.pop()!;
          const x = stack.pop()!;
          arcToBeziers(x, y, r, ang1, ang2, false);
        }
        break;
      }

      // arcn (x y r ang1 ang2)
      case 'arcn': {
        if (stack.length >= 5) {
          const ang2 = stack.pop()!;
          const ang1 = stack.pop()!;
          const r = stack.pop()!;
          const y = stack.pop()!;
          const x = stack.pop()!;
          arcToBeziers(x, y, r, ang1, ang2, true);
        }
        break;
      }

      // closepath / h / H / cp
      case 'closepath':
      case 'h':
      case 'H':
      case 'cp': {
        currentSegments.push({ type: 'Z', args: [] });
        break;
      }

      // rectfill / rectstroke
      case 'rectfill': {
        if (stack.length >= 4) {
          const h = stack.pop()!;
          const w = stack.pop()!;
          const y = stack.pop()!;
          const x = stack.pop()!;
          const svgY = pageHeight - y - h;
          currentSegments.push({ type: 'R', args: [x, svgY, w, h] });
          commitPath(true, false);
        }
        break;
      }

      case 'rectstroke': {
        if (stack.length >= 4) {
          const h = stack.pop()!;
          const w = stack.pop()!;
          const y = stack.pop()!;
          const x = stack.pop()!;
          const svgY = pageHeight - y - h;
          currentSegments.push({ type: 'R', args: [x, svgY, w, h] });
          commitPath(false, true);
        }
        break;
      }

      // fill operators: f, f*, F, F*, fill, eofill
      case 'fill':
      case 'eofill':
      case 'f':
      case 'f*':
      case 'F':
      case 'F*': {
        commitPath(true, false);
        stack.length = 0;
        break;
      }

      // stroke operators: s, S, stroke
      case 'stroke':
      case 's':
      case 'S': {
        commitPath(false, true);
        stack.length = 0;
        break;
      }

      // fill and stroke: b, b*, B, B*
      case 'b':
      case 'b*':
      case 'B':
      case 'B*': {
        commitPath(true, true);
        stack.length = 0;
        break;
      }

      // newpath / no-op path terminators: n, N, newpath
      case 'newpath':
      case 'n':
      case 'N': {
        currentSegments = [];
        break;
      }

      // Clipping paths (W, W*, clip, eoclip) - Illustrator sets clip paths with W n or W* n
      case 'clip':
      case 'eoclip':
      case 'W':
      case 'W*': {
        // Do not render clip path as visible geometry
        break;
      }

      // Graphics state operators
      case 'gsave':
      case 'q': {
        gstateStack.push({
          fill: currentFill,
          stroke: currentStroke,
          lineWidth: currentLineWidth,
        });
        break;
      }

      case 'grestore':
      case 'Q': {
        if (gstateStack.length > 0) {
          const saved = gstateStack.pop()!;
          currentFill = saved.fill;
          currentStroke = saved.stroke;
          currentLineWidth = saved.lineWidth;
        }
        stack.length = 0;
        break;
      }

      case 'save':
      case 'restore':
      case 'showpage': {
        stack.length = 0;
        break;
      }

      // setrgbcolor / rg / RG / xa / Xa (Illustrator RGB fill & stroke)
      case 'setrgbcolor':
      case 'rg':
      case 'RG':
      case 'xa':
      case 'Xa': {
        if (stack.length >= 3) {
          const b = Math.round(Math.max(0, Math.min(1, stack.pop()!)) * 255);
          const g = Math.round(Math.max(0, Math.min(1, stack.pop()!)) * 255);
          const r = Math.round(Math.max(0, Math.min(1, stack.pop()!)) * 255);
          const hex = `rgb(${r},${g},${b})`;
          if (token === 'RG' || token === 'Xa') {
            currentStroke = hex;
          } else {
            currentFill = hex;
            if (currentStroke === 'none') currentStroke = hex;
          }
        }
        break;
      }

      // setgray / g / G (Illustrator Grayscale fill & stroke)
      case 'setgray':
      case 'g':
      case 'G': {
        if (stack.length >= 1) {
          const gray = Math.round(Math.max(0, Math.min(1, stack.pop()!)) * 255);
          const hex = `rgb(${gray},${gray},${gray})`;
          if (token === 'G') {
            currentStroke = hex;
          } else {
            currentFill = hex;
            if (currentStroke === 'none') currentStroke = hex;
          }
        }
        break;
      }

      // setcmykcolor / k / K / x / X (Illustrator CMYK fill & stroke: x=fill, X=stroke, k=fill, K=stroke)
      case 'setcmykcolor':
      case 'k':
      case 'K':
      case 'x':
      case 'X': {
        if (stack.length >= 4) {
          const k = stack.pop()!;
          const y = stack.pop()!;
          const m = stack.pop()!;
          const c = stack.pop()!;
          // CMYK to RGB
          const r = Math.round(255 * (1 - Math.min(1, c)) * (1 - Math.min(1, k)));
          const g = Math.round(255 * (1 - Math.min(1, m)) * (1 - Math.min(1, k)));
          const b = Math.round(255 * (1 - Math.min(1, y)) * (1 - Math.min(1, k)));
          const hex = `rgb(${r},${g},${b})`;
          if (token === 'K' || token === 'X') {
            currentStroke = hex;
          } else {
            currentFill = hex;
          }
        }
        break;
      }

      // setlinewidth / w
      case 'setlinewidth':
      case 'w': {
        if (stack.length >= 1) {
          currentLineWidth = Math.max(0.5, stack.pop()!);
        }
        break;
      }

      // Illustrator overprint: 0 O or 0 o (takes 1 argument)
      case 'O':
      case 'o': {
        if (stack.length >= 1) stack.pop();
        break;
      }

      // Line cap (J) and line join (j)
      case 'setlinecap':
      case 'J':
      case 'setlinejoin':
      case 'j': {
        if (stack.length >= 1) stack.pop();
        break;
      }

      // Miter limit (M)
      case 'setmiterlimit':
      case 'M': {
        if (stack.length >= 1) stack.pop();
        break;
      }

      // Dash pattern: [array] phase d
      case 'setdash':
      case 'd': {
        // Clear whatever arguments were pushed for dash
        if (stack.length >= 1) stack.pop();
        break;
      }

      // Compound path and group markers (*u, *U, u, U) in Illustrator
      case '*u':
      case '*U':
      case 'u':
      case 'U': {
        // Group delimiters, no stack arguments
        break;
      }

      default:
        // Other PostScript token, drop stack if too large
        if (stack.length > 20) {
          stack.length = 0;
        }
        break;
    }
  }

  // Commit any trailing path
  if (currentSegments.length > 0) {
    commitPath(true, false);
  }

  return paths;
}

/**
 * Converts a list of VectorPath into an SVG path string
 */
export function vectorPathsToSvgData(paths: VectorPath[]): string {
  let svgPaths = '';
  for (const p of paths) {
    let d = '';
    for (const seg of p.segments) {
      if (seg.type === 'M') d += `M ${seg.args[0].toFixed(2)} ${seg.args[1].toFixed(2)} `;
      else if (seg.type === 'L') d += `L ${seg.args[0].toFixed(2)} ${seg.args[1].toFixed(2)} `;
      else if (seg.type === 'C')
        d += `C ${seg.args[0].toFixed(2)} ${seg.args[1].toFixed(2)}, ${seg.args[2].toFixed(2)} ${seg.args[3].toFixed(2)}, ${seg.args[4].toFixed(2)} ${seg.args[5].toFixed(2)} `;
      else if (seg.type === 'R') {
        const [rx, ry, rw, rh] = seg.args;
        d += `M ${rx.toFixed(2)} ${ry.toFixed(2)} h ${rw.toFixed(2)} v ${rh.toFixed(2)} h ${(-rw).toFixed(2)} Z `;
      } else if (seg.type === 'Z') d += 'Z ';
    }

    if (!d.trim()) continue;

    const fillAttr = p.hasFill ? `fill="${p.fillColor || 'currentColor'}"` : 'fill="none"';
    const strokeAttr = p.hasStroke ? `stroke="${p.strokeColor || 'currentColor'}" stroke-width="${p.strokeWidth || 2}" stroke-linecap="round" stroke-linejoin="round"` : '';
    svgPaths += `<path d="${d.trim()}" ${fillAttr} ${strokeAttr} />\n`;
  }
  return svgPaths;
}

/**
 * Spatial Clustering: Groups vector paths into isolated icons based on spatial proximity
 */
export function clusterPathsIntoIcons(
  paths: VectorPath[],
  pageWidth: number,
  pageHeight: number,
  sensitivity: 'balanced' | 'high' | 'grid' = 'balanced'
): { clusterBbox: BoundingBox; paths: VectorPath[] }[] {
  if (paths.length === 0) return [];

  // Filter out tiny artifacts (noise < 2px)
  const validPaths = paths.filter((p) => {
    const w = p.bbox.maxX - p.bbox.minX;
    const h = p.bbox.maxY - p.bbox.minY;
    return w > 2 || h > 2;
  });

  if (validPaths.length === 0) return [];

  // Proximity threshold:
  // Separate icons in a grid/sheet are separated by whitespace (usually >= 12px gap).
  // Inside a single icon, paths are overlapping, touching, or enclosed.
  // Using tight threshold (2-4px) prevents merging neighboring icons in a row!
  const threshold = sensitivity === 'high' ? 1 : sensitivity === 'grid' ? 6 : 3;

  // Group paths into clusters
  const clusters: { bbox: { minX: number; minY: number; maxX: number; maxY: number }; paths: VectorPath[] }[] = [];

  for (const path of validPaths) {
    let merged = false;

    // Check if this path overlaps or is close to an existing cluster
    for (const cluster of clusters) {
      const c = cluster.bbox;
      const p = path.bbox;

      // Check for spatial proximity or enclosure
      const overlapX = !(p.maxX < c.minX - threshold || p.minX > c.maxX + threshold);
      const overlapY = !(p.maxY < c.minY - threshold || p.minY > c.maxY + threshold);

      // Check if one bounding box is enclosed inside another (e.g. icon inside a circle or frame)
      const pInsideC = p.minX >= c.minX - 4 && p.maxX <= c.maxX + 4 && p.minY >= c.minY - 4 && p.maxY <= c.maxY + 4;
      const cInsideP = c.minX >= p.minX - 4 && c.maxX <= p.maxX + 4 && c.minY >= p.minY - 4 && c.maxY <= p.maxY + 4;

      if ((overlapX && overlapY) || pInsideC || cInsideP) {
        // Merge into cluster
        cluster.paths.push(path);
        cluster.bbox.minX = Math.min(c.minX, p.minX);
        cluster.bbox.minY = Math.min(c.minY, p.minY);
        cluster.bbox.maxX = Math.max(c.maxX, p.maxX);
        cluster.bbox.maxY = Math.max(c.maxY, p.maxY);
        merged = true;
        break;
      }
    }

    if (!merged) {
      clusters.push({
        bbox: { ...path.bbox },
        paths: [path],
      });
    }
  }

  // Second pass: only merge clusters if one is inside another or they directly overlap with 0 gap
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const c1 = clusters[i].bbox;
        const c2 = clusters[j].bbox;

        // Check if c2 is inside c1 or c1 is inside c2
        const c2InsideC1 = c2.minX >= c1.minX - 2 && c2.maxX <= c1.maxX + 2 && c2.minY >= c1.minY - 2 && c2.maxY <= c1.maxY + 2;
        const c1InsideC2 = c1.minX >= c2.minX - 2 && c1.maxX <= c2.maxX + 2 && c1.minY >= c2.minY - 2 && c1.maxY <= c2.maxY + 2;

        // Direct overlap
        const directOverlap = !(c2.maxX < c1.minX || c2.minX > c1.maxX || c2.maxY < c1.minY || c2.minY > c1.maxY);

        if (c2InsideC1 || c1InsideC2 || directOverlap) {
          c1.minX = Math.min(c1.minX, c2.minX);
          c1.minY = Math.min(c1.minY, c2.minY);
          c1.maxX = Math.max(c1.maxX, c2.maxX);
          c1.maxY = Math.max(c1.maxY, c2.maxY);
          clusters[i].paths.push(...clusters[j].paths);
          clusters.splice(j, 1);
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }

  // Filter out clusters that are full-page backgrounds (e.g. background rect > 90% of page)
  const filteredClusters = clusters.filter((c) => {
    const w = c.bbox.maxX - c.bbox.minX;
    const h = c.bbox.maxY - c.bbox.minY;
    const isFullScreenBg = w > pageWidth * 0.95 && h > pageHeight * 0.95 && c.paths.length <= 2;
    const isTinyNoise = w < 4 && h < 4;
    return !isFullScreenBg && !isTinyNoise;
  });

  const finalClusters = filteredClusters.length > 0 ? filteredClusters : clusters;

  // Dynamic row grouping for sorting left-to-right, top-to-bottom
  const estRows = Math.round(Math.sqrt(finalClusters.length)) || 10;
  const rowBucket = Math.max(20, (pageHeight / estRows) * 0.6);

  finalClusters.sort((a, b) => {
    const rowA = Math.floor(a.bbox.minY / rowBucket);
    const rowB = Math.floor(b.bbox.minY / rowBucket);
    if (rowA !== rowB) return a.bbox.minY - b.bbox.minY;
    return a.bbox.minX - b.bbox.minX;
  });

  return finalClusters.map((c) => ({
    clusterBbox: {
      x: c.bbox.minX,
      y: c.bbox.minY,
      width: Math.max(16, c.bbox.maxX - c.bbox.minX),
      height: Math.max(16, c.bbox.maxY - c.bbox.minY),
    },
    paths: c.paths,
  }));
}

/**
 * Creates clean standalone SVG markup for an isolated icon with normalized coordinates.
 * CRITICAL: This MUST ONLY contain paths belonging to THIS SINGLE ICON!
 * Any other paths from the sheet are strictly omitted so 3D engines (Three.js SVGLoader),
 * vector tools, and asset pipelines render ONLY this single icon.
 */
export function buildIconSvg(
  paths: VectorPath[],
  bbox: BoundingBox,
  paddingPercent: number = 6
): string {
  if (!paths || paths.length === 0) {
    const w = Math.max(16, Math.round(bbox.width));
    const h = Math.max(16, Math.round(bbox.height));
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"></svg>`;
  }

  // Calculate tight bounding box around the actual paths of this icon
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of paths) {
    if (p.bbox && isFinite(p.bbox.minX) && isFinite(p.bbox.maxX)) {
      minX = Math.min(minX, p.bbox.minX);
      minY = Math.min(minY, p.bbox.minY);
      maxX = Math.max(maxX, p.bbox.maxX);
      maxY = Math.max(maxY, p.bbox.maxY);
    }
  }

  const hasValidBounds = isFinite(minX) && maxX > minX && isFinite(minY) && maxY > minY;
  const contentX = hasValidBounds ? minX : bbox.x;
  const contentY = hasValidBounds ? minY : bbox.y;
  const contentW = hasValidBounds ? maxX - minX : bbox.width;
  const contentH = hasValidBounds ? maxY - minY : bbox.height;

  const pad = Math.max(contentW, contentH) * (paddingPercent / 100);
  const viewX = contentX - pad;
  const viewY = contentY - pad;
  const viewW = Math.max(16, contentW + pad * 2);
  const viewH = Math.max(16, contentH + pad * 2);

  let pathData = '';
  for (const p of paths) {
    let d = '';
    for (const seg of p.segments) {
      if (seg.type === 'M') {
        d += `M ${(seg.args[0] - viewX).toFixed(2)} ${(seg.args[1] - viewY).toFixed(2)} `;
      } else if (seg.type === 'L') {
        d += `L ${(seg.args[0] - viewX).toFixed(2)} ${(seg.args[1] - viewY).toFixed(2)} `;
      } else if (seg.type === 'C') {
        d += `C ${(seg.args[0] - viewX).toFixed(2)} ${(seg.args[1] - viewY).toFixed(2)}, ${(seg.args[2] - viewX).toFixed(2)} ${(seg.args[3] - viewY).toFixed(2)}, ${(seg.args[4] - viewX).toFixed(2)} ${(seg.args[5] - viewY).toFixed(2)} `;
      } else if (seg.type === 'R') {
        const [rx, ry, rw, rh] = seg.args;
        d += `M ${(rx - viewX).toFixed(2)} ${(ry - viewY).toFixed(2)} h ${rw.toFixed(2)} v ${rh.toFixed(2)} h ${(-rw).toFixed(2)} Z `;
      } else if (seg.type === 'A') {
        const [rx, ry, rot, large, sweep, x, y] = seg.args;
        d += `A ${rx.toFixed(2)} ${ry.toFixed(2)} ${rot} ${large} ${sweep} ${(x - viewX).toFixed(2)} ${(y - viewY).toFixed(2)} `;
      } else if (seg.type === 'Z') {
        d += 'Z ';
      }
    }

    if (!d.trim()) continue;

    const fillAttr = p.hasFill ? `fill="${p.fillColor || 'currentColor'}"` : 'fill="none"';
    const strokeAttr = p.hasStroke
      ? `stroke="${p.strokeColor || 'currentColor'}" stroke-width="${p.strokeWidth || 2}" stroke-linecap="${p.strokeLineCap || 'round'}" stroke-linejoin="${p.strokeLineJoin || 'round'}"`
      : '';
    const fillRuleAttr = p.fillRule ? `fill-rule="${p.fillRule}"` : '';
    pathData += `  <path d="${d.trim()}" ${fillAttr} ${strokeAttr} ${fillRuleAttr} />\n`;
  }

  const finalW = Math.round(viewW);
  const finalH = Math.round(viewH);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${finalW} ${finalH}" width="${finalW}" height="${finalH}">\n${pathData}</svg>`;
}

/**
 * Builds pristine isolated icon SVG containing ONLY this icon's paths and styles
 */
export function buildIconSvgFromDoc(
  _fullSvg: string,
  bbox: BoundingBox,
  paths: VectorPath[],
  paddingPercent: number = 6
): string {
  // Always build an isolated SVG with ONLY this icon's paths.
  // Never embed the entire sheet's markup because 3D engines (e.g. Three.js SVGLoader in 3D Icon Studio),
  // vector software, and SVG parsers will extrude/render all 100 icons across the sheet.
  return buildIconSvg(paths, bbox, paddingPercent);
}

/**
 * Slices an EPS/SVG document into an exact regular grid of icons (e.g. 10x10 = 100 icons)
 */
export function splitDocumentIntoGrid(
  doc: EPSDocument,
  cols: number,
  rows: number
): ExtractedIcon[] {
  const cellW = doc.width / cols;
  const cellH = doc.height / rows;
  const icons: ExtractedIcon[] = [];
  let count = 1;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cellX = c * cellW;
      const cellY = r * cellH;

      // Find any paths whose center falls inside this cell
      const matchingPaths = (doc.parsedVectorPaths || []).filter((p) => {
        const midX = (p.bbox.minX + p.bbox.maxX) / 2;
        const midY = (p.bbox.minY + p.bbox.maxY) / 2;
        return midX >= cellX && midX < cellX + cellW && midY >= cellY && midY < cellY + cellH;
      });

      let iconBbox: BoundingBox;
      if (matchingPaths.length > 0) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of matchingPaths) {
          minX = Math.min(minX, p.bbox.minX);
          minY = Math.min(minY, p.bbox.minY);
          maxX = Math.max(maxX, p.bbox.maxX);
          maxY = Math.max(maxY, p.bbox.maxY);
        }
        const padX = Math.max(4, (maxX - minX) * 0.08);
        const padY = Math.max(4, (maxY - minY) * 0.08);
        iconBbox = {
          x: Math.max(cellX, minX - padX),
          y: Math.max(cellY, minY - padY),
          width: Math.min(cellW, (maxX - minX) + padX * 2),
          height: Math.min(cellH, (maxY - minY) + padY * 2),
        };
      } else {
        const padX = cellW * 0.08;
        const padY = cellH * 0.08;
        iconBbox = {
          x: cellX + padX,
          y: cellY + padY,
          width: cellW - padX * 2,
          height: cellH - padY * 2,
        };
      }

      const num = count;
      const name = `icon-${num.toString().padStart(2, '0')}`;
      const svgContent = buildIconSvg(matchingPaths, iconBbox, 4);
      const epsContent = buildIconEPS(matchingPaths, iconBbox, doc.height);

      icons.push({
        id: `icon-${Date.now()}-${count}`,
        name,
        index: num,
        bbox: iconBbox,
        originalBbox: [
          iconBbox.x,
          doc.height - (iconBbox.y + iconBbox.height),
          iconBbox.x + iconBbox.width,
          doc.height - iconBbox.y,
        ],
        svgContent,
        epsContent,
        width: Math.round(iconBbox.width),
        height: Math.round(iconBbox.height),
        pathCount: matchingPaths.length || 1,
        selected: true,
        aspectRatio: iconBbox.width / Math.max(1, iconBbox.height),
      });

      count++;
    }
  }

  return icons;
}

/**
 * Creates valid standalone EPS snippet for an individual icon
 */
export function buildIconEPS(
  paths: VectorPath[],
  bbox: BoundingBox,
  pageHeight: number
): string {
  const w = Math.round(bbox.width);
  const h = Math.round(bbox.height);

  let psCommands = '';
  for (const p of paths) {
    if (p.hasFill && p.fillColor && p.fillColor.startsWith('rgb')) {
      const rgb = p.fillColor.match(/\d+/g);
      if (rgb && rgb.length >= 3) {
        const r = (parseInt(rgb[0], 10) / 255).toFixed(3);
        const g = (parseInt(rgb[1], 10) / 255).toFixed(3);
        const b = (parseInt(rgb[2], 10) / 255).toFixed(3);
        psCommands += `${r} ${g} ${b} setrgbcolor\n`;
      }
    }

    psCommands += 'newpath\n';
    for (const seg of p.segments) {
      // Revert from SVG Y coordinate to normalized icon PostScript Y
      if (seg.type === 'M') {
        const normX = (seg.args[0] - bbox.x).toFixed(2);
        const normY = (h - (seg.args[1] - bbox.y)).toFixed(2);
        psCommands += `${normX} ${normY} moveto\n`;
      } else if (seg.type === 'L') {
        const normX = (seg.args[0] - bbox.x).toFixed(2);
        const normY = (h - (seg.args[1] - bbox.y)).toFixed(2);
        psCommands += `${normX} ${normY} lineto\n`;
      } else if (seg.type === 'C') {
        const x1 = (seg.args[0] - bbox.x).toFixed(2);
        const y1 = (h - (seg.args[1] - bbox.y)).toFixed(2);
        const x2 = (seg.args[2] - bbox.x).toFixed(2);
        const y2 = (h - (seg.args[3] - bbox.y)).toFixed(2);
        const x3 = (seg.args[4] - bbox.x).toFixed(2);
        const y3 = (h - (seg.args[5] - bbox.y)).toFixed(2);
        psCommands += `${x1} ${y1} ${x2} ${y2} ${x3} ${y3} curveto\n`;
      } else if (seg.type === 'Z') {
        psCommands += 'closepath\n';
      }
    }

    if (p.hasFill && p.hasStroke) {
      psCommands += 'gsave fill grestore stroke\n';
    } else if (p.hasFill) {
      psCommands += 'fill\n';
    } else if (p.hasStroke) {
      psCommands += 'stroke\n';
    }
  }

  return `%!PS-Adobe-3.0 EPSF-3.0
%%Creator: IconSplit EPS Engine
%%Title: Extracted Vector Icon
%%BoundingBox: 0 0 ${w} ${h}
%%HiResBoundingBox: 0 0 ${w} ${h}
%%Pages: 1
%%EndComments
%%BeginProlog
%%EndProlog
%%Page: 1 1
gsave
${psCommands}grestore
showpage
%%EOF
`;
}

/**
 * High-level EPS processing pipeline with progress updates
 */
export async function processEPSFile(
  file: File | { name: string; size: number; content: string },
  onProgress?: (step: string, percent: number) => void,
  sensitivity: 'balanced' | 'high' | 'grid' = 'balanced'
): Promise<EPSDocument> {
  onProgress?.('Analyzing EPS vector artwork...', 20);

  let rawText = '';
  const filename = file.name;
  let fileSizeStr = '0 KB';

  if (file instanceof File) {
    fileSizeStr = (file.size / 1024 / 1024).toFixed(1) + ' MB';
    const buffer = await file.arrayBuffer();
    rawText = extractPostScriptText(buffer);
  } else {
    fileSizeStr = (file.content.length / 1024).toFixed(1) + ' KB';
    rawText = file.content;
  }

  onProgress?.('Parsing vector headers & bounding box...', 40);
  const { bbox, width, height } = parseEPSBoundingBox(rawText);

  let paths: VectorPath[] = [];

  const isSvg = filename.toLowerCase().endsWith('.svg') || rawText.trim().startsWith('<svg') || /<svg\b/i.test(rawText.slice(0, 300));
  if (isSvg) {
    onProgress?.('Extracting SVG vector paths...', 60);
    paths = parseSvgToVectorPaths(rawText);
  } else {
    onProgress?.('Extracting PostScript vector paths...', 60);
    paths = parsePostScriptVectors(rawText, height);

    // If PostScript extracted 0 paths, check for embedded SVG in EPS metadata
    if (paths.length === 0) {
      const embedded = extractEmbeddedSVG(rawText);
      if (embedded) {
        onProgress?.('Extracting embedded vector paths...', 65);
        paths = parseSvgToVectorPaths(embedded);
      }
    }
  }

  onProgress?.('Detecting separate icon artwork...', 80);
  const clusters = clusterPathsIntoIcons(paths, width, height, sensitivity);

  // If no clusters detected via PostScript parser, check if an embedded SVG exists
  if (clusters.length === 0) {
    if (paths.length === 0) {
      const hasRasterOps = /\b(image|colorimage|imagemask)\b/.test(rawText);
      const hasAICompressed = /%AI9_PrivateDataBegin|\/FlateDecode/i.test(rawText);

      if (hasRasterOps && !/\b(moveto|lineto|curveto|m|l|c)\b/.test(rawText)) {
        throw new Error(
          'This EPS file appears to contain only raster bitmap pixels rather than vector strokes and curves. Please export with vector paths enabled, or save as SVG.'
        );
      } else if (hasAICompressed) {
        throw new Error(
          'This file was saved with Illustrator private binary data. To open it here: in Adobe Illustrator, choose File > Save As > EPS and set PostScript to "LanguageLevel 2" or "LanguageLevel 3", or choose File > Export > Export As > SVG (SVG is 100% supported).'
        );
      } else {
        throw new Error(
          'No vector paths could be decoded from this file. If you created this in Adobe Illustrator, save it as EPS (LanguageLevel 2 or 3) or export directly as an SVG vector file.'
        );
      }
    }
  }

  onProgress?.('Generating asset previews & metadata...', 95);

  // Full SVG of entire sheet (preserve authentic SVG markup if source was SVG)
  let fullSvg = '';
  if (isSvg) {
    fullSvg = rawText;
  } else {
    const fullSvgPaths = vectorPathsToSvgData(paths);
    fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">\n${fullSvgPaths}</svg>`;
  }

  const icons: ExtractedIcon[] = clusters.map((cluster, idx) => {
    const num = idx + 1;
    const name = `icon-${num.toString().padStart(2, '0')}`;
    const svgContent = buildIconSvg(cluster.paths, cluster.clusterBbox, 6);
    const epsContent = buildIconEPS(cluster.paths, cluster.clusterBbox, height);

    return {
      id: `icon-${Date.now()}-${idx}`,
      name,
      index: num,
      bbox: cluster.clusterBbox,
      originalBbox: [
        cluster.clusterBbox.x,
        height - (cluster.clusterBbox.y + cluster.clusterBbox.height),
        cluster.clusterBbox.x + cluster.clusterBbox.width,
        height - cluster.clusterBbox.y,
      ],
      svgContent,
      epsContent,
      width: Math.round(cluster.clusterBbox.width),
      height: Math.round(cluster.clusterBbox.height),
      pathCount: cluster.paths.length,
      selected: true,
      aspectRatio: cluster.clusterBbox.width / Math.max(1, cluster.clusterBbox.height),
    };
  });

  onProgress?.(`${icons.length} icons detected`, 100);

  return {
    id: `eps-${Date.now()}`,
    filename,
    filesize: fileSizeStr,
    bbox,
    width,
    height,
    rawContent: rawText,
    fullSvg,
    icons,
    parsedVectorPaths: paths,
    processedAt: new Date().toISOString(),
  };
}
