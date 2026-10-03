'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ProjectState,
  SvgElementNode,
  Keyframe,
  AnimProperty,
  EasingType,
  ToastMessage,
} from './types';
import { DEFAULT_DURATION, DEFAULT_FPS, DEFAULT_VIEWBOX } from './constants';
import { sanitizeAndParseSvg, findElementById } from './svgParser';
import { ANIMATION_PRESETS } from './presets';
import { AiAnimationPlan } from './aiAssistant';
import { computeElementStylesAtTime } from './animationEngine';
import {
  recordPropertyKeyframe,
  recordAllTransformKeyframes,
  applyEasingToElementTransforms,
  getAdjacentKeyframes,
} from './keyframeManager';
import { downloadText } from '@/lib/downloadHelper';
import { TopBar } from './TopBar';
import { LayersPanel } from './LayersPanel';
import { CanvasViewport } from './CanvasViewport';
import { Inspector } from './Inspector';
import { Timeline } from './Timeline';
import { AiAssistantModal } from './AiAssistantModal';
import { ExportModal } from './ExportModal';
import { ShortcutsModal } from './ShortcutsModal';
import {
  X,
  CheckCircle,
  AlertTriangle,
  Info,
  Maximize,
  Minimize,
} from 'lucide-react';

const LOCAL_STORAGE_KEY = 'mcu_svg_motion_last_project';
type PlaybackRenderer = (time: number) => void;

