'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Anchor, ChevronDown, Hand, Home, Magnet, Menu, MousePointer2, RotateCw,
  Scaling, Search, Shapes, Type, ZoomIn,
} from 'lucide-react';

export type MotionTool = 'select' | 'hand' | 'zoom' | 'move' | 'rotate' | 'scale' | 'anchor';
export type MotionWorkspace = 'Default' | 'Standard' | 'Small screen';

type WorkspaceChromeProps = {
  activeTool: MotionTool;
  snapping: boolean;
  workspace: MotionWorkspace;
  openPanels: string[];
  visiblePanels: string[];
  onSetTool: (tool: MotionTool) => void;
  onToggleSnapping: () => void;
  onSetWorkspace: (workspace: MotionWorkspace) => void;
  onResetWorkspace: () => void;
  onSaveWorkspace: () => void;
  onOpenArtworkFile: (file: File) => void;
  onSaveProject: () => void;
  onLoadProjectFile: (file: File) => void;
  onExport: () => void;
  onNewComposition: () => void;
  onCompositionSettings: () => void;
  onSetWorkArea: () => void;
  onToggleAi: () => void;
  onOpenVeo: () => void;
  onOpenShortcuts: () => void;
  onTogglePanel: (panel: string) => void;
  onOpenHome: () => void;
  onFilterShortcuts: (query: string) => void;
  onAddShape: () => void;
  onAddText: () => void;
};

const toolOptions: { id: MotionTool | 'shape' | 'text'; label: string; shortcut: string; icon: React.ReactNode }[] = [
  { id: 'select', label: 'Select', shortcut: 'V', icon: <MousePointer2 /> },
  { id: 'hand', label: 'Hand', shortcut: 'H', icon: <Hand /> },
  { id: 'zoom', label: 'Zoom', shortcut: 'Z', icon: <ZoomIn /> },
  { id: 'move', label: 'Move', shortcut: 'W', icon: <MousePointer2 /> },
  { id: 'rotate', label: 'Rotate', shortcut: 'R', icon: <RotateCw /> },
  { id: 'scale', label: 'Scale', shortcut: 'S', icon: <Scaling /> },
  { id: 'anchor', label: 'Anchor', shortcut: 'A', icon: <Anchor /> },
  { id: 'shape', label: 'Shape', shortcut: 'Q', icon: <Shapes /> },
  { id: 'text', label: 'Text', shortcut: 'T', icon: <Type /> },
];

const windowPanels = ['Project', 'Layers', 'Preview', 'Info', 'Audio', 'Properties', 'Align', 'Presets', 'Character', 'Timeline', 'Render Queue'];

