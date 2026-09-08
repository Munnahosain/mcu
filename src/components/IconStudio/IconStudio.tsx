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
  Sparkles,
  Trash2,
  Upload,
  X,
  Palette,
} from "lucide-react";
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import ThemeToggle from "@/components/ThemeToggle";

export type MaterialKind = "glass" | "plastic" | "glossy" | "frosted" | "metallic" | "iridescent";
export type Resolution = "1K" | "2K" | "4K";
export type ArtboardMode = "fit" | "custom";
export type ExportFormat = "png" | "webp";
export type ColorMode = "svg" | "custom";

export type IconAsset = {
  id: string;
  name: string;
  text: string;
  preview: string;
};

export type StudioControls = {
  color: string;
  colorMode: ColorMode; // "svg" (preserve original SVG colors) vs "custom" (palette tint)
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

// High-Fidelity Samples matching user's reference styles (Liquid Glass, 3D Plastic, Multi-color)
const sampleSvgCursor = `<svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <path fill="#0284c7" d="M24 16 L24 96 L46 76 L68 116 L84 106 L62 66 L94 66 Z"/>
  <path fill="#38bdf8" d="M30 26 L30 84 L48 68 L66 102 L76 96 L58 60 L82 60 Z"/>
</svg>`;

const sampleSvgCheck = `<svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <path fill="#0284c7" d="M18 64 L46 94 L110 26 L94 14 L46 68 L32 52 Z"/>
</svg>`;

const sampleSvgCoins = `<svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <circle fill="#0284c7" cx="64" cy="64" r="52"/>
  <circle fill="#38bdf8" cx="64" cy="64" r="42"/>
  <path fill="#ffffff" d="M60 36 h8 v6 c8 1 14 6 15 13 h-8 c-1-4-4-6-8-6 -5 0-8 3-8 6 0 4 3 6 10 8 9 3 14 6 14 14 0 7-6 12-13 13 v6 h-8 v-6 c-8-1-15-7-16-15 h9 c1 4 4 8 9 8 5 0 8-3 8-7 0-4-3-6-10-8 -9-3-14-6-14-14 0-7 6-12 13-13 v-6 Z"/>
</svg>`;

const sampleSvgChat = `<svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <path fill="#0ea5e9" d="M52 24 C28 24 12 38 12 56 C12 66 18 75 28 81 L24 98 L44 87 C46 88 49 88 52 88 C76 88 92 74 92 56 C92 38 76 24 52 24 Z"/>
  <path fill="#f97316" d="M78 50 C60 50 46 62 46 76 C46 84 51 91 58 96 L55 110 L71 101 C73 102 75 102 78 102 C96 102 110 90 110 76 C110 62 96 50 78 50 Z"/>
  <path fill="#ffffff" d="M76 62 c4 0 7 3 7 7 0 3-2 5-5 6 v3 h-4 v-4 c0-3 2-4 4-5 1-1 2-2 2-3 0-2-1-3-4-3 -2 0-3 1-4 3 l-3-2 c2-3 4-4 7-4 Z M74 82 h4 v4 h-4 Z"/>
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
  plastic: "3D Plastic",
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
  color: "#3b82f6",
  colorMode: "svg", // Default to authentic SVG native colors
  material: "glass",
  depth: 22,
  bevel: 2.8,
  roughness: 12,
  brightness: 110,
  artboardMode: "fit",
  customSize: 1024,
  resolution: "1K",
  tiltX: -16,
  tiltY: 22,
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

/**
 * Extract authentic fill color from SVG path
 */
function parseColorFromPath(path: any, fallbackHex: string): string {
  if (path.userData?.style?.fill && path.userData.style.fill !== "none" && path.userData.style.fill !== "currentColor") {
    const f = path.userData.style.fill;
    if (f.startsWith("#")) return f;
    if (f.startsWith("rgb")) {
      const c = new THREE.Color(f);
      return `#${c.getHexString()}`;
    }
  }
  if (path.color && typeof path.color.getHexString === "function") {
    const hex = `#${path.color.getHexString()}`;
    if (hex !== "#000000") return hex;
  }
  return fallbackHex;
}