export const SvgMotionStudio: React.FC = () => {
  // Master Project State
  const [project, setProject] = useState<ProjectState>({
    version: '1.0',
    name: 'Untitled Project',
    document: {
      width: 800,
      height: 650,
      viewBox: { x: 0, y: 0, width: 800, height: 650 },
      backgroundColor: 'transparent',
      fps: DEFAULT_FPS,
      duration: DEFAULT_DURATION,
      loop: true,
      name: 'Untitled Project',
    },
    svgRaw: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 650" width="800" height="650"></svg>',
    elements: [],
    tracks: [],
    characterSlots: {},
    isSingleFlattenedPath: false,
    selectedElementId: null,
    selectedKeyframeId: null,
    currentTime: 0,
    isPlaying: false,
  });
  const playbackTimeRef = useRef(project.currentTime);
  const canvasPlaybackRendererRef = useRef<PlaybackRenderer | null>(null);
  const timelinePlaybackRendererRef = useRef<PlaybackRenderer | null>(null);

  // Undo / Redo History Stack (stores snapshot of project state)
  const historyRef = useRef<ProjectState[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Viewport display controls
  const [showGrid, setShowGrid] = useState(true);
  const [showRulers, setShowRulers] = useState(true);
  const [showSafeArea, setShowSafeArea] = useState(false);
  const [canvasBg, setCanvasBg] = useState<'checkerboard' | string>('checkerboard');

  // Modal dialog states
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  // Responsive sidebar collapse
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);
  const [autoKeyframe, setAutoKeyframe] = useState(false);

  useEffect(() => {
    const updateSidebarLayout = () => {
      const isMobile = window.matchMedia('(max-width: 767px)').matches;
      setIsLeftCollapsed(isMobile);
      setIsRightCollapsed(isMobile);
    };
    updateSidebarLayout();
    window.addEventListener('resize', updateSidebarLayout);
    return () => window.removeEventListener('resize', updateSidebarLayout);
  }, []);

  // Toast Notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (title: string, description?: string, type: ToastMessage['type'] = 'info') => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, title, description, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const fitToScreenCallbackRef = useRef<(() => void) | null>(null);
  const handleRegisterFitToScreen = useCallback((cb: () => void) => {
    fitToScreenCallbackRef.current = cb;
  }, []);
  const handleRegisterCanvasPlaybackRenderer = useCallback((renderer: PlaybackRenderer | null) => {
    canvasPlaybackRendererRef.current = renderer;
  }, []);
  const handleRegisterTimelinePlaybackRenderer = useCallback((renderer: PlaybackRenderer | null) => {
    timelinePlaybackRendererRef.current = renderer;
  }, []);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const studioContainerRef = useRef<HTMLDivElement>(null);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (studioContainerRef.current) {
        studioContainerRef.current.requestFullscreen().then(() => {
          setIsFullscreen(true);
        }).catch(() => {
          setIsFullscreen((prev) => !prev);
        });
      } else {
        setIsFullscreen((prev) => !prev);
      }
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(() => {
        setIsFullscreen(false);
      });
    }
  };

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Push state to undo history
  const pushHistory = useCallback((newState: ProjectState) => {
    const history = historyRef.current.slice(0, historyIndexRef.current + 1);
    history.push({
      ...newState,
      isPlaying: false, // do not record playback playhead state in history
    });
    if (history.length > 50) history.shift();
    historyRef.current = history;
    historyIndexRef.current = history.length - 1;
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(false);
  }, []);

  // Undo / Redo handlers
  const handleUndo = () => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      const prevState = historyRef.current[historyIndexRef.current];
      setProject((curr) => ({
        ...prevState,
        currentTime: curr.currentTime,
        isPlaying: false,
      }));
      setCanUndo(historyIndexRef.current > 0);
      setCanRedo(true);
      addToast('Undo', 'Reverted last change', 'info');
    }
  };

  const handleRedo = () => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++;
      const nextState = historyRef.current[historyIndexRef.current];
      setProject((curr) => ({
        ...nextState,
        currentTime: curr.currentTime,
        isPlaying: false,
      }));
      setCanUndo(true);
      setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
      addToast('Redo', 'Restored next change', 'info');
    }
  };

  // Keep playback time outside React state so playback does not rerender the whole editor.
  useEffect(() => {
    if (!project.isPlaying) playbackTimeRef.current = project.currentTime;
  }, [project.currentTime, project.isPlaying]);

  // 2. Playback animation loop
  useEffect(() => {
    let animId: number;
    let lastUpdateTime = performance.now();
    const frameInterval = 1000 / Math.max(1, Math.min(project.document.fps, 60));
    const duration = project.document.duration;
    const shouldLoop = project.document.loop;

    const loop = (now: number) => {
      const elapsed = now - lastUpdateTime;

      if (elapsed >= frameInterval) {
        lastUpdateTime = now;
        let nextTime = playbackTimeRef.current + elapsed / 1000;

        if (nextTime >= duration) {
          if (shouldLoop) nextTime %= duration;
          else nextTime = duration;
        }

        playbackTimeRef.current = nextTime;
        canvasPlaybackRendererRef.current?.(nextTime);
        timelinePlaybackRendererRef.current?.(nextTime);

        if (!shouldLoop && nextTime >= duration) {
          setProject((prev) => ({ ...prev, currentTime: duration, isPlaying: false }));
          return;
        }
      }

      animId = requestAnimationFrame(loop);
    };

    if (project.isPlaying) {
      lastUpdateTime = performance.now();
      animId = requestAnimationFrame(loop);
    }

    return () => cancelAnimationFrame(animId);
  }, [project.isPlaying, project.document.fps, project.document.duration, project.document.loop]);

  const handleTogglePlayback = () => {
    if (project.isPlaying) {
      const currentTime = playbackTimeRef.current;
      setProject((prev) => ({ ...prev, currentTime, isPlaying: false }));
      return;
    }

    playbackTimeRef.current = project.currentTime;
    setProject((prev) => ({ ...prev, isPlaying: true }));
  };

  const handleRewind = () => {
    playbackTimeRef.current = 0;
    setProject((prev) => ({ ...prev, currentTime: 0 }));
    canvasPlaybackRendererRef.current?.(0);
    timelinePlaybackRendererRef.current?.(0);
  };

  const handleSeek = (time: number) => {
    playbackTimeRef.current = time;
    setProject((prev) => ({ ...prev, currentTime: time }));
    canvasPlaybackRendererRef.current?.(time);
    timelinePlaybackRendererRef.current?.(time);
  };

  // 3. User SVG Upload Handler
  const handleOpenSvgFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = sanitizeAndParseSvg(text);

      if (!parsed.success) {
        addToast('Invalid SVG', parsed.error || 'Could not parse SVG file', 'error');
        return;
      }

      const cleanName = file.name.replace(/\.[^/.]+$/, '');

      const newProject: ProjectState = {
        version: '1.0',
        name: cleanName,
        document: {
          width: parsed.width,
          height: parsed.height,
          viewBox: parsed.viewBox,
          backgroundColor: 'transparent',
          fps: project.document.fps,
          duration: project.document.duration,
          loop: project.document.loop,
          name: cleanName,
        },
        svgRaw: parsed.cleanSvg,
        elements: parsed.elements,
        tracks: [],
        characterSlots: {},
        isSingleFlattenedPath: parsed.isSingleFlattenedPath,
        selectedElementId: parsed.elements[0]?.id || null,
        selectedKeyframeId: null,
        currentTime: 0,
        isPlaying: false,
      };

      playbackTimeRef.current = 0;
      setProject(newProject);
      pushHistory(newProject);

      if (parsed.isSingleFlattenedPath) {
        addToast(
          'Single Vector Object',
          'Artwork contains 1 flattened path. Animate position/scale or use stroke drawing.',
          'warning'
        );
      } else {
        addToast(
          'SVG Loaded',
          `Parsed ${parsed.totalShapes} elements and created layers hierarchy`,
          'success'
        );
      }

      setTimeout(() => {
        if (fitToScreenCallbackRef.current) fitToScreenCallbackRef.current();
      }, 150);
    } catch (err: any) {
      addToast('Upload Failed', err?.message || 'Error reading SVG', 'error');
    }
  };

  // 4. Project File Save & Load (.mcuproj)
  const handleSaveProject = () => {
    const jsonStr = JSON.stringify(
      {
        version: '1.0',
        name: project.name,
        document: project.document,
        svgRaw: project.svgRaw,
        elements: project.elements,
        tracks: project.tracks,
        characterSlots: project.characterSlots,
        isSingleFlattenedPath: project.isSingleFlattenedPath,
        savedAt: new Date().toISOString(),
      },
      null,
      2
    );

    const filename = `${project.name.toLowerCase().replace(/[^a-z0-9_]/g, '_')}.mcuproj`;
    downloadText(jsonStr, filename, 'application/json');

    // Also persist to localStorage
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, jsonStr);
    } catch {}

    addToast('Project Saved', `Downloaded ${filename}`, 'success');
  };

  const handleLoadProjectFile = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.svgRaw || !data.document) {
        addToast('Invalid Project', 'Not a valid MCU project file', 'error');
        return;
      }

      const loadedProject: ProjectState = {
        version: data.version || '1.0',
        name: data.name || 'Imported Project',
        document: data.document,
        svgRaw: data.svgRaw,
        elements: data.elements || [],
        tracks: data.tracks || [],
        characterSlots: data.characterSlots || {},
        isSingleFlattenedPath: !!data.isSingleFlattenedPath,
        selectedElementId: data.elements?.[0]?.id || null,
        selectedKeyframeId: null,
        currentTime: 0,
        isPlaying: false,
      };

      playbackTimeRef.current = 0;
      setProject(loadedProject);
      pushHistory(loadedProject);
      addToast('Project Opened', `Loaded project "${loadedProject.name}"`, 'success');

      setTimeout(() => {
        if (fitToScreenCallbackRef.current) fitToScreenCallbackRef.current();
      }, 150);
    } catch (err: any) {
      addToast('Failed to open project', err?.message || 'Error parsing project file', 'error');
    }
  };

  // 5. New Clean Project
  const handleNewProject = () => {
    if (confirm('Create a new blank project? Unsaved changes will be discarded.')) {
      const blankSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
        <rect id="sample-box" x="300" y="200" width="200" height="200" rx="16" fill="#6366f1" />
      </svg>`;
      const parsed = sanitizeAndParseSvg(blankSvg);

      const blankProj: ProjectState = {
        version: '1.0',
        name: 'Untitled Project',
        document: {
          width: 800,
          height: 600,
          viewBox: { x: 0, y: 0, width: 800, height: 600 },
          backgroundColor: 'transparent',
          fps: 30,
          duration: 4.0,
          loop: true,
          name: 'Untitled Project',
        },
        svgRaw: parsed.cleanSvg,
        elements: parsed.elements,
        tracks: [],
        characterSlots: {},
        isSingleFlattenedPath: false,
        selectedElementId: parsed.elements[0]?.id || null,
        selectedKeyframeId: null,
        currentTime: 0,
        isPlaying: false,
      };

      playbackTimeRef.current = 0;
      setProject(blankProj);
      pushHistory(blankProj);
      addToast('New Project', 'Blank canvas created', 'info');
    }
  };

  // 6. Element & Layer Manipulation
  const handleToggleVisibility = (elId: string) => {
    setProject((prev) => {
      const updateVisibility = (nodes: SvgElementNode[]): SvgElementNode[] =>
        nodes.map((n) => {
          if (n.id === elId) return { ...n, visible: !n.visible };
          if (n.children && n.children.length > 0)
            return { ...n, children: updateVisibility(n.children) };
          return n;
        });

      const next = { ...prev, elements: updateVisibility(prev.elements) };
      pushHistory(next);
      return next;
    });
  };

  const handleToggleLock = (elId: string) => {
    setProject((prev) => {
      const updateLock = (nodes: SvgElementNode[]): SvgElementNode[] =>
        nodes.map((n) => {
          if (n.id === elId) return { ...n, locked: !n.locked };
          if (n.children && n.children.length > 0)
            return { ...n, children: updateLock(n.children) };
          return n;
        });

      const next = { ...prev, elements: updateLock(prev.elements) };
      pushHistory(next);
      return next;
    });
  };

  const handleRenameElement = (elId: string, newName: string) => {
    setProject((prev) => {
      const updateName = (nodes: SvgElementNode[]): SvgElementNode[] =>
        nodes.map((n) => {
          if (n.id === elId) return { ...n, name: newName };
          if (n.children && n.children.length > 0)
            return { ...n, children: updateName(n.children) };
          return n;
        });

      const next = { ...prev, elements: updateName(prev.elements) };
      pushHistory(next);
      return next;
    });
  };

  const handleMoveElement = (elId: string, direction: 'up' | 'down') => {
    setProject((prev) => {
      const moveInList = (list: SvgElementNode[]): SvgElementNode[] => {
        const idx = list.findIndex((item) => item.id === elId);
        if (idx !== -1) {
          const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
          if (targetIdx >= 0 && targetIdx < list.length) {
            const copy = [...list];
            const [item] = copy.splice(idx, 1);
            copy.splice(targetIdx, 0, item);
            return copy;
          }
          return list;
        }
        return list.map((item) =>
          item.children ? { ...item, children: moveInList(item.children) } : item
        );
      };

      const next = { ...prev, elements: moveInList(prev.elements) };
      pushHistory(next);
      return next;
    });
  };

  const handleSelectElement = useCallback((id: string | null) => {
    setProject((p) => (p.selectedElementId === id ? p : { ...p, selectedElementId: id }));
  }, []);

  // 7. Transform Property Updates (Position, Rotation, Scale, Origin, etc.)
  const handleUpdateTransform = useCallback((
    elementId: string,
    transform: { x?: number; y?: number; rotation?: number; scaleX?: number; scaleY?: number; opacity?: number; originX?: number; originY?: number }
  ) => {
    setProject((prev) => {
      let updatedTracks = [...prev.tracks];

      // Helper to add or update keyframe on track
      const applyProp = (prop: AnimProperty, val: number | undefined) => {
        if (val === undefined) return;

        const trackIndex = updatedTracks.findIndex(
          (t) => t.elementId === elementId && t.property === prop
        );
        const track = trackIndex >= 0
          ? updatedTracks[trackIndex]
          : {
            id: `trk_${Date.now()}_${prop}`,
            elementId,
            property: prop,
            keyframes: [],
          };
        const keyframes = [...track.keyframes];

        // Check if keyframe already exists near playhead
        const existingKfIndex = keyframes.findIndex(
          (k) => Math.abs(k.time - prev.currentTime) < 0.05
        );

        if (existingKfIndex >= 0) {
          keyframes[existingKfIndex] = {
            ...keyframes[existingKfIndex],
            value: val,
          };
        } else {
          keyframes.push({
            id: `kf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            time: prev.currentTime,
            value: val,
            easing: 'easeInOut',
          });
          keyframes.sort((a, b) => a.time - b.time);
        }

        const updatedTrack = { ...track, keyframes };
        if (trackIndex >= 0) updatedTracks[trackIndex] = updatedTrack;
        else updatedTracks.push(updatedTrack);
      };

      applyProp('x', transform.x);
      applyProp('y', transform.y);
      applyProp('rotation', transform.rotation);
      applyProp('scaleX', transform.scaleX);
      applyProp('scaleY', transform.scaleY);
      applyProp('opacity', transform.opacity);
      applyProp('originX', transform.originX);
      applyProp('originY', transform.originY);

      return { ...prev, tracks: updatedTracks };
    });
  }, []);

  const handleUpdateTransformProperty = (
    elementId: string,
    property: AnimProperty,
    value: number | string
  ) => {
    handleUpdateTransform(elementId, { [property]: value });
  };

  const handleRecordAllTransforms = (elementId: string) => {
    setProject((prev) => {
      const element = findElementById(prev.elements, elementId);
      if (!element) return prev;

      const styles = computeElementStylesAtTime(
        prev.tracks,
        elementId,
        prev.currentTime,
        element.initialTransform,
        element.initialAppearance
      );
      const next = {
        ...prev,
        tracks: recordAllTransformKeyframes(
          prev.tracks,
          elementId,
          styles,
          prev.currentTime
        ),
      };
      pushHistory(next);
      return next;
    });
  };

  const handleApplyEasingToTransforms = (elementId: string, easing: EasingType) => {
    setProject((prev) => {
      const next = {
        ...prev,
        tracks: applyEasingToElementTransforms(prev.tracks, elementId, easing),
      };
      pushHistory(next);
      return next;
    });
  };

  // 8. Keyframe operations (Add, Delete, Move, Duplicate, Easing)
  const handleToggleKeyframe = (elementId: string, property: AnimProperty) => {
    setProject((prev) => {
      let updatedTracks = [...prev.tracks];
      const trackIndex = updatedTracks.findIndex(
        (t) => t.elementId === elementId && t.property === property
      );
      const track = trackIndex >= 0
        ? updatedTracks[trackIndex]
        : {
          id: `trk_${Date.now()}_${property}`,
          elementId,
          property,
          keyframes: [],
        };
      const keyframes = [...track.keyframes];

      const existingIndex = keyframes.findIndex(
        (k) => Math.abs(k.time - prev.currentTime) < 0.05
      );

      if (existingIndex >= 0) {
        keyframes.splice(existingIndex, 1);
        addToast('Keyframe removed', `Removed ${property} keyframe`, 'info');
      } else {
        const node = findElementById(prev.elements, elementId);
        const currentVal =
          property === 'scaleX' || property === 'scaleY' || property === 'opacity'
            ? 100
            : property === 'originX' || property === 'originY'
            ? 50
            : 0;

        keyframes.push({
          id: `kf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          time: prev.currentTime,
          value: currentVal,
          easing: 'easeInOut',
        });
        keyframes.sort((a, b) => a.time - b.time);
        addToast('Keyframe added', `Added ${property} keyframe at ${prev.currentTime.toFixed(2)}s`, 'success');
      }

      const updatedTrack = { ...track, keyframes };
      if (trackIndex >= 0) updatedTracks[trackIndex] = updatedTrack;
      else updatedTracks.push(updatedTrack);

      const next = { ...prev, tracks: updatedTracks };
      pushHistory(next);
      return next;
    });
  };

  const handleMoveKeyframe = (keyframeId: string, newTime: number) => {
    setProject((prev) => {
      const updatedTracks = prev.tracks.map((track) => ({
        ...track,
        keyframes: track.keyframes.map((kf) =>
          kf.id === keyframeId ? { ...kf, time: Math.max(0, Math.min(prev.document.duration, newTime)) } : kf
        ),
      }));
      return { ...prev, tracks: updatedTracks };
    });
  };

  const handleDeleteKeyframes = (keyframeIds: string[]) => {
    if (keyframeIds.length === 0) return;
    const ids = new Set(keyframeIds);
    setProject((prev) => {
      const updatedTracks = prev.tracks.map((track) => ({
        ...track,
        keyframes: track.keyframes.filter((kf) => !ids.has(kf.id)),
      }));
      const next = {
        ...prev,
        tracks: updatedTracks,
        selectedKeyframeId: null,
        selectedKeyframeIds: [],
      };
      pushHistory(next);
      addToast(keyframeIds.length === 1 ? 'Keyframe Deleted' : 'Keyframes Deleted', '', 'info');
      return next;
    });
  };

  const handleDeleteKeyframe = (keyframeId: string) => handleDeleteKeyframes([keyframeId]);

  const handleDuplicateKeyframe = (keyframeId: string) => {
    setProject((prev) => {
      let duplicated = false;
      const updatedTracks = prev.tracks.map((track) => {
        const match = track.keyframes.find((k) => k.id === keyframeId);
        if (match && !duplicated) {
          duplicated = true;
          const newKf: Keyframe = {
            ...match,
            id: `kf_${Date.now()}_dup`,
            time: Math.min(prev.document.duration, match.time + 0.5),
          };
          return {
            ...track,
            keyframes: [...track.keyframes, newKf].sort((a, b) => a.time - b.time),
          };
        }
        return track;
      });

      const next = { ...prev, tracks: updatedTracks };
      pushHistory(next);
      addToast('Keyframe Duplicated', '', 'success');
      return next;
    });
  };

  const handleUpdateKeyframeEasing = (keyframeId: string, easing: EasingType) => {
    setProject((prev) => {
      const updatedTracks = prev.tracks.map((track) => ({
        ...track,
        keyframes: track.keyframes.map((kf) =>
          kf.id === keyframeId ? { ...kf, easing } : kf
        ),
      }));
      const next = { ...prev, tracks: updatedTracks };
      pushHistory(next);
      return next;
    });
  };

  // 9. Presets Application
  const handleApplyPreset = (elementId: string, presetId: string) => {
    const preset = ANIMATION_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    const node = findElementById(project.elements, elementId);
    const newTracks = preset.createTracks(
      elementId,
      project.document.duration,
      project.currentTime,
      node?.pathLength
    );

    setProject((prev) => {
      // Merge new tracks with existing
      const existingProps = new Set(newTracks.map((t) => `${t.elementId}_${t.property}`));
      const filtered = prev.tracks.filter((t) => !existingProps.has(`${t.elementId}_${t.property}`));
      const next = { ...prev, tracks: [...filtered, ...newTracks] };
      pushHistory(next);
      return next;
    });

    addToast('Preset Applied', `Added "${preset.name}" animation keyframes`, 'success');
  };

  // 10. AI Assistant Plan Application
  const handleApplyAiPlan = (plan: AiAnimationPlan) => {
    playbackTimeRef.current = 0;
    setProject((prev) => {
      const existingProps = new Set(plan.tracks.map((t) => `${t.elementId}_${t.property}`));
      const baseTracks = prev.aiAnimationBaseTracks ?? prev.tracks;
      const filtered = baseTracks.filter((t) => !existingProps.has(`${t.elementId}_${t.property}`));
      const next: ProjectState = {
        ...prev,
        document: {
          ...prev.document,
          duration: plan.duration,
          fps: plan.fps,
          loop: plan.loop,
        },
        tracks: [...filtered, ...plan.tracks],
        aiAnimationBaseTracks: baseTracks,
        aiAnimationBaseDocument: prev.aiAnimationBaseDocument ?? prev.document,
        currentTime: 0,
        isPlaying: false,
      };
      pushHistory(next);
      return next;
    });

    addToast('AI Motion Applied', 'Editable keyframes were added to the timeline', 'success');
  };

  const handleResetAiAnimation = () => {
    setProject((prev) => {
      if (!prev.aiAnimationBaseTracks) return prev;
      const next: ProjectState = {
        ...prev,
        document: prev.aiAnimationBaseDocument ?? prev.document,
        tracks: prev.aiAnimationBaseTracks,
        aiAnimationBaseTracks: null,
        aiAnimationBaseDocument: null,
        currentTime: 0,
        isPlaying: false,
      };
      pushHistory(next);
      return next;
    });
    playbackTimeRef.current = 0;
    addToast('AI Animation Reset', 'Restored the timeline state from before AI animation', 'info');
  };

  // 12. Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is inside a form input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      // Space = Play / Pause
      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlayback();
      }

      // Delete / Backspace = Delete keyframe
      if (e.code === 'Delete' || e.code === 'Backspace') {
        const selectedIds = project.selectedKeyframeIds?.length
          ? project.selectedKeyframeIds
          : project.selectedKeyframeId ? [project.selectedKeyframeId] : [];
        if (selectedIds.length > 0) {
          e.preventDefault();
          handleDeleteKeyframes(selectedIds);
        }
      }

      // Ctrl / Cmd + Z = Undo
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }

      // Ctrl / Cmd + Shift + Z or Ctrl + Y = Redo
      if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyZ') ||
        ((e.ctrlKey || e.metaKey) && e.code === 'KeyY')
      ) {
        e.preventDefault();
        handleRedo();
      }

      // Ctrl / Cmd + S = Save Project
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
        e.preventDefault();
        handleSaveProject();
      }

      // Ctrl / Cmd + D = Duplicate Keyframe
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyD') {
        if (project.selectedKeyframeId) {
          e.preventDefault();
          handleDuplicateKeyframe(project.selectedKeyframeId);
        }
      }

      // ? = Shortcuts Modal
      if (e.key === '?') {
        setIsShortcutsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [project.selectedKeyframeId, project.selectedKeyframeIds, handleTogglePlayback]);

  return (
    <div
      ref={studioContainerRef}
      className={`flex flex-col h-full w-full bg-[var(--main-bg)] text-foreground overflow-hidden font-sans transition-colors ${
        isFullscreen ? 'fixed inset-0 z-[100] h-screen w-screen' : ''
      }`}
    >
      {/* 1. TOP BAR */}
      <TopBar
        project={project}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onTogglePlay={handleTogglePlayback}
        onRewind={handleRewind}
        onOpenSvgFile={handleOpenSvgFile}
        onNewProject={handleNewProject}
        onSaveProject={handleSaveProject}
        onLoadProjectFile={handleLoadProjectFile}
        onOpenExportModal={() => setIsExportOpen(true)}
        onToggleAiAssistant={() => setIsAiAssistantOpen(!isAiAssistantOpen)}
        isAiAssistantOpen={isAiAssistantOpen}
        onToggleShortcuts={() => setIsShortcutsOpen(true)}
        showGrid={showGrid}
        onToggleGrid={() => setShowGrid(!showGrid)}
        showRulers={showRulers}
        onToggleRulers={() => setShowRulers(!showRulers)}
        showSafeArea={showSafeArea}
        onToggleSafeArea={() => setShowSafeArea(!showSafeArea)}
        canvasBg={canvasBg}
        onChangeCanvasBg={setCanvasBg}
        onFitToScreen={() => {
          if (fitToScreenCallbackRef.current) fitToScreenCallbackRef.current();
        }}
        onRenameProject={(name) => setProject((p) => ({ ...p, name }))}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
      />

      {/* 2. MIDDLE WORKSPACE (Layers | Canvas | Inspector) */}
      <div className="svg-motion-workspace flex-1 flex overflow-hidden relative min-h-0">
        {/* Left Layers Sidebar */}
        {!isLeftCollapsed && (
          <LayersPanel
            elements={project.elements}
            selectedElementId={project.selectedElementId}
            onSelectElement={handleSelectElement}
            onToggleVisibility={handleToggleVisibility}
            onToggleLock={handleToggleLock}
            onRenameElement={handleRenameElement}
            onMoveElement={handleMoveElement}
            tracks={project.tracks}
            isSingleFlattenedPath={project.isSingleFlattenedPath}
          />
        )}

        {/* Center Canvas Viewport */}
        <CanvasViewport
          project={project}
          selectedElementId={project.selectedElementId}
          onSelectElement={handleSelectElement}
          showGrid={showGrid}
          showRulers={showRulers}
          showSafeArea={showSafeArea}
          canvasBg={canvasBg}
          onUpdateTransform={handleUpdateTransform}
          onFitToScreenTrigger={handleRegisterFitToScreen}
          isLeftCollapsed={isLeftCollapsed}
          onToggleLeftSidebar={() => setIsLeftCollapsed((collapsed) => !collapsed)}
          isRightCollapsed={isRightCollapsed}
          onToggleRightSidebar={() => setIsRightCollapsed((collapsed) => !collapsed)}
          onRegisterPlaybackRenderer={handleRegisterCanvasPlaybackRenderer}
        />

        {/* Right Inspector */}
        {!isRightCollapsed && (
          <Inspector
            project={project}
            selectedElementId={project.selectedElementId}
            selectedKeyframeId={project.selectedKeyframeId}
            onUpdateDocumentSettings={(settings) =>
              setProject((p) => ({ ...p, document: { ...p.document, ...settings } }))
            }
            onUpdateTransformProperty={handleUpdateTransformProperty}
            onToggleKeyframe={handleToggleKeyframe}
            onApplyPreset={handleApplyPreset}
            onUpdateKeyframe={(kfId, updates) => {
              setProject((p) => {
                const nextTracks = p.tracks.map((t) => ({
                  ...t,
                  keyframes: t.keyframes.map((k) => (k.id === kfId ? { ...k, ...updates } : k)),
                }));
                return { ...p, tracks: nextTracks };
              });
            }}
            onDeleteKeyframe={handleDeleteKeyframe}
            onDuplicateKeyframe={handleDuplicateKeyframe}
            onRenameElement={handleRenameElement}
            autoKeyframe={autoKeyframe}
            onToggleAutoKeyframe={() => setAutoKeyframe((enabled) => !enabled)}
            onRecordAllTransforms={handleRecordAllTransforms}
            onApplyEasingToTransforms={handleApplyEasingToTransforms}
            onSeek={handleSeek}
          />
        )}
      </div>

      {/* 3. BOTTOM TIMELINE */}
      <Timeline
        project={project}
        onTogglePlay={handleTogglePlayback}
        onRewind={handleRewind}
        onSeek={handleSeek}
        onRegisterPlaybackRenderer={handleRegisterTimelinePlaybackRenderer}
        onUpdateDuration={(duration) =>
          setProject((p) => ({ ...p, document: { ...p.document, duration } }))
        }
        onUpdateFps={(fps) =>
          setProject((p) => ({ ...p, document: { ...p.document, fps } }))
        }
        onToggleLoop={() =>
          setProject((p) => ({ ...p, document: { ...p.document, loop: !p.document.loop } }))
        }
        onSelectKeyframe={(id) => setProject((p) => ({
          ...p,
          selectedKeyframeId: id,
          selectedKeyframeIds: id ? [id] : [],
        }))}
        onSelectKeyframes={(ids, primaryId) => setProject((p) => ({
          ...p,
          selectedKeyframeIds: ids,
          selectedKeyframeId: primaryId,
        }))}
        onAddKeyframeAtPlayhead={(elId, prop) => handleToggleKeyframe(elId, prop)}
        onMoveKeyframe={handleMoveKeyframe}
        onDeleteKeyframes={handleDeleteKeyframes}
        onDuplicateKeyframe={handleDuplicateKeyframe}
        onUpdateKeyframeEasing={handleUpdateKeyframeEasing}
        selectedElementId={project.selectedElementId}
        onSelectElement={handleSelectElement}
      />

      {/* Modals */}
      <AiAssistantModal
        isOpen={isAiAssistantOpen}
        onClose={() => setIsAiAssistantOpen(false)}
        elements={project.elements}
        svgRaw={project.svgRaw}
        selectedElementId={project.selectedElementId}
        currentDuration={project.document.duration}
        currentFps={project.document.fps}
        currentLoop={project.document.loop}
        hasAiAnimation={Boolean(project.aiAnimationBaseTracks)}
        onApplyPlan={handleApplyAiPlan}
        onResetAnimation={handleResetAiAnimation}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        project={project}
      />

      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* Toast Notifications Overlay */}
      <div className="fixed top-20 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[var(--card-bg)]/95 border border-[var(--card-border)] text-foreground shadow-2xl backdrop-blur-xl text-xs animate-in slide-in-from-bottom-2 fade-in duration-150 pointer-events-auto max-w-sm"
          >
            {toast.type === 'success' && <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />}
            {toast.type === 'warning' && <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />}
            {toast.type === 'error' && <X className="h-4 w-4 text-red-500 shrink-0" />}
            {toast.type === 'info' && <Info className="h-4 w-4 text-primary shrink-0" />}
            <div className="min-w-0">
              <span className="font-bold block truncate">{toast.title}</span>
              {toast.description && (
                <span className="text-[10px] text-[var(--text-secondary)] block line-clamp-2">
                  {toast.description}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SvgMotionStudio;
