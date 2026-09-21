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
} from 'lucide-react';

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
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Sync theme with mcumetadata.vercel.app convention ('mcustock_theme')
  useEffect(() => {
    try {
      const stored = localStorage.getItem('mcustock_theme') || 'dark';
      const isDark = stored === 'dark';
      setIsDarkMode(isDark);
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
    <header className="h-14 bg-[#101114] border-b border-[#252a31] px-4 flex items-center justify-between select-none z-30 relative text-[#f5f7f8]">
      {/* Brand & 1:1 Badge matching mcumetadata.vercel.app */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          {/* MCU Brand Mark */}
          <div className="w-8 h-8 rounded-lg bg-[#18c98a]/15 border border-[#18c98a]/40 flex items-center justify-center text-[#18c98a] font-bold text-xs tracking-tight shadow-sm shadow-[#18c98a]/10">
            MCU
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-[#f5f7f8] tracking-tight">
                MCUSTOCK <span className="font-semibold text-[#aeb5bf]">Pattern</span>
              </span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#18c98a]/15 text-[#18c98a] font-bold border border-[#18c98a]/30">
                1:1 Fabric Map
              </span>
            </div>
            <div className="text-[10px] text-[#77808c] hidden sm:block">
              Zero-Math Toroidal Wrap & Cutting Studio
            </div>
          </div>
        </div>

        {/* Template Quick Switcher */}
        <div className="relative ml-2">
          <button
            id="btn-templates"
            onClick={() => setShowTemplateMenu(!showTemplateMenu)}
            className="flex items-center gap-1.5 text-xs bg-[#17191e] hover:bg-[#20242a] text-[#f5f7f8] px-2.5 py-1.5 rounded-md border border-[#252a31] transition"
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
      </div>

      {/* Navigation View Tabs */}
      <div className="flex items-center bg-[#0d0e12] p-0.5 rounded-lg border border-[#252a31] shadow-inner">
        <button
          id="tab-artboard"
          onClick={() => setActiveTab('artboard')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
            activeTab === 'artboard'
              ? 'bg-[#18c98a] text-[#071b17] shadow-sm'
              : 'text-[#aeb5bf] hover:text-[#f5f7f8] hover:bg-[#17191e]'
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
              ? 'bg-[#18c98a] text-[#071b17] shadow-sm'
              : 'text-[#aeb5bf] hover:text-[#f5f7f8] hover:bg-[#17191e]'
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
              ? 'bg-[#18c98a] text-[#071b17] shadow-sm'
              : 'text-[#aeb5bf] hover:text-[#f5f7f8] hover:bg-[#17191e]'
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
              ? 'bg-[#18c98a] text-[#071b17] shadow-sm'
              : 'text-[#aeb5bf] hover:text-[#f5f7f8] hover:bg-[#17191e]'
          }`}
        >
          <Shirt className="w-3.5 h-3.5" />
          <span>Mockups</span>
        </button>
      </div>

      {/* Action Controls: Undo/Redo, Theme & Export */}
      <div className="flex items-center gap-2">
        <div className="hidden lg:flex items-center gap-1 bg-[#17191e] p-0.5 rounded-md border border-[#252a31]">
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
          className="p-1.5 rounded-md bg-[#17191e] hover:bg-[#20242a] text-[#aeb5bf] hover:text-[#18c98a] border border-[#252a31] transition"
        >
          {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button
          onClick={onOpenHelp}
          title="Edge Wrapping & Math Guide"
          className="p-1.5 rounded-md bg-[#17191e] hover:bg-[#20242a] text-[#aeb5bf] hover:text-[#18c98a] border border-[#252a31] transition"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* Export Dropdown in signature MCUSTOCK Mint */}
        <div className="relative">
          <button
            id="btn-export-dropdown"
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="flex items-center gap-1.5 text-xs bg-[#18c98a] hover:bg-[#27d99b] text-[#071b17] font-bold px-3 py-1.5 rounded-md shadow-sm transition"
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
                  exportHighResTile(elements, settings, 3);
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
                  exportFabricSpecSheet(elements, settings);
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
                  exportTiledFabric(elements, settings, 4, 4);
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

