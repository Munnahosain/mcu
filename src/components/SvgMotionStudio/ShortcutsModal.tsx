'use client';

import React from 'react';
import { X, Keyboard, Command } from 'lucide-react';
import { KEYBOARD_SHORTCUTS } from './constants';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md select-none">
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-foreground">
        <div className="px-5 py-4 border-b border-[var(--card-border)] flex items-center justify-between bg-[var(--card-bg)]">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Keyboard className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground tracking-wide">Keyboard Shortcuts</h2>
              <p className="text-[11px] text-[var(--text-secondary)]">Power-user keyboard navigation and shortcuts</p>
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

        <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-2">
          {KEYBOARD_SHORTCUTS.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2.5 rounded-2xl bg-[var(--input-bg)] border border-[var(--card-border)]"
            >
              <span className="text-xs text-foreground font-medium">{item.description}</span>
              <kbd className="font-mono text-[11px] font-bold px-2.5 py-1 rounded-xl bg-[var(--card-bg)] text-primary border border-[var(--card-border)] shadow-sm">
                {item.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="px-5 py-3.5 border-t border-[var(--card-border)] bg-[var(--card-bg)] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-[#071b17] text-xs font-extrabold shadow-md shadow-primary/25 transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShortcutsModal;
