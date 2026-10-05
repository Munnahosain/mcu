'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { compressImageForUpload } from '@/lib/client-image';

type ElementAction = 'keep' | 'replace' | 'modify';
type AnalysisElement = {
  id: string;
  name: string;
  details: string;
  suggestedAction: ElementAction;
  variable: string;
};
type ReferenceAnalysis = {
  overview: string;
  composition: string;
  subject: string;
  camera: string;
  lighting: string;
  background: string;
  design: string;
  style: string;
  palette?: string;
  visibleText?: string;
  elements: AnalysisElement[];
};
type PromptGoal = 'recreate' | 'style' | 'template';
type SavedTemplate = {
  id: string;
  name: string;
  analysis: ReferenceAnalysis;
  actions: Record<string, ElementAction>;
  replacements: Record<string, string>;
  assetMappings: Record<string, string>;
  brandKit: { name: string; colors: string; logo: string; typography: string; cta: string };
  goal?: PromptGoal;
  influence: 'strict' | 'balanced' | 'loose';
  instructions: string;
  templatePrompt: string;
  finalPrompt: string;
  negativePrompt: string;
};

type Props = {
  provider: string;
  model: string;
  apiKey?: string;
  hasStoredKey: boolean;
  storageScope: string;
};

const MAX_LOCAL_FILE_BYTES = 20 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const STORAGE_KEY = 'mcustock_reference_templates';
const NEGATIVE_PROMPT = 'low quality, blurry, distorted anatomy, extra fingers, malformed hands, duplicate subjects, unreadable text, watermark, unintended logo, oversaturated colors, cluttered composition';
const EMPTY_BRAND_KIT = { name: '', colors: '', logo: '', typography: '', cta: '' };

function storageKey(scope: string) {
  return `${STORAGE_KEY}:${encodeURIComponent(scope || 'guest')}`;
}

function promptSections(analysis: ReferenceAnalysis) {
  return [
    `Visual concept: ${analysis.overview}`,
    `Composition and layout: ${analysis.composition}`,
    `Subject: ${analysis.subject}`,
    `Camera and framing: ${analysis.camera}`,
    `Lighting: ${analysis.lighting}`,
    `Background: ${analysis.background}`,
    `Design and typography: ${analysis.design}`,
    `Visual style and mood: ${analysis.style}`,
    ...(analysis.palette ? [`Color palette: ${analysis.palette}`] : []),
    ...(analysis.visibleText ? [`Exact visible text to reproduce: ${analysis.visibleText}`] : []),
  ];
}

async function copyText(value: string) {
  if (!value.trim()) throw new Error('Generate the prompt before copying it.');
  await navigator.clipboard.writeText(value);
}

