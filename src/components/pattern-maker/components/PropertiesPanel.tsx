import React from 'react';
import {
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
} from 'lucide-react';
import { isElementCrossingEdge } from '../utils/seamlessMath';

interface PropertiesPanelProps {
  selectedElement: DesignElement | null;
  onUpdateElement: (updated: Partial<DesignElement>) => void;
  onDuplicateElement: () => void;
  onDeleteElement: () => void;
  onReorderElement: (direction: 'front' | 'back' | 'forward' | 'backward') => void;
  settings: PatternSettings;
  setSettings: React.Dispatch<React.SetStateAction<PatternSettings>>;
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

function sliderProgress(value: number, minimum: number, maximum: number): React.CSSProperties {
  const percentage = ((value - minimum) / (maximum - minimum)) * 100;
  return { '--range-progress': `${Math.max(0, Math.min(100, percentage))}%` } as React.CSSProperties;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedElement,
  onUpdateElement,
  onDuplicateElement,
  onDeleteElement,
  onReorderElement,
  settings,
  setSettings,
}) => {
  const crossing = selectedElement
    ? isElementCrossingEdge(selectedElement, settings.artboardSize)
    : null;
  const isCrossingAny = crossing && (crossing.left || crossing.right || crossing.top || crossing.bottom);

  return (
    <aside className="flex h-full w-[clamp(260px,22vw,320px)] max-w-[30vw] shrink-0 flex-col overflow-y-auto border-r border-[var(--card-border)] bg-[var(--card-bg)] text-xs text-foreground select-none">
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
            {selectedElement.name || selectedElement.type}
          </span>
        )}
      </div>

      <div className="p-3.5 space-y-5">
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
              </div>
            </div>

            {/* Layer Hierarchy & Actions */}
            <div className="space-y-2">
              <div className="font-mono text-[11px] text-[#77808c] uppercase tracking-wider font-semibold">
                Layers
              </div>
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
