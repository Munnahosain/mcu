import { CanvasPreset } from "./types";

export const CANVAS_PRESETS: CanvasPreset[] = [
  // Social
  { id: "ig-square", name: "Instagram Post (1:1)", category: "Social", width: 1080, height: 1080, icon: "📸" },
  { id: "ig-portrait", name: "Instagram Portrait (4:5)", category: "Social", width: 1080, height: 1350, icon: "📱" },
  { id: "ig-story", name: "Instagram Story / Reel (9:16)", category: "Social", width: 1080, height: 1920, icon: "🎬" },
  { id: "yt-thumb", name: "YouTube Thumbnail (16:9)", category: "Social", width: 1280, height: 720, icon: "▶️" },
  { id: "x-header", name: "X / Twitter Header (3:1)", category: "Social", width: 1500, height: 500, icon: "🐦" },
  { id: "dribbble", name: "Dribbble Shot (4:3)", category: "Social", width: 1600, height: 1200, icon: "🏀" },
  { id: "pinterest", name: "Pinterest Pin (2:3)", category: "Social", width: 1000, height: 1500, icon: "📌" },

  // Web & UI
  { id: "desktop-fhd", name: "Desktop Full HD (16:9)", category: "Web & UI", width: 1920, height: 1080, icon: "🖥️" },
  { id: "desktop-mac", name: "MacBook Pro / Air", category: "Web & UI", width: 1440, height: 900, icon: "💻" },
  { id: "tablet-ipad", name: "iPad Pro 11-inch", category: "Web & UI", width: 1194, height: 834, icon: "📟" },
  { id: "mobile-iphone", name: "iPhone 16 / 15 Pro", category: "Web & UI", width: 393, height: 852, icon: "📱" },

  // Print
  { id: "print-a4", name: "A4 Document (210×297 mm)", category: "Print", width: 1240, height: 1754, icon: "📄" },
  { id: "print-a3", name: "A3 Poster (297×420 mm)", category: "Print", width: 1754, height: 2480, icon: "📑" },
  { id: "print-poster", name: "Poster Medium (2:3)", category: "Print", width: 1200, height: 1800, icon: "🎨" },

  // Video & Cinema
  { id: "video-4k", name: "4K UHD Cinema (16:9)", category: "Video", width: 3840, height: 2160, icon: "🎥" },
  { id: "video-ultrawide", name: "Cinematic Ultrawide (21:9)", category: "Video", width: 2560, height: 1080, icon: "🎞️" },
];

export const GRID_COLOR_PALETTES = [
  { name: "Neon Emerald", grid: "#16c784", accent: "#f5c451", bg: "#0c131a" },
  { name: "Golden Ratio", grid: "#eab308", accent: "#38bdf8", bg: "#13110c" },
  { name: "Cyber Cyan", grid: "#06b6d4", accent: "#ec4899", bg: "#08151f" },
  { name: "Electric Violet", grid: "#a855f7", accent: "#10b981", bg: "#13091e" },
  { name: "Crimson Rose", grid: "#f43f5e", accent: "#fbbf24", bg: "#1c090e" },
  { name: "Clean Monochrome", grid: "#ffffff", accent: "#16c784", bg: "#111418" },
];
