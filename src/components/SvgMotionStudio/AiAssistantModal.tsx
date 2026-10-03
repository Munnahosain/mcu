'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, Clock3, LoaderCircle, Repeat, RotateCcw, Send, Sparkles, X } from 'lucide-react';
import { SvgElementNode } from './types';
import { AiAnimationPlan, generateAiAnimation } from './aiAssistant';

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  elements: SvgElementNode[];
  svgRaw: string;
  selectedElementId: string | null;
  currentDuration: number;
  currentFps: number;
  currentLoop: boolean;
  hasAiAnimation: boolean;
  onApplyPlan: (plan: AiAnimationPlan) => void;
  onResetAnimation: () => void;
}

const PRESET_PROMPTS = [
  { label: 'Smooth Loop', prompt: 'Create an elegant seamless loop for this abstract SVG.' },
  { label: 'Flowing Background', prompt: 'Animate the waves and flowing shapes slowly from left to right.' },
  { label: 'Minimal Motion', prompt: 'Add very subtle, premium movement without making the composition busy.' },
  { label: 'Premium Stock Motion', prompt: 'Create a polished stock motion background loop with controlled, commercially usable movement.' },
  { label: 'Futuristic Motion', prompt: 'Create a refined futuristic technology background with subtle independent movement.' },
  { label: 'Geometric Motion', prompt: 'Animate the geometric elements independently with gentle rotation and drifting.' },
  { label: 'Liquid Motion', prompt: 'Give the abstract forms smooth, liquid-like flowing movement while preserving the artwork.' },
  { label: 'Slow Ambient Motion', prompt: 'Create slow ambient movement with a calm, seamless loop.' },
  { label: 'Dynamic Motion', prompt: 'Create a rhythmic, dynamic abstract animation while keeping the composition clear.' },
  { label: 'Subtle Motion', prompt: 'Add subtle movement to a few elements and leave the rest of the composition still.' },
];

