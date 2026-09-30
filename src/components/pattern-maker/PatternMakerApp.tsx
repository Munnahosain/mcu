"use client";

import React, { useState, useCallback, useEffect } from 'react';
import {
  ActiveTab,
  DesignElement,
  PatternSettings,
  ToolMode,
} from './types';
import { STARTER_TEMPLATES, ShapePreset } from './utils/shapeLibrary';
import { Header } from './components/Header';
import { Toolbar } from './components/Toolbar';
import { ArtboardCanvas } from './components/ArtboardCanvas';
import { PropertiesPanel } from './components/PropertiesPanel';
import { TilingPreview } from './components/TilingPreview';
import { FabricSpecView } from './components/FabricSpecView';
import { MockupView } from './components/MockupView';
import { ShapeLibraryModal } from './components/ShapeLibraryModal';
import { HelpModal } from './components/HelpModal';
import { ColorwayModal } from './components/ColorwayModal';
import { TextPromptModal } from './components/TextPromptModal';
import { importVectorFile } from './utils/vectorImport';

const SETTINGS_STORAGE_KEY = 'mcustock_pattern_maker_settings';

export default function App() {
  const defaultTemplate = STARTER_TEMPLATES[0];

  const [elements, setElements] = useState<DesignElement[]>(
    JSON.parse(JSON.stringify(defaultTemplate.elements))
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // History stack for Undo / Redo
  const [history, setHistory] = useState<{
    past: DesignElement[][];
    future: DesignElement[][];
  }>({
    past: [],
    future: [],
  });

  const [settings, setSettings] = useState<PatternSettings>({
    artboardSize: 500, // 1:1 square canvas
    physicalUnit: 'cm',
    physicalSize: 15, // 15cm x 15cm repeat tile
    dpi: 300, // textile standard
    repeatType: 'grid',
    backgroundColor: defaultTemplate.backgroundColor,
    backgroundTransparent: false,
    showBleedGuide: true,
    seamAllowance: 1.0, // 1 cm safe margin
    showRulers: true,
    showGhostWraps: true, // live auto edge mirrors
    showGridLines: false,
    gridSnap: false,
    gridSize: 25,
    fabricBoltWidth: 140, // 140cm standard fabric roll
    fabricLength: 100, // 100cm (1 meter)
  });
  const [settingsHydrated, setSettingsHydrated] = useState(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>('artboard');
  const [toolMode, setToolMode] = useState<ToolMode>('select');
  const [zoom, setZoom] = useState<number>(1);
  const [isShapeLibraryOpen, setIsShapeLibraryOpen] = useState<boolean>(false);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [isColorwayOpen, setIsColorwayOpen] = useState<boolean>(false);
  const [isTextPromptOpen, setIsTextPromptOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) {
        setSettings((current) => ({ ...current, ...JSON.parse(saved) as Partial<PatternSettings> }));
      }
    } catch {
    } finally {
      setSettingsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!settingsHydrated) return;
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
    }
  }, [settings, settingsHydrated]);

  // Push current elements state to history before mutating
  const pushHistory = useCallback(() => {
    setHistory((prev) => ({
      past: [...prev.past.slice(-25), JSON.parse(JSON.stringify(elements))],
      future: [],
    }));
  }, [elements]);

  const handleUndo = useCallback(() => {
    setHistory((prev) => {
      if (prev.past.length === 0) return prev;
      const previous = prev.past[prev.past.length - 1];
      const newPast = prev.past.slice(0, prev.past.length - 1);
      setElements(JSON.parse(JSON.stringify(previous)));
      return {
        past: newPast,
        future: [JSON.parse(JSON.stringify(elements)), ...prev.future],
      };
    });
  }, [elements]);

  const handleRedo = useCallback(() => {
    setHistory((prev) => {
      if (prev.future.length === 0) return prev;
      const next = prev.future[0];
      const newFuture = prev.future.slice(1);
      setElements(JSON.parse(JSON.stringify(next)));
      return {
        past: [...prev.past, JSON.parse(JSON.stringify(elements))],
        future: newFuture,
      };
    });
  }, [elements]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key.toLowerCase() === 'v') {
        setToolMode('select');
      } else if (e.key.toLowerCase() === 'h') {
        setToolMode('pan');
      } else if (e.key.toLowerCase() === 'm') {
        setIsShapeLibraryOpen(true);
      } else if (e.key.toLowerCase() === 'p') {
        setToolMode('draw');
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleUndo, handleRedo]);

  // Update selected element
  const handleUpdateElement = (updated: Partial<DesignElement>) => {
    if (!selectedId) return;
    setElements((prev) =>
      prev.map((el) => (el.id === selectedId ? { ...el, ...updated } : el))
    );
  };

  // Duplicate selected element
  const handleDuplicateElement = () => {
    if (!selectedId) return;
    pushHistory();
    const source = elements.find((e) => e.id === selectedId);
    if (!source) return;

    const newEl: DesignElement = {
      ...source,
      id: `el-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: `${source.name} Copy`,
      x: (source.x + 25) % settings.artboardSize,
      y: (source.y + 25) % settings.artboardSize,
      zIndex: elements.length + 1,
    };

    setElements((prev) => [...prev, newEl]);
    setSelectedId(newEl.id);
  };

  // Delete selected element
  const handleDeleteElement = () => {
    if (!selectedId) return;
    pushHistory();
    setElements((prev) => prev.filter((el) => el.id !== selectedId));
    setSelectedId(null);
  };

  // Reorder layer
  const handleReorderElement = (direction: 'front' | 'back' | 'forward' | 'backward') => {
    if (!selectedId) return;
    pushHistory();
    setElements((prev) => {
      const idx = prev.findIndex((e) => e.id === selectedId);
      if (idx === -1) return prev;
      const sorted = [...prev].sort((a, b) => a.zIndex - b.zIndex);
      const currentPos = sorted.findIndex((e) => e.id === selectedId);

      if (direction === 'front') {
        const item = sorted.splice(currentPos, 1)[0];
        sorted.push(item);
      } else if (direction === 'back') {
        const item = sorted.splice(currentPos, 1)[0];
        sorted.unshift(item);
      } else if (direction === 'forward' && currentPos < sorted.length - 1) {
        const temp = sorted[currentPos];
        sorted[currentPos] = sorted[currentPos + 1];
        sorted[currentPos + 1] = temp;
      } else if (direction === 'backward' && currentPos > 0) {
        const temp = sorted[currentPos];
        sorted[currentPos] = sorted[currentPos - 1];
        sorted[currentPos - 1] = temp;
      }

      return sorted.map((el, i) => ({ ...el, zIndex: i + 1 }));
    });
  };

  // Insert Shape from presets
  const handleAddShape = (
    preset: ShapePreset,
    initialFill: string,
    placeAtEdge: boolean = false
  ) => {
    pushHistory();
    const S = settings.artboardSize;

    // If placeAtEdge is requested, place directly straddling the right edge!
    // This demonstrates automatic seamless flipping to the opposite side immediately!
    const x = placeAtEdge ? S : S / 2;
    const y = S / 2;

    const newElement: DesignElement = {
      id: `shape-${Date.now()}`,
      name: preset.name,
      type: 'shape',
      shapeKind: preset.kind,
      x,
      y,
      width: 110,
      height: 110,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      fill: initialFill || preset.defaultFill,
      stroke: preset.defaultStroke || 'none',
      strokeWidth: preset.defaultStrokeWidth || 0,
      zIndex: elements.length + 1,
    };

    setElements((prev) => [...prev, newElement]);
    setSelectedId(newElement.id);
    setActiveTab('artboard');
  };

  // Load complex pre-designed pattern arrangement from preset library
  const handleLoadPatternPreset = (presetElements: DesignElement[], bg?: string) => {
    pushHistory();
    setElements(JSON.parse(JSON.stringify(presetElements)));
    if (bg) {
      setSettings((prev) => ({ ...prev, backgroundColor: bg }));
    }
    setSelectedId(null);
    setActiveTab('artboard');
    setToastMessage('Pattern preset loaded into Artboard!');
  };

  // Insert Custom SVG path
  const handleAddCustomSvgPath = (path: string, fill: string) => {
    pushHistory();
    const S = settings.artboardSize;
    const newElement: DesignElement = {
      id: `svg-${Date.now()}`,
      name: 'Custom SVG Motif',
      type: 'path',
      pathData: path,
      x: S / 2,
      y: S / 2,
      width: 100,
      height: 100,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      fill: fill || '#2a9d8f',
      stroke: 'none',
      strokeWidth: 0,
      zIndex: elements.length + 1,
    };
    setElements((prev) => [...prev, newElement]);
    setSelectedId(newElement.id);
  };

  // Add Monogram / Text Motif modal trigger
  const handleAddText = () => {
    setIsTextPromptOpen(true);
  };

  const handleTextPromptSubmit = (textPrompt: string) => {
    pushHistory();
    const S = settings.artboardSize;
    const newElement: DesignElement = {
      id: `text-${Date.now()}`,
      name: `Text: ${textPrompt}`,
      type: 'text',
      textContent: textPrompt,
      fontFamily: 'Plus Jakarta Sans',
      fontSize: 36,
      x: S / 2,
      y: S / 2,
      width: 120,
      height: 50,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      fill: '#f59e0b',
      stroke: 'none',
      strokeWidth: 0,
      zIndex: elements.length + 1,
    };
    setElements((prev) => [...prev, newElement]);
    setSelectedId(newElement.id);
  };

  // Smart Harmonic Motif Auto-Scatter across toroidal repeat
  const handleScatterMotifs = () => {
    if (elements.length === 0) {
      setToastMessage("Load or add some motifs first before scattering.");
      return;
    }
    pushHistory();
    const S = settings.artboardSize;
    const edgeCoords = [
      { x: 0, y: S * 0.3 },
      { x: S, y: S * 0.7 },
      { x: S * 0.4, y: 0 },
      { x: S * 0.8, y: S },
    ];
    setElements((prev) =>
      prev.map((el, i) => {
        let newX = Math.round((Math.sin(i * 1.7 + 0.6) * 0.36 + 0.5) * S);
        let newY = Math.round((Math.cos(i * 2.1 + 1.1) * 0.36 + 0.5) * S);
        if (i < edgeCoords.length) {
          newX = Math.round(edgeCoords[i].x);
          newY = Math.round(edgeCoords[i].y);
        }
        const rots = [0, 30, 45, 90, 135, 180, 270, 315];
        return {
          ...el,
          x: newX,
          y: newY,
          rotation: rots[(i * 3) % rots.length],
        };
      })
    );
    setToastMessage("Motifs seamlessly scattered with edge wrapping!");
  };

  // Upload Custom Stamp / Graphic
  const handleUploadImages = (images: { dataUrl: string; width: number; height: number }[]) => {
    pushHistory();
    const S = settings.artboardSize;
    const imageIds = images.map((_, index) => `img-${Date.now()}-${index}`);
    const lastImageId = imageIds[imageIds.length - 1];
    if (lastImageId) setSelectedId(lastImageId);

    setElements((prev) => {
      const newElements = images.map(({ dataUrl, width, height }, index) => {
        const maxDim = 140;
        const ratio = width / height;
        const w = ratio >= 1 ? maxDim : maxDim * ratio;
        const h = ratio >= 1 ? maxDim / ratio : maxDim;

        return {
          id: imageIds[index],
          name: 'Uploaded Graphic Motif',
          type: 'image' as const,
          imageUrl: dataUrl,
          x: S / 2,
          y: S / 2,
          width: Math.round(w),
          height: Math.round(h),
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          opacity: 1,
          fill: 'none',
          stroke: 'none',
          strokeWidth: 0,
          zIndex: prev.length + index + 1,
        };
      });

      return [...prev, ...newElements];
    });
  };

  const handleImportVector = (fileName: string, data: ArrayBuffer | string) => {
    const imported = importVectorFile(fileName, data, settings.artboardSize);
    if (imported.elements.length === 0) {
      setToastMessage(imported.warnings.join('\n') || 'No editable vector content found.');
      return;
    }

    pushHistory();
    setElements((prev) => imported.elements.map((element, index) => ({
      ...element,
      zIndex: prev.length + index + 1,
    })).concat(prev));
    setSelectedId(imported.elements[imported.elements.length - 1].id);
    if (imported.warnings.length > 0) setToastMessage(imported.warnings.join('\n'));
  };

  const selectedElement = elements.find((e) => e.id === selectedId) || null;

  return (
    <div className="pattern-maker-app flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-background font-sans text-foreground select-none">
      {/* Top Application Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        elements={elements}
        settings={settings}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onOpenHelp={() => setIsHelpOpen(true)}
        onOpenColorways={() => setIsColorwayOpen(true)}
        onScatterMotifs={handleScatterMotifs}
      />

      {/* Main Workspace Body */}
      <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
        {/* Compact tool rail and settings inspector stay together on the left. */}
        {activeTab === 'artboard' && (
          <Toolbar
            toolMode={toolMode}
            setToolMode={setToolMode}
            onOpenShapeLibrary={() => setIsShapeLibraryOpen(true)}
            settings={settings}
            setSettings={setSettings}
            zoom={zoom}
            setZoom={setZoom}
            onResetZoom={() => setZoom(1)}
            onAddText={handleAddText}
            onUploadImages={handleUploadImages}
            onImportVector={handleImportVector}
          />
        )}

        {activeTab === 'artboard' && (
          <PropertiesPanel
            elements={elements}
            selectedElement={selectedElement}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            onUpdateElement={handleUpdateElement}
            onDuplicateElement={handleDuplicateElement}
            onDeleteElement={handleDeleteElement}
            onReorderElement={handleReorderElement}
            settings={settings}
            setSettings={setSettings}
          />
        )}

        {/* View Switcher based on Active Tab */}
        <main className="relative order-3 flex min-h-0 min-w-0 flex-1 overflow-hidden">
          {activeTab === 'artboard' && (
            <ArtboardCanvas
              elements={elements}
              setElements={setElements}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
              settings={settings}
              toolMode={toolMode}
              zoom={zoom}
              setZoom={setZoom}
              onPushHistory={pushHistory}
            />
          )}

          {activeTab === 'tiling' && (
            <TilingPreview
              elements={elements}
              settings={settings}
              setSettings={setSettings}
            />
          )}

          {activeTab === 'fabric-spec' && (
            <FabricSpecView
              elements={elements}
              settings={settings}
              setSettings={setSettings}
            />
          )}

          {activeTab === 'mockups' && (
            <MockupView elements={elements} settings={settings} />
          )}
        </main>

      </div>

      {/* Vector Shape Library Modal */}
      <ShapeLibraryModal
        isOpen={isShapeLibraryOpen}
        onClose={() => setIsShapeLibraryOpen(false)}
        onSelectShape={handleAddShape}
        onAddCustomSvgPath={handleAddCustomSvgPath}
        onLoadPatternPreset={handleLoadPatternPreset}
      />

      {/* Help & Zero-Math Edge Wrapping Guide Modal */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      {/* Colorway Studio / Palette Harmonizer Modal */}
      <ColorwayModal
        isOpen={isColorwayOpen}
        onClose={() => setIsColorwayOpen(false)}
        elements={elements}
        setElements={setElements}
        settings={settings}
        setSettings={setSettings}
        onPushHistory={pushHistory}
      />

      {/* Text / Monogram Input Modal (zero window.prompt) */}
      <TextPromptModal
        isOpen={isTextPromptOpen}
        onClose={() => setIsTextPromptOpen(false)}
        onSubmit={handleTextPromptSubmit}
      />

      {/* Modern In-App Toast Notification (zero window.alert) */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-primary/40 bg-[var(--card-bg)] px-4 py-3 text-xs font-bold text-foreground shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
          <span className="flex h-2 w-2 rounded-full bg-primary" />
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--input-bg)] hover:text-foreground"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
