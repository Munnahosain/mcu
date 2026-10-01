'use client';

import React, { useState } from 'react';
import {
  X,
  Download,
  FileCode,
  Film,
  Image as ImageIcon,
  FolderArchive,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Server,
  Layers,
} from 'lucide-react';
import { ProjectState } from './types';
import {
  generateAnimatedSvg,
  generateCleanSvg,
  exportPngSequenceZip,
  recordWebmVideo,
  downloadFile,
} from './exportEngine';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectState;
}

type ExportFormat = 'animated-svg' | 'clean-svg' | 'json-project' | 'webm' | 'png-sequence' | 'mp4-gif';

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, project }) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('animated-svg');
  const [fps, setFps] = useState<number>(project.document.fps || 30);
  const [scale, setScale] = useState<number>(1);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ percent: number; text: string } | null>(null);

  if (!isOpen) return null;

  const handleExport = async () => {
    setIsExporting(true);
    setProgress({ percent: 10, text: 'Preparing export pipeline...' });

    const baseName = (project.name || 'mcu_motion')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_');

    try {
      if (selectedFormat === 'animated-svg') {
        setProgress({ percent: 60, text: 'Compiling CSS @keyframes and packaging SVG...' });
        const animatedSvg = generateAnimatedSvg(project);
        downloadFile(animatedSvg, `${baseName}_animated.svg`, 'image/svg+xml');
        setProgress({ percent: 100, text: 'Download ready!' });
      } else if (selectedFormat === 'clean-svg') {
        setProgress({ percent: 60, text: 'Sanitizing and cleaning vector code...' });
        const cleanSvg = generateCleanSvg(project.svgRaw);
        downloadFile(cleanSvg, `${baseName}_clean.svg`, 'image/svg+xml');
        setProgress({ percent: 100, text: 'Download ready!' });
      } else if (selectedFormat === 'json-project') {
        setProgress({ percent: 70, text: 'Serializing project state...' });
        const jsonContent = JSON.stringify(
          {
            version: '1.0',
            name: project.name,
            document: project.document,
            svgRaw: project.svgRaw,
            elements: project.elements,
            tracks: project.tracks,
            characterSlots: project.characterSlots,
            isSingleFlattenedPath: project.isSingleFlattenedPath,
            exportedAt: new Date().toISOString(),
          },
          null,
          2
        );
        downloadFile(jsonContent, `${baseName}.mcuproj`, 'application/json');
        setProgress({ percent: 100, text: 'Project saved!' });
      } else if (selectedFormat === 'webm') {
        setProgress({ percent: 20, text: 'Capturing canvas animation stream...' });
        const webmBlob = await recordWebmVideo(project, fps, scale, (pct) => {
          setProgress({ percent: pct, text: `Rendering frames to WebM (${pct}%)...` });
        });
        downloadFile(webmBlob, `${baseName}.webm`, 'video/webm');
        setProgress({ percent: 100, text: 'Video exported!' });
      } else if (selectedFormat === 'png-sequence') {
        setProgress({ percent: 15, text: 'Rendering high-resolution PNG frames...' });
        const zipBlob = await exportPngSequenceZip(
          project,
          fps,
          scale,
          (pct, curr, total) => {
            setProgress({
              percent: pct,
              text: `Rendering frame ${curr} of ${total} (${pct}%)...`,
            });
          }
        );
        downloadFile(zipBlob, `${baseName}_frames.zip`, 'application/zip');
        setProgress({ percent: 100, text: 'Sequence exported!' });
      }

      setTimeout(() => {
        setIsExporting(false);
        setProgress(null);
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Export error:', err);
      setProgress({ percent: 0, text: 'Export error occurred. Please check console.' });
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md select-none">
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-foreground">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--card-border)] flex items-center justify-between bg-[var(--card-bg)]">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shadow-sm">
              <Download className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground tracking-wide">Export Animation</h2>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Choose from standalone vector animations, video, or frame sequences.
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
        <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-5">
          {/* Format Selection Cards */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Select Output Format
            </span>

            <div className="grid grid-cols-2 gap-2.5">
              {/* 1. Animated SVG */}
              <button
                type="button"
                onClick={() => setSelectedFormat('animated-svg')}
                className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between h-24 ${
                  selectedFormat === 'animated-svg'
                    ? 'bg-primary/15 border-primary text-foreground shadow-md shadow-primary/20'
                    : 'bg-[var(--input-bg)] border-[var(--card-border)] text-[var(--text-secondary)] hover:border-primary/40'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <FileCode className="h-4 w-4 text-primary" />
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">
                    Recommended
                  </span>
                </div>
                <div>
                  <span className="text-xs font-bold block text-foreground">Animated SVG</span>
                  <span className="text-[10px] text-[var(--text-muted)] leading-tight">
                    CSS @keyframes, plays anywhere without JS
                  </span>
                </div>
              </button>

              {/* 2. WebM Video */}
              <button
                type="button"
                onClick={() => setSelectedFormat('webm')}
                className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between h-24 ${
                  selectedFormat === 'webm'
                    ? 'bg-primary/15 border-primary text-foreground shadow-md shadow-primary/20'
                    : 'bg-[var(--input-bg)] border-[var(--card-border)] text-[var(--text-secondary)] hover:border-primary/40'
                }`}
              >
                <Film className="h-4 w-4 text-primary" />
                <div>
                  <span className="text-xs font-bold block text-foreground">WebM Video</span>
                  <span className="text-[10px] text-[var(--text-muted)] leading-tight">
                    High quality VP9 canvas video recording
                  </span>
                </div>
              </button>

              {/* 3. PNG Sequence */}
              <button
                type="button"
                onClick={() => setSelectedFormat('png-sequence')}
                className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between h-24 ${
                  selectedFormat === 'png-sequence'
                    ? 'bg-primary/15 border-primary text-foreground shadow-md shadow-primary/20'
                    : 'bg-[var(--input-bg)] border-[var(--card-border)] text-[var(--text-secondary)] hover:border-primary/40'
                }`}
              >
                <FolderArchive className="h-4 w-4 text-amber-500" />
                <div>
                  <span className="text-xs font-bold block text-foreground">PNG Sequence</span>
                  <span className="text-[10px] text-[var(--text-muted)] leading-tight">
                    ZIP archive of sequential frames for AE / Premiere
                  </span>
                </div>
              </button>

              {/* 4. JSON Project */}
              <button
                type="button"
                onClick={() => setSelectedFormat('json-project')}
                className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between h-24 ${
                  selectedFormat === 'json-project'
                    ? 'bg-primary/15 border-primary text-foreground shadow-md shadow-primary/20'
                    : 'bg-[var(--input-bg)] border-[var(--card-border)] text-[var(--text-secondary)] hover:border-primary/40'
                }`}
              >
                <Layers className="h-4 w-4 text-primary" />
                <div>
                  <span className="text-xs font-bold block text-foreground">JSON Project</span>
                  <span className="text-[10px] text-[var(--text-muted)] leading-tight">
                    .mcuproj file with complete keyframe data
                  </span>
                </div>
              </button>

              {/* 5. Clean Static SVG */}
              <button
                type="button"
                onClick={() => setSelectedFormat('clean-svg')}
                className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between h-24 ${
                  selectedFormat === 'clean-svg'
                    ? 'bg-primary/15 border-primary text-foreground shadow-md shadow-primary/20'
                    : 'bg-[var(--input-bg)] border-[var(--card-border)] text-[var(--text-secondary)] hover:border-primary/40'
                }`}
              >
                <FileCode className="h-4 w-4 text-[var(--text-muted)]" />
                <div>
                  <span className="text-xs font-bold block text-foreground">Clean Static SVG</span>
                  <span className="text-[10px] text-[var(--text-muted)] leading-tight">
                    Sanitized vector SVG without editor tags
                  </span>
                </div>
              </button>

              {/* 6. MP4 & GIF Info */}
              <button
                type="button"
                onClick={() => setSelectedFormat('mp4-gif')}
                className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between h-24 ${
                  selectedFormat === 'mp4-gif'
                    ? 'bg-primary/15 border-primary text-foreground shadow-md shadow-primary/20'
                    : 'bg-[var(--input-bg)] border-[var(--card-border)] text-[var(--text-secondary)] hover:border-primary/40'
                }`}
              >
                <Server className="h-4 w-4 text-pink-500" />
                <div>
                  <span className="text-xs font-bold block text-foreground">MP4 &amp; GIF</span>
                  <span className="text-[10px] text-[var(--text-muted)] leading-tight">Server rendering pipeline details</span>
                </div>
              </button>
            </div>
          </div>

          {/* Conditional Controls for Video/Sequence */}
          {(selectedFormat === 'webm' || selectedFormat === 'png-sequence') && (
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-[var(--input-bg)] border border-[var(--card-border)]">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Resolution Scale</span>
                <select
                  value={scale}
                  onChange={(e) => setScale(Number(e.target.value))}
                  className="w-full bg-[var(--card-bg)] text-foreground text-xs px-2.5 py-1.5 rounded-xl border border-[var(--input-border)] outline-none font-semibold focus:border-primary"
                >
                  <option value={1}>1x Original ({project.document.viewBox.width}×{project.document.viewBox.height})</option>
                  <option value={2}>2x HD Retina ({project.document.viewBox.width * 2}×{project.document.viewBox.height * 2})</option>
                  <option value={3}>3x Ultra HD 4K</option>
                </select>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Framerate</span>
                <select
                  value={fps}
                  onChange={(e) => setFps(Number(e.target.value))}
                  className="w-full bg-[var(--card-bg)] text-foreground text-xs px-2.5 py-1.5 rounded-xl border border-[var(--input-border)] outline-none font-semibold focus:border-primary"
                >
                  <option value={24}>24 FPS</option>
                  <option value={30}>30 FPS</option>
                  <option value={60}>60 FPS (Ultra Smooth)</option>
                </select>
              </div>
            </div>
          )}

          {/* MP4 & GIF Server Rendering Notice */}
          {selectedFormat === 'mp4-gif' && (
            <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 text-foreground text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-primary">
                <Server className="h-4 w-4" />
                <span>Server-Side H.264 MP4 &amp; GIF Pipeline</span>
              </div>
              <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
                Client-side rendering cannot reliably encode proprietary H.264 MP4 and paletted GIF
                without heavy external binaries.
              </p>
              <div className="bg-[var(--card-bg)] p-3 rounded-xl border border-[var(--card-border)] text-[10px] space-y-1 text-[var(--text-secondary)]">
                <p>
                  <strong className="text-foreground">Ready Immediately:</strong> Export as <strong>WebM</strong> (plays in all
                  browsers, Canva, Figma) or download the <strong>PNG Sequence</strong>.
                </p>
                <p className="text-[var(--text-muted)]">
                  Cloud FFmpeg pipeline is configured to transcode PNG sequences to compressed H.264
                  MP4 and looping GIF automatically.
                </p>
              </div>
            </div>
          )}

          {/* Progress Bar */}
          {progress && (
            <div className="space-y-1.5 p-3.5 rounded-2xl bg-[var(--input-bg)] border border-primary/30">
              <div className="flex items-center justify-between text-xs">
                <span className="text-foreground font-semibold">{progress.text}</span>
                <span className="font-mono text-primary font-bold">{progress.percent}%</span>
              </div>
              <div className="h-2 w-full bg-[var(--card-bg)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-[#27e39a] transition-all duration-150"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[var(--card-border)] bg-[var(--card-bg)] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl text-[var(--text-muted)] hover:text-foreground text-xs font-semibold"
          >
            Cancel
          </button>

          {selectedFormat !== 'mp4-gif' ? (
            <button
              type="button"
              disabled={isExporting}
              onClick={handleExport}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-40 text-[#071b17] font-extrabold text-xs shadow-md shadow-primary/25 transition-all"
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" />
                  <span>Download File</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSelectedFormat('webm')}
              className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-[#071b17] font-extrabold text-xs"
            >
              Switch to WebM Video
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
