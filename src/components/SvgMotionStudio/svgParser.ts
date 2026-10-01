import DOMPurify from 'dompurify';
import { SvgElementNode, SvgTagName, BoundingBox } from './types';

export interface ParseResult {
  success: boolean;
  error?: string;
  elements: SvgElementNode[];
  viewBox: { x: number; y: number; width: number; height: number };
  width: number;
  height: number;
  cleanSvg: string;
  isSingleFlattenedPath: boolean;
  totalShapes: number;
}

const SUPPORTED_TAGS: Set<string> = new Set([
  'path',
  'rect',
  'circle',
  'ellipse',
  'polygon',
  'polyline',
  'line',
  'text',
  'image',
  'g',
]);

const SHAPE_TAGS: Set<string> = new Set([
  'path',
  'rect',
  'circle',
  'ellipse',
  'polygon',
  'polyline',
  'line',
  'text',
  'image',
]);

export function sanitizeAndParseSvg(rawSvg: string): ParseResult {
  if (!rawSvg || typeof rawSvg !== 'string') {
    return {
      success: false,
      error: 'Empty or invalid SVG input provided.',
      elements: [],
      viewBox: { x: 0, y: 0, width: 800, height: 600 },
      width: 800,
      height: 600,
      cleanSvg: '',
      isSingleFlattenedPath: false,
      totalShapes: 0,
    };
  }

  // 1. Sanitize with DOMPurify
  const sanitized = DOMPurify.sanitize(rawSvg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: ['use', 'symbol', 'defs', 'clipPath', 'mask', 'pattern'],
    ADD_ATTR: [
      'id',
      'class',
      'transform',
      'viewBox',
      'xmlns',
      'd',
      'fill',
      'stroke',
      'stroke-width',
      'stroke-dasharray',
      'stroke-dashoffset',
      'stroke-linecap',
      'stroke-linejoin',
      'stroke-miterlimit',
      'xmlns:inkscape',
      'opacity',
      'points',
      'cx',
      'cy',
      'r',
      'rx',
      'ry',
      'x',
      'y',
      'x1',
      'y1',
      'x2',
      'y2',
      'width',
      'height',
      'inkscape:label',
      'aria-label',
      'data-name',
      'style',
    ],
  });

  // 2. Parse XML
  if (typeof window === 'undefined') {
    return {
      success: false,
      error: 'DOMParser is only available in browser environment.',
      elements: [],
      viewBox: { x: 0, y: 0, width: 800, height: 600 },
      width: 800,
      height: 600,
      cleanSvg: '',
      isSingleFlattenedPath: false,
      totalShapes: 0,
    };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(sanitized, 'image/svg+xml');

  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    return {
      success: false,
      error: `Malformed SVG structure: ${parserError.textContent?.slice(0, 150) || 'Syntax error in XML'}`,
      elements: [],
      viewBox: { x: 0, y: 0, width: 800, height: 600 },
      width: 800,
      height: 600,
      cleanSvg: '',
      isSingleFlattenedPath: false,
      totalShapes: 0,
    };
  }

  const svgRoot = doc.querySelector('svg');
  if (!svgRoot) {
    return {
      success: false,
      error: 'No root <svg> element found in the uploaded file.',
      elements: [],
      viewBox: { x: 0, y: 0, width: 800, height: 600 },
      width: 800,
      height: 600,
      cleanSvg: '',
      isSingleFlattenedPath: false,
      totalShapes: 0,
    };
  }

  // 3. Extract dimensions & viewBox
  let vbX = 0;
  let vbY = 0;
  let vbWidth = 800;
  let vbHeight = 600;

  const rawViewBox = svgRoot.getAttribute('viewBox');
  if (rawViewBox) {
    const parts = rawViewBox.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && !parts.some(isNaN)) {
      [vbX, vbY, vbWidth, vbHeight] = parts;
    }
  } else {
    const attrW = parseFloat(svgRoot.getAttribute('width') || '');
    const attrH = parseFloat(svgRoot.getAttribute('height') || '');
    if (!isNaN(attrW) && attrW > 0) vbWidth = attrW;
    if (!isNaN(attrH) && attrH > 0) vbHeight = attrH;
    svgRoot.setAttribute('viewBox', `${vbX} ${vbY} ${vbWidth} ${vbHeight}`);
  }

  // Ensure svg has standard attributes
  svgRoot.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svgRoot.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  // 4. Count total shapes to detect single flattened path
  let shapeCount = 0;
  const allElements = svgRoot.querySelectorAll('*');
  allElements.forEach((el) => {
    const tag = el.tagName.toLowerCase();
    if (SHAPE_TAGS.has(tag)) {
      shapeCount++;
    }
  });

  const isSingleFlattenedPath = shapeCount === 1;

  // 5. Recursive element tree extraction
  let elementCounter = 1;
  const tagCounters: Record<string, number> = {};

  function generateName(el: Element, tag: string): string {
    const inkscapeLabel = el.getAttribute('inkscape:label')?.trim();
    if (inkscapeLabel) return inkscapeLabel;

    const ariaLabel = el.getAttribute('aria-label')?.trim();
    if (ariaLabel) return ariaLabel;

    const dataName = el.getAttribute('data-name')?.trim();
    if (dataName) return dataName;

    const id = el.getAttribute('id')?.trim();
    if (id && !id.startsWith('mcu_el_') && !id.startsWith('SVGID_') && !id.startsWith('path_') && id.length > 2) {
      // Beautify id (e.g. "left-arm" -> "Left Arm", "Head_Group" -> "Head Group")
      return id
        .replace(/[-_]/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }

    const className = el.getAttribute('class')?.trim();
    if (className && className.length > 2 && !className.includes(' ')) {
      return className
        .replace(/[-_]/g, ' ')
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }

    tagCounters[tag] = (tagCounters[tag] || 0) + 1;
    const padded = String(tagCounters[tag]).padStart(2, '0');
    const tagDisplayName = tag.charAt(0).toUpperCase() + tag.slice(1);
    return `${tagDisplayName} ${padded}`;
  }

  function traverse(node: Element, parentId: string | null): SvgElementNode | null {
    const tag = node.tagName.toLowerCase();

    // Skip defs, metadata, scripts, styles from layer tree (they remain in DOM though)
    if (!SUPPORTED_TAGS.has(tag)) {
      return null;
    }

    const mcuId = `mcu_el_${elementCounter++}`;
    node.setAttribute('data-mcu-id', mcuId);

    const isGroup = tag === 'g';
    const originalId = node.getAttribute('id') || '';
    const name = generateName(node, tag);

    // Initial appearance
    const fill = node.getAttribute('fill') || undefined;
    const stroke = node.getAttribute('stroke') || undefined;
    const strokeWidthAttr = node.getAttribute('stroke-width');
    const strokeWidth = strokeWidthAttr ? parseFloat(strokeWidthAttr) : undefined;
    const opacityAttr = node.getAttribute('opacity');
    const opacity = opacityAttr ? parseFloat(opacityAttr) : undefined;
    const strokeDasharray = node.getAttribute('stroke-dasharray') || undefined;
    const strokeDashoffsetAttr = node.getAttribute('stroke-dashoffset');
    const strokeDashoffset = strokeDashoffsetAttr ? parseFloat(strokeDashoffsetAttr) : undefined;

    // Approximate or compute path length for path drawing
    let pathLength: number | undefined;
    if (tag === 'path' && 'getTotalLength' in node) {
      try {
        pathLength = (node as SVGGeometryElement).getTotalLength();
      } catch {
        // SVG not mounted yet in DOM, approximate fallback
        const d = node.getAttribute('d') || '';
        pathLength = Math.max(100, d.length * 1.5);
      }
    }

    const children: SvgElementNode[] = [];
    Array.from(node.children).forEach((childEl) => {
      const childNode = traverse(childEl, mcuId);
      if (childNode) {
        children.push(childNode);
      }
    });

    const elementNode: SvgElementNode = {
      id: mcuId,
      originalId,
      tagName: tag as SvgTagName,
      name,
      parentId,
      children,
      isGroup,
      visible: true,
      locked: false,
      pathLength,
      initialAppearance: {
        fill,
        stroke,
        strokeWidth: isNaN(strokeWidth as number) ? undefined : strokeWidth,
        opacity: isNaN(opacity as number) ? 1 : opacity,
        strokeDasharray,
        strokeDashoffset: isNaN(strokeDashoffset as number) ? undefined : strokeDashoffset,
      },
      initialTransform: {
        x: 0,
        y: 0,
        rotation: 0,
        scaleX: 100,
        scaleY: 100,
        skewX: 0,
        skewY: 0,
        originX: 50,
        originY: 50,
      },
    };

    return elementNode;
  }

  const rootElements: SvgElementNode[] = [];
  Array.from(svgRoot.children).forEach((childEl) => {
    const parsed = traverse(childEl, null);
    if (parsed) {
      rootElements.push(parsed);
    }
  });

  const serializer = new XMLSerializer();
  const cleanSvg = serializer.serializeToString(svgRoot);

  return {
    success: true,
    elements: rootElements,
    viewBox: { x: vbX, y: vbY, width: vbWidth, height: vbHeight },
    width: vbWidth,
    height: vbHeight,
    cleanSvg,
    isSingleFlattenedPath,
    totalShapes: shapeCount,
  };
}

export function flattenElementTree(nodes: SvgElementNode[]): SvgElementNode[] {
  const result: SvgElementNode[] = [];
  function recurse(list: SvgElementNode[]) {
    for (const node of list) {
      result.push(node);
      if (node.children && node.children.length > 0) {
        recurse(node.children);
      }
    }
  }
  recurse(nodes);
  return result;
}

export function findElementById(nodes: SvgElementNode[], id: string): SvgElementNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children && node.children.length > 0) {
      const found = findElementById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}
