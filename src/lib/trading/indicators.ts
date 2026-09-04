import type { Candle } from "./types";

export function sma(candles: Candle[], period: number) {
  return candles.map((candle, index) => index + 1 < period ? null : candles.slice(index + 1 - period, index + 1).reduce((sum, item) => sum + item.close, 0) / period);
}

export function ema(candles: Candle[], period: number) {
  const multiplier = 2 / (period + 1);
  let value = candles[0]?.close ?? 0;
  return candles.map((candle, index) => { value = index === 0 ? candle.close : (candle.close - value) * multiplier + value; return index + 1 < period ? null : value; });
}

export function vwap(candles: Candle[]) {
  let cumulativeVolume = 0;
  let cumulativeValue = 0;
  return candles.map((candle) => { cumulativeVolume += candle.volume; cumulativeValue += ((candle.high + candle.low + candle.close) / 3) * candle.volume; return cumulativeValue / cumulativeVolume; });
}

export function bollinger(candles: Candle[], period = 20) {
  const middle = sma(candles, period);
  return candles.map((_, index) => { const center = middle[index]; if (center === null) return null; const values = candles.slice(index + 1 - period, index + 1).map((item) => item.close); const deviation = Math.sqrt(values.reduce((sum, value) => sum + (value - center) ** 2, 0) / period); return { upper: center + deviation * 2, lower: center - deviation * 2 }; });
}

export function rsi(candles: Candle[], period = 14) {
  return candles.map((_, index) => { if (index < period) return null; let gains = 0; let losses = 0; for (let cursor = index - period + 1; cursor <= index; cursor += 1) { const delta = candles[cursor].close - candles[cursor - 1].close; if (delta >= 0) gains += delta; else losses -= delta; } const averageLoss = losses / period; return averageLoss === 0 ? 100 : 100 - 100 / (1 + gains / period / averageLoss); });
}

export type IndicatorValues = { sma20: (number | null)[]; sma50: (number | null)[]; ema9: (number | null)[]; ema20: (number | null)[]; vwap: number[]; bollinger: ({ upper: number; lower: number } | null)[] };
export function calculateIndicators(candles: Candle[]): IndicatorValues { return { sma20: sma(candles, 20), sma50: sma(candles, 50), ema9: ema(candles, 9), ema20: ema(candles, 20), vwap: vwap(candles), bollinger: bollinger(candles) }; }
