"use client";

import NextImage from "next/image";
import { useState, useRef, useEffect } from "react";
import { Upload, Download, RefreshCw, Palette, ImagePlus, ChevronDown, Copy, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// --- Helpers ---
function rgbToHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join("").toUpperCase();
}

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

// Simple K-means algorithm to extract prominent colors
function extractColors(imageData: ImageData, colorCount: number) {
  const data = imageData.data;
  const pixels: number[][] = [];
  
  // Downsample drastically for speed (e.g. step by 16)
  for (let i = 0; i < data.length; i += 4 * 16) {
    const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
    // Ignore somewhat transparent or purely white/black (optional, but skipping pure transparent is needed)
    if (a > 125) pixels.push([r, g, b]);
  }

  if (pixels.length === 0) return Array.from({ length: colorCount }).map(() => [0,0,0]);

  // Initialize centroids by picking random pixels
  let centroids = [];
  for (let i = 0; i < colorCount; i++) {
    const randomPixel = pixels[Math.floor(Math.random() * pixels.length)];
    centroids.push(randomPixel ? [...randomPixel] : [...pixels[0]]);
  }

  // Iterate a few times to stabilize
  for (let iter = 0; iter < 10; iter++) {
    const clusters: number[][][] = Array.from({ length: colorCount }, () => []);
    
    // Assign pixels to nearest centroid
    for (const p of pixels) {
      let minDist = Infinity;
      let closestObj = 0;
      for (let c = 0; c < colorCount; c++) {
        const cent = centroids[c];
        const distSq = (p[0] - cent[0])**2 + (p[1] - cent[1])**2 + (p[2] - cent[2])**2;
        if (distSq < minDist) {
          minDist = distSq;
          closestObj = c;
        }
      }
      clusters[closestObj].push(p);
    }
    
    // Recalculate centroids
    for (let c = 0; c < colorCount; c++) {
      if (clusters[c].length === 0) continue;
      let sum = [0, 0, 0];
      for (const p of clusters[c]) {
        sum[0] += p[0]; sum[1] += p[1]; sum[2] += p[2];
      }
      centroids[c] = [
        sum[0] / clusters[c].length,
        sum[1] / clusters[c].length,
        sum[2] / clusters[c].length
      ];
    }
  }

  // Sort by darkness/lightness usually makes nicer palettes
  centroids.sort((a,b) => (b[0]+b[1]+b[2]) - (a[0]+a[1]+a[2]));

  return centroids;
}


interface ExtractedColor {
  r: number; g: number; b: number;
  hex: string;
  hsl: { h: number; s: number; l: number };
}

