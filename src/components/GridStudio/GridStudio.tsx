"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Check,
  ChevronDown,
  Code,
  Copy,
  Download,
  Eye,
  EyeOff,
  Grid3X3,
  HelpCircle,
  Home,
  Image as ImageIcon,
  ImagePlus,
  Layers,
  Lock,
  Unlock,
  Maximize2,
  Minimize2,
  Move,
  Palette,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Sliders,
  Sparkles,
  Trash2,
  Upload,
  ZoomIn,
  ZoomOut,
  X,
  ArrowLeftRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ThemeToggle from "@/components/ThemeToggle";
import { GridConfig, GridType, LineStyle, BgMode, CanvasPreset, CompositionScores, ReferenceAnalysis } from "@/lib/grid/types";
import { CANVAS_PRESETS, GRID_COLOR_PALETTES } from "@/lib/grid/presets";
import {
  createDefaultConfig,
  generateSeed,
  calculateCompositionScores,
  buildGridSvg,
  analyzeComposition,
  generateCssGridCode,
  PHI,
} from "@/lib/grid/engine";

const GRID_TYPE_ITEMS: { id: GridType; label: string; desc: string; icon: string }[] = [
  { id: "smart", label: "Smart Grid", desc: "Adaptive modular system with auto-harmony", icon: "✨" },
  { id: "golden", label: "Golden Ratio", desc: "Phi 1.618 logarithmic spiral & whirling squares", icon: "🌀" },
  { id: "fibonacci", label: "Fibonacci", desc: "Harmonic recursive progression arcs", icon: "📐" },
  { id: "thirds", label: "Rule of Thirds", desc: "3×3 power grid with 4 focal vertices", icon: "🎯" },
  { id: "modular", label: "Modular Grid", desc: "Custom rows, columns, and gutter tracks", icon: "🧱" },
  { id: "columns", label: "Column System", desc: "12 / 16-column editorial web framework", icon: "🏛️" },
  { id: "isometric", label: "Isometric Mesh", desc: "30° isometric lattice for 3D & iconography", icon: "🧊" },
  { id: "diagonal", label: "Dynamic Symmetry", desc: "Root harmonics and reciprocal diagonals", icon: "⚡" },
  { id: "baseline", label: "Baseline Grid", desc: "Typographic vertical rhythm guides", icon: "📝" },
];

const ASPECT_RATIO_PRESETS = [
  { label: "1:1", name: "Square", w: 1080, h: 1080 },
  { label: "16:9", name: "Landscape", w: 1920, h: 1080 },
  { label: "9:16", name: "Story / Reel", w: 1080, h: 1920 },
  { label: "4:5", name: "Portrait", w: 1080, h: 1350 },
  { label: "4:3", name: "Standard", w: 1600, h: 1200 },
  { label: "21:9", name: "Ultrawide", w: 2560, h: 1080 },
  { label: "A4", name: "Print Doc", w: 1240, h: 1754 },
];

