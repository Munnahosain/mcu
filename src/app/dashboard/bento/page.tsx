"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { CSSProperties } from "react";
import { 
  Download,
  ChevronDown,
  RotateCcw
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as htmlToImage from 'html-to-image';

const STORAGE_KEY = "bento_layout_v6_pro";

interface WidgetInstance {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const APPLE_PRESET: WidgetInstance[] = [
  { id: 'left-1', type: 'empty-light', x: 0, y: 0, w: 1, h: 2 },
  { id: 'left-2', type: 'empty-med', x: 0, y: 2, w: 1, h: 1 },
  { id: 'center-1', type: 'empty-dark', x: 1, y: 0, w: 2, h: 2 },
  { id: 'bottom-1', type: 'empty-light', x: 1, y: 2, w: 1, h: 1 },
  { id: 'bottom-2', type: 'empty-med', x: 2, y: 2, w: 1, h: 1 },
  { id: 'right-1', type: 'empty-dark', x: 3, y: 0, w: 1, h: 3 },
];

const GRID_STYLES = [
  "Bento", "Uniform", "Abstract", "Mondrian", "Fibonacci",
  "Recursive", "Masonry", "Mosaic", "Partition", "Rectangles"
];

const COLORS = {
  light: 'var(--neutral-800)',
  med: 'var(--neutral-700)',
  dark: 'var(--neutral-600)',
  accent: 'var(--primary)'
};

const getSliderProgress = (value: number, min: number, max: number) =>
  `${((value - min) / (max - min)) * 100}%`;

function adjustLayoutForGridSize(currentWidgets: WidgetInstance[], newCols: number, newRows: number): WidgetInstance[] {
  const adjustedWidgets = currentWidgets
    .filter(w => w.x < newCols && w.y < newRows)
    .map(w => ({
      ...w,
      w: Math.min(w.w, newCols - w.x),
      h: Math.min(w.h, newRows - w.y)
    }));

  const occupied = Array.from({ length: newRows }, () => Array(newCols).fill(false));
  adjustedWidgets.forEach(w => {
    for (let y = w.y; y < w.y + w.h; y++) {
      for (let x = w.x; x < w.x + w.w; x++) {
        if (y < newRows && x < newCols) occupied[y][x] = true;
      }
    }
  });

  const types = ['empty-light', 'empty-med', 'empty-dark'];
  let idCounter = Date.now();
  const newWidgets: WidgetInstance[] = [];

  for (let y = 0; y < newRows; y++) {
    for (let x = 0; x < newCols; x++) {
      if (!occupied[y][x]) {
        newWidgets.push({
          id: `w-auto-${idCounter++}-${x}-${y}`,
          type: types[Math.floor(Math.random() * types.length)],
          x, y, w: 1, h: 1
        });
      }
    }
  }

  return [...adjustedWidgets, ...newWidgets];
}

interface BentoSettings {
  canvasWidth: number;
  canvasHeight: number;
  cols: number;
  rows: number;
  gap: number;
  margins: number;
  radius: number;
  complexity: number;
  hBias: number;
  maxColSpan: number;
  maxRowSpan: number;
  gridStyle: string;
}

type BentoExportFormat = 'png' | 'jpg' | 'svg';

export default function BentoBuilderPage() {
  const [widgets, setWidgets] = useState<WidgetInstance[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  
  // Merge state for Drag-to-Fill
  const [mergeSourceId, setMergeSourceId] = useState<string | null>(null);
  const [mergeTargetCell, setMergeTargetCell] = useState<{x: number, y: number} | null>(null);

  const [settings, setSettings] = useState<BentoSettings>({
    canvasWidth: 400,
    canvasHeight: 300,
    cols: 4,
    rows: 3,
    gap: 8,
    margins: 20,
    radius: 8,
    complexity: 46,
    hBias: 46,
    maxColSpan: 4,
    maxRowSpan: 4,
    gridStyle: "Bento"
  });

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    "Grid style": false,
    "Dimensions": false,
    "Grid layout": false,
    "Spacing & corners": false,
    "Advanced": false
  });

  const [isEditing, setIsEditing] = useState(true);
  const [zoom, setZoom] = useState(1);
  const gridRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setWidgets(data.widgets || APPLE_PRESET);
        if (data.settings) setSettings(prev => ({ ...prev, ...data.settings }));
      } catch { setWidgets([...APPLE_PRESET]); }
    } else { setWidgets([...APPLE_PRESET]); }
  }, []);

  const updateSetting = <K extends keyof BentoSettings>(key: K, value: BentoSettings[K]) => {
    if (key === 'cols' || key === 'rows') {
      const newCols = key === 'cols' ? (value as number) : settings.cols;
      const newRows = key === 'rows' ? (value as number) : settings.rows;
      setWidgets(prev => adjustLayoutForGridSize(prev, newCols, newRows));
    } else if (['complexity', 'hBias', 'maxColSpan', 'maxRowSpan', 'gridStyle'].includes(key)) {
      const activeSettings = { ...settings, [key]: value };
      generateRandomGrid(activeSettings);
    }
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const toggleSection = (name: string) => {
    setCollapsedSections(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const generateRandomGrid = (overrideSettings?: typeof settings) => {
    const activeSettings = overrideSettings || settings;
    const { cols, rows, maxColSpan, maxRowSpan, complexity, hBias, gridStyle } = activeSettings;
    const newWidgets: WidgetInstance[] = [];
    const grid: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
    
    const occupies = (x: number, y: number, w: number, h: number) => {
      if (x + w > cols || y + h > rows) return true;
      for (let i = y; i < y + h; i++) for (let j = x; j < x + w; j++) if (grid[i][j]) return true;
      return false;
    };
    
    const mark = (x: number, y: number, w: number, h: number) => {
      for (let i = y; i < y + h; i++) for (let j = x; j < x + w; j++) grid[i][j] = true;
    };
    
    const types = ['empty-light', 'empty-med', 'empty-dark'];
    let idCounter = 0;
    
    const getRandomType = () => types[Math.floor(Math.random() * types.length)];

    // ALGORITHM DISPATCHER
    const generateByStyle = () => {
      switch (gridStyle) {
        case "Uniform":
           for (let y = 0; y < rows; y++) {
             for (let x = 0; x < cols; x++) {
               newWidgets.push({ id: `unif-${idCounter++}`, type: getRandomType(), x, y, w: 1, h: 1 });
             }
           }
           break;

        case "Masonry":
          for (let x = 0; x < cols; x++) {
            let y = 0;
            while (y < rows) {
              const h = Math.min(rows - y, Math.floor(Math.random() * maxRowSpan) + 1);
              newWidgets.push({ id: `mas-${idCounter++}`, type: getRandomType(), x, y, w: 1, h });
              y += h;
            }
          }
          break;

        case "Mosaic":
          for (let y = 0; y < rows; y++) {
            let x = 0;
            while (x < cols) {
              const w = Math.min(cols - x, Math.floor(Math.random() * maxColSpan) + 1);
              newWidgets.push({ id: `mos-${idCounter++}`, type: getRandomType(), x, y, w, h: 1 });
              x += w;
            }
          }
          break;

        case "Fibonacci":
          // Simple spiral filling for grid
          let fx = 0, fy = 0, fw = cols, fh = rows;
          while (fw > 0 && fh > 0) {
              // Top row
              for (let i = 0; i < fw; i++) if (!grid[fy][fx+i]) { newWidgets.push({ id: `f-${idCounter++}`, type: getRandomType(), x: fx+i, y: fy, w: 1, h: 1 }); grid[fy][fx+i] = true; }
              fy++; fh--; if (fh <= 0) break;
              // Right col
              for (let i = 0; i < fh; i++) if (!grid[fy+i][fx+fw-1]) { newWidgets.push({ id: `f-${idCounter++}`, type: getRandomType(), x: fx+fw-1, y: fy+i, w: 1, h: 1 }); grid[fy+i][fx+fw-1] = true; }
              fw--; if (fw <= 0) break;
              // Bottom row
              for (let i = fw-1; i >= 0; i--) if (!grid[fy+fh-1][fx+i]) { newWidgets.push({ id: `f-${idCounter++}`, type: getRandomType(), x: fx+i, y: fy+fh-1, w: 1, h: 1 }); grid[fy+fh-1][fx+i] = true; }
              fh--; if (fh <= 0) break;
              // Left col
              for (let i = fh-1; i >= 0; i--) if (!grid[fy+i][fx]) { newWidgets.push({ id: `f-${idCounter++}`, type: getRandomType(), x: fx, y: fy+i, w: 1, h: 1 }); grid[fy+i][fx] = true; }
              fx++; fw--;
          }
          break;

        case "Recursive":
          const split = (sx: number, sy: number, sw: number, sh: number, depth: number) => {
            if (depth > 3 || (sw <= 1 && sh <= 1) || (depth > 1 && Math.random() > 0.7)) {
              if (sw > 0 && sh > 0) newWidgets.push({ id: `rec-${idCounter++}`, type: getRandomType(), x: sx, y: sy, w: sw, h: sh });
              return;
            }
            if (sw > sh) {
              const mid = Math.floor(sw / 2) || 1;
              split(sx, sy, mid, sh, depth + 1);
              split(sx + mid, sy, sw - mid, sh, depth + 1);
            } else {
              const mid = Math.floor(sh / 2) || 1;
              split(sx, sy, sw, mid, depth + 1);
              split(sx, sy + mid, sw, sh - mid, depth + 1);
            }
          };
          split(0, 0, cols, rows, 0);
          break;

        case "Partition":
          const part = (sx: number, sy: number, sw: number, sh: number, depth: number) => {
            if (depth > 4 || (sw <= 1 && sh <= 1) || (depth > 1 && Math.random() > 0.6)) {
              if (sw > 0 && sh > 0) newWidgets.push({ id: `p-${idCounter++}`, type: getRandomType(), x: sx, y: sy, w: sw, h: sh });
              return;
            }
            if (Math.random() > 0.5 && sw > 1) {
              const mid = Math.floor(Math.random() * (sw - 1)) + 1;
              part(sx, sy, mid, sh, depth + 1);
              part(sx + mid, sy, sw - mid, sh, depth + 1);
            } else if (sh > 1) {
              const mid = Math.floor(Math.random() * (sh - 1)) + 1;
              part(sx, sy, sw, mid, depth + 1);
              part(sx, sy + mid, sw, sh - mid, depth + 1);
            } else {
              newWidgets.push({ id: `p-${idCounter++}`, type: getRandomType(), x: sx, y: sy, w: sw, h: sh });
            }
          };
          part(0, 0, cols, rows, 0);
          break;

        case "Rectangles":
           for (let y = 0; y < rows; y++) {
             for (let x = 0; x < cols; x++) {
               if (!grid[y][x]) {
                 let w = 1, h = 1;
                 if (Math.random() > 0.5 && x + 1 < cols && !grid[y][x+1]) w = 2;
                 else if (y + 1 < rows && !grid[y+1][x]) h = 2;
                 newWidgets.push({ id: `rect-${idCounter++}`, type: getRandomType(), x, y, w, h });
                 mark(x, y, w, h);
               }
             }
           }
           break;

        default: // Default Bento/Abstract Logic with variable complexities
          for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
              if (!grid[y][x]) {
                let w = 1, h = 1;
                const roll = Math.random();
                
                // Adjust probabilities based on style
                let largeProb = 1 - (complexity / 110);
                if (gridStyle === "Mondrian") largeProb = 0.9;
                if (gridStyle === "Abstract") largeProb = 0.1;

                if (roll < largeProb) {
                  let maxW = 1; while (x + maxW <= cols && !occupies(x, y, maxW, 1) && maxW <= maxColSpan) maxW++; maxW--;
                  let maxH = 1; while (y + maxH <= rows && !occupies(x, y, 1, maxH) && maxH <= maxRowSpan) maxH++; maxH--;
                  
                  const horizBias = gridStyle === "Partition" ? (Math.random() < 0.5 ? 100 : 0) : hBias;
                  
                  if (Math.random() < (horizBias/100) && maxW > 1) {
                    w = Math.min(maxW, Math.floor(Math.random() * maxW) + 1);
                    h = Math.min(maxH, gridStyle === "Mondrian" ? Math.floor(Math.random() * maxH) + 1 : 1);
                  } else if (maxH > 1) {
                    h = Math.min(maxH, Math.floor(Math.random() * maxH) + 1);
                    w = Math.min(maxW, gridStyle === "Mondrian" ? Math.floor(Math.random() * maxW) + 1 : 1);
                  }
                }
                
                while (w > 1 || h > 1) {
                   if (!occupies(x, y, w, h)) break;
                   if (w > h) w--; else h--;
                }
                
                newWidgets.push({ id: `gen-${idCounter++}-${Date.now()}`, type: getRandomType(), x, y, w, h });
                mark(x, y, w, h);
              }
            }
          }
      }
    };

    generateByStyle();
    setWidgets(newWidgets);
  };

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;

    const handleWorkspaceWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(prev => Math.min(Math.max(prev + delta, 0.2), 3));
    };

    workspace.addEventListener('wheel', handleWorkspaceWheel, { passive: false });
    return () => workspace.removeEventListener('wheel', handleWorkspaceWheel);
  }, []);

  const exportLayout = async (format: 'png' | 'jpg' | 'svg') => {
    if (!gridRef.current) return;
    setIsExporting(true); setShowExportMenu(false);
    try {
      let dataUrl = '';
      const isDark = document.documentElement.classList.contains('dark');
      const currentBg = isDark ? '#090D16' : '#00E5FF';
      if (format === 'png') {
        const options = { backgroundColor: currentBg, style: { transform: 'scale(1)', borderRadius: '0' } };
        dataUrl = await htmlToImage.toPng(gridRef.current, options);
      } else if (format === 'jpg') {
        const options = { backgroundColor: currentBg, style: { transform: 'scale(1)', borderRadius: '0' } };
        dataUrl = await htmlToImage.toJpeg(gridRef.current, { ...options, quality: 0.95 });
      } else if (format === 'svg') {
        // Generate proper Illustrator-compatible SVG
        dataUrl = generateCleanSvg();
      }
      const link = document.createElement('a'); link.download = `bento-layout-${Date.now()}.${format}`; link.href = dataUrl; link.click();
    } catch (err) { alert('Export failed.'); } finally { setIsExporting(false); }
  };

  // Generate clean SVG that Adobe Illustrator can open properly
  const generateCleanSvg = () => {
    const { canvasWidth, canvasHeight, margins, gap, radius, cols, rows } = settings;
    const colWidth = (canvasWidth - 2 * margins - (cols - 1) * gap) / cols;
    const rowHeightVal = (canvasHeight - 2 * margins - (rows - 1) * gap) / rows;

    const isDark = document.documentElement.classList.contains('dark');
    const primaryColor = isDark ? '#00E5FF' : '#090D16';
    const bgColor = isDark ? '#090D16' : '#00E5FF';

    const colorMap: Record<string, string> = {
      'empty-light': isDark ? 'rgba(0, 229, 255, 0.1)' : 'rgba(9, 13, 22, 0.1)',
      'empty-med': isDark ? 'rgba(0, 229, 255, 0.2)' : 'rgba(9, 13, 22, 0.2)',
      'empty-dark': isDark ? 'rgba(0, 229, 255, 0.4)' : 'rgba(9, 13, 22, 0.4)'
    };

    // Build SVG rectangles for each widget
    const rectangles = widgets.map(w => {
      const x = margins + w.x * (colWidth + gap);
      const y = margins + w.y * (rowHeightVal + gap);
      const width = w.w * colWidth + (w.w - 1) * gap;
      const height = w.h * rowHeightVal + (w.h - 1) * gap;
      const fill = colorMap[w.type] || primaryColor;

      return `    <rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${width.toFixed(2)}" height="${height.toFixed(2)}" rx="${radius}" ry="${radius}" fill="${fill}" />`;
    }).join('\n');

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}">
  <title>Bento Layout</title>
  <rect x="0" y="0" width="${canvasWidth}" height="${canvasHeight}" fill="${bgColor}" />
