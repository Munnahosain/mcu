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
  Folder,
  Layers,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  FastForward,
  Rewind,
  Sparkles,
} from 'lucide-react';
import {
  ProjectState,
  AnimationTrack,
  Keyframe,
  AnimProperty,
  EasingType,
  SvgElementNode,
} from './types';
import { ANIMATABLE_PROPERTIES, EASING_OPTIONS } from './constants';
import { findElementById, flattenElementTree } from './svgParser';
import { EASING_PRESETS, getAdjacentKeyframes } from './keyframeManager';

function formatTimelineTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
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

interface TimelineProps {
  project: ProjectState;
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
}

export const Timeline: React.FC<TimelineProps> = ({
  project,
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
  const [timelineHeight, setTimelineHeight] = useState(260);
  const resizeStartRef = useRef<{ y: number; height: number } | null>(null);

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

  const { duration, fps, loop } = project.document;
  const currentTime = project.currentTime;
  const timelineWidth = Math.max(800, duration * pixelsPerSec);
  const selectedKeyframeIds = useMemo(() => {
    if (project.selectedKeyframeIds && project.selectedKeyframeIds.length > 0) {
      return project.selectedKeyframeIds;
    }
    return project.selectedKeyframeId ? [project.selectedKeyframeId] : [];
  }, [project.selectedKeyframeId, project.selectedKeyframeIds]);

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
  }, [isScrubbing, draggingKfId, isMarqueeSelecting, clientXToTime, onSeek, onMoveKeyframe, onSelectKeyframes, pixelsPerSec]);

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
    setTimelineHeight(Math.max(160, Math.min(maxHeight, nextHeight)));
  };

  const handleResizeEnd = () => {
    resizeStartRef.current = null;
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
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left: Tracks Name Column */}
        <div className="w-64 border-r border-[var(--card-border)] bg-[var(--card-bg)] flex flex-col shrink-0 overflow-hidden">
          {/* Ruler header space */}
          <div className="h-6 border-b border-[var(--card-border)] bg-[var(--input-bg)] px-2.5 flex items-center justify-between text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
            <span>Layers &amp; Tracks</span>
            <span>{timelineLayers.length} Layers</span>
          </div>

          {/* Track Rows Header */}
          <div ref={trackNamesRef} onScroll={handleScroll} className="flex-1 overflow-y-auto no-scrollbar py-1">
            {timelineLayers.length === 0 ? (
              <div className="p-4 text-center text-[var(--text-muted)] text-[11px] font-medium leading-relaxed">
                No layers yet. Add a shape or open an SVG to start animating.
              </div>
            ) : (
              timelineLayers.map(({ element, tracks }) => {
                const elId = element.id;
                const isCollapsed = collapsedElements[elId] ?? false;
                const isSelected = selectedElementId === elId;

                return (
                  <div key={elId} className="flex flex-col border-b border-[var(--card-border)]/50">
                    {/* Master Element Track Header */}
                    <div
                      onClick={() => onSelectElement(elId)}
                      className={`group h-8 px-2 flex items-center justify-between cursor-pointer border-l-2 transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary font-bold'
                          : 'border-transparent hover:bg-[var(--hover-bg)] text-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {tracks.length > 0 ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCollapsedElements((prev) => ({ ...prev, [elId]: !isCollapsed }));
                            }}
                            className="text-[var(--text-muted)] hover:text-foreground"
                            aria-label={isCollapsed ? `Expand ${element.name} tracks` : `Collapse ${element.name} tracks`}
                          >
                            {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </button>
                        ) : (
                          <span className="w-3" />
                        )}
                        <span className={`h-2.5 w-2.5 rounded-sm shrink-0 border ${getLayerColor(element.tagName)}`} />
                        <span className="text-[11px] truncate">{element.name}</span>
                      </div>

                      <div className="relative flex items-center gap-1">
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
              })
            )}
          </div>
        </div>

        {/* Right: Timeline Ruler & Canvas Lanes Area */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-[var(--main-bg)]">
          {/* Top Time Ruler */}
          <div
            ref={rulerContainerRef}
            onMouseDown={handleRulerMouseDown}
            onScroll={handleScroll}
            className="h-6 border-b border-[var(--card-border)] bg-[var(--input-bg)] overflow-x-auto no-scrollbar relative cursor-crosshair shrink-0"
          >
            <div style={{ width: `${timelineWidth}px` }} className="h-full relative pointer-events-none">
              {/* Ruler Tick Marks */}
              {Array.from({ length: Math.ceil(duration * 10) + 1 }).map((_, i) => {
                const time = i / 10;
                const isSecond = i % 10 === 0;
                const isHalf = i % 5 === 0 && !isSecond;
                const left = time * pixelsPerSec;

                return (
                  <div
                    key={i}
                    style={{ left: `${left}px` }}
                    className={`absolute bottom-0 w-[1px] ${
                      isSecond
                        ? 'h-3.5 bg-[var(--text-secondary)] font-mono text-[8px] text-[var(--text-muted)]'
                        : isHalf
                        ? 'h-2 bg-[var(--card-border)]'
                        : 'h-1 bg-[var(--card-border)]/40'
                    }`}
                  >
                    {isSecond && <span className="absolute -top-3.5 -left-2">{time}s</span>}
                  </div>
                );
              })}

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
              {timelineLayers.map(({ element, tracks }) => {
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
                        className={`absolute left-1 right-1 top-2 bottom-2 rounded-sm border ${getLayerColor(element.tagName)} ${
                          selectedElementId === elId ? 'brightness-125' : 'opacity-80'
                        }`}
                        title={`${element.name} · ${formatTimelineTime(duration)}`}
                      />
                      {tracks.flatMap((t) => t.keyframes).map((kf) => (
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
                          {track.keyframes.map((kf) => {
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
                                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rotate-45 cursor-ew-resize transition-transform hover:scale-125 z-10 flex items-center justify-center ${
                                  isSelected
                                    ? 'bg-amber-400 border border-white shadow-md shadow-amber-400/50'
                                    : 'bg-primary hover:brightness-110 border border-emerald-300 dark:border-emerald-600 shadow-sm'
                                }`}
                                title={`Time: ${Math.round(kf.time * 100) / 100}s | Value: ${kf.value} | Easing: ${kf.easing} | Ctrl/Cmd-click to add, Shift-click for range`}
                              >
                                <span className="-rotate-45 text-[7px] font-black text-[#071b17] pointer-events-none">
                                  {badge}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

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
              const selectedIds = selectedKeyframeIds.length > 0 ? selectedKeyframeIds : project.selectedKeyframeId ? [project.selectedKeyframeId] : [];
              onDeleteKeyframes(selectedIds.includes(contextKf.id) ? selectedIds : [contextKf.id]);
              setContextKf(null);
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-red-500 hover:bg-red-500/10 transition-colors font-medium"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete selected (Del)
          </button>
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
