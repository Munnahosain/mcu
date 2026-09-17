"use client";

import {
  ChangeEvent,
  DragEvent,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  Box,
  Check,
  Download,
  FileArchive,
  FileCode,
  FileImage,
  Home,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  Palette,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  X,
  Zap,
  Copy,
  CheckCheck,
  Video,
  Layers,
  Compass,
  Move,
  Rotate3d,
  Gauge,
  Crosshair,
  Timer,
} from "lucide-react";
import * as THREE from "three";
import { useRouter } from "next/navigation";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { downloadBlob, downloadText, copyBlobToClipboard } from "@/lib/downloadHelper";
import { readSessionValue, removeSessionValue } from "@/lib/safeStorage";
import SegmentedToggle from "@/components/ui/SegmentedToggle";

export type MaterialKind = "glass" | "plastic" | "glossy" | "frosted" | "metallic" | "iridescent";
export type Resolution = "1K" | "2K" | "4K" | "8K";
export type ArtboardMode = "fit" | "custom";
export type ExportFormat = "png" | "webp" | "svg" | "obj" | "gltf" | "mp4";
export type ColorMode = "svg" | "custom";
export type LightingPreset = "studio" | "softbox" | "rim" | "warm" | "cyber";
export type AnimationKind = "none" | "turntable" | "floating" | "wobble" | "pulse" | "swing" | "orbit" | "tilt" | "bob";

export type IconAsset = {
  id: string;
  name: string;
  text: string;
  preview: string;
};

export type StudioControls = {
  color: string;
  colorMode: ColorMode;
  material: MaterialKind;
  depth: number;
  bevel: number;
  bevelSmoothing: number;
  roughness: number;
  brightness: number;
  artboardMode: ArtboardMode;
  customSize: number;
  resolution: Resolution;
  lighting: LightingPreset;
  // Position & Transform
  posX: number;
  posY: number;
  posZ: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  scale: number;
  // Background
  alpha: boolean;
  bgColor: string;
  showShadow: boolean;
  // Performance
  fastPreview: boolean;
  // Animations & Video
  animation: AnimationKind;
  animSpeed: number;
  videoDuration: number; // 1 to 20 seconds
};

type BatchStatus = {
  running: boolean;
  current: string;
  completed: number;
  failed: number;
};

type PreviewHandle = {
  exportBlob: (asset: IconAsset, format: "png" | "webp", resolution: Resolution) => Promise<Blob>;
  export3DModel: (asset: IconAsset, format: "obj" | "gltf") => Promise<Blob | string>;
  record360Video: (
    asset: IconAsset,
    durationSeconds: number,
    onProgress: (pct: number) => void
  ) => Promise<{ blob: Blob; format: string }>;
  resetView: () => void;
  centerObject: () => void;
  setManualPose: (rotX: number, rotY: number, rotZ?: number) => void;
};

const MAX_FILES = 500;
const MAX_FILE_SIZE = 4 * 1024 * 1024;

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

const sampleSvgCursor = `<svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <path fill="#16c784" d="M24 16 L24 96 L46 76 L68 116 L84 106 L62 66 L94 66 Z"/>
  <path fill="#27e39a" d="M30 26 L30 84 L48 68 L66 102 L76 96 L58 60 L82 60 Z"/>
</svg>`;

const sampleSvgCheck = `<svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <circle fill="#16c784" cx="64" cy="64" r="56"/>
  <path fill="#ffffff" d="M34 64 L54 84 L96 42 L88 34 L54 68 L42 56 Z"/>
</svg>`;

const sampleSvgCoins = `<svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <circle fill="#16c784" cx="64" cy="64" r="52"/>
  <circle fill="#27e39a" cx="64" cy="64" r="42"/>
  <path fill="#ffffff" d="M60 36 h8 v6 c8 1 14 6 15 13 h-8 c-1-4-4-6-8-6 -5 0-8 3-8 6 0 4 3 6 10 8 9 3 14 6 14 14 0 7-6 12-13 13 v6 h-8 v-6 c-8-1-15-7-16-15 h9 c1 4 4 8 9 8 5 0 8-3 8-7 0-4-3-6-10-8 -9-3-14-6-14-14 0-7 6-12 13-13 v-6 Z"/>
</svg>`;

const sampleSvgChat = `<svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <path fill="#16c784" d="M52 24 C28 24 12 38 12 56 C12 66 18 75 28 81 L24 98 L44 87 C46 88 49 88 52 88 C76 88 92 74 92 56 C92 38 76 24 52 24 Z"/>
  <path fill="#091a16" d="M78 50 C60 50 46 62 46 76 C46 84 51 91 58 96 L55 110 L71 101 C73 102 75 102 78 102 C96 102 110 90 110 76 C110 62 96 50 78 50 Z"/>
  <path fill="#ffffff" d="M76 62 c4 0 7 3 7 7 0 3-2 5-5 6 v3 h-4 v-4 c0-3 2-4 4-5 1-1 2-2 2-3 0-2-1-3-4-3 -2 0-3 1-4 3 l-3-2 c2-3 4-4 7-4 Z M74 82 h4 v4 h-4 Z"/>
</svg>`;

const presetColors = [
  ["Emerald", "#16c784"],
  ["Mint", "#27e39a"],
  ["Dark Teal", "#0f5132"],
  ["Ink Slate", "#1e293b"],
  ["Gold", "#f5c451"],
  ["Amber", "#f59e0b"],
  ["Coral", "#f97316"],
  ["Ruby", "#ef4444"],
  ["Purple", "#8b5cf6"],
  ["Cyan", "#06b6d4"],
  ["Pure White", "#ffffff"],
  ["Dark Charcoal", "#101116"],
];

const presetBgColors = [
  ["Deep Dark", "#101116"],
  ["Pitch Black", "#000000"],
  ["Pure White", "#ffffff"],
  ["Soft Cloud", "#f4f7f6"],
  ["Dark Forest", "#071b17"],
  ["Midnight Blue", "#0f172a"],
  ["Warm Cream", "#faf8f5"],
];

const materialLabels: Record<MaterialKind, string> = {
  glass: "Liquid Glass",
  plastic: "3D Plastic",
  glossy: "Glossy Lacquer",
  frosted: "Frosted Glass",
  metallic: "Polished Metal",
  iridescent: "Iridescent Sheen",
};

const resolutionSize: Record<Resolution, number> = {
  "1K": 1024,
  "2K": 2048,
  "4K": 4096,
  "8K": 8192,
};

const defaultControls: StudioControls = {
  color: "#16c784",
  colorMode: "svg",
  material: "glass",
  depth: 18,
  bevel: 2.5,
  bevelSmoothing: 8,
  roughness: 12,
  brightness: 110,
  artboardMode: "fit",
  customSize: 1024,
  resolution: "2K",
  lighting: "studio",
  posX: 0,
  posY: 0,
  posZ: 0,
  rotX: -16,
  rotY: 22,
  rotZ: 0,
  scale: 100,
  alpha: true,
  bgColor: "#101116",
  showShadow: true,
  fastPreview: true,
  animation: "none",
  animSpeed: 1,
  videoDuration: 4, // 4 seconds by default, max 20
};

function sanitizeHex(value: string) {
  const hex = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex}`;
  return null;
}

/**
 * Advanced SVG Gradient & Color Extractor
 * Parses <linearGradient>, <radialGradient>, stop colors, and class styles
 */
function extractSvgGradientAndColorMap(svgText: string): Map<string, string> {
  const colorMap = new Map<string, string>();
  if (typeof DOMParser === "undefined") return colorMap;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");

    // Extract gradients & stop colors
    const gradients = doc.querySelectorAll("linearGradient, radialGradient");
    gradients.forEach((grad) => {
      const id = grad.getAttribute("id");
      if (!id) return;
      const stops = grad.querySelectorAll("stop");
      if (stops.length > 0) {
        for (let i = 0; i < stops.length; i++) {
          const stop = stops[i];
          const stopColor = stop.getAttribute("stop-color") || stop.style.stopColor;
          if (stopColor && stopColor !== "none") {
            try {
              const c = new THREE.Color(stopColor);
              colorMap.set(id, `#${c.getHexString()}`);
              break;
            } catch {}
          }
        }
      }
    });

    // Extract styles from <style> blocks
    const styles = doc.querySelectorAll("style");
    styles.forEach((st) => {
      const text = st.textContent || "";
      const matches = text.matchAll(/\.([a-zA-Z0-9_-]+)\s*\{([^}]+)\}/g);
      for (const m of matches) {
        const clsName = m[1];
        const ruleBody = m[2];
        const fillMatch = ruleBody.match(/fill:\s*([^;]+)/i);
        if (fillMatch) {
          const val = fillMatch[1].trim();
          try {
            const c = new THREE.Color(val);
            colorMap.set(`class:${clsName}`, `#${c.getHexString()}`);
          } catch {}
        }
      }
    });
  } catch (err) {
    console.warn("SVG DOM parse warning:", err);
  }
  return colorMap;
}

interface SVGPathLike {
  userData?: {
    style?: {
      fill?: string;
      stroke?: string;
    };
    node?: Element;
  };
  color?: THREE.Color | { getHexString?: () => string };
}