export function WorkspaceChrome({
  activeTool, snapping, workspace, openPanels, visiblePanels, onSetTool, onToggleSnapping,
  onSetWorkspace, onResetWorkspace, onSaveWorkspace, onOpenArtworkFile,
  onSaveProject, onLoadProjectFile, onExport, onNewComposition, onCompositionSettings,
  onSetWorkArea, onToggleAi, onOpenVeo, onOpenShortcuts, onTogglePanel, onOpenHome,
  onFilterShortcuts, onAddShape, onAddText,
}: WorkspaceChromeProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [helpSearch, setHelpSearch] = useState('');
  const openArtworkPicker = () => {
    const input = document.getElementById('motion-studio-artwork-input') as HTMLInputElement | null;
    input?.click();
  };
  const openProjectPicker = () => {
    const input = document.getElementById('motion-studio-project-input') as HTMLInputElement | null;
    input?.click();
  };
  const menuActions: Record<string, Array<{ label: string; action: () => void }>> = {
    File: [
      { label: 'New Composition', action: onNewComposition },
      { label: 'Open Artwork…', action: openArtworkPicker },
      { label: 'Open Project…', action: openProjectPicker },
      { label: 'Save Project', action: onSaveProject },
      { label: 'Export…', action: onExport },
    ],
    Edit: [{ label: 'Keyboard Shortcuts', action: onOpenShortcuts }],
    Composition: [
      { label: 'New Composition…', action: onNewComposition },
      { label: 'Composition Settings…', action: onCompositionSettings },
      { label: 'Set Work Area', action: onSetWorkArea },
    ],
    Layer: [{ label: 'Open AI Assistant', action: onToggleAi }, { label: 'Video tools', action: onOpenVeo }],
    Animation: [{ label: 'Keyboard Shortcuts', action: onOpenShortcuts }],
    View: [{ label: 'Reset Workspace', action: onResetWorkspace }],
    Window: windowPanels.map((panel) => ({ label: `${visiblePanels.includes(panel) ? '✓ ' : '　'}${panel}`, action: () => onTogglePanel(panel) })),
    Help: [{ label: 'Shortcuts', action: onOpenShortcuts }],
  };
  const menus = ['File', 'Edit', 'Composition', 'Layer', 'Animation', 'View', 'Window', 'Help'];
  const setWorkspaceTab = (next: MotionWorkspace) => onSetWorkspace(next);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
        || (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)))) return;
      const option = toolOptions.find((candidate) => candidate.shortcut.toLowerCase() === event.key.toLowerCase());
      if (!option) return;
      event.preventDefault();
      if (option.id === 'shape') onAddShape();
      else if (option.id === 'text') onAddText();
      else onSetTool(option.id);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onAddShape, onAddText, onSetTool]);

  return (
    <header className="shrink-0 border-b border-[#121212] bg-[var(--st-panel)] text-[var(--st-text)]">
      <input id="motion-studio-artwork-input" type="file" accept=".svg,image/svg+xml,image/png,image/jpeg,image/webp" className="hidden"
        aria-label="Open SVG artwork or image" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) onOpenArtworkFile(file); event.currentTarget.value = ''; }} />
      <input id="motion-studio-project-input" type="file" accept=".mcuproj,.json" className="hidden" aria-label="Open project file"
        onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) onLoadProjectFile(file); event.currentTarget.value = ''; }} />
      <div className="flex h-8 items-center gap-1 border-b border-[#121212] px-2">
        <nav aria-label="Studio menus" className="flex h-full min-w-0 items-center">
          {menus.map((label) => (
            <div className="relative h-full" key={label}>
              <button type="button" aria-haspopup="menu" aria-expanded={openMenu === label}
                onClick={() => setOpenMenu((open) => open === label ? null : label)}
                className={`h-full px-2 text-[11px] transition-colors hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--st-accent)] ${openMenu === label ? 'text-[var(--st-accent)]' : 'text-[var(--st-text)]'}`}>
                {label}
              </button>
              {openMenu === label && (
                <div role="menu" aria-label={`${label} menu`} className="absolute left-0 top-full z-[80] min-w-52 border border-[#121212] bg-[var(--st-panel)] p-1 shadow-2xl">
                  {menuActions[label].map(({ label: itemLabel, action }) => (
                    <button key={itemLabel} type="button" role="menuitem" onClick={() => { action(); setOpenMenu(null); }}
                      className="block w-full whitespace-nowrap px-2.5 py-1.5 text-left text-[11px] text-[var(--st-text)] hover:bg-white/5 hover:text-[var(--st-accent)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--st-accent)]">
                      {itemLabel}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
        <label className="ml-auto flex h-6 w-44 items-center gap-1 border border-[#121212] bg-[#1d1d1d] px-1.5">
          <Search className="h-3 w-3 shrink-0 text-[#888]" />
          <input value={helpSearch} onChange={(event) => { setHelpSearch(event.target.value); onFilterShortcuts(event.target.value); }}
            aria-label="Search help and shortcuts" placeholder="Search help" className="min-w-0 flex-1 bg-transparent text-[10px] text-white outline-none placeholder:text-[#777]" />
        </label>
      </div>
      <div className="flex h-7 items-center gap-1 px-2">
        <Link href="/dashboard" onClick={(event) => { event.preventDefault(); onOpenHome(); }}
          aria-label="Back to dashboard" title="Back to dashboard" className="flex h-6 w-6 items-center justify-center text-[#aaa] hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--st-accent)]">
          <Home className="h-4 w-4" />
        </Link>
        <div className="mx-1 h-4 w-px bg-[#121212]" />
        {toolOptions.map(({ id, label, shortcut, icon }) => {
          const active = activeTool === id;
          return (
            <button key={id} type="button" title={`${label} (${shortcut})`} aria-label={`${label} tool`} aria-pressed={active}
              onClick={() => id === 'shape' ? onAddShape() : id === 'text' ? onAddText() : onSetTool(id)}
              className={`flex h-6 w-6 items-center justify-center rounded-sm focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--st-accent)] ${active ? 'bg-white/10 text-[var(--st-accent)]' : 'text-[#aaa] hover:bg-white/5 hover:text-white'}`}>
              {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: 'h-4 w-4' })}
            </button>
          );
        })}
        <label className="ml-2 flex items-center gap-1.5 text-[10px] text-[#aaa]">
          <input type="checkbox" checked={snapping} onChange={onToggleSnapping} aria-label="Enable snapping" className="accent-[var(--st-accent)]" />
          <Magnet className="h-3.5 w-3.5" /> Snapping
        </label>
        <div className="ml-auto flex h-full items-center gap-3">
          {(['Default', 'Standard', 'Small screen'] as MotionWorkspace[]).map((tab) => (
            <button key={tab} type="button" aria-pressed={workspace === tab} onClick={() => setWorkspaceTab(tab)}
              className={`h-full border-b-2 px-2 text-[10px] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--st-accent)] ${workspace === tab ? 'border-[var(--st-accent)] text-[var(--st-accent)]' : 'border-transparent text-[#aaa] hover:text-white'}`}>
              {tab === 'Small screen' ? 'Small Screen' : tab}
            </button>
          ))}
          <button type="button" aria-label="Workspace options" title="Workspace options" onClick={() => setShowWorkspaceMenu((open) => !open)}
            className="flex h-6 w-6 items-center justify-center text-[#aaa] hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--st-accent)]">»</button>
          <div className="relative">
            <button type="button" aria-label="Workspace options" title="Workspace options" aria-expanded={showWorkspaceMenu}
              onClick={() => setShowWorkspaceMenu((open) => !open)} className="flex h-6 w-6 items-center justify-center text-[#aaa] hover:text-white">
              <Menu className="h-3.5 w-3.5" />
            </button>
            {showWorkspaceMenu && <div className="absolute right-0 top-full z-[80] min-w-40 border border-[#121212] bg-[var(--st-panel)] p-1 shadow-xl">
              <button type="button" onClick={() => { onSaveWorkspace(); setShowWorkspaceMenu(false); }} className="block w-full px-2 py-1.5 text-left text-[11px] hover:text-[var(--st-accent)]">Save Workspace</button>
              <button type="button" onClick={() => { onResetWorkspace(); setShowWorkspaceMenu(false); }} className="block w-full px-2 py-1.5 text-left text-[11px] hover:text-[var(--st-accent)]">Reset Workspace</button>
            </div>}
          </div>
          <ChevronDown className="h-3 w-3 text-[#666]" />
        </div>
      </div>
    </header>
  );
}