/**
 * Ultra-Realistic Physically-Based Material Generator
 */
function makeMaterial(controls: StudioControls, pathHexColor?: string) {
  const hex = controls.colorMode === "svg" && pathHexColor ? pathHexColor : controls.color;
  const baseColor = new THREE.Color(hex).multiplyScalar(controls.brightness / 100);
  const roughness = controls.roughness / 100;

  if (controls.material === "glass") {
    // 🌟 Ultra-Realistic Liquid Glass (Apple VisionOS / Octane Glass style)
    return new THREE.MeshPhysicalMaterial({
      color: baseColor,
      transmission: 0.94,
      transparent: true,
      opacity: 1.0,
      roughness: Math.max(0.01, roughness * 0.16),
      ior: 1.52, // Optical Crown Glass IOR
      thickness: Math.max(1.6, controls.depth * 0.28), // Volumetric depth refraction
      specularIntensity: 1.0,
      specularColor: new THREE.Color(0xffffff),
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      attenuationColor: baseColor,
      attenuationDistance: 2.2, // Deep internal volumetric color gradient
      metalness: 0.0,
      reflectivity: 0.85,
    });
  }

  if (controls.material === "plastic") {
    // 🌟 Realistic 3D Molded / Vinyl Plastic with protective gloss & sheen
    return new THREE.MeshPhysicalMaterial({
      color: baseColor,
      roughness: Math.max(0.14, roughness * 0.52),
      metalness: 0.0,
      clearcoat: 0.88, // Glossy protective clearcoat
      clearcoatRoughness: 0.08,
      specularIntensity: 0.85,
      reflectivity: 0.55,
      sheen: 0.35, // Soft micro-sheen on curved plastic surfaces
      sheenRoughness: 0.28,
      sheenColor: baseColor.clone().offsetHSL(0, 0, 0.08),
    });
  }

  if (controls.material === "glossy") {
    // 🌟 Ultra-Reflective Enamel / Glossy Lacquer
    return new THREE.MeshPhysicalMaterial({
      color: baseColor,
      roughness: Math.max(0.03, roughness * 0.12),
      metalness: 0.04,
      clearcoat: 1.0,
      clearcoatRoughness: 0.015,
      specularIntensity: 1.0,
      specularColor: new THREE.Color(0xffffff),
      reflectivity: 0.92,
    });
  }

  if (controls.material === "frosted") {
    // 🌟 Frosted Translucent Matte Glass
    return new THREE.MeshPhysicalMaterial({
      color: baseColor,
      transmission: 0.78,
      transparent: true,
      opacity: 0.92,
      roughness: Math.max(0.38, roughness * 0.75),
      ior: 1.46,
      thickness: 2.4,
      clearcoat: 0.15,
      clearcoatRoughness: 0.45,
      attenuationColor: baseColor,
      attenuationDistance: 1.4,
    });
  }

  if (controls.material === "metallic") {
    // 🌟 Polished Chrome / Heavy Metal
    return new THREE.MeshStandardMaterial({
      color: baseColor,
      roughness: Math.max(0.12, roughness * 0.35),
      metalness: 0.96,
    });
  }

  if (controls.material === "iridescent") {
    // 🌟 Chameleon Holographic Sheen
    const mat = new THREE.MeshPhysicalMaterial({
      color: baseColor,
      roughness: Math.max(0.06, roughness * 0.2),
      metalness: 0.12,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
    });
    Object.assign(mat, {
      iridescence: 1.0,
      iridescenceIOR: 1.65,
      iridescenceThicknessRange: [120, 580],
    });
    return mat;
  }

  return new THREE.MeshStandardMaterial({ color: baseColor, roughness, metalness: 0.1 });
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

/**
 * 3D Icon Extrusion with Multi-color & Bevel Support
 */
async function createIconGroup(asset: IconAsset, controls: StudioControls) {
  const loader = new SVGLoader();
  const data = loader.parse(asset.text);
  const group = new THREE.Group();
  let shapeCount = 0;

  data.paths.forEach((path) => {
    const pathColor = parseColorFromPath(path, controls.color);
    const material = makeMaterial(controls, pathColor);
    const shapes = SVGLoader.createShapes(path);

    shapes.forEach((shape) => {
      const rawGeo = new THREE.ExtrudeGeometry(shape, {
        depth: controls.depth,
        bevelEnabled: controls.bevel > 0,
        bevelSize: controls.bevel,
        bevelThickness: controls.bevel,
        bevelSegments: Math.max(4, Math.round(controls.bevel * 2.5)),
        curveSegments: 64,
      });

      // Merge vertices to eliminate faceting and calculate smooth continuous normal vectors across curves
      const geometry = BufferGeometryUtils.mergeVertices(rawGeo, 0.001);
      rawGeo.dispose();
      geometry.computeVertexNormals();

      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData = { pathColor };
      group.add(mesh);
      shapeCount += 1;
    });
  });

  if (!shapeCount) {
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
  const scale = controls.artboardMode === "fit" ? 3.3 / largest : Math.min(3.3 / largest, controls.customSize / 1024);
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
    const controlsRefCurrent = useRef<StudioControls>(controls);
    controlsRefCurrent.current = controls;

    const clearIcon = useCallback(() => {
      if (!sceneRef.current || !iconRef.current) return;
      sceneRef.current.remove(iconRef.current);
      disposeObject(iconRef.current);
      iconRef.current = null;
    }, []);

    const loadIcon = useCallback(async (nextAsset: IconAsset, nextControls: StudioControls) => {
      if (!sceneRef.current) return;
      clearIcon();
      const group = await createIconGroup(nextAsset, nextControls);
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
      renderer.setClearColor(controls.alpha ? 0x000000 : 0x101116, controls.alpha ? 0 : 1);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      mount.appendChild(renderer.domElement);

      // 🌟 Studio IBL Environment Map Generator (Crucial for photo-realistic Glass & Plastic reflections!)
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      pmremGenerator.compileEquirectangularShader();
      const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTexture;

      // 🌟 Multi-Directional Studio Lighting for specular glass rims & bevels
      const keyLight = new THREE.DirectionalLight(0xffffff, 3.8);
      keyLight.position.set(4, 5, 6);
      scene.add(keyLight);

      const fillLight = new THREE.DirectionalLight(0xdbeafe, 2.2);
      fillLight.position.set(-4, 2, 4);
      scene.add(fillLight);

      // Specular Rim / Back Light (gives crisp glowing edges to glass)
      const rimLight = new THREE.DirectionalLight(0xffffff, 4.5);
      rimLight.position.set(0, 6, -4);
      scene.add(rimLight);

      const bounceLight = new THREE.DirectionalLight(0xf1f5f9, 1.6);
      bounceLight.position.set(0, -5, 2);
      scene.add(bounceLight);

      scene.add(new THREE.AmbientLight(0xffffff, 0.8));
      scene.add(new THREE.HemisphereLight(0xffffff, 0x1e293b, 1.2));

      const orbit = new OrbitControls(camera, renderer.domElement);
      orbit.enableDamping = true;
      orbit.dampingFactor = 0.08;
      orbit.enablePan = true;
      orbit.enableZoom = true;
      orbit.mouseButtons.LEFT = THREE.MOUSE.PAN;
      orbit.mouseButtons.RIGHT = THREE.MOUSE.PAN;
      orbit.minDistance = 3;
      orbit.maxDistance = 14;

      sceneRef.current = scene;
      cameraRef.current = camera;
      rendererRef.current = renderer;
      controlsRef.current = orbit;

      const handleContextMenu = (event: MouseEvent) => event.preventDefault();
      renderer.domElement.addEventListener("contextmenu", handleContextMenu);

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
        envTexture.dispose();
        pmremGenerator.dispose();
        renderer.domElement.removeEventListener("contextmenu", handleContextMenu);
        renderer.dispose();
        renderer.domElement.remove();
      };
    }, [clearIcon, onError]);

    // ⚡ Lightning-Fast 0ms Transform Updates (Tilt, Offset) - NO Geometry Rebuilding!
    useEffect(() => {
      if (!iconRef.current) return;
      iconRef.current.rotation.x = THREE.MathUtils.degToRad(controls.tiltX);
      iconRef.current.rotation.y = THREE.MathUtils.degToRad(controls.tiltY);
      iconRef.current.position.set(controls.offsetX / 55, -controls.offsetY / 55, 0);
    }, [controls.tiltX, controls.tiltY, controls.offsetX, controls.offsetY]);

    // ⚡ Lightning-Fast 0ms Material Updates (Roughness, Brightness, Color, Material Kind)
    useEffect(() => {
      if (!iconRef.current) return;
      iconRef.current.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) {
          const pathColor = mesh.userData?.pathColor || controls.color;
          const newMat = makeMaterial(controls, pathColor);
          if (mesh.material) {
            if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
            else mesh.material.dispose();
          }
          mesh.material = newMat;
        }
      });
    }, [controls.material, controls.color, controls.colorMode, controls.roughness, controls.brightness]);

    // ⚡ Instant 0ms Alpha Viewport Updates
    useEffect(() => {
      if (rendererRef.current) {
        rendererRef.current.setClearColor(controls.alpha ? 0x000000 : 0x101116, controls.alpha ? 0 : 1);
      }
    }, [controls.alpha]);

    // 🔄 Geometry Rebuild ONLY when Asset, Depth, Bevel, or Artboard Scale changes (Debounced at 60fps)
    useEffect(() => {
      if (!asset) {
        clearIcon();
        return;
      }
      let active = true;
      const timer = setTimeout(() => {
        if (!active) return;
        loadIcon(asset, controlsRefCurrent.current).catch((error: unknown) => {
          onError(error instanceof Error ? error.message : "Unable to load asset.");
        });
      }, 20);

      return () => {
        active = false;
        clearTimeout(timer);
      };
    }, [asset?.id, controls.depth, controls.bevel, controls.artboardMode, controls.customSize, clearIcon, loadIcon, onError]);

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
        const exportGroup = await createIconGroup(targetAsset, controls);
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
          }, format === "png" ? "image/png" : "image/webp", 0.98);
        });

        scene.remove(exportGroup);
        disposeObject(exportGroup);
        if (oldIcon) scene.add(oldIcon);
        renderer.setPixelRatio(previousPixelRatio);
        renderer.setSize(previousSize.x, previousSize.y, false);
        camera.aspect = previousSize.x / Math.max(1, previousSize.y);
        camera.updateProjectionMatrix();
        renderer.setClearColor(controls.alpha ? 0x000000 : 0x101116, controls.alpha ? 0 : 1);
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
  const safeVal = typeof value === "number" && !isNaN(value) ? value : min;
  const progress = `${Math.min(100, Math.max(0, ((safeVal - min) / (max - min)) * 100))}%`;

  return (
    <label className="block space-y-2">
      <span className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
        <span>{label}</span>
        <span className="text-foreground font-mono">{safeVal}{suffix}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={safeVal}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-primary cursor-pointer"
        style={{ "--range-progress": progress } as React.CSSProperties}
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
      const isSvg = file.name.toLowerCase().endsWith(".svg") || file.type === "image/svg+xml";
      if (!isSvg) {
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

  // Load High-Quality Sample Library
  const loadSamplePreset = (type: "cursor" | "coins" | "check" | "chat") => {
    let svgStr = sampleSvgCursor;
    let name = "liquid-glass-cursor.svg";
    if (type === "coins") {
      svgStr = sampleSvgCoins;
      name = "liquid-glass-coin.svg";
    } else if (type === "check") {
      svgStr = sampleSvgCheck;
      name = "liquid-glass-check.svg";
    } else if (type === "chat") {
      svgStr = sampleSvgChat;
      name = "3d-glass-chat-bubbles.svg";
    }

    const sample = {
      id: `sample-${Date.now()}`,
      name,
      text: svgStr,
      preview: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgStr)}`,
    };
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
    setControls((prev) => ({ ...prev, color, colorMode: "custom" }));
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

  // Automatically load the cursor sample on initial mount if assets list is empty
  useEffect(() => {
    if (assets.length === 0) {
      loadSamplePreset("cursor");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-full text-foreground font-sans">
      {/* 1. TOP HEADER BANNER */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-[var(--card-border)] bg-[var(--card-bg)] p-3.5 shadow-2xl backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/dashboard/generator" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--input-bg)] text-[var(--text-secondary)] hover:text-primary transition-all border border-[var(--card-border)]" aria-label="Home">
            <Home className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">3D Icon Studio PRO</p>
            <h1 className="truncate text-lg font-extrabold">{selectedAsset?.name || "No SVG selected"}</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ThemeToggle />
          <label className="flex h-11 items-center gap-2 rounded-2xl border border-[var(--card-border)] bg-[var(--input-bg)] px-3 text-xs font-bold text-[var(--text-secondary)] cursor-pointer">
            <input type="checkbox" checked={controls.alpha} onChange={(event) => updateControl("alpha", event.target.checked)} className="accent-primary cursor-pointer" />
            Alpha (Transparent)
          </label>
          <button onClick={() => void exportCurrent("png")} disabled={!selectedAsset} className="flex h-11 items-center gap-2 rounded-2xl bg-primary px-4 text-sm font-bold text-background disabled:opacity-40 shadow-[0_0_15px_rgba(22,199,132,0.3)] transition-all active:scale-[0.98]">
            <Download className="h-4 w-4" /> Download PNG
          </button>
        </div>
      </div>

      {/* 2. MAIN 2-COLUMN WORKSPACE */}
      <div className="grid min-h-[calc(100vh-12rem)] grid-cols-1 gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        {/* LEFT SIDEBAR: CONTROLS */}
        <aside className="order-2 space-y-4 xl:order-1 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto xl:pr-2 custom-scrollbar">
          {/* UPLOAD SVG & SAMPLES */}
          <section className="rounded-[24px] border border-[var(--card-border)] bg-[var(--card-bg)] p-5 space-y-3.5 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold">Upload SVG</h2>
                <p className="text-xs text-[var(--text-secondary)]">{assets.length}/{MAX_FILES} files</p>
              </div>
            </div>

            {/* Quick Realistic Samples */}
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              <button onClick={() => loadSamplePreset("cursor")} className="rounded-xl bg-primary/10 hover:bg-primary/20 px-2.5 py-1 text-xs font-bold text-primary transition-all">
                ✦ Glass Cursor
              </button>
              <button onClick={() => loadSamplePreset("coins")} className="rounded-xl bg-primary/10 hover:bg-primary/20 px-2.5 py-1 text-xs font-bold text-primary transition-all">
                ✦ Glass Coin
              </button>
              <button onClick={() => loadSamplePreset("check")} className="rounded-xl bg-primary/10 hover:bg-primary/20 px-2.5 py-1 text-xs font-bold text-primary transition-all">
                ✦ Checkmark
              </button>
              <button onClick={() => loadSamplePreset("chat")} className="rounded-xl bg-primary/10 hover:bg-primary/20 px-2.5 py-1 text-xs font-bold text-primary transition-all">
                ✦ Chat Bubbles
              </button>
            </div>

            <label
              onDragOver={(event) => event.preventDefault()}
              onDrop={onDrop}
              className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-[var(--input-bg)] p-4 text-center hover:border-primary/50 transition-all"
            >
              <Upload className="mb-2 h-6 w-6 text-primary" />
              <span className="text-xs font-bold">Choose SVG or drag files here</span>
              <span className="mt-1 text-[11px] text-[var(--text-muted)]">Preserves multi-color SVG shapes</span>
              <input type="file" accept=".svg,image/svg+xml" multiple className="sr-only" onChange={(event: ChangeEvent<HTMLInputElement>) => event.target.files && void addAssets(event.target.files)} />
            </label>

            {assets.length > 0 && (
              <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1 custom-scrollbar">
                {assets.map((asset) => (
                  <button key={asset.id} onClick={() => setSelectedId(asset.id)} className={`flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-all ${asset.id === selectedId ? "border-primary bg-primary/10 shadow-sm" : "border-[var(--card-border)] bg-[var(--input-bg)] hover:border-primary/30"}`}>
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/90 p-1.5 shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={asset.preview} alt="" className="max-h-full max-w-full" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-bold">{asset.name}</span>
                    {asset.id === selectedId && <Check className="h-4 w-4 text-primary shrink-0" />}
                    <span role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); removeAsset(asset.id); }} className="rounded-lg p-1 text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-400" aria-label={`Remove ${asset.name}`}>
                      <X className="h-3.5 w-3.5" />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* MATERIAL SELECTION */}
          <section className="rounded-[24px] border border-[var(--card-border)] bg-[var(--card-bg)] p-5 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-extrabold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> 3D Material
              </h2>
              <span className="text-[11px] font-bold text-primary uppercase">{materialLabels[controls.material]}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(materialLabels) as MaterialKind[]).map((kind) => (
                <button
                  key={kind}
                  onClick={() => updateControl("material", kind)}
                  className={`rounded-2xl px-3.5 py-2.5 text-center text-xs font-extrabold transition-all border ${
                    controls.material === kind
                      ? "border-2 border-primary bg-primary/20 text-primary shadow-[0_0_12px_rgba(22,199,132,0.25)] scale-[1.02]"
                      : "border-[var(--card-border)] bg-[var(--input-bg)] text-[var(--text-secondary)] hover:text-foreground"
                  }`}
                >
                  {materialLabels[kind]}
                </button>
              ))}
            </div>
          </section>

          {/* COLOR MANAGEMENT (SVG Colors vs Custom Palette) */}
          <section className="rounded-[24px] border border-[var(--card-border)] bg-[var(--card-bg)] p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-extrabold flex items-center gap-2">
                <Palette className="h-4 w-4 text-primary" /> Color Management
              </h2>
              <div className="flex bg-[var(--input-bg)] p-0.5 rounded-xl border border-[var(--card-border)]">
                <button
                  onClick={() => updateControl("colorMode", "svg")}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                    controls.colorMode === "svg"
                      ? "bg-primary text-background shadow"
                      : "text-[var(--text-secondary)] hover:text-foreground"
                  }`}
                  title="Preserve multiple native colors from SVG file"
                >
                  SVG Colors
                </button>
                <button
                  onClick={() => updateControl("colorMode", "custom")}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                    controls.colorMode === "custom"
                      ? "bg-primary text-background shadow"
                      : "text-[var(--text-secondary)] hover:text-foreground"
                  }`}
                  title="Override all shapes with custom color tint"
                >
                  Custom
                </button>
              </div>
            </div>

            {controls.colorMode === "svg" ? (
              <div className="bg-[var(--input-bg)] p-3 rounded-2xl border border-[var(--card-border)] text-xs text-[var(--text-secondary)] space-y-1">
                <p className="font-bold text-foreground flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-primary" /> Native Multi-Color Mode Active
                </p>
                <p className="text-[11px] leading-relaxed">
                  Every shape renders with its exact SVG fill color using the selected <strong className="text-primary">{materialLabels[controls.material]}</strong> material.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-1.5">
                  {presetColors.map(([label, color]) => (
                    <button
                      key={color}
                      onClick={() => updateColor(color)}
                      className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all border ${
                        controls.color === color
                          ? "border-2 border-primary bg-primary/20 text-primary shadow-sm"
                          : "border-[var(--card-border)] bg-[var(--input-bg)] text-[var(--text-secondary)] hover:text-foreground"
                      }`}
                    >
                      <span className="h-3 w-3 rounded-full border border-white/20 shrink-0" style={{ backgroundColor: color }} />
                      <span className="truncate">{label}</span>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={controls.color}
                    onChange={(event) => updateColor(event.target.value)}
                    className="h-10 w-12 rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] p-1 cursor-pointer"
                    aria-label="Custom color picker"
                  />
                  <input
                    value={hexDraft}
                    onChange={(event) => {
                      const next = event.target.value;
                      setHexDraft(next);
                      const hex = sanitizeHex(next);
                      if (hex) updateColor(hex);
                    }}
                    onBlur={() => setHexDraft(sanitizeHex(hexDraft) || controls.color)}
                    className="h-10 min-w-0 flex-1 rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] px-3 text-xs font-mono font-bold uppercase outline-none focus:border-primary"
                    aria-label="HEX color"
                  />
                </div>
              </div>
            )}
          </section>

          {/* SHAPE & FINISH */}
          <section className="space-y-4 rounded-[24px] border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-xl">
            <h2 className="text-base font-extrabold">Shape & Finish</h2>
            <Slider label="Depth (Thickness)" min={2} max={60} value={controls.depth} onChange={(value) => updateControl("depth", value)} />
            <Slider label="Edge Bevel Roundness" min={0} max={8} step={0.1} value={controls.bevel} onChange={(value) => updateControl("bevel", value)} />
            <Slider label="Roughness" min={0} max={100} suffix="%" value={controls.roughness} onChange={(value) => updateControl("roughness", value)} />
            <Slider label="Brightness" min={50} max={160} suffix="%" value={controls.brightness} onChange={(value) => updateControl("brightness", value)} />
          </section>

          {/* ARTBOARD & VIEW */}
          <section className="space-y-4 rounded-[24px] border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-xl">
            <h2 className="text-base font-extrabold">Artboard & View</h2>
            <div className="grid grid-cols-2 gap-2">
              {(["fit", "custom"] as ArtboardMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => updateControl("artboardMode", mode)}
                  className={`rounded-xl px-3 py-2 text-xs font-bold transition-all border ${
                    controls.artboardMode === mode
                      ? "border-2 border-primary bg-primary/20 text-primary shadow-sm"
                      : "border-[var(--card-border)] bg-[var(--input-bg)] text-[var(--text-secondary)] hover:text-foreground"
                  }`}
                >
                  {mode === "fit" ? "Fit to Icon" : "Custom Size"}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(["1K", "2K", "4K"] as Resolution[]).map((resolution) => (
                <button
                  key={resolution}
                  onClick={() => updateControl("resolution", resolution)}
                  className={`rounded-xl px-3 py-2 text-xs font-bold transition-all border ${
                    controls.resolution === resolution
                      ? "border-2 border-primary bg-primary/20 text-primary shadow-sm"
                      : "border-[var(--card-border)] bg-[var(--input-bg)] text-[var(--text-secondary)] hover:text-foreground"
                  }`}
                >
                  {resolution} ({resolutionSize[resolution]}px)
                </button>
              ))}
            </div>
            <Slider label="Tilt X" min={-80} max={80} value={controls.tiltX} onChange={(value) => updateControl("tiltX", value)} />
            <Slider label="Tilt Y" min={-80} max={80} value={controls.tiltY} onChange={(value) => updateControl("tiltY", value)} />
            <Slider label="Offset X" min={-120} max={120} value={controls.offsetX} onChange={(value) => updateControl("offsetX", value)} />
            <Slider label="Offset Y" min={-120} max={120} value={controls.offsetY} onChange={(value) => updateControl("offsetY", value)} />
            <button
              onClick={() => {
                setControls((current) => ({ ...current, tiltX: defaultControls.tiltX, tiltY: defaultControls.tiltY, offsetX: 0, offsetY: 0 }));
                previewRef.current?.resetView();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--card-border)] bg-[var(--input-bg)] hover:bg-[var(--card-bg)] py-3 text-xs font-bold transition-all"
            >
              <RotateCcw className="h-4 w-4" /> Reset 3D View Angle
            </button>
          </section>
        </aside>

        {/* RIGHT MAIN PANEL: INTERACTIVE 3D PREVIEW */}
        <main className="order-1 flex min-h-[620px] flex-col rounded-[28px] border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-2xl xl:sticky xl:top-4 xl:order-2 xl:h-[calc(100vh-7rem)]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--input-bg)] text-primary">
                <Box className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-extrabold text-base">Photorealistic 3D Live Preview</h2>
                <p className="text-xs text-[var(--text-secondary)]">Rotate, pan & zoom with studio lighting reflections.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => void exportCurrent("webp")} disabled={!selectedAsset} className="flex items-center gap-2 rounded-2xl border border-[var(--card-border)] bg-[var(--input-bg)] hover:bg-[var(--card-bg)] px-4 py-2.5 text-xs font-bold transition-all disabled:opacity-40">
                <FileImage className="h-4 w-4 text-primary" /> WebP
              </button>
              <button onClick={() => void exportBatch()} disabled={!assets.length || batch.running} className="flex items-center gap-2 rounded-2xl border border-primary/35 bg-primary/10 hover:bg-primary/20 px-4 py-2.5 text-xs font-bold text-primary transition-all disabled:opacity-40">
                {batch.running ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />} Batch ZIP ({assets.length})
              </button>
              {batch.running && (
                <button onClick={() => { cancelBatch.current = true; }} className="flex items-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs font-bold text-red-300">
                  <Trash2 className="h-4 w-4" /> Cancel
                </button>
              )}
            </div>
          </div>

          {/* 3D WebGL Viewport Container */}
          <div
            className="relative flex-1 w-full overflow-hidden rounded-[24px] border border-dashed border-white/10 flex items-center justify-center"
            style={{
              backgroundColor: controls.alpha ? "#16181f" : "#101116",
              backgroundImage: controls.alpha
                ? "linear-gradient(45deg, rgba(255,255,255,0.06) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.06) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.06) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.06) 75%)"
                : "none",
              backgroundPosition: "0 0, 0 12px, 12px -12px, -12px 0px",
              backgroundSize: "24px 24px",
            }}
          >
            {selectedAsset ? (
              <IconPreview ref={previewRef} asset={selectedAsset} controls={controls} onError={setError} />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
                <ImageIcon className="mb-4 h-16 w-16 text-[var(--text-muted)]" />
                <h3 className="text-lg font-extrabold">Upload an SVG to begin</h3>
                <p className="mt-1 max-w-sm text-xs text-[var(--text-secondary)]">Your photorealistic 3D render with reflections will appear here.</p>
              </div>
            )}
          </div>

          {(error || batch.running || batch.completed > 0 || batch.failed > 0) && (
            <div className="mt-3 rounded-2xl border border-[var(--card-border)] bg-[var(--input-bg)] p-3 text-xs">
              {error && <p className="font-bold text-red-400">{error}</p>}
              {(batch.running || batch.completed > 0 || batch.failed > 0) && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                    <span>{batch.running ? `Processing ${batch.current}` : "Batch Complete"}</span>
                    <span>{batch.completed} done / {batch.failed} failed</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${assets.length ? ((batch.completed + batch.failed) / assets.length) * 100 : 0}%` }} />
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
