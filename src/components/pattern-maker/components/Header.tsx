import React, { useState, useEffect } from 'react';
import {
  ActiveTab,
  PatternSettings,
  DesignElement,
} from '../types';
import { STARTER_TEMPLATES } from '../utils/shapeLibrary';
import {
  exportHighResTile,
  exportTiledFabric,
  exportFabricSpecSheet,
  generateTileSvg,
  triggerDownload,
} from '../utils/exportUtils';
import {
  LayoutGrid,
  Scissors,
  Shirt,
  Download,
  RotateCcw,
  RotateCw,
  HelpCircle,
  Layers,
  Sparkles,
  ChevronDown,
  Sun,
  Moon,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  elements: DesignElement[];
  setElements: (elements: DesignElement[]) => void;
  settings: PatternSettings;
  setSettings: React.Dispatch<React.SetStateAction<PatternSettings>>;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpenHelp: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  elements,
  setElements,
  settings,
  setSettings,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenHelp,
}) => {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === 'undefined') return true;
    return (localStorage.getItem('mcustock_theme') || 'dark') === 'dark';
  });

  // Sync theme with mcumetadata.vercel.app convention ('mcustock_theme')
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

  const toggleTheme = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    const themeStr = nextDark ? 'dark' : 'light';
    try {
      localStorage.setItem('mcustock_theme', themeStr);
    } catch {}
    if (nextDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  };

  const handleLoadTemplate = (templateId: string) => {
    const template = STARTER_TEMPLATES.find((t) => t.id === templateId);
    if (template) {
      setElements(JSON.parse(JSON.stringify(template.elements)));
      setSettings((prev) => ({
        ...prev,
        backgroundColor: template.backgroundColor,
      }));
      setShowTemplateMenu(false);
    }
  };

  const handleExportSvg = () => {
    const svgString = generateTileSvg(elements, settings);
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, `seamless-tile-${settings.physicalSize}${settings.physicalUnit}.svg`);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  return (
    <header className="relative z-30 mx-3 mt-3 flex min-h-16 min-w-0 shrink-0 flex-wrap items-center justify-between gap-3 overflow-visible rounded-[24px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3.5 py-3 text-foreground shadow-2xl backdrop-blur-md select-none sm:px-4">
      <div className="flex min-w-0 shrink items-center gap-3">
        <Link href="/dashboard" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--card-border)] bg-[var(--input-bg)] text-[var(--text-secondary)] transition-all hover:text-primary" aria-label="Back to dashboard">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">Textile Studio</p>
          <h1 className="flex items-center gap-2 truncate text-lg font-extrabold">
            Pattern Maker <span className="text-primary">Fabric Engine</span>
            <span className="hidden rounded-full border border-primary/30 bg-primary/15 px-2 py-0.5 font-mono text-[10px] uppercase text-primary sm:inline">300 DPI PRO</span>
          </h1>
        </div>
      </div>

      {/* Template Quick Switcher. Branding lives in the dashboard shell above. */}
      <div className="relative min-w-0 shrink-0">
          <button
            id="btn-templates"
            onClick={() => setShowTemplateMenu(!showTemplateMenu)}
            className="flex h-11 items-center gap-1.5 rounded-2xl border border-[var(--card-border)] bg-[var(--input-bg)] px-3 text-xs font-bold text-[var(--text-secondary)] transition-all hover:bg-primary/15 hover:text-primary"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#18c98a]" />
            <span className="hidden md:inline text-[#77808c]">Preset:</span>
            <span className="font-medium text-[#f5f7f8]">Templates</span>
            <ChevronDown className="w-3 h-3 text-[#77808c]" />
          </button>

          {showTemplateMenu && (
            <div className="absolute left-0 mt-1 w-64 bg-[#17191e] rounded-lg shadow-2xl border border-[#252a31] py-1.5 z-50">
              <div className="px-3 py-1 text-[11px] uppercase tracking-wider text-[#77808c] font-bold font-mono">
                Seamless Design Presets
              </div>
              {STARTER_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => handleLoadTemplate(tmpl.id)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-[#20242a] text-[#f5f7f8] flex flex-col transition"
                >
                  <span className="font-semibold text-[#18c98a]">{tmpl.name}</span>
                  <span className="text-[11px] text-[#77808c] truncate">
                    {tmpl.description}
                  </span>
                </button>
              ))}
              <div className="border-t border-[#252a31] my-1" />
              <button
                onClick={() => {
                  setElements([]);
                  setShowTemplateMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-rose-400 hover:bg-[#20242a] transition"
              >
                Clear to Blank Canvas
              </button>
            </div>
          )}
        </div>

      {/* Navigation View Tabs */}
      <div className="hidden shrink-0 items-center rounded-2xl border border-[var(--card-border)] bg-[var(--input-bg)] p-0.5 shadow-inner md:flex">
        <button
          id="tab-artboard"
          onClick={() => setActiveTab('artboard')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
            activeTab === 'artboard'
              ? 'bg-primary text-background shadow-sm'
              : 'text-[var(--text-secondary)] hover:bg-primary/15 hover:text-primary'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>1:1 Artboard</span>
        </button>

        <button
          id="tab-tiling"
          onClick={() => setActiveTab('tiling')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
            activeTab === 'tiling'
              ? 'bg-primary text-background shadow-sm'
              : 'text-[var(--text-secondary)] hover:bg-primary/15 hover:text-primary'
          }`}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>Real-Time Tiling</span>
        </button>

        <button
          id="tab-fabric-spec"
          onClick={() => setActiveTab('fabric-spec')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
            activeTab === 'fabric-spec'
              ? 'bg-primary text-background shadow-sm'
              : 'text-[var(--text-secondary)] hover:bg-primary/15 hover:text-primary'
          }`}
        >
          <Scissors className="w-3.5 h-3.5" />
          <span>Cutting Map</span>
        </button>

        <button
          id="tab-mockups"
          onClick={() => setActiveTab('mockups')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
            activeTab === 'mockups'
              ? 'bg-primary text-background shadow-sm'
              : 'text-[var(--text-secondary)] hover:bg-primary/15 hover:text-primary'
          }`}
        >
          <Shirt className="w-3.5 h-3.5" />
          <span>Mockups</span>
        </button>
      </div>

      {/* Action Controls: Undo/Redo, Theme & Export */}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <div className="hidden items-center gap-1 rounded-2xl border border-[var(--card-border)] bg-[var(--input-bg)] p-0.5 lg:flex">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="p-1.5 rounded hover:bg-[#20242a] text-[#aeb5bf] disabled:opacity-30 disabled:pointer-events-none transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            className="p-1.5 rounded hover:bg-[#20242a] text-[#aeb5bf] disabled:opacity-30 disabled:pointer-events-none transition"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Dark/Light Mode Switcher matching mcumetadata.vercel.app */}
        <button
          onClick={toggleTheme}
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--card-border)] bg-[var(--input-bg)] text-[var(--text-secondary)] transition-all hover:bg-primary/15 hover:text-primary"
        >
          {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button
          onClick={onOpenHelp}
          title="Edge Wrapping & Math Guide"
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--card-border)] bg-[var(--input-bg)] text-[var(--text-secondary)] transition-all hover:bg-primary/15 hover:text-primary"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* Export Dropdown in signature MCUSTOCK Mint */}
        <div className="relative">
          <button
            id="btn-export-dropdown"
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="flex h-11 items-center gap-1.5 rounded-2xl bg-primary px-4 text-xs font-bold text-background shadow-[0_0_15px_rgba(22,199,132,0.3)] transition-all hover:bg-primary/90 active:scale-[0.98]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
            <ChevronDown className="w-3 h-3" />
          </button>

          {showExportMenu && (
            <div className="absolute right-0 mt-1 w-64 bg-[#17191e] rounded-lg shadow-2xl border border-[#252a31] py-1.5 z-50">
              <div className="px-3 py-1 text-[11px] uppercase tracking-wider text-[#77808c] font-bold font-mono">
                Tile Outputs (300 DPI)
              </div>
              <button
                onClick={() => {
                  void exportHighResTile(elements, settings, 3);
                  setShowExportMenu(false);
                }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-[#20242a] text-[#f5f7f8] flex flex-col transition"
              >
                <span className="font-semibold text-[#f5f7f8]">1:1 Seamless Tile (PNG 1500px)</span>
                <span className="text-[11px] text-[#77808c]">High-res for digital textile printing</span>
              </button>

              <button
                onClick={handleExportSvg}
                className="w-full text-left px-3 py-2 text-xs hover:bg-[#20242a] text-[#f5f7f8] flex flex-col transition"
              >
                <span className="font-semibold text-[#f5f7f8]">Vector SVG Seamless Tile</span>
                <span className="text-[11px] text-[#77808c]">Pure scalable vectors with auto edge clip</span>
              </button>

              <div className="border-t border-[#252a31] my-1" />
              <div className="px-3 py-1 text-[11px] uppercase tracking-wider text-[#77808c] font-bold font-mono">
                Production Sheets
              </div>

              <button
                onClick={() => {
                  void exportFabricSpecSheet(elements, settings);
                  setShowExportMenu(false);
                }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-[#20242a] text-[#18c98a] flex flex-col transition"
              >
                <span className="font-semibold">Fabric Cutting Spec Sheet</span>
                <span className="text-[11px] text-[#77808c]">
                  Full blueprint with cm/inch repeat, seam allowance & bolt yield
                </span>
              </button>

              <button
                onClick={() => {
                  void exportTiledFabric(elements, settings, 4, 4);
                  setShowExportMenu(false);
                }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-[#20242a] text-[#f5f7f8] flex flex-col transition"
              >
                <span className="font-semibold text-[#f5f7f8]">4×4 Continuous Fabric Sheet</span>
                <span className="text-[11px] text-[#77808c]">Simulated repeat bolt ready to print</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

