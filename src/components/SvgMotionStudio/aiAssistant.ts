import { AnimationTarget, AiAnimationPlan, AnimationPlanJson, getAnimationTargets, planJson, validateAnimationPlan } from './animationPlan';
import { SvgElementNode } from './types';
import { flattenElementTree } from './svgParser';

export type { AiAnimationPlan } from './animationPlan';

export interface SvgElementContext extends AnimationTarget {
  tag: string;
  className: string | null;
  parentId: string | null;
  children: string[];
  bounds: { x: number; y: number; width: number; height: number } | null;
  fill: string | null;
  stroke: string | null;
  strokeWidth: string | null;
  opacity: string | null;
  transform: string | null;
  clipPath: string | null;
  mask: string | null;
  filter: string | null;
  pathLength: number | null;
  pathStructure: { commandCount: number; moveCount: number; curveCount: number; closed: boolean } | null;
  geometry: Record<string, string>;
}

export interface SvgDefinitionContext {
  id: string | null;
  type: string;
  children: number;
  attributes: Record<string, string>;
  stops?: string[];
  filterPrimitives?: string[];
}

export interface SvgAnalysisContext {
  elementCount: number;
  elements: SvgElementContext[];
  definitions: SvgDefinitionContext[];
}

export interface GenerateAnimationOptions {
  duration: number;
  fps: number;
  loop: boolean;
  stockMotion: boolean;
  mode?: 'generate' | 'modify';
  existingPlan?: AnimationPlanJson;
  avoidPlan?: AnimationPlanJson;
  signal?: AbortSignal;
}

const GEOMETRY_ATTRIBUTES = [
  'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry',
  'width', 'height', 'points', 'viewBox',
];

function readInlineStyle(element: Element, property: string): string | null {
  const declaration = element.getAttribute('style');
  if (!declaration) return null;
  const match = declaration.match(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, 'i'));
  return match?.[1]?.trim() ?? null;
}

function getPresentationValue(element: Element, property: string): string | null {
  return element.getAttribute(property) || readInlineStyle(element, property);
}

function getPathStructure(path: string | null | undefined) {
  if (!path) return null;
  const commands = path.match(/[MmZzLlHhVvCcSsQqTtAa]/g) || [];
  return {
    commandCount: commands.length,
    moveCount: commands.filter((command) => command.toLowerCase() === 'm').length,
    curveCount: commands.filter((command) => 'cstaq'.includes(command.toLowerCase())).length,
    closed: /z/i.test(path),
  };
}

function measureSvgElements(svgRaw: string): Map<string, { bounds: SvgElementContext['bounds']; fill: string | null; stroke: string | null; opacity: string | null; transform: string | null }> {
  const measurements = new Map<string, { bounds: SvgElementContext['bounds']; fill: string | null; stroke: string | null; opacity: string | null; transform: string | null }>();
  if (typeof DOMParser === 'undefined' || typeof document === 'undefined' || !svgRaw) return measurements;

  const parsed = new DOMParser().parseFromString(svgRaw, 'image/svg+xml');
  if (parsed.querySelector('parsererror')) return measurements;
  const root = parsed.documentElement.cloneNode(true) as unknown as SVGSVGElement;
  const sandbox = document.createElement('div');
  sandbox.setAttribute('aria-hidden', 'true');
  sandbox.style.cssText = 'position:fixed;left:-100000px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;contain:strict;';
  sandbox.appendChild(root);
  document.body.appendChild(sandbox);

  try {
    root.querySelectorAll<SVGGraphicsElement>('[data-mcu-id]').forEach((element) => {
      const id = element.getAttribute('data-mcu-id');
      if (!id) return;
      let bounds: SvgElementContext['bounds'] = null;
      try {
        const box = element.getBBox();
        if ([box.x, box.y, box.width, box.height].every(Number.isFinite)) {
          bounds = { x: box.x, y: box.y, width: box.width, height: box.height };
        }
      } catch {
        bounds = null;
      }
      const style = getComputedStyle(element);
      measurements.set(id, {
        bounds,
        fill: style.fill || null,
        stroke: style.stroke || null,
        opacity: style.opacity || null,
        transform: element.getAttribute('transform') || readInlineStyle(element, 'transform'),
      });
    });
  } finally {
    sandbox.remove();
  }
  return measurements;
}

