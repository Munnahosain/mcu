"use client";

import NextImage from "next/image";
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Upload,
  Copy,
  RefreshCw,
  Terminal,
  X,
  FileImage,
  Layers,
  ChevronDown,
  ChevronUp,
  Palette,
  FileText,
  ZoomOut,
  ZoomIn,
  Maximize2,
  Image as ImageIcon,
  Sparkles,
  Sliders,
  Grid3X3,
  CircleDot,
  Cpu,
  Download,
  Check,
  Binary,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { consumeFeatureCredit } from "@/lib/feature-credits";
import { usePersistentState } from "@/lib/usePersistentState";
import ThemedSelect from "@/components/ui/ThemedSelect";
import {
  HalftoneOptions,
  DEFAULT_HALFTONE_OPTIONS,
  processHalftoneCanvas,
  generateHalftoneSVG,
} from "@/components/retro-studio/halftoneEngine";
import {
  DitherOptions,
  DEFAULT_DITHER_OPTIONS,
  processDitherCanvas,
  generateDitherSVG,
  PRESET_PALETTES,
} from "@/components/retro-studio/ditherEngine";

type StudioMode = "halftone" | "dither" | "ascii";

type CharSet = "standard" | "blocks" | "light" | "dense" | "custom";
const RASTER_SETTINGS_KEY = "mcustock_raster_lab_settings";

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
  standard: "@%#*+=-:. ",
};

const getSliderProgress = (value: number, min: number, max: number) =>
  `${((value - min) / (max - min)) * 100}%`;

