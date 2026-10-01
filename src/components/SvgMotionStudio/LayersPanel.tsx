'use client';

import React, { useState } from 'react';
import {
  Search,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Layers,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  PenTool,
  Square,
  Circle,
  Type,
  Image as ImageIcon,
  Check,
  Edit2,
  MoreVertical,
} from 'lucide-react';
import { SvgElementNode, SvgTagName, CharacterSlot, AnimationTrack } from './types';
import { CHARACTER_SLOT_LABELS } from './constants';

interface LayersPanelProps {
  elements: SvgElementNode[];
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
  onRenameElement: (id: string, newName: string) => void;
  onMoveElement: (id: string, direction: 'up' | 'down') => void;
  characterSlots: Partial<Record<CharacterSlot, string>>;
  onAssignSlot: (slot: CharacterSlot, elementId: string | null) => void;
  tracks: AnimationTrack[];
  isSingleFlattenedPath: boolean;
}

function getElementIcon(tagName: SvgTagName, isGroup: boolean, isExpanded?: boolean) {
  if (isGroup) {
    return isExpanded ? (
      <FolderOpen className="h-3.5 w-3.5 text-amber-500 shrink-0" />
    ) : (
      <Folder className="h-3.5 w-3.5 text-amber-500 shrink-0" />
    );
  }
  switch (tagName) {
    case 'path':
      return <PenTool className="h-3.5 w-3.5 text-primary shrink-0" />;
    case 'rect':
      return <Square className="h-3.5 w-3.5 text-emerald-500 shrink-0" />;
    case 'circle':
    case 'ellipse':
      return <Circle className="h-3.5 w-3.5 text-pink-500 shrink-0" />;
    case 'text':
      return <Type className="h-3.5 w-3.5 text-cyan-500 shrink-0" />;
    case 'image':
      return <ImageIcon className="h-3.5 w-3.5 text-amber-400 shrink-0" />;
    default:
      return <Layers className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />;
  }
}

