"use client";

import { ChangeEvent, DragEvent, forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import Link from "next/link";
import {
  Box,
  Check,
  Download,
  FileArchive,
  FileImage,
  Home,
  Image as ImageIcon,
  Loader2,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import ThemeToggle from "@/components/ThemeToggle";

type MaterialKind = "glass" | "glossy" | "frosted" | "metallic" | "iridescent";
type Resolution = "1K" | "2K" | "4K";
type ArtboardMode = "fit" | "custom";
type ExportFormat = "png" | "webp";

type IconAsset = {
  id: string;
  name: string;
  text: string;
  preview: string;
};

type StudioControls = {
  color: string;
  material: MaterialKind;
  depth: number;
  bevel: number;
  roughness: number;
  brightness: number;
  artboardMode: ArtboardMode;
  customSize: number;
  resolution: Resolution;
  tiltX: number;
  tiltY: number;
  offsetX: number;
  offsetY: number;
  alpha: boolean;
};

type BatchStatus = {
  running: boolean;
  current: string;
  completed: number;
  failed: number;
};

type PreviewHandle = {
  exportBlob: (asset: IconAsset, format: ExportFormat, resolution: Resolution) => Promise<Blob>;
  resetView: () => void;
};

const MAX_FILES = 500;
const MAX_FILE_SIZE = 2 * 1024 * 1024;

const sampleSvg = `<svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <path d="M64 10 116 40v48l-52 30-52-30V40L64 10Z"/>
  <path d="M64 34 92 50v28L64 94 36 78V50l28-16Z"/>
</svg>`;

const presetColors = [
  ["Blue", "#3b82f6"],
  ["Cyan", "#06b6d4"],
  ["Purple", "#8b5cf6"],
  ["Pink", "#ec4899"],
  ["Green", "#16c784"],
  ["Orange", "#f97316"],
  ["Red", "#ef4444"],
  ["White", "#ffffff"],
];

const materialLabels: Record<MaterialKind, string> = {
  glass: "Liquid Glass",
  glossy: "Glossy",
  frosted: "Frosted",
  metallic: "Metallic",
  iridescent: "Iridescent",
};

const resolutionSize: Record<Resolution, number> = {
  "1K": 1024,
  "2K": 2048,
  "4K": 4096,
};

const defaultControls: StudioControls = {
  color: "#16c784",
  material: "glass",
  depth: 18,
  bevel: 2.2,
  roughness: 18,
  brightness: 105,
  artboardMode: "fit",
  customSize: 1024,
  resolution: "1K",
  tiltX: -18,
  tiltY: 24,
  offsetX: 0,
  offsetY: 0,
  alpha: true,
};

function sanitizeHex(value: string) {
  const hex = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex}`;
  return null;
}

function makeMaterial(controls: StudioControls) {
  const color = new THREE.Color(controls.color).multiplyScalar(controls.brightness / 100);
  const roughness = controls.roughness / 100;

  if (controls.material === "glass") {
    return new THREE.MeshPhysicalMaterial({
      color,
      roughness,
      metalness: 0,
      transmission: 0.72,
      transparent: true,
      opacity: 0.76,
      thickness: 2.4,
      ior: 1.45,
      clearcoat: 1,
      clearcoatRoughness: Math.min(0.32, roughness),
    });
  }

  if (controls.material === "metallic") {
    return new THREE.MeshStandardMaterial({ color, roughness: Math.min(0.32, roughness), metalness: 0.92 });
  }

  if (controls.material === "frosted") {
    return new THREE.MeshPhysicalMaterial({
      color,
      roughness: Math.max(0.52, roughness),
      transmission: 0.32,
      transparent: true,
      opacity: 0.72,
      thickness: 1.8,
      clearcoat: 0.45,
    });
  }

  if (controls.material === "iridescent") {
    const material = new THREE.MeshPhysicalMaterial({
      color,
      roughness: Math.min(0.26, roughness),
      metalness: 0.18,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
    });
    Object.assign(material, { iridescence: 1, iridescenceIOR: 1.7, iridescenceThicknessRange: [120, 520] });
    return material;
  }

  return new THREE.MeshPhysicalMaterial({ color, roughness: Math.min(0.22, roughness), metalness: 0.04, clearcoat: 1, clearcoatRoughness: 0.06 });
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach((item) => item.dispose());
    else material?.dispose?.();
  });
}

function createIconGroup(svgText: string, controls: StudioControls) {
  const loader = new SVGLoader();
  const data = loader.parse(svgText);
  const material = makeMaterial(controls);
  const group = new THREE.Group();
  let shapeCount = 0;

  data.paths.forEach((path) => {
    const shapes = SVGLoader.createShapes(path);
    shapes.forEach((shape) => {
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: controls.depth,
        bevelEnabled: controls.bevel > 0,
        bevelSize: controls.bevel,
        bevelThickness: controls.bevel,
        bevelSegments: Math.max(1, Math.round(controls.bevel * 2)),
        curveSegments: 18,
      });
      const mesh = new THREE.Mesh(geometry, material);
      group.add(mesh);
      shapeCount += 1;
    });
  });

  if (!shapeCount) {
    material.dispose();
    throw new Error("No supported SVG shapes found.");
  }

  const box = new THREE.Box3().setFromObject(group);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  group.children.forEach((child) => {
    const mesh = child as THREE.Mesh;
    mesh.geometry.translate(-center.x, -center.y, -center.z);
  });

  const largest = Math.max(size.x, size.y, size.z, 1);
  const scale = controls.artboardMode === "fit" ? 3.2 / largest : Math.min(3.2 / largest, controls.customSize / 1024);
  group.scale.set(scale, -scale, scale);
  group.rotation.x = THREE.MathUtils.degToRad(controls.tiltX);
  group.rotation.y = THREE.MathUtils.degToRad(controls.tiltY);
  group.position.set(controls.offsetX / 55, -controls.offsetY / 55, 0);
  return group;
}

const IconPreview = forwardRef<PreviewHandle, { asset?: IconAsset; controls: StudioControls; onError: (error: string) => void }>(
  function IconPreview({ asset, controls, onError }, ref) {
    const mountRef = useRef<HTMLDivElement | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const iconRef = useRef<THREE.Group | null>(null);
    const frameRef = useRef<number | null>(null);
    const dragRef = useRef<{ x: number; y: number } | null>(null);

    const clearIcon = useCallback(() => {
      if (!sceneRef.current || !iconRef.current) return;
      sceneRef.current.remove(iconRef.current);
      disposeObject(iconRef.current);
      iconRef.current = null;
    }, []);

    const loadIcon = useCallback((svgText: string, nextControls: StudioControls) => {
      if (!sceneRef.current) return;
      clearIcon();
      const group = createIconGroup(svgText, nextControls);
      sceneRef.current.add(group);
      iconRef.current = group;
      onError("");
    }, [clearIcon, onError]);

    useEffect(() => {
      if (!mountRef.current) return;
      if (!window.WebGLRenderingContext) {
        onError("WebGL is not available in this browser.");
        return;
      }

      const mount = mountRef.current;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
      camera.position.set(0, 0, 7);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      mount.appendChild(renderer.domElement);

      scene.add(new THREE.AmbientLight(0xffffff, 1.45));
      scene.add(new THREE.HemisphereLight(0xffffff, 0x22242c, 1.15));
      const key = new THREE.DirectionalLight(0xffffff, 3.2);
      key.position.set(3.5, 4, 6);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0x16c784, 1.8);
      rim.position.set(-4, 2, -3);
      scene.add(rim);

      const orbit = new OrbitControls(camera, renderer.domElement);
      orbit.enableDamping = true;
      orbit.dampingFactor = 0.08;
      orbit.enablePan = true;
      orbit.minDistance = 3;
      orbit.maxDistance = 14;

      sceneRef.current = scene;
      cameraRef.current = camera;
      rendererRef.current = renderer;
      controlsRef.current = orbit;

      const handlePointerDown = (event: PointerEvent) => {
        if (event.button !== 0 || !iconRef.current) return;
        dragRef.current = { x: event.clientX, y: event.clientY };
        orbit.enabled = false;
        renderer.domElement.setPointerCapture(event.pointerId);
      };
      const handlePointerMove = (event: PointerEvent) => {
        if (!dragRef.current || !iconRef.current) return;
        const rect = mount.getBoundingClientRect();
        const scale = camera.position.z / Math.max(rect.width, rect.height);
        iconRef.current.position.x += (event.clientX - dragRef.current.x) * scale * 0.012;
        iconRef.current.position.y -= (event.clientY - dragRef.current.y) * scale * 0.012;
        dragRef.current = { x: event.clientX, y: event.clientY };
      };
      const handlePointerUp = (event: PointerEvent) => {
        if (!dragRef.current) return;
        dragRef.current = null;
        orbit.enabled = true;
        if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
      };
      renderer.domElement.addEventListener("pointerdown", handlePointerDown);
      renderer.domElement.addEventListener("pointermove", handlePointerMove);
      renderer.domElement.addEventListener("pointerup", handlePointerUp);

      const resize = () => {
        const rect = mount.getBoundingClientRect();
        renderer.setSize(Math.max(320, rect.width), Math.max(320, rect.height), false);
        camera.aspect = Math.max(1, rect.width) / Math.max(1, rect.height);
        camera.updateProjectionMatrix();
      };

      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(mount);

      const animate = () => {
        orbit.update();
        renderer.render(scene, camera);
        frameRef.current = requestAnimationFrame(animate);
      };
      animate();

      return () => {
        if (frameRef.current) cancelAnimationFrame(frameRef.current);
        observer.disconnect();
        clearIcon();
        orbit.dispose();
        renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
        renderer.domElement.removeEventListener("pointermove", handlePointerMove);
        renderer.domElement.removeEventListener("pointerup", handlePointerUp);
        renderer.dispose();
        renderer.domElement.remove();
      };
    }, [clearIcon, onError]);

    useEffect(() => {
      if (!asset) {
        clearIcon();
        return;
      }
      try {
        loadIcon(asset.text, controls);
      } catch (error) {
        onError(error instanceof Error ? error.message : "Unable to load SVG.");
      }
    }, [asset, controls, clearIcon, loadIcon, onError]);

    useImperativeHandle(ref, () => ({
      resetView: () => {
        if (!cameraRef.current || !controlsRef.current) return;
        cameraRef.current.position.set(0, 0, 7);
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
      },
      exportBlob: async (targetAsset, format, resolution) => {
        if (!sceneRef.current || !cameraRef.current || !rendererRef.current) throw new Error("Preview is not ready.");
        const renderer = rendererRef.current;
        const camera = cameraRef.current;
        const scene = sceneRef.current;
        const previousSize = new THREE.Vector2();
        renderer.getSize(previousSize);
        const previousPixelRatio = renderer.getPixelRatio();
        const oldIcon = iconRef.current;
        if (oldIcon) scene.remove(oldIcon);
        const exportGroup = createIconGroup(targetAsset.text, controls);
        scene.add(exportGroup);

        const size = resolutionSize[resolution];
        renderer.setPixelRatio(1);
        renderer.setSize(size, size, false);
        camera.aspect = 1;
        camera.updateProjectionMatrix();
        renderer.setClearColor(controls.alpha ? 0x000000 : 0x101116, controls.alpha ? 0 : 1);
        renderer.render(scene, camera);

        const blob = await new Promise<Blob>((resolve, reject) => {
          renderer.domElement.toBlob((result) => {
            if (result) resolve(result);
            else reject(new Error("Export failed."));
          }, format === "png" ? "image/png" : "image/webp", 0.96);
        });

        scene.remove(exportGroup);
        disposeObject(exportGroup);
        if (oldIcon) scene.add(oldIcon);
        renderer.setPixelRatio(previousPixelRatio);
        renderer.setSize(previousSize.x, previousSize.y, false);
        camera.aspect = previousSize.x / Math.max(1, previousSize.y);
        camera.updateProjectionMatrix();
        renderer.setClearColor(0x000000, 0);
        return blob;
      },
    }), [controls]);

    return <div ref={mountRef} className="absolute inset-0 cursor-grab active:cursor-grabbing" aria-label="Interactive 3D icon preview" />;
  }
);

function Slider({ label, value, min, max, step = 1, suffix = "", onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block space-y-2">
      <span className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
        <span>{label}</span>
        <span className="text-foreground">{value}{suffix}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-primary"
        aria-label={label}
      />
    </label>
  );
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function IconStudio() {
  const [assets, setAssets] = useState<IconAsset[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [controls, setControls] = useState<StudioControls>(defaultControls);
  const [hexDraft, setHexDraft] = useState(defaultControls.color);
  const [error, setError] = useState("");
  const [batch, setBatch] = useState<BatchStatus>({ running: false, current: "", completed: 0, failed: 0 });
  const cancelBatch = useRef(false);
  const previewRef = useRef<PreviewHandle | null>(null);
  const selectedAsset = assets.find((asset) => asset.id === selectedId);

  const addAssets = useCallback(async (files: FileList | File[]) => {
    const incoming = Array.from(files).slice(0, Math.max(0, MAX_FILES - assets.length));
    const parsed: IconAsset[] = [];
    for (const file of incoming) {
      if (!file.name.toLowerCase().endsWith(".svg") && file.type !== "image/svg+xml") {
        setError(`${file.name} is not an SVG file.`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        setError(`${file.name} is too large. Keep SVG files under 2MB.`);
        continue;
      }
      const text = await file.text();
      if (!text.includes("<svg")) {
        setError(`${file.name} does not look like a valid SVG.`);
        continue;
      }
      parsed.push({ id: `${Date.now()}-${file.name}-${parsed.length}`, name: file.name, text, preview: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}` });
    }
    if (!parsed.length) return;
    setAssets((current) => [...current, ...parsed].slice(0, MAX_FILES));
    setSelectedId((current) => current || parsed[0].id);
    setError("");
  }, [assets.length]);

  const loadSample = () => {
    const sample = { id: `sample-${Date.now()}`, name: "sample-cube.svg", text: sampleSvg, preview: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sampleSvg)}` };
    setAssets((current) => [sample, ...current].slice(0, MAX_FILES));
    setSelectedId(sample.id);
    setError("");
  };

  const removeAsset = (id: string) => {
    setAssets((current) => current.filter((asset) => asset.id !== id));
    if (selectedId === id) {
      const next = assets.find((asset) => asset.id !== id);
      setSelectedId(next?.id || "");
    }
  };

  const updateControl = <K extends keyof StudioControls>(key: K, value: StudioControls[K]) => {
    setControls((current) => ({ ...current, [key]: value }));
  };

  const updateColor = (color: string) => {
    setHexDraft(color);
    updateControl("color", color);
  };

  const exportCurrent = async (format: ExportFormat) => {
    if (!selectedAsset || !previewRef.current) return;
    try {
      const blob = await previewRef.current.exportBlob(selectedAsset, format, controls.resolution);
      saveBlob(blob, `${selectedAsset.name.replace(/\.svg$/i, "")}-3d.${format}`);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Export failed.");
    }
  };

  const exportBatch = async () => {
    if (!assets.length || !previewRef.current) return;
    cancelBatch.current = false;
    setBatch({ running: true, current: "", completed: 0, failed: 0 });
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      let completed = 0;
      let failed = 0;
      for (const asset of assets) {
        if (cancelBatch.current) break;
        setBatch({ running: true, current: asset.name, completed, failed });
        try {
          const blob = await previewRef.current.exportBlob(asset, "png", controls.resolution);
          zip.file(`${asset.name.replace(/\.svg$/i, "")}-3d.png`, blob);
          completed += 1;
        } catch {
          failed += 1;
        }
        setBatch({ running: true, current: asset.name, completed, failed });
      }
      const zipBlob = await zip.generateAsync({ type: "blob" });
      saveBlob(zipBlob, `3d-icons-${controls.resolution}.zip`);
    } catch (zipError) {
      setError(zipError instanceof Error ? zipError.message : "Batch export failed.");
    } finally {
      setBatch((current) => ({ ...current, running: false, current: "" }));
      cancelBatch.current = false;
    }
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    void addAssets(event.dataTransfer.files);
  };

  return (
    <div className="min-h-full text-foreground">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-[var(--card-border)] bg-[var(--card-bg)] p-3 shadow-2xl">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/dashboard/generator" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--input-bg)] text-[var(--text-secondary)] hover:text-primary" aria-label="Home">
            <Home className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">3D Icon Studio</p>
            <h1 className="truncate text-lg font-extrabold">{selectedAsset?.name || "No SVG selected"}</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ThemeToggle />
          <label className="flex h-11 items-center gap-2 rounded-2xl border border-[var(--card-border)] bg-[var(--input-bg)] px-3 text-xs font-bold text-[var(--text-secondary)]">
            <input type="checkbox" checked={controls.alpha} onChange={(event) => updateControl("alpha", event.target.checked)} className="accent-primary" />
            Alpha
          </label>
          <button onClick={() => void exportCurrent("png")} disabled={!selectedAsset} className="flex h-11 items-center gap-2 rounded-2xl bg-primary px-4 text-sm font-bold text-background disabled:opacity-40">
            <Download className="h-4 w-4" /> Download PNG
          </button>
        </div>
      </div>

      <div className="grid min-h-[calc(100vh-12rem)] grid-cols-1 gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="order-2 space-y-4 xl:order-1">
          <section className="rounded-[24px] border border-[var(--card-border)] bg-[var(--card-bg)] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold">Upload SVG</h2>
                <p className="text-xs text-[var(--text-secondary)]">{assets.length}/{MAX_FILES} files</p>
              </div>
              <button onClick={loadSample} className="rounded-full bg-primary/10 px-3 py-2 text-xs font-bold text-primary">Try a Sample</button>
            </div>
            <label
              onDragOver={(event) => event.preventDefault()}
              onDrop={onDrop}
              className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 bg-[var(--input-bg)] p-5 text-center hover:border-primary/50"
            >
              <Upload className="mb-3 h-7 w-7 text-primary" />
              <span className="text-sm font-bold">Choose SVG or drag files here</span>
              <span className="mt-1 text-xs text-[var(--text-muted)]">Supports path, rect, circle, ellipse, polygon and polyline</span>
              <input type="file" accept=".svg,image/svg+xml" multiple className="sr-only" onChange={(event: ChangeEvent<HTMLInputElement>) => event.target.files && void addAssets(event.target.files)} />
            </label>
            <div className="mt-4 max-h-60 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
              {assets.map((asset) => (
                <button key={asset.id} onClick={() => setSelectedId(asset.id)} className={`flex w-full items-center gap-3 rounded-2xl border p-2 text-left ${asset.id === selectedId ? "border-primary bg-primary/10" : "border-[var(--card-border)] bg-[var(--input-bg)] hover:border-primary/30"}`}>
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/90 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={asset.preview} alt="" className="max-h-full max-w-full" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{asset.name}</span>
                  {asset.id === selectedId && <Check className="h-4 w-4 text-primary" />}
                  <span role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); removeAsset(asset.id); }} className="rounded-lg p-1 text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-400" aria-label={`Remove ${asset.name}`}>
                    <X className="h-4 w-4" />
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-[24px] border border-[var(--card-border)] bg-[var(--card-bg)] p-5">
            <h2 className="mb-4 text-base font-extrabold">Color</h2>
            <div className="grid grid-cols-4 gap-2">
              {presetColors.map(([label, color]) => (
                <button key={color} onClick={() => updateColor(color)} className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold transition-all ${controls.color === color ? "border-2 border-primary bg-primary/20 text-primary shadow-[0_0_12px_rgba(22,199,132,0.25)]" : "border-0 bg-transparent text-[var(--text-secondary)] hover:text-primary"}`}>
                  <span className="h-3.5 w-3.5 rounded-full border border-white/20" style={{ backgroundColor: color }} />
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <input type="color" value={controls.color} onChange={(event) => updateColor(event.target.value)} className="h-11 w-14 rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] p-1" aria-label="Custom color picker" />
              <input
                value={hexDraft}
                onChange={(event) => {
                  const next = event.target.value;
                  setHexDraft(next);
                  const hex = sanitizeHex(next);
                  if (hex) updateControl("color", hex);
                }}
                onBlur={() => setHexDraft(sanitizeHex(hexDraft) || controls.color)}
                className="h-11 min-w-0 flex-1 rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] px-3 text-sm font-bold outline-none focus:border-primary"
                aria-label="HEX color"
              />
            </div>
          </section>

          <section className="rounded-[24px] border border-[var(--card-border)] bg-[var(--card-bg)] p-5">
            <h2 className="mb-4 text-base font-extrabold">Material</h2>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(materialLabels) as MaterialKind[]).map((kind) => (
                <button key={kind} onClick={() => updateControl("material", kind)} className={`rounded-full px-4 py-2.5 text-center text-sm font-bold transition-all ${controls.material === kind ? "border-2 border-primary bg-primary/20 text-primary shadow-[0_0_12px_rgba(22,199,132,0.25)]" : "border-0 bg-transparent text-[var(--text-secondary)] hover:text-primary"}`}>
                  {materialLabels[kind]}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-5 rounded-[24px] border border-[var(--card-border)] bg-[var(--card-bg)] p-5">
            <h2 className="text-base font-extrabold">Shape & Finish</h2>
            <Slider label="Depth" min={2} max={60} value={controls.depth} onChange={(value) => updateControl("depth", value)} />
            <Slider label="Edge Roundness" min={0} max={8} step={0.1} value={controls.bevel} onChange={(value) => updateControl("bevel", value)} />
            <Slider label="Roughness" min={0} max={100} suffix="%" value={controls.roughness} onChange={(value) => updateControl("roughness", value)} />
            <Slider label="Brightness" min={50} max={160} suffix="%" value={controls.brightness} onChange={(value) => updateControl("brightness", value)} />
          </section>

          <section className="space-y-5 rounded-[24px] border border-[var(--card-border)] bg-[var(--card-bg)] p-5">
            <h2 className="text-base font-extrabold">Artboard & View</h2>
            <div className="grid grid-cols-2 gap-2">
              {(["fit", "custom"] as ArtboardMode[]).map((mode) => (
                <button key={mode} onClick={() => updateControl("artboardMode", mode)} className={`rounded-full px-3 py-2 text-sm font-bold transition-all ${controls.artboardMode === mode ? "border-2 border-primary bg-primary/20 text-primary shadow-[0_0_12px_rgba(22,199,132,0.25)]" : "border-0 bg-transparent text-[var(--text-secondary)] hover:text-primary"}`}>
                  {mode === "fit" ? "Fit to Icon" : "Custom"}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(["1K", "2K", "4K"] as Resolution[]).map((resolution) => (
                <button key={resolution} onClick={() => updateControl("resolution", resolution)} className={`rounded-full px-3 py-2 text-sm font-bold transition-all ${controls.resolution === resolution ? "border-2 border-primary bg-primary/20 text-primary shadow-[0_0_12px_rgba(22,199,132,0.25)]" : "border-0 bg-transparent text-[var(--text-secondary)] hover:text-primary"}`}>
                  {resolution}
                </button>
              ))}
            </div>
            <Slider label="Tilt X" min={-80} max={80} value={controls.tiltX} onChange={(value) => updateControl("tiltX", value)} />
            <Slider label="Tilt Y" min={-80} max={80} value={controls.tiltY} onChange={(value) => updateControl("tiltY", value)} />
            <Slider label="Offset X" min={-120} max={120} value={controls.offsetX} onChange={(value) => updateControl("offsetX", value)} />
            <Slider label="Offset Y" min={-120} max={120} value={controls.offsetY} onChange={(value) => updateControl("offsetY", value)} />
            <button onClick={() => { setControls((current) => ({ ...current, tiltX: defaultControls.tiltX, tiltY: defaultControls.tiltY, offsetX: 0, offsetY: 0 })); previewRef.current?.resetView(); }} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--card-border)] bg-[var(--input-bg)] py-3 text-sm font-bold">
              <RotateCcw className="h-4 w-4" /> Reset View
            </button>
          </section>
        </aside>

        <main className="order-1 flex min-h-[620px] flex-col rounded-[28px] border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-2xl xl:order-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--input-bg)] text-primary"><Box className="h-5 w-5" /></span>
              <div>
                <h2 className="font-extrabold">Interactive Preview</h2>
                <p className="text-xs text-[var(--text-secondary)]">Rotate, zoom and pan directly on the canvas.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => void exportCurrent("webp")} disabled={!selectedAsset} className="flex items-center gap-2 rounded-2xl border border-[var(--card-border)] bg-[var(--input-bg)] px-4 py-3 text-sm font-bold disabled:opacity-40">
                <FileImage className="h-4 w-4" /> WebP
              </button>
              <button onClick={() => void exportBatch()} disabled={!assets.length || batch.running} className="flex items-center gap-2 rounded-2xl border border-primary/35 bg-primary/10 px-4 py-3 text-sm font-bold text-primary disabled:opacity-40">
                {batch.running ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />} Batch ZIP
              </button>
              {batch.running && (
                <button onClick={() => { cancelBatch.current = true; }} className="flex items-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-300">
                  <Trash2 className="h-4 w-4" /> Cancel
                </button>
              )}
            </div>
          </div>

          <div
            className="relative aspect-video w-full overflow-hidden rounded-[24px] border border-dashed border-white/10"
            style={{
              backgroundColor: "#1b1d23",
              backgroundImage:
                "linear-gradient(45deg, rgba(255,255,255,0.07) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.07) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.07) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.07) 75%)",
              backgroundPosition: "0 0, 0 12px, 12px -12px, -12px 0px",
              backgroundSize: "24px 24px",
            }}
          >
            {selectedAsset ? (
              <IconPreview ref={previewRef} asset={selectedAsset} controls={controls} onError={setError} />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <ImageIcon className="mb-4 h-16 w-16 text-[var(--text-muted)]" />
                <h3 className="text-xl font-extrabold">Upload an SVG to begin</h3>
                <p className="mt-2 max-w-md text-sm text-[var(--text-secondary)]">Your transparent 3D render will appear here.</p>
              </div>
            )}
          </div>

          {(error || batch.running || batch.completed > 0 || batch.failed > 0) && (
            <div className="mt-4 rounded-2xl border border-[var(--card-border)] bg-[var(--input-bg)] p-4 text-sm">
              {error && <p className="font-bold text-red-300">{error}</p>}
              {(batch.running || batch.completed > 0 || batch.failed > 0) && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                    <span>{batch.running ? `Processing ${batch.current}` : "Batch complete"}</span>
                    <span>{batch.completed} done / {batch.failed} failed</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${assets.length ? ((batch.completed + batch.failed) / assets.length) * 100 : 0}%` }} />
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
