'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ProjectState,
  SvgElementNode,
  Keyframe,
  AnimProperty,
  EasingType,
  ToastMessage,
  SvgPrimitiveKind,
  BoundingBox,
  RasterImageSource,
} from './types';
import { DEFAULT_DURATION, DEFAULT_FPS, DEFAULT_VIEWBOX } from './constants';
import { sanitizeAndParseSvg, findElementById, flattenElementTree } from './svgParser';
import { ANIMATION_PRESETS } from './presets';
import { AiAnimationPlan } from './aiAssistant';
import { computeElementStylesAtTime } from './animationEngine';
import {
  recordPropertyKeyframe,
  recordAllTransformKeyframes,
  applyEasingToElementTransforms,
  getAdjacentKeyframes,
} from './keyframeManager';
import { downloadText } from '@/lib/downloadHelper';
import { TopBar } from './TopBar';
import { LayersPanel } from './LayersPanel';
import { CanvasViewport } from './CanvasViewport';
import { Inspector } from './Inspector';
import { Timeline } from './Timeline';
import { AiAssistantModal } from './AiAssistantModal';
import { ExportModal } from './ExportModal';
import { ShortcutsModal } from './ShortcutsModal';
import { VeoVideoModal } from './VeoVideoModal';
import {
  X,
  CheckCircle,
  AlertTriangle,
  Info,
  Maximize,
  Minimize,
} from 'lucide-react';

const LOCAL_STORAGE_KEY = 'mcu_svg_motion_last_project';
const MAX_RASTER_UPLOAD_BYTES = 20 * 1024 * 1024;
type PlaybackRenderer = (time: number) => void;
type TransformUpdate = {
  x?: number;
  y?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  skewX?: number;
  skewY?: number;
  opacity?: number;
  originX?: number;
  originY?: number;
};

const clampTimelineTime = (time: number, duration: number): number => {
  const safeDuration = Number.isFinite(duration) ? Math.max(0, duration) : 0;
  const safeTime = Number.isFinite(time) ? time : 0;
  return Math.min(Math.max(safeTime, 0), safeDuration);
};

function updateElementTreeBaseStyle(
  nodes: SvgElementNode[],
  elementId: string,
  update: TransformUpdate
): SvgElementNode[] {
  return nodes.map((node) => {
    if (node.id === elementId) {
      return {
        ...node,
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
          ...node.initialTransform,
          ...update,
        },
        initialAppearance: update.opacity === undefined
          ? node.initialAppearance
          : { ...node.initialAppearance, opacity: update.opacity / 100 },
      };
    }
    return node.children.length
      ? { ...node, children: updateElementTreeBaseStyle(node.children, elementId, update) }
      : node;
  });
}

function updateSvgBaseTransform(
  svgRaw: string,
  elementId: string,
  baseTransform: SvgElementNode['initialTransform'],
  baseAppearance: SvgElementNode['initialAppearance'],
  update: TransformUpdate
): string {
  const parsed = new DOMParser().parseFromString(svgRaw, 'image/svg+xml');
  const element = parsed.querySelector(`[data-mcu-id="${elementId}"]`);
  if (!element) return svgRaw;

  const style = (element as SVGElement).style;
  const next = {
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 100,
    scaleY: 100,
    skewX: 0,
    skewY: 0,
    originX: 50,
    originY: 50,
    opacity: (baseAppearance?.opacity ?? 1) * 100,
    ...baseTransform,
    ...update,
  };
  if (
    update.x !== undefined ||
    update.y !== undefined ||
    update.rotation !== undefined ||
    update.scaleX !== undefined ||
    update.scaleY !== undefined ||
    update.skewX !== undefined ||
    update.skewY !== undefined
  ) {
    element.setAttribute(
      'transform',
      `translate(${next.x} ${next.y}) rotate(${next.rotation}) scale(${next.scaleX / 100} ${next.scaleY / 100}) skewX(${next.skewX}) skewY(${next.skewY})`
    );
  }
  style.setProperty('transform-origin', `${next.originX}% ${next.originY}%`);
  style.setProperty('transform-box', 'fill-box');
  style.setProperty('opacity', String(Math.max(0, Math.min(1, next.opacity / 100))));
  return new XMLSerializer().serializeToString(parsed.documentElement);
}

