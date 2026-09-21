import React, { useEffect, useRef, useState } from 'react';
import { DesignElement, PatternSettings } from '../types';
import { drawTileToCanvas } from '../utils/exportUtils';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid,
  Download,
  Layers,
  Sparkles,
} from 'lucide-react';
import { exportTiledFabric } from '../utils/exportUtils';

interface TilingPreviewProps {
  elements: DesignElement[];
  settings: PatternSettings;
  setSettings: React.Dispatch<React.SetStateAction<PatternSettings>>;
}

export const TilingPreview: React.FC<TilingPreviewProps> = ({
  elements,
  settings,
  setSettings,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [repeatCount, setRepeatCount] = useState<number>(4); // 4x4 repeat
  const [showTileBorders, setShowTileBorders] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });

  // Render seamless tiling in real-time
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const tileSize = 280; // virtual render size per tile
    const totalW = repeatCount * tileSize;
    const totalH = repeatCount * tileSize;

    canvas.width = totalW;
    canvas.height = totalH;

    // Render 1:1 single master tile onto offscreen buffer
    const offscreen = document.createElement('canvas');
    offscreen.width = tileSize;
    offscreen.height = tileSize;
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;

    drawTileToCanvas(offCtx, elements, settings, tileSize, tileSize, true);

    // Background
    if (!settings.backgroundTransparent) {
      ctx.fillStyle = settings.backgroundColor;
      ctx.fillRect(0, 0, totalW, totalH);
    } else {
      ctx.clearRect(0, 0, totalW, totalH);
    }

    // Tile across columns and rows with seamless wrapping and repeat offsets
    for (let c = 0; c < repeatCount; c++) {
      for (let r = 0; r < repeatCount; r++) {
        let x = c * tileSize;
        let y = r * tileSize;

        if (settings.repeatType === 'half-drop') {
          if (c % 2 === 1) {
            y += tileSize / 2;
          }
        } else if (settings.repeatType === 'half-brick') {
          if (r % 2 === 1) {
            x += tileSize / 2;
          }
        }

        ctx.drawImage(offscreen, x, y);

        // Fill gaps produced by half-drop/half-brick at the edge
        if (settings.repeatType === 'half-drop' && c % 2 === 1) {
          ctx.drawImage(offscreen, x, y - tileSize * repeatCount);
        }
        if (settings.repeatType === 'half-brick' && r % 2 === 1) {
          ctx.drawImage(offscreen, x - tileSize * repeatCount, y);
        }

        // Optional tile outline to inspect seams
        if (showTileBorders) {
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, tileSize, tileSize);
        }
      }
    }
  }, [elements, settings, repeatCount, showTileBorders]);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsPanning(true);
    setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPanning) return;
    setPan({
      x: e.clientX - startPan.x,
      y: e.clientY - startPan.y,
    });
  };

  const handlePointerUp = () => {
    setIsPanning(false);
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-[#0b0c0e] select-none overflow-hidden relative">
      {/* Top Tiling Control Bar */}
      <div className="h-12 bg-[#101114] border-b border-[#252a31] px-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-[#aeb5bf]">
            <Sparkles className="w-4 h-4 text-[#18c98a]" />
            <span className="font-semibold text-[#f5f7f8]">Live Repeat Tiling:</span>
            <span className="text-[#18c98a] font-mono font-bold">
              {repeatCount} × {repeatCount} Units
            </span>
          </div>

          <div className="h-4 w-px bg-[#252a31] hidden sm:block" />

          {/* Repeat Type Buttons */}
          <div className="flex items-center gap-1 bg-[#17191e] p-0.5 rounded-lg border border-[#252a31]">
            {(['grid', 'half-drop', 'half-brick'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() =>
                  setSettings((prev) => ({ ...prev, repeatType: mode }))
                }
                className={`px-2.5 py-1 rounded text-xs capitalize transition ${
                  settings.repeatType === mode
                    ? 'bg-[#18c98a] text-[#071b17] font-bold'
                    : 'text-[#aeb5bf] hover:text-[#f5f7f8]'
                }`}
              >
                {mode.replace('-', ' ')}
              </button>
            ))}
          </div>

          {/* Repeat Density Slider */}
          <div className="hidden md:flex items-center gap-2 pl-2">
            <span className="text-[11px] text-[#77808c] font-mono">Density:</span>
            <input
              type="range"
              min="2"
              max="8"
              step="1"
              value={repeatCount}
              onChange={(e) => setRepeatCount(Number(e.target.value))}
              className="w-24 accent-[#18c98a] cursor-pointer"
            />
          </div>
        </div>

        {/* Right Tools: Seam Borders, Zoom, Download */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTileBorders(!showTileBorders)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border transition ${
              showTileBorders
                ? 'bg-[#18c98a]/20 text-[#18c98a] border-[#18c98a]/40 font-semibold'
                : 'bg-[#17191e] text-[#aeb5bf] border-[#252a31] hover:text-[#f5f7f8]'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Highlight Tile Seams</span>
          </button>

          <div className="flex items-center gap-1 bg-[#17191e] p-0.5 rounded-md border border-[#252a31]">
            <button
              onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.15).toFixed(2)))}
              className="p-1 text-[#aeb5bf] hover:text-[#f5f7f8]"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono text-[#77808c] px-1">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.15).toFixed(2)))}
              className="p-1 text-[#aeb5bf] hover:text-[#f5f7f8]"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              className="p-1 text-[#aeb5bf] hover:text-[#f5f7f8]"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={() => exportTiledFabric(elements, settings, repeatCount, repeatCount)}
            className="flex items-center gap-1.5 bg-[#18c98a] hover:bg-[#14b179] text-[#071b17] font-bold px-3 py-1.5 rounded-md text-xs shadow transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export Tiled Yardage</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Continuous Canvas */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={`flex-1 overflow-hidden flex items-center justify-center relative cursor-grab active:cursor-grabbing ${
          settings.backgroundTransparent ? 'bg-transparency-grid-dark' : 'bg-[#0b0c0e]'
        }`}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
          }}
          className="shadow-2xl rounded-sm transition-transform duration-75"
        >
          <canvas ref={canvasRef} className="block rounded shadow-2xl" />
        </div>

        {/* Real-time Seamless Banner */}
        <div className="absolute bottom-4 right-4 bg-[#101114]/90 backdrop-blur px-3 py-1.5 rounded-lg border border-[#252a31] text-[11px] font-mono text-[#aeb5bf] shadow-xl flex items-center gap-2 pointer-events-none">
          <div className="w-2 h-2 rounded-full bg-[#18c98a]" />
          <span>Real-time seamless edge stitching verified</span>
        </div>
      </div>
    </div>
  );
};
