"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  UploadCloud,
  Zap,
  Download,
  Lock,
  Wrench,
  X,
  Copy,
  RefreshCw,
  ImagePlus,
  Layers,
  Type,
  Pencil,
  Plus,
  Check,
  FileJson,
  ExternalLink
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ensureAccessToken, getAuthUser, AuthUser } from "@/lib/auth";
import { AI_DEFAULT_MODELS, AI_PROVIDERS, AI_PROVIDER_NAMES } from "@/lib/ai-models";
import PremiumSlider from "@/components/PremiumSlider";
import { StoredProviderKey, getActiveProvider, getProviderKeys, getProviderModels, syncProviderKeys, saveActiveProvider, saveProviderKeys, saveProviderModel, saveRemoteProviderKey, deleteRemoteProviderKey } from "@/lib/ai-settings";
import { useGeneratorState, GeneratorImageFile } from "../GeneratorStateContext";
import { compressImageForUpload } from "@/lib/client-image";

type ImageFile = GeneratorImageFile;

const PROVIDER_KEY_URLS: Record<string, string> = {
  Groq: 'https://console.groq.com/keys',
  'Google Gemini': 'https://aistudio.google.com/app/apikey',
  OpenAI: 'https://platform.openai.com/api-keys',
  'Mistral AI': 'https://console.mistral.ai/api-keys/',
  OpenRouter: 'https://openrouter.ai/settings/keys',
};

