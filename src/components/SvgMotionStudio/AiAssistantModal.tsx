'use client';

import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Send,
  Loader2,
  Check,
  Undo2,
  Wand2,
  ArrowRight,
  Layers,
  Clock,
  Repeat,
} from 'lucide-react';
import { SvgElementNode, CharacterSlot, AnimationTrack } from './types';
import { generateAiAnimation, AiAnimationPlan } from './aiAssistant';

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  elements: SvgElementNode[];
  characterSlots: Partial<Record<CharacterSlot, string>>;
  selectedElementId: string | null;
  currentDuration: number;
  onApplyPlan: (plan: AiAnimationPlan) => void;
}

const EXAMPLE_PROMPTS = [
  'Make the character breathe naturally for 4 seconds.',
  'Make this character wave its right arm enthusiastically.',
  'Create a 3 second idle animation with head sway.',
  'Make this element pulse like a heartbeat.',
  'Make this character jump and land with bounce physics.',
  'Float this object smoothly in mid-air.',
  'Draw and reveal vector strokes from start to finish.',
];

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  isOpen,
  onClose,
  elements,
  characterSlots,
  selectedElementId,
  currentDuration,
  onApplyPlan,
}) => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<AiAnimationPlan | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async (queryToRun?: string) => {
    const q = queryToRun || prompt;
    if (!q.trim()) return;

    setLoading(true);
    try {
      const plan = await generateAiAnimation(
        q,
        elements,
        characterSlots,
        selectedElementId,
        currentDuration
      );
      setGeneratedPlan(plan);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (generatedPlan) {
      onApplyPlan(generatedPlan);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md select-none">
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-foreground">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--card-border)] flex items-center justify-between bg-[var(--card-bg)]">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shadow-sm">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground tracking-wide flex items-center gap-2">
                <span>AI Motion Assistant</span>
                <span className="text-[9px] uppercase font-black px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
                  Semantic Planner
                </span>
              </h2>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Type natural language instructions to generate non-destructive timeline keyframes.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-[var(--text-muted)] hover:text-foreground hover:bg-[var(--hover-bg)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-5">
          {/* Prompt Input Box */}
          <div className="space-y-2">
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleGenerate();
                  }
                }}
                placeholder="Describe your desired motion (e.g. 'Make the character breathe naturally for 4 seconds' or 'Make this character wave')..."
                rows={3}
                className="w-full bg-[var(--input-bg)] text-xs text-foreground p-3.5 rounded-2xl border border-[var(--input-border)] focus:border-primary outline-none placeholder:text-[var(--text-muted)] resize-none transition-all font-medium"
              />
              <button
                type="button"
                onClick={() => handleGenerate()}
                disabled={loading || !prompt.trim()}
                className="absolute right-3 bottom-3.5 px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-40 text-[#071b17] font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-primary/25 transition-all"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                <span>Generate</span>
              </button>
            </div>

            {/* Example Prompt Chips */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                Quick Prompt Suggestions:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLE_PROMPTS.map((ex, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setPrompt(ex);
                      handleGenerate(ex);
                    }}
                    className="text-[10px] font-medium text-[var(--text-secondary)] hover:text-foreground bg-[var(--input-bg)] hover:bg-primary/10 hover:border-primary/40 px-3 py-1 rounded-full border border-[var(--card-border)] transition-colors"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Generated Plan Result Card */}
          {generatedPlan && (
            <div className="p-4 rounded-2xl bg-[var(--input-bg)] border border-primary/30 shadow-lg space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center justify-between border-b border-[var(--card-border)] pb-2">
                <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-emerald-500" />
                  <span>Generated Keyframe Plan</span>
                </span>
                <div className="flex items-center gap-2 text-[10px] font-mono text-[var(--text-muted)] font-semibold">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {generatedPlan.duration}s
                  </span>
                  <span className="flex items-center gap-1">
                    <Repeat className="h-3 w-3" /> {generatedPlan.loop ? 'Loop' : 'Once'}
                  </span>
                </div>
              </div>

              {/* Summary bullet points */}
              <div className="space-y-1">
                {generatedPlan.summary.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-foreground font-medium">
                    <span className="text-primary font-bold">•</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <div className="p-2.5 rounded-xl bg-primary/10 text-[10px] text-foreground/80 leading-relaxed border border-primary/20">
                Non-destructive: This will populate editable keyframes onto your timeline tracks without
                destroying any vector paths or styles.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[var(--card-border)] bg-[var(--card-bg)] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl text-[var(--text-muted)] hover:text-foreground text-xs font-semibold"
          >
            Cancel
          </button>

          {generatedPlan && (
            <button
              type="button"
              onClick={handleApply}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-[#071b17] font-extrabold text-xs shadow-md shadow-primary/25 transition-all"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Apply to Timeline</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AiAssistantModal;
