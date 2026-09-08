"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BarChart2,
  Check,
  ChevronDown,
  Copy,
  Download,
  Eye,
  EyeOff,
  Flame,
  Globe,
  Grid,
  Heart,
  Layers,
  LineChart,
  Maximize2,
  Minimize2,
  Moon,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings2,
  Share2,
  Sliders,
  Sparkles,
  Star,
  TrendingDown,
  TrendingUp,
  Volume2,
  Zap,
} from "lucide-react";
import { candleIntervals, markets, MockMarketDataProvider, tickIntervals } from "@/lib/trading/marketData";
import { chartCategories, chartTemplates, defaultTemplate } from "@/lib/trading/chartTemplates";
import { calculateIndicators, heikinAshi } from "@/lib/trading/indicators";
import { buildChartSvg, downloadSvg } from "@/lib/trading/svgExporter";
import type { Candle, CandleInterval, ChartTemplate, ChartType, IndicatorKey, MarketSymbol, TickInterval } from "@/lib/trading/types";

const chartWidth = 1000;
const chartHeight = 520;

const CHART_TYPES: { id: ChartType; label: string; icon: string }[] = [
  { id: "candlestick", label: "Candles", icon: "🕯️" },
  { id: "heikin-ashi", label: "Heikin Ashi", icon: "📊" },
  { id: "area", label: "Area", icon: "📈" },
  { id: "line", label: "Line", icon: "〰️" },
  { id: "hollow", label: "Hollow", icon: "⬜" },
  { id: "bar", label: "Bars", icon: "🪜" },
  { id: "baseline", label: "Baseline", icon: "⚖️" },
  { id: "mountain", label: "Mountain", icon: "⛰️" },
  { id: "step", label: "Step", icon: "🪜" },
];

