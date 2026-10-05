import React, { useEffect, useRef, useState } from 'react';
import {
  BlendMode,
  DesignElement,
  PatternSettings,
  PhysicalUnit,
  RepeatType,
} from '../types';
import {
  Sliders,
  FlipHorizontal,
  FlipVertical,
  Copy,
  Trash2,
  ChevronsUp,
  ChevronsDown,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  GripVertical,
  Pipette,
  Blend,
} from 'lucide-react';
import { isElementCrossingEdge } from '../utils/seamlessMath';
import { getPresetByKind } from '../utils/shapeLibrary';

interface PropertiesPanelProps {
  elements: DesignElement[];
  selectedElement: DesignElement | null;
  selectedId: string | null;
  selectedIds: string[];
  setSelectedId: (id: string | null) => void;
  onSelectLayer: (id: string, extend: boolean) => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
  onReorderLayer: (draggedId: string, targetId: string) => void;
  onUpdateElement: (updated: Partial<DesignElement>) => void;
  onDuplicateElement: () => void;
  onDeleteElement: () => void;
  onReorderElement: (direction: 'front' | 'back' | 'forward' | 'backward') => void;
  settings: PatternSettings;
  setSettings: React.Dispatch<React.SetStateAction<PatternSettings>>;
  onOpenImagePalette?: () => void;
  extractedPalette?: string[];
}

const TEXTILE_PALETTE = [
  '#1b4332', // Forest Green
  '#40916c', // Sage
  '#2a9d8f', // Peacock Teal
  '#0077b6', // Classic Indigo
  '#3d405b', // Midnight Navy
  '#f72585', // Hibiscus Pink
  '#e63946', // Crimson Red
  '#e76f51', // Terracotta
  '#f4a261', // Ochre Amber
  '#e9c46a', // Marigold Yellow
  '#8338ec', // Royal Purple
  '#bc6c25', // Caramel Brown
  '#606c38', // Olive Khaki
  '#ffffff', // Crisp White
  '#1c1917', // Carbon Black
];

const BLEND_MODES: Array<{ id: BlendMode; label: string; group: string; description: string }> = [
  { id: 'normal', label: 'Normal', group: 'Standard', description: 'Default opaque layer blending' },
  { id: 'multiply', label: 'Multiply', group: 'Darken', description: 'Multiplies colors — ideal for textile dye & shadow effects' },
  { id: 'darken', label: 'Darken', group: 'Darken', description: 'Retains the darker of overlapping colors' },
  { id: 'color-burn', label: 'Color Burn', group: 'Darken', description: 'Darkens base color to reflect blend color' },
  { id: 'screen', label: 'Screen', group: 'Lighten', description: 'Inverts, multiplies, & inverts — ideal for glowing highlights' },
  { id: 'lighten', label: 'Lighten', group: 'Lighten', description: 'Retains the lighter of overlapping colors' },
  { id: 'color-dodge', label: 'Color Dodge', group: 'Lighten', description: 'Brightens base color to reflect blend color' },
  { id: 'overlay', label: 'Overlay', group: 'Contrast', description: 'Combines Multiply and Screen for rich contrast' },
  { id: 'soft-light', label: 'Soft Light', group: 'Contrast', description: 'Soft, diffused lighting and subtle contrast' },
  { id: 'hard-light', label: 'Hard Light', group: 'Contrast', description: 'Vivid spotlight effect with punchy contrast' },
  { id: 'difference', label: 'Difference', group: 'Inversion', description: 'Subtracts colors, creating high-contrast inverse tones' },
  { id: 'exclusion', label: 'Exclusion', group: 'Inversion', description: 'Softer difference effect with gentler contrast' },
  { id: 'hue', label: 'Hue', group: 'Component', description: 'Adopts motif hue while preserving backdrop luminosity' },
  { id: 'saturation', label: 'Saturation', group: 'Component', description: 'Adopts motif saturation while keeping hue & lightness' },
  { id: 'color', label: 'Color', group: 'Component', description: 'Tints backdrop with the motif hue and chroma' },
  { id: 'luminosity', label: 'Luminosity', group: 'Component', description: 'Applies brightness while keeping original colors' },
];

