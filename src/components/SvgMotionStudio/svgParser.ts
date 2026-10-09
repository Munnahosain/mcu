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

function getStyleValue(element: Element, property: string): string | undefined {
  const style = element.getAttribute('style') || '';
  return style.match(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, 'i'))?.[1]?.trim();
}

function presentationValue(element: Element, property: string): string | undefined {
  return element.getAttribute(property) || getStyleValue(element, property);
}

function parseTransform(transform: string | undefined) {
  const matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  if (!transform) return matrix;

  const multiply = (right: typeof matrix) => {
    const left = { ...matrix };
    matrix.a = left.a * right.a + left.c * right.b;
    matrix.b = left.b * right.a + left.d * right.b;
    matrix.c = left.a * right.c + left.c * right.d;
    matrix.d = left.b * right.c + left.d * right.d;
    matrix.e = left.a * right.e + left.c * right.f + left.e;
    matrix.f = left.b * right.e + left.d * right.f + left.f;
  };

  for (const match of transform.matchAll(/([a-z]+)\s*\(([^)]*)\)/gi)) {
    const operation = match[1].toLowerCase();
    const values = match[2].trim().split(/[\s,]+/).map(Number);
    if (values.some((value) => !Number.isFinite(value))) continue;
    if (operation === 'matrix' && values.length === 6) {
      multiply({ a: values[0], b: values[1], c: values[2], d: values[3], e: values[4], f: values[5] });
    } else if (operation === 'translate' && values.length >= 1) {
      multiply({ a: 1, b: 0, c: 0, d: 1, e: values[0], f: values[1] || 0 });
    } else if (operation === 'scale' && values.length >= 1) {
      multiply({ a: values[0], b: 0, c: 0, d: values[1] ?? values[0], e: 0, f: 0 });
    } else if (operation === 'rotate' && values.length >= 1) {
      const radians = values[0] * Math.PI / 180;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);
      const cx = values[1] || 0;
      const cy = values[2] || 0;
      multiply({
        a: cos,
        b: sin,
        c: -sin,
        d: cos,
        e: cx - cos * cx + sin * cy,
        f: cy - sin * cx - cos * cy,
      });
    } else if (operation === 'skewx' && values.length === 1) {
      multiply({ a: 1, b: 0, c: Math.tan(values[0] * Math.PI / 180), d: 1, e: 0, f: 0 });
    } else if (operation === 'skewy' && values.length === 1) {
      multiply({ a: 1, b: Math.tan(values[0] * Math.PI / 180), c: 0, d: 1, e: 0, f: 0 });
    }
  }
  return matrix;
}

function estimateBounds(tag: string, attrs: Record<string, string>, childBounds: Array<BoundingBox | undefined>): BoundingBox | undefined {
  const number = (key: string, fallback = 0) => {
    const parsed = parseFloat(attrs[key] || '');
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  if (tag === 'rect' || tag === 'image') {
    return { x: number('x'), y: number('y'), width: number('width'), height: number('height') };
  }
  if (tag === 'circle') {
    const radius = number('r');
    return { x: number('cx') - radius, y: number('cy') - radius, width: radius * 2, height: radius * 2 };
  }
  if (tag === 'ellipse') {
    const rx = number('rx');
    const ry = number('ry');
    return { x: number('cx') - rx, y: number('cy') - ry, width: rx * 2, height: ry * 2 };
  }
  if (tag === 'line') {
    const x1 = number('x1');
    const y1 = number('y1');
    const x2 = number('x2');
    const y2 = number('y2');
    return { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
  }
  if (tag === 'polygon' || tag === 'polyline') {
    const points = (attrs.points || '').trim().split(/[\s,]+/).map(Number);
    if (points.length >= 4 && points.every(Number.isFinite)) {
      const xs = points.filter((_, index) => index % 2 === 0);
      const ys = points.filter((_, index) => index % 2 === 1);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
    }
  }
  if (tag === 'g') {
    const valid = childBounds.filter((box): box is BoundingBox => Boolean(box));
    if (valid.length) {
      const x = Math.min(...valid.map((box) => box.x));
      const y = Math.min(...valid.map((box) => box.y));
      const right = Math.max(...valid.map((box) => box.x + box.width));
      const bottom = Math.max(...valid.map((box) => box.y + box.height));
      return { x, y, width: right - x, height: bottom - y };
    }
  }
  return undefined;
}

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
      'clip-path',
      'mask',
      'filter',
      'stop-color',
      'stop-opacity',
      'gradientUnits',
      'gradientTransform',
      'patternUnits',
      'patternTransform',
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
    const attributes = Object.fromEntries(
      Array.from(node.attributes)
        .filter((attribute) => attribute.name !== 'data-mcu-id')
        .map((attribute) => [attribute.name, attribute.value])
    );

    const isGroup = tag === 'g';
    const originalId = node.getAttribute('id') || '';
    const name = generateName(node, tag);

    // Initial appearance
    const fill = presentationValue(node, 'fill');
    const stroke = presentationValue(node, 'stroke');
    const strokeWidthAttr = presentationValue(node, 'stroke-width');
    const strokeWidth = strokeWidthAttr ? parseFloat(strokeWidthAttr) : undefined;
    const opacityAttr = presentationValue(node, 'opacity');
    const opacityValue = opacityAttr
      ? (opacityAttr.endsWith('%') ? parseFloat(opacityAttr) / 100 : parseFloat(opacityAttr))
      : undefined;
    const opacity = opacityValue === undefined || !Number.isFinite(opacityValue)
      ? undefined
      : Math.max(0, Math.min(1, opacityValue));
    const strokeDasharray = presentationValue(node, 'stroke-dasharray');
    const strokeDashoffsetAttr = presentationValue(node, 'stroke-dashoffset');
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

    const transform = parseTransform(presentationValue(node, 'transform'));
    const transformOrigin = presentationValue(node, 'transform-origin')?.split(/[\s,]+/);
    const originValue = (index: number) => {
      const value = transformOrigin?.[index];
      if (!value) return 50;
      if (value.endsWith('%')) return Math.max(0, Math.min(100, parseFloat(value)));
      return 50;
    };
    const elementNode: SvgElementNode = {
      id: mcuId,
      originalId,
      tagName: tag as SvgTagName,
      name,
      textContent: tag === 'text' ? node.textContent || '' : undefined,
      isTextEditable: tag === 'text' ? node.children.length === 0 : undefined,
      className: node.getAttribute('class') || undefined,
      attributes,
      parentId,
      children,
      isGroup,
      visible: true,
      locked: false,
      bbox: estimateBounds(tag, attributes, children.map((child) => child.bbox)),
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
        x: transform.e,
        y: transform.f,
        rotation: Math.atan2(transform.b, transform.a) * 180 / Math.PI,
        scaleX: Math.hypot(transform.a, transform.b) * 100,
        scaleY: (transform.a * transform.d - transform.b * transform.c) / (Math.hypot(transform.a, transform.b) || 1) * 100,
        skewX: Math.atan2(transform.a * transform.c + transform.b * transform.d, transform.a * transform.a + transform.b * transform.b) * 180 / Math.PI,
        skewY: 0,
        originX: originValue(0),
        originY: originValue(1),
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
