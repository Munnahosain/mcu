'use client';

import React, { useRef, useEffect, useLayoutEffect, useState, useCallback, useMemo } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Move, RotateCw, ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import { ProjectState, SvgElementNode, BoundingBox } from './types';
import { computeElementStylesAtTime, applyComputedStylesToElement } from './animationEngine';
import { findElementById, flattenElementTree } from './svgParser';

interface CanvasViewportProps {
  project: ProjectState;
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  showGrid: boolean;
  showRulers: boolean;
  showSafeArea: boolean;
  canvasBg: string;
  onUpdateTransform: (
    elementId: string,
    transform: { x?: number; y?: number; rotation?: number; scaleX?: number; scaleY?: number; originX?: number; originY?: number }
  ) => void;
  onOpenSvgFile: (file: File) => void;
  isRegionCutMode: boolean;
  onCreateImageRegion: (region: BoundingBox) => void;
  onFitToScreenTrigger?: (callback: () => void) => void;
  isLeftCollapsed: boolean;
  onToggleLeftSidebar: () => void;
  isRightCollapsed: boolean;
  onToggleRightSidebar: () => void;
  onRegisterPlaybackRenderer: (renderer: ((time: number) => void) | null) => void;
}

const SvgMarkup = React.memo(function SvgMarkup({
  svgRaw,
  wrapperRef,
}: {
  svgRaw: string;
  wrapperRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={wrapperRef}
      className="absolute inset-0 w-full h-full select-none"
      dangerouslySetInnerHTML={{ __html: svgRaw }}
    />
  );
});

