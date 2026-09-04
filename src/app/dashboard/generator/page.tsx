"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  UploadCloud,
  FileImage,
  Zap,
  Download,
  Trash2,
  Lock,
  Wrench,
  X,
  Copy,
  RefreshCw,
  Search,
  ImagePlus,
  Layers,
  Type
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getAuthUser, AuthUser } from "@/lib/auth";
import { AI_DEFAULT_MODELS, AI_PROVIDERS, AI_PROVIDER_NAMES } from "@/lib/ai-models";
import PremiumSlider from "@/components/PremiumSlider";
import { getProviderKeys, getProviderModels, saveProviderKeys, saveProviderModel } from "@/lib/ai-settings";
import { useGeneratorState, GeneratorImageFile } from "../GeneratorStateContext";

type ImageFile = GeneratorImageFile;

interface HistoryItem {
  _id: string;
  filename: string;
  title: string;
  description: string;
  keywords: string[];
  category: string;
  createdAt: string;
}

export default function GeneratorPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [activeTab, setActiveTab] = useState<"Metadata" | "Prompt">("Metadata");
  const [platform, setPlatform] = useState("General");
  const [titleLength, setTitleLength] = useState(200);
  const [keywordsCount, setKeywordsCount] = useState(30);

  // Prompt States
  const [whiteBg, setWhiteBg] = useState(false);
  const [cameraParams, setCameraParams] = useState(false);
  const [promptLength, setPromptLength] = useState(600);
  const [usePrefix, setUsePrefix] = useState(false);
  const [prefixText, setPrefixText] = useState("");
  const [useSuffix, setUseSuffix] = useState(false);
  const [suffixText, setSuffixText] = useState("");
  const [useNegativePrompt, setUseNegativePrompt] = useState(false);
  const [negativePromptText, setNegativePromptText] = useState("");

  // API Keys
  const [isApiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [activeProvider, setActiveProvider] = useState("Groq");
  const [apiKeys, setApiKeys] = useState<{ id: string; key: string; provider: string }[]>([]);
  const [apiKeyInput, setApiKeyInput] = useState("");

  const platforms = ["General", "Adobe Stock", "Shutterstock", "FreePik", "Vecteezy"];
  const [selectedModels, setSelectedModels] = useState<Record<string, string>>(AI_DEFAULT_MODELS);
  const activeModel = selectedModels[activeProvider] ?? AI_DEFAULT_MODELS[activeProvider] ?? '';

  // Image Queue
  const { images, setImages, isGenerating, setIsGenerating } = useGeneratorState();
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // History States
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historySearch, setHistorySearch] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    setUser(getAuthUser());
    setApiKeys(getProviderKeys());
    setSelectedModels(getProviderModels());
  }, [setImages]);

  const fetchHistory = useCallback(async (userId: string) => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`/api/history/list?userId=${userId}`);
      const data = await res.json();
      if (data.success) setHistory(data.history || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchHistory(user.id);
    }
  }, [user, fetchHistory]);

  const saveKey = () => {
    if (!apiKeyInput.trim()) return;
    const newKeys = [...apiKeys.filter(k => k.provider !== activeProvider), {
      id: crypto.randomUUID(),
      key: apiKeyInput.trim(),
      provider: activeProvider
    }];
    setApiKeys(newKeys);
    saveProviderKeys(newKeys);
    setApiKeyInput('');
  };

  const removeKey = (id: string) => {
    const newKeys = apiKeys.filter(k => k.id !== id);
    setApiKeys(newKeys);
    saveProviderKeys(newKeys);
  };

  const activeProviderKeyObj = apiKeys.find(k => k.provider === activeProvider);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const newImages = Array.from(files).filter(f => f.type.startsWith('image/')).map(file => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      status: 'pending' as const,
    }));
    setImages(prev => [...prev, ...newImages]);
  }, []);

  const removeImage = (id: string) => {
    setImages(prev => {
      const img = prev.find(i => i.id === id);
      if (img?.preview) URL.revokeObjectURL(img.preview);
      return prev.filter(i => i.id !== id);
    });
  };

  const clearAllImages = () => {
    setImages(prev => {
      prev.forEach(img => { if (img.preview) URL.revokeObjectURL(img.preview); });
      return [];
    });
  };

  const generateSingle = async (img: ImageFile) => {
    const keyToUse = activeProviderKeyObj?.key;
    if (!keyToUse) {
      alert(`Please set an API key for ${activeProvider}`);
      return;
    }

    setImages(prev => prev.map(i => i.id === img.id ? { ...i, status: 'generating' } : i));

    try {
      const fd = new FormData();
      fd.append('image', img.file);
      fd.append('apiKey', keyToUse);
      fd.append('provider', activeProvider);
      fd.append('model', activeModel);

      let endpoint = '/api/generate';
      if (activeTab === 'Metadata') {
        fd.append('titleLength', titleLength.toString());
        fd.append('keywordsCount', keywordsCount.toString());
      } else {
        endpoint = '/api/generate-prompt';
        fd.append('promptLength', promptLength.toString());
        fd.append('usePrefix', usePrefix.toString());
        fd.append('prefixText', prefixText);
        fd.append('useSuffix', useSuffix.toString());
        fd.append('suffixText', suffixText);
        fd.append('useNegativePrompt', useNegativePrompt.toString());
        fd.append('negativePromptText', negativePromptText);
        const instr = [
          whiteBg ? 'white background' : '',
          cameraParams ? 'camera parameters' : '',
        ].filter(Boolean).join(' ');
        fd.append('instructions', instr);
      }

      const res = await fetch(endpoint, { method: 'POST', body: fd });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Generation failed');
      }

      if (activeTab === 'Metadata' && data.metadata) {
        setImages(prev => prev.map(i => i.id === img.id ? {
          ...i,
          status: 'done',
          metadata: data.metadata
        } : i));

        // Save to MongoDB history
        if (user) {
          try {
            await fetch('/api/history/save', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: user.id,
                filename: img.file.name,
                title: data.metadata.title,
                description: data.metadata.description,
                keywords: data.metadata.keywords,
                category: data.metadata.category,
              }),
            });
            fetchHistory(user.id);
          } catch (e) {
            console.error("Failed to save generation to history database:", e);
          }
        }
      } else if (activeTab === 'Prompt' && data.prompt) {
        setImages(prev => prev.map(i => i.id === img.id ? {
          ...i,
          status: 'done',
          prompt: data.prompt
        } : i));
      }

    } catch (err: unknown) {
      console.error(err);
      setImages(prev => prev.map(i => i.id === img.id ? { ...i, status: 'error' } : i));
    }
  };

  const generateAll = async () => {
    if (!activeProviderKeyObj) {
      setApiKeyModalOpen(true);
      return;
    }
    setIsGenerating(true);
    const targets = images.filter(i => i.status !== 'done');
    const CONCURRENCY = 2;
    for (let i = 0; i < targets.length; i += CONCURRENCY) {
      const batch = targets.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(img => generateSingle(img)));
    }
    setIsGenerating(false);
  };

  const deleteHistoryItem = async (id: string) => {
    try {
      const res = await fetch('/api/history/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success && user) {
        fetchHistory(user.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const exportCSV = () => {
    const done = images.filter(i => i.status === 'done');
    if (!done.length) return;

    const esc = (value: string) => `"${(value || '').replace(/"/g, '""')}"`;
    let lines = [];

    if (activeTab === 'Metadata') {
      lines = [
        "Filename,Title,Keywords,Category,Description",
        ...done.map((img) => {
          const { title, keywords, category, description } = img.metadata!;
          const kws = Array.isArray(keywords) ? keywords.join(", ") : String(keywords ?? "");
          return [esc(img.file.name), esc(title), esc(kws), esc(category), esc(description)].join(",");
        })
      ];
    } else {
      lines = [
        "Filename,Generated Prompt",
        ...done.map((img) => [esc(img.file.name), esc(img.prompt!)].join(","))
      ];
    }

    const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mcustock_${activeTab.toLowerCase()}_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredHistory = history.filter(item => 
    item.filename.toLowerCase().includes(historySearch.toLowerCase()) ||
    item.title.toLowerCase().includes(historySearch.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 gap-5 pb-20 xl:grid-cols-[300px_minmax(0,1fr)]">
      
      {/* Settings Side Pane */}
      <div className="flex w-full flex-col gap-4">
        
        {/* API Info Card */}
        <div className="border border-[var(--card-border)] bg-[var(--card-bg)] rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-primary" />
              <h3 className="font-bold text-[11px] text-foreground uppercase tracking-[0.18em]">Parameters</h3>
            </div>
            <button
              onClick={() => setApiKeyModalOpen(true)}
              className="px-3 py-1 border border-primary/30 rounded-xl text-[10px] font-bold text-primary hover:bg-primary/10 transition-colors"
            >
              API keys
            </button>
          </div>

          <div className="segmented-tabs relative flex gap-1 rounded-xl p-1">
            <motion.span
              layoutId="generator-mode-indicator"
              className="segmented-tabs-indicator"
              animate={{ x: activeTab === "Prompt" ? "100%" : "0%" }}
              transition={{ type: "spring", stiffness: 420, damping: 30, mass: 0.7 }}
            />
            <button 
              onClick={() => setActiveTab("Metadata")}
              data-selected={activeTab === "Metadata"}
              className={`relative z-10 flex-1 inline-flex items-center justify-center gap-2 text-[13px] font-bold py-2 transition-colors ${activeTab === "Metadata" ? "is-active" : ""}`}
            >
              <span className="inline-flex items-center justify-center gap-2">
                <Layers className="h-3.5 w-3.5" />
                Metadata
              </span>
            </button>
            <button 
              onClick={() => setActiveTab("Prompt")}
              data-selected={activeTab === "Prompt"}
              className={`relative z-10 flex-1 inline-flex items-center justify-center gap-2 text-[13px] font-bold py-2 transition-colors ${activeTab === "Prompt" ? "is-active" : ""}`}
            >
              <span className="inline-flex items-center justify-center gap-2">
                <Type className="h-3.5 w-3.5" />
                Prompt
              </span>
            </button>
          </div>
        </div>

        {/* Option Panel Controls */}
        <div className="border border-[var(--card-border)] rounded-2xl p-4 space-y-5 bg-[var(--card-bg)]">
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">AI Provider</label>
              <select
                value={activeProvider}
                onChange={e => setActiveProvider(e.target.value)}
                className="w-full text-xs font-semibold bg-background border border-primary/20 rounded-xl px-3 py-2 text-primary outline-none"
              >
                {AI_PROVIDER_NAMES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Model</label>
              <select
                value={activeModel}
                onChange={e => {
                  setSelectedModels(prev => ({ ...prev, [activeProvider]: e.target.value }));
                  saveProviderModel(activeProvider, e.target.value);
                }}
                className="w-full text-xs font-semibold bg-background border border-primary/20 rounded-xl px-3 py-2 text-primary outline-none"
              >
                {(AI_PROVIDERS[activeProvider] || []).map(m => <option key={m.id} value={m.id}>{m.label}{m.badge ? ` - ${m.badge}` : ''}</option>)}
              </select>
            </div>
            {activeProviderKeyObj ? (
                <p className="text-[10px] font-bold text-primary flex items-center gap-1.5 pt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                API Key Connected
              </p>
            ) : (
                <p className="text-[10px] font-bold text-amber-500 flex items-center gap-1.5 pt-1">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> API key required
              </p>
            )}
          </div>

          {activeTab === "Metadata" ? (
            <div className="space-y-6 pt-4 border-t border-primary/10">
              <div>
                <label className="block text-[10px] font-bold text-primary/60 uppercase tracking-wider mb-3">Export Platform</label>
                <div className="platform-options grid grid-cols-2 gap-2">
                  {platforms.map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPlatform(p)}
                      data-active={p === platform}
                      className="platform-button px-3 py-2 rounded-full text-[11px] font-bold transition-all"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <PremiumSlider label="TITLE LENGTH" value={titleLength} min={10} max={200} suffix=" CHARS" onChange={setTitleLength} />
              <PremiumSlider label="KEYWORDS COUNT" value={keywordsCount} min={5} max={50} suffix=" KEYS" onChange={setKeywordsCount} />
            </div>
          ) : (
            <div className="space-y-5 pt-4 border-t border-primary/10 text-xs text-primary font-semibold">
              <div className="flex items-center justify-between">
                <span>White Background</span>
                <input type="checkbox" checked={whiteBg} onChange={e => setWhiteBg(e.target.checked)} className="w-4 h-4 accent-primary" />
              </div>

              <div className="flex items-center justify-between">
                <span>Camera Params</span>
                <input type="checkbox" checked={cameraParams} onChange={e => setCameraParams(e.target.checked)} className="w-4 h-4 accent-primary" />
              </div>

              <PremiumSlider label="PROMPT LENGTH" value={promptLength} min={100} max={600} step={10} suffix=" CHARS" onChange={setPromptLength} />

              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-primary/60 uppercase">Prefix</span>
                    <input type="checkbox" checked={usePrefix} onChange={e => setUsePrefix(e.target.checked)} className="accent-primary" />
                  </div>
                  {usePrefix && (
                    <input
                      type="text"
                      value={prefixText}
                      onChange={e => setPrefixText(e.target.value)}
                      placeholder="Start prompt with..."
                      className="w-full bg-background border border-primary/25 rounded-xl px-3 py-1.5 text-xs text-primary outline-none"
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-primary/60 uppercase">Suffix</span>
                    <input type="checkbox" checked={useSuffix} onChange={e => setUseSuffix(e.target.checked)} className="accent-primary" />
                  </div>
                  {useSuffix && (
                    <input
                      type="text"
                      value={suffixText}
                      onChange={e => setSuffixText(e.target.value)}
                      placeholder="End prompt with..."
                      className="w-full bg-background border border-primary/25 rounded-xl px-3 py-1.5 text-xs text-primary outline-none"
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-primary/60 uppercase">Negative Exclude</span>
                    <input type="checkbox" checked={useNegativePrompt} onChange={e => setUseNegativePrompt(e.target.checked)} className="accent-primary" />
                  </div>
                  {useNegativePrompt && (
                    <input
                      type="text"
                      value={negativePromptText}
                      onChange={e => setNegativePromptText(e.target.value)}
                      placeholder="Exclude terms..."
                      className="w-full bg-background border border-primary/25 rounded-xl px-3 py-1.5 text-xs text-primary outline-none"
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Uploader workspace */}
      <div className="flex min-w-0 flex-col gap-5">
        
        {/* Upload Box */}
        <div className="border border-[var(--card-border)] rounded-2xl p-5 bg-[var(--card-bg)] flex flex-col gap-4 shadow-[0_18px_45px_rgba(0,0,0,.08)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImagePlus className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-[11px] uppercase tracking-[0.18em] text-foreground">Upload Assets</h3>
            </div>
            <span className="text-[10px] font-bold text-primary/70">{images.length} items selected</span>
          </div>

           <div 
             className={`min-h-48 border border-dashed rounded-xl px-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${isDragging ? 'border-primary bg-primary/10' : 'border-[var(--input-border)] bg-[var(--input-bg)] hover:border-primary/50 hover:bg-primary/5'}`}
             onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
             onDragLeave={() => setIsDragging(false)}
             onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
             onClick={() => fileInputRef.current?.click()}
          >
            <input ref={fileInputRef} type="file" className="hidden" multiple accept="image/*" onChange={(e) => handleFiles(e.target.files)} />
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-primary/25 text-primary"><UploadCloud className="h-5 w-5" /></div>
            <p className="text-sm font-bold text-foreground mb-1">Drop your assets here</p>
            <p className="text-xs text-[var(--text-secondary)]">or browse files · PNG · JPG · JPEG · WEBP</p>
          </div>
        </div>

        {/* Action button bar */}
        {images.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2 border-b border-primary/10 pb-4">
            <span className="text-xs font-bold text-primary">
              Queue: {images.filter(i => i.status === 'done').length} of {images.length} processed
            </span>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button onClick={clearAllImages} className="px-4 py-2 bg-transparent border border-primary/30 rounded-xl text-xs font-bold text-primary hover:bg-primary/5 transition-all">
                Clear Queue
              </button>
              <button onClick={exportCSV} disabled={images.filter(i => i.status === 'done').length === 0} className="px-4 py-2 bg-transparent border border-primary/30 rounded-xl text-xs font-bold text-primary hover:bg-primary/5 disabled:opacity-40 transition-all flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
              <button 
                 onClick={generateAll}
                 disabled={isGenerating || images.length === 0}
                 className="px-5 py-2 bg-primary text-background rounded-xl text-xs font-bold hover:bg-primary-hover disabled:opacity-40 transition-all flex items-center gap-1.5"
               >
                <Zap className="w-3.5 h-3.5" />
                {isGenerating ? 'Processing...' : 'Generate All'}
              </button>
            </div>
          </div>
        )}

        {/* Queue Outputs Display */}
        <div className="space-y-4">
          {images.map(img => (
            <div key={img.id} className="border border-[var(--card-border)] rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row gap-5 bg-[var(--card-bg)]">
              <div className="w-full md:w-48 shrink-0 flex flex-col gap-2">
                <div className="relative aspect-video md:h-32 bg-primary/5 rounded-xl border border-primary/15 overflow-hidden flex items-center justify-center">
                  <img src={img.preview} alt="preview" className="object-contain w-full h-full p-1.5" />
                  <button onClick={() => removeImage(img.id)} className="absolute top-2 right-2 bg-background/80 hover:bg-background text-primary border border-primary/25 p-1.5 rounded-full shadow-md transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <span className="text-[10px] font-bold text-primary/70 truncate">{img.file.name}</span>
                <div className="text-[10px] font-bold text-primary/60">
                  Status: <span className="uppercase text-primary">{img.status}</span>
                </div>
              </div>

              <div className="flex-1 min-w-0 flex flex-col justify-center">
                {img.status === 'pending' && (
                  <button onClick={() => generateSingle(img)} className="self-start px-4 py-2 border border-primary/25 rounded-xl text-xs font-bold text-primary hover:bg-primary/5 transition-colors">
                    Process Individually
                  </button>
                )}

                {img.status === 'generating' && (
                  <div className="flex items-center gap-2 text-xs font-bold text-primary">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Analyzing image features...
                  </div>
                )}

                {img.status === 'error' && (
                  <p className="text-xs font-bold text-primary border border-dashed border-primary/30 p-3 rounded-xl">
                    ⚠️ Generation failed. Verify API Key settings.
                  </p>
                )}

                {img.status === 'done' && img.metadata && activeTab === 'Metadata' && (
                  <div className="space-y-4 text-xs">
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-bold text-primary/60 uppercase mb-1">
                        <span>Title</span>
                        <button onClick={() => navigator.clipboard.writeText(img.metadata!.title)} className="hover:underline flex items-center gap-1"><Copy className="w-3 h-3" /> Copy</button>
                      </div>
                      <div className="bg-primary/5 border border-primary/10 rounded-xl p-3 text-primary font-medium">{img.metadata.title}</div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[10px] font-bold text-primary/60 uppercase mb-1">
                        <span>Description</span>
                        <button onClick={() => navigator.clipboard.writeText(img.metadata!.description)} className="hover:underline flex items-center gap-1"><Copy className="w-3 h-3" /> Copy</button>
                      </div>
                      <div className="bg-primary/5 border border-primary/10 rounded-xl p-3 text-primary font-medium">{img.metadata.description}</div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[10px] font-bold text-primary/60 uppercase mb-1">
                        <span>Keywords ({img.metadata.keywords.length})</span>
                        <button onClick={() => navigator.clipboard.writeText(img.metadata!.keywords.join(", "))} className="hover:underline flex items-center gap-1"><Copy className="w-3 h-3" /> Copy CSV</button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto border border-primary/10 p-2.5 rounded-xl bg-primary/5">
                        {img.metadata.keywords.map((k, idx) => (
                          <span key={idx} className="bg-background border border-primary/15 px-2.5 py-1 rounded-full text-[10px] font-bold text-primary">{k}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {img.status === 'done' && img.prompt && activeTab === 'Prompt' && (
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between text-[10px] font-bold text-primary/60 uppercase mb-1">
                      <span>Prompt</span>
                      <button onClick={() => navigator.clipboard.writeText(img.prompt!)} className="hover:underline flex items-center gap-1"><Copy className="w-3 h-3" /> Copy</button>
                    </div>
                    <div className="bg-primary/5 border border-primary/10 rounded-xl p-3 text-primary font-medium font-mono leading-relaxed whitespace-pre-wrap">{img.prompt}</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* MongoDB History Log Panel */}
        <div className="border-t border-[var(--divider)] pt-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-primary/15 pb-4">
            <div className="flex items-center gap-2">
              <FileImage className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-sm text-foreground">Recent Generations</h3>
            </div>
            <div className="relative w-full sm:w-60">
              <input
                type="text"
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                placeholder="Search history..."
                className="w-full text-xs bg-background border border-primary/25 rounded-xl pl-8 pr-3 py-2 text-primary placeholder-primary/40 outline-none"
              />
              <Search className="w-3.5 h-3.5 text-primary/40 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {isLoadingHistory ? (
            <div className="py-10 text-center text-xs font-bold text-primary flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" /> Fetching history from database...
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="border border-dashed border-[var(--card-border)] rounded-xl py-10 text-center"><p className="text-sm font-semibold text-foreground/75">No generations yet</p><p className="mt-1 text-xs text-[var(--text-muted)]">Your generated metadata will appear here.</p></div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {filteredHistory.map(item => (
                <div key={item._id} className="border border-primary/10 rounded-xl p-3 bg-primary/5 space-y-2 relative text-xs text-primary">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 pr-10">
                      <p className="font-bold truncate">{item.filename}</p>
                      <p className="text-[10px] text-primary/70 mt-0.5">Category: {item.category || "General"} · {new Date(item.createdAt).toLocaleDateString()}</p>
                    </div>
                    <button
                      onClick={() => deleteHistoryItem(item._id)}
                      className="text-primary/70 hover:text-primary border border-primary/20 p-1.5 rounded-lg transition-all absolute top-2 right-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  
                  <div className="space-y-1.5 pt-1.5 border-t border-primary/5">
                    <p className="font-semibold"><span className="text-primary/60 uppercase text-[9px] font-bold">Title:</span> {item.title}</p>
                    <p className="text-primary/95 leading-relaxed"><span className="text-primary/60 uppercase text-[9px] font-bold">Desc:</span> {item.description}</p>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {item.keywords.slice(0, 10).map((k, idx) => (
                        <span key={idx} className="bg-background border border-primary/15 px-2 py-0.5 rounded text-[10px] font-medium">{k}</span>
                      ))}
                      {item.keywords.length > 10 && <span className="text-[10px] text-primary/70 font-bold px-1">+{item.keywords.length - 10}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* API Key Configure Modal */}
      <AnimatePresence>
        {isApiKeyModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setApiKeyModalOpen(false)} className="absolute inset-0 bg-background/80 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="border border-primary/20 relative w-full max-w-[420px] overflow-hidden p-6 rounded-3xl bg-background shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-primary/10 pb-3">
                <h3 className="font-bold text-sm text-primary flex items-center gap-1.5"><Lock className="w-4 h-4" /> Setup API Keys</h3>
                <button onClick={() => setApiKeyModalOpen(false)} className="p-1 text-primary/65 hover:text-primary"><X className="w-4 h-4" /></button>
              </div>

              <div className="space-y-3 text-xs text-primary">
                <div>
                  <label className="block text-[10px] font-bold text-primary/60 uppercase tracking-wider mb-1">Select Provider</label>
                  <select
                    value={activeProvider}
                    onChange={e => setActiveProvider(e.target.value)}
                    className="w-full text-xs font-semibold bg-background border border-primary/20 rounded-xl px-3 py-2 outline-none text-primary"
                  >
                    {AI_PROVIDER_NAMES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-primary/60 uppercase tracking-wider">Configure API Key</label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={apiKeyInput}
                      onChange={e => setApiKeyInput(e.target.value)}
                      placeholder={`Enter ${activeProvider} key...`}
                      className="flex-1 text-xs bg-background border border-primary/20 rounded-xl px-3.5 py-2 text-primary placeholder-primary/35 outline-none"
                    />
                    <button onClick={saveKey} className="px-4 py-2 bg-primary text-background rounded-xl font-bold hover:bg-primary-hover transition-colors">Save</button>
                  </div>
                </div>

                {apiKeys.length > 0 && (
                  <div className="pt-3 border-t border-primary/10 space-y-1.5">
                    <p className="text-[10px] font-bold text-primary/60 uppercase">Configured Keys:</p>
                    {apiKeys.map(k => (
                      <div key={k.id} className="flex items-center justify-between text-xs border border-primary/10 rounded-xl p-2 bg-primary/5">
                        <span className="font-bold text-primary">{k.provider}</span>
                        <button onClick={() => removeKey(k.id)} className="text-[10px] font-bold text-primary hover:underline">Remove</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
