"use client";

import { useState, useEffect } from "react";
import { UploadCloud, FileImage, Settings2, Play, DownloadCloud, Trash2, ImageIcon, Plus, X, ExternalLink, Wand2, Copy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getProviderKeys, getProviderModels } from "@/lib/ai-settings";

interface ImageFile {
  id: string;
  file: File;
  preview: string;
  status: 'pending' | 'generating' | 'done' | 'error';
  prompt?: string;
  errorMsg?: string;
}

export default function PromptsPage() {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
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

  const [currentKeyIndex, setCurrentKeyIndex] = useState(0);
  const [charLength, setCharLength] = useState(300);
  
  const generatePrompts = async () => {
    // Read from global settings
    const providerKeys = getProviderKeys();
    const apiKeys = providerKeys.map((item) => item.key);
    const provider = providerKeys[0]?.provider || 'Groq';
    const model = getProviderModels()[provider] || 'meta-llama/llama-4-scout-17b-16e-instruct';

    if (apiKeys.length === 0) {
      alert("Please configure your Groq API Keys in the Settings page.");
      return;
    }
    
    setIsGenerating(true);
    let keyIdx = currentKeyIndex;
    
    const pendingImages = images.filter(i => i.status !== 'done');
      
    for (let i = 0; i < pendingImages.length; i++) {
      const img = pendingImages[i];
      
      // Set single image to generating
      setImages(prev => prev.map(item => item.id === img.id ? { ...item, status: 'generating', errorMsg: undefined } : item));
      
      try {
        const formData = new FormData();
        formData.append("image", img.file);
        formData.append("apiKey", apiKeys[keyIdx]);
        formData.append("provider", provider);
        formData.append("charLength", charLength.toString());
        formData.append("model", model);
        
        const res = await fetch("/api/generate-prompt", {
          method: "POST",
          body: formData
        });
        
        const data = await res.json();
        
        if (!data.success) throw new Error(data.error);
        
        // Update valid prompt
        setImages(prev => prev.map(item => item.id === img.id ? { ...item, status: 'done', prompt: data.prompt } : item));
        
        // Advance Key Index on Success (Round Robin)
        keyIdx = (keyIdx + 1) % apiKeys.length;
        setCurrentKeyIndex(keyIdx);
        
      } catch (e: any) {
        console.error(e);
        const errorText = e.message || "Generation failed";
        setImages(prev => prev.map(item => item.id === img.id ? { ...item, status: 'error', errorMsg: errorText } : item));
        // Advance Key Index on Error (Failover)
        keyIdx = (keyIdx + 1) % Math.max(apiKeys.length, 1);
        setCurrentKeyIndex(keyIdx);
      }

      // Mandatory 3-second delay between generations (if not the last image)
      if (i < pendingImages.length - 1) {
         await new Promise(r => setTimeout(r, 3000));
      }
    }
    setIsGenerating(false);
  };

  const exportCSV = () => {
    const done = images.filter(i => i.status === 'done' && i.prompt);
    if (!done.length) {
      alert("No completed prompts to export yet.");
      return;
    }

    const esc = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const lines = [
      "Filename,AI Prompt",
      ...done.map((img) => [
        esc(img.file.name),
        esc(img.prompt ?? "")
      ].join(","))
    ];

    try {
      const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `mcu_prompts_${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("CSV download failed. Please try again.");
    }
  };

  const copyToClipboard = (text: string, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    const btn = e.currentTarget;
    const originalText = btn.innerHTML;
    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg><span class="sr-only">Copied</span>`;
    setTimeout(() => { btn.innerHTML = originalText; }, 2000);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
           <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
             <Wand2 className="w-6 h-6 text-primary" /> Image Prompt Generator
           </h2>
           <p className="text-gray-400 mt-1 text-sm">Reverse engineer images into high-quality AI text prompts.</p>
        </div>
      </div>

      {/* Top Stats / Action Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
        <div className="glass-card p-4 flex items-center justify-between border-t-2 border-t-primary/50">
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Images</p>
            <p className="text-2xl font-bold">{images.length}</p>
          </div>
          <div className="p-2 bg-primary/10 rounded-lg"><FileImage className="w-5 h-5 text-primary" /></div>
        </div>
        <div className="glass-card p-4 flex items-center justify-between border-t-2 border-t-yellow-500/50">
          <div>
            <p className="text-sm text-gray-500 font-medium">Pending</p>
            <p className="text-2xl font-bold">{images.filter(i => i.status === 'pending').length}</p>
          </div>
          <div className="p-2 bg-yellow-500/10 rounded-lg"><Settings2 className="w-5 h-5 text-yellow-500" /></div>
        </div>
        <div className="glass-card p-4 flex items-center justify-between border-t-2 border-t-green-500/50">
          <div>
            <p className="text-sm text-gray-500 font-medium">Generated</p>
            <p className="text-2xl font-bold">{images.filter(i => i.status === 'done').length}</p>
          </div>
          <div className="p-2 bg-green-500/10 rounded-lg"><Play className="w-5 h-5 text-green-500" /></div>
        </div>

        {/* Global Actions */}
        <div className="flex flex-col gap-4">
            
            {/* Features Restored Container */}
            <div className="glass-card p-4 space-y-4">
               {/* Prompt Slider */}
               <div>
                 <div className="flex justify-between items-center mb-2">
                   <span className="text-xs font-semibold text-gray-400">PROMPT LENGTH</span>
                   <span className="text-xs text-primary font-mono">{charLength}</span>
                 </div>
                 <input 
                   type="range"
                   min="100" max="600" step="10"
                   value={charLength}
                   onChange={(e) => setCharLength(parseInt(e.target.value))}
                   className="liquid-slider w-full"
                   style={{ "--range-progress": `${((charLength - 100) / (600 - 100)) * 100}%` } as React.CSSProperties}
                 />
               </div>
            </div>

            <button 
              onClick={generatePrompts}
              disabled={images.filter(i => i.status === 'pending').length === 0 || isGenerating}
              className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white force-white text-sm font-semibold rounded-lg py-2.5 flex items-center justify-center gap-2 transition-colors mt-2"
            >
              <Wand2 className="w-4 h-4" /> {isGenerating ? "Generating Prompts..." : "Generate Pending"}
            </button>
            <button 
              onClick={exportCSV}
              disabled={images.filter(i => i.status === 'done').length === 0}
              className="w-full bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg py-2 flex items-center justify-center gap-2 transition-colors"
            >
              <DownloadCloud className="w-4 h-4" /> Export CSV (Prompts Only)
            </button>
        </div>
      </div>

      {/* Upload Zone */}
      {images.length === 0 ? (
        <motion.div 
           initial={{ opacity: 0, scale: 0.95 }}
           animate={{ opacity: 1, scale: 1 }}
           className={`relative mt-8 group cursor-pointer border-2 border-dashed rounded-3xl transition-all duration-300 ease-out flex flex-col items-center justify-center p-20 ${
             isDragging ? "border-primary bg-primary/5" : "border-white/20 bg-black/20 hover:border-white/40 hover:bg-white/5"
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
           <div className="p-5 bg-primary/10 rounded-full mb-6 group-hover:scale-110 transition-transform duration-500 group-hover:bg-primary/20 border border-primary/20">
            <Wand2 className="w-10 h-10 text-primary transition-colors" />
          </div>
          <h3 className="text-xl font-bold mb-2">Extract Prompts from Images</h3>
          <p className="text-gray-500 text-sm max-w-sm text-center">Upload bulk images here. AI runs with a mandatory 3-second gap between each generation.</p>
        </motion.div>
      ) : (
        /* Image Grid Workspace */
        <div className="mt-8 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-gray-400" />
              Extraction Queue
            </h3>
            <button 
              onClick={() => setImages([])}
              disabled={isGenerating}
              className="text-sm font-medium text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
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
                  transition={{ type: "spring", stiffness: 350, damping: 25 }}
                  className={`glass-card overflow-hidden flex flex-col group relative ${img.status === 'generating' ? 'border-primary ring-1 ring-primary/50' : ''}`}
                >
                   <div className="p-3 bg-black/40 border-b border-white/10 flex justify-between items-center text-xs">
                       <span className="truncate flex-1 font-medium text-gray-300">{img.file.name}</span>
                       <span className={`px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                           img.status === 'done' ? 'bg-green-500/20 text-green-400' :
                           img.status === 'generating' ? 'bg-primary/20 text-primary animate-pulse' :
                           img.status === 'error' ? 'bg-red-500/20 text-red-400' :
                           'bg-yellow-500/20 text-yellow-500'
                       }`}>
                           {img.status}
                       </span>
                   </div>

                  <div className="flex flex-col sm:flex-row p-4 gap-4 flex-1">
                      <div className="w-full sm:w-24 h-48 sm:h-24 rounded-lg bg-black shrink-0 overflow-hidden relative">
                        <motion.img 
                            whileHover={{ scale: 1.1 }}
                            src={img.preview} 
                            alt="preview" 
                            className="w-full h-full object-cover" 
                        />
                      </div>

                      <div className="flex-1 flex flex-col justify-center">
                          {img.status === 'pending' && (
                              <p className="text-sm text-gray-500 text-center">Waiting to generate prompt...</p>
                          )}
                           {img.status === 'generating' && (
                              <div className="flex flex-col items-center gap-2 text-primary">
                                  <span className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                                  <span className="text-xs font-semibold animate-pulse">Analyzing Image...</span>
                              </div>
                          )}
                          {img.status === 'done' && img.prompt && (
                              <div className="relative group text-sm text-gray-300 flex-1">
                                  <p className="line-clamp-4 leading-relaxed pr-6">{img.prompt}</p>
                                  <button 
                                      onClick={(e) => copyToClipboard(img.prompt as string, e)}
                                      className="absolute top-0 right-0 p-1 bg-white/10 hover:bg-white/20 rounded shadow-md text-gray-300 transition-colors opacity-0 group-hover:opacity-100"
                                      title="Copy Prompt"
                                  >
                                      <Copy className="w-3 h-3" />
                                  </button>
                              </div>
                          )}
                           {img.status === 'error' && (
                              <p className="text-sm text-red-400 text-center flex flex-col items-center justify-center gap-1">
                                  <span>Failed: {img.errorMsg || "Unknown Error"}</span>
                                  <span className="text-xs opacity-70 line-clamp-1">Check API Key and try again.</span>
                              </p>
                          )}
                      </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {/* Quick Add Card */}
            {!isGenerating && (
              <motion.div 
                layout
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => document.getElementById('file-upload-add')?.click()}
                className="border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center p-8 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all text-gray-500 hover:text-primary min-h-[160px]"
              >
                <input type="file" id="file-upload-add" className="hidden" multiple accept="image/*" onChange={(e) => handleFiles(e.target.files)} />
                <Plus className="w-8 h-8 mb-2" />
                <span className="text-sm font-medium">Add more images</span>
              </motion.div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
