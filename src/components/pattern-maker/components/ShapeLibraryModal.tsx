import React, { useState } from 'react';
import { SHAPE_PRESETS, ShapePreset } from '../utils/shapeLibrary';
import { DesignElement, ShapeKind } from '../types';
import { X, Search, Shapes, Plus, Sparkles, Code2 } from 'lucide-react';

interface ShapeLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectShape: (preset: ShapePreset, initialFill: string, placeAtEdge?: boolean) => void;
  onAddCustomSvgPath: (path: string, fill: string) => void;
}

export const ShapeLibraryModal: React.FC<ShapeLibraryModalProps> = ({
  isOpen,
  onClose,
  onSelectShape,
  onAddCustomSvgPath,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedColor, setSelectedColor] = useState('#2d6a4f');
  const [customSvgD, setCustomSvgD] = useState('');
  const [showSvgTab, setShowSvgTab] = useState(false);

  if (!isOpen) return null;

  const categories = ['All', 'Botanical', 'Ornate', 'Whimsical', 'Geometric'];

  const filtered = SHAPE_PRESETS.filter((p) => {
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

  return (
    <div className="fixed inset-0 bg-[#07080a]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-[#101114] border border-[#252a31] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-[#252a31] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#18c98a]/15 text-[#18c98a] flex items-center justify-center border border-[#18c98a]/30">
              <Shapes className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-[#f5f7f8]">
                Vector Motif & Shape Library
              </h2>
              <p className="text-[11px] text-[#aeb5bf]">
                Click any motif to insert into the 1:1 Artboard. Drag over edges to test auto-wrapping!
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

        {/* Categories & Search */}
        <div className="p-4 border-b border-[#252a31] space-y-3 bg-[#0b0c0e]">
          <div className="flex items-center justify-between gap-3">
            {/* Category tabs */}
            <div className="flex items-center gap-1 overflow-x-auto">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setActiveCategory(cat);
                    setShowSvgTab(false);
                  }}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                    activeCategory === cat && !showSvgTab
                      ? 'bg-[#18c98a] text-[#071b17] font-bold'
                      : 'text-[#aeb5bf] hover:text-[#f5f7f8] hover:bg-[#17191e]'
                  }`}
                >
                  {cat}
                </button>
              ))}

              <button
                onClick={() => setShowSvgTab(true)}
                className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition ${
                  showSvgTab
                    ? 'bg-[#18c98a] text-[#071b17] font-bold'
                    : 'text-[#aeb5bf] hover:text-[#f5f7f8] hover:bg-[#17191e]'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Custom SVG</span>
              </button>
            </div>

            {/* Quick Color Picker for newly added motif */}
            <div className="flex items-center gap-2 bg-[#17191e] px-2.5 py-1 rounded-md border border-[#252a31] text-xs">
              <span className="text-[#77808c] text-[11px]">Color:</span>
              <input
                type="color"
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value)}
                className="w-5 h-5 rounded cursor-pointer border-0 p-0 bg-transparent"
              />
            </div>
          </div>

          {!showSvgTab && (
            <div className="relative">
              <Search className="w-4 h-4 text-[#77808c] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search motifs (e.g. monstera, paisley, leaf, flower, star)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#101114] text-[#f5f7f8] pl-9 pr-3 py-2 rounded-lg text-xs border border-[#252a31] focus:border-[#18c98a] focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Motifs Grid or Custom SVG input */}
        <div className="p-4 overflow-y-auto flex-1 bg-[#101114]">
          {showSvgTab ? (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-[#aeb5bf] block mb-1">
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
              <button
                onClick={handleInsertCustomSvg}
                disabled={!customSvgD.trim()}
                className="w-full py-2.5 bg-[#18c98a] hover:bg-[#14b179] disabled:opacity-40 text-[#071b17] font-bold text-xs rounded-lg shadow transition"
              >
                Insert Custom SVG Motif
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {filtered.map((preset) => (
                <div
                  key={preset.kind}
                  className="group relative bg-[#17191e] hover:bg-[#20242a] border border-[#252a31] hover:border-[#18c98a]/50 rounded-xl p-3 flex flex-col items-center justify-between transition cursor-pointer shadow-sm"
                  onClick={() => {
                    onSelectShape(preset, selectedColor, false);
                    onClose();
                  }}
                >
                  {/* SVG Shape Preview */}
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

                  {/* Quick edge wrap test button on hover */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectShape(preset, selectedColor, true); // place directly over artboard right edge!
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
        </div>
      </div>
    </div>
  );
};
