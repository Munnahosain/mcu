'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Sparkles,
  Film,
  Upload,
  Image as ImageIcon,
  Play,
  Download,
  RotateCcw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Camera,
  Layers,
} from 'lucide-react';
import { ProjectState } from './types';

interface VeoVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  project?: ProjectState;
}

type VideoMode = 'image-to-video' | 'text-to-video';
type AspectRatio = '16:9' | '9:16';

const PROMPT_SUGGESTIONS = [
  'Smooth cinematic motion with dynamic lighting and camera drift',
  'Fluid morphing animation with vibrant neon particles and depth',
  'Subtle floating and breathing parallax motion in 4k detail',
  'Dynamic 3D camera orbit with volumetric light rays',
];

export const VeoVideoModal: React.FC<VeoVideoModalProps> = ({
  isOpen,
  onClose,
  project,
}) => {
  const [mode, setMode] = useState<VideoMode>('image-to-video');
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string>('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [operationName, setOperationName] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      if (videoUrl && videoUrl.startsWith('blob:')) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please upload a valid image file (PNG, JPG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedImage(event.target?.result as string);
      setImageName(file.name);
      setErrorMessage(null);
    };
    reader.readAsDataURL(file);
  };

  const handleCaptureCanvas = () => {
    try {
      const svgElement = document.querySelector('#svg-motion-canvas-viewport svg') as SVGSVGElement | null;
      if (!svgElement) {
        // Fallback to project raw SVG
        if (project?.svgRaw) {
          const base64 = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(project.svgRaw)))}`;
          setUploadedImage(base64);
          setImageName('Current-Canvas.svg');
          setErrorMessage(null);
          return;
        }
        setErrorMessage('Could not find active SVG canvas to capture.');
        return;
      }

      const svgString = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const URLObj = window.URL || window.webkitURL || window;
      const blobUrl = URLObj.createObjectURL(svgBlob);

      const canvas = document.createElement('canvas');
      const bbox = svgElement.viewBox.baseVal || { width: 800, height: 600 };
      canvas.width = bbox.width || 800;
      canvas.height = bbox.height || 600;
      const ctx = canvas.getContext('2d');

      const img = new Image();
      img.onload = () => {
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/png');
          setUploadedImage(dataUrl);
          setImageName('SVG-Canvas-Snapshot.png');
          setErrorMessage(null);
        }
        URLObj.revokeObjectURL(blobUrl);
      };
      img.onerror = () => {
        // Fallback to direct svg data URL
        const directDataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgString)))}`;
        setUploadedImage(directDataUrl);
        setImageName('SVG-Canvas-Snapshot.svg');
        setErrorMessage(null);
        URLObj.revokeObjectURL(blobUrl);
      };
      img.src = blobUrl;
    } catch (err: unknown) {
      console.warn('Canvas capture warning:', err);
      if (project?.svgRaw) {
        const base64 = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(project.svgRaw)))}`;
        setUploadedImage(base64);
        setImageName('Current-Canvas.svg');
        setErrorMessage(null);
      }
    }
  };

  const handleStartGeneration = async () => {
    if (mode === 'image-to-video' && !uploadedImage) {
      setErrorMessage('Please upload a photo or capture the canvas to animate into video.');
      return;
    }

    if (mode === 'text-to-video' && !prompt.trim()) {
      setErrorMessage('Please enter a description for the video you want to generate.');
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);
    setVideoUrl(null);
    setStatusMessage('Initiating Veo 3 generation with model: veo-3.1-fast-generate-preview...');
    setElapsedSeconds(0);

    // Start timer
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    elapsedTimerRef.current = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);

    try {
      const response = await fetch('/api/veo/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim() || (mode === 'image-to-video' ? 'Animate this visual with cinematic motion' : 'Cinematic visual'),
          image: mode === 'image-to-video' ? uploadedImage : undefined,
          aspectRatio,
          resolution: '720p',
        }),
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to start video generation.');
      }

      const opName = data.operationName;
      setOperationName(opName);
      setStatusMessage('Veo 3 is rendering frames & synthesizing temporal coherence...');

      // Begin polling status
      pollOperation(opName);
    } catch (err: unknown) {
      console.error('Generation request failed:', err);
      setIsGenerating(false);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      const msg = err instanceof Error ? err.message : 'Video generation failed to start.';
      setErrorMessage(msg);
    }
  };

  const pollOperation = (opName: string) => {
    if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);

    let attempts = 0;
    pollingTimerRef.current = setInterval(async () => {
      attempts++;

      // Reassuring dynamic progress messages
      if (attempts === 3) {
        setStatusMessage('Deep motion modeling and fluid camera synthesis...');
      } else if (attempts === 6) {
        setStatusMessage('Refining visual fidelity and temporal consistency...');
      } else if (attempts === 10) {
        setStatusMessage('Finalizing MP4 video encoding and preparing download stream...');
      }

      try {
        const res = await fetch('/api/veo/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operationName: opName }),
        });

        const statusData = await res.json();
        if (statusData.error) {
          throw new Error(statusData.error.message || 'Error occurred during generation.');
        }

        if (statusData.done) {
          if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
          setStatusMessage('Generation complete! Fetching video stream...');
          downloadGeneratedVideo(opName);
        }
      } catch (err: unknown) {
        console.warn('Polling error:', err);
        // Do not fail immediately on one transient polling network error, retry next tick
        if (attempts > 30) {
          if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
          setIsGenerating(false);
          if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
          setErrorMessage('Video generation timed out or could not be verified. Please retry.');
        }
      }
    }, 4000);
  };

  const downloadGeneratedVideo = async (opName: string) => {
    try {
      const res = await fetch('/api/veo/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operationName: opName }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to download generated video.');
      }

      const blob = await res.blob();
      const localUrl = URL.createObjectURL(blob);
      setVideoUrl(localUrl);
      setIsGenerating(false);
      setStatusMessage('');
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    } catch (err: unknown) {
      console.error('Download video failed:', err);
      setIsGenerating(false);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      const msg = err instanceof Error ? err.message : 'Failed to retrieve generated video file.';
      setErrorMessage(msg);
    }
  };

  const handleDownloadMp4 = () => {
    if (!videoUrl) return;
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = `veo-video-${aspectRatio === '16:9' ? 'landscape' : 'portrait'}-${Date.now()}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleReset = () => {
    setIsGenerating(false);
    setVideoUrl(null);
    setErrorMessage(null);
    setStatusMessage('');
    setElapsedSeconds(0);
    if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-[#12141a] border border-[#262b36] rounded-2xl shadow-2xl text-foreground overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#262b36] bg-[#161922]">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shadow-md shadow-emerald-500/20">
              <Film className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">AI Video Studio (Veo 3)</h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  veo-3.1-fast-generate-preview
                </span>
              </div>
              <p className="text-xs text-[#8e98a8]">
                Animate photos into videos or generate video directly from text prompts
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-[#8e98a8] hover:text-white hover:bg-[#202531] transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
              <div className="flex-1">
                <span className="font-semibold block mb-0.5">Generation Notice</span>
                {errorMessage}
              </div>
            </div>
          )}

          {/* If video is finished, show video player */}
          {videoUrl ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> Video Successfully Generated
                </span>
                <span className="text-xs font-mono text-[#8e98a8]">
                  Aspect Ratio: {aspectRatio} • {aspectRatio === '16:9' ? 'Landscape' : 'Portrait'}
                </span>
              </div>

              <div
                className={`w-full mx-auto rounded-xl overflow-hidden bg-black border border-[#262b36] shadow-xl flex items-center justify-center ${
                  aspectRatio === '16:9' ? 'aspect-video max-h-[380px]' : 'aspect-[9/16] max-h-[460px]'
                }`}
              >
                <video
                  src={videoUrl}
                  controls
                  autoPlay
                  loop
                  playsInline
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleDownloadMp4}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition active:scale-[0.99]"
                >
                  <Download className="h-4 w-4" />
                  <span>Download MP4 Video</span>
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="py-2.5 px-4 rounded-xl bg-[#1c202a] hover:bg-[#252b38] text-white border border-[#2d3444] text-xs font-medium flex items-center gap-1.5 transition"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Generate Another</span>
                </button>
              </div>
            </div>
          ) : isGenerating ? (
            /* Generating in progress view */
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="h-16 w-16 rounded-full border-4 border-emerald-500/20 border-t-emerald-400 animate-spin" />
                <Sparkles className="h-6 w-6 text-emerald-400 absolute inset-0 m-auto animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">Generating Video with Veo 3</h3>
                <p className="text-xs text-[#8e98a8] max-w-md mx-auto">{statusMessage}</p>
              </div>
              <div className="inline-flex items-center gap-2 font-mono text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Elapsed: {elapsedSeconds}s</span>
              </div>
              <p className="text-[11px] text-[#6b7687] max-w-sm pt-2">
                High-quality video synthesis usually takes between 60 to 120 seconds. Please keep this modal open.
              </p>
            </div>
          ) : (
            /* Configuration & Input Form */
            <div className="space-y-5">
              {/* Mode Toggle */}
              <div className="flex p-1 bg-[#161922] rounded-xl border border-[#262b36]">
                <button
                  type="button"
                  onClick={() => setMode('image-to-video')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition ${
                    mode === 'image-to-video'
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                      : 'text-[#8e98a8] hover:text-white'
                  }`}
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                  <span>Animate Photo / Image</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('text-to-video')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition ${
                    mode === 'text-to-video'
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                      : 'text-[#8e98a8] hover:text-white'
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Generate from Text</span>
                </button>
              </div>

              {/* Aspect Ratio Selection */}
              <div>
                <label className="text-xs font-semibold text-[#8e98a8] block mb-2">
                  Aspect Ratio <span className="text-rose-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAspectRatio('16:9')}
                    className={`p-3 rounded-xl border flex items-center gap-3 transition text-left ${
                      aspectRatio === '16:9'
                        ? 'border-emerald-500 bg-emerald-500/10 text-white ring-1 ring-emerald-500/40'
                        : 'border-[#262b36] bg-[#161922] text-[#8e98a8] hover:border-[#384050] hover:text-white'
                    }`}
                  >
                    <div className="h-8 w-12 rounded border border-current flex items-center justify-center text-[10px] font-mono shrink-0">
                      16:9
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">16:9 Landscape</div>
                      <div className="text-[10px] text-[#8e98a8]">Desktop, YouTube, Cinema format</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAspectRatio('9:16')}
                    className={`p-3 rounded-xl border flex items-center gap-3 transition text-left ${
                      aspectRatio === '9:16'
                        ? 'border-emerald-500 bg-emerald-500/10 text-white ring-1 ring-emerald-500/40'
                        : 'border-[#262b36] bg-[#161922] text-[#8e98a8] hover:border-[#384050] hover:text-white'
                    }`}
                  >
                    <div className="h-10 w-7 rounded border border-current flex items-center justify-center text-[10px] font-mono shrink-0">
                      9:16
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">9:16 Portrait</div>
                      <div className="text-[10px] text-[#8e98a8]">TikTok, Instagram Reels, Shorts</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Photo Upload / Canvas Capture Section (Image-to-Video) */}
              {mode === 'image-to-video' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[#8e98a8]">
                      Starting Photo / Artwork <span className="text-rose-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleCaptureCanvas}
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      <span>Capture SVG Canvas</span>
                    </button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />

                  {uploadedImage ? (
                    <div className="p-3 bg-[#161922] rounded-xl border border-[#262b36] flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={uploadedImage}
                          alt="Starting frame preview"
                          className="h-14 w-14 rounded-lg object-cover border border-[#2e3442] shrink-0 bg-black/40"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{imageName || 'Selected Image'}</p>
                          <p className="text-[10px] text-emerald-400">Ready for Veo animation</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="py-1.5 px-3 rounded-lg bg-[#202531] hover:bg-[#2a3040] text-xs font-medium text-white transition"
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setUploadedImage(null);
                            setImageName('');
                          }}
                          className="p-1.5 rounded-lg text-[#8e98a8] hover:text-rose-400 hover:bg-rose-500/10 transition"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="p-6 rounded-xl border-2 border-dashed border-[#2d3444] hover:border-emerald-500/60 bg-[#161922] hover:bg-[#1a1e28] transition cursor-pointer flex flex-col items-center justify-center text-center space-y-2 group"
                    >
                      <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition">
                        <Upload className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">Click to upload a photo</p>
                        <p className="text-[10px] text-[#8e98a8]">PNG, JPG, or WEBP up to 10MB</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Text Prompt Section */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#8e98a8] block">
                  Motion & Scene Prompt {mode === 'text-to-video' && <span className="text-rose-400">*</span>}
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={
                    mode === 'image-to-video'
                      ? 'Describe how this photo should move (e.g. "Gentle wind rustling hair, camera slowly zooms in, golden sunset lighting")...'
                      : 'Describe the scene to generate (e.g. "A futuristic holographic astronaut drifting in colorful nebula space with cinematic lighting")...'
                  }
                  rows={3}
                  className="w-full p-3 rounded-xl bg-[#161922] border border-[#262b36] focus:border-emerald-500 focus:outline-none text-xs text-white placeholder-[#5a6475] resize-none"
                />

                {/* Prompt Suggestions */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {PROMPT_SUGGESTIONS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setPrompt(preset)}
                      className="text-[10px] px-2.5 py-1 rounded-full bg-[#1b1f2a] hover:bg-[#252b3a] text-[#8e98a8] hover:text-white border border-[#2d3444] transition"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Model Info Pill */}
              <div className="p-3 rounded-xl bg-[#161922] border border-[#262b36] flex items-center justify-between text-xs">
                <span className="text-[#8e98a8] flex items-center gap-1.5">
                  <Film className="h-3.5 w-3.5 text-emerald-400" />
                  Veo Model
                </span>
                <span className="font-mono text-emerald-400 font-bold">veo-3.1-fast-generate-preview</span>
              </div>

              {/* Submit CTA */}
              <button
                type="button"
                onClick={handleStartGeneration}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition active:scale-[0.99]"
              >
                <Sparkles className="h-4 w-4" />
                <span>
                  {mode === 'image-to-video' ? 'Animate Photo with Veo 3' : 'Generate Video from Prompt'}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