const QUICK_BLEND_MODES: BlendMode[] = ['normal', 'multiply', 'screen', 'overlay'];

function sliderProgress(value: number, minimum: number, maximum: number): React.CSSProperties {
  const percentage = ((value - minimum) / (maximum - minimum)) * 100;
  return { '--range-progress': `${Math.max(0, Math.min(100, percentage))}%` } as React.CSSProperties;
}

function LayerPreview({ element }: { element: DesignElement }) {
  const extent = Math.max(element.width, element.height, 1);
  const scale = 72 / extent;

  return (
    <svg viewBox="0 0 100 100" className="h-10 w-10 shrink-0 rounded-md border border-[#30363e] bg-[#101114]" aria-hidden="true">
      <g transform={`translate(50 50) rotate(${element.rotation}) scale(${scale})`}>
        {element.type === 'shape' && element.shapeKind && (
          <path d={getPresetByKind(element.shapeKind).path} transform="translate(-50 -50)" fill={element.fill} stroke={element.stroke || 'none'} strokeWidth={element.strokeWidth || 0} />
        )}
        {element.type === 'path' && element.pathData && (
          <path d={element.pathData} transform={`translate(${-element.width / 2} ${-element.height / 2})`} fill={element.fill} stroke={element.stroke || 'none'} strokeWidth={element.strokeWidth || 0} strokeLinecap="round" strokeLinejoin="round" />
        )}
        {element.type === 'text' && (
          <text x="0" y="0" fontFamily={element.fontFamily || 'sans-serif'} fontSize={element.fontSize || 32} fill={element.fill} textAnchor="middle" dominantBaseline="central" fontWeight="bold">{element.textContent || 'Aa'}</text>
        )}
        {element.type === 'image' && element.imageUrl && (
          <image href={element.imageUrl} x={-element.width / 2} y={-element.height / 2} width={element.width} height={element.height} preserveAspectRatio="xMidYMid meet" />
        )}
      </g>
    </svg>
  );
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  elements,
  selectedElement,
  selectedId,
  selectedIds,
  setSelectedId,
  onSelectLayer,
  onToggleVisibility,
  onToggleLock,
  onReorderLayer,
  onUpdateElement,
  onDuplicateElement,
  onDeleteElement,
  onReorderElement,
  settings,
  setSettings,
  onOpenImagePalette,
  extractedPalette = [],
}) => {
  const [draggingLayerId, setDraggingLayerId] = useState<string | null>(null);
  const dragSourceId = useRef<string | null>(null);
  const reorderLayerRef = useRef(onReorderLayer);

  useEffect(() => {
    reorderLayerRef.current = onReorderLayer;
  }, [onReorderLayer]);

  useEffect(() => {
    const finishLayerDrag = (event: PointerEvent) => {
      const sourceId = dragSourceId.current;
      if (!sourceId) return;
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-layer-id]');
      const targetId = target?.dataset.layerId;
      if (targetId && targetId !== sourceId) reorderLayerRef.current(sourceId, targetId);
      dragSourceId.current = null;
      setDraggingLayerId(null);
    };

    window.addEventListener('pointerup', finishLayerDrag);
    window.addEventListener('pointercancel', finishLayerDrag);
    return () => {
      window.removeEventListener('pointerup', finishLayerDrag);
      window.removeEventListener('pointercancel', finishLayerDrag);
    };
  }, []);
  const crossing = selectedElement
    ? isElementCrossingEdge(selectedElement, settings.artboardSize)
    : null;
  const isCrossingAny = crossing && (crossing.left || crossing.right || crossing.top || crossing.bottom);

  return (
    <aside className="pattern-maker-inspector flex h-full w-[clamp(260px,22vw,320px)] max-w-[30vw] shrink-0 flex-col overflow-y-auto border-r border-[var(--card-border)] bg-[var(--card-bg)] text-xs text-foreground select-none">
      {/* Panel Header */}
      <div className="p-3.5 border-b border-[#252a31] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[#18c98a]" />
          <span className="font-bold text-sm text-[#f5f7f8]">
            {selectedElement ? 'Element Inspector' : 'Settings'}
          </span>
        </div>
        {selectedElement && (
          <span className="font-mono text-[10px] text-[#18c98a] bg-[#18c98a]/10 px-2 py-0.5 rounded border border-[#18c98a]/30">
            {selectedIds.length > 1 ? `${selectedIds.length} selected` : selectedElement.name || selectedElement.type}
          </span>
        )}
      </div>

      <div className="p-3.5 space-y-5">
        <section className="space-y-2">
          <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-wider text-[#77808c]">
            <span>Layers</span>
            <span>{elements.length}</span>
          </div>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {[...elements].sort((a, b) => b.zIndex - a.zIndex).map((element) => (
              <div
                key={element.id}
                data-layer-id={element.id}
                className={`flex min-w-0 items-center gap-1 rounded-md border p-1 transition ${
                  selectedIds.includes(element.id)
                    ? 'border-[#18c98a]/50 bg-[#18c98a]/10 text-[#18c98a]'
                    : 'border-transparent bg-[#17191e] text-[#aeb5bf] hover:border-[#30363e] hover:text-[#f5f7f8]'
                } ${draggingLayerId === element.id ? 'opacity-40' : ''}`}
              >
                <button
                  type="button"
                  aria-label={`Drag ${element.name} to reorder`}
                  title="Drag to reorder"
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    dragSourceId.current = element.id;
                    setDraggingLayerId(element.id);
                  }}
                  className="flex h-9 w-5 shrink-0 touch-none cursor-grab items-center justify-center text-[#77808c] active:cursor-grabbing"
                >
                  <GripVertical className="h-4 w-3" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={(event) => onSelectLayer(element.id, event.shiftKey)}
                  title={element.name || element.type}
                  className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-left"
                >
                  <LayerPreview element={element} />
                  <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
                    <span className="truncate text-[10px] uppercase text-[#aeb5bf]">{element.name || element.type}</span>
                    {element.blendMode && element.blendMode !== 'normal' && (
                      <span className="text-[9px] font-mono text-[#18c98a] leading-none mt-0.5 capitalize">
                        {element.blendMode}
                      </span>
                    )}
                  </div>
                </button>
                <button type="button" onClick={() => onToggleVisibility(element.id)} aria-label={element.visible === false ? `Show ${element.name}` : `Hide ${element.name}`} title={element.visible === false ? 'Show layer' : 'Hide layer'} className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-[#aeb5bf] hover:bg-[#2a2f36] hover:text-[#f5f7f8]">
                  {element.visible === false ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <button type="button" onClick={() => onToggleLock(element.id)} aria-label={element.locked ? `Unlock ${element.name}` : `Lock ${element.name}`} title={element.locked ? 'Unlock layer' : 'Lock layer'} className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-[#aeb5bf] hover:bg-[#2a2f36] hover:text-[#f5f7f8]">
                  {element.locked ? <Lock className="h-3.5 w-3.5 text-[#18c98a]" /> : <Unlock className="h-3.5 w-3.5" />}
                </button>
              </div>
            ))}
            {elements.length === 0 && (
              <p className="rounded-md bg-[#17191e] px-2.5 py-3 text-[11px] text-[#77808c]">No layers yet</p>
            )}
          </div>
        </section>

        {selectedElement ? (
          <>
            {/* Edge Wrapping Active Alert */}
            {(selectedElement.groupName || selectedElement.sourceFormat) && (
              <div className="rounded-lg border border-[#18c98a]/30 bg-[#18c98a]/10 p-2.5 space-y-1">
                <div className="font-mono text-[10px] uppercase tracking-wider text-[#18c98a]">Imported Layer</div>
                <div className="text-[11px] text-[#f5f7f8]">{selectedElement.groupName || 'Standalone vector'}</div>
                <div className="text-[10px] text-[#aeb5bf]">
                  {selectedElement.sourceFormat?.toUpperCase()} vector • editable path
                </div>
              </div>
            )}

            {/* Edge Wrapping Active Alert */}
            {isCrossingAny && (
              <div className="bg-[#18c98a]/10 border border-[#18c98a]/30 rounded-lg p-2.5 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#18c98a] shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-semibold text-[#18c98a] text-[11px]">
                    Automatic Edge Stitching Active
                  </div>
                  <p className="text-[10px] text-[#aeb5bf] leading-relaxed">
                    This shape extends beyond the artboard edge. The protruding portion is automatically flipped to the opposite edge with 0 math required!
                  </p>
                </div>
              </div>
            )}

            {/* Position & Dimensions */}
            <div className="space-y-2">
              <div className="font-mono text-[11px] text-[#77808c] uppercase tracking-wider font-semibold">
                Transform
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#17191e] rounded-md p-2 border border-[#252a31]">
                  <label className="text-[10px] text-[#77808c] block mb-0.5">X Position</label>
                  <input
                    type="number"
                    value={Math.round(selectedElement.x)}
                    onChange={(e) => onUpdateElement({ x: Number(e.target.value) })}
                    className="w-full bg-[#20242a] text-[#f5f7f8] font-mono text-xs px-2 py-1 rounded border border-[#30363e] focus:border-[#18c98a] focus:outline-none"
                  />
                </div>
                <div className="bg-[#17191e] rounded-md p-2 border border-[#252a31]">
                  <label className="text-[10px] text-[#77808c] block mb-0.5">Y Position</label>
                  <input
                    type="number"
                    value={Math.round(selectedElement.y)}
                    onChange={(e) => onUpdateElement({ y: Number(e.target.value) })}
                    className="w-full bg-[#20242a] text-[#f5f7f8] font-mono text-xs px-2 py-1 rounded border border-[#30363e] focus:border-[#18c98a] focus:outline-none"
                  />
                </div>
                <div className="bg-[#17191e] rounded-md p-2 border border-[#252a31]">
                  <label className="text-[10px] text-[#77808c] block mb-0.5">Width</label>
                  <input
                    type="number"
                    value={Math.round(selectedElement.width)}
                    onChange={(e) =>
                      onUpdateElement({ width: Math.max(10, Number(e.target.value)) })
                    }
                    className="w-full bg-[#20242a] text-[#f5f7f8] font-mono text-xs px-2 py-1 rounded border border-[#30363e] focus:border-[#18c98a] focus:outline-none"
                  />
                </div>
                <div className="bg-[#17191e] rounded-md p-2 border border-[#252a31]">
                  <label className="text-[10px] text-[#77808c] block mb-0.5">Height</label>
                  <input
                    type="number"
                    value={Math.round(selectedElement.height)}
                    onChange={(e) =>
                      onUpdateElement({ height: Math.max(10, Number(e.target.value)) })
                    }
                    className="w-full bg-[#20242a] text-[#f5f7f8] font-mono text-xs px-2 py-1 rounded border border-[#30363e] focus:border-[#18c98a] focus:outline-none"
                  />
                </div>
              </div>

              {/* Rotation & Flip Controls */}
              <div className="bg-[#17191e] rounded-md p-2 border border-[#252a31] space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-[#77808c]">Rotation</label>
                  <span className="font-mono text-[#18c98a] text-[11px]">
                    {selectedElement.rotation}°
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={selectedElement.rotation}
                  onChange={(e) => onUpdateElement({ rotation: Number(e.target.value) })}
                  style={sliderProgress(selectedElement.rotation, 0, 360)}
                  className="w-full accent-[#18c98a] cursor-pointer"
                />

                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    onClick={() =>
                      onUpdateElement({ scaleX: selectedElement.scaleX * -1 })
                    }
                    title="Flip Horizontally"
                    className="flex-1 py-1.5 bg-[#20242a] hover:bg-[#2a2f36] text-[#aeb5bf] rounded flex items-center justify-center gap-1 text-[11px] transition"
                  >
                    <FlipHorizontal className="w-3.5 h-3.5" />
                    <span>Flip H</span>
                  </button>
                  <button
                    onClick={() =>
                      onUpdateElement({ scaleY: selectedElement.scaleY * -1 })
                    }
                    title="Flip Vertically"
                    className="flex-1 py-1.5 bg-[#20242a] hover:bg-[#2a2f36] text-[#aeb5bf] rounded flex items-center justify-center gap-1 text-[11px] transition"
                  >
                    <FlipVertical className="w-3.5 h-3.5" />
                    <span>Flip V</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Colors & Appearance */}
            <div className="space-y-2">
              <div className="font-mono text-[11px] text-[#77808c] uppercase tracking-wider font-semibold">
                Appearance
              </div>

              <div className="bg-[#17191e] rounded-md p-2.5 border border-[#252a31] space-y-2.5">
                {/* Fill Color */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-[#77808c]">Fill Color</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={selectedElement.fill === 'none' ? '#ffffff' : selectedElement.fill}
                        onChange={(e) => onUpdateElement({ fill: e.target.value })}
                        className="w-5 h-5 rounded cursor-pointer border-0 p-0 bg-transparent"
                      />
                      <span className="font-mono text-[10px] text-[#aeb5bf]">
                        {selectedElement.fill}
                      </span>
                    </div>
                  </div>

                  {/* Extracted Image Palette (if available) */}
                  {extractedPalette && extractedPalette.length > 0 && (
                    <div className="mb-2 pb-2 border-b border-[#252a31]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-[#18c98a] font-bold flex items-center gap-1">
                          <Pipette className="w-3 h-3 text-[#18c98a]" /> Extracted Palette
                        </span>
                        {onOpenImagePalette && (
                          <button
                            type="button"
                            onClick={onOpenImagePalette}
                            className="text-[9px] text-[#18c98a] hover:underline font-bold"
                          >
                            New Image
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {extractedPalette.map((col, idx) => (
                          <button
                            key={col + idx}
                            type="button"
                            onClick={() => onUpdateElement({ fill: col })}
                            title={`1-Click Apply ${col} as Fill`}
                            style={{ backgroundColor: col }}
                            className={`h-6 rounded border transition shadow-sm ${
                              selectedElement.fill.toLowerCase() === col.toLowerCase()
                                ? 'border-[#18c98a] scale-110 ring-2 ring-[#18c98a]/40 z-10'
                                : 'border-white/20 hover:scale-105'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Extract Palette Button */}
                  {onOpenImagePalette && (!extractedPalette || extractedPalette.length === 0) && (
                    <button
                      type="button"
                      onClick={onOpenImagePalette}
                      className="w-full py-1.5 px-2 mb-2 rounded-md border border-[#18c98a]/30 bg-[#18c98a]/10 hover:bg-[#18c98a]/20 text-[#18c98a] text-[10px] font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Pipette className="w-3 h-3" />
                      <span>Extract Palette from Image</span>
                    </button>
                  )}

                  {/* Textile Palette Quick Picks */}
                  <div className="grid grid-cols-8 gap-1 pt-1">
                    {TEXTILE_PALETTE.map((col) => (
                      <button
                        key={col}
                        onClick={() => onUpdateElement({ fill: col })}
                        style={{ backgroundColor: col }}
                        className={`w-6 h-6 rounded border transition ${
                          selectedElement.fill.toLowerCase() === col.toLowerCase()
                            ? 'border-[#18c98a] scale-110 shadow-sm'
                            : 'border-[#252a31] hover:scale-105'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Stroke Color & Width */}
                <div className="pt-2 border-t border-[#252a31]">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-[#77808c]">Stroke / Outline</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={
                          selectedElement.stroke === 'none'
                            ? '#000000'
                            : selectedElement.stroke
                        }
                        onChange={(e) => onUpdateElement({ stroke: e.target.value })}
                        className="w-5 h-5 rounded cursor-pointer border-0 p-0 bg-transparent"
                      />
                      <span className="font-mono text-[10px] text-[#aeb5bf]">
                        {selectedElement.strokeWidth}px
                      </span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="16"
                    value={selectedElement.strokeWidth}
                    onChange={(e) =>
                      onUpdateElement({
                        strokeWidth: Number(e.target.value),
                        stroke: selectedElement.stroke === 'none' ? '#ffffff' : selectedElement.stroke,
                      })
                    }
                    style={sliderProgress(selectedElement.strokeWidth, 0, 16)}
                    className="w-full accent-[#18c98a] cursor-pointer"
                  />
                </div>

                {/* Opacity */}
                <div className="pt-2 border-t border-[#252a31]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-[#77808c]">Opacity</span>
                    <span className="font-mono text-[10px] text-[#aeb5bf]">
                      {Math.round(selectedElement.opacity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.05"
                    value={selectedElement.opacity}
                    onChange={(e) =>
                      onUpdateElement({ opacity: Number(e.target.value) })
                    }
                    style={sliderProgress(selectedElement.opacity, 0.1, 1)}
                    className="w-full accent-[#18c98a] cursor-pointer"
                  />
                </div>

                {/* CSS Blend Mode */}
                <div className="pt-2.5 border-t border-[#252a31] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#77808c] flex items-center gap-1.5 font-medium">
                      <Blend className="w-3.5 h-3.5 text-[#18c98a]" />
                      <span>CSS Blend Mode</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] text-[#18c98a] bg-[#18c98a]/10 px-1.5 py-0.5 rounded border border-[#18c98a]/20 capitalize">
                        {selectedElement.blendMode || 'normal'}
                      </span>
                      {selectedElement.blendMode && selectedElement.blendMode !== 'normal' && (
                        <button
                          type="button"
                          onClick={() => onUpdateElement({ blendMode: 'normal' })}
                          className="text-[9px] text-[#77808c] hover:text-white underline transition"
                          title="Reset to Normal blend mode"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Quick-Access Common Modes */}
                  <div className="grid grid-cols-4 gap-1">
                    {QUICK_BLEND_MODES.map((mode) => {
                      const isActive = (selectedElement.blendMode || 'normal') === mode;
                      return (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => onUpdateElement({ blendMode: mode })}
                          className={`py-1 px-1.5 text-[10px] font-semibold rounded capitalize transition border ${
                            isActive
                              ? 'bg-[#18c98a] text-[#071b17] border-[#18c98a] shadow-sm font-bold'
                              : 'bg-[#20242a] text-[#aeb5bf] border-[#30363e] hover:bg-[#282d34] hover:text-white'
                          }`}
                        >
                          {mode}
                        </button>
                      );
                    })}
                  </div>

                  {/* Comprehensive Dropdown Selector */}
                  <div className="relative">
                    <select
                      value={selectedElement.blendMode || 'normal'}
                      onChange={(e) => onUpdateElement({ blendMode: e.target.value as BlendMode })}
                      className="w-full bg-[#20242a] text-[#f5f7f8] text-xs px-2.5 py-1.5 rounded border border-[#30363e] focus:border-[#18c98a] focus:outline-none cursor-pointer appearance-none pr-7 font-sans"
                    >
                      {['Standard', 'Darken', 'Lighten', 'Contrast', 'Inversion', 'Component'].map((group) => (
                        <optgroup key={group} label={group} className="bg-[#17191e] text-[#18c98a] font-bold">
                          {BLEND_MODES.filter((m) => m.group === group).map((m) => (
                            <option key={m.id} value={m.id} className="bg-[#20242a] text-white font-normal py-1">
                              {m.label} ({m.id})
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-[#77808c] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>

                  {/* Active Blend Mode Description */}
                  {(() => {
                    const activeModeMeta = BLEND_MODES.find(
                      (m) => m.id === (selectedElement.blendMode || 'normal')
                    );
                    if (!activeModeMeta) return null;
                    return (
                      <p className="text-[10px] text-[#77808c] leading-tight px-1 italic">
                        {activeModeMeta.description}
                      </p>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Layer ordering and object actions */}
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-1.5 bg-[#17191e] p-2 rounded-md border border-[#252a31]">
                <button
                  onClick={() => onReorderElement('front')}
                  title="Bring to Front"
                  className="p-2 bg-[#20242a] hover:bg-[#2a2f36] text-[#aeb5bf] hover:text-[#f5f7f8] rounded flex flex-col items-center gap-1 transition"
                >
                  <ChevronsUp className="w-3.5 h-3.5" />
                  <span className="text-[9px]">Front</span>
                </button>
                <button
                  onClick={() => onReorderElement('forward')}
                  title="Bring Forward"
                  className="p-2 bg-[#20242a] hover:bg-[#2a2f36] text-[#aeb5bf] hover:text-[#f5f7f8] rounded flex flex-col items-center gap-1 transition"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span className="text-[9px]">Forward</span>
                </button>
                <button
                  onClick={() => onReorderElement('backward')}
                  title="Send Backward"
                  className="p-2 bg-[#20242a] hover:bg-[#2a2f36] text-[#aeb5bf] hover:text-[#f5f7f8] rounded flex flex-col items-center gap-1 transition"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span className="text-[9px]">Back</span>
                </button>
                <button
                  onClick={() => onReorderElement('back')}
                  title="Send to Back"
                  className="p-2 bg-[#20242a] hover:bg-[#2a2f36] text-[#aeb5bf] hover:text-[#f5f7f8] rounded flex flex-col items-center gap-1 transition"
                >
                  <ChevronsDown className="w-3.5 h-3.5" />
                  <span className="text-[9px]">Bottom</span>
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={onDuplicateElement}
                  className="flex-1 py-2 bg-[#17191e] hover:bg-[#20242a] text-[#f5f7f8] border border-[#252a31] rounded-md flex items-center justify-center gap-1.5 transition font-medium"
                >
                  <Copy className="w-3.5 h-3.5 text-[#18c98a]" />
                  <span>Duplicate</span>
                </button>
                <button
                  onClick={onDeleteElement}
                  className="py-2 px-3 bg-rose-950/30 hover:bg-rose-900/50 text-rose-400 border border-rose-800/40 rounded-md flex items-center justify-center transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Global Artboard & Fabric Dimensions (Map) */
          <>
            <div className="bg-[#17191e] p-3 rounded-lg border border-[#252a31] space-y-3">
              <div className="flex items-center gap-2 text-[#18c98a] font-semibold text-xs">
                <Lock className="w-3.5 h-3.5" />
                <span>Artboard</span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-[#77808c]">Tile size</label>
                  <div className="flex items-center gap-1">
                    {(['cm', 'inch', 'mm'] as PhysicalUnit[]).map((u) => (
                      <button
                        key={u}
                        onClick={() =>
                          setSettings((prev) => ({
                            ...prev,
                            physicalUnit: u,
                            physicalSize:
                              u === 'inch' && prev.physicalUnit === 'cm'
                                ? +(prev.physicalSize / 2.54).toFixed(1)
                                : u === 'cm' && prev.physicalUnit === 'inch'
                                ? +(prev.physicalSize * 2.54).toFixed(1)
                                : prev.physicalSize,
                          }))
                        }
                        className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono transition ${
                          settings.physicalUnit === u
                            ? 'bg-[#18c98a] text-[#071b17] font-bold'
                            : 'bg-[#20242a] text-[#aeb5bf] hover:text-[#f5f7f8]'
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="2"
                    max="100"
                    step="0.5"
                    value={settings.physicalSize}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        physicalSize: Math.min(100, Math.max(2, Number(e.target.value))),
                      }))
                    }
                    className="w-24 bg-[#20242a] text-[#18c98a] font-bold font-mono text-sm px-2.5 py-1.5 rounded border border-[#30363e] focus:border-[#18c98a] focus:outline-none"
                  />
                  <span className="text-[#aeb5bf] font-mono text-xs">
                    × {settings.physicalSize} {settings.physicalUnit}
                  </span>
                </div>
              </div>
            </div>

            {/* Repeat Pattern Alignment Mode */}
            <div className="space-y-2">
              <div className="font-mono text-[11px] text-[#77808c] uppercase tracking-wider font-semibold">
                Repeat
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'grid', label: 'Block Grid', desc: 'Standard 1:1' },
                  { id: 'half-drop', label: 'Half-Drop', desc: 'Vertical 50%' },
                  { id: 'half-brick', label: 'Half-Brick', desc: 'Horiz 50%' },
                ].map((rep) => (
                  <button
                    key={rep.id}
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        repeatType: rep.id as RepeatType,
                      }))
                    }
                    className={`p-2 rounded-md border text-center flex flex-col items-center transition ${
                      settings.repeatType === rep.id
                        ? 'bg-[#18c98a]/20 border-[#18c98a] text-[#18c98a]'
                        : 'bg-[#17191e] border-[#252a31] text-[#aeb5bf] hover:text-[#f5f7f8]'
                    }`}
                  >
                    <span className="font-semibold text-xs">{rep.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Fabric Bolt & Cutting Specifications */}
            <div className="space-y-2">
              <div className="font-mono text-[11px] text-[#77808c] uppercase tracking-wider font-semibold">
                Fabric
              </div>

              <div className="bg-[#17191e] rounded-md p-3 border border-[#252a31] space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] text-[#77808c]">Bolt width</label>
                    <span className="text-[10px] font-mono text-[#18c98a] font-semibold">
                      {settings.fabricBoltWidth} {settings.physicalUnit}
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    {[110, 140, 150].map((w) => (
                      <button
                        key={w}
                        onClick={() =>
                          setSettings((prev) => ({
                            ...prev,
                            fabricBoltWidth: w,
                          }))
                        }
                        className={`flex-1 py-1 rounded text-[10px] font-mono transition ${
                          settings.fabricBoltWidth === w
                            ? 'bg-[#20242a] text-[#18c98a] font-bold border border-[#18c98a]/40'
                            : 'bg-[#101114] text-[#77808c] hover:text-[#f5f7f8]'
                        }`}
                      >
                        {w}{settings.physicalUnit}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-[#252a31]">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] text-[#77808c]">Seam allowance</label>
                    <span className="text-[10px] font-mono text-rose-400 font-semibold">
                      {settings.seamAllowance} {settings.physicalUnit}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={settings.physicalUnit === 'inch' ? 2 : 5}
                    step={settings.physicalUnit === 'inch' ? 0.25 : 0.5}
                    value={Math.min(settings.physicalUnit === 'inch' ? 2 : 5, Math.max(0, settings.seamAllowance))}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        seamAllowance: Math.min(settings.physicalUnit === 'inch' ? 2 : 5, Math.max(0, Number(e.target.value))),
                      }))
                    }
                    style={sliderProgress(settings.seamAllowance, 0, settings.physicalUnit === 'inch' ? 2 : 5)}
                    className="w-full accent-rose-500 cursor-pointer"
                  />
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-[#77808c]">Seam guide</span>
                    <input
                      type="checkbox"
                      checked={settings.showBleedGuide}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          showBleedGuide: e.target.checked,
                        }))
                      }
                      className="accent-[#18c98a] rounded"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-[#252a31]">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] text-[#77808c]">DPI</label>
                    <span className="text-[10px] font-mono text-[#aeb5bf]">
                      {settings.dpi} DPI
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    {[150, 300, 600].map((d) => (
                      <button
                        key={d}
                        onClick={() =>
                          setSettings((prev) => ({
                            ...prev,
                            dpi: d,
                          }))
                        }
                        className={`flex-1 py-1 rounded text-[10px] font-mono transition ${
                          settings.dpi === d
                            ? 'bg-[#18c98a] text-[#071b17] font-bold'
                            : 'bg-[#101114] text-[#77808c] hover:text-[#f5f7f8]'
                        }`}
                      >
                        {d} DPI
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Background Color & Transparency */}
            <div className="space-y-2">
              <div className="font-mono text-[11px] text-[#77808c] uppercase tracking-wider font-semibold">
                Background
              </div>
              <div className="bg-[#17191e] rounded-md p-3 border border-[#252a31] space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-[#77808c]">Transparent</label>
                  <input
                    type="checkbox"
                    checked={settings.backgroundTransparent}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        backgroundTransparent: e.target.checked,
                      }))
                    }
                    className="accent-[#18c98a] rounded"
                  />
                </div>

                {!settings.backgroundTransparent && (
                  <div className="pt-2 border-t border-[#252a31] flex items-center justify-between">
                    <span className="text-[10px] text-[#77808c]">Base color</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={settings.backgroundColor}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            backgroundColor: e.target.value,
                          }))
                        }
                        className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent"
                      />
                      <span className="font-mono text-[10px] text-[#aeb5bf]">
                        {settings.backgroundColor}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
};
