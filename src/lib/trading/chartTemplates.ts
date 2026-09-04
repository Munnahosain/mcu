import type { ChartTemplate, ChartType } from "./types";

const names = [
  ["Terminal Candles", "Candles", "candlestick"], ["Classic Candles", "Candles", "candlestick"], ["Neon Candles", "Neon", "candlestick"], ["Minimal Candles", "Minimal", "candlestick"], ["Compact Candles", "Candles", "candlestick"], ["Pro Candles", "Professional", "candlestick"], ["Soft Candles", "Candles", "candlestick"], ["High Contrast Candles", "Candles", "candlestick"], ["Glass Candles", "Professional", "candlestick"], ["Cyber Candles", "Neon", "candlestick"], ["Emerald Candles", "Crypto", "candlestick"], ["Crimson Candles", "Candles", "candlestick"], ["Gold Candles", "Futures", "candlestick"], ["Midnight Candles", "Professional", "candlestick"], ["Monochrome Candles", "Minimal", "candlestick"],
  ["Terminal Line", "Lines", "line"], ["Neon Line", "Neon", "line"], ["Minimal Line", "Minimal", "line"], ["Smooth Line", "Lines", "line"], ["Gradient Line", "Area", "line"], ["Dual Line", "Lines", "line"], ["Triple Line", "Lines", "line"], ["Dashed Line", "Lines", "line"], ["Thin Line", "Minimal", "line"], ["Bold Line", "Professional", "line"],
  ["Terminal Area", "Area", "area"], ["Gradient Area", "Area", "area"], ["Neon Area", "Neon", "area"], ["Soft Area", "Area", "area"], ["Dark Area", "Area", "area"], ["Emerald Area", "Crypto", "area"], ["Crimson Area", "Area", "area"], ["Blue Area", "Area", "area"], ["Gold Area", "Futures", "area"], ["Minimal Area", "Minimal", "area"],
  ["Terminal Bars", "Bars", "bar"], ["Classic Bars", "Bars", "bar"], ["Volume Bars", "Bars", "bar"], ["Neon Bars", "Neon", "bar"], ["Minimal Bars", "Minimal", "bar"], ["Gradient Bars", "Area", "bar"], ["Dual Color Bars", "Bars", "bar"], ["Compact Bars", "Bars", "bar"], ["High Contrast Bars", "Bars", "bar"], ["Trading Desk Bars", "Professional", "bar"],
  ["Bloomberg Inspired", "Professional", "ohlc"], ["Trading Terminal", "Professional", "candlestick"], ["Institutional", "Professional", "ohlc"], ["Quant Dashboard", "Professional", "line"], ["Market Maker", "Professional", "bar"], ["Crypto Pro", "Crypto", "candlestick"], ["Forex Pro", "Forex", "candlestick"], ["Stock Market", "Stocks", "line"], ["Futures Terminal", "Futures", "ohlc"], ["Technical Analysis", "Professional", "candlestick"], ["Dark Finance", "Professional", "area"], ["Professional Minimal", "Minimal", "line"], ["Analyst Desk", "Professional", "line"], ["Quant Research", "Professional", "area"], ["Executive Market", "Stocks", "line"],
  ["Cyberpunk", "Neon", "area"], ["Matrix", "Neon", "line"], ["Aurora", "Neon", "area"], ["Sunset", "Area", "mountain"], ["Ocean", "Area", "area"], ["Arctic", "Minimal", "line"], ["Monochrome Pro", "Professional", "ohlc"], ["High Frequency", "Crypto", "bar"], ["Clean White", "Minimal", "line"], ["Glass Terminal", "Professional", "candlestick"],
  ["Heikin Flow", "Candles", "heikin-ashi"], ["Hollow Pro", "Professional", "hollow"], ["Baseline Focus", "Lines", "baseline"], ["Step Signal", "Lines", "step"], ["Mountain Range", "Area", "mountain"], ["Ruby Momentum", "Crypto", "area"], ["Golden Ratio", "Futures", "line"], ["Forex Session", "Forex", "candlestick"], ["Stock Pulse", "Stocks", "line"], ["Volume Profile", "Bars", "bar"], ["Signal Room", "Professional", "candlestick"], ["Night Shift", "Minimal", "area"], ["Mint Research", "Crypto", "line"], ["Redline Desk", "Professional", "ohlc"], ["Open Range", "Stocks", "candlestick"], ["Vector Slate", "Minimal", "line"],
] as const;

const palettes = [
  ["#07100e", "#17352d", "#27e39a", "#f87171", "#f5c451"], ["#10141f", "#263047", "#73e0ff", "#ff6b87", "#f7c948"], ["#100b19", "#39204f", "#d8ff5f", "#ff4f9a", "#b88cff"], ["#0d1117", "#252b34", "#d6dee8", "#8b98a8", "#f0b84f"], ["#11120d", "#37331c", "#c8e66d", "#f08b6d", "#e8c45d"], ["#090e1a", "#1c3152", "#55d6ff", "#ff6f61", "#f6c85f"], ["#101312", "#29443b", "#75d6ac", "#e87c91", "#d4b483"], ["#050505", "#343434", "#ffffff", "#ff5252", "#ffd166"],
];

export const chartCategories = ["All", "Favorites", "Candles", "Lines", "Area", "Bars", "Minimal", "Professional", "Crypto", "Forex", "Stocks", "Futures", "Neon"];

export const chartTemplates: ChartTemplate[] = names.map(([name, category, chartType], index) => {
  const palette = palettes[index % palettes.length];
  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name, category,
    chartType: chartType as ChartType, background: palette[0], gridColor: palette[1], bullishColor: palette[2], bearishColor: palette[3], lineColor: palette[4], volumeColor: palette[2], textColor: "#dce9e5", accentColor: palette[4],
    candleWidth: 5 + (index % 5), wickWidth: 1 + (index % 3), gridOpacity: 0.12 + (index % 4) * 0.04, fontSize: 11 + (index % 3), showVolume: index % 7 !== 3, showGrid: index % 6 !== 2, showPriceScale: true, showTimeScale: true, showCrosshair: true, movingAverage: index % 4 === 0, glow: index % 5 === 2, gradient: index % 3 === 0, builtIn: true,
  };
});

export const defaultTemplate = chartTemplates[0];
