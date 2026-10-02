import React, { useState, useEffect, useRef } from 'react';
import {
  ActiveTab,
  PatternSettings,
  DesignElement,
} from '../types';
import {
  exportHighResTile,
  exportTiledFabric,
  exportFabricSpecSheet,
  generateTileSvg,
  triggerDownload,
} from '../utils/exportUtils';
import {
  Download,
  RotateCcw,
  RotateCw,
  HelpCircle,
  ChevronDown,
  ArrowLeft,
  Palette,
  Shuffle,
  Pipette,
} from 'lucide-react';
import Link from 'next/link';
import ThemedSelect from '@/components/ui/ThemedSelect';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  elements: DesignElement[];
  settings: PatternSettings;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpenHelp: () => void;
  onOpenColorways: () => void;
  onOpenImagePalette?: () => void;
  onScatterMotifs: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  elements,
  settings,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenHelp,
  onOpenColorways,
  onScatterMotifs,
}) => {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync theme with mcumetadata convention
  useEffect(() => {
    try {
      const stored = localStorage.getItem('mcustock_theme') || 'dark';
      const isDark = stored === 'dark';
      if (isDark) {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
      }
    } catch {
      document.documentElement.classList.add('dark');
    }
  }, []);

  const handleExportSvg = () => {
    const svgString = generateTileSvg(elements, settings);
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, `seamless-tile-${settings.physicalSize}${settings.physicalUnit}.svg`);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  return (
    <header className="pattern-maker-header relative z-30 mx-3 mt-3 flex h-16 min-h-14 min-w-0 shrink-0 flex-row items-center gap-2.5 overflow-x-auto overflow-y-hidden rounded-[20px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 text-foreground shadow-2xl select-none sm:gap-4 sm:px-4">
      <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
        <div className="flex min-w-0 shrink-0 items-center gap-2">
        <Link href="/dashboard" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--card-border)] bg-[var(--input-bg)] text-[var(--text-secondary)] transition-all hover:text-primary" aria-label="Back to dashboard">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Textile Studio</p>
          <h1 className="flex flex-wrap items-center gap-x-2 text-xl font-extrabold leading-tight text-foreground sm:text-2xl">
            Pattern Maker
            <span className="hidden rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase text-primary sm:inline">300 DPI PRO</span>
          </h1>
        </div>
      </div>

        <div className="flex shrink-0 items-center gap-1.5">
        <button
          onClick={onOpenColorways}
          title="Open Colorway Studio & Palette Harmonizer"
          className="flex h-9 items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 text-xs font-bold text-primary hover:bg-primary/20 transition shadow-sm"
        >
          <Palette className="w-3.5 h-3.5 text-primary" />
          <span className="hidden sm:inline">Colorways</span>
        </button>

        {onOpenImagePalette && (
          <button
            onClick={onOpenImagePalette}
            title="Extract Color Palette from an uploaded image"
            className="flex h-9 items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/15 px-3 text-xs font-bold text-primary hover:bg-primary/25 transition shadow-sm"
          >
            <Pipette className="w-3.5 h-3.5 text-primary" />
            <span className="hidden sm:inline">Image Palette</span>
          </button>
        )}

        {/* Smart Auto-Scatter Motifs */}
        <button
          onClick={onScatterMotifs}
          title="Smart Auto-Scatter motifs seamlessly across the canvas"
          className="flex h-9 items-center gap-1.5 rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] px-3 text-xs font-bold text-[var(--text-secondary)] hover:text-foreground hover:bg-primary/15 hover:border-primary/30 transition"
        >
          <Shuffle className="w-3.5 h-3.5 text-primary" />
          <span className="hidden sm:inline">Auto-Scatter</span>
        </button>
      </div>
      </div>

      <div className="flex min-w-0 shrink-0 items-center gap-1.5">
      <ThemedSelect
        value={activeTab}
        onChange={(value) => setActiveTab(value as ActiveTab)}
        ariaLabel="Workspace view"
        portalMenu
        className="w-[126px] shrink-0 sm:w-[158px]"
        options={[
          { value: 'artboard', label: 'Artboard' },
          { value: 'tiling', label: 'Real-Time Tiling' },
          { value: 'mockups', label: 'Mockups' },
        ]}
      />

      {/* Action Controls: Undo/Redo, Help & Export */}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <div className="flex items-center gap-1 rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] p-0.5">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
            className="rounded-lg p-1 sm:p-1.5 hover:bg-[var(--card-bg)] text-[var(--text-secondary)] disabled:opacity-30 disabled:pointer-events-none transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            aria-label="Redo"
            className="rounded-lg p-1 sm:p-1.5 hover:bg-[var(--card-bg)] text-[var(--text-secondary)] disabled:opacity-30 disabled:pointer-events-none transition"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          onClick={onOpenHelp}
          title="Edge Wrapping & Math Guide"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] text-[var(--text-secondary)] transition-all hover:bg-primary/15 hover:text-primary"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* Export Dropdown */}
        <div ref={exportMenuRef} className="pattern-maker-export-anchor relative">
          <button
            id="btn-export-dropdown"
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-bold text-background shadow-md transition-all hover:bg-primary/90 active:scale-[0.98]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
            <ChevronDown className="w-3 h-3" />
          </button>

          {showExportMenu && (
            <div className="pattern-maker-export-menu absolute right-0 mt-1 w-64 rounded-xl shadow-2xl border border-[var(--card-border)] bg-[var(--card-bg)] py-1.5 z-50">
              <div className="px-3 py-1 text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-bold font-mono">
                Tile Outputs (300 DPI)
              </div>
              <button
                onClick={() => {
                  void exportHighResTile(elements, settings, 3);
                  setShowExportMenu(false);
                }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--input-bg)] text-foreground flex flex-col transition"
              >
                <span className="font-semibold text-foreground">1:1 Seamless Tile (PNG 1500px)</span>
                <span className="text-[11px] text-[var(--text-secondary)]">High-res for digital textile printing</span>
              </button>

              <button
                onClick={handleExportSvg}
                className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--input-bg)] text-foreground flex flex-col transition"
              >
                <span className="font-semibold text-foreground">Vector SVG Seamless Tile</span>
                <span className="text-[11px] text-[var(--text-secondary)]">Pure scalable vectors with auto edge clip</span>
              </button>

              <div className="border-t border-[var(--card-border)] my-1" />
              <div className="px-3 py-1 text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-bold font-mono">
                Production Sheets
              </div>

              <button
                onClick={() => {
                  void exportFabricSpecSheet(elements, settings);
                  setShowExportMenu(false);
                }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--input-bg)] text-primary flex flex-col transition"
              >
                <span className="font-semibold">Fabric Cutting Spec Sheet</span>
                <span className="text-[11px] text-[var(--text-secondary)]">
                  Full blueprint with cm/inch repeat, seam allowance & bolt yield
                </span>
              </button>

              <button
                onClick={() => {
                  void exportTiledFabric(elements, settings, 4, 4);
                  setShowExportMenu(false);
                }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--input-bg)] text-foreground flex flex-col transition"
              >
                <span className="font-semibold text-foreground">4×4 Continuous Fabric Sheet</span>
                <span className="text-[11px] text-[var(--text-secondary)]">Simulated repeat bolt ready to print</span>
              </button>
            </div>
          )}
        </div>
      </div>
      </div>
    </header>
  );
};
