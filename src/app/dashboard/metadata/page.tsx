"use client";

import { useState } from "react";
import { UploadCloud, FileImage, Settings2, Play, DownloadCloud, Trash2, ImageIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getAuthUser, getDownloadsKey } from "@/lib/auth";
import { getProviderKeys, getProviderModels, syncProviderKeys } from "@/lib/ai-settings";
import { compressImageForUpload } from "@/lib/client-image";

type DownloadRecord = {
  id: string;
  fileName: string;
  type: "CSV";
  date: string;
  size: number;
  itemCount: number;
  content: string;
};

interface ImageFile {
  id: string;
  file: File;
  preview: string;
  status: 'pending' | 'generating' | 'done' | 'error';
  metadata?: {
    title: string;
    description: string;
    keywords: string[];
    category: string;
  };
}

export default function MetadataGeneratorPage() {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const [currentKeyIndex, setCurrentKeyIndex] = useState(0);

  // Handle File Select
  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const newImages = Array.from(files).filter(f => f.type.startsWith('image/')).map(file => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      status: 'pending' as const
    }));
    setImages(prev => [...prev, ...newImages]);
  };

  const generateMetadata = async (imgId?: string) => {
    const providerKeys = await syncProviderKeys();
    const apiKeys = providerKeys.map((item) => item.key);
    const provider = providerKeys[0]?.provider || 'Groq';
    const model = getProviderModels()[provider] || 'meta-llama/llama-4-scout-17b-16e-instruct';

    if (apiKeys.length === 0) {
      alert("Please configure your Groq API Keys in the Settings page.");
      return;
    }

    setIsGenerating(true);
    let keyIdx = currentKeyIndex;

    const targets = imgId
      ? images.filter(i => i.id === imgId && i.status !== 'done')
      : images.filter(i => i.status !== 'done');

    for (const img of targets) {
      setImages(prev => prev.map(i => i.id === img.id ? { ...i, status: 'generating' } : i));

      try {
        const formData = new FormData();
        formData.append("image", await compressImageForUpload(img.file));
        formData.append("apiKey", apiKeys[keyIdx]);
        formData.append("provider", provider);
        formData.append("model", model);

        const res = await fetch("/api/generate", {
          method: "POST",
          body: formData
        });

        const data = await res.json();

        if (!data.success) throw new Error(data.error);

        setImages(prev => prev.map(i => i.id === img.id ? { ...i, status: 'done', metadata: data.metadata } : i));

        keyIdx = (keyIdx + 1) % apiKeys.length;
        setCurrentKeyIndex(keyIdx);

      } catch (e: unknown) {
        console.error(e);
        setImages(prev => prev.map(i => i.id === img.id ? { ...i, status: 'error' } : i));
        keyIdx = (keyIdx + 1) % Math.max(apiKeys.length, 1);
        setCurrentKeyIndex(keyIdx);
      }
    }
    setIsGenerating(false);
  };

  const exportCSV = () => {
    const done = images.filter(i => i.status === 'done' && i.metadata);
    if (!done.length) {
      alert("No completed metadata to export yet.");
      return;
    }

    const esc = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const lines = [
      "Filename,Title,Keywords,Category,Description",
      ...done.map((img) => {
        const { title, keywords, category, description } = img.metadata!;
        const kws = Array.isArray(keywords) ? keywords.join(", ") : String(keywords ?? "");
        return [
          esc(img.file.name),
          esc(title),
          esc(kws),
          esc(category),
          esc(description)
        ].join(",");
      })
    ];

    try {
      const csvContent = lines.join("\r\n");
      const fileName = `mcu_stock_metadata_${Date.now()}.csv`;
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const user = getAuthUser();
      const historyKey = getDownloadsKey(user?.email);
      const existingRaw = localStorage.getItem(historyKey);
      let existing: DownloadRecord[] = [];
      if (existingRaw) {
        try {
          existing = JSON.parse(existingRaw) as DownloadRecord[];
        } catch {
          existing = [];
        }
      }
      const record: DownloadRecord = {
        id: crypto.randomUUID(),
        fileName,
        type: "CSV",
        date: new Date().toISOString(),
        size: blob.size,
        itemCount: done.length,
        content: csvContent,
      };
      localStorage.setItem(historyKey, JSON.stringify([record, ...existing]));
    } catch (e) {
      console.error(e);
      alert("CSV download failed. Please try again.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Stats / Action Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Images</p>
            <p className="text-2xl font-bold">{images.length}</p>
          </div>
          <div className="p-2 bg-primary/10 rounded-lg"><FileImage className="w-5 h-5 text-primary" /></div>
        </div>
        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">Pending</p>
            <p className="text-2xl font-bold">{images.filter(i => i.status === 'pending').length}</p>
          </div>
          <div className="p-2 bg-yellow-500/10 rounded-lg"><Settings2 className="w-5 h-5 text-yellow-500" /></div>
        </div>
        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">Generated</p>
            <p className="text-2xl font-bold">{images.filter(i => i.status === 'done').length}</p>
          </div>
          <div className="p-2 bg-green-500/10 rounded-lg"><Play className="w-5 h-5 text-green-500" /></div>
        </div>

        {/* Global Actions */}
        <div className="flex flex-col gap-4">
          <button
            onClick={() => generateMetadata()}
            disabled={images.length === 0 || isGenerating}
            className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white force-white text-sm font-semibold rounded-lg py-2.5 flex items-center justify-center gap-2 transition-colors mt-2"
          >
            <Play className="w-4 h-4" /> {isGenerating ? "Generating..." : "Generate Pending"}
          </button>
          <button
            onClick={exportCSV}
            disabled={images.filter(i => i.status === 'done').length === 0}
            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg py-2 flex items-center justify-center gap-2 transition-colors"
          >
            <DownloadCloud className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Upload Zone */}
      {images.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`relative mt-8 group cursor-pointer border-2 border-dashed rounded-3xl transition-all duration-300 ease-out flex flex-col items-center justify-center p-20 ${isDragging ? "border-primary bg-primary/5" : "border-white/20 bg-black/20 hover:border-white/40 hover:bg-white/5"
            }`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => document.getElementById('file-upload')?.click()}
        >
          <input
            type="file"
            id="file-upload"
            className="hidden"
            multiple
            accept="image/*"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <div className="p-5 bg-white/5 rounded-full mb-6 group-hover:scale-110 transition-transform duration-500 group-hover:bg-primary/20">
            <UploadCloud className="w-10 h-10 text-gray-400 group-hover:text-primary transition-colors" />
          </div>
          <h3 className="text-xl font-bold mb-2">Drop images to start</h3>
          <p className="text-gray-500 text-sm max-w-sm text-center">Supports JPG, PNG, WebP up to 20MB. Upload up to 100 images at once for bulk metadata generation.</p>
        </motion.div>
      ) : (
        /* Image Grid */
        <div className="mt-8 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-gray-400" />
              Generation Queue
            </h3>
            <button
              onClick={() => setImages([])}
              className="text-sm font-medium text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Clear All
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {images.map((img) => (
                <motion.div
                  key={img.id}
                  layout
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, filter: "blur(10px)" }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  className="glass-card overflow-hidden flex flex-col group relative"
                >
                  <div className="relative aspect-video bg-black shrink-0 overflow-hidden">
                    <motion.img
                      whileHover={{ scale: 1.05 }}
                      transition={{ duration: 0.4 }}
                      src={img.preview}
                      alt="preview"
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                    />
                    <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded border border-white/10 text-[10px] uppercase font-bold text-yellow-500 tracking-wider">
                      {img.status}
                    </div>
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between gap-4">
                    <div className="truncate text-sm font-medium text-gray-300">{img.file.name}</div>

                    {img.status === 'pending' && (
                      <button onClick={() => generateMetadata(img.id)} className="w-full py-2 bg-white/5 hover:bg-white/10 rounded-md text-xs font-semibold tracking-wide transition-colors border border-white/5">
                        Generate Metadata
                      </button>
                    )}
                    {img.status === 'generating' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="w-full py-2 flex justify-center items-center rounded-md border border-white/5 bg-primary/5"
                      >
                        <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                      </motion.div>
                    )}
                    {img.status === 'done' && img.metadata && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="space-y-4 text-xs text-gray-400"
                      >
                        <div className="flex flex-col">
                          <span className="font-semibold text-white truncate">{img.metadata.title}</span>
                          <span className="text-[10px] text-primary">{img.metadata.category}</span>
                        </div>
                        <div className="flex flex-wrap gap-1 max-h-12 overflow-hidden truncate">
                          {Array.isArray(img.metadata.keywords) && img.metadata.keywords.slice(0, 8).map(k => (
                            <span key={k} className="bg-white/10 px-1 py-0.5 rounded text-[10px] sm:text-xs">{k}</span>
                          ))}
                          {Array.isArray(img.metadata.keywords) && img.metadata.keywords.length > 8 && (
                            <span className="px-1 text-gray-500">+{img.metadata.keywords.length - 8}</span>
                          )}
                        </div>

                      </motion.div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Quick Add Card */}
            <motion.div
              layout
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => document.getElementById('file-upload-add')?.click()}
              className="border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center p-8 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all text-gray-500 hover:text-primary min-h-[240px]"
            >
              <input type="file" id="file-upload-add" className="hidden" multiple accept="image/*" onChange={(e) => handleFiles(e.target.files)} />
              <UploadCloud className="w-8 h-8 mb-3" />
              <span className="text-sm font-medium">Add more images</span>
            </motion.div>
          </div>
        </div>
      )}
    </div>
  );
}