export const CanvasViewport: React.FC<CanvasViewportProps> = ({
  project,
  selectedElementId,
  onSelectElement,
  showGrid,
  showRulers,
  showSafeArea,
  canvasBg,
  onUpdateTransform,
  onOpenSvgFile,
  isRegionCutMode,
  onCreateImageRegion,
  onFitToScreenTrigger,
  isLeftCollapsed,
  onToggleLeftSidebar,
  isRightCollapsed,
  onToggleRightSidebar,
  onRegisterPlaybackRenderer,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgWrapperRef = useRef<HTMLDivElement>(null);
  const selectionOverlayRef = useRef<HTMLDivElement>(null);
  const svgNodesRef = useRef<SVGElement[]>([]);
  const animatedNodesRef = useRef<SVGElement[]>([]);

  // Viewport navigation state (Pan & Zoom)
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Mouse cursor position on canvas (for rulers)
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Selected element bounding box on screen
  const [selectionBox, setSelectionBox] = useState<BoundingBox | null>(null);

  // Interaction dragging: 'move' | 'rotate' | 'origin' | 'nw' | 'ne' | 'se' | 'sw' | null
  const [dragMode, setDragMode] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; initialVal?: any }>({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  const [isFileDragActive, setIsFileDragActive] = useState(false);
  const [regionSelection, setRegionSelection] = useState<BoundingBox | null>(null);
  const regionSelectionRef = useRef<BoundingBox | null>(null);
  const regionStartRef = useRef<{ x: number; y: number } | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const { viewBox } = project.document;
  const { currentTime } = project;
  const elementById = useMemo(
    () => new Map(flattenElementTree(project.elements).map((element) => [element.id, element])),
    [project.elements]
  );
  const animatedElementIds = useMemo(
    () => new Set(project.tracks.map((track) => track.elementId)),
    [project.tracks]
  );

  useLayoutEffect(() => {
    const svgEl = svgWrapperRef.current?.querySelector('svg');
    svgNodesRef.current = svgEl
      ? Array.from(svgEl.querySelectorAll<SVGElement>('[data-mcu-id]'))
      : [];
    animatedNodesRef.current = svgNodesRef.current.filter((node) =>
      animatedElementIds.has(node.getAttribute('data-mcu-id') || '')
    );
    svgNodesRef.current.forEach((node) => {
      const elementId = node.getAttribute('data-mcu-id');
      const elementNode = elementId ? elementById.get(elementId) : undefined;
      node.style.display = elementNode?.visible === false ? 'none' : '';
    });
  }, [project, animatedElementIds, elementById]);
  const vbW = viewBox?.width || 800;
  const vbH = viewBox?.height || 600;

  // Fit to screen calculation
  const handleFitToScreen = useCallback(() => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    if (!clientWidth || !clientHeight) return;
    const padding = 80;
    const availableW = Math.max(100, clientWidth - padding);
    const availableH = Math.max(100, clientHeight - padding);

    const scaleW = availableW / vbW;
    const scaleH = availableH / vbH;
    const fitScale = Math.min(scaleW, scaleH, 1.5);
    const newPanX = (clientWidth - vbW * fitScale) / 2;
    const newPanY = (clientHeight - vbH * fitScale) / 2;

    setZoom((prev) => (Math.abs(prev - fitScale) < 0.001 ? prev : fitScale));
    setPan((prev) =>
      Math.abs(prev.x - newPanX) < 1 && Math.abs(prev.y - newPanY) < 1
        ? prev
        : { x: newPanX, y: newPanY }
    );
  }, [vbW, vbH]);

  // Register trigger callback without triggering infinite render loop
  useEffect(() => {
    if (onFitToScreenTrigger) {
      onFitToScreenTrigger(handleFitToScreen);
    }
  }, [onFitToScreenTrigger, handleFitToScreen]);

  // Initial fit to screen on mount and when viewBox dimensions change
  const initialFitDoneRef = useRef(false);
  useEffect(() => {
    if (!initialFitDoneRef.current) {
      initialFitDoneRef.current = true;
      handleFitToScreen();
    }
  }, [handleFitToScreen]);

  const renderAnimationAtTime = useCallback((time: number) => {
    animatedNodesRef.current.forEach((node) => {
      const elementId = node.getAttribute('data-mcu-id');
      if (!elementId) return;

      const elementNode = elementById.get(elementId);
      if (!elementNode) return;

      const display = elementNode.visible ? '' : 'none';
      if (node.style.display !== display) node.style.display = display;
      if (!elementNode.visible) return;

      const styles = computeElementStylesAtTime(
        project.tracks,
        elementId,
        time,
        elementNode.initialTransform,
        elementNode.initialAppearance
      );
      applyComputedStylesToElement(node, styles);
    });

    if (selectedElementId && selectionOverlayRef.current) {
      const selectedNode = elementById.get(selectedElementId);
      const styles = computeElementStylesAtTime(
        project.tracks,
        selectedElementId,
        time,
        selectedNode?.initialTransform,
        selectedNode?.initialAppearance
      );
      selectionOverlayRef.current.style.transform =
        `translate(${styles.x}px, ${styles.y}px) rotate(${styles.rotation}deg) ` +
        `scale(${styles.scaleX / 100}, ${styles.scaleY / 100})`;
      selectionOverlayRef.current.style.transformOrigin = `${styles.originX}% ${styles.originY}%`;
    }
  }, [elementById, project.tracks, selectedElementId]);

  useLayoutEffect(() => {
    renderAnimationAtTime(currentTime);
  }, [project, currentTime, renderAnimationAtTime]);

  useEffect(() => {
    onRegisterPlaybackRenderer(renderAnimationAtTime);
    renderAnimationAtTime(currentTime);
    return () => onRegisterPlaybackRenderer(null);
  }, [currentTime, onRegisterPlaybackRenderer, renderAnimationAtTime, project.svgRaw]);

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      const svgEl = svgWrapperRef.current?.querySelector('svg');
      const activeEl = selectedElementId
        ? (svgEl?.querySelector(`[data-mcu-id="${selectedElementId}"]`) as SVGGraphicsElement | null)
        : null;

      if (!activeEl || typeof activeEl.getBBox !== 'function') {
        setSelectionBox(null);
        return;
      }

      try {
        const bbox = activeEl.getBBox();
        setSelectionBox({ x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height });
      } catch {
        setSelectionBox(null);
      }
    });

    return () => cancelAnimationFrame(frameId);
  }, [selectedElementId, project.elements, project.svgRaw]);

  // Keyboard navigation & panning (Space key)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && (e.target as HTMLElement).tagName !== 'INPUT') {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        setIsPanning(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      setZoom((z) => Math.max(0.15, Math.min(5.0, z * zoomFactor)));
    } else {
      // Pan with 2-finger trackpad or wheel
      setPan((p) => ({
        x: p.x - e.deltaX,
        y: p.y - e.deltaY,
      }));
    }
  };

  // Canvas Mouse Down: pan or select
  const handleMouseDown = (e: React.MouseEvent) => {
    // Middle click or Space+LeftClick initiates Pan
    if (e.button === 1 || (e.button === 0 && isSpacePressed)) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    if (isRegionCutMode && e.button === 0) {
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = Math.max(0, Math.min(vbW, (e.clientX - rect.left - pan.x) / zoom));
      const y = Math.max(0, Math.min(vbH, (e.clientY - rect.top - pan.y) / zoom));
      regionStartRef.current = { x, y };
      const selection = { x, y, width: 0, height: 0 };
      regionSelectionRef.current = selection;
      setRegionSelection(selection);
      return;
    }

    // Direct click on SVG element
    const target = e.target as Element;
    const clickedElement = target.closest('[data-mcu-id]');
    if (clickedElement) {
      const elId = clickedElement.getAttribute('data-mcu-id');
      if (elId) {
        onSelectElement(elId);
        return;
      }
    }

    // Clicked empty background deselects element
    if (e.button === 0 && !dragMode) {
      onSelectElement(null);
    }
  };

  // Canvas Mouse Move
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const curX = Math.round((e.clientX - rect.left - pan.x) / zoom);
    const curY = Math.round((e.clientY - rect.top - pan.y) / zoom);
    if (showRulers) {
      setMousePos((prev) => (prev.x === curX && prev.y === curY ? prev : { x: curX, y: curY }));
    }

    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    if (regionStartRef.current) {
      const start = regionStartRef.current;
      const x = Math.max(0, Math.min(vbW, (e.clientX - rect.left - pan.x) / zoom));
      const y = Math.max(0, Math.min(vbH, (e.clientY - rect.top - pan.y) / zoom));
      const selection = {
        x: Math.min(start.x, x),
        y: Math.min(start.y, y),
        width: Math.abs(x - start.x),
        height: Math.abs(y - start.y),
      };
      regionSelectionRef.current = selection;
      setRegionSelection(selection);
      return;
    }

    // Handle Direct Manipulation of Selected Element on Canvas
    if (dragMode && selectedElementId) {
      const deltaX = (e.clientX - dragStart.x) / zoom;
      const deltaY = (e.clientY - dragStart.y) / zoom;

      if (dragMode === 'move') {
        const initX = dragStart.initialVal?.x || 0;
        const initY = dragStart.initialVal?.y || 0;
        onUpdateTransform(selectedElementId, {
          x: Math.round(initX + deltaX),
          y: Math.round(initY + deltaY),
        });
      } else if (dragMode === 'rotate') {
        // Calculate angle relative to selection box center
        if (selectionBox) {
          const centerX = pan.x + (selectionBox.x + selectionBox.width / 2) * zoom;
          const centerY = pan.y + (selectionBox.y + selectionBox.height / 2) * zoom;
          const rad = Math.atan2(e.clientY - centerY, e.clientX - centerX);
          let deg = Math.round(rad * (180 / Math.PI)) + 90; // stem is pointing up
          if (deg > 180) deg -= 360;
          if (deg < -180) deg += 360;
          onUpdateTransform(selectedElementId, { rotation: deg });
        }
      } else if (dragMode === 'origin') {
        if (selectionBox && selectionBox.width > 0 && selectionBox.height > 0) {
          const originXPct = Math.max(0, Math.min(100, Math.round(((curX - selectionBox.x) / selectionBox.width) * 100)));
          const originYPct = Math.max(0, Math.min(100, Math.round(((curY - selectionBox.y) / selectionBox.height) * 100)));
          onUpdateTransform(selectedElementId, { originX: originXPct, originY: originYPct });
        }
      }
    }
  };

  // Canvas Mouse Up
  const handleMouseUp = () => {
    setIsPanning(false);
    setDragMode(null);
    const selection = regionSelectionRef.current;
    regionStartRef.current = null;
    regionSelectionRef.current = null;
    setRegionSelection(null);
    if (selection && selection.width >= 2 && selection.height >= 2) {
      onCreateImageRegion(selection);
    }
  };

  useEffect(() => {
    if (!isRegionCutMode) {
      regionStartRef.current = null;
      regionSelectionRef.current = null;
      setRegionSelection(null);
    }
  }, [isRegionCutMode]);

  // Arrow keys nudging for precision placement
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedElementId) return;
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT') {
        return;
      }

      const step = e.shiftKey ? 10 : 1;
      let deltaX = 0;
      let deltaY = 0;

      if (e.key === 'ArrowLeft') deltaX = -step;
      else if (e.key === 'ArrowRight') deltaX = step;
      else if (e.key === 'ArrowUp') deltaY = -step;
      else if (e.key === 'ArrowDown') deltaY = step;

      if (deltaX !== 0 || deltaY !== 0) {
        e.preventDefault();
        const selectedNode = elementById.get(selectedElementId);
        const currentStyles = computeElementStylesAtTime(
          project.tracks,
          selectedElementId,
          currentTime,
          selectedNode?.initialTransform,
          selectedNode?.initialAppearance
        );
        onUpdateTransform(selectedElementId, {
          x: currentStyles.x + deltaX,
          y: currentStyles.y + deltaY,
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementId, currentTime, project.tracks, elementById, onUpdateTransform]);

  // Selected element current computed transform
  const selectedStyles = selectedElementId
    ? computeElementStylesAtTime(
        project.tracks,
        selectedElementId,
        currentTime,
        elementById.get(selectedElementId)?.initialTransform,
        elementById.get(selectedElementId)?.initialAppearance
      )
    : null;

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      className="relative flex-1 min-w-0 h-full w-full bg-[var(--main-bg)] text-foreground overflow-hidden select-none cursor-default transition-colors"
      style={{ touchAction: 'none', cursor: isRegionCutMode ? 'crosshair' : undefined }}
    >
      <button
        type="button"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={onToggleLeftSidebar}
        className="z-30 flex h-9 w-4 items-center justify-center rounded-r-md border border-[var(--card-border)] bg-[var(--card-bg)]/90 text-[var(--text-secondary)] shadow-md transition-colors hover:bg-primary hover:text-[#071b17]"
        style={{ position: 'absolute', top: 'calc(50% - 18px)', left: '24px' }}
        title={isLeftCollapsed ? 'Expand Layers' : 'Collapse Layers'}
        aria-label={isLeftCollapsed ? 'Expand Layers' : 'Collapse Layers'}
      >
        {isLeftCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>

      <button
        type="button"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={onToggleRightSidebar}
        className="z-30 flex h-9 w-4 items-center justify-center rounded-l-md border border-[var(--card-border)] bg-[var(--card-bg)]/90 text-[var(--text-secondary)] shadow-md transition-colors hover:bg-primary hover:text-[#071b17]"
        style={{ position: 'absolute', top: 'calc(50% - 18px)', right: '4px' }}
        title={isRightCollapsed ? 'Expand Inspector' : 'Collapse Inspector'}
        aria-label={isRightCollapsed ? 'Expand Inspector' : 'Collapse Inspector'}
      >
        {isRightCollapsed ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>

      {/* Top Ruler */}
      {showRulers && (
        <div className="absolute top-0 left-6 right-0 h-6 bg-[var(--card-bg)] border-b border-[var(--card-border)] z-20 overflow-hidden flex items-end">
          <svg className="w-full h-full">
            {Array.from({ length: 60 }).map((_, i) => {
              const xPos = pan.x + (i * 100 - (viewBox.x || 0)) * zoom;
              if (xPos < -100 || xPos > 3000) return null;
              return (
                <g key={i} transform={`translate(${xPos}, 0)`}>
                  <line x1="0" y1="14" x2="0" y2="24" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1" />
                  <text x="3" y="12" fill="currentColor" fillOpacity="0.5" fontSize="9" fontFamily="monospace">
                    {i * 100}
                  </text>
                  <line x1="50" y1="19" x2="50" y2="24" stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" />
                </g>
              );
            })}
            {/* Mouse guide marker */}
            <line
              x1={pan.x + mousePos.x * zoom}
              y1="0"
              x2={pan.x + mousePos.x * zoom}
              y2="24"
              stroke="#16c784"
              strokeWidth="1.5"
            />
          </svg>
        </div>
      )}

      {/* Left Ruler */}
      {showRulers && (
        <div className="absolute top-6 left-0 bottom-0 w-6 bg-[var(--card-bg)] border-r border-[var(--card-border)] z-20 overflow-hidden">
          <svg className="w-full h-full">
            {Array.from({ length: 50 }).map((_, i) => {
              const yPos = pan.y + (i * 100 - (viewBox.y || 0)) * zoom;
              if (yPos < -100 || yPos > 3000) return null;
              return (
                <g key={i} transform={`translate(0, ${yPos})`}>
                  <line x1="14" y1="0" x2="24" y2="0" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1" />
                  <text
                    x="2"
                    y="10"
                    fill="currentColor"
                    fillOpacity="0.5"
                    fontSize="8"
                    fontFamily="monospace"
                    transform="rotate(-90 8 10)"
                  >
                    {i * 100}
                  </text>
                  <line x1="19" y1="50" x2="24" y2="50" stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" />
                </g>
              );
            })}
            {/* Mouse guide marker */}
            <line
              x1="0"
              y1={pan.y + mousePos.y * zoom}
              x2="24"
              y2={pan.y + mousePos.y * zoom}
              stroke="#16c784"
              strokeWidth="1.5"
            />
          </svg>
        </div>
      )}

      {/* Origin Corner */}
      {showRulers && (
        <div className="absolute top-0 left-0 w-6 h-6 bg-[var(--card-bg)] border-r border-b border-[var(--card-border)] z-30 flex items-center justify-center text-[9px] text-[var(--text-muted)] font-mono font-bold">
          px
        </div>
      )}

      {/* Main Interactive Canvas Board */}
      <div
        id="canvas-board"
        className="absolute inset-0"
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            width: `${vbW}px`,
            height: `${vbH}px`,
            position: 'absolute',
            left: 0,
            top: 0,
          }}
          className="relative transition-transform duration-75 ease-out shadow-2xl ring-1 ring-[var(--card-border)]"
        >
          {/* Canvas Background Surface */}
          <div
            className="absolute inset-0 w-full h-full overflow-hidden"
            style={{
              backgroundColor: canvasBg === 'checkerboard' ? 'transparent' : canvasBg,
              backgroundImage:
                canvasBg === 'checkerboard'
                  ? 'linear-gradient(45deg, rgba(128,128,128,0.2) 25%, transparent 25%), linear-gradient(-45deg, rgba(128,128,128,0.2) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(128,128,128,0.2) 75%), linear-gradient(-45deg, transparent 75%, rgba(128,128,128,0.2) 75%)'
                  : undefined,
              backgroundSize: '16px 16px',
              backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
            }}
          >
            {/* Subtle Grid Overlay */}
            {showGrid && (
              <div
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{
                  backgroundImage:
                    'linear-gradient(to right, rgba(128, 128, 128, 0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(128, 128, 128, 0.12) 1px, transparent 1px)',
                  backgroundSize: '40px 40px',
                }}
              />
            )}

            {/* Safe Area Guides Overlay (Action Safe 90%, Title Safe 80%) */}
            {showSafeArea && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Action Safe (90%) */}
                <div className="absolute inset-[5%] border border-emerald-500/50 border-dashed rounded-sm">
                  <span className="absolute top-1 left-2 text-[9px] text-emerald-500 font-mono tracking-wider font-bold">
                    ACTION SAFE (90%)
                  </span>
                </div>
                {/* Title Safe (80%) */}
                <div className="absolute inset-[10%] border border-teal-500/50 border-dotted rounded-sm">
                  <span className="absolute top-1 left-2 text-[9px] text-teal-500 font-mono tracking-wider font-bold">
                    TITLE SAFE (80%)
                  </span>
                </div>
                {/* Center Crosshair */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 pointer-events-none">
                  <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-emerald-500/60" />
                  <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-emerald-500/60" />
                </div>
              </div>
            )}
          </div>

          {/* SVG Content Mount */}
          <SvgMarkup svgRaw={project.svgRaw} wrapperRef={svgWrapperRef} />

          {isRegionCutMode && (
            <div className="pointer-events-none absolute left-1/2 top-4 z-30 -translate-x-1/2 rounded-lg border border-primary/40 bg-[var(--card-bg)]/95 px-3 py-2 text-[11px] font-semibold text-primary shadow-lg">
              Drag over the image to create a separate animation layer
            </div>
          )}
          {regionSelection && (
            <div
              className="pointer-events-none absolute z-30 border-2 border-primary bg-primary/20 shadow-[0_0_0_1px_rgba(255,255,255,0.6)]"
              style={{
                left: regionSelection.x,
                top: regionSelection.y,
                width: regionSelection.width,
                height: regionSelection.height,
              }}
            />
          )}

          {project.elements.length === 0 && (
            <div
              className={`absolute inset-0 z-10 flex items-center justify-center p-6 ${
                isFileDragActive ? 'bg-primary/10' : 'bg-[var(--main-bg)]/35'
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                setIsFileDragActive(true);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setIsFileDragActive(false);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                setIsFileDragActive(false);
                const file = event.dataTransfer.files[0];
                if (file) onOpenSvgFile(file);
              }}
            >
              <div className="max-w-sm rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)]/95 p-7 text-center shadow-2xl backdrop-blur">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Upload className="h-5 w-5" />
                </div>
                <h2 className="text-base font-semibold text-foreground">Start a Motion Studio project</h2>
                <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
                  Import a layered SVG, or upload a PNG/JPEG/WebP and cut regions into independently animated layers.
                </p>
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept=".svg,image/svg+xml,image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    if (file) onOpenSvgFile(file);
                    event.currentTarget.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => uploadInputRef.current?.click()}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-primary/20 transition hover:brightness-110"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload SVG or image
                </button>
                <p className="mt-3 text-[10px] text-[var(--text-muted)]">
                  Image cutouts become separate layers; the remaining image keeps transparent cutout areas.
                </p>
              </div>
            </div>
          )}

          {/* Selection Bounding Box & Handles */}
          {selectedElementId && selectionBox && !isRegionCutMode && (
            <div
              ref={selectionOverlayRef}
              className="absolute pointer-events-none border-2 border-primary shadow-sm"
              style={{
                left: `${selectionBox.x}px`,
                top: `${selectionBox.y}px`,
                width: `${selectionBox.width}px`,
                height: `${selectionBox.height}px`,
                transform: selectedStyles
                  ? `translate(${selectedStyles.x}px, ${selectedStyles.y}px) rotate(${selectedStyles.rotation}deg) scale(${selectedStyles.scaleX / 100}, ${selectedStyles.scaleY / 100})`
                  : undefined,
                transformOrigin: `${selectedStyles?.originX ?? 50}% ${selectedStyles?.originY ?? 50}%`,
              }}
            >
              {/* Rotation Handle with stem */}
              <div
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setDragMode('rotate');
                  setDragStart({ x: e.clientX, y: e.clientY });
                }}
                className="absolute -top-7 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-primary hover:brightness-110 border-2 border-white shadow-md cursor-grab active:cursor-grabbing pointer-events-auto flex items-center justify-center transition-transform hover:scale-125"
                title="Rotate Object (Drag to rotate)"
              >
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[1px] h-3 bg-primary pointer-events-none" />
              </div>

              {/* Transform Origin Crosshair */}
              <div
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setDragMode('origin');
                  setDragStart({ x: e.clientX, y: e.clientY });
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-primary bg-primary/40 pointer-events-auto cursor-move flex items-center justify-center z-10"
                style={{
                  left: `${selectedStyles?.originX ?? 50}%`,
                  top: `${selectedStyles?.originY ?? 50}%`,
                }}
                title="Anchor Point / Transform-Origin (Drag to adjust center)"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-white shadow-sm" />
              </div>

              {/* Move Draggable Overlay in the center */}
              <div
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setDragMode('move');
                  setDragStart({
                    x: e.clientX,
                    y: e.clientY,
                    initialVal: { x: selectedStyles?.x || 0, y: selectedStyles?.y || 0 },
                  });
                }}
                className="absolute inset-0 cursor-move pointer-events-auto opacity-0 hover:opacity-10 bg-primary transition-opacity"
                title="Drag to move position"
              />

              {/* 8 Corner & Edge Resizing Handles */}
              {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((handle) => {
                const isTop = handle.includes('top');
                const isLeft = handle.includes('left');
                return (
                  <div
                    key={handle}
                    className={`absolute w-2.5 h-2.5 bg-white border border-primary shadow-sm pointer-events-auto ${
                      isTop ? '-top-1.5' : '-bottom-1.5'
                    } ${isLeft ? '-left-1.5' : '-right-1.5'}`}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Floating Bottom-Right Zoom & View Controls */}
      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 bg-[var(--card-bg)]/90 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-[var(--card-border)] shadow-xl text-xs select-none text-foreground">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0.15, z - 0.15))}
          className="p-1 rounded-lg text-[var(--text-secondary)] hover:text-foreground hover:bg-[var(--hover-bg)] transition-colors"
          title="Zoom Out (-)"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>

        <span
          onClick={handleFitToScreen}
          className="px-2 font-mono font-bold text-foreground cursor-pointer hover:text-primary transition-colors"
          title="Click to reset zoom"
        >
          {Math.round(zoom * 100)}%
        </span>

        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(5.0, z + 0.15))}
          className="p-1 rounded-lg text-[var(--text-secondary)] hover:text-foreground hover:bg-[var(--hover-bg)] transition-colors"
          title="Zoom In (+)"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>

        <div className="h-3.5 w-[1px] bg-[var(--card-border)] mx-0.5" />

        <button
          type="button"
          onClick={handleFitToScreen}
          className="p-1 rounded-lg text-[var(--text-secondary)] hover:text-foreground hover:bg-[var(--hover-bg)] transition-colors"
          title="Fit Canvas to Viewport"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Floating Bottom-Left Mouse Coordinates */}
      <div className="absolute bottom-4 left-8 z-20 font-mono text-[10px] text-[var(--text-muted)] bg-[var(--card-bg)]/80 backdrop-blur-md px-2.5 py-1 rounded-xl border border-[var(--card-border)] pointer-events-none select-none font-semibold shadow-sm">
        X: {mousePos.x}px &nbsp;|&nbsp; Y: {mousePos.y}px
      </div>
    </div>
  );
};

export default CanvasViewport;
