'use client';

import React, { useMemo, useRef, useState } from 'react';
import { AnimationTrack, Keyframe, ProjectState } from './types';
import { evaluateEasing } from './animationEngine';

interface GraphEditorProps {
  project: ProjectState;
  selectedElementId: string | null;
  onSelectElement: (elementId: string) => void;
  onUpdateKeyframe: (keyframeId: string, updates: Partial<Keyframe>) => void;
}

type GraphMode = 'value' | 'speed';
type Point = { x: number; y: number; time: number; value: number };

const WIDTH = 600;
const HEIGHT = 240;
const PLOT = { left: 40, right: 588, top: 16, bottom: 210 };

function getBezier(keyframe: Keyframe): [number, number, number, number] {
  if (
    keyframe.bezier
    && keyframe.bezier.length === 4
    && keyframe.bezier.every(Number.isFinite)
  ) return keyframe.bezier;
  return keyframe.easing === 'linear' ? [0.333, 0.333, 0.667, 0.667] : [0.25, 0.1, 0.25, 1];
}

export const GraphEditor: React.FC<GraphEditorProps> = ({
  project,
  selectedElementId,
  onSelectElement,
  onUpdateKeyframe,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{
    keyframe: Keyframe;
    handle: 0 | 2;
    start: Point;
    end: Point;
    bezier: [number, number, number, number];
  } | null>(null);
  const [mode, setMode] = useState<GraphMode>('value');
  const [snapping, setSnapping] = useState(true);
  const [zoom, setZoom] = useState(1);

  const tracks = useMemo(
    () => project.tracks.filter((track) => !selectedElementId || track.elementId === selectedElementId),
    [project.tracks, selectedElementId]
  );
  const numericTracks = useMemo(
    () => tracks.filter((track) => track.keyframes.length > 0 && track.keyframes.every((frame) => typeof frame.value === 'number')),
    [tracks]
  );
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const track = numericTracks.find((item) => item.id === selectedTrackId) ?? numericTracks[0] ?? null;
  const keyframes = useMemo(
    () => track ? [...track.keyframes].sort((a, b) => a.time - b.time) : [],
    [track]
  );
  const duration = Number.isFinite(project.document.duration) ? Math.max(0.1, project.document.duration) : 4;
  const plotWidth = (PLOT.right - PLOT.left) / zoom;
  const plotHeight = PLOT.bottom - PLOT.top;
  const points = keyframes.map((frame) => ({
    x: PLOT.left + frame.time / duration * plotWidth,
    y: Number(frame.value),
    time: frame.time,
    value: Number(frame.value),
  }));

  const valueSamples = useMemo(() => {
    const samples: Array<{ time: number; value: number; speed: number }> = [];
    for (let index = 0; index < keyframes.length - 1; index++) {
      const first = keyframes[index];
      const next = keyframes[index + 1];
      const startValue = Number(first.value);
      const endValue = Number(next.value);
      const span = next.time - first.time;
      if (!Number.isFinite(span) || span <= 0) continue;
      for (let sample = 0; sample <= 20; sample++) {
        const t = sample / 20;
        const eased = evaluateEasing(first.easing, t, first.bezier);
        const nextT = Math.min(1, t + 0.005);
        const previousT = Math.max(0, t - 0.005);
        const nextEase = evaluateEasing(first.easing, nextT, first.bezier);
        const previousEase = evaluateEasing(first.easing, previousT, first.bezier);
        samples.push({
          time: first.time + span * t,
          value: startValue + (endValue - startValue) * eased,
          speed: (endValue - startValue) * (nextEase - previousEase) / Math.max(0.0001, (nextT - previousT) * span),
        });
      }
    }
    return samples;
  }, [keyframes]);

  const graphValues = valueSamples.map((sample) => mode === 'value' ? sample.value : sample.speed);
  const fallbackValues = keyframes.map((frame) => Number(frame.value));
  const minValue = Math.min(...(graphValues.length ? graphValues : fallbackValues), 0);
  const maxValue = Math.max(...(graphValues.length ? graphValues : fallbackValues), 1);
  const valueRange = Math.max(0.0001, maxValue - minValue);
  const padding = valueRange * 0.08;
  const lowerBound = minValue - padding;
  const upperBound = maxValue + padding;
  const valueToY = (value: number) => PLOT.bottom - ((value - lowerBound) / (upperBound - lowerBound)) * plotHeight;
  const timeToX = (time: number) => PLOT.left + time / duration * plotWidth;

  const valuePath = useMemo(() => {
    return valueSamples.map((sample, index) =>
      `${index === 0 ? 'M' : 'L'} ${timeToX(sample.time).toFixed(2)} ${valueToY(mode === 'value' ? sample.value : sample.speed).toFixed(2)}`
    ).join(' ');
  }, [valueSamples, mode, duration, plotWidth, lowerBound, upperBound]);

  const beginHandleDrag = (
    event: React.PointerEvent<SVGCircleElement>,
    frame: Keyframe,
    nextFrame: Keyframe,
    handle: 0 | 2
  ) => {
    if (mode !== 'value') return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      keyframe: frame,
      handle,
      start: { x: timeToX(frame.time), y: valueToY(Number(frame.value)), time: frame.time, value: Number(frame.value) },
      end: { x: timeToX(nextFrame.time), y: valueToY(Number(nextFrame.value)), time: nextFrame.time, value: Number(nextFrame.value) },
      bezier: getBezier(frame),
    };
  };

  const moveHandle = (event: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    const bounds = svgRef.current?.getBoundingClientRect();
    if (!drag || !bounds || !bounds.width || !bounds.height) return;
    const x = (event.clientX - bounds.left) / bounds.width * WIDTH;
    const y = (event.clientY - bounds.top) / bounds.height * HEIGHT;
    const xSpan = Math.max(1, drag.end.x - drag.start.x);
    const ySpan = drag.end.y - drag.start.y;
    let bezierX = Math.max(0, Math.min(1, (x - drag.start.x) / xSpan));
    let bezierY = Math.max(-2, Math.min(2, Math.abs(ySpan) < 0.001 ? drag.bezier[drag.handle + 1] : (y - drag.start.y) / ySpan));
    if (snapping) {
      bezierX = Math.round(bezierX * 20) / 20;
      bezierY = Math.round(bezierY * 20) / 20;
    }
    const bezier = [...drag.bezier] as [number, number, number, number];
    bezier[drag.handle] = bezierX;
    bezier[drag.handle + 1] = bezierY;
    onUpdateKeyframe(drag.keyframe.id, { easing: 'cubicBezier', interpolation: 'bezier', bezier });
  };

  const endHandleDrag = () => {
    dragRef.current = null;
  };

  const paths = keyframes.slice(0, -1).map((frame, index) => {
    const nextFrame = keyframes[index + 1];
    const startX = timeToX(frame.time);
    const endX = timeToX(nextFrame.time);
    const startY = valueToY(Number(frame.value));
    const endY = valueToY(Number(nextFrame.value));
    const bezier = getBezier(frame);
    const control1X = startX + (endX - startX) * bezier[0];
    const control1Y = startY + (endY - startY) * bezier[1];
    const control2X = startX + (endX - startX) * bezier[2];
    const control2Y = startY + (endY - startY) * bezier[3];
    return {
      frame,
      nextFrame,
      startX,
      endX,
      startY,
      endY,
      control1X,
      control1Y,
      control2X,
      control2Y,
      path: mode === 'value'
        ? `M ${startX} ${startY} C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${endX} ${endY}`
        : '',
    };
  });

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-[var(--main-bg)] text-foreground" aria-label="Graph editor">
      <header className="flex min-h-9 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Graph</span>
          <select
            value={track?.id ?? ''}
            onChange={(event) => {
              const next = numericTracks.find((item) => item.id === event.target.value);
              setSelectedTrackId(next?.id ?? null);
              if (next) onSelectElement(next.elementId);
            }}
            aria-label="Graph property"
            className="h-6 max-w-36 rounded border border-[var(--card-border)] bg-[var(--input-bg)] px-2 text-[9px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {numericTracks.map((item) => <option key={item.id} value={item.id}>{item.property}</option>)}
          </select>
          <div className="flex rounded border border-[var(--card-border)] bg-[var(--input-bg)] p-0.5">
            {(['value', 'speed'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setMode(option)}
                aria-pressed={mode === option}
                className={`rounded px-2 py-0.5 text-[9px] capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${mode === option ? 'bg-primary/20 text-primary' : 'text-[var(--text-muted)] hover:text-foreground'}`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setSnapping((value) => !value)} aria-pressed={snapping} className={`rounded px-2 py-1 text-[9px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${snapping ? 'text-primary' : 'text-[var(--text-muted)]'}`}>Snap</button>
          <button type="button" onClick={() => setZoom(1)} className="rounded px-2 py-1 text-[9px] text-[var(--text-secondary)] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Fit</button>
          <input type="range" min="0.5" max="2" step="0.1" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} aria-label="Graph zoom" className="w-16 accent-primary" />
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {!track || keyframes.length < 2 ? (
          <div className="flex h-full items-center justify-center text-[10px] text-[var(--text-muted)]">
            {numericTracks.length ? 'Select a property with at least two numeric keyframes.' : 'Add numeric keyframes to view the value or speed graph.'}
          </div>
        ) : (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            preserveAspectRatio="none"
            onPointerMove={moveHandle}
            onPointerUp={endHandleDrag}
            onPointerCancel={endHandleDrag}
            className="h-full min-h-48 w-full overflow-visible rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)]"
            role="img"
            aria-label={`${mode} graph for ${track.property}`}
          >
            {Array.from({ length: 5 }, (_, index) => {
              const y = PLOT.top + plotHeight * index / 4;
              return <line key={index} x1={PLOT.left} x2={PLOT.right} y1={y} y2={y} stroke="currentColor" strokeOpacity="0.08" />;
            })}
            <line x1={PLOT.left} x2={PLOT.left} y1={PLOT.top} y2={PLOT.bottom} stroke="currentColor" strokeOpacity="0.3" />
            <line x1={PLOT.left} x2={PLOT.right} y1={PLOT.bottom} y2={PLOT.bottom} stroke="currentColor" strokeOpacity="0.3" />
            <path d={valuePath} fill="none" stroke="var(--color-primary, #16c784)" strokeWidth="1.5" strokeDasharray={mode === 'speed' ? '4 2' : undefined} />
            {mode === 'value' && paths.map((segment) => (
              <g key={segment.frame.id}>
                <path d={segment.path} fill="none" stroke="transparent" strokeWidth="12" />
                <line x1={segment.startX} y1={segment.startY} x2={segment.control1X} y2={segment.control1Y} stroke="var(--color-primary, #16c784)" strokeOpacity="0.4" />
                <line x1={segment.endX} y1={segment.endY} x2={segment.control2X} y2={segment.control2Y} stroke="var(--color-primary, #16c784)" strokeOpacity="0.4" />
                <circle
                  cx={segment.control1X}
                  cy={segment.control1Y}
                  r="4"
                  fill="var(--card-bg)"
                  stroke="var(--color-primary, #16c784)"
                  strokeWidth="2"
                  className="cursor-move"
                  aria-label={`Edit outgoing bezier handle for keyframe at ${segment.frame.time.toFixed(2)} seconds`}
                  onPointerDown={(event) => beginHandleDrag(event, segment.frame, segment.nextFrame, 0)}
                />
                <circle
                  cx={segment.control2X}
                  cy={segment.control2Y}
                  r="4"
                  fill="var(--card-bg)"
                  stroke="var(--color-primary, #16c784)"
                  strokeWidth="2"
                  className="cursor-move"
                  aria-label={`Edit incoming bezier handle for keyframe at ${segment.nextFrame.time.toFixed(2)} seconds`}
                  onPointerDown={(event) => beginHandleDrag(event, segment.frame, segment.nextFrame, 2)}
                />
              </g>
            ))}
            {mode === 'value' && points.map((point, index) => (
              <g key={keyframes[index].id}>
                <circle cx={point.x} cy={valueToY(point.value)} r="4" fill="#16c784" stroke="var(--card-bg)" strokeWidth="2" />
                <text x={point.x} y={PLOT.bottom + 16} fill="currentColor" fillOpacity="0.6" fontSize="8" textAnchor="middle">{point.time.toFixed(2)}s</text>
              </g>
            ))}
            {mode === 'speed' && <text x={PLOT.left + 4} y={PLOT.top + 12} fill="currentColor" fillOpacity="0.5" fontSize="9">Speed / second</text>}
          </svg>
        )}
      </div>
    </section>
  );
};
