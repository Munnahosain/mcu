"use client";

import NextImage from "next/image";
import { useState, useRef } from "react";
import { Upload, Image as ImageIcon, Download, Trash2, Eraser, X, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface BgImage {
  id: string;
  file: File;
  preview: string;
  resultPreview?: string;
  status: "pending" | "processing" | "done" | "error";
  error?: string;
}

export default function BackgroundRemoverPage() {
  const [images, setImages] = useState<BgImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const newImages = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .map((file) => ({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
        status: "pending" as const,
      }));
    setImages((prev) => [...prev, ...newImages]);
  };

  const processImages = async () => {
    const pendingImages = images.filter((img) => img.status === "pending" || img.status === "error");
    if (!pendingImages.length) return;

    setIsProcessing(true);

    for (const img of pendingImages) {
      setImages((prev) =>
        prev.map((i) => (i.id === img.id ? { ...i, status: "processing" } : i))
      );

      try {
        const formData = new FormData();
        formData.append("image", img.file);

        const res = await fetch("/api/remove-bg", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to remove background");
        }

        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);

        setImages((prev) =>
          prev.map((i) =>
            i.id === img.id
              ? { ...i, status: "done", resultPreview: objectUrl }
              : i
          )
        );
      } catch (err: any) {
        console.error("Remove BG error for", img.file.name, err);
        setImages((prev) =>
          prev.map((i) =>
            i.id === img.id ? { ...i, status: "error", error: err.message } : i
          )
        );
      }
    }

    setIsProcessing(false);
  };

  const downloadImage = (img: BgImage) => {
    if (!img.resultPreview) return;
    const link = document.createElement("a");
    link.href = img.resultPreview;
    link.download = `no-bg-${img.file.name.replace(/\.[^/.]+$/, "")}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAll = () => {
    const doneImages = images.filter((i) => i.status === "done" && i.resultPreview);
    doneImages.forEach(downloadImage);
  };

  return (
    <div className="max-w-5xl mx-auto pb-20 pt-6 px-4">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 border border-primary/20 bg-primary/5 rounded-2xl flex items-center justify-center shrink-0 shadow-sm text-primary">
          <Eraser className="w-6 h-6 text-primary" strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-primary tracking-tight">Background Remover</h1>
          <p className="text-primary/75 text-sm font-semibold">Bulk remove backgrounds from images instantly</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Upload Card */}
        <div className="border border-primary/20 rounded-3xl p-6 md:p-8 bg-background">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 border border-primary/20 bg-primary/5 rounded-lg text-primary">
              <Upload className="w-4 h-4" strokeWidth={2.5} />
            </div>
            <h2 className="font-bold text-sm text-primary uppercase tracking-widest">Upload Images</h2>
          </div>

          <div
            className={`border-2 border-dashed rounded-3xl py-16 px-6 flex flex-col items-center justify-center text-center transition-colors cursor-pointer group ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-primary/20 hover:border-primary/40 hover:bg-primary/5 bg-background"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              accept="image/*"
              onChange={(e) => handleFiles(e.target.files)}
            />
            
            <div className="w-16 h-16 bg-primary/5 rounded-2xl shadow-sm border border-primary/10 flex items-center justify-center mb-6 group-hover:-translate-y-1 transition-transform duration-300 text-primary">
               <ImageIcon className="w-7 h-7 text-primary" />
            </div>
            <div className="flex flex-wrap justify-center gap-2 mb-5 text-[10px] font-bold text-primary">
              <span className="px-3.5 py-1.5 border border-primary/25 bg-primary/5 rounded-full shadow-sm">PNG</span>
              <span className="px-3.5 py-1.5 border border-primary/25 bg-primary/5 rounded-full shadow-sm">WEBP</span>
              <span className="px-3.5 py-1.5 border border-primary/25 bg-primary/5 rounded-full shadow-sm">JPG</span>
              <span className="px-3.5 py-1.5 border border-primary/25 bg-primary/5 rounded-full shadow-sm">JPEG</span>
            </div>
            <h3 className="font-bold text-[15px] text-primary mb-2">
              Drag & drop images, or <span className="underline decoration-primary/30 underline-offset-4 cursor-pointer hover:text-primary transition-colors">browse</span>
            </h3>
            <p className="text-xs text-primary/60 font-medium">Up to 500 images per session — bulk background removal (free to use)</p>
          </div>
        </div>

        {/* Action Bar (Only show if images exist) */}
        {images.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2 border-b border-primary/10 pb-4">
            <span className="text-xs font-bold text-primary">
              {images.length} {images.length === 1 ? "Image" : "Images"} Ready
            </span>
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                onClick={() => setImages([])}
                disabled={isProcessing}
                className="px-4 py-2 bg-transparent border border-primary/30 rounded-xl text-xs font-bold text-primary hover:bg-primary/5 disabled:opacity-50 transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear All
              </button>
              <button
                onClick={processImages}
                disabled={isProcessing || images.filter(i => i.status === 'pending' || i.status === 'error').length === 0}
                className="px-5 py-2 bg-primary text-background rounded-xl text-xs font-bold hover:bg-primary-hover disabled:opacity-40 transition-all flex items-center gap-1.5"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Eraser className="w-3.5 h-3.5" /> Remove BG
                  </>
                )}
              </button>
              {images.some((i) => i.status === "done") && (
                <button
                  onClick={downloadAll}
                  className="px-4 py-2 bg-primary text-background rounded-xl text-xs font-bold hover:bg-primary-hover transition-all flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Download All
                </button>
              )}
            </div>
          </div>
        )}

        {/* Results Area */}
        <div className="border border-primary/20 rounded-3xl p-6 md:p-8 bg-background min-h-[400px]">
          {images.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-16">
              <div className="w-16 h-16 border border-primary/20 bg-primary/5 rounded-2xl flex items-center justify-center mb-6 text-primary">
                <Eraser className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-lg text-primary mb-2">No images yet</h3>
              <p className="text-primary/75 text-sm max-w-sm mb-10 leading-relaxed font-semibold">
                Upload images above to remove backgrounds in bulk. Supports PNG, JPG, WEBP formats.
              </p>
              
              {/* Stepper visual */}
              <div className="flex items-center justify-center gap-4 text-primary/40 font-bold">
                 <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 border border-primary/20 bg-primary/5 rounded-xl flex items-center justify-center text-primary"><Upload className="w-5 h-5"/></div>
                    <span className="text-[10px] uppercase tracking-wider">Upload</span>
                 </div>
                 <ArrowRight />
                 <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 border border-primary/20 bg-primary/5 rounded-xl flex items-center justify-center text-primary"><Eraser className="w-5 h-5"/></div>
                    <span className="text-[10px] uppercase tracking-wider text-primary">Remove BG</span>
                 </div>
                 <ArrowRight />
                 <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 border border-primary/20 bg-primary/5 rounded-xl flex items-center justify-center text-primary"><Download className="w-5 h-5"/></div>
                    <span className="text-[10px] uppercase tracking-wider">Download</span>
                 </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              <AnimatePresence>
                {images.map((img) => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    key={img.id}
                    className="group relative bg-primary/5 rounded-2xl overflow-hidden border border-primary/15 aspect-square flex items-center justify-center"
                  >
                    {/* Checkered pattern background using primary color */}
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+Cgo8cmVjdCB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiMwMEU1RkYiIGZpbGwtb3BhY2l0eT0iMC4xNSIvPgo8cmVjdCB4PSIxMCIgeT0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iIzAwRTVGRiIgZmlsbC1vcGFjaXR5PSIwLjE1Ii8+Cjwvc3ZnPg==')] opacity-0 transition-opacity duration-300 pointer-events-none group-hover:opacity-100 z-0"></div>

                    {img.status === "processing" ? (
                      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-3">
                        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                        <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Processing</span>
                      </div>
                    ) : img.status === "error" ? (
                      <div className="absolute inset-0 bg-primary/5 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-2 p-4 text-center">
                        <X className="w-8 h-8 text-primary" />
                        <span className="text-[10px] font-bold text-primary capitalize">{img.error || "Failed"}</span>
                      </div>
                    ) : null}

                    <div className="relative w-full h-full p-2 z-10 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                      <NextImage
                        src={img.resultPreview || img.preview}
                        alt="Background removal preview"
                        fill
                        unoptimized
                        className={`object-contain p-2 ${img.status === 'processing' ? 'opacity-50' : 'opacity-100'}`}
                      />
                    </div>

                    {img.status === "done" && (
                      <div className="absolute top-2 left-2 z-20 bg-background border border-primary/30 text-primary rounded-full p-1 shadow-md">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    )}

                    <button
                      onClick={() => setImages((prev) => prev.filter((i) => i.id !== img.id))}
                      className="absolute top-2 right-2 z-20 bg-background border border-primary/20 text-primary p-1.5 rounded-full shadow-md transition-colors opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {img.status === "done" && img.resultPreview && (
                      <button
                        onClick={() => downloadImage(img)}
                        className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 bg-primary text-background px-4 py-1.5 rounded-full text-[10px] font-bold tracking-wider shadow-lg opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" /> Save
                      </button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ArrowRight() {
  return (
    <div className="text-primary/40">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 12H19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M12 5L19 12L12 19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

function RefreshCw({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}
