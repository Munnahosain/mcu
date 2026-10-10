import {
  AnimationTrack,
  AnimProperty,
  CompositionInfo,
  EasingType,
  Keyframe,
  KeyframeInterpolation,
  ProjectItem,
  ProjectMarker,
  ProjectState,
  SvgElementNode,
} from './types';

const ANIM_PROPERTIES: AnimProperty[] = [
  'x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity', 'skewX', 'skewY',
  'fill', 'stroke', 'strokeWidth', 'strokeDashoffset', 'originX', 'originY',
];
const EASINGS: EasingType[] = [
  'linear', 'easeIn', 'easeOut', 'easeInOut', 'backIn', 'backOut',
  'backInOut', 'elasticOut', 'bounceOut', 'custom', 'cubicBezier',
];
const INTERPOLATIONS: KeyframeInterpolation[] = ['linear', 'bezier', 'hold'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeElements(value: unknown, duration: number, parentId: string | null = null): SvgElementNode[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.id !== 'string') return [];
    const id = entry.id;
    const children = normalizeElements(entry.children, duration, id);
    const inPoint = Math.max(0, Math.min(duration, finiteNumber(entry.inPoint, 0)));
    const outPoint = Math.max(inPoint, Math.min(duration, finiteNumber(entry.outPoint, duration)));
    const colorLabels = ['green', 'blue', 'purple', 'orange', 'pink', 'cyan'];
    const legacyColor = colorLabels.indexOf(String(entry.colorLabel));
    const colorLabel = typeof entry.colorLabel === 'number' && Number.isInteger(entry.colorLabel)
      && entry.colorLabel >= 0 && entry.colorLabel < colorLabels.length
      ? entry.colorLabel
      : legacyColor >= 0 ? legacyColor : 0;
    const blendModes = ['normal', 'multiply', 'screen', 'overlay', 'add'];
    const blendMode = blendModes.includes(String(entry.blendMode))
      ? entry.blendMode
      : 'normal';
    return [{
      ...entry,
      id,
      originalId: typeof entry.originalId === 'string' ? entry.originalId : id,
      tagName: typeof entry.tagName === 'string' ? entry.tagName : 'g',
      name: typeof entry.name === 'string' ? entry.name : 'Layer',
      parentId: typeof entry.parentId === 'string' || entry.parentId === null ? entry.parentId : parentId,
      animParentId: typeof entry.animParentId === 'string' ? entry.animParentId : null,
      children,
      isGroup: Boolean(entry.isGroup),
      visible: entry.visible !== false,
      locked: Boolean(entry.locked),
      inPoint,
      outPoint,
      colorLabel,
      solo: typeof entry.solo === 'boolean' ? entry.solo : false,
      shy: typeof entry.shy === 'boolean' ? entry.shy : false,
      ...(typeof entry.motionBlur === 'boolean' ? { motionBlur: entry.motionBlur } : {}),
      blendMode,
    } as SvgElementNode];
  });
}

function normalizeTracks(value: unknown, duration: number): AnimationTrack[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (
      !isRecord(entry)
      || typeof entry.id !== 'string'
      || typeof entry.elementId !== 'string'
      || typeof entry.property !== 'string'
      || !ANIM_PROPERTIES.includes(entry.property as AnimProperty)
      || !Array.isArray(entry.keyframes)
    ) return [];
    const keyframes: Keyframe[] = entry.keyframes.flatMap((frame) => {
      if (
        !isRecord(frame)
        || typeof frame.id !== 'string'
        || typeof frame.value !== 'number' && typeof frame.value !== 'string'
      ) return [];
      const easing = EASINGS.includes(frame.easing as EasingType)
        ? frame.easing as EasingType
        : 'linear';
      const interpolation = INTERPOLATIONS.includes(frame.interpolation as KeyframeInterpolation)
        ? frame.interpolation as KeyframeInterpolation
        : easing === 'linear' ? 'linear' : 'bezier';
      const bezier = Array.isArray(frame.bezier)
        && frame.bezier.length === 4
        && frame.bezier.every((number) => typeof number === 'number' && Number.isFinite(number))
        ? frame.bezier as [number, number, number, number]
        : undefined;
      return [{
        id: frame.id,
        time: Math.min(duration, Math.max(0, finiteNumber(frame.time, 0))),
        value: frame.value,
        easing,
        interpolation,
        ...(bezier ? { bezier } : {}),
      }];
    }).sort((a, b) => a.time - b.time);
    return [{
      id: entry.id,
      elementId: entry.elementId,
      property: entry.property as AnimProperty,
      keyframes,
    }];
  });
}