export default function TradingPage() {
  const provider = useRef(new MockMarketDataProvider());
  const [symbol, setSymbol] = useState<MarketSymbol>("BTC/USD");
  const [interval, setInterval] = useState<CandleInterval>("2s");
  const [tickInterval, setTickInterval] = useState<TickInterval>("1s");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [template, setTemplate] = useState<ChartTemplate>(defaultTemplate);
  const [chartType, setChartType] = useState<ChartType>(defaultTemplate.chartType);
  const [isPaused, setIsPaused] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [customTemplates, setCustomTemplates] = useState<ChartTemplate[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showVolume, setShowVolume] = useState(defaultTemplate.showVolume);
  const [showGrid, setShowGrid] = useState(defaultTemplate.showGrid);
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);
  const [crosshair, setCrosshair] = useState<{ x: number; y: number; price: number; time: number } | null>(null);

  const [indicators, setIndicators] = useState<Record<IndicatorKey, boolean>>({
    sma20: true,
    sma50: true,
    sma100: false,
    sma200: false,
    ema9: false,
    ema20: false,
    ema50: false,
    ema200: false,
    vwap: false,
    bollinger: false,
    rsi: false,
    macd: false,
    volume: true,
  });

  const [zoom, setZoom] = useState(1);
  const [toast, setToast] = useState("");

  useEffect(() => {
    try {
      setFavorites(JSON.parse(localStorage.getItem("mcustock-trading-favorites") || "[]"));
      setCustomTemplates(JSON.parse(localStorage.getItem("mcustock-trading-custom") || "[]"));
    } catch {
      // defaults
    }
  }, []);

  useEffect(() => {
    provider.current.subscribe(symbol, interval, tickInterval, setCandles);
    return () => provider.current.unsubscribe();
  }, [symbol, interval, tickInterval]);

  useEffect(() => {
    if (isPaused) provider.current.unsubscribe();
    else provider.current.subscribe(symbol, interval, tickInterval, setCandles);
    return () => provider.current.unsubscribe();
  }, [isPaused, symbol, interval, tickInterval]);

  useEffect(() => {
    setShowVolume(template.showVolume);
    setShowGrid(template.showGrid);
    setChartType(template.chartType);
  }, [template]);

  const allTemplates = [...customTemplates, ...chartTemplates];
  const filteredTemplates = allTemplates.filter(
    (item) =>
      (category === "All" || (category === "Favorites" ? favorites.includes(item.id) : item.category === category)) &&
      `${item.name} ${item.category}`.toLowerCase().includes(search.toLowerCase())
  );

  const activeCandles = useMemo(() => {
    if (chartType === "heikin-ashi") {
      return heikinAshi(candles);
    }
    return candles;
  }, [candles, chartType]);

  const current = candles.at(-1);
  const previous = candles.at(-2);
  const first = candles[0];
  const change = current && previous ? current.close - previous.close : 0;
  const changePercent = previous ? (change / previous.close) * 100 : 0;
  const sessionChange = current && first ? current.close - first.open : 0;
  const sessionChangePercent = first ? (sessionChange / first.open) * 100 : 0;

  const high = candles.length ? Math.max(...candles.map((item) => item.high)) : 0;
  const low = candles.length ? Math.min(...candles.map((item) => item.low)) : 0;
  const totalVolume = candles.reduce((sum, item) => sum + item.volume, 0);

  const activeConfig: ChartTemplate = {
    ...template,
    chartType,
    showVolume,
    showGrid,
  };

  const svgMarkup = useMemo(() => buildChartSvg(activeCandles, activeConfig), [activeCandles, activeConfig]);
  const indicatorValues = useMemo(() => calculateIndicators(activeCandles), [activeCandles]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  };

  const toggleFavorite = (id: string) => {
    const next = favorites.includes(id) ? favorites.filter((item) => item !== id) : [...favorites, id];
    setFavorites(next);
    localStorage.setItem("mcustock-trading-favorites", JSON.stringify(next));
  };

  const saveTemplate = () => {
    const name = window.prompt("Template name", `${symbol.replace("/", "-")} Custom`);
    if (!name?.trim()) return;
    const saved = {
      ...activeConfig,
      id: `custom-${Date.now()}`,
      name: name.trim(),
      category: "Custom",
      builtIn: false,
    };
    const next = [saved, ...customTemplates];
    setCustomTemplates(next);
    localStorage.setItem("mcustock-trading-custom", JSON.stringify(next));
    setTemplate(saved);
    notify("Template saved to Favorites");
  };

  const copySvg = async () => {
    try {
      await navigator.clipboard.writeText(svgMarkup);
      notify("Vector SVG copied to clipboard");
    } catch {
      notify("Clipboard unavailable");
    }
  };

  const exportSvg = () => {
    downloadSvg(svgMarkup, `${symbol.toLowerCase().replace("/", "-")}-${template.id}.svg`);
    notify("SVG exported successfully");
  };

  const displayCandle = hoveredCandle || current;
  const isPositive = (displayCandle ? displayCandle.close >= displayCandle.open : change >= 0);

  return (
    <div className="space-y-5 pb-8">
      {/* Top Header */}
      <header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="liquid-chip w-fit text-xs font-bold">
              <Activity className="h-3.5 w-3.5 text-primary" /> Realtime Terminal
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-primary/30 bg-primary/10 text-primary">
              <span className={`h-2 w-2 rounded-full ${isPaused ? "bg-amber-400" : "bg-primary animate-pulse"}`} />
              {isPaused ? "FEED PAUSED" : "LIVE TICK"}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
            Live Trading Studio
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-foreground/60">
            Professional multi-style vector market charts with real-time indicators
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsPaused((value) => !value)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
              isPaused
                ? "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                : "bg-foreground/5 border-foreground/10 text-foreground/80 hover:bg-foreground/10"
            }`}
          >
            {isPaused ? <Play className="h-3.5 w-3.5 fill-current" /> : <Pause className="h-3.5 w-3.5" />}
            {isPaused ? "Resume Live Feed" : "Pause Feed"}
          </button>
          <button
            onClick={copySvg}
            title="Copy vector SVG to clipboard"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-foreground/10 bg-foreground/5 hover:bg-foreground/10 transition-colors text-foreground/80"
          >
            <Copy className="h-3.5 w-3.5" /> Copy SVG
          </button>
          <button
            onClick={exportSvg}
            title="Download SVG vector file"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary text-background hover:bg-primary-hover transition-colors shadow-lg shadow-primary/20"
          >
            <Download className="h-3.5 w-3.5 stroke-[2.5]" /> Export SVG
          </button>
        </div>
      </header>

      {/* Main Terminal Bar (Markets, Timeframes, Chart Styles) */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl border border-[var(--sidebar-border)] bg-[var(--sidebar-bg)]">
        {/* Market Selector */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-foreground/45 shrink-0 pl-1">
            Symbol:
          </span>
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value as MarketSymbol)}
            className="h-9 px-3 rounded-xl bg-foreground/[0.06] border border-foreground/10 text-xs font-bold text-foreground focus:outline-none focus:border-primary cursor-pointer"
          >
            {markets.map((m) => (
              <option key={m} value={m} className="bg-[#111827] text-white">
                {m}
              </option>
            ))}
          </select>

          <div className="h-5 w-[1px] bg-foreground/10 mx-1 shrink-0" />

          {/* Timeframe Interval Buttons */}
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-foreground/45 shrink-0">
            Time:
          </span>
          <div className="inline-flex items-center gap-1 bg-foreground/[0.04] p-1 rounded-xl border border-foreground/10">
            {(["1s", "5s", "15s", "1m", "5m", "15m", "1h", "4h", "1D"] as CandleInterval[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setInterval(tf)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  interval === tf
                    ? "bg-primary text-background shadow-sm"
                    : "text-foreground/60 hover:text-foreground hover:bg-foreground/5"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Chart Types & Indicator controls */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {/* Chart Style Switcher */}
          <div className="inline-flex items-center gap-1 bg-foreground/[0.04] p-1 rounded-xl border border-foreground/10">
            {CHART_TYPES.slice(0, 5).map((ct) => (
              <button
                key={ct.id}
                onClick={() => setChartType(ct.id)}
                title={ct.label}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  chartType === ct.id
                    ? "bg-primary text-background shadow-sm"
                    : "text-foreground/60 hover:text-foreground hover:bg-foreground/5"
                }`}
              >
                <span>{ct.icon}</span>
                <span className="hidden sm:inline">{ct.label}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowSettings((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors ${
              showSettings
                ? "bg-primary/20 border-primary text-primary"
                : "bg-foreground/[0.04] border-foreground/10 text-foreground/70 hover:text-foreground"
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Indicators & Colors</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Chart Panel + Sidebar Templates (Responsive side-by-side layout) */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Left / Center: The Live Trading Chart */}
        <main className="min-w-0 space-y-4">
          <section
            className="rounded-2xl border border-[var(--sidebar-border)] overflow-hidden shadow-2xl transition-all"
            style={{ background: template.background }}
          >
            {/* Top Market Bar & OHLC HUD */}
            <div className="p-4 border-b border-foreground/10 bg-black/20 flex flex-wrap items-center justify-between gap-4">
              {/* Live Price & Symbol */}
              <div className="flex items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-black tracking-tight" style={{ color: template.textColor }}>
                      {symbol}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/20 text-primary border border-primary/30">
                      {interval}
                    </span>
                    <span className="text-xs text-foreground/45 font-semibold">
                      {template.name} ({chartType})
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2.5 mt-0.5">
                    <span className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: template.textColor }}>
                      {formatPrice(current?.close ?? 0)}
                    </span>
                    <span
                      className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-md ${
                        sessionChange >= 0
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                      }`}
                    >
                      {sessionChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {sessionChange >= 0 ? "+" : ""}
                      {sessionChangePercent.toFixed(2)}% ({sessionChange >= 0 ? "+" : ""}
                      {formatPrice(sessionChange)})
                    </span>
                  </div>
                </div>
              </div>

              {/* 24h Stats Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-foreground/45 block">24h High</span>
                  <span className="font-bold text-foreground/90">{formatPrice(high)}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-foreground/45 block">24h Low</span>
                  <span className="font-bold text-foreground/90">{formatPrice(low)}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-foreground/45 block">24h Vol (USD)</span>
                  <span className="font-bold text-foreground/90">{formatVolume(totalVolume)}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-foreground/45 block">Active Bars</span>
                  <span className="font-bold text-foreground/90">{candles.length}</span>
                </div>
              </div>
            </div>

            {/* Candle OHLC HUD Overlay Bar */}
            {displayCandle && (
              <div className="px-4 py-2 border-b border-foreground/5 bg-black/10 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] font-mono">
                <span className="text-foreground/50">
                  Time: <b className="text-foreground/80">{new Date(displayCandle.time).toLocaleTimeString()}</b>
                </span>
                <span>
                  O: <b className="text-foreground/90">{formatPrice(displayCandle.open)}</b>
                </span>
                <span>
                  H: <b className="text-emerald-400">{formatPrice(displayCandle.high)}</b>
                </span>
                <span>
                  L: <b className="text-rose-400">{formatPrice(displayCandle.low)}</b>
                </span>
                <span>
                  C:{" "}
                  <b style={{ color: displayCandle.close >= displayCandle.open ? template.bullishColor : template.bearishColor }}>
                    {formatPrice(displayCandle.close)}
                  </b>
                </span>
                <span>
                  Vol: <b className="text-foreground/90">{formatVolume(displayCandle.volume)}</b>
                </span>

                {/* MA Legends */}
                {indicators.sma20 && (
                  <span className="text-[#f5c451] font-bold">
                    MA(20): {formatPrice(indicatorValues.sma20.at(-1) ?? 0)}
                  </span>
                )}
                {indicators.sma50 && (
                  <span className="text-[#38bdf8] font-bold">
                    MA(50): {formatPrice(indicatorValues.sma50.at(-1) ?? 0)}
                  </span>
                )}
                {indicators.bollinger && (
                  <span className="text-[#c084fc] font-bold">BOLL(20,2)</span>
                )}
                {indicators.rsi && (
                  <span className="text-[#f43f5e] font-bold">
                    RSI(14): {Number(indicatorValues.rsi.at(-1) ?? 50).toFixed(1)}
                  </span>
                )}
              </div>
            )}

            {/* SVG Interactive Canvas */}
            <div
              className="relative overflow-x-auto custom-scrollbar select-none"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                const padding = { top: 30, right: 80, bottom: template.showVolume ? 100 : 40, left: 15 };
                const plotWidth = (chartWidth - padding.left - padding.right) / zoom;
                const candleWidthWithGap = plotWidth / Math.max(activeCandles.length, 1);
                const candleIdx = Math.floor((mouseX - padding.left) / candleWidthWithGap);
                if (candleIdx >= 0 && candleIdx < activeCandles.length) {
                  setHoveredCandle(activeCandles[candleIdx]);
                  setCrosshair({
                    x: padding.left + candleIdx * candleWidthWithGap + candleWidthWithGap / 2,
                    y: mouseY,
                    price: 0,
                    time: activeCandles[candleIdx].time,
                  });
                }
              }}
              onMouseLeave={() => {
                setHoveredCandle(null);
                setCrosshair(null);
              }}
            >
              <TradingChartCanvas
                candles={activeCandles}
                template={activeConfig}
                chartType={chartType}
                zoom={zoom}
                indicators={indicators}
                indicatorValues={indicatorValues}
                crosshair={crosshair}
              />
            </div>

            {/* Bottom Status & Zoom bar */}
            <div className="p-3 border-t border-foreground/10 bg-black/30 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3 text-foreground/55 text-[11px]">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Live Binance Feed Simulator
                </span>
                <span>·</span>
                <span>Ticks: {tickInterval}</span>
                <span>·</span>
                <span>Zoom: {(zoom * 100).toFixed(0)}%</span>
              </div>

              {/* Indicator Quick Toggles */}
              <div className="flex items-center gap-1.5">
                {(["sma20", "sma50", "bollinger", "rsi", "macd"] as IndicatorKey[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setIndicators((prev) => ({ ...prev, [key]: !prev[key] }))}
                    className={`px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider transition-colors ${
                      indicators[key]
                        ? "bg-primary/25 text-primary border border-primary/40"
                        : "bg-foreground/5 text-foreground/40 hover:text-foreground border border-transparent"
                    }`}
                  >
                    {key.toUpperCase()}
                  </button>
                ))}

                <div className="h-4 w-[1px] bg-foreground/10 mx-1" />

                {/* Zoom Controls */}
                <button
                  onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
                  className="px-2 py-0.5 rounded bg-foreground/10 hover:bg-foreground/20 text-xs font-bold"
                  title="Zoom Out"
                >
                  −
                </button>
                <button
                  onClick={() => setZoom(1)}
                  className="px-2 py-0.5 rounded bg-foreground/10 hover:bg-foreground/20 text-[10px] font-bold"
                  title="Reset Zoom"
                >
                  <RotateCcw className="h-3 w-3 inline" /> 100%
                </button>
                <button
                  onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))}
                  className="px-2 py-0.5 rounded bg-foreground/10 hover:bg-foreground/20 text-xs font-bold"
                  title="Zoom In"
                >
                  +
                </button>
              </div>
            </div>
          </section>

          {/* Indicator Settings Panel (Collapsible) */}
          {showSettings && (
            <SettingsPanel
              template={template}
              showVolume={showVolume}
              showGrid={showGrid}
              setShowVolume={setShowVolume}
              setShowGrid={setShowGrid}
              setTemplate={setTemplate}
              indicators={indicators}
              setIndicators={setIndicators}
            />
          )}
        </main>

        {/* Right Sidebar: Rich Template Gallery */}
        <aside className="rounded-2xl border border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] flex flex-col p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-black text-sm tracking-wide flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" /> CHART TEMPLATES
              </h2>
              <p className="text-[11px] text-foreground/50">{allTemplates.length} Unique Visual Styles</p>
            </div>
            <button
              onClick={saveTemplate}
              title="Save current chart settings as custom template"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-primary/30 bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors"
            >
              <Save className="h-3.5 w-3.5" /> Save
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search styles (Neon, Candles, Area...)"
              className="w-full h-9 rounded-xl bg-foreground/[0.05] border border-foreground/10 pl-8 pr-3 text-xs outline-none focus:border-primary placeholder:text-foreground/40"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
            {chartCategories.map((item) => (
              <button
                key={item}
                onClick={() => setCategory(item)}
                className={`whitespace-nowrap rounded-full px-3 py-1 text-[10px] font-extrabold transition-all ${
                  category === item
                    ? "bg-primary text-background shadow-sm"
                    : "text-foreground/55 hover:text-foreground hover:bg-foreground/5"
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          {/* Template Cards List (Full-height 16:9 preview cards with smooth scroll) */}
          <div className="flex flex-col gap-3.5 overflow-y-auto max-h-[720px] custom-scrollbar pr-1.5">
            {filteredTemplates.map((item) => {
              const isSelected = template.id === item.id;
              const isFav = favorites.includes(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => setTemplate(item)}
                  className={`group relative rounded-2xl border p-3 text-left transition-all shrink-0 w-full ${
                    isSelected
                      ? "border-primary bg-primary/10 shadow-[0_0_25px_rgba(22,199,132,0.2)] ring-2 ring-primary/50"
                      : "border-foreground/10 bg-foreground/[0.03] hover:border-primary/40 hover:bg-foreground/[0.06]"
                  }`}
                >
                  {/* Dynamic Template Visual Preview */}
                  <DynamicMiniPreview template={item} />

                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="block truncate text-xs font-bold text-foreground/90 group-hover:text-primary transition-colors">
                        {item.name}
                      </span>
                      <span className="text-[10px] font-semibold text-foreground/45 flex items-center gap-1.5 mt-0.5">
                        <span className="uppercase">{item.chartType}</span>
                        <span>•</span>
                        <span>{item.category}</span>
                      </span>
                    </div>

                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(item.id);
                      }}
                      className="p-1 rounded-lg text-foreground/40 hover:text-primary hover:bg-foreground/10 transition-colors"
                      title={isFav ? "Remove favorite" : "Add to favorites"}
                    >
                      {isFav ? (
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                      ) : (
                        <Heart className="h-4 w-4" />
                      )}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>
      </div>

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-foreground px-4 py-2.5 text-xs font-bold text-background shadow-2xl animate-fade-in border border-foreground/20">
          {toast}
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   AUTHENTIC TRADING CHART CANVAS (Pixel-Perfect SVG / Multi-type Renderer)
   ========================================================================= */

function TradingChartCanvas({
  candles,
  template,
  chartType,
  zoom,
  indicators,
  indicatorValues,
  crosshair,
}: {
  candles: Candle[];
  template: ChartTemplate;
  chartType: ChartType;
  zoom: number;
  indicators: Record<IndicatorKey, boolean>;
  indicatorValues: ReturnType<typeof calculateIndicators>;
  crosshair: { x: number; y: number; price: number; time: number } | null;
}) {
  const values = candles.length ? candles.flatMap((item) => [item.high, item.low]) : [0, 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 0.01);

  const padding = {
    top: 30,
    right: 85,
    bottom: template.showVolume ? 100 : 40,
    left: 15,
  };

  const plotHeight = chartHeight - padding.top - padding.bottom;
  const plotWidth = (chartWidth - padding.left - padding.right) / zoom;
  const gap = plotWidth / Math.max(candles.length, 1);

  const y = (val: number) => padding.top + ((max - val) / range) * plotHeight;
  const priceAtY = (yCoord: number) => max - ((yCoord - padding.top) / plotHeight) * range;

  const currentPrice = candles.at(-1)?.close ?? 0;
  const currentRising = candles.length > 1 ? currentPrice >= (candles.at(-2)?.close ?? currentPrice) : true;
  const currentPriceColor = currentRising ? template.bullishColor : template.bearishColor;

  const linePath = (series: (number | null)[]) =>
    series
      .map((value, index) =>
        value === null ? "" : `${index ? "L" : "M"}${padding.left + index * gap + gap / 2},${y(value)}`
      )
      .filter(Boolean)
      .join(" ");

  const color = (item: Candle) => (item.close >= item.open ? template.bullishColor : template.bearishColor);

  // Area fill path
  const areaPath = useMemo(() => {
    if (candles.length < 2) return "";
    const points = candles.map((c, i) => `${padding.left + i * gap + gap / 2},${y(c.close)}`);
    const startX = padding.left + gap / 2;
    const endX = padding.left + (candles.length - 1) * gap + gap / 2;
    const bottomY = padding.top + plotHeight;
    return `M${startX},${bottomY} L${points.join(" L")} L${endX},${bottomY} Z`;
  }, [candles, gap, plotHeight, padding.left, padding.top]);

  const maxVolume = Math.max(...candles.map((c) => c.volume), 1);

  return (
    <svg
      viewBox={`0 0 ${chartWidth} ${chartHeight}`}
      style={{ minWidth: zoom > 1 ? `${Math.max(760, zoom * 960)}px` : "100%" }}
      className="block h-auto min-h-[440px] w-full"
      role="img"
      aria-label={`${template.name} trading chart`}
    >
      <defs>
        {/* Area Gradient */}
        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={template.bullishColor} stopOpacity="0.45" />
          <stop offset="60%" stopColor={template.lineColor} stopOpacity="0.15" />
          <stop offset="100%" stopColor={template.background} stopOpacity="0.0" />
        </linearGradient>

        {/* Mountain Gradient */}
        <linearGradient id="mountainGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={template.lineColor} stopOpacity="0.6" />
          <stop offset="40%" stopColor={template.bullishColor} stopOpacity="0.25" />
          <stop offset="100%" stopColor={template.background} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* 🌟 Authentic Pro Trading Grid (Crisp Visible Price & Time Coordinate Lines) */}
      {template.showGrid && (
        <g>
          {/* Horizontal Price Grid Lines */}
          {[0, 1, 2, 3, 4, 5].map((step) => {
            const gridY = padding.top + (plotHeight * step) / 5;
            return (
              <line
                key={`h-grid-${step}`}
                x1={padding.left}
                x2={chartWidth - padding.right}
                y1={gridY}
                y2={gridY}
                stroke={template.gridColor || "#384152"}
                strokeWidth="1"
                strokeOpacity={Math.max(0.4, (template.gridOpacity || 0.35) * 1.4)}
                strokeDasharray="3 3"
              />
            );
          })}

          {/* Vertical Time Grid Lines */}
          {[0.12, 0.25, 0.38, 0.5, 0.62, 0.75, 0.88].map((step, idx) => {
            const gridX = padding.left + (chartWidth - padding.left - padding.right) * step;
            return (
              <line
                key={`v-grid-${idx}`}
                x1={gridX}
                x2={gridX}
                y1={padding.top}
                y2={chartHeight - padding.bottom + (template.showVolume ? 35 : 0)}
                stroke={template.gridColor || "#384152"}
                strokeWidth="1"
                strokeOpacity={Math.max(0.35, (template.gridOpacity || 0.35) * 1.2)}
                strokeDasharray="3 3"
              />
            );
          })}
        </g>
      )}

      {/* Bollinger Bands Shaded Channel */}
      {indicators.bollinger && (
        <g opacity="0.12">
          {indicatorValues.bollinger.map((b, i) => {
            if (!b || i === 0) return null;
            const prev = indicatorValues.bollinger[i - 1];
            if (!prev) return null;
            const x1 = padding.left + (i - 1) * gap + gap / 2;
            const x2 = padding.left + i * gap + gap / 2;
            const yUpper1 = y(prev.upper);
            const yUpper2 = y(b.upper);
            const yLower1 = y(prev.lower);
            const yLower2 = y(b.lower);
            return (
              <polygon
                key={`bb-poly-${i}`}
                points={`${x1},${yUpper1} ${x2},${yUpper2} ${x2},${yLower2} ${x1},${yLower1}`}
                fill={template.lineColor}
              />
            );
          })}
        </g>
      )}

      {/* CHART TYPE RENDERING */}

      {/* 1. Area / Mountain Chart */}
      {(chartType === "area" || chartType === "mountain") && (
        <g>
          <path
            d={areaPath}
            fill={chartType === "mountain" ? "url(#mountainGradient)" : "url(#areaGradient)"}
          />
          <path
            d={linePath(candles.map((c) => c.close))}
            fill="none"
            stroke={template.lineColor}
            strokeWidth="3"
            filter={template.glow ? "drop-shadow(0 0 6px rgba(22,199,132,0.6))" : undefined}
          />
        </g>
      )}

      {/* 2. Line / Step / Baseline Chart */}
      {(chartType === "line" || chartType === "step" || chartType === "baseline") && (
        <g>
          {chartType === "baseline" && (
            <line
              x1={padding.left}
              x2={chartWidth - padding.right}
              y1={padding.top + plotHeight / 2}
              y2={padding.top + plotHeight / 2}
              stroke={template.gridColor}
              strokeWidth="2"
              strokeDasharray="5 5"
            />
          )}
          <path
            d={linePath(candles.map((c) => c.close))}
            fill="none"
            stroke={template.lineColor}
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={template.glow ? "drop-shadow(0 0 8px rgba(39,227,154,0.7))" : undefined}
          />
        </g>
      )}

      {/* 3. Candlesticks / Heikin Ashi / Hollow / Bars / OHLC */}
      {["candlestick", "heikin-ashi", "hollow", "bar", "ohlc"].includes(chartType) && (
        <g>
          {candles.map((c, i) => {
            const cx = padding.left + i * gap + gap / 2;
            const top = Math.min(y(c.open), y(c.close));
            const bodyHeight = Math.max(Math.abs(y(c.open) - y(c.close)), 1.5);
            const isBullish = c.close >= c.open;
            const barColor = isBullish ? template.bullishColor : template.bearishColor;
            const candleW = Math.max(gap * 0.72, 3);

            if (chartType === "ohlc" || chartType === "bar") {
              return (
                <g key={`ohlc-${c.time}`}>
                  {/* High-Low Spine */}
                  <line
                    x1={cx}
                    x2={cx}
                    y1={y(c.high)}
                    y2={y(c.low)}
                    stroke={barColor}
                    strokeWidth={template.wickWidth || 1.5}
                  />
                  {/* Left Open Tick */}
                  <line
                    x1={cx - candleW / 2}
                    x2={cx}
                    y1={y(c.open)}
                    y2={y(c.open)}
                    stroke={barColor}
                    strokeWidth={template.wickWidth || 1.5}
                  />
                  {/* Right Close Tick */}
                  <line
                    x1={cx}
                    x2={cx + candleW / 2}
                    y1={y(c.close)}
                    y2={y(c.close)}
                    stroke={barColor}
                    strokeWidth={template.wickWidth || 1.5}
                  />
                </g>
              );
            }

            // Candlesticks (Solid / Hollow)
            return (
              <g key={`candle-${c.time}`} className="transition-opacity">
                {/* Upper & Lower Wick Line */}
                <line
                  x1={cx}
                  x2={cx}
                  y1={y(c.high)}
                  y2={y(c.low)}
                  stroke={barColor}
                  strokeWidth={template.wickWidth || 1.2}
                />
                {/* Candle Body Rect */}
                <rect
                  x={cx - candleW / 2}
                  y={top}
                  width={candleW}
                  height={bodyHeight}
                  fill={chartType === "hollow" && isBullish ? template.background : barColor}
                  stroke={barColor}
                  strokeWidth={chartType === "hollow" && isBullish ? 1.5 : 0}
                  rx="1"
                />
              </g>
            );
          })}
        </g>
      )}

      {/* TECHNICAL INDICATOR LINES */}

      {/* SMA 20 (Yellow) */}
      {indicators.sma20 && (
        <path
          d={linePath(indicatorValues.sma20)}
          fill="none"
          stroke="#f5c451"
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}

      {/* SMA 50 (Cyan) */}
      {indicators.sma50 && (
        <path
          d={linePath(indicatorValues.sma50)}
          fill="none"
          stroke="#38bdf8"
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}

      {/* EMA 9 (Pink) */}
      {indicators.ema9 && (
        <path
          d={linePath(indicatorValues.ema9)}
          fill="none"
          stroke="#f43f5e"
          strokeWidth="1.8"
          strokeDasharray="4 2"
        />
      )}

      {/* VWAP (Orange) */}
      {indicators.vwap && (
        <path
          d={linePath(indicatorValues.vwap)}
          fill="none"
          stroke="#fb923c"
          strokeWidth="2"
          strokeDasharray="6 4"
        />
      )}

      {/* Bollinger Upper & Lower Lines (Purple) */}
      {indicators.bollinger && (
        <g>
          <path
            d={linePath(indicatorValues.bollinger.map((b) => b?.upper ?? null))}
            fill="none"
            stroke="#c084fc"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
          <path
            d={linePath(indicatorValues.bollinger.map((b) => b?.lower ?? null))}
            fill="none"
            stroke="#c084fc"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
        </g>
      )}

      {/* VOLUME HISTOGRAM PANE */}
      {template.showVolume && (
        <g>
          <line
            x1={padding.left}
            x2={chartWidth - padding.right}
            y1={chartHeight - 68}
            y2={chartHeight - 68}
            stroke={template.gridColor}
            strokeWidth="1"
            opacity="0.2"
          />
          {candles.map((c, i) => {
            const cx = padding.left + i * gap + gap / 2;
            const volHeight = Math.max((c.volume / maxVolume) * 55, 2);
            const isBull = c.close >= c.open;
            return (
              <rect
                key={`vol-${c.time}`}
                x={cx - Math.max(gap * 0.35, 1.5)}
                y={chartHeight - 25 - volHeight}
                width={Math.max(gap * 0.7, 3)}
                height={volHeight}
                fill={isBull ? template.bullishColor : template.bearishColor}
                opacity="0.5"
                rx="1"
              />
            );
          })}
        </g>
      )}

      {/* LIVE CURRENT PRICE TRACKER LINE */}
      {candles.length > 0 && (
        <g>
          <line
            x1={padding.left}
            x2={chartWidth - padding.right}
            y1={y(currentPrice)}
            y2={y(currentPrice)}
            stroke={currentPriceColor}
            strokeWidth="1.2"
            strokeDasharray="4 4"
            opacity="0.85"
          />
          {/* Price Tag Pill on Right Axis */}
          <rect
            x={chartWidth - padding.right}
            y={y(currentPrice) - 10}
            width="80"
            height="20"
            fill={currentPriceColor}
            rx="4"
          />
          <text
            x={chartWidth - padding.right + 40}
            y={y(currentPrice) + 4}
            fill="#051c14"
            fontSize="10"
            fontWeight="bold"
            textAnchor="middle"
          >
            {formatPrice(currentPrice)}
          </text>
        </g>
      )}

      {/* RIGHT Y-AXIS PRICE LABELS */}
      {[0, 1, 2, 3, 4].map((step) => {
        const p = max - (range * step) / 4;
        const pY = padding.top + (plotHeight * step) / 4;
        return (
          <text
            key={`p-${step}`}
            x={chartWidth - padding.right + 8}
            y={pY + 4}
            fill={template.textColor}
            opacity="0.6"
            fontSize={template.fontSize || 10}
            fontFamily="monospace"
          >
            {formatPrice(p)}
          </text>
        );
      })}

      {/* BOTTOM X-AXIS TIME LABELS */}
      {[0.1, 0.35, 0.65, 0.9].map((step, idx) => {
        const cIdx = Math.floor(candles.length * step);
        const candle = candles[cIdx];
        if (!candle) return null;
        const timeX = padding.left + cIdx * gap + gap / 2;
        return (
          <text
            key={`t-${idx}`}
            x={timeX}
            y={chartHeight - 8}
            fill={template.textColor}
            opacity="0.5"
            fontSize="10"
            fontFamily="monospace"
            textAnchor="middle"
          >
            {new Date(candle.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </text>
        );
      })}

      {/* INTERACTIVE CROSSHAIR */}
      {crosshair && (
        <g pointerEvents="none">
          {/* Vertical Time Line */}
          <line
            x1={crosshair.x}
            x2={crosshair.x}
            y1={padding.top}
            y2={chartHeight - padding.bottom + 10}
            stroke="#ffffff"
            strokeWidth="1"
            strokeDasharray="3 3"
            opacity="0.4"
          />
          {/* Horizontal Price Line */}
          <line
            x1={padding.left}
            x2={chartWidth - padding.right}
            y1={crosshair.y}
            y2={crosshair.y}
            stroke="#ffffff"
            strokeWidth="1"
            strokeDasharray="3 3"
            opacity="0.4"
          />
          {/* Crosshair Price Tag */}
          <rect
            x={chartWidth - padding.right}
            y={crosshair.y - 9}
            width="75"
            height="18"
            fill="#1e293b"
            stroke="#475569"
            rx="3"
          />
          <text
            x={chartWidth - padding.right + 37}
            y={crosshair.y + 4}
            fill="#ffffff"
            fontSize="10"
            fontWeight="bold"
            textAnchor="middle"
            fontFamily="monospace"
          >
            {formatPrice(priceAtY(crosshair.y))}
          </text>
        </g>
      )}
    </svg>
  );
}

/* =========================================================================
   DYNAMIC MINI PREVIEW FOR EACH TEMPLATE (Diverse Real Visual Preview)
   ========================================================================= */

function DynamicMiniPreview({ template }: { template: ChartTemplate }) {
  const isArea = template.chartType === "area" || template.chartType === "mountain";
  const isLine = template.chartType === "line" || template.chartType === "step";
  const isHollow = template.chartType === "hollow";
  const isBar = template.chartType === "bar" || template.chartType === "ohlc";

  return (
    <div
      className="w-full h-32 sm:h-36 rounded-xl relative overflow-hidden border border-foreground/10 shadow-md shrink-0 block"
      style={{ background: template.background }}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full block" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`mini-grad-${template.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={template.bullishColor} stopOpacity="0.4" />
            <stop offset="100%" stopColor={template.background} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* 16:9 Background Grid */}
        <g opacity={template.gridOpacity || 0.2}>
          <line x1="0" x2="320" y1="45" y2="45" stroke={template.gridColor} strokeWidth="1" strokeDasharray="4 4" />
          <line x1="0" x2="320" y1="90" y2="90" stroke={template.gridColor} strokeWidth="1" strokeDasharray="4 4" />
          <line x1="0" x2="320" y1="135" y2="135" stroke={template.gridColor} strokeWidth="1" strokeDasharray="4 4" />
          <line x1="106" x2="106" y1="0" y2="180" stroke={template.gridColor} strokeWidth="1" strokeDasharray="4 4" />
          <line x1="213" x2="213" y1="0" y2="180" stroke={template.gridColor} strokeWidth="1" strokeDasharray="4 4" />
        </g>

        {/* Area / Mountain 16:9 Path */}
        {isArea && (
          <g>
            <polygon
              points="0,180 0,110 30,85 65,105 100,55 135,75 170,30 205,65 240,40 275,55 320,25 320,180"
              fill={`url(#mini-grad-${template.id})`}
            />
            <path
              d="M0,110 L30,85 L65,105 L100,55 L135,75 L170,30 L205,65 L240,40 L275,55 L320,25"
              fill="none"
              stroke={template.lineColor || template.bullishColor}
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        )}

        {/* Line / Step 16:9 Path */}
        {isLine && (
          <path
            d={
              template.chartType === "step"
                ? "M0,120 L40,120 L40,90 L90,90 L90,110 L140,110 L140,60 L190,60 L190,45 L240,45 L240,30 L320,30"
                : "M0,125 L35,100 L70,115 L105,60 L140,80 L175,35 L210,70 L245,45 L280,55 L320,28"
            }
            fill="none"
            stroke={template.lineColor}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Candlestick / Hollow / OHLC / Bars 16:9 Path */}
        {!isArea && !isLine && (
          <g>
            {[
              { x: 22, open: 115, close: 85, high: 70, low: 130, bull: true },
              { x: 48, open: 85, close: 105, high: 75, low: 118, bull: false },
              { x: 74, open: 105, close: 68, high: 55, low: 115, bull: true },
              { x: 100, open: 68, close: 92, high: 60, low: 102, bull: false },
              { x: 126, open: 92, close: 50, high: 38, low: 98, bull: true },
              { x: 152, open: 50, close: 72, high: 42, low: 80, bull: false },
              { x: 178, open: 72, close: 38, high: 28, low: 82, bull: true },
              { x: 204, open: 38, close: 58, high: 30, low: 68, bull: false },
              { x: 230, open: 58, close: 32, high: 22, low: 65, bull: true },
              { x: 256, open: 32, close: 48, high: 25, low: 58, bull: false },
              { x: 282, open: 48, close: 25, high: 15, low: 55, bull: true },
              { x: 304, open: 25, close: 36, high: 18, low: 45, bull: false },
            ].map((c, i) => {
              const color = c.bull ? template.bullishColor : template.bearishColor;
              const top = Math.min(c.open, c.close);
              const height = Math.max(Math.abs(c.open - c.close), 3);

              if (isBar) {
                return (
                  <g key={`minibar-${i}`}>
                    <line x1={c.x} x2={c.x} y1={c.high} y2={c.low} stroke={color} strokeWidth="2" />
                    <line x1={c.x - 6} x2={c.x} y1={c.open} y2={c.open} stroke={color} strokeWidth="2" />
                    <line x1={c.x} x2={c.x + 6} y1={c.close} y2={c.close} stroke={color} strokeWidth="2" />
                  </g>
                );
              }

              return (
                <g key={`minicandle-${i}`}>
                  <line x1={c.x} x2={c.x} y1={c.high} y2={c.low} stroke={color} strokeWidth="1.8" />
                  <rect
                    x={c.x - 7}
                    y={top}
                    width="14"
                    height={height}
                    fill={isHollow && c.bull ? template.background : color}
                    stroke={color}
                    strokeWidth={isHollow && c.bull ? 2 : 0}
                    rx="1.5"
                  />
                </g>
              );
            })}
          </g>
        )}

        {/* 16:9 Mini Volume Bars */}
        {[25, 48, 30, 65, 42, 75, 55, 68, 85, 45, 95, 60].map((v, i) => (
          <rect
            key={`mv-${i}`}
            x={16 + i * 26}
            y={180 - v * 0.4}
            width="12"
            height={v * 0.4}
            fill={i % 2 === 0 ? template.bullishColor : template.bearishColor}
            opacity="0.35"
            rx="1"
          />
        ))}

        {/* Mini Price Tracker Line */}
        <line x1="0" x2="320" y1="38" y2="38" stroke={template.bullishColor} strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
      </svg>

      {/* 16:9 Overlay Badges */}
      <div className="absolute top-2 left-2 flex items-center gap-1.5">
        <span
          className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider backdrop-blur-md border border-white/10"
          style={{ background: "rgba(0,0,0,0.55)", color: template.bullishColor }}
        >
          {template.chartType}
        </span>
      </div>
    </div>
  );
}

/* =========================================================================
   SETTINGS & INDICATORS CUSTOMIZATION PANEL
   ========================================================================= */

function SettingsPanel({
  template,
  showVolume,
  showGrid,
  setShowVolume,
  setShowGrid,
  setTemplate,
  indicators,
  setIndicators,
}: {
  template: ChartTemplate;
  showVolume: boolean;
  showGrid: boolean;
  setShowVolume: (value: boolean) => void;
  setShowGrid: (value: boolean) => void;
  setTemplate: (value: ChartTemplate) => void;
  indicators: Record<IndicatorKey, boolean>;
  setIndicators: (value: (prev: Record<IndicatorKey, boolean>) => Record<IndicatorKey, boolean>) => void;
}) {
  return (
    <section className="p-4 rounded-2xl border border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] space-y-4">
      <h3 className="text-xs font-black uppercase tracking-wider text-primary flex items-center gap-2">
        <Sliders className="h-4 w-4" /> Customize Indicators & Appearance
      </h3>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Colors */}
        <label className="flex items-center justify-between text-xs font-bold text-foreground/80 bg-foreground/[0.04] p-2.5 rounded-xl border border-foreground/10">
          <span>Bullish Candle</span>
          <input
            type="color"
            value={template.bullishColor}
            onChange={(e) => setTemplate({ ...template, bullishColor: e.target.value })}
            className="h-7 w-10 rounded cursor-pointer border-0 bg-transparent"
          />
        </label>

        <label className="flex items-center justify-between text-xs font-bold text-foreground/80 bg-foreground/[0.04] p-2.5 rounded-xl border border-foreground/10">
          <span>Bearish Candle</span>
          <input
            type="color"
            value={template.bearishColor}
            onChange={(e) => setTemplate({ ...template, bearishColor: e.target.value })}
            className="h-7 w-10 rounded cursor-pointer border-0 bg-transparent"
          />
        </label>

        <label className="flex items-center justify-between text-xs font-bold text-foreground/80 bg-foreground/[0.04] p-2.5 rounded-xl border border-foreground/10">
          <span>Background</span>
          <input
            type="color"
            value={template.background}
            onChange={(e) => setTemplate({ ...template, background: e.target.value })}
            className="h-7 w-10 rounded cursor-pointer border-0 bg-transparent"
          />
        </label>

        <label className="flex items-center justify-between text-xs font-bold text-foreground/80 bg-foreground/[0.04] p-2.5 rounded-xl border border-foreground/10">
          <span>Grid Opacity</span>
          <input
            type="range"
            min="0.05"
            max="0.6"
            step="0.05"
            value={template.gridOpacity}
            onChange={(e) => setTemplate({ ...template, gridOpacity: Number(e.target.value) })}
            className="w-20"
          />
        </label>
      </div>

      {/* Indicator Checkboxes */}
      <div className="pt-2 border-t border-foreground/10">
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-foreground/45 block mb-2">
          Technical Overlays & Oscillators:
        </span>
        <div className="flex flex-wrap gap-2">
          {[
            { id: "sma20", label: "SMA 20 (Yellow)" },
            { id: "sma50", label: "SMA 50 (Cyan)" },
            { id: "ema9", label: "EMA 9 (Pink)" },
            { id: "vwap", label: "VWAP (Orange)" },
            { id: "bollinger", label: "Bollinger Bands" },
            { id: "rsi", label: "RSI 14" },
            { id: "macd", label: "MACD Indicator" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() =>
                setIndicators((prev) => ({
                  ...prev,
                  [item.id as IndicatorKey]: !prev[item.id as IndicatorKey],
                }))
              }
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                indicators[item.id as IndicatorKey]
                  ? "bg-primary/20 border-primary text-primary"
                  : "bg-foreground/[0.04] border-foreground/10 text-foreground/50 hover:text-foreground"
              }`}
            >
              {indicators[item.id as IndicatorKey] ? (
                <Check className="h-3.5 w-3.5 stroke-[3]" />
              ) : null}
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function formatPrice(value: number) {
  if (!value) return "--";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: value < 2 ? 4 : 2,
    maximumFractionDigits: value < 2 ? 4 : 2,
  });
}

function formatVolume(value: number) {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${Math.round(value / 1000)}K`;
}