export default function GridStudio() {
  const [mode, setMode] = useState<"generate" | "analyze">("generate");
  const [width, setWidth] = useState(1080);
  const [height, setHeight] = useState(1080);
  const [widthInput, setWidthInput] = useState("1080");
  const [heightInput, setHeightInput] = useState("1080");
  const [isAspectLocked, setIsAspectLocked] = useState(false);
  const [config, setConfig] = useState<GridConfig>(() => createDefaultConfig("smart"));
  const [zoom, setZoom] = useState(1.0);
  const [toast, setToast] = useState<string | null>(null);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [savedGrids, setSavedGrids] = useState<{ id: string; seed: string; width: number; height: number; config: GridConfig; createdAt: string }[]>([]);

  // Reference image state (Analyze mode)
  const [referenceImg, setReferenceImg] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ReferenceAnalysis | null>(null);
  const [refBlendMode, setRefBlendMode] = useState<"screen" | "multiply" | "overlay" | "normal">("screen");
  const [refGridOpacity, setRefGridOpacity] = useState(0.85);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [isDraggingFocal, setIsDraggingFocal] = useState(false);

  // Sync inputs with state
  useEffect(() => {
    setWidthInput(String(width));
    setHeightInput(String(height));
  }, [width, height]);

  // Load saved grids from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("mcustock_saved_smart_grids");
      if (raw) setSavedGrids(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  // Mouse Wheel Zoom on Preview Panel
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomStep = e.deltaY < 0 ? 0.08 : -0.08;
      setZoom((prev) => Math.min(3.0, Math.max(0.2, Number((prev + zoomStep).toFixed(2)))));
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // Helper update config
  const updateConfig = <K extends keyof GridConfig>(key: K, value: GridConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  // Aspect Ratio & Dimension Handlers
  const handleWidthChange = (valStr: string) => {
    setWidthInput(valStr);
    const parsed = parseInt(valStr, 10);
    if (!isNaN(parsed) && parsed > 0) {
      const oldW = width;
      const oldH = height;
      setWidth(parsed);
      if (isAspectLocked && oldW > 0) {
        const newH = Math.max(1, Math.round((parsed * oldH) / oldW));
        setHeight(newH);
        setHeightInput(String(newH));
      }
    }
  };

  const handleHeightChange = (valStr: string) => {
    setHeightInput(valStr);
    const parsed = parseInt(valStr, 10);
    if (!isNaN(parsed) && parsed > 0) {
      const oldW = width;
      const oldH = height;
      setHeight(parsed);
      if (isAspectLocked && oldH > 0) {
        const newW = Math.max(1, Math.round((parsed * oldW) / oldH));
        setWidth(newW);
        setWidthInput(String(newW));
      }
    }
  };

  const handleApplyRatio = (w: number, h: number, label: string) => {
    setWidth(w);
    setHeight(h);
    setWidthInput(String(w));
    setHeightInput(String(h));
    notify(`Applied ${label} (${w}×${h}px)`);
  };

  const handleFlipOrientation = () => {
    const prevW = width;
    const prevH = height;
    setWidth(prevH);
    setHeight(prevW);
    setWidthInput(String(prevH));
    setHeightInput(String(prevW));
    notify(`Flipped canvas: ${prevH}×${prevW}px`);
  };

  // Generate new grid seed
  const handleGenerateNew = (type?: GridType) => {
    const nextType = type || config.type;
    const nextConfig = createDefaultConfig(nextType, generateSeed());
    setConfig((prev) => ({
      ...nextConfig,
      gridColor: prev.gridColor,
      accentColor: prev.accentColor,
      bgMode: prev.bgMode,
      bgColor: prev.bgColor,
      opacity: prev.opacity,
      lineWidth: prev.lineWidth,
    }));
    notify(`Generated new ${nextType.toUpperCase()} grid`);
  };

  // Calculate scores
  const scores: CompositionScores = useMemo(() => {
    return calculateCompositionScores(config, width, height);
  }, [config, width, height]);

  // Build SVG string
  const svgOutput = useMemo(() => {
    return buildGridSvg(config, width, height);
  }, [config, width, height]);

  // Interactive Focal Point Dragging on Live Canvas
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!config.showFocal) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;

    updateConfig("focalX", Math.max(0, Math.min(100, Math.round(clickX))));
    updateConfig("focalY", Math.max(0, Math.min(100, Math.round(clickY))));
    setIsDraggingFocal(true);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingFocal || !config.showFocal) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;

    updateConfig("focalX", Math.max(0, Math.min(100, Math.round(clickX))));
    updateConfig("focalY", Math.max(0, Math.min(100, Math.round(clickY))));
  };

  const handleCanvasMouseUp = () => {
    setIsDraggingFocal(false);
  };

  // Reference Image Upload Handler
  const handleUploadReference = (file: File) => {
    if (!file.type.startsWith("image/")) {
      notify("Please select an image file (PNG, JPG, WebP)");
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setReferenceImg(url);
      setWidth(img.width);
      setHeight(img.height);
      const res = analyzeComposition(img.width, img.height);
      setAnalysis(res);
      setMode("analyze");
      notify(`Analyzed ${img.width}×${img.height} reference composition`);
    };
    img.src = url;
  };

  // Export SVG vector file
  const handleExportSvg = () => {
    const fullSvg = buildGridSvg(config, width, height, { isExport: true });
    const blob = new Blob([fullSvg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smart-grid-${config.type}-${width}x${height}-${config.seed.toLowerCase()}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notify("Vector SVG exported successfully");
  };

  // Copy SVG to clipboard
  const handleCopySvg = async () => {
    try {
      const fullSvg = buildGridSvg(config, width, height, { isExport: true });
      await navigator.clipboard.writeText(fullSvg);
      notify("SVG vector code copied to clipboard!");
    } catch {
      notify("Failed to copy to clipboard");
    }
  };

  // Export high-res PNG
  const handleExportPng = () => {
    const fullSvg = buildGridSvg(config, width, height, { isExport: true });
    const svgBlob = new Blob([fullSvg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      if (config.bgMode === "dark") {
        ctx.fillStyle = config.bgColor || "#0c131a";
        ctx.fillRect(0, 0, width, height);
      } else if (config.bgMode === "light") {
        ctx.fillStyle = "#f4f7f6";
        ctx.fillRect(0, 0, width, height);
      } else if (config.bgMode === "custom") {
        ctx.fillStyle = config.bgColor;
        ctx.fillRect(0, 0, width, height);
      }

      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const pngUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = pngUrl;
        a.download = `smart-grid-${config.type}-${width}x${height}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(pngUrl);
        notify("High-res PNG exported!");
      }, "image/png");
    };

    img.src = url;
  };

  // Save grid preset
  const handleSaveGrid = () => {
    const item = {
      id: `${config.seed}-${Date.now()}`,
      seed: config.seed,
      width,
      height,
      config,
      createdAt: new Date().toLocaleTimeString(),
    };
    const next = [item, ...savedGrids.slice(0, 19)];
    setSavedGrids(next);
    localStorage.setItem("mcustock_saved_smart_grids", JSON.stringify(next));
    notify("Grid configuration saved!");
  };

  const handleRestoreGrid = (saved: typeof savedGrids[0]) => {
    setConfig(saved.config);
    setWidth(saved.width);
    setHeight(saved.height);
    notify(`Restored ${saved.config.type.toUpperCase()} grid (${saved.seed})`);
  };

  const codeSnippets = useMemo(() => {
    return generateCssGridCode(config, width, height);
  }, [config, width, height]);

  return (
    <div className="min-h-full w-full text-foreground font-sans space-y-4 pb-12">
      {/* 1. TOP HEADER BANNER */}
      <header className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3.5 shadow-xl backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
        {/* Left Brand info */}
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/generator"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--input-bg)] text-[var(--text-secondary)] hover:text-primary transition-all border border-[var(--card-border)]"
            aria-label="Home"
          >
            <Home className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary/70">
                Composition Studio PRO
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/25">
                {config.seed}
              </span>
            </div>
            <h1 className="text-lg font-black tracking-tight flex items-center gap-2">
              AI Smart Grid <span className="text-primary font-bold">& Composition</span>
            </h1>
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex items-center gap-1 bg-foreground/[0.04] p-1 rounded-xl border border-foreground/10">
          <button
            onClick={() => setMode("generate")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              mode === "generate"
                ? "bg-primary text-background shadow-sm"
                : "text-foreground/60 hover:text-foreground"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" /> Grid Composer
          </button>
          <button
            onClick={() => setMode("analyze")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              mode === "analyze"
                ? "bg-primary text-background shadow-sm"
                : "text-foreground/60 hover:text-foreground"
            }`}
          >
            <Search className="h-3.5 w-3.5" /> AI Analyzer
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleGenerateNew()}
            title="Generate Random Harmonized Grid"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-all"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Next Seed
          </button>
          <button
            onClick={() => setShowCodeModal(true)}
            title="View & Copy CSS Grid Code"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-foreground/10 bg-foreground/5 hover:bg-foreground/10 transition-colors text-foreground/80"
          >
            <Code className="h-3.5 w-3.5" /> CSS Code
          </button>
          <button
            onClick={handleCopySvg}
            title="Copy SVG to Clipboard"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-foreground/10 bg-foreground/5 hover:bg-foreground/10 transition-colors text-foreground/80"
          >
            <Copy className="h-3.5 w-3.5" /> SVG
          </button>
          <button
            onClick={handleExportSvg}
            title="Download Vector SVG file"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-primary text-background hover:bg-primary-hover transition-colors shadow-lg shadow-primary/20"
          >
            <Download className="h-3.5 w-3.5 stroke-[2.5]" /> Export
          </button>
        </div>
      </header>

      {/* 2. MAIN 2-COLUMN WORKSPACE: LEFT SETTINGS (ALL SETTINGS + SCORES + PRESETS) & RIGHT PREVIEW */}
      <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)] items-start">
        
        {/* LEFT SETTINGS SIDEBAR (Scores & Presets at Top + All controls) */}
        <aside className="space-y-4 xl:max-h-[calc(100vh-8.5rem)] xl:overflow-y-auto xl:pr-2 custom-scrollbar">
          
          {/* 1. AI COMPOSITION SCORE & METRICS (TOP PRIORITY) */}
          <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-extrabold uppercase tracking-widest text-primary flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5" /> AI Composition Score
                </h2>
                <span className="text-[10px] text-foreground/50 font-semibold">Mathematical Harmony</span>
              </div>
              <div className="h-11 w-11 rounded-2xl border border-primary/30 bg-primary/10 flex items-center justify-center text-primary font-black text-lg shadow-inner">
                {scores.overallScore}
              </div>
            </div>

            {/* Score Progress Bars */}
            <div className="space-y-2.5 pt-2 border-t border-foreground/10">
              <ScoreProgress label="Visual Hierarchy" value={scores.hierarchy} />
              <ScoreProgress label="Golden Ratio (Phi)" value={scores.goldenMatch} accent />
              <ScoreProgress label="Rule of Thirds" value={scores.thirdsMatch} />
              <ScoreProgress label="Equilibrium / Balance" value={scores.balance} />
              <ScoreProgress label="Alignment Rhythm" value={scores.alignment} />
              <ScoreProgress label="Negative Space" value={scores.negativeSpace} />
            </div>
          </div>

          {/* 2. SAVED PRESETS */}
          <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-extrabold uppercase tracking-widest text-primary flex items-center gap-2">
                <Save className="h-3.5 w-3.5" /> Saved Presets ({savedGrids.length})
              </h2>
              <button
                onClick={handleSaveGrid}
                className="px-2.5 py-1 rounded-lg border border-primary/30 bg-primary/10 text-primary text-[11px] font-bold hover:bg-primary/20 transition-all"
              >
                + Save Current
              </button>
            </div>

            {savedGrids.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                {savedGrids.map((g) => (
                  <div
                    key={g.id}
                    onClick={() => handleRestoreGrid(g)}
                    className="flex items-center justify-between p-2 rounded-xl border border-foreground/10 bg-foreground/[0.03] hover:border-primary/40 hover:bg-foreground/[0.06] transition-all cursor-pointer"
                  >
                    <div className="min-w-0">
                      <span className="block truncate text-xs font-bold text-primary">
                        {g.seed} ({g.config.type})
                      </span>
                      <span className="text-[10px] text-foreground/50">
                        {g.width}×{g.height} · {g.config.columns}C/{g.config.rows}R
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-foreground/40 shrink-0">
                      {g.createdAt}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-foreground/45 italic text-center py-2">
                No saved grids yet. Click Save Current to bookmark.
              </p>
            )}
          </div>

          {/* 3. GRID SYSTEM SELECTOR */}
          <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-extrabold uppercase tracking-widest text-primary flex items-center gap-2">
                <Layers className="h-3.5 w-3.5" /> Grid System
              </h2>
              <span className="text-[10px] font-bold text-foreground/50 font-mono">{config.type.toUpperCase()}</span>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {GRID_TYPE_ITEMS.map((item) => {
                const isSelected = config.type === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      updateConfig("type", item.id);
                      handleGenerateNew(item.id);
                    }}
                    title={item.desc}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl text-center transition-all border ${
                      isSelected
                        ? "border-primary bg-primary/20 text-primary shadow-sm font-bold scale-[1.02]"
                        : "border-foreground/10 bg-foreground/[0.03] text-foreground/70 hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    <span className="text-base mb-1">{item.icon}</span>
                    <span className="text-[11px] font-bold leading-tight">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. ASPECT RATIO & DIMENSIONS */}
          <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-extrabold uppercase tracking-widest text-primary flex items-center gap-2">
                <Sliders className="h-3.5 w-3.5" /> Ratio & Dimensions
              </h2>
              <span className="text-[10px] font-bold text-foreground/50 font-mono">
                {(width / height).toFixed(2)}:1
              </span>
            </div>

            {/* Aspect Ratio Quick Pills */}
            <div className="flex flex-wrap gap-1.5">
              {ASPECT_RATIO_PRESETS.map((p) => {
                const isActive = width === p.w && height === p.h;
                return (
                  <button
                    key={p.label}
                    onClick={() => handleApplyRatio(p.w, p.h, p.name)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border ${
                      isActive
                        ? "border-primary bg-primary text-background shadow-sm"
                        : "border-foreground/10 bg-foreground/[0.04] text-foreground/70 hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    {p.label} <span className="opacity-70 text-[10px]">({p.name})</span>
                  </button>
                );
              })}
            </div>

            {/* Width, Height, Lock & Flip */}
            <div className="pt-2 border-t border-foreground/10 flex items-center gap-2">
              <div className="flex-1">
                <label className="text-[10px] text-foreground/50 font-bold block mb-1">Width (px)</label>
                <input
                  type="number"
                  min="1"
                  value={widthInput}
                  onChange={(e) => handleWidthChange(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-lg bg-foreground/[0.06] border border-foreground/10 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              {/* Aspect Ratio Lock button */}
              <div className="pt-4 flex flex-col items-center">
                <button
                  onClick={() => setIsAspectLocked((prev) => !prev)}
                  title={isAspectLocked ? "Unlock Aspect Ratio" : "Lock Aspect Ratio"}
                  className={`p-1.5 rounded-lg border transition-colors ${
                    isAspectLocked
                      ? "border-primary bg-primary/20 text-primary"
                      : "border-foreground/10 bg-foreground/5 text-foreground/40 hover:text-foreground"
                  }`}
                >
                  {isAspectLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                </button>
              </div>

              <div className="flex-1">
                <label className="text-[10px] text-foreground/50 font-bold block mb-1">Height (px)</label>
                <input
                  type="number"
                  min="1"
                  value={heightInput}
                  onChange={(e) => handleHeightChange(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-lg bg-foreground/[0.06] border border-foreground/10 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              {/* Flip Orientation */}
              <div className="pt-4">
                <button
                  onClick={handleFlipOrientation}
                  title="Swap Width & Height"
                  className="p-1.5 rounded-lg border border-foreground/10 bg-foreground/5 hover:bg-foreground/10 text-foreground/60 hover:text-foreground transition-colors"
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* 3. GEOMETRY & TRACKS */}
          <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 space-y-3 shadow-lg">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-primary flex items-center gap-2">
              <Sliders className="h-3.5 w-3.5" /> Geometry & Tracks
            </h2>

            {/* Columns & Rows */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <GridControlSlider
                label="Columns"
                value={config.columns}
                min={1}
                max={32}
                step={1}
                onChange={(val) => updateConfig("columns", val)}
              />
              <GridControlSlider
                label="Rows"
                value={config.rows}
                min={1}
                max={24}
                step={1}
                onChange={(val) => updateConfig("rows", val)}
              />
            </div>

            {/* Margins & Gutters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <GridControlSlider
                label="Margin"
                value={config.margin}
                min={0}
                max={30}
                step={1}
                suffix="%"
                onChange={(val) => updateConfig("margin", val)}
              />
              <GridControlSlider
                label="Gutter"
                value={config.gutter}
                min={0}
                max={60}
                step={2}
                suffix="px"
                onChange={(val) => updateConfig("gutter", val)}
              />
            </div>
          </div>

          {/* 4. HARMONIC OVERLAYS */}
          <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 space-y-3 shadow-lg">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-primary flex items-center gap-2">
              <Activity className="h-3.5 w-3.5" /> Harmonic Overlays
            </h2>

            <div className="space-y-2 text-xs font-semibold">
              <label className="flex items-center justify-between p-2 rounded-xl hover:bg-foreground/[0.03] cursor-pointer transition-colors">
                <span>Columns & Tracks</span>
                <input
                  type="checkbox"
                  checked={config.showColumns}
                  onChange={(e) => updateConfig("showColumns", e.target.checked)}
                  className="accent-primary h-4 w-4 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-xl hover:bg-foreground/[0.03] cursor-pointer transition-colors">
                <span>Rows & Horizontal Guides</span>
                <input
                  type="checkbox"
                  checked={config.showRows}
                  onChange={(e) => updateConfig("showRows", e.target.checked)}
                  className="accent-primary h-4 w-4 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-xl hover:bg-foreground/[0.03] cursor-pointer transition-colors">
                <span>Margin Boundaries</span>
                <input
                  type="checkbox"
                  checked={config.showMargins}
                  onChange={(e) => updateConfig("showMargins", e.target.checked)}
                  className="accent-primary h-4 w-4 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-xl hover:bg-foreground/[0.03] cursor-pointer transition-colors">
                <span className="text-[#f5c451]">Golden Ratio Spiral (Phi)</span>
                <input
                  type="checkbox"
                  checked={config.showGoldenSpiral}
                  onChange={(e) => updateConfig("showGoldenSpiral", e.target.checked)}
                  className="accent-[#f5c451] h-4 w-4 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-xl hover:bg-foreground/[0.03] cursor-pointer transition-colors">
                <span>Fibonacci Spiral</span>
                <input
                  type="checkbox"
                  checked={config.showFibonacciSpiral}
                  onChange={(e) => updateConfig("showFibonacciSpiral", e.target.checked)}
                  className="accent-primary h-4 w-4 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-xl hover:bg-foreground/[0.03] cursor-pointer transition-colors">
                <span>Rule of Thirds (3×3)</span>
                <input
                  type="checkbox"
                  checked={config.showThirds}
                  onChange={(e) => updateConfig("showThirds", e.target.checked)}
                  className="accent-primary h-4 w-4 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-xl hover:bg-foreground/[0.03] cursor-pointer transition-colors">
                <span>Dynamic Diagonals</span>
                <input
                  type="checkbox"
                  checked={config.showDiagonals}
                  onChange={(e) => updateConfig("showDiagonals", e.target.checked)}
                  className="accent-primary h-4 w-4 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-xl hover:bg-foreground/[0.03] cursor-pointer transition-colors">
                <span className="text-primary font-bold">Focal Target Point</span>
                <input
                  type="checkbox"
                  checked={config.showFocal}
                  onChange={(e) => updateConfig("showFocal", e.target.checked)}
                  className="accent-primary h-4 w-4 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-xl hover:bg-foreground/[0.03] cursor-pointer transition-colors">
                <span>Typographic Baseline</span>
                <input
                  type="checkbox"
                  checked={config.showBaseline}
                  onChange={(e) => updateConfig("showBaseline", e.target.checked)}
                  className="accent-primary h-4 w-4 rounded cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* 5. VISUAL PALETTES & STYLES */}
          <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 space-y-3 shadow-lg">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-primary flex items-center gap-2">
              <Palette className="h-3.5 w-3.5" /> Visual Style
            </h2>

            {/* Preset Color Themes */}
            <div className="grid grid-cols-3 gap-1.5">
              {GRID_COLOR_PALETTES.map((pal) => (
                <button
                  key={pal.name}
                  onClick={() => {
                    updateConfig("gridColor", pal.grid);
                    updateConfig("accentColor", pal.accent);
                    updateConfig("bgColor", pal.bg);
                  }}
                  className="flex items-center gap-1.5 p-2 rounded-xl border border-foreground/10 bg-foreground/[0.03] hover:border-primary/40 text-left transition-all"
                >
                  <span
                    className="h-4 w-4 rounded-full shrink-0 border border-white/20 shadow-sm"
                    style={{ background: pal.grid }}
                  />
                  <span className="text-[10px] font-bold truncate">{pal.name}</span>
                </button>
              ))}
            </div>

            {/* Opacity & Stroke Width with GridControlSlider */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
              <GridControlSlider
                label="Opacity"
                value={Math.round(config.opacity * 100)}
                min={10}
                max={100}
                step={5}
                suffix="%"
                onChange={(val) => updateConfig("opacity", val / 100)}
              />
              <GridControlSlider
                label="Line Width"
                value={config.lineWidth}
                min={0.5}
                max={5}
                step={0.5}
                suffix="px"
                onChange={(val) => updateConfig("lineWidth", val)}
              />
            </div>

            {/* Background Style Switcher */}
            <div className="pt-2 border-t border-foreground/10 flex items-center justify-between text-xs">
              <span className="text-foreground/70 font-bold">Background:</span>
              <div className="inline-flex gap-1 bg-foreground/[0.05] p-1 rounded-lg border border-foreground/10">
                {(["dark", "transparent", "light"] as BgMode[]).map((bg) => (
                  <button
                    key={bg}
                    onClick={() => updateConfig("bgMode", bg)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all ${
                      config.bgMode === bg
                        ? "bg-primary text-background"
                        : "text-foreground/60 hover:text-foreground"
                    }`}
                  >
                    {bg}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* RIGHT MAIN PREVIEW PANEL: HUGE DISTRACTION-FREE CANVAS WORKSPACE */}
        <main className="flex-1 min-w-0 space-y-3">
          {mode === "generate" ? (
            <div className="rounded-2xl border border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] overflow-hidden shadow-2xl flex flex-col min-h-[calc(100vh-10rem)]">
              {/* Canvas Action Bar */}
              <div className="p-3 border-b border-foreground/10 bg-black/20 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-foreground/45">
                    Live Canvas:
                  </span>
                  <span className="font-bold text-primary">
                    {width} × {height} px
                  </span>
                  <span className="text-foreground/40">·</span>
                  <span className="text-foreground/70 text-[11px] font-mono">
                    Ratio: {(width / height).toFixed(2)}:1
                  </span>
                </div>

                {/* Mouse Scroll Zoom & Focal Hint & Zoom Buttons */}
                <div className="flex items-center gap-3">
                  <span className="hidden md:inline text-[11px] text-primary/80 font-medium flex items-center gap-1.5 bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20">
                    🖱️ Mouse scroll to Zoom In / Out
                  </span>

                  <span className="hidden sm:inline text-[11px] text-foreground/50 italic flex items-center gap-1">
                    <Move className="h-3 w-3" /> Click/drag canvas to move Focal Target
                  </span>

                  {/* Zoom controls */}
                  <div className="flex items-center gap-1 bg-foreground/[0.05] p-1 rounded-xl border border-foreground/10">
                    <button
                      onClick={() => setZoom((z) => Math.max(0.2, Number((z - 0.1).toFixed(2))))}
                      className="p-1 rounded-lg hover:bg-foreground/10 text-foreground/70"
                      title="Zoom Out"
                    >
                      <ZoomOut className="h-3.5 w-3.5" />
                    </button>
                    <span className="px-1 text-[10px] font-mono font-bold text-foreground/80">
                      {Math.round(zoom * 100)}%
                    </span>
                    <button
                      onClick={() => setZoom((z) => Math.min(3.0, Number((z + 0.1).toFixed(2))))}
                      className="p-1 rounded-lg hover:bg-foreground/10 text-foreground/70"
                      title="Zoom In"
                    >
                      <ZoomIn className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setZoom(1.0)}
                      className="px-2 py-0.5 rounded text-[10px] font-bold text-primary hover:bg-primary/10"
                    >
                      Fit
                    </button>
                  </div>
                </div>
              </div>

              {/* Large Live Canvas Viewport Container */}
              <div
                ref={canvasContainerRef}
                className={`relative flex-1 min-h-[580px] flex items-center justify-center p-6 overflow-hidden select-none cursor-crosshair ${
                  config.bgMode === "transparent" ? "bg-[radial-gradient(#ffffff15_1px,transparent_1px)] [background-size:16px_16px] bg-[#090b0e]" : "bg-[#070a0e]"
                }`}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
              >
                {/* Scaled Responsive Canvas Box */}
                <div
                  style={{
                    width: width >= height ? "min(100%, 820px)" : `calc(min(100%, 820px) * ${width / height})`,
                    aspectRatio: `${width} / ${height}`,
                    maxHeight: "calc(100vh - 16rem)",
                    transform: `scale(${zoom})`,
                    transformOrigin: "center center",
                    transition: isDraggingFocal ? "none" : "transform 0.1s ease-out",
                  }}
                  className="relative shadow-2xl rounded-lg overflow-hidden shrink-0 flex items-center justify-center"
                  dangerouslySetInnerHTML={{ __html: svgOutput }}
                />
              </div>

              {/* Bottom Quick Tools Bar */}
              <div className="p-3 border-t border-foreground/10 bg-black/30 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3 text-[11px] text-foreground/60 font-mono">
                  <span>Focal X: <b className="text-primary">{config.focalX}%</b></span>
                  <span>Focal Y: <b className="text-primary">{config.focalY}%</b></span>
                  <span>Margins: <b className="text-foreground/90">{config.margin}%</b></span>
                  <span>Gutters: <b className="text-foreground/90">{config.gutter}px</b></span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveGrid}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-primary/30 bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-all"
                  >
                    <Save className="h-3.5 w-3.5" /> Save Preset
                  </button>
                  <button
                    onClick={handleExportPng}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-foreground/10 bg-foreground/5 hover:bg-foreground/10 text-xs font-bold transition-all text-foreground/80"
                  >
                    <Download className="h-3.5 w-3.5" /> PNG
                  </button>
                  <button
                    onClick={handleExportSvg}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-primary text-background hover:bg-primary-hover transition-colors shadow-lg shadow-primary/20"
                  >
                    <Download className="h-3.5 w-3.5 stroke-[2.5]" /> SVG
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ANALYZE REFERENCE VIEW */
            <div className="rounded-2xl border border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] p-5 space-y-4 shadow-2xl min-h-[calc(100vh-10rem)]">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleUploadReference(e.target.files[0])}
              />

              {referenceImg ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-extrabold text-sm text-foreground">
                        Image Composition Analyzer
                      </h3>
                      <p className="text-xs text-foreground/50">
                        {width} × {height} px · Aspect Ratio: {analysis?.aspectRatio}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={refBlendMode}
                        onChange={(e) => setRefBlendMode(e.target.value as "screen" | "multiply" | "overlay" | "normal")}
                        className="h-8 px-2.5 rounded-lg bg-foreground/[0.06] border border-foreground/10 text-xs font-bold"
                      >
                        <option value="screen">Blend: Screen</option>
                        <option value="overlay">Blend: Overlay</option>
                        <option value="multiply">Blend: Multiply</option>
                        <option value="normal">Blend: Normal</option>
                      </select>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-xl border border-primary/30 bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-all"
                      >
                        Replace Image
                      </button>
                    </div>
                  </div>

                  {/* Overlaid Image Viewport */}
                  <div className="relative flex min-h-[540px] max-h-[680px] items-center justify-center overflow-hidden rounded-2xl bg-black/40 p-4 border border-foreground/10">
                    <img
                      src={referenceImg}
                      alt="Uploaded Reference"
                      className="max-h-[620px] max-w-full object-contain rounded-lg shadow-xl"
                    />
                    <div
                      className="pointer-events-none absolute inset-4 flex items-center justify-center"
                      style={{
                        mixBlendMode: refBlendMode,
                        opacity: refGridOpacity,
                      }}
                      dangerouslySetInnerHTML={{ __html: svgOutput }}
                    />
                  </div>

                  {/* Recommendations */}
                  {analysis && (
                    <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5" /> AI Composition Feedback
                      </span>
                      <p className="text-xs font-semibold text-foreground/90">
                        Dominant Structure: <b className="text-primary">{analysis.dominantComposition}</b>
                      </p>
                      <ul className="text-xs text-foreground/70 space-y-1 list-disc pl-4">
                        {analysis.recommendations.map((rec, i) => (
                          <li key={i}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                /* Dropzone placeholder */
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex min-h-[540px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-8 text-center hover:border-primary/60 hover:bg-primary/10 transition-all cursor-pointer"
                >
                  <div className="h-16 w-16 rounded-3xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary mb-4 shadow-lg shadow-primary/20">
                    <Upload className="h-8 w-8" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">Upload Reference Artwork or Screenshot</h3>
                  <p className="mt-1 text-xs text-foreground/60 max-w-sm">
                    Drag and drop your poster, UI mockup, or artwork here to reveal its underlying mathematical composition.
                  </p>
                  <span className="mt-4 px-4 py-2 rounded-xl bg-primary text-background font-bold text-xs shadow-md">
                    Choose Image (PNG, JPG, WebP)
                  </span>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* 3. CSS & TAILWIND CODE MODAL */}
      <AnimatePresence>
        {showCodeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-2xl rounded-3xl border border-primary/30 bg-[var(--card-bg)] p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code className="h-5 w-5 text-primary" />
                  <h3 className="font-extrabold text-base text-foreground">
                    CSS Grid & Tailwind Code Exporter
                  </h3>
                </div>
                <button
                  onClick={() => setShowCodeModal(false)}
                  className="p-1 rounded-lg hover:bg-foreground/10 text-foreground/60"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Standard CSS */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-foreground/70">
                  <span>Standard CSS Grid</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(codeSnippets.css);
                      notify("CSS copied!");
                    }}
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    <Copy className="h-3 w-3" /> Copy CSS
                  </button>
                </div>
                <pre className="p-3.5 rounded-xl bg-black/60 border border-foreground/10 font-mono text-xs text-primary/90 overflow-x-auto">
                  {codeSnippets.css}
                </pre>
              </div>

              {/* Tailwind CSS */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-foreground/70">
                  <span>Tailwind CSS Framework</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(codeSnippets.tailwind);
                      notify("Tailwind code copied!");
                    }}
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    <Copy className="h-3 w-3" /> Copy Tailwind
                  </button>
                </div>
                <pre className="p-3.5 rounded-xl bg-black/60 border border-foreground/10 font-mono text-xs text-primary/90 overflow-x-auto">
                  {codeSnippets.tailwind}
                </pre>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TOAST POPUP */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-2xl bg-foreground text-background px-4 py-2.5 text-xs font-extrabold shadow-2xl flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> {toast}
        </div>
      )}
    </div>
  );
}

function ScoreProgress({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-bold">
        <span className={accent ? "text-[#f5c451]" : "text-foreground/70"}>{label}</span>
        <span className={accent ? "text-[#f5c451] font-mono" : "text-primary font-mono"}>{value}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-foreground/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${accent ? "bg-[#f5c451]" : "bg-primary"}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function GridControlSlider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (val: number) => void;
}) {
  const safeVal = typeof value === "number" && !isNaN(value) ? value : min;
  const progress = `${Math.min(100, Math.max(0, ((safeVal - min) / (max - min)) * 100))}%`;

  const handleDecrement = () => {
    onChange(Math.max(min, Number((safeVal - step).toFixed(2))));
  };

  const handleIncrement = () => {
    onChange(Math.min(max, Number((safeVal + step).toFixed(2))));
  };

  return (
    <div className="space-y-1.5 p-2.5 rounded-xl border border-foreground/[0.08] bg-foreground/[0.02]">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[11px] font-bold text-foreground/75 uppercase tracking-wider">{label}</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleDecrement}
            className="h-5 w-5 flex items-center justify-center rounded bg-foreground/10 hover:bg-foreground/20 text-[11px] font-bold text-foreground/80 transition-colors"
            title="Decrease"
          >
            -
          </button>
          <span className="font-mono font-black text-primary text-xs min-w-[36px] text-center">
            {safeVal}{suffix}
          </span>
          <button
            onClick={handleIncrement}
            className="h-5 w-5 flex items-center justify-center rounded bg-foreground/10 hover:bg-foreground/20 text-[11px] font-bold text-foreground/80 transition-colors"
            title="Increase"
          >
            +
          </button>
        </div>
      </div>
      <div className="relative flex items-center pt-1">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={safeVal}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ "--range-progress": progress } as React.CSSProperties}
          className="w-full h-2 accent-primary cursor-pointer rounded-lg bg-foreground/15"
        />
      </div>
    </div>
  );
}
