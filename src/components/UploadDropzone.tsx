import React, { useState, useRef } from 'react';
import { Upload, FileCode, CheckCircle2, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { SAMPLE_EPS_SETS, SampleSet } from '../services/sampleEpsSets';

interface UploadDropzoneProps {
  onFileSelected: (file: File) => void;
  onSampleSelected: (sample: SampleSet) => void;
  isProcessing: boolean;
  processingStep: string;
  processingPercent: number;
  error: string | null;
  onClearError: () => void;
  onOpenManualSplit?: () => void;
}

export const UploadDropzone: React.FC<UploadDropzoneProps> = ({
  onFileSelected,
  onSampleSelected,
  isProcessing,
  processingStep,
  processingPercent,
  error,
  onClearError,
  onOpenManualSplit,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      validateAndProcess(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      validateAndProcess(file);
    }
  };

  const validateAndProcess = (file: File) => {
    onClearError();
    const nameLower = file.name.toLowerCase();
    if (
      !nameLower.endsWith('.eps') &&
      !nameLower.endsWith('.epsf') &&
      !nameLower.endsWith('.ps') &&
      !nameLower.endsWith('.svg')
    ) {
      // Still allow if MIME contains postscript or svg or user insists
      if (file.type && !file.type.includes('postscript') && !file.type.includes('eps') && !file.type.includes('svg')) {
        // Continue and attempt to parse
      }
    }
    onFileSelected(file);
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8">
      {/* Main Drag-and-Drop Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={`relative w-full rounded-3xl border-2 border-dashed transition-all duration-200 cursor-pointer overflow-hidden p-8 sm:p-14 text-center flex flex-col items-center justify-center ${
          isDragOver
            ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 scale-[1.008]'
            : 'border-slate-300 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".eps,.epsf,.ps,.svg,application/postscript,image/svg+xml"
          onChange={handleFileInputChange}
          className="hidden"
        />

        {isProcessing ? (
          <div className="w-full max-w-md flex flex-col items-center py-6">
            <div className="relative w-16 h-16 mb-6">
              <div className="absolute inset-0 rounded-2xl bg-indigo-500/20 animate-ping"></div>
              <div className="relative w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            </div>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              {processingStep || 'Processing Vector Artwork...'}
            </h3>

            {/* Realistic Progress Bar */}
            <div className="w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden mt-3 mb-2">
              <div
                className="bg-gradient-to-r from-indigo-500 to-violet-500 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${Math.max(5, Math.min(100, processingPercent))}%` }}
              ></div>
            </div>

            <div className="flex justify-between w-full text-xs text-slate-500 dark:text-slate-400 px-1">
              <span>PostScript & Bézier Vector Engine</span>
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                {processingPercent}%
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
              <Upload className="w-8 h-8 stroke-[2.2]" />
            </div>

            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Drop your EPS or SVG vector sheet here
            </h3>

            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 mb-6">
              or click to browse files from your computer
            </p>

            <button
              type="button"
              className="px-5 py-2.5 rounded-xl font-medium text-sm text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20 flex items-center gap-2 pointer-events-none"
            >
              <FileCode className="w-4 h-4" />
              <span>Choose Vector File</span>
            </button>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-400 dark:text-slate-500">
              <span className="font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                EPS (LanguageLevel 2 / 3)
              </span>
              <span className="font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                SVG Vector Sheet
              </span>
              <span>• Adobe Illustrator, CorelDraw, Inkscape</span>
            </div>
          </div>
        )}
      </div>

      {/* Error Alert Card */}
      {error && (
        <div className="mt-6 p-5 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 text-red-900 dark:text-red-200 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm">Unable to extract vector icons</h4>
                <p className="text-xs text-red-700 dark:text-red-300 mt-1 leading-relaxed">{error}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors shadow-sm"
              >
                Upload Another File
              </button>
            </div>
          </div>

          {/* Quick Solution Card */}
          <div className="mt-2 p-4 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-red-200 dark:border-red-900/50 text-slate-800 dark:text-slate-200 text-xs">
            <div className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-1.5">
              <span>💡 সমাধান (How to solve in Adobe Illustrator):</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
                <div className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                  <span>✅ পদ্ধতি ১: সরাসরি SVG Export (সেরা ও সহজ)</span>
                </div>
                <p className="text-emerald-700 dark:text-emerald-400 mt-1 leading-relaxed">
                  Illustrator এ ফাইলটি খুলে <strong>File &gt; Export &gt; Export As</strong> এ গিয়ে Format হিসেবে <strong>SVG (.svg)</strong> নির্বাচন করুন। সেই SVG ফাইলটি এখানে ড্রপ করুন, ১০০% কাজ করবে!
                </p>
              </div>

              <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60">
                <div className="font-semibold text-indigo-800 dark:text-indigo-300 flex items-center gap-1">
                  <span>⚙️ পদ্ধতি ২: EPS হিসেবে সেভ করতে চাইলে</span>
                </div>
                <p className="text-indigo-700 dark:text-indigo-400 mt-1 leading-relaxed">
                  Illustrator এ <strong>File &gt; Save As &gt; EPS</strong> নির্বাচন করার পর পপ-আপ বক্সে <strong>PostScript: LanguageLevel 2 বা 3</strong> নির্বাচন করুন।
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Instant Demo EPS Samples */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Or load a demo EPS icon set
            </h4>
          </div>
          <span className="text-[11px] text-slate-400">Pure PostScript vector sets</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {SAMPLE_EPS_SETS.map((sample) => (
            <button
              key={sample.id}
              onClick={(e) => {
                e.stopPropagation();
                onSampleSelected(sample);
              }}
              disabled={isProcessing}
              className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 text-left transition-all hover:shadow-sm group disabled:opacity-50 cursor-pointer"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {sample.name}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                  {sample.iconCount} icons
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                {sample.description}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
