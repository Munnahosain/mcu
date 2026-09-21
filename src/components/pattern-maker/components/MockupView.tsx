import React, { useEffect, useState } from 'react';
import { DesignElement, PatternSettings } from '../types';
import { drawTileToCanvas } from '../utils/exportUtils';
import { Shirt, ShoppingBag, Bed, Sparkles, Layers, Sliders } from 'lucide-react';

interface MockupViewProps {
  elements: DesignElement[];
  settings: PatternSettings;
}

type ProductMockup = 'dress' | 'tshirt' | 'scarf' | 'pillow' | 'totebag';

export const MockupView: React.FC<MockupViewProps> = ({
  elements,
  settings,
}) => {
  const [activeProduct, setActiveProduct] = useState<ProductMockup>('dress');
  const [patternScale, setPatternScale] = useState<number>(1); // 0.5 to 2.5
  const [tileDataUrl, setTileDataUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (typeof document === 'undefined') return;
    const canvas = document.createElement('canvas');
    const size = 300;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    void drawTileToCanvas(ctx, elements, settings, size, size, true).then(() => {
      if (!cancelled) setTileDataUrl(canvas.toDataURL('image/png'));
    });
    return () => { cancelled = true; };
  }, [elements, settings]);

  const tileSize = Math.round(120 * patternScale);

  const productTabs: { id: ProductMockup; name: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dress', name: "Summer Dress / Kurti", icon: Shirt },
    { id: 'tshirt', name: "Classic T-Shirt", icon: Shirt },
    { id: 'scarf', name: "Silk Square Scarf", icon: Layers },
    { id: 'pillow', name: "Throw Cushion", icon: Bed },
    { id: 'totebag', name: "Canvas Tote Bag", icon: ShoppingBag },
  ];

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#0b0c0e] select-none p-6 text-[#f5f7f8] flex flex-col">
      <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col space-y-5">
        {/* Mockup Toolbar */}
        <div className="bg-[#101114] border border-[#252a31] p-4 rounded-xl flex flex-wrap items-center justify-between gap-4 shadow-md">
          {/* Product Selectors */}
          <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-[#17191e] rounded-lg border border-[#252a31]">
            {productTabs.map((p) => {
              const Icon = p.icon;
              return (
                <button
                  key={p.id}
                  onClick={() => setActiveProduct(p.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                    activeProduct === p.id
                      ? 'bg-[#18c98a] text-[#071b17] font-bold shadow-sm'
                      : 'text-[#77808c] hover:text-[#f5f7f8]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="whitespace-nowrap">{p.name}</span>
                </button>
              );
            })}
          </div>

          {/* Scale Slider */}
          <div className="flex items-center gap-3 bg-[#17191e] px-3 py-1.5 rounded-lg border border-[#252a31] text-xs">
            <Sliders className="w-3.5 h-3.5 text-[#18c98a]" />
            <span className="text-[#aeb5bf]">Pattern Scale:</span>
            <input
              type="range"
              min="0.5"
              max="2.2"
              step="0.1"
              value={patternScale}
              onChange={(e) => setPatternScale(Number(e.target.value))}
              className="w-28 accent-[#18c98a] cursor-pointer"
            />
            <span className="font-mono text-[#18c98a] text-[11px] w-8">
              {patternScale}x
            </span>
          </div>
        </div>

        {/* 3D / Apparel Stage View */}
        <div className="flex-1 min-h-[460px] bg-gradient-to-b from-[#101114] via-[#101114]/90 to-[#0b0c0e] border border-[#252a31] rounded-2xl flex items-center justify-center p-8 relative overflow-hidden shadow-2xl">
          {/* Subtle Ambient Backlight */}
          <div className="absolute w-96 h-96 rounded-full bg-[#18c98a]/5 blur-3xl pointer-events-none" />

          {/* Mockup SVG Visualizers */}
          {tileDataUrl && (
            <div className="relative w-full max-w-md h-[460px] flex items-center justify-center">
              {/* Product: Summer Dress / Kurti */}
              {activeProduct === 'dress' && (
                <svg
                  viewBox="0 0 400 500"
                  className="w-full h-full drop-shadow-[0_20px_35px_rgba(0,0,0,0.8)]"
                >
                  <defs>
                    <pattern
                      id="pattern-dress"
                      width={tileSize}
                      height={tileSize}
                      patternUnits="userSpaceOnUse"
                    >
                      <image href={tileDataUrl} width={tileSize} height={tileSize} />
                    </pattern>
                    {/* Shadow overlay gradient for dress folds */}
                    <linearGradient id="dress-shadow" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#000000" stopOpacity="0.4" />
                      <stop offset="15%" stopColor="#ffffff" stopOpacity="0.15" />
                      <stop offset="50%" stopColor="#000000" stopOpacity="0.05" />
                      <stop offset="85%" stopColor="#ffffff" stopOpacity="0.1" />
                      <stop offset="100%" stopColor="#000000" stopOpacity="0.4" />
                    </linearGradient>
                  </defs>

                  {/* Dress Silhouette */}
                  <g>
                    {/* Hanger / Neckline detail */}
                    <path
                      d="M170,25 Q200,45 230,25 L280,60 L240,110 L250,190 L340,460 L60,460 L150,190 L160,110 L120,60 Z"
                      fill="url(#pattern-dress)"
                      stroke="#44403c"
                      strokeWidth="2"
                    />
                    {/* Fold shading */}
                    <path
                      d="M170,25 Q200,45 230,25 L280,60 L240,110 L250,190 L340,460 L60,460 L150,190 L160,110 L120,60 Z"
                      fill="url(#dress-shadow)"
                      style={{ mixBlendMode: 'multiply' }}
                    />
                    {/* Waistline ribbon */}
                    <path
                      d="M150,190 Q200,205 250,190"
                      fill="none"
                      stroke="#1c1917"
                      strokeWidth="5"
                    />
                  </g>
                </svg>
              )}

              {/* Product: Classic T-Shirt */}
              {activeProduct === 'tshirt' && (
                <svg
                  viewBox="0 0 400 440"
                  className="w-full h-full drop-shadow-[0_20px_35px_rgba(0,0,0,0.8)]"
                >
                  <defs>
                    <pattern
                      id="pattern-tshirt"
                      width={tileSize}
                      height={tileSize}
                      patternUnits="userSpaceOnUse"
                    >
                      <image href={tileDataUrl} width={tileSize} height={tileSize} />
                    </pattern>
                    <linearGradient id="tshirt-folds" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#000" stopOpacity="0.35" />
                      <stop offset="25%" stopColor="#fff" stopOpacity="0.1" />
                      <stop offset="50%" stopColor="#000" stopOpacity="0.05" />
                      <stop offset="75%" stopColor="#fff" stopOpacity="0.1" />
                      <stop offset="100%" stopColor="#000" stopOpacity="0.35" />
                    </linearGradient>
                  </defs>
                  <g>
                    {/* T-Shirt Cut */}
                    <path
                      d="M140,40 Q200,75 260,40 L355,95 L310,175 L265,145 L265,410 L135,410 L135,145 L90,175 L45,95 Z"
                      fill="url(#pattern-tshirt)"
                      stroke="#292524"
                      strokeWidth="2"
                    />
                    <path
                      d="M140,40 Q200,75 260,40 L355,95 L310,175 L265,145 L265,410 L135,410 L135,145 L90,175 L45,95 Z"
                      fill="url(#tshirt-folds)"
                      style={{ mixBlendMode: 'multiply' }}
                    />
                    {/* Collar Trim */}
                    <path
                      d="M140,40 Q200,75 260,40 Q200,90 140,40 Z"
                      fill="#1c1917"
                      opacity="0.8"
                    />
                  </g>
                </svg>
              )}

              {/* Product: Silk Square Scarf */}
              {activeProduct === 'scarf' && (
                <svg
                  viewBox="0 0 440 440"
                  className="w-full h-full drop-shadow-[0_20px_35px_rgba(0,0,0,0.8)]"
                >
                  <defs>
                    <pattern
                      id="pattern-scarf"
                      width={tileSize}
                      height={tileSize}
                      patternUnits="userSpaceOnUse"
                    >
                      <image href={tileDataUrl} width={tileSize} height={tileSize} />
                    </pattern>
                    <radialGradient id="silk-sheen" cx="45%" cy="45%" r="60%">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="0.3" />
                      <stop offset="70%" stopColor="#000000" stopOpacity="0.05" />
                      <stop offset="100%" stopColor="#000000" stopOpacity="0.4" />
                    </radialGradient>
                  </defs>
                  {/* Square Scarf on Diamond/Draped Angle */}
                  <g transform="rotate(4 220 220)">
                    <rect
                      x="40"
                      y="40"
                      width="360"
                      height="360"
                      rx="8"
                      fill="url(#pattern-scarf)"
                      stroke="#f59e0b"
                      strokeWidth="6"
                    />
                    <rect
                      x="40"
                      y="40"
                      width="360"
                      height="360"
                      rx="8"
                      fill="url(#silk-sheen)"
                      style={{ mixBlendMode: 'overlay' }}
                    />
                    {/* Rolled hem inner stitch */}
                    <rect
                      x="52"
                      y="52"
                      width="336"
                      height="336"
                      rx="4"
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      strokeDasharray="4,3"
                      opacity="0.6"
                    />
                  </g>
                </svg>
              )}

              {/* Product: Throw Cushion */}
              {activeProduct === 'pillow' && (
                <svg
                  viewBox="0 0 440 440"
                  className="w-full h-full drop-shadow-[0_25px_40px_rgba(0,0,0,0.85)]"
                >
                  <defs>
                    <pattern
                      id="pattern-pillow"
                      width={tileSize}
                      height={tileSize}
                      patternUnits="userSpaceOnUse"
                    >
                      <image href={tileDataUrl} width={tileSize} height={tileSize} />
                    </pattern>
                    <radialGradient id="cushion-puff" cx="50%" cy="50%" r="55%">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="0.25" />
                      <stop offset="60%" stopColor="#000000" stopOpacity="0.1" />
                      <stop offset="100%" stopColor="#000000" stopOpacity="0.5" />
                    </radialGradient>
                  </defs>
                  {/* Cushion with pinched corners */}
                  <path
                    d="M40,40 Q220,70 400,40 Q370,220 400,400 Q220,370 40,400 Q70,220 40,40 Z"
                    fill="url(#pattern-pillow)"
                    stroke="#1c1917"
                    strokeWidth="3"
                  />
                  <path
                    d="M40,40 Q220,70 400,40 Q370,220 400,400 Q220,370 40,400 Q70,220 40,40 Z"
                    fill="url(#cushion-puff)"
                    style={{ mixBlendMode: 'multiply' }}
                  />
                  {/* Center tuft button */}
                  <circle cx="220" cy="220" r="8" fill="#1c1917" opacity="0.4" />
                </svg>
              )}

              {/* Product: Canvas Tote Bag */}
              {activeProduct === 'totebag' && (
                <svg
                  viewBox="0 0 400 480"
                  className="w-full h-full drop-shadow-[0_20px_35px_rgba(0,0,0,0.8)]"
                >
                  <defs>
                    <pattern
                      id="pattern-tote"
                      width={tileSize}
                      height={tileSize}
                      patternUnits="userSpaceOnUse"
                    >
                      <image href={tileDataUrl} width={tileSize} height={tileSize} />
                    </pattern>
                    <linearGradient id="tote-depth" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#000" stopOpacity="0.3" />
                      <stop offset="50%" stopColor="#fff" stopOpacity="0.1" />
                      <stop offset="100%" stopColor="#000" stopOpacity="0.3" />
                    </linearGradient>
                  </defs>
                  {/* Handles */}
                  <path
                    d="M130,160 C130,20 270,20 270,160"
                    fill="none"
                    stroke="#d4a373"
                    strokeWidth="16"
                    strokeLinecap="round"
                  />
                  {/* Bag Body */}
                  <rect
                    x="70"
                    y="150"
                    width="260"
                    height="300"
                    rx="12"
                    fill="url(#pattern-tote)"
                    stroke="#78716c"
                    strokeWidth="2"
                  />
                  <rect
                    x="70"
                    y="150"
                    width="260"
                    height="300"
                    rx="12"
                    fill="url(#tote-depth)"
                    style={{ mixBlendMode: 'multiply' }}
                  />
                </svg>
              )}
            </div>
          )}

          {/* Product Info Chip */}
          <div className="absolute bottom-4 left-6 bg-[#101114]/90 backdrop-blur px-3 py-1.5 rounded-lg border border-[#252a31] text-xs flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-[#18c98a]" />
            <span className="font-semibold text-[#f5f7f8] capitalize">
              {activeProduct.replace('-', ' ')}
            </span>
            <span className="text-[#77808c]">|</span>
            <span className="text-[#aeb5bf] font-mono">
              Tile: {settings.physicalSize} {settings.physicalUnit}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