export default function GeneratorPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [activeTab, setActiveTab] = useState<"Metadata" | "Prompt">("Metadata");
  const [platform, setPlatform] = useState("General");
  const [titleLength, setTitleLength] = useState(200);
  const [descriptionLength, setDescriptionLength] = useState(150);
  const [keywordsCount, setKeywordsCount] = useState(30);
  const [additionalKeywords, setAdditionalKeywords] = useState('');
  const [negativeTitleWords, setNegativeTitleWords] = useState('');
  const [negativeKeywords, setNegativeKeywords] = useState('');
  const [autoCsvDownload, setAutoCsvDownload] = useState(false);

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
  const [apiKeys, setApiKeys] = useState<StoredProviderKey[]>([]);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [batchMode, setBatchMode] = useState(false);
  const keyCursorRef = useRef(0);

  const platforms = ["General", "Adobe Stock", "Shutterstock", "FreePik", "Vecteezy", "Pond5"];
  const [selectedModels, setSelectedModels] = useState<Record<string, string>>(AI_DEFAULT_MODELS);
  const activeModel = selectedModels[activeProvider] ?? AI_DEFAULT_MODELS[activeProvider] ?? '';

  // Image Queue
  const { images, setImages, isGenerating, setIsGenerating } = useGeneratorState();
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [keywordDrafts, setKeywordDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setUser(getAuthUser());
    setApiKeys(getProviderKeys());
    setSelectedModels(getProviderModels());
    setActiveProvider(getActiveProvider());
    void syncProviderKeys().then((syncedKeys) => {
      setApiKeys(syncedKeys);
    });
  }, [setImages]);

  const saveKey = async () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed || apiKeys.some(k => k.key === trimmed && k.provider === activeProvider)) return;
    const newKeyObj: StoredProviderKey = {
      id: crypto.randomUUID(),
      key: trimmed,
      provider: activeProvider,
      lastFour: trimmed.slice(-4),
    };
    const newKeys = [...apiKeys, newKeyObj];
    setApiKeys(newKeys);
    saveProviderKeys(newKeys);
    setApiKeyInput('');

    const res = await saveRemoteProviderKey(newKeyObj);
    if ('key' in res && res.key?.id) {
      const updatedKeys = newKeys.map(k => k.id === newKeyObj.id ? { ...k, id: res.key.id } : k);
      setApiKeys(updatedKeys);
      saveProviderKeys(updatedKeys);
    }
  };

  const removeKey = (id: string) => {
    const target = apiKeys.find(k => k.id === id);
    const newKeys = apiKeys.filter(k => k.id !== id);
    setApiKeys(newKeys);
    saveProviderKeys(newKeys);
    if (target?.id) {
      void deleteRemoteProviderKey(target.id);
    }
  };

  const activeProviderKeyObj = apiKeys.find(k => k.provider === activeProvider);

  const updateMetadata = (id: string, update: Partial<NonNullable<ImageFile['metadata']>>) => {
    setImages(prev => prev.map(image => image.id === id && image.metadata
      ? { ...image, metadata: { ...image.metadata, ...update } }
      : image));
  };

  const addKeyword = (image: ImageFile) => {
    const value = (keywordDrafts[image.id] || '').trim().toLowerCase();
    if (!value || !image.metadata || image.metadata.keywords.includes(value)) return;
    updateMetadata(image.id, { keywords: [...image.metadata.keywords, value] });
    setKeywordDrafts(prev => ({ ...prev, [image.id]: '' }));
  };

  const downloadMetadataJson = (image: ImageFile) => {
    if (!image.metadata) return;
    const blob = new Blob([JSON.stringify({ filename: image.file.name, ...image.metadata }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${image.file.name.replace(/\.[^.]+$/, '')}-metadata.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const remainingSlots = Math.max(500 - images.length, 0);
    const newImages = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, remainingSlots).map(file => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      status: 'pending' as const,
    }));
    setImages(prev => [...prev, ...newImages]);
  }, [images.length, setImages]);

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

  const generateSingle = async (img: ImageFile, attemptedKeyIds = new Set<string>()) => {
    const providerKeys = apiKeys.filter(key => key.provider === activeProvider);
    const availableKeys = providerKeys.filter(key => !attemptedKeyIds.has(key.id));
    const keyIndex = availableKeys.length ? keyCursorRef.current++ % availableKeys.length : 0;
    const keyObject = availableKeys[keyIndex];
    const keyToUse = keyObject?.key || '';

    setImages(prev => prev.map(i => i.id === img.id ? { ...i, status: 'generating', error: undefined } : i));

    try {
      const fd = new FormData();
      const uploadImage = await compressImageForUpload(img.file);
      fd.append('image', uploadImage);
      if (keyToUse) {
        fd.append('apiKey', keyToUse);
      }
      fd.append('provider', activeProvider);
      fd.append('model', activeModel);

      let endpoint = '/api/generate';
      if (activeTab === 'Metadata') {
        fd.append('titleLength', titleLength.toString());
        fd.append('descriptionLength', descriptionLength.toString());
        fd.append('keywordsCount', keywordsCount.toString());
        fd.append('platform', platform);
        fd.append('additionalKeywords', additionalKeywords);
        fd.append('negativeTitleWords', negativeTitleWords);
        fd.append('negativeKeywords', negativeKeywords);
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

      const token = await ensureAccessToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const controller = new AbortController();
      const requestTimeout = window.setTimeout(() => controller.abort(), 60000);
      const res = await fetch(endpoint, { method: 'POST', headers, body: fd, signal: controller.signal }).finally(() => {
        window.clearTimeout(requestTimeout);
      });
      const data = await res.json().catch(() => ({ success: false, error: `Generation service returned HTTP ${res.status}` }));

      if (!res.ok || !data.success) {
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
            const accessToken = await ensureAccessToken();
            await fetch('/api/history/save', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
              },
              body: JSON.stringify({
                filename: img.file.name,
                title: data.metadata.title,
                description: data.metadata.description,
                keywords: data.metadata.keywords,
                category: data.metadata.category,
              }),
            });
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
      const errorMessage = err instanceof Error ? err.message : 'Generation failed';
      const isRateLimited = errorMessage.toLowerCase().includes('rate limit') || errorMessage.toLowerCase().includes('quota');
      if (isRateLimited && providerKeys.some(key => key.id !== keyObject.id && !attemptedKeyIds.has(key.id))) {
        const nextAttempts = new Set(attemptedKeyIds);
        nextAttempts.add(keyObject.id);
        await generateSingle(img, nextAttempts);
        return;
      }
      const message = err instanceof DOMException && err.name === 'AbortError'
        ? 'Generation timed out after 35 seconds. Check the provider, model, and API key, then retry.'
        : err instanceof Error ? err.message : 'Generation failed';
      setImages(prev => prev.map(i => i.id === img.id ? { ...i, status: 'error', error: message } : i));
    }
  };

  const generateAll = async () => {
    if (!activeProviderKeyObj) {
      setApiKeyModalOpen(true);
      return;
    }
    setIsGenerating(true);
    const targets = images.filter(i => i.status !== 'done').slice(0, 500);
    const providerKeyCount = apiKeys.filter(key => key.provider === activeProvider).length;
    const CONCURRENCY = activeProvider === 'Google Gemini'
      ? (batchMode ? 2 : 1)
      : Math.min(Math.max(providerKeyCount, 1) * (batchMode ? 2 : 1), batchMode ? 8 : 3);
    for (let i = 0; i < targets.length; i += CONCURRENCY) {
      const batch = targets.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(img => generateSingle(img)));
    }
    setIsGenerating(false);
    if (autoCsvDownload) exportCSV();
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
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
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
              <label className="block text-[10px] font-bold text-foreground/60 uppercase tracking-wider mb-1">AI Provider</label>
              <select
                value={activeProvider}
                onChange={e => {
                  setActiveProvider(e.target.value);
                  saveActiveProvider(e.target.value);
                }}
                className="w-full text-xs font-semibold bg-background border border-[var(--card-border)] rounded-xl px-3 py-2 text-foreground outline-none focus:border-primary"
              >
                {AI_PROVIDER_NAMES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-foreground/60 uppercase tracking-wider mb-1">Model</label>
              <select
                value={activeModel}
                onChange={e => {
                  setSelectedModels(prev => ({ ...prev, [activeProvider]: e.target.value }));
                  saveProviderModel(activeProvider, e.target.value);
                }}
                className="w-full text-xs font-semibold bg-background border border-[var(--card-border)] rounded-xl px-3 py-2 text-foreground outline-none focus:border-primary"
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
            <div className="space-y-6 pt-4 border-t border-[var(--card-border)]">
              <div>
                <label className="block text-[10px] font-bold text-foreground/60 uppercase tracking-wider mb-3">Export Platform</label>
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
              <PremiumSlider label="DESCRIPTION LENGTH" value={descriptionLength} min={50} max={300} suffix=" CHARS" onChange={setDescriptionLength} />
              <PremiumSlider label="KEYWORDS COUNT" value={keywordsCount} min={5} max={50} suffix=" KEYS" onChange={setKeywordsCount} />
              <div className="space-y-2 border-t border-[var(--card-border)] pt-4">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-foreground/60">Additional keywords</label>
                <input value={additionalKeywords} onChange={e => setAdditionalKeywords(e.target.value)} placeholder="e.g. sustainable, editorial, premium" className="w-full rounded-xl border border-[var(--card-border)] bg-background px-3 py-2 text-xs text-foreground placeholder:text-foreground/35 outline-none focus:border-primary" />
                <label className="block text-[10px] font-bold uppercase tracking-wider text-foreground/60">Negative title words</label>
                <input value={negativeTitleWords} onChange={e => setNegativeTitleWords(e.target.value)} placeholder="e.g. best, beautiful, amazing" className="w-full rounded-xl border border-[var(--card-border)] bg-background px-3 py-2 text-xs text-foreground placeholder:text-foreground/35 outline-none focus:border-primary" />
                <label className="block text-[10px] font-bold uppercase tracking-wider text-foreground/60">Negative keywords</label>
                <input value={negativeKeywords} onChange={e => setNegativeKeywords(e.target.value)} placeholder="e.g. logo, watermark, blurry" className="w-full rounded-xl border border-[var(--card-border)] bg-background px-3 py-2 text-xs text-foreground placeholder:text-foreground/35 outline-none focus:border-primary" />
                <label className="flex items-center justify-between pt-2 text-xs font-semibold text-foreground">
                  Auto CSV download
                  <input type="checkbox" checked={autoCsvDownload} onChange={e => setAutoCsvDownload(e.target.checked)} className="h-4 w-4 accent-primary" />
                </label>
              </div>
            </div>
          ) : (
            <div className="space-y-5 pt-4 border-t border-[var(--card-border)] text-xs text-foreground font-semibold">
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
                    <span className="text-[10px] font-bold text-foreground/60 uppercase">Prefix</span>
                    <input type="checkbox" checked={usePrefix} onChange={e => setUsePrefix(e.target.checked)} className="accent-primary" />
                  </div>
                  {usePrefix && (
                    <input
                      type="text"
                      value={prefixText}
                      onChange={e => setPrefixText(e.target.value)}
                      placeholder="Start prompt with..."
                      className="w-full bg-background border border-[var(--card-border)] rounded-xl px-3 py-1.5 text-xs text-foreground placeholder:text-foreground/35 outline-none focus:border-primary"
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-foreground/60 uppercase">Suffix</span>
                    <input type="checkbox" checked={useSuffix} onChange={e => setUseSuffix(e.target.checked)} className="accent-primary" />
                  </div>
                  {useSuffix && (
                    <input
                      type="text"
                      value={suffixText}
                      onChange={e => setSuffixText(e.target.value)}
                      placeholder="End prompt with..."
                      className="w-full bg-background border border-[var(--card-border)] rounded-xl px-3 py-1.5 text-xs text-foreground placeholder:text-foreground/35 outline-none focus:border-primary"
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-foreground/60 uppercase">Negative Exclude</span>
                    <input type="checkbox" checked={useNegativePrompt} onChange={e => setUseNegativePrompt(e.target.checked)} className="accent-primary" />
                  </div>
                  {useNegativePrompt && (
                    <input
                      type="text"
                      value={negativePromptText}
                      onChange={e => setNegativePromptText(e.target.value)}
                      placeholder="Exclude terms..."
                      className="w-full bg-background border border-[var(--card-border)] rounded-xl px-3 py-1.5 text-xs text-foreground placeholder:text-foreground/35 outline-none focus:border-primary"
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
              <label className="inline-flex items-center gap-2 text-xs font-bold text-primary">
                <input type="checkbox" checked={batchMode} onChange={e => setBatchMode(e.target.checked)} className="h-4 w-4 accent-primary" />
                Batch mode (up to 500)
              </label>
              <button 
                 onClick={generateAll}
                 disabled={isGenerating || images.length === 0}
                 className="px-5 py-2 bg-primary text-background rounded-xl text-xs font-bold hover:bg-primary-hover disabled:opacity-40 transition-all flex items-center gap-1.5"
               >
                <Zap className="w-3.5 h-3.5" />
                {isGenerating ? 'Processing batch...' : batchMode ? 'Generate batch' : 'Generate All'}
              </button>
            </div>
          </div>
        )}

        {/* Queue Outputs Display */}
        {images.length > 0 && (
          <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3 shadow-[0_18px_45px_rgba(0,0,0,.08)] sm:p-5">
            <div className="mb-4 flex items-center justify-between border-b border-primary/10 pb-4">
              <div>
                <h3 className="text-sm font-bold text-foreground">Generated Results</h3>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-primary/60">{images.length} image{images.length === 1 ? '' : 's'} in this batch</p>
              </div>
              <span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[10px] font-bold text-primary">
                {images.filter(image => image.status === 'done').length}/{images.length} ready
              </span>
            </div>
            <div className="max-h-[calc(100vh-190px)] space-y-4 overflow-y-auto pr-1 sm:max-h-[calc(100vh-210px)]">
              {images.map(img => (
                <div key={img.id} className="border border-[var(--card-border)] rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row gap-5 bg-[var(--input-bg)]">
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
                {(img.status === 'pending' || img.status === 'error') && (
                  <button onClick={() => generateSingle(img)} className="self-start px-4 py-2 border border-primary/25 rounded-xl text-xs font-bold text-primary hover:bg-primary/5 transition-colors">
                    <RefreshCw className="mr-1.5 inline h-3.5 w-3.5" /> {img.status === 'error' ? 'Retry generation' : 'Process individually'}
                  </button>
                )}

                {img.status === 'generating' && (
                  <div className="flex items-center gap-2 text-xs font-bold text-primary">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Analyzing image features...
                  </div>
                )}

                {img.status === 'error' && (
                  <p className="mt-3 text-xs font-bold text-red-400 border border-dashed border-red-400/30 p-3 rounded-xl">
                    {img.error || 'Generation failed. Verify API key and provider settings.'}
                  </p>
                )}

                {img.status === 'done' && img.metadata && activeTab === 'Metadata' && (
                  <div className="space-y-4 text-xs">
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-bold text-primary/60 uppercase mb-1">
                        <span>Title</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => { setEditingTitleId(img.id); setTitleDraft(img.metadata!.title); }} className="hover:underline flex items-center gap-1"><Pencil className="h-3 w-3" /> Edit</button>
                          <button onClick={() => navigator.clipboard.writeText(img.metadata!.title)} className="hover:underline flex items-center gap-1"><Copy className="w-3 h-3" /> Copy</button>
                        </div>
                      </div>
                      {editingTitleId === img.id ? (
                        <div className="flex gap-2">
                          <input value={titleDraft} onChange={e => setTitleDraft(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-primary/20 bg-background p-3 text-primary outline-none" />
                          <button onClick={() => { updateMetadata(img.id, { title: titleDraft.trim() || img.metadata!.title }); setEditingTitleId(null); }} className="rounded-xl bg-primary px-3 text-background" title="Save title"><Check className="h-4 w-4" /></button>
                        </div>
                      ) : <div className="rounded-xl border border-primary/10 bg-primary/5 p-3 font-medium text-primary">{img.metadata.title}</div>}
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <span className="mb-1 block text-[10px] font-bold uppercase text-primary/60">Category</span>
                        <div className="rounded-xl border border-primary/10 bg-primary/5 p-3 font-medium text-primary">{img.metadata.category || 'General'}</div>
                      </div>
                      <div>
                        <span className="mb-1 block text-[10px] font-bold uppercase text-primary/60">Actions</span>
                        <button onClick={() => generateSingle(img)} className="inline-flex items-center gap-1.5 rounded-xl border border-primary/25 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/5">
                          <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                        </button>
                      </div>
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
                      <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-primary/10 bg-primary/5 p-2.5">
                        {img.metadata.keywords.map((k, idx) => (
                          <button key={`${k}-${idx}`} onClick={() => updateMetadata(img.id, { keywords: img.metadata!.keywords.filter((_, keywordIndex) => keywordIndex !== idx) })} className="group rounded-full border border-primary/15 bg-background px-2.5 py-1 text-[10px] font-bold text-primary" title="Remove keyword">
                            {k} <span className="ml-1 text-primary/40 group-hover:text-red-400">x</span>
                          </button>
                        ))}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <input value={keywordDrafts[img.id] || ''} onChange={e => setKeywordDrafts(prev => ({ ...prev, [img.id]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') addKeyword(img); }} placeholder="Add keyword..." className="min-w-0 flex-1 rounded-xl border border-primary/20 bg-background px-3 py-2 text-xs text-primary outline-none" />
                        <button onClick={() => addKeyword(img)} className="rounded-xl border border-primary/25 px-3 text-primary" title="Add keyword"><Plus className="h-4 w-4" /></button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 border-t border-primary/10 pt-3">
                      <button onClick={() => navigator.clipboard.writeText(`${img.metadata!.title}\n\n${img.metadata!.description}\n\n${img.metadata!.keywords.join(', ')}`)} className="inline-flex items-center gap-1.5 rounded-xl border border-primary/20 px-3 py-2 text-[10px] font-bold text-primary hover:bg-primary/5"><Copy className="h-3 w-3" /> Copy all</button>
                      <button onClick={() => downloadMetadataJson(img)} className="inline-flex items-center gap-1.5 rounded-xl border border-primary/20 px-3 py-2 text-[10px] font-bold text-primary hover:bg-primary/5"><FileJson className="h-3 w-3" /> JSON</button>
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
          </section>
        )}

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
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {AI_PROVIDER_NAMES.map(provider => {
                    const connected = apiKeys.some(key => key.provider === provider);
                    return (
                      <button
                        key={provider}
                        type="button"
                        onClick={() => {
                          setActiveProvider(provider);
                          saveActiveProvider(provider);
                        }}
                        className={`rounded-xl border p-2 text-left transition-colors ${activeProvider === provider ? 'border-primary bg-primary/15' : 'border-primary/10 bg-primary/5 hover:border-primary/30'}`}
                      >
                        <span className="block truncate text-[10px] font-bold">{provider}</span>
                        <span className={`mt-1 block text-[9px] font-semibold ${connected ? 'text-primary' : 'text-amber-500'}`}>
                          {connected ? 'Connected' : 'Add key'}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-primary/60 uppercase tracking-wider mb-1">Select Provider</label>
                  <select
                    value={activeProvider}
                    onChange={e => {
                      setActiveProvider(e.target.value);
                      saveActiveProvider(e.target.value);
                    }}
                    className="w-full text-xs font-semibold bg-background border border-primary/20 rounded-xl px-3 py-2 outline-none text-primary"
                  >
                    {AI_PROVIDER_NAMES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label className="block text-[10px] font-bold text-primary/60 uppercase tracking-wider">Configure API Key</label>
                    <a
                      href={PROVIDER_KEY_URLS[activeProvider]}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold text-primary hover:underline"
                    >
                      Get API Key <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
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
                <div className="rounded-xl border border-primary/10 bg-primary/5 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary/60">Active model</span>
                    <span className="text-[10px] font-bold text-primary">{activeProviderKeyObj ? 'Ready' : 'Needs API key'}</span>
                  </div>
                  <select
                    value={activeModel}
                    onChange={e => {
                      setSelectedModels(prev => ({ ...prev, [activeProvider]: e.target.value }));
                      saveProviderModel(activeProvider, e.target.value);
                    }}
                    className="mt-2 w-full rounded-xl border border-primary/20 bg-background px-3 py-2 text-xs font-semibold text-primary outline-none"
                  >
                    {(AI_PROVIDERS[activeProvider] || []).map(model => <option key={model.id} value={model.id}>{model.label}</option>)}
                  </select>
                </div>

                {apiKeys.length > 0 && (
                  <div className="pt-3 border-t border-primary/10 space-y-1.5">
                    <p className="text-[10px] font-bold text-primary/60 uppercase">Configured Keys:</p>
                    {apiKeys.filter(key => key.provider === activeProvider).map((k, index) => (
                      <div key={k.id} className="flex items-center justify-between text-xs border border-primary/10 rounded-xl p-2 bg-primary/5">
                        <span className="font-bold text-primary">{k.provider} key {index + 1}</span>
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
