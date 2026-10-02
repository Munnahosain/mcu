'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Settings,
  Sliders,
  Move,
  RotateCw,
  Maximize2,
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
  Play,
  Activity,
  CircleDot,
  FastForward,
  Rewind,
  Check,
  Zap,
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
import {
  EASING_PRESETS,
  getAdjacentKeyframes,
  hasKeyframeAtTime,
} from './keyframeManager';

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
  autoKeyframe: boolean;
  onToggleAutoKeyframe: () => void;
  onRecordAllTransforms: (elementId: string) => void;
  onApplyEasingToTransforms: (elementId: string, easing: EasingType) => void;
  onSeek: (time: number) => void;
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
  autoKeyframe,
  onToggleAutoKeyframe,
  onRecordAllTransforms,
  onApplyEasingToTransforms,
  onSeek,
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
  const hasKeyframe = (prop: AnimProperty): boolean => {
    if (!selectedElementId) return false;
    return hasKeyframeAtTime(project.tracks, selectedElementId, prop, project.currentTime);
  };

  // Check if any transform has keyframe at playhead
  const hasAnyTransformKeyframe = useMemo(() => {
    if (!selectedElementId) return false;
    const transformProps: AnimProperty[] = ['scaleX', 'scaleY', 'rotation', 'opacity', 'x', 'y'];
    return transformProps.some((p) => hasKeyframe(p));
  }, [project.tracks, selectedElementId, project.currentTime]);

  // Adjacent keyframes for selected element
  const adjacent = useMemo(() => {
    return getAdjacentKeyframes(project.tracks, selectedElementId, project.currentTime);
  }, [project.tracks, selectedElementId, project.currentTime]);

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
      <aside className="w-80 border-l border-[var(--card-border)] bg-[var(--card-bg)] text-foreground flex flex-col h-full min-h-0 select-none z-10 shrink-0 transition-colors">
        <div className="p-3 border-b border-[var(--card-border)] bg-[var(--card-bg)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold text-foreground tracking-wide uppercase">
              Document Settings
            </span>
          </div>
          <span className="text-[10px] font-mono text-[var(--text-muted)]">
            {project.document.fps} FPS
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

          {/* Duration & FPS */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Timeline Settings
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1.5 bg-[var(--input-bg)] px-2.5 py-1.5 rounded-xl border border-[var(--card-border)]">
                <Clock className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="60"
                  value={project.document.duration}
                  onChange={(e) =>
                    onUpdateDocumentSettings({ duration: Number(e.target.value) || 4.0 })
                  }
                  className="bg-transparent text-foreground font-mono text-xs w-full outline-none font-bold"
                />
                <span className="text-[10px] text-[var(--text-muted)]">sec</span>
              </div>

              <div className="relative">
                <button
                  ref={fpsTriggerRef}
                  type="button"
                  onClick={() => setIsFpsMenuOpen((prev) => !prev)}
                  className="w-full flex items-center justify-between bg-[var(--input-bg)] px-2.5 py-1.5 rounded-xl border border-[var(--card-border)] text-xs font-mono font-bold text-foreground"
                >
                  <span>{project.document.fps} FPS</span>
                  <ChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                </button>

                {isFpsMenuOpen && (
                  <div
                    ref={fpsDropdownRef}
                    className="absolute right-0 top-full z-50 mt-1 w-full overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-1 shadow-2xl"
                  >
                    {fpsOptions.map((fps) => (
                      <button
                        key={fps}
                        type="button"
                        onClick={() => {
                          onUpdateDocumentSettings({ fps });
                          setIsFpsMenuOpen(false);
                        }}
                        className={`w-full rounded-lg px-2.5 py-1.5 text-left font-mono text-xs transition-colors ${
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
          <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/20 text-foreground text-[11px] space-y-1.5">
            <p className="font-bold text-primary flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" /> Keyframe Studio Ready
            </p>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Select any SVG layer to record and animate transform properties (Scale, Rotation, Opacity, Position) with smooth Ease-In / Ease-Out curves.
            </p>
          </div>
        </div>
      </aside>
    );
  }

  // Render Element Inspector when an object is selected
  return (
    <aside className="w-80 border-l border-[var(--card-border)] bg-[var(--card-bg)] text-foreground flex flex-col h-full min-h-0 select-none z-10 shrink-0 transition-colors">
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
        {/* ============================================================== */}
        {/* 1. KEYFRAME MANAGEMENT CONTROL BAR (After Effects Style)        */}
        {/* ============================================================== */}
        <div className="rounded-2xl border border-primary/30 bg-primary/[0.04] p-3 space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" />
              <span>Keyframe Management</span>
            </span>

            {/* Auto-Keyframe Toggle Button */}
            <button
              type="button"
              onClick={onToggleAutoKeyframe}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                autoKeyframe
                  ? 'bg-red-500/20 text-red-400 border border-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.25)]'
                  : 'bg-[var(--input-bg)] text-[var(--text-muted)] border border-[var(--card-border)] hover:text-foreground'
              }`}
              title={autoKeyframe ? 'Auto-Keyframe is ON: Changes record keyframes automatically' : 'Auto-Keyframe is OFF: Click to enable auto-recording'}
            >
              <span className={`h-2 w-2 rounded-full ${autoKeyframe ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`} />
              <span>{autoKeyframe ? 'REC ON' : 'REC OFF'}</span>
            </button>
          </div>

          {/* 1-Click Keyframe Record All & Keyframe Navigation */}
          <div className="flex items-center gap-1.5">
            {/* Record All Transforms Button */}
            <button
              type="button"
              onClick={() => onRecordAllTransforms(selectedNode.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl bg-primary hover:bg-primary-hover text-[#071b17] font-bold text-xs transition-colors shadow-sm"
              title="Record keyframe for Scale, Rotation, Opacity, and Position at current playhead"
            >
              <span className="text-sm font-black">◆</span>
              <span>Keyframe All</span>
            </button>

            {/* Jump to Previous Keyframe */}
            <button
              type="button"
              onClick={() => {
                if (adjacent.prevTime !== null) onSeek(adjacent.prevTime);
              }}
              disabled={adjacent.prevTime === null}
              className="p-1.5 rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] text-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:border-primary/40 hover:text-primary transition-colors"
              title="Jump to Previous Keyframe (J)"
            >
              <Rewind className="h-3.5 w-3.5" />
            </button>

            {/* Jump to Next Keyframe */}
            <button
              type="button"
              onClick={() => {
                if (adjacent.nextTime !== null) onSeek(adjacent.nextTime);
              }}
              disabled={adjacent.nextTime === null}
              className="p-1.5 rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] text-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:border-primary/40 hover:text-primary transition-colors"
              title="Jump to Next Keyframe (K)"
            >
              <FastForward className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Quick Easing Presets Bar */}
          <div className="space-y-1 pt-1 border-t border-[var(--card-border)]/60">
            <div className="flex items-center justify-between text-[10px] text-[var(--text-secondary)] font-medium">
              <span>Ease Presets</span>
              <span className="text-[9px] text-[var(--text-muted)]">1-Click Apply</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {EASING_PRESETS.slice(0, 6).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onApplyEasingToTransforms(selectedNode.id, preset.id)}
                  className="flex items-center justify-center gap-1 px-1.5 py-1 rounded-lg bg-[var(--input-bg)] hover:bg-primary/15 hover:border-primary/40 border border-[var(--card-border)] text-[10px] font-semibold text-foreground hover:text-primary transition-colors truncate"
                  title={`${preset.label}: ${preset.description}`}
                >
                  <svg className="w-2.5 h-2.5 stroke-current fill-none stroke-[2]" viewBox="0 0 20 20">
                    <path d={preset.curveSvgPath} />
                  </svg>
                  <span className="truncate">{preset.shortLabel}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 2. TRANSFORM CONTROLS (Scale, Rotation, Opacity, Position)      */}
        {/* ============================================================== */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-[var(--card-border)] pb-1">
            <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Transform Controls
            </span>
            <span className="text-[9px] font-mono text-[var(--text-muted)]">
              {autoKeyframe ? 'Auto-Key Active' : 'Manual'}
            </span>
          </div>

          {/* --- A. SCALE (Uniform & Independent SX/SY) --- */}
          <div className="space-y-1.5 bg-[var(--input-bg)] p-2.5 rounded-2xl border border-[var(--card-border)]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-foreground flex items-center gap-1.5">
                <Maximize2 className="h-3 w-3 text-primary" />
                <span>Scale</span>
              </span>
              <div className="flex items-center gap-1">
                {/* Scale presets */}
                <div className="flex items-center gap-1 mr-1">
                  {[0, 50, 100, 125].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => {
                        onUpdateTransformProperty(selectedNode.id, 'scaleX', val);
                        onUpdateTransformProperty(selectedNode.id, 'scaleY', val);
                      }}
                      className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-[var(--card-bg)] text-[var(--text-muted)] hover:text-primary hover:border-primary/40 border border-[var(--card-border)]"
                    >
                      {val}%
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onToggleKeyframe(selectedNode.id, 'scaleX');
                    onToggleKeyframe(selectedNode.id, 'scaleY');
                  }}
                  className={`p-1 rounded text-xs font-black transition-colors ${
                    hasKeyframe('scaleX') || hasKeyframe('scaleY')
                      ? 'text-primary fill-primary shadow-[0_0_8px_rgba(22,199,132,0.4)]'
                      : 'text-[var(--text-muted)] hover:text-primary'
                  }`}
                  title="Toggle Scale Keyframes (◆)"
                >
                  ◆
                </button>
              </div>
            </div>

            {/* Scale Slider */}
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="250"
                value={Math.round(currentStyles.scaleX)}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  onUpdateTransformProperty(selectedNode.id, 'scaleX', val);
                  if (scaleLocked) onUpdateTransformProperty(selectedNode.id, 'scaleY', val);
                }}
                className="w-full accent-primary cursor-pointer h-1.5 rounded"
              />
              <span className="font-mono text-xs text-foreground font-bold w-12 text-right">
                {Math.round(currentStyles.scaleX)}%
              </span>
            </div>

            {/* SX, Link Lock, SY Inputs */}
            <div className="flex items-center gap-1.5 pt-1">
              <div className="flex-1 flex items-center justify-between bg-[var(--card-bg)] px-2 py-1 rounded-xl border border-[var(--card-border)]">
                <span className="text-[10px] font-mono text-[var(--text-muted)]">SX</span>
                <input
                  type="number"
                  value={Math.round(currentStyles.scaleX)}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 100;
                    onUpdateTransformProperty(selectedNode.id, 'scaleX', val);
                    if (scaleLocked) onUpdateTransformProperty(selectedNode.id, 'scaleY', val);
                  }}
                  className="bg-transparent text-foreground font-mono text-xs w-12 outline-none text-right font-bold"
                />
                <span className="text-[9px] text-[var(--text-muted)]">%</span>
              </div>

              <button
                type="button"
                onClick={() => setScaleLocked(!scaleLocked)}
                className={`p-1.5 rounded-xl border transition-colors ${
                  scaleLocked
                    ? 'bg-primary/20 text-primary border-primary/40'
                    : 'text-[var(--text-muted)] border-[var(--card-border)] hover:text-foreground'
                }`}
                title={scaleLocked ? 'Scale Aspect Ratio Locked' : 'Independent Scale X / Y'}
              >
                {scaleLocked ? <Link className="h-3 w-3" /> : <Unlink className="h-3 w-3" />}
              </button>

              <div className="flex-1 flex items-center justify-between bg-[var(--card-bg)] px-2 py-1 rounded-xl border border-[var(--card-border)]">
                <span className="text-[10px] font-mono text-[var(--text-muted)]">SY</span>
                <input
                  type="number"
                  value={Math.round(currentStyles.scaleY)}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 100;
                    onUpdateTransformProperty(selectedNode.id, 'scaleY', val);
                    if (scaleLocked) onUpdateTransformProperty(selectedNode.id, 'scaleX', val);
                  }}
                  className="bg-transparent text-foreground font-mono text-xs w-12 outline-none text-right font-bold"
                />
                <span className="text-[9px] text-[var(--text-muted)]">%</span>
              </div>
            </div>
          </div>

          {/* --- B. ROTATION --- */}
          <div className="space-y-1.5 bg-[var(--input-bg)] p-2.5 rounded-2xl border border-[var(--card-border)]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-foreground flex items-center gap-1.5">
                <RotateCw className="h-3 w-3 text-primary" />
                <span>Rotation</span>
              </span>
              <div className="flex items-center gap-1">
                {/* Snap angles */}
                {[-90, 0, 90, 180].map((deg) => (
                  <button
                    key={deg}
                    type="button"
                    onClick={() => onUpdateTransformProperty(selectedNode.id, 'rotation', deg)}
                    className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-[var(--card-bg)] text-[var(--text-muted)] hover:text-primary hover:border-primary/40 border border-[var(--card-border)]"
                  >
                    {deg}°
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => onToggleKeyframe(selectedNode.id, 'rotation')}
                  className={`p-1 rounded text-xs font-black transition-colors ${
                    hasKeyframe('rotation')
                      ? 'text-primary fill-primary shadow-[0_0_8px_rgba(22,199,132,0.4)]'
                      : 'text-[var(--text-muted)] hover:text-primary'
                  }`}
                  title="Toggle Rotation Keyframe (◆)"
                >
                  ◆
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
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
              <div className="flex items-center bg-[var(--card-bg)] px-2 py-0.5 rounded-xl border border-[var(--card-border)]">
                <input
                  type="number"
                  value={Math.round(currentStyles.rotation)}
                  onChange={(e) =>
                    onUpdateTransformProperty(selectedNode.id, 'rotation', Number(e.target.value) || 0)
                  }
                  className="bg-transparent text-foreground font-mono text-xs w-10 outline-none text-right font-bold"
                />
                <span className="text-[10px] text-[var(--text-muted)]">°</span>
              </div>
            </div>
          </div>

          {/* --- C. OPACITY --- */}
          <div className="space-y-1.5 bg-[var(--input-bg)] p-2.5 rounded-2xl border border-[var(--card-border)]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-foreground flex items-center gap-1.5">
                <Eye className="h-3 w-3 text-primary" />
                <span>Opacity</span>
              </span>
              <div className="flex items-center gap-1">
                {/* Opacity presets */}
                {[0, 50, 100].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => onUpdateTransformProperty(selectedNode.id, 'opacity', val)}
                    className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-[var(--card-bg)] text-[var(--text-muted)] hover:text-primary hover:border-primary/40 border border-[var(--card-border)]"
                  >
                    {val}%
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => onToggleKeyframe(selectedNode.id, 'opacity')}
                  className={`p-1 rounded text-xs font-black transition-colors ${
                    hasKeyframe('opacity')
                      ? 'text-primary fill-primary shadow-[0_0_8px_rgba(22,199,132,0.4)]'
                      : 'text-[var(--text-muted)] hover:text-primary'
                  }`}
                  title="Toggle Opacity Keyframe (◆)"
                >
                  ◆
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
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
              <div className="flex items-center bg-[var(--card-bg)] px-2 py-0.5 rounded-xl border border-[var(--card-border)]">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={Math.round(currentStyles.opacity)}
                  onChange={(e) =>
                    onUpdateTransformProperty(selectedNode.id, 'opacity', Number(e.target.value) || 0)
                  }
                  className="bg-transparent text-foreground font-mono text-xs w-8 outline-none text-right font-bold"
                />
                <span className="text-[10px] text-[var(--text-muted)]">%</span>
              </div>
            </div>
          </div>

          {/* --- D. POSITION X & Y --- */}
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
                className={`p-0.5 rounded transition-colors text-xs font-black ${
                  hasKeyframe('x') ? 'text-primary fill-primary' : 'text-[var(--text-muted)] hover:text-primary'
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
                className={`p-0.5 rounded transition-colors text-xs font-black ${
                  hasKeyframe('y') ? 'text-primary fill-primary' : 'text-[var(--text-muted)] hover:text-primary'
                }`}
                title="Toggle Position Y Keyframe (◆)"
              >
                ◆
              </button>
            </div>
          </div>

          {/* --- E. TRANSFORM ORIGIN (Anchor Point) --- */}
          <div className="space-y-1.5 bg-[var(--input-bg)] p-2.5 rounded-2xl border border-[var(--card-border)]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-[var(--text-secondary)]">Anchor Point (Origin)</span>
              <span className="text-[10px] font-mono text-[var(--text-muted)] font-bold">
                {currentStyles.originX}%, {currentStyles.originY}%
              </span>
            </div>
            <div className="flex items-center gap-3">
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
                ].map((pt, i) => {
                  const isActive = currentStyles.originX === pt.x && currentStyles.originY === pt.y;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        onUpdateTransformProperty(selectedNode.id, 'originX', pt.x);
                        onUpdateTransformProperty(selectedNode.id, 'originY', pt.y);
                      }}
                      className={`h-4 w-4 rounded-sm border transition-colors flex items-center justify-center ${
                        isActive
                          ? 'bg-primary border-primary text-[#071b17]'
                          : 'bg-[var(--card-bg)] border-[var(--card-border)] hover:border-primary/50'
                      }`}
                      title={`Origin: ${pt.x}%, ${pt.y}%`}
                    >
                      {isActive && <div className="h-1.5 w-1.5 rounded-full bg-[#071b17]" />}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-[var(--text-muted)] leading-tight flex-1">
                Pivots scale and rotation from center, corner, or bottom edge.
              </p>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 3. ACTIVE KEYFRAME DETAIL INSPECTOR (When keyframe is selected) */}
        {/* ============================================================== */}
        {activeKeyframe && (
          <div className="space-y-3 bg-[var(--input-bg)] p-3 rounded-2xl border border-primary/50 shadow-lg">
            <div className="flex items-center justify-between border-b border-[var(--card-border)] pb-1.5">
              <span className="text-[11px] font-bold text-primary flex items-center gap-1.5">
                <span className="text-sm font-black">◆</span>
                <span>Active Keyframe</span>
                <span className="text-[10px] text-foreground font-semibold px-1.5 py-0.5 rounded-md bg-[var(--card-bg)] border border-[var(--card-border)]">
                  {activeKeyframe.trackProperty}
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

            {/* Time & Value Inputs */}
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

            {/* Easing Presets Pills for Selected Keyframe */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-wider">
                  Ease Preset
                </span>
                <span className="text-[9px] font-mono text-primary font-bold">
                  {activeKeyframe.kf.easing}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1">
                {EASING_PRESETS.map((preset) => {
                  const isCur = activeKeyframe!.kf.easing === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => onUpdateKeyframe(activeKeyframe!.kf.id, { easing: preset.id })}
                      className={`flex items-center justify-center gap-1 px-1.5 py-1 rounded-lg text-[10px] font-semibold border transition-all truncate ${
                        isCur
                          ? 'bg-primary text-[#071b17] border-primary font-bold shadow-sm'
                          : 'bg-[var(--card-bg)] text-foreground border-[var(--card-border)] hover:border-primary/40'
                      }`}
                      title={preset.description}
                    >
                      <svg className="w-2.5 h-2.5 stroke-current fill-none stroke-[2]" viewBox="0 0 20 20">
                        <path d={preset.curveSvgPath} />
                      </svg>
                      <span className="truncate">{preset.shortLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 4. CHARACTER SLOT BINDING (Optional)                           */}
        {/* ============================================================== */}
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

        {/* ============================================================== */}
        {/* 5. ONE-CLICK MOTION PRESETS                                     */}
        {/* ============================================================== */}
        <div className="space-y-2">
          <div className="flex items-center justify-between border-b border-[var(--card-border)] pb-1">
            <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Motion Presets
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
      </div>
    </aside>
  );
};

export default Inspector;