function normalizeItems(value: unknown): ProjectItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const kind = isRecord(entry) ? entry.kind ?? entry.type : undefined;
    if (
      !isRecord(entry)
      || typeof entry.id !== 'string'
      || typeof entry.name !== 'string'
      || !['composition', 'folder', 'svg', 'image'].includes(String(kind))
    ) return [];
    return [{
      id: entry.id,
      name: entry.name,
      type: kind as ProjectItem['type'],
      kind: kind as ProjectItem['kind'],
      ...(typeof entry.parentId === 'string' || entry.parentId === null
        ? { parentId: entry.parentId }
        : {}),
      ...(typeof entry.size === 'number' && Number.isFinite(entry.size) ? { size: entry.size } : {}),
      ...(typeof entry.width === 'number' && Number.isFinite(entry.width) ? { width: entry.width } : {}),
      ...(typeof entry.height === 'number' && Number.isFinite(entry.height) ? { height: entry.height } : {}),
      ...(typeof entry.dataUrl === 'string' ? { dataUrl: entry.dataUrl } : {}),
      ...(typeof entry.svgText === 'string' ? { svgText: entry.svgText } : {}),
      ...(typeof entry.layerId === 'string' ? { layerId: entry.layerId } : {}),
      ...(Array.isArray(entry.layerIds)
        ? { layerIds: entry.layerIds.filter((id): id is string => typeof id === 'string') }
        : {}),
      ...(typeof entry.createdAt === 'string' ? { createdAt: entry.createdAt } : {}),
    }];
  });
}

function normalizeCompositions(value: unknown, project: ProjectState): CompositionInfo[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => {
      if (!isRecord(entry) || typeof entry.id !== 'string') return [];
      return [{
        id: entry.id,
        name: typeof entry.name === 'string' ? entry.name : project.name,
        width: Math.max(1, finiteNumber(entry.width, project.document.width)),
        height: Math.max(1, finiteNumber(entry.height, project.document.height)),
        duration: Math.max(0.1, finiteNumber(entry.duration, project.document.duration)),
        fps: Math.max(1, finiteNumber(entry.fps, project.document.fps)),
      }];
    });
  }
  return [{
    id: 'comp-main',
    name: project.document.name || project.name,
    width: project.document.width,
    height: project.document.height,
    duration: project.document.duration,
    fps: project.document.fps,
  }];
}

function normalizeAnimationParents(elements: SvgElementNode[]): SvgElementNode[] {
  const nodes = new Map<string, SvgElementNode>();
  const collect = (items: SvgElementNode[]) => items.forEach((item) => {
    nodes.set(item.id, item);
    collect(item.children);
  });
  collect(elements);
  return elements.map((node) => {
    let parentId = node.animParentId ?? null;
    const visited = new Set([node.id]);
    while (parentId) {
      if (visited.has(parentId) || !nodes.has(parentId)) {
        parentId = null;
        break;
      }
      visited.add(parentId);
      parentId = nodes.get(parentId)?.animParentId ?? null;
    }
    return {
      ...node,
      animParentId: parentId === node.animParentId ? node.animParentId : null,
      children: normalizeAnimationParents(node.children),
    };
  });
}

