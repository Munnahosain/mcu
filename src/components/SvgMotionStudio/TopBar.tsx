'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import {
  Play,
  Pause,
  RotateCcw,
  Upload,
  Download,
  Save,
  FolderOpen,
  Plus,
  Undo2,
  Redo2,
  Sparkles,
  Grid,
  Maximize2,
  Minimize2,
  HelpCircle,
  Maximize,
  Minimize,
  Film,
} from 'lucide-react';
import { ProjectState } from './types';

interface TopBarProps {
  project: ProjectState;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onTogglePlay: () => void;
  onRewind: () => void;
  onOpenSvgFile: (file: File) => void;
  onNewProject: () => void;
  onSaveProject: () => void;
  onLoadProjectFile: (file: File) => void;
  onOpenExportModal: () => void;
  onToggleAiAssistant: () => void;
  isAiAssistantOpen: boolean;
  onOpenVeoVideoModal?: () => void;
  isVeoVideoModalOpen?: boolean;
  onToggleShortcuts: () => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  showRulers: boolean;
  onToggleRulers: () => void;
  showSafeArea: boolean;
  onToggleSafeArea: () => void;
  canvasBg: string;
  onChangeCanvasBg: (bg: string) => void;
  onFitToScreen: () => void;
  onRenameProject: (name: string) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  project,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onTogglePlay,
  onRewind,
  onOpenSvgFile,
  onNewProject,
  onSaveProject,
  onLoadProjectFile,
  onOpenExportModal,
  onToggleAiAssistant,
  isAiAssistantOpen,
  onOpenVeoVideoModal,
  isVeoVideoModalOpen = false,
  onToggleShortcuts,
  showGrid,
  onToggleGrid,
  showRulers,
  onToggleRulers,
  showSafeArea,
  onToggleSafeArea,
  canvasBg,
  onChangeCanvasBg,
  onFitToScreen,
  onRenameProject,
  isFullscreen = false,
  onToggleFullscreen,
}) => {
  const svgFileInputRef = useRef<HTMLInputElement>(null);
  const projFileInputRef = useRef<HTMLInputElement>(null);

  const handleSvgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onOpenSvgFile(file);
      e.target.value = '';
    }
  };

  const handleProjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onLoadProjectFile(file);
      e.target.value = '';
    }
  };

  return (
    <header className="svg-motion-topbar h-14 border-b border-[var(--card-border)] bg-[var(--card-bg)] px-3 sm:px-4 flex items-center justify-between select-none z-30 shrink-0 backdrop-blur-xl transition-colors">
      <input
        type="file"
        ref={svgFileInputRef}
        onChange={handleSvgChange}
        accept=".svg,image/svg+xml"
        className="hidden"
      />
      <input
        type="file"
        ref={projFileInputRef}
        onChange={handleProjChange}
        accept=".mcuproj,.json"
        className="hidden"
      />

      {/* Left: Brand & File Operations */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2 select-none">
          <Link
            href="/"
            className="h-8 w-8 rounded-xl bg-primary/10 hover:bg-primary border border-primary/25 hover:border-primary flex items-center justify-center text-primary hover:text-[#071b17] shadow-sm shadow-primary/10 transition-all cursor-pointer"
            title="Return to MCUSTOCK"
          >
            <Film className="h-4 w-4" strokeWidth={2.2} />
          </Link>
          <div className="leading-tight hidden sm:block">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-foreground tracking-wide">SVG Motion</span>
              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
                PRO
              </span>
            </div>
            <span className="text-[10px] text-[var(--text-secondary)] font-medium">Vector Animator</span>
          </div>
        </div>

        <div className="h-5 w-[1px] bg-[var(--card-border)] mx-0.5" />

        {/* Project Name inline edit */}
        <input
          type="text"
          value={project.name}
          onChange={(e) => onRenameProject(e.target.value)}
          className="bg-[var(--input-bg)] hover:border-primary/40 focus:border-primary text-xs font-semibold text-foreground px-2.5 py-1 rounded-xl border border-[var(--input-border)] outline-none w-28 sm:w-36 transition-all"
          title="Click to rename project"
        />

        {/* File Actions */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => svgFileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-foreground hover:text-primary bg-[var(--input-bg)] hover:bg-primary/10 border border-[var(--card-border)] hover:border-primary/40 transition-all shadow-sm"
            title="Upload local SVG file"
          >
            <Upload className="h-3.5 w-3.5 text-primary" />
            <span className="hidden md:inline">Open SVG</span>
          </button>

          <button
            type="button"
            onClick={onSaveProject}
            className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:text-foreground hover:bg-[var(--hover-bg)] transition-all"
            title="Save project (.mcuproj JSON)"
          >
            <Save className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Save</span>
          </button>

          <button
            type="button"
            onClick={() => projFileInputRef.current?.click()}
            className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:text-foreground hover:bg-[var(--hover-bg)] transition-all"
            title="Open existing project file"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Open</span>
          </button>

          <button
            type="button"
            onClick={onNewProject}
            className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:text-foreground hover:bg-[var(--hover-bg)] transition-all"
            title="Create clean blank canvas"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden xl:inline">New</span>
          </button>
        </div>

        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 bg-[var(--input-bg)] p-0.5 rounded-xl border border-[var(--card-border)]">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-foreground disabled:opacity-30 disabled:hover:text-[var(--text-secondary)] transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-foreground disabled:opacity-30 disabled:hover:text-[var(--text-secondary)] transition-colors"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Center: Playback Preview Button */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRewind}
          className="p-1.5 rounded-xl text-[var(--text-secondary)] hover:text-foreground hover:bg-[var(--hover-bg)] transition-colors"
          title="Rewind to start (Home / 0)"
        >
          <RotateCcw className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onTogglePlay}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-extrabold text-xs transition-all shadow-md ${
            project.isPlaying
              ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-amber-500/25'
              : 'bg-gradient-to-r from-primary to-[#27e39a] hover:opacity-95 text-[#071b17] shadow-[0_4px_14px_rgba(22,199,132,0.35)]'
          }`}
          title="Play / Pause preview (Space)"
        >
          {project.isPlaying ? (
            <>
              <Pause className="h-3.5 w-3.5 fill-current" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Preview</span>
            </>
          )}
        </button>
      </div>

      {/* Right: Studio Modes, View Toggles & Export */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* AI Assistant Toggle */}
        <button
          type="button"
          onClick={onToggleAiAssistant}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
            isAiAssistantOpen
              ? 'bg-primary/20 text-primary border-primary shadow-sm shadow-primary/20'
              : 'text-[var(--text-secondary)] hover:text-foreground bg-[var(--input-bg)] hover:bg-[var(--hover-bg)] border-[var(--card-border)]'
          }`}
          title="Toggle AI Natural Language Motion Assistant"
        >
          <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
          <span className="hidden md:inline">AI Assistant</span>
        </button>

        {/* AI Video (Veo 3) Button */}
        {onOpenVeoVideoModal && (
          <button
            type="button"
            onClick={onOpenVeoVideoModal}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              isVeoVideoModalOpen
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500 shadow-sm shadow-emerald-500/20'
                : 'text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30'
            }`}
            title="Generate video with Veo 3 (Animate Photo or Text-to-Video)"
          >
            <Film className="h-3.5 w-3.5 text-emerald-400" />
            <span className="hidden sm:inline">AI Video (Veo)</span>
          </button>
        )}

        <div className="h-5 w-[1px] bg-[var(--card-border)]" />

        {/* Canvas background picker */}
        <div className="flex items-center gap-1 bg-[var(--input-bg)] p-1 rounded-xl border border-[var(--card-border)]">
          <button
            type="button"
            onClick={() => onChangeCanvasBg('checkerboard')}
            className={`h-4.5 w-4.5 rounded-md border transition-all ${
              canvasBg === 'checkerboard' ? 'border-primary ring-2 ring-primary/40' : 'border-transparent'
            }`}
            style={{
              backgroundImage:
                'linear-gradient(45deg, #888888 25%, transparent 25%), linear-gradient(-45deg, #888888 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #888888 75%), linear-gradient(-45deg, transparent 75%, #888888 75%)',
              backgroundSize: '8px 8px',
              backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
              backgroundColor: '#202229',
            }}
            title="Checkerboard transparent background"
          />
          <button
            type="button"
            onClick={() => onChangeCanvasBg('#101116')}
            className={`h-4.5 w-4.5 rounded-md bg-[#101116] border transition-all ${
              canvasBg === '#101116' || canvasBg === '#0e1015' ? 'border-primary ring-2 ring-primary/40' : 'border-slate-700/50'
            }`}
            title="Dark charcoal background"
          />
          <button
            type="button"
            onClick={() => onChangeCanvasBg('#ffffff')}
            className={`h-4.5 w-4.5 rounded-md bg-white border transition-all ${
              canvasBg === '#ffffff' ? 'border-primary ring-2 ring-primary/40' : 'border-slate-300 dark:border-slate-700'
            }`}
            title="Pure white background"
          />
          <label
            className="relative h-5 w-5 overflow-hidden rounded-md border border-[var(--card-border)] cursor-pointer"
            style={{ backgroundColor: canvasBg === 'checkerboard' ? '#16c784' : canvasBg }}
            title="Choose a custom canvas background"
          >
            <input
              type="color"
              value={canvasBg === 'checkerboard' ? '#16c784' : canvasBg}
              onChange={(e) => onChangeCanvasBg(e.target.value)}
              aria-label="Custom canvas background color"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
        </div>

        {/* Grid toggle */}
        <button
          type="button"
          onClick={onToggleGrid}
          className={`p-1.5 rounded-xl transition-colors ${
            showGrid ? 'bg-primary/20 text-primary border border-primary/40' : 'text-[var(--text-secondary)] hover:text-foreground'
          }`}
          title="Toggle Grid (G)"
        >
          <Grid className="h-4 w-4" />
        </button>

        {/* Fit to screen */}
        <button
          type="button"
          onClick={onFitToScreen}
          className="p-1.5 rounded-xl text-[var(--text-secondary)] hover:text-foreground hover:bg-[var(--hover-bg)] transition-colors"
          title="Fit Canvas to Screen"
        >
          <Maximize2 className="h-4 w-4" />
        </button>

        {/* Fullscreen Toggle */}
        {onToggleFullscreen && (
          <button
            type="button"
            onClick={onToggleFullscreen}
            className={`p-1.5 rounded-xl transition-colors ${
              isFullscreen ? 'bg-primary/20 text-primary border border-primary/40' : 'text-[var(--text-secondary)] hover:text-foreground hover:bg-[var(--hover-bg)]'
            }`}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
        )}

        {/* Shortcuts */}
        <button
          type="button"
          onClick={onToggleShortcuts}
          className="p-1.5 rounded-xl text-[var(--text-secondary)] hover:text-foreground hover:bg-[var(--hover-bg)] transition-colors"
          title="Keyboard shortcuts (?)"
        >
          <HelpCircle className="h-4 w-4" />
        </button>

        {/* Export Button */}
        <button
          type="button"
          onClick={onOpenExportModal}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-extrabold text-[#071b17] bg-gradient-to-r from-primary to-[#27e39a] hover:opacity-95 shadow-md shadow-primary/20 transition-all ml-1"
          title="Export Animated SVG, WebM, MP4, PNG Sequence or Project"
        >
          <Download className="h-3.5 w-3.5 stroke-[2.5]" />
          <span>Export</span>
        </button>
      </div>
    </header>
  );
};

export default TopBar;
