import {
  extractEmbeddedSVG,
  extractPostScriptText,
  parseEPSBoundingBox,
  parsePostScriptVectors,
  parseSvgToVectorPaths,
  type VectorPath,
} from '@/services/epsParser';
import { DesignElement } from '../types';

export interface ImportedVectorAsset {
  elements: DesignElement[];
  format: 'svg' | 'eps';
  warnings: string[];
}

function pathFromVector(vector: VectorPath): string {
  const { minX, minY } = vector.bbox;
  return vector.segments.map((segment) => {
    const values = [...segment.args];
    if (segment.type === 'M' || segment.type === 'L') {
      values[0] -= minX;
      values[1] -= minY;
    } else if (segment.type === 'C') {
      values[0] -= minX;
      values[1] -= minY;
      values[2] -= minX;
      values[3] -= minY;
      values[4] -= minX;
      values[5] -= minY;
    } else if (segment.type === 'R') {
      const [x, y, width, height] = values;
      return `M ${x - minX} ${y - minY} L ${x + width - minX} ${y - minY} L ${x + width - minX} ${y + height - minY} L ${x - minX} ${y + height - minY} Z`;
    }

    if (segment.type === 'Z') return 'Z';
    return `${segment.type} ${values.map((value) => Number(value.toFixed(3))).join(' ')}`;
  }).join(' ');
}

function elementFromVector(
  vector: VectorPath,
  index: number,
  groupName: string,
  format: 'svg' | 'eps',
  artboardSize: number,
  sourceWidth: number,
  sourceHeight: number,
  groupId: string,
): DesignElement {
  const sourceWidthSafe = Math.max(1, sourceWidth);
  const sourceHeightSafe = Math.max(1, sourceHeight);
  const scale = Math.min((artboardSize * 0.8) / sourceWidthSafe, (artboardSize * 0.8) / sourceHeightSafe);
  const width = Math.max(10, vector.bbox.maxX - vector.bbox.minX) * scale;
  const height = Math.max(10, vector.bbox.maxY - vector.bbox.minY) * scale;
  const sourceCenterX = (vector.bbox.minX + vector.bbox.maxX) / 2;
  const sourceCenterY = (vector.bbox.minY + vector.bbox.maxY) / 2;

  return {
    id: `import-${format}-${Date.now()}-${index}`,
    name: groupName === 'Imported Artwork' ? `Imported Vector ${index + 1}` : groupName,
    type: 'path',
    pathData: pathFromVector(vector),
    x: artboardSize / 2 + (sourceCenterX - sourceWidthSafe / 2) * scale,
    y: artboardSize / 2 + (sourceCenterY - sourceHeightSafe / 2) * scale,
    width,
    height,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
    fill: vector.hasFill ? vector.fillColor || '#18c98a' : 'none',
    stroke: vector.hasStroke ? vector.strokeColor || '#111111' : 'none',
    strokeWidth: vector.strokeWidth || 0,
    zIndex: index + 1,
    groupId,
    groupName,
    sourceFormat: format,
  };
}

function importSvg(svgText: string, artboardSize: number): ImportedVectorAsset {
  const parser = new DOMParser();
  const document = parser.parseFromString(svgText, 'image/svg+xml');
  const svg = document.documentElement;
  const sourceWidth = Number.parseFloat(svg.getAttribute('width') || '') || Number.parseFloat(svg.getAttribute('viewBox')?.split(/\s+/)[2] || '') || 500;
  const sourceHeight = Number.parseFloat(svg.getAttribute('height') || '') || Number.parseFloat(svg.getAttribute('viewBox')?.split(/\s+/)[3] || '') || 500;
  const drawableSelector = 'path,circle,ellipse,rect,polygon,polyline';
  const drawables = Array.from(svg.querySelectorAll(drawableSelector));
  const elements: DesignElement[] = [];
  const warnings: string[] = [];

  drawables.forEach((node, index) => {
    const vectorPaths = parseSvgToVectorPaths(node.outerHTML);
    const group = node.closest('g');
    const groupName = group?.getAttribute('inkscape:label') || group?.getAttribute('data-name') || group?.getAttribute('id') || 'Imported Artwork';
    vectorPaths.forEach((vector, vectorIndex) => {
      elements.push(elementFromVector(
        vector,
        index + vectorIndex,
        groupName,
        'svg',
        artboardSize,
        sourceWidth,
        sourceHeight,
        `svg-group-${groupName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      ));
    });
  });

  if (drawables.length === 0) warnings.push('No editable SVG vector shapes were found.');
  if (svg.querySelector('image')) warnings.push('Embedded raster images were skipped; vector layers were imported.');
  return { elements, format: 'svg', warnings };
}

export function importVectorFile(
  fileName: string,
  fileData: ArrayBuffer | string,
  artboardSize: number,
): ImportedVectorAsset {
  const extension = fileName.toLowerCase().split('.').pop();
  if (extension === 'svg') {
    return importSvg(typeof fileData === 'string' ? fileData : new TextDecoder().decode(fileData), artboardSize);
  }

  const postScript = extractPostScriptText(fileData);
  const embeddedSvg = extractEmbeddedSVG(postScript);
  if (embeddedSvg) return importSvg(embeddedSvg, artboardSize);

  const { width, height } = parseEPSBoundingBox(postScript);
  const vectors = parsePostScriptVectors(postScript, height);
  const elements = vectors.map((vector, index) => elementFromVector(
    vector,
    index,
    'EPS Artwork',
    'eps',
    artboardSize,
    width,
    height,
    'eps-artwork',
  ));

  return {
    elements,
    format: 'eps',
    warnings: elements.length === 0
      ? ['This EPS file contains no supported editable vector paths.']
      : [],
  };
}