export const SvgMotionStudio: React.FC = () => {
  // Master Project State
  const [project, setProject] = useState<ProjectState>({
    version: '1.0',
    name: 'Untitled Project',
    document: {
      width: 800,
      height: 650,
      viewBox: { x: 0, y: 0, width: 800, height: 650 },
      backgroundColor: 'transparent',
      fps: DEFAULT_FPS,
      duration: DEFAULT_DURATION,
      loop: true,
      name: 'Untitled Project',
    },
    svgRaw: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 650" width="800" height="650"></svg>',
    elements: [],
    tracks: [],
    characterSlots: {},
    isSingleFlattenedPath: false,
    selectedElementId: null,
    selectedKeyframeId: null,
    currentTime: 0,
    isPlaying: false,
  });
  const playbackTimeRef = useRef(project.currentTime);
  const canvasPlaybackRendererRef = useRef<PlaybackRenderer | null>(null);
  const timelinePlaybackRendererRef = useRef<PlaybackRenderer | null>(null);
  const rasterSourceRef = useRef<RasterImageSource[]>([]);
  const keyboardActionsRef = useRef<{
    togglePlayback: () => void;
    deleteKeyframes: (ids: string[]) => void;
    deleteElement: (id: string) => Promise<void>;
    undo: () => void;
    redo: () => void;
    saveProject: () => void;
    duplicateKeyframe: (id: string) => void;
  } | null>(null);

  // Undo / Redo History Stack (stores snapshot of project state)
  const historyRef = useRef<ProjectState[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Viewport display controls
  const [showGrid, setShowGrid] = useState(true);
  const [showRulers, setShowRulers] = useState(true);
  const [showSafeArea, setShowSafeArea] = useState(false);
  const [canvasBg, setCanvasBg] = useState<'checkerboard' | string>('checkerboard');

  // Modal dialog states
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isVeoVideoModalOpen, setIsVeoVideoModalOpen] = useState(false);

  // Responsive sidebar collapse
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);
  const [autoKeyframe, setAutoKeyframe] = useState(false);
  const [isRegionCutMode, setIsRegionCutMode] = useState(false);

  useEffect(() => {
    const updateSidebarLayout = () => {
      const isMobile = window.matchMedia('(max-width: 767px)').matches;
      setIsLeftCollapsed(isMobile);
      setIsRightCollapsed(isMobile);
    };
    updateSidebarLayout();
    window.addEventListener('resize', updateSidebarLayout);
    return () => window.removeEventListener('resize', updateSidebarLayout);
  }, []);

  // Toast Notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (title: string, description?: string, type: ToastMessage['type'] = 'info') => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, title, description, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const fitToScreenCallbackRef = useRef<(() => void) | null>(null);
  const handleRegisterFitToScreen = useCallback((cb: () => void) => {
    fitToScreenCallbackRef.current = cb;
  }, []);
  const handleRegisterCanvasPlaybackRenderer = useCallback((renderer: PlaybackRenderer | null) => {
    canvasPlaybackRendererRef.current = renderer;
  }, []);
  const handleRegisterTimelinePlaybackRenderer = useCallback((renderer: PlaybackRenderer | null) => {
    timelinePlaybackRendererRef.current = renderer;
  }, []);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const studioContainerRef = useRef<HTMLDivElement>(null);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (studioContainerRef.current) {
        studioContainerRef.current.requestFullscreen().then(() => {
          setIsFullscreen(true);
        }).catch(() => {
          setIsFullscreen((prev) => !prev);
        });
      } else {
        setIsFullscreen((prev) => !prev);
      }
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(() => {
        setIsFullscreen(false);
      });
    }
  };

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Push state to undo history
  const pushHistory = useCallback((newState: ProjectState) => {
    const history = historyRef.current.slice(0, historyIndexRef.current + 1);
    history.push({
      ...newState,
      isPlaying: false, // do not record playback playhead state in history
    });
    if (history.length > 50) history.shift();
    historyRef.current = history;
    historyIndexRef.current = history.length - 1;
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(false);
  }, []);

  // Undo / Redo handlers
  const handleUndo = () => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      const prevState = historyRef.current[historyIndexRef.current];
      setProject((curr) => ({
        ...prevState,
        currentTime: curr.currentTime,
        isPlaying: false,
      }));
      setCanUndo(historyIndexRef.current > 0);
      setCanRedo(true);
      addToast('Undo', 'Reverted last change', 'info');
    }
  };

  const handleRedo = () => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++;
      const nextState = historyRef.current[historyIndexRef.current];
      setProject((curr) => ({
        ...nextState,
        currentTime: curr.currentTime,
        isPlaying: false,
      }));
      setCanUndo(true);
      setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
      addToast('Redo', 'Restored next change', 'info');
    }
  };

  // Keep playback time outside React state so playback does not rerender the whole editor.
  useEffect(() => {
    if (!project.isPlaying) playbackTimeRef.current = project.currentTime;
  }, [project.currentTime, project.isPlaying]);

  useEffect(() => {
    rasterSourceRef.current = project.rasterSources ?? [];
  }, [project.rasterSources]);

  // 2. Playback animation loop
  useEffect(() => {
    let animId: number;
    let lastUpdateTime = performance.now();
    const frameInterval = 1000 / Math.max(1, Math.min(project.document.fps, 60));
    const duration = project.document.duration;
    const shouldLoop = project.document.loop;

    const loop = (now: number) => {
      const elapsed = now - lastUpdateTime;

      if (elapsed >= frameInterval) {
        lastUpdateTime = now;
        let nextTime = playbackTimeRef.current + elapsed / 1000;

        if (duration <= 0) {
          nextTime = 0;
        } else if (nextTime >= duration) {
          if (shouldLoop) nextTime = nextTime % duration;
          else nextTime = duration;
        }

        playbackTimeRef.current = clampTimelineTime(nextTime, duration);
        canvasPlaybackRendererRef.current?.(playbackTimeRef.current);
        timelinePlaybackRendererRef.current?.(playbackTimeRef.current);

        if (!shouldLoop && playbackTimeRef.current >= duration) {
          setProject((prev) => ({ ...prev, currentTime: duration, isPlaying: false }));
          return;
        }
      }

      animId = requestAnimationFrame(loop);
    };

    if (project.isPlaying) {
      lastUpdateTime = performance.now();
      animId = requestAnimationFrame(loop);
    }

    return () => cancelAnimationFrame(animId);
  }, [project.isPlaying, project.document.fps, project.document.duration, project.document.loop]);

  const handleTogglePlayback = () => {
    if (project.isPlaying) {
      const currentTime = playbackTimeRef.current;
      setProject((prev) => ({ ...prev, currentTime, isPlaying: false }));
      return;
    }

    playbackTimeRef.current = project.currentTime;
    setProject((prev) => ({ ...prev, isPlaying: true }));
  };

  const handleRewind = () => {
    const nextTime = 0;
    playbackTimeRef.current = nextTime;
    setProject((prev) => ({ ...prev, currentTime: nextTime }));
    canvasPlaybackRendererRef.current?.(nextTime);
    timelinePlaybackRendererRef.current?.(nextTime);
  };

  const handleSeek = (time: number) => {
    const nextTime = clampTimelineTime(time, project.document.duration);
    playbackTimeRef.current = nextTime;
    setProject((prev) => ({ ...prev, currentTime: nextTime }));
    canvasPlaybackRendererRef.current?.(nextTime);
    timelinePlaybackRendererRef.current?.(nextTime);
  };

  // 3. User SVG Upload Handler
  const handleOpenSvgFile = async (file: File) => {
    try {
      if (file.type === 'image/png' || file.type === 'image/jpeg' || file.type === 'image/webp') {
        if (file.size > MAX_RASTER_UPLOAD_BYTES) {
          addToast('Image is too large', 'Please use an image smaller than 20 MB.', 'error');
          return;
        }
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error('The image file could not be read.'));
          reader.onload = () => {
            if (typeof reader.result === 'string') resolve(reader.result);
            else reject(new Error('The image file did not produce a readable data URL.'));
          };
          reader.readAsDataURL(file);
        });
        const image = new Image();
        image.src = dataUrl;
        await image.decode();
        if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 50_000_000) {
          addToast('Unsupported image dimensions', 'Use an image with fewer than 50 megapixels.', 'error');
          return;
        }

        const isFirstImage = project.elements.length === 0;
        const svgDocument = isFirstImage
          ? new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg"></svg>', 'image/svg+xml')
          : new DOMParser().parseFromString(project.svgRaw, 'image/svg+xml');
        const svgRoot = svgDocument.documentElement;
        if (svgRoot.tagName.toLowerCase() !== 'svg' || svgDocument.querySelector('parsererror')) {
          throw new Error('The current project does not contain a valid SVG composition.');
        }
        const composition = isFirstImage
          ? { x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight }
          : project.document.viewBox;
        if (isFirstImage) {
          svgRoot.setAttribute('viewBox', `0 0 ${image.naturalWidth} ${image.naturalHeight}`);
          svgRoot.setAttribute('width', String(image.naturalWidth));
          svgRoot.setAttribute('height', String(image.naturalHeight));
        }
        const fitScale = Math.min(
          composition.width * (isFirstImage ? 1 : 0.62) / image.naturalWidth,
          composition.height * (isFirstImage ? 1 : 0.62) / image.naturalHeight
        );
        const displayWidth = isFirstImage ? composition.width : image.naturalWidth * fitScale;
        const displayHeight = isFirstImage ? composition.height : image.naturalHeight * fitScale;
        const imageLayerCount = rasterSourceRef.current.length;
        const offsetX = isFirstImage ? 0 : ((imageLayerCount % 3) - 1) * composition.width * 0.12;
        const offsetY = isFirstImage ? 0 : Math.floor(imageLayerCount / 3) * composition.height * 0.08;
        const x = Math.max(
          composition.x,
          Math.min(composition.x + composition.width - displayWidth, composition.x + (composition.width - displayWidth) / 2 + offsetX)
        );
        const y = Math.max(
          composition.y,
          Math.min(composition.y + composition.height - displayHeight, composition.y + (composition.height - displayHeight) / 2 + offsetY)
        );
        const sourceElementOriginalId = `mcu-original-image-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const imageLayer = svgDocument.createElementNS('http://www.w3.org/2000/svg', 'image');
        imageLayer.setAttribute('id', sourceElementOriginalId);
        const cleanName = file.name.replace(/\.[^/.]+$/, '').slice(0, 80) || 'Image';
        imageLayer.setAttribute('data-name', cleanName);
        imageLayer.setAttribute('x', String(x));
        imageLayer.setAttribute('y', String(y));
        imageLayer.setAttribute('width', String(displayWidth));
        imageLayer.setAttribute('height', String(displayHeight));
        imageLayer.setAttribute('preserveAspectRatio', 'none');
        imageLayer.setAttribute('href', dataUrl);
        svgRoot.appendChild(imageLayer);

        const parsedImage = sanitizeAndParseSvg(new XMLSerializer().serializeToString(svgRoot));
        if (!parsedImage.success) {
          addToast('Image import failed', parsedImage.error || 'The image could not be prepared as an animation layer.', 'error');
          return;
        }
        const newNode = flattenElementTree(parsedImage.elements).find(
          (node) => node.originalId === sourceElementOriginalId
        );
        if (!newNode) throw new Error('The imported image layer could not be found after parsing.');
        const imageProject: ProjectState = {
          ...project,
          rasterSources: [...rasterSourceRef.current, {
            dataUrl,
            width: image.naturalWidth,
            height: image.naturalHeight,
            name: cleanName,
            elementOriginalId: sourceElementOriginalId,
            x,
            y,
            displayWidth,
            displayHeight,
          }],
          name: isFirstImage ? cleanName : project.name,
          document: isFirstImage ? {
            width: image.naturalWidth,
            height: image.naturalHeight,
            viewBox: parsedImage.viewBox,
            backgroundColor: 'transparent',
            fps: project.document.fps,
            duration: project.document.duration,
            loop: project.document.loop,
            name: cleanName,
          } : project.document,
          svgRaw: parsedImage.cleanSvg,
          elements: parsedImage.elements,
          isSingleFlattenedPath: false,
          selectedElementId: newNode.id,
          selectedKeyframeId: null,
          isPlaying: false,
        };
        rasterSourceRef.current = imageProject.rasterSources ?? [];
        setIsRegionCutMode(false);
        setProject(imageProject);
        pushHistory(imageProject);
        addToast(
          isFirstImage ? 'Image imported' : 'Image added to composition',
          isFirstImage
            ? 'Use Cut Region to create separate image layers for animation.'
            : `${cleanName} was added as a new layer without replacing existing artwork.`,
          'success'
        );
        if (isFirstImage) setTimeout(() => fitToScreenCallbackRef.current?.(), 150);
        return;
      }

      if (file.type && file.type !== 'image/svg+xml' && !file.name.toLowerCase().endsWith('.svg')) {
        addToast('Unsupported file', 'Choose an SVG, PNG, JPEG, or WebP image.', 'error');
        return;
      }

      const text = await file.text();
      const parsed = sanitizeAndParseSvg(text);

      if (!parsed.success) {
        addToast('Invalid SVG', parsed.error || 'Could not parse SVG file', 'error');
        return;
      }

      const cleanName = file.name.replace(/\.[^/.]+$/, '');
      rasterSourceRef.current = [];
      setIsRegionCutMode(false);

      const newProject: ProjectState = {
        version: '1.0',
        name: cleanName,
        document: {
          width: parsed.width,
          height: parsed.height,
          viewBox: parsed.viewBox,
          backgroundColor: 'transparent',
          fps: project.document.fps,
          duration: project.document.duration,
          loop: project.document.loop,
          name: cleanName,
        },
        svgRaw: parsed.cleanSvg,
        rasterSources: [],
        elements: parsed.elements,
        tracks: [],
        characterSlots: {},
        isSingleFlattenedPath: parsed.isSingleFlattenedPath,
        selectedElementId: parsed.elements[0]?.id || null,
        selectedKeyframeId: null,
        currentTime: 0,
        isPlaying: false,
      };

      playbackTimeRef.current = 0;
      setProject(newProject);
      pushHistory(newProject);

      if (parsed.isSingleFlattenedPath) {
        addToast(
          'Single Vector Object',
          'Artwork contains 1 flattened path. Animate position/scale or use stroke drawing.',
          'warning'
        );
      } else {
        addToast(
          'SVG Loaded',
          `Parsed ${parsed.totalShapes} elements and created layers hierarchy`,
          'success'
        );
      }

      setTimeout(() => {
        if (fitToScreenCallbackRef.current) fitToScreenCallbackRef.current();
      }, 150);
    } catch (err: any) {
      addToast('Upload Failed', err?.message || 'Error reading SVG', 'error');
    }
  };

  const handleCreateImageRegion = async (region: BoundingBox) => {
    const selectedElement = project.selectedElementId
      ? findElementById(project.elements, project.selectedElementId)
      : null;
    const source = rasterSourceRef.current.find(
      (item) => item.elementOriginalId === selectedElement?.originalId
    );
    if (!source) {
      setIsRegionCutMode(false);
      addToast('Select an image layer', 'Select an imported image layer before using Cut Region.', 'warning');
      return;
    }

    try {
      const imageRight = source.x + source.displayWidth;
      const imageBottom = source.y + source.displayHeight;
      const cutLeft = Math.max(region.x, source.x);
      const cutTop = Math.max(region.y, source.y);
      const cutRight = Math.min(region.x + region.width, imageRight);
      const cutBottom = Math.min(region.y + region.height, imageBottom);
      const scaleX = source.width / source.displayWidth;
      const scaleY = source.height / source.displayHeight;
      const sourceX = Math.max(0, Math.floor((cutLeft - source.x) * scaleX));
      const sourceY = Math.max(0, Math.floor((cutTop - source.y) * scaleY));
      const sourceRight = Math.min(source.width, Math.ceil((cutRight - source.x) * scaleX));
      const sourceBottom = Math.min(source.height, Math.ceil((cutBottom - source.y) * scaleY));
      const cropWidth = sourceRight - sourceX;
      const cropHeight = sourceBottom - sourceY;
      if (cropWidth < 2 || cropHeight < 2) {
        addToast('Region is too small', 'Drag a larger rectangle over the image.', 'warning');
        return;
      }

      const image = new Image();
      image.src = source.dataUrl;
      await image.decode();
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = cropWidth;
      cropCanvas.height = cropHeight;
      const context = cropCanvas.getContext('2d');
      if (!context) throw new Error('Your browser could not create an image crop.');
      context.drawImage(image, sourceX, sourceY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
      const croppedDataUrl = cropCanvas.toDataURL('image/png');

      const svgDocument = new DOMParser().parseFromString(project.svgRaw, 'image/svg+xml');
      const svgRoot = svgDocument.documentElement;
      if (svgRoot.tagName.toLowerCase() !== 'svg' || svgDocument.querySelector('parsererror')) {
        throw new Error('The current project does not contain a valid SVG canvas.');
      }
      const existingCutouts = flattenElementTree(project.elements).filter((node) =>
        node.originalId.startsWith('mcu-region-')
        && node.attributes?.['data-source-image-id'] === source.elementOriginalId
      );
      const residualCanvas = document.createElement('canvas');
      residualCanvas.width = source.width;
      residualCanvas.height = source.height;
      const residualContext = residualCanvas.getContext('2d');
      if (!residualContext) throw new Error('Your browser could not prepare the remaining image layer.');
      residualContext.drawImage(image, 0, 0);
      [...existingCutouts.map((node) => node.attributes || {}), {
        x: String(source.x + sourceX / scaleX),
        y: String(source.y + sourceY / scaleY),
        width: String(cropWidth / scaleX),
        height: String(cropHeight / scaleY),
      }].forEach((attributes) => {
        const x = (Number(attributes.x) - source.x) * scaleX;
        const y = (Number(attributes.y) - source.y) * scaleY;
        const width = Number(attributes.width) * scaleX;
        const height = Number(attributes.height) * scaleY;
        if ([x, y, width, height].every(Number.isFinite)) {
          residualContext.clearRect(x, y, width, height);
        }
      });
      const originalImageLayer = Array.from(svgRoot.querySelectorAll<SVGImageElement>('image')).find(
        (node) => node.getAttribute('id') === source.elementOriginalId
      );
      if (!originalImageLayer) throw new Error('The original image layer could not be found.');
      originalImageLayer.setAttribute('href', residualCanvas.toDataURL('image/png'));

      const existingRegions = existingCutouts.length;
      const originalId = `mcu-region-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const imageLayer = svgDocument.createElementNS('http://www.w3.org/2000/svg', 'image');
      imageLayer.setAttribute('id', originalId);
      imageLayer.setAttribute('data-source-image-id', source.elementOriginalId);
      imageLayer.setAttribute('data-name', `Cutout ${existingRegions + 1}`);
      imageLayer.setAttribute('x', String(source.x + sourceX / scaleX));
      imageLayer.setAttribute('y', String(source.y + sourceY / scaleY));
      imageLayer.setAttribute('width', String(cropWidth / scaleX));
      imageLayer.setAttribute('height', String(cropHeight / scaleY));
      imageLayer.setAttribute('preserveAspectRatio', 'none');
      imageLayer.setAttribute('href', croppedDataUrl);
      svgRoot.appendChild(imageLayer);

      const parsed = sanitizeAndParseSvg(new XMLSerializer().serializeToString(svgRoot));
      if (!parsed.success) throw new Error(parsed.error || 'The cropped image layer could not be added.');
      const newNode = flattenElementTree(parsed.elements).find((node) => node.originalId === originalId);
      if (!newNode) throw new Error('The new image layer could not be found after parsing.');

      const nextProject: ProjectState = {
        ...project,
        svgRaw: parsed.cleanSvg,
        elements: parsed.elements,
        selectedElementId: newNode.id,
        selectedKeyframeId: null,
        selectedKeyframeIds: [],
        isPlaying: false,
      };
      playbackTimeRef.current = project.currentTime;
      setProject(nextProject);
      pushHistory(nextProject);
      addToast('Image layer created', `${newNode.name} is ready for independent animation.`, 'success');
    } catch (error) {
      addToast(
        'Could not create image layer',
        error instanceof Error ? error.message : 'The selected image region could not be cropped.',
        'error'
      );
    }
  };

  // 4. Project File Save & Load (.mcuproj)
  const handleSaveProject = () => {
    const jsonStr = JSON.stringify(
      {
        version: '1.0',
        name: project.name,
        document: project.document,
        svgRaw: project.svgRaw,
        elements: project.elements,
        tracks: project.tracks,
        characterSlots: project.characterSlots,
        isSingleFlattenedPath: project.isSingleFlattenedPath,
        rasterSources: project.rasterSources ?? [],
        savedAt: new Date().toISOString(),
      },
      null,
      2
    );

    const filename = `${project.name.toLowerCase().replace(/[^a-z0-9_]/g, '_')}.mcuproj`;
    downloadText(jsonStr, filename, 'application/json');

    // Also persist to localStorage
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, jsonStr);
    } catch {}

    addToast('Project Saved', `Downloaded ${filename}`, 'success');
  };

  const handleLoadProjectFile = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.svgRaw || !data.document) {
        addToast('Invalid Project', 'Not a valid MCU project file', 'error');
        return;
      }

      const loadedProject: ProjectState = {
        version: data.version || '1.0',
        name: data.name || 'Imported Project',
        document: data.document,
        svgRaw: data.svgRaw,
        rasterSources: [],
        elements: data.elements || [],
        tracks: data.tracks || [],
        characterSlots: data.characterSlots || {},
        isSingleFlattenedPath: !!data.isSingleFlattenedPath,
        selectedElementId: data.elements?.[0]?.id || null,
        selectedKeyframeId: null,
        currentTime: 0,
        isPlaying: false,
      };

      const projectSvg = new DOMParser().parseFromString(loadedProject.svgRaw, 'image/svg+xml');
      const savedSources = Array.isArray(data.rasterSources)
        ? data.rasterSources.filter((source: RasterImageSource) =>
          source
          && typeof source.dataUrl === 'string'
          && /^data:image\/(?:png|jpeg|webp);base64,/i.test(source.dataUrl)
          && typeof source.elementOriginalId === 'string'
          && Number.isFinite(source.width)
          && Number.isFinite(source.height)
          && Number.isFinite(source.x)
          && Number.isFinite(source.y)
          && Number.isFinite(source.displayWidth)
          && Number.isFinite(source.displayHeight)
        )
        : [];
      if (savedSources.length) {
        loadedProject.rasterSources = savedSources;
      } else {
        const legacySource = Array.from(projectSvg.querySelectorAll<SVGImageElement>('image')).find(
          (image) => image.id.startsWith('mcu-original-image-')
        );
        const sourceHref = legacySource?.getAttribute('href') || legacySource?.getAttribute('xlink:href') || '';
        const sourceWidth = Number(legacySource?.getAttribute('width'));
        const sourceHeight = Number(legacySource?.getAttribute('height'));
        loadedProject.rasterSources = legacySource
          && /^data:image\/(?:png|jpeg|webp);base64,/i.test(sourceHref)
          && Number.isFinite(sourceWidth)
          && Number.isFinite(sourceHeight)
          && sourceWidth > 0
          && sourceHeight > 0
          ? [{
            dataUrl: sourceHref,
            width: sourceWidth,
            height: sourceHeight,
            name: loadedProject.name,
            elementOriginalId: legacySource.id,
            x: Number(legacySource.getAttribute('x')) || 0,
            y: Number(legacySource.getAttribute('y')) || 0,
            displayWidth: Number(legacySource.getAttribute('width')),
            displayHeight: Number(legacySource.getAttribute('height')),
          }]
          : [];
      }
      rasterSourceRef.current = loadedProject.rasterSources ?? [];
      playbackTimeRef.current = 0;
      setIsRegionCutMode(false);
      setProject(loadedProject);
      pushHistory(loadedProject);
      addToast('Project Opened', `Loaded project "${loadedProject.name}"`, 'success');

      setTimeout(() => {
        if (fitToScreenCallbackRef.current) fitToScreenCallbackRef.current();
      }, 150);
    } catch (err: any) {
      addToast('Failed to open project', err?.message || 'Error parsing project file', 'error');
    }
  };

  // 5. New Clean Project
  const handleNewProject = () => {
    if (confirm('Create a new blank project? Unsaved changes will be discarded.')) {
      const blankSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
        <rect id="sample-box" x="300" y="200" width="200" height="200" rx="16" fill="#6366f1" />
      </svg>`;
      const parsed = sanitizeAndParseSvg(blankSvg);

      const blankProj: ProjectState = {
        version: '1.0',
        name: 'Untitled Project',
        document: {
          width: 800,
          height: 600,
          viewBox: { x: 0, y: 0, width: 800, height: 600 },
          backgroundColor: 'transparent',
          fps: 30,
          duration: 4.0,
          loop: true,
          name: 'Untitled Project',
        },
        svgRaw: parsed.cleanSvg,
        rasterSources: [],
        elements: parsed.elements,
        tracks: [],
        characterSlots: {},
        isSingleFlattenedPath: false,
        selectedElementId: parsed.elements[0]?.id || null,
        selectedKeyframeId: null,
        currentTime: 0,
        isPlaying: false,
      };

      playbackTimeRef.current = 0;
      rasterSourceRef.current = [];
      setIsRegionCutMode(false);
      setProject(blankProj);
      pushHistory(blankProj);
      addToast('New Project', 'Blank canvas created', 'info');
    }
  };

  const handleAddElement = (kind: SvgPrimitiveKind) => {
    try {
      const svgDocument = new DOMParser().parseFromString(project.svgRaw, 'image/svg+xml');
      const svgRoot = svgDocument.documentElement;
      if (svgRoot.tagName.toLowerCase() !== 'svg' || svgDocument.querySelector('parsererror')) {
        addToast('Could not add layer', 'The current project does not contain a valid SVG canvas.', 'error');
        return;
      }

      const { x, y, width, height } = project.document.viewBox;
      const canvasWidth = Math.max(1, Math.abs(width));
      const canvasHeight = Math.max(1, Math.abs(height));
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      const namespace = 'http://www.w3.org/2000/svg';
      const element = svgDocument.createElementNS(namespace, kind === 'triangle' ? 'polygon' : kind);
      const originalId = `mcu-${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const existingCount = flattenElementTree(project.elements).filter(
        (node) => node.originalId.startsWith(`mcu-${kind}-`)
      ).length;
      const displayName = `${kind === 'text' ? 'Text' : kind.charAt(0).toUpperCase() + kind.slice(1)} ${existingCount + 1}`;
      element.setAttribute('id', originalId);
      element.setAttribute('data-name', displayName);

      if (kind === 'text') {
        element.setAttribute('x', String(centerX));
        element.setAttribute('y', String(centerY));
        element.setAttribute('fill', '#f8fafc');
        element.setAttribute('font-size', String(Math.max(18, Math.round(canvasWidth * 0.08))));
        element.setAttribute('font-family', 'Inter, sans-serif');
        element.setAttribute('text-anchor', 'middle');
        element.setAttribute('dominant-baseline', 'middle');
        element.textContent = 'Your text';
      } else if (kind === 'rect') {
        const shapeWidth = Math.min(180, canvasWidth * 0.34);
        const shapeHeight = Math.min(120, canvasHeight * 0.28);
        element.setAttribute('x', String(centerX - shapeWidth / 2));
        element.setAttribute('y', String(centerY - shapeHeight / 2));
        element.setAttribute('width', String(shapeWidth));
        element.setAttribute('height', String(shapeHeight));
        element.setAttribute('rx', '14');
        element.setAttribute('fill', '#16c784');
      } else if (kind === 'circle') {
        element.setAttribute('cx', String(centerX));
        element.setAttribute('cy', String(centerY));
        element.setAttribute('r', String(Math.min(70, canvasWidth * 0.13, canvasHeight * 0.2)));
        element.setAttribute('fill', '#8b5cf6');
      } else if (kind === 'ellipse') {
        element.setAttribute('cx', String(centerX));
        element.setAttribute('cy', String(centerY));
        element.setAttribute('rx', String(Math.min(100, canvasWidth * 0.2)));
        element.setAttribute('ry', String(Math.min(60, canvasHeight * 0.15)));
        element.setAttribute('fill', '#06b6d4');
      } else {
        const radius = Math.min(82, canvasWidth * 0.16, canvasHeight * 0.22);
        element.setAttribute(
          'points',
          `${centerX},${centerY - radius} ${centerX + radius},${centerY + radius} ${centerX - radius},${centerY + radius}`
        );
        element.setAttribute('fill', '#f59e0b');
      }

      svgRoot.appendChild(element);
      const parsed = sanitizeAndParseSvg(new XMLSerializer().serializeToString(svgRoot));
      if (!parsed.success) {
        addToast('Could not add layer', parsed.error || 'The updated SVG could not be parsed.', 'error');
        return;
      }

      const newNode = flattenElementTree(parsed.elements).find((node) => node.originalId === originalId);
      if (!newNode) {
        addToast('Could not add layer', 'The new SVG layer was not found after parsing.', 'error');
        return;
      }

      const nextProject: ProjectState = {
        ...project,
        svgRaw: parsed.cleanSvg,
        elements: parsed.elements,
        isSingleFlattenedPath: parsed.isSingleFlattenedPath,
        selectedElementId: newNode.id,
        selectedKeyframeId: null,
        selectedKeyframeIds: [],
        isPlaying: false,
      };
      setProject(nextProject);
      pushHistory(nextProject);
      addToast('Layer added', `${displayName} is ready to animate.`, 'success');
    } catch (error) {
      addToast(
        'Could not add layer',
        error instanceof Error ? error.message : 'The SVG canvas could not be updated.',
        'error'
      );
    }
  };

  // 6. Element & Layer Manipulation
  const handleToggleVisibility = (elId: string) => {
    setProject((prev) => {
      const updateVisibility = (nodes: SvgElementNode[]): SvgElementNode[] =>
        nodes.map((n) => {
          if (n.id === elId) return { ...n, visible: !n.visible };
          if (n.children && n.children.length > 0)
            return { ...n, children: updateVisibility(n.children) };
          return n;
        });

      const next = { ...prev, elements: updateVisibility(prev.elements) };
      pushHistory(next);
      return next;
    });
  };

  const handleToggleLock = (elId: string) => {
    setProject((prev) => {
      const updateLock = (nodes: SvgElementNode[]): SvgElementNode[] =>
        nodes.map((n) => {
          if (n.id === elId) return { ...n, locked: !n.locked };
          if (n.children && n.children.length > 0)
            return { ...n, children: updateLock(n.children) };
          return n;
        });

      const next = { ...prev, elements: updateLock(prev.elements) };
      pushHistory(next);
      return next;
    });
  };

  const handleRenameElement = (elId: string, newName: string) => {
    setProject((prev) => {
      const updateName = (nodes: SvgElementNode[]): SvgElementNode[] =>
        nodes.map((n) => {
          if (n.id === elId) return { ...n, name: newName };
          if (n.children && n.children.length > 0)
            return { ...n, children: updateName(n.children) };
          return n;
        });

      const next = { ...prev, elements: updateName(prev.elements) };
      pushHistory(next);
      return next;
    });
  };

  const handleMoveElement = (elId: string, direction: 'up' | 'down') => {
    setProject((prev) => {
      const moveInList = (list: SvgElementNode[]): SvgElementNode[] => {
        const idx = list.findIndex((item) => item.id === elId);
        if (idx !== -1) {
          const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
          if (targetIdx >= 0 && targetIdx < list.length) {
            const copy = [...list];
            const [item] = copy.splice(idx, 1);
            copy.splice(targetIdx, 0, item);
            return copy;
          }
          return list;
        }
        return list.map((item) =>
          item.children ? { ...item, children: moveInList(item.children) } : item
        );
      };

      const next = { ...prev, elements: moveInList(prev.elements) };
      pushHistory(next);
      return next;
    });
  };

  const handleDeleteElement = async (elementId: string) => {
    const selectedNode = findElementById(project.elements, elementId);
    if (!selectedNode) return;
    if (selectedNode.locked) {
      addToast('Layer is locked', 'Unlock this layer before deleting it.', 'warning');
      return;
    }

    try {
      const deletedIds = new Set<string>();
      const deletedOriginalIds = new Set<string>();
      const collectDeleted = (node: SvgElementNode) => {
        deletedIds.add(node.id);
        if (node.originalId) deletedOriginalIds.add(node.originalId);
        node.children.forEach(collectDeleted);
      };
      collectDeleted(selectedNode);
      const deletedRasterSources = rasterSourceRef.current.filter(
        (source) => deletedOriginalIds.has(source.elementOriginalId)
      );
      if (deletedRasterSources.length) {
        flattenElementTree(project.elements)
          .filter((node) => deletedRasterSources.some(
            (source) => node.attributes?.['data-source-image-id'] === source.elementOriginalId
          ))
          .forEach((node) => {
            deletedIds.add(node.id);
            node.children.forEach(collectDeleted);
          });
      }

      const svgDocument = new DOMParser().parseFromString(project.svgRaw, 'image/svg+xml');
      const svgRoot = svgDocument.documentElement;
      if (svgRoot.tagName.toLowerCase() !== 'svg' || svgDocument.querySelector('parsererror')) {
        throw new Error('The current SVG composition could not be updated.');
      }
      Array.from(svgRoot.querySelectorAll<SVGElement>('[data-mcu-id]'))
        .filter((element) => deletedIds.has(element.getAttribute('data-mcu-id') || ''))
        .forEach((element) => element.remove());

      const deletedCutoutSources = new Set(
        flattenElementTree(project.elements)
          .filter((node) => deletedIds.has(node.id))
          .map((node) => node.attributes?.['data-source-image-id'])
          .filter((id): id is string => Boolean(id))
      );
      for (const sourceId of deletedCutoutSources) {
        if (deletedRasterSources.some((source) => source.elementOriginalId === sourceId)) continue;
        const source = rasterSourceRef.current.find((item) => item.elementOriginalId === sourceId);
        if (!source) continue;
        const image = new Image();
        image.src = source.dataUrl;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = source.width;
        canvas.height = source.height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Your browser could not restore the source image layer.');
        context.drawImage(image, 0, 0);
        const remainingCutouts = flattenElementTree(project.elements).filter(
          (node) => !deletedIds.has(node.id) && node.attributes?.['data-source-image-id'] === sourceId
        );
        const scaleX = source.width / source.displayWidth;
        const scaleY = source.height / source.displayHeight;
        remainingCutouts.forEach((node) => {
          const attributes = node.attributes || {};
          const x = (Number(attributes.x) - source.x) * scaleX;
          const y = (Number(attributes.y) - source.y) * scaleY;
          const width = Number(attributes.width) * scaleX;
          const height = Number(attributes.height) * scaleY;
          if ([x, y, width, height].every(Number.isFinite)) context.clearRect(x, y, width, height);
        });
        const originalImage = Array.from(svgRoot.querySelectorAll<SVGImageElement>('image')).find(
          (node) => node.id === sourceId
        );
        originalImage?.setAttribute('href', canvas.toDataURL('image/png'));
      }

      const removeFromTree = (nodes: SvgElementNode[]): SvgElementNode[] =>
        nodes
          .filter((node) => !deletedIds.has(node.id))
          .map((node) => ({ ...node, children: removeFromTree(node.children) }));
      const elements = removeFromTree(project.elements);
      const nextSelectedId = selectedNode.parentId && !deletedIds.has(selectedNode.parentId)
        ? selectedNode.parentId
        : flattenElementTree(elements)[0]?.id || null;
      const nextProject: ProjectState = {
        ...project,
        svgRaw: new XMLSerializer().serializeToString(svgRoot),
        rasterSources: deletedRasterSources.length
          ? rasterSourceRef.current.filter((source) => !deletedRasterSources.includes(source))
          : project.rasterSources,
        elements,
        tracks: project.tracks.filter((track) => !deletedIds.has(track.elementId)),
        selectedElementId: nextSelectedId,
        selectedKeyframeId: null,
        selectedKeyframeIds: [],
        isPlaying: false,
      };
      if (deletedRasterSources.length) {
        rasterSourceRef.current = rasterSourceRef.current.filter(
          (source) => !deletedRasterSources.includes(source)
        );
        setIsRegionCutMode(false);
      }
      setProject(nextProject);
      pushHistory(nextProject);
      addToast('Layer deleted', `${selectedNode.name} and its keyframes were removed.`, 'success');
    } catch (error) {
      addToast(
        'Could not delete layer',
        error instanceof Error ? error.message : 'The selected layer could not be deleted.',
        'error'
      );
    }
  };

  const handleSelectElement = useCallback((id: string | null) => {
    setProject((p) => {
      if (p.selectedElementId === id && p.selectedKeyframeId === null && (!p.selectedKeyframeIds || p.selectedKeyframeIds.length === 0)) {
        return p;
      }
      return {
        ...p,
        selectedElementId: id,
        selectedKeyframeId: null,
        selectedKeyframeIds: [],
      };
    });
  }, []);

  const handleUpdateElementFill = (elementId: string, fill: string) => {
    const svgDocument = new DOMParser().parseFromString(project.svgRaw, 'image/svg+xml');
    const element = Array.from(svgDocument.querySelectorAll<SVGElement>('[data-mcu-id]')).find(
      (node) => node.getAttribute('data-mcu-id') === elementId
    );
    if (!element) {
      addToast('Color not updated', 'The selected SVG layer could not be found.', 'error');
      return;
    }

    element.style.removeProperty('fill');
    element.setAttribute('fill', fill);
    const updateFill = (nodes: SvgElementNode[]): SvgElementNode[] =>
      nodes.map((node) => {
        if (node.id === elementId) {
          return { ...node, initialAppearance: { ...node.initialAppearance, fill } };
        }
        return node.children.length ? { ...node, children: updateFill(node.children) } : node;
      });
    setProject({
      ...project,
      svgRaw: new XMLSerializer().serializeToString(svgDocument.documentElement),
      elements: updateFill(project.elements),
    });
  };

  const handleUpdateElementText = (elementId: string, text: string) => {
    const svgDocument = new DOMParser().parseFromString(project.svgRaw, 'image/svg+xml');
    const element = Array.from(svgDocument.querySelectorAll<SVGElement>('[data-mcu-id]')).find(
      (node) => node.getAttribute('data-mcu-id') === elementId
    );
    if (!element || element.tagName.toLowerCase() !== 'text' || element.children.length > 0) {
      addToast('Text not updated', 'Only simple text layers can be edited here.', 'warning');
      return;
    }

    element.textContent = text;
    const updateText = (nodes: SvgElementNode[]): SvgElementNode[] =>
      nodes.map((node) => {
        if (node.id === elementId) return { ...node, textContent: text };
        return node.children.length ? { ...node, children: updateText(node.children) } : node;
      });
    setProject({
      ...project,
      svgRaw: new XMLSerializer().serializeToString(svgDocument.documentElement),
      elements: updateText(project.elements),
    });
  };

  // 7. Transform Property Updates (Position, Rotation, Scale, Origin, etc.)
  const handleUpdateTransform = useCallback((elementId: string, transform: TransformUpdate) => {
    setProject((prev) => {
      const updatedTracks = [...prev.tracks];
      let recordedKeyframe = false;

      // Helper to add or update keyframe on track
      const applyProp = (prop: AnimProperty, val: number | undefined) => {
        if (val === undefined) return;

        const trackIndex = updatedTracks.findIndex((t) => t.elementId === elementId && t.property === prop);
        const track = trackIndex >= 0
          ? updatedTracks[trackIndex]
          : {
            id: `trk_${Date.now()}_${prop}`,
            elementId,
            property: prop,
            keyframes: [],
          };
        const keyframes = [...track.keyframes];

        // Check if keyframe already exists near playhead
        const existingKfIndex = keyframes.findIndex((k) => Math.abs(k.time - prev.currentTime) < 0.05);
        if (!autoKeyframe && existingKfIndex < 0) {
          return;
        }

        if (existingKfIndex >= 0) {
          keyframes[existingKfIndex] = {
            ...keyframes[existingKfIndex],
            value: val,
          };
        } else {
          keyframes.push({
            id: `kf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            time: prev.currentTime,
            value: val,
            easing: 'easeInOut',
          });
          keyframes.sort((a, b) => a.time - b.time);
        }

        const updatedTrack = { ...track, keyframes };
        if (trackIndex >= 0) updatedTracks[trackIndex] = updatedTrack;
        else updatedTracks.push(updatedTrack);
        recordedKeyframe = true;
      };

      applyProp('x', transform.x);
      applyProp('y', transform.y);
      applyProp('rotation', transform.rotation);
      applyProp('scaleX', transform.scaleX);
      applyProp('scaleY', transform.scaleY);
      applyProp('skewX', transform.skewX);
      applyProp('skewY', transform.skewY);
      applyProp('opacity', transform.opacity);
      applyProp('originX', transform.originX);
      applyProp('originY', transform.originY);

      if (autoKeyframe || recordedKeyframe) {
        return { ...prev, tracks: updatedTracks };
      }

      const element = findElementById(prev.elements, elementId);
      if (!element) return prev;
      return {
        ...prev,
        svgRaw: updateSvgBaseTransform(
          prev.svgRaw,
          elementId,
          element.initialTransform,
          element.initialAppearance,
          transform
        ),
        elements: updateElementTreeBaseStyle(prev.elements, elementId, transform),
      };
    });
  }, [autoKeyframe]);

  const handleUpdateTransformProperty = (
    elementId: string,
    property: AnimProperty,
    value: number | string
  ) => {
    handleUpdateTransform(elementId, { [property]: value });
  };

  const handleRecordAllTransforms = (elementId: string) => {
    setProject((prev) => {
      const element = findElementById(prev.elements, elementId);
      if (!element) return prev;

      const styles = computeElementStylesAtTime(
        prev.tracks,
        elementId,
        prev.currentTime,
        element.initialTransform,
        element.initialAppearance
      );
      const next = {
        ...prev,
        tracks: recordAllTransformKeyframes(
          prev.tracks,
          elementId,
          styles,
          prev.currentTime
        ),
      };
      pushHistory(next);
      return next;
    });
  };

  const handleApplyEasingToTransforms = (elementId: string, easing: EasingType) => {
    setProject((prev) => {
      const next = {
        ...prev,
        tracks: applyEasingToElementTransforms(prev.tracks, elementId, easing),
      };
      pushHistory(next);
      return next;
    });
  };

  // 8. Keyframe operations (Add, Delete, Move, Duplicate, Easing)
  const handleToggleKeyframe = (elementId: string, property: AnimProperty) => {
    setProject((prev) => {
      const updatedTracks = [...prev.tracks];
      const trackIndex = updatedTracks.findIndex(
        (t) => t.elementId === elementId && t.property === property
      );
      const track = trackIndex >= 0
        ? updatedTracks[trackIndex]
        : {
          id: `trk_${Date.now()}_${property}`,
          elementId,
          property,
          keyframes: [],
        };
      const keyframes = [...track.keyframes];

      const existingIndex = keyframes.findIndex(
        (k) => Math.abs(k.time - prev.currentTime) < 0.05
      );

      if (existingIndex >= 0) {
        keyframes.splice(existingIndex, 1);
        addToast('Keyframe removed', `Removed ${property} keyframe`, 'info');
      } else {
        const node = findElementById(prev.elements, elementId);
        const styles = node
          ? computeElementStylesAtTime(
              prev.tracks,
              elementId,
              prev.currentTime,
              node.initialTransform,
              node.initialAppearance
            )
          : null;
        const currentVal = styles?.[property as keyof typeof styles];
        if (currentVal === undefined) return prev;

        keyframes.push({
          id: `kf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          time: prev.currentTime,
          value: currentVal,
          easing: 'easeInOut',
        });
        keyframes.sort((a, b) => a.time - b.time);
        addToast('Keyframe added', `Added ${property} keyframe at ${prev.currentTime.toFixed(2)}s`, 'success');
      }

      if (keyframes.length === 0) {
        if (trackIndex >= 0) updatedTracks.splice(trackIndex, 1);
      } else {
        const updatedTrack = { ...track, keyframes };
        if (trackIndex >= 0) updatedTracks[trackIndex] = updatedTrack;
        else updatedTracks.push(updatedTrack);
      }

      const next = { ...prev, tracks: updatedTracks };
      pushHistory(next);
      return next;
    });
  };

  const handleMoveKeyframe = (keyframeId: string, newTime: number) => {
    setProject((prev) => {
      const safeTime = clampTimelineTime(newTime, prev.document.duration);
      const updatedTracks = prev.tracks.map((track) => ({
        ...track,
        keyframes: track.keyframes.map((kf) =>
          kf.id === keyframeId ? { ...kf, time: safeTime } : kf
        ),
      }));
      return { ...prev, tracks: updatedTracks };
    });
  };

  const handleDeleteKeyframes = (keyframeIds: string[]) => {
    if (keyframeIds.length === 0) return;
    const ids = new Set(keyframeIds);
    setProject((prev) => {
      const updatedTracks = prev.tracks.map((track) => ({
        ...track,
        keyframes: track.keyframes.filter((kf) => !ids.has(kf.id)),
      }));
      const next = {
        ...prev,
        tracks: updatedTracks,
        selectedKeyframeId: null,
        selectedKeyframeIds: [],
      };
      pushHistory(next);
      addToast(keyframeIds.length === 1 ? 'Keyframe Deleted' : 'Keyframes Deleted', '', 'info');
      return next;
    });
  };

  const handleDeleteKeyframe = (keyframeId: string) => handleDeleteKeyframes([keyframeId]);

  const handleDuplicateKeyframe = (keyframeId: string) => {
    setProject((prev) => {
      let duplicated = false;
      const updatedTracks = prev.tracks.map((track) => {
        const match = track.keyframes.find((k) => k.id === keyframeId);
        if (match && !duplicated) {
          duplicated = true;
          const newKf: Keyframe = {
            ...match,
            id: `kf_${Date.now()}_dup`,
            time: Math.min(prev.document.duration, match.time + 0.5),
          };
          return {
            ...track,
            keyframes: [...track.keyframes, newKf].sort((a, b) => a.time - b.time),
          };
        }
        return track;
      });

      const next = { ...prev, tracks: updatedTracks };
      pushHistory(next);
      addToast('Keyframe Duplicated', '', 'success');
      return next;
    });
  };

  const handleNudgeSelectedKeyframes = (direction: 'left' | 'right', shiftKey = false) => {
    setProject((prev) => {
      const selectedIds = prev.selectedKeyframeIds && prev.selectedKeyframeIds.length > 0
        ? prev.selectedKeyframeIds
        : prev.selectedKeyframeId
          ? [prev.selectedKeyframeId]
          : [];
      if (selectedIds.length === 0) return prev;

      const frameStep = 1 / Math.max(1, prev.document.fps);
      const step = shiftKey ? frameStep * 5 : frameStep;
      const tracks = prev.tracks.map((track) => ({
        ...track,
        keyframes: track.keyframes.map((kf) => {
          if (!selectedIds.includes(kf.id)) return kf;
          const delta = direction === 'left' ? -step : step;
          return { ...kf, time: clampTimelineTime(kf.time + delta, prev.document.duration) };
        }),
      }));

      const next = { ...prev, tracks };
      pushHistory(next);
      return next;
    });
  };

  const handleUpdateKeyframeEasing = (keyframeId: string, easing: EasingType) => {
    setProject((prev) => {
      const updatedTracks = prev.tracks.map((track) => ({
        ...track,
        keyframes: track.keyframes.map((kf) =>
          kf.id === keyframeId ? { ...kf, easing } : kf
        ),
      }));
      const next = { ...prev, tracks: updatedTracks };
      pushHistory(next);
      return next;
    });
  };

  // 9. Presets Application
  const handleApplyPreset = (elementId: string, presetId: string) => {
    const preset = ANIMATION_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    const node = findElementById(project.elements, elementId);
    const newTracks = preset.createTracks(
      elementId,
      project.document.duration,
      project.currentTime,
      node?.pathLength
    );

    setProject((prev) => {
      // Merge new tracks with existing
      const existingProps = new Set(newTracks.map((t) => `${t.elementId}_${t.property}`));
      const filtered = prev.tracks.filter((t) => !existingProps.has(`${t.elementId}_${t.property}`));
      const next = { ...prev, tracks: [...filtered, ...newTracks] };
      pushHistory(next);
      return next;
    });

    addToast('Preset Applied', `Added "${preset.name}" animation keyframes`, 'success');
  };

  // 10. AI Assistant Plan Application
  const handleApplyAiPlan = (plan: AiAnimationPlan) => {
    playbackTimeRef.current = 0;
    setProject((prev) => {
      const existingProps = new Set(plan.tracks.map((t) => `${t.elementId}_${t.property}`));
      const baseTracks = prev.aiAnimationBaseTracks ?? prev.tracks;
      const filtered = baseTracks.filter((t) => !existingProps.has(`${t.elementId}_${t.property}`));
      const next: ProjectState = {
        ...prev,
        document: {
          ...prev.document,
          duration: plan.duration,
          fps: plan.fps,
          loop: plan.loop,
        },
        tracks: [...filtered, ...plan.tracks],
        aiAnimationBaseTracks: baseTracks,
        aiAnimationBaseDocument: prev.aiAnimationBaseDocument ?? prev.document,
        currentTime: 0,
        isPlaying: false,
      };
      pushHistory(next);
      return next;
    });

    addToast('AI Motion Applied', 'Editable keyframes were added to the timeline', 'success');
  };

  const handleResetAiAnimation = () => {
    setProject((prev) => {
      if (!prev.aiAnimationBaseTracks) return prev;
      const next: ProjectState = {
        ...prev,
        document: prev.aiAnimationBaseDocument ?? prev.document,
        tracks: prev.aiAnimationBaseTracks,
        aiAnimationBaseTracks: null,
        aiAnimationBaseDocument: null,
        currentTime: 0,
        isPlaying: false,
      };
      pushHistory(next);
      return next;
    });
    playbackTimeRef.current = 0;
    addToast('AI Animation Reset', 'Restored the timeline state from before AI animation', 'info');
  };

  // 12. Keyboard Shortcuts Listener
  useEffect(() => {
    keyboardActionsRef.current = {
      togglePlayback: handleTogglePlayback,
      deleteKeyframes: handleDeleteKeyframes,
      deleteElement: handleDeleteElement,
      undo: handleUndo,
      redo: handleRedo,
      saveProject: handleSaveProject,
      duplicateKeyframe: handleDuplicateKeyframe,
    };
  });
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is inside a form input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      // Space = Play / Pause
      if (e.code === 'Space') {
        e.preventDefault();
        keyboardActionsRef.current?.togglePlayback();
      }

      // Delete / Backspace = Delete keyframe
      if (e.code === 'Delete' || e.code === 'Backspace') {
        const selectedIds = project.selectedKeyframeIds?.length
          ? project.selectedKeyframeIds
          : project.selectedKeyframeId ? [project.selectedKeyframeId] : [];
        if (selectedIds.length > 0) {
          e.preventDefault();
          keyboardActionsRef.current?.deleteKeyframes(selectedIds);
        } else if (project.selectedElementId) {
          e.preventDefault();
          void keyboardActionsRef.current?.deleteElement(project.selectedElementId);
        }
      }

      // Ctrl / Cmd + Z = Undo
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && !e.shiftKey) {
        e.preventDefault();
        keyboardActionsRef.current?.undo();
      }

      // Ctrl / Cmd + Shift + Z or Ctrl + Y = Redo
      if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyZ') ||
        ((e.ctrlKey || e.metaKey) && e.code === 'KeyY')
      ) {
        e.preventDefault();
        keyboardActionsRef.current?.redo();
      }

      // Ctrl / Cmd + S = Save Project
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
        e.preventDefault();
        keyboardActionsRef.current?.saveProject();
      }

      // Ctrl / Cmd + D = Duplicate Keyframe
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyD') {
        if (project.selectedKeyframeId) {
          e.preventDefault();
          keyboardActionsRef.current?.duplicateKeyframe(project.selectedKeyframeId);
        }
      }

      // Arrow keys = nudge selected keyframe(s) left/right by one frame
      if ((e.code === 'ArrowLeft' || e.code === 'ArrowRight') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const selectedIds = project.selectedKeyframeIds?.length
          ? project.selectedKeyframeIds
          : project.selectedKeyframeId ? [project.selectedKeyframeId] : [];
        if (selectedIds.length > 0) {
          e.preventDefault();
          handleNudgeSelectedKeyframes(e.code === 'ArrowLeft' ? 'left' : 'right', e.shiftKey);
        }
      }

      // ? = Shortcuts Modal
      if (e.key === '?') {
        setIsShortcutsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    project.selectedElementId,
    project.selectedKeyframeId,
    project.selectedKeyframeIds,
  ]);

  const selectedLayer = project.selectedElementId
    ? findElementById(project.elements, project.selectedElementId)
    : null;
  const canCutSelectedImage = Boolean(
    selectedLayer
    && rasterSourceRef.current.some((source) => source.elementOriginalId === selectedLayer.originalId)
  );

  return (
    <div
      ref={studioContainerRef}
      className={`flex flex-col h-full w-full bg-[var(--main-bg)] text-foreground overflow-hidden font-sans transition-colors ${
        isFullscreen ? 'fixed inset-0 z-[100] h-screen w-screen' : ''
      }`}
    >
      {/* 1. TOP BAR */}
      <TopBar
        project={project}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onTogglePlay={handleTogglePlayback}
        onRewind={handleRewind}
        onOpenSvgFile={handleOpenSvgFile}
        onToggleRegionCut={() => setIsRegionCutMode((enabled) => !enabled)}
        isRegionCutMode={isRegionCutMode}
        canCutImageRegion={canCutSelectedImage}
        onAddElement={handleAddElement}
        onNewProject={handleNewProject}
        onSaveProject={handleSaveProject}
        onLoadProjectFile={handleLoadProjectFile}
        onOpenExportModal={() => setIsExportOpen(true)}
        onToggleAiAssistant={() => setIsAiAssistantOpen(!isAiAssistantOpen)}
        isAiAssistantOpen={isAiAssistantOpen}
        onOpenVeoVideoModal={() => setIsVeoVideoModalOpen(true)}
        isVeoVideoModalOpen={isVeoVideoModalOpen}
        onToggleShortcuts={() => setIsShortcutsOpen(true)}
        showGrid={showGrid}
        onToggleGrid={() => setShowGrid(!showGrid)}
        showRulers={showRulers}
        onToggleRulers={() => setShowRulers(!showRulers)}
        showSafeArea={showSafeArea}
        onToggleSafeArea={() => setShowSafeArea(!showSafeArea)}
        canvasBg={canvasBg}
        onChangeCanvasBg={setCanvasBg}
        onFitToScreen={() => {
          if (fitToScreenCallbackRef.current) fitToScreenCallbackRef.current();
        }}
        onRenameProject={(name) => setProject((p) => ({ ...p, name }))}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
      />

      {/* 2. MIDDLE WORKSPACE (Layers | Canvas | Inspector) */}
      <div className="svg-motion-workspace flex-1 flex overflow-hidden relative min-h-0">
        {/* Left Layers Sidebar */}
        {!isLeftCollapsed && (
          <LayersPanel
            elements={project.elements}
            selectedElementId={project.selectedElementId}
            onSelectElement={handleSelectElement}
            onToggleVisibility={handleToggleVisibility}
            onToggleLock={handleToggleLock}
            onRenameElement={handleRenameElement}
            onMoveElement={handleMoveElement}
            onDeleteElement={(id) => void handleDeleteElement(id)}
            tracks={project.tracks}
            isSingleFlattenedPath={project.isSingleFlattenedPath}
          />
        )}

        {/* Center Canvas Viewport */}
        <CanvasViewport
          project={project}
          selectedElementId={project.selectedElementId}
          onSelectElement={handleSelectElement}
          showGrid={showGrid}
          showRulers={showRulers}
          showSafeArea={showSafeArea}
          canvasBg={canvasBg}
          onUpdateTransform={handleUpdateTransform}
          onOpenSvgFile={handleOpenSvgFile}
          isRegionCutMode={isRegionCutMode}
          onCreateImageRegion={(region) => void handleCreateImageRegion(region)}
          onFitToScreenTrigger={handleRegisterFitToScreen}
          isLeftCollapsed={isLeftCollapsed}
          onToggleLeftSidebar={() => setIsLeftCollapsed((collapsed) => !collapsed)}
          isRightCollapsed={isRightCollapsed}
          onToggleRightSidebar={() => setIsRightCollapsed((collapsed) => !collapsed)}
          onRegisterPlaybackRenderer={handleRegisterCanvasPlaybackRenderer}
        />

        {/* Right Inspector */}
        {!isRightCollapsed && (
          <Inspector
            project={project}
            selectedElementId={project.selectedElementId}
            selectedKeyframeId={project.selectedKeyframeId}
            onUpdateDocumentSettings={(settings) =>
              setProject((p) => ({ ...p, document: { ...p.document, ...settings } }))
            }
            onUpdateTransformProperty={handleUpdateTransformProperty}
            onToggleKeyframe={handleToggleKeyframe}
            onApplyPreset={handleApplyPreset}
            onUpdateKeyframe={(kfId, updates) => {
              setProject((p) => {
                const nextTracks = p.tracks.map((t) => ({
                  ...t,
                  keyframes: t.keyframes.map((k) => (k.id === kfId ? { ...k, ...updates } : k)),
                }));
                return { ...p, tracks: nextTracks };
              });
            }}
            onDeleteKeyframe={handleDeleteKeyframe}
            onDuplicateKeyframe={handleDuplicateKeyframe}
            onRenameElement={handleRenameElement}
            onUpdateElementFill={handleUpdateElementFill}
            onUpdateElementText={handleUpdateElementText}
            autoKeyframe={autoKeyframe}
            onToggleAutoKeyframe={() => setAutoKeyframe((enabled) => !enabled)}
            onRecordAllTransforms={handleRecordAllTransforms}
            onApplyEasingToTransforms={handleApplyEasingToTransforms}
            onSeek={handleSeek}
          />
        )}
      </div>

      {/* 3. BOTTOM TIMELINE */}
      <Timeline
        project={project}
        onTogglePlay={handleTogglePlayback}
        onRewind={handleRewind}
        onSeek={handleSeek}
        onRegisterPlaybackRenderer={handleRegisterTimelinePlaybackRenderer}
        onUpdateDuration={(duration) =>
          setProject((p) => {
            const safeDuration = Math.max(0.1, Number.isFinite(duration) ? duration : p.document.duration);
            const nextCurrentTime = clampTimelineTime(p.currentTime, safeDuration);
            const nextTracks = p.tracks.map((track) => ({
              ...track,
              keyframes: track.keyframes
                .filter((kf) => kf.time <= safeDuration)
                .map((kf) => ({ ...kf, time: clampTimelineTime(kf.time, safeDuration) })),
            }));

            return {
              ...p,
              currentTime: nextCurrentTime,
              document: { ...p.document, duration: safeDuration },
              tracks: nextTracks,
            };
          })
        }
        onUpdateFps={(fps) =>
          setProject((p) => ({ ...p, document: { ...p.document, fps } }))
        }
        onToggleLoop={() =>
          setProject((p) => ({ ...p, document: { ...p.document, loop: !p.document.loop } }))
        }
        onSelectKeyframe={(id) => setProject((p) => ({
          ...p,
          selectedKeyframeId: id,
          selectedKeyframeIds: id ? [id] : [],
        }))}
        onSelectKeyframes={(ids, primaryId) => setProject((p) => ({
          ...p,
          selectedKeyframeIds: ids,
          selectedKeyframeId: primaryId,
        }))}
        onAddKeyframeAtPlayhead={(elId, prop) => handleToggleKeyframe(elId, prop)}
        onMoveKeyframe={handleMoveKeyframe}
        onDeleteKeyframes={handleDeleteKeyframes}
        onDuplicateKeyframe={handleDuplicateKeyframe}
        onUpdateKeyframeEasing={handleUpdateKeyframeEasing}
        selectedElementId={project.selectedElementId}
        onSelectElement={handleSelectElement}
      />

      {/* Modals */}
      <AiAssistantModal
        isOpen={isAiAssistantOpen}
        onClose={() => setIsAiAssistantOpen(false)}
        elements={project.elements}
        svgRaw={project.svgRaw}
        selectedElementId={project.selectedElementId}
        currentDuration={project.document.duration}
        currentFps={project.document.fps}
        currentLoop={project.document.loop}
        hasAiAnimation={Boolean(project.aiAnimationBaseTracks)}
        onApplyPlan={handleApplyAiPlan}
        onResetAnimation={handleResetAiAnimation}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        project={project}
      />

      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      <VeoVideoModal
        isOpen={isVeoVideoModalOpen}
        onClose={() => setIsVeoVideoModalOpen(false)}
        project={project}
      />

      {/* Toast Notifications Overlay */}
      <div className="fixed top-20 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[var(--card-bg)]/95 border border-[var(--card-border)] text-foreground shadow-2xl backdrop-blur-xl text-xs animate-in slide-in-from-bottom-2 fade-in duration-150 pointer-events-auto max-w-sm"
          >
            {toast.type === 'success' && <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />}
            {toast.type === 'warning' && <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />}
            {toast.type === 'error' && <X className="h-4 w-4 text-red-500 shrink-0" />}
            {toast.type === 'info' && <Info className="h-4 w-4 text-primary shrink-0" />}
            <div className="min-w-0">
              <span className="font-bold block truncate">{toast.title}</span>
              {toast.description && (
                <span className="text-[10px] text-[var(--text-secondary)] block line-clamp-2">
                  {toast.description}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SvgMotionStudio;
