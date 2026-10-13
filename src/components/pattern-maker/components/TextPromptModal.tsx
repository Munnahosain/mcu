import React, { useState } from 'react';
import { Type, X, Plus } from 'lucide-react';

interface TextPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (text: string) => void;
}

export const TextPromptModal: React.FC<TextPromptModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [text, setText] = useState('Bloom');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSubmit(text.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-sm rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] text-foreground shadow-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Type className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-extrabold text-foreground">Add Monogram / Text Motif</h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--input-bg)] hover:text-foreground transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-[var(--text-secondary)] mb-1">
              Text or Monogram
            </label>
            <input
              type="text"
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. Bloom, Flora, MC, NYC"
              maxLength={24}
              className="w-full h-10 px-3 rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] text-sm font-bold text-foreground outline-none focus:border-primary transition"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--input-bg)] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!text.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-background text-xs font-bold hover:bg-primary/90 disabled:opacity-40 transition"
            >
              <Plus className="h-3.5 w-3.5" /> Add to Pattern
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
