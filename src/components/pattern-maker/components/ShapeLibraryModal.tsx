import React, { useState } from 'react';
import { SHAPE_PRESETS, ShapePreset, STARTER_TEMPLATES, PatternTemplate } from '../utils/shapeLibrary';
import { DesignElement } from '../types';
import { X, Search, Shapes, Sparkles, Code2, LayoutGrid, Layers } from 'lucide-react';

interface ShapeLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectShape: (preset: ShapePreset, initialFill: string, placeAtEdge?: boolean) => void;
  onAddCustomSvgPath: (path: string, fill: string) => void;
  onLoadPatternPreset?: (elements: DesignElement[], backgroundColor?: string) => void;
}

export const ShapeLibraryModal: React.FC<ShapeLibraryModalProps> = ({
  isOpen,
  onClose,
  onSelectShape,
  onAddCustomSvgPath,
  onLoadPatternPreset,
}) => {
  const [modalTab, setModalTab] = useState<'presets' | 'motifs' | 'custom'>('presets');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [presetCategory, setPresetCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedColor, setSelectedColor] = useState('#2d6a4f');
  const [customSvgD, setCustomSvgD] = useState('');

  if (!isOpen) return null;

  const shapeCategories = ['All', 'Botanical', 'Ornate', 'Whimsical', 'Geometric'];
  const presetCategories = ['All', 'Floral', 'Geometric', 'Minimalist', 'Boho', 'Whimsical'];

  const filteredPresets = STARTER_TEMPLATES.filter((p) => {
    const matchesCat = presetCategory === 'All' || p.category === presetCategory;
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const filteredShapes = SHAPE_PRESETS.filter((p) => {
    const matchesCat = activeCategory === 'All' || p.category === activeCategory;
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.kind.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleInsertCustomSvg = () => {
    if (!customSvgD.trim()) return;
    onAddCustomSvgPath(customSvgD.trim(), selectedColor);
    setCustomSvgD('');
    onClose();
  };

  const handleApplyPreset = (preset: PatternTemplate) => {
    if (onLoadPatternPreset) {
      onLoadPatternPreset(preset.elements, preset.backgroundColor);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-[#07080a]/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 select-none">
      <div className="bg-[#101114] border border-[#252a31] rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-[#252a31] flex items-center justify-between bg-[#0e1013]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#18c98a]/15 text-[#18c98a] flex items-center justify-center border border-[#18c98a]/30 shadow-sm">
              <Shapes className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-[#f5f7f8] flex items-center gap-2">
                Motifs & Pattern Preset Library
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#18c98a]/20 text-[#18c98a] font-semibold">
                  New
                </span>
              </h2>
              <p className="text-[11px] text-[#aeb5bf]">
                Quickly load pre-designed arrangements (Floral, Geometric, Minimalist) or insert individual vector motifs.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#17191e] text-[#77808c] hover:text-[#f5f7f8] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Primary View Selector Tabs */}
        <div className="px-4 pt-3 pb-2 border-b border-[#252a31] flex flex-wrap items-center justify-between gap-3 bg-[#0b0c0e]">
          <div className="flex items-center gap-1.5 bg-[#17191e] p-1 rounded-xl border border-[#252a31]">
            <button
              onClick={() => {
                setModalTab('presets');
                setSearchQuery('');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                modalTab === 'presets'
                  ? 'bg-[#18c98a] text-[#071b17] shadow-sm'
                  : 'text-[#aeb5bf] hover:text-[#f5f7f8] hover:bg-[#20242a]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Pattern Presets ({STARTER_TEMPLATES.length})</span>
            </button>
            <button
              onClick={() => {
                setModalTab('motifs');
                setSearchQuery('');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                modalTab === 'motifs'
                  ? 'bg-[#18c98a] text-[#071b17] shadow-sm'
                  : 'text-[#aeb5bf] hover:text-[#f5f7f8] hover:bg-[#20242a]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Single Motifs ({SHAPE_PRESETS.length})</span>
            </button>
            <button
              onClick={() => {
                setModalTab('custom');
                setSearchQuery('');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                modalTab === 'custom'
                  ? 'bg-[#18c98a] text-[#071b17] shadow-sm'
                  : 'text-[#aeb5bf] hover:text-[#f5f7f8] hover:bg-[#20242a]'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Custom SVG</span>
            </button>
          </div>

          {modalTab === 'motifs' && (
            <div className="flex items-center gap-2 bg-[#17191e] px-2.5 py-1 rounded-lg border border-[#252a31] text-xs">
              <span className="text-[#77808c] text-[11px]">Motif Color:</span>
              <input
                type="color"
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value)}
                className="w-5 h-5 rounded cursor-pointer border-0 p-0 bg-transparent"
              />
            </div>
          )}
        </div>

        {/* Categories Bar & Search Filter */}
        {modalTab !== 'custom' && (
          <div className="px-4 py-2.5 border-b border-[#252a31] space-y-2.5 bg-[#0e1013]">
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
              <div className="flex items-center gap-1">
                {(modalTab === 'presets' ? presetCategories : shapeCategories).map((cat) => {
                  const isActive = (modalTab === 'presets' ? presetCategory : activeCategory) === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => {
                        if (modalTab === 'presets') setPresetCategory(cat);
                        else setActiveCategory(cat);
                      }}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition whitespace-nowrap ${
                        isActive
                          ? 'bg-[#18c98a]/20 text-[#18c98a] border border-[#18c98a]/40 font-semibold'
                          : 'text-[#8b94a0] hover:text-[#f5f7f8] hover:bg-[#1a1d23]'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-[#77808c] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={
                  modalTab === 'presets'
                    ? 'Search pattern presets (e.g. Floral, Geometric, Minimalist, Bauhaus, Zen)...'
                    : 'Search motifs (e.g. monstera, paisley, leaf, flower, star)...'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#14161b] text-[#f5f7f8] pl-9 pr-3 py-1.5 rounded-lg text-xs border border-[#252a31] focus:border-[#18c98a] focus:outline-none placeholder:text-[#636c78]"
              />
            </div>
          </div>
        )}

        {/* Modal Content Body */}
        <div className="p-4 overflow-y-auto flex-1 bg-[#101114]">
          {modalTab === 'presets' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredPresets.map((preset) => (
                  <div
                    key={preset.id}
                    className="group bg-[#15171d] hover:bg-[#1b1e25] border border-[#232830] hover:border-[#18c98a]/60 rounded-xl p-3 flex flex-col justify-between transition-all shadow-md hover:shadow-xl"
                  >
                    {/* SVG Arrangement Preview */}
                    <div
                      className="w-full aspect-square rounded-lg overflow-hidden border border-[#282e38] relative flex items-center justify-center p-2 mb-2.5 transition-transform group-hover:scale-[1.01]"
                      style={{ backgroundColor: preset.backgroundColor }}
                    >
                      <svg
                        viewBox="0 0 500 500"
                        className="w-full h-full drop-shadow-sm pointer-events-none"
                      >
                        {preset.elements.map((el) => {
                          const shapeDef = SHAPE_PRESETS.find((s) => s.kind === el.shapeKind);
                          const pathData = el.pathData || shapeDef?.path || '';
                          const vb = shapeDef?.viewBox || '0 0 100 100';

                          return (
                            <g
                              key={el.id}
                              transform={`translate(${el.x}, ${el.y}) rotate(${el.rotation}) scale(${el.scaleX}, ${el.scaleY})`}
                            >
                              <svg
                                x={-el.width / 2}
                                y={-el.height / 2}
                                width={el.width}
                                height={el.height}
                                viewBox={vb}
                                overflow="visible"
                              >
                                <path
                                  d={pathData}
                                  fill={el.fill}
                                  stroke={el.stroke || 'none'}
                                  strokeWidth={el.strokeWidth || 0}
                                  opacity={el.opacity ?? 1}
                                />
                              </svg>
                            </g>
                          );
                        })}
                      </svg>
                    </div>

                    {/* Metadata */}
                    <div className="space-y-1 mb-3">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-xs text-[#f5f7f8] truncate">
                          {preset.name}
                        </span>
                        <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-[#18c98a]/15 text-[#18c98a] border border-[#18c98a]/30 shrink-0">
                          {preset.category}
                        </span>
                      </div>
                      <p className="text-[10.5px] text-[#8e98a5] line-clamp-2 leading-relaxed">
                        {preset.description}
                      </p>
                    </div>

                    {/* Action & Info */}
                    <div className="flex items-center justify-between pt-2 border-t border-[#232830]">
                      <div className="flex items-center gap-1.5 text-[10px] text-[#717b88]">
                        <div
                          className="w-3.5 h-3.5 rounded-full border border-white/20"
                          style={{ backgroundColor: preset.backgroundColor }}
                          title={`Canvas background: ${preset.backgroundColor}`}
                        />
                        <span>{preset.elements.length} elements</span>
                      </div>

                      <button
                        onClick={() => handleApplyPreset(preset)}
                        className="py-1.5 px-3 bg-[#18c98a] hover:bg-[#14b179] text-[#071b17] font-bold text-[11px] rounded-lg transition-colors flex items-center gap-1 shadow"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Load Pattern</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {filteredPresets.length === 0 && (
                <div className="text-center py-12 text-[#77808c] space-y-1">
                  <p className="text-sm font-semibold">No pattern presets found</p>
                  <p className="text-xs">Try selecting &apos;All&apos; or a different category</p>
                </div>
              )}
            </div>
          )}

          {modalTab === 'motifs' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {filteredShapes.map((preset) => (
                <div
                  key={preset.kind}
                  className="group relative bg-[#17191e] hover:bg-[#20242a] border border-[#252a31] hover:border-[#18c98a]/50 rounded-xl p-3 flex flex-col items-center justify-between transition cursor-pointer shadow-sm"
                  onClick={() => {
                    onSelectShape(preset, selectedColor, false);
                    onClose();
                  }}
                >
                  <div className="w-16 h-16 flex items-center justify-center my-2">
                    <svg
                      viewBox={preset.viewBox}
                      className="w-full h-full drop-shadow transition-transform group-hover:scale-110"
                    >
                      <path
                        d={preset.path}
                        fill={selectedColor || preset.defaultFill}
                        stroke={preset.defaultStroke || 'none'}
                        strokeWidth={preset.defaultStrokeWidth || 0}
                      />
                    </svg>
                  </div>

                  <span className="font-semibold text-[11px] text-[#f5f7f8] text-center truncate w-full">
                    {preset.name}
                  </span>

                  <span className="text-[9px] text-[#77808c] uppercase font-mono mt-0.5">
                    {preset.category}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectShape(preset, selectedColor, true);
                      onClose();
                    }}
                    title="Place on Artboard Edge (Test seamless wrap instantly)"
                    className="mt-2 w-full py-1 bg-[#20242a] group-hover:bg-[#18c98a]/20 text-[#aeb5bf] group-hover:text-[#18c98a] rounded text-[10px] flex items-center justify-center gap-1 transition"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Place on Edge</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          {modalTab === 'custom' && (
            <div className="space-y-4 max-w-lg mx-auto py-2">
              <div>
                <label className="text-xs font-semibold text-[#aeb5bf] block mb-1">
                  Paste Raw SVG Path Data (d attribute)
                </label>
                <textarea
                  rows={6}
                  value={customSvgD}
                  onChange={(e) => setCustomSvgD(e.target.value)}
                  placeholder='e.g. M10 80 Q 52.5 10, 95 80 T 180 80 or any vector path data...'
                  className="w-full bg-[#0b0c0e] text-[#f5f7f8] font-mono text-xs p-3 rounded-lg border border-[#252a31] focus:border-[#18c98a] focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-[#8e98a5]">Fill Color:</span>
                <input
                  type="color"
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  className="w-7 h-7 rounded cursor-pointer border border-[#252a31] p-0 bg-transparent"
                />
                <span className="text-xs font-mono text-[#aeb5bf]">{selectedColor}</span>
              </div>

              <button
                onClick={handleInsertCustomSvg}
                disabled={!customSvgD.trim()}
                className="w-full py-2.5 bg-[#18c98a] hover:bg-[#14b179] disabled:opacity-40 text-[#071b17] font-bold text-xs rounded-lg shadow transition"
              >
                Insert Custom SVG Motif
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