function exportPrompts(template: string, final: string, negative: string) {
  const content = [
    'TEMPLATE PROMPT',
    template,
    '',
    'FINAL PROMPT',
    final,
    '',
    'NEGATIVE PROMPT',
    negative,
  ].join('\n');
  const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `reference-template-${Date.now()}.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function getDefaultAction(element: AnalysisElement, actions: Record<string, ElementAction>, goal: PromptGoal) {
  if (actions[element.id]) return actions[element.id];
  if (goal === 'template') return element.suggestedAction || 'replace';
  if (goal === 'style' && /person|face|pose|outfit|product|subject|logo|brand|text|wording/i.test(element.name)) {
    return 'replace';
  }
  return 'keep';
}

export default function ReferenceTemplateGenerator({ provider, model, apiKey, hasStoredKey, storageScope }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [dimensions, setDimensions] = useState('');
  const [analysis, setAnalysis] = useState<ReferenceAnalysis | null>(null);
  const [actions, setActions] = useState<Record<string, ElementAction>>({});
  const [replacements, setReplacements] = useState<Record<string, string>>({});
  const [assetMappings, setAssetMappings] = useState<Record<string, string>>({});
  const [goal, setGoal] = useState<PromptGoal>('recreate');
  const [influence, setInfluence] = useState<'strict' | 'balanced' | 'loose'>('strict');
  const [instructions, setInstructions] = useState('');
  const [brandKit, setBrandKit] = useState(EMPTY_BRAND_KIT);
  const [showBrandKit, setShowBrandKit] = useState(false);
  const [templatePrompt, setTemplatePrompt] = useState('');
  const [finalPrompt, setFinalPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState(NEGATIVE_PROMPT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [saveName, setSaveName] = useState('');
  const canAnalyze = Boolean(referenceFile && (apiKey || hasStoredKey));
  const activeStorageKey = useMemo(() => storageKey(storageScope), [storageScope]);

  useEffect(() => {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(activeStorageKey) || '[]');
      if (Array.isArray(parsed)) {
        setSavedTemplates(parsed.filter((item): item is SavedTemplate =>
          Boolean(item && typeof item === 'object' &&
            typeof (item as SavedTemplate).id === 'string' &&
            typeof (item as SavedTemplate).name === 'string' &&
            (item as SavedTemplate).analysis &&
            typeof (item as SavedTemplate).templatePrompt === 'string')
        ));
      }
    } catch (storageError) {
      console.error('[ReferenceTemplateGenerator] Could not read saved templates:', storageError);
      setError('Saved templates could not be loaded from this browser.');
    }
  }, [activeStorageKey]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const clearGenerated = () => {
    setTemplatePrompt('');
    setFinalPrompt('');
  };

  const chooseReference = async (file?: File) => {
    setError('');
    setNotice('');
    if (!file) return;
    if (!ACCEPTED_TYPES.has(file.type)) {
      setError('Choose a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > MAX_LOCAL_FILE_BYTES) {
      setError('The reference image must be 20 MB or smaller.');
      return;
    }

    try {
      const bitmap = await createImageBitmap(file);
      const size = `${bitmap.width} × ${bitmap.height}`;
      bitmap.close();
      const prepared = await compressImageForUpload(file);
      setReferenceFile(prepared);
      setDimensions(size);
      setAnalysis(null);
      clearGenerated();
      setPreviewUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return URL.createObjectURL(prepared);
      });
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : 'The image could not be prepared.');
    }
  };

  const analyzeReference = async () => {
    if (!referenceFile) {
      setError('Upload a reference image first.');
      return;
    }
    if (!apiKey && !hasStoredKey) {
      setError(`Add an API key for ${provider} in the provider settings before analyzing.`);
      return;
    }

    setLoading(true);
    setError('');
    setNotice('');
    try {
      const formData = new FormData();
      formData.append('image', referenceFile);
      formData.append('provider', provider);
      formData.append('model', model);
      if (apiKey) formData.append('apiKey', apiKey);

      const response = await fetch('/api/reference-template/analyze', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Reference analysis failed. Please retry.');
      }
      setAnalysis(data.analysis as ReferenceAnalysis);
      setActions({});
      setReplacements({});
      setAssetMappings({});
      clearGenerated();
      setNotice('Reference analyzed. Review each element and choose what to keep, replace, or modify.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Reference analysis failed.');
    } finally {
      setLoading(false);
    }
  };

  const generatePrompts = () => {
    if (!analysis) {
      setError('Analyze a reference image before generating prompts.');
      return;
    }
    const actionLines = analysis.elements.map((element) => {
      const action = getDefaultAction(element, actions, goal);
      const variable = element.variable || element.name.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
      if (action === 'keep') return `Reproduce ${element.name} as seen in the reference without redesigning it: ${element.details}`;
      if (action === 'modify') return `Modify ${element.name} as {{${variable}}}, changing only the requested attribute and keeping all other observed details: ${element.details}`;
      return `Replace only ${element.name} with {{${variable}}}; leave the rest of the image unchanged and do not copy the original ${element.name}: ${element.details}`;
    });
    const goalInstruction = {
      recreate: 'Create the closest faithful recreation of the uploaded reference image. If the image-generation model supports image reference, image-to-image, or visual conditioning, use the uploaded reference directly as the visual condition rather than relying on text alone. Match the same scene and subject, crop, aspect ratio, camera angle, subject count and placement, pose, expression, silhouette, perspective, background objects, negative space, lighting direction and softness, shadow shape, palette, contrast, textures, typography, and visible text. Preserve small distinctive details. Do not add, remove, move, or redesign anything unless explicitly listed in the element changes or custom instructions. Do not invent text or logos.',
      style: 'Create a new image with different subject/content, but closely match the reference visual style: its medium, palette, lighting character, contrast, texture, typography treatment, and mood. Do not copy the original subject, wording, or brand identity unless explicitly requested.',
      template: 'Create a reusable image template based on the reference. Preserve its layout, hierarchy, style, and visual rhythm while replacing only the selected elements with clearly usable placeholders.',
    }[goal];
    const controlLines = [
      `Reference influence: ${influence === 'strict' ? 'maximum fidelity; preserve nearly all unedited details' : influence === 'loose' ? 'allow creative variation in unedited details while retaining the selected goal' : 'preserve the reference strongly while allowing only requested changes'}.`,
      goalInstruction,
      ...promptSections(analysis),
      ...actionLines,
    ];
    if (brandKit.name || brandKit.colors || brandKit.logo || brandKit.typography || brandKit.cta) {
      controlLines.push(`Brand kit: ${[
        brandKit.name && `brand name "${brandKit.name}"`,
        brandKit.colors && `brand colors ${brandKit.colors}`,
        brandKit.logo && `logo asset ${brandKit.logo}`,
        brandKit.typography && `typography ${brandKit.typography}`,
        brandKit.cta && `call to action "${brandKit.cta}"`,
      ].filter(Boolean).join('; ')}.`);
    }
    if (instructions.trim()) controlLines.push(`Additional instructions: ${instructions.trim()}`);
    const template = [
      'REFERENCE-DRIVEN IMAGE PROMPT',
      'Use the uploaded reference image as the source of truth. Resolve conflicts in favor of the reference and the explicit Keep/Replace/Modify choices below.',
      ...controlLines,
      'Render one coherent final image. Keep the original aspect ratio and crop unless instructed otherwise. Preserve legibility of requested text, accurate object count and placement, realistic perspective, clean edges, and professional image quality.',
    ].join('\n\n');
    const final = template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (placeholder, variable: string) => {
      const element = analysis.elements.find((item) => item.variable === variable);
      if (!element) return placeholder;
      const replacement = replacements[element.id]?.trim();
      const asset = assetMappings[element.id]?.trim();
      return [replacement, asset && `use the attached asset "${asset}"`].filter(Boolean).join('; ') || placeholder;
    });
    setTemplatePrompt(template);
    setFinalPrompt(final);
    if (!negativePrompt.trim()) setNegativePrompt(NEGATIVE_PROMPT);
    setError('');
    setNotice('Template and final prompts are ready. Review or edit them below.');
  };

  const setAllActions = (action: ElementAction) => {
    if (!analysis) return;
    setActions(Object.fromEntries(analysis.elements.map((element) => [element.id, action])));
    clearGenerated();
  };

  const applyQuickAction = (term: string, action: ElementAction) => {
    if (!analysis) return;
    const matches = analysis.elements.filter((element) => `${element.name} ${element.details}`.toLowerCase().includes(term));
    if (!matches.length) {
      setNotice(`No matching ${term} element was detected. You can add it to the prompt with custom instructions.`);
      return;
    }
    setActions((previous) => ({ ...previous, ...Object.fromEntries(matches.map((element) => [element.id, action])) }));
    clearGenerated();
    setNotice(`${matches.map((element) => element.name).join(', ')} set to ${action}.`);
  };

  const persistTemplates = (items: SavedTemplate[]) => {
    try {
      localStorage.setItem(activeStorageKey, JSON.stringify(items));
      setSavedTemplates(items);
    } catch (storageError) {
      console.error('[ReferenceTemplateGenerator] Could not save templates:', storageError);
      setError('Could not save the template. Browser storage may be full.');
    }
  };

  const saveTemplate = () => {
    if (!analysis || !templatePrompt) {
      setError('Generate a template before saving it.');
      return;
    }
    const item: SavedTemplate = {
      id: `${Date.now()}`,
      name: saveName.trim() || `Reference template ${savedTemplates.length + 1}`,
      analysis,
      actions,
      replacements,
      assetMappings,
      brandKit,
      goal,
      influence,
      instructions,
      templatePrompt,
      finalPrompt,
      negativePrompt,
    };
    persistTemplates([item, ...savedTemplates].slice(0, 30));
    setSaveName('');
    setNotice('Template saved in this browser for this account.');
  };

  const loadTemplate = (item: SavedTemplate) => {
    setAnalysis(item.analysis);
    setActions(item.actions || {});
    setReplacements(item.replacements || {});
    setAssetMappings(item.assetMappings || {});
    setBrandKit(item.brandKit || EMPTY_BRAND_KIT);
    setGoal(item.goal || 'recreate');
    setInfluence(item.influence || 'strict');
    setInstructions(item.instructions || '');
    setTemplatePrompt(item.templatePrompt || '');
    setFinalPrompt(item.finalPrompt || '');
    setNegativePrompt(item.negativePrompt || NEGATIVE_PROMPT);
    setNotice(`Loaded "${item.name}". Upload its reference image again if you want to reanalyze it.`);
    setError('');
  };

  const removeTemplate = (id: string) => {
    persistTemplates(savedTemplates.filter((item) => item.id !== id));
    setNotice('Saved template removed.');
  };

  const updateBrand = (key: keyof typeof EMPTY_BRAND_KIT, value: string) => {
    setBrandKit((previous) => ({ ...previous, [key]: value }));
    clearGenerated();
  };

  return (
    <section className="min-w-0 space-y-5 rounded-2xl border border-primary/15 bg-background/60 p-4 sm:p-6" aria-labelledby="reference-template-title">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-primary">
            <Sparkles className="h-5 w-5" />
            <h2 id="reference-template-title" className="text-lg font-bold">Advanced Reference Template</h2>
          </div>
          <p className="max-w-3xl text-xs leading-relaxed text-[var(--text-secondary)]">
            Analyze one reference, choose what stays or changes, then build reusable template, final, and negative prompts.
          </p>
        </div>
        <span className="w-fit rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-[10px] font-bold text-primary">
          {provider} · {model}
        </span>
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.2fr)]">
        <div className="space-y-4">
          <div
            className="rounded-2xl border border-dashed border-primary/30 bg-primary/[0.03] p-4"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              void chooseReference(event.dataTransfer.files[0]);
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => {
                void chooseReference(event.target.files?.[0]);
                event.currentTarget.value = '';
              }}
            />
            {previewUrl ? (
              <div className="space-y-3">
                <div className="relative overflow-hidden rounded-xl border border-primary/10 bg-black/5">
                  {/* The user-selected image is shown locally and is not persisted with saved templates. */}
                  <img src={previewUrl} alt="Selected reference preview" className="max-h-72 w-full object-contain" />
                  <button
                    type="button"
                    onClick={() => {
                      setReferenceFile(null);
                      setPreviewUrl((previous) => {
                        if (previous) URL.revokeObjectURL(previous);
                        return '';
                      });
                      setDimensions('');
                      setAnalysis(null);
                      clearGenerated();
                    }}
                    className="absolute right-2 top-2 rounded-lg bg-black/70 p-1.5 text-white"
                    aria-label="Remove reference image"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--text-secondary)]">
                  <span className="flex min-w-0 items-center gap-2 truncate"><ImageIcon className="h-4 w-4 shrink-0" />{referenceFile?.name}</span>
                  <span className="shrink-0">{dimensions}</span>
                </div>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs font-semibold text-primary hover:underline">Replace image</button>
              </div>
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()} className="flex min-h-44 w-full flex-col items-center justify-center gap-3 text-center">
                <span className="rounded-2xl bg-primary/10 p-3 text-primary"><Upload className="h-6 w-6" /></span>
                <span className="text-sm font-bold text-foreground">Upload or drop a reference image</span>
                <span className="text-[11px] text-[var(--text-secondary)]">JPG, PNG, WebP · up to 20 MB · one reference</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => void analyzeReference()}
            disabled={!canAnalyze || loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-background transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Analyzing reference…</> : <><Sparkles className="h-4 w-4" />{analysis ? 'Re-analyze reference' : 'Analyze reference'}</>}
          </button>
          {!apiKey && !hasStoredKey && <p className="text-[11px] text-amber-600">Add a {provider} API key in the settings panel to analyze an image.</p>}
          {analysis && <p className="text-[10px] text-[var(--text-secondary)]">Analysis uses 1 prompt-generation credit; composing and editing prompts is free.</p>}

          <fieldset className="space-y-2 rounded-xl border border-primary/10 bg-primary/[0.03] p-3">
            <legend className="px-1 text-[10px] font-bold uppercase tracking-wider text-primary/65">What should the prompt do?</legend>
            <div className="grid gap-2">
              {([
                ['recreate', 'Faithful recreation', 'Match the uploaded image as closely as possible.'],
                ['style', 'Match the style', 'Make new content with the same visual style.'],
                ['template', 'Reusable template', 'Keep the layout and make selected elements replaceable.'],
              ] as const).map(([value, label, description]) => (
                <label key={value} className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2 ${goal === value ? 'border-primary/35 bg-primary/10' : 'border-primary/10'}`}>
                  <input type="radio" name="reference-prompt-goal" value={value} checked={goal === value} onChange={() => { setGoal(value); clearGenerated(); }} className="mt-0.5 accent-primary" />
                  <span><span className="block text-[11px] font-bold text-foreground">{label}</span><span className="mt-0.5 block text-[10px] text-[var(--text-secondary)]">{description}</span></span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2 rounded-xl border border-primary/10 bg-primary/[0.03] p-3">
            <label htmlFor="reference-influence" className="block text-[10px] font-bold uppercase tracking-wider text-primary/65">How strictly to follow the image</label>
            <select id="reference-influence" value={influence} onChange={(event) => { setInfluence(event.target.value as typeof influence); clearGenerated(); }} className="w-full rounded-lg border border-primary/15 bg-background px-3 py-2 text-xs text-foreground">
              <option value="strict">Strong — preserve framing and composition</option>
              <option value="balanced">Balanced — composition plus changes</option>
              <option value="loose">Loose — inspiration only</option>
            </select>
            <p className="text-[10px] leading-relaxed text-[var(--text-secondary)]">For the closest match, also attach this reference image in your image-generation tool. Text prompts alone cannot guarantee pixel-identical results.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-primary/10 bg-primary/[0.03] p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-xs font-bold text-foreground">Quick actions</h3>
              {analysis && <button type="button" onClick={() => setAllActions('keep')} className="text-[10px] font-semibold text-primary hover:underline">Keep everything</button>}
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                ['Swap person', 'person', 'replace'],
                ['Swap product', 'product', 'replace'],
                ['Replace background', 'background', 'replace'],
                ['Modify outfit', 'outfit', 'modify'],
                ['Change style', 'style', 'modify'],
                ['Keep layout', 'composition', 'keep'],
              ].map(([label, term, action]) => (
                <button key={label} type="button" onClick={() => term === 'style' && !analysis?.elements.some((item) => item.name.toLowerCase().includes(term)) ? setInstructions((value) => `${value}${value ? '\n' : ''}Change the visual style while preserving the requested composition.`) : applyQuickAction(term, action as ElementAction)} disabled={!analysis} className="rounded-full border border-primary/15 px-3 py-1.5 text-[10px] font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-40">{label}</button>
              ))}
            </div>
          </div>

          {analysis ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-primary/10 bg-background/70 p-3">
                <h3 className="mb-1 text-xs font-bold text-foreground">Reference overview</h3>
                <p className="text-xs leading-relaxed text-[var(--text-secondary)]">{analysis.overview}</p>
              </div>
              <div className="max-h-[460px] space-y-3 overflow-y-auto pr-1">
                {analysis.elements.map((element) => {
                  const action = getDefaultAction(element, actions, goal);
                  return (
                    <article key={element.id} className="rounded-xl border border-primary/10 bg-background/70 p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-foreground">{element.name}</h4>
                          <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-secondary)]">{element.details}</p>
                        </div>
                        <div className="flex shrink-0 rounded-lg border border-primary/10 p-0.5" role="group" aria-label={`${element.name} action`}>
                          {(['keep', 'replace', 'modify'] as ElementAction[]).map((item) => (
                            <button key={item} type="button" onClick={() => { setActions((previous) => ({ ...previous, [element.id]: item })); clearGenerated(); }} aria-pressed={action === item} className={`rounded-md px-2 py-1 text-[9px] font-bold capitalize ${action === item ? 'bg-primary text-background' : 'text-primary/65 hover:bg-primary/10'}`}>{item}</button>
                          ))}
                        </div>
                      </div>
                      {action !== 'keep' && (
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <label className="text-[10px] font-semibold text-primary/65">
                            {action === 'replace' ? `Replace with (${element.variable})` : `Modify (${element.variable})`}
                            <input value={replacements[element.id] || ''} onChange={(event) => { setReplacements((previous) => ({ ...previous, [element.id]: event.target.value })); clearGenerated(); }} placeholder={action === 'replace' ? 'Describe the new element' : 'Describe the change'} className="mt-1 w-full rounded-lg border border-primary/15 bg-background px-3 py-2 text-xs font-normal text-foreground outline-none focus:border-primary/40" />
                          </label>
                          <label className="text-[10px] font-semibold text-primary/65">
                            Optional mapped asset
                            <input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file && file.size > MAX_LOCAL_FILE_BYTES) { setError('Mapped assets must be 20 MB or smaller.'); return; } setAssetMappings((previous) => ({ ...previous, [element.id]: file?.name || '' })); clearGenerated(); }} className="mt-1 block w-full text-[10px] text-[var(--text-secondary)] file:mr-2 file:rounded-lg file:border-0 file:bg-primary/10 file:px-2 file:py-1 file:text-[10px] file:font-semibold file:text-primary" />
                            {assetMappings[element.id] && <span className="mt-1 block truncate text-[10px]">{assetMappings[element.id]}</span>}
                          </label>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed border-primary/15 px-4 text-center text-xs text-[var(--text-secondary)]">
              Analyze an image to see its visual structure and editable elements.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-primary/10 bg-primary/[0.03] p-3">
        <button type="button" aria-expanded={showBrandKit} onClick={() => setShowBrandKit((value) => !value)} className="flex w-full items-center justify-between text-left text-xs font-bold text-foreground">
          <span>Optional Brand Kit</span><span className="text-primary">{showBrandKit ? '−' : '+'}</span>
        </button>
        {showBrandKit && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {([
              ['name', 'Brand name'],
              ['colors', 'Brand colors'],
              ['logo', 'Logo asset filename / note'],
              ['typography', 'Typography'],
              ['cta', 'Call to action'],
            ] as const).map(([key, label]) => (
              <label key={key} className="text-[10px] font-semibold text-primary/65">{label}
                <input value={brandKit[key]} onChange={(event) => updateBrand(key, event.target.value)} className="mt-1 w-full rounded-lg border border-primary/15 bg-background px-3 py-2 text-xs font-normal text-foreground outline-none focus:border-primary/40" />
              </label>
            ))}
          </div>
        )}
      </div>

      <label className="block text-[10px] font-bold uppercase tracking-wider text-primary/65">
        Custom instructions
        <textarea value={instructions} onChange={(event) => { setInstructions(event.target.value); clearGenerated(); }} rows={3} maxLength={2000} placeholder="Add camera, mood, output, or composition requirements…" className="mt-1 w-full resize-y rounded-xl border border-primary/15 bg-background px-3 py-2 text-xs font-normal normal-case tracking-normal text-foreground outline-none focus:border-primary/40" />
        <span className="mt-1 block text-right font-normal normal-case tracking-normal">{instructions.length}/2000</span>
      </label>

      <button type="button" onClick={generatePrompts} disabled={!analysis} className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-bold text-primary transition-colors hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-50">
        <Sparkles className="h-4 w-4" />Generate template, final & negative prompts
      </button>

      {(templatePrompt || finalPrompt) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {([
            ['Template Prompt', templatePrompt, setTemplatePrompt],
            ['Final Prompt', finalPrompt, setFinalPrompt],
          ] as const).map(([label, value, setter]) => (
            <section key={label} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-foreground">{label}</h3>
                <button type="button" onClick={() => void copyText(value).then(() => setNotice(`${label} copied.`)).catch((copyError) => setError(copyError instanceof Error ? copyError.message : 'Copy failed.'))} className="inline-flex items-center gap-1 rounded-lg border border-primary/15 px-2 py-1 text-[10px] font-semibold text-primary"><Copy className="h-3 w-3" />Copy</button>
              </div>
              <textarea value={value} onChange={(event) => setter(event.target.value)} rows={13} className="w-full resize-y rounded-xl border border-primary/15 bg-background px-3 py-2 font-mono text-[11px] leading-relaxed text-foreground outline-none focus:border-primary/40" />
            </section>
          ))}
          <section className="space-y-2 lg:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-foreground">Negative Prompt</h3>
              <button type="button" onClick={() => void copyText(negativePrompt).then(() => setNotice('Negative prompt copied.')).catch((copyError) => setError(copyError instanceof Error ? copyError.message : 'Copy failed.'))} className="inline-flex items-center gap-1 rounded-lg border border-primary/15 px-2 py-1 text-[10px] font-semibold text-primary"><Copy className="h-3 w-3" />Copy</button>
            </div>
            <textarea value={negativePrompt} onChange={(event) => setNegativePrompt(event.target.value)} rows={3} maxLength={2000} className="w-full resize-y rounded-xl border border-primary/15 bg-background px-3 py-2 font-mono text-[11px] leading-relaxed text-foreground outline-none focus:border-primary/40" />
          </section>
          <div className="flex flex-wrap items-center gap-2 lg:col-span-2">
            <input value={saveName} onChange={(event) => setSaveName(event.target.value)} placeholder="Template name (optional)" maxLength={80} className="min-w-0 flex-1 rounded-lg border border-primary/15 bg-background px-3 py-2 text-xs text-foreground" />
            <button type="button" onClick={() => void copyText(`TEMPLATE PROMPT\n${templatePrompt}\n\nFINAL PROMPT\n${finalPrompt}\n\nNEGATIVE PROMPT\n${negativePrompt}`).then(() => setNotice('All prompts copied.')).catch((copyError) => setError(copyError instanceof Error ? copyError.message : 'Copy failed.'))} className="inline-flex items-center gap-2 rounded-lg border border-primary/20 px-3 py-2 text-xs font-bold text-primary"><Copy className="h-3.5 w-3.5" />Copy all</button>
            <button type="button" onClick={() => exportPrompts(templatePrompt, finalPrompt, negativePrompt)} className="inline-flex items-center gap-2 rounded-lg border border-primary/20 px-3 py-2 text-xs font-bold text-primary">Export .txt</button>
            <button type="button" onClick={saveTemplate} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-background"><Save className="h-3.5 w-3.5" />Save & reuse</button>
          </div>
        </div>
      )}

      {savedTemplates.length > 0 && (
        <section className="space-y-2 border-t border-primary/10 pt-4">
          <h3 className="text-xs font-bold text-foreground">Saved templates · this account, this browser</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {savedTemplates.map((item) => (
              <div key={item.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-primary/10 bg-background/70 p-2">
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">{item.name}</span>
                <button type="button" onClick={() => loadTemplate(item)} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-primary/15 px-2 py-1 text-[10px] font-semibold text-primary"><RefreshCw className="h-3 w-3" />Load</button>
                <button type="button" onClick={() => removeTemplate(item.id)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-500/10" aria-label={`Delete ${item.name}`}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
        </section>
      )}

      {(error || notice) && (
        <div role={error ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${error ? 'border-red-500/25 bg-red-500/5 text-red-600' : 'border-emerald-500/25 bg-emerald-500/5 text-emerald-700'}`}>
          {error ? <X className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
          <span>{error || notice}</span>
          {error && <button type="button" onClick={() => setError('')} className="ml-auto text-[10px] font-bold underline">Dismiss</button>}
        </div>
      )}
    </section>
  );
}
