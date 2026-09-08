"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Type as TypeIcon,
  FileCode2,
  RotateCcw,
  Sparkles,
  Download,
  Shuffle,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Upload,
  Layers,
  Palette,
  Check,
  Zap,
  Grid,
  Scissors,
  Bomb,
  Radio,
  Instagram,
  Youtube,
  Home,
  Move,
  MousePointer,
  Maximize,
  Sliders,
  X,
  FileImage,
  ImageIcon,
} from "lucide-react";
import {
  TypeboxState,
  SourceMode,
  TextAlign,
  FontFamily,
  FontWeight,
  EffectType,
  DitherShape,
  SliceMode,
  BoomOrigin,
  BoomShape,
} from "@/lib/typebox/types";
import {
  DEFAULT_TYPEBOX_STATE,
  ARTBOARD_PRESETS,
} from "@/lib/typebox/presets";
import {
  renderTypeboxToCanvas,
  generateSvgExport,
} from "@/lib/typebox/engine";
import ThemeToggle from "@/components/ThemeToggle";

// Pro Slider Component matching 3D Icon Studio style with full number input support
function StudioSlider({
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
  onChange: (value: number) => void;
}) {
  const safeVal = typeof value === "number" && !isNaN(value) ? value : min;
  const progress = `${Math.min(100, Math.max(0, ((safeVal - min) / (max - min)) * 100))}%`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
        <span>{label}</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={safeVal}
            onChange={(e) => {
              const num = parseFloat(e.target.value);
              if (!isNaN(num)) {
                onChange(Math.max(min, Math.min(max, num)));
              }
            }}
            className="w-16 bg-[var(--input-bg)] border border-[var(--card-border)] rounded-lg px-2 py-0.5 text-right font-mono text-xs font-bold text-foreground focus:border-primary outline-none"
          />
          {suffix && <span className="text-[11px] font-bold text-[var(--text-muted)]">{suffix}</span>}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={safeVal}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-primary cursor-pointer"
        style={{ "--range-progress": progress } as React.CSSProperties}
        aria-label={label}
      />
    </div>
  );
}

