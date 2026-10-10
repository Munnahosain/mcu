'use client';

import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  FileImage,
  FilePlus2,
  FileType2,
  Folder,
  FolderPlus,
  Image as ImageIcon,
  Search,
  Trash2,
  Video,
} from 'lucide-react';
import { ProjectItem, ProjectState } from './types';

export type ProjectSort = { key: 'name' | 'type' | 'size'; direction: 'asc' | 'desc' };

interface ProjectPanelProps {
  project: ProjectState;
  sort: ProjectSort;
  onSortChange: (sort: ProjectSort) => void;
  onOpenFile: (file: File) => void;
  onCreateFolder: (parentId?: string) => void;
  onDeleteItem: (item: ProjectItem) => void;
  onRenameItem: (item: ProjectItem, name: string) => void;
  onMoveItem: (itemId: string, parentId: string | null) => void;
  onSelectLayer: (layerId: string) => void;
  onOpenComposition: (item: ProjectItem) => void;
}

function formatSize(size?: number): string {
  if (!Number.isFinite(size) || !size || size < 0) return '—';
  return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function makeTree(items: ProjectItem[], query: string, sort: ProjectSort) {
  const normalized = query.trim().toLocaleLowerCase();
  const visible = new Set<string>();
  if (!normalized) {
    items.forEach((item) => visible.add(item.id));
  } else {
    const byId = new Map(items.map((item) => [item.id, item]));
    items.forEach((item) => {
      if (!item.name.toLocaleLowerCase().includes(normalized)) return;
      let current: ProjectItem | undefined = item;
      while (current) {
        visible.add(current.id);
        current = current.parentId ? byId.get(current.parentId) : undefined;
      }
    });
  }
  const compare = (a: ProjectItem, b: ProjectItem) => {
    const value = sort.key === 'size'
      ? (a.size ?? -1) - (b.size ?? -1)
      : (a[sort.key] ?? '').toString().localeCompare((b[sort.key] ?? '').toString(), undefined, { sensitivity: 'base' });
    return value * (sort.direction === 'asc' ? 1 : -1);
  };
  const byParent = new Map<string | null, ProjectItem[]>();
  items.filter((item) => visible.has(item.id)).forEach((item) => {
    const parent = item.parentId && items.some((candidate) => candidate.id === item.parentId)
      ? item.parentId
      : null;
    byParent.set(parent, [...(byParent.get(parent) ?? []), item]);
  });
  byParent.forEach((children) => children.sort(compare));
  const result: Array<{ item: ProjectItem; depth: number }> = [];
  const visit = (parentId: string | null, depth: number) => {
    (byParent.get(parentId) ?? []).forEach((item) => {
      result.push({ item, depth });
      if (item.type === 'folder') visit(item.id, depth + 1);
    });
  };
  visit(null, 0);
  return result;
}

interface ItemRowProps {
  item: ProjectItem;
  depth: number;
  selected: boolean;
  expanded: boolean;
  hasChildren: boolean;
  editing: boolean;
  editName: string;
  onEditNameChange: (value: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onSelect: () => void;
  onDoubleClick: () => void;
  onToggleFolder: () => void;
  onDelete: () => void;
  onDragStart: (event: React.DragEvent) => void;
  onDragOver: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
}

const ItemRow = memo(function ItemRow({
  item,
  depth,
  selected,
  expanded,
  hasChildren,
  editing,
  editName,
  onEditNameChange,
  onCommitRename,
  onCancelRename,
  onSelect,
  onDoubleClick,
  onToggleFolder,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
}: ItemRowProps) {
  const Icon = item.type === 'composition'
    ? Video
    : item.type === 'image'
      ? FileImage
      : item.type === 'svg'
        ? FileType2
        : Folder;
  const dot = item.type === 'composition'
    ? 'bg-cyan-500'
    : item.type === 'image'
      ? 'bg-purple-500'
      : item.type === 'svg'
        ? 'bg-emerald-500'
        : 'bg-amber-500';
  return (
    <div
      draggable={item.type !== 'composition'}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDoubleClick={onDoubleClick}
      className={`group relative grid min-h-8 grid-cols-[minmax(0,1fr)_84px_64px] items-center gap-1 overflow-hidden border-l-2 pr-1 text-[10px] transition-colors ${
        selected ? 'border-primary bg-primary/10 text-primary' : 'border-transparent text-foreground hover:bg-[var(--hover-bg)]'
      }`}
    >
      <div className="flex min-w-0 items-center gap-1" style={{ paddingLeft: `${6 + depth * 14}px` }}>
        {item.type === 'folder' ? (
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); onToggleFolder(); }}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} folder ${item.name}`}
            aria-expanded={expanded}
            className="rounded p-0.5 text-[var(--text-muted)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {hasChildren ? (expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />) : <span className="block h-3 w-3" />}
          </button>
        ) : <span className="w-4 shrink-0" />}
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
        <button
          type="button"
          onClick={onSelect}
          aria-label={`Select ${item.name}, ${item.type}`}
          className="flex min-w-0 flex-1 items-center gap-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Icon className="h-3.5 w-3.5 shrink-0" />
          {editing ? (
            <input
              autoFocus
              value={editName}
              onChange={(event) => onEditNameChange(event.target.value)}
              onBlur={onCommitRename}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onCommitRename();
                if (event.key === 'Escape') onCancelRename();
              }}
              onClick={(event) => event.stopPropagation()}
              aria-label={`Rename ${item.name}`}
              className="min-w-0 w-full rounded border border-primary bg-[var(--input-bg)] px-1 text-[10px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          ) : <span className="truncate font-medium">{item.name}</span>}
        </button>
      </div>
      <span className="truncate text-[9px] capitalize text-[var(--text-muted)]">{item.type}</span>
      <span className="relative flex min-w-0 items-center justify-end text-right text-[9px] text-[var(--text-muted)]">
        {formatSize(item.size)}
        {item.type !== 'composition' && (
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${item.name}`}
            title={`Delete ${item.name}`}
            className="absolute right-0 hidden rounded bg-[var(--card-bg)] p-0.5 text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-500 group-hover:inline-flex focus-visible:inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </span>
    </div>
  );
});