export const LayersPanel: React.FC<LayersPanelProps> = ({
  elements,
  selectedElementId,
  onSelectElement,
  onToggleVisibility,
  onToggleLock,
  onRenameElement,
  onMoveElement,
  characterSlots,
  onAssignSlot,
  tracks,
  isSingleFlattenedPath,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'character-root': true,
    'character': true,
    'head': true,
    'body': true,
    'face': true,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const toggleGroup = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const startEditing = (node: SvgElementNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(node.id);
    setEditingText(node.name);
  };

  const commitEditing = (id: string) => {
    if (editingText.trim()) {
      onRenameElement(id, editingText.trim());
    }
    setEditingId(null);
  };

  // Find assigned slot for element if any
  const getSlotForElement = (elId: string): CharacterSlot | null => {
    for (const [slot, id] of Object.entries(characterSlots)) {
      if (id === elId) return slot as CharacterSlot;
    }
    return null;
  };

  // Check if element has animated tracks
  const hasAnimation = (elId: string): boolean => {
    return tracks.some((t) => t.elementId === elId && t.keyframes && t.keyframes.length > 0);
  };

  const renderNode = (node: SvgElementNode, depth: number = 0) => {
    const isSelected = selectedElementId === node.id;
    const isExpanded = expandedGroups[node.id] ?? true;
    const hasChildren = node.children && node.children.length > 0;
    const assignedSlot = getSlotForElement(node.id);
    const animated = hasAnimation(node.id);

    // Search filter
    if (searchQuery.trim()) {
      const matchSelf = node.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchChildren = node.children?.some((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      if (!matchSelf && !matchChildren) return null;
    }

    return (
      <div key={node.id} className="flex flex-col select-none">
        <div
          onClick={() => onSelectElement(node.id)}
          className={`group flex items-center justify-between py-1.5 px-2 cursor-pointer transition-all border-l-2 text-xs ${
            isSelected
              ? 'bg-primary/15 text-primary border-primary font-bold'
              : 'hover:bg-[var(--hover-bg)] text-[var(--text-secondary)] border-transparent'
          }`}
          style={{ paddingLeft: `${Math.max(8, depth * 16 + 6)}px` }}
        >
          {/* Left item details: Chevron + Icon + Name */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => toggleGroup(node.id, e)}
                className="p-0.5 rounded text-[var(--text-muted)] hover:text-foreground transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </button>
            ) : (
              <span className="w-3" />
            )}

            {getElementIcon(node.tagName, node.isGroup, isExpanded)}

            {/* Name / Editable input */}
            {editingId === node.id ? (
              <input
                type="text"
                value={editingText}
                autoFocus
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setEditingText(e.target.value)}
                onBlur={() => commitEditing(node.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitEditing(node.id);
                  if (e.key === 'Escape') setEditingId(null);
                }}
                className="bg-[var(--input-bg)] text-foreground px-2 py-0.5 text-xs rounded-lg border border-primary outline-none w-full"
              />
            ) : (
              <span
                onDoubleClick={(e) => startEditing(node, e)}
                className="truncate text-[11px] font-semibold tracking-tight text-foreground/90 group-hover:text-foreground"
                title={`${node.name} (<${node.tagName}>)`}
              >
                {node.name}
              </span>
            )}

            {/* Character Slot Badge */}
            {assignedSlot && (
              <span
                className="ml-1 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30 shrink-0"
                title={`Rigged as ${CHARACTER_SLOT_LABELS[assignedSlot]?.label}`}
              >
                {CHARACTER_SLOT_LABELS[assignedSlot]?.label.split(' ')[0]}
              </span>
            )}

            {/* Animated Indicator dot */}
            {animated && (
              <span
                className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 animate-pulse"
                title="Contains animated keyframe tracks"
              />
            )}
          </div>

          {/* Right actions: Layer reorder, Lock, Visibility */}
          <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity shrink-0">
            {/* Move Up/Down */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMoveElement(node.id, 'up');
              }}
              className="p-1 rounded text-[var(--text-muted)] hover:text-foreground hover:bg-[var(--hover-bg)]"
              title="Move layer up"
            >
              <ArrowUp className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMoveElement(node.id, 'down');
              }}
              className="p-1 rounded text-[var(--text-muted)] hover:text-foreground hover:bg-[var(--hover-bg)]"
              title="Move layer down"
            >
              <ArrowDown className="h-3 w-3" />
            </button>

            {/* Rename */}
            <button
              type="button"
              onClick={(e) => startEditing(node, e)}
              className="p-1 rounded text-[var(--text-muted)] hover:text-foreground hover:bg-[var(--hover-bg)]"
              title="Rename layer"
            >
              <Edit2 className="h-3 w-3" />
            </button>

            {/* Lock */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleLock(node.id);
              }}
              className={`p-1 rounded transition-colors ${
                node.locked ? 'text-amber-500' : 'text-[var(--text-muted)] hover:text-foreground'
              }`}
              title={node.locked ? 'Unlock element' : 'Lock element'}
            >
              {node.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
            </button>

            {/* Visibility */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleVisibility(node.id);
              }}
              className={`p-1 rounded transition-colors ${
                node.visible ? 'text-[var(--text-muted)] hover:text-foreground' : 'text-red-500'
              }`}
              title={node.visible ? 'Hide element' : 'Show element'}
            >
              {node.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            </button>
          </div>
        </div>

        {/* Render child elements if expanded */}
        {hasChildren && isExpanded && (
          <div className="flex flex-col">
            {node.children!.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="w-64 border-r border-[var(--card-border)] bg-[var(--card-bg)] flex flex-col h-full select-none z-10 shrink-0 text-foreground transition-colors">
      {/* Header */}
      <div className="p-3 border-b border-[var(--card-border)] bg-[var(--card-bg)] flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Layers className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold text-foreground tracking-wide uppercase">Layers</span>
          <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-[var(--input-bg)] text-[var(--text-secondary)] border border-[var(--card-border)]">
            {elements.length}
          </span>
        </div>

        {/* Expand/Collapse All */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setExpandedGroups({})}
            className="text-[10px] text-[var(--text-muted)] hover:text-foreground px-2 py-0.5 rounded-lg hover:bg-[var(--hover-bg)] transition-colors font-medium"
            title="Collapse all groups"
          >
            Collapse
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-3 py-2 border-b border-[var(--card-border)] bg-[var(--card-bg)]">
        <div className="relative flex items-center">
          <Search className="h-3.5 w-3.5 absolute left-2.5 text-[var(--text-muted)] pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search layers..."
            className="w-full bg-[var(--input-bg)] text-xs text-foreground pl-8 pr-2.5 py-1.5 rounded-xl border border-[var(--input-border)] focus:border-primary outline-none placeholder:text-[var(--text-muted)] transition-all font-medium"
          />
        </div>
      </div>

      {/* Flattened SVG Notice Banner if single vector path detected */}
      {isSingleFlattenedPath && (
        <div className="m-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-200 text-xs">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-[11px] leading-tight text-amber-600 dark:text-amber-300">
                Single Vector Object
              </p>
              <p className="text-[10px] leading-relaxed opacity-90">
                This artwork is a single flattened path. It cannot be automatically separated into
                semantic parts (head, hand, eye, etc.). You can still animate its position, scale,
                rotation, or use the <strong>Draw Path</strong> reveal preset!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Layer Tree List */}
      <div className="flex-1 overflow-y-auto no-scrollbar py-1">
        {elements.length === 0 ? (
          <div className="p-6 text-center text-[var(--text-muted)] text-xs flex flex-col items-center gap-2">
            <Layers className="h-8 w-8 text-[var(--text-muted)] opacity-50 stroke-[1.5]" />
            <p className="font-semibold">No layers detected</p>
            <p className="text-[10px]">Upload an SVG or click Try Demo to begin.</p>
          </div>
        ) : (
          elements.map((el) => renderNode(el, 0))
        )}
      </div>

      {/* Footer Info */}
      <div className="p-2.5 border-t border-[var(--card-border)] bg-[var(--card-bg)] text-[10px] text-[var(--text-muted)] flex items-center justify-between font-medium">
        <span>Double-click to rename</span>
        <span>Drag / Arrow to nudge</span>
      </div>
    </aside>
  );
};

export default LayersPanel;