function parseColorFromPath(path: SVGPathLike, gradientMap: Map<string, string>, fallbackHex: string): string {
  const node = path.userData?.node;
  if (node) {
    const nodeFill = node.getAttribute("fill") || (node as SVGElement).style?.fill;
    if (nodeFill && nodeFill !== "none" && nodeFill !== "transparent") {
      if (nodeFill.startsWith("url(#") || nodeFill.startsWith("url('#") || nodeFill.startsWith('url("#')) {
        const gradId = nodeFill.replace(/^url\(["']?#|["']?\)$/g, "");
        if (gradientMap.has(gradId)) return gradientMap.get(gradId)!;
      }
      try {
        const c = new THREE.Color(nodeFill);
        return `#${c.getHexString()}`;
      } catch {}
    }

    const cls = node.getAttribute("class");
    if (cls) {
      for (const singleCls of cls.split(/\s+/)) {
        if (gradientMap.has(`class:${singleCls}`)) {
          return gradientMap.get(`class:${singleCls}`)!;
        }
      }
    }

    // Check parent group fills
    let parent = node.parentElement;
    while (parent && parent.nodeName.toLowerCase() !== "svg") {
      const pFill = parent.getAttribute("fill") || parent.style?.fill;
      if (pFill && pFill !== "none" && pFill !== "transparent") {
        if (pFill.startsWith("url(#") || pFill.startsWith("url('#") || pFill.startsWith('url("#')) {
          const gradId = pFill.replace(/^url\(["']?#|["']?\)$/g, "");
          if (gradientMap.has(gradId)) return gradientMap.get(gradId)!;
        }
        try {
          const c = new THREE.Color(pFill);
          return `#${c.getHexString()}`;
        } catch {}
      }
      parent = parent.parentElement;
    }
  }

  const fill = path.userData?.style?.fill;
  if (fill && fill !== "none" && fill !== "currentColor" && fill !== "transparent") {
    // 1. URL Gradient reference url(#gradientId)
    if (fill.startsWith("url(#") || fill.startsWith("url('#") || fill.startsWith('url("#')) {
      const gradId = fill.replace(/^url\(["']?#|["']?\)$/g, "");
      if (gradientMap.has(gradId)) {
        return gradientMap.get(gradId)!;
      }
    }
    // 2. Direct Hex / RGB
    if (fill.startsWith("#")) return fill;
    if (fill.startsWith("rgb")) {
      try {
        const c = new THREE.Color(fill);
        return `#${c.getHexString()}`;
      } catch {}
    }
    // 3. Named color
    try {
      const c = new THREE.Color(fill);
      return `#${c.getHexString()}`;
    } catch {}
  }

  // Check stroke if fill is none
  const stroke = path.userData?.style?.stroke || node?.getAttribute("stroke");
  if (stroke && stroke !== "none" && stroke !== "currentColor") {
    if (stroke.startsWith("#")) return stroke;
    try {
      const c = new THREE.Color(stroke);
      return `#${c.getHexString()}`;
    } catch {}
  }

  // Check path.color from SVGLoader
  if (path.color && typeof (path.color as THREE.Color).getHexString === "function") {
    const hex = `#${(path.color as THREE.Color).getHexString()}`;
    if (hex !== "#000000" && hex !== "#ffffff") {
      return hex;
    }
  }

  return fallbackHex;
}

/**
 * Ultra-Realistic Physically-Based Materials with Rich Color Saturation
 */
function makeMaterial(controls: StudioControls, pathHexColor?: string) {
  const hex = controls.colorMode === "svg" && pathHexColor ? pathHexColor : controls.color;
  const baseColor = new THREE.Color(hex).multiplyScalar(controls.brightness / 100);
  const roughness = controls.roughness / 100;

  if (controls.material === "glass") {
    return new THREE.MeshPhysicalMaterial({
      color: baseColor,
      transmission: 0.55,
      transparent: true,
      opacity: 0.95,
      roughness: Math.max(0.02, roughness * 0.2),
      ior: 1.45,
      thickness: Math.max(1.2, controls.depth * 0.25),
      specularIntensity: 1.0,
      specularColor: new THREE.Color(0xffffff),
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
      attenuationColor: baseColor,
      attenuationDistance: 3.5,
      metalness: 0.02,
      reflectivity: 0.9,
      side: THREE.DoubleSide,
    });
  }

  if (controls.material === "plastic") {
    return new THREE.MeshPhysicalMaterial({
      color: baseColor,
      roughness: Math.max(0.1, roughness * 0.45),
      metalness: 0.0,
      clearcoat: 0.85,
      clearcoatRoughness: 0.06,
      specularIntensity: 0.95,
      reflectivity: 0.65,
      side: THREE.DoubleSide,
    });
  }

  if (controls.material === "glossy") {
    return new THREE.MeshPhysicalMaterial({
      color: baseColor,
      roughness: Math.max(0.03, roughness * 0.12),
      metalness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      specularIntensity: 1.0,
      specularColor: new THREE.Color(0xffffff),
      reflectivity: 0.95,
      side: THREE.DoubleSide,
    });
  }

  if (controls.material === "frosted") {
    return new THREE.MeshPhysicalMaterial({
      color: baseColor,
      transmission: 0.65,
      transparent: true,
      opacity: 0.92,
      roughness: Math.max(0.3, roughness * 0.7),
      ior: 1.45,
      thickness: 2.2,
      clearcoat: 0.3,
      clearcoatRoughness: 0.35,
      attenuationColor: baseColor,
      attenuationDistance: 2.2,
      side: THREE.DoubleSide,
    });
  }

  if (controls.material === "metallic") {
    return new THREE.MeshStandardMaterial({
      color: baseColor,
      roughness: Math.max(0.08, roughness * 0.3),
      metalness: 0.94,
      side: THREE.DoubleSide,
    });
  }

  if (controls.material === "iridescent") {
    const mat = new THREE.MeshPhysicalMaterial({
      color: baseColor,
      roughness: Math.max(0.05, roughness * 0.2),
      metalness: 0.15,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      side: THREE.DoubleSide,
    });
    Object.assign(mat, {
      iridescence: 1.0,
      iridescenceIOR: 1.7,
      iridescenceThicknessRange: [120, 600],
    });
    return mat;
  }

  return new THREE.MeshStandardMaterial({ color: baseColor, roughness, metalness: 0.1, side: THREE.DoubleSide });
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
 * 3D Icon Extrusion with Zero-Jitter Geometry & Gradient Support
 */
async function createIconGroup(asset: IconAsset, controls: StudioControls, isExport = false) {
  const gradientMap = extractSvgGradientAndColorMap(asset.text);
  const loader = new SVGLoader();
  const data = loader.parse(asset.text);
  const group = new THREE.Group();
  let shapeCount = 0;

  const curveSegments = isExport ? 128 : controls.fastPreview ? 24 : 64;
  const bevelSegments = isExport
    ? Math.max(12, Math.round(controls.bevel * 3.5))
    : controls.fastPreview
    ? Math.max(6, Math.min(12, Math.round(controls.bevel * 2.5)))
    : Math.max(6, Math.round(controls.bevel * 2.5));

  data.paths.forEach((path, pathIndex) => {
    const pathColor = parseColorFromPath(path, gradientMap, controls.color);
    const material = makeMaterial(controls, pathColor);
    const shapes = SVGLoader.createShapes(path);

    // Subtle Z elevation per SVG layer so overlapping paths don't Z-fight or occlude
    const zElevation = pathIndex * 0.04;

    shapes.forEach((shape) => {
      const safeBevel = Math.min(controls.bevel, controls.depth * 0.35);
      const rawGeo = new THREE.ExtrudeGeometry(shape, {
        depth: Math.max(0.5, controls.depth),
        bevelEnabled: safeBevel > 0,
        bevelSize: safeBevel,
        bevelThickness: safeBevel,
        bevelSegments: bevelSegments,
        curveSegments: curveSegments,
      });

      // Flip geometry vertically on the geometry level to avoid negative scale normal-inversion jitter!
      rawGeo.scale(1, -1, 1);
      rawGeo.computeVertexNormals();

      const mesh = new THREE.Mesh(rawGeo, material);
      mesh.position.z = zElevation;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { pathColor };
      group.add(mesh);
      shapeCount += 1;
    });
  });

  if (!shapeCount) {
    throw new Error("No supported SVG shapes found in file.");
  }

  // Center bounding box accurately
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
  const baseScale = controls.artboardMode === "fit" ? 3.4 / largest : Math.min(3.4 / largest, controls.customSize / 1024);
  const userScale = (controls.scale / 100) * baseScale;

  // Keep all scales POSITIVE to prevent backface normal culling flicker!
  group.scale.set(userScale, userScale, userScale);
  group.userData = { baseScale };
  group.rotation.x = THREE.MathUtils.degToRad(controls.rotX);
  group.rotation.y = THREE.MathUtils.degToRad(controls.rotY);
  group.rotation.z = THREE.MathUtils.degToRad(controls.rotZ);
  group.position.set(controls.posX / 30, -controls.posY / 30, controls.posZ / 30);
  return group;
}

function applyLightingPreset(preset: LightingPreset, lightsGroup: THREE.Group) {
  lightsGroup.clear();

  if (preset === "studio") {
    const key = new THREE.DirectionalLight(0xffffff, 3.8);
    key.position.set(5, 6, 7);
    const fill = new THREE.DirectionalLight(0xe0f2fe, 2.2);
    fill.position.set(-5, 3, 5);
    const rim = new THREE.DirectionalLight(0xffffff, 4.2);
    rim.position.set(0, 7, -5);
    const bounce = new THREE.DirectionalLight(0xf1f5f9, 1.4);
    bounce.position.set(0, -6, 2);
    lightsGroup.add(key, fill, rim, bounce);
  } else if (preset === "softbox") {
    const key = new THREE.DirectionalLight(0xffffff, 4.5);
    key.position.set(0, 8, 8);
    const left = new THREE.DirectionalLight(0xf8fafc, 2.8);
    left.position.set(-6, 0, 4);
    const right = new THREE.DirectionalLight(0xf8fafc, 2.8);
    right.position.set(6, 0, 4);
    const rim = new THREE.DirectionalLight(0xffffff, 3.0);
    rim.position.set(0, 5, -6);
    lightsGroup.add(key, left, right, rim);
  } else if (preset === "rim") {
    const key = new THREE.DirectionalLight(0xffffff, 1.8);
    key.position.set(2, 4, 6);
    const rim1 = new THREE.DirectionalLight(0x27e39a, 6.0);
    rim1.position.set(-6, 6, -4);
    const rim2 = new THREE.DirectionalLight(0x38bdf8, 5.0);
    rim2.position.set(6, -4, -4);
    lightsGroup.add(key, rim1, rim2);
  } else if (preset === "warm") {
    const sun = new THREE.DirectionalLight(0xffedd5, 4.6);
    sun.position.set(6, 7, 5);
    const fill = new THREE.DirectionalLight(0xfef3c7, 2.0);
    fill.position.set(-5, 2, 4);
    const rim = new THREE.DirectionalLight(0xffedd5, 3.8);
    rim.position.set(-2, 6, -5);
    lightsGroup.add(sun, fill, rim);
  } else if (preset === "cyber") {
    const key = new THREE.DirectionalLight(0x16c784, 4.2);
    key.position.set(5, 5, 5);
    const cyan = new THREE.DirectionalLight(0x06b6d4, 4.8);
    cyan.position.set(-6, 3, -3);
    const purple = new THREE.DirectionalLight(0xa855f7, 4.0);
    purple.position.set(0, -6, 4);
    lightsGroup.add(key, cyan, purple);
  }
}

const IconPreview = forwardRef<
  PreviewHandle,
  { asset?: IconAsset; controls: StudioControls; onError: (error: string) => void }
>(function IconPreview({ asset, controls, onError }, ref) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const iconRef = useRef<THREE.Group | null>(null);
  const lightsGroupRef = useRef<THREE.Group | null>(null);
  const shadowMeshRef = useRef<THREE.Mesh | null>(null);
  const frameRef = useRef<number | null>(null);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());
  const controlsRefCurrent = useRef<StudioControls>(controls);

  useEffect(() => {
    controlsRefCurrent.current = controls;
  }, [controls]);

  const clearIcon = useCallback(() => {
    if (!sceneRef.current || !iconRef.current) return;
    sceneRef.current.remove(iconRef.current);
    disposeObject(iconRef.current);
    iconRef.current = null;
  }, []);

  const loadIcon = useCallback(
    async (nextAsset: IconAsset, nextControls: StudioControls) => {
      if (!sceneRef.current) return;
      clearIcon();
      const group = await createIconGroup(nextAsset, nextControls, false);
      sceneRef.current.add(group);
      iconRef.current = group;
      onError("");
    },
    [clearIcon, onError]
  );

  useEffect(() => {
    if (!mountRef.current) return;
    if (!window.WebGLRenderingContext) {
      onError("WebGL is not available in this browser.");
      return;
    }

    const mount = mountRef.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    camera.position.set(0, 0, 7.2);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, controls.fastPreview ? 1.5 : 2));
    renderer.setClearColor(
      controls.alpha ? 0x000000 : new THREE.Color(controls.bgColor).getHex(),
      controls.alpha ? 0 : 1
    );
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    mount.appendChild(renderer.domElement);

    // Studio IBL Environment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;

    // Lights
    const lightsGroup = new THREE.Group();
    scene.add(lightsGroup);
    lightsGroupRef.current = lightsGroup;
    applyLightingPreset(controls.lighting, lightsGroup);

    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    scene.add(new THREE.HemisphereLight(0xffffff, 0x091a16, 1.1));

    // Ground Contact Shadow (offset with polygonOffset to prevent Z-fighting)
    const shadowGeo = new THREE.PlaneGeometry(6, 6);
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 60);
      grad.addColorStop(0, "rgba(0, 0, 0, 0.4)");
      grad.addColorStop(0.5, "rgba(0, 0, 0, 0.12)");
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
    }
    const shadowTexture = new THREE.CanvasTexture(canvas);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      opacity: controls.showShadow ? 0.6 : 0,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -2.2;
    scene.add(shadowMesh);
    shadowMeshRef.current = shadowMesh;

    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.08;
    orbit.enablePan = true;
    orbit.enableZoom = true;
    orbit.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    orbit.mouseButtons.RIGHT = THREE.MOUSE.PAN;
    orbit.minDistance = 3;
    orbit.maxDistance = 15;

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

    // Butter-smooth 60fps render loop
    const animate = () => {
      const elapsed = clockRef.current.getElapsedTime();
      const c = controlsRefCurrent.current;
      const speed = c.animSpeed || 1;

      if (iconRef.current) {
        const baseRotX = THREE.MathUtils.degToRad(c.rotX);
        const baseRotY = THREE.MathUtils.degToRad(c.rotY);
        const baseRotZ = THREE.MathUtils.degToRad(c.rotZ);

        const basePosX = c.posX / 30;
        const basePosY = -c.posY / 30;
        const basePosZ = c.posZ / 30;

        const baseScale = (iconRef.current.userData?.baseScale as number) || 1;
        const currentScale = (c.scale / 100) * baseScale;

        if (c.animation === "turntable") {
          iconRef.current.rotation.y = baseRotY + elapsed * 1.5 * speed;
          iconRef.current.rotation.x = baseRotX;
          iconRef.current.rotation.z = baseRotZ;
          iconRef.current.position.set(basePosX, basePosY, basePosZ);
          iconRef.current.scale.set(currentScale, currentScale, currentScale);
        } else if (c.animation === "floating") {
          iconRef.current.position.set(basePosX, basePosY + Math.sin(elapsed * 2.2 * speed) * 0.22, basePosZ);
          iconRef.current.rotation.set(baseRotX, baseRotY + Math.sin(elapsed * 1.2 * speed) * 0.08, baseRotZ);
          iconRef.current.scale.set(currentScale, currentScale, currentScale);
        } else if (c.animation === "wobble") {
          iconRef.current.rotation.x = baseRotX + Math.sin(elapsed * 2.8 * speed) * 0.12;
          iconRef.current.rotation.y = baseRotY + Math.cos(elapsed * 2.4 * speed) * 0.18;
          iconRef.current.position.set(basePosX, basePosY, basePosZ);
          iconRef.current.scale.set(currentScale, currentScale, currentScale);
        } else if (c.animation === "pulse") {
          // Dynamic heartbeat rhythm (double pulse beat)
          const beatTime = (elapsed * 3.2 * speed) % (Math.PI * 2);
          const beat1 = Math.pow(Math.max(0, Math.sin(beatTime)), 8) * 0.14;
          const beat2 = Math.pow(Math.max(0, Math.sin(beatTime + 0.5)), 12) * 0.08;
          const pulse = 1 + beat1 + beat2;
          iconRef.current.scale.set(currentScale * pulse, currentScale * pulse, currentScale * pulse);
          iconRef.current.position.set(basePosX, basePosY, basePosZ);
          iconRef.current.rotation.set(baseRotX, baseRotY, baseRotZ);
        } else if (c.animation === "swing") {
          iconRef.current.rotation.y = baseRotY + Math.sin(elapsed * 2 * speed) * 0.55;
          iconRef.current.position.set(basePosX, basePosY, basePosZ);
          iconRef.current.scale.set(currentScale, currentScale, currentScale);
        } else if (c.animation === "orbit") {
          iconRef.current.rotation.set(baseRotX + Math.sin(elapsed * 1.4 * speed) * 0.12, baseRotY + elapsed * 0.9 * speed, baseRotZ);
          iconRef.current.position.set(basePosX + Math.cos(elapsed * 1.4 * speed) * 0.16, basePosY + Math.sin(elapsed * 1.4 * speed) * 0.12, basePosZ);
          iconRef.current.scale.set(currentScale, currentScale, currentScale);
        } else if (c.animation === "tilt") {
          iconRef.current.rotation.set(baseRotX + Math.sin(elapsed * 1.8 * speed) * 0.2, baseRotY, baseRotZ + Math.cos(elapsed * 1.8 * speed) * 0.12);
          iconRef.current.position.set(basePosX, basePosY, basePosZ);
          iconRef.current.scale.set(currentScale, currentScale, currentScale);
        } else if (c.animation === "bob") {
          iconRef.current.position.set(basePosX, basePosY + Math.sin(elapsed * 2.6 * speed) * 0.28, basePosZ);
          iconRef.current.rotation.set(baseRotX, baseRotY + Math.sin(elapsed * 2.6 * speed) * 0.06, baseRotZ);
          iconRef.current.scale.set(currentScale, currentScale, currentScale);
        } else {
          // Static pose
          iconRef.current.rotation.set(baseRotX, baseRotY, baseRotZ);
          iconRef.current.position.set(basePosX, basePosY, basePosZ);
          iconRef.current.scale.set(currentScale, currentScale, currentScale);
        }
      }

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
      shadowGeo.dispose();
      shadowMat.dispose();
      shadowTexture.dispose();
      renderer.domElement.removeEventListener("contextmenu", handleContextMenu);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [clearIcon, onError]);

  // Lighting updates
  useEffect(() => {
    if (lightsGroupRef.current) {
      applyLightingPreset(controls.lighting, lightsGroupRef.current);
    }
  }, [controls.lighting]);

  // Shadow visibility
  useEffect(() => {
    if (shadowMeshRef.current) {
      (shadowMeshRef.current.material as THREE.MeshBasicMaterial).opacity = controls.showShadow ? 0.6 : 0;
    }
  }, [controls.showShadow]);

  // Instant 0ms Position & Rotation Transform Updates
  useEffect(() => {
    if (!iconRef.current) return;
    iconRef.current.rotation.x = THREE.MathUtils.degToRad(controls.rotX);
    iconRef.current.rotation.y = THREE.MathUtils.degToRad(controls.rotY);
    iconRef.current.rotation.z = THREE.MathUtils.degToRad(controls.rotZ);
    iconRef.current.position.set(controls.posX / 30, -controls.posY / 30, controls.posZ / 30);
  }, [controls.rotX, controls.rotY, controls.rotZ, controls.posX, controls.posY, controls.posZ]);

  // Instant 0ms Material updates
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

  // Background color / alpha updates
  useEffect(() => {
    if (rendererRef.current) {
      const bgHex = new THREE.Color(controls.bgColor).getHex();
      rendererRef.current.setClearColor(controls.alpha ? 0x000000 : bgHex, controls.alpha ? 0 : 1);
    }
  }, [controls.alpha, controls.bgColor]);

  // Debounced Geometry rebuild when Depth, Bevel, Artboard, or FastPreview changes
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
    }, 25);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    asset?.id,
    controls.depth,
    controls.bevel,
    controls.scale,
    controls.fastPreview,
    controls.artboardMode,
    controls.customSize,
    clearIcon,
    loadIcon,
    onError,
  ]);

  useImperativeHandle(
    ref,
    () => ({
      resetView: () => {
        if (!cameraRef.current || !controlsRef.current) return;
        cameraRef.current.position.set(0, 0, 7.2);
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
      },
      centerObject: () => {
        if (!iconRef.current || !controlsRef.current) return;
        iconRef.current.position.set(0, 0, 0);
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
      },
      setManualPose: (rotX, rotY, rotZ = 0) => {
        if (!iconRef.current) return;
        iconRef.current.rotation.set(
          THREE.MathUtils.degToRad(rotX),
          THREE.MathUtils.degToRad(rotY),
          THREE.MathUtils.degToRad(rotZ)
        );
      },
      exportBlob: async (targetAsset, format, resolution) => {
        const size = resolutionSize[resolution];
        const offCanvas = document.createElement("canvas");
        offCanvas.width = size;
        offCanvas.height = size;

        const offRenderer = new THREE.WebGLRenderer({
          canvas: offCanvas,
          antialias: true,
          alpha: controls.alpha,
          preserveDrawingBuffer: true,
          powerPreference: "high-performance",
        });
        offRenderer.setSize(size, size, false);
        offRenderer.setPixelRatio(1);
        offRenderer.outputColorSpace = THREE.SRGBColorSpace;
        offRenderer.toneMapping = THREE.ACESFilmicToneMapping;
        offRenderer.toneMappingExposure = 1.15;

        const bgHex = new THREE.Color(controls.bgColor).getHex();
        offRenderer.setClearColor(controls.alpha ? 0x000000 : bgHex, controls.alpha ? 0 : 1);

        const offScene = new THREE.Scene();
        const offCamera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
        offCamera.position.set(0, 0, 7.2);
        offCamera.lookAt(0, 0, 0);

        const pmremGenerator = new THREE.PMREMGenerator(offRenderer);
        pmremGenerator.compileEquirectangularShader();
        const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
        offScene.environment = envTexture;

        const offLights = new THREE.Group();
        offScene.add(offLights);
        applyLightingPreset(controls.lighting, offLights);
        offScene.add(new THREE.AmbientLight(0xffffff, 0.85));
        offScene.add(new THREE.HemisphereLight(0xffffff, 0x091a16, 1.1));

        if (controls.showShadow) {
          const shadowGeo = new THREE.PlaneGeometry(6, 6);
          const shadowCanvas = document.createElement("canvas");
          shadowCanvas.width = 128;
          shadowCanvas.height = 128;
          const sCtx = shadowCanvas.getContext("2d");
          if (sCtx) {
            const grad = sCtx.createRadialGradient(64, 64, 0, 64, 64, 60);
            grad.addColorStop(0, "rgba(0, 0, 0, 0.4)");
            grad.addColorStop(0.5, "rgba(0, 0, 0, 0.12)");
            grad.addColorStop(1, "rgba(0, 0, 0, 0)");
            sCtx.fillStyle = grad;
            sCtx.fillRect(0, 0, 128, 128);
          }
          const shadowMat = new THREE.MeshBasicMaterial({
            map: new THREE.CanvasTexture(shadowCanvas),
            transparent: true,
            opacity: 0.6,
            depthWrite: false,
          });
          const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
          shadowMesh.rotation.x = -Math.PI / 2;
          shadowMesh.position.y = -2.2;
          offScene.add(shadowMesh);
        }

        const exportGroup = await createIconGroup(targetAsset, controls, true);
        offScene.add(exportGroup);

        offRenderer.render(offScene, offCamera);

        const blob = await new Promise<Blob>((resolve, reject) => {
          offCanvas.toBlob(
            (result) => {
              if (result) resolve(result);
              else reject(new Error("Export render failed."));
            },
            format === "png" ? "image/png" : "image/webp",
            0.98
          );
        });

        offScene.remove(exportGroup);
        disposeObject(exportGroup);
        envTexture.dispose();
        pmremGenerator.dispose();
        offRenderer.dispose();

        return blob;
      },
      export3DModel: async (targetAsset, format) => {
        const exportGroup = await createIconGroup(targetAsset, controls, true);
        try {
          if (format === "obj") {
            const exporter = new OBJExporter();
            const result = exporter.parse(exportGroup);
            disposeObject(exportGroup);
            return result;
          } else {
            const exporter = new GLTFExporter();
            const result = await new Promise<Blob>((resolve, reject) => {
              exporter.parse(
                exportGroup,
                (gltf) => {
                  if (gltf instanceof ArrayBuffer) {
                    resolve(new Blob([gltf], { type: "model/gltf-binary" }));
                  } else {
                    resolve(new Blob([JSON.stringify(gltf, null, 2)], { type: "model/gltf+json" }));
                  }
                },
                (error) => reject(error),
                { binary: true }
              );
            });
            disposeObject(exportGroup);
            return result;
          }
        } catch (err) {
          disposeObject(exportGroup);
          throw err;
        }
      },
      record360Video: async (targetAsset, durationSeconds, onProgress) => {
        const recordSize = 720;
        const offCanvas = document.createElement("canvas");
        offCanvas.width = recordSize;
        offCanvas.height = recordSize;

        const offRenderer = new THREE.WebGLRenderer({
          canvas: offCanvas,
          antialias: true,
          alpha: false,
          preserveDrawingBuffer: true,
          powerPreference: "high-performance",
        });
        offRenderer.setSize(recordSize, recordSize, false);
        offRenderer.setPixelRatio(1);
        offRenderer.outputColorSpace = THREE.SRGBColorSpace;
        offRenderer.toneMapping = THREE.ACESFilmicToneMapping;
        offRenderer.toneMappingExposure = 1.15;

        const bgHex = new THREE.Color(controls.alpha ? "#101116" : controls.bgColor).getHex();
        offRenderer.setClearColor(bgHex, 1);

        const offScene = new THREE.Scene();
        const offCamera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
        offCamera.position.set(0, 0, 7.2);
        offCamera.lookAt(0, 0, 0);

        const pmremGenerator = new THREE.PMREMGenerator(offRenderer);
        pmremGenerator.compileEquirectangularShader();
        const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
        offScene.environment = envTexture;

        const offLights = new THREE.Group();
        offScene.add(offLights);
        applyLightingPreset(controls.lighting, offLights);
        offScene.add(new THREE.AmbientLight(0xffffff, 0.85));
        offScene.add(new THREE.HemisphereLight(0xffffff, 0x091a16, 1.1));

        if (controls.showShadow) {
          const shadowGeo = new THREE.PlaneGeometry(6, 6);
          const shadowCanvas = document.createElement("canvas");
          shadowCanvas.width = 128;
          shadowCanvas.height = 128;
          const sCtx = shadowCanvas.getContext("2d");
          if (sCtx) {
            const grad = sCtx.createRadialGradient(64, 64, 0, 64, 64, 60);
            grad.addColorStop(0, "rgba(0, 0, 0, 0.4)");
            grad.addColorStop(0.5, "rgba(0, 0, 0, 0.12)");
            grad.addColorStop(1, "rgba(0, 0, 0, 0)");
            sCtx.fillStyle = grad;
            sCtx.fillRect(0, 0, 128, 128);
          }
          const shadowMat = new THREE.MeshBasicMaterial({
            map: new THREE.CanvasTexture(shadowCanvas),
            transparent: true,
            opacity: 0.6,
            depthWrite: false,
          });
          const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
          shadowMesh.rotation.x = -Math.PI / 2;
          shadowMesh.position.y = -2.2;
          offScene.add(shadowMesh);
        }

        const exportGroup = await createIconGroup(targetAsset, controls, true);
        offScene.add(exportGroup);

        // Pre-render ready frame
        offRenderer.render(offScene, offCamera);

        const stream = offCanvas.captureStream(60);

        if (typeof MediaRecorder === "undefined") {
          throw new Error("Video export is not supported by this browser. Try Chrome, Edge, or Firefox.");
        }

        let selectedMimeType = "video/webm";
        let formatExt = "webm";

        if (typeof MediaRecorder !== "undefined") {
          const candidateTypes = [
            { mime: "video/webm;codecs=vp9,opus", ext: "webm" },
            { mime: "video/webm;codecs=vp9", ext: "webm" },
            { mime: "video/webm;codecs=vp8", ext: "webm" },
            { mime: "video/webm", ext: "webm" },
            { mime: "video/mp4;codecs=avc1.42E01E,mp4a.40.2", ext: "mp4" },
          ];

          for (const cand of candidateTypes) {
            if (MediaRecorder.isTypeSupported(cand.mime)) {
              selectedMimeType = cand.mime;
              formatExt = cand.ext;
              break;
            }
          }
        }

        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: selectedMimeType,
          videoBitsPerSecond: 16000000,
        });

        const chunks: Blob[] = [];
        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        const fps = 30;
        const duration = Math.max(1, Math.min(20, durationSeconds || 4));
        const totalFrames = Math.round(duration * fps);
        const baseRotX = THREE.MathUtils.degToRad(controls.rotX);
        const baseRotY = THREE.MathUtils.degToRad(controls.rotY);
        const baseRotZ = THREE.MathUtils.degToRad(controls.rotZ);
        const basePosX = controls.posX / 30;
        const basePosY = -controls.posY / 30;
        const basePosZ = controls.posZ / 30;
        const baseScale = (exportGroup.userData?.baseScale as number) || 1;
        const currentScale = (controls.scale / 100) * baseScale;
        const speed = controls.animSpeed || 1;

        mediaRecorder.start(250);

        const frameInterval = 1000 / fps;
        const startRecordTime = performance.now();

        for (let i = 0; i <= totalFrames; i++) {
          const targetTime = startRecordTime + i * frameInterval;
          const frameProgress = i / totalFrames;
          const animTime = frameProgress * duration;

          if (controls.animation === "floating") {
            exportGroup.position.set(basePosX, basePosY + Math.sin(animTime * 2.2 * speed) * 0.22, basePosZ);
            exportGroup.rotation.set(baseRotX, baseRotY + Math.sin(animTime * 1.2 * speed) * 0.08, baseRotZ);
            exportGroup.scale.set(currentScale, currentScale, currentScale);
          } else if (controls.animation === "wobble") {
            exportGroup.rotation.x = baseRotX + Math.sin(animTime * 2.8 * speed) * 0.12;
            exportGroup.rotation.y = baseRotY + Math.cos(animTime * 2.4 * speed) * 0.18;
            exportGroup.position.set(basePosX, basePosY, basePosZ);
            exportGroup.scale.set(currentScale, currentScale, currentScale);
          } else if (controls.animation === "pulse") {
            const beatTime = (animTime * 3.2 * speed) % (Math.PI * 2);
            const beat1 = Math.pow(Math.max(0, Math.sin(beatTime)), 8) * 0.14;
            const beat2 = Math.pow(Math.max(0, Math.sin(beatTime + 0.5)), 12) * 0.08;
            const pulse = 1 + beat1 + beat2;
            exportGroup.scale.set(currentScale * pulse, currentScale * pulse, currentScale * pulse);
            exportGroup.position.set(basePosX, basePosY, basePosZ);
            exportGroup.rotation.set(baseRotX, baseRotY, baseRotZ);
          } else if (controls.animation === "swing") {
            exportGroup.rotation.y = baseRotY + Math.sin(animTime * 2 * speed) * 0.55;
            exportGroup.position.set(basePosX, basePosY, basePosZ);
            exportGroup.scale.set(currentScale, currentScale, currentScale);
          } else if (controls.animation === "orbit") {
            exportGroup.rotation.set(baseRotX + Math.sin(animTime * 1.4 * speed) * 0.12, baseRotY + animTime * 0.9 * speed, baseRotZ);
            exportGroup.position.set(basePosX + Math.cos(animTime * 1.4 * speed) * 0.16, basePosY + Math.sin(animTime * 1.4 * speed) * 0.12, basePosZ);
            exportGroup.scale.set(currentScale, currentScale, currentScale);
          } else if (controls.animation === "tilt") {
            exportGroup.rotation.set(baseRotX + Math.sin(animTime * 1.8 * speed) * 0.2, baseRotY, baseRotZ + Math.cos(animTime * 1.8 * speed) * 0.12);
            exportGroup.position.set(basePosX, basePosY, basePosZ);
            exportGroup.scale.set(currentScale, currentScale, currentScale);
          } else if (controls.animation === "bob") {
            exportGroup.position.set(basePosX, basePosY + Math.sin(animTime * 2.6 * speed) * 0.28, basePosZ);
            exportGroup.rotation.set(baseRotX, baseRotY + Math.sin(animTime * 2.6 * speed) * 0.06, baseRotZ);
            exportGroup.scale.set(currentScale, currentScale, currentScale);
          } else {
            // Default 360 Turntable rotation for full seamless loop!
            exportGroup.rotation.y = baseRotY + frameProgress * Math.PI * 2;
            exportGroup.rotation.x = baseRotX;
            exportGroup.rotation.z = baseRotZ;
            exportGroup.position.set(basePosX, basePosY, basePosZ);
            exportGroup.scale.set(currentScale, currentScale, currentScale);
          }

          offRenderer.render(offScene, offCamera);
          onProgress(Math.round(frameProgress * 100));

          const now = performance.now();
          const delay = Math.max(0, targetTime - now);
          if (delay > 0) {
            await new Promise((r) => setTimeout(r, delay));
          }
        }

        if (mediaRecorder.state === "recording") {
          mediaRecorder.requestData();
        }

        await new Promise((r) => setTimeout(r, 150));

        const videoBlob = await new Promise<Blob>((resolve, reject) => {
          mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: selectedMimeType });
            if (!blob.size) reject(new Error("Video export produced an empty file. Please try a shorter duration."));
            else resolve(blob);
          };
          mediaRecorder.onerror = () => reject(new Error("Video recording failed. Please try WebM or a shorter duration."));
          mediaRecorder.stop();
        });

        offScene.remove(exportGroup);
        disposeObject(exportGroup);
        envTexture.dispose();
        pmremGenerator.dispose();
        offRenderer.dispose();

        return { blob: videoBlob, format: formatExt };
      },
    }),
    [controls]
  );

  return (
    <div
      ref={mountRef}
      className="absolute inset-0 cursor-grab active:cursor-grabbing"
      aria-label="Interactive 3D icon viewport"
    />
  );
});

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
}: {
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
        <span className="text-primary font-mono font-bold">
          {safeVal}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={safeVal}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-primary cursor-pointer h-2 bg-foreground/10 rounded-lg"
        style={{ "--range-progress": progress } as React.CSSProperties}
        aria-label={label}
      />
    </label>
  );
}

