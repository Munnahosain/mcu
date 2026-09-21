import React, { useRef } from 'react';
import { ToolMode, PatternSettings } from '../types';
import {
  MousePointer,
  Hand,
  Shapes,
  PenTool,
  Type,
  Upload,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid,
  Eye,
  Ruler,
  Magnet,
} from 'lucide-react';

interface ToolbarProps {
  toolMode: ToolMode;
  setToolMode: (mode: ToolMode) => void;
  onOpenShapeLibrary: () => void;
  settings: PatternSettings;
  setSettings: React.Dispatch<React.SetStateAction<PatternSettings>>;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  onResetZoom: () => void;
  onAddText: () => void;
  onUploadImages: (images: { dataUrl: string; width: number; height: number }[]) => void;
  onImportVector: (fileName: string, data: ArrayBuffer | string) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  toolMode,
  setToolMode,
  onOpenShapeLibrary,
  settings,
  setSettings,
  zoom,
  setZoom,
  onResetZoom,
  onAddText,
  onUploadImages,
  onImportVector,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const vectorFiles = files.filter((file) => /\.(svg|eps|epsf)$/i.test(file.name));
    vectorFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result) onImportVector(file.name, reader.result);
      };
      if (/\.svg$/i.test(file.name)) reader.readAsText(file);
      else reader.readAsArrayBuffer(file);
    });

    const imageFiles = files.filter((file) => !/\.(svg|eps|epsf)$/i.test(file.name));
    const imagePromises = imageFiles.map(
      (file) =>
        new Promise<{ dataUrl: string; width: number; height: number } | null>((resolve) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUrl = event.target?.result;
            if (typeof dataUrl !== 'string') {
              resolve(null);
              return;
            }

            const img = new Image();
            img.onload = () => resolve({
              dataUrl,
              width: img.width || 100,
              height: img.height || 100,
            });
            img.onerror = () => resolve(null);
            img.src = dataUrl;
          };
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        })
    );

    void Promise.all(imagePromises).then((images) => {
      const validImages = images.filter(
        (image): image is { dataUrl: string; width: number; height: number } => image !== null
      );
      if (validImages.length > 0) onUploadImages(validImages);
    });
    e.target.value = '';
  };

  return (
    <aside className="pattern-maker-toolbar flex w-14 shrink-0 flex-col items-center justify-between border-r border-[#252a31] bg-[#101114] py-3 text-[#f5f7f8] select-none">
      {/* Primary Vector Creation & Manipulation Tools */}
      <div className="flex flex-col items-center gap-1.5 w-full px-2">
        <button
          id="tool-select"
          onClick={() => setToolMode('select')}
          title="Select & Transform Tool (V)"
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition ${
            toolMode === 'select'
              ? 'bg-[#18c98a] text-[#071b17] font-bold shadow-md shadow-[#18c98a]/20'
              : 'text-[#aeb5bf] hover:text-[#f5f7f8] hover:bg-[#17191e]'
          }`}
        >
          <MousePointer className="w-4 h-4" />
        </button>

        <button
          id="tool-pan"
          onClick={() => setToolMode('pan')}
          title="Pan / Hand Tool (H or Space+Drag)"
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition ${
            toolMode === 'pan'
              ? 'bg-[#18c98a] text-[#071b17] font-bold shadow-md shadow-[#18c98a]/20'
              : 'text-[#aeb5bf] hover:text-[#f5f7f8] hover:bg-[#17191e]'
          }`}
        >
          <Hand className="w-4 h-4" />
        </button>

        <div className="w-6 border-b border-[#252a31] my-1" />

        <button
          id="tool-shapes"
          onClick={onOpenShapeLibrary}
          title="Vector Motifs & Shape Library (M)"
          className="w-10 h-10 rounded-lg flex items-center justify-center text-[#18c98a] bg-[#18c98a]/10 hover:bg-[#18c98a]/20 border border-[#18c98a]/30 transition group relative"
        >
          <Shapes className="w-4 h-4" />
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#18c98a]" />
        </button>

        <button
          id="tool-draw"
          onClick={() => setToolMode('draw')}
          title="Seamless Edge Brush / Pen Tool (P)"
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition ${
            toolMode === 'draw'
              ? 'bg-[#18c98a] text-[#071b17] font-bold shadow-md shadow-[#18c98a]/20'
              : 'text-[#aeb5bf] hover:text-[#f5f7f8] hover:bg-[#17191e]'
          }`}
        >
          <PenTool className="w-4 h-4" />
        </button>

        <button
          id="tool-text"
          onClick={onAddText}
          title="Add Monogram or Typographic Pattern (T)"
          className="w-10 h-10 rounded-lg flex items-center justify-center text-[#aeb5bf] hover:text-[#f5f7f8] hover:bg-[#17191e] transition"
        >
          <Type className="w-4 h-4" />
        </button>

        <button
          id="tool-upload"
          onClick={() => fileInputRef.current?.click()}
          title="Upload Custom SVG or PNG motif"
          className="w-10 h-10 rounded-lg flex items-center justify-center text-[#aeb5bf] hover:text-[#f5f7f8] hover:bg-[#17191e] transition"
        >
          <Upload className="w-4 h-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,.eps,.epsf,application/postscript"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="w-6 border-b border-[#252a31] my-1" />

        {/* Seamless Edge Wrap & Visual Guides Toggles */}
        <button
          id="toggle-ghost-wraps"
          onClick={() =>
            setSettings((prev) => ({
              ...prev,
              showGhostWraps: !prev.showGhostWraps,
            }))
          }
          title={
            settings.showGhostWraps
              ? 'Edge Wrapping Indicators: ON (Shows automatic mirrored wraps across borders)'
              : 'Edge Wrapping Indicators: OFF'
          }
          className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs transition ${
            settings.showGhostWraps
              ? 'bg-[#18c98a]/20 text-[#18c98a] border border-[#18c98a]/40'
              : 'text-[#77808c] hover:text-[#f5f7f8] hover:bg-[#17191e]'
          }`}
        >
          <Eye className="w-4 h-4" />
        </button>

        <button
          id="toggle-rulers"
          onClick={() =>
            setSettings((prev) => ({
              ...prev,
              showRulers: !prev.showRulers,
            }))
          }
          title={settings.showRulers ? 'Hide Rulers' : 'Show Rulers (cm/inch map)'}
          className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs transition ${
            settings.showRulers
              ? 'bg-[#18c98a]/20 text-[#18c98a] border border-[#18c98a]/40'
              : 'text-[#77808c] hover:text-[#f5f7f8] hover:bg-[#17191e]'
          }`}
        >
          <Ruler className="w-4 h-4" />
        </button>

        <button
          id="toggle-grid"
          onClick={() =>
            setSettings((prev) => ({
              ...prev,
              showGridLines: !prev.showGridLines,
            }))
          }
          title="Toggle Grid Lines"
          className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs transition ${
            settings.showGridLines
              ? 'bg-[#18c98a]/20 text-[#18c98a] border border-[#18c98a]/40'
              : 'text-[#77808c] hover:text-[#f5f7f8] hover:bg-[#17191e]'
          }`}
        >
          <Grid className="w-4 h-4" />
        </button>

        <button
          id="toggle-snap"
          onClick={() =>
            setSettings((prev) => ({
              ...prev,
              gridSnap: !prev.gridSnap,
            }))
          }
          title={settings.gridSnap ? 'Grid Snapping: Active' : 'Grid Snapping: Off'}
          className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs transition ${
            settings.gridSnap
              ? 'bg-[#18c98a]/20 text-[#18c98a] border border-[#18c98a]/40'
              : 'text-[#77808c] hover:text-[#f5f7f8] hover:bg-[#17191e]'
          }`}
        >
          <Magnet className="w-4 h-4" />
        </button>
      </div>

      {/* Canvas Zoom & Inspection Controls */}
      <div className="flex flex-col items-center gap-1 w-full px-2">
        <button
          onClick={() => setZoom((z) => Math.min(3, +(z + 0.15).toFixed(2)))}
          title="Zoom In"
          className="w-9 h-9 rounded-md flex items-center justify-center text-[#aeb5bf] hover:text-[#f5f7f8] hover:bg-[#17191e] transition"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <div className="text-[10px] font-mono text-[#77808c] py-0.5">
          {Math.round(zoom * 100)}%
        </div>

        <button
          onClick={() => setZoom((z) => Math.max(0.3, +(z - 0.15).toFixed(2)))}
          title="Zoom Out"
          className="w-9 h-9 rounded-md flex items-center justify-center text-[#aeb5bf] hover:text-[#f5f7f8] hover:bg-[#17191e] transition"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <button
          onClick={onResetZoom}
          title="Reset Zoom to 100%"
          className="w-9 h-9 rounded-md flex items-center justify-center text-[#aeb5bf] hover:text-[#f5f7f8] hover:bg-[#17191e] transition"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
};