export default function RetroRasterStudioPage() {
  // Mode selection: Halftone, Dither, or ASCII
  const [activeStudioMode, setActiveStudioMode] = useState<StudioMode>("halftone");

  // Shared image state
  const [sourceImage, setSourceImage] = usePersistentState<{ dataUrl: string; name: string } | null>(
    "mcustock_ascii_source_image",
    null
  );
  const image = sourceImage?.dataUrl ?? null;
  const imageName = sourceImage?.name ?? "untitled";
  const [imageSize, setImageSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(84);
  const [exportScale, setExportScale] = useState<number>(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImageDragOver, setIsImageDragOver] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Accordion state for sidebar sections
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    import: true,
    adjustments: true,
    algorithm: true,
    grid: true,
    sampling: true,
    dots: true,
    effects: true,
    palette: true,
    export: true,
  });

  const toggleSection = (id: string) => {
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // --- Halftone State ---
  const [halftoneOptions, setHalftoneOptions] = useState<HalftoneOptions>({ ...DEFAULT_HALFTONE_OPTIONS });

  // --- Dither State ---
  const [ditherOptions, setDitherOptions] = useState<DitherOptions>({ ...DEFAULT_DITHER_OPTIONS });

  // --- ASCII State ---
  const [asciiOptions, setAsciiOptions] = useState<ASCIIOptions>({
    gridWidth: 150,
    fontSize: 10,
    lineHeight: 0.6,
    charSet: "standard",
    customChars: "",
    invert: false,
    colored: false,
    textColor: "inherit",
    backgroundColor: "transparent",
  });
  const [settingsHydrated, setSettingsHydrated] = useState(false);
  const [asciiArt, setAsciiArt] = useState<string>("");
  const [coloredIRows, setColoredIRows] = useState<{ char: string; color: string }[][]>([]);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const halftoneCanvasRef = useRef<HTMLCanvasElement>(null);
  const ditherCanvasRef = useRef<HTMLCanvasElement>(null);
  const sourceImgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(RASTER_SETTINGS_KEY);
      if (saved) {
        const settings = JSON.parse(saved) as {
          activeStudioMode?: StudioMode;
          exportScale?: number;
          halftoneOptions?: Partial<HalftoneOptions>;
          ditherOptions?: Partial<DitherOptions>;
          asciiOptions?: Partial<ASCIIOptions>;
        };
        if (["halftone", "dither", "ascii"].includes(settings.activeStudioMode || "")) {
          setActiveStudioMode(settings.activeStudioMode!);
        }
        if (typeof settings.exportScale === "number") setExportScale(settings.exportScale);
        if (settings.halftoneOptions) setHalftoneOptions((current) => ({ ...current, ...settings.halftoneOptions }));
        if (settings.ditherOptions) setDitherOptions((current) => ({ ...current, ...settings.ditherOptions }));
        if (settings.asciiOptions) setAsciiOptions((current) => ({ ...current, ...settings.asciiOptions }));
      }
    } catch {
    } finally {
      setSettingsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!settingsHydrated) return;
    try {
      localStorage.setItem(RASTER_SETTINGS_KEY, JSON.stringify({
        activeStudioMode,
        exportScale,
        halftoneOptions,
        ditherOptions,
        asciiOptions,
      }));
    } catch {
    }
  }, [activeStudioMode, exportScale, halftoneOptions, ditherOptions, asciiOptions, settingsHydrated]);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 2400);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const loadImage = useCallback((file: File) => {
    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result !== "string") {
        setIsProcessing(false);
        showToast("Could not read this image", "error");
        return;
      }
      setSourceImage({ dataUrl: result, name: file.name });

      const img = new Image();
      img.onload = () => {
        setImageSize({ width: img.width, height: img.height });
        sourceImgRef.current = img;
        setIsProcessing(false);
        showToast("Image loaded successfully!");
      };
      img.onerror = () => {
        setIsProcessing(false);
        showToast("Could not load this image", "error");
      };
      img.src = result;
    };
    reader.onerror = () => {
      setIsProcessing(false);
      showToast("Could not read this image", "error");
    };
    reader.readAsDataURL(file);
  }, [setSourceImage, showToast]);

  // Clipboard paste listener
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
  }, [loadImage]);

  // Update sourceImgRef whenever image URL changes
  useEffect(() => {
    if (!image) {
      sourceImgRef.current = null;
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setImageSize({ width: img.width, height: img.height });
      sourceImgRef.current = img;
    };
    img.onerror = () => showToast("Could not load this image", "error");
    img.src = image;
  }, [image, showToast]);

  // --- Render Halftone to Canvas ---
  const renderHalftone = useCallback(() => {
    if (!sourceImgRef.current || !halftoneCanvasRef.current) return;
    const canvas = halftoneCanvasRef.current;
    const processed = processHalftoneCanvas(sourceImgRef.current, halftoneOptions, 1);
    canvas.width = processed.width;
    canvas.height = processed.height;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(processed, 0, 0);
    }
  }, [halftoneOptions]);

  // --- Render Dither to Canvas ---
  const renderDither = useCallback(() => {
    if (!sourceImgRef.current || !ditherCanvasRef.current) return;
    const canvas = ditherCanvasRef.current;
    const processed = processDitherCanvas(sourceImgRef.current, ditherOptions, 1);
    canvas.width = processed.width;
    canvas.height = processed.height;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(processed, 0, 0);
    }
  }, [ditherOptions]);

  // Re-run halftone when options or mode change
  useEffect(() => {
    if (activeStudioMode === "halftone") {
      renderHalftone();
    }
  }, [activeStudioMode, halftoneOptions, imageSize, renderHalftone]);

  // Re-run dither when options or mode change
  useEffect(() => {
    if (activeStudioMode === "dither") {
      renderDither();
    }
  }, [activeStudioMode, ditherOptions, imageSize, renderDither]);

  // --- ASCII Generation ---
  useEffect(() => {
    if (!image || activeStudioMode !== "ascii") return;

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx || cancelled) return;

      const aspect = img.height / img.width;
      const width = asciiOptions.gridWidth;
      const height = Math.floor(width * aspect * 0.55);
      canvas.width = width;
      canvas.height = height;

      ctx.drawImage(img, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      const pixels = imageData.data;

      const charset =
        asciiOptions.charSet === "custom"
          ? asciiOptions.customChars || " "
          : CHAR_SETS[asciiOptions.charSet];
      const rows: string[] = [];
      const processedRows: { char: string; color: string }[][] = [];

      for (let y = 0; y < height; y++) {
        let row = "";
        const coloredRow: { char: string; color: string }[] = [];
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];

          let gray = 0.299 * r + 0.587 * g + 0.114 * b;
          if (asciiOptions.invert) gray = 255 - gray;

          const charIndex = Math.floor((gray / 255) * (charset.length - 1));
          const char = charset[charIndex] || " ";

          row += char;
          coloredRow.push({ char, color: `rgb(${r},${g},${b})` });
        }
        rows.push(row);
        processedRows.push(coloredRow);
      }

      if (!cancelled) {
        setAsciiArt(rows.join("\n"));
        setColoredIRows(processedRows);
      }
    };
    img.src = image;

    return () => {
      cancelled = true;
    };
  }, [image, asciiOptions, activeStudioMode]);

  // --- Handlers: Halftone ---
  const handleResetHalftone = () => {
    setHalftoneOptions({ ...DEFAULT_HALFTONE_OPTIONS });
    showToast("Halftone settings reset");
  };

  const handleRandomizeHalftonePalette = () => {
    const randomHex = () =>
      "#" +
      Math.floor(Math.random() * 16777215)
        .toString(16)
        .padStart(6, "0");
    setHalftoneOptions(prev => ({
      ...prev,
      fgColor: randomHex(),
      bgColor: randomHex(),
    }));
    showToast("Halftone palette randomized");
  };

  const handleDownloadHalftonePNG = async () => {
    if (!sourceImgRef.current) return;
    await consumeFeatureCredit("ascii_generation");
    const scaledCanvas = processHalftoneCanvas(sourceImgRef.current, halftoneOptions, exportScale);
    const link = document.createElement("a");
    link.href = scaledCanvas.toDataURL("image/png");
    link.download = `${imageName.split(".")[0]}_halftone_${exportScale}x.png`;
    link.click();
    showToast(`Downloaded Halftone PNG (${exportScale}x)!`);
  };

  const handleDownloadHalftoneSVG = async () => {
    if (!sourceImgRef.current) return;
    await consumeFeatureCredit("ascii_generation");
    const svgString = generateHalftoneSVG(sourceImgRef.current, halftoneOptions);
    const blob = new Blob([svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${imageName.split(".")[0]}_halftone.svg`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("Downloaded Halftone Vector SVG!");
  };

  const handleCopyHalftoneToClipboard = async () => {
    if (!sourceImgRef.current) return;
    const canvas = processHalftoneCanvas(sourceImgRef.current, halftoneOptions, 1);
    canvas.toBlob(async (blob) => {
      if (blob) {
        try {
          await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
          showToast("Halftone copied to clipboard!");
        } catch {
          showToast("Clipboard copy failed", "error");
        }
      }
    });
  };

  // --- Handlers: Dither ---
  const handleResetDither = () => {
    setDitherOptions({ ...DEFAULT_DITHER_OPTIONS });
    showToast("Dither settings reset");
  };

  const handleRandomizeDitherPalette = () => {
    const randomHex = () =>
      "#" +
      Math.floor(Math.random() * 16777215)
        .toString(16)
        .padStart(6, "0");
    setDitherOptions(prev => ({
      ...prev,
      colors: [randomHex(), randomHex()],
    }));
    showToast("Dither palette randomized");
  };

  const handleDownloadDitherPNG = async () => {
    if (!sourceImgRef.current) return;
    await consumeFeatureCredit("ascii_generation");
    const scaledCanvas = processDitherCanvas(sourceImgRef.current, ditherOptions, exportScale);
    const link = document.createElement("a");
    link.href = scaledCanvas.toDataURL("image/png");
    link.download = `${imageName.split(".")[0]}_dither_${exportScale}x.png`;
    link.click();
    showToast(`Downloaded Dither PNG (${exportScale}x)!`);
  };

  const handleDownloadDitherSVG = async () => {
    if (!sourceImgRef.current) return;
    await consumeFeatureCredit("ascii_generation");
    const svgString = generateDitherSVG(sourceImgRef.current, ditherOptions);
    const blob = new Blob([svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${imageName.split(".")[0]}_dither.svg`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("Downloaded Dither Vector SVG!");
  };

  const handleCopyDitherToClipboard = async () => {
    if (!sourceImgRef.current) return;
    const canvas = processDitherCanvas(sourceImgRef.current, ditherOptions, 1);
    canvas.toBlob(async (blob) => {
      if (blob) {
        try {
          await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
          showToast("Dither copied to clipboard!");
        } catch {
          showToast("Clipboard copy failed", "error");
        }
      }
    });
  };

  // --- Handlers: ASCII ---
  const handleCopyAsciiText = () => {
    navigator.clipboard.writeText(asciiArt);
    showToast("ASCII text copied to clipboard!");
  };

  const handleDownloadAsciiTxt = async () => {
    await consumeFeatureCredit("ascii_generation");
    const blob = new Blob([asciiArt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${imageName.split(".")[0]}_ascii.txt`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("ASCII TXT saved!");
  };

  const getAsciiCanvas = async () => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const isLight = document.documentElement.classList.contains("light");
    const resolvedBg =
      asciiOptions.backgroundColor === "transparent"
        ? (isLight ? "#f8fafc" : "#020617")
        : asciiOptions.backgroundColor;
    const resolvedText =
      asciiOptions.textColor === "inherit"
        ? (isLight ? "#0f172a" : "#38bdf8")
        : asciiOptions.textColor;

    const charWidth = asciiOptions.fontSize * 0.6;
    const charHeight = asciiOptions.fontSize * asciiOptions.lineHeight;
    const width = asciiOptions.gridWidth * charWidth;
    const height = coloredIRows.length * charHeight;

    canvas.width = width + 40;
    canvas.height = height + 40;

    ctx.fillStyle = resolvedBg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = `${asciiOptions.fontSize}px monospace`;
    ctx.textBaseline = "top";

    coloredIRows.forEach((row, y) => {
      row.forEach((cell, x) => {
        ctx.fillStyle = asciiOptions.colored ? cell.color : resolvedText;
        ctx.fillText(cell.char, 20 + x * charWidth, 20 + y * charHeight);
      });
    });

    return canvas;
  };

  const handleDownloadAsciiPNG = async () => {
    await consumeFeatureCredit("ascii_generation");
    const canvas = await getAsciiCanvas();
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${imageName.split(".")[0]}_ascii.png`;
    link.click();
    showToast("ASCII PNG saved!");
  };

  const handleCopyAsciiPNG = async () => {
    const canvas = await getAsciiCanvas();
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (blob) {
        try {
          await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
          showToast("ASCII PNG copied to clipboard!");
        } catch {
          showToast("Copy failed", "error");
        }
      }
    });
  };

  const handleClearAll = () => {
    setSourceImage(null);
    setImageSize({ width: 0, height: 0 });
    sourceImgRef.current = null;
    showToast("Image cleared");
  };

  const handleImageDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsImageDragOver(false);
    const file = Array.from(event.dataTransfer.files).find((item) => item.type.startsWith("image/"));
    if (file) loadImage(file);
    else showToast("Drop an image file to import it", "error");
  };

  return (
    <div className="retro-raster-studio flex flex-col h-auto lg:h-[calc(100vh-8rem)] w-full min-w-0 bg-[#07080b] text-[#f1f5f9] overflow-x-hidden lg:overflow-hidden rounded-[24px] border border-[#1e222a] shadow-2xl">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 20, x: "-50%" }}
            className={`fixed bottom-8 left-1/2 z-50 px-5 py-2.5 rounded-2xl shadow-2xl border text-xs font-semibold flex items-center gap-2.5 backdrop-blur-xl ${
              toast.type === "success"
                ? "bg-[#11141c]/95 border-[#16c784]/40 text-[#16c784]"
                : "bg-red-500/20 border-red-500/30 text-red-400"
            }`}
          >
            {toast.type === "success" ? <Check size={14} className="text-[#16c784]" /> : <X size={14} />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top 3-Way Mode Switcher Header */}
      <div className="h-16 px-4 sm:px-6 border-b border-[#252a31] bg-[#17191e]/90 backdrop-blur-xl flex flex-wrap items-center justify-between gap-3 shrink-0 z-30">
        {/* Studio Branding */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#16c784]/15 flex items-center justify-center border border-[#16c784]/30 shadow-sm">
            {activeStudioMode === "halftone" && <CircleDot size={18} className="text-[#16c784]" />}
            {activeStudioMode === "dither" && <Cpu size={18} className="text-[#16c784]" />}
            {activeStudioMode === "ascii" && <Binary size={18} className="text-[#16c784]" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                Raster Lab
              </h1>
            </div>
            <p className="text-[10.5px] text-gray-400">
              Halftone · Dither · ASCII
            </p>
          </div>
        </div>

        {/* The 3-Toggle Switch (Halftone, Dither, ASCII) */}
        <div className="flex items-center p-1 bg-[#131720] border border-[#232936] rounded-xl shadow-inner">
          <button
            onClick={() => setActiveStudioMode("halftone")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeStudioMode === "halftone"
                ? "bg-[#16c784] text-[#07080b] shadow-md font-bold"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <CircleDot size={13} />
            <span>Halftone</span>
          </button>
          <button
            onClick={() => setActiveStudioMode("dither")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeStudioMode === "dither"
                ? "bg-[#16c784] text-[#07080b] shadow-md font-bold"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Cpu size={13} />
            <span>Dither</span>
          </button>
          <button
            onClick={() => setActiveStudioMode("ascii")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeStudioMode === "ascii"
                ? "bg-[#16c784] text-[#07080b] shadow-md font-bold"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Terminal size={13} />
            <span>ASCII</span>
          </button>
        </div>

        {/* Global Zoom */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 bg-[#17191e] border border-[#252a31] rounded-xl px-2.5 py-1">
            <button
              onClick={() => setZoom(prev => Math.max(10, prev - 10))}
              className="p-1 text-gray-400 hover:text-[#16c784] transition"
              title="Zoom Out"
            >
              <ZoomOut size={14} />
            </button>
            <span className="w-10 text-center font-mono text-[11px] text-gray-200">{zoom}%</span>
            <button
              onClick={() => setZoom(prev => Math.min(400, prev + 10))}
              className="p-1 text-gray-400 hover:text-[#16c784] transition"
              title="Zoom In"
            >
              <ZoomIn size={14} />
            </button>
            <div className="w-px h-3 bg-gray-700 mx-1" />
            <button
              onClick={() => setZoom(84)}
              className="p-1 text-gray-400 hover:text-[#16c784] transition"
              title="Reset Zoom"
            >
              <Maximize2 size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Studio Body: Sidebar + Viewport */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden relative">
        {/* Left Sidebar */}
        <div className="w-full lg:w-[320px] xl:w-[340px] border-b lg:border-b-0 lg:border-r border-[#252a31] bg-[#17191e] flex flex-col shrink-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
            {/* Section: Import Image */}
            <div className="border border-[#252a31] rounded-xl bg-[#17191e] overflow-hidden">
              <button
                onClick={() => toggleSection("import")}
                className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-gray-300 hover:text-white transition"
              >
                <div className="flex items-center gap-2">
                  <Upload size={14} className="text-[#16c784]" />
                  <span>Import Image</span>
                </div>
                {openSections.import ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {openSections.import && (
                <div className="p-3 border-t border-[#252a31] space-y-3">
                  {/* Image preview box */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setIsImageDragOver(true);
                    }}
                    onDragLeave={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                        setIsImageDragOver(false);
                      }
                    }}
                    onDrop={handleImageDrop}
                    className={`relative aspect-square max-h-[160px] w-full rounded-xl border border-dashed bg-[#101114] flex flex-col items-center justify-center p-3 cursor-pointer group transition overflow-hidden ${
                      isImageDragOver
                        ? "border-[#16c784] bg-[#16c784]/10"
                        : "border-[#30363e] hover:border-[#16c784]/60"
                    }`}
                  >
                    {image ? (
                      <div className="relative w-full h-full">
                        <NextImage
                          src={image}
                          alt="Imported"
                          fill
                          unoptimized
                          className="object-contain"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-lg">
                          <span className="text-[11px] font-semibold text-white bg-black/80 px-2 py-1 rounded">
                            Change Image
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-center">
                        <div className="w-10 h-10 rounded-xl bg-[#16c784]/10 flex items-center justify-center text-[#16c784]">
                          <Upload size={18} />
                        </div>
                        <span className="text-xs font-medium text-gray-300">Drop an image or click to browse</span>
                        <span className="text-[10px] text-gray-500">Supports PNG, JPG, WebP</span>
                      </div>
                    )}
                    {isProcessing && (
                      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-2 bg-[#101114]/85 text-xs font-medium text-[#16c784]">
                        <RefreshCw size={14} className="animate-spin" />
                        Processing image
                      </div>
                    )}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) loadImage(file);
                      }}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={handleClearAll}
                      className="flex-1 py-2 px-3 bg-[#16c784] hover:bg-[#27e39a] text-[#07080b] font-black text-xs rounded-xl shadow-md transition"
                    >
                      CLEAR ALL
                    </button>
                    <button
                      onClick={() => {
                        if (activeStudioMode === "halftone") handleResetHalftone();
                        else if (activeStudioMode === "dither") handleResetDither();
                        else setAsciiOptions({
                          gridWidth: 150,
                          fontSize: 10,
                          lineHeight: 0.6,
                          charSet: "standard",
                          customChars: "",
                          invert: false,
                          colored: false,
                          textColor: "inherit",
                          backgroundColor: "transparent",
                        });
                      }}
                      className="flex-1 py-2 px-3 bg-[#20242a] hover:bg-[#30363e] text-gray-300 border border-[#30363e] text-xs font-semibold rounded-xl transition"
                    >
                      RESET SETTINGS
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* --- HALFTONE SPECIFIC CONTROLS --- */}
            {activeStudioMode === "halftone" && (
              <>
                {/* Canvas & Adjustments */}
                <div className="border border-[#252a31] rounded-xl bg-[#17191e] overflow-hidden">
                  <button
                    onClick={() => toggleSection("adjustments")}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-gray-300 hover:text-white transition"
                  >
                    <div className="flex items-center gap-2">
                      <Sliders size={14} className="text-[#16c784]" />
                      <span>Canvas & Adjustments</span>
                    </div>
                    {openSections.adjustments ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {openSections.adjustments && (
                    <div className="p-3 border-t border-[#252a31] space-y-3 text-xs">
                      {/* Algorithm */}
                      <div className="space-y-1">
                        <label className="text-[11px] text-gray-400">Algorithm</label>
                        <ThemedSelect
                          value={halftoneOptions.algorithm}
                          onChange={(value) => setHalftoneOptions((current) => ({ ...current, algorithm: value as any }))}
                          ariaLabel="Algorithm"
                          portalMenu
                          className="w-full"
                          options={[
                            { value: "am", label: "Amplitude Modulation" },
                            { value: "fm", label: "Frequency Modulation" },
                            { value: "dotGain", label: "Dot Gain / Concentric" },
                          ]}
                        />
                      </div>

                      {/* Fit Mode */}
                      <div className="space-y-1">
                        <label className="text-[11px] text-gray-400">Fit Mode</label>
                        <ThemedSelect
                          value={halftoneOptions.fitMode}
                          onChange={(value) => setHalftoneOptions((current) => ({ ...current, fitMode: value as any }))}
                          ariaLabel="Fit mode"
                          portalMenu
                          className="w-full"
                          options={[
                            { value: "fit", label: "Fit" },
                            { value: "fill", label: "Fill" },
                            { value: "original", label: "Original" },
                          ]}
                        />
                      </div>

                      {/* Blur Slider */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-gray-400">
                          <span>Blur</span>
                          <span className="font-mono text-gray-200">{halftoneOptions.blur}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="20"
                          value={halftoneOptions.blur}
                          onChange={(e) => setHalftoneOptions(p => ({ ...p, blur: Number(e.target.value) }))}
                          className="liquid-slider"
                          style={{ "--range-progress": getSliderProgress(halftoneOptions.blur, 0, 20) } as React.CSSProperties}
                        />
                      </div>

                      {/* Gamma Slider */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-gray-400">
                          <span>Gamma</span>
                          <span className="font-mono text-gray-200">{halftoneOptions.gamma.toFixed(1)}</span>
                        </div>
                        <input
                          type="range"
                          min="0.1"
                          max="3.0"
                          step="0.1"
                          value={halftoneOptions.gamma}
                          onChange={(e) => setHalftoneOptions(p => ({ ...p, gamma: Number(e.target.value) }))}
                          className="liquid-slider"
                          style={{ "--range-progress": getSliderProgress(halftoneOptions.gamma, 0.1, 3.0) } as React.CSSProperties}
                        />
                      </div>

                      {/* Contrast Slider */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-gray-400">
                          <span>Contrast</span>
                          <span className="font-mono text-gray-200">{halftoneOptions.contrast}</span>
                        </div>
                        <input
                          type="range"
                          min="-100"
                          max="100"
                          value={halftoneOptions.contrast}
                          onChange={(e) => setHalftoneOptions(p => ({ ...p, contrast: Number(e.target.value) }))}
                          className="liquid-slider"
                          style={{ "--range-progress": getSliderProgress(halftoneOptions.contrast, -100, 100) } as React.CSSProperties}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Grid Settings */}
                <div className="border border-[#252a31] rounded-xl bg-[#17191e] overflow-hidden">
                  <button
                    onClick={() => toggleSection("grid")}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-gray-300 hover:text-white transition"
                  >
                    <div className="flex items-center gap-2">
                      <Grid3X3 size={14} className="text-[#16c784]" />
                      <span>Grid Settings</span>
                    </div>
                    {openSections.grid ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {openSections.grid && (
                    <div className="p-3 border-t border-[#252a31] space-y-3 text-xs">
                      {/* Grid Type */}
                      <div className="space-y-1">
                        <label className="text-[11px] text-gray-400">Grid Type</label>
                        <ThemedSelect
                          value={halftoneOptions.gridType}
                          onChange={(value) => setHalftoneOptions((current) => ({ ...current, gridType: value as any }))}
                          ariaLabel="Grid type"
                          portalMenu
                          className="w-full"
                          options={[
                            { value: "square", label: "Square" },
                            { value: "hexagonal", label: "Hexagonal" },
                            { value: "radial", label: "Radial" },
                          ]}
                        />
                      </div>

                      {/* Spacing */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-gray-400">
                          <span>Spacing</span>
                          <span className="font-mono text-gray-200">{halftoneOptions.spacing}</span>
                        </div>
                        <input
                          type="range"
                          min="4"
                          max="40"
                          value={halftoneOptions.spacing}
                          onChange={(e) => setHalftoneOptions(p => ({ ...p, spacing: Number(e.target.value) }))}
                          className="liquid-slider"
                          style={{ "--range-progress": getSliderProgress(halftoneOptions.spacing, 4, 40) } as React.CSSProperties}
                        />
                      </div>

                      {/* Rotation */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-gray-400">
                          <span>Rotation</span>
                          <span className="font-mono text-gray-200">{halftoneOptions.rotation}°</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="360"
                          value={halftoneOptions.rotation}
                          onChange={(e) => setHalftoneOptions(p => ({ ...p, rotation: Number(e.target.value) }))}
                          className="liquid-slider"
                          style={{ "--range-progress": getSliderProgress(halftoneOptions.rotation, 0, 360) } as React.CSSProperties}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Sampling & Channels */}
                <div className="border border-[#252a31] rounded-xl bg-[#17191e] overflow-hidden">
                  <button
                    onClick={() => toggleSection("sampling")}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-gray-300 hover:text-white transition"
                  >
                    <div className="flex items-center gap-2">
                      <Layers size={14} className="text-[#16c784]" />
                      <span>Sampling & Channels</span>
                    </div>
                    {openSections.sampling ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {openSections.sampling && (
                    <div className="p-3 border-t border-[#252a31] space-y-3 text-xs">
                      <div className="space-y-1">
                        <label className="text-[11px] text-gray-400">Channel</label>
                        <ThemedSelect
                          value={halftoneOptions.channel}
                          onChange={(value) => setHalftoneOptions((current) => ({ ...current, channel: value as any }))}
                          ariaLabel="Color channel"
                          portalMenu
                          className="w-full"
                          options={[
                            { value: "invLum", label: "Inverse Luminance" },
                            { value: "lum", label: "Luminance" },
                            { value: "red", label: "Red" },
                            { value: "green", label: "Green" },
                            { value: "blue", label: "Blue" },
                          ]}
                        />
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-gray-300">Invert Channel</span>
                        <input
                          type="checkbox"
                          checked={halftoneOptions.invertChannel}
                          onChange={(e) => setHalftoneOptions(p => ({ ...p, invertChannel: e.target.checked }))}
                          className="w-4 h-4 accent-[#16c784] cursor-pointer"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Dots & Patterns */}
                <div className="border border-[#252a31] rounded-xl bg-[#17191e] overflow-hidden">
                  <button
                    onClick={() => toggleSection("dots")}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-gray-300 hover:text-white transition"
                  >
                    <div className="flex items-center gap-2">
                      <CircleDot size={14} className="text-[#16c784]" />
                      <span>Dots & Patterns</span>
                    </div>
                    {openSections.dots ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {openSections.dots && (
                    <div className="p-3 border-t border-[#252a31] space-y-3 text-xs">
                      <div className="space-y-1">
                        <label className="text-[11px] text-gray-400">Style</label>
                        <ThemedSelect
                          value={halftoneOptions.dotStyle}
                          onChange={(value) => setHalftoneOptions((current) => ({ ...current, dotStyle: value as any }))}
                          ariaLabel="Dot style"
                          portalMenu
                          className="w-full"
                          options={[
                            { value: "circle", label: "Circle" },
                            { value: "square", label: "Square" },
                            { value: "diamond", label: "Diamond" },
                            { value: "cross", label: "Cross" },
                            { value: "ring", label: "Ring" },
                            { value: "line", label: "Line / Stripe" },
                          ]}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-gray-300">Outline Mode</span>
                        <input
                          type="checkbox"
                          checked={halftoneOptions.outlineMode}
                          onChange={(e) => setHalftoneOptions(p => ({ ...p, outlineMode: e.target.checked }))}
                          className="w-4 h-4 accent-[#16c784] cursor-pointer"
                        />
                      </div>

                      {/* Min Size */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-gray-400">
                          <span>Min Size</span>
                          <span className="font-mono text-gray-200">{halftoneOptions.minSize}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1.0"
                          step="0.05"
                          value={halftoneOptions.minSize}
                          onChange={(e) => setHalftoneOptions(p => ({ ...p, minSize: Number(e.target.value) }))}
                          className="liquid-slider"
                          style={{ "--range-progress": getSliderProgress(halftoneOptions.minSize, 0, 1.0) } as React.CSSProperties}
                        />
                      </div>

                      {/* Max Size */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-gray-400">
                          <span>Max Size</span>
                          <span className="font-mono text-gray-200">{halftoneOptions.maxSize}</span>
                        </div>
                        <input
                          type="range"
                          min="0.1"
                          max="2.5"
                          step="0.05"
                          value={halftoneOptions.maxSize}
                          onChange={(e) => setHalftoneOptions(p => ({ ...p, maxSize: Number(e.target.value) }))}
                          className="liquid-slider"
                          style={{ "--range-progress": getSliderProgress(halftoneOptions.maxSize, 0.1, 2.5) } as React.CSSProperties}
                        />
                      </div>

                      {/* Global Size */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-gray-400">
                          <span>Global Size</span>
                          <span className="font-mono text-gray-200">{halftoneOptions.globalSize}</span>
                        </div>
                        <input
                          type="range"
                          min="0.1"
                          max="3.0"
                          step="0.1"
                          value={halftoneOptions.globalSize}
                          onChange={(e) => setHalftoneOptions(p => ({ ...p, globalSize: Number(e.target.value) }))}
                          className="liquid-slider"
                          style={{ "--range-progress": getSliderProgress(halftoneOptions.globalSize, 0.1, 3.0) } as React.CSSProperties}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Colors & Palette */}
                <div className="border border-[#252a31] rounded-xl bg-[#17191e] overflow-hidden">
                  <button
                    onClick={() => toggleSection("palette")}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-gray-300 hover:text-white transition"
                  >
                    <div className="flex items-center gap-2">
                      <Palette size={14} className="text-[#16c784]" />
                      <span>Colors & Palette</span>
                    </div>
                    {openSections.palette ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {openSections.palette && (
                    <div className="p-3 border-t border-[#252a31] space-y-3 text-xs">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col gap-1 items-center">
                          <span className="text-[10px] text-gray-400">Dots</span>
                          <input
                            type="color"
                            value={halftoneOptions.fgColor}
                            onChange={(e) => setHalftoneOptions(p => ({ ...p, fgColor: e.target.value }))}
                            className="w-10 h-10 rounded-lg cursor-pointer border border-[#2e3748] p-0.5 bg-transparent"
                          />
                        </div>
                        <div className="flex flex-col gap-1 items-center">
                          <span className="text-[10px] text-gray-400">Background</span>
                          <input
                            type="color"
                            value={halftoneOptions.bgColor}
                            onChange={(e) => setHalftoneOptions(p => ({ ...p, bgColor: e.target.value }))}
                            className="w-10 h-10 rounded-lg cursor-pointer border border-[#2e3748] p-0.5 bg-transparent"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={handleRandomizeHalftonePalette}
                          className="flex-1 py-1.5 bg-[#16c784] hover:bg-[#27e39a] text-[#07080b] font-bold text-xs rounded-lg transition"
                        >
                          Randomize
                        </button>
                        <button
                          onClick={() => setHalftoneOptions(p => ({ ...p, fgColor: "#ffffff", bgColor: "#000000" }))}
                          className="flex-1 py-1.5 bg-[#20242a] hover:bg-[#30363e] text-gray-300 border border-[#30363e] text-xs rounded-lg transition"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Export */}
                <div className="border border-[#252a31] rounded-xl bg-[#17191e] overflow-hidden">
                  <button
                    onClick={() => toggleSection("export")}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-gray-300 hover:text-white transition"
                  >
                    <div className="flex items-center gap-2">
                      <Download size={14} className="text-[#16c784]" />
                      <span>Export</span>
                    </div>
                    {openSections.export ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {openSections.export && (
                    <div className="p-3 border-t border-[#252a31] space-y-2.5 text-xs">
                      <div className="space-y-1">
                        <label className="text-[11px] text-gray-400">PNG Scale</label>
                        <ThemedSelect
                          value={String(exportScale)}
                          onChange={(value) => setExportScale(Number(value))}
                          ariaLabel="Halftone PNG scale"
                          portalMenu
                          className="w-full"
                          options={[
                            { value: "1", label: "1x Scale" },
                            { value: "2", label: "2x Scale" },
                            { value: "4", label: "4x Scale" },
                          ]}
                        />
                      </div>

                      <button
                        onClick={handleDownloadHalftonePNG}
                        disabled={!image}
                        className="w-full py-2.5 bg-[#16c784] hover:bg-[#27e39a] disabled:opacity-40 text-[#07080b] font-black text-xs rounded-xl shadow-md transition"
                      >
                        Download PNG
                      </button>
                      <button
                        onClick={handleDownloadHalftoneSVG}
                        disabled={!image}
                        className="w-full py-2 bg-[#20242a] hover:bg-[#30363e] disabled:opacity-40 text-gray-300 border border-[#30363e] text-xs font-semibold rounded-xl transition"
                      >
                        Download SVG (Vector)
                      </button>
                      <button
                        onClick={handleCopyHalftoneToClipboard}
                        disabled={!image}
                        className="w-full py-2 bg-[#20242a] hover:bg-[#30363e] disabled:opacity-40 text-gray-300 border border-[#30363e] text-xs font-semibold rounded-xl transition"
                      >
                        Copy to Clipboard
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* --- DITHER SPECIFIC CONTROLS --- */}
            {activeStudioMode === "dither" && (
              <>
                {/* Image Adjustments */}
                <div className="border border-[#252a31] rounded-xl bg-[#17191e] overflow-hidden">
                  <button
                    onClick={() => toggleSection("adjustments")}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-gray-300 hover:text-white transition"
                  >
                    <div className="flex items-center gap-2">
                      <Sliders size={14} className="text-[#16c784]" />
                      <span>Image Adjustments</span>
                    </div>
                    {openSections.adjustments ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {openSections.adjustments && (
                    <div className="p-3 border-t border-[#252a31] space-y-2.5 text-xs">
                      {/* Highlights */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-gray-400">
                          <span>Highlights</span>
                          <span className="font-mono text-gray-200">{ditherOptions.highlights}</span>
                        </div>
                        <input
                          type="range"
                          min="-100"
                          max="100"
                          value={ditherOptions.highlights}
                          onChange={(e) => setDitherOptions(p => ({ ...p, highlights: Number(e.target.value) }))}
                          className="liquid-slider"
                          style={{ "--range-progress": getSliderProgress(ditherOptions.highlights, -100, 100) } as React.CSSProperties}
                        />
                      </div>

                      {/* Midtones */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-gray-400">
                          <span>Midtones</span>
                          <span className="font-mono text-gray-200">{ditherOptions.midtones}</span>
                        </div>
                        <input
                          type="range"
                          min="-100"
                          max="100"
                          value={ditherOptions.midtones}
                          onChange={(e) => setDitherOptions(p => ({ ...p, midtones: Number(e.target.value) }))}
                          className="liquid-slider"
                          style={{ "--range-progress": getSliderProgress(ditherOptions.midtones, -100, 100) } as React.CSSProperties}
                        />
                      </div>

                      {/* Shadows */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-gray-400">
                          <span>Shadows</span>
                          <span className="font-mono text-gray-200">{ditherOptions.shadows}</span>
                        </div>
                        <input
                          type="range"
                          min="-100"
                          max="100"
                          value={ditherOptions.shadows}
                          onChange={(e) => setDitherOptions(p => ({ ...p, shadows: Number(e.target.value) }))}
                          className="liquid-slider"
                          style={{ "--range-progress": getSliderProgress(ditherOptions.shadows, -100, 100) } as React.CSSProperties}
                        />
                      </div>

                      {/* Brightness */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-gray-400">
                          <span>Brightness</span>
                          <span className="font-mono text-gray-200">{ditherOptions.brightness}</span>
                        </div>
                        <input
                          type="range"
                          min="-100"
                          max="100"
                          value={ditherOptions.brightness}
                          onChange={(e) => setDitherOptions(p => ({ ...p, brightness: Number(e.target.value) }))}
                          className="liquid-slider"
                          style={{ "--range-progress": getSliderProgress(ditherOptions.brightness, -100, 100) } as React.CSSProperties}
                        />
                      </div>

                      {/* Contrast */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-gray-400">
                          <span>Contrast</span>
                          <span className="font-mono text-gray-200">{ditherOptions.contrast}</span>
                        </div>
                        <input
                          type="range"
                          min="-100"
                          max="100"
                          value={ditherOptions.contrast}
                          onChange={(e) => setDitherOptions(p => ({ ...p, contrast: Number(e.target.value) }))}
                          className="liquid-slider"
                          style={{ "--range-progress": getSliderProgress(ditherOptions.contrast, -100, 100) } as React.CSSProperties}
                        />
                      </div>

                      {/* Invert Source */}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-gray-300">Invert Source</span>
                        <input
                          type="checkbox"
                          checked={ditherOptions.invertSource}
                          onChange={(e) => setDitherOptions(p => ({ ...p, invertSource: e.target.checked }))}
                          className="w-4 h-4 accent-[#16c784] cursor-pointer"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Algorithm */}
                <div className="border border-[#252a31] rounded-xl bg-[#17191e] overflow-hidden">
                  <button
                    onClick={() => toggleSection("algorithm")}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-gray-300 hover:text-white transition"
                  >
                    <div className="flex items-center gap-2">
                      <Cpu size={14} className="text-[#16c784]" />
                      <span>Algorithm</span>
                    </div>
                    {openSections.algorithm ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {openSections.algorithm && (
                    <div className="p-3 border-t border-[#252a31] space-y-2.5 text-xs">
                      {/* Method */}
                      <div className="space-y-1">
                        <label className="text-[11px] text-gray-400">Method</label>
                        <ThemedSelect
                          value={ditherOptions.method}
                          onChange={(value) => setDitherOptions((current) => ({ ...current, method: value as any }))}
                          ariaLabel="Dither method"
                          portalMenu
                          className="w-full"
                          options={[
                            { value: "bayer8", label: "Bayer 8×8 (Classic)" },
                            { value: "bayer4", label: "Bayer 4×4" },
                            { value: "bayer2", label: "Bayer 2×2" },
                            { value: "floydSteinberg", label: "Floyd-Steinberg" },
                            { value: "atkinson", label: "Atkinson (Mac Classic)" },
                            { value: "sierraLite", label: "Sierra Lite" },
                            { value: "burkes", label: "Burkes" },
                            { value: "stucki", label: "Stucki" },
                            { value: "noise", label: "Random Noise" },
                          ]}
                        />
                      </div>

                      {/* Pixel Size */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-gray-400">
                          <span>Pixel Size</span>
                          <span className="font-mono text-gray-200">{ditherOptions.pixelSize}</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="16"
                          value={ditherOptions.pixelSize}
                          onChange={(e) => setDitherOptions(p => ({ ...p, pixelSize: Number(e.target.value) }))}
                          className="liquid-slider"
                          style={{ "--range-progress": getSliderProgress(ditherOptions.pixelSize, 1, 16) } as React.CSSProperties}
                        />
                      </div>

                      {/* Filter Threshold */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-gray-400">
                          <span>Filter Threshold</span>
                          <span className="font-mono text-gray-200">{ditherOptions.filterThreshold}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="255"
                          value={ditherOptions.filterThreshold}
                          onChange={(e) => setDitherOptions(p => ({ ...p, filterThreshold: Number(e.target.value) }))}
                          className="liquid-slider"
                          style={{ "--range-progress": getSliderProgress(ditherOptions.filterThreshold, 0, 255) } as React.CSSProperties}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Image Effects */}
                <div className="border border-[#252a31] rounded-xl bg-[#17191e] overflow-hidden">
                  <button
                    onClick={() => toggleSection("effects")}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-gray-300 hover:text-white transition"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles size={14} className="text-[#16c784]" />
                      <span>Image Effects</span>
                    </div>
                    {openSections.effects ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {openSections.effects && (
                    <div className="p-3 border-t border-[#252a31] space-y-2.5 text-xs">
                      {/* Blur */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-gray-400">
                          <span>Blur</span>
                          <span className="font-mono text-gray-200">{ditherOptions.blur}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="20"
                          value={ditherOptions.blur}
                          onChange={(e) => setDitherOptions(p => ({ ...p, blur: Number(e.target.value) }))}
                          className="liquid-slider"
                          style={{ "--range-progress": getSliderProgress(ditherOptions.blur, 0, 20) } as React.CSSProperties}
                        />
                      </div>

                      {/* Grain */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-gray-400">
                          <span>Grain</span>
                          <span className="font-mono text-gray-200">{ditherOptions.grain}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={ditherOptions.grain}
                          onChange={(e) => setDitherOptions(p => ({ ...p, grain: Number(e.target.value) }))}
                          className="liquid-slider"
                          style={{ "--range-progress": getSliderProgress(ditherOptions.grain, 0, 100) } as React.CSSProperties}
                        />
                      </div>

                      {/* Posterize */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-gray-400">
                          <span>Posterize</span>
                          <span className="font-mono text-gray-200">{ditherOptions.posterize}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="16"
                          value={ditherOptions.posterize}
                          onChange={(e) => setDitherOptions(p => ({ ...p, posterize: Number(e.target.value) }))}
                          className="liquid-slider"
                          style={{ "--range-progress": getSliderProgress(ditherOptions.posterize, 0, 16) } as React.CSSProperties}
                        />
                      </div>

                      {/* Pixelate */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-gray-400">
                          <span>Pixelate</span>
                          <span className="font-mono text-gray-200">{ditherOptions.pixelate}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="20"
                          value={ditherOptions.pixelate}
                          onChange={(e) => setDitherOptions(p => ({ ...p, pixelate: Number(e.target.value) }))}
                          className="liquid-slider"
                          style={{ "--range-progress": getSliderProgress(ditherOptions.pixelate, 0, 20) } as React.CSSProperties}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Colors & Palette */}
                <div className="border border-[#252a31] rounded-xl bg-[#17191e] overflow-hidden">
                  <button
                    onClick={() => toggleSection("palette")}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-gray-300 hover:text-white transition"
                  >
                    <div className="flex items-center gap-2">
                      <Palette size={14} className="text-[#16c784]" />
                      <span>Colors & Palette</span>
                    </div>
                    {openSections.palette ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {openSections.palette && (
                    <div className="p-3 border-t border-[#252a31] space-y-3 text-xs">
                      <div className="space-y-1">
                        <label className="text-[11px] text-gray-400">Color Palette</label>
                        <ThemedSelect
                          value={String(ditherOptions.colorCount)}
                          onChange={(value) => {
                            const val = value as any;
                            setDitherOptions(p => ({
                              ...p,
                              colorCount: val,
                              colors: PRESET_PALETTES[val] || PRESET_PALETTES['2'],
                            }));
                          }}
                          ariaLabel="Color palette"
                          portalMenu
                          className="w-full"
                          options={[
                            { value: "2", label: "2 Colors (Custom / 1-Bit)" },
                            { value: "4", label: "Game Boy (4 Colors)" },
                            { value: "cyberpunk", label: "Cyberpunk Neon" },
                            { value: "amber", label: "Amber CRT Monochrome" },
                            { value: "sepia", label: "Vintage Sepia Newspaper" },
                          ]}
                        />
                      </div>

                      {/* Swatches */}
                      <div className="flex flex-wrap gap-2 items-center">
                        {ditherOptions.colors.map((c, idx) => (
                          <div key={idx} className="relative">
                            <input
                              type="color"
                              value={c}
                              onChange={(e) => {
                                const newC = [...ditherOptions.colors];
                                newC[idx] = e.target.value;
                                setDitherOptions(p => ({ ...p, colors: newC }));
                              }}
                              className="w-8 h-8 rounded-lg cursor-pointer border border-[#2e3748] p-0.5 bg-transparent"
                            />
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={handleRandomizeDitherPalette}
                        className="w-full py-1.5 bg-[#20242a] hover:bg-[#30363e] text-gray-300 border border-[#30363e] text-xs font-semibold rounded-lg transition"
                      >
                        Randomize Palette
                      </button>
                    </div>
                  )}
                </div>

                {/* Export */}
                <div className="border border-[#252a31] rounded-xl bg-[#17191e] overflow-hidden">
                  <button
                    onClick={() => toggleSection("export")}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-gray-300 hover:text-white transition"
                  >
                    <div className="flex items-center gap-2">
                      <Download size={14} className="text-[#16c784]" />
                      <span>Export</span>
                    </div>
                    {openSections.export ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {openSections.export && (
                    <div className="p-3 border-t border-[#252a31] space-y-2.5 text-xs">
                      <div className="space-y-1">
                        <label className="text-[11px] text-gray-400">PNG Scale</label>
                        <ThemedSelect
                          value={String(exportScale)}
                          onChange={(value) => setExportScale(Number(value))}
                          ariaLabel="Dither PNG scale"
                          portalMenu
                          className="w-full"
                          options={[
                            { value: "1", label: "1x Scale" },
                            { value: "2", label: "2x Scale" },
                            { value: "4", label: "4x Scale" },
                          ]}
                        />
                      </div>

                      <button
                        onClick={handleDownloadDitherPNG}
                        disabled={!image}
                        className="w-full py-2.5 bg-[#16c784] hover:bg-[#27e39a] disabled:opacity-40 text-[#07080b] font-black text-xs rounded-xl shadow-md transition"
                      >
                        Download PNG
                      </button>
                      <button
                        onClick={handleDownloadDitherSVG}
                        disabled={!image}
                        className="w-full py-2 bg-[#20242a] hover:bg-[#30363e] disabled:opacity-40 text-gray-300 border border-[#30363e] text-xs font-semibold rounded-xl transition"
                      >
                        Download SVG (Vector)
                      </button>
                      <button
                        onClick={handleCopyDitherToClipboard}
                        disabled={!image}
                        className="w-full py-2 bg-[#20242a] hover:bg-[#30363e] disabled:opacity-40 text-gray-300 border border-[#30363e] text-xs font-semibold rounded-xl transition"
                      >
                        Copy to Clipboard
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* --- ASCII SPECIFIC CONTROLS --- */}
            {activeStudioMode === "ascii" && (
              <>
                {/* Settings Section */}
                <div className="border border-[#252a31] rounded-xl bg-[#17191e] overflow-hidden">
                  <button
                    onClick={() => toggleSection("adjustments")}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-gray-300 hover:text-white transition"
                  >
                    <div className="flex items-center gap-2">
                      <Terminal size={14} className="text-[#16c784]" />
                      <span>Grid & Characters</span>
                    </div>
                    {openSections.adjustments ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {openSections.adjustments && (
                    <div className="p-3 border-t border-[#252a31] space-y-3 text-xs">
                      {/* Grid Width Slider */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-gray-400">
                          <span>Grid width</span>
                          <span className="font-mono text-gray-200">{asciiOptions.gridWidth}</span>
                        </div>
                        <input
                          type="range"
                          min="10"
                          max="400"
                          value={asciiOptions.gridWidth}
                          onChange={(e) => setAsciiOptions(p => ({ ...p, gridWidth: parseInt(e.target.value) }))}
                          className="liquid-slider"
                          style={{ "--range-progress": getSliderProgress(asciiOptions.gridWidth, 10, 400) } as React.CSSProperties}
                        />
                      </div>

                      {/* Font Size Slider */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-gray-400">
                          <span>Font size</span>
                          <span className="font-mono text-gray-200">{asciiOptions.fontSize}px</span>
                        </div>
                        <input
                          type="range"
                          min="5"
                          max="20"
                          value={asciiOptions.fontSize}
                          onChange={(e) => setAsciiOptions(p => ({ ...p, fontSize: parseInt(e.target.value) }))}
                          className="liquid-slider"
                          style={{ "--range-progress": getSliderProgress(asciiOptions.fontSize, 5, 20) } as React.CSSProperties}
                        />
                      </div>

                      {/* Line Height Slider */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-gray-400">
                          <span>Line height</span>
                          <span className="font-mono text-gray-200">{asciiOptions.lineHeight}</span>
                        </div>
                        <input
                          type="range"
                          min="0.1"
                          max="2.0"
                          step="0.1"
                          value={asciiOptions.lineHeight}
                          onChange={(e) => setAsciiOptions(p => ({ ...p, lineHeight: parseFloat(e.target.value) }))}
                          className="liquid-slider"
                          style={{ "--range-progress": getSliderProgress(asciiOptions.lineHeight, 0.1, 2) } as React.CSSProperties}
                        />
                      </div>

                      {/* Character Set */}
                      <div className="space-y-1">
                        <label className="text-[11px] text-gray-400">Character set</label>
                        <ThemedSelect
                          value={asciiOptions.charSet}
                          onChange={(value) => setAsciiOptions(p => ({ ...p, charSet: value as CharSet }))}
                          ariaLabel="Character set"
                          portalMenu
                          className="w-full"
                          options={[
                            { value: "standard", label: "Standard" },
                            { value: "dense", label: "Dense" },
                            { value: "light", label: "Light" },
                            { value: "blocks", label: "Blocks" },
                            { value: "custom", label: "Custom" },
                          ]}
                        />
                      </div>

                      {asciiOptions.charSet === "custom" && (
                        <div className="space-y-1 pt-1">
                          <label className="text-[11px] text-gray-400">Custom characters</label>
                          <input
                            type="text"
                            value={asciiOptions.customChars}
                            onChange={(e) => setAsciiOptions(p => ({ ...p, customChars: e.target.value }))}
                            placeholder="e.g. .:-=+*#%@"
                            className="w-full bg-[#20242a] border border-[#30363e] text-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none"
                          />
                        </div>
                      )}

                      {/* Invert & Colored Toggles */}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-gray-300">Invert Luminance</span>
                        <input
                          type="checkbox"
                          checked={asciiOptions.invert}
                          onChange={(e) => setAsciiOptions(p => ({ ...p, invert: e.target.checked }))}
                          className="w-4 h-4 accent-[#16c784] cursor-pointer"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-gray-300">Colored Text</span>
                        <input
                          type="checkbox"
                          checked={asciiOptions.colored}
                          onChange={(e) => setAsciiOptions(p => ({ ...p, colored: e.target.checked }))}
                          className="w-4 h-4 accent-[#16c784] cursor-pointer"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* ASCII Export */}
                <div className="border border-[#252a31] rounded-xl bg-[#17191e] overflow-hidden">
                  <button
                    onClick={() => toggleSection("export")}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-gray-300 hover:text-white transition"
                  >
                    <div className="flex items-center gap-2">
                      <Download size={14} className="text-[#16c784]" />
                      <span>Export</span>
                    </div>
                    {openSections.export ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {openSections.export && (
                    <div className="p-3 border-t border-[#252a31] space-y-2 text-xs">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={handleCopyAsciiText}
                          disabled={!image}
                          className="py-2 px-2.5 rounded-lg bg-[#20242a] hover:bg-[#30363e] text-gray-300 border border-[#30363e] font-medium flex items-center justify-center gap-1.5 transition"
                        >
                          <Copy size={13} />
                          <span>Copy Text</span>
                        </button>
                        <button
                          onClick={handleDownloadAsciiTxt}
                          disabled={!image}
                          className="py-2 px-2.5 rounded-lg bg-[#20242a] hover:bg-[#30363e] text-gray-300 border border-[#30363e] font-medium flex items-center justify-center gap-1.5 transition"
                        >
                          <FileText size={13} />
                          <span>Save TXT</span>
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={handleDownloadAsciiPNG}
                          disabled={!image}
                          className="py-2 px-2.5 rounded-lg bg-[#16c784] hover:bg-[#27e39a] text-[#07080b] font-bold flex items-center justify-center gap-1.5 transition"
                        >
                          <FileImage size={13} />
                          <span>Save PNG</span>
                        </button>
                        <button
                          onClick={handleCopyAsciiPNG}
                          disabled={!image}
                          className="py-2 px-2.5 rounded-lg bg-[#20242a] hover:bg-[#30363e] text-gray-300 border border-[#30363e] font-medium flex items-center justify-center gap-1.5 transition"
                        >
                          <Layers size={13} />
                          <span>Copy PNG</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

        </div>

        {/* Center Canvas / Preview Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#101114] relative overflow-hidden">
          {/* Subtle Studio Blueprint Grid Background */}
          <div
            className="retro-raster-grid absolute inset-0 pointer-events-none opacity-20"
            style={{
              backgroundImage:
                "linear-gradient(to right, #252b3b 1px, transparent 1px), linear-gradient(to bottom, #252b3b 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />

          {/* Viewport Content */}
          <div className="flex-1 overflow-auto p-4 sm:p-8 flex items-center justify-center custom-scrollbar relative z-10">
            {!image ? (
              <div className="flex flex-col items-center gap-4 text-center max-w-sm">
                <div className="w-20 h-20 rounded-3xl bg-[#16c784]/10 border border-dashed border-[#16c784]/30 flex items-center justify-center text-[#16c784]">
                  <ImageIcon size={36} />
                </div>
                <div>
                  <h3 className="text-white font-bold text-base mb-1">No Image Loaded</h3>
                  <p className="text-xs text-gray-400 mb-4">
                    Import an image from the sidebar to start creating.
                  </p>
                </div>
              </div>
            ) : (
              <div
                style={{
                  transform: `scale(${zoom / 100})`,
                  transformOrigin: "center center",
                  transition: "transform 0.15s ease-out",
                }}
                className="flex items-center justify-center"
              >
                {/* 1. Halftone Studio Canvas */}
                <div className={activeStudioMode === "halftone" ? "block" : "hidden"}>
                  <canvas
                    ref={halftoneCanvasRef}
                    className="rounded-lg shadow-2xl border border-white/10 max-w-full"
                  />
                </div>

                {/* 2. Dither Studio Canvas */}
                <div className={activeStudioMode === "dither" ? "block" : "hidden"}>
                  <canvas
                    ref={ditherCanvasRef}
                    className="rounded-lg shadow-2xl border border-white/10 max-w-full"
                  />
                </div>

                {/* 3. ASCII Studio: Framer Motion Morphing Container */}
                {activeStudioMode === "ascii" && (
                  <motion.div
                    layout
                    transition={{
                      type: "spring",
                      stiffness: 280,
                      damping: 24,
                      mass: 0.8,
                    }}
                    className="p-6 rounded-2xl bg-[#030712] border border-white/10 shadow-2xl overflow-hidden"
                  >
                    <motion.pre
                      layout
                      animate={{
                        fontSize: `${asciiOptions.fontSize}px`,
                        lineHeight: asciiOptions.lineHeight,
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 280,
                        damping: 24,
                        mass: 0.8,
                      }}
                      style={{
                        fontFamily: "monospace",
                        whiteSpace: "pre",
                        color:
                          asciiOptions.textColor === "inherit"
                            ? "#16c784"
                            : asciiOptions.textColor,
                      }}
                    >
                      {asciiOptions.colored ? (
                        coloredIRows.map((row, i) => (
                          <div
                            key={i}
                            style={{
                              height: `${asciiOptions.fontSize * asciiOptions.lineHeight}px`,
                            }}
                          >
                            {row.map((cell, j) => (
                              <span key={j} style={{ color: cell.color }}>
                                {cell.char}
                              </span>
                            ))}
                          </div>
                        ))
                      ) : (
                        asciiArt
                      )}
                    </motion.pre>
                  </motion.div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Floating Status Bar (matching screenshot layout) */}
          <div className="h-10 px-4 border-t border-[#252a31] bg-[#17191e]/90 backdrop-blur-md flex items-center justify-between text-[11px] text-gray-400 shrink-0 z-20">
            <div className="flex items-center gap-3 font-mono">
              <span>
                Zoom: <strong className="text-white">{zoom}%</strong>
              </span>
              <span className="text-gray-600">|</span>
              <span>
                Mode:{" "}
                <strong className="text-[#16c784] capitalize">
                  {activeStudioMode === "halftone"
                    ? "Halftone"
                    : activeStudioMode === "dither"
                    ? "Dithered"
                    : "ASCII Grid"}
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-3 font-mono">
              <span>
                Dimensions:{" "}
                <strong className="text-white">
                  {imageSize.width > 0 ? `${imageSize.width} × ${imageSize.height}` : "No image"}
                </strong>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