export const ProjectPanel: React.FC<ProjectPanelProps> = ({
  project,
  sort,
  onSortChange,
  onOpenFile,
  onCreateFolder,
  onDeleteItem,
  onRenameItem,
  onMoveItem,
  onSelectLayer,
  onOpenComposition,
}) => {
  const [query, setQuery] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const items = useMemo(() => project.projectItems ?? [], [project.projectItems]);
  const rows = useMemo(() => makeTree(items, query, sort), [items, query, sort]);
  const selectedItem = items.find((item) => item.id === selectedItemId) ?? items[0] ?? null;
  const selectedImage = selectedItem?.dataUrl
    ?? project.rasterSources?.find((source) => source.elementOriginalId === selectedItem?.id)?.dataUrl;
  const selectedSvg = selectedItem?.svgText;
  const selectedComposition = selectedItem?.type === 'composition';
  const children = useMemo(
    () => new Set(items.filter((item) => item.parentId).map((item) => item.parentId as string)),
    [items]
  );

  const commitRename = useCallback((item: ProjectItem) => {
    const name = editName.trim();
    if (name && name !== item.name) onRenameItem(item, name);
    setEditingId(null);
  }, [editName, onRenameItem]);

  const isHiddenByCollapsedParent = (item: ProjectItem) => {
    if (query.trim()) return false;
    let parentId = item.parentId;
    while (parentId) {
      if (expandedFolders[parentId] === false) return true;
      parentId = items.find((candidate) => candidate.id === parentId)?.parentId ?? null;
    }
    return false;
  };

  const startRename = useCallback((item: ProjectItem) => {
    setSelectedItemId(item.id);
    setEditingId(item.id);
    setEditName(item.name);
  }, []);

  const toggleSort = (key: ProjectSort['key']) => {
    onSortChange({
      key,
      direction: sort.key === key && sort.direction === 'asc' ? 'desc' : 'asc',
    });
  };

  const handleDropFile = (event: React.DragEvent, parentId?: string) => {
    const file = event.dataTransfer.files[0];
    if (file) {
      event.preventDefault();
      event.stopPropagation();
      onOpenFile(file);
      return true;
    }
    if (parentId) {
      const itemId = event.dataTransfer.getData('application/x-mcu-project-item');
      if (itemId && itemId !== parentId) {
        event.preventDefault();
        event.stopPropagation();
        onMoveItem(itemId, parentId);
        setDragOverId(null);
        return true;
      }
    }
    return false;
  };

  return (
    <aside
      tabIndex={0}
      aria-label="Project panel"
      onKeyDown={(event) => {
        if (event.key === 'F2' && selectedItem && selectedItem.type !== 'composition') {
          event.preventDefault();
          startRename(selectedItem);
        }
      }}
      onDragOver={(event) => {
        if (event.dataTransfer.files.length || event.dataTransfer.types.includes('application/x-mcu-project-item')) {
          event.preventDefault();
        }
      }}
      onDrop={(event) => { handleDropFile(event); }}
      className="flex h-full min-h-0 w-full shrink-0 flex-col border-r border-[var(--card-border)] bg-[var(--card-bg)] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
    >
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-[var(--card-border)] px-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-secondary)]">Project</span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onCreateFolder(selectedItem?.type === 'folder' ? selectedItem.id : undefined)} title="New folder" aria-label="Create project folder" className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <FolderPlus className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => document.getElementById('motion-project-file-input')?.click()} title="Import SVG, PNG, JPEG, or WebP" aria-label="Import project asset" className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <FilePlus2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <input
        id="motion-project-file-input"
        type="file"
        accept=".svg,image/svg+xml,image/png,image/jpeg,image/webp"
        className="hidden"
        aria-label="Import SVG or raster image"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) onOpenFile(file);
          event.currentTarget.value = '';
        }}
      />
      <div className="border-b border-[var(--card-border)] p-2">
        <label className="flex h-7 items-center gap-2 rounded-md border border-[var(--card-border)] bg-[var(--input-bg)] px-2 text-[var(--text-muted)] focus-within:border-primary/60">
          <Search className="h-3.5 w-3.5 shrink-0" />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search project" aria-label="Search project items" className="min-w-0 flex-1 appearance-none rounded-none border-0 bg-transparent p-0 text-[10px] text-foreground shadow-none outline-none ring-0 placeholder:text-[var(--text-muted)] focus:border-0 focus:outline-none focus:ring-0" />
        </label>
      </div>
      <div className="grid h-7 shrink-0 grid-cols-[minmax(0,1fr)_84px_64px] items-center gap-1 overflow-hidden border-b border-[var(--card-border)] px-2 text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        {(['name', 'type', 'size'] as const).map((key) => (
          <button key={key} type="button" onClick={() => toggleSort(key)} aria-label={`Sort by ${key}`} aria-pressed={sort.key === key} className={`text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${key === 'size' ? 'text-right' : ''}`}>
            {key === 'name' ? 'Name' : key === 'type' ? 'Type' : 'Size'}{sort.key === key ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {rows.length === 0 ? (
          <div className="p-4 text-center text-[10px] leading-relaxed text-[var(--text-muted)]">
            {items.length ? 'No matching project items.' : (
              <>
                <p>Import an SVG or image to get started.</p>
                <button type="button" onClick={() => document.getElementById('motion-project-file-input')?.click()} className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 font-semibold text-[#071b17] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <FilePlus2 className="h-3.5 w-3.5" /> Import
                </button>
              </>
            )}
          </div>
        ) : rows.map(({ item, depth }) => {
          if (isHiddenByCollapsedParent(item)) return null;
          return (
            <div key={item.id} className={dragOverId === item.id ? 'bg-primary/15' : ''}>
              <ItemRow
                item={item}
                depth={depth}
                selected={selectedItem?.id === item.id}
                expanded={expandedFolders[item.id] !== false || Boolean(query.trim())}
                hasChildren={children.has(item.id)}
                editing={editingId === item.id}
                editName={editName}
                onEditNameChange={setEditName}
                onCommitRename={() => commitRename(item)}
                onCancelRename={() => setEditingId(null)}
                onSelect={() => {
                  setSelectedItemId(item.id);
                  const linkedLayerId = item.layerId ?? item.layerIds?.[0];
                  if (linkedLayerId) onSelectLayer(linkedLayerId);
                }}
                onDoubleClick={() => {
                  if (item.type === 'composition') onOpenComposition(item);
                  else startRename(item);
                }}
                onToggleFolder={() => setExpandedFolders((current) => ({ ...current, [item.id]: current[item.id] === false }))}
                onDelete={() => onDeleteItem(item)}
                onDragStart={(event) => {
                  event.dataTransfer.setData('application/x-mcu-project-item', item.id);
                  event.dataTransfer.effectAllowed = 'copy';
                }}
                onDragOver={(event) => {
                  if (item.type === 'folder' && event.dataTransfer.types.includes('application/x-mcu-project-item')) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                    setDragOverId(item.id);
                  } else if (event.dataTransfer.files.length) {
                    event.preventDefault();
                  }
                }}
                onDrop={(event) => {
                  setDragOverId(null);
                  if (!handleDropFile(event, item.type === 'folder' ? item.id : undefined)) {
                    const itemId = event.dataTransfer.getData('application/x-mcu-project-item');
                    if (item.type === 'folder' && itemId && itemId !== item.id) onMoveItem(itemId, item.id);
                  }
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="shrink-0 border-t border-[var(--card-border)] p-2.5">
        <div className="mb-2 text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Details</div>
        {selectedItem ? (
          <div className="flex min-h-12 items-center gap-2">
            {selectedImage ? (
              <img src={selectedImage} alt={`${selectedItem.name} preview`} className="h-12 w-12 shrink-0 rounded border border-[var(--card-border)] object-contain" />
            ) : selectedSvg ? (
              <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(selectedSvg)}`} alt={`${selectedItem.name} preview`} className="h-12 w-12 shrink-0 rounded border border-[var(--card-border)] object-contain" />
            ) : selectedComposition ? (
              <Video className="h-8 w-8 shrink-0 text-cyan-500" />
            ) : (
              <ImageIcon className="h-8 w-8 shrink-0 text-[var(--text-muted)]" />
            )}
            <div className="min-w-0 text-[9px] leading-relaxed text-[var(--text-secondary)]">
              <div className="truncate font-semibold text-foreground">{selectedItem.name}</div>
              {selectedItem.width && selectedItem.height && <div>{selectedItem.width} × {selectedItem.height}</div>}
              {selectedComposition && <div>{project.document.fps} fps · {project.document.duration.toFixed(2)}s</div>}
              <div>{formatSize(selectedItem.size)}</div>
            </div>
          </div>
        ) : <div className="text-[9px] text-[var(--text-muted)]">No item selected</div>}
      </div>
    </aside>
  );
};