export default function TypeboxStudioPage() {
  const [state, setState] = useState<TypeboxState>({
    ...DEFAULT_TYPEBOX_STATE,
    language: "en",
  });
  const [zoom, setZoom] = useState<number>(0.85);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewBoxRef = useRef<HTMLDivElement | null>(null);
  const customFontInputRef = useRef<HTMLInputElement | null>(null);
  const svgInputRef = useRef<HTMLInputElement | null>(null);
  const shardSvgInputRef = useRef<HTMLInputElement | null>(null);

  // Drag interaction tracking
  const dragStartRef = useRef<{ clientX: number; clientY: number; initialX: number; initialY: number }>({
    clientX: 0,
    clientY: 0,
    initialX: 0,
    initialY: 0,
  });

  // State Updaters
  const updateState = useCallback(<K extends keyof TypeboxState>(key: K, value: TypeboxState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateNested = useCallback(<K extends keyof TypeboxState, N extends keyof TypeboxState[K]>(
    key: K,
    nestedKey: N,
    val: TypeboxState[K][N]
  ) => {
    setState((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] as object),
        [nestedKey]: val,
      },
    }));
  }, []);

  // Real-time canvas render
  useEffect(() => {
    let active = true;
    const canvas = canvasRef.current;
    if (!canvas) return;

    renderTypeboxToCanvas(canvas, state, 1).catch((err) => {
      if (active) console.error("Canvas render error:", err);
    });

    return () => {
      active = false;
    };
  }, [state]);

  // Fit canvas to preview box
  const handleFitToScreen = useCallback(() => {
    if (!previewBoxRef.current) return;
    const { clientWidth, clientHeight } = previewBoxRef.current;
    if (clientWidth > 0 && clientHeight > 0) {
      const padding = 60;
      const availableW = clientWidth - padding;
      const availableH = clientHeight - padding;
      const scaleX = availableW / state.artboardWidth;
      const scaleY = availableH / state.artboardHeight;
      const fitScale = Math.min(scaleX, scaleY, 1);
      setZoom(Math.max(0.15, Number(fitScale.toFixed(2))));
    }
  }, [state.artboardWidth, state.artboardHeight]);

  useEffect(() => {
    handleFitToScreen();
  }, [handleFitToScreen]);

  // Mouse drag handlers on canvas to move position (X, Y)
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      initialX: state.transform.x,
      initialY: state.transform.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    const deltaX = (e.clientX - dragStartRef.current.clientX) / zoom;
    const deltaY = (e.clientY - dragStartRef.current.clientY) / zoom;
    
    setState((prev) => ({
      ...prev,
      transform: {
        ...prev.transform,
        x: Math.round(dragStartRef.current.initialX + deltaX),
        y: Math.round(dragStartRef.current.initialY + deltaY),
      },
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch drag handlers for mobile / tablet
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      const touch = e.touches[0];
      dragStartRef.current = {
        clientX: touch.clientX,
        clientY: touch.clientY,
        initialX: state.transform.x,
        initialY: state.transform.y,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const deltaX = (touch.clientX - dragStartRef.current.clientX) / zoom;
    const deltaY = (touch.clientY - dragStartRef.current.clientY) / zoom;

    setState((prev) => ({
      ...prev,
      transform: {
        ...prev.transform,
        x: Math.round(dragStartRef.current.initialX + deltaX),
        y: Math.round(dragStartRef.current.initialY + deltaY),
      },
    }));
  };

  // Custom Font Upload
  const handleCustomFontUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fontName = `UserFont_${Date.now()}`;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const arrayBuffer = event.target?.result as ArrayBuffer;
      if (!arrayBuffer) return;

      try {
        const fontFace = new FontFace(fontName, arrayBuffer);
        const loadedFace = await fontFace.load();
        document.fonts.add(loadedFace);

        setState((prev) => ({
          ...prev,
          fontFamily: "Custom",
          customFontName: fontName,
          customFontUrl: file.name,
        }));
      } catch (err) {
        alert("Failed to parse font file: " + (err instanceof Error ? err.message : "Unknown error"));
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // SVG Main Source Upload
  const handleSvgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setState((prev) => ({
          ...prev,
          sourceMode: "svg",
          svgContent: text,
          svgFileName: file.name,
        }));
      }
    };
    reader.readAsText(file);
  };

  // Custom Shard SVG Upload (Boom effect)
  const handleShardSvgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setState((prev) => ({
          ...prev,
          boom: {
            ...prev.boom,
            shape: "svg",
            shardSvgContent: text,
            shardSvgName: file.name,
          },
        }));
      }
    };
    reader.readAsText(file);
  };

  // Reset Transform
  const handleResetTransform = () => {
    setState((prev) => ({
      ...prev,
      transform: {
        x: 0,
        y: 0,
        rotate: 0,
        perspectiveV: 0,
        perspectiveH: 0,
      },
    }));
  };

  // Save PNG Export
  const handleSavePng = async () => {
    setIsExporting(true);
    try {
      const exportCanvas = document.createElement("canvas");
      await renderTypeboxToCanvas(exportCanvas, state, state.exportScale);

      const dataUrl = exportCanvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `typebox-${state.activeEffect}-${state.artboardWidth}x${state.artboardHeight}@${state.exportScale}x.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setCopiedNotification("PNG exported successfully!");
      setTimeout(() => setCopiedNotification(null), 3000);
    } catch (err) {
      alert("Export failed: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setIsExporting(false);
    }
  };

  // Save SVG Vector Export
  const handleSaveSvg = () => {
    try {
      const svgStr = generateSvgExport(state);
      const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `typebox-${state.activeEffect}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setCopiedNotification("SVG vector exported successfully!");
      setTimeout(() => setCopiedNotification(null), 3000);
    } catch (err) {
      alert("SVG export error: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  return (
    <div className="min-h-full w-full text-foreground font-sans selection:bg-primary selection:text-background">
      {/* 1. TOP HEADER BANNER (3D Icon Studio Style) */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-[var(--card-border)] bg-[var(--card-bg)] p-3.5 shadow-2xl backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/dashboard"
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--input-bg)] text-[var(--text-secondary)] hover:text-primary transition-all border border-[var(--card-border)]"
            aria-label="Home"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              TODOTOOL Studio
            </p>
            <h1 className="truncate text-lg font-extrabold flex items-center gap-2">
              Typebox <span className="text-primary">Graphic Engine</span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
                v2.0 PRO
              </span>
            </h1>
          </div>
        </div>

        {/* Quick Actions & Export */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Preset Buttons */}
          <div className="hidden sm:flex items-center gap-1 mr-1">
            <button
              onClick={() => {
                setState((prev) => ({
                  ...prev,
                  activeEffect: "dither",
                  color: { textColor: "#16c784", bgColor: "#090a0f", transparent: false },
                  dither: { shape: "dot", cellSize: 14, dotSize: 0.95, angle: 45 },
                  fontSize: 110,
                }));
              }}
              className="px-3 py-1.5 rounded-xl bg-[var(--input-bg)] hover:bg-primary/15 hover:text-primary text-[var(--text-secondary)] text-xs font-bold border border-[var(--card-border)] transition-all"
            >
              ✦ Halftone
            </button>
            <button
              onClick={() => {
                setState((prev) => ({
                  ...prev,
                  activeEffect: "slice",
                  color: { textColor: "#ec4899", bgColor: "#050505", transparent: false },
                  slice: { pieces: 16, offset: 32, mode: "alternate", seed: Math.random() * 100 },
                  fontSize: 120,
                }));
              }}
              className="px-3 py-1.5 rounded-xl bg-[var(--input-bg)] hover:bg-primary/15 hover:text-primary text-[var(--text-secondary)] text-xs font-bold border border-[var(--card-border)] transition-all"
            >
              ✦ Glitch Slice
            </button>
            <button
              onClick={() => {
                setState((prev) => ({
                  ...prev,
                  activeEffect: "boom",
                  color: { textColor: "#f97316", bgColor: "#121212", transparent: false },
                  boom: { ...prev.boom, shape: "triangle", spread: 80, shardSize: 16, seed: Math.random() * 100 },
                }));
              }}
              className="px-3 py-1.5 rounded-xl bg-[var(--input-bg)] hover:bg-primary/15 hover:text-primary text-[var(--text-secondary)] text-xs font-bold border border-[var(--card-border)] transition-all"
            >
              ✦ Shard Boom
            </button>
          </div>

          <ThemeToggle />

          <label className="flex h-11 items-center gap-2 rounded-2xl border border-[var(--card-border)] bg-[var(--input-bg)] px-3 text-xs font-bold text-[var(--text-secondary)] cursor-pointer">
            <input
              type="checkbox"
              checked={state.color.transparent}
              onChange={(e) => updateNested("color", "transparent", e.target.checked)}
              className="accent-primary cursor-pointer"
            />
            Alpha (Transparent)
          </label>

          <button
            onClick={handleSaveSvg}
            className="flex h-11 items-center gap-2 rounded-2xl border border-[var(--card-border)] bg-[var(--input-bg)] hover:bg-[var(--card-bg)] px-3.5 text-xs font-bold text-foreground transition-all"
          >
            <FileCode2 className="h-4 w-4 text-primary" /> Vector SVG
          </button>

          <button
            onClick={handleSavePng}
            disabled={isExporting}
            className="flex h-11 items-center gap-2 rounded-2xl bg-primary hover:bg-primary/90 px-4 text-xs font-bold text-background disabled:opacity-40 shadow-[0_0_15px_rgba(22,199,132,0.3)] transition-all active:scale-[0.98]"
          >
            <Download className="h-4 w-4" /> {isExporting ? "Rendering..." : `Download PNG (${state.exportScale}×)`}
          </button>
        </div>
      </div>

      {/* 2. MAIN 2-COLUMN LAYOUT: SIDEBAR SETTINGS (LEFT) + INTERACTIVE PREVIEW (RIGHT) */}
      <div className="grid min-h-[calc(100vh-12rem)] grid-cols-1 gap-5 xl:grid-cols-[400px_minmax(0,1fr)]">
        {/* ============================================================ */}
        {/* LEFT SIDEBAR: SCROLLABLE SETTINGS CARDS */}
        {/* ============================================================ */}
        <aside className="order-2 space-y-4 xl:order-1 xl:max-h-[calc(100vh-8.5rem)] xl:overflow-y-auto xl:pr-2 custom-scrollbar">
          {/* SECTION 1: SOURCE */}
          <section className="rounded-[24px] border border-[var(--card-border)] bg-[var(--card-bg)] p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" /> Source Input
                </h2>
                <p className="text-xs text-[var(--text-secondary)]">Choose Text or SVG Graphic</p>
              </div>
              <div className="flex bg-[var(--input-bg)] p-1 rounded-2xl border border-[var(--card-border)]">
                <button
                  onClick={() => updateState("sourceMode", "text")}
                  className={`px-3 py-1 text-xs font-bold rounded-xl transition-all ${
                    state.sourceMode === "text"
                      ? "bg-primary text-background shadow"
                      : "text-[var(--text-secondary)] hover:text-foreground"
                  }`}
                >
                  Text
                </button>
                <button
                  onClick={() => updateState("sourceMode", "svg")}
                  className={`px-3 py-1 text-xs font-bold rounded-xl transition-all ${
                    state.sourceMode === "svg"
                      ? "bg-primary text-background shadow"
                      : "text-[var(--text-secondary)] hover:text-foreground"
                  }`}
                >
                  SVG File
                </button>
              </div>
            </div>

            {state.sourceMode === "text" ? (
              <div className="space-y-3.5">
                <textarea
                  rows={2}
                  value={state.text}
                  onChange={(e) => updateState("text", e.target.value)}
                  placeholder="Enter typography text..."
                  className="w-full bg-[var(--input-bg)] border border-[var(--card-border)] rounded-2xl p-3 text-sm text-foreground font-mono focus:border-primary outline-none resize-y"
                />

                {/* Alignment */}
                <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] font-bold">
                  <span>TEXT ALIGN</span>
                  <div className="flex bg-[var(--input-bg)] p-1 rounded-xl border border-[var(--card-border)]">
                    {(["left", "center", "right"] as TextAlign[]).map((align) => (
                      <button
                        key={align}
                        onClick={() => updateState("textAlign", align)}
                        className={`px-3 py-1 capitalize rounded-lg text-xs font-bold transition-all ${
                          state.textAlign === align
                            ? "bg-primary text-background"
                            : "text-[var(--text-secondary)] hover:text-foreground"
                        }`}
                      >
                        {align}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font Selector */}
                <div className="space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                    Font Family
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(["Pretendard", "Myungjo", "Inter", "Outfit", "Orbitron", "Custom"] as FontFamily[]).map((f) => (
                      <button
                        key={f}
                        onClick={() => updateState("fontFamily", f)}
                        className={`px-2 py-2 rounded-xl text-xs font-bold border truncate transition-all ${
                          state.fontFamily === f
                            ? "border-2 border-primary bg-primary/20 text-primary shadow-[0_0_12px_rgba(22,199,132,0.25)]"
                            : "border-[var(--card-border)] bg-[var(--input-bg)] text-[var(--text-secondary)] hover:text-foreground"
                        }`}
                      >
                        {f === "Myungjo" ? "Myungjo (명조)" : f === "Custom" ? "My Font" : f}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Font Loader */}
                {state.fontFamily === "Custom" && (
                  <div className="p-3 rounded-2xl bg-[var(--input-bg)] border border-[var(--card-border)] space-y-2">
                    <input
                      type="file"
                      ref={customFontInputRef}
                      accept=".ttf,.otf,.woff,.woff2"
                      onChange={handleCustomFontUpload}
                      className="hidden"
                    />
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--text-secondary)] font-bold">Custom Font File:</span>
                      <button
                        onClick={() => customFontInputRef.current?.click()}
                        className="px-3 py-1 rounded-xl bg-primary/15 text-primary hover:bg-primary/25 border border-primary/30 font-bold text-xs"
                      >
                        Load Font
                      </button>
                    </div>
                    <div className="text-[11px] font-mono text-[var(--text-muted)] truncate">
                      {state.customFontUrl ? `Loaded: ${state.customFontUrl}` : "None selected (System fallback)"}
                    </div>
                  </div>
                )}

                {/* Weight Dropdown */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                    Weight
                  </label>
                  <select
                    value={state.fontWeight}
                    onChange={(e) => updateState("fontWeight", e.target.value as FontWeight)}
                    className="w-full bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:border-primary outline-none"
                  >
                    <option value="100">Thin 100</option>
                    <option value="300">Light 300</option>
                    <option value="400">Regular 400</option>
                    <option value="500">Medium 500</option>
                    <option value="600">SemiBold 600</option>
                    <option value="700">Bold 700</option>
                    <option value="900">Black 900</option>
                  </select>
                </div>

                {/* Typography Sliders */}
                <StudioSlider
                  label="Font Size"
                  value={state.fontSize}
                  min={10}
                  max={280}
                  step={1}
                  suffix="px"
                  onChange={(val) => updateState("fontSize", val)}
                />
                <StudioSlider
                  label="Letter Spacing"
                  value={state.letterSpacing}
                  min={-30}
                  max={80}
                  step={1}
                  suffix="px"
                  onChange={(val) => updateState("letterSpacing", val)}
                />
                <StudioSlider
                  label="Line Height"
                  value={state.lineHeight}
                  min={0.6}
                  max={2.5}
                  step={0.05}
                  onChange={(val) => updateState("lineHeight", val)}
                />
              </div>
            ) : (
              <div className="space-y-3.5">
                <input
                  type="file"
                  ref={svgInputRef}
                  accept=".svg"
                  onChange={handleSvgUpload}
                  className="hidden"
                />
                <button
                  onClick={() => svgInputRef.current?.click()}
                  className="w-full py-4 px-4 rounded-2xl bg-primary/10 hover:bg-primary/20 border border-dashed border-primary/50 text-primary font-bold text-xs flex flex-col items-center justify-center gap-2 transition-all"
                >
                  <Upload className="h-6 w-6" />
                  <span>Choose SVG file or upload logo</span>
                </button>
                {state.svgFileName && (
                  <div className="text-xs font-mono bg-[var(--input-bg)] p-2.5 rounded-xl border border-[var(--card-border)] text-foreground truncate">
                    📄 {state.svgFileName}
                  </div>
                )}
                <StudioSlider
                  label="SVG Scale"
                  value={state.svgScale}
                  min={0.1}
                  max={3.0}
                  step={0.05}
                  suffix="x"
                  onChange={(val) => updateState("svgScale", val)}
                />
              </div>
            )}
          </section>

          {/* SECTION 2: TRANSFORM & POSITION */}
          <section className="rounded-[24px] border border-[var(--card-border)] bg-[var(--card-bg)] p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold flex items-center gap-2">
                  <Move className="h-4 w-4 text-primary" /> Transform & Position
                </h2>
                <p className="text-xs text-[var(--text-secondary)]">Drag preview or adjust sliders</p>
              </div>
              <button
                onClick={handleResetTransform}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StudioSlider
                label="X Position"
                value={state.transform.x}
                min={-600}
                max={600}
                step={1}
                suffix="px"
                onChange={(val) => updateNested("transform", "x", val)}
              />
              <StudioSlider
                label="Y Position"
                value={state.transform.y}
                min={-600}
                max={600}
                step={1}
                suffix="px"
                onChange={(val) => updateNested("transform", "y", val)}
              />
            </div>

            <StudioSlider
              label="Rotation"
              value={state.transform.rotate}
              min={-180}
              max={180}
              step={1}
              suffix="°"
              onChange={(val) => updateNested("transform", "rotate", val)}
            />

            <div className="grid grid-cols-2 gap-3">
              <StudioSlider
                label="Perspective V"
                value={state.transform.perspectiveV}
                min={-70}
                max={70}
                step={1}
                onChange={(val) => updateNested("transform", "perspectiveV", val)}
              />
              <StudioSlider
                label="Perspective H"
                value={state.transform.perspectiveH}
                min={-70}
                max={70}
                step={1}
                onChange={(val) => updateNested("transform", "perspectiveH", val)}
              />
            </div>
          </section>

          {/* SECTION 3: COLOR */}
          <section className="rounded-[24px] border border-[var(--card-border)] bg-[var(--card-bg)] p-5 space-y-4 shadow-xl">
            <h2 className="text-base font-extrabold flex items-center gap-2">
              <Palette className="h-4 w-4 text-primary" /> Color Management
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {/* Foreground / Text */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                  Graphic Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={state.color.textColor}
                    onChange={(e) => updateNested("color", "textColor", e.target.value)}
                    className="h-10 w-12 rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] p-1 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={state.color.textColor}
                    onChange={(e) => updateNested("color", "textColor", e.target.value)}
                    className="h-10 min-w-0 flex-1 rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] px-2.5 text-xs font-bold uppercase font-mono outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Background */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                  Background Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={state.color.bgColor}
                    disabled={state.color.transparent}
                    onChange={(e) => updateNested("color", "bgColor", e.target.value)}
                    className="h-10 w-12 rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] p-1 cursor-pointer disabled:opacity-30"
                  />
                  <input
                    type="text"
                    value={state.color.bgColor}
                    disabled={state.color.transparent}
                    onChange={(e) => updateNested("color", "bgColor", e.target.value)}
                    className="h-10 min-w-0 flex-1 rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] px-2.5 text-xs font-bold uppercase font-mono outline-none focus:border-primary disabled:opacity-30"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 4: VISUAL EFFECT */}
          <section className="rounded-[24px] border border-[var(--card-border)] bg-[var(--card-bg)] p-5 space-y-4 shadow-xl">
            <h2 className="text-base font-extrabold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Visual Graphic Effects
            </h2>

            {/* 6 Effects Buttons */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "type", label: "Type", icon: TypeIcon },
                { id: "dither", label: "Dither", icon: Grid },
                { id: "line", label: "Line", icon: Radio },
                { id: "slice", label: "Slice", icon: Scissors },
                { id: "boom", label: "Boom", icon: Bomb },
                { id: "crack", label: "Crack", icon: Zap },
              ].map(({ id, label, icon: Icon }) => {
                const isActive = state.activeEffect === id;
                return (
                  <button
                    key={id}
                    onClick={() => updateState("activeEffect", id as EffectType)}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-2xl text-xs font-extrabold transition-all border ${
                      isActive
                        ? "border-2 border-primary bg-primary/20 text-primary shadow-[0_0_12px_rgba(22,199,132,0.25)]"
                        : "border-[var(--card-border)] bg-[var(--input-bg)] text-[var(--text-secondary)] hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Dynamic Effect Parameters */}
            <div className="p-4 rounded-2xl bg-[var(--input-bg)] border border-[var(--card-border)] space-y-3.5">
              {state.activeEffect === "type" && (
                <p className="text-xs text-[var(--text-secondary)] text-center py-1">
                  Clean vector rendering and standard high-definition shapes.
                </p>
              )}

              {/* Dither */}
              {state.activeEffect === "dither" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-[var(--text-secondary)]">DOT SHAPE</span>
                    <div className="flex bg-[var(--card-bg)] p-1 rounded-xl border border-[var(--card-border)]">
                      {(["dot", "square"] as DitherShape[]).map((shape) => (
                        <button
                          key={shape}
                          onClick={() => updateNested("dither", "shape", shape)}
                          className={`px-3 py-1 capitalize rounded-lg text-xs font-bold transition-all ${
                            state.dither.shape === shape
                              ? "bg-primary text-background"
                              : "text-[var(--text-secondary)] hover:text-foreground"
                          }`}
                        >
                          {shape}
                        </button>
                      ))}
                    </div>
                  </div>
                  <StudioSlider
                    label="Cell Size"
                    value={state.dither.cellSize}
                    min={3}
                    max={45}
                    step={1}
                    suffix="px"
                    onChange={(val) => updateNested("dither", "cellSize", val)}
                  />
                  <StudioSlider
                    label="Dot Size"
                    value={state.dither.dotSize}
                    min={0.1}
                    max={1.5}
                    step={0.05}
                    onChange={(val) => updateNested("dither", "dotSize", val)}
                  />
                  <StudioSlider
                    label="Angle"
                    value={state.dither.angle}
                    min={0}
                    max={360}
                    step={1}
                    suffix="°"
                    onChange={(val) => updateNested("dither", "angle", val)}
                  />
                </div>
              )}

              {/* Line */}
              {state.activeEffect === "line" && (
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <button
                      onClick={() => updateNested("line", "seed", Math.random() * 1000)}
                      className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                    >
                      <Shuffle className="h-3.5 w-3.5" /> Shuffle Line Pattern
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <StudioSlider
                      label="Thickness"
                      value={state.line.thickness}
                      min={1}
                      max={30}
                      step={1}
                      suffix="px"
                      onChange={(val) => updateNested("line", "thickness", val)}
                    />
                    <StudioSlider
                      label="Gap"
                      value={state.line.gap}
                      min={1}
                      max={40}
                      step={1}
                      suffix="px"
                      onChange={(val) => updateNested("line", "gap", val)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <StudioSlider
                      label="Angle"
                      value={state.line.angle}
                      min={0}
                      max={360}
                      step={1}
                      suffix="°"
                      onChange={(val) => updateNested("line", "angle", val)}
                    />
                    <StudioSlider
                      label="Offset"
                      value={state.line.offset}
                      min={0}
                      max={100}
                      step={1}
                      onChange={(val) => updateNested("line", "offset", val)}
                    />
                  </div>
                </div>
              )}

              {/* Slice */}
              {state.activeEffect === "slice" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <div className="flex bg-[var(--card-bg)] p-1 rounded-xl border border-[var(--card-border)]">
                      {(["alternate", "random"] as SliceMode[]).map((m) => (
                        <button
                          key={m}
                          onClick={() => updateNested("slice", "mode", m)}
                          className={`px-3 py-1 capitalize rounded-lg text-xs font-bold transition-all ${
                            state.slice.mode === m
                              ? "bg-primary text-background"
                              : "text-[var(--text-secondary)] hover:text-foreground"
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => updateNested("slice", "seed", Math.random() * 1000)}
                      className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                    >
                      <Shuffle className="h-3.5 w-3.5" /> Shuffle
                    </button>
                  </div>
                  <StudioSlider
                    label="Pieces"
                    value={state.slice.pieces}
                    min={2}
                    max={60}
                    step={1}
                    onChange={(val) => updateNested("slice", "pieces", val)}
                  />
                  <StudioSlider
                    label="Offset Shift"
                    value={state.slice.offset}
                    min={-180}
                    max={180}
                    step={1}
                    suffix="px"
                    onChange={(val) => updateNested("slice", "offset", val)}
                  />
                </div>
              )}

              {/* Boom */}
              {state.activeEffect === "boom" && (
                <div className="space-y-3">
                  <input
                    type="file"
                    ref={shardSvgInputRef}
                    accept=".svg"
                    onChange={handleShardSvgUpload}
                    className="hidden"
                  />
                  <div className="flex items-center gap-2">
                    <div className="flex-1 space-y-1">
                      <label className="text-[11px] font-bold text-[var(--text-secondary)]">ORIGIN</label>
                      <select
                        value={state.boom.origin}
                        onChange={(e) => updateNested("boom", "origin", e.target.value as BoomOrigin)}
                        className="w-full bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl px-2.5 py-1.5 text-xs font-bold text-foreground"
                      >
                        <option value="center">Center</option>
                        <option value="glyph">Per glyph</option>
                        <option value="top">Top</option>
                        <option value="bottom">Bottom</option>
                        <option value="left">Left</option>
                        <option value="right">Right</option>
                        <option value="top-left">Top left</option>
                        <option value="top-right">Top right</option>
                        <option value="bottom-left">Bottom left</option>
                        <option value="bottom-right">Bottom right</option>
                      </select>
                    </div>
                    <button
                      onClick={() => updateNested("boom", "seed", Math.random() * 1000)}
                      className="mt-4 px-3 py-1.5 rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] text-xs font-bold text-primary flex items-center gap-1"
                    >
                      <Shuffle className="h-3.5 w-3.5" /> Shuffle
                    </button>
                  </div>

                  {/* Shard Shape */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {(["dot", "square", "triangle", "svg"] as BoomShape[]).map((shp) => (
                      <button
                        key={shp}
                        onClick={() => updateNested("boom", "shape", shp)}
                        className={`py-1.5 text-xs font-bold rounded-xl capitalize border transition-all ${
                          state.boom.shape === shp
                            ? "border-2 border-primary bg-primary/20 text-primary"
                            : "border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-secondary)] hover:text-foreground"
                        }`}
                      >
                        {shp}
                      </button>
                    ))}
                  </div>

                  {state.boom.shape === "svg" && (
                    <div className="p-2.5 bg-[var(--card-bg)] rounded-xl border border-[var(--card-border)] space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[var(--text-secondary)] font-bold">Shard SVG:</span>
                        <button
                          onClick={() => shardSvgInputRef.current?.click()}
                          className="px-2.5 py-0.5 rounded-lg bg-primary/15 text-primary font-bold text-[11px]"
                        >
                          Load SVG
                        </button>
                      </div>
                      <div className="text-[10px] font-mono text-[var(--text-muted)] truncate">
                        {state.boom.shardSvgName ? `Loaded: ${state.boom.shardSvgName}` : "Dots until loaded"}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <StudioSlider
                      label="Shard Size"
                      value={state.boom.shardSize}
                      min={2}
                      max={50}
                      step={1}
                      suffix="px"
                      onChange={(val) => updateNested("boom", "shardSize", val)}
                    />
                    <StudioSlider
                      label="Spread"
                      value={state.boom.spread}
                      min={0}
                      max={200}
                      step={1}
                      onChange={(val) => updateNested("boom", "spread", val)}
                    />
                  </div>
                </div>
              )}

              {/* Crack */}
              {state.activeEffect === "crack" && (
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <button
                      onClick={() => updateNested("crack", "seed", Math.random() * 1000)}
                      className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                    >
                      <Shuffle className="h-3.5 w-3.5" /> Shuffle Fracture
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <StudioSlider
                      label="Pieces"
                      value={state.crack.pieces}
                      min={4}
                      max={80}
                      step={1}
                      onChange={(val) => updateNested("crack", "pieces", val)}
                    />
                    <StudioSlider
                      label="Gap"
                      value={state.crack.gap}
                      min={0}
                      max={30}
                      step={1}
                      suffix="px"
                      onChange={(val) => updateNested("crack", "gap", val)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <StudioSlider
                      label="Scatter"
                      value={state.crack.scatter}
                      min={0}
                      max={100}
                      step={1}
                      onChange={(val) => updateNested("crack", "scatter", val)}
                    />
                    <StudioSlider
                      label="Spread"
                      value={state.crack.spread}
                      min={0}
                      max={100}
                      step={1}
                      onChange={(val) => updateNested("crack", "spread", val)}
                    />
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* SECTION 5: ARTBOARD PRESETS & RESOLUTION */}
          <section className="rounded-[24px] border border-[var(--card-border)] bg-[var(--card-bg)] p-5 space-y-4 shadow-xl">
            <h2 className="text-base font-extrabold flex items-center gap-2">
              <Maximize2 className="h-4 w-4 text-primary" /> Artboard Dimensions
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[var(--text-secondary)]">WIDTH (PX)</label>
                <input
                  type="number"
                  value={state.artboardWidth}
                  onChange={(e) => updateState("artboardWidth", Math.max(200, parseInt(e.target.value) || 200))}
                  className="w-full bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl px-3 py-2 text-xs font-bold text-foreground font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[var(--text-secondary)]">HEIGHT (PX)</label>
                <input
                  type="number"
                  value={state.artboardHeight}
                  onChange={(e) => updateState("artboardHeight", Math.max(200, parseInt(e.target.value) || 200))}
                  className="w-full bg-[var(--input-bg)] border border-[var(--card-border)] rounded-xl px-3 py-2 text-xs font-bold text-foreground font-mono"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {ARTBOARD_PRESETS.map((p) => {
                const isSelected = state.artboardWidth === p.width && state.artboardHeight === p.height;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setState((prev) => ({
                        ...prev,
                        artboardWidth: p.width,
                        artboardHeight: p.height,
                      }));
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      isSelected
                        ? "border-2 border-primary bg-primary/20 text-primary shadow-[0_0_10px_rgba(22,199,132,0.2)]"
                        : "border-[var(--card-border)] bg-[var(--input-bg)] text-[var(--text-secondary)] hover:text-foreground"
                    }`}
                  >
                    {p.id} ({p.label})
                  </button>
                );
              })}
            </div>
          </section>
        </aside>

        {/* ============================================================ */}
        {/* RIGHT MAIN PANEL: INTERACTIVE LIVE PREVIEW CANVAS (STICKY) */}
        {/* ============================================================ */}
        <main className="order-1 flex min-h-[580px] flex-col rounded-[28px] border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-2xl xl:sticky xl:top-4 xl:order-2 xl:h-[calc(100vh-8.5rem)]">
          {/* Preview Header Controls */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--input-bg)] text-primary">
                <MousePointer className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-extrabold text-sm sm:text-base">Interactive Live Preview</h2>
                <p className="text-xs text-[var(--text-secondary)]">Click & drag on canvas to reposition in real-time.</p>
              </div>
            </div>

            {/* Position HUD & Zoom Controls */}
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 bg-[var(--input-bg)] px-3 py-1.5 rounded-2xl border border-[var(--card-border)] text-xs font-mono font-bold text-foreground">
                <span className="text-primary">X:</span> {state.transform.x}px
                <span className="text-[var(--text-muted)]">|</span>
                <span className="text-primary">Y:</span> {state.transform.y}px
              </div>

              <div className="flex items-center gap-1 bg-[var(--input-bg)] p-1 rounded-2xl border border-[var(--card-border)]">
                <button
                  onClick={() => setZoom((z) => Math.max(0.15, Number((z - 0.1).toFixed(2))))}
                  className="p-1.5 hover:bg-[var(--card-bg)] rounded-xl text-[var(--text-secondary)] hover:text-foreground transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <span className="font-mono text-xs font-bold text-foreground w-10 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={() => setZoom((z) => Math.min(2.5, Number((z + 0.1).toFixed(2))))}
                  className="p-1.5 hover:bg-[var(--card-bg)] rounded-xl text-[var(--text-secondary)] hover:text-foreground transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button
                  onClick={handleFitToScreen}
                  className="px-2 py-1 hover:bg-primary/20 rounded-xl text-xs font-extrabold text-primary transition-colors"
                >
                  Fit
                </button>
              </div>
            </div>
          </div>

          {/* Canvas Viewport Box */}
          <div
            ref={previewBoxRef}
            className="relative flex-1 w-full overflow-hidden rounded-[24px] border border-dashed border-[var(--card-border)] flex items-center justify-center select-none"
            style={{
              backgroundColor: state.color.transparent ? "#14171d" : undefined,
              backgroundImage: state.color.transparent
                ? "linear-gradient(45deg, rgba(255,255,255,0.06) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.06) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.06) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.06) 75%)"
                : undefined,
              backgroundPosition: "0 0, 0 12px, 12px -12px, -12px 0px",
              backgroundSize: "24px 24px",
            }}
          >
            <div
              className={`transition-shadow duration-150 relative overflow-hidden flex items-center justify-center rounded-xl shadow-2xl ${
                isDragging ? "cursor-grabbing ring-2 ring-primary" : "cursor-grab hover:ring-1 hover:ring-primary/40"
              }`}
              style={{
                width: `${state.artboardWidth * zoom}px`,
                height: `${state.artboardHeight * zoom}px`,
              }}
            >
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleMouseUp}
                style={{
                  width: `${state.artboardWidth * zoom}px`,
                  height: `${state.artboardHeight * zoom}px`,
                }}
                className="block select-none"
              />
            </div>
          </div>

          {/* Toast Notification */}
          {copiedNotification && (
            <div className="absolute bottom-6 left-6 bg-primary text-background font-extrabold text-xs px-4 py-2 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-2 z-30 animate-bounce">
              <Check className="h-4 w-4" />
              {copiedNotification}
            </div>
          )}

          {/* Footer Bar */}
          <div className="mt-3 flex items-center justify-between text-xs text-[var(--text-muted)] font-bold px-1 shrink-0">
            <span>
              Artboard: {state.artboardWidth} × {state.artboardHeight} px ({state.exportScale}× Output: {state.artboardWidth * state.exportScale} × {state.artboardHeight * state.exportScale} px)
            </span>
            <div className="flex items-center gap-3 text-[var(--text-secondary)]">
              <a href="https://instagram.com" target="_blank" rel="noreferrer" className="hover:text-primary transition-colors">
                <Instagram className="h-4 w-4" />
              </a>
              <a href="https://youtube.com" target="_blank" rel="noreferrer" className="hover:text-primary transition-colors">
                <Youtube className="h-4 w-4" />
              </a>
              <Link href="/dashboard" className="hover:text-primary transition-colors">
                <Home className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