${rectangles}
</svg>`;

    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  };

  const rowHeight = useMemo(() => {
    const { canvasHeight, rows, gap, margins } = settings;
    return Math.max(1, (canvasHeight - (margins * 2) - (gap * (rows - 1))) / rows);
  }, [settings.canvasHeight, settings.rows, settings.gap, settings.margins]);

  const getGridCoords = useCallback((clientX: number, clientY: number) => {
    if (!gridRef.current) return null;
    const rect = gridRef.current.getBoundingClientRect();
    const scaleX = settings.canvasWidth / rect.width;
    const scaleY = settings.canvasHeight / rect.height;
    const x = (clientX - rect.left) * scaleX - settings.margins;
    const y = (clientY - rect.top) * scaleY - settings.margins;
    
    const colWidth = (settings.canvasWidth - 2 * settings.margins - (settings.cols - 1) * settings.gap) / settings.cols;
    
    const gridX = Math.floor(x / (colWidth + settings.gap));
    const gridY = Math.floor(y / (rowHeight + settings.gap));
    
    return {
      x: Math.max(0, Math.min(gridX, settings.cols - 1)),
      y: Math.max(0, Math.min(gridY, settings.rows - 1))
    };
  }, [settings.canvasWidth, settings.margins, settings.cols, settings.gap, rowHeight]);

  const mergeWidgetsArea = useCallback((sourceId: string, currentCell: {x: number, y: number}) => {
    setWidgets(prev => {
      const source = prev.find(w => w.id === sourceId);
      if (!source) return prev;

      const newX = Math.min(source.x, currentCell.x);
      const newY = Math.min(source.y, currentCell.y);
      const newW = Math.max(source.x + source.w, currentCell.x + 1) - newX;
      const newH = Math.max(source.y + source.h, currentCell.y + 1) - newY;

      const merged: WidgetInstance = { 
        id: source.id, 
        type: source.type, 
        x: newX, 
        y: newY, 
        w: newW, 
        h: newH 
      };

      const overlaps = (w: WidgetInstance) => {
        if (w.id === source.id) return false;
        return !(w.x >= newX + newW || w.x + w.w <= newX || w.y >= newY + newH || w.y + w.h <= newY);
      };

      const filtered = prev.filter(w => w.id !== source.id && !overlaps(w));
      return [...filtered, merged];
    });
  }, []);

  const mergeSourceIdRef = useRef<string | null>(null);
  const mergeTargetCellRef = useRef<{x: number, y: number} | null>(null);

  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      if (mergeSourceIdRef.current) {
        const cell = getGridCoords(e.clientX, e.clientY);
        if (cell) {
          mergeTargetCellRef.current = cell;
          setMergeTargetCell(cell);
        }
      }
    };

    const handleGlobalPointerUp = () => {
      if (mergeSourceIdRef.current && mergeTargetCellRef.current) {
        mergeWidgetsArea(mergeSourceIdRef.current, mergeTargetCellRef.current);
      }
      mergeSourceIdRef.current = null;
      mergeTargetCellRef.current = null;
      setMergeSourceId(null);
      setMergeTargetCell(null);
    };

    window.addEventListener('pointermove', handleGlobalPointerMove);
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
    };
  }, [getGridCoords, mergeWidgetsArea]);

  const previewRect = useMemo(() => {
    if (!mergeSourceId || !mergeTargetCell) return null;
    const source = widgets.find(w => w.id === mergeSourceId);
    if (!source) return null;

    const newX = Math.min(source.x, mergeTargetCell.x);
    const newY = Math.min(source.y, mergeTargetCell.y);
    const newW = Math.max(source.x + source.w, mergeTargetCell.x + 1) - newX;
    const newH = Math.max(source.y + source.h, mergeTargetCell.y + 1) - newY;

    const colWidth = (settings.canvasWidth - 2 * settings.margins - (settings.cols - 1) * settings.gap) / settings.cols;
    
    return {
      left: settings.margins + newX * (colWidth + settings.gap),
      top: settings.margins + newY * (rowHeight + settings.gap),
      width: newW * colWidth + (newW - 1) * settings.gap,
      height: newH * rowHeight + (newH - 1) * settings.gap
    };
  }, [mergeSourceId, mergeTargetCell, widgets, settings.canvasWidth, settings.margins, settings.cols, settings.gap, rowHeight]);

  const gridItems = useMemo(() => {
    const colWidth = (settings.canvasWidth - 2 * settings.margins - (settings.cols - 1) * settings.gap) / settings.cols;

    return widgets.map((w) => {
      const isHovered = hoveredId === w.id;
      const isSelected = selectedId === w.id;
      const isMergeSource = mergeSourceId === w.id;

      const left = settings.margins + w.x * (colWidth + settings.gap);
      const top = settings.margins + w.y * (rowHeight + settings.gap);
      const width = w.w * colWidth + (w.w - 1) * settings.gap;
      const height = w.h * rowHeight + (w.h - 1) * settings.gap;

      return (
        <div key={w.id} 
           style={{ 
             position: 'absolute',
             left: `${left}px`,
             top: `${top}px`,
             width: `${width}px`,
             height: `${height}px`,
             pointerEvents: 'auto', 
             borderRadius: `${settings.radius}px`,
             transition: isExporting ? 'none' : 'all 0.3s cubic-bezier(0.19, 1, 0.22, 1)'
           }}
           onPointerDownCapture={(e) => {
             if (!isEditing) return;
             if (e.button === 0) { // Left click
               mergeSourceIdRef.current = w.id;
               setMergeSourceId(w.id);
               const initialCell = getGridCoords(e.clientX, e.clientY);
               if (initialCell) {
                 mergeTargetCellRef.current = initialCell;
                 setMergeTargetCell(initialCell);
               }
               if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                 e.currentTarget.releasePointerCapture(e.pointerId);
               }
             }
           }}
           onMouseEnter={() => setHoveredId(w.id)} 
           onMouseLeave={() => setHoveredId(null)}
           onClick={(e) => { e.stopPropagation(); if (isEditing) setSelectedId(w.id); }}
           className={`group ${isEditing ? 'cursor-crosshair' : 'cursor-pointer'}`}>
          
          {isEditing && (isMergeSource || (isSelected && !mergeSourceId)) && (
            <div className="absolute inset-0 bg-primary/10 border-2 border-primary z-20 rounded-[inherit]" style={{ borderRadius: `${settings.radius}px` }} />
          )}

          {isEditing && isHovered && !mergeSourceId && (
             <div className={`absolute -inset-[1px] border-[1.5px] rounded-[inherit] pointer-events-none z-10 border-primary/20`}
               style={{ borderRadius: `${settings.radius + 1}px` }}>
             </div>
          )}
          <div className="relative w-full h-full overflow-hidden transition-all duration-300" 
             style={{ borderRadius: `${settings.radius}px`, backgroundColor: w.type === 'empty-light' ? COLORS.light : w.type === 'empty-med' ? COLORS.med : w.type === 'empty-dark' ? COLORS.dark : COLORS.accent }}>
             <div className="w-full h-full flex items-center justify-center text-primary/10 font-bold uppercase tracking-widest text-[10px]">{w.type.includes('empty') ? '' : w.type}</div>
          </div>
        </div>
      );
    });
  }, [widgets, hoveredId, selectedId, mergeSourceId, isEditing, settings, rowHeight, getGridCoords, isExporting]);

  return (
    <div className="dashboard-liquid-page flex h-full min-h-0 flex-col overflow-hidden bg-background font-sans text-primary sm:-m-6 lg:-m-10">
      
      <div className="bento-actions flex w-full shrink-0 items-center justify-end gap-2 px-4 py-3 sm:px-8 lg:absolute lg:right-0 lg:top-0 lg:z-50 lg:w-[360px] lg:px-6">
        <div className="flex w-full sm:w-auto items-center justify-end gap-2 sm:gap-3">
             <div className="relative group">
              <div className="dashboard-liquid-ghost flex items-center gap-0 text-primary rounded-[10px] overflow-hidden shadow-sm shadow-primary/5">
                <button onClick={() => setShowExportMenu(!showExportMenu)} className="px-3 sm:px-3.5 py-1.5 text-[11px] font-bold flex items-center gap-1.5 hover:bg-primary/5 transition-colors"><Download className="w-3.5 h-3.5" /> {isExporting ? 'Exporting...' : 'Export'}</button>
                <div className="w-[1px] h-6 bg-primary/20 my-auto" />
                <button onClick={() => setShowExportMenu(!showExportMenu)} className="px-2 py-1.5 hover:bg-primary/5 transition-colors"><ChevronDown className="w-3.5 h-3.5 transition-transform" /></button>
              </div>
              <AnimatePresence>
                {showExportMenu && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute top-full mt-2 right-0 z-[100] w-48 bg-background p-2" style={{ backgroundColor: 'var(--background)', backgroundImage: 'none' }}>
                    {(['png', 'jpg', 'svg'] as const).map((fmt) => (
                      <button key={fmt} onClick={() => exportLayout(fmt)} className="bento-export-option w-full text-left px-4 py-3 text-[11px] font-black uppercase tracking-widest text-primary/80 hover:bg-primary/5 rounded-xl transition-all">Download as {fmt.toUpperCase()}</button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
           </div>
        </div>
        </div>

      <div className="bento-workspace-row flex flex-1 min-h-0 lg:flex-row flex-col overflow-hidden overscroll-none">
        <div ref={workspaceRef} className="relative flex min-h-[360px] min-w-0 flex-1 items-center justify-center overflow-auto overscroll-none bg-background p-6 lg:flex-[0_0_calc(100%_-_360px)]">
          <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center', transition: isExporting ? 'none' : 'transform 0.2s cubic-bezier(0.19, 1, 0.22, 1)' }} className="flex items-center justify-center">
            <div ref={gridRef} onContextMenu={(e) => e.preventDefault()} onClick={() => setSelectedId(null)} className="dashboard-liquid-card bg-background border border-primary/20 shadow-[0_40px_100px_rgba(0,0,0,0.08)] rounded-[12px] overflow-hidden relative select-none touch-none"
              style={{ width: `${settings.canvasWidth}px`, height: `${settings.canvasHeight}px`, transition: 'all 0.4s cubic-bezier(0.19, 1, 0.22, 1)' }}>
              {mounted && (
                <>
                  {/* Grid Guides */}
                  <div className="absolute inset-0 pointer-events-none opacity-[0.05] dark:opacity-[0.08]" style={{ padding: `${settings.margins}px` }}>
                    <div className="w-full h-full relative">
                      {Array.from({ length: settings.cols - 1 }).map((_, i) => {
                        const colWidth = (settings.canvasWidth - 2 * settings.margins - (settings.cols - 1) * settings.gap) / settings.cols;
                        return (
                          <div key={`col-${i}`} className="absolute top-0 bottom-0 border-r border-primary border-dashed"
                            style={{ left: `${(i + 1) * colWidth + i * settings.gap + settings.gap / 2}px` }} />
                        );
                      })}
                      {Array.from({ length: settings.rows - 1 }).map((_, i) => {
                        return (
                          <div key={`row-${i}`} className="absolute left-0 right-0 border-b border-primary border-dashed"
                            style={{ top: `${(i + 1) * rowHeight + i * settings.gap + settings.gap / 2}px` }} />
                        );
                      })}
                    </div>
                  </div>

                  {/* Drag-to-Fill Preview Overlay */}
                  <AnimatePresence>
                    {previewRect && (
                      <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }}
                        className="absolute bg-primary/20 border-2 border-primary z-[60] pointer-events-none transition-all duration-200 ease-out"
                        style={{ 
                           left: `${previewRect.left}px`, 
                           top: `${previewRect.top}px`, 
                           width: `${previewRect.width}px`, 
                           height: `${previewRect.height}px`,
                           borderRadius: `${settings.radius}px`
                        }}
                      >
                        <div className="absolute inset-0 flex items-center justify-center">
                           <div className="bg-primary text-background text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest shadow-lg">Fill Area</div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="absolute inset-0">
                    {gridItems}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <aside className="bento-settings-panel bento-settings-solid dashboard-liquid-panel w-full shrink-0 min-h-0 max-h-[45vh] flex flex-col overflow-hidden rounded-none border-t border-primary/20 bg-background overscroll-none lg:h-full lg:max-h-none lg:w-[360px] lg:border-l lg:border-t-0" style={{ background: 'var(--background)', backgroundImage: 'none', backdropFilter: 'none' }}>
          <div onWheel={(e) => e.stopPropagation()} className="bento-settings-scroll flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-scroll overscroll-contain custom-scrollbar">
          <div className="px-6 py-8 space-y-2">
            <div className="flex items-center justify-between gap-3 pr-24 lg:pr-28">
              <h2 className="text-[20px] font-bold text-primary">Settings</h2>
            </div>
            <p className="text-[13px] text-primary/60">Drag to paint and fill the grid</p>
          </div>

          <div className="flex-1 pb-12">
            <CollapsibleSection title="Grid style" isCollapsed={collapsedSections["Grid style"]} onToggle={() => toggleSection("Grid style")}>
              <div className="grid grid-cols-2 gap-2">
                {GRID_STYLES.map(style => (
                  <button key={style} onClick={() => updateSetting('gridStyle', style)}
                    className={`py-2.5 px-3 rounded-full text-[12px] font-bold transition-all ${settings.gridStyle === style ? 'border-2 border-primary bg-primary/20 text-primary shadow-[0_0_14px_rgba(22,199,132,0.3)]' : 'border-0 bg-transparent text-primary/60 hover:text-primary'}`}>
                    {style}
                  </button>
                ))}
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Dimensions" isCollapsed={collapsedSections["Dimensions"]} onToggle={() => toggleSection("Dimensions")}>
               <div className="space-y-6">
                 <CompactSidebarSlider label="Width" value={settings.canvasWidth} min={200} max={1200} step={10} onChange={(v) => updateSetting('canvasWidth', v)} />
                 <CompactSidebarSlider label="Height" value={settings.canvasHeight} min={200} max={1200} step={10} onChange={(v) => updateSetting('canvasHeight', v)} />
               </div>
            </CollapsibleSection>

            <CollapsibleSection title="Grid layout" isCollapsed={collapsedSections["Grid layout"]} onToggle={() => toggleSection("Grid layout")}>
               <div className="space-y-6">
                 <CompactSidebarSlider label="Columns" value={settings.cols} min={1} max={12} step={1} onChange={(v) => updateSetting('cols', v)} />
                 <CompactSidebarSlider label="Rows" value={settings.rows} min={1} max={12} step={1} onChange={(v) => updateSetting('rows', v)} />
                 <button onClick={() => generateRandomGrid()} className="liquid-button-primary w-full flex items-center justify-center gap-2 py-3.5 text-background rounded-[12px] text-[14px] font-bold shadow-lg leading-none">
                   <RotateCcw className="w-4 h-4" /> Randomize grid
                 </button>
               </div>
            </CollapsibleSection>

            <CollapsibleSection title="Spacing & corners" isCollapsed={collapsedSections["Spacing & corners"]} onToggle={() => toggleSection("Spacing & corners")}>
               <div className="space-y-6">
                 <CompactSidebarSlider label="Gap" value={settings.gap} min={0} max={40} step={1} onChange={(v) => updateSetting('gap', v)} />
                 <CompactSidebarSlider label="Margins" value={settings.margins} min={0} max={60} step={1} onChange={(v) => updateSetting('margins', v)} />
                 <CompactSidebarSlider label="Radius" value={settings.radius} min={0} max={60} step={1} onChange={(v) => updateSetting('radius', v)} />
               </div>
            </CollapsibleSection>

            <CollapsibleSection title="Advanced" isCollapsed={collapsedSections["Advanced"]} onToggle={() => toggleSection("Advanced")}>
               <div className="space-y-6">
                 <CompactSidebarSlider label="Complexity" value={settings.complexity} min={0} max={100} step={1} onChange={(v) => updateSetting('complexity', v)} />
                 <CompactSidebarSlider label="Horizontal bias" value={settings.hBias} min={0} max={100} step={1} onChange={(v) => updateSetting('hBias', v)} />
                 <CompactSidebarSlider label="Max col span" value={settings.maxColSpan} min={1} max={12} step={1} onChange={(v) => updateSetting('maxColSpan', v)} />
                 <CompactSidebarSlider label="Max row span" value={settings.maxRowSpan} min={1} max={12} step={1} onChange={(v) => updateSetting('maxRowSpan', v)} />
               </div>
            </CollapsibleSection>
          </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

interface CollapsibleSectionProps {
  title: string;
  isCollapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function CollapsibleSection({ title, isCollapsed, onToggle, children }: CollapsibleSectionProps) {
  return (
    <div className="border-t border-primary/20 first:border-t-0">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-6 py-6 hover:bg-primary/5 transition-colors group">
        <span className="text-[14px] font-bold text-primary uppercase tracking-wider">{title}</span>
        <ChevronDown className={`w-5 h-5 text-primary/60 group-hover:text-primary transition-transform duration-300 ${isCollapsed ? '-rotate-90' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: 'easeInOut' }} className="overflow-hidden">
            <div className="px-6 pb-8">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CompactSidebarSlider({ label, value, min, max, step, onChange, tooltip }: { label: string, value: number, min: number, max: number, step: number, onChange: (v: number) => void, tooltip?: string }) {
  const percentage = getSliderProgress(value, min, max);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4">
         <span className="text-[13px] font-medium text-primary/60 w-20 shrink-0 capitalize">{label}</span>
         <div className="flex-1 relative h-6 flex items-center">
            <input type="range" min={min} max={max} step={step} value={value} 
              onInput={(e) => onChange(Number((e.target as HTMLInputElement).value))} 
              className="w-full sidebar-range-pro" style={{ '--range-progress': percentage } as CSSProperties} />
         </div>
      </div>
      {tooltip && (
        <p className="text-[11px] text-primary/50 leading-relaxed pl-24">{tooltip}</p>
      )}
    </div>
  );
}
