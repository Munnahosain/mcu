import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  DesignElement,
  PatternSettings,
  ToolMode,
} from '../types';
import { getPresetByKind } from '../utils/shapeLibrary';
import { getToroidalInstances, wrapCoordinate } from '../utils/seamlessMath';

let duplicateSequence = 0;

function createDuplicateId() {
  duplicateSequence += 1;
  return `el-copy-${duplicateSequence}`;
}

interface ArtboardCanvasProps {
  elements: DesignElement[];
  setElements: React.Dispatch<React.SetStateAction<DesignElement[]>>;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  settings: PatternSettings;
  toolMode: ToolMode;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  onPushHistory: () => void;
}

type DragAction =
  | { type: 'move'; startX: number; startY: number; initialElX: number; initialElY: number; isAltDuplicated?: boolean }
  | { type: 'resize'; handle: string; startX: number; startY: number; initialX: number; initialY: number; initialW: number; initialH: number; initialRot: number }
  | { type: 'rotate'; startAngle: number; initialRot: number; centerX: number; centerY: number }
  | { type: 'pan'; startX: number; startY: number; initialPanX: number; initialPanY: number }
  | { type: 'draw'; points: { x: number; y: number }[] }
  | null;

export const ArtboardCanvas: React.FC<ArtboardCanvasProps> = ({
  elements,
  setElements,
  selectedId,
  setSelectedId,
  settings,
  toolMode,
  zoom,
  setZoom,
  onPushHistory,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragAction, setDragAction] = useState<DragAction>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0, canvasX: 0, canvasY: 0 });
  const [drawingPoints, setDrawingPoints] = useState<{ x: number; y: number }[]>([]);

  const S = settings.artboardSize; // 500px

  const [spacePressed, setSpacePressed] = useState(false);

  // Keep the artboard centered when the dashboard shell or side panels resize.
  useEffect(() => {
    const centerArtboard = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setPan({
        x: (rect.width - S * zoom) / 2,
        y: (rect.height - S * zoom) / 2,
      });
    };

    const frame = window.requestAnimationFrame(centerArtboard);
    const observer = containerRef.current ? new ResizeObserver(centerArtboard) : null;
    if (observer && containerRef.current) observer.observe(containerRef.current);
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [S, zoom]);

  // Spacebar tracking
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.code === 'Space') {
        setSpacePressed(e.type === 'keydown');
      }
    };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('keyup', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('keyup', handleKey);
    };
  }, []);

  const selectedElement = elements.find((e) => e.id === selectedId) || null;

  // Convert screen mouse coordinates to Artboard canvas coordinates
  const screenToCanvas = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const rawX = clientX - rect.left - pan.x;
      const rawY = clientY - rect.top - pan.y;
      return {
        x: rawX / zoom,
        y: rawY / zoom,
      };
    },
    [pan, zoom]
  );

  // Wheel zoom centered on pointer
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      const newZoom = Math.min(3.5, Math.max(0.3, +(zoom * zoomFactor).toFixed(2)));
      setZoom(newZoom);
    } else {
      // Pan with trackpad
      setPan((p) => ({
        x: p.x - e.deltaX,
        y: p.y - e.deltaY,
      }));
    }
  };

  // Keyboard navigation & deletion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        onPushHistory();
        setElements((prev) => prev.filter((el) => el.id !== selectedId));
        setSelectedId(null);
      } else if (e.key === 'Escape') {
        setSelectedId(null);
      } else if (selectedId && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        onPushHistory();
        const step = e.shiftKey ? 10 : 1;
        setElements((prev) =>
          prev.map((el) => {
            if (el.id !== selectedId) return el;
            let nx = el.x;
            let ny = el.y;
            if (e.key === 'ArrowLeft') nx -= step;
            if (e.key === 'ArrowRight') nx += step;
            if (e.key === 'ArrowUp') ny -= step;
            if (e.key === 'ArrowDown') ny += step;
            return {
              ...el,
              x: wrapCoordinate(nx, S),
              y: wrapCoordinate(ny, S),
            };
          })
        );
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, S, onPushHistory, setElements, setSelectedId]);

  // Pointer Down on canvas or background
  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if (e.button === 1 || toolMode === 'pan' || (e.button === 0 && spacePressed)) {
      // Pan
      setDragAction({
        type: 'pan',
        startX: e.clientX,
        startY: e.clientY,
        initialPanX: pan.x,
        initialPanY: pan.y,
      });
      return;
    }

    const { x, y } = screenToCanvas(e.clientX, e.clientY);

    if (toolMode === 'draw') {
      onPushHistory();
      setDragAction({
        type: 'draw',
        points: [{ x, y }],
      });
      setDrawingPoints([{ x, y }]);
      return;
    }

    // If clicked empty space, deselect
    if ((e.target as HTMLElement).id === 'artboard-workspace' || (e.target as HTMLElement).id === 'artboard-svg') {
      setSelectedId(null);
    }
  };

  // Pointer Down on an element
  const handleElementPointerDown = (
    e: React.PointerEvent,
    element: DesignElement
  ) => {
    e.stopPropagation();
    if (toolMode === 'pan') return;

    setSelectedId(element.id);
    onPushHistory();

    const isAlt = e.altKey;
    let targetEl = element;

    // Alt + Drag duplicates like Illustrator
    if (isAlt) {
      const newEl: DesignElement = {
        ...element,
        id: createDuplicateId(),
        name: `${element.name} Copy`,
        zIndex: elements.length + 1,
      };
      setElements((prev) => [...prev, newEl]);
      setSelectedId(newEl.id);
      targetEl = newEl;
    }

    setDragAction({
      type: 'move',
      startX: e.clientX,
      startY: e.clientY,
      initialElX: targetEl.x,
      initialElY: targetEl.y,
      isAltDuplicated: isAlt,
    });
  };

  // Pointer Down on Resize Handle
  const handleResizePointerDown = (e: React.PointerEvent, handle: string) => {
    e.stopPropagation();
    if (!selectedElement) return;
    onPushHistory();

    setDragAction({
      type: 'resize',
      handle,
      startX: e.clientX,
      startY: e.clientY,
      initialX: selectedElement.x,
      initialY: selectedElement.y,
      initialW: selectedElement.width,
      initialH: selectedElement.height,
      initialRot: selectedElement.rotation,
    });
  };

  // Pointer Down on Rotate Handle
  const handleRotatePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (!selectedElement) return;
    onPushHistory();

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const screenCenterX = rect.left + pan.x + selectedElement.x * zoom;
    const screenCenterY = rect.top + pan.y + selectedElement.y * zoom;

    const angle = Math.atan2(e.clientY - screenCenterY, e.clientX - screenCenterX);

    setDragAction({
      type: 'rotate',
      startAngle: (angle * 180) / Math.PI,
      initialRot: selectedElement.rotation,
      centerX: screenCenterX,
      centerY: screenCenterY,
    });
  };

  // Pointer Move
  const handlePointerMove = (e: React.PointerEvent) => {
    const { x, y } = screenToCanvas(e.clientX, e.clientY);
    setMousePos({ x: e.clientX, y: e.clientY, canvasX: x, canvasY: y });

    if (!dragAction) return;

    if (dragAction.type === 'pan') {
      const dx = e.clientX - dragAction.startX;
      const dy = e.clientY - dragAction.startY;
      setPan({
        x: dragAction.initialPanX + dx,
        y: dragAction.initialPanY + dy,
      });
      return;
    }

    if (dragAction.type === 'draw') {
      const newPts = [...dragAction.points, { x, y }];
      setDragAction({ ...dragAction, points: newPts });
      setDrawingPoints(newPts);
      return;
    }

    if (dragAction.type === 'move' && selectedElement) {
      const dx = (e.clientX - dragAction.startX) / zoom;
      const dy = (e.clientY - dragAction.startY) / zoom;

      let newX = dragAction.initialElX + dx;
      let newY = dragAction.initialElY + dy;

      if (settings.gridSnap) {
        const gs = settings.gridSize || 20;
        newX = Math.round(newX / gs) * gs;
        newY = Math.round(newY / gs) * gs;
      }

      // Toroidal coordinates wrap smoothly:
      // If the object's center moves past 0 or S, it gracefully wraps to opposite side!
      // This is the core reason user asked for: no math needed, automatic seamless edge stitching!
      const wrappedX = wrapCoordinate(newX, S);
      const wrappedY = wrapCoordinate(newY, S);

      setElements((prev) =>
        prev.map((el) =>
          el.id === selectedElement.id
            ? { ...el, x: wrappedX, y: wrappedY }
            : el
        )
      );
      return;
    }

    if (dragAction.type === 'resize' && selectedElement) {
      const dx = (e.clientX - dragAction.startX) / zoom;
      const dy = (e.clientY - dragAction.startY) / zoom;
      const { handle, initialW, initialH, initialX, initialY } = dragAction;

      let nw = initialW;
      let nh = initialH;
      let nx = initialX;
      let ny = initialY;

      // Check handle directions
      if (handle.includes('e')) nw = Math.max(15, initialW + dx);
      if (handle.includes('s')) nh = Math.max(15, initialH + dy);
      if (handle.includes('w')) {
        const diff = Math.min(dx, initialW - 15);
        nw = initialW - diff;
        nx = initialX + diff / 2;
      }
      if (handle.includes('n')) {
        const diff = Math.min(dy, initialH - 15);
        nh = initialH - diff;
        ny = initialY + diff / 2;
      }

      // If Shift key held, maintain 1:1 aspect ratio
      if (e.shiftKey) {
        const maxDim = Math.max(nw, nh);
        nw = maxDim;
        nh = maxDim;
      }

      setElements((prev) =>
        prev.map((el) =>
          el.id === selectedElement.id
            ? { ...el, width: Math.round(nw), height: Math.round(nh), x: nx, y: ny }
            : el
        )
      );
      return;
    }

    if (dragAction.type === 'rotate' && selectedElement) {
      const { centerX, centerY, startAngle, initialRot } = dragAction;
      const curAngle = (Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180) / Math.PI;
      const deltaAngle = curAngle - startAngle;
      let newRot = Math.round(initialRot + deltaAngle);

      // Snap to 15 degrees if Shift is held
      if (e.shiftKey) {
        newRot = Math.round(newRot / 15) * 15;
      }
      newRot = ((newRot % 360) + 360) % 360;

      setElements((prev) =>
        prev.map((el) =>
          el.id === selectedElement.id ? { ...el, rotation: newRot } : el
        )
      );
      return;
    }
  };

  // Pointer Up
  const handlePointerUp = () => {
    if (dragAction?.type === 'draw' && drawingPoints.length > 2) {
      // Convert points array into smooth SVG path data
      // Compute bounding box
      const xs = drawingPoints.map((p) => p.x);
      const ys = drawingPoints.map((p) => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const w = Math.max(20, maxX - minX);
      const h = Math.max(20, maxY - minY);
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;

      // Re-center path around (0,0) so scaling and rotation work like other elements
      let centeredD = '';
      for (let i = 0; i < drawingPoints.length; i++) {
        const px = drawingPoints[i].x - cx + w / 2;
        const py = drawingPoints[i].y - cy + h / 2;
        centeredD += (i === 0 ? 'M' : 'L') + ` ${px.toFixed(1)} ${py.toFixed(1)}`;
      }

      const newElement: DesignElement = {
        id: `path-${Date.now()}`,
        name: 'Hand-drawn Motif',
        type: 'path',
        x: cx,
        y: cy,
        width: w,
        height: h,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        opacity: 1,
        fill: 'none',
        stroke: '#f59e0b',
        strokeWidth: 4,
        pathData: centeredD,
        zIndex: elements.length + 1,
      };

      setElements((prev) => [...prev, newElement]);
      setSelectedId(newElement.id);
      setDrawingPoints([]);
    }

    setDragAction(null);
  };

  const unitLabel = settings.physicalUnit;

  return (
    <div
      ref={containerRef}
      id="artboard-workspace"
      className="pattern-maker-canvas flex-1 h-full relative overflow-hidden bg-stone-950 select-none cursor-default"
      onWheel={handleWheel}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Top Ruler */}
      {settings.showRulers && (
        <div className="absolute top-0 left-7 right-0 h-6 bg-[#101114] border-b border-[#252a31] z-10 flex items-end overflow-hidden pointer-events-none">
          <div
            className="h-full flex items-end font-mono text-[9px] text-[#77808c] relative"
            style={{
              transform: `translateX(${pan.x}px)`,
              width: `${S * zoom}px`,
            }}
          >
            {/* 0 and End labels */}
            <span className="absolute left-0 bottom-1">0{unitLabel}</span>
            <span className="absolute right-0 bottom-1">
              {settings.physicalSize}{unitLabel}
            </span>
            {/* Middle ticks */}
            {[0.25, 0.5, 0.75].map((frac) => (
              <span
                key={frac}
                className="absolute bottom-1 -translate-x-1/2"
                style={{ left: `${frac * 100}%` }}
              >
                {(settings.physicalSize * frac).toFixed(1)}
              </span>
            ))}
            {/* Mouse tracking line */}
            <div
              className="absolute top-0 bottom-0 w-px bg-[#18c98a] z-20"
              style={{ left: `${mousePos.canvasX * zoom}px` }}
            />
          </div>
        </div>
      )}

      {/* Left Ruler */}
      {settings.showRulers && (
        <div className="absolute top-6 left-0 bottom-0 w-7 bg-[#101114] border-r border-[#252a31] z-10 overflow-hidden pointer-events-none">
          <div
            className="w-full relative font-mono text-[9px] text-[#77808c]"
            style={{
              transform: `translateY(${pan.y}px)`,
              height: `${S * zoom}px`,
            }}
          >
            <span className="absolute top-0 left-1">0</span>
            <span className="absolute bottom-0 left-1">
              {settings.physicalSize}
            </span>
            {[0.25, 0.5, 0.75].map((frac) => (
              <span
                key={frac}
                className="absolute left-1 -translate-y-1/2"
                style={{ top: `${frac * 100}%` }}
              >
                {(settings.physicalSize * frac).toFixed(1)}
              </span>
            ))}
            <div
              className="absolute left-0 right-0 h-px bg-[#18c98a] z-20"
              style={{ top: `${mousePos.canvasY * zoom}px` }}
            />
          </div>
        </div>
      )}

      {/* Origin Corner Box */}
      {settings.showRulers && (
        <div className="absolute top-0 left-0 w-7 h-6 bg-[#101114] border-r border-b border-[#252a31] z-20 flex items-center justify-center text-[9px] font-mono text-[#77808c]">
          1:1
        </div>
      )}

      {/* Real-time Status Badge */}
      <div className="absolute bottom-4 left-10 bg-[#17191e]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#252a31] flex items-center gap-3 text-xs z-10 shadow-lg pointer-events-none text-[#f5f7f8]">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#18c98a] animate-pulse" />
          <span className="text-[#aeb5bf] font-medium">Toroidal Edge Stitching:</span>
          <span className="text-[#18c98a] font-semibold font-mono">AUTOMATIC</span>
        </div>
        <div className="h-3 w-px bg-[#252a31]" />
        <div className="text-[#aeb5bf] font-mono">
          Tile: <span className="text-[#18c98a] font-bold">{settings.physicalSize}{settings.physicalUnit}</span> × <span className="text-[#18c98a] font-bold">{settings.physicalSize}{settings.physicalUnit}</span>
        </div>
        <div className="h-3 w-px bg-[#252a31]" />
        <div className="text-[#77808c] font-mono hidden md:block">
          X: {mousePos.canvasX.toFixed(0)}px | Y: {mousePos.canvasY.toFixed(0)}px
        </div>
      </div>

      {/* Canvas Viewport containing 1:1 Artboard & Workspace */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {/* Workspace Extended Outer Region (Allows seeing shapes outside artboard and how they wrap) */}
        <div
          className="absolute border border-stone-800/80 rounded-xl"
          style={{
            left: -160,
            top: -160,
            width: S + 320,
            height: S + 320,
            backgroundColor: 'rgba(28, 25, 23, 0.4)',
          }}
        >
          <span className="absolute top-2 left-3 text-[10px] font-mono text-stone-500 uppercase tracking-wider">
            Workspace Bleed (Protruding elements auto-wrap to opposite edge)
          </span>
        </div>

        {/* 1:1 MASTER ARTBOARD CONTAINER */}
        <div
          id="master-artboard"
          className={`absolute rounded-sm shadow-2xl transition-colors duration-200 pointer-events-auto ${
            settings.backgroundTransparent
              ? 'bg-transparency-grid-dark'
              : ''
          }`}
          style={{
            left: 0,
            top: 0,
            width: S,
            height: S,
            backgroundColor: settings.backgroundTransparent
              ? undefined
              : settings.backgroundColor,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(245, 158, 11, 0.4)',
          }}
        >
          {/* Grid lines overlay */}
          {settings.showGridLines && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none opacity-20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <pattern
                  id="canvas-grid"
                  width={settings.gridSize || 25}
                  height={settings.gridSize || 25}
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d={`M ${settings.gridSize || 25} 0 L 0 0 0 ${settings.gridSize || 25}`}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="0.5"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#canvas-grid)" />
            </svg>
          )}

          {/* Safe Seam Allowance Cutting Guide Line */}
          {settings.showBleedGuide && settings.seamAllowance > 0 && (
            <div
              className="absolute border border-dashed border-rose-500/60 pointer-events-none z-10"
              style={{
                left: (settings.seamAllowance / settings.physicalSize) * S,
                top: (settings.seamAllowance / settings.physicalSize) * S,
                right: (settings.seamAllowance / settings.physicalSize) * S,
                bottom: (settings.seamAllowance / settings.physicalSize) * S,
              }}
            >
              <span className="absolute top-1 left-1.5 text-[9px] font-mono text-rose-400 bg-stone-900/80 px-1 rounded">
                Seam Margin ({settings.seamAllowance}{settings.physicalUnit})
              </span>
            </div>
          )}

          {/* Master SVG containing all Elements & Automatic Toroidal Edge Wraps */}
          <svg
            id="artboard-svg"
            className="w-full h-full overflow-visible"
            viewBox={`0 0 ${S} ${S}`}
          >
            {/* Render all design elements sorted by z-index */}
            {[...elements]
              .sort((a, b) => a.zIndex - b.zIndex)
              .map((el) => {
                // Get all toroidal instances (the center one + any edge wrap clones)
                const instances = getToroidalInstances(el, S);

                return (
                  <g key={el.id}>
                    {instances.map((inst, idx) => {
                      // If ghost wraps are disabled and this is not the primary instance, skip
                      if (!settings.showGhostWraps && !inst.isPrimary) {
                        return null;
                      }

                      return (
                        <g
                          key={`${el.id}-inst-${idx}`}
                          transform={`translate(${inst.x}, ${inst.y}) rotate(${el.rotation}) scale(${el.scaleX}, ${el.scaleY})`}
                          opacity={inst.isPrimary ? el.opacity : el.opacity * 0.75}
                          className="cursor-move"
                          onPointerDown={(e) =>
                            handleElementPointerDown(e, el)
                          }
                        >
                          {/* Ghost Wrap Visual Border indicator if it's a wrapped edge twin */}
                          {!inst.isPrimary && (
                            <circle
                              r={Math.max(el.width, el.height) / 2 + 6}
                              fill="none"
                              stroke="#10b981"
                              strokeWidth="1.5"
                              strokeDasharray="4,4"
                              className="pointer-events-none opacity-40"
                            />
                          )}

                          {/* Render Shape */}
                          {el.type === 'shape' && el.shapeKind && (
                            <g
                              transform={`translate(${-el.width / 2}, ${-el.height / 2}) scale(${el.width / 100}, ${el.height / 100})`}
                            >
                              <path
                                d={getPresetByKind(el.shapeKind).path}
                                fill={el.fill}
                                stroke={el.stroke || 'none'}
                                strokeWidth={el.strokeWidth || 0}
                              />
                            </g>
                          )}

                          {/* Render Path */}
                          {el.type === 'path' && el.pathData && (
                            <g transform={`translate(${-el.width / 2}, ${-el.height / 2})`}>
                              <path
                                d={el.pathData}
                                fill={el.fill}
                                stroke={el.stroke || 'none'}
                                strokeWidth={el.strokeWidth || 0}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </g>
                          )}

                          {/* Render Text */}
                          {el.type === 'text' && (
                            <text
                              x="0"
                              y="0"
                              fontFamily={el.fontFamily || 'Plus Jakarta Sans'}
                              fontSize={el.fontSize || 32}
                              fill={el.fill}
                              textAnchor="middle"
                              dominantBaseline="central"
                              fontWeight="bold"
                            >
                              {el.textContent || 'Fabric Pattern'}
                            </text>
                          )}

                          {/* Render Uploaded Image */}
                          {el.type === 'image' && el.imageUrl && (
                            <image
                              href={el.imageUrl}
                              x={-el.width / 2}
                              y={-el.height / 2}
                              width={el.width}
                              height={el.height}
                              preserveAspectRatio="xMidYMid meet"
                            />
                          )}
                        </g>
                      );
                    })}
                  </g>
                );
              })}

            {/* Currently drawing active stroke */}
            {dragAction?.type === 'draw' && drawingPoints.length > 1 && (
              <polyline
                points={drawingPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>

          {/* Illustrator-Style Bounding Box & Transform Controls for Selected Element */}
          {selectedElement && (
            <div
              className="absolute pointer-events-none"
              style={{
                left: selectedElement.x,
                top: selectedElement.y,
                width: selectedElement.width,
                height: selectedElement.height,
                transform: `translate(-50%, -50%) rotate(${selectedElement.rotation}deg)`,
                transformOrigin: '50% 50%',
              }}
            >
              {/* Bounding box outline */}
              <div className="w-full h-full border-2 border-[#18c98a] relative">
                {/* 8 Resize Handles */}
                {[
                  { handle: 'nw', cls: '-top-1.5 -left-1.5 cursor-nwse-resize' },
                  { handle: 'n', cls: '-top-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize' },
                  { handle: 'ne', cls: '-top-1.5 -right-1.5 cursor-nesw-resize' },
                  { handle: 'e', cls: 'top-1/2 -right-1.5 -translate-y-1/2 cursor-ew-resize' },
                  { handle: 'se', cls: '-bottom-1.5 -right-1.5 cursor-nwse-resize' },
                  { handle: 's', cls: '-bottom-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize' },
                  { handle: 'sw', cls: '-bottom-1.5 -left-1.5 cursor-nesw-resize' },
                  { handle: 'w', cls: 'top-1/2 -left-1.5 -translate-y-1/2 cursor-ew-resize' },
                ].map(({ handle, cls }) => (
                  <div
                    key={handle}
                    onPointerDown={(e) => handleResizePointerDown(e, handle)}
                    className={`absolute w-3 h-3 bg-[#101114] border-2 border-[#18c98a] rounded-sm pointer-events-auto shadow-sm ${cls}`}
                  />
                ))}

                {/* Top Rotation Stem and Handle */}
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto">
                  <div
                    onPointerDown={handleRotatePointerDown}
                    title="Rotate element (Hold Shift for 15° steps)"
                    className="w-3.5 h-3.5 rounded-full bg-[#18c98a] border-2 border-[#101114] cursor-grab active:cursor-grabbing shadow-md hover:scale-125 transition-transform"
                  />
                  <div className="w-0.5 h-3.5 bg-[#18c98a]" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 1:1 Aspect Ratio Dimensions Indicator */}
        <div
          className="absolute font-mono text-[10px] text-[#18c98a] flex items-center justify-between pointer-events-none"
          style={{
            left: 0,
            top: S + 10,
            width: S,
          }}
        >
          <span>0 {settings.physicalUnit}</span>
          <span className="bg-[#17191e]/90 px-2 py-0.5 rounded border border-[#18c98a]/30 text-[#f5f7f8]">
            1:1 Artboard ({settings.physicalSize} {settings.physicalUnit} × {settings.physicalSize} {settings.physicalUnit})
          </span>
          <span>{settings.physicalSize} {settings.physicalUnit}</span>
        </div>
      </div>
    </div>
  );
};
