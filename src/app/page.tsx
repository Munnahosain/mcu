"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud,
  Download,
  Trash2,
  Play,
  Zap,
  Sparkles,
  Tags,
  X,
  Check,
  Copy,
  LogOut,
  Sun,
  Moon,
  Eye,
  Search,
  ImagePlus,
  FileImage,
  Lock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Settings,
  ArrowRight,
  Shield,
  FileSpreadsheet,
  Type
} from "lucide-react";
import { getAuthUser, clearAuthUser, AuthUser } from "@/lib/auth";
import ThemeToggle from "@/components/ThemeToggle";
import { AI_DEFAULT_MODELS, AI_PROVIDERS, AI_PROVIDER_NAMES } from "@/lib/ai-models";
import PremiumSlider from "@/components/PremiumSlider";
import { getProviderKeys, getProviderModels, saveProviderKeys, saveProviderModel } from "@/lib/ai-settings";

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
  prompt?: string;
}

interface HistoryItem {
  _id: string;
  filename: string;
  title: string;
  description: string;
  keywords: string[];
  category: string;
  createdAt: string;
}

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState<"Metadata" | "Prompt">("Metadata");
  
  // App States
  const [images, setImages] = useState<ImageFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [platform, setPlatform] = useState("General");
  const [titleLength, setTitleLength] = useState(200);
  const [keywordsCount, setKeywordsCount] = useState(30);
  const [showSettingsMobile, setShowSettingsMobile] = useState(false);
  
  // Prompt settings
  const [whiteBg, setWhiteBg] = useState(false);
  const [cameraParams, setCameraParams] = useState(false);
  const [promptLength, setPromptLength] = useState(600);
  const [usePrefix, setUsePrefix] = useState(false);
  const [prefixText, setPrefixText] = useState("");
  const [useSuffix, setUseSuffix] = useState(false);
  const [suffixText, setSuffixText] = useState("");
  const [useNegativePrompt, setUseNegativePrompt] = useState(false);
  const [negativePromptText, setNegativePromptText] = useState("");

  // API Key States
  const [activeProvider, setActiveProvider] = useState("Groq");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKeys, setApiKeys] = useState<{ id: string; key: string; provider: string }[]>([]);
  const [isKeyPanelOpen, setIsKeyPanelOpen] = useState(false);
  
  // History States
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historySearch, setHistorySearch] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const platforms = ["General", "Adobe Stock", "Shutterstock", "FreePik", "Vecteezy"];
  const [selectedModels, setSelectedModels] = useState<Record<string, string>>(AI_DEFAULT_MODELS);
  const activeModel = selectedModels[activeProvider] ?? AI_DEFAULT_MODELS[activeProvider] ?? '';

  useEffect(() => {
    const auth = getAuthUser();
    setUser(auth);
    setIsHydrated(true);

    setApiKeys(getProviderKeys());
    setSelectedModels(getProviderModels());
  }, []);

  const fetchHistory = useCallback(async (userId: string) => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`/api/history/list?userId=${userId}`);
      const data = await res.json();
      if (data.success) {
        setHistory(data.history || []);
      }
    } catch (err) {
      console.error("Error fetching history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchHistory(user.id);
    }
  }, [user, fetchHistory]);

  useEffect(() => {
    if (isHydrated && user) {
      router.replace("/dashboard/generator");
    }
  }, [isHydrated, user, router]);

  const handleSignOut = () => {
    clearAuthUser();
    setUser(null);
    router.refresh();
  };

  const saveApiKey = () => {
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

  const removeApiKey = (id: string) => {
    const newKeys = apiKeys.filter(k => k.id !== id);
    setApiKeys(newKeys);
    saveProviderKeys(newKeys);
  };

  const activeProviderKeyObj = apiKeys.find(k => k.provider === activeProvider);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const fileArray = Array.from(files).filter(f => f.type.startsWith('image/'));
    const newImages: ImageFile[] = fileArray.map(file => ({
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
      prev.forEach(img => {
        if (img.preview) URL.revokeObjectURL(img.preview);
      });
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

    } catch (err: any) {
      console.error(err);
      setImages(prev => prev.map(i => i.id === img.id ? { ...i, status: 'error' } : i));
    }
  };

  const generateAll = async () => {
    if (!activeProviderKeyObj) {
      setIsKeyPanelOpen(true);
      return;
    }
    setIsGenerating(true);
    const targets = images.filter(i => i.status !== 'done');
    
    // Concurrency limit of 2 for safety
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
      console.error("Failed to delete history item:", e);
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const filteredHistory = history.filter(item => 
    item.filename.toLowerCase().includes(historySearch.toLowerCase()) ||
    item.title.toLowerCase().includes(historySearch.toLowerCase())
  );

  if (!isHydrated) return null;

  // Keep one canonical authenticated workspace instead of rendering a second UI at `/`.
  if (false && user) {
    return null;
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        {/* Navigation Bar */}
        <header className="border-b border-primary/20 bg-background sticky top-0 z-40 px-4 py-3 sm:px-6">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <span className="liquid-icon-shell h-10 w-10 rounded-xl">
                <Image src="/MCU-LOGO-0.2V-1.png" alt="MCU Logo" width={28} height={28} className="h-6 w-6 object-contain" />
              </span>
              <div>
                <span className="block text-[8px] font-bold uppercase tracking-[0.3em] text-primary/60">Stock Creator AI</span>
                <span className="text-[14px] font-bold tracking-[0.2em] text-primary">MCUSTOCK</span>
              </div>
            </Link>

            <div className="flex items-center gap-3">
              <ThemeToggle />
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-bold text-primary truncate max-w-[120px]">{user?.name}</span>
                <span className="text-[9px] text-primary/70 truncate max-w-[120px]">{user?.email}</span>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border border-primary/20 hover:bg-primary/10 text-primary transition-all"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Work Area */}
        <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row gap-6">
          {/* Settings Drawer/Sidebar */}
          <div className="w-full lg:w-[320px] shrink-0 flex flex-col gap-6">
            
            {/* Header Control Panel */}
            <div className="border border-primary/20 bg-primary/5 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-primary" />
                  <h3 className="font-bold text-sm text-primary">Workspace Controls</h3>
                </div>
                <button
                  onClick={() => setIsKeyPanelOpen(!isKeyPanelOpen)}
                  className="px-3 py-1.5 border border-primary/30 rounded-full text-[10px] font-bold text-primary hover:bg-primary/10 transition-colors"
                >
                  {isKeyPanelOpen ? "Close Keys" : "API Keys"}
                </button>
              </div>

              {/* API Keys Configuration Panel */}
              <AnimatePresence>
                {isKeyPanelOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden space-y-3 pt-2 border-t border-primary/10"
                  >
                    <div>
                      <label className="block text-[10px] font-bold text-primary/60 uppercase tracking-wider mb-1">Select Provider</label>
                      <select
                        value={activeProvider}
                        onChange={e => setActiveProvider(e.target.value)}
                        className="w-full text-xs font-semibold bg-background border border-primary/20 rounded-xl px-3 py-2 text-primary outline-none"
                      >
                        {AI_PROVIDER_NAMES.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold text-primary/60 uppercase tracking-wider">Configure Key</label>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={apiKeyInput}
                          onChange={e => setApiKeyInput(e.target.value)}
                          placeholder={`Enter ${activeProvider} key...`}
                          className="flex-1 text-xs bg-background border border-primary/20 rounded-xl px-3 py-2 text-primary placeholder-primary/30 outline-none"
                        />
                        <button
                          onClick={saveApiKey}
                          className="px-3 py-2 bg-primary text-background rounded-xl text-xs font-bold hover:bg-primary-hover transition-colors"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                    {apiKeys.length > 0 && (
                      <div className="pt-2 border-t border-primary/10 space-y-1.5">
                        <p className="text-[10px] font-bold text-primary/60 uppercase">Configured Keys:</p>
                        {apiKeys.map(k => (
                          <div key={k.id} className="flex items-center justify-between text-xs border border-primary/10 rounded-lg p-2 bg-background">
                            <span className="font-bold text-primary">{k.provider}</span>
                            <button onClick={() => removeApiKey(k.id)} className="text-[10px] font-bold text-primary hover:underline">Remove</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Mode Selector Tabs */}
              <div className="flex bg-background border border-primary/10 p-1 rounded-xl">
                <button
                  onClick={() => setActiveTab("Metadata")}
                  className={`flex-1 text-xs font-bold py-2 rounded-lg transition-all ${activeTab === "Metadata" ? "bg-primary text-background shadow-md" : "text-primary/70 hover:text-primary"}`}
                >
                  Metadata Generator
                </button>
                <button
                  onClick={() => setActiveTab("Prompt")}
                  className={`flex-1 text-xs font-bold py-2 rounded-lg transition-all ${activeTab === "Prompt" ? "bg-primary text-background shadow-md" : "text-primary/70 hover:text-primary"}`}
                >
                  Prompt Extractor
                </button>
              </div>
            </div>

            {/* Mobile Settings Toggle Button */}
            <button
              onClick={() => setShowSettingsMobile(!showSettingsMobile)}
              className="lg:hidden flex items-center justify-center gap-2 w-full py-2.5 border border-primary/20 rounded-2xl text-xs font-bold text-primary"
            >
              <span>{showSettingsMobile ? "Hide Settings" : "Configure Generation Settings"}</span>
              {showSettingsMobile ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {/* Dynamic Settings Card */}
            <div className={`border border-primary/20 rounded-2xl p-6 space-y-6 flex-1 ${showSettingsMobile ? 'block' : 'hidden lg:block'}`}>
              <div className="flex items-center gap-2 border-b border-primary/15 pb-3">
                <Sparkles className="w-4 h-4 text-primary" />
                <h4 className="font-bold text-xs text-primary uppercase tracking-wider">{activeTab} Parameters</h4>
              </div>

              {/* Active Provider & Model Info */}
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-primary/60 uppercase tracking-wider mb-1">Active AI Provider</label>
                  <select
                    value={activeProvider}
                    onChange={e => setActiveProvider(e.target.value)}
                    className="w-full text-xs font-semibold bg-background border border-primary/20 rounded-xl px-3 py-2 text-primary outline-none"
                  >
                    {AI_PROVIDER_NAMES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-primary/60 uppercase tracking-wider mb-1">Model Selection</label>
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
                  <div className="text-[10px] font-bold text-primary flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                    API Key set and ready
                  </div>
                ) : (
                  <div className="text-[10px] font-bold text-primary border border-dashed border-primary/30 p-2 rounded-xl text-center">
                    ❌ Setup API key under "API Keys" above.
                  </div>
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
                          className="platform-button px-3 py-2 rounded-full text-xs font-semibold transition-all"
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
                    <span>White Background Only</span>
                    <input
                      type="checkbox"
                      checked={whiteBg}
                      onChange={e => setWhiteBg(e.target.checked)}
                      className="w-4 h-4 accent-primary"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span>Camera Parameters Details</span>
                    <input
                      type="checkbox"
                      checked={cameraParams}
                      onChange={e => setCameraParams(e.target.checked)}
                      className="w-4 h-4 accent-primary"
                    />
                  </div>

                  <PremiumSlider label="PROMPT CHARACTER COUNT" value={promptLength} min={100} max={1500} step={50} suffix=" CHARS" onChange={setPromptLength} />

                  <div className="space-y-3 pt-2">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-primary/60 uppercase">Add Prefix</span>
                        <input type="checkbox" checked={usePrefix} onChange={e => setUsePrefix(e.target.checked)} className="accent-primary" />
                      </div>
                      {usePrefix && (
                        <input
                          type="text"
                          value={prefixText}
                          onChange={e => setPrefixText(e.target.value)}
                          placeholder="Always start prompt with..."
                          className="w-full bg-background border border-primary/20 rounded-xl px-3 py-2 text-xs text-primary outline-none"
                        />
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-primary/60 uppercase">Add Suffix</span>
                        <input type="checkbox" checked={useSuffix} onChange={e => setUseSuffix(e.target.checked)} className="accent-primary" />
                      </div>
                      {useSuffix && (
                        <input
                          type="text"
                          value={suffixText}
                          onChange={e => setSuffixText(e.target.value)}
                          placeholder="Always end prompt with..."
                          className="w-full bg-background border border-primary/20 rounded-xl px-3 py-2 text-xs text-primary outline-none"
                        />
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-primary/60 uppercase">Negative Keywords</span>
                        <input type="checkbox" checked={useNegativePrompt} onChange={e => setUseNegativePrompt(e.target.checked)} className="accent-primary" />
                      </div>
                      {useNegativePrompt && (
                        <input
                          type="text"
                          value={negativePromptText}
                          onChange={e => setNegativePromptText(e.target.value)}
                          placeholder="Exclude objects (e.g. text, watermark)..."
                          className="w-full bg-background border border-primary/20 rounded-xl px-3 py-2 text-xs text-primary outline-none"
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main Working Panel */}
          <div className="flex-1 flex flex-col gap-6">
            
            {/* Image Upload Area */}
            <div className="border border-primary/20 rounded-3xl p-6 bg-background flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ImagePlus className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-sm text-primary">Upload Assets</h3>
                </div>
                <span className="text-[10px] font-bold text-primary/70">{images.length} items selected</span>
              </div>

              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl py-10 px-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${isDragging ? 'border-primary bg-primary/5' : 'border-primary/20 hover:border-primary/40 hover:bg-primary/5'}`}
              >
                <input ref={fileInputRef} type="file" className="hidden" multiple accept="image/*" onChange={e => handleFiles(e.target.files)} />
                <UploadCloud className="w-8 h-8 text-primary mb-3" />
                <p className="text-xs font-bold text-primary mb-1">Drag and drop images here, or browse files</p>
                <p className="text-[10px] text-primary/60">Supports PNG, JPG, JPEG, and WebP formats</p>
              </div>
            </div>

            {/* Action Bar */}
            {images.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2 border-b border-primary/10 pb-4">
                <span className="text-xs font-bold text-primary">
                  Queue status: {images.filter(i => i.status === 'done').length} of {images.length} processed
                </span>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    onClick={clearAllImages}
                    className="px-4 py-2 bg-transparent border border-primary/30 rounded-xl text-xs font-bold text-primary hover:bg-primary/5 transition-all"
                  >
                    Clear Queue
                  </button>
                  <button
                    onClick={exportCSV}
                    disabled={images.filter(i => i.status === 'done').length === 0}
                    className="px-4 py-2 bg-transparent border border-primary/30 rounded-xl text-xs font-bold text-primary hover:bg-primary/5 disabled:opacity-40 transition-all flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export CSV
                  </button>
                  <button
                    onClick={generateAll}
                    disabled={isGenerating || images.length === 0}
                    className="px-5 py-2 bg-primary text-background rounded-xl text-xs font-bold hover:bg-primary-hover disabled:opacity-40 transition-all flex items-center gap-1.5"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    {isGenerating ? "Processing..." : "Generate All"}
                  </button>
                </div>
              </div>
            )}

            {/* Queue List / Generated Outputs */}
            <div className="space-y-4">
              {images.map(img => (
                <div key={img.id} className="border border-primary/20 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row gap-5 bg-background">
                  {/* Image Preview */}
                  <div className="w-full md:w-48 shrink-0 flex flex-col gap-2">
                    <div className="relative aspect-video md:h-32 bg-primary/5 rounded-xl border border-primary/15 overflow-hidden flex items-center justify-center">
                      <img src={img.preview} alt="Queue thumbnail" className="object-contain w-full h-full p-1.5" />
                      <button
                        onClick={() => removeImage(img.id)}
                        className="absolute top-2 right-2 bg-background/80 hover:bg-background text-primary border border-primary/25 p-1.5 rounded-full shadow-md transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <span className="text-[10px] font-bold text-primary/70 truncate">{img.file.name}</span>
                    <div className="text-[10px] font-bold text-primary/60">
                      Status: <span className="uppercase text-primary">{img.status}</span>
                    </div>
                  </div>

                  {/* Generated Metadata display */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    {img.status === 'pending' && (
                      <button
                        onClick={() => generateSingle(img)}
                        className="self-start px-4 py-2 border border-primary/25 rounded-xl text-xs font-bold text-primary hover:bg-primary/5 transition-colors"
                      >
                        Process Individually
                      </button>
                    )}

                    {img.status === 'generating' && (
                      <div className="flex items-center gap-2 text-xs font-bold text-primary">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        AI is reviewing your image details...
                      </div>
                    )}

                    {img.status === 'error' && (
                      <div className="text-xs font-bold text-primary border border-dashed border-primary/30 p-3 rounded-xl">
                        ⚠️ Generation failed. Please check your API Key settings and try again.
                      </div>
                    )}

                    {img.status === 'done' && img.metadata && activeTab === 'Metadata' && (
                      <div className="space-y-4 text-xs">
                        <div>
                          <div className="flex items-center justify-between text-[10px] font-bold text-primary/60 uppercase mb-1">
                            <span>Generated Title</span>
                            <button onClick={() => copyToClipboard(img.metadata!.title)} className="hover:underline flex items-center gap-1"><Copy className="w-3 h-3" /> Copy</button>
                          </div>
                          <div className="bg-primary/5 border border-primary/10 rounded-xl p-3 text-primary font-medium">
                            {img.metadata.title}
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between text-[10px] font-bold text-primary/60 uppercase mb-1">
                            <span>Generated Description</span>
                            <button onClick={() => copyToClipboard(img.metadata!.description)} className="hover:underline flex items-center gap-1"><Copy className="w-3 h-3" /> Copy</button>
                          </div>
                          <div className="bg-primary/5 border border-primary/10 rounded-xl p-3 text-primary font-medium">
                            {img.metadata.description}
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between text-[10px] font-bold text-primary/60 uppercase mb-1.5">
                            <span>Keywords ({img.metadata.keywords.length})</span>
                            <button onClick={() => copyToClipboard(img.metadata!.keywords.join(", "))} className="hover:underline flex items-center gap-1"><Copy className="w-3 h-3" /> Copy CSV</button>
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
                          <span>Extracted Prompt</span>
                          <button onClick={() => copyToClipboard(img.prompt!)} className="hover:underline flex items-center gap-1"><Copy className="w-3 h-3" /> Copy</button>
                        </div>
                        <div className="bg-primary/5 border border-primary/10 rounded-xl p-3 text-primary font-medium font-mono leading-relaxed whitespace-pre-wrap">
                          {img.prompt}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* MongoDB History Log Section */}
            <div className="mt-8 border border-primary/20 rounded-3xl p-6 bg-background space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-primary/15 pb-4">
                <div className="flex items-center gap-2">
                  <FileImage className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-sm text-primary">MongoDB Generation History</h3>
                </div>
                <div className="relative w-full sm:w-60">
                  <input
                    type="text"
                    value={historySearch}
                    onChange={e => setHistorySearch(e.target.value)}
                    placeholder="Search past uploads..."
                    className="w-full text-xs bg-background border border-primary/25 rounded-xl pl-8 pr-3 py-2 text-primary placeholder-primary/40 outline-none"
                  />
                  <Search className="w-3.5 h-3.5 text-primary/40 absolute left-2.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {isLoadingHistory ? (
                <div className="py-10 text-center text-xs font-bold text-primary flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Loading history log from MongoDB...
                </div>
              ) : filteredHistory.length === 0 ? (
                <p className="text-center py-10 text-xs font-bold text-primary/60">
                  {historySearch ? "No matching history items found." : "Your past generated metadata items will be saved here."}
                </p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {filteredHistory.map(item => (
                    <div key={item._id} className="border border-primary/10 rounded-xl p-3 bg-primary/5 space-y-2 relative text-xs">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 pr-10">
                          <p className="font-bold text-primary truncate">{item.filename}</p>
                          <p className="text-[10px] text-primary/70 mt-0.5">Category: {item.category || "General"} · {new Date(item.createdAt).toLocaleDateString()}</p>
                        </div>
                        <button
                          onClick={() => deleteHistoryItem(item._id)}
                          className="text-primary/70 hover:text-primary hover:bg-primary/10 border border-primary/20 p-1.5 rounded-lg transition-all absolute top-2 right-2"
                          title="Delete history item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      
                      <div className="space-y-1.5 pt-1.5 border-t border-primary/5">
                        <p className="font-semibold text-primary"><span className="text-primary/60 uppercase text-[9px] font-bold">Title:</span> {item.title}</p>
                        <p className="text-primary/95 leading-relaxed"><span className="text-primary/60 uppercase text-[9px] font-bold">Desc:</span> {item.description}</p>
                        <div className="flex flex-wrap gap-1 pt-1">
                          {item.keywords.slice(0, 10).map((k, idx) => (
                            <span key={idx} className="bg-background border border-primary/10 px-2 py-0.5 rounded text-[10px] font-medium text-primary">{k}</span>
                          ))}
                          {item.keywords.length > 10 && <span className="text-[10px] text-primary/70 font-bold px-1">+{item.keywords.length - 10} more</span>}
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => {
                            copyToClipboard(`Title: ${item.title}\nDescription: ${item.description}\nKeywords: ${item.keywords.join(", ")}`);
                          }}
                          className="px-2.5 py-1 border border-primary/20 rounded-lg text-[10px] font-bold text-primary hover:bg-primary/10 transition-colors"
                        >
                          Copy All
                        </button>
                        <button
                          onClick={() => {
                            const esc = (val: string) => `"${(val || '').replace(/"/g, '""')}"`;
                            const header = "Filename,Title,Keywords,Category,Description";
                            const row = [esc(item.filename), esc(item.title), esc(item.keywords.join(", ")), esc(item.category), esc(item.description)].join(",");
                            const csvBlob = new Blob([[header, row].join("\r\n")], { type: "text/csv;charset=utf-8" });
                            const csvUrl = URL.createObjectURL(csvBlob);
                            const downloadLink = document.createElement("a");
                            downloadLink.href = csvUrl;
                            downloadLink.download = `mcustock_history_${item.filename.split('.')[0]}.csv`;
                            document.body.appendChild(downloadLink);
                            downloadLink.click();
                            document.body.removeChild(downloadLink);
                            URL.revokeObjectURL(csvUrl);
                          }}
                          className="px-2.5 py-1 border border-primary/20 rounded-lg text-[10px] font-bold text-primary hover:bg-primary/10 transition-colors"
                        >
                          Export CSV
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    );
  }

  // Render Logged Out Landing Page
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Navbar */}
      <nav className="border-b border-primary/20 bg-background sticky top-0 z-40 px-4 py-3 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="h-10 w-10 border border-primary/30 rounded-xl flex items-center justify-center bg-primary/5">
              <Image src="/MCU-LOGO-0.2V-1.png" alt="MCU Logo" width={28} height={28} className="h-6 w-6 object-contain" />
            </span>
            <div>
              <span className="block text-[8px] font-bold uppercase tracking-[0.3em] text-primary/60">Stock Creator AI</span>
              <span className="text-[14px] font-bold tracking-[0.2em] text-primary">MCUSTOCK</span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/login" className="px-4 py-2 border border-primary/25 rounded-xl text-xs font-bold text-primary hover:bg-primary/5 transition-colors">
              Log In
            </Link>
            <Link href="/signup" className="px-4 py-2 bg-primary text-background rounded-xl text-xs font-bold hover:bg-primary-hover transition-colors">
              Start Free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-4xl mx-auto px-4 py-20 text-center space-y-6">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-[10px] font-bold uppercase tracking-widest">
          <Sparkles className="w-3.5 h-3.5" />
          AI Stock Metadata Automation
        </div>
        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-primary leading-[1.15]">
          High-Precision SEO Metadata & Agency Exports
        </h1>
        <p className="text-sm sm:text-lg text-primary/80 max-w-2xl mx-auto leading-relaxed">
          Upload stock photography and automatically generate optimized titles, descriptions, and 49 keywords. Export perfectly structured CSV files for major stock agencies in seconds.
        </p>
        <div className="flex justify-center gap-3 pt-4">
          <Link href="/signup" className="px-6 py-3 bg-primary text-background rounded-xl text-sm font-bold hover:bg-primary-hover transition-colors flex items-center gap-2">
            Get Started for Free
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Feature section */}
      <section className="border-t border-primary/10 py-16 bg-primary/5">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="border border-primary/20 bg-background rounded-2xl p-6 space-y-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-primary">AI Metadata Engine</h3>
            <p className="text-xs text-primary/80 leading-relaxed">
              State-of-the-art vision models analyze images to write human-like descriptive titles, search-optimized descriptions, and categories.
            </p>
          </div>

          <div className="border border-primary/20 bg-background rounded-2xl p-6 space-y-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-primary">Agency CSV Exports</h3>
            <p className="text-xs text-primary/80 leading-relaxed">
              Export perfect columns compliant with guidelines for Adobe Stock, Shutterstock, Freepik, and Vecteezy to remove manual cleanup work.
            </p>
          </div>

          <div className="border border-primary/20 bg-background rounded-2xl p-6 space-y-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Type className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-primary">Prompt Extractor</h3>
            <p className="text-xs text-primary/80 leading-relaxed">
              Reverse engineer visuals into precise text prompts for tools like Midjourney or Stable Diffusion. Fine-tune length, parameters, and style.
            </p>
          </div>
        </div>
      </section>

      {/* Simple CTA */}
      <section className="border-t border-primary/10 py-16 text-center space-y-5">
        <h2 className="text-2xl sm:text-3xl font-bold text-primary">Start simplifying your workflow today</h2>
        <p className="text-xs sm:text-sm text-primary/70">Create a secure MongoDB account, add your API keys, and start processing files.</p>
        <Link href="/signup" className="inline-block px-6 py-2.5 bg-primary text-background rounded-xl text-xs font-bold hover:bg-primary-hover transition-colors">
          Register Account
        </Link>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-primary/20 py-6 text-center text-[10px] font-bold tracking-wider text-primary/60">
        © {new Date().getFullYear()} MCUSTOCK AI. Built for Stock Photography Contributors.
      </footer>
    </div>
  );
}