function buildDefinitions(svgRaw: string): SvgDefinitionContext[] {
  if (typeof DOMParser === 'undefined' || !svgRaw) return [];
  const doc = new DOMParser().parseFromString(svgRaw, 'image/svg+xml');
  if (doc.querySelector('parsererror')) return [];

  return Array.from(doc.querySelectorAll('linearGradient, radialGradient, pattern, clipPath, mask, filter'))
    .slice(0, 32)
    .map((definition) => {
      const type = definition.tagName;
      const attributes: Record<string, string> = {};
      for (const name of ['gradientUnits', 'gradientTransform', 'patternUnits', 'patternTransform', 'x', 'y', 'width', 'height', 'filterUnits', 'clipPathUnits', 'maskUnits']) {
        const value = definition.getAttribute(name);
        if (value) attributes[name] = value.slice(0, 120);
      }
      const definitionInfo: SvgDefinitionContext = {
        id: definition.getAttribute('id'),
        type,
        children: definition.children.length,
        attributes,
      };
      if (type === 'linearGradient' || type === 'radialGradient') {
        definitionInfo.stops = Array.from(definition.querySelectorAll('stop')).slice(0, 12).map((stop) =>
          getPresentationValue(stop, 'stop-color') || '#000000'
        );
      }
      if (type === 'filter') {
        definitionInfo.filterPrimitives = Array.from(definition.children).slice(0, 12).map((child) => child.tagName);
      }
      return definitionInfo;
    });
}

export function buildSvgAnalysisContext(elements: SvgElementNode[], svgRaw: string): SvgAnalysisContext {
  const flat = flattenElementTree(elements);
  const measurements = measureSvgElements(svgRaw);
  let document: Document | null = null;
  if (typeof DOMParser !== 'undefined' && svgRaw) {
    const parsed = new DOMParser().parseFromString(svgRaw, 'image/svg+xml');
    if (!parsed.querySelector('parsererror')) document = parsed;
  }

  const compactElements = flat.slice(0, 80).map((node) => {
    const domNode = document?.querySelector(`[data-mcu-id="${node.id}"]`);
    const geometry: Record<string, string> = {};
    for (const key of GEOMETRY_ATTRIBUTES) {
      const value = domNode?.getAttribute(key);
      if (value) geometry[key] = value.slice(0, 100);
    }
    const initialAppearance = node.initialAppearance;
    const measured = measurements.get(node.id);
    return {
      id: node.id,
      originalId: node.originalId || undefined,
      name: node.name,
      tag: node.tagName,
      className: domNode?.getAttribute('class') || null,
      parentId: node.parentId,
      children: node.children.map((child) => child.id),
      bounds: measured?.bounds ?? node.bbox ?? null,
      fill: measured?.fill || (domNode ? getPresentationValue(domNode, 'fill') : null) || initialAppearance?.fill || null,
      stroke: measured?.stroke || (domNode ? getPresentationValue(domNode, 'stroke') : null) || initialAppearance?.stroke || null,
      strokeWidth: domNode ? getPresentationValue(domNode, 'stroke-width') : initialAppearance?.strokeWidth?.toString() || null,
      opacity: measured?.opacity || (domNode ? getPresentationValue(domNode, 'opacity') : null) || initialAppearance?.opacity?.toString() || null,
      transform: measured?.transform || (domNode ? getPresentationValue(domNode, 'transform') : null),
      clipPath: domNode ? getPresentationValue(domNode, 'clip-path') : null,
      mask: domNode ? getPresentationValue(domNode, 'mask') : null,
      filter: domNode ? getPresentationValue(domNode, 'filter') : null,
      pathLength: node.pathLength ?? null,
      pathStructure: node.tagName === 'path' ? getPathStructure(node.attributes?.d) : null,
      geometry,
    } satisfies SvgElementContext;
  });

  return {
    elementCount: flat.length,
    elements: compactElements,
    definitions: buildDefinitions(svgRaw),
  };
}

export async function generateAiAnimation(
  prompt: string,
  elements: SvgElementNode[],
  svgRaw: string,
  options: GenerateAnimationOptions
): Promise<AiAnimationPlan> {
  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) throw new Error('Describe the motion you want to create.');
  if (trimmedPrompt.length > 1200) throw new Error('Keep the prompt under 1,200 characters.');

  const response = await fetch('/api/svg-motion/ai-assist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: trimmedPrompt,
      context: buildSvgAnalysisContext(elements, svgRaw),
      duration: options.duration,
      fps: options.fps,
      loop: options.loop,
      stockMotion: options.stockMotion,
      mode: options.mode ?? 'generate',
      existingPlan: options.existingPlan,
      avoidPlan: options.avoidPlan,
    }),
    signal: options.signal,
  });

  const payload = await response.json().catch(() => ({})) as { plan?: unknown; error?: string };
  if (!response.ok) throw new Error(payload.error || `Animation request failed (${response.status}).`);

  const targets = getAnimationTargets(elements);
  return validateAnimationPlan(payload.plan, targets, trimmedPrompt);
}

export function exportAnimationPlan(plan: AiAnimationPlan): AnimationPlanJson {
  return planJson(plan);
}
