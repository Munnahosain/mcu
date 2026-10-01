'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Settings,
  Sliders,
  Move,
  RotateCw,
  Maximize,
  Sparkles,
  Palette,
  Eye,
  EyeOff,
  Link,
  Unlink,
  Trash2,
  Copy,
  PenTool,
  Clock,
  ChevronDown,
  Layers,
  Plus,
} from 'lucide-react';
import {
  ProjectState,
  SvgElementNode,
  AnimProperty,
  EasingType,
  Keyframe,
  CharacterSlot,
} from './types';
import { CHARACTER_SLOT_LABELS, EASING_OPTIONS } from './constants';
import { computeElementStylesAtTime } from './animationEngine';
import { ANIMATION_PRESETS } from './presets';
import { findElementById } from './svgParser';

interface InspectorProps {
  project: ProjectState;
  selectedElementId: string | null;
  selectedKeyframeId: string | null;
  onUpdateDocumentSettings: (settings: Partial<ProjectState['document']>) => void;
  onUpdateTransformProperty: (elementId: string, property: AnimProperty, value: number | string) => void;
  onToggleKeyframe: (elementId: string, property: AnimProperty) => void;
  onApplyPreset: (elementId: string, presetId: string) => void;
  onUpdateKeyframe: (keyframeId: string, updates: Partial<Keyframe>) => void;
  onDeleteKeyframe: (keyframeId: string) => void;
  onDuplicateKeyframe: (keyframeId: string) => void;
  characterSlots: Partial<Record<CharacterSlot, string>>;
  onAssignSlot: (slot: CharacterSlot, elementId: string | null) => void;
  onRenameElement: (elementId: string, newName: string) => void;
}

