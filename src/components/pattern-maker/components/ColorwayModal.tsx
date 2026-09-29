import React, { useState } from 'react';
import { COLORWAY_THEMES, ColorwayTheme, applyColorway } from '../utils/colorwayThemes';
import { DesignElement, PatternSettings } from '../types';
import { Palette, Sparkles, Shuffle, Check, X } from 'lucide-react';

interface ColorwayModalProps {
  isOpen: boolean;
  onClose: () => void;
  elements: DesignElement[];
  setElements: React.Dispatch<React.SetStateAction<DesignElement[]>>;
  settings: PatternSettings;
  setSettings: React.Dispatch<React.SetStateAction<PatternSettings>>;
  onPushHistory: () => void;
}

export const ColorwayModal: React.FC<ColorwayModalProps> = ({
  isOpen,
  onClose,
  elements,
  setElements,
  settings,
  setSettings,
  onPushHistory,
}) => {
  const [selectedThemeId, setSelectedThemeId] = useState<string>(COLORWAY_THEMES[0].id);

  if (!isOpen) return null;

  const handleApply = (theme: ColorwayTheme, shuffle: boolean = false) => {
    onPushHistory();
    const { updatedElements, newBg } = applyColorway(elements, theme, shuffle);
    setElements(updatedElements);
    setSettings((prev) => ({
      ...prev,
      backgroundColor: newBg,
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] text-foreground shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[var(--card-border)] p-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Palette className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold flex items-center gap-2">
                Colorway Studio & Palette Harmonizer
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary border border-primary/30 bg-primary/10 rounded-full px-2 py-0.5">
                  Pro
                </span>
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Instant commercial textile color schemes for Spoonflower, Printful & Microstock
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

        {/* Modal Content */}
        <div className="p-4 space-y-3.5 overflow-y-auto flex-1">
          <p className="text-xs text-[var(--text-secondary)]">
            Select a designer textile colorway to automatically re-harmonize all motifs and the background while preserving vector fidelity.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {COLORWAY_THEMES.map((theme) => {
              const isSelected = selectedThemeId === theme.id;
              return (
                <div
                  key={theme.id}
                  onClick={() => setSelectedThemeId(theme.id)}
                  className={`cursor-pointer rounded-xl border p-3 transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/10 shadow-sm'
                      : 'border-[var(--card-border)] bg-[var(--input-bg)] hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      {theme.name}
                      {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                    </span>
                  </div>

                  {/* Swatches preview */}
                  <div className="flex items-center gap-1.5 mb-2">
                    <span
                      className="h-6 w-6 rounded-md border border-white/20 shrink-0 shadow-inner"
                      style={{ backgroundColor: theme.backgroundColor }}
                      title={`Background: ${theme.backgroundColor}`}
                    />
                    <div className="h-4 w-px bg-[var(--card-border)] mx-0.5" />
                    {theme.colors.map((c, i) => (
                      <span
                        key={i}
                        className="h-6 flex-1 rounded-md border border-white/10 shadow-sm"
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    ))}
                  </div>

                  <p className="text-[11px] text-[var(--text-muted)] leading-tight truncate">
                    {theme.description}
                  </p>

                  <div className="mt-2.5 flex items-center gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApply(theme, false);
                      }}
                      className="flex-1 py-1.5 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary text-[11px] font-bold transition flex items-center justify-center gap-1"
                    >
                      <Sparkles className="h-3 w-3" /> Apply
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApply(theme, true);
                      }}
                      title="Shuffle color assignment"
                      className="px-2.5 py-1.5 rounded-lg border border-[var(--card-border)] hover:bg-[var(--card-bg)] text-[var(--text-secondary)] hover:text-foreground text-[11px] font-bold transition flex items-center justify-center gap-1"
                    >
                      <Shuffle className="h-3 w-3" /> Shuffle
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="border-t border-[var(--card-border)] p-3.5 bg-[var(--input-bg)] flex justify-between items-center text-xs">
          <span className="text-[11px] text-[var(--text-muted)]">
            Tip: Press Ctrl+Z at any time to undo colorway changes.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-primary text-background font-bold hover:bg-primary/90 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
