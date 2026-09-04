import { Candle, CandleInterval, MarketSymbol, TickInterval } from "./types";

export const markets: MarketSymbol[] = ["BTC/USD", "ETH/USD", "SOL/USD", "BNB/USD", "XRP/USD", "EUR/USD", "GBP/USD", "USD/JPY", "XAU/USD", "NASDAQ", "S&P 500"];
export const candleIntervals: CandleInterval[] = ["1s", "2s", "5s", "10s", "30s", "1m", "5m", "15m", "30m", "1h", "4h", "1D", "1W"];
export const tickIntervals: TickInterval[] = ["0.25s", "0.5s", "1s", "2s", "5s"];

const basePrices: Record<MarketSymbol, number> = {
  "BTC/USD": 65550,
  "ETH/USD": 3420,
  "SOL/USD": 146,
  "BNB/USD": 612,
  "XRP/USD": 0.63,
  "EUR/USD": 1.08,
  "GBP/USD": 1.27,
  "USD/JPY": 157.8,
  "XAU/USD": 2375,
  NASDAQ: 18150,
  "S&P 500": 5520,
};

export function intervalMs(interval: CandleInterval) {
  const value = Number.parseInt(interval, 10);
  if (interval.endsWith("s")) return value * 1000;
  if (interval.endsWith("m")) return value * 60_000;
  if (interval.endsWith("h")) return value * 3_600_000;
  if (interval === "1D") return 86_400_000;
  return 604_800_000;
}

export function tickMs(interval: TickInterval) {
  return Number.parseFloat(interval) * 1000;
}

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export interface MarketDataProvider {
  mode: "demo" | "real";
  connect(): Promise<void>;
  disconnect(): void;
  subscribe(symbol: MarketSymbol, interval: CandleInterval, tickInterval: TickInterval, onUpdate: (candles: Candle[]) => void): void;
  unsubscribe(): void;
  getHistoricalData(symbol: MarketSymbol, interval: CandleInterval, bars?: number): Promise<Candle[]>;
}

export class MockMarketDataProvider implements MarketDataProvider {
  mode: "demo" = "demo";
  private timer: ReturnType<typeof setInterval> | null = null;
  private candles: Candle[] = [];
  private symbol: MarketSymbol = "BTC/USD";
  private interval: CandleInterval = "2s";

  async connect() {
    await Promise.resolve();
  }

  disconnect() {
    this.unsubscribe();
  }

  unsubscribe() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async getHistoricalData(symbol: MarketSymbol, interval: CandleInterval, bars = 90) {
    const ms = intervalMs(interval);
    const base = basePrices[symbol];
    const volatility = Math.max(base * 0.0025, base < 5 ? 0.002 : 0.12);
    let price = base;
    const now = Date.now();
    const candles: Candle[] = [];
    for (let index = bars - 1; index >= 0; index -= 1) {
      const drift = (seededRandom(now / 100000 + index) - 0.48) * volatility;
      const open = price;
      const close = Math.max(0.0001, open + drift);
      const spread = Math.abs(drift) + volatility * (0.35 + seededRandom(index * 9));
      const high = Math.max(open, close) + spread * seededRandom(index + 3);
      const low = Math.min(open, close) - spread * seededRandom(index + 7);
      const volume = Math.round((seededRandom(index * 17 + base) * 0.8 + 0.2) * 1_000_000);
      candles.push({ time: now - index * ms, open, high, low: Math.max(0.0001, low), close, volume });
      price = close;
    }
    return candles;
  }

  subscribe(symbol: MarketSymbol, interval: CandleInterval, tickInterval: TickInterval, onUpdate: (candles: Candle[]) => void) {
    this.unsubscribe();
    this.symbol = symbol;
    this.interval = interval;
    void this.getHistoricalData(symbol, interval).then((candles) => {
      this.candles = candles;
      onUpdate([...this.candles]);
      this.timer = setInterval(() => {
        this.candles = nextCandles(this.candles, this.symbol, this.interval);
        onUpdate([...this.candles]);
      }, tickMs(tickInterval));
    });
  }
}

export class RealMarketDataProvider implements MarketDataProvider {
  mode: "real" = "real";
  async connect() {
    throw new Error("No realtime provider is configured.");
  }
  disconnect() {}
  subscribe() {}
  unsubscribe() {}
  async getHistoricalData(_symbol: MarketSymbol, _interval: CandleInterval, _bars?: number): Promise<Candle[]> {
    throw new Error("No realtime provider is configured.");
  }
}

function nextCandles(candles: Candle[], symbol: MarketSymbol, interval: CandleInterval) {
  const ms = intervalMs(interval);
  const last = candles[candles.length - 1];
  const base = basePrices[symbol];
  const volatility = Math.max(base * 0.0018, base < 5 ? 0.001 : 0.08);
  const pulse = Math.sin(Date.now() / 7000) * volatility * 0.28;
  const move = (Math.random() - 0.49) * volatility + pulse;
  const current = { ...last };
  const close = Math.max(0.0001, current.close + move);
  current.close = close;
  current.high = Math.max(current.high, close);
  current.low = Math.min(current.low, close);
  current.volume += Math.round((Math.random() * 0.5 + 0.2) * 10000);

  if (Date.now() - last.time >= ms) {
    const next: Candle = {
      time: last.time + ms,
      open: close,
      high: close + Math.random() * volatility,
      low: Math.max(0.0001, close - Math.random() * volatility),
      close,
      volume: Math.round((Math.random() * 0.7 + 0.3) * 1_000_000),
    };
    return [...candles.slice(-119), next];
  }

  return [...candles.slice(0, -1), current];
}

