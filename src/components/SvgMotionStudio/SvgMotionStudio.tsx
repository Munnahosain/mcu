'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ProjectState,
  ProjectItem,
  SvgElementNode,
  Keyframe,
  AnimProperty,
  EasingType,
  KeyframeInterpolation,
  KeyframeClipboardEntry,
  ToastMessage,
  SvgPrimitiveKind,
  BoundingBox,
  RasterImageSource,
} from './types';
import { DEFAULT_DURATION, DEFAULT_FPS } from './constants';
import { sanitizeAndParseSvg, findElementById, flattenElementTree } from './svgParser';
import { ANIMATION_PRESETS } from './presets';
import { AiAnimationPlan } from './aiAssistant';
import { computeElementStylesAtTime } from './animationEngine';
import {
  recordAllTransformKeyframes,
  applyEasingToElementTransforms,
} from './keyframeManager';
import { downloadText } from '@/lib/downloadHelper';
import { LayersPanel } from './LayersPanel';
import { CanvasViewport } from './CanvasViewport';
import { Inspector } from './Inspector';
import { Timeline } from './Timeline';
import { migrateProject } from './projectMigration';
import { canSetAnimationParent } from './layerUtilities';
import { CHARACTER_PRESETS, autoDetectCharacterSlots } from './characterMode';
import { ProjectPanel, ProjectSort } from './ProjectPanel';
import { PreviewPanel, PreviewQuality, PreviewTab } from './PreviewPanel';
import { AiAssistantModal } from './AiAssistantModal';
import { ExportModal } from './ExportModal';
import { ShortcutsModal } from './ShortcutsModal';
import { VeoVideoModal } from './VeoVideoModal';
import { getAuthUser } from '@/lib/auth';
import { MotionTool, MotionWorkspace, WorkspaceChrome } from './WorkspaceChrome';
import {
  AlignHorizontalDistributeCenter,
  AlignHorizontalDistributeEnd,
  AlignHorizontalDistributeStart,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignVerticalDistributeCenter,
  AlignVerticalDistributeEnd,
  AlignVerticalDistributeStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  Menu,
  Lock,
  Unlock,
  X,
  CheckCircle,
  AlertTriangle,
  Info,
} from 'lucide-react';

const LOCAL_STORAGE_KEY = 'mcu_svg_motion_last_project';
const WORKSPACE_LAYOUT_KEY = 'mcu_svg_motion_workspace';
const MAX_RASTER_UPLOAD_BYTES = 20 * 1024 * 1024;
const WORKSPACE_PRESETS: Record<MotionWorkspace, { leftWidth: number; rightWidth: number }> = {
  Default: { leftWidth: 256, rightWidth: 320 },
  Standard: { leftWidth: 224, rightWidth: 288 },
  'Small screen': { leftWidth: 184, rightWidth: 240 },
};
const WORKSPACE_NAMES = Object.keys(WORKSPACE_PRESETS) as MotionWorkspace[];
type WorkspaceLayout = {
  workspace: MotionWorkspace;
  leftWidth: number;
  rightWidth: number;
  timelineHeight: number;
  activeLeftPanel: 'project' | 'layers';
  projectSort: ProjectSort;
  previewTab: PreviewTab;
  previewQuality: PreviewQuality;
  openPanels: string[];
  visiblePanels: string[];
  bottomTab: 'timeline' | 'renderQueue';
};
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

function clampElementRanges(nodes: SvgElementNode[], duration: number): SvgElementNode[] {
  return nodes.map((node) => {
    const inPoint = Math.max(0, Math.min(duration, Number.isFinite(node.inPoint) ? node.inPoint ?? 0 : 0));
    const outPoint = Math.max(inPoint, Math.min(duration, Number.isFinite(node.outPoint) ? node.outPoint ?? duration : duration));
    return {
      ...node,
      inPoint,
      outPoint,
      colorLabel: Number.isInteger(node.colorLabel) && (node.colorLabel ?? 0) >= 0 && (node.colorLabel ?? 0) < 6 ? node.colorLabel : 0,
      solo: node.solo ?? false,
      shy: node.shy ?? false,
      blendMode: node.blendMode ?? 'normal',
      children: clampElementRanges(node.children, duration),
    };
  });
}

