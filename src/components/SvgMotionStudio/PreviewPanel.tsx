'use client';

import React, { useEffect, useRef } from 'react';
import {
  AudioLines,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Info,
  Pause,
  Play,
  Repeat,
} from 'lucide-react';
import { ProjectState } from './types';
import { findElementById } from './svgParser';
import { computeElementStylesAtTime } from './animationEngine';

export type PreviewQuality = 'Auto' | 'Full' | 'Half' | 'Third' | 'Quarter';
export type PreviewTab = 'info' | 'audio';

interface PreviewPanelProps {
  project: ProjectState;
  tab: PreviewTab;
  quality: PreviewQuality;
  playbackTimeRef: React.RefObject<number>;
  renderedProgressRef: React.RefObject<number>;
  onTabChange: (tab: PreviewTab) => void;
  onQualityChange: (quality: PreviewQuality) => void;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onToggleLoop: () => void;
  onUpdateWorkArea: (start: number, end: number) => void;
  embedded?: boolean;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

function formatTimecode(time: number, fps: number) {
  const safeFrameRate = Math.max(1, Math.round(fps));
  const totalFrames = Math.max(0, Math.round(time * safeFrameRate));
  const frames = totalFrames % safeFrameRate;
  const totalSeconds = Math.floor(totalFrames / safeFrameRate);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
}

function parseTimecode(value: string, fps: number): number | null {
  const match = /^(\d+):([0-5]\d):([0-5]\d):(\d+)$/.exec(value.trim());
  if (!match) return null;
  const frames = Number(match[4]);
  if (frames >= Math.max(1, Math.round(fps))) return null;
  return ((Number(match[1]) * 60 + Number(match[2])) * 60 + Number(match[3])) + frames / fps;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({
  project,
  tab,
  quality,
  playbackTimeRef,
  renderedProgressRef,
  onTabChange,
  onQualityChange,
  onTogglePlay,
  onSeek,
  onToggleLoop,
  onUpdateWorkArea,
  embedded = false,
}) => {
  const timeReadoutRef = useRef<HTMLSpanElement>(null);
  const frameReadoutRef = useRef<HTMLSpanElement>(null);
  const frameBarRef = useRef<HTMLDivElement>(null);
  const renderedBarRef = useRef<HTMLDivElement>(null);
  const renderedProgressBarRef = useRef<HTMLDivElement>(null);
  const frameProgressRef = useRef<HTMLDivElement>(null);
  const renderedPercentRef = useRef<HTMLSpanElement>(null);
  const { duration, fps, loop } = project.document;
  const safeDuration = Number.isFinite(duration) ? Math.max(0, duration) : 0;
  const safeFps = Number.isFinite(fps) ? Math.max(1, fps) : 1;
  const workArea = project.workArea ?? { start: 0, end: safeDuration };
  const rangeStart = clamp(workArea.start, 0, safeDuration);
  const rangeEnd = clamp(workArea.end, rangeStart, safeDuration);
  const [rangeStartText, setRangeStartText] = React.useState(() => formatTimecode(rangeStart, safeFps));
  const [rangeEndText, setRangeEndText] = React.useState(() => formatTimecode(rangeEnd, safeFps));
  const frameStep = 1 / safeFps;
  const selected = project.selectedElementId ? findElementById(project.elements, project.selectedElementId) : null;
  const selectedStyles = selected
    ? computeElementStylesAtTime(
      project.tracks,
      selected.id,
      project.currentTime,
      selected.initialTransform,
      selected.initialAppearance
    )
    : null;
  const frameProgress = safeDuration > 0
    ? clamp(project.currentTime / safeDuration * 100, 0, 100)
    : 0;
  const rangeLength = rangeEnd - rangeStart;
  const totalFrames = Math.max(0, Math.ceil(safeDuration * safeFps));

  useEffect(() => {
    let frameId = 0;
    const updateReadouts = () => {
      const time = clamp(project.isPlaying ? playbackTimeRef.current : project.currentTime, 0, safeDuration);
      if (timeReadoutRef.current) timeReadoutRef.current.textContent = `${time.toFixed(2)}s / ${safeDuration.toFixed(2)}s`;
      if (frameReadoutRef.current) {
        frameReadoutRef.current.textContent = `${Math.min(totalFrames, Math.round(time * safeFps))} / ${totalFrames} frames`;
      }
      if (frameBarRef.current) {
        frameBarRef.current.style.width = `${safeDuration > 0 ? clamp(time / safeDuration * 100, 0, 100) : 0}%`;
      }
      if (frameProgressRef.current) {
        frameProgressRef.current.setAttribute('aria-valuenow', String(Math.round(safeDuration > 0 ? clamp(time / safeDuration * 100, 0, 100) : 0)));
      }
      if (renderedBarRef.current) {
        renderedBarRef.current.style.width = `${clamp(renderedProgressRef.current * 100, 0, 100)}%`;
      }
      if (renderedProgressBarRef.current) {
        renderedProgressBarRef.current.setAttribute('aria-valuenow', String(Math.round(clamp(renderedProgressRef.current * 100, 0, 100))));
      }
      if (renderedPercentRef.current) {
        renderedPercentRef.current.textContent = `${Math.round(clamp(renderedProgressRef.current * 100, 0, 100))}%`;
      }
      if (project.isPlaying) frameId = requestAnimationFrame(updateReadouts);
    };
    updateReadouts();
    return () => cancelAnimationFrame(frameId);
  }, [
    playbackTimeRef,
    project.currentTime,
    project.isPlaying,
    renderedProgressRef,
    safeDuration,
    safeFps,
    totalFrames,
  ]);

  const seekTo = (time: number) => onSeek(clamp(time, 0, safeDuration));
  const setRangeStart = (value: number) => {
    const start = clamp(value, 0, safeDuration);
    onUpdateWorkArea(start, Math.max(start, rangeEnd));
  };
  const setRangeEnd = (value: number) => {
    const end = clamp(value, 0, safeDuration);
    onUpdateWorkArea(Math.min(rangeStart, end), end);
  };

  return (
    <section className={`flex min-h-0 flex-col overflow-hidden bg-[var(--card-bg)] text-foreground ${embedded ? 'h-full flex-1' : 'h-[272px] min-h-[272px] max-h-[272px] shrink-0 border-b border-[var(--card-border)]'}`}>
      {!embedded && (
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-[var(--card-border)] px-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-secondary)]">Preview</span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => seekTo(rangeStart)} aria-label="Go to first frame of work area" title="First frame of work area" className="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <ChevronFirst className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => seekTo(project.currentTime - frameStep)} aria-label="Previous frame" className="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={onTogglePlay} aria-label={project.isPlaying ? 'Pause preview' : 'Play preview'} className="rounded-md bg-primary/15 p-1.5 text-primary hover:bg-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            {project.isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
          <button type="button" onClick={() => seekTo(project.currentTime + frameStep)} aria-label="Next frame" className="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => seekTo(rangeEnd)} aria-label="Go to last frame of work area" title="Last frame of work area" className="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <ChevronLast className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={onToggleLoop} aria-pressed={loop} aria-label="Toggle looping" className={`rounded p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${loop ? 'text-primary' : 'text-[var(--text-muted)] hover:text-foreground'}`}>
            <Repeat className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span ref={timeReadoutRef} className="font-mono text-[10px] font-semibold text-primary">
            {project.currentTime.toFixed(2)}s / {safeDuration.toFixed(2)}s
          </span>
          <label className="flex items-center gap-1.5 text-[9px] text-[var(--text-muted)]">
            Quality
            <select value={quality} onChange={(event) => onQualityChange(event.target.value as PreviewQuality)} aria-label="Preview quality" className="motion-studio-select h-6 rounded border border-[var(--card-border)] bg-[var(--input-bg)] px-1.5 text-[9px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary" style={{ color: 'var(--foreground)', backgroundColor: 'var(--input-bg)' }}>
              {(['Auto', 'Full', 'Half', 'Third', 'Quarter'] as const).map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-1 shrink-0">
          <div className="mb-1 flex items-center justify-between text-[8px] text-[var(--text-muted)]">
            <span>Frame position</span><span ref={frameReadoutRef}>{Math.round(project.currentTime * safeFps)} / {totalFrames} frames</span>
          </div>
          <div ref={frameProgressRef} role="progressbar" aria-label="Current preview frame position" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(frameProgress)} className="h-1 overflow-hidden rounded-full bg-[var(--input-bg)]">
            <div ref={frameBarRef} className="h-full rounded-full bg-primary transition-[width] duration-75" style={{ width: `${frameProgress}%` }} />
          </div>
        </div>
        <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
          <label className="min-w-0 text-[8px] text-[var(--text-muted)]">
            Range start (timecode)
            <input type="text" inputMode="numeric" value={rangeStartText} onChange={(event) => setRangeStartText(event.target.value)} onBlur={() => {
              const time = parseTimecode(rangeStartText, safeFps);
              if (time === null) setRangeStartText(formatTimecode(rangeStart, safeFps));
              else setRangeStart(time);
            }} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} aria-label="Work area start timecode" placeholder="00:00:00:00" className="mt-0.5 h-6 w-full rounded border border-[var(--card-border)] bg-[var(--input-bg)] px-1.5 font-mono text-[9px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary" />
          </label>
          <label className="min-w-0 text-[8px] text-[var(--text-muted)]">
            Range end (timecode)
            <input type="text" inputMode="numeric" value={rangeEndText} onChange={(event) => setRangeEndText(event.target.value)} onBlur={() => {
              const time = parseTimecode(rangeEndText, safeFps);
              if (time === null) setRangeEndText(formatTimecode(rangeEnd, safeFps));
              else setRangeEnd(time);
            }} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} aria-label="Work area end timecode" placeholder="00:00:00:00" className="mt-0.5 h-6 w-full rounded border border-[var(--card-border)] bg-[var(--input-bg)] px-1.5 font-mono text-[9px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary" />
          </label>
          <span className="pb-1 text-[8px] text-[var(--text-muted)]">{safeFps} fps</span>
        </div>
        <div className="mt-1 shrink-0">
          <div className="mb-1 flex items-center justify-between text-[8px] text-[var(--text-muted)]">
            <span title="Highest point in the work area reached during playback this session">Work area rendered this session</span>
            <span ref={renderedPercentRef}>0%</span>
          </div>
          <div ref={renderedProgressBarRef} role="progressbar" aria-label="Work area rendered this session" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0} className="h-1 overflow-hidden rounded-full bg-[var(--input-bg)]">
            <div ref={renderedBarRef} className="h-full rounded-full bg-emerald-500 transition-[width] duration-75" style={{ width: '0%' }} />
          </div>
        </div>
      </div>
      {!embedded && <div className="flex h-7 shrink-0 items-center gap-1 border-t border-[var(--card-border)] px-2">
        <button type="button" onClick={() => onTabChange('info')} aria-pressed={tab === 'info'} className={`flex h-full items-center gap-1.5 border-b-2 px-2 text-[9px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${tab === 'info' ? 'border-primary text-primary' : 'border-transparent text-[var(--text-muted)] hover:text-foreground'}`}>
          <Info className="h-3 w-3" /> Info
        </button>
        <button type="button" onClick={() => onTabChange('audio')} aria-pressed={tab === 'audio'} className={`flex h-full items-center gap-1.5 border-b-2 px-2 text-[9px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${tab === 'audio' ? 'border-primary text-primary' : 'border-transparent text-[var(--text-muted)] hover:text-foreground'}`}>
          <AudioLines className="h-3 w-3" /> Audio
        </button>
      </div>}
      {!embedded && <div className="min-h-0 flex-1 overflow-y-auto px-3 py-1.5 text-[9px] leading-relaxed text-[var(--text-secondary)]">
        {tab === 'audio' ? (
          <div className="flex h-full items-center justify-center text-[var(--text-muted)]">No audio track yet.</div>
        ) : (
          <div className="grid grid-cols-2 gap-x-3">
            <span className="truncate font-semibold text-foreground">{project.document.name || project.name}</span>
            <span>{project.document.width} × {project.document.height} · {safeFps} fps · {safeDuration.toFixed(2)}s</span>
            {selected ? (
              <>
                <span className="truncate text-foreground">Layer: {selected.name} (&lt;{selected.tagName}&gt;)</span>
                <span>In {clamp(selected.inPoint ?? 0, 0, safeDuration).toFixed(2)}s · Out {clamp(selected.outPoint ?? safeDuration, 0, safeDuration).toFixed(2)}s</span>
                <span>Position {selectedStyles?.x.toFixed(1) ?? '0'}, {selectedStyles?.y.toFixed(1) ?? '0'}</span>
                <span>Scale {selectedStyles?.scaleX.toFixed(1) ?? '100'}%, {selectedStyles?.scaleY.toFixed(1) ?? '100'}% · Rotation {selectedStyles?.rotation.toFixed(1) ?? '0'}° · Opacity {selectedStyles?.opacity.toFixed(1) ?? '100'}%</span>
              </>
            ) : <span className="col-span-2 text-[var(--text-muted)]">No layer selected.</span>}
            <span className="col-span-2 text-[var(--text-muted)]">Play range {rangeStart.toFixed(2)}–{rangeEnd.toFixed(2)}s{rangeLength === 0 ? ' (empty)' : ''}</span>
          </div>
        )}
      </div>}
    </section>
  );
};
