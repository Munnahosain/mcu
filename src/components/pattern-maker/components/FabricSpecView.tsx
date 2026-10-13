import React, { useRef, useEffect } from 'react';
import { DesignElement, PatternSettings } from '../types';
import { calculateFabricMetrics } from '../utils/seamlessMath';
import { drawTileToCanvas, exportFabricSpecSheet } from '../utils/exportUtils';
import {
  Scissors,
  Download,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Info,
  Ruler,
  Compass,
} from 'lucide-react';

interface FabricSpecViewProps {
  elements: DesignElement[];
  settings: PatternSettings;
  setSettings: React.Dispatch<React.SetStateAction<PatternSettings>>;
}

export const FabricSpecView: React.FC<FabricSpecViewProps> = ({
  elements,
  settings,
  setSettings,
}) => {
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const metrics = calculateFabricMetrics(
    settings.physicalSize,
    settings.physicalUnit,
    settings.fabricBoltWidth,
    settings.fabricLength,
    settings.dpi
  );

  useEffect(() => {
    let cancelled = false;
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 400;
    canvas.height = 400;
    void drawTileToCanvas(ctx, elements, settings, 400, 400, true).then(() => {
      if (cancelled) return;
    });
    return () => { cancelled = true; };
  }, [elements, settings]);

  // Tailoring estimation table for popular garments
  const garmentEstimates = [
    {
      name: 'Summer Kurti / Tunic',
      lengthNeeded: settings.physicalUnit === 'inch' ? '90 inches (2.5 yd)' : '2.25 meters',
      repeatsNeeded: Math.ceil((225 / metrics.tileSizeCm) * metrics.repeatsAcrossWidth),
      advice: 'Align center-front floral/motif symmetrically along the fold line.',
    },
    {
      name: 'Flared Summer Dress',
      lengthNeeded: settings.physicalUnit === 'inch' ? '120 inches (3.3 yd)' : '3.0 meters',
      repeatsNeeded: Math.ceil((300 / metrics.tileSizeCm) * metrics.repeatsAcrossWidth),
      advice: 'Pattern matching required across side seams and bodice waist.',
    },
    {
      name: 'Button-up Casual Shirt',
      lengthNeeded: settings.physicalUnit === 'inch' ? '72 inches (2 yd)' : '1.8 meters',
      repeatsNeeded: Math.ceil((180 / metrics.tileSizeCm) * metrics.repeatsAcrossWidth),
      advice: 'Match repeat horizontally across the button placket and front chest pocket.',
    },
    {
      name: 'Silk Square Scarf (90×90)',
      lengthNeeded: settings.physicalUnit === 'inch' ? '36 inches (1 yd)' : '1.0 meter',
      repeatsNeeded: Math.ceil(90 / metrics.tileSizeCm) ** 2,
      advice: 'Add 1.5 cm rolled-hem allowance all around perimeter.',
    },
    {
      name: 'Throw Pillow Cushion (45×45)',
      lengthNeeded: settings.physicalUnit === 'inch' ? '20 inches (0.5 yd)' : '0.5 meter',
      repeatsNeeded: Math.ceil(45 / metrics.tileSizeCm) * 2,
      advice: 'Center dominant pattern motif in the middle of each cushion square.',
    },
  ];

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#0b0c0e] p-6 select-none text-[#f5f7f8]">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#101114] border border-[#252a31] p-5 rounded-xl shadow-lg">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Scissors className="w-5 h-5 text-[#18c98a]" />
              <h1 className="text-lg font-bold text-[#f5f7f8]">
                Fabric Cutting & Customization Map
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#18c98a]/15 text-[#18c98a] font-semibold border border-[#18c98a]/30">
                100% SCALE READY
              </span>
            </div>
            <p className="text-xs text-[#aeb5bf]">
              Precise millimeter/inch measurements for digital textile printing, bolt yield, and master tailor cutting.
            </p>
          </div>

          <button
            id="btn-download-spec-sheet"
            onClick={() => { void exportFabricSpecSheet(elements, settings); }}
            className="flex items-center gap-2 bg-[#18c98a] hover:bg-[#14b179] text-[#071b17] font-bold px-4 py-2.5 rounded-lg shadow-md transition text-xs"
          >
            <Download className="w-4 h-4" />
            <span>Download Tailor Spec Sheet (PNG)</span>
          </button>
        </div>

        {/* Primary Spec Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: 1:1 Tile Blueprint with Seam Overlay */}
          <div className="bg-[#101114] border border-[#252a31] rounded-xl p-5 space-y-4 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ruler className="w-4 h-4 text-[#18c98a]" />
                <h2 className="font-bold text-sm text-[#f5f7f8]">
                  1:1 Master Repeat Tile
                </h2>
              </div>
              <span className="font-mono text-xs font-bold text-[#18c98a]">
                {metrics.tileSizeCm} × {metrics.tileSizeCm} cm
              </span>
            </div>

            {/* Rendered Tile with Cutting Margin Overlay */}
            <div className="relative aspect-square rounded-lg overflow-hidden border-2 border-[#18c98a]/60 shadow-inner bg-[#0b0c0e]">
              <canvas ref={previewCanvasRef} className="w-full h-full object-cover" />

              {/* Seam Allowance Overlay */}
              {settings.seamAllowance > 0 && (
                <div
                  className="absolute border border-dashed border-rose-400 pointer-events-none"
                  style={{
                    left: `${(settings.seamAllowance / settings.physicalSize) * 100}%`,
                    top: `${(settings.seamAllowance / settings.physicalSize) * 100}%`,
                    right: `${(settings.seamAllowance / settings.physicalSize) * 100}%`,
                    bottom: `${(settings.seamAllowance / settings.physicalSize) * 100}%`,
                  }}
                >
                  <div className="absolute top-1 left-1 bg-[#101114]/90 text-rose-300 text-[9px] font-mono px-1 py-0.5 rounded border border-rose-500/30">
                    Cut Margin: {settings.seamAllowance} {settings.physicalUnit}
                  </div>
                </div>
              )}

              {/* Dimension indicators on sides */}
              <div className="absolute bottom-1 right-2 bg-[#101114]/90 text-[#18c98a] text-[10px] font-mono px-1.5 py-0.5 rounded border border-[#252a31]">
                {metrics.tileSizeInches}&quot; × {metrics.tileSizeInches}&quot;
              </div>
            </div>

            <div className="space-y-1 text-xs text-[#aeb5bf] bg-[#17191e] p-3 rounded-lg border border-[#252a31]">
              <div className="flex justify-between">
                <span>Tile Aspect Ratio:</span>
                <span className="font-mono text-[#f5f7f8] font-bold">1:1 Square</span>
              </div>
              <div className="flex justify-between">
                <span>Output Resolution:</span>
                <span className="font-mono text-[#f5f7f8]">
                  {metrics.pixelWidthForPrint} × {metrics.pixelWidthForPrint} px @ {settings.dpi} DPI
                </span>
              </div>
              <div className="flex justify-between">
                <span>Edge Connection:</span>
                <span className="font-mono text-[#18c98a] font-semibold">
                  Continuous Toroidal Seamless
                </span>
              </div>
            </div>
          </div>

          {/* Center Column: Fabric Bolt Cutting Blueprint */}
          <div className="bg-[#101114] border border-[#252a31] rounded-xl p-5 space-y-4 shadow-md lg:col-span-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-[#18c98a]" />
                <h2 className="font-bold text-sm text-[#f5f7f8]">
                  Fabric Bolt Layout & Cutting Blueprint
                </h2>
              </div>
              <span className="text-xs font-mono text-[#aeb5bf]">
                Bolt Width: <strong className="text-[#18c98a]">{metrics.boltWidthCm} cm</strong> ({metrics.boltWidthInches}&quot;)
              </span>
            </div>

            {/* Visual Bolt Layout Representation */}
            <div className="bg-[#17191e] p-4 rounded-xl border border-[#252a31] space-y-3">
              <div className="text-xs text-[#f5f7f8] font-medium flex items-center justify-between">
                <span>Bolt Cross-Section ({metrics.repeatsAcrossWidth} full pattern repeats):</span>
                <span className="text-[#18c98a] font-mono text-[11px]">
                  Effective Print Width: {metrics.recommendedCutWidthCm} cm
                </span>
              </div>

              {/* Graphical Roll Display */}
              <div className="w-full bg-[#101114] border border-[#252a31] rounded-lg p-2 flex gap-1 items-center overflow-x-auto relative">
                {/* Selvage Left */}
                <div className="w-4 h-24 bg-[#20242a] rounded flex items-center justify-center text-[8px] text-[#77808c] font-mono -rotate-90 select-none">
                  SELVAGE
                </div>

                {/* Pattern Repeats Blocks */}
                {Array.from({ length: Math.min(10, metrics.repeatsAcrossWidth) }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 min-w-[50px] h-24 bg-[#18c98a]/10 border-2 border-[#18c98a]/40 rounded flex flex-col items-center justify-center relative group hover:border-[#18c98a] transition"
                  >
                    <span className="text-[10px] font-mono text-[#18c98a] font-bold">
                      #{i + 1}
                    </span>
                    <span className="text-[9px] text-[#aeb5bf] font-mono">
                      {metrics.tileSizeCm}cm
                    </span>
                    {/* Cutting marker scissors */}
                    <Scissors className="w-3 h-3 text-rose-400 absolute -top-1.5 -right-1.5 bg-[#101114] rounded-full" />
                  </div>
                ))}

                {/* Selvage Right Waste */}
                <div className="w-4 h-24 bg-[#20242a] rounded flex items-center justify-center text-[8px] text-[#77808c] font-mono rotate-90 select-none">
                  SELVAGE
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono text-[#aeb5bf] pt-1">
                <span>Total Width: {metrics.boltWidthCm} cm</span>
                <span className="text-[#18c98a] font-semibold">
                  Cut Yield: {metrics.repeatsAcrossWidth} full repeats across width
                </span>
                <span className="text-[#77808c]">Selvage Margin: {metrics.remainingWidthCm} cm</span>
              </div>
            </div>

            {/* Key Technical Specifications Table */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-[#17191e] p-2.5 rounded-lg border border-[#252a31]">
                <span className="text-[10px] text-[#77808c] block mb-0.5">Repeat Type</span>
                <span className="font-mono text-xs font-bold text-[#18c98a] capitalize">
                  {settings.repeatType} Repeat
                </span>
              </div>
              <div className="bg-[#17191e] p-2.5 rounded-lg border border-[#252a31]">
                <span className="text-[10px] text-[#77808c] block mb-0.5">Recommended Cut</span>
                <span className="font-mono text-xs font-bold text-[#f5f7f8]">
                  {metrics.recommendedCutWidthCm} cm
                </span>
              </div>
              <div className="bg-[#17191e] p-2.5 rounded-lg border border-[#252a31]">
                <span className="text-[10px] text-[#77808c] block mb-0.5">Repeats / Meter</span>
                <span className="font-mono text-xs font-bold text-[#f5f7f8]">
                  {metrics.repeatsAlongLength} along length
                </span>
              </div>
              <div className="bg-[#17191e] p-2.5 rounded-lg border border-[#252a31]">
                <span className="text-[10px] text-[#77808c] block mb-0.5">Total Yield / Meter</span>
                <span className="font-mono text-xs font-bold text-[#18c98a]">
                  {metrics.totalRepeatsInYardage} Tiles
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tailor & Apparel Cutting Customization Table */}
        <div className="bg-[#101114] border border-[#252a31] rounded-xl p-5 space-y-4 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-[#18c98a]" />
              <h2 className="font-bold text-sm text-[#f5f7f8]">
                Garment Customization & Fabric Yardage Guide
              </h2>
            </div>
            <span className="text-xs text-[#aeb5bf]">
              Guidance for seamstress & pattern cutters
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#252a31] text-[#77808c] font-mono text-[11px]">
                  <th className="py-2.5 px-3">Garment Type</th>
                  <th className="py-2.5 px-3">Recommended Fabric Yardage</th>
                  <th className="py-2.5 px-3">Total Pattern Repeats</th>
                  <th className="py-2.5 px-3">Tailoring & Pattern Matching Guidance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#252a31] text-[#aeb5bf]">
                {garmentEstimates.map((item, idx) => (
                  <tr key={idx} className="hover:bg-[#17191e] transition">
                    <td className="py-3 px-3 font-semibold text-[#f5f7f8]">
                      {item.name}
                    </td>
                    <td className="py-3 px-3 font-mono text-[#18c98a]">
                      {item.lengthNeeded}
                    </td>
                    <td className="py-3 px-3 font-mono text-[#f5f7f8] font-bold">
                      ~{item.repeatsNeeded} repeats
                    </td>
                    <td className="py-3 px-3 text-[#aeb5bf] leading-relaxed">
                      {item.advice}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
