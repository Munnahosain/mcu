import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  CheckSquare,
  Square,
  Download,
  RotateCcw,
  Scissors,
  ArrowUpDown,
  Grid,
  ChevronDown,
  Sparkles,
} from 'lucide-react';

interface WorkspaceToolbarProps {
  totalCount: number;
  selectedCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onExportSelected: () => void;
  onExportAll: () => void;
  onReprocess: () => void;
  onManualSplit: () => void;
  onGridSplit?: (cols: number, rows: number) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterMode: 'all' | 'selected' | 'unselected';
  onFilterModeChange: (mode: 'all' | 'selected' | 'unselected') => void;
  sortBy: 'order' | 'name' | 'size' | 'paths';
  onSortByChange: (sort: 'order' | 'name' | 'size' | 'paths') => void;
}

export const WorkspaceToolbar: React.FC<WorkspaceToolbarProps> = ({
  totalCount,
  selectedCount,
  onSelectAll,
  onDeselectAll,
  onExportSelected,
  onExportAll,
  onReprocess,
  onManualSplit,
  onGridSplit,
  searchQuery,
  onSearchChange,
  filterMode,
  onFilterModeChange,
  sortBy,
  onSortByChange,
}) => {
  const [isGridMenuOpen, setIsGridMenuOpen] = useState(false);
  const [customCols, setCustomCols] = useState(10);
  const [customRows, setCustomRows] = useState(10);
  const gridMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (gridMenuRef.current && !gridMenuRef.current.contains(e.target as Node)) {
        setIsGridMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleApplyPreset = (cols: number, rows: number) => {
    onGridSplit?.(cols, rows);
    setIsGridMenuOpen(false);
  };

  return (
    <div className="w-full border-b border-slate-200 bg-white shadow-xs transition-colors dark:border-slate-800 dark:bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col gap-3">
        {/* Top Line: Stats and Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Status badge */}
          <div className="flex items-center gap-3">
            <div className="flex items-baseline gap-2">
              <span className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {totalCount} Icons Detected
              </span>
                <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                {selectedCount} of {totalCount} selected
              </span>
            </div>
          </div>

          {/* Quick Selection and Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onSelectAll}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Shortcut: Ctrl+A or Cmd+A"
            >
              <CheckSquare className="w-3.5 h-3.5 text-primary" />
              <span>Select All</span>
            </button>

            <button
              onClick={onDeselectAll}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Shortcut: Ctrl+D"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Deselect</span>
            </button>

            {/* Grid Split Menu */}
            {onGridSplit && (
              <div className="relative" ref={gridMenuRef}>
                <button
                  onClick={() => setIsGridMenuOpen(!isGridMenuOpen)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 border border-primary/25 flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Split regular sheet rows & columns"
                >
                  <Grid className="w-3.5 h-3.5 text-primary" />
                  <span>Grid Split</span>
                  <ChevronDown className="w-3 h-3 text-primary/70" />
                </button>

                {isGridMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-3 z-50 animate-in fade-in zoom-in-95">
                    <div className="text-xs font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                      <span>Regular Grid Presets</span>
                    </div>

                    <div className="space-y-1">
                      <button
                        onClick={() => handleApplyPreset(10, 10)}
                        className="w-full text-left px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 rounded-lg flex items-center justify-between transition-colors cursor-pointer border border-primary/20 bg-primary/[0.04]"
                      >
                        <span>10 × 10 Grid (100 Icons)</span>
                        <span className="text-[10px] bg-primary text-[#071b17] px-1.5 py-0.2 rounded-full">Recommended</span>
                      </button>

                      <button
                        onClick={() => handleApplyPreset(8, 8)}
                        className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <span>8 × 8 Grid (64 Icons)</span>
                      </button>

                      <button
                        onClick={() => handleApplyPreset(6, 6)}
                        className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <span>6 × 6 Grid (36 Icons)</span>
                      </button>

                      <button
                        onClick={() => handleApplyPreset(5, 5)}
                        className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <span>5 × 5 Grid (25 Icons)</span>
                      </button>

                      <button
                        onClick={() => handleApplyPreset(4, 4)}
                        className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <span>4 × 4 Grid (16 Icons)</span>
                      </button>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                      <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5">Custom Cols × Rows</div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="1"
                          max="30"
                          value={customCols}
                          onChange={(e) => setCustomCols(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-14 px-2 py-1 text-xs text-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-white"
                          title="Columns"
                        />
                        <span className="text-xs text-slate-400">×</span>
                        <input
                          type="number"
                          min="1"
                          max="30"
                          value={customRows}
                          onChange={(e) => setCustomRows(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-14 px-2 py-1 text-xs text-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-white"
                          title="Rows"
                        />
                        <button
                          onClick={() => handleApplyPreset(customCols, customRows)}
                          className="flex-1 px-2.5 py-1 text-xs font-semibold text-[#071b17] bg-primary hover:bg-primary-hover rounded-md transition-colors cursor-pointer"
                        >
                          Split
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={onManualSplit}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Manually adjust or draw split regions"
            >
              <Scissors className="w-3.5 h-3.5 text-primary" />
              <span>Manual Split</span>
            </button>

            <button
              onClick={onReprocess}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Re-analyze EPS vector structure"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Reprocess</span>
            </button>

            {/* Export buttons */}
            <button
              onClick={onExportSelected}
              disabled={selectedCount === 0}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#071b17] bg-primary hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              title="Shortcut: Ctrl+E"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Selected ({selectedCount})</span>
            </button>

            <button
              onClick={onExportAll}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/25 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Export All ({totalCount})</span>
            </button>
          </div>
        </div>

        {/* Bottom Line: Search, Filter Tabs, and Sorting */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-800/60">
          {/* Search bar */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search icons..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-8.5 pr-3 py-1.5 rounded-lg text-xs bg-[var(--input-bg)] border border-transparent focus:border-primary focus:outline-none text-foreground transition-all"
            />
          </div>

          {/* Filter pills & Sort selector */}
          <div className="flex items-center justify-between sm:justify-end gap-3">
            {/* Filter Pills */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
              <button
                onClick={() => onFilterModeChange('all')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  filterMode === 'all'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                All
              </button>
              <button
                onClick={() => onFilterModeChange('selected')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  filterMode === 'selected'
                    ? 'bg-[var(--card-bg)] text-primary shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Selected
              </button>
              <button
                onClick={() => onFilterModeChange('unselected')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  filterMode === 'unselected'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Unselected
              </button>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <ArrowUpDown className="w-3.5 h-3.5" />
              <select
                value={sortBy}
                onChange={(e) => onSortByChange(e.target.value as 'order' | 'name' | 'size' | 'paths')}
                className="bg-[var(--input-bg)] border border-[var(--card-border)] rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary"
              >
                <option value="order">Original Order</option>
                <option value="name">Name</option>
                <option value="size">Dimensions</option>
                <option value="paths">Path Count</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
