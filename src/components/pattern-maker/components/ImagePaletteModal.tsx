import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  extractPaletteFromImage,
  ExtractedPaletteResult,
  ExtractedColor,
  SAMPLE_INSPIRATION_IMAGES,
} from '../utils/colorExtractor';
import { DesignElement, PatternSettings } from '../types';
import {
  Upload,
  Sparkles,
  Shuffle,
  Check,
  X,
  Pipette,
  Copy,
  Layers,
  Image as ImageIcon,
  Paintbrush,
  RefreshCw,
} from 'lucide-react';

interface ImagePaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  elements: DesignElement[];
  setElements: React.Dispatch<React.SetStateAction<DesignElement[]>>;
  selectedId: string | null;
  selectedIds: string[];
  settings?: PatternSettings;
  setSettings: React.Dispatch<React.SetStateAction<PatternSettings>>;
  onPushHistory: () => void;
  onExtractedPaletteChange?: (palette: string[]) => void;
}

export const ImagePaletteModal: React.FC<ImagePaletteModalProps> = ({
  isOpen,
  onClose,
  elements,
  setElements,
  selectedId,
  selectedIds,
  setSettings,
  onPushHistory,
  onExtractedPaletteChange,
}) => {
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [extractedResult, setExtractedResult] = useState<ExtractedPaletteResult | null>(null);
  const [activeColorIndex, setActiveColorIndex] = useState<number>(0);
  const [copiedHex, setCopiedHex] = useState<string | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determine targeted elements (either multi-selected or single selected)
  const targetElementIds = selectedIds.length > 0 ? selectedIds : selectedId ? [selectedId] : [];
  const selectedCount = targetElementIds.length;

  const showFeedback = (msg: string) => {
    setStatusFeedback(msg);
    setTimeout(() => setStatusFeedback(null), 3500);
  };

  // Process image source and extract palette
  const handleExtractFromSource = useCallback(
    async (source: string | File | Blob) => {
      setIsProcessing(true);
      try {
        if (typeof source === 'string') {
          setImagePreviewUrl(source);
        } else {
          setImagePreviewUrl(URL.createObjectURL(source));
        }

        const result = await extractPaletteFromImage(source, 7);
        setExtractedResult(result);
        setActiveColorIndex(0);
        if (onExtractedPaletteChange) {
          onExtractedPaletteChange(result.hexes);
        }
        showFeedback(`Extracted ${result.colors.length} harmonious colors from image!`);
      } catch (err: any) {
        showFeedback('Could not extract palette: ' + (err?.message || 'Invalid image'));
      } finally {
        setIsProcessing(false);
      }
    },
    [onExtractedPaletteChange]
  );

  // Auto-load default inspiration image on first open if no image yet
  useEffect(() => {
    if (isOpen && !extractedResult && !imagePreviewUrl) {
      void handleExtractFromSource(SAMPLE_INSPIRATION_IMAGES[0].url);
    }
  }, [isOpen, extractedResult, imagePreviewUrl, handleExtractFromSource]);

  if (!isOpen) return null;

  // File Upload handling
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleExtractFromSource(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      void handleExtractFromSource(file);
    }
  };

  // Copy hex to clipboard
  const handleCopyHex = (hex: string) => {
    navigator.clipboard.writeText(hex).then(() => {
      setCopiedHex(hex);
      setTimeout(() => setCopiedHex(null), 1800);
    });
  };

  // 1-Click: Apply active or specific color to selected elements
  const handleApplyColorToSelection = (colorHex: string, mode: 'fill' | 'stroke' = 'fill') => {
    if (targetElementIds.length === 0) {
      showFeedback('Select at least one motif on the canvas to apply this color.');
      return;
    }

    onPushHistory();
    setElements((prev) =>
      prev.map((el) => {
        if (targetElementIds.includes(el.id)) {
          if (mode === 'fill') {
            return { ...el, fill: colorHex };
          } else {
            return {
              ...el,
              stroke: colorHex,
              strokeWidth: el.strokeWidth > 0 ? el.strokeWidth : 3,
            };
          }
        }
        return el;
      })
    );
    showFeedback(`Applied ${colorHex} to ${targetElementIds.length} element${targetElementIds.length > 1 ? 's' : ''}!`);
  };

  // 1-Click: Distribute entire extracted palette across selected elements
  const handleApplyPaletteToSelection = (shuffle: boolean = false) => {
    if (!extractedResult || extractedResult.hexes.length === 0) return;
    if (targetElementIds.length === 0) {
      showFeedback('Please select elements on the canvas to apply palette.');
      return;
    }

    onPushHistory();
    const palette = shuffle
      ? [...extractedResult.hexes].sort(() => Math.random() - 0.5)
      : extractedResult.hexes;

    setElements((prev) =>
      prev.map((el) => {
        if (targetElementIds.includes(el.id)) {
          const index = targetElementIds.indexOf(el.id);
          const assignedColor = palette[index % palette.length];
          return {
            ...el,
            fill: assignedColor,
          };
        }
        return el;
      })
    );

    showFeedback(
      `Distributed ${palette.length} palette colors across ${targetElementIds.length} selected element${
        targetElementIds.length > 1 ? 's' : ''
      }!`
    );
  };

  // 1-Click: Harmonize ALL canvas elements using the extracted palette
  const handleApplyPaletteToAll = (shuffle: boolean = false) => {
    if (!extractedResult || extractedResult.hexes.length === 0) return;
    onPushHistory();

    const palette = shuffle
      ? [...extractedResult.hexes].sort(() => Math.random() - 0.5)
      : extractedResult.hexes;

    setElements((prev) =>
      prev.map((el, i) => ({
        ...el,
        fill: palette[i % palette.length],
      }))
    );

    showFeedback(`Harmonized all ${elements.length} canvas motifs with extracted palette!`);
  };

  // 1-Click: Set canvas background color
  const handleSetCanvasBackground = (bgHex: string) => {
    onPushHistory();
    setSettings((prev) => ({
      ...prev,
      backgroundColor: bgHex,
      backgroundTransparent: false,
    }));
    showFeedback(`Canvas background set to ${bgHex}!`);
  };

  const activeColor = extractedResult?.colors[activeColorIndex] || extractedResult?.colors[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-5 animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-2xl rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] text-foreground shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[var(--card-border)] px-4 py-3 sm:px-5 sm:py-4 bg-[var(--card-bg)]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
              <Pipette className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold flex items-center gap-2">
                Extract Palette from Image
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary border border-primary/30 bg-primary/10 rounded-full px-2 py-0.5">
                  1-Click Apply
                </span>
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Upload any artwork, photo, or moodboard to instantly sample commercial textile palettes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--input-bg)] hover:text-foreground transition"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* Top Section: Upload Area & Image Preview */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-stretch">
            {/* Left: Drag & Drop Upload Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`sm:col-span-6 rounded-xl border-2 border-dashed p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-primary bg-primary/15'
                  : 'border-[var(--card-border)] hover:border-primary/50 bg-[var(--input-bg)]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileInput}
                className="hidden"
              />
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary mb-2">
                <Upload className="h-5 w-5" />
              </div>
              <p className="text-xs font-bold text-foreground">
                Click to upload or drag & drop
              </p>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                PNG, JPG, WebP, SVG (photos, artwork, textures)
              </p>
            </div>

            {/* Right: Active Image Preview & Inspiration Presets */}
            <div className="sm:col-span-6 flex flex-col justify-between rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-[var(--text-secondary)] flex items-center gap-1.5">
                  <ImageIcon className="h-3.5 w-3.5 text-primary" /> Active Image Source
                </span>
                {isProcessing && (
                  <span className="text-[10px] text-primary flex items-center gap-1 font-mono animate-pulse">
                    <RefreshCw className="h-3 w-3 animate-spin" /> Sampling pixels...
                  </span>
                )}
              </div>

              {imagePreviewUrl ? (
                <div className="relative h-24 w-full rounded-lg overflow-hidden border border-white/10 bg-black/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreviewUrl}
                    alt="Active Palette Source"
                    className="w-full h-full object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                </div>
              ) : (
                <div className="h-24 w-full rounded-lg border border-dashed border-[var(--card-border)] flex items-center justify-center text-xs text-[var(--text-muted)]">
                  No image loaded yet
                </div>
              )}

              {/* Quick Inspiration Samples */}
              <div className="mt-2 pt-2 border-t border-[var(--card-border)]">
                <span className="text-[10px] text-[var(--text-muted)] block mb-1">
                  Or pick a sample photo:
                </span>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                  {SAMPLE_INSPIRATION_IMAGES.map((sample) => (
                    <button
                      key={sample.id}
                      onClick={() => handleExtractFromSource(sample.url)}
                      className="px-2 py-1 rounded-md text-[10px] font-semibold border border-[var(--card-border)] hover:border-primary/40 bg-[var(--card-bg)] hover:text-primary transition shrink-0"
                    >
                      {sample.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Palette Swatches Bar */}
          {extractedResult && (
            <div className="space-y-3 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3.5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-foreground flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Extracted Palette ({extractedResult.colors.length} Colors)
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">
                  Click any swatch to apply directly to selection
                </span>
              </div>

              {/* Swatches Row */}
              <div className="grid grid-cols-2 sm:grid-cols-7 gap-2">
                {extractedResult.colors.map((c, index) => {
                  const isActive = activeColorIndex === index;
                  return (
                    <div
                      key={c.hex + index}
                      onClick={() => {
                        setActiveColorIndex(index);
                        handleApplyColorToSelection(c.hex, 'fill');
                      }}
                      className={`group cursor-pointer rounded-xl border p-2 flex flex-col items-center justify-between gap-1.5 transition-all ${
                        isActive
                          ? 'border-primary ring-2 ring-primary/30 bg-primary/10 shadow-md scale-[1.03]'
                          : 'border-[var(--card-border)] bg-[var(--input-bg)] hover:border-primary/40 hover:scale-[1.01]'
                      }`}
                    >
                      {/* Swatch Circle / Pill */}
                      <div
                        className="h-10 w-full rounded-lg shadow-inner border border-white/20 relative flex items-center justify-center"
                        style={{ backgroundColor: c.hex }}
                      >
                        {isActive && (
                          <div className="h-4 w-4 rounded-full bg-white/90 text-black flex items-center justify-center shadow">
                            <Check className="h-3 w-3 stroke-[3]" />
                          </div>
                        )}
                      </div>

                      {/* Hex & Copy */}
                      <div className="flex items-center justify-between w-full px-0.5">
                        <span className="font-mono text-[10px] font-bold text-foreground">
                          {c.hex.toUpperCase()}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyHex(c.hex);
                          }}
                          title="Copy Hex Code"
                          className="text-[var(--text-muted)] hover:text-foreground p-0.5 transition"
                        >
                          {copiedHex === c.hex ? (
                            <Check className="h-3 w-3 text-primary" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>

                      {/* Role Pill */}
                      <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-tight">
                        {c.hex === extractedResult.dominant
                          ? 'Dominant'
                          : c.hex === extractedResult.vibrant
                          ? 'Vibrant'
                          : c.hex === extractedResult.light
                          ? 'Light'
                          : c.hex === extractedResult.dark
                          ? 'Deep'
                          : `${c.population}%`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Apply Control Hub */}
          {extractedResult && (
            <div className="rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div
                    className="h-4 w-4 rounded-full border border-white/30"
                    style={{ backgroundColor: activeColor?.hex || '#ffffff' }}
                  />
                  <span className="text-xs font-bold text-foreground">
                    Active Swatch: <code className="font-mono text-primary">{activeColor?.hex}</code>
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    ({selectedCount > 0 ? `${selectedCount} element${selectedCount > 1 ? 's' : ''} targeted` : 'No element selected'})
                  </span>
                </div>

                {statusFeedback && (
                  <span className="text-xs font-bold text-primary animate-in fade-in flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" /> {statusFeedback}
                  </span>
                )}
              </div>

              {/* Action Buttons Matrix */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {/* 1. Apply to selected elements */}
                <button
                  type="button"
                  onClick={() => handleApplyPaletteToSelection(false)}
                  disabled={selectedCount === 0}
                  className="px-3 py-2.5 rounded-xl bg-primary text-background font-extrabold text-xs shadow hover:bg-primary/90 transition flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Apply to Selection ({selectedCount})</span>
                </button>

                {/* 2. Shuffle across selection */}
                <button
                  type="button"
                  onClick={() => handleApplyPaletteToSelection(true)}
                  disabled={selectedCount === 0}
                  className="px-3 py-2.5 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] hover:border-primary/40 text-foreground font-bold text-xs hover:text-primary transition flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Shuffle className="h-3.5 w-3.5" />
                  <span>Shuffle on Selection</span>
                </button>

                {/* 3. Apply active color as stroke / outline */}
                <button
                  type="button"
                  onClick={() => activeColor && handleApplyColorToSelection(activeColor.hex, 'stroke')}
                  disabled={selectedCount === 0 || !activeColor}
                  className="px-3 py-2.5 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] hover:border-primary/40 text-foreground font-bold text-xs hover:text-primary transition flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Paintbrush className="h-3.5 w-3.5" />
                  <span>Apply as Stroke</span>
                </button>

                {/* 4. Set as canvas background */}
                <button
                  type="button"
                  onClick={() =>
                    handleSetCanvasBackground(
                      activeColor?.hex || extractedResult.suggestedBackground
                    )
                  }
                  className="px-3 py-2.5 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] hover:border-primary/40 text-foreground font-bold text-xs hover:text-primary transition flex items-center justify-center gap-1.5"
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>Set as Background</span>
                </button>
              </div>

              {/* Whole-Pattern Harmonizer Shortcut */}
              <div className="pt-2 border-t border-[var(--card-border)] flex items-center justify-between text-xs">
                <span className="text-[11px] text-[var(--text-muted)]">
                  Want to colorize all motifs at once?
                </span>
                <button
                  type="button"
                  onClick={() => handleApplyPaletteToAll(false)}
                  className="text-primary hover:underline font-bold text-xs flex items-center gap-1"
                >
                  <Sparkles className="h-3 w-3" /> Apply to All {elements.length} Motifs
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-[var(--card-border)] px-4 py-3 sm:px-5 bg-[var(--input-bg)] flex justify-between items-center text-xs">
          <span className="text-[11px] text-[var(--text-muted)]">
            Tip: Press Ctrl+Z on the artboard anytime to undo color changes.
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-primary text-background font-bold hover:bg-primary/90 transition shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
