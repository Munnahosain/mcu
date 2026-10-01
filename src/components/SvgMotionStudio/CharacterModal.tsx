'use client';

import React from 'react';
import {
  X,
  UserCheck,
  Wand2,
  Sparkles,
  Smile,
  Eye,
  MessageCircle,
  Shirt,
  Footprints,
  Hand,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { CharacterSlot, SvgElementNode } from './types';
import { CHARACTER_SLOT_LABELS } from './constants';
import { CHARACTER_PRESETS, autoDetectCharacterSlots } from './characterMode';
import { flattenElementTree, findElementById } from './svgParser';

interface CharacterModalProps {
  isOpen: boolean;
  onClose: () => void;
  elements: SvgElementNode[];
  characterSlots: Partial<Record<CharacterSlot, string>>;
  onAssignSlot: (slot: CharacterSlot, elementId: string | null) => void;
  onApplyCharacterPreset: (presetId: string) => void;
  onAutoRig: () => void;
}

export const CharacterModal: React.FC<CharacterModalProps> = ({
  isOpen,
  onClose,
  elements,
  characterSlots,
  onAssignSlot,
  onApplyCharacterPreset,
  onAutoRig,
}) => {
  if (!isOpen) return null;

  const flatElements = flattenElementTree(elements);
  const slotsList: CharacterSlot[] = [
    'head',
    'hair',
    'eyes',
    'mouth',
    'body',
    'left_arm',
    'right_arm',
    'left_leg',
    'right_leg',
  ];

  const assignedCount = Object.values(characterSlots).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md select-none">
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-foreground">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--card-border)] flex items-center justify-between bg-[var(--card-bg)]">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shadow-sm">
              <UserCheck className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground tracking-wide">Smart Character Mode</h2>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Rig semantic body parts to unlock one-click character animation cycles.
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-6">
          {/* Auto-Rig Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-primary/10 border border-primary/20">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-primary">
                  Semantic Rigging Status: {assignedCount} / {slotsList.length} Bound
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                Automatically scans layer labels, names, and geometry to map character parts.
              </p>
            </div>

            <button
              type="button"
              onClick={onAutoRig}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-[#071b17] font-extrabold text-xs shadow-md shadow-primary/25 transition-all shrink-0"
            >
              <Wand2 className="h-3.5 w-3.5" />
              <span>Auto-Detect Slots</span>
            </button>
          </div>

          {/* Slot Assignments Grid */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              1. Body Slots Mapping
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {slotsList.map((slot) => {
                const assignedId = characterSlots[slot];
                const assignedNode = assignedId
                  ? findElementById(elements, assignedId)
                  : null;
                const slotInfo = CHARACTER_SLOT_LABELS[slot];

                return (
                  <div
                    key={slot}
                    className="p-2.5 rounded-2xl bg-[var(--input-bg)] border border-[var(--card-border)] flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`h-6 w-6 rounded-lg flex items-center justify-center shrink-0 ${
                          assignedNode
                            ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
                            : 'bg-[var(--card-bg)] text-[var(--text-muted)] border border-[var(--card-border)]'
                        }`}
                      >
                        {assignedNode ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <AlertCircle className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-foreground block truncate">
                          {slotInfo.label}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)] truncate block font-medium">
                          {assignedNode ? assignedNode.name : 'Unassigned'}
                        </span>
                      </div>
                    </div>

                    <select
                      value={assignedId || ''}
                      onChange={(e) => onAssignSlot(slot, e.target.value || null)}
                      className="bg-[var(--card-bg)] text-foreground text-xs px-2.5 py-1.5 rounded-xl border border-[var(--input-border)] outline-none max-w-[140px] truncate font-medium focus:border-primary"
                    >
                      <option value="">(None)</option>
                      {flatElements.map((el) => (
                        <option key={el.id} value={el.id}>
                          {el.name}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Character Animation Presets */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              2. Character Animation Cycles
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {CHARACTER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    onApplyCharacterPreset(preset.id);
                    onClose();
                  }}
                  className="flex flex-col items-start p-3 rounded-2xl bg-[var(--input-bg)] hover:bg-primary/10 hover:border-primary/40 border border-[var(--card-border)] text-left transition-all group shadow-sm"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Sparkles className="h-3.5 w-3.5 text-primary group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                      {preset.name}
                    </span>
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)] leading-relaxed">
                    {preset.description}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--card-border)] bg-[var(--card-bg)] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-[#071b17] font-extrabold text-xs shadow-md shadow-primary/25 transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default CharacterModal;