export const Inspector: React.FC<InspectorProps> = ({
  project,
  selectedElementId,
  selectedKeyframeId,
  onUpdateDocumentSettings,
  onUpdateTransformProperty,
  onToggleKeyframe,
  onApplyPreset,
  onUpdateKeyframe,
  onDeleteKeyframe,
  onDuplicateKeyframe,
  characterSlots,
  onAssignSlot,
  onRenameElement,
}) => {
  const [scaleLocked, setScaleLocked] = useState(true);
  const [isFpsMenuOpen, setIsFpsMenuOpen] = useState(false);
  const fpsDropdownRef = useRef<HTMLDivElement>(null);
  const fpsTriggerRef = useRef<HTMLButtonElement>(null);
  const fpsOptions = [12, 24, 30, 60];

  useEffect(() => {
    if (!isFpsMenuOpen) return;

    const handleOutsidePointerDown = (event: PointerEvent) => {
      if (!fpsDropdownRef.current?.contains(event.target as Node)) {
        setIsFpsMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handleOutsidePointerDown);
    return () => document.removeEventListener('pointerdown', handleOutsidePointerDown);
  }, [isFpsMenuOpen]);

  const handleFpsMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setIsFpsMenuOpen(false);
      fpsTriggerRef.current?.focus();
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const currentOption = Number((event.target as HTMLElement).dataset.fpsValue);
      const currentIndex = fpsOptions.indexOf(currentOption || project.document.fps);
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = (currentIndex + direction + fpsOptions.length) % fpsOptions.length;
      setIsFpsMenuOpen(true);
      requestAnimationFrame(() => {
        fpsDropdownRef.current
          ?.querySelector<HTMLButtonElement>(`[data-fps-value="${fpsOptions[nextIndex]}"]`)
          ?.focus();
      });
    }
  };

  const selectedNode = selectedElementId
    ? findElementById(project.elements, selectedElementId)
    : null;

  // Selected element computed style at current time
  const currentStyles = selectedElementId
    ? computeElementStylesAtTime(
        project.tracks,
        selectedElementId,
        project.currentTime,
        selectedNode?.initialTransform,
        selectedNode?.initialAppearance
      )
    : null;

  // Check if property has keyframe at current playhead
  const hasKeyframeAtPlayhead = (prop: AnimProperty): boolean => {
    if (!selectedElementId) return false;
    const track = project.tracks.find(
      (t) => t.elementId === selectedElementId && t.property === prop
    );
    if (!track) return false;
    return track.keyframes.some(
      (kf) => Math.abs(kf.time - project.currentTime) < 0.04
    );
  };

  // Find selected keyframe object if any
  let activeKeyframe: { trackProperty: AnimProperty; kf: Keyframe } | null = null;
  if (selectedKeyframeId) {
    for (const trk of project.tracks) {
      const found = trk.keyframes.find((k) => k.id === selectedKeyframeId);
      if (found) {
        activeKeyframe = { trackProperty: trk.property, kf: found };
        break;
      }
    }
  }

  // Find assigned slot for selected element
  const currentAssignedSlot = selectedElementId
    ? (Object.entries(characterSlots).find(([_, id]) => id === selectedElementId)?.[0] as CharacterSlot | undefined)
    : undefined;

  // Render Document Inspector when no element is selected
  if (!selectedNode || !currentStyles) {
    return (
      <aside className="w-72 border-l border-[var(--card-border)] bg-[var(--card-bg)] text-foreground flex flex-col h-full min-h-0 select-none z-10 shrink-0 transition-colors">
        <div className="p-3 border-b border-[var(--card-border)] bg-[var(--card-bg)] flex items-center gap-2">
          <Settings className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold text-foreground tracking-wide uppercase">
            Document Settings
          </span>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-4 text-xs">
          {/* Dimensions */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Canvas Dimensions
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1.5 bg-[var(--input-bg)] px-2.5 py-1.5 rounded-xl border border-[var(--card-border)]">
                <span className="text-[var(--text-muted)] font-mono text-[10px]">W:</span>
                <input
                  type="number"
                  value={project.document.viewBox.width}
                  onChange={(e) =>
                    onUpdateDocumentSettings({
                      viewBox: { ...project.document.viewBox, width: Number(e.target.value) || 800 },
                    })
                  }
                  className="bg-transparent text-foreground font-mono text-xs w-full outline-none font-bold"
                />
              </div>
              <div className="flex items-center gap-1.5 bg-[var(--input-bg)] px-2.5 py-1.5 rounded-xl border border-[var(--card-border)]">
                <span className="text-[var(--text-muted)] font-mono text-[10px]">H:</span>
                <input
                  type="number"
                  value={project.document.viewBox.height}
                  onChange={(e) =>
                    onUpdateDocumentSettings({
                      viewBox: { ...project.document.viewBox, height: Number(e.target.value) || 600 },
                    })
                  }
                  className="bg-transparent text-foreground font-mono text-xs w-full outline-none font-bold"
                />
              </div>
            </div>
          </div>

          {/* Timeline Duration & FPS */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Playback Configuration
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <span className="text-[10px] text-[var(--text-muted)]">Duration (s)</span>
                <input
                  type="number"
                  min="0.5"
                  max="30"
                  step="0.5"
                  value={project.document.duration}
                  onChange={(e) =>
                    onUpdateDocumentSettings({ duration: Math.max(0.5, Number(e.target.value) || 4.0) })
                  }
                  className="w-full bg-[var(--input-bg)] text-foreground px-2.5 py-1.5 rounded-xl border border-[var(--input-border)] font-mono text-xs outline-none focus:border-primary font-bold"
                />
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-[var(--text-muted)]">Frame Rate</span>
                <div
                  ref={fpsDropdownRef}
                  className="relative"
                  onKeyDown={handleFpsMenuKeyDown}
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                      setIsFpsMenuOpen(false);
                    }
                  }}
                >
                  <button
                    ref={fpsTriggerRef}
                    type="button"
                    role="combobox"
                    aria-label="Frame rate"
                    aria-haspopup="listbox"
                    aria-expanded={isFpsMenuOpen}
                    onClick={() => setIsFpsMenuOpen((open) => !open)}
                    className="flex w-full items-center justify-between gap-2 rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-2.5 py-1.5 text-left font-mono text-xs font-semibold text-foreground outline-none transition-colors hover:border-primary/50 focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
                  >
                    <span>{project.document.fps} FPS</span>
                    <ChevronDown className={`h-3.5 w-3.5 text-primary transition-transform ${isFpsMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isFpsMenuOpen && (
                    <div
                      role="listbox"
                      aria-label="Frame rate options"
                      className="absolute right-0 top-full z-50 mt-1 w-full overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-1 shadow-2xl"
                    >
                      {fpsOptions.map((fps) => (
                        <button
                          key={fps}
                          type="button"
                          role="option"
                          aria-selected={project.document.fps === fps}
                          data-fps-value={fps}
                          onClick={() => {
                            onUpdateDocumentSettings({ fps });
                            setIsFpsMenuOpen(false);
                            fpsTriggerRef.current?.focus();
                          }}
                          className={`w-full rounded-lg px-2.5 py-2 text-left font-mono text-xs transition-colors ${
                            project.document.fps === fps
                              ? 'bg-primary/15 font-bold text-primary'
                              : 'text-foreground hover:bg-primary/10 hover:text-primary'
                          }`}
                        >
                          {fps} FPS
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Loop toggle */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--input-bg)] border border-[var(--card-border)]">
            <span className="text-foreground font-semibold">Loop Playback</span>
            <input
              type="checkbox"
              checked={project.document.loop}
              onChange={(e) => onUpdateDocumentSettings({ loop: e.target.checked })}
              className="accent-primary w-4 h-4 cursor-pointer"
            />
          </div>

          {/* Selection Hint */}
          <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 text-foreground text-[11px] space-y-1">
            <p className="font-bold text-primary">Inspector Ready</p>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Click any element on the canvas or layers list to inspect and animate its transform,
              appearance, and keyframes.
            </p>
          </div>
        </div>
      </aside>
    );
  }

  // Render Element Inspector when an object is selected
  return (
    <aside className="w-72 border-l border-[var(--card-border)] bg-[var(--card-bg)] text-foreground flex flex-col h-full min-h-0 select-none z-10 shrink-0 transition-colors">
      {/* Element Header */}
      <div className="p-2.5 border-b border-[var(--card-border)] bg-[var(--card-bg)] flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <Sliders className="h-4 w-4 text-primary shrink-0" />
          <input
            type="text"
            value={selectedNode.name}
            onChange={(e) => onRenameElement(selectedNode.id, e.target.value)}
            className="bg-[var(--input-bg)] hover:border-primary/40 focus:border-primary text-xs font-bold text-foreground px-2 py-1 rounded-xl border border-[var(--input-border)] outline-none truncate"
            title="Edit layer name"
          />
        </div>
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-[var(--input-bg)] text-[var(--text-secondary)] border border-[var(--card-border)]">
          &lt;{selectedNode.tagName}&gt;
        </span>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-4 text-xs">
        {/* Semantic Character Slot Assign */}
        <div className="space-y-1.5 bg-[var(--input-bg)] p-2.5 rounded-2xl border border-[var(--card-border)]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-primary uppercase tracking-wide">
              Character Slot
            </span>
            {currentAssignedSlot && (
              <button
                type="button"
                onClick={() => onAssignSlot(currentAssignedSlot, null)}
                className="text-[9px] font-semibold text-[var(--text-muted)] hover:text-red-500 transition-colors"
              >
                Unbind
              </button>
            )}
          </div>
          <select
            value={currentAssignedSlot || ''}
            onChange={(e) => {
              const val = e.target.value as CharacterSlot;
              if (val) onAssignSlot(val, selectedNode.id);
            }}
            className="w-full bg-[var(--card-bg)] text-foreground px-2.5 py-1.5 rounded-xl border border-[var(--input-border)] text-xs outline-none focus:border-primary font-semibold"
          >
            <option value="">None (Generic Object)</option>
            {Object.entries(CHARACTER_SLOT_LABELS).map(([slotKey, info]) => (
              <option key={slotKey} value={slotKey}>
                {info.label}
              </option>
            ))}
          </select>
        </div>

        {/* 1. TRANSFORM SECTION */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between border-b border-[var(--card-border)] pb-1">
            <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Transform
            </span>
          </div>

          {/* Position X / Y */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center justify-between bg-[var(--input-bg)] px-2.5 py-1.5 rounded-xl border border-[var(--card-border)]">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-[var(--text-muted)]">X</span>
                <input
                  type="number"
                  value={Math.round(currentStyles.x)}
                  onChange={(e) =>
                    onUpdateTransformProperty(selectedNode.id, 'x', Number(e.target.value) || 0)
                  }
                  className="bg-transparent text-foreground font-mono text-xs w-16 outline-none text-right font-bold"
                />
              </div>
              <button
                type="button"
                onClick={() => onToggleKeyframe(selectedNode.id, 'x')}
                className={`p-0.5 rounded transition-colors ${
                  hasKeyframeAtPlayhead('x') ? 'text-primary fill-primary' : 'text-[var(--text-muted)] hover:text-primary'
                }`}
                title="Toggle Position X Keyframe (◆)"
              >
                ◆
              </button>
            </div>

            <div className="flex items-center justify-between bg-[var(--input-bg)] px-2.5 py-1.5 rounded-xl border border-[var(--card-border)]">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-[var(--text-muted)]">Y</span>
                <input
                  type="number"
                  value={Math.round(currentStyles.y)}
                  onChange={(e) =>
                    onUpdateTransformProperty(selectedNode.id, 'y', Number(e.target.value) || 0)
                  }
                  className="bg-transparent text-foreground font-mono text-xs w-16 outline-none text-right font-bold"
                />
              </div>
              <button
                type="button"
                onClick={() => onToggleKeyframe(selectedNode.id, 'y')}
                className={`p-0.5 rounded transition-colors ${
                  hasKeyframeAtPlayhead('y') ? 'text-primary fill-primary' : 'text-[var(--text-muted)] hover:text-primary'
                }`}
                title="Toggle Position Y Keyframe (◆)"
              >
                ◆
              </button>
            </div>
          </div>

          {/* Rotation */}
          <div className="flex items-center justify-between bg-[var(--input-bg)] px-2.5 py-1.5 rounded-xl border border-[var(--card-border)]">
            <div className="flex items-center gap-2 flex-1 mr-2">
              <RotateCw className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />
              <input
                type="range"
                min="-180"
                max="180"
                value={Math.round(currentStyles.rotation)}
                onChange={(e) =>
                  onUpdateTransformProperty(selectedNode.id, 'rotation', Number(e.target.value))
                }
                className="w-full accent-primary cursor-pointer h-1.5 rounded"
              />
              <span className="font-mono text-xs text-foreground font-bold w-10 text-right">
                {Math.round(currentStyles.rotation)}°
              </span>
            </div>
            <button
              type="button"
              onClick={() => onToggleKeyframe(selectedNode.id, 'rotation')}
              className={`p-0.5 rounded transition-colors ${
                hasKeyframeAtPlayhead('rotation') ? 'text-primary fill-primary' : 'text-[var(--text-muted)] hover:text-primary'
              }`}
              title="Toggle Rotation Keyframe (◆)"
            >
              ◆
            </button>
          </div>

          {/* Scale X / Y */}
          <div className="flex items-center gap-1.5">
            <div className="flex-1 flex items-center justify-between bg-[var(--input-bg)] px-2.5 py-1.5 rounded-xl border border-[var(--card-border)]">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-[var(--text-muted)]">SX</span>
                <input
                  type="number"
                  value={Math.round(currentStyles.scaleX)}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 100;
                    onUpdateTransformProperty(selectedNode.id, 'scaleX', val);
                    if (scaleLocked) {
                      onUpdateTransformProperty(selectedNode.id, 'scaleY', val);
                    }
                  }}
                  className="bg-transparent text-foreground font-mono text-xs w-12 outline-none text-right font-bold"
                />
                <span className="text-[9px] text-[var(--text-muted)]">%</span>
              </div>
              <button
                type="button"
                onClick={() => onToggleKeyframe(selectedNode.id, 'scaleX')}
                className={`p-0.5 rounded transition-colors ${
                  hasKeyframeAtPlayhead('scaleX') ? 'text-primary fill-primary' : 'text-[var(--text-muted)] hover:text-primary'
                }`}
                title="Toggle Scale X Keyframe (◆)"
              >
                ◆
              </button>
            </div>

            <button
              type="button"
              onClick={() => setScaleLocked(!scaleLocked)}
              className={`p-2 rounded-xl border transition-colors ${
                scaleLocked
                  ? 'bg-primary/20 text-primary border-primary/40'
                  : 'text-[var(--text-muted)] border-[var(--card-border)] hover:text-foreground'
              }`}
              title={scaleLocked ? 'Aspect Ratio Locked' : 'Aspect Ratio Unlocked'}
            >
              {scaleLocked ? <Link className="h-3.5 w-3.5" /> : <Unlink className="h-3.5 w-3.5" />}
            </button>

            <div className="flex-1 flex items-center justify-between bg-[var(--input-bg)] px-2.5 py-1.5 rounded-xl border border-[var(--card-border)]">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-[var(--text-muted)]">SY</span>
                <input
                  type="number"
                  value={Math.round(currentStyles.scaleY)}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 100;
                    onUpdateTransformProperty(selectedNode.id, 'scaleY', val);
                    if (scaleLocked) {
                      onUpdateTransformProperty(selectedNode.id, 'scaleX', val);
                    }
                  }}
                  className="bg-transparent text-foreground font-mono text-xs w-12 outline-none text-right font-bold"
                />
                <span className="text-[9px] text-[var(--text-muted)]">%</span>
              </div>
              <button
                type="button"
                onClick={() => onToggleKeyframe(selectedNode.id, 'scaleY')}
                className={`p-0.5 rounded transition-colors ${
                  hasKeyframeAtPlayhead('scaleY') ? 'text-primary fill-primary' : 'text-[var(--text-muted)] hover:text-primary'
                }`}
                title="Toggle Scale Y Keyframe (◆)"
              >
                ◆
              </button>
            </div>
          </div>

          {/* Opacity */}
          <div className="flex items-center justify-between bg-[var(--input-bg)] px-2.5 py-1.5 rounded-xl border border-[var(--card-border)]">
            <div className="flex items-center gap-2 flex-1 mr-2">
              <span className="text-[10px] font-mono text-[var(--text-muted)]">Opacity</span>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(currentStyles.opacity)}
                onChange={(e) =>
                  onUpdateTransformProperty(selectedNode.id, 'opacity', Number(e.target.value))
                }
                className="w-full accent-primary cursor-pointer h-1.5 rounded"
              />
              <span className="font-mono text-xs text-foreground font-bold w-10 text-right">
                {Math.round(currentStyles.opacity)}%
              </span>
            </div>
            <button
              type="button"
              onClick={() => onToggleKeyframe(selectedNode.id, 'opacity')}
              className={`p-0.5 rounded transition-colors ${
                hasKeyframeAtPlayhead('opacity') ? 'text-primary fill-primary' : 'text-[var(--text-muted)] hover:text-primary'
              }`}
              title="Toggle Opacity Keyframe (◆)"
            >
              ◆
            </button>
          </div>

          {/* Transform Origin Quick 9-Point Grid */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-[var(--text-secondary)]">Anchor Point (Origin)</span>
              <span className="text-[10px] font-mono text-[var(--text-muted)] font-bold">
                {currentStyles.originX}%, {currentStyles.originY}%
              </span>
            </div>
            <div className="flex items-center gap-3 bg-[var(--input-bg)] p-2.5 rounded-2xl border border-[var(--card-border)]">
              {/* 9-point grid */}
              <div className="grid grid-cols-3 gap-1 w-14">
                {[
                  { x: 0, y: 0 },
                  { x: 50, y: 0 },
                  { x: 100, y: 0 },
                  { x: 0, y: 50 },
                  { x: 50, y: 50 },
                  { x: 100, y: 50 },
                  { x: 0, y: 100 },
                  { x: 50, y: 100 },
                  { x: 100, y: 100 },
                ].map((pt, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      onUpdateTransformProperty(selectedNode.id, 'originX', pt.x);
                      onUpdateTransformProperty(selectedNode.id, 'originY', pt.y);
                    }}
                    className={`h-3.5 w-3.5 rounded-md border transition-all ${
                      currentStyles.originX === pt.x && currentStyles.originY === pt.y
                        ? 'bg-primary border-primary shadow-sm shadow-primary/30'
                        : 'bg-[var(--card-bg)] border-[var(--card-border)] hover:border-primary/50'
                    }`}
                  />
                ))}
              </div>
              <span className="text-[10px] text-[var(--text-muted)] leading-tight">
                Sets the pivot center for scaling &amp; rotation.
              </span>
            </div>
          </div>
        </div>

        {/* 2. APPEARANCE & SVG DRAWING */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between border-b border-[var(--card-border)] pb-1">
            <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Appearance
            </span>
          </div>

          {/* Stroke Width & Dash Animation */}
          {selectedNode.pathLength !== undefined && (
            <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-primary uppercase">
                  SVG Path Reveal
                </span>
                <span className="text-[9px] font-mono text-[var(--text-muted)]">
                  Len: {Math.round(selectedNode.pathLength)}px
                </span>
              </div>
              <button
                type="button"
                onClick={() => onApplyPreset(selectedNode.id, 'draw-path')}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-primary hover:bg-primary-hover text-[#071b17] font-bold text-xs transition-colors shadow-sm"
              >
                <PenTool className="h-3.5 w-3.5" />
                <span>Animate Line Drawing</span>
              </button>
            </div>
          )}
        </div>

        {/* 3. ANIMATION PRESETS GRID */}
        <div className="space-y-2">
          <div className="flex items-center justify-between border-b border-[var(--card-border)] pb-1">
            <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              One-Click Presets
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {ANIMATION_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onApplyPreset(selectedNode.id, preset.id)}
                className="flex flex-col items-start p-2 rounded-xl bg-[var(--input-bg)] hover:bg-primary/10 hover:border-primary/40 border border-[var(--card-border)] text-left transition-all group"
                title={preset.description}
              >
                <span className="text-[11px] font-bold text-foreground group-hover:text-primary transition-colors">
                  {preset.name}
                </span>
                <span className="text-[9px] text-[var(--text-muted)] line-clamp-1">{preset.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 4. KEYFRAME INSPECTOR (if a keyframe is active) */}
        {activeKeyframe && (
          <div className="space-y-2.5 bg-[var(--input-bg)] p-3 rounded-2xl border border-primary/40 shadow-lg">
            <div className="flex items-center justify-between border-b border-[var(--card-border)] pb-1.5">
              <span className="text-[11px] font-bold text-primary flex items-center gap-1">
                <span>◆ Keyframe</span>
                <span className="text-[10px] text-[var(--text-secondary)] font-medium">
                  ({activeKeyframe.trackProperty})
                </span>
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onDuplicateKeyframe(activeKeyframe!.kf.id)}
                  className="p-1 rounded-lg text-[var(--text-muted)] hover:text-foreground hover:bg-[var(--hover-bg)]"
                  title="Duplicate Keyframe (Ctrl+D)"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteKeyframe(activeKeyframe!.kf.id)}
                  className="p-1 rounded-lg text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10"
                  title="Delete Keyframe (Del)"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Time & Value */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <span className="text-[9px] text-[var(--text-muted)] font-medium">Time (s)</span>
                <input
                  type="number"
                  step="0.05"
                  value={Math.round(activeKeyframe.kf.time * 100) / 100}
                  onChange={(e) =>
                    onUpdateKeyframe(activeKeyframe!.kf.id, { time: Number(e.target.value) || 0 })
                  }
                  className="w-full bg-[var(--card-bg)] text-foreground px-2 py-1 rounded-xl border border-[var(--input-border)] font-mono text-xs outline-none focus:border-primary font-bold"
                />
              </div>

              <div className="space-y-0.5">
                <span className="text-[9px] text-[var(--text-muted)] font-medium">Value</span>
                <input
                  type="number"
                  value={Number(activeKeyframe.kf.value) || 0}
                  onChange={(e) =>
                    onUpdateKeyframe(activeKeyframe!.kf.id, { value: Number(e.target.value) || 0 })
                  }
                  className="w-full bg-[var(--card-bg)] text-foreground px-2 py-1 rounded-xl border border-[var(--input-border)] font-mono text-xs outline-none focus:border-primary font-bold"
                />
              </div>
            </div>

            {/* Easing Selector */}
            <div className="space-y-1">
              <span className="text-[9px] text-[var(--text-muted)] font-medium">Easing Curve</span>
              <select
                value={activeKeyframe.kf.easing}
                onChange={(e) =>
                  onUpdateKeyframe(activeKeyframe!.kf.id, {
                    easing: e.target.value as EasingType,
                  })
                }
                className="w-full bg-[var(--card-bg)] text-foreground px-2.5 py-1.5 rounded-xl border border-[var(--input-border)] text-xs outline-none focus:border-primary font-semibold"
              >
                {EASING_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} ({opt.curveName})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Inspector;
