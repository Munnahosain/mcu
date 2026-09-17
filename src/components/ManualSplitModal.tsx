import React, { useState, useRef } from 'react';
import {
  X,
  Scissors,
  Trash2,
  Check,
} from 'lucide-react';
import { EPSDocument, ExtractedIcon, ManualRegion, BoundingBox } from '../types';
import { buildIconSvg, buildIconEPS } from '../services/epsParser';

interface ManualSplitModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: EPSDocument;
  onApplyManualSplit: (newIcons: ExtractedIcon[]) => void;
}

export const ManualSplitModal: React.FC<ManualSplitModalProps> = ({
  isOpen,
  onClose,
  document,
  onApplyManualSplit,
}) => {
  // Initialize regions from existing icons or empty
  const [regions, setRegions] = useState<ManualRegion[]>(() => {
    return document.icons.map((icon, idx) => ({
      id: `region-${idx + 1}`,
      name: icon.name,
      x: icon.bbox.x,
      y: icon.bbox.y,
      width: icon.bbox.width,
      height: icon.bbox.height,
    }));
  });

  const [activeRegionId, setActiveRegionId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [currentDragRect, setCurrentDragRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // SVG dimensions
  const docW = Math.max(100, document.width);
  const docH = Math.max(100, document.height);

  if (!isOpen) return null;

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = docW / rect.width;
    const scaleY = docH / rect.height;

    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    setIsDrawing(true);
    setDragStart({ x: clickX, y: clickY });
    setCurrentDragRect({ x: clickX, y: clickY, w: 0, h: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !dragStart || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = docW / rect.width;
    const scaleY = docH / rect.height;

    const currentX = (e.clientX - rect.left) * scaleX;
    const currentY = (e.clientY - rect.top) * scaleY;

    const rx = Math.min(dragStart.x, currentX);
    const ry = Math.min(dragStart.y, currentY);
    const rw = Math.abs(currentX - dragStart.x);
    const rh = Math.abs(currentY - dragStart.y);

    setCurrentDragRect({ x: rx, y: ry, w: rw, h: rh });
  };

  const handleMouseUp = () => {
    if (isDrawing && currentDragRect && currentDragRect.w > 15 && currentDragRect.h > 15) {
      const newId = `region-${Date.now()}`;
      const newName = `icon-${(regions.length + 1).toString().padStart(2, '0')}`;
      const newReg: ManualRegion = {
        id: newId,
        name: newName,
        x: Math.round(currentDragRect.x),
        y: Math.round(currentDragRect.y),
        width: Math.round(currentDragRect.w),
        height: Math.round(currentDragRect.h),
      };
      setRegions((prev) => [...prev, newReg]);
      setActiveRegionId(newId);
    }
    setIsDrawing(false);
    setDragStart(null);
    setCurrentDragRect(null);
  };

  const removeRegion = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRegions((prev) => prev.filter((r) => r.id !== id));
    if (activeRegionId === id) setActiveRegionId(null);
  };

  const handleAutoGrid = (cols: number, rows: number) => {
    const cellW = docW / cols;
    const cellH = docH / rows;
    const padX = cellW * 0.08;
    const padY = cellH * 0.08;

    const generated: ManualRegion[] = [];
    let count = 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        generated.push({
          id: `grid-region-${count}`,
          name: `icon-${count.toString().padStart(2, '0')}`,
          x: Math.round(c * cellW + padX),
          y: Math.round(r * cellH + padY),
          width: Math.round(cellW - padX * 2),
          height: Math.round(cellH - padY * 2),
        });
        count++;
      }
    }
    setRegions(generated);
  };

  const handleApply = () => {
    if (regions.length === 0) {
      alert('Please define at least one slice region before confirming extraction.');
      return;
    }

    // Convert regions to ExtractedIcon[]
    const extracted: ExtractedIcon[] = regions.map((reg, idx) => {
      const bbox: BoundingBox = {
        x: reg.x,
        y: reg.y,
        width: Math.max(16, reg.width),
        height: Math.max(16, reg.height),
      };

      // If document has parsed vector paths, find paths intersecting this region
      const matchingPaths = (document.parsedVectorPaths || []).filter((p) => {
        const pMidX = (p.bbox.minX + p.bbox.maxX) / 2;
        const pMidY = (p.bbox.minY + p.bbox.maxY) / 2;
        return (
          pMidX >= bbox.x &&
          pMidX <= bbox.x + bbox.width &&
          pMidY >= bbox.y &&
          pMidY <= bbox.y + bbox.height
        );
      });

      let svgContent = '';
      let epsContent = '';

      if (matchingPaths.length > 0) {
        svgContent = buildIconSvg(matchingPaths, bbox, 4);
        epsContent = buildIconEPS(matchingPaths, bbox, docH);
      } else {
        svgContent = buildIconSvg([], bbox, 4);
        epsContent = buildIconEPS([], bbox, docH);
      }

      return {
        id: `manual-icon-${Date.now()}-${idx}`,
        name: reg.name,
        index: idx + 1,
        bbox,
        originalBbox: [bbox.x, docH - (bbox.y + bbox.height), bbox.x + bbox.width, docH - bbox.y],
        svgContent,
        epsContent,
        width: Math.round(bbox.width),
        height: Math.round(bbox.height),
        pathCount: matchingPaths.length > 0 ? matchingPaths.length : 1,
        selected: true,
        aspectRatio: bbox.width / Math.max(1, bbox.height),
      };
    });

    onApplyManualSplit(extracted);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-xs">
      <div className="relative w-full max-w-6xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Manual Split Studio
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Click & drag to draw custom bounding boxes over the EPS canvas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Grid Presets */}
            <div className="hidden sm:flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
              <span className="px-2 text-slate-500 font-medium">Split Grid:</span>
              <button
                type="button"
                onClick={() => handleAutoGrid(3, 3)}
                className="px-2 py-1 rounded-lg hover:bg-white dark:hover:bg-slate-700 font-mono text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                3×3
              </button>
              <button
                type="button"
                onClick={() => handleAutoGrid(4, 4)}
                className="px-2 py-1 rounded-lg hover:bg-white dark:hover:bg-slate-700 font-mono text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                4×4
              </button>
              <button
                type="button"
                onClick={() => handleAutoGrid(6, 4)}
                className="px-2 py-1 rounded-lg hover:bg-white dark:hover:bg-slate-700 font-mono text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                6×4
              </button>
              <button
                type="button"
                onClick={() => handleAutoGrid(6, 6)}
                className="px-2 py-1 rounded-lg hover:bg-white dark:hover:bg-slate-700 font-mono text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                6×6
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Studio Workspace */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Main Interactive Stage */}
          <div className="flex-1 p-4 sm:p-6 bg-slate-100/70 dark:bg-slate-950/70 overflow-auto flex items-center justify-center">
            <div
              ref={containerRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              className="relative max-w-full max-h-full bg-white dark:bg-slate-900 rounded-2xl shadow-md border border-slate-300 dark:border-slate-700 overflow-hidden cursor-crosshair select-none"
              style={{
                width: `${docW}px`,
                height: `${docH}px`,
                maxWidth: '100%',
                maxHeight: '100%',
                aspectRatio: `${docW}/${docH}`,
              }}
            >
              {/* Full SVG Artwork Behind */}
              <div
                className="absolute inset-0 w-full h-full text-slate-800 dark:text-slate-200 pointer-events-none p-2"
                dangerouslySetInnerHTML={{ __html: document.fullSvg }}
              />

              {/* Existing Bounding Boxes */}
              {regions.map((reg) => {
                const isActive = activeRegionId === reg.id;
                const left = (reg.x / docW) * 100;
                const top = (reg.y / docH) * 100;
                const width = (reg.width / docW) * 100;
                const height = (reg.height / docH) * 100;

                return (
                  <div
                    key={reg.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveRegionId(reg.id);
                    }}
                    style={{
                      left: `${left}%`,
                      top: `${top}%`,
                      width: `${width}%`,
                      height: `${height}%`,
                    }}
                    className={`absolute border-2 rounded-lg transition-all flex items-start justify-between p-1 group cursor-pointer ${
                      isActive
                        ? 'border-indigo-600 bg-indigo-500/20 shadow-md ring-2 ring-indigo-500/30'
                        : 'border-amber-500/80 bg-amber-500/10 hover:border-amber-500'
                    }`}
                  >
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-900 text-white truncate max-w-[90px]">
                      {reg.name}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => removeRegion(reg.id, e)}
                      className="p-0.5 rounded bg-red-600 text-white opacity-0 group-hover:opacity-100 hover:bg-red-700 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}

              {/* Active Drawing Preview Box */}
              {isDrawing && currentDragRect && (
                <div
                  style={{
                    left: `${(currentDragRect.x / docW) * 100}%`,
                    top: `${(currentDragRect.y / docH) * 100}%`,
                    width: `${(currentDragRect.w / docW) * 100}%`,
                    height: `${(currentDragRect.h / docH) * 100}%`,
                  }}
                  className="absolute border-2 border-dashed border-indigo-600 bg-indigo-500/20 rounded-lg pointer-events-none"
                />
              )}
            </div>
          </div>

          {/* Side Drawer: Region List & Actions */}
          <div className="w-full lg:w-80 bg-white dark:bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {regions.length} Slices Defined
                </span>
                <button
                  type="button"
                  onClick={() => setRegions([])}
                  className="text-xs text-red-500 hover:text-red-700 cursor-pointer"
                >
                  Clear All
                </button>
              </div>

              {/* Scrollable list of regions */}
              <div className="max-h-[50vh] overflow-y-auto space-y-1.5 pr-1 text-xs">
                {regions.map((reg, idx) => (
                  <div
                    key={reg.id}
                    onClick={() => setActiveRegionId(reg.id)}
                    className={`p-2.5 rounded-xl border flex items-center justify-between transition-colors cursor-pointer ${
                      activeRegionId === reg.id
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-400">#{idx + 1}</span>
                      <input
                        type="text"
                        value={reg.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRegions((prev) =>
                            prev.map((r) => (r.id === reg.id ? { ...r, name: val } : r))
                          );
                        }}
                        className="font-bold text-slate-900 dark:text-white bg-transparent border-0 outline-none w-28"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-slate-400">
                        {reg.width}×{reg.height}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => removeRegion(reg.id, e)}
                        className="text-slate-400 hover:text-red-500 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {regions.length === 0 && (
                  <div className="text-center py-10 text-slate-400 text-xs">
                    No regions drawn yet. Click and drag anywhere on the canvas to draw an icon slice.
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleApply}
                className="w-full py-2.5 rounded-xl font-bold text-xs text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Confirm Extraction ({regions.length} Icons)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
