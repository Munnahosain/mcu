export type MarketSymbol =
  | "BTC/USD"
  | "ETH/USD"
  | "SOL/USD"
  | "BNB/USD"
  | "XRP/USD"
  | "EUR/USD"
  | "GBP/USD"
  | "USD/JPY"
  | "XAU/USD"
  | "NASDAQ"
  | "S&P 500";

export type CandleInterval = "1s" | "2s" | "5s" | "10s" | "30s" | "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1D" | "1W";
export type TickInterval = "0.25s" | "0.5s" | "1s" | "2s" | "5s";
export type ConnectionState = "CONNECTING" | "LIVE" | "PAUSED" | "DISCONNECTED" | "DEMO";
export type ChartType = "candlestick" | "heikin-ashi" | "line" | "area" | "bar" | "ohlc" | "hollow" | "baseline" | "step" | "mountain";

export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type IndicatorKey = "sma20" | "sma50" | "sma100" | "sma200" | "ema9" | "ema20" | "ema50" | "ema200" | "vwap" | "bollinger" | "rsi" | "macd" | "volume";

export type IndicatorState = Record<IndicatorKey, boolean>;

export type ChartTemplate = {
  id: string;
  name: string;
  category: string;
  chartType: ChartType;
  background: string;
  gridColor: string;
  bullishColor: string;
  bearishColor: string;
  lineColor: string;
  volumeColor: string;
  textColor: string;
  accentColor: string;
  candleWidth: number;
  wickWidth: number;
  gridOpacity: number;
  fontSize: number;
  showVolume: boolean;
  showGrid: boolean;
  showPriceScale: boolean;
  showTimeScale: boolean;
  showCrosshair: boolean;
  movingAverage: boolean;
  glow: boolean;
  gradient: boolean;
  builtIn?: boolean;
};

export type ExportOptions = {
  width: number;
  height: number;
  transparent: boolean;
  includeGrid: boolean;
  includePriceScale: boolean;
  includeTimeScale: boolean;
  includeVolume: boolean;
  includeIndicators: boolean;
  includeCurrentPrice: boolean;
  includeCrosshair: boolean;
};