export default function ColorPalettePage() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [colorsCount, setColorsCount] = useState<number>(6);
  const [palette, setPalette] = useState<ExtractedColor[]>([]);
  const [pickedColor, setPickedColor] = useState<ExtractedColor | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const processImage = (src: string, colorCount: number) => {
    setIsProcessing(true);
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      // Scale down image for processing to save memory and time
      const maxDim = 200;
      let w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim/w, maxDim/h);
          w = Math.floor(w * ratio);
          h = Math.floor(h * ratio);
      }
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, w, h);
      
      const imgData = ctx.getImageData(0, 0, w, h);
      const centroids = extractColors(imgData, colorCount);
      
      const newPalette = centroids.map(c => {
         const r = Math.round(c[0]), g = Math.round(c[1]), b = Math.round(c[2]);
         return {
             r, g, b, 
             hex: rgbToHex(r, g, b),
             hsl: rgbToHsl(r, g, b)
         };
      });
      setPalette(newPalette);
      setIsProcessing(false);
    };
    img.src = src;
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith("image/")) return;

    const url = URL.createObjectURL(file);
    setImagePreview(url);
    setPickedColor(null);
    processImage(url, colorsCount);
  };

  useEffect(() => {
     if (imagePreview) {
         processImage(imagePreview, colorsCount);
     }
  }, [colorsCount]);

  const copyToClipboard = (text: string, index: number) => {
     navigator.clipboard.writeText(text);
     setCopiedIndex(index);
     setTimeout(() => setCopiedIndex(null), 1500);
  };

  const pickColorNative = async () => {
    if ('EyeDropper' in window) {
      try {
        const eyeDropper = new (window as any).EyeDropper();
        const result = await eyeDropper.open();
        // Result is { sRGBHex: "#ff0000" }
        // We'll trust they picked a color and add it to pickedColor
        const hex = result.sRGBHex.toUpperCase();
        // convert hex back to RGB
        const r = parseInt(hex.slice(1,3), 16);
        const g = parseInt(hex.slice(3,5), 16);
        const b = parseInt(hex.slice(5,7), 16);
        
        setPickedColor({
            r, g, b, hex, hsl: rgbToHsl(r, g, b)
        });
      } catch (e) {
        console.log("EyeDropper canceled");
      }
    } else {
        alert("Your browser doesn't support the EyeDropper API. Please click on the image itself if we implement drawing on canvas!");
    }
  };

  // Click on image to pick color using an invisible canvas
  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
      if (!imgRef.current || !canvasRef.current) return;
      
      const img = imgRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Make sure canvas matches image size
      if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          ctx.drawImage(img, 0, 0);
      }

      // Calculate the scaled click position
      const rect = img.getBoundingClientRect();
      const scaleX = img.naturalWidth / rect.width;
      const scaleY = img.naturalHeight / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

      const pixel = ctx.getImageData(x, y, 1, 1).data;
      const r = pixel[0], g = pixel[1], b = pixel[2];
      
      setPickedColor({
          r, g, b, 
          hex: rgbToHex(r, g, b),
          hsl: rgbToHsl(r, g, b)
      });
  };

  const exportAsCSS = () => {
    const cssVars = palette.map((c, i) => `--color-${i+1}: ${c.hex};`).join('\n');
    const css = `:root {\n${cssVars}\n}`;
    navigator.clipboard.writeText(css);
    alert("Palette exported & copied to clipboard as CSS variables!");
  };

  return (
    <div className="max-w-6xl mx-auto pb-20 pt-6 px-4 bg-background text-primary">
      {/* Hidden canvas for pixel picking */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <div className="flex items-center justify-between mb-8 border-b border-primary/20 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center shrink-0 border border-primary/20 shadow-sm">
            <Palette className="w-6 h-6 text-primary" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-[22px] font-bold text-primary tracking-tight leading-tight">Color palette</h1>
            <p className="text-primary/70 text-xs font-medium mt-0.5">Extract and pick colors from images</p>
          </div>
        </div>
        
        {palette.length > 0 && (
          <div className="relative">
            <button 
                onClick={() => setExportMenuOpen(!exportMenuOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-background rounded-lg text-sm font-bold shadow-md hover:bg-primary-hover transition-colors"
            >
              <Download className="w-4 h-4" /> Export palette <ChevronDown className="w-3.5 h-3.5 ml-1" />
            </button>
            {exportMenuOpen && (
               <div className="absolute top-12 right-0 bg-background border border-primary/20 shadow-2xl rounded-xl py-2 w-48 z-50 overflow-hidden">
                  <button onClick={() => { exportAsCSS(); setExportMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm font-semibold text-primary/80 hover:bg-primary/5">Copy as CSS Variables</button>
               </div>
            )}
          </div>
        )}
      </div>

      {!imagePreview ? (
        // Hero & Dropzone for Empty State
        <div className="w-full py-16 sm:py-24 text-center">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-primary tracking-tight mb-4">Image color picker</h1>
            <p className="text-primary/80 text-lg sm:text-xl font-medium mb-12 max-w-lg mx-auto">Extract beautiful color palettes from your photos instantly.</p>
            
            <div 
               className={`mx-auto max-w-2xl border-2 border-dashed rounded-3xl p-16 flex flex-col items-center justify-center bg-primary/5 transition-all cursor-pointer hover:bg-primary/10 ${isDragging ? 'border-primary bg-primary/15' : 'border-primary/20'}`}
               onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
               onDragLeave={() => setIsDragging(false)}
               onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
               onClick={() => fileInputRef.current?.click()}
             >
               <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => handleFiles(e.target.files)} />
               <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-primary/20">
                   <Upload className="w-7 h-7 text-primary stroke-[2]" />
               </div>
               <h3 className="text-lg font-bold text-primary mb-2">Drop your image here</h3>
               <p className="text-sm font-medium text-primary/60">or click to browse</p>
            </div>
        </div>
      ) : (
        // Results Area
        <div className="flex flex-col lg:flex-row gap-6 mt-6">
            
            {/* LEFT SIDE: Image Viewer */}
            <div className="w-full lg:flex-[1.2] flex flex-col gap-4">
                <div className="bg-background rounded-[24px] p-2 sm:p-4 shadow-sm border border-primary/20 relative group min-h-[300px] flex items-center justify-center overflow-hidden">
                    <div className="relative z-10 h-full max-h-[500px] w-full">
                        <NextImage 
                            ref={imgRef}
                            src={imagePreview} 
                            alt="Uploaded for palette" 
                            fill
                            unoptimized
                            onLoad={(e) => {
                                // Setup canvas silently when loaded so clicking works instantly
                                const c = canvasRef.current;
                                if (c && e.currentTarget) {
                                    c.width = e.currentTarget.naturalWidth;
                                    c.height = e.currentTarget.naturalHeight;
                                    const ctx = c.getContext("2d");
                                    if (ctx) ctx.drawImage(e.currentTarget, 0, 0);
                                }
                            }}
                            onClick={handleImageClick}
                            className="object-contain rounded-[18px] cursor-crosshair shadow-sm transition-transform duration-300"
                        />
                    </div>
                    
                    {isProcessing && (
                         <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-3">
                            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                            <span className="text-xs font-bold text-primary uppercase tracking-widest">Extracting Colors</span>
                          </div>
                    )}

                    <button 
                        onClick={pickColorNative} 
                        className="absolute bottom-6 left-6 z-30 flex items-center gap-2 px-4 py-2.5 bg-background border border-primary/25 rounded-full shadow-lg text-sm font-bold text-primary hover:bg-primary/5 transition-colors"
                    >
                        <span className="w-3 h-3 rounded-full border border-primary/30 bg-primary"></span> Click to pick a color
                    </button>
                    
                    {pickedColor && (
                        <div className="absolute top-6 left-6 z-30 flex items-center p-2 pr-4 bg-background rounded-2xl shadow-xl border border-primary/20 gap-3 animate-in slide-in-from-top-4">
                             <div className="w-10 h-10 rounded-xl border border-primary/30 shadow-inner" style={{ backgroundColor: pickedColor.hex }} />
                             <div className="flex flex-col">
                                 <span className="text-sm font-bold text-primary uppercase leading-tight">{pickedColor.hex}</span>
                                 <span className="text-[10px] font-semibold text-primary/60">Picked Color</span>
                             </div>
                        </div>
                    )}
                </div>

                <div 
                    onClick={() => { setImagePreview(null); setPalette([]); setPickedColor(null); }}
                    className="flex items-center gap-3 px-6 py-4 bg-primary/5 hover:bg-primary/10 border border-dashed border-primary/20 rounded-2xl cursor-pointer text-primary/70 transition-colors"
                >
                    <ImagePlus className="w-5 h-5 opacity-60" />
                    <span className="text-sm font-semibold">Click or drop to change image</span>
                </div>
            </div>

            {/* RIGHT SIDE: Extracted Palette */}
            <div className="w-full lg:flex-1 flex flex-col gap-6">
                
                {/* Palette Controls / Swatch Row Header */}
                <div className="flex flex-col gap-5 p-6 bg-background rounded-[24px] shadow-sm border border-primary/20">
                    <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3">
                             <span className="text-sm font-bold text-primary/80">Colors</span>
                             <select 
                                 value={colorsCount} 
                                 onChange={(e) => setColorsCount(Number(e.target.value))}
                                 className="appearance-none bg-background border border-primary/25 px-4 py-1.5 pr-8 rounded-lg text-sm font-bold text-primary cursor-pointer outline-none"
                             >
                                 {[2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}</option>)}
                             </select>
                         </div>
                         <button onClick={() => processImage(imagePreview, colorsCount)} className="p-2 hover:bg-primary/5 rounded-lg text-primary/70 transition-colors" title="Regenerate Palette">
                             <RefreshCw className="w-4 h-4" />
                         </button>
                    </div>

                    {/* Single continuous bar of colors */}
                    <div className="flex w-full h-10 rounded-xl overflow-hidden border border-primary/20 shadow-inner">
                        {palette.map((c, i) => (
                           <div key={i} className="flex-1 h-full font-bold text-[10px] uppercase text-white tracking-widest items-center justify-center bg-black/10" style={{ backgroundColor: c.hex }}></div>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col mb-2">
                    <h3 className="text-[11px] font-bold text-primary/60 uppercase tracking-widest pl-1">Extracted Palette</h3>
                </div>

                {/* Color Cards Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-4 pb-10">
                    <AnimatePresence>
                        {palette.map((color, i) => (
                            <motion.div
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: i * 0.05 }}
                                key={i}
                                className="group relative bg-background border border-primary/20 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col"
                            >
                                {/* Color Block */}
                                <div className="h-28 w-full p-4 flex items-end justify-between relative" style={{ backgroundColor: color.hex }}>
                                     {/* Darken/Lighten text based on color luminosity */}
                                     {(() => {
                                         const isLight = color.hsl.l > 60;
                                         return <span className={`text-[15px] font-bold uppercase tracking-wider ${isLight ? 'text-black/70' : 'text-white/90'}`}>{color.hex}</span>
                                     })()}

                                     <button 
                                        onClick={() => copyToClipboard(color.hex, i)}
                                        className={`absolute top-3 right-3 p-2 rounded-xl bg-primary/15 hover:bg-primary/30 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all ${color.hsl.l > 60 ? 'text-black/70' : 'text-white/90'}`}
                                     >
                                         {copiedIndex === i ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                     </button>
                                </div>
                                {/* Details */}
                                <div className="p-4 flex flex-col gap-2">
                                     <div className="flex items-center justify-between group/rgb cursor-pointer" onClick={() => copyToClipboard(`rgb(${color.r}, ${color.g}, ${color.b})`, i)}>
                                         <code className="text-[11px] font-bold text-primary/70">rgb({color.r}, {color.g}, {color.b})</code>
                                     </div>
                                     <div className="flex items-center justify-between group/hsl cursor-pointer" onClick={() => copyToClipboard(`hsl(${color.hsl.h}, ${color.hsl.s}%, ${color.hsl.l}%)`, i)}>
                                         <code className="text-[11px] font-bold text-primary/70">hsl({color.hsl.h}, {color.hsl.s}%, {color.hsl.l}%)</code>
                                     </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

            </div>
        </div>
      )}
    </div>
  );
}
