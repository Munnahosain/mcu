import type { Candle, ChartTemplate } from "./types";
import { calculateIndicators } from "./indicators";

export function buildChartSvg(candles: Candle[], template: ChartTemplate, width = 1280, height = 720) {
  const padding = { top: 48, right: 100, bottom: template.showVolume ? 130 : 54, left: 24 };
  const values = candles.flatMap((candle) => [candle.high, candle.low]);
  const min = Math.min(...values); const max = Math.max(...values); const range = Math.max(max - min, 0.01);
  const plotWidth = width - padding.left - padding.right; const plotHeight = height - padding.top - padding.bottom; const gap = plotWidth / Math.max(candles.length, 1);
  const y = (value: number) => padding.top + ((max - value) / range) * plotHeight;
  const line = (points: string[], color: string, strokeWidth = 2) => `<path d="${points.join(" ")}" fill="none" stroke="${color}" stroke-width="${strokeWidth}"/>`;
  const grid = template.showGrid ? [0, 1, 2, 3, 4].map((index) => { const price = max - (range * index) / 4; return `<line x1="${padding.left}" x2="${width - padding.right}" y1="${y(price)}" y2="${y(price)}" stroke="${template.gridColor}" opacity="${template.gridOpacity}"/><text x="${width - padding.right + 12}" y="${y(price) + 4}" fill="${template.textColor}" font-size="${template.fontSize}">${price.toFixed(2)}</text>`; }).join("") : "";
  const candlesMarkup = candles.map((candle, index) => { const x = padding.left + index * gap + gap / 2; const rising = candle.close >= candle.open; const color = rising ? template.bullishColor : template.bearishColor; const top = Math.min(y(candle.open), y(candle.close)); const body = Math.max(Math.abs(y(candle.open) - y(candle.close)), 2); return `<line x1="${x}" x2="${x}" y1="${y(candle.high)}" y2="${y(candle.low)}" stroke="${color}" stroke-width="${template.wickWidth}"/><rect x="${x - Math.max(gap * template.candleWidth / 20, 2)}" y="${top}" width="${Math.max(gap * template.candleWidth / 10, 3)}" height="${body}" fill="${color}"/>`; }).join("");
  const closePoints = candles.map((candle, index) => `${index ? "L" : "M"}${padding.left + index * gap + gap / 2},${y(candle.close)}`);
  const valuesFor = calculateIndicators(candles);
  const indicatorMarkup = valuesFor.sma20.some(Boolean) ? line(valuesFor.sma20.map((value, index) => value === null ? "" : `${index ? "L" : "M"}${padding.left + index * gap + gap / 2},${y(value)}`).filter(Boolean), "#f5c451", 2) : "";
  const volumeMarkup = template.showVolume ? candles.map((candle, index) => { const x = padding.left + index * gap + gap / 2; const color = candle.close >= candle.open ? template.bullishColor : template.bearishColor; const volumeHeight = candle.volume / Math.max(...candles.map((item) => item.volume)) * 70; return `<rect x="${x - Math.max(gap * .3, 2)}" y="${height - 92 - volumeHeight}" width="${Math.max(gap * .6, 3)}" height="${volumeHeight}" fill="${color}" opacity=".65"/>`; }).join("") : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${template.background}"/>${grid}${template.chartType === "line" || template.chartType === "step" || template.chartType === "mountain" ? line(closePoints, template.lineColor, 3) : candlesMarkup}${indicatorMarkup}${volumeMarkup}<text x="${padding.left}" y="28" fill="${template.textColor}" font-size="18" font-family="sans-serif">${template.name}</text></svg>`;
}

export function downloadSvg(svg: string, filename: string) { const blob = new Blob([svg], { type: "image/svg+xml" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url); }
