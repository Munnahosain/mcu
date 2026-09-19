import React, { useState } from 'react';
import {
  Check,
  Download,
  Edit2,
  Maximize2,
  Trash2,
  MoreVertical,
  Box,
} from 'lucide-react';
import { ExtractedIcon } from '../types';

interface IconCardProps {
  icon: ExtractedIcon;
  onToggleSelect: (id: string) => void;
  onPreview: (icon: ExtractedIcon) => void;
  onDownload: (icon: ExtractedIcon) => void;
  onRename: (id: string, newName: string) => void;
  onRemove: (id: string) => void;
  onOpenIn3D?: (icon: ExtractedIcon) => void;
}

export const IconCard: React.FC<IconCardProps> = ({
  icon,
  onToggleSelect,
  onPreview,
  onDownload,
  onRename,
  onRemove,
  onOpenIn3D,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [nameValue, setNameValue] = useState(icon.name);
  const [showMenu, setShowMenu] = useState(false);

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nameValue.trim()) {
      onRename(icon.id, nameValue.trim());
    }
    setIsEditing(false);
  };

  return (
    <div
      className={`group relative rounded-2xl bg-white dark:bg-slate-900 border transition-all duration-200 flex flex-col overflow-hidden shadow-xs hover:shadow-md ${
        icon.selected
          ? 'border-indigo-500 ring-2 ring-indigo-500/20 dark:ring-indigo-500/30'
          : 'border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
      }`}
    >
      {/* Top Header: Checkbox, Index & More Menu */}
      <div className="p-3 pb-0 flex items-center justify-between z-10">
        <button
          onClick={() => onToggleSelect(icon.id)}
          className="flex items-center gap-1.5 focus:outline-none cursor-pointer"
          title={icon.selected ? 'Deselect' : 'Select'}
        >
          <div
            className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
              icon.selected
                ? 'bg-indigo-600 text-white'
                : 'border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-transparent hover:border-indigo-400'
            }`}
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          </div>
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 font-mono">
            #{icon.index.toString().padStart(2, '0')}
          </span>
        </button>

        {/* More Actions Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="More actions"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 w-36 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg py-1 z-30 text-xs">
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onPreview(icon);
                  }}
                  className="w-full px-3 py-1.5 text-left text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Preview</span>
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    setIsEditing(true);
                  }}
                  className="w-full px-3 py-1.5 text-left text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Rename</span>
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onDownload(icon);
                  }}
                  className="w-full px-3 py-1.5 text-left text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
                <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onRemove(icon.id);
                  }}
                  className="w-full px-3 py-1.5 text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Large Checkerboard Vector Preview */}
      <div
        onClick={() => onPreview(icon)}
        className="relative mx-3 my-2 h-44 rounded-xl checkerboard-pattern flex items-center justify-center p-5 cursor-pointer overflow-hidden border border-slate-200/50 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-950/40 group/preview"
      >
        <div
          className="w-full h-full flex items-center justify-center text-slate-800 dark:text-slate-100 transition-transform duration-200 group-hover/preview:scale-110 drop-shadow-xs"
          dangerouslySetInnerHTML={{ __html: icon.svgContent }}
        />

        {/* Hover overlay hint */}
        <div className="absolute inset-0 bg-indigo-900/10 dark:bg-indigo-900/20 opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center justify-center">
          <span className="px-2 py-1 rounded-md text-[11px] font-medium bg-white/90 dark:bg-slate-900/90 text-slate-900 dark:text-white shadow-xs flex items-center gap-1">
            <Maximize2 className="w-3 h-3" />
            Inspect
          </span>
        </div>
      </div>

      {/* Card Body: Name, Dimensions, & Format Badges */}
      <div className="p-3 pt-1 flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          {isEditing ? (
            <form onSubmit={handleNameSubmit} className="flex-1">
              <input
                type="text"
                autoFocus
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={handleNameSubmit}
                className="w-full px-1.5 py-0.5 text-xs font-bold text-slate-900 dark:text-white bg-indigo-50 dark:bg-indigo-950/60 rounded border border-indigo-300 dark:border-indigo-700 outline-none"
              />
            </form>
          ) : (
            <div
              onDoubleClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 group/name cursor-pointer flex-1 min-w-0"
              title="Double click to rename"
            >
              <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {icon.name}
              </h4>
              <Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover/name:opacity-100 transition-opacity shrink-0" />
            </div>
          )}
        </div>

        {/* Dimension & Format Badges */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
          <span className="font-mono">{icon.width} × {icon.height}</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700/80">
            Vector
          </span>
        </div>

        {/* Quick actions row */}
        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-1">
          <button
            onClick={() => onPreview(icon)}
            className="flex-1 py-1 px-1.5 rounded-lg text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white flex items-center justify-center gap-1 transition-colors"
          >
            <Maximize2 className="w-3 h-3" />
            <span>Preview</span>
          </button>
          <button
            onClick={() => onDownload(icon)}
            className="flex-1 py-1 px-1.5 rounded-lg text-[11px] font-medium text-primary hover:bg-primary/10 flex items-center justify-center gap-1 transition-colors"
          >
            <Download className="w-3 h-3" />
            <span>Download</span>
          </button>
          {onOpenIn3D && (
            <button
              type="button"
              onClick={() => onOpenIn3D(icon)}
              className="flex-1 py-1 px-1.5 rounded-lg text-[11px] font-bold text-white bg-red-600 hover:bg-red-500 flex items-center justify-center gap-1 transition-colors"
              title="Open this icon in 3D Studio"
            >
              <Box className="w-3 h-3" />
              <span>3D View</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