function syncRasterProjectItems(project: ProjectState): ProjectState {
  const items = [...(project.projectItems ?? [])];
  (project.rasterSources ?? []).forEach((source) => {
    const layerId = flattenElementTree(project.elements).find(
      (element) => element.originalId === source.elementOriginalId
    )?.id;
    const existingIndex = items.findIndex((item) =>
      item.type === 'image'
      && (item.id === source.elementOriginalId || item.dataUrl === source.dataUrl)
    );
    const existing = existingIndex >= 0 ? items[existingIndex] : undefined;
    const imageItem: ProjectItem = {
      ...(existing ?? {}),
      id: existing?.id ?? source.elementOriginalId,
      name: existing?.name ?? source.name,
      type: 'image',
      kind: 'image',
      size: existing?.size ?? Math.round(source.dataUrl.length * 0.75),
      width: source.width,
      height: source.height,
      dataUrl: source.dataUrl,
      ...(layerId ? { layerId: existing?.layerId ?? layerId } : {}),
      layerIds: [...new Set([...(existing?.layerIds ?? []), ...(layerId ? [layerId] : [])])],
      createdAt: existing?.createdAt ?? new Date(0).toISOString(),
    };
    if (existingIndex >= 0) items[existingIndex] = imageItem;
    else items.push(imageItem);
  });
  return { ...project, projectItems: items };
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
    version: '3.0',
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
    markers: [],
    workArea: { start: 0, end: DEFAULT_DURATION },
    compositions: [],
    projectItems: [],
  });
  const playbackTimeRef = useRef(project.currentTime);
  const renderedProgressRef = useRef(0);
  const canvasPlaybackRendererRef = useRef<PlaybackRenderer | null>(null);
  const timelinePlaybackRendererRef = useRef<PlaybackRenderer | null>(null);
  const rasterSourceRef = useRef<RasterImageSource[]>([]);
  const keyboardActionsRef = useRef<{
    togglePlayback: () => void;
    deleteKeyframes: (ids: string[]) => void;
    deleteElement: (id: string | string[]) => Promise<void>;
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
  const [compositionDialog, setCompositionDialog] = useState<'create' | 'settings' | null>(null);
  const [compositionDraft, setCompositionDraft] = useState({
    name: 'Composition 1',
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 10,
    backgroundColor: 'transparent',
  });
  const [shortcutSearch, setShortcutSearch] = useState('');
  const [presetSearch, setPresetSearch] = useState('');
  const [alignTo, setAlignTo] = useState<'selection' | 'composition'>('selection');
  const [renderJobs, setRenderJobs] = useState<Array<{
    id: string;
    format: string;
    compName: string;
    status: 'Rendering' | 'Done' | 'Failed';
    progress: number;
    startedAt: number;
    finishedAt?: number;
    error?: string;
  }>>([]);
  const [dockMenuId, setDockMenuId] = useState<string | null>(null);
  const [maximizedDockPanel, setMaximizedDockPanel] = useState<string | null>(null);
  const [elapsedTick, setElapsedTick] = useState(Date.now());
  const studioStartedAt = useRef(Date.now());
  const pointerReadoutRef = useRef<HTMLSpanElement>(null);
  const [viewerLocked, setViewerLocked] = useState(false);
  const [viewerMenuOpen, setViewerMenuOpen] = useState(false);

  // Responsive sidebar collapse
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);
  const [autoKeyframe, setAutoKeyframe] = useState(false);
  const [isRegionCutMode, setIsRegionCutMode] = useState(false);
  const [workspaceLayout, setWorkspaceLayout] = useState<WorkspaceLayout>({
    workspace: 'Default',
    ...WORKSPACE_PRESETS.Default,
    timelineHeight: 260,
    activeLeftPanel: 'project',
    projectSort: { key: 'name', direction: 'asc' },
    previewTab: 'info',
    previewQuality: 'Auto',
    openPanels: ['Info', 'Preview', 'Properties'],
    visiblePanels: ['Project', 'Layers', 'Info', 'Audio', 'Preview', 'Properties', 'Align', 'Presets', 'Character', 'Text', 'Timeline', 'Render Queue'],
    bottomTab: 'timeline',
  });
  const [workspaceLayoutReady, setWorkspaceLayoutReady] = useState(false);
  const [activeTool, setActiveTool] = useState<MotionTool>('select');
  const [snapping, setSnapping] = useState(false);
  const resizingPanelRef = useRef<'left' | 'right' | null>(null);

  useEffect(() => {
    const interval = window.setInterval(() => setElapsedTick(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const getWorkspaceStorageKey = () => {
    try {
      const userId = getAuthUser()?.id || 'guest';
      return `${WORKSPACE_LAYOUT_KEY}:${userId}`;
    } catch (error) {
      console.error('[Motion Studio] Unable to identify the workspace owner:', error);
      return `${WORKSPACE_LAYOUT_KEY}:guest`;
    }
  };

  useEffect(() => {
    try {
      const stored = localStorage.getItem(getWorkspaceStorageKey());
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<WorkspaceLayout>;
        const workspace = WORKSPACE_NAMES.includes(parsed.workspace as MotionWorkspace)
          ? parsed.workspace as MotionWorkspace
          : 'Default';
        const validWidth = (width: unknown, fallback: number) =>
          typeof width === 'number' && Number.isFinite(width)
            ? Math.max(160, Math.min(520, width))
            : fallback;
        const validTimelineHeight = typeof parsed.timelineHeight === 'number' && Number.isFinite(parsed.timelineHeight)
          ? Math.max(160, Math.min(2000, parsed.timelineHeight))
          : 260;
        const projectSort = parsed.projectSort
          && ['name', 'type', 'size'].includes(parsed.projectSort.key)
          && ['asc', 'desc'].includes(parsed.projectSort.direction)
          ? parsed.projectSort as ProjectSort
          : { key: 'name', direction: 'asc' } as ProjectSort;
        setWorkspaceLayout({
          workspace,
          leftWidth: validWidth(parsed.leftWidth, WORKSPACE_PRESETS[workspace].leftWidth),
          rightWidth: validWidth(parsed.rightWidth, WORKSPACE_PRESETS[workspace].rightWidth),
          timelineHeight: validTimelineHeight,
          activeLeftPanel: parsed.activeLeftPanel === 'layers' ? 'layers' : 'project',
          projectSort,
          previewTab: parsed.previewTab === 'audio' ? 'audio' : 'info',
          previewQuality: ['Auto', 'Full', 'Half', 'Third', 'Quarter'].includes(parsed.previewQuality as string)
            ? parsed.previewQuality as PreviewQuality
            : 'Auto',
          openPanels: Array.isArray(parsed.openPanels)
            ? parsed.openPanels.filter((panel): panel is string =>
              ['Info', 'Audio', 'Preview', 'Properties', 'Align', 'Presets', 'Character', 'Text'].includes(panel)
            )
            : ['Info', 'Preview', 'Properties'],
          visiblePanels: Array.isArray(parsed.visiblePanels)
            ? parsed.visiblePanels.filter((panel): panel is string =>
              ['Project', 'Layers', 'Info', 'Audio', 'Preview', 'Properties', 'Align', 'Presets', 'Character', 'Text', 'Timeline', 'Render Queue'].includes(panel)
            )
            : ['Project', 'Layers', 'Info', 'Audio', 'Preview', 'Properties', 'Align', 'Presets', 'Character', 'Text', 'Timeline', 'Render Queue'],
          bottomTab: parsed.bottomTab === 'renderQueue' ? 'renderQueue' : 'timeline',
        });
      }
    } catch (error) {
      console.error('[Motion Studio] Unable to restore the workspace layout:', error);
    } finally {
      setWorkspaceLayoutReady(true);
    }
  }, []);

  useEffect(() => {
    if (!workspaceLayoutReady) return;
    try {
      localStorage.setItem(getWorkspaceStorageKey(), JSON.stringify(workspaceLayout));
    } catch (error) {
      console.error('[Motion Studio] Unable to save the workspace layout:', error);
    }
  }, [workspaceLayout, workspaceLayoutReady]);

  const setWorkspace = (workspace: MotionWorkspace) => {
    setWorkspaceLayout((layout) => ({
      ...layout,
      workspace,
      ...WORKSPACE_PRESETS[workspace],
      timelineHeight: workspace === 'Small screen' ? 190 : 260,
    }));
    setIsLeftCollapsed(false);
    setIsRightCollapsed(false);
  };

  const resizePanel = (side: 'left' | 'right', clientX: number) => {
    const bounds = studioContainerRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const maximum = Math.max(
      160,
      Math.min(520, bounds.width - 280 - (side === 'left' ? workspaceLayout.rightWidth : workspaceLayout.leftWidth))
    );
    const width = Math.max(160, Math.min(maximum, side === 'left' ? clientX - bounds.left : bounds.right - clientX));
    setWorkspaceLayout((layout) => ({
      ...layout,
      [side === 'left' ? 'leftWidth' : 'rightWidth']: width,
    }));
  };

  const handleResizeKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, side: 'left' | 'right') => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const delta = (event.key === 'ArrowRight' ? 12 : -12) * (side === 'left' ? 1 : -1);
    const widthKey = side === 'left' ? 'leftWidth' : 'rightWidth';
    setWorkspaceLayout((layout) => ({
      ...layout,
      [widthKey]: Math.max(160, Math.min(520, layout[widthKey] + delta)),
    }));
  };

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

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!stored) return;
      const migrated = migrateProject(JSON.parse(stored));
      if (!migrated) {
        console.error('[Motion Studio] Saved project data is invalid and was not restored.');
        return;
      }
      const safeRasterSources = (migrated.rasterSources ?? []).filter((source) =>
        source
        && typeof source.dataUrl === 'string'
        && /^data:image\/(?:png|jpeg|webp);base64,/i.test(source.dataUrl)
        && typeof source.elementOriginalId === 'string'
        && [source.width, source.height, source.x, source.y, source.displayWidth, source.displayHeight]
          .every(Number.isFinite)
      );
      migrated.rasterSources = safeRasterSources;
      rasterSourceRef.current = safeRasterSources;
      const restoredProject = syncRasterProjectItems(migrated);
      setProject(restoredProject);
      pushHistory(restoredProject);
    } catch (error) {
      console.error('[Motion Studio] Unable to restore the saved project:', error);
    }
  }, [pushHistory]);

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
    const requestedStart = Math.min(duration, Math.max(0, project.workArea?.start ?? 0));
    const requestedEnd = Math.min(duration, Math.max(0, project.workArea?.end ?? duration));
    const hasWorkArea = requestedEnd > requestedStart;
    const workAreaStart = hasWorkArea ? requestedStart : 0;
    const playbackEnd = hasWorkArea ? requestedEnd : duration;

    const loop = (now: number) => {
      const elapsed = now - lastUpdateTime;

      if (elapsed >= frameInterval) {
        lastUpdateTime = now;
        let nextTime = playbackTimeRef.current + elapsed / 1000;

        if (duration <= 0) {
          nextTime = 0;
        } else if (nextTime >= playbackEnd) {
          if (shouldLoop) nextTime = workAreaStart + ((nextTime - workAreaStart) % (playbackEnd - workAreaStart));
          else nextTime = playbackEnd;
        }

        playbackTimeRef.current = clampTimelineTime(nextTime, duration);
        if (hasWorkArea && playbackEnd > workAreaStart) {
          renderedProgressRef.current = Math.max(
            renderedProgressRef.current,
            Math.min(1, (playbackTimeRef.current - workAreaStart) / (playbackEnd - workAreaStart))
          );
        }
        canvasPlaybackRendererRef.current?.(playbackTimeRef.current);
        timelinePlaybackRendererRef.current?.(playbackTimeRef.current);

        if (!shouldLoop && playbackTimeRef.current >= playbackEnd) {
          setProject((prev) => ({ ...prev, currentTime: playbackEnd, isPlaying: false }));
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
  }, [project.isPlaying, project.document.fps, project.document.duration, project.document.loop, project.workArea]);

  useEffect(() => {
    renderedProgressRef.current = 0;
  }, [project.workArea?.start, project.workArea?.end]);

  const handleTogglePlayback = () => {
    if (project.isPlaying) {
      const currentTime = playbackTimeRef.current;
      setProject((prev) => ({ ...prev, currentTime, isPlaying: false }));
      return;
    }

    const workArea = project.workArea ?? { start: 0, end: project.document.duration };
    const hasWorkArea = workArea.end > workArea.start;
    playbackTimeRef.current = hasWorkArea && (project.currentTime < workArea.start || project.currentTime >= workArea.end)
      ? workArea.start
      : project.currentTime;
    setProject((prev) => ({ ...prev, isPlaying: true }));
  };

  const handleToggleLoop = () => {
    setProject((current) => ({
      ...current,
      document: { ...current.document, loop: !current.document.loop },
    }));
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
  const handleOpenSvgFile = async (
    file: File,
    options: { inPoint?: number; reuseItemId?: string } = {}
  ) => {
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
        const imageInPoint = clampTimelineTime(options.inPoint ?? 0, project.document.duration);
        const imageElements = options.inPoint === undefined
          ? parsedImage.elements
          : parsedImage.elements.map((node) => node.id === newNode.id
            ? { ...node, inPoint: imageInPoint, outPoint: project.document.duration }
            : node);
        const matchingImageItem = project.projectItems?.find(
          (item) => item.type === 'image' && item.dataUrl === dataUrl
        );
        const imageItemId = matchingImageItem?.id ?? options.reuseItemId ?? sourceElementOriginalId;
        const imageItem: ProjectItem = {
          ...(matchingImageItem ?? {}),
          id: imageItemId,
          name: matchingImageItem?.name ?? cleanName,
          type: 'image',
          kind: 'image',
          size: file.size,
          width: image.naturalWidth,
          height: image.naturalHeight,
          dataUrl,
          layerId: matchingImageItem?.layerId ?? newNode.id,
          layerIds: [...new Set([...(matchingImageItem?.layerIds ?? []), ...(matchingImageItem?.layerId ? [matchingImageItem.layerId] : []), newNode.id])],
          createdAt: matchingImageItem?.createdAt ?? new Date().toISOString(),
        };
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
          compositions: isFirstImage
            ? [{
              id: 'comp-main',
              name: cleanName,
              width: image.naturalWidth,
              height: image.naturalHeight,
              duration: project.document.duration,
              fps: project.document.fps,
            }]
            : project.compositions,
          svgRaw: parsedImage.cleanSvg,
          elements: imageElements,
          isSingleFlattenedPath: false,
          selectedElementId: newNode.id,
          selectedKeyframeId: null,
          isPlaying: false,
          projectItems: [
            ...(project.projectItems ?? []).filter((item) => item.type !== 'composition'),
            {
              id: 'comp-main',
              name: isFirstImage ? cleanName : project.document.name,
              type: 'composition',
              kind: 'composition',
              width: isFirstImage ? image.naturalWidth : project.document.width,
              height: isFirstImage ? image.naturalHeight : project.document.height,
              createdAt: project.projectItems?.find((item) => item.type === 'composition')?.createdAt ?? new Date().toISOString(),
            },
            ...((project.projectItems ?? []).some((item) => item.id === imageItemId)
              ? (project.projectItems ?? []).filter((item) => item.id !== imageItemId)
              : []),
            imageItem,
          ],
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
        version: '3.0',
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
        markers: [],
        workArea: { start: 0, end: project.document.duration },
        compositions: [{
          id: 'comp-main',
          name: cleanName,
          width: parsed.width,
          height: parsed.height,
          duration: project.document.duration,
          fps: project.document.fps,
        }],
        projectItems: [
          {
            id: 'comp-main',
            name: cleanName,
            type: 'composition',
            kind: 'composition',
            width: parsed.width,
            height: parsed.height,
            createdAt: new Date().toISOString(),
          },
          {
            id: `asset-svg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: file.name || `${cleanName}.svg`,
            type: 'svg',
            kind: 'svg',
            size: file.size || text.length * 2,
            width: parsed.width,
            height: parsed.height,
            svgText: parsed.cleanSvg,
            createdAt: new Date().toISOString(),
          },
        ],
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

  const handleAddProjectItem = async (itemId: string, requestedTime: number) => {
    const item = project.projectItems?.find((candidate) => candidate.id === itemId);
    if (!item || item.type === 'folder' || item.type === 'composition') return;
    const time = clampTimelineTime(
      project.isPlaying ? playbackTimeRef.current : requestedTime,
      project.document.duration
    );
    try {
      if (item.type === 'image') {
        const dataUrl = item.dataUrl
          ?? project.rasterSources?.find((source) => source.elementOriginalId === item.id)?.dataUrl;
        if (!dataUrl) {
          addToast('Asset unavailable', `${item.name} has no embedded image data.`, 'error');
          return;
        }
        const response = await fetch(dataUrl);
        if (!response.ok) throw new Error('The image asset could not be read.');
        const blob = await response.blob();
        const extension = blob.type.split('/')[1] || 'png';
        await handleOpenSvgFile(new File([blob], `${item.name}.${extension}`, { type: blob.type }), {
          inPoint: time,
          reuseItemId: item.id,
        });
        return;
      }

      if (!item.svgText) {
        addToast('Asset unavailable', `${item.name} does not contain SVG source data.`, 'error');
        return;
      }
      const parsedAsset = sanitizeAndParseSvg(item.svgText);
      if (!parsedAsset.success) throw new Error(parsedAsset.error || 'The SVG asset could not be parsed.');
      const currentDocument = new DOMParser().parseFromString(project.svgRaw, 'image/svg+xml');
      const currentRoot = currentDocument.documentElement;
      if (currentRoot.tagName.toLowerCase() !== 'svg' || currentDocument.querySelector('parsererror')) {
        throw new Error('The current composition is not a valid SVG.');
      }
      const assetDocument = new DOMParser().parseFromString(parsedAsset.cleanSvg, 'image/svg+xml');
      const assetRoot = assetDocument.documentElement;
      const sourceBox = parsedAsset.viewBox;
      const destinationBox = project.document.viewBox;
      const sourceWidth = Math.max(1, Math.abs(sourceBox.width));
      const sourceHeight = Math.max(1, Math.abs(sourceBox.height));
      const groupId = `mcu-project-asset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const namespace = 'http://www.w3.org/2000/svg';
      const outerGroup = currentDocument.createElementNS(namespace, 'g');
      const normalizedGroup = currentDocument.createElementNS(namespace, 'g');
      outerGroup.setAttribute('id', groupId);
      outerGroup.setAttribute('data-name', item.name);
      normalizedGroup.setAttribute(
        'transform',
        `translate(${destinationBox.x} ${destinationBox.y}) scale(${destinationBox.width / sourceWidth} ${destinationBox.height / sourceHeight}) translate(${-sourceBox.x} ${-sourceBox.y})`
      );
      Array.from(assetRoot.childNodes).forEach((child) => {
        normalizedGroup.appendChild(currentDocument.importNode(child, true));
      });
      outerGroup.appendChild(normalizedGroup);
      currentRoot.appendChild(outerGroup);
      const parsedComposition = sanitizeAndParseSvg(new XMLSerializer().serializeToString(currentRoot));
      if (!parsedComposition.success) throw new Error(parsedComposition.error || 'The SVG layer could not be added.');
      const addedNode = flattenElementTree(parsedComposition.elements).find((node) => node.originalId === groupId);
      if (!addedNode) throw new Error('The new SVG layer could not be located.');
      const updateRange = (nodes: SvgElementNode[]): SvgElementNode[] => nodes.map((node) =>
        node.id === addedNode.id
          ? { ...node, inPoint: time, outPoint: project.document.duration }
          : node.children.length ? { ...node, children: updateRange(node.children) } : node
      );
      const nextProject: ProjectState = {
        ...project,
        svgRaw: parsedComposition.cleanSvg,
        elements: updateRange(parsedComposition.elements),
        isSingleFlattenedPath: false,
        selectedElementId: addedNode.id,
        selectedKeyframeId: null,
        selectedKeyframeIds: [],
        projectItems: (project.projectItems ?? []).map((currentItem) => currentItem.id === item.id
          ? {
            ...currentItem,
            layerId: currentItem.layerId ?? addedNode.id,
            layerIds: [...new Set([...(currentItem.layerIds ?? []), ...(currentItem.layerId ? [currentItem.layerId] : []), addedNode.id])],
          }
          : currentItem),
      };
      setProject(nextProject);
      pushHistory(nextProject);
      addToast('Asset added as layer', `${item.name} was added at ${time.toFixed(2)}s.`, 'success');
    } catch (error) {
      addToast('Could not add asset', error instanceof Error ? error.message : 'The project item could not be added.', 'error');
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
        ...project,
        version: '3.0',
        isPlaying: false,
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
    } catch (error) {
      console.error('[Motion Studio] Unable to save the project to local storage:', error);
      addToast('Browser backup unavailable', 'The project file was downloaded, but local storage could not be updated.', 'warning');
    }

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

      let loadedProject = migrateProject(data);
      if (!loadedProject) {
        addToast('Invalid Project', 'The project data could not be migrated.', 'error');
        return;
      }

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
      loadedProject = syncRasterProjectItems(loadedProject);
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
      const blankProj: ProjectState = {
        version: '3.0',
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
        svgRaw: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600"></svg>',
        rasterSources: [],
        elements: [],
        tracks: [],
        characterSlots: {},
        isSingleFlattenedPath: false,
        selectedElementId: null,
        selectedKeyframeId: null,
        currentTime: 0,
        isPlaying: false,
        markers: [],
        workArea: { start: 0, end: 4 },
        compositions: [],
        projectItems: [],
      };

      playbackTimeRef.current = 0;
      renderedProgressRef.current = 0;
      rasterSourceRef.current = [];
      setIsRegionCutMode(false);
      setProject(blankProj);
      pushHistory(blankProj);
      addToast('New Project', 'Blank canvas created', 'info');
    }
  };

  const handleCreateComposition = () => {
    const width = Math.round(Number(compositionDraft.width));
    const height = Math.round(Number(compositionDraft.height));
    const fps = Number(compositionDraft.fps);
    const duration = Number(compositionDraft.duration);
    if (!compositionDraft.name.trim() || !Number.isFinite(width) || width < 1 || width > 16384
      || !Number.isFinite(height) || height < 1 || height > 16384
      || !Number.isFinite(fps) || fps < 1 || fps > 240
      || !Number.isFinite(duration) || duration <= 0 || duration > 3600) {
      addToast('Composition not created', 'Enter a name, valid dimensions, frame rate, and duration.', 'error');
      return;
    }
    const name = compositionDraft.name.trim();
    const id = project.compositions?.[0]?.id ?? `comp-${Date.now()}`;
    const composition = { id, name, width, height, fps, duration };
    const documentSettings = {
      ...project.document,
      width,
      height,
      viewBox: { x: 0, y: 0, width, height },
      backgroundColor: compositionDraft.backgroundColor,
      fps,
      duration,
      name,
    };
    const settingsOnly = compositionDialog === 'settings';
    setProject((current) => {
      let svgRaw = current.svgRaw;
      if (settingsOnly) {
        const svgDocument = new DOMParser().parseFromString(current.svgRaw, 'image/svg+xml');
        const root = svgDocument.documentElement;
        if (root.tagName.toLowerCase() === 'svg' && !svgDocument.querySelector('parsererror')) {
          root.setAttribute('viewBox', `0 0 ${width} ${height}`);
          root.setAttribute('width', String(width));
          root.setAttribute('height', String(height));
          svgRaw = new XMLSerializer().serializeToString(root);
        }
      } else {
        svgRaw = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"></svg>`;
      }
      const next = {
        ...current,
        name,
        document: documentSettings,
        svgRaw,
        elements: settingsOnly ? clampElementRanges(current.elements, duration) : [],
        tracks: settingsOnly ? current.tracks : [],
        selectedElementId: settingsOnly ? current.selectedElementId : null,
        selectedElementIds: settingsOnly ? current.selectedElementIds : [],
        currentTime: settingsOnly ? clampTimelineTime(current.currentTime, duration) : 0,
        workArea: settingsOnly
          ? { start: Math.min(duration, current.workArea?.start ?? 0), end: Math.min(duration, current.workArea?.end ?? duration) }
          : { start: 0, end: duration },
        compositions: [composition],
        projectItems: [
          ...(current.projectItems ?? []).filter((item) => item.type !== 'composition'),
          {
            id,
            name,
            type: 'composition' as const,
            kind: 'composition' as const,
            width,
            height,
            createdAt: new Date().toISOString(),
          },
        ],
      };
      pushHistory(next);
      return next;
    });
    setCompositionDialog(null);
    addToast('Composition created', name, 'success');
  };

  const handleCompositionSettings = () => {
    setCompositionDraft({
      name: project.document.name || project.name,
      width: project.document.width,
      height: project.document.height,
      fps: project.document.fps,
      duration: project.document.duration,
      backgroundColor: project.document.backgroundColor,
    });
    setCompositionDialog(project.compositions?.length ? 'settings' : 'create');
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

  const handleUpdateLayer = (
    elId: string,
    updates: Partial<Pick<SvgElementNode, 'colorLabel' | 'solo' | 'shy' | 'blendMode' | 'animParentId'>>
  ) => {
    if (updates.animParentId !== undefined && !canSetAnimationParent(
      elId,
      updates.animParentId,
      (id) => findElementById(project.elements, id)?.animParentId
    )) {
      addToast('Parent not changed', 'A layer cannot be parented to itself or one of its descendants.', 'warning');
      return;
    }
    setProject((prev) => {
      const updateLayer = (nodes: SvgElementNode[]): SvgElementNode[] => nodes.map((node) => {
        if (node.id === elId) return { ...node, ...updates };
        return node.children.length ? { ...node, children: updateLayer(node.children) } : node;
      });
      const next = { ...prev, elements: updateLayer(prev.elements) };
      pushHistory(next);
      return next;
    });
  };

  const handleUpdateLayerRange = (elId: string, start: number, end: number) => {
    setProject((prev) => {
      const safeStart = Math.max(0, Math.min(prev.document.duration, Number.isFinite(start) ? start : 0));
      const safeEnd = Math.max(safeStart, Math.min(prev.document.duration, Number.isFinite(end) ? end : prev.document.duration));
      const updateLayer = (nodes: SvgElementNode[]): SvgElementNode[] => nodes.map((node) => {
        if (node.id === elId) return { ...node, inPoint: safeStart, outPoint: safeEnd };
        return node.children.length ? { ...node, children: updateLayer(node.children) } : node;
      });
      return { ...prev, elements: updateLayer(prev.elements) };
    });
  };

  const handleCommitLayerRange = (elId: string, start: number, end: number) => {
    setProject((prev) => {
      const safeStart = Math.max(0, Math.min(prev.document.duration, Number.isFinite(start) ? start : 0));
      const safeEnd = Math.max(safeStart, Math.min(prev.document.duration, Number.isFinite(end) ? end : prev.document.duration));
      const updateLayer = (nodes: SvgElementNode[]): SvgElementNode[] => nodes.map((node) => {
        if (node.id === elId) return { ...node, inPoint: safeStart, outPoint: safeEnd };
        return node.children.length ? { ...node, children: updateLayer(node.children) } : node;
      });
      const next = { ...prev, elements: updateLayer(prev.elements) };
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

  const handleReorderLayer = (elId: string, targetId: string, after: boolean) => {
    setProject((prev) => {
      const source = findElementById(prev.elements, elId);
      const target = findElementById(prev.elements, targetId);
      if (!source || !target || source.parentId !== target.parentId) return prev;
      const document = new DOMParser().parseFromString(prev.svgRaw, 'image/svg+xml');
      const sourceDom = Array.from(document.querySelectorAll<SVGElement>('[data-mcu-id]'))
        .find((element) => element.getAttribute('data-mcu-id') === elId);
      const targetDom = Array.from(document.querySelectorAll<SVGElement>('[data-mcu-id]'))
        .find((element) => element.getAttribute('data-mcu-id') === targetId);
      if (!sourceDom || !targetDom || sourceDom.parentElement !== targetDom.parentElement) {
        addToast('Layer order unchanged', 'Only layers with the same SVG parent can be reordered.', 'warning');
        return prev;
      }
      const siblings = source.parentId
        ? findElementById(prev.elements, source.parentId)?.children ?? []
        : prev.elements;
      const fromIndex = siblings.findIndex((node) => node.id === elId);
      const nextSiblings = [...siblings];
      const [moving] = nextSiblings.splice(fromIndex, 1);
      const targetIndex = nextSiblings.findIndex((node) => node.id === targetId);
      if (!moving || targetIndex < 0) return prev;
      nextSiblings.splice(targetIndex + (after ? 1 : 0), 0, moving);
      const reorderTree = (nodes: SvgElementNode[]): SvgElementNode[] => {
        if (source.parentId === null && nodes === prev.elements) return nextSiblings;
        return nodes.map((node) => node.id === source.parentId
          ? { ...node, children: nextSiblings }
          : node.children.length ? { ...node, children: reorderTree(node.children) } : node);
      };
      const reference = after ? targetDom.nextSibling : targetDom;
      const domParent = targetDom.parentElement;
      if (!domParent) return prev;
      domParent.insertBefore(sourceDom, reference);
      const next = {
        ...prev,
        svgRaw: new XMLSerializer().serializeToString(document.documentElement),
        elements: reorderTree(prev.elements),
      };
      pushHistory(next);
      return next;
    });
  };

  const handleMoveElement = (elId: string, direction: 'up' | 'down') => {
    const node = findElementById(project.elements, elId);
    if (!node) return;
    const siblings = node.parentId
      ? findElementById(project.elements, node.parentId)?.children ?? []
      : project.elements;
    const index = siblings.findIndex((item) => item.id === elId);
    const target = siblings[index + (direction === 'up' ? -1 : 1)];
    if (target) handleReorderLayer(elId, target.id, direction === 'down');
  };

  const handleResetLayerTransform = (elementId: string) => {
    setProject((prev) => {
      const next = {
        ...prev,
        tracks: prev.tracks.filter((track) =>
          track.elementId !== elementId
          || !['x', 'y', 'rotation', 'scaleX', 'scaleY', 'skewX', 'skewY', 'originX', 'originY'].includes(track.property)
        ),
      };
      pushHistory(next);
      return next;
    });
  };

  const handleSelectLayerChildren = (elementId: string) => {
    const root = findElementById(project.elements, elementId);
    if (!root) return;
    const ids: string[] = [];
    const collect = (node: SvgElementNode) => node.children.forEach((child) => {
      ids.push(child.id);
      collect(child);
    });
    collect(root);
    handleSelectElements(ids, ids[0] ?? elementId);
  };

  const cloneLayerSelection = (elementIds: string[], splitTime?: number) => {
    setProject((prev) => {
      const requested = new Set(elementIds);
      const all = flattenElementTree(prev.elements);
      const roots = all.filter((node) => requested.has(node.id) && !all.some((ancestor) => {
        if (!requested.has(ancestor.id)) return false;
        let current = node.parentId;
        while (current) {
          if (current === ancestor.id) return true;
          current = findElementById(prev.elements, current)?.parentId ?? null;
        }
        return false;
      }));
      if (!roots.length) return prev;
      const cloneByRoot = new Map<string, SvgElementNode>();
      const clonedIdMap = new Map<string, string>();
      const clonedOriginalIdMap = new Map<string, string>();
      roots.forEach((root) => flattenElementTree([root]).forEach((node) => {
        clonedIdMap.set(node.id, `mcu_el_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
        clonedOriginalIdMap.set(node.id, `mcu-dup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      }));
      const cloneNode = (node: SvgElementNode, clonedParentId?: string): SvgElementNode => {
        const id = clonedIdMap.get(node.id)!;
        const originalId = clonedOriginalIdMap.get(node.id)!;
        const attrs = { ...node.attributes };
        if (attrs.id) attrs.id = originalId;
        const inPoint = splitTime === undefined
          ? node.inPoint ?? 0
          : Math.max(node.inPoint ?? 0, Math.min(node.outPoint ?? prev.document.duration, splitTime));
        const outPoint = splitTime === undefined
          ? node.outPoint ?? prev.document.duration
          : node.outPoint ?? prev.document.duration;
        return {
          ...node,
          id,
          originalId,
          attributes: attrs,
          parentId: clonedParentId ?? node.parentId,
          animParentId: node.animParentId && clonedIdMap.has(node.animParentId)
            ? clonedIdMap.get(node.animParentId)!
            : node.animParentId ?? null,
          inPoint,
          outPoint,
          children: node.children.map((child) => cloneNode(child, id)),
        };
      };
      roots.forEach((root) => cloneByRoot.set(root.id, cloneNode(root)));

      const svgDocument = new DOMParser().parseFromString(prev.svgRaw, 'image/svg+xml');
      const svgRoot = svgDocument.documentElement;
      if (svgRoot.tagName.toLowerCase() !== 'svg' || svgDocument.querySelector('parsererror')) {
        addToast('Layer not duplicated', 'The current SVG document could not be updated.', 'error');
        return prev;
      }
      roots.forEach((root) => {
        const source = Array.from(svgRoot.querySelectorAll<SVGElement>('[data-mcu-id]'))
          .find((element) => element.getAttribute('data-mcu-id') === root.id);
        if (!source?.parentElement) return;
        const clone = source.cloneNode(true) as SVGElement;
        Array.from(clone.querySelectorAll<SVGElement>('[data-mcu-id]')).concat(
          clone.hasAttribute('data-mcu-id') ? [clone] : []
        ).forEach((element) => {
          const oldId = element.getAttribute('data-mcu-id');
          if (!oldId) return;
          element.setAttribute('data-mcu-id', clonedIdMap.get(oldId) ?? oldId);
          const currentId = element.getAttribute('id');
          if (currentId) element.setAttribute('id', clonedOriginalIdMap.get(oldId) ?? currentId);
        });
        source.parentElement.insertBefore(clone, source.nextSibling);
      });

      const splitSource = (node: SvgElementNode): SvgElementNode => ({
        ...node,
        outPoint: splitTime === undefined
          ? node.outPoint ?? prev.document.duration
          : Math.max(node.inPoint ?? 0, Math.min(node.outPoint ?? prev.document.duration, splitTime)),
        children: node.children.map(splitSource),
      });
      const insertClones = (nodes: SvgElementNode[]): SvgElementNode[] => nodes.flatMap((node) => {
        const source = splitTime === undefined ? node : splitSource(node);
        const clone = cloneByRoot.get(node.id);
        if (clone) return [source, clone];
        return [{ ...source, children: insertClones(source.children) }];
      });
      const elements = insertClones(prev.elements);
      const sourceIds = new Set(roots.flatMap((root) => flattenElementTree([root]).map((node) => node.id)));
      const tracks = prev.tracks.flatMap((track) => {
        if (!sourceIds.has(track.elementId)) return [track];
        const keyframesForSource = splitTime === undefined
          ? track.keyframes
          : track.keyframes.filter((keyframe) => keyframe.time <= splitTime);
        const originalTrack = splitTime === undefined
          ? track
          : { ...track, keyframes: keyframesForSource };
        const duplicateKeyframes = track.keyframes
          .filter((keyframe) => splitTime === undefined || keyframe.time >= splitTime)
          .map((keyframe) => ({
            ...keyframe,
            id: `kf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          }));
        const clonedElementId = clonedIdMap.get(track.elementId);
        if (!clonedElementId) return [originalTrack];
        return [
          originalTrack,
          {
            ...track,
            id: `track_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            elementId: clonedElementId,
            keyframes: duplicateKeyframes,
          },
        ];
      });
      const selectedIds = roots.map((root) => cloneByRoot.get(root.id)!.id);
      const next = {
        ...prev,
        svgRaw: new XMLSerializer().serializeToString(svgRoot),
        elements,
        tracks,
        selectedElementId: selectedIds[0] ?? null,
        selectedElementIds: selectedIds,
        selectedKeyframeId: null,
        selectedKeyframeIds: [],
      };
      pushHistory(next);
      addToast(splitTime === undefined ? 'Layer duplicated' : 'Layer split', `${selectedIds.length} layer${selectedIds.length === 1 ? '' : 's'} created.`, 'success');
      return next;
    });
  };
  const handleDuplicateLayers = (elementIds: string[]) => cloneLayerSelection(elementIds);
  const handleSplitLayer = (elementIds: string[], requestedTime: number) => {
    const validIds = elementIds.filter((id) => {
      const element = findElementById(project.elements, id);
      return element && requestedTime > (element.inPoint ?? 0) && requestedTime < (element.outPoint ?? project.document.duration);
    });
    if (!validIds.length) {
      addToast('Layer not split', 'Move the playhead inside the selected layer range.', 'warning');
      return;
    }
    cloneLayerSelection(validIds, requestedTime);
  };

  const handleMoveLayersToEdge = (elementIds: string[], edge: 'front' | 'back') => {
    const source = elementIds.map((id) => findElementById(project.elements, id)).find(Boolean);
    if (!source) return;
    const siblings = source.parentId
      ? findElementById(project.elements, source.parentId)?.children ?? []
      : project.elements;
    const selected = new Set(elementIds.filter((id) => siblings.some((node) => node.id === id)));
    if (!selected.size) return;
    const ordered = siblings.filter((node) => selected.has(node.id));
    const remaining = siblings.filter((node) => !selected.has(node.id));
    const nextSiblings = edge === 'front' ? [...remaining, ...ordered] : [...ordered, ...remaining];
    setProject((prev) => {
      const replace = (nodes: SvgElementNode[]): SvgElementNode[] => source.parentId === null && nodes === prev.elements
        ? nextSiblings
        : nodes.map((node) => node.id === source.parentId
          ? { ...node, children: nextSiblings }
          : node.children.length ? { ...node, children: replace(node.children) } : node);
      const document = new DOMParser().parseFromString(prev.svgRaw, 'image/svg+xml');
      const domParent = source.parentId
        ? Array.from(document.querySelectorAll<SVGElement>('[data-mcu-id]')).find((node) => node.getAttribute('data-mcu-id') === source.parentId)
        : document.documentElement;
      if (domParent) {
        nextSiblings.forEach((node) => {
          const domNode = Array.from(document.querySelectorAll<SVGElement>('[data-mcu-id]')).find((item) => item.getAttribute('data-mcu-id') === node.id);
          if (domNode?.parentElement === domParent) domParent.appendChild(domNode);
        });
      }
      const next = {
        ...prev,
        elements: replace(prev.elements),
        svgRaw: new XMLSerializer().serializeToString(document.documentElement),
      };
      pushHistory(next);
      return next;
    });
  };

  const handleDeleteElement = async (
    elementId: string | string[],
    removeProjectItemIds: string[] = []
  ) => {
    const requestedIds = Array.isArray(elementId) ? elementId : [elementId];
    const selectedNodes = requestedIds
      .map((id) => findElementById(project.elements, id))
      .filter((node): node is SvgElementNode => Boolean(node));
    const selectedNode = selectedNodes[0];
    if (!selectedNode) return;
    if (selectedNodes.some((node) => node.locked)) {
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
      selectedNodes.forEach(collectDeleted);
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
        projectItems: (project.projectItems ?? [])
          .filter((item) => !removeProjectItemIds.includes(item.id))
          .map((item) => {
          const layerIds = (item.layerIds ?? (item.layerId ? [item.layerId] : []))
            .filter((id) => !deletedIds.has(id));
          return {
            ...item,
            layerId: layerIds[0],
            layerIds,
          };
          }),
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
      addToast('Layer deleted', `${selectedNodes.map((node) => node.name).join(', ')} and their keyframes were removed.`, 'success');
    } catch (error) {
      addToast(
        'Could not delete layer',
        error instanceof Error ? error.message : 'The selected layer could not be deleted.',
        'error'
      );
    }
  };

  const handleSelectElements = useCallback((ids: string[], primaryId: string | null) => {
    setProject((p) => {
      const nextIds = Array.from(new Set(ids)).filter((id) => Boolean(findElementById(p.elements, id)));
      if (
        p.selectedElementId === primaryId
        && JSON.stringify(p.selectedElementIds ?? []) === JSON.stringify(nextIds)
        && p.selectedKeyframeId === null
        && (!p.selectedKeyframeIds || p.selectedKeyframeIds.length === 0)
      ) {
        return p;
      }
      return {
        ...p,
        selectedElementId: primaryId,
        selectedElementIds: nextIds,
        selectedKeyframeId: null,
        selectedKeyframeIds: [],
      };
    });
  }, []);
  const handleSelectElement = useCallback((id: string | null) => {
    handleSelectElements(id ? [id] : [], id);
  }, [handleSelectElements]);

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
        const currentVal = styles?.[property as Exclude<keyof typeof styles, 'transformMatrix'>];
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
        keyframes: track.keyframes.map((kf): Keyframe =>
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

  const handleNudgeSelectedKeyframes = useCallback((direction: 'left' | 'right', shiftKey = false) => {
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
  }, [pushHistory]);

  const handleUpdateKeyframeEasing = (keyframeId: string, easing: EasingType) => {
    setProject((prev) => {
      const updatedTracks = prev.tracks.map((track) => ({
        ...track,
        keyframes: track.keyframes.map((kf): Keyframe =>
          kf.id === keyframeId
            ? {
              ...kf,
              easing,
              interpolation: easing === 'linear' ? 'linear' : 'bezier',
              ...(easing === 'cubicBezier' && !kf.bezier ? { bezier: [0.25, 0.1, 0.25, 1] as [number, number, number, number] } : {}),
            }
            : kf
        ),
      }));
      const next = { ...prev, tracks: updatedTracks };
      pushHistory(next);
      return next;
    });
  };

  const handleUpdateKeyframeInterpolation = (keyframeId: string, interpolation: KeyframeInterpolation) => {
    setProject((prev) => {
      const updatedTracks = prev.tracks.map((track) => ({
        ...track,
        keyframes: track.keyframes.map((keyframe): Keyframe => {
          if (keyframe.id !== keyframeId) return keyframe;
          if (interpolation === 'linear') return { ...keyframe, interpolation, easing: 'linear' as const };
          if (interpolation === 'hold') return { ...keyframe, interpolation };
          const easing = keyframe.easing === 'linear' ? 'cubicBezier' : keyframe.easing;
          return {
            ...keyframe,
            interpolation,
            easing,
            ...(easing === 'cubicBezier' && !keyframe.bezier
              ? { bezier: [0.25, 0.1, 0.25, 1] as [number, number, number, number] }
              : {}),
          };
        }),
      }));
      const next = { ...prev, tracks: updatedTracks };
      pushHistory(next);
      return next;
    });
  };

  const handlePasteKeyframes = (
    elementId: string,
    time: number,
    entries: KeyframeClipboardEntry[]
  ) => {
    if (!entries.length || !findElementById(project.elements, elementId)) return;
    setProject((prev) => {
      const safeTime = clampTimelineTime(time, prev.document.duration);
      const tracks = [...prev.tracks];
      entries.forEach((entry) => {
        const keyframe: Keyframe = {
          id: `kf_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          time: clampTimelineTime(safeTime + entry.offset, prev.document.duration),
          value: entry.value,
          easing: entry.easing,
          ...(entry.interpolation ? { interpolation: entry.interpolation } : {}),
          ...(entry.bezier ? { bezier: entry.bezier } : {}),
        };
        const trackIndex = tracks.findIndex(
          (track) => track.elementId === elementId && track.property === entry.property
        );
        if (trackIndex >= 0) {
          tracks[trackIndex] = {
            ...tracks[trackIndex],
            keyframes: [...tracks[trackIndex].keyframes, keyframe]
              .sort((a, b) => a.time - b.time),
          };
        } else {
          tracks.push({
            id: `track_${elementId}_${entry.property}_${Date.now()}`,
            elementId,
            property: entry.property,
            keyframes: [keyframe],
          });
        }
      });
      const next = { ...prev, tracks };
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
        } else if (project.selectedElementIds?.length) {
          e.preventDefault();
          void keyboardActionsRef.current?.deleteElement(project.selectedElementIds);
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
    project.selectedElementIds,
    project.selectedKeyframeId,
    project.selectedKeyframeIds,
    handleNudgeSelectedKeyframes,
  ]);

  const selectedLayer = project.selectedElementId
    ? findElementById(project.elements, project.selectedElementId)
    : null;
  const canCutSelectedImage = Boolean(
    selectedLayer
    && rasterSourceRef.current.some((source) => source.elementOriginalId === selectedLayer.originalId)
  );

  const handleCreateProjectFolder = (parentId?: string) => {
    const name = window.prompt('Folder name');
    if (!name?.trim()) return;
    const folder: ProjectItem = {
      id: `folder-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim(),
      type: 'folder',
      kind: 'folder',
      parentId: parentId ?? null,
      createdAt: new Date().toISOString(),
    };
    setProject((current) => {
      const next = { ...current, projectItems: [...(current.projectItems ?? []), folder] };
      pushHistory(next);
      return next;
    });
  };

  const handleRenameProjectItem = (item: ProjectItem, name: string) => {
    setProject((current) => {
      const projectItems = (current.projectItems ?? []).map((candidate) =>
        candidate.id === item.id ? { ...candidate, name } : candidate
      );
      const next = item.type === 'composition'
        ? {
          ...current,
          name,
          document: { ...current.document, name },
          compositions: (current.compositions ?? []).map((composition) =>
            composition.id === item.id ? { ...composition, name } : composition
          ),
          projectItems,
        }
        : { ...current, projectItems };
      pushHistory(next);
      return next;
    });
  };

  const handleMoveProjectItem = (itemId: string, parentId: string | null) => {
    const items = project.projectItems ?? [];
    const item = items.find((candidate) => candidate.id === itemId);
    if (!item || item.type === 'composition' || itemId === parentId) return;
    let ancestor = parentId;
    while (ancestor) {
      if (ancestor === itemId) return;
      ancestor = items.find((candidate) => candidate.id === ancestor)?.parentId ?? null;
    }
    setProject((current) => {
      const next = {
        ...current,
        projectItems: (current.projectItems ?? []).map((candidate) =>
          candidate.id === itemId ? { ...candidate, parentId } : candidate
        ),
      };
      pushHistory(next);
      return next;
    });
  };

  const handleDeleteProjectItem = (item: ProjectItem) => {
    const items = project.projectItems ?? [];
    const removedIds = new Set([item.id]);
    let foundChild = true;
    while (foundChild) {
      foundChild = false;
      items.forEach((candidate) => {
        if (candidate.parentId && removedIds.has(candidate.parentId) && !removedIds.has(candidate.id)) {
          removedIds.add(candidate.id);
          foundChild = true;
        }
      });
    }
    const removedItems = items.filter((candidate) => removedIds.has(candidate.id));
    const layerIds = [...new Set(removedItems.flatMap((candidate) => [
      ...(candidate.layerIds ?? []),
      ...(candidate.layerId ? [candidate.layerId] : []),
    ]))].filter((layerId) => Boolean(findElementById(project.elements, layerId)));
    if (layerIds.length && !window.confirm(`Delete "${item.name}" and its ${layerIds.length} linked layer${layerIds.length === 1 ? '' : 's'}?`)) return;
    if (layerIds.length) {
      void handleDeleteElement(layerIds, [...removedIds]);
      return;
    }
    setProject((current) => {
      const next = {
        ...current,
        projectItems: (current.projectItems ?? []).filter((candidate) => !removedIds.has(candidate.id)),
      };
      pushHistory(next);
      return next;
    });
  };

  const handleOpenComposition = (item: ProjectItem) => {
    if (item.type === 'composition' && item.id !== project.compositions?.[0]?.id) {
      addToast('Composition unavailable', 'This project currently has one active composition.', 'info');
    }
  };

  const handleUpdateWorkArea = (start: number, end: number) => {
    setProject((current) => {
      const safeStart = clampTimelineTime(start, current.document.duration);
      const safeEnd = Math.max(safeStart, clampTimelineTime(end, current.document.duration));
      return { ...current, workArea: { start: safeStart, end: safeEnd } };
    });
  };

  const handleAlignLayers = (action: string) => {
    const selectedIds = project.selectedElementIds?.length
      ? project.selectedElementIds
      : project.selectedElementId ? [project.selectedElementId] : [];
    const nodes = selectedIds
      .map((id) => findElementById(project.elements, id))
      .filter((node): node is SvgElementNode => Boolean(node?.bbox));
    const distribute = action.startsWith('distribute-');
    const minimum = distribute ? 3 : alignTo === 'selection' ? 2 : 1;
    if (nodes.length < minimum) return;
    setProject((previous) => {
      const picked = selectedIds
        .map((id) => findElementById(previous.elements, id))
        .filter((node): node is SvgElementNode => Boolean(node?.bbox));
      if (picked.length < minimum) return previous;
      const rects = picked.map((node) => {
        const style = computeElementStylesAtTime(previous.tracks, node.id, previous.currentTime, node.initialTransform);
        const x = node.bbox!.x + style.x;
        const y = node.bbox!.y + style.y;
        return { node, style, x, y, right: x + node.bbox!.width, bottom: y + node.bbox!.height };
      });
      const minX = alignTo === 'composition' ? 0 : Math.min(...rects.map((rect) => rect.x));
      const maxX = alignTo === 'composition' ? previous.document.width : Math.max(...rects.map((rect) => rect.right));
      const minY = alignTo === 'composition' ? 0 : Math.min(...rects.map((rect) => rect.y));
      const maxY = alignTo === 'composition' ? previous.document.height : Math.max(...rects.map((rect) => rect.bottom));
      let ordered = rects;
      if (distribute) {
        const vertical = action.endsWith('top') || action.endsWith('v-center') || action.endsWith('bottom');
        const key = vertical ? (action.endsWith('top') ? 'y' : action.endsWith('bottom') ? 'bottom' : 'centerY')
          : (action.endsWith('left') ? 'x' : action.endsWith('right') ? 'right' : 'centerX');
        ordered = [...rects].sort((a, b) => {
          const aValue = key === 'centerY' ? a.y + (a.bottom - a.y) / 2 : key === 'centerX' ? a.x + (a.right - a.x) / 2 : a[key];
          const bValue = key === 'centerY' ? b.y + (b.bottom - b.y) / 2 : key === 'centerX' ? b.x + (b.right - b.x) / 2 : b[key];
          return aValue - bValue;
        });
      }
      const axis = action.endsWith('top') || action.endsWith('v-center') || action.endsWith('bottom')
        ? 'y'
        : action.includes('horizontal') || action.endsWith('left') || action.endsWith('h-center') || action.endsWith('right')
          ? 'x'
          : action;
      let elements = previous.elements;
      let svgRaw = previous.svgRaw;
      let tracks = [...previous.tracks];
      const updateValue = (node: SvgElementNode, property: 'x' | 'y', value: number) => {
        const trackIndex = tracks.findIndex((track) => track.elementId === node.id && track.property === property && track.keyframes.length > 0);
        if (trackIndex >= 0) {
          const track = tracks[trackIndex];
          const frameIndex = track.keyframes.findIndex((frame) => Math.abs(frame.time - previous.currentTime) < 0.0001);
          const keyframes = [...track.keyframes];
          if (frameIndex >= 0) keyframes[frameIndex] = { ...keyframes[frameIndex], value };
          else keyframes.push({ id: `kf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, time: previous.currentTime, value, easing: 'linear' });
          tracks[trackIndex] = { ...track, keyframes: keyframes.sort((a, b) => a.time - b.time) };
        } else {
          const update = { [property]: value };
          svgRaw = updateSvgBaseTransform(svgRaw, node.id, node.initialTransform, node.initialAppearance, update);
          elements = updateElementTreeBaseStyle(elements, node.id, update);
        }
      };
      const targetEdge = (rect: typeof rects[number], index: number) => {
        if (action === 'distribute-left' || action === 'distribute-right' || action === 'distribute-h-center') {
          const first = ordered[0];
          const last = ordered[ordered.length - 1];
          const span = action.endsWith('left') ? last.x - first.x : action.endsWith('right') ? last.right - first.right : (last.x + last.right - first.x - first.right) / 2;
          const step = span / (ordered.length - 1);
          const current = ordered[index];
          return action.endsWith('left') ? first.x + step * index
            : action.endsWith('right') ? first.right + step * index - (current.right - current.x)
              : (first.x + first.right) / 2 + step * index - (current.right - current.x) / 2;
        }
        if (action === 'distribute-top' || action === 'distribute-bottom' || action === 'distribute-v-center') {
          const first = ordered[0];
          const last = ordered[ordered.length - 1];
          const span = action.endsWith('top') ? last.y - first.y : action.endsWith('bottom') ? last.bottom - first.bottom : (last.y + last.bottom - first.y - first.bottom) / 2;
          const step = span / (ordered.length - 1);
          const current = ordered[index];
          return action.endsWith('top') ? first.y + step * index
            : action.endsWith('bottom') ? first.bottom + step * index - (current.bottom - current.y)
              : (first.y + first.bottom) / 2 + step * index - (current.bottom - current.y) / 2;
        }
        return axis === 'x' ? minX : minY;
      };
      ordered.forEach((rect, index) => {
        const horizontalAction = ['left', 'h-center', 'right', 'distribute-left', 'distribute-h-center', 'distribute-right'].includes(action);
        const prop = horizontalAction ? 'x' : 'y';
        const target = distribute ? targetEdge(rect, index)
          : action === 'left' ? (alignTo === 'composition' ? 0 : minX)
            : action === 'right' ? maxX - (rect.right - rect.x)
              : action === 'h-center' ? (minX + maxX) / 2 - (rect.right - rect.x) / 2
                : action === 'top' ? (alignTo === 'composition' ? 0 : minY)
                  : action === 'bottom' ? maxY - (rect.bottom - rect.y)
                    : (minY + maxY) / 2 - (rect.bottom - rect.y) / 2;
        const delta = target - (horizontalAction ? rect.x : rect.y);
        updateValue(rect.node, prop, rect.style[prop] + delta);
      });
      const next = { ...previous, svgRaw, elements, tracks };
      pushHistory(next);
      return next;
    });
  };

  const handleApplyCharacterPreset = (presetId: string) => {
    const preset = CHARACTER_PRESETS.find((candidate) => candidate.id === presetId);
    if (!preset) return;
    const missing = preset.requiredSlots.filter((slot) => !project.characterSlots?.[slot]);
    if (missing.length) {
      addToast('Character preset not applied', `Assign the required character slots first: ${missing.join(', ')}.`, 'warning');
      return;
    }
    setProject((previous) => {
      const tracks = preset.generateTracks(previous.characterSlots ?? {}, previous.document.duration);
      const next = { ...previous, tracks: [...previous.tracks, ...tracks] };
      pushHistory(next);
      return next;
    });
    addToast('Character animation applied', preset.name, 'success');
  };

  const handleExportJobStatus = (status: 'Rendering' | 'Done' | 'Failed', format: string, error?: string) => {
    setRenderJobs((jobs) => {
      if (status === 'Rendering') {
        return [...jobs, {
          id: `render-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          format,
          compName: project.document.name || project.name,
          status,
          progress: 0,
          startedAt: Date.now(),
        }];
      }
      const index = jobs.findLastIndex((job) => job.status === 'Rendering' && job.format === format);
      if (index < 0) return jobs;
      const updated = [...jobs];
      updated[index] = { ...updated[index], status, finishedAt: Date.now(), error };
      return updated;
    });
    if (status === 'Rendering') {
      setWorkspaceLayout((layout) => ({
        ...layout,
        bottomTab: 'renderQueue',
        visiblePanels: layout.visiblePanels.includes('Render Queue') ? layout.visiblePanels : [...layout.visiblePanels, 'Render Queue'],
      }));
    }
  };

  const handleExportJobProgress = (progress: number, format: string) => {
    setRenderJobs((jobs) => {
      const index = jobs.findLastIndex((job) => job.status === 'Rendering' && job.format === format);
      if (index < 0) return jobs;
      const updated = [...jobs];
      updated[index] = { ...updated[index], progress: Math.max(0, Math.min(100, progress)) };
      return updated;
    });
  };

  const dockPanelNames = ['Info', 'Audio', 'Preview', 'Properties', 'Align', 'Presets', 'Character', 'Text'];
  const selectedLayerIds = project.selectedElementIds?.length
    ? project.selectedElementIds
    : project.selectedElementId ? [project.selectedElementId] : [];
  const validSelectedLayers = selectedLayerIds
    .map((id) => findElementById(project.elements, id))
    .filter((node): node is SvgElementNode => Boolean(node?.bbox));
  const alignButtonRows = [
    [
      { action: 'left', label: 'Align left edge', icon: <AlignHorizontalJustifyStart /> },
      { action: 'h-center', label: 'Align horizontal centers', icon: <AlignHorizontalJustifyCenter /> },
      { action: 'right', label: 'Align right edge', icon: <AlignHorizontalJustifyEnd /> },
      { action: 'top', label: 'Align top edge', icon: <AlignVerticalJustifyStart /> },
      { action: 'v-center', label: 'Align vertical centers', icon: <AlignVerticalJustifyCenter /> },
      { action: 'bottom', label: 'Align bottom edge', icon: <AlignVerticalJustifyEnd /> },
    ],
    [
      { action: 'distribute-left', label: 'Distribute left edges', icon: <AlignHorizontalDistributeStart /> },
      { action: 'distribute-h-center', label: 'Distribute horizontal centers', icon: <AlignHorizontalDistributeCenter /> },
      { action: 'distribute-right', label: 'Distribute right edges', icon: <AlignHorizontalDistributeEnd /> },
      { action: 'distribute-top', label: 'Distribute top edges', icon: <AlignVerticalDistributeStart /> },
      { action: 'distribute-v-center', label: 'Distribute vertical centers', icon: <AlignVerticalDistributeCenter /> },
      { action: 'distribute-bottom', label: 'Distribute bottom edges', icon: <AlignVerticalDistributeEnd /> },
    ],
  ];
  const visiblePresets = ANIMATION_PRESETS.filter((preset) =>
    `${preset.name} ${preset.description} ${preset.category}`.toLowerCase().includes(presetSearch.toLowerCase())
  );
  const browserMemory = typeof performance !== 'undefined'
    ? (performance as Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory
    : undefined;

  return (
    <div
      ref={studioContainerRef}
      className={`svg-motion-studio flex flex-col h-full w-full bg-[var(--main-bg)] text-foreground overflow-hidden font-sans transition-colors ${
        isFullscreen ? 'fixed inset-0 z-[100] h-screen w-screen' : ''
      }`}
    >
      <WorkspaceChrome
        activeTool={activeTool}
        snapping={snapping}
        workspace={workspaceLayout.workspace}
        openPanels={workspaceLayout.openPanels}
        visiblePanels={workspaceLayout.visiblePanels}
        onSaveProject={handleSaveProject}
        onLoadProjectFile={handleLoadProjectFile}
        onOpenArtworkFile={(file) => void handleOpenSvgFile(file)}
        onExport={() => setIsExportOpen(true)}
        onNewComposition={() => setCompositionDialog('create')}
        onCompositionSettings={handleCompositionSettings}
        onSetWorkArea={() => handleUpdateWorkArea(0, project.document.duration)}
        onToggleAi={() => setIsAiAssistantOpen((open) => !open)}
        onOpenVeo={() => setIsVeoVideoModalOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onTogglePanel={(panel) => {
          const isVisible = workspaceLayout.visiblePanels.includes(panel);
          const visiblePanels = isVisible
            ? workspaceLayout.visiblePanels.filter((candidate) => candidate !== panel)
            : [...workspaceLayout.visiblePanels, panel];
          setWorkspaceLayout((layout) => {
            const openPanels = isVisible
              ? layout.openPanels
              : layout.openPanels.includes(panel) ? layout.openPanels : [...layout.openPanels, panel];
            if (panel === 'Project' || panel === 'Layers') {
              const other = panel === 'Project' ? 'Layers' : 'Project';
              const nextActivePanel = isVisible && visiblePanels.includes(other)
                ? other === 'Project' ? 'project' : 'layers'
                : panel === 'Project' ? 'project' : 'layers';
              return {
                ...layout,
                activeLeftPanel: nextActivePanel,
                visiblePanels,
                openPanels,
              };
            }
            if (panel === 'Timeline' || panel === 'Render Queue') {
              return {
                ...layout,
                visiblePanels,
                openPanels,
                bottomTab: panel === 'Timeline' ? 'timeline' : 'renderQueue',
              };
            }
            return { ...layout, visiblePanels, openPanels };
          });
          if (panel === 'Project' || panel === 'Layers') {
            const other = panel === 'Project' ? 'Layers' : 'Project';
            setIsLeftCollapsed(isVisible && !visiblePanels.includes(other));
          }
        }}
        onOpenHome={() => { window.location.href = '/dashboard'; }}
        onFilterShortcuts={setShortcutSearch}
        onAddShape={() => handleAddElement('rect')}
        onAddText={() => handleAddElement('text')}
        onSetTool={setActiveTool}
        onToggleSnapping={() => setSnapping((value) => !value)}
        onSetWorkspace={setWorkspace}
        onResetWorkspace={() => {
          setWorkspace('Default');
          setWorkspaceLayout((layout) => ({
            ...layout,
            openPanels: ['Info', 'Preview', 'Properties'],
            visiblePanels: ['Project', 'Layers', 'Info', 'Audio', 'Preview', 'Properties', 'Align', 'Presets', 'Character', 'Text', 'Timeline', 'Render Queue'],
            bottomTab: 'timeline',
          }));
        }}
        onSaveWorkspace={() => {
          try {
            localStorage.setItem(`mcu_svg_motion_saved_workspace:${getAuthUser()?.id || 'guest'}`, JSON.stringify(workspaceLayout));
            addToast('Workspace saved', '', 'success');
          } catch (error) {
            console.error('[Motion Studio] Unable to save the workspace:', error);
            addToast('Workspace not saved', 'Browser storage is unavailable.', 'error');
          }
        }}
      />

      {/* 2. MIDDLE WORKSPACE (Layers | Canvas | Inspector) */}
      <div className="svg-motion-workspace flex-1 flex overflow-hidden relative min-h-0">
        {/* Left Layers Sidebar */}
        {!isLeftCollapsed && (
          <>
            <div
              className="flex h-full min-h-0 shrink-0 flex-col"
              style={{ width: workspaceLayout.leftWidth, flexBasis: workspaceLayout.leftWidth }}
            >
              <div className="flex h-8 shrink-0 items-center gap-1 border-b border-[var(--card-border)] bg-[var(--card-bg)] px-2">
                {(['project', 'layers'] as const).filter((panel) =>
                  workspaceLayout.visiblePanels.includes(panel === 'project' ? 'Project' : 'Layers')
                ).map((panel) => (
                  <button
                    key={panel}
                    type="button"
                    onClick={() => setWorkspaceLayout((layout) => ({ ...layout, activeLeftPanel: panel }))}
                    aria-pressed={workspaceLayout.activeLeftPanel === panel}
                    className={`h-full border-b-2 px-2 text-[9px] font-bold uppercase tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      workspaceLayout.activeLeftPanel === panel
                        ? 'border-primary text-primary'
                        : 'border-transparent text-[var(--text-muted)] hover:text-foreground'
                    }`}
                  >
                    {panel}
                  </button>
                ))}
              </div>
              <div className="min-h-0 flex-1">
                {workspaceLayout.activeLeftPanel === 'project' ? (
                  <ProjectPanel
                    project={project}
                    sort={workspaceLayout.projectSort}
                    onSortChange={(projectSort) => setWorkspaceLayout((layout) => ({ ...layout, projectSort }))}
                    onOpenFile={handleOpenSvgFile}
                    onCreateFolder={handleCreateProjectFolder}
                    onDeleteItem={handleDeleteProjectItem}
                    onRenameItem={handleRenameProjectItem}
                    onMoveItem={handleMoveProjectItem}
                    onSelectLayer={handleSelectElement}
                    onOpenComposition={handleOpenComposition}
                  />
                ) : (
                  <LayersPanel
                    elements={project.elements}
                    selectedElementId={project.selectedElementId}
                    selectedElementIds={project.selectedElementIds}
                    onSelectElement={handleSelectElement}
                    onSelectElements={handleSelectElements}
                    onToggleVisibility={handleToggleVisibility}
                    onToggleLock={handleToggleLock}
                    onRenameElement={handleRenameElement}
                    onMoveElement={handleMoveElement}
                    onDeleteElement={(id) => void handleDeleteElement(id)}
                    tracks={project.tracks}
                    isSingleFlattenedPath={project.isSingleFlattenedPath}
                    style={{ width: '100%', flexBasis: '100%' }}
                  />
                )}
              </div>
            </div>
            <div
              role="separator"
              aria-label="Resize project layers panel"
              aria-orientation="vertical"
              aria-valuemin={160}
              aria-valuemax={520}
              aria-valuenow={Math.round(workspaceLayout.leftWidth)}
              tabIndex={0}
              onKeyDown={(event) => handleResizeKeyDown(event, 'left')}
              onPointerDown={(event) => {
                event.preventDefault();
                resizingPanelRef.current = 'left';
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                if (resizingPanelRef.current === 'left') resizePanel('left', event.clientX);
              }}
              onPointerUp={() => { resizingPanelRef.current = null; }}
              onPointerCancel={() => { resizingPanelRef.current = null; }}
              className="svg-motion-panel-resize z-20 w-1.5 shrink-0 touch-none cursor-col-resize border-r border-[var(--card-border)] bg-[var(--card-bg)] transition-colors hover:bg-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
              title="Drag or use arrow keys to resize the layers panel"
            />
          </>
        )}

        {/* Center Canvas Viewport */}
        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-6 shrink-0 items-center gap-1 border-b border-[#121212] bg-[var(--st-panel)] px-2 text-[10px]">
          <button type="button" aria-label="Close composition" title="Close composition" onClick={() => setProject((current) => ({
            ...current,
            compositions: [],
            projectItems: (current.projectItems ?? []).filter((item) => item.type !== 'composition'),
          }))} className="text-[#888] hover:text-white">×</button>
          <Lock className="h-3 w-3 text-[#888]" />
          <span className="text-[#aaa]">Composition</span>
          <span className="text-[var(--st-accent)]">{project.compositions?.[0]?.name ?? '(none)'}</span>
          <button type="button" aria-label="Composition options" title="Composition options" aria-expanded={viewerMenuOpen} onClick={() => setViewerMenuOpen((open) => !open)} className="ml-1 text-[#888] hover:text-white">
            <Menu className="h-3 w-3" />
          </button>
          {viewerMenuOpen && <div className="absolute left-24 top-6 z-[75] border border-[#121212] bg-[var(--st-panel)] p-1 shadow-xl">
            <button type="button" onClick={() => { handleCompositionSettings(); setViewerMenuOpen(false); }} className="block px-2 py-1.5 text-left text-[10px] hover:text-[var(--st-accent)]">Composition Settings</button>
            <button type="button" onClick={() => { setViewerLocked((locked) => !locked); setViewerMenuOpen(false); }} className="block px-2 py-1.5 text-left text-[10px] hover:text-[var(--st-accent)]">{viewerLocked ? 'Unlock Viewer' : 'Lock Viewer'}</button>
          </div>}
          <button type="button" onClick={() => setViewerLocked((locked) => !locked)} aria-pressed={viewerLocked} aria-label={viewerLocked ? 'Unlock viewer' : 'Lock viewer'} title={viewerLocked ? 'Unlock viewer' : 'Lock viewer'} className="ml-auto text-[#888] hover:text-white">
            {viewerLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
          </button>
        </div>
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
          activeTool={activeTool}
          snapping={snapping}
          renderScale={workspaceLayout.previewQuality === 'Auto' || workspaceLayout.previewQuality === 'Full'
            ? 1
            : workspaceLayout.previewQuality === 'Half'
              ? 0.5
              : workspaceLayout.previewQuality === 'Third'
                ? 1 / 3
                : 0.25}
          onAddProjectItem={handleAddProjectItem}
          onCreateComposition={() => setCompositionDialog('create')}
          onOpenArtworkPicker={() => document.getElementById('motion-studio-artwork-input')?.click()}
          onPointerInfo={(x, y, color) => {
            if (pointerReadoutRef.current) pointerReadoutRef.current.textContent = `${x}, ${y} · ${color}`;
          }}
          quality={workspaceLayout.previewQuality}
          onQualityChange={(previewQuality) => setWorkspaceLayout((layout) => ({ ...layout, previewQuality }))}
          onToggleGrid={() => setShowGrid((value) => !value)}
          onToggleSafeArea={() => setShowSafeArea((value) => !value)}
          onToggleCheckerboard={() => setCanvasBg((value) => value === 'checkerboard' ? project.document.backgroundColor : 'checkerboard')}
          onSeek={handleSeek}
        />
        </div>

        {/* Right-side accordion dock */}
        {!isRightCollapsed && (
          <>
            <div
              role="separator"
              aria-label="Resize properties panel"
              aria-orientation="vertical"
              aria-valuemin={160}
              aria-valuemax={520}
              aria-valuenow={Math.round(workspaceLayout.rightWidth)}
              tabIndex={0}
              onKeyDown={(event) => handleResizeKeyDown(event, 'right')}
              onPointerDown={(event) => {
                event.preventDefault();
                resizingPanelRef.current = 'right';
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                if (resizingPanelRef.current === 'right') resizePanel('right', event.clientX);
              }}
              onPointerUp={() => { resizingPanelRef.current = null; }}
              onPointerCancel={() => { resizingPanelRef.current = null; }}
              className="svg-motion-panel-resize z-20 w-1.5 shrink-0 touch-none cursor-col-resize border-l border-[var(--card-border)] bg-[var(--card-bg)] transition-colors hover:bg-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
              title="Drag or use arrow keys to resize the properties panel"
            />
            <aside
              className="flex h-full min-h-0 shrink-0 flex-col overflow-y-auto bg-[var(--st-panel)]"
              style={{ width: workspaceLayout.rightWidth, flexBasis: workspaceLayout.rightWidth }}
            >
              {dockPanelNames.filter((name) => workspaceLayout.visiblePanels.includes(name))
                .filter((name) => !maximizedDockPanel || name === maximizedDockPanel)
                .map((name) => {
                  const isOpen = workspaceLayout.openPanels.includes(name) || maximizedDockPanel === name;
                  const selectedNode = project.selectedElementId ? findElementById(project.elements, project.selectedElementId) : null;
                  return (
                    <section key={name} className="shrink-0 border-b border-[#121212]">
                      <div className={`flex h-[30px] items-center justify-between border-b border-[#121212] px-2 ${isOpen ? 'text-[var(--st-accent)]' : 'text-[#aaa]'}`}>
                        <button type="button" onClick={(event) => setWorkspaceLayout((layout) => ({
                          ...layout,
                          openPanels: event.altKey
                            ? (isOpen && layout.openPanels.length === 1 ? [] : [name])
                            : isOpen ? layout.openPanels.filter((panel) => panel !== name) : [...layout.openPanels, name],
                        }))} aria-expanded={isOpen} className="flex h-full flex-1 items-center gap-2 text-left text-[11px] hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--st-accent)]">
                          <span>{isOpen ? '▾' : '▸'}</span>{name}
                        </button>
                        <div className="relative">
                          <button type="button" aria-label={`${name} panel options`} title={`${name} panel options`} aria-expanded={dockMenuId === name}
                            onClick={() => setDockMenuId((current) => current === name ? null : name)} className="flex h-6 w-6 items-center justify-center text-[#888] hover:text-white">
                            <Menu className="h-3 w-3" />
                          </button>
                          {dockMenuId === name && <div className="absolute right-0 top-full z-[70] min-w-36 border border-[#121212] bg-[var(--st-panel)] p-1 shadow-xl">
                            <button type="button" onClick={() => { setWorkspaceLayout((layout) => ({ ...layout, visiblePanels: layout.visiblePanels.filter((panel) => panel !== name) })); setDockMenuId(null); }}
                              className="block w-full px-2 py-1.5 text-left text-[10px] hover:text-[var(--st-accent)]">Close</button>
                            <button type="button" onClick={() => { setMaximizedDockPanel((current) => current === name ? null : name); setDockMenuId(null); }}
                              className="block w-full px-2 py-1.5 text-left text-[10px] hover:text-[var(--st-accent)]">{maximizedDockPanel === name ? 'Restore panel' : 'Maximise panel'}</button>
                            <button type="button" onClick={() => { setWorkspace('Default'); setMaximizedDockPanel(null); setDockMenuId(null); }}
                              className="block w-full px-2 py-1.5 text-left text-[10px] hover:text-[var(--st-accent)]">Reset layout</button>
                          </div>}
                        </div>
                      </div>
                      {isOpen && (
                        <div className={`min-h-0 overflow-y-auto ${maximizedDockPanel === name ? 'max-h-full' : 'max-h-[min(42vh,360px)]'}`}>
                          {name === 'Info' && (
                            <div className="space-y-1.5 p-2 text-[10px] text-[#aaa]">
                              <div className="flex justify-between gap-2"><span>Pointer</span><span ref={pointerReadoutRef}>Move over viewer</span></div>
                              <div className="flex justify-between gap-2"><span>Composition</span><span className="truncate text-right text-[#ddd]">{project.compositions?.[0]?.name ?? 'None'}</span></div>
                              {selectedNode ? <>
                                <div className="flex justify-between gap-2"><span>Layer</span><span className="truncate text-right text-[#ddd]">{selectedNode.name}</span></div>
                                <div className="flex justify-between gap-2"><span>In / Out</span><span>{(selectedNode.inPoint ?? 0).toFixed(2)} / {(selectedNode.outPoint ?? project.document.duration).toFixed(2)} s</span></div>
                                <div className="flex justify-between gap-2"><span>Duration</span><span>{((selectedNode.outPoint ?? project.document.duration) - (selectedNode.inPoint ?? 0)).toFixed(2)} s</span></div>
                              </> : <span>No layer selected.</span>}
                            </div>
                          )}
                          {name === 'Audio' && <div className="p-3 text-[10px] text-[#888]">No audio track in this composition.</div>}
                          {name === 'Preview' && <PreviewPanel
                            project={project}
                            tab="info"
                            quality={workspaceLayout.previewQuality}
                            playbackTimeRef={playbackTimeRef}
                            renderedProgressRef={renderedProgressRef}
                            onTabChange={() => undefined}
                            onQualityChange={(previewQuality) => setWorkspaceLayout((layout) => ({ ...layout, previewQuality }))}
                            onTogglePlay={handleTogglePlayback}
                            onSeek={handleSeek}
                            onToggleLoop={handleToggleLoop}
                            onUpdateWorkArea={handleUpdateWorkArea}
                            embedded
                          />}
                          {name === 'Properties' && <Inspector
                            project={project}
                            selectedElementId={project.selectedElementId}
                            selectedKeyframeId={project.selectedKeyframeId}
                            onUpdateDocumentSettings={(settings) => setProject((p) => ({ ...p, document: { ...p.document, ...settings } }))}
                            onUpdateTransformProperty={handleUpdateTransformProperty}
                            onToggleKeyframe={handleToggleKeyframe}
                            onApplyPreset={handleApplyPreset}
                            onUpdateKeyframe={(kfId, updates) => setProject((p) => {
                              const safeUpdates = updates.time === undefined ? updates : { ...updates, time: clampTimelineTime(updates.time, p.document.duration) };
                              return { ...p, tracks: p.tracks.map((t) => ({ ...t, keyframes: t.keyframes.map((k) => k.id === kfId ? { ...k, ...safeUpdates } : k) })) };
                            })}
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
                            style={{ width: '100%', minHeight: 180 }}
                          />}
                          {name === 'Align' && (
                            <div className="space-y-2 p-2">
                              <label className="flex items-center justify-between text-[10px] text-[#aaa]">
                                Align layers to
                                <select value={alignTo} onChange={(event) => setAlignTo(event.target.value as 'selection' | 'composition')} className="motion-studio-select rounded border border-[#121212] bg-[#1d1d1d] px-1.5 py-1 text-[10px] text-white">
                                  <option value="selection">Selection</option><option value="composition">Composition</option>
                                </select>
                              </label>
                              {alignButtonRows.map((row, rowIndex) => (
                                <div key={rowIndex} className="grid grid-cols-6 gap-1">
                                  {row.map(({ action, label, icon }) => {
                                    const required = action.startsWith('distribute-') ? 3 : alignTo === 'composition' ? 1 : 2;
                                    const disabled = validSelectedLayers.length < required;
                                    return <button key={action} type="button" disabled={disabled} aria-label={label} title={label} onClick={() => handleAlignLayers(action)}
                                      className="flex h-7 items-center justify-center rounded border border-[#121212] text-[#aaa] hover:bg-white/5 hover:text-[var(--st-accent)] disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--st-accent)]">
                                      {React.cloneElement(icon, { className: 'h-3.5 w-3.5' })}
                                    </button>;
                                  })}
                                </div>
                              ))}
                            </div>
                          )}
                          {name === 'Presets' && <div className="space-y-1 p-2">
                            <input type="search" value={presetSearch} onChange={(event) => setPresetSearch(event.target.value)} placeholder="Search presets" aria-label="Search animation presets" className="mb-1 h-7 w-full border border-[#121212] bg-[#1d1d1d] px-2 text-[10px] text-white outline-none focus:border-[var(--st-accent)]" />
                            {visiblePresets.map((preset) => <button key={preset.id} type="button" disabled={!project.selectedElementId}
                              onDoubleClick={() => project.selectedElementId && handleApplyPreset(project.selectedElementId, preset.id)}
                              title={`${preset.description} — double-click to apply`}
                              className="block w-full border-b border-[#121212] px-1 py-1.5 text-left text-[10px] text-[#ccc] hover:text-[var(--st-accent)] disabled:opacity-40">
                              <span className="block font-medium">{preset.name}</span><span className="text-[9px] text-[#888]">{preset.category} · Double-click to apply</span>
                            </button>)}
                          </div>}
                          {name === 'Character' && <div className="space-y-2 p-2">
                            <button type="button" onClick={() => setProject((previous) => {
                              const next = { ...previous, characterSlots: autoDetectCharacterSlots(previous.elements) };
                              pushHistory(next);
                              return next;
                            })} className="border border-[#121212] px-2 py-1 text-[10px] text-[#ccc] hover:text-[var(--st-accent)]">Auto-detect parts</button>
                            {(['head', 'hair', 'eyes', 'mouth', 'body', 'left_arm', 'right_arm', 'left_leg', 'right_leg'] as const).map((slot) => (
                              <label key={slot} className="flex items-center justify-between gap-2 text-[9px] capitalize text-[#aaa]">
                                {slot.replace('_', ' ')}
                                <select value={project.characterSlots?.[slot] ?? ''} onChange={(event) => setProject((previous) => ({ ...previous, characterSlots: { ...previous.characterSlots, [slot]: event.target.value || undefined } }))} aria-label={`Character ${slot} layer`} className="motion-studio-select max-w-32 rounded border border-[#121212] bg-[#1d1d1d] px-1 py-1 text-[9px] text-white">
                                  <option value="">Unassigned</option>{flattenElementTree(project.elements).map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
                                </select>
                              </label>
                            ))}
                            {CHARACTER_PRESETS.map((preset) => <button key={preset.id} type="button" onClick={() => handleApplyCharacterPreset(preset.id)} className="block w-full border-t border-[#121212] py-1.5 text-left text-[10px] text-[#ccc] hover:text-[var(--st-accent)]">{preset.name}</button>)}
                          </div>}
                          {name === 'Text' && <div className="p-2">
                            {selectedNode?.tagName === 'text' ? <>
                              <label className="mb-1 block text-[9px] text-[#888]">Text content</label>
                              <textarea value={selectedNode.textContent ?? ''} onChange={(event) => handleUpdateElementText(selectedNode.id, event.target.value)} aria-label="Selected text layer content" className="min-h-20 w-full border border-[#121212] bg-[#1d1d1d] p-2 text-[10px] text-white outline-none focus:border-[var(--st-accent)]" />
                            </> : <span className="text-[10px] text-[#888]">Select a text layer to edit its content.</span>}
                          </div>}
                        </div>
                      )}
                    </section>
                  );
                })}
            </aside>
          </>
        )}
      </div>

      {/* 3. BOTTOM DOCK */}
      {(workspaceLayout.visiblePanels.includes('Timeline') || workspaceLayout.visiblePanels.includes('Render Queue')) && (
      <div className="flex shrink-0 flex-col border-t border-[#121212]" style={{ height: workspaceLayout.timelineHeight + 28 }}>
      <div className="flex h-7 shrink-0 items-center gap-1 border-b border-[#121212] bg-[var(--st-panel)] px-2 text-[10px]">
        {workspaceLayout.visiblePanels.includes('Timeline') && <button type="button" aria-pressed={workspaceLayout.bottomTab === 'timeline'} onClick={() => setWorkspaceLayout((layout) => ({ ...layout, bottomTab: 'timeline' }))}
          className={`flex h-full items-center gap-1 border-b-2 px-2 ${workspaceLayout.bottomTab === 'timeline' ? 'border-[var(--st-accent)] text-[var(--st-accent)]' : 'border-transparent text-[#888] hover:text-white'}`}>
          {project.compositions?.[0]?.name ?? 'Timeline'} <span aria-label="Close timeline" onClick={(event) => { event.stopPropagation(); setWorkspaceLayout((layout) => ({ ...layout, visiblePanels: layout.visiblePanels.filter((panel) => panel !== 'Timeline') })); }}>×</span>
        </button>}
        {workspaceLayout.visiblePanels.includes('Render Queue') && <button type="button" aria-pressed={workspaceLayout.bottomTab === 'renderQueue'} onClick={() => setWorkspaceLayout((layout) => ({ ...layout, bottomTab: 'renderQueue' }))}
          className={`flex h-full items-center gap-1 border-b-2 px-2 ${workspaceLayout.bottomTab === 'renderQueue' ? 'border-[var(--st-accent)] text-[var(--st-accent)]' : 'border-transparent text-[#888] hover:text-white'}`}>
          Render Queue <span aria-label="Close render queue" onClick={(event) => { event.stopPropagation(); setWorkspaceLayout((layout) => ({ ...layout, visiblePanels: layout.visiblePanels.filter((panel) => panel !== 'Render Queue') })); }}>×</span>
        </button>}
        <button type="button" aria-label="Bottom panel options" title="Bottom panel options" className="ml-auto text-[#888] hover:text-white"><Menu className="h-3 w-3" /></button>
      </div>
      {workspaceLayout.bottomTab === 'timeline' && workspaceLayout.visiblePanels.includes('Timeline') && <Timeline
        project={project}
        initialHeight={workspaceLayout.timelineHeight}
        onHeightChange={(timelineHeight) => setWorkspaceLayout((layout) => ({ ...layout, timelineHeight }))}
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
              elements: clampElementRanges(p.elements, safeDuration),
              workArea: {
                start: Math.min(safeDuration, Math.max(0, p.workArea?.start ?? 0)),
                end: Math.min(safeDuration, Math.max(0, p.workArea?.end ?? safeDuration)),
              },
              tracks: nextTracks,
              markers: (p.markers ?? []).map((marker) => ({
                ...marker,
                time: clampTimelineTime(marker.time, safeDuration),
              })),
            };
          })
        }
        onUpdateFps={(fps) =>
          setProject((p) => ({ ...p, document: { ...p.document, fps } }))
        }
        onToggleLoop={handleToggleLoop}
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
        selectedElementIds={project.selectedElementIds}
        onSelectElement={handleSelectElement}
        onSelectElements={handleSelectElements}
        onToggleVisibility={handleToggleVisibility}
        onToggleLock={handleToggleLock}
        onUpdateLayer={handleUpdateLayer}
        onRenameLayer={handleRenameElement}
        onDeleteLayers={(ids) => void handleDeleteElement(ids)}
        onDuplicateLayers={handleDuplicateLayers}
        onReorderLayer={handleReorderLayer}
        onResetLayerTransform={handleResetLayerTransform}
        onSelectLayerChildren={handleSelectLayerChildren}
        onSplitLayer={handleSplitLayer}
        onMoveLayersToEdge={handleMoveLayersToEdge}
        onUpdateLayerRange={handleUpdateLayerRange}
        onCommitLayerRange={handleCommitLayerRange}
        onUpdateKeyframeInterpolation={handleUpdateKeyframeInterpolation}
        onPasteKeyframes={handlePasteKeyframes}
        onAddProjectItem={handleAddProjectItem}
        onUpdateKeyframe={(keyframeId, updates) => setProject((current) => ({
          ...current,
          tracks: current.tracks.map((track) => ({
            ...track,
            keyframes: track.keyframes.map((keyframe) => keyframe.id === keyframeId
              ? {
                ...keyframe,
                ...updates,
                ...(updates.time !== undefined
                  ? { time: clampTimelineTime(updates.time, current.document.duration) }
                  : {}),
              }
              : keyframe),
          })),
        }))}
        onUpdateWorkArea={handleUpdateWorkArea}
        onAddMarker={(time) => {
          const label = window.prompt('Marker label', `Marker ${(project.markers?.length ?? 0) + 1}`);
          if (!label?.trim()) return;
          setProject((current) => ({
            ...current,
            markers: [
              ...(current.markers ?? []),
              {
                id: `marker-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                time: clampTimelineTime(time, current.document.duration),
                label: label.trim(),
              },
            ],
          }));
        }}
        onUpdateMarker={(markerId, label) => setProject((current) => ({
          ...current,
          markers: (current.markers ?? []).map((marker) => marker.id === markerId ? { ...marker, label } : marker),
        }))}
      />}
      {workspaceLayout.bottomTab === 'renderQueue' && workspaceLayout.visiblePanels.includes('Render Queue') && (
        <div className="min-h-0 flex-1 overflow-auto bg-[#1d1d1d] text-[9px] text-[#aaa]">
          <div className="flex h-8 items-center gap-2 border-b border-[#121212] px-2">
            <span className="w-24 font-semibold text-[#ddd]">Current Render</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded bg-[#292929]" role="progressbar" aria-label="Current render progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={renderJobs.find((job) => job.status === 'Rendering')?.progress ?? 0}>
              <div className="h-full bg-[var(--st-accent)] transition-[width]" style={{ width: `${renderJobs.find((job) => job.status === 'Rendering')?.progress ?? 0}%` }} />
            </div>
            <span>Elapsed: {renderJobs.some((job) => job.status === 'Rendering') ? `${Math.floor((elapsedTick - (renderJobs.find((job) => job.status === 'Rendering')?.startedAt ?? elapsedTick)) / 1000)}s` : '—'}</span>
            <span>Est. Remain: —</span>
            <button type="button" disabled={!renderJobs.some((job) => job.status === 'Rendering')} title="Stop is unavailable for the active browser export" className="rounded px-2 py-1 opacity-40">Stop</button>
            <button type="button" disabled title="Pause is unavailable for browser exports" className="rounded px-2 py-1 opacity-40">Pause</button>
            <button type="button" onClick={() => setIsExportOpen(true)} className="rounded bg-[var(--st-accent)] px-2 py-1 font-semibold text-[#111]">Render</button>
          </div>
          <div className="grid grid-cols-[72px_70px_34px_minmax(120px,1fr)_84px_125px_96px] border-b border-[#121212] bg-[#232323] px-2 py-1 font-semibold text-[#aaa]">
            <span>Render</span><span>Label</span><span>#</span><span>Comp name</span><span>Status</span><span>Started</span><span>Render time</span>
          </div>
          {renderJobs.map((job, index) => {
            const elapsed = Math.max(0, ((job.finishedAt ?? elapsedTick) - job.startedAt) / 1000);
            return <div key={job.id} className="grid grid-cols-[72px_70px_34px_minmax(120px,1fr)_84px_125px_96px] border-b border-[#121212] px-2 py-1">
              <span>{job.format}</span><span>—</span><span>{index + 1}</span><span className="truncate">{job.compName}</span>
              <span className={job.status === 'Failed' ? 'text-red-400' : job.status === 'Done' ? 'text-[var(--st-accent)]' : 'text-amber-300'} title={job.error}>{job.status}</span>
              <span>{new Date(job.startedAt).toLocaleTimeString()}</span><span>{elapsed.toFixed(1)}s</span>
            </div>;
          })}
        </div>
      )}
      </div>
      )}
      <div className="flex h-[22px] shrink-0 items-center gap-4 border-t border-[#121212] bg-[#232323] px-2 text-[9px] text-[#888]">
        <span className="min-w-0 flex-1 truncate">Message: {toasts.at(-1)?.title ?? 'Ready'}</span>
        {browserMemory && <span>RAM: {Math.round(browserMemory.usedJSHeapSize / 1024 / 1024)} MB</span>}
        <span>Renders Started: {renderJobs.length}</span>
        <span>Total Time Elapsed: {Math.floor((elapsedTick - studioStartedAt.current) / 1000)}s</span>
      </div>

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
