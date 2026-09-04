"use client";

import NextImage from "next/image";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { 
  Upload, 
  Trash2, 
  Copy, 
  Download, 
  RefreshCw, 
  Maximize, 
  Minus, 
  Plus, 
  Image as ImageIcon,
  Type,
  Baseline,
  Palette,
  Monitor,
  FileOutput,
  FileText,
  Terminal,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronDown,
  X,
  FileImage,
  Layers,
  RotateCcw,
  Languages,
  IterationCcw
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// --- Types ---
type CharSet = "standard" | "blocks" | "light" | "dense" | "custom";

interface ASCIIOptions {
  gridWidth: number;
  fontSize: number;
  lineHeight: number;
  charSet: CharSet;
  customChars: string;
  invert: boolean;
  colored: boolean;
  textColor: string;
  backgroundColor: string;
}

const CHAR_SETS: Record<Exclude<CharSet, "custom">, string> = {
  dense: "@#W$9876543210?!abc;:+=-,._ ",
  light: ".:-=+*#%@ ",
  blocks: "█▓▒░ ",
  standard: "@%#*+=-:. "
};

const getSliderProgress = (value: number, min: number, max: number) =>
  `${((value - min) / (max - min)) * 100}%`;

export default function ASCIIVisionPage() {
  // --- State ---
  const [image, setImage] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string>("");
  const [imageSize, setImageSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [activeTab, setActiveTab] = useState<"original" | "processed" | "compare">("processed");
  const [zoom, setZoom] = useState(100);
  const [options, setOptions] = useState<ASCIIOptions>({
    gridWidth: 150,
    fontSize: 10,
    lineHeight: 0.6,
    charSet: "standard",
    customChars: "",
    invert: false,
    colored: false,
    textColor: "inherit",
    backgroundColor: "transparent"
  });
  const [asciiArt, setAsciiArt] = useState<string>("");
  const [coloredIRows, setColoredIRows] = useState<{ char: string; color: string }[][]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // --- Refs ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const asciiRef = useRef<HTMLPreElement>(null);

  // --- Handlers ---
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  const loadImage = (file: File) => {
    setOptions(prev => ({
      ...prev,
      colored: false,
      textColor: "inherit",
      backgroundColor: "transparent"
    }));

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setImage(result);
      setImageName(file.name);
      
      const img = new Image();
      img.onload = () => {
        setImageSize({ width: img.width, height: img.height });
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  const processImage = useCallback(() => {
    if (!image) return;
    setIsProcessing(true);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const aspect = img.height / img.width;
      const width = options.gridWidth;
      // Multiply by 0.55 to compensate for monospace character height-to-width ratio
      const height = Math.floor(width * aspect * 0.55);
      canvas.width = width;
      canvas.height = height;

      ctx.drawImage(img, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      const pixels = imageData.data;

      const charset = options.charSet === "custom" ? options.customChars || " " : CHAR_SETS[options.charSet];
      let rows: string[] = [];
      let coloredRows: { char: string; color: string }[][] = [];

      for (let y = 0; y < height; y++) {
        let row = "";
        let coloredRow: { char: string; color: string }[] = [];
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const a = pixels[i + 3];

          // Grayscale
          let gray = (0.299 * r + 0.587 * g + 0.114 * b);
          if (options.invert) gray = 255 - gray;

          const charIndex = Math.floor((gray / 255) * (charset.length - 1));
          const char = charset[charIndex] || " ";
          
          row += char;
          coloredRow.push({
            char,
            color: `rgb(${r},${g},${b})`
          });
        }
        rows.push(row);
        coloredRows.push(coloredRow);
      }

      setAsciiArt(rows.join("\n"));
      setColoredIRows(coloredRows);
      setIsProcessing(false);
    };
    img.src = image;
  }, [image, options]);

  // --- Effects ---
  useEffect(() => {
    if (image) {
      processImage();
    }
  }, [image, options, processImage]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const item = e.clipboardData?.items[0];
      if (item?.type.includes("image")) {
        const file = item.getAsFile();
        if (file) loadImage(file);
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      loadImage(file);
    }
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(asciiArt);
    showToast("Text copied to clipboard!");
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([asciiArt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${imageName.split('.')[0]}_ascii.txt`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("TXT saved!");
  };

  const getExportCanvas = async () => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const isLightTheme = document.documentElement.classList.contains("light");
    const resolvedBg = options.backgroundColor === "transparent" ? (isLightTheme ? "#00E5FF" : "#090D16") : options.backgroundColor;
    const resolvedText = options.textColor === "inherit" ? (isLightTheme ? "#090D16" : "#00E5FF") : options.textColor;

    const charWidth = options.fontSize * 0.6;
    const charHeight = options.fontSize * options.lineHeight;
    const width = options.gridWidth * charWidth;
    const height = coloredIRows.length * charHeight;

    canvas.width = width + 40;
    canvas.height = height + 40;

    ctx.fillStyle = resolvedBg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = `${options.fontSize}px monospace`;
    ctx.textBaseline = "top";

    coloredIRows.forEach((row, y) => {
      row.forEach((cell, x) => {
        ctx.fillStyle = options.colored ? cell.color : resolvedText;
        ctx.fillText(cell.char, 20 + x * charWidth, 20 + y * charHeight);
      });
    });

    return canvas;
  };

  const handleSavePNG = async () => {
    const canvas = await getExportCanvas();
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${imageName.split('.')[0]}_ascii.png`;
    link.click();
    showToast("PNG saved!");
  };

  const handleCopyPNG = async () => {
    const canvas = await getExportCanvas();
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (blob) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob })
          ]);
          showToast("PNG copied to clipboard!");
        } catch (err) {
          showToast("Copy failed", "error");
        }
      }
    });
  };

  const handleSaveSVG = () => {
    const isLightTheme = document.documentElement.classList.contains("light");
    const resolvedBg = options.backgroundColor === "transparent" ? (isLightTheme ? "#00E5FF" : "#090D16") : options.backgroundColor;
    const resolvedText = options.textColor === "inherit" ? (isLightTheme ? "#090D16" : "#00E5FF") : options.textColor;

    const charWidth = options.fontSize * 0.6;
    const charHeight = options.fontSize * options.lineHeight;
    const width = options.gridWidth * charWidth;
    const height = coloredIRows.length * charHeight;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width + 40}" height="${height + 40}" viewBox="0 0 ${width + 40} ${height + 40}">`;
    svg += `<rect width="100%" height="100%" fill="${resolvedBg}" />`;
    svg += `<g font-family="monospace" font-size="${options.fontSize}" style="white-space: pre;">`;

    coloredIRows.forEach((row, y) => {
      row.forEach((cell, x) => {
        const color = options.colored ? cell.color : resolvedText;
        svg += `<text x="${20 + x * charWidth}" y="${20 + y * charHeight}" fill="${color}" dominant-baseline="hanging">${cell.char.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>`;
      });
    });

    svg += `</g></svg>`;

    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${imageName.split('.')[0]}_ascii.svg`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("SVG saved!");
  };

  const handleReset = () => {
    setOptions({
      gridWidth: 150,
      fontSize: 10,
      lineHeight: 0.6,
      charSet: "standard",
      customChars: "",
      invert: false,
      colored: false,
      textColor: "inherit",
      backgroundColor: "transparent"
    });
    setZoom(100);
    showToast("Settings reset");
  };

  const isLightTheme = typeof document !== "undefined" && document.documentElement.classList.contains("light");
  const previewTextColor =
    options.textColor === "inherit"
      ? (isLightTheme ? "#0f172a" : "#e8eaed")
      : options.textColor;
  const previewBackgroundColor =
    options.backgroundColor === "transparent"
      ? (isLightTheme ? "#ffffff" : "#020617")
      : options.backgroundColor;

  const renderASCII = () => {
    if (options.colored) {
      return (
        <pre
          ref={asciiRef}
          className="text-foreground"
          style={{
            fontSize: `${options.fontSize}px`,
            lineHeight: options.lineHeight,
            backgroundColor: previewBackgroundColor,
            padding: "24px",
            borderRadius: "18px",
            whiteSpace: "pre",
            fontFamily: "monospace",
            display: "inline-block",
            boxShadow: isLightTheme
              ? "0 20px 50px rgba(15, 23, 42, 0.08)"
              : "0 24px 60px rgba(0, 0, 0, 0.45)"
          }}
        >
          {coloredIRows.map((row, i) => (
            <div key={i} style={{ height: `${options.fontSize * options.lineHeight}px` }}>
              {row.map((cell, j) => (
                <span key={j} style={{ color: cell.color }}>
                  {cell.char}
                </span>
              ))}
            </div>
          ))}
        </pre>
      );
    }

    return (
      <pre
        ref={asciiRef}
        className="text-foreground"
        style={{
          fontSize: `${options.fontSize}px`,
          lineHeight: options.lineHeight,
          color: previewTextColor,
          backgroundColor: previewBackgroundColor,
          padding: "24px",
          borderRadius: "18px",
          whiteSpace: "pre",
          fontFamily: "monospace",
          display: "inline-block",
          boxShadow: isLightTheme
            ? "0 20px 50px rgba(15, 23, 42, 0.08)"
            : "0 24px 60px rgba(0, 0, 0, 0.45)"
        }}
      >
        {asciiArt}
      </pre>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row h-auto lg:h-[calc(100vh-8rem)] w-full min-w-0 bg-background text-foreground overflow-x-hidden lg:overflow-hidden rounded-[20px] sm:rounded-[28px] border border-divider shadow-2xl">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 20, x: "-50%" }}
            className={`fixed bottom-8 left-1/2 z-50 px-6 py-3 rounded-2xl shadow-2xl border text-sm font-medium flex items-center gap-3 ${
              toast.type === 'success' 
              ? 'bg-sidebar-bg border-divider text-foreground' 
              : 'bg-red-500/10 border-red-500/20 text-red-500'
            }`}
          >
            {toast.type === 'success' ? <Terminal size={16} className="text-gray-400" /> : <X size={16} />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <div className="w-full lg:w-[340px] xl:w-[360px] h-auto lg:h-full border-b lg:border-b-0 lg:border-r border-divider bg-sidebar-bg flex flex-col shrink-0 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-divider flex items-center justify-between sticky top-0 bg-sidebar-bg/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
              <Terminal size={18} className="text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-bold">ASCII Vision</h1>
              <p className="text-[10px] text-primary/60">Image to ASCII art</p>
            </div>
          </div>
          <button className="text-primary/60 hover:text-primary transition-colors">
            <Maximize size={16} />
          </button>
        </div>

        {/* Import Content - Fixed Position */}
        <div className="p-3 sm:p-4 space-y-4 border-b border-divider shrink-0">
          <h2 className="text-xs font-semibold text-primary/60 uppercase tracking-wider">Import</h2>
          <div 
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const file = e.dataTransfer.files[0];
              if (file) loadImage(file);
            }}
            className="border-2 border-dashed border-primary/20 rounded-2xl px-5 py-6 flex flex-col items-center justify-center gap-3 hover:border-primary/40 hover:bg-primary/5 transition-colors cursor-pointer group text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0 border border-primary/20">
              <Upload className="text-primary" size={24} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Drop your image here</p>
              <p className="text-[10px] text-gray-500 mt-1">or click to browse · Ctrl+V to paste</p>
            </div>
            <div className="flex gap-1.5 flex-wrap justify-center">
              {['JPG', 'PNG', 'GIF', 'WebP', 'SVG', 'BMP'].map(ext => (
                <span key={ext} className="px-2 py-1 rounded-md bg-white/5 text-[10px] text-gray-500 font-medium">
                  {ext}
                </span>
              ))}
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept="image/*" 
              className="hidden" 
            />
          </div>

          {image && (
            <div className="p-3 rounded-xl bg-white/5 flex items-center justify-between group">
              <div className="flex items-center gap-2 overflow-hidden">
                <FileImage size={14} className="text-gray-400 shrink-0" />
                <span className="text-[11px] truncate text-gray-300">{imageName}</span>
              </div>
              <button 
                onClick={() => setImage(null)}
                className="p-1 hover:bg-white/10 rounded transition-colors"
              >
                <X size={14} className="text-gray-500 hover:text-red-400" />
              </button>
            </div>
          )}
        </div>

        {/* Settings Section */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-3 py-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Settings</h2>
            <button 
              onClick={handleReset}
              className="flex items-center gap-1 text-[11px] text-muted hover:text-foreground transition-colors"
            >
              <RefreshCw size={12} />
              Reset
            </button>
          </div>

          {/* Grid Width */}
          <div className="space-y-2.5">
            <div className="flex justify-between items-center">
              <label className="text-[11px] text-gray-400">Grid width</label>
              <span className="text-[11px] font-medium">{options.gridWidth}</span>
            </div>
            <input 
              type="range" 
              min="10" 
              max="400" 
              value={options.gridWidth}
              onChange={(e) => setOptions(prev => ({ ...prev, gridWidth: parseInt(e.target.value) }))}
              className="liquid-slider"
              style={{ "--range-progress": getSliderProgress(options.gridWidth, 10, 400) } as React.CSSProperties}
            />
          </div>

          {/* Font Size */}
          <div className="space-y-2.5">
            <div className="flex justify-between items-center">
              <label className="text-[11px] text-muted">Font size</label>
              <span className="text-[11px] font-medium">{options.fontSize}px</span>
            </div>
            <input 
              type="range" 
              min="5" 
              max="20" 
              value={options.fontSize}
              onChange={(e) => setOptions(prev => ({ ...prev, fontSize: parseInt(e.target.value) }))}
              className="liquid-slider"
              style={{ "--range-progress": getSliderProgress(options.fontSize, 5, 20) } as React.CSSProperties}
            />
          </div>

          {/* Line Height */}
          <div className="space-y-2.5">
            <div className="flex justify-between items-center">
              <label className="text-[11px] text-muted">Line height</label>
              <span className="text-[11px] font-medium">{options.lineHeight}</span>
            </div>
            <input 
              type="range" 
              min="0.1" 
              max="2.0" 
              step="0.1"
              value={options.lineHeight}
              onChange={(e) => setOptions(prev => ({ ...prev, lineHeight: parseFloat(e.target.value) }))}
              className="liquid-slider"
              style={{ "--range-progress": getSliderProgress(options.lineHeight, 0.1, 2) } as React.CSSProperties}
            />
          </div>

          {/* Character Set */}
          <div className="space-y-2">
            <label className="text-[11px] text-gray-400">Character set</label>
            <div className="relative">
              <select 
                value={options.charSet}
                onChange={(e) => setOptions(prev => ({ ...prev, charSet: e.target.value as CharSet }))}
                className="ascii-character-select w-full bg-input-bg border border-divider rounded-lg px-3 py-2 text-[11px] appearance-none focus:outline-none focus:border-primary/40"
              >
                <option value="standard">Standard</option>
                <option value="dense">Dense</option>
                <option value="light">Light</option>
                <option value="blocks">Blocks</option>
                <option value="custom">Custom</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={14} />
            </div>
          </div>

          {/* Custom Characters */}
          <div className={`space-y-2 transition-all duration-300 overflow-hidden ${options.charSet === "custom" ? "max-h-20 opacity-100 mt-2" : "max-h-0 opacity-0"}`}>
            <label className="text-[11px] text-gray-400">Custom characters</label>
            <input 
              type="text"
              value={options.customChars}
              onChange={(e) => setOptions(prev => ({ ...prev, customChars: e.target.value }))}
              placeholder="e.g. .:-=+*#%@"
              className="w-full bg-input-bg border border-divider rounded-lg px-3 py-2 text-[11px] focus:outline-none focus:border-primary/40"
            />
          </div>

          {/* Toggles */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between group cursor-pointer" onClick={() => setOptions(prev => ({ ...prev, invert: !prev.invert }))}>
              <div className="flex items-center gap-2">
                <IterationCcw size={14} className="text-gray-400" />
                <span className="text-[11px] text-gray-300">Invert</span>
              </div>
              <button type="button" className={`liquid-switch ${options.invert ? 'is-on' : ''}`} aria-checked={options.invert} role="switch">
                <span className="liquid-switch-thumb" />
              </button>
            </div>

            <div className="flex items-center justify-between group cursor-pointer" onClick={() => setOptions(prev => ({ ...prev, colored: !prev.colored }))}>
              <div className="flex items-center gap-2">
                <Palette size={14} className="text-gray-400" />
                <span className="text-[11px] text-gray-300">Colored</span>
              </div>
              <button type="button" className={`liquid-switch ${options.colored ? 'is-on' : ''}`} aria-checked={options.colored} role="switch">
                <span className="liquid-switch-thumb" />
              </button>
            </div>
          </div>

          {/* Colors */}
          <AnimatePresence>
            {!options.colored && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-3 overflow-hidden"
              >
                <div className="space-y-2">
                  <label className="text-[11px] text-muted">Text color</label>
                  <div className="flex items-center gap-2 p-1.5 bg-input-bg rounded-lg border border-divider">
                    <input 
                      type="color" 
                      value={options.textColor === "inherit" ? "#888888" : options.textColor}
                      onChange={(e) => setOptions(prev => ({ ...prev, textColor: e.target.value }))}
                      className="w-6 h-6 rounded bg-transparent cursor-pointer border-none overflow-hidden"
                    />
                    <span className="text-[10px] text-muted font-mono tracking-tight uppercase">
                      {options.textColor === "inherit" ? "Auto" : options.textColor}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-2">
            <label className="text-[11px] text-muted">Background</label>
            <div className="flex items-center gap-2 p-1.5 bg-input-bg rounded-lg border border-divider">
              <input 
                type="color" 
                value={options.backgroundColor === "transparent" ? "#000000" : options.backgroundColor}
                onChange={(e) => setOptions(prev => ({ ...prev, backgroundColor: e.target.value }))}
                className="w-6 h-6 rounded bg-transparent cursor-pointer border-none overflow-hidden"
              />
              <span className="text-[10px] text-muted font-mono tracking-tight uppercase">
                {options.backgroundColor === "transparent" ? "Auto" : options.backgroundColor}
              </span>
            </div>
          </div>

          {/* Export Section - Scrolled with Settings */}
          <div className="pt-6 mt-4 border-t border-divider pb-4">
            <h2 className="text-xs font-semibold text-primary/60 uppercase tracking-wider mb-4">Export</h2>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={handleCopyText}
                disabled={!image}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-primary/5 border border-primary/10 hover:bg-primary/10 text-[11px] font-medium disabled:opacity-50 disabled:cursor-not-allowed text-primary"
              >
                <Copy size={14} />
                Copy text
              </button>
              <button 
                onClick={handleDownloadTxt}
                disabled={!image}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-primary/5 border border-primary/10 hover:bg-primary/10 text-[11px] font-medium disabled:opacity-50 disabled:cursor-not-allowed text-primary"
              >
                <FileText size={14} />
                Save TXT
              </button>
              <button 
                onClick={handleSavePNG}
                disabled={!image}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-primary/5 border border-primary/10 hover:bg-primary/10 text-[11px] font-medium disabled:opacity-50 disabled:cursor-not-allowed text-primary"
              >
                <FileImage size={14} />
                Save PNG
              </button>
              <button 
                onClick={handleCopyPNG}
                disabled={!image}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-primary/5 border border-primary/10 hover:bg-primary/10 text-[11px] font-medium disabled:opacity-50 disabled:cursor-not-allowed text-primary"
              >
                <Layers size={14} />
                Copy PNG
              </button>
            </div>
            <button 
              onClick={handleSaveSVG}
              disabled={!image}
              className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-primary/5 border border-primary/15 hover:bg-primary/10 text-[11px] font-medium disabled:opacity-50 disabled:cursor-not-allowed text-primary"
            >
              <FileOutput size={14} />
              Save SVG
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-main-bg relative h-[600px] lg:h-full overflow-hidden">
        {/* Header Tabs */}
        <div className="h-14 sm:h-16 border-b border-divider flex items-center justify-between px-4 sm:px-6 bg-header-bg backdrop-blur-xl sticky top-0 z-20 shrink-0">
          <div className="flex p-1 bg-primary/5 rounded-full border border-primary/20 overflow-x-auto no-scrollbar max-w-[60%] sm:max-w-none">
            {['Original', 'Processed', 'Compare'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab.toLowerCase() as any)}
                className={`px-7 py-2 rounded-full text-[12px] font-medium transition-all ${
                  activeTab === tab.toLowerCase() ? 'border border-primary bg-primary/20 text-primary shadow-[0_0_12px_rgba(22,199,132,0.2)]' : 'border-0 bg-transparent text-primary/70 hover:text-primary'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 sm:gap-4 text-primary/70 text-[11px] shrink-0 min-w-0">
            {image && (
              <span className="hidden md:block max-w-[220px] truncate font-mono bg-primary/5 px-2 py-1 rounded text-primary/80">{imageName} · {imageSize.width}x{imageSize.height}</span>
            )}
            {image && <div className="hidden md:block h-5 w-px bg-divider" />}
            <div className="flex items-center gap-2 sm:gap-3 bg-background rounded-2xl border border-primary/20 p-1.5 px-2 sm:px-3">
              <button onClick={() => setZoom(prev => Math.max(10, prev - 10))} className="p-1 hover:text-primary transition-colors">
                <ZoomOut size={16} />
              </button>
              <span className="w-12 text-center font-mono text-primary/95">{zoom}%</span>
              <button onClick={() => setZoom(prev => Math.min(400, prev + 10))} className="p-1 hover:text-primary transition-colors">
                <ZoomIn size={16} />
              </button>
              <div className="w-[1px] h-3 bg-primary/20 mx-1" />
              <button onClick={() => setZoom(100)} className="p-1 hover:text-primary transition-colors" title="Reset Zoom">
                <Maximize2 size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-h-0 overflow-auto px-4 sm:px-6 lg:px-10 pt-6 lg:pt-10 pb-12 lg:pb-16 flex items-center justify-center custom-scrollbar bg-[radial-gradient(var(--divider)_1px,transparent_1px)] [background-size:28px_28px]">
          <AnimatePresence mode="wait">
            {!image ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center gap-6 text-primary/60 max-w-sm text-center"
              >
                <div className="w-24 h-24 rounded-[2.5rem] bg-primary/5 border border-dashed border-primary/20 flex items-center justify-center shadow-2xl relative group">
                  <div className="absolute inset-0 bg-primary/5 rounded-[2.5rem] blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  <ImageIcon size={48} className="relative z-10 text-primary" />
                </div>
                <div>
                  <h3 className="text-primary font-medium mb-1">No image selected</h3>
                  <p className="text-xs leading-relaxed text-primary/70">Upload or paste an image to see the ASCII art magic happen. Try a high-contrast photo for the best results!</p>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key={activeTab + zoom}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: zoom / 100 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="relative flex items-center justify-center min-h-full w-full"
              >
                {activeTab === 'original' && (
                  <div className="relative aspect-square h-auto w-[min(420px,80vw)] max-w-none overflow-hidden rounded-2xl shadow-2xl border border-primary/20">
                    <NextImage
                      src={image}
                      alt="Original"
                      fill
                      unoptimized
                      className="object-contain"
                    />
                  </div>
                )}
                {activeTab === 'processed' && (
                  <div className="shadow-2xl rounded-2xl border border-primary/20 overflow-hidden ring-1 ring-primary/20 mb-4">
                    {renderASCII()}
                  </div>
                )}
                {activeTab === 'compare' && (
                  <div className="flex flex-col xl:flex-row gap-6 xl:gap-8 items-center xl:items-start pb-4">
                    <div className="flex flex-col gap-3">
                      <span className="text-[10px] uppercase tracking-widest text-primary/60 font-bold ml-1">Original</span>
                      <div className="relative aspect-square h-auto w-[min(400px,78vw)] max-w-[400px] overflow-hidden rounded-2xl shadow-2xl border border-primary/20">
                        <NextImage
                          src={image}
                          alt="Original"
                          fill
                          unoptimized
                          className="object-contain"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-3">
                      <span className="text-[10px] uppercase tracking-widest text-primary/60 font-bold ml-1">ASCII Vision</span>
                      <div className="shadow-2xl rounded-2xl border border-primary/20 overflow-hidden ring-1 ring-primary/20">
                        {renderASCII()}
                      </div>
                    </div>
                  </div>
                )}
                
                {isProcessing && (
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center rounded-2xl z-20">
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative">
                        <RefreshCw className="animate-spin text-primary" size={32} />
                        <div className="absolute inset-0 blur-lg bg-primary/20 animate-pulse" />
                      </div>
                      <span className="text-primary text-xs font-bold tracking-widest uppercase">Transforming...</span>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: var(--divider);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: var(--primary);
        }
        pre {
          cursor: crosshair;
        }
      `}</style>
    </div>
  );
}