export default function IconStudio() {
  const router = useRouter();
  const [assets, setAssets] = useState<IconAsset[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [controls, setControls] = useState<StudioControls>(defaultControls);
  const [hexDraft, setHexDraft] = useState(defaultControls.color);
  const [bgHexDraft, setBgHexDraft] = useState(defaultControls.bgColor);
  const [error, setError] = useState("");
  const [batch, setBatch] = useState<BatchStatus>({ running: false, current: "", completed: 0, failed: 0 });
  const [videoRecording, setVideoRecording] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [copySuccess, setCopySuccess] = useState(false);
  const cancelBatch = useRef(false);
  const previewRef = useRef<PreviewHandle | null>(null);
  const selectedAsset = assets.find((asset) => asset.id === selectedId);

  useEffect(() => {
    const imported = readSessionValue<{ svg: string; name: string }>("mcustock_studio_import");
    if (!imported?.svg || !imported.name) return;
    removeSessionValue("mcustock_studio_import");
    const asset: IconAsset = {
      id: `splitter-${Date.now()}`,
      name: imported.name,
      text: imported.svg,
      preview: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(imported.svg)}`,
    };
    setAssets((current) => [asset, ...current].slice(0, MAX_FILES));
    setSelectedId(asset.id);
    setError("");
  }, []);

  const addAssets = useCallback(
    async (files: FileList | File[]) => {
      const incoming = Array.from(files).slice(0, Math.max(0, MAX_FILES - assets.length));
      const parsed: IconAsset[] = [];
      for (const file of incoming) {
        const isSvg = file.name.toLowerCase().endsWith(".svg") || file.type === "image/svg+xml";
        if (!isSvg) {
          setError(`${file.name} is not an SVG file.`);
          continue;
        }
        if (file.size > MAX_FILE_SIZE) {
          setError(`${file.name} is too large. Keep SVG files under 4MB.`);
          continue;
        }
        const text = await file.text();
        if (!text.includes("<svg")) {
          setError(`${file.name} does not look like a valid SVG.`);
          continue;
        }
        parsed.push({
          id: `${Date.now()}-${file.name}-${parsed.length}`,
          name: file.name,
          text,
          preview: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`,
        });
      }
      if (!parsed.length) return;
      setAssets((current) => [...current, ...parsed].slice(0, MAX_FILES));
      setSelectedId((current) => current || parsed[0].id);
      setError("");
    },
    [assets.length]
  );

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

  const removeAsset = (id: string, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    setAssets((current) => {
      const remaining = current.filter((asset) => asset.id !== id);
      if (selectedId === id) {
        setSelectedId(remaining.length > 0 ? remaining[0].id : "");
      }
      return remaining;
    });
  };

  const clearAssets = () => {
    cancelBatch.current = true;
    setAssets([]);
    setSelectedId("");
    setBatch({ running: false, current: "", completed: 0, failed: 0 });
    setError("");
  };

  const updateControl = <K extends keyof StudioControls>(key: K, value: StudioControls[K]) => {
    setControls((current) => ({ ...current, [key]: value }));
  };

  const updateColor = (color: string) => {
    setHexDraft(color);
    setControls((prev) => ({ ...prev, color, colorMode: "custom" }));
  };

  const updateBgColor = (bgColor: string) => {
    setBgHexDraft(bgColor);
    setControls((prev) => ({ ...prev, bgColor, alpha: false }));
  };

  const centerAndAlignObject = () => {
    setControls((c) => ({
      ...c,
      posX: 0,
      posY: 0,
      posZ: 0,
    }));
    previewRef.current?.centerObject();
  };

  const exportCurrent = async (format: ExportFormat) => {
    if (!selectedAsset || !previewRef.current) return;
    try {
      const baseName = selectedAsset.name.replace(/\.svg$/i, "");
      if (format === "png" || format === "webp") {
        const blob = await previewRef.current.exportBlob(selectedAsset, format, controls.resolution);
        downloadBlob(blob, `${baseName}-3d-${controls.resolution}.${format}`);
      } else if (format === "svg") {
        downloadText(selectedAsset.text, `${baseName}.svg`, "image/svg+xml;charset=utf-8");
      } else if (format === "obj") {
        const objData = await previewRef.current.export3DModel(selectedAsset, "obj");
        downloadText(typeof objData === "string" ? objData : "", `${baseName}-3d.obj`);
      } else if (format === "gltf") {
        const gltfData = await previewRef.current.export3DModel(selectedAsset, "gltf");
        if (gltfData instanceof Blob) {
          downloadBlob(gltfData, `${baseName}-3d.glb`);
        } else {
          downloadText(gltfData, `${baseName}-3d.gltf`, "application/json");
        }
      } else if (format === "mp4") {
        setVideoRecording(true);
        setVideoProgress(0);
        const { blob, format: vidExt } = await previewRef.current.record360Video(
          selectedAsset,
          controls.videoDuration,
          setVideoProgress
        );
        downloadBlob(blob, `${baseName}-3d-${controls.videoDuration}s-turntable.${vidExt}`);
        setVideoRecording(false);
      }
    } catch (exportError) {
      setVideoRecording(false);
      setError(exportError instanceof Error ? exportError.message : "Export failed.");
    }
  };

  const copyImageToClipboard = async () => {
    if (!selectedAsset || !previewRef.current) return;
    try {
      const blob = await previewRef.current.exportBlob(selectedAsset, "png", "1K");
      const ok = await copyBlobToClipboard(blob);
      if (ok) {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2500);
      } else {
        setError("Clipboard write not permitted by your browser.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Copy failed.");
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
        await yieldToBrowser();
        setBatch({ running: true, current: asset.name, completed, failed });
        try {
          const blob = await previewRef.current.exportBlob(asset, "png", controls.resolution);
          zip.file(`${asset.name.replace(/\.svg$/i, "")}-3d-${controls.resolution}.png`, blob);
          completed += 1;
        } catch {
          failed += 1;
        }
        setBatch({ running: true, current: asset.name, completed, failed });
        // Let React paint progress and process cancellation before the next WebGL export.
        await yieldToBrowser();
      }
      if (!cancelBatch.current && completed > 0) {
        await yieldToBrowser();
        const zipBlob = await zip.generateAsync({ type: "blob" });
        downloadBlob(zipBlob, `3d-icons-${controls.resolution}.zip`);
      }
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
    <div className="min-h-full text-foreground font-sans transition-colors duration-200 pb-12">
      {/* 1. TOP HEADER BANNER */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-[var(--card-border)] bg-[var(--card-bg)] p-3.5 shadow-xl backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/dashboard/generator"
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--input-bg)] text-[var(--text-secondary)] hover:text-primary transition-all duration-200 border border-[var(--card-border)] hover:scale-105"
            aria-label="Home"
          >
            <Home className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-primary">3D Icon Studio Pro</p>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary border border-primary/20">
                Ultra-HD 360°
              </span>
            </div>
            <h1 className="truncate text-base font-extrabold text-foreground">
              {selectedAsset?.name || "Select or Upload an SVG"}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/dashboard/splitter")}
            className="!transform-none flex h-10 items-center gap-1.5 rounded-full border border-transparent bg-primary px-3.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-white shadow-[0_4px_16px_rgba(22,199,132,0.3)] transition-[background-color,box-shadow] duration-200 hover:!transform-none hover:border-transparent hover:bg-primary-hover hover:shadow-[0_5px_18px_rgba(22,199,132,0.42)]"
            title="Open Vector Sheet Splitter"
          >
            <Box className="h-4 w-4" />
            <span>Vector Splitter</span>
          </button>

          <div className="flex items-center gap-2" title="Fast Preview: 60 FPS viewport. Exports still render ultra high-quality.">
            <Zap className={`h-4 w-4 ${controls.fastPreview ? "text-primary" : "text-[var(--text-secondary)]"}`} />
            <span className="hidden sm:inline text-xs font-bold text-[var(--text-secondary)]">Fast Preview</span>
            <SegmentedToggle<"on" | "off">
              options={[
                { id: "on", label: "ON" },
                { id: "off", label: "OFF" },
              ]}
              value={controls.fastPreview ? "on" : "off"}
              onChange={(val) => updateControl("fastPreview", val === "on")}
              size="sm"
              className="w-[132px]"
              ariaLabel="Fast preview"
            />
          </div>

          {/* Align Center Button */}
          <button
            type="button"
            onClick={centerAndAlignObject}
            className="flex h-11 items-center gap-2 rounded-2xl border border-[var(--card-border)] bg-[var(--input-bg)] px-3.5 text-xs font-bold text-[var(--text-secondary)] hover:text-primary hover:border-primary/40 transition-all duration-200"
            title="Align and center 3D object to viewport origin"
          >
            <Crosshair className="h-4 w-4 text-primary" />
            <span>Center Object</span>
          </button>

          {/* 360 Video Turntable MP4 Export */}
          <button
            type="button"
            onClick={() => void exportCurrent("mp4")}
            disabled={!selectedAsset || videoRecording}
            className="flex h-11 items-center gap-2 rounded-2xl border border-primary/40 bg-primary/10 hover:bg-primary/20 px-3.5 text-xs font-bold text-primary transition-all duration-200 disabled:opacity-40"
            title={`Download ${controls.videoDuration}s Turntable rotation video`}
          >
            {videoRecording ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
            <span>{videoRecording ? `Recording (${videoProgress}%)` : `Video (${controls.videoDuration}s)`}</span>
          </button>

          {/* Quick Copy to Clipboard */}
          <button
            type="button"
            onClick={() => void copyImageToClipboard()}
            disabled={!selectedAsset}
            className="flex h-11 items-center gap-2 rounded-2xl border border-[var(--card-border)] bg-[var(--input-bg)] px-3.5 text-xs font-bold text-[var(--text-secondary)] hover:text-primary hover:border-primary/40 transition-all duration-200 disabled:opacity-40"
          >
            {copySuccess ? <CheckCheck className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
            <span>{copySuccess ? "Copied!" : "Copy PNG"}</span>
          </button>

          {/* High-Q Download Button */}
          <button
            onClick={() => void exportCurrent("png")}
            disabled={!selectedAsset}
            className="flex h-11 items-center gap-2 rounded-2xl bg-primary px-4.5 text-sm font-bold text-white shadow-[0_4px_16px_rgba(22,199,132,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-hover active:scale-95 disabled:opacity-40"
          >
            <Download className="h-4 w-4" /> Download PNG ({controls.resolution})
          </button>
        </div>
      </div>

      {/* 2. MAIN 2-COLUMN WORKSPACE */}
      <div className="grid min-h-[calc(100vh-12rem)] grid-cols-1 gap-5 xl:grid-cols-[400px_minmax(0,1fr)]">
        {/* LEFT SIDEBAR: CONTROLS */}
        <aside className="order-2 space-y-4 xl:order-1 xl:max-h-[calc(100vh-7.5rem)] xl:overflow-y-auto xl:pr-2 custom-scrollbar">
          {/* UPLOAD SVG & SAMPLES */}
          <section className="rounded-[24px] border border-[var(--card-border)] bg-[var(--card-bg)] p-5 space-y-3.5 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-extrabold text-foreground">Upload SVG</h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  {assets.length}/{MAX_FILES} loaded
                </p>
              </div>
              {assets.length > 0 && (
                <button
                  type="button"
                  onClick={clearAssets}
                  disabled={batch.running}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[10px] font-extrabold text-red-400 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                  title="Remove all loaded SVGs"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear All
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 pt-0.5">
              <button
                onClick={() => loadSamplePreset("cursor")}
                className="rounded-xl bg-primary/10 hover:bg-primary/20 px-2.5 py-1 text-xs font-bold text-primary transition-all duration-150"
              >
                ✦ Cursor
              </button>
              <button
                onClick={() => loadSamplePreset("coins")}
                className="rounded-xl bg-primary/10 hover:bg-primary/20 px-2.5 py-1 text-xs font-bold text-primary transition-all duration-150"
              >
                ✦ Coin
              </button>
              <button
                onClick={() => loadSamplePreset("check")}
                className="rounded-xl bg-primary/10 hover:bg-primary/20 px-2.5 py-1 text-xs font-bold text-primary transition-all duration-150"
              >
                ✦ Checkmark
              </button>
              <button
                onClick={() => loadSamplePreset("chat")}
                className="rounded-xl bg-primary/10 hover:bg-primary/20 px-2.5 py-1 text-xs font-bold text-primary transition-all duration-150"
              >
                ✦ Chat
              </button>
            </div>

            <label
              onDragOver={(event) => event.preventDefault()}
              onDrop={onDrop}
              className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-primary/25 bg-[var(--input-bg)] p-4 text-center hover:border-primary/60 transition-all duration-200"
            >
              <Upload className="mb-2 h-5 w-5 text-primary" />
              <span className="text-xs font-bold text-foreground">Choose SVG or drag files here</span>
              <span className="mt-1 text-[10px] text-[var(--text-muted)]">Preserves multi-color & gradient shapes</span>
              <input
                type="file"
                accept=".svg,image/svg+xml"
                multiple
                className="sr-only"
                onChange={(event: ChangeEvent<HTMLInputElement>) => event.target.files && void addAssets(event.target.files)}
              />
            </label>

            {assets.length > 0 && (
              <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1 custom-scrollbar">
                {assets.map((asset) => (
                  <div
                    key={asset.id}
                    onClick={() => setSelectedId(asset.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-all duration-150 cursor-pointer select-none ${
                      asset.id === selectedId
                        ? "border-primary bg-primary/15 shadow-sm"
                        : "border-[var(--card-border)] bg-[var(--input-bg)] hover:border-primary/30"
                    }`}
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/90 p-1 shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={asset.preview} alt="" className="max-h-full max-w-full object-contain" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-bold text-foreground">{asset.name}</span>
                    {asset.id === selectedId && <Check className="h-4 w-4 text-primary shrink-0" />}
                    <button
                      type="button"
                      onClick={(event) => removeAsset(asset.id, event)}
                      className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-red-500/20 hover:text-red-400 transition-colors shrink-0"
                      aria-label={`Remove ${asset.name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 3D KINETIC ANIMATIONS & VIDEO DURATION */}
          <section className="rounded-[24px] border border-[var(--card-border)] bg-[var(--card-bg)] p-5 space-y-3.5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold flex items-center gap-2 text-foreground">
                <Play className="h-4 w-4 text-primary" /> 3D Kinetic Animations
              </h2>
              <span className="text-[10px] font-bold text-primary uppercase">{controls.animation}</span>
            </div>

            {/* Animation Kind Buttons */}
            <SegmentedToggle<AnimationKind>
              options={(
                [
                  ["none", "Static Pose"],
                  ["turntable", "360° Turntable"],
                  ["floating", "Floating Hover"],
                  ["wobble", "3D Wobble"],
                  ["pulse", "Heartbeat Pulse"],
                  ["swing", "45° Swing"],
                  ["orbit", "Orbit Drift"],
                  ["tilt", "Tilt Reveal"],
                  ["bob", "Soft Bob"],
                ] as [AnimationKind, string][]
              ).map(([id, label]) => ({ id, label }))}
              value={controls.animation}
              onChange={(val) => updateControl("animation", val)}
              columns={3}
              size="sm"
              className="w-full"
              ariaLabel="Kinetic animation"
            />

            {/* Video Duration Slider (Max 20s) */}
            <div className="pt-2 border-t border-[var(--card-border)]">
              <Slider
                label="Video Loop Duration (Max 20s)"
                min={1}
                max={20}
                step={1}
                suffix="s"
                value={controls.videoDuration}
                onChange={(v) => updateControl("videoDuration", v)}
              />
              <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                Output: {controls.videoDuration} seconds @ 30 FPS ({controls.videoDuration * 30} frames, WebM for reliable playback)
              </p>
            </div>

            {/* Speed Multiplier */}
            {controls.animation !== "none" && (
              <div className="flex items-center justify-between pt-1 border-t border-[var(--card-border)]">
                <span className="text-xs font-bold text-[var(--text-secondary)] flex items-center gap-1.5">
                  <Gauge className="h-3.5 w-3.5 text-primary" /> Speed:
                </span>
                <SegmentedToggle<number>
                  options={[0.5, 1, 1.5, 2].map((spd) => ({ id: spd, label: `${spd}x` }))}
                  value={controls.animSpeed}
                  onChange={(val) => updateControl("animSpeed", val)}
                  size="sm"
                  className="w-[210px]"
                  ariaLabel="Animation speed"
                />
              </div>
            )}
          </section>

          {/* BACKGROUND COLOR & ALPHA */}
          <section className="rounded-[24px] border border-[var(--card-border)] bg-[var(--card-bg)] p-5 space-y-3.5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold flex items-center gap-2 text-foreground">
                <Palette className="h-4 w-4 text-primary" /> Background Color
              </h2>
              <label className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-secondary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={controls.alpha}
                  onChange={(e) => updateControl("alpha", e.target.checked)}
                  className="accent-primary cursor-pointer h-3.5 w-3.5 rounded"
                />
                <span>Transparent</span>
              </label>
            </div>

            {/* Background Color Presets */}
            <div className="grid grid-cols-4 gap-1.5">
              {presetBgColors.map(([label, color]) => (
                <button
                  key={color}
                  onClick={() => updateBgColor(color)}
                  className={`flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-[11px] font-bold transition-all border ${
                    !controls.alpha && controls.bgColor.toLowerCase() === color.toLowerCase()
                      ? "border-primary bg-primary/20 text-primary shadow-sm"
                      : "border-[var(--card-border)] bg-[var(--input-bg)] text-[var(--text-secondary)] hover:text-foreground"
                  }`}
                >
                  <span className="h-3 w-3 rounded-full border border-white/20 shrink-0" style={{ backgroundColor: color }} />
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </div>

            {/* Custom Hex Picker */}
            <div className="flex gap-2">
              <input
                type="color"
                value={controls.bgColor}
                onChange={(e) => updateBgColor(e.target.value)}
                className="h-10 w-12 rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] p-1 cursor-pointer"
                aria-label="Custom background color"
              />
              <input
                value={bgHexDraft}
                onChange={(e) => {
                  const next = e.target.value;
                  setBgHexDraft(next);
                  const hex = sanitizeHex(next);
                  if (hex) updateBgColor(hex);
                }}
                onBlur={() => setBgHexDraft(sanitizeHex(bgHexDraft) || controls.bgColor)}
                placeholder="Hex #101116"
                className="h-10 min-w-0 flex-1 rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] px-3 text-xs font-mono font-bold uppercase outline-none focus:border-primary"
              />
            </div>
          </section>

          {/* 3D POSITION, ROTATION & SCALE */}
          <section className="space-y-4 rounded-[24px] border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold flex items-center gap-2 text-foreground">
                <Move className="h-4 w-4 text-primary" /> Position & Transform
              </h2>
              <button
                onClick={centerAndAlignObject}
                className="flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                title="Reset X, Y, Z to center"
              >
                <Crosshair className="h-3.5 w-3.5" /> Center & Align
              </button>
            </div>

            {/* Quick Pose Presets */}
            <div className="grid grid-cols-4 gap-1.5">
              <button
                onClick={() => setControls((c) => ({ ...c, rotX: 0, rotY: 0, rotZ: 0 }))}
                className="rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] py-1.5 text-[11px] font-bold text-[var(--text-secondary)] hover:text-foreground"
              >
                Front (0°)
              </button>
              <button
                onClick={() => setControls((c) => ({ ...c, rotX: -25, rotY: 35, rotZ: 0 }))}
                className="rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] py-1.5 text-[11px] font-bold text-[var(--text-secondary)] hover:text-foreground"
              >
                Isometric
              </button>
              <button
                onClick={() => setControls((c) => ({ ...c, rotX: -90, rotY: 0, rotZ: 0 }))}
                className="rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] py-1.5 text-[11px] font-bold text-[var(--text-secondary)] hover:text-foreground"
              >
                Top-Down
              </button>
              <button
                onClick={() => setControls((c) => ({ ...c, rotY: (c.rotY + 180) % 360 }))}
                className="rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] py-1.5 text-[11px] font-bold text-[var(--text-secondary)] hover:text-foreground"
              >
                Flip 180°
              </button>
            </div>

            <Slider label="Position X (Horizontal)" min={-150} max={150} value={controls.posX} onChange={(v) => updateControl("posX", v)} />
            <Slider label="Position Y (Vertical)" min={-150} max={150} value={controls.posY} onChange={(v) => updateControl("posY", v)} />
            <Slider label="Position Z (Distance)" min={-150} max={150} value={controls.posZ} onChange={(v) => updateControl("posZ", v)} />
            <Slider label="Rotation Pitch (X)" min={-180} max={180} suffix="°" value={controls.rotX} onChange={(v) => updateControl("rotX", v)} />
            <Slider label="Rotation Yaw (Y)" min={-180} max={180} suffix="°" value={controls.rotY} onChange={(v) => updateControl("rotY", v)} />
            <Slider label="Rotation Roll (Z)" min={-180} max={180} suffix="°" value={controls.rotZ} onChange={(v) => updateControl("rotZ", v)} />
            <Slider label="Size Scale" min={30} max={250} suffix="%" value={controls.scale} onChange={(v) => updateControl("scale", v)} />
          </section>

          {/* 3D MATERIAL SELECTION */}
          <section className="rounded-[24px] border border-[var(--card-border)] bg-[var(--card-bg)] p-5 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold flex items-center gap-2 text-foreground">
                <Sparkles className="h-4 w-4 text-primary" /> 3D Material
              </h2>
              <span className="text-[10px] font-bold text-primary uppercase">{materialLabels[controls.material]}</span>
            </div>
            <SegmentedToggle<MaterialKind>
              options={(Object.keys(materialLabels) as MaterialKind[]).map((kind) => ({
                id: kind,
                label: materialLabels[kind],
              }))}
              value={controls.material}
              onChange={(val) => updateControl("material", val)}
              columns={2}
              size="sm"
              className="w-full"
              ariaLabel="3D material"
            />
          </section>

          {/* COLOR MANAGEMENT */}
          <section className="rounded-[24px] border border-[var(--card-border)] bg-[var(--card-bg)] p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold flex items-center gap-2 text-foreground">
                <Palette className="h-4 w-4 text-primary" /> Colors
              </h2>
              <SegmentedToggle<ColorMode>
                options={[
                  { id: "svg", label: "SVG Native", ariaLabel: "Preserve SVG colors" },
                  { id: "custom", label: "Custom", ariaLabel: "Custom color tint" },
                ]}
                value={controls.colorMode}
                onChange={(val) => updateControl("colorMode", val)}
                size="sm"
                className="w-auto min-w-[200px]"
                ariaLabel="Color mode"
              />
            </div>

            {controls.colorMode === "svg" ? (
              <div className="bg-[var(--input-bg)] p-3 rounded-2xl border border-[var(--card-border)] text-xs text-[var(--text-secondary)] space-y-1">
                <p className="font-bold text-foreground flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-primary" /> Native Multi-Color & Gradients Active
                </p>
                <p className="text-[11px] leading-relaxed">
                  Every layer renders with its original SVG fill color & gradient stops using selected{" "}
                  <strong className="text-primary">{materialLabels[controls.material]}</strong> material.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-1.5">
                  {presetColors.map(([label, color]) => (
                    <button
                      key={color}
                      onClick={() => updateColor(color)}
                      className={`flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-[11px] font-bold transition-all border ${
                        controls.color === color
                          ? "border-primary bg-primary/20 text-primary shadow-sm"
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

          {/* EXTRUSION & BEVEL */}
          <section className="space-y-4 rounded-[24px] border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-xl">
            <h2 className="text-sm font-extrabold text-foreground">Extrusion & Bevel Smoothing</h2>
            <Slider label="Depth (Thickness)" min={1} max={60} value={controls.depth} onChange={(value) => updateControl("depth", value)} />
            <Slider label="Bevel Sharpness" min={0} max={8} step={0.1} value={controls.bevel} onChange={(value) => updateControl("bevel", value)} />
            <p className="text-[10px] text-[var(--text-muted)]">Preview keeps bevel detail in Fast Preview; final exports use maximum geometry quality.</p>
            <Slider label="Surface Roughness" min={0} max={100} suffix="%" value={controls.roughness} onChange={(value) => updateControl("roughness", value)} />
            <Slider label="Brightness" min={50} max={180} suffix="%" value={controls.brightness} onChange={(value) => updateControl("brightness", value)} />
          </section>

          {/* STUDIO LIGHTING */}
          <section className="space-y-3 rounded-[24px] border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-xl">
            <h2 className="text-sm font-extrabold flex items-center gap-2 text-foreground">
              <Sun className="h-4 w-4 text-primary" /> Studio Lighting
            </h2>
            <SegmentedToggle<LightingPreset>
              options={(
                [
                  ["studio", "Studio Soft"],
                  ["softbox", "Clean Apple"],
                  ["rim", "Neon Rim"],
                  ["warm", "Warm Sun"],
                  ["cyber", "Cyber Dark"],
                ] as [LightingPreset, string][]
              ).map(([id, label]) => ({ id, label }))}
              value={controls.lighting}
              onChange={(val) => updateControl("lighting", val)}
              columns={3}
              size="sm"
              className="w-full"
              ariaLabel="Studio lighting"
            />
            <label className="flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)] pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={controls.showShadow}
                onChange={(e) => updateControl("showShadow", e.target.checked)}
                className="accent-primary cursor-pointer h-4 w-4 rounded"
              />
              <span>Soft Ambient Ground Shadow</span>
            </label>
          </section>

          {/* EXPORT RESOLUTION */}
          <section className="space-y-4 rounded-[24px] border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-xl">
            <h2 className="text-sm font-extrabold text-foreground">Export Resolution</h2>
            <SegmentedToggle<Resolution>
              options={(["1K", "2K", "4K", "8K"] as Resolution[])}
              value={controls.resolution}
              onChange={(val) => updateControl("resolution", val)}
              size="sm"
              className="w-full"
              ariaLabel="Export resolution"
            />
          </section>
        </aside>

        {/* RIGHT MAIN PANEL: 3D VIEWPORT & DOWNLOAD EXPORTS */}
        <main className="order-1 flex min-h-[640px] flex-col rounded-[28px] border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-2xl xl:sticky xl:top-4 xl:order-2 xl:h-[calc(100vh-7.5rem)]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--input-bg)] text-primary border border-[var(--card-border)]">
                <Box className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-extrabold text-base text-foreground">Interactive 3D Viewport</h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  Rotate, pan & animate with real-time studio lighting.
                </p>
              </div>
            </div>

            {/* All Download Format Options */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => void exportCurrent("mp4")}
                disabled={!selectedAsset || videoRecording}
                className="flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 hover:bg-primary/20 px-3 py-2 text-xs font-bold text-primary transition-all disabled:opacity-40 shadow-sm"
                title={`Download ${controls.videoDuration}s Turntable Video (Max 20s)`}
              >
                {videoRecording ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Video className="h-3.5 w-3.5" />}
                <span>{controls.videoDuration}s Video</span>
              </button>
              <button
                onClick={() => void exportCurrent("webp")}
                disabled={!selectedAsset}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] hover:bg-primary/10 hover:text-primary px-3 py-2 text-xs font-bold transition-all disabled:opacity-40"
              >
                <FileImage className="h-3.5 w-3.5 text-primary" /> WebP
              </button>
              <button
                onClick={() => void exportCurrent("svg")}
                disabled={!selectedAsset}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] hover:bg-primary/10 hover:text-primary px-3 py-2 text-xs font-bold transition-all disabled:opacity-40"
              >
                <FileCode className="h-3.5 w-3.5 text-primary" /> SVG
              </button>
              <button
                onClick={() => void exportCurrent("gltf")}
                disabled={!selectedAsset}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] hover:bg-primary/10 hover:text-primary px-3 py-2 text-xs font-bold transition-all disabled:opacity-40"
                title="Download 3D Model in GLB format"
              >
                <Box className="h-3.5 w-3.5 text-primary" /> 3D GLB
              </button>
              <button
                onClick={() => void exportCurrent("obj")}
                disabled={!selectedAsset}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] hover:bg-primary/10 hover:text-primary px-3 py-2 text-xs font-bold transition-all disabled:opacity-40"
                title="Download 3D OBJ file"
              >
                <Maximize2 className="h-3.5 w-3.5 text-primary" /> OBJ
              </button>
              <button
                onClick={() => void exportBatch()}
                disabled={!assets.length || batch.running}
                className="flex items-center gap-1.5 rounded-xl border border-primary/35 bg-primary/10 hover:bg-primary/20 px-3 py-2 text-xs font-bold text-primary transition-all disabled:opacity-40"
              >
                {batch.running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileArchive className="h-3.5 w-3.5" />}
                <span>ZIP ({assets.length})</span>
              </button>
              {batch.running && (
                <button
                  onClick={() => {
                    cancelBatch.current = true;
                  }}
                  className="flex items-center gap-1 rounded-xl border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-xs font-bold text-red-300"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Cancel
                </button>
              )}
            </div>
          </div>

          {/* 3D WebGL Viewport Container */}
          <div
            className="relative flex-1 w-full overflow-hidden rounded-[24px] border border-dashed border-primary/20 flex items-center justify-center transition-colors duration-300"
            style={{
              backgroundColor: controls.alpha ? "#111317" : controls.bgColor,
              backgroundImage: controls.alpha
                ? "linear-gradient(45deg, rgba(255,255,255,0.05) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.05) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.05) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.05) 75%)"
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
                <h3 className="text-lg font-extrabold text-foreground">Upload an SVG to begin</h3>
                <p className="mt-1 max-w-sm text-xs text-[var(--text-secondary)]">
                  Your photorealistic 3D render with position controls & kinetic animations will appear here.
                </p>
              </div>
            )}
          </div>

          {(error || videoRecording || batch.running || batch.completed > 0 || batch.failed > 0) && (
            <div className="mt-3 rounded-2xl border border-[var(--card-border)] bg-[var(--input-bg)] p-3 text-xs">
              {error && <p className="font-bold text-red-400">{error}</p>}
              {videoRecording && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Recording {controls.videoDuration}s Video...
                    </span>
                    <span>{videoProgress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-foreground/10">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-150"
                      style={{ width: `${videoProgress}%` }}
                    />
                  </div>
                </div>
              )}
              {(batch.running || batch.completed > 0 || batch.failed > 0) && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                    <span>{batch.running ? `Processing ${batch.current}` : "Batch Complete"}</span>
                    <span>
                      {batch.completed} done / {batch.failed} failed
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{
                        width: `${assets.length ? ((batch.completed + batch.failed) / assets.length) * 100 : 0}%`,
                      }}
                    />
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