const LOADING_STAGES = [
  'Analyzing SVG structure...',
  'Understanding layers and visual roles...',
  'Planning abstract motion...',
  'Validating editable keyframes...',
];

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  isOpen,
  onClose,
  elements,
  svgRaw,
  selectedElementId,
  currentDuration,
  currentFps,
  currentLoop,
  hasAiAnimation,
  onApplyPlan,
  onResetAnimation,
}) => {
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState(currentDuration);
  const [fps, setFps] = useState(currentFps);
  const [loop, setLoop] = useState(currentLoop);
  const [stockMotion, setStockMotion] = useState(true);
  const [loadingMode, setLoadingMode] = useState<'generate' | 'modify' | null>(null);
  const [loadingStage, setLoadingStage] = useState(0);
  const [generatedPlan, setGeneratedPlan] = useState<AiAnimationPlan | null>(null);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState('');
  const requestControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isOpen || generatedPlan) return;
    setDuration(currentDuration);
    setFps(currentFps);
    setLoop(currentLoop);
  }, [isOpen, currentDuration, currentFps, currentLoop, generatedPlan]);

  useEffect(() => {
    if (!loadingMode) return;
    const timer = window.setInterval(() => setLoadingStage((stage) => (stage + 1) % LOADING_STAGES.length), 1300);
    return () => window.clearInterval(timer);
  }, [loadingMode]);

  if (!isOpen) return null;

  const runGeneration = async (mode: 'generate' | 'modify') => {
    const requestPrompt = prompt.trim();
    if (!requestPrompt || loadingMode) return;
    if (mode === 'modify' && !generatedPlan) return;

    setError('');
    setApplied(false);
    setLoadingStage(0);
    setLoadingMode(mode);
    const controller = new AbortController();
    requestControllerRef.current = controller;
    try {
      const plan = await generateAiAnimation(requestPrompt, elements, svgRaw, {
        duration,
        fps,
        loop,
        stockMotion,
        mode,
        existingPlan: mode === 'modify' && generatedPlan ? {
          duration: generatedPlan.duration,
          fps: generatedPlan.fps,
          loop: generatedPlan.loop,
          description: generatedPlan.description,
          animations: generatedPlan.animations,
        } : undefined,
        avoidPlan: mode === 'generate' && generatedPlan ? {
          duration: generatedPlan.duration,
          fps: generatedPlan.fps,
          loop: generatedPlan.loop,
          description: generatedPlan.description,
          animations: generatedPlan.animations,
        } : undefined,
        signal: controller.signal,
      });
      setGeneratedPlan(plan);
      setDuration(plan.duration);
      setFps(plan.fps);
      setLoop(plan.loop);
      window.dispatchEvent(new CustomEvent('mcustock:credits-updated'));
    } catch (requestError) {
      if (!controller.signal.aborted) {
        setError(requestError instanceof Error ? requestError.message : 'Animation request failed. Please retry.');
      }
    } finally {
      if (requestControllerRef.current === controller) requestControllerRef.current = null;
      setLoadingMode(null);
    }
  };

  const closeAssistant = () => {
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    onClose();
  };

  const handleApply = () => {
    if (!generatedPlan) return;
    onApplyPlan(generatedPlan);
    setApplied(true);
  };

  const handleReset = () => {
    onResetAnimation();
    setGeneratedPlan(null);
    setApplied(false);
    setError('');
  };

  const selectedName = elements.flatMap((element) => [element, ...element.children]).find((element) => element.id === selectedElementId)?.name;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm" onMouseDown={(event) => {
      if (event.target === event.currentTarget) closeAssistant();
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="ai-animation-title" className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-foreground shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-[var(--card-border)] px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 id="ai-animation-title" className="text-sm font-bold">AI Animation Assistant</h2>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-[var(--text-secondary)]">
                Create editable motion plans for abstract SVG artwork. {elements.length} top-level layers{selectedName ? ` · Selected: ${selectedName}` : ''}.
              </p>
            </div>
          </div>
          <button type="button" onClick={closeAssistant} className="rounded-md p-2 text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-foreground" title="Close assistant" aria-label="Close assistant">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <label className="block space-y-2">
            <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Motion prompt</span>
            <textarea
              value={prompt}
              maxLength={1200}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  runGeneration(generatedPlan ? 'modify' : 'generate');
                }
              }}
              placeholder="Create a premium 8 second seamless abstract motion background. Make the waves flow slowly and add gentle movement to the geometric elements."
              rows={4}
              className="w-full resize-y rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2.5 text-sm text-foreground placeholder:text-[var(--text-muted)] focus:border-primary focus:outline-none"
            />
            <span className="block text-right text-[10px] text-[var(--text-muted)]">{prompt.length}/1200</span>
          </label>

          <div className="space-y-2">
            <h3 className="text-[11px] font-semibold text-[var(--text-secondary)]">Quick prompts</h3>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_PROMPTS.map((preset) => (
                <button key={preset.label} type="button" onClick={() => { setPrompt(preset.prompt); setError(''); }} className="rounded-md border border-[var(--card-border)] bg-[var(--input-bg)] px-2.5 py-1.5 text-[10px] font-medium text-[var(--text-secondary)] transition-colors hover:border-primary/40 hover:text-primary">
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 rounded-lg border border-[var(--card-border)] bg-[var(--input-bg)] p-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <label className="flex items-center gap-2 text-xs font-medium">
              <input type="checkbox" checked={stockMotion} onChange={(event) => setStockMotion(event.target.checked)} className="accent-primary" />
              <span>Stock Motion</span>
            </label>
            <label className="flex min-w-28 flex-col gap-1 text-[10px] text-[var(--text-secondary)]">
              Duration (seconds)
              <input type="number" min={1} max={30} step={1} value={duration} onChange={(event) => setDuration(Math.max(1, Math.min(30, Number(event.target.value) || 1)))} className="w-full rounded-md border border-[var(--input-border)] bg-[var(--card-bg)] px-2 py-1.5 text-sm text-foreground" />
            </label>
            <div className="flex items-center gap-3">
              <label className="flex flex-col gap-1 text-[10px] text-[var(--text-secondary)]">
                FPS
                <select value={fps} onChange={(event) => setFps(Number(event.target.value))} className="rounded-md border border-[var(--input-border)] bg-[var(--card-bg)] px-2 py-1.5 text-sm text-foreground">
                  {[12, 24, 30, 60].map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label className="flex h-9 items-center gap-2 rounded-md border border-[var(--card-border)] px-2.5 text-xs font-medium">
                <input type="checkbox" checked={loop} onChange={(event) => setLoop(event.target.checked)} className="accent-primary" />
                <span className="flex items-center gap-1.5"><Repeat className="h-3.5 w-3.5 text-primary" /> Loop</span>
              </label>
            </div>
          </div>

          {loadingMode && (
            <div role="status" className="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5 text-xs text-primary">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              <span>{LOADING_STAGES[loadingStage]}</span>
            </div>
          )}
          {error && <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs leading-relaxed text-red-300">{error}</div>}

          {generatedPlan && (
            <section className="space-y-3 rounded-lg border border-primary/30 bg-primary/[0.04] p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                  <Check className="h-4 w-4" />
                  <span>{applied ? 'Animation applied to timeline.' : 'Animation created successfully.'}</span>
                </div>
                <div className="flex items-center gap-3 font-mono text-[10px] text-[var(--text-secondary)]">
                  <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" />{generatedPlan.duration}s</span>
                  <span>{generatedPlan.fps} FPS</span>
                  <span>{generatedPlan.loop ? 'Loop' : 'Once'}</span>
                </div>
              </div>
              <p className="text-xs leading-relaxed text-foreground">{generatedPlan.description}</p>
              <div className="flex flex-wrap gap-1.5">
                {generatedPlan.animations.map((animation, index) => (
                  <span key={`${animation.target}-${animation.property}-${index}`} className="rounded border border-[var(--card-border)] bg-[var(--input-bg)] px-2 py-1 text-[10px] text-[var(--text-secondary)]">
                    {animation.target} · {animation.property} · {animation.keyframes.length} keyframes
                  </span>
                ))}
              </div>
              <p className="text-[10px] leading-relaxed text-[var(--text-muted)]">The plan is stored as editable timeline keyframes. Your uploaded SVG markup remains unchanged.</p>
            </section>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--card-border)] px-5 py-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={closeAssistant} className="rounded-md px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]">{loadingMode ? 'Cancel request' : 'Cancel'}</button>
            {hasAiAnimation && <button type="button" onClick={handleReset} disabled={Boolean(loadingMode)} className="flex items-center gap-1.5 rounded-md border border-[var(--card-border)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:border-red-500/40 hover:text-red-400 disabled:opacity-40"><RotateCcw className="h-3.5 w-3.5" />Reset Animation</button>}
          </div>
          <div className="flex flex-wrap gap-2">
            {generatedPlan && <button type="button" onClick={() => runGeneration('generate')} disabled={Boolean(loadingMode) || !prompt.trim()} className="rounded-md border border-[var(--card-border)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:border-primary/40 hover:text-primary disabled:opacity-40">Regenerate</button>}
            <button type="button" onClick={() => runGeneration(generatedPlan ? 'modify' : 'generate')} disabled={Boolean(loadingMode) || !prompt.trim() || elements.length === 0} className="flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-xs font-bold text-[#071b17] hover:bg-primary-hover disabled:opacity-40">
              {loadingMode ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {generatedPlan ? 'Modify Animation' : 'Generate Animation'}
            </button>
            {generatedPlan && <button type="button" onClick={handleApply} disabled={Boolean(loadingMode)} className="flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3.5 py-2 text-xs font-bold text-primary hover:bg-primary/20 disabled:opacity-40">{applied ? 'Apply Update' : 'Apply to Timeline'}</button>}
          </div>
        </footer>
      </section>
    </div>
  );
};

export default AiAssistantModal;