export function migrateProject(value: unknown): ProjectState | null {
  if (!isRecord(value) || typeof value.svgRaw !== 'string' || !isRecord(value.document)) return null;
  const sourceDocument = value.document;
  const viewBox = isRecord(sourceDocument.viewBox) ? sourceDocument.viewBox : {};
  const duration = Math.max(0.1, finiteNumber(sourceDocument.duration, 4));
  const document = {
    width: Math.max(1, finiteNumber(sourceDocument.width, 800)),
    height: Math.max(1, finiteNumber(sourceDocument.height, 600)),
    viewBox: {
      x: finiteNumber(viewBox.x, 0),
      y: finiteNumber(viewBox.y, 0),
      width: Math.max(1, finiteNumber(viewBox.width, 800)),
      height: Math.max(1, finiteNumber(viewBox.height, 600)),
    },
    backgroundColor: typeof sourceDocument.backgroundColor === 'string' ? sourceDocument.backgroundColor : 'transparent',
    fps: Math.max(1, finiteNumber(sourceDocument.fps, 30)),
    duration,
    loop: sourceDocument.loop !== false,
    name: typeof sourceDocument.name === 'string' ? sourceDocument.name : 'Untitled Project',
  };
  const name = typeof value.name === 'string' ? value.name : document.name;
  const elements = normalizeAnimationParents(normalizeElements(value.elements, duration));
  const rasterSources = Array.isArray(value.rasterSources)
    ? value.rasterSources as ProjectState['rasterSources']
    : [];
  if (!rasterSources?.length && typeof DOMParser !== 'undefined') {
    const svgDocument = new DOMParser().parseFromString(value.svgRaw, 'image/svg+xml');
    const legacyImage = Array.from(svgDocument.querySelectorAll<SVGImageElement>('image')).find((image) =>
      image.id.startsWith('mcu-original-image-')
    );
    const dataUrl = legacyImage?.getAttribute('href') || legacyImage?.getAttribute('xlink:href') || '';
    const width = Number(legacyImage?.getAttribute('width'));
    const height = Number(legacyImage?.getAttribute('height'));
    if (
      legacyImage
      && /^data:image\/(?:png|jpeg|webp);base64,/i.test(dataUrl)
      && Number.isFinite(width)
      && Number.isFinite(height)
      && width > 0
      && height > 0
    ) {
      rasterSources?.push({
        dataUrl,
        width,
        height,
        name: legacyImage.getAttribute('data-name') || name,
        elementOriginalId: legacyImage.id,
        x: finiteNumber(legacyImage.getAttribute('x'), 0),
        y: finiteNumber(legacyImage.getAttribute('y'), 0),
        displayWidth: width,
        displayHeight: height,
      });
    }
  }
  const project: ProjectState = {
    version: '3.0',
    name,
    document,
    svgRaw: value.svgRaw,
    elements,
    tracks: normalizeTracks(value.tracks, duration),
    characterSlots: isRecord(value.characterSlots) ? value.characterSlots as ProjectState['characterSlots'] : {},
    isSingleFlattenedPath: Boolean(value.isSingleFlattenedPath),
    selectedElementId: typeof value.selectedElementId === 'string' ? value.selectedElementId : null,
    selectedKeyframeId: typeof value.selectedKeyframeId === 'string' ? value.selectedKeyframeId : null,
    selectedKeyframeIds: Array.isArray(value.selectedKeyframeIds)
      ? value.selectedKeyframeIds.filter((id): id is string => typeof id === 'string')
      : [],
    currentTime: Math.min(duration, Math.max(0, finiteNumber(value.currentTime, 0))),
    isPlaying: false,
    autoKeyframe: Boolean(value.autoKeyframe),
    defaultEasing: EASINGS.includes(value.defaultEasing as EasingType) ? value.defaultEasing as EasingType : 'easeInOut',
    rasterSources,
    markers: Array.isArray(value.markers)
      ? value.markers.flatMap((marker): ProjectMarker[] => {
        if (!isRecord(marker) || typeof marker.id !== 'string') return [];
        return [{
          id: marker.id,
          time: Math.min(duration, Math.max(0, finiteNumber(marker.time, 0))),
          label: typeof marker.label === 'string' ? marker.label : 'Marker',
        }];
      })
      : [],
    workArea: isRecord(value.workArea)
      ? {
        start: Math.min(duration, Math.max(0, finiteNumber(value.workArea.start, 0))),
        end: Math.max(
          Math.min(duration, Math.max(0, finiteNumber(value.workArea.start, 0))),
          Math.min(duration, Math.max(0, finiteNumber(value.workArea.end, duration)))
        ),
      }
      : { start: 0, end: duration },
    compositions: [],
    projectItems: normalizeItems(value.projectItems),
  };
  project.compositions = normalizeCompositions(value.compositions, project);
  const items = project.projectItems ?? [];
  const composition = project.compositions[0] ?? {
    id: 'comp-main',
    name: project.document.name || project.name,
    width: project.document.width,
    height: project.document.height,
    duration: project.document.duration,
    fps: project.document.fps,
  };
  if (!items.some((item) => item.type === 'composition')) {
    items.unshift({
      id: composition.id,
      name: composition.name,
      type: 'composition',
      kind: 'composition',
      width: composition.width,
      height: composition.height,
      createdAt: new Date(0).toISOString(),
    });
  }
  if (!items.some((item) => item.type === 'svg')) {
    items.push({
      id: 'asset-svg-main',
      name: `${project.name}.svg`,
      type: 'svg',
      kind: 'svg',
      size: project.svgRaw.length * 2,
      width: project.document.width,
      height: project.document.height,
      svgText: project.svgRaw,
      createdAt: new Date(0).toISOString(),
    });
  }
  for (const source of project.rasterSources ?? []) {
    if (items.some((item) => item.id === source.elementOriginalId)) continue;
    items.push({
      id: source.elementOriginalId,
      name: source.name,
      type: 'image',
      kind: 'image',
      size: Math.round(source.dataUrl.length * 0.75),
      width: source.width,
      height: source.height,
      dataUrl: source.dataUrl,
      createdAt: new Date(0).toISOString(),
    });
  }
  project.projectItems = items;
  return project;
}
