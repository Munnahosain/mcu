'use client';

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Repeat,
  Magnet,
  ZoomIn,
  ZoomOut,
  Plus,
  Trash2,
  Copy,
  Layers,
  ChevronDown,
  ChevronRight,
  FastForward,
  Rewind,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  CircleDot,
} from 'lucide-react';
import {
  ProjectState,
  AnimationTrack,
  Keyframe,
  AnimProperty,
  EasingType,
  SvgElementNode,
  KeyframeInterpolation,
  KeyframeClipboardEntry,
} from './types';
import { ANIMATABLE_PROPERTIES, LAYER_COLORS } from './constants';
import { findElementById, flattenElementTree } from './svgParser';
import { EASING_PRESETS, getAdjacentKeyframes } from './keyframeManager';
import { GraphEditor } from './GraphEditor';

function formatTimelineTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}

function formatRulerTime(seconds: number): string {
  const wholeSeconds = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, '0')}`;
}

function getRulerMajorInterval(pixelsPerSec: number): number {
  const intervals = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
  return intervals.find((interval) => interval * pixelsPerSec >= 64) ?? 600;
}

function getEasingBadge(easing: EasingType): string {
  switch (easing) {
    case 'easeInOut':
      return '≈';
    case 'easeOut':
      return '↘';
    case 'easeIn':
      return '↗';
    case 'bounceOut':
      return 'B';
    case 'elasticOut':
      return 'S';
    case 'backOut':
    case 'backInOut':
      return 'P';
    case 'linear':
    default:
      return '—';
  }
}

function getLayerColor(tagName: SvgElementNode['tagName']): string {
  if (tagName === 'text') return 'bg-rose-500/70 border-rose-300/50';
  if (tagName === 'rect' || tagName === 'circle' || tagName === 'ellipse') {
    return 'bg-blue-500/70 border-blue-300/50';
  }
  if (tagName === 'image') return 'bg-amber-500/70 border-amber-300/50';
  if (tagName === 'g') return 'bg-violet-500/70 border-violet-300/50';
  return 'bg-emerald-500/70 border-emerald-300/50';
}

const LAYER_LABEL_CLASSES: Record<typeof LAYER_COLORS[number], string> = {
  green: 'bg-emerald-500/70 border-emerald-300/50',
  blue: 'bg-blue-500/70 border-blue-300/50',
  purple: 'bg-violet-500/70 border-violet-300/50',
  orange: 'bg-orange-500/70 border-orange-300/50',
  pink: 'bg-pink-500/70 border-pink-300/50',
  cyan: 'bg-cyan-500/70 border-cyan-300/50',
};

function getElementLayerColor(element: SvgElementNode): string {
  const label = LAYER_COLORS[element.colorLabel ?? 0] ?? LAYER_COLORS[0];
  return LAYER_LABEL_CLASSES[label] ?? getLayerColor(element.tagName);
}

interface TimelineProps {
  project: ProjectState;
  initialHeight?: number;
  onHeightChange?: (height: number) => void;
  onTogglePlay: () => void;
  onRewind: () => void;
  onSeek: (time: number) => void;
  onRegisterPlaybackRenderer: (renderer: ((time: number) => void) | null) => void;
  onUpdateDuration: (duration: number) => void;
  onUpdateFps: (fps: number) => void;
  onToggleLoop: () => void;
  onSelectKeyframe: (keyframeId: string | null) => void;
  onSelectKeyframes: (keyframeIds: string[], primaryKeyframeId: string | null) => void;
  onAddKeyframeAtPlayhead: (elementId: string, property: AnimProperty) => void;
  onMoveKeyframe: (keyframeId: string, newTime: number) => void;
  onDeleteKeyframes: (keyframeIds: string[]) => void;
  onDuplicateKeyframe: (keyframeId: string) => void;
  onUpdateKeyframeEasing: (keyframeId: string, easing: EasingType) => void;
  selectedElementId: string | null;
  onSelectElement: (elementId: string | null) => void;
  onApplyEasingToTransforms?: (elementId: string, easing: EasingType) => void;
  onToggleVisibility?: (elementId: string) => void;
  onToggleLock?: (elementId: string) => void;
  onUpdateLayer?: (elementId: string, updates: Partial<Pick<SvgElementNode, 'colorLabel' | 'solo' | 'shy' | 'blendMode' | 'animParentId'>>) => void;
  onUpdateLayerRange?: (elementId: string, start: number, end: number) => void;
  onCommitLayerRange?: (elementId: string, start: number, end: number) => void;
  onUpdateKeyframeInterpolation?: (keyframeId: string, interpolation: KeyframeInterpolation) => void;
  onUpdateWorkArea?: (start: number, end: number) => void;
  onAddMarker?: (time: number) => void;
  onUpdateMarker?: (markerId: string, label: string) => void;
  onUpdateKeyframe?: (keyframeId: string, updates: Partial<Keyframe>) => void;
  onPasteKeyframes?: (elementId: string, time: number, entries: KeyframeClipboardEntry[]) => void;
  onAddProjectItem?: (itemId: string, time: number) => void;
  selectedElementIds?: string[];
  onSelectElements?: (elementIds: string[], primaryId: string | null) => void;
  onRenameLayer?: (elementId: string, name: string) => void;
  onDeleteLayers?: (elementIds: string[]) => void;
  onDuplicateLayers?: (elementIds: string[]) => void;
  onReorderLayer?: (elementId: string, targetId: string, after: boolean) => void;
  onResetLayerTransform?: (elementId: string) => void;
  onSelectLayerChildren?: (elementId: string) => void;
  onSplitLayer?: (elementIds: string[], time: number) => void;
  onMoveLayersToEdge?: (elementIds: string[], edge: 'front' | 'back') => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  project,
  initialHeight = 260,
  onHeightChange,
  onTogglePlay,
  onRewind,
  onSeek,
  onRegisterPlaybackRenderer,
  onUpdateDuration,
  onUpdateFps,
  onToggleLoop,
  onSelectKeyframe,
  onSelectKeyframes,
  onAddKeyframeAtPlayhead,
  onMoveKeyframe,
  onDeleteKeyframes,
  onDuplicateKeyframe,
  onUpdateKeyframeEasing,
  selectedElementId,
  onSelectElement,
  onApplyEasingToTransforms,
  onToggleVisibility,
  onToggleLock,
  onUpdateLayer,
  onUpdateLayerRange,
  onCommitLayerRange,
  onUpdateKeyframeInterpolation,
  onUpdateWorkArea,
  onAddMarker,
  onUpdateMarker,
  onUpdateKeyframe,
  onPasteKeyframes,
  onAddProjectItem,
  selectedElementIds,
  onSelectElements,
  onRenameLayer,
  onDeleteLayers,
  onDuplicateLayers,
  onReorderLayer,
  onResetLayerTransform,
  onSelectLayerChildren,
  onSplitLayer,
  onMoveLayersToEdge,
}) => {
  const rulerContainerRef = useRef<HTMLDivElement>(null);
  const lanesContainerRef = useRef<HTMLDivElement>(null);
  const trackNamesRef = useRef<HTMLDivElement>(null);
  const currentTimeTextRef = useRef<HTMLSpanElement>(null);
  const currentFrameTextRef = useRef<HTMLSpanElement>(null);
  const rulerPlayheadRef = useRef<HTMLDivElement>(null);
  const trackPlayheadRef = useRef<HTMLDivElement>(null);
  const playbackTimeRef = useRef(project.currentTime);

  // Timeline zoom: pixels per second (min 60px/s, max 400px/s)
  const [pixelsPerSec, setPixelsPerSec] = useState<number>(140);
  const [snapping, setSnapping] = useState<boolean>(true);
  const [isGraphEditorOpen, setIsGraphEditorOpen] = useState(false);
  const [timelineHeight, setTimelineHeight] = useState(initialHeight);
  const [clipboardCount, setClipboardCount] = useState(0);
  const resizeStartRef = useRef<{ y: number; height: number } | null>(null);

  useEffect(() => {
    setTimelineHeight(initialHeight);
  }, [initialHeight]);

  // Playhead dragging
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);

  // Keyframe dragging
  const [draggingKfId, setDraggingKfId] = useState<string | null>(null);
  const dragStateRef = useRef<{
    pointerStartTime: number;
    selectedIds: string[];
    initialTimes: Record<string, number>;
  } | null>(null);
  const selectionAnchorRef = useRef<string | null>(null);
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);
  const marqueeMovedRef = useRef(false);
  const [isMarqueeSelecting, setIsMarqueeSelecting] = useState(false);
  const [marqueeRect, setMarqueeRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  // Context menu for keyframe
  const [contextKf, setContextKf] = useState<{ id: string; x: number; y: number } | null>(null);

  // Expanded track rows
  const [collapsedElements, setCollapsedElements] = useState<Record<string, boolean>>({});
  const [propertyMenuElementId, setPropertyMenuElementId] = useState<string | null>(null);
  const [layerColorMenuId, setLayerColorMenuId] = useState<string | null>(null);
  const [hideShyLayers, setHideShyLayers] = useState(false);
  const [layerColumnWidth, setLayerColumnWidth] = useState(256);
  const [virtualScrollTop, setVirtualScrollTop] = useState(0);
  const [renamingLayerId, setRenamingLayerId] = useState<string | null>(null);
  const [renamingLayerText, setRenamingLayerText] = useState('');
  const [layerContextMenu, setLayerContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [dropIndicatorId, setDropIndicatorId] = useState<string | null>(null);
  const layerSelectionAnchorRef = useRef<string | null>(null);
  const layerResizeRef = useRef<{ pointerX: number; width: number } | null>(null);
  const draggingLayerIdRef = useRef<string | null>(null);
  const layerRangeDragRef = useRef<{
    id: string;
    mode: 'start' | 'end' | 'slide';
    pointerX: number;
    start: number;
    end: number;
    latestStart: number;
    latestEnd: number;
    initialKeyframeTimes: Record<string, number>;
    altTrim: boolean;
  } | null>(null);
  const workAreaDragRef = useRef<{
    mode: 'start' | 'end';
    pointerX: number;
    start: number;
    end: number;
  } | null>(null);

  const { duration, fps, loop } = project.document;
  const markers = project.markers ?? [];
  const workArea = project.workArea ?? { start: 0, end: duration };
  const currentTime = project.currentTime;
  const timelineWidth = Math.max(800, duration * pixelsPerSec);
  const rulerMajorInterval = getRulerMajorInterval(pixelsPerSec);
  const selectedKeyframeIds = useMemo(() => {
    if (project.selectedKeyframeIds && project.selectedKeyframeIds.length > 0) {
      return project.selectedKeyframeIds;
    }
    return project.selectedKeyframeId ? [project.selectedKeyframeId] : [];
  }, [project.selectedKeyframeId, project.selectedKeyframeIds]);
  const keyframeClipboardRef = useRef<KeyframeClipboardEntry[]>([]);
  const copySelectedKeyframes = useCallback((fallbackId?: string) => {
    const ids = selectedKeyframeIds.length ? selectedKeyframeIds : fallbackId ? [fallbackId] : [];
    const selected = project.tracks.flatMap((track) =>
      track.keyframes
        .filter((keyframe) => ids.includes(keyframe.id))
        .map((keyframe) => ({ track, keyframe }))
    );
    if (!selected.length) return;
    const origin = Math.min(...selected.map(({ keyframe }) => keyframe.time));
    keyframeClipboardRef.current = selected.map(({ track, keyframe }) => ({
      property: track.property,
      offset: keyframe.time - origin,
      value: keyframe.value,
      easing: keyframe.easing,
      interpolation: keyframe.interpolation,
      ...(keyframe.bezier ? { bezier: keyframe.bezier } : {}),
    }));
    setClipboardCount(keyframeClipboardRef.current.length);
  }, [project.tracks, selectedKeyframeIds]);

  // Group tracks by elementId
  const elementTrackGroups = useMemo(() => {
    const map = new Map<string, AnimationTrack[]>();
    project.tracks.forEach((track) => {
      if (!map.has(track.elementId)) {
        map.set(track.elementId, []);
      }
      map.get(track.elementId)!.push(track);
    });
    return map;
  }, [project.tracks]);
  const timelineLayers = useMemo(
    () => flattenElementTree(project.elements).map((element) => ({
      element,
      tracks: elementTrackGroups.get(element.id) ?? [],
    })),
    [project.elements, elementTrackGroups]
  );
  const visibleTimelineLayers = useMemo(
    () => hideShyLayers ? timelineLayers.filter(({ element }) => !element.shy) : timelineLayers,
    [hideShyLayers, timelineLayers]
  );
  const virtualLayerWindow = useMemo(() => {
    const rowHeights = visibleTimelineLayers.map(({ element, tracks }) =>
      33 + ((collapsedElements[element.id] ?? false) ? 0 : tracks.length * 24)
    );
    const offsets = [0];
    rowHeights.forEach((height) => offsets.push(offsets[offsets.length - 1] + height));
    if (visibleTimelineLayers.length <= 100) {
      return { start: 0, end: visibleTimelineLayers.length, top: 0, bottom: 0 };
    }
    const overscan = 600;
    const visibleTop = Math.max(0, virtualScrollTop - overscan);
    const visibleBottom = virtualScrollTop + 900 + overscan;
    let start = 0;
    while (start < rowHeights.length && offsets[start + 1] < visibleTop) start += 1;
    let end = start;
    while (end < rowHeights.length && offsets[end] < visibleBottom) end += 1;
    return {
      start,
      end,
      top: offsets[start],
      bottom: offsets[rowHeights.length] - offsets[end],
    };
  }, [visibleTimelineLayers, collapsedElements, virtualScrollTop]);
  const renderedTimelineLayers = useMemo(
    () => visibleTimelineLayers.slice(virtualLayerWindow.start, virtualLayerWindow.end),
    [visibleTimelineLayers, virtualLayerWindow.start, virtualLayerWindow.end]
  );

  useEffect(() => {
    try {
      const stored = localStorage.getItem('mcu_svg_motion_layer_column_width');
      if (stored !== null) {
        const width = Number(stored);
        if (Number.isFinite(width)) setLayerColumnWidth(Math.max(220, Math.min(480, width)));
      }
    } catch (error) {
      console.error('[Motion Studio] Unable to restore the layer column width:', error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('mcu_svg_motion_layer_column_width', String(layerColumnWidth));
    } catch (error) {
      console.error('[Motion Studio] Unable to save the layer column width:', error);
    }
  }, [layerColumnWidth]);

  // Keyframe navigation calculations
  const adjacent = useMemo(() => {
    return getAdjacentKeyframes(project.tracks, selectedElementId, currentTime);
  }, [project.tracks, selectedElementId, currentTime]);

  // Calculate snap time to closest frame
  const snapToFrame = useCallback((time: number): number => {
    if (!snapping) return time;
    const frameDuration = 1 / fps;
    return Math.round(time / frameDuration) * frameDuration;
  }, [snapping, fps]);

  // Convert client X on lanes / ruler to timeline seconds
  const clientXToTime = useCallback((clientX: number, container: HTMLElement): number => {
    const rect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft;
    const offsetX = clientX - rect.left + scrollLeft;
    const rawTime = offsetX / pixelsPerSec;
    const clamped = Math.max(0, Math.min(duration, rawTime));
    return snapToFrame(clamped);
  }, [duration, pixelsPerSec, snapToFrame]);

  // 1. Playhead scrubbing handlers with RAF 60fps smoothing
  const handleRulerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-work-area-handle], [data-marker]')) return;
    if (!rulerContainerRef.current) return;
    setIsScrubbing(true);
    const newTime = clientXToTime(e.clientX, rulerContainerRef.current);
    onSeek(newTime);
  };

  useEffect(() => {
    let rafId: number | null = null;
    let pendingTime: number | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      if (isScrubbing && rulerContainerRef.current) {
        const newTime = clientXToTime(e.clientX, rulerContainerRef.current);
        pendingTime = newTime;

        // Immediately update visual needle directly for 60fps fluidity
        if (rulerPlayheadRef.current) rulerPlayheadRef.current.style.left = `${newTime * pixelsPerSec}px`;
        if (trackPlayheadRef.current) trackPlayheadRef.current.style.left = `${newTime * pixelsPerSec}px`;
        if (currentTimeTextRef.current) currentTimeTextRef.current.textContent = formatTimelineTime(newTime);

        if (!rafId) {
          rafId = requestAnimationFrame(() => {
            if (pendingTime !== null) {
              onSeek(pendingTime);
              pendingTime = null;
            }
            rafId = null;
          });
        }
      }

      if (draggingKfId && lanesContainerRef.current) {
        const newTime = clientXToTime(e.clientX, lanesContainerRef.current);
        const dragState = dragStateRef.current;
        if (!rafId) {
          rafId = requestAnimationFrame(() => {
            if (dragState) {
              const delta = newTime - dragState.pointerStartTime;
              dragState.selectedIds.forEach((id) => {
                const startTime = dragState.initialTimes[id] ?? 0;
                const nextTime = Math.max(0, Math.min(duration, startTime + delta));
                onMoveKeyframe(id, nextTime);
              });
            } else {
              onMoveKeyframe(draggingKfId, newTime);
            }
            rafId = null;
          });
        }
      }

      if (isMarqueeSelecting && selectionStartRef.current && lanesContainerRef.current) {
        const start = selectionStartRef.current;
        const deltaX = e.clientX - start.x;
        const deltaY = e.clientY - start.y;
        if (Math.abs(deltaX) + Math.abs(deltaY) >= 4) {
          marqueeMovedRef.current = true;
          const container = lanesContainerRef.current;
          const containerRect = container.getBoundingClientRect();
          const left = Math.min(start.x, e.clientX);
          const top = Math.min(start.y, e.clientY);
          const right = Math.max(start.x, e.clientX);
          const bottom = Math.max(start.y, e.clientY);

          setMarqueeRect({
            left: left - containerRect.left + container.scrollLeft,
            top: top - containerRect.top + container.scrollTop,
            width: right - left,
            height: bottom - top,
          });

          const selectedIds = Array.from(container.querySelectorAll<HTMLElement>('[data-keyframe-id]'))
            .filter((element) => {
              const rect = element.getBoundingClientRect();
              return rect.right >= left && rect.left <= right && rect.bottom >= top && rect.top <= bottom;
            })
            .map((element) => element.dataset.keyframeId!)
            .filter(Boolean);

          onSelectKeyframes(selectedIds, selectedIds.at(-1) ?? null);
        }
      }
    };

    const handleMouseUp = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (pendingTime !== null) {
        onSeek(pendingTime);
        pendingTime = null;
      }
      setIsScrubbing(false);
      setDraggingKfId(null);
      dragStateRef.current = null;
      selectionStartRef.current = null;
      setIsMarqueeSelecting(false);
      setMarqueeRect(null);
    };

    if (isScrubbing || draggingKfId || isMarqueeSelecting) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isScrubbing, draggingKfId, isMarqueeSelecting, clientXToTime, onSeek, onMoveKeyframe, onSelectKeyframes, pixelsPerSec, duration]);

  // Synchronize ruler and tracks horizontal scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (rulerContainerRef.current && lanesContainerRef.current) {
      if (e.currentTarget === rulerContainerRef.current) {
        lanesContainerRef.current.scrollLeft = rulerContainerRef.current.scrollLeft;
      } else {
        rulerContainerRef.current.scrollLeft = lanesContainerRef.current.scrollLeft;
      }
    }
    if (e.currentTarget === lanesContainerRef.current && trackNamesRef.current) {
      if (trackNamesRef.current.scrollTop !== lanesContainerRef.current.scrollTop) {
        trackNamesRef.current.scrollTop = lanesContainerRef.current.scrollTop;
      }
    } else if (e.currentTarget === trackNamesRef.current && lanesContainerRef.current) {
      if (lanesContainerRef.current.scrollTop !== trackNamesRef.current.scrollTop) {
        lanesContainerRef.current.scrollTop = trackNamesRef.current.scrollTop;
      }
    }
    if (
      visibleTimelineLayers.length > 100
      && (e.currentTarget === lanesContainerRef.current || e.currentTarget === trackNamesRef.current)
    ) {
      const nextScrollTop = e.currentTarget.scrollTop;
      setVirtualScrollTop((current) => current === nextScrollTop ? current : nextScrollTop);
    }
  };

  const handleResizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    resizeStartRef.current = { y: event.clientY, height: timelineHeight };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleResizeMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!resizeStartRef.current) return;
    const maxHeight = Math.round(window.innerHeight * 0.6);
    const nextHeight = resizeStartRef.current.height + resizeStartRef.current.y - event.clientY;
    const height = Math.max(160, Math.min(maxHeight, nextHeight));
    setTimelineHeight(height);
    onHeightChange?.(height);
  };

  const handleResizeEnd = () => {
    resizeStartRef.current = null;
  };

  const handleLayerColumnResizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    layerResizeRef.current = { pointerX: event.clientX, width: layerColumnWidth };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handleLayerColumnResizeMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = layerResizeRef.current;
    if (!start) return;
    setLayerColumnWidth(Math.max(220, Math.min(480, start.width + event.clientX - start.pointerX)));
  };
  const handleLayerColumnResizeEnd = () => {
    layerResizeRef.current = null;
  };

  // Step 1 frame forward / backward
  const stepFrame = (direction: 'forward' | 'back') => {
    const frameDur = 1 / fps;
    const newTime =
      direction === 'forward'
        ? Math.min(duration, playbackTimeRef.current + frameDur)
        : Math.max(0, playbackTimeRef.current - frameDur);
    onSeek(Math.round(newTime * 100) / 100);
  };

  const currentFrame = Math.round(currentTime * fps);
  const totalFrames = Math.round(duration * fps);
  const beginLayerRangeDrag = (
    event: React.PointerEvent<HTMLDivElement>,
    element: SvgElementNode,
    mode: 'start' | 'end' | 'slide'
  ) => {
    if (!onUpdateLayerRange || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = Math.max(0, Math.min(duration, element.inPoint ?? 0));
    const end = Math.max(0, Math.min(duration, element.outPoint ?? duration));
    layerRangeDragRef.current = {
      id: element.id,
      mode,
      pointerX: event.clientX,
      start,
      end,
      latestStart: start,
      latestEnd: end,
      initialKeyframeTimes: Object.fromEntries(
        (elementTrackGroups.get(element.id) ?? []).flatMap((track) =>
          track.keyframes.map((keyframe) => [keyframe.id, keyframe.time] as const)
        )
      ),
      altTrim: event.altKey,
    };
  };
  const moveLayerRangeDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = layerRangeDragRef.current;
    if (!drag || !onUpdateLayerRange) return;
    const frame = 1 / Math.max(1, fps);
    const delta = Math.round((event.clientX - drag.pointerX) / pixelsPerSec * Math.max(1, fps)) / Math.max(1, fps);
    if (drag.mode === 'start') {
      drag.latestStart = Math.max(0, Math.min(drag.end - frame, drag.start + delta));
    } else if (drag.mode === 'end') {
      drag.latestEnd = Math.max(drag.start + frame, Math.min(duration, drag.end + delta));
    } else {
      const length = drag.end - drag.start;
      const start = Math.max(0, Math.min(duration - length, drag.start + delta));
      drag.latestStart = start;
      drag.latestEnd = start + length;
    }
    onUpdateLayerRange(drag.id, drag.latestStart, drag.latestEnd);
    Object.entries(drag.initialKeyframeTimes).forEach(([keyframeId, initialTime]) => {
      if (drag.mode === 'slide') {
        const shift = drag.latestStart - drag.start;
        onMoveKeyframe(keyframeId, Math.max(0, Math.min(duration, initialTime + shift)));
      } else if (!drag.altTrim && initialTime < drag.latestStart) {
        onMoveKeyframe(keyframeId, Math.max(0, drag.latestStart));
      } else if (!drag.altTrim && initialTime > drag.latestEnd) {
        onMoveKeyframe(keyframeId, Math.min(duration - frame, drag.latestEnd));
      }
    });
  };
  const endLayerRangeDrag = () => {
    const drag = layerRangeDragRef.current;
    if (drag) onCommitLayerRange?.(drag.id, drag.latestStart, drag.latestEnd);
    layerRangeDragRef.current = null;
  };
  const chooseLayer = (id: string, event: React.MouseEvent) => {
    const allIds = visibleTimelineLayers.map(({ element }) => element.id);
    const selectedIds = selectedElementIds?.length
      ? selectedElementIds
      : selectedElementId ? [selectedElementId] : [];
    let nextIds: string[];
    if (event.shiftKey && layerSelectionAnchorRef.current) {
      const anchorIndex = allIds.indexOf(layerSelectionAnchorRef.current);
      const targetIndex = allIds.indexOf(id);
      nextIds = anchorIndex < 0 || targetIndex < 0
        ? [id]
        : allIds.slice(Math.min(anchorIndex, targetIndex), Math.max(anchorIndex, targetIndex) + 1);
    } else if (event.ctrlKey || event.metaKey) {
      nextIds = selectedIds.includes(id)
        ? selectedIds.filter((selectedId) => selectedId !== id)
        : [...selectedIds, id];
    } else {
      nextIds = [id];
    }
    layerSelectionAnchorRef.current = id;
    if (onSelectElements) onSelectElements(nextIds, nextIds.includes(id) ? id : nextIds.at(-1) ?? null);
    else onSelectElement(id);
  };

  const getSelectedLayerIds = useCallback(() => {
    const ids = selectedElementIds?.length
      ? selectedElementIds
      : selectedElementId ? [selectedElementId] : [];
    return ids.filter((id) => timelineLayers.some(({ element }) => element.id === id));
  }, [selectedElementId, selectedElementIds, timelineLayers]);
  const beginWorkAreaDrag = (event: React.PointerEvent<HTMLButtonElement>, mode: 'start' | 'end') => {
    if (!onUpdateWorkArea || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    workAreaDragRef.current = {
      mode,
      pointerX: event.clientX,
      start: workArea.start,
      end: workArea.end,
    };
  };
  const moveWorkAreaDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = workAreaDragRef.current;
    if (!drag || !onUpdateWorkArea) return;
    const delta = snapToFrame((event.clientX - drag.pointerX) / pixelsPerSec);
    const frame = 1 / Math.max(1, fps);
    if (drag.mode === 'start') {
      onUpdateWorkArea(Math.max(0, Math.min(drag.end - frame, drag.start + delta)), drag.end);
    } else {
      onUpdateWorkArea(drag.start, Math.min(duration, Math.max(drag.start + frame, drag.end + delta)));
    }
  };
  const endWorkAreaDrag = () => {
    workAreaDragRef.current = null;
  };

  useEffect(() => {
    const handleMarkerShortcut = (event: KeyboardEvent) => {
      const target = event.target;
      const isEditing = target instanceof HTMLElement
        && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
      if (isEditing) return;
      if ((event.ctrlKey || event.metaKey) && !event.altKey) {
        if (event.key.toLowerCase() === 'c' && selectedKeyframeIds.length > 0) {
          event.preventDefault();
          copySelectedKeyframes();
        } else if (
          event.key.toLowerCase() === 'v'
          && clipboardCount > 0
          && selectedElementId
        ) {
          event.preventDefault();
          onPasteKeyframes?.(selectedElementId, currentTime, keyframeClipboardRef.current);
        }
        return;
      }
      if (
        event.ctrlKey || event.metaKey || event.altKey
      ) return;
      if (event.key.toLowerCase() === 'm') {
        event.preventDefault();
        onAddMarker?.(currentTime);
      } else if (event.key === '[' && !selectedElementId) {
        event.preventDefault();
        const frame = 1 / Math.max(1, fps);
        const start = Math.min(duration - frame, currentTime);
        onUpdateWorkArea?.(Math.max(0, start), Math.max(start + frame, workArea.end));
      } else if (event.key === ']' && !selectedElementId) {
        event.preventDefault();
        const end = Math.min(duration, currentTime);
        onUpdateWorkArea?.(Math.min(workArea.start, Math.max(0, end - 1 / Math.max(1, fps))), end);
      }
    };
    window.addEventListener('keydown', handleMarkerShortcut);
    return () => window.removeEventListener('keydown', handleMarkerShortcut);
  }, [
    currentTime,
    duration,
    fps,
    onAddMarker,
    onUpdateWorkArea,
    workArea.end,
    workArea.start,
    selectedKeyframeIds,
    copySelectedKeyframes,
    clipboardCount,
    selectedElementId,
    onPasteKeyframes,
  ]);

  useEffect(() => {
    const handleLayerShortcuts = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement
        && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      const ids = getSelectedLayerIds();
      const primaryId = selectedElementId;
      const command = event.ctrlKey || event.metaKey;
      if (project.selectedKeyframeId || (project.selectedKeyframeIds?.length ?? 0) > 0) {
        if (command && event.code === 'KeyD') return;
      }
      if (command && event.shiftKey && event.code === 'KeyD') {
        if (ids.length) {
          event.preventDefault();
          onSplitLayer?.(ids, currentTime);
        }
      } else if (command && event.code === 'KeyD') {
        if (ids.length) {
          event.preventDefault();
          onDuplicateLayers?.(ids);
        }
      } else if (command && event.shiftKey && event.code === 'BracketRight') {
        event.preventDefault();
        onMoveLayersToEdge?.(ids, 'front');
      } else if (command && event.shiftKey && event.code === 'BracketLeft') {
        event.preventDefault();
        onMoveLayersToEdge?.(ids, 'back');
      } else if (!command && !event.altKey && event.key === 'F2' && primaryId) {
        event.preventDefault();
        const element = findElementById(project.elements, primaryId);
        if (element) {
          setRenamingLayerId(primaryId);
          setRenamingLayerText(element.name);
        }
      } else if (!command && (event.key === '[' || event.key === ']') && ids.length) {
        event.preventDefault();
        const frame = 1 / Math.max(1, fps);
        ids.forEach((id) => {
          const element = findElementById(project.elements, id);
          if (!element) return;
          const start = element.inPoint ?? 0;
          const end = element.outPoint ?? duration;
          if (event.altKey) {
            onCommitLayerRange?.(id, event.key === '[' ? 0 : start, event.key === ']' ? duration : end);
            return;
          }
          if (event.key === '[') {
            const nextStart = Math.min(Math.max(0, duration - frame), currentTime);
            const nextEnd = Math.max(nextStart + frame, end);
            onUpdateLayerRange?.(id, nextStart, Math.min(duration, nextEnd));
            onCommitLayerRange?.(id, nextStart, Math.min(duration, nextEnd));
          } else {
            const nextEnd = Math.min(duration, Math.max(start + frame, currentTime));
            onUpdateLayerRange?.(id, start, nextEnd);
            onCommitLayerRange?.(id, start, nextEnd);
          }
        });
      }
    };
    window.addEventListener('keydown', handleLayerShortcuts);
    return () => window.removeEventListener('keydown', handleLayerShortcuts);
  }, [
    currentTime,
    duration,
    fps,
    onCommitLayerRange,
    onDeleteLayers,
    onDuplicateLayers,
    onMoveLayersToEdge,
    onSplitLayer,
    onUpdateLayerRange,
    getSelectedLayerIds,
    project.elements,
    selectedElementIds,
    selectedElementId,
    timelineLayers,
    visibleTimelineLayers,
    project.selectedKeyframeId,
    project.selectedKeyframeIds?.length,
  ]);

  const renderPlaybackAtTime = useCallback((time: number) => {
    playbackTimeRef.current = time;
    if (currentTimeTextRef.current) currentTimeTextRef.current.textContent = formatTimelineTime(time);
    if (currentFrameTextRef.current) {
      currentFrameTextRef.current.textContent = `(F: ${Math.round(time * fps)}/${totalFrames})`;
    }
    if (rulerPlayheadRef.current) rulerPlayheadRef.current.style.left = `${time * pixelsPerSec}px`;
    if (trackPlayheadRef.current) trackPlayheadRef.current.style.left = `${time * pixelsPerSec}px`;
  }, [fps, pixelsPerSec, totalFrames]);

  useEffect(() => {
    onRegisterPlaybackRenderer(renderPlaybackAtTime);
    renderPlaybackAtTime(currentTime);
    return () => onRegisterPlaybackRenderer(null);
  }, [currentTime, onRegisterPlaybackRenderer, renderPlaybackAtTime]);

  return (
    <footer
      onDragOver={(event) => {
        if (
          Array.from(event.dataTransfer.types).includes('application/x-mcu-motion-layer')
          || Array.from(event.dataTransfer.types).includes('application/x-mcu-project-item')
        ) {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDrop={(event) => {
        const projectItemId = event.dataTransfer.getData('application/x-mcu-project-item');
        if (projectItemId) {
          event.preventDefault();
          onAddProjectItem?.(projectItemId, currentTime);
          return;
        }
        const layerId = event.dataTransfer.getData('application/x-mcu-motion-layer');
        if (!layerId) return;
        event.preventDefault();
        onSelectElement(layerId);
      }}
      className="svg-motion-timeline min-h-0 border-t border-[var(--card-border)] bg-[var(--card-bg)] flex flex-col select-none shrink-0 z-20 text-foreground transition-colors"
      style={{ height: timelineHeight, flexBasis: timelineHeight }}
    >
      <div
        onPointerDown={handleResizeStart}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeEnd}
        onPointerCancel={handleResizeEnd}
        className="group flex h-3 shrink-0 touch-none cursor-ns-resize items-center justify-center border-y border-[var(--card-border)] bg-[var(--card-bg)] hover:border-primary/50 hover:bg-primary/10"
        title="Drag to resize the timeline"
        aria-label="Resize timeline"
      >
        <span className="h-0.5 w-12 rounded-full bg-[var(--text-muted)]/50 group-hover:bg-primary" />
      </div>
      {/* 1. TIMELINE TOP CONTROLS BAR */}
      <div className="h-10 border-b border-[var(--card-border)] bg-[var(--card-bg)] px-3 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
        {/* Left: Transport Controls & Keyframe Nav */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onRewind}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-foreground hover:bg-[var(--hover-bg)] transition-colors"
            title="Rewind to start (Home / 0)"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => stepFrame('back')}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-foreground hover:bg-[var(--hover-bg)] transition-colors"
            title="Previous Frame (,)"
          >
            <SkipBack className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={onTogglePlay}
            className={`p-2 rounded-full transition-all shadow-md ${
              project.isPlaying
                ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-amber-500/25'
                : 'bg-primary hover:bg-primary-hover text-[#071b17] shadow-primary/20'
            }`}
            title="Play / Pause (Space)"
          >
            {project.isPlaying ? (
              <Pause className="h-3.5 w-3.5 fill-current" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current" />
            )}
          </button>

          <button
            type="button"
            onClick={() => stepFrame('forward')}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-foreground hover:bg-[var(--hover-bg)] transition-colors"
            title="Next Frame (.)"
          >
            <SkipForward className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={onToggleLoop}
            className={`p-1.5 rounded-lg transition-colors ${
              loop ? 'text-primary bg-primary/20' : 'text-[var(--text-secondary)] hover:text-foreground hover:bg-[var(--hover-bg)]'
            }`}
            title={loop ? 'Looping enabled' : 'Looping disabled'}
          >
            <Repeat className="h-3.5 w-3.5" />
          </button>

          {/* Keyframe Jump Previous / Next */}
          <div className="flex items-center gap-0.5 ml-1 border-l border-[var(--card-border)] pl-1.5">
            <button
              type="button"
              onClick={() => {
                if (adjacent.prevTime !== null) onSeek(adjacent.prevTime);
              }}
              disabled={adjacent.prevTime === null}
              className="p-1 rounded-lg text-[var(--text-secondary)] hover:text-primary hover:bg-[var(--hover-bg)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Jump to Previous Keyframe (J)"
            >
              <Rewind className="h-3 w-3" />
            </button>

            {selectedElementId && (
              <button
                type="button"
                onClick={() => onAddKeyframeAtPlayhead(selectedElementId, 'rotation')}
                className={`p-1 rounded-lg text-xs font-black transition-colors ${
                  adjacent.hasAtCurrent
                    ? 'text-primary fill-primary bg-primary/20'
                    : 'text-[var(--text-secondary)] hover:text-primary hover:bg-[var(--hover-bg)]'
                }`}
                title="Toggle keyframe at playhead (K)"
              >
                ◆
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (adjacent.nextTime !== null) onSeek(adjacent.nextTime);
              }}
              disabled={adjacent.nextTime === null}
              className="p-1 rounded-lg text-[var(--text-secondary)] hover:text-primary hover:bg-[var(--hover-bg)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Jump to Next Keyframe (K)"
            >
              <FastForward className="h-3 w-3" />
            </button>
          </div>

          <div className="h-4 w-[1px] bg-[var(--card-border)] mx-1" />

          {selectedKeyframeIds.length > 0 && (
            <button
              type="button"
              onClick={() => onDeleteKeyframes(selectedKeyframeIds)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
              title={`Delete ${selectedKeyframeIds.length} selected keyframes (Del)`}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="text-[10px]">{selectedKeyframeIds.length}</span>
            </button>
          )}

          {/* Time & Frame Counter */}
          <div className="font-mono text-xs text-foreground flex items-center gap-1.5 bg-[var(--input-bg)] px-2.5 py-1 rounded-xl border border-[var(--card-border)]">
            <span ref={currentTimeTextRef} className="font-bold text-primary">{formatTimelineTime(currentTime)}</span>
            <span className="text-[10px] text-[var(--text-muted)]">/</span>
            <span className="text-[10px] text-[var(--text-secondary)]">{formatTimelineTime(duration)}</span>
            <span ref={currentFrameTextRef} className="text-[9px] text-[var(--text-muted)] ml-1">
              (F: {currentFrame}/{totalFrames})
            </span>
          </div>
        </div>

        {/* Center: Quick Easing Presets Bar */}
        <div className="hidden lg:flex items-center gap-1 border-l border-r border-[var(--card-border)] px-2">
          <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mr-1">
            Ease:
          </span>
          {EASING_PRESETS.slice(0, 5).map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                if (project.selectedKeyframeId) {
                  onUpdateKeyframeEasing(project.selectedKeyframeId, preset.id);
                } else if (selectedElementId && onApplyEasingToTransforms) {
                  onApplyEasingToTransforms(selectedElementId, preset.id);
                }
              }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--input-bg)] hover:bg-primary/15 hover:border-primary/40 border border-[var(--card-border)] text-[10px] font-semibold text-foreground hover:text-primary transition-all"
              title={`Apply ${preset.label} to selected keyframe or layer (${preset.shortcut || preset.description})`}
            >
              <svg className="w-2.5 h-2.5 stroke-current fill-none stroke-[2]" viewBox="0 0 20 20">
                <path d={preset.curveSvgPath} />
              </svg>
              <span>{preset.shortLabel}</span>
            </button>
          ))}
        </div>

        {/* Right: Snapping & Zoom */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsGraphEditorOpen((open) => !open)}
            aria-pressed={isGraphEditorOpen}
            className={`rounded-lg border px-2 py-1 text-[9px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              isGraphEditorOpen
                ? 'border-primary/40 bg-primary/15 text-primary'
                : 'border-[var(--card-border)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-foreground'
            }`}
          >
            Graph Editor
          </button>
          {/* Snapping Toggle */}
          <button
            type="button"
            onClick={() => setSnapping(!snapping)}
            className={`p-1.5 rounded-xl transition-colors ${
              snapping ? 'text-primary bg-primary/20' : 'text-[var(--text-muted)] hover:text-foreground'
            }`}
            title={snapping ? 'Frame snapping ON' : 'Frame snapping OFF'}
          >
            <Magnet className="h-3.5 w-3.5" />
          </button>

          {/* Timeline Zoom Slider */}
          <div className="flex items-center gap-1.5 bg-[var(--input-bg)] px-2 py-1 rounded-xl border border-[var(--card-border)]">
            <ZoomOut className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            <input
              type="range"
              min="80"
              max="350"
              value={pixelsPerSec}
              onChange={(e) => setPixelsPerSec(Number(e.target.value))}
              className="w-16 accent-primary cursor-pointer h-1.5 rounded"
              style={{ width: '4rem', flex: '0 0 4rem' }}
              aria-label="Timeline zoom"
              title="Timeline Zoom"
            />
            <ZoomIn className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          </div>
        </div>
      </div>

      {/* 2. MAIN TRACKS & TIME RULER BODY */}
      {isGraphEditorOpen ? (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <GraphEditor
            project={project}
            selectedElementId={selectedElementId}
            onSelectElement={onSelectElement}
            onUpdateKeyframe={(keyframeId, updates) => onUpdateKeyframe?.(keyframeId, updates)}
          />
        </div>
      ) : (
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left: Tracks Name Column */}
        <div className="relative flex shrink-0 flex-col overflow-hidden border-r border-[var(--card-border)] bg-[var(--card-bg)]" style={{ width: layerColumnWidth, flexBasis: layerColumnWidth }}>
          {/* Ruler header space */}
          <div className="flex h-6 shrink-0 items-center justify-between border-b border-[var(--card-border)] bg-[var(--input-bg)] px-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            <span>Layers &amp; Tracks</span>
            <div className="flex items-center gap-1">
              <span>{visibleTimelineLayers.length}/{timelineLayers.length}</span>
              <button type="button" onClick={() => setHideShyLayers((hidden) => !hidden)} aria-pressed={hideShyLayers} aria-label={`${hideShyLayers ? 'Show' : 'Hide'} shy layers`} title={`${hideShyLayers ? 'Show' : 'Hide'} shy layers`} className={`rounded p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${hideShyLayers ? 'text-primary' : 'text-[var(--text-muted)] hover:text-foreground'}`}>
                <EyeOff className="h-3 w-3" />
              </button>
            </div>
          </div>

          <div className="flex h-5 shrink-0 items-center gap-1 border-b border-[var(--card-border)]/70 px-1 text-[8px] text-[var(--text-muted)]">
            <span title="Visibility"><Eye className="h-3 w-3" /></span>
            <span title="Solo"><CircleDot className="h-3 w-3" /></span>
            <span title="Lock"><Lock className="h-3 w-3" /></span>
            <span title="Layer color label" className="w-3 text-center">C</span>
            <span title="Layer number" className="w-3 text-center">#</span>
            <span title="Expand tracks"><ChevronRight className="h-3 w-3" /></span>
            <span title="Layer type"><Layers className="h-3 w-3" /></span>
            <span className="flex-1">Name</span>
            {layerColumnWidth >= 340 && <span title="Shy"><EyeOff className="h-3 w-3" /></span>}
            {layerColumnWidth >= 340 && <span title="Blend mode">Blend</span>}
            <span title="Animation parent">Parent</span>
          </div>

          {/* Track Rows Header */}
          <div ref={trackNamesRef} onScroll={handleScroll} className="flex-1 overflow-y-auto no-scrollbar py-1">
            {visibleTimelineLayers.length === 0 ? (
              <div className="p-4 text-center text-[var(--text-muted)] text-[11px] font-medium leading-relaxed">
                {timelineLayers.length ? 'All layers are shy and currently hidden.' : 'No layers yet. Add a shape or open an SVG to start animating.'}
              </div>
            ) : (
              <>
              {virtualLayerWindow.top > 0 && <div aria-hidden="true" style={{ height: virtualLayerWindow.top }} />}
              {renderedTimelineLayers.map(({ element, tracks }, renderedIndex) => {
                const layerIndex = virtualLayerWindow.start + renderedIndex;
                const elId = element.id;
                const isCollapsed = collapsedElements[elId] ?? false;
                const isSelected = (selectedElementIds?.length ? selectedElementIds : [selectedElementId]).includes(elId);
                const canShowAdvancedColumns = layerColumnWidth >= 340;

                return (
                  <div
                    key={elId}
                    className={`relative flex flex-col border-b border-[var(--card-border)]/50 ${dropIndicatorId === elId ? 'border-b-2 border-primary' : ''}`}
                    draggable
                    onDragStart={(event) => {
                      draggingLayerIdRef.current = elId;
                      event.dataTransfer.setData('text/plain', elId);
                      event.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragEnd={() => { draggingLayerIdRef.current = null; setDropIndicatorId(null); }}
                    onDragOver={(event) => {
                      if (!draggingLayerIdRef.current || draggingLayerIdRef.current === elId) return;
                      event.preventDefault();
                      setDropIndicatorId(elId);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const draggedId = draggingLayerIdRef.current ?? event.dataTransfer.getData('text/plain');
                      if (draggedId && draggedId !== elId) {
                        onReorderLayer?.(draggedId, elId, event.clientY > event.currentTarget.getBoundingClientRect().top + event.currentTarget.clientHeight / 2);
                      }
                      draggingLayerIdRef.current = null;
                      setDropIndicatorId(null);
                    }}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      if (!isSelected) onSelectElement(elId);
                      setLayerContextMenu({ id: elId, x: event.clientX, y: event.clientY });
                    }}
                  >
                    <div
                      onClick={(event) => chooseLayer(elId, event)}
                      onDoubleClick={() => {
                        setRenamingLayerId(elId);
                        setRenamingLayerText(element.name);
                      }}
                      className={`group flex h-8 min-w-0 items-center gap-0.5 overflow-hidden border-l-2 px-1 transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary font-bold'
                          : 'border-transparent hover:bg-[var(--hover-bg)] text-foreground'
                      }`}
                    >
                      {onToggleVisibility && (
                        <button type="button" onClick={(event) => { event.stopPropagation(); onToggleVisibility(elId); }} aria-label={element.visible ? `Hide ${element.name}` : `Show ${element.name}`} title="Visibility" className="shrink-0 rounded p-0.5 text-[var(--text-muted)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                          {element.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3 text-red-500" />}
                        </button>
                      )}
                      <button type="button" onClick={(event) => { event.stopPropagation(); onUpdateLayer?.(elId, { solo: !element.solo }); }} aria-pressed={Boolean(element.solo)} aria-label={`${element.solo ? 'Disable' : 'Solo'} ${element.name}`} title="Solo" className={`shrink-0 rounded p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${element.solo ? 'text-primary' : 'text-[var(--text-muted)] hover:text-foreground'}`}>
                        <CircleDot className="h-3 w-3" />
                      </button>
                      {onToggleLock && (
                        <button type="button" onClick={(event) => { event.stopPropagation(); onToggleLock(elId); }} aria-label={element.locked ? `Unlock ${element.name}` : `Lock ${element.name}`} title="Lock" className="shrink-0 rounded p-0.5 text-[var(--text-muted)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                          {element.locked ? <Lock className="h-3 w-3 text-amber-500" /> : <Unlock className="h-3 w-3" />}
                        </button>
                      )}
                      <div className="relative shrink-0">
                        <button type="button" onClick={(event) => { event.stopPropagation(); setLayerColorMenuId((current) => current === elId ? null : elId); }} aria-label={`Change ${element.name} color label`} title="Choose layer color label" className={`h-3 w-3 rounded-sm border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${getElementLayerColor(element)}`} />
                        {layerColorMenuId === elId && (
                          <div role="group" aria-label={`${element.name} color labels`} className="absolute left-0 top-full z-50 flex gap-1 rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] p-1 shadow-xl">
                            {LAYER_COLORS.map((color, colorIndex) => (
                              <button key={color} type="button" onClick={(event) => { event.stopPropagation(); onUpdateLayer?.(elId, { colorLabel: colorIndex }); setLayerColorMenuId(null); }} aria-label={`Set ${element.name} color label ${colorIndex + 1}`} aria-pressed={(element.colorLabel ?? 0) === colorIndex} className={`h-4 w-4 rounded-sm border ${LAYER_LABEL_CLASSES[color]} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`} />
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="w-3 shrink-0 text-center font-mono text-[8px] text-[var(--text-muted)]">{layerIndex + 1}</span>
                      {tracks.length > 0 ? (
                        <button type="button" onClick={(event) => { event.stopPropagation(); setCollapsedElements((previous) => ({ ...previous, [elId]: !isCollapsed })); }} className="shrink-0 text-[var(--text-muted)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={isCollapsed ? `Expand ${element.name} tracks` : `Collapse ${element.name} tracks`}>
                          {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                      ) : <span className="w-3 shrink-0" />}
                      <span className={`h-3 w-3 shrink-0 rounded-sm border ${getLayerColor(element.tagName)}`} title={`${element.tagName} layer`} />
                      {renamingLayerId === elId ? (
                        <input autoFocus value={renamingLayerText} onClick={(event) => event.stopPropagation()} onChange={(event) => setRenamingLayerText(event.target.value)} onBlur={() => { const name = renamingLayerText.trim(); if (name && name !== element.name) onRenameLayer?.(elId, name); setRenamingLayerId(null); }} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setRenamingLayerText(element.name); setRenamingLayerId(null); } }} aria-label={`Rename ${element.name}`} className="min-w-0 flex-1 rounded border border-primary bg-[var(--input-bg)] px-1 text-[10px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary" />
                      ) : (
                        <span className="min-w-0 flex-1 truncate text-[11px]" title={element.name}>{element.name}</span>
                      )}
                      {canShowAdvancedColumns && (
                        <button type="button" onClick={(event) => { event.stopPropagation(); onUpdateLayer?.(elId, { shy: !element.shy }); }} aria-pressed={Boolean(element.shy)} aria-label={`${element.shy ? 'Unmark' : 'Mark'} ${element.name} shy`} title={element.shy ? 'Unmark shy' : 'Mark shy'} className={`shrink-0 rounded p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${element.shy ? 'text-primary' : 'text-[var(--text-muted)] hover:text-foreground'}`}>
                          <EyeOff className="h-3 w-3" />
                        </button>
                      )}
                      {canShowAdvancedColumns && (
                        <select value={element.blendMode ?? 'normal'} onClick={(event) => event.stopPropagation()} onChange={(event) => onUpdateLayer?.(elId, { blendMode: event.target.value as NonNullable<SvgElementNode['blendMode']> })} aria-label={`${element.name} blend mode`} title="Layer blend mode" className="motion-studio-select w-10 shrink-0 rounded border border-transparent bg-transparent px-0 text-[8px] text-foreground outline-none hover:border-[var(--card-border)] focus-visible:ring-2 focus-visible:ring-primary">
                          <option value="normal">Norm</option><option value="multiply">Mult</option><option value="screen">Scrn</option><option value="overlay">Over</option><option value="add">Add</option>
                        </select>
                      )}
                      <select value={element.animParentId ?? ''} onClick={(event) => event.stopPropagation()} onChange={(event) => onUpdateLayer?.(elId, { animParentId: event.target.value || null })} aria-label={`${element.name} animation parent`} title="Animation parent" className="motion-studio-select w-10 shrink-0 rounded border border-transparent bg-transparent px-0 text-[8px] text-foreground outline-none hover:border-[var(--card-border)] focus-visible:ring-2 focus-visible:ring-primary">
                        <option value="">None</option>
                        {timelineLayers.filter(({ element: candidate }) => candidate.id !== elId).map(({ element: candidate }) => {
                          let ancestorId = candidate.animParentId ?? null;
                          let createsCycle = false;
                          while (ancestorId) {
                            if (ancestorId === elId) { createsCycle = true; break; }
                            ancestorId = findElementById(project.elements, ancestorId)?.animParentId ?? null;
                          }
                          return <option key={candidate.id} value={candidate.id} disabled={createsCycle}>{candidate.name}</option>;
                        })}
                      </select>
                      <div className="relative flex shrink-0 items-center">
                        {tracks.length > 0 && (
                          <span className="text-[9px] font-mono text-[var(--text-muted)]">{tracks.length}</span>
                        )}
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setPropertyMenuElementId((current) => current === elId ? null : elId);
                          }}
                          className="rounded p-1 text-[var(--text-muted)] opacity-0 transition-opacity hover:bg-primary/15 hover:text-primary group-hover:opacity-100 focus:opacity-100"
                          title={`Add an animated property to ${element.name}`}
                          aria-label={`Add animated property to ${element.name}`}
                          aria-expanded={propertyMenuElementId === elId}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        {propertyMenuElementId === elId && (
                          <div className="absolute right-0 top-full z-40 mt-1 max-h-56 w-40 overflow-y-auto rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-1 shadow-xl">
                            {ANIMATABLE_PROPERTIES.filter(({ key }) =>
                              ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity'].includes(key)
                            ).map(({ key, label }) => (
                              <button
                                key={key}
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onSelectElement(elId);
                                  onAddKeyframeAtPlayhead(elId, key);
                                  setPropertyMenuElementId(null);
                                }}
                                className="block w-full rounded px-2 py-1.5 text-left text-[10px] text-foreground hover:bg-primary/10 hover:text-primary"
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Sub-property rows (e.g. rotation, scaleX, opacity) */}
                    {tracks.length > 0 && !isCollapsed &&
                      tracks.map((track) => (
                        <div
                          key={track.id}
                          className="h-6 pl-6 pr-2 flex items-center justify-between text-[10px] font-mono text-[var(--text-secondary)] border-b border-[var(--card-border)]/20 hover:bg-[var(--hover-bg)]"
                        >
                          <span className="truncate">{track.property}</span>
                          <span className="text-[9px] text-[var(--text-muted)]">
                            {track.keyframes.length} pts
                          </span>
                        </div>
                      ))}
                  </div>
                );
              })}
              {virtualLayerWindow.bottom > 0 && <div aria-hidden="true" style={{ height: virtualLayerWindow.bottom }} />}
              </>
            )}
          </div>
          <div
            role="separator"
            aria-label="Resize timeline layer column"
            aria-orientation="vertical"
            aria-valuemin={220}
            aria-valuemax={480}
            aria-valuenow={Math.round(layerColumnWidth)}
            tabIndex={0}
            onPointerDown={handleLayerColumnResizeStart}
            onPointerMove={handleLayerColumnResizeMove}
            onPointerUp={handleLayerColumnResizeEnd}
            onPointerCancel={handleLayerColumnResizeEnd}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
              event.preventDefault();
              setLayerColumnWidth((width) => Math.max(220, Math.min(480, width + (event.key === 'ArrowRight' ? 12 : -12))));
            }}
            className="absolute inset-y-0 right-0 z-30 w-1 touch-none cursor-ew-resize bg-transparent hover:bg-primary/50 focus-visible:bg-primary focus-visible:outline-none"
            title="Drag to resize the layer column"
          />
        </div>

        {/* Right: Timeline Ruler & Canvas Lanes Area */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-[var(--main-bg)]">
          {/* Top Time Ruler */}
          <div
            ref={rulerContainerRef}
            onMouseDown={handleRulerMouseDown}
            onPointerMove={moveWorkAreaDrag}
            onPointerUp={endWorkAreaDrag}
            onPointerCancel={endWorkAreaDrag}
            onScroll={handleScroll}
            className="h-6 border-b border-[var(--card-border)] bg-[var(--input-bg)] overflow-x-auto no-scrollbar relative cursor-crosshair shrink-0"
          >
            <div style={{ width: `${timelineWidth}px` }} className="h-full relative">
              {/* Ruler Tick Marks */}
              {Array.from({ length: Math.ceil(duration * 10) + 1 }).map((_, i) => {
                const time = i / 10;
                const isSecond = i % 10 === 0;
                const hasLabel = isSecond && Math.round(time) % rulerMajorInterval === 0;
                const isHalf = i % 5 === 0 && !isSecond;
                const left = time * pixelsPerSec;

                return (
                  <div
                    key={i}
                    style={{ left: `${left}px` }}
                    className={`absolute bottom-0 w-[1px] ${
                      isSecond
                        ? 'h-3.5 bg-[var(--text-secondary)]'
                        : isHalf
                        ? 'h-2 bg-[var(--card-border)]'
                        : 'h-1 bg-[var(--card-border)]/40'
                    }`}
                  >
                    {hasLabel && (
                      <span
                        className="absolute left-1 top-0 whitespace-nowrap font-mono text-[10px] leading-3 text-[var(--text-secondary)]"
                        aria-hidden="true"
                      >
                        {formatRulerTime(time)}
                      </span>
                    )}
                  </div>
                );
              })}

              <div
                className="absolute inset-y-0 z-10 border-x border-primary/60 bg-primary/10 pointer-events-none"
                style={{
                  left: `${workArea.start * pixelsPerSec}px`,
                  width: `${Math.max(0, workArea.end - workArea.start) * pixelsPerSec}px`,
                }}
                aria-hidden="true"
              />
              <button
                type="button"
                data-work-area-handle
                aria-label="Set work area start"
                title="Drag work area start"
                onMouseDown={(event) => event.stopPropagation()}
                onPointerDown={(event) => beginWorkAreaDrag(event, 'start')}
                className="absolute inset-y-0 z-20 w-2 cursor-ew-resize bg-primary/60 hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                style={{ left: `${workArea.start * pixelsPerSec - 3}px` }}
              />
              <button
                type="button"
                data-work-area-handle
                aria-label="Set work area end"
                title="Drag work area end"
                onMouseDown={(event) => event.stopPropagation()}
                onPointerDown={(event) => beginWorkAreaDrag(event, 'end')}
                className="absolute inset-y-0 z-20 w-2 cursor-ew-resize bg-primary/60 hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                style={{ left: `${workArea.end * pixelsPerSec - 3}px` }}
              />
              {markers.map((marker) => (
                <button
                  key={marker.id}
                  type="button"
                  data-marker
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={() => onSeek(marker.time)}
                  onDoubleClick={() => {
                    const label = window.prompt('Marker label', marker.label);
                    if (label?.trim()) onUpdateMarker?.(marker.id, label.trim());
                  }}
                  title={`${marker.label} · ${formatTimelineTime(marker.time)}`}
                  aria-label={`Go to marker ${marker.label} at ${formatTimelineTime(marker.time)}`}
                  className="absolute top-0 z-30 h-3 min-w-3 -translate-x-1/2 rounded-sm bg-amber-400 px-0.5 text-[7px] font-bold leading-3 text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                  style={{ left: `${marker.time * pixelsPerSec}px` }}
                >
                  M
                </button>
              ))}

              {/* Playhead Head Triangle on Ruler */}
              <div
                ref={rulerPlayheadRef}
                style={{ left: `${currentTime * pixelsPerSec}px` }}
                className="absolute top-0 bottom-0 w-[1.5px] bg-red-500 z-30 pointer-events-none -translate-x-1/2"
              >
                <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-red-500 -translate-x-[3.25px]" />
              </div>
            </div>
          </div>

          {/* Keyframe Lanes Container */}
          <div
            ref={lanesContainerRef}
            onScroll={handleScroll}
            onMouseDown={(event) => {
              if (event.button !== 0 || (event.target as HTMLElement).closest('[data-keyframe-id]')) return;
              selectionStartRef.current = { x: event.clientX, y: event.clientY };
              marqueeMovedRef.current = false;
              setMarqueeRect(null);
              setIsMarqueeSelecting(true);
              onSelectKeyframes([], null);
            }}
            onClick={() => {
              if (marqueeMovedRef.current) {
                marqueeMovedRef.current = false;
                return;
              }
              if (selectedKeyframeIds.length > 0) {
                onSelectKeyframe(null);
              }
            }}
            className="flex-1 overflow-auto no-scrollbar relative bg-[var(--main-bg)]"
          >
            {marqueeRect && (
              <div
                className="absolute z-30 pointer-events-none border border-primary bg-primary/15"
                style={{
                  left: `${marqueeRect.left}px`,
                  top: `${marqueeRect.top}px`,
                  width: `${marqueeRect.width}px`,
                  height: `${marqueeRect.height}px`,
                }}
              />
            )}
            <div style={{ width: `${timelineWidth}px` }} className="relative min-h-full py-1">
              {/* Playhead vertical red line extending through all tracks */}
              <div
                ref={trackPlayheadRef}
                style={{ left: `${currentTime * pixelsPerSec}px` }}
                className="absolute top-0 bottom-0 w-[1.5px] bg-red-500/80 pointer-events-none z-20 -translate-x-1/2"
              />

              {/* Tracks Lanes */}
              {virtualLayerWindow.top > 0 && <div aria-hidden="true" style={{ height: virtualLayerWindow.top }} />}
              {renderedTimelineLayers.map(({ element, tracks }) => {
                const elId = element.id;
                const isCollapsed = collapsedElements[elId] ?? false;

                return (
                  <div key={elId} className="flex flex-col border-b border-[var(--card-border)]/40">
                    {/* Full-duration layer bar and summary keyframes */}
                    <div
                      onClick={() => onSelectElement(elId)}
                      className={`group h-8 relative border-b border-[var(--card-border)]/20 bg-[var(--card-bg)]/30 cursor-pointer ${
                        selectedElementId === elId ? 'bg-primary/[0.04]' : ''
                      }`}
                    >
                      <div
                        className={`absolute top-2 bottom-2 rounded-sm border ${getElementLayerColor(element)} ${
                          selectedElementId === elId ? 'brightness-125' : 'opacity-80'
                        }`}
                        title={`${element.name} · ${formatTimelineTime(element.inPoint ?? 0)}–${formatTimelineTime(element.outPoint ?? duration)} (drag the bar to slide, edges to trim)`}
                        style={{
                        left: `${(element.inPoint ?? 0) * pixelsPerSec}px`,
                        width: `${Math.max(0, (element.outPoint ?? duration) - (element.inPoint ?? 0)) * pixelsPerSec}px`,
                        }}
                        onPointerDown={(event) => beginLayerRangeDrag(event, element, 'slide')}
                        onPointerMove={moveLayerRangeDrag}
                        onPointerUp={endLayerRangeDrag}
                        onPointerCancel={endLayerRangeDrag}
                        >
                        <div
                          role="separator"
                          aria-label={`Trim start of ${element.name}`}
                          tabIndex={0}
                          onPointerDown={(event) => beginLayerRangeDrag(event, element, 'start')}
                          onKeyDown={(event) => {
                            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                            event.preventDefault();
                            event.stopPropagation();
                            const step = (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 10 : 1) / Math.max(1, fps);
                            const start = Math.max(0, Math.min((element.outPoint ?? duration) - 1 / Math.max(1, fps), (element.inPoint ?? 0) + step));
                            onUpdateLayerRange?.(elId, start, element.outPoint ?? duration);
                            onCommitLayerRange?.(elId, start, element.outPoint ?? duration);
                          }}
                          className="absolute inset-y-0 left-0 z-10 w-2 cursor-ew-resize rounded-l-sm bg-white/35 hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        />
                        <div
                          role="separator"
                          aria-label={`Trim end of ${element.name}`}
                          tabIndex={0}
                          onPointerDown={(event) => beginLayerRangeDrag(event, element, 'end')}
                          onKeyDown={(event) => {
                            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                            event.preventDefault();
                            event.stopPropagation();
                            const step = (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 10 : 1) / Math.max(1, fps);
                            const start = element.inPoint ?? 0;
                            const end = Math.max(start + 1 / Math.max(1, fps), Math.min(duration, (element.outPoint ?? duration) + step));
                            onUpdateLayerRange?.(elId, start, end);
                            onCommitLayerRange?.(elId, start, end);
                          }}
                          className="absolute inset-y-0 right-0 z-10 w-2 cursor-ew-resize rounded-r-sm bg-white/35 hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        />
                        </div>
                      {tracks.flatMap((t) => t.keyframes).filter((kf) => kf.time >= (element.inPoint ?? 0) && kf.time <= (element.outPoint ?? duration)).map((kf) => (
                        <div
                          key={kf.id}
                          style={{ left: `${kf.time * pixelsPerSec}px` }}
                          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-[1px] bg-primary rotate-45 pointer-events-none opacity-50"
                        />
                      ))}
                    </div>

                    {/* Sub-Property Lanes: interactive draggable diamond keyframes */}
                    {tracks.length > 0 && !isCollapsed &&
                      tracks.map((track) => (
                        <div
                          key={track.id}
                          className="h-6 relative border-b border-[var(--card-border)]/15 hover:bg-[var(--hover-bg)]"
                        >
                          {track.keyframes.filter((kf) => kf.time >= (element.inPoint ?? 0) && kf.time <= (element.outPoint ?? duration)).map((kf) => {
                            const isSelected = selectedKeyframeIds.includes(kf.id);
                            const badge = getEasingBadge(kf.easing);
                            return (
                              <div
                                key={kf.id}
                                data-keyframe-id={kf.id}
                                style={{ left: `${kf.time * pixelsPerSec}px` }}
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  if (e.button === 2) return;
                                  const isMultiSelect = e.shiftKey || e.ctrlKey || e.metaKey;
                                  const selectedIds = selectedKeyframeIds.length > 0 ? selectedKeyframeIds : [kf.id];
                                  if (isMultiSelect) {
                                    const allKeyframes = project.tracks
                                      .flatMap((item) => item.keyframes)
                                      .sort((a, b) => a.time - b.time);
                                    const anchorId = selectionAnchorRef.current ?? project.selectedKeyframeId;
                                    let nextIds: string[];

                                    if (e.shiftKey && anchorId) {
                                      const anchorIndex = allKeyframes.findIndex((item) => item.id === anchorId);
                                      const targetIndex = allKeyframes.findIndex((item) => item.id === kf.id);
                                      if (anchorIndex >= 0 && targetIndex >= 0) {
                                        const start = Math.min(anchorIndex, targetIndex);
                                        const end = Math.max(anchorIndex, targetIndex);
                                        nextIds = allKeyframes.slice(start, end + 1).map((item) => item.id);
                                      } else {
                                        nextIds = [kf.id];
                                      }
                                    } else {
                                      nextIds = selectedIds.includes(kf.id)
                                        ? selectedIds.filter((id) => id !== kf.id)
                                        : [...selectedIds, kf.id];
                                    }

                                    selectionAnchorRef.current = kf.id;
                                    const primaryId = nextIds.includes(kf.id) ? kf.id : nextIds.at(-1) ?? null;
                                    onSelectKeyframes(nextIds, primaryId);
                                    setDraggingKfId(null);
                                    dragStateRef.current = null;
                                    return;
                                  }

                                  const nextSelectedIds = selectedIds.includes(kf.id)
                                    ? selectedIds
                                    : [kf.id];
                                  const initialTimes = Object.fromEntries(
                                    nextSelectedIds.map((id) => {
                                      const keyframe = project.tracks
                                        .flatMap((track) => track.keyframes)
                                        .find((item) => item.id === id);
                                      return [id, keyframe?.time ?? 0];
                                    })
                                  );

                                  selectionAnchorRef.current = kf.id;
                                  onSelectKeyframes(nextSelectedIds, kf.id);
                                  if (!lanesContainerRef.current) return;
                                  const pointerStartTime = clientXToTime(e.clientX, lanesContainerRef.current);
                                  dragStateRef.current = {
                                    pointerStartTime,
                                    selectedIds: nextSelectedIds,
                                    initialTimes,
                                  };
                                  setDraggingKfId(kf.id);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  setContextKf({ id: kf.id, x: e.clientX, y: e.clientY });
                                }}
                                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 cursor-ew-resize transition-transform hover:scale-125 z-10 flex items-center justify-center ${
                                  (kf.interpolation ?? (kf.easing === 'linear' ? 'linear' : 'bezier')) === 'hold'
                                    ? 'rounded-sm'
                                    : (kf.interpolation ?? (kf.easing === 'linear' ? 'linear' : 'bezier')) === 'bezier'
                                      ? 'rounded-full'
                                      : 'rotate-45'
                                } ${
                                  isSelected
                                    ? 'bg-amber-400 border border-white shadow-md shadow-amber-400/50'
                                    : 'bg-primary hover:brightness-110 border border-emerald-300 dark:border-emerald-600 shadow-sm'
                                }`}
                                title={`Time: ${Math.round(kf.time * 100) / 100}s | Value: ${kf.value} | Interpolation: ${kf.interpolation ?? kf.easing} | Easing: ${kf.easing}`}
                              >
                                <span className={`${(kf.interpolation ?? (kf.easing === 'linear' ? 'linear' : 'bezier')) === 'linear' ? '-rotate-45' : ''} text-[7px] font-black text-[#071b17] pointer-events-none`}>
                                  {badge}
                                </span>
                              </div>
                            );
                          })}
                          {virtualLayerWindow.bottom > 0 && <div aria-hidden="true" style={{ height: virtualLayerWindow.bottom }} />}
                        </div>
                      ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      )}

      {layerContextMenu && (
        <div
          role="menu"
          aria-label="Layer actions"
          style={{
            top: Math.max(8, Math.min(layerContextMenu.y, window.innerHeight - 300)),
            left: Math.max(8, Math.min(layerContextMenu.x, window.innerWidth - 190)),
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setLayerContextMenu(null);
          }}
          className="fixed z-[60] w-48 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-1 text-[10px] text-foreground shadow-2xl"
        >
          {(() => {
            const element = findElementById(project.elements, layerContextMenu.id);
            const ids = getSelectedLayerIds().includes(layerContextMenu.id)
              ? getSelectedLayerIds()
              : [layerContextMenu.id];
            if (!element) return null;
            const action = (label: string, run: () => void) => (
              <button key={label} type="button" role="menuitem" onClick={() => { run(); setLayerContextMenu(null); }} className="block w-full rounded px-2 py-1.5 text-left hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                {label}
              </button>
            );
            return (
              <>
                {action('Rename', () => { setRenamingLayerId(element.id); setRenamingLayerText(element.name); })}
                {action('Duplicate', () => onDuplicateLayers?.(ids))}
                {action('Delete', () => onDeleteLayers?.(ids))}
                {action(element.solo ? 'Unsolo' : 'Solo', () => onUpdateLayer?.(element.id, { solo: !element.solo }))}
                {action(element.locked ? 'Unlock' : 'Lock', () => onToggleLock?.(element.id))}
                {action(element.visible ? 'Hide' : 'Show', () => onToggleVisibility?.(element.id))}
                {action('Bring to front', () => onMoveLayersToEdge?.(ids, 'front'))}
                {action('Send to back', () => onMoveLayersToEdge?.(ids, 'back'))}
                {action('Reset transform', () => onResetLayerTransform?.(element.id))}
                {action('Select children', () => onSelectLayerChildren?.(element.id))}
              </>
            );
          })()}
        </div>
      )}

      {/* Context Menu for Keyframe */}
      {contextKf && (
        <div
          style={{ top: `${Math.max(10, contextKf.y - 200)}px`, left: `${contextKf.x}px` }}
          className="fixed z-50 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl shadow-2xl p-1.5 w-52 text-xs space-y-1 backdrop-blur-xl text-foreground"
        >
          <div className="px-2 py-1 text-[10px] font-bold text-[var(--text-muted)] uppercase border-b border-[var(--card-border)]">
            Keyframe Options
          </div>
          <button
            type="button"
            onClick={() => {
              onDuplicateKeyframe(contextKf.id);
              setContextKf(null);
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-foreground hover:bg-primary/10 hover:text-primary transition-colors font-medium"
          >
            <Copy className="h-3.5 w-3.5" /> Duplicate (Ctrl+D)
          </button>
          <button
            type="button"
            onClick={() => {
              copySelectedKeyframes(contextKf.id);
              setContextKf(null);
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-foreground hover:bg-primary/10 hover:text-primary transition-colors font-medium"
          >
            <Copy className="h-3.5 w-3.5" /> Copy keyframes (Ctrl+C)
          </button>
          <button
            type="button"
            disabled={!clipboardCount || !selectedElementId}
            onClick={() => {
              if (selectedElementId) {
                onPasteKeyframes?.(selectedElementId, currentTime, keyframeClipboardRef.current);
              }
              setContextKf(null);
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-foreground hover:bg-primary/10 hover:text-primary transition-colors font-medium disabled:opacity-40 disabled:pointer-events-none"
          >
            <Copy className="h-3.5 w-3.5" /> Paste at playhead (Ctrl+V)
          </button>
          <button
            type="button"
            onClick={() => {
              const selectedIds = selectedKeyframeIds.length > 0 ? selectedKeyframeIds : project.selectedKeyframeId ? [project.selectedKeyframeId] : [];
              onDeleteKeyframes(selectedIds.includes(contextKf.id) ? selectedIds : [contextKf.id]);
              setContextKf(null);
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-red-500 hover:bg-red-500/10 transition-colors font-medium"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete selected (Del)
          </button>
          <div className="border-t border-[var(--card-border)] pt-1">
            <span className="px-2 text-[9px] text-[var(--text-muted)] font-bold block mb-0.5">Interpolation</span>
            {([
              { value: 'linear', label: 'Linear' },
              { value: 'bezier', label: 'Bezier' },
              { value: 'hold', label: 'Hold' },
            ] as const).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onUpdateKeyframeInterpolation?.(contextKf.id, option.value);
                  setContextKf(null);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1 rounded-lg text-[11px] text-[var(--text-secondary)] hover:text-foreground hover:bg-[var(--hover-bg)] transition-colors"
              >
                <span>{option.label}</span>
                <span>{option.value === 'hold' ? '■' : option.value === 'bezier' ? '●' : '◆'}</span>
              </button>
            ))}
          </div>
          <div className="border-t border-[var(--card-border)] pt-1">
            <span className="px-2 text-[9px] text-[var(--text-muted)] font-bold block mb-0.5">
              Set Easing Preset
            </span>
            {EASING_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  onUpdateKeyframeEasing(contextKf.id, preset.id);
                  setContextKf(null);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1 rounded-lg text-[11px] text-[var(--text-secondary)] hover:text-foreground hover:bg-[var(--hover-bg)] transition-colors"
              >
                <span>{preset.label}</span>
                <span className="text-[9px] text-[var(--text-muted)]">{preset.shortcut || ''}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </footer>
  );
};

export default Timeline;
